/**
 * atomic-profit-guard.js — Radar multi-piscina de SOLO LECTURA ($0 gas) + guard de ganancia.
 *
 * Evalúa ciclos cerrados USDC ➔ WPOL/WBNB ➔ USDC cotizando con eth_call (Quoter V3 / getAmountsOut V2)
 * en TODAS las combinaciones compra/venta de piscinas. Nunca firma nada ni usa claves privadas.
 *
 * IMPORTANTE: sin contrato ejecutor, las dos patas serían dos transacciones (no atómicas).
 * Este módulo solo decide si un ciclo SERÍA rentable: neto >= MIN_NET_PROFIT_USDC tras fees y gas.
 */
require("dotenv").config();
const { ethers } = require("ethers");

const MIN_NET_PROFIT_USDC = 0.05;
const GAS_LIMIT_ROUND_TRIP = 400000n; // 2 swaps

const V3_QUOTER_ABI = ["function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160,uint32,uint256)"];
const V2_ROUTER_ABI = ["function getAmountsOut(uint256 amountIn,address[] path) view returns (uint256[] amounts)"];

const CHAINS = {
  polygon: {
    rpcEnv: "POLYGON_RPC_URL", usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", usdcDec: 6,
    wrapped: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", symbol: "WPOL", defaultUsdc: 160,
    venues: [
      { name: "Uniswap V3 0.05%", type: "v3", quoter: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e", fee: 500 },
      { name: "Uniswap V3 0.30%", type: "v3", quoter: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e", fee: 3000 },
      { name: "Uniswap V3 0.01%", type: "v3", quoter: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e", fee: 100 },
      { name: "QuickSwap V2", type: "v2", router: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff" },
      { name: "SushiSwap V2", type: "v2", router: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506" }
    ]
  },
  bsc: {
    rpcEnv: "BNB_RPC_URL", usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", usdcDec: 18,
    wrapped: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB", defaultUsdc: 20,
    venues: [
      { name: "PancakeSwap V3 0.01%", type: "v3", quoter: "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997", fee: 100 },
      { name: "PancakeSwap V3 0.05%", type: "v3", quoter: "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997", fee: 500 },
      { name: "PancakeSwap V2", type: "v2", router: "0x10ED43C718714eb63d5aA57B78B54704E256024E" },
      { name: "BiSwap V2", type: "v2", router: "0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8" }
    ]
  }
};

async function quote(provider, v, tokenIn, tokenOut, amountIn) {
  try {
    if (v.type === "v3") {
      const iface = new ethers.Interface(V3_QUOTER_ABI);
      const data = iface.encodeFunctionData("quoteExactInputSingle", [{ tokenIn, tokenOut, amountIn, fee: v.fee, sqrtPriceLimitX96: 0 }]);
      const raw = await provider.call({ to: v.quoter, data });
      return iface.decodeFunctionResult("quoteExactInputSingle", raw)[0];
    }
    const r = new ethers.Contract(v.router, V2_ROUTER_ABI, provider);
    const out = await r.getAmountsOut(amountIn, [tokenIn, tokenOut]);
    return out[1];
  } catch (_) {
    return null; // piscina inexistente / sin liquidez
  }
}

/**
 * Evalúa todas las combinaciones compra/venta. Devuelve { best, rows, shouldFire }.
 * shouldFire === true solo si USDC_final >= USDC_inicial + gas_en_USDC + MIN_NET_PROFIT_USDC.
 */
async function evaluateRoundTrip(chainKey, usdcAmount, providerOverride) {
  const c = CHAINS[chainKey];
  const url = process.env[c.rpcEnv];
  if (!providerOverride && !url) throw new Error(`Falta ${c.rpcEnv} en .env`);
  const provider = providerOverride || new ethers.JsonRpcProvider(url);
  const amtIn = ethers.parseUnits(String(usdcAmount), c.usdcDec);

  // Cotizaciones de compra (USDC ➔ wrapped) en todas las piscinas, en paralelo
  const buys = await Promise.all(c.venues.map(v => quote(provider, v, c.usdc, c.wrapped, amtIn)));

  // Precio del token en USDC (para convertir gas) usando la mejor compra
  const bestBuy = buys.reduce((m, x) => (x && x > m ? x : m), 0n);
  const tokensOut = bestBuy > 0n ? Number(ethers.formatUnits(bestBuy, 18)) : 0;
  const tokenPriceUsdc = tokensOut > 0 ? usdcAmount / tokensOut : 0;
  const fee = await provider.getFeeData();
  const gasPrice = fee.maxFeePerGas || fee.gasPrice || 0n;
  const gasNative = Number(ethers.formatUnits(gasPrice * GAS_LIMIT_ROUND_TRIP, 18));
  const gasUsdc = gasNative * tokenPriceUsdc;

  const rows = [];
  for (let i = 0; i < c.venues.length; i++) {
    if (!buys[i]) continue;
    const sells = await Promise.all(c.venues.map(v => quote(provider, v, c.wrapped, c.usdc, buys[i])));
    for (let j = 0; j < c.venues.length; j++) {
      if (!sells[j]) continue;
      const finalUsdc = Number(ethers.formatUnits(sells[j], c.usdcDec));
      const gross = finalUsdc - usdcAmount;
      const net = gross - gasUsdc;
      rows.push({ buy: c.venues[i].name, sell: c.venues[j].name, finalUsdc, grossUsdc: gross, gasUsdc, netUsdc: net, netPct: (net / usdcAmount) * 100 });
    }
  }
  rows.sort((a, b) => b.netUsdc - a.netUsdc);
  const best = rows[0] || null;
  return { chain: chainKey, usdcAmount, gasUsdc, tokenPriceUsdc, best, rows, shouldFire: !!best && best.netUsdc >= MIN_NET_PROFIT_USDC };
}

async function runRadar() {
  console.log("\n🛰️ [RADAR ATÓMICO MULTI-PISCINA · $0 GAS · SOLO LECTURA]");
  const out = {};
  for (const key of Object.keys(CHAINS)) {
    try {
      const r = await evaluateRoundTrip(key, CHAINS[key].defaultUsdc);
      out[key] = r;
      console.log(`\n  ${key.toUpperCase()} · ciclo USDC ➔ ${CHAINS[key].symbol} ➔ USDC con ${r.usdcAmount} USDC (gas ≈ $${r.gasUsdc.toFixed(4)})`);
      r.rows.slice(0, 5).forEach(x => console.log(`    ${x.buy} ➔ ${x.sell}: final ${x.finalUsdc.toFixed(4)} | neto ${x.netUsdc >= 0 ? "+" : ""}${x.netUsdc.toFixed(4)} USDC (${x.netPct.toFixed(3)}%)`));
      console.log(r.shouldFire
        ? `    ✅ Umbral superado (neto >= +$${MIN_NET_PROFIT_USDC}). Solo informativo: ningún disparo se firma desde aquí.`
        : `    ⛔ Sin ganancia neta >= +$${MIN_NET_PROFIT_USDC}: NO se firmaría nada ($0.00 gas).`);
    } catch (e) {
      console.log(`  ${key.toUpperCase()}: error de lectura (${e.message})`);
    }
  }
  return out;
}

module.exports = { evaluateRoundTrip, runRadar, MIN_NET_PROFIT_USDC, CHAINS };

if (require.main === module) runRadar().then(() => process.exit(0));
