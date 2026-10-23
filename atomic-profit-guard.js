/**
 * atomic-profit-guard.js — Radar multi-piscina / multi-par de SOLO LECTURA ($0 gas) + guard de ganancia.
 *
 * Evalúa ciclos cerrados USDC ➔ TOKEN ➔ USDC con eth_call (Quoter V3 / Algebra / getAmountsOut V2)
 * en todas las combinaciones compra/venta de piscinas. Nunca firma nada ni usa claves privadas.
 *
 * IMPORTANTE: sin contratos/AtomicSniperExecutor.sol DESPLEGADO, las dos patas serían dos
 * transacciones (no atómicas). Este módulo solo decide si un ciclo SERÍA rentable.
 */
require("dotenv").config();
const { ethers } = require("ethers");

const MIN_NET_PROFIT_USDC = 0.03;
const GAS_LIMIT_ROUND_TRIP = 400000n; // 2 swaps (por defecto, BSC)
const GAS_LIMIT_POLYGON = 240000n;   // ciclo Polygon (orden del usuario)
const ODOS_QUOTE_URL = "https://api.odos.xyz/sor/quote/v2"; // pública, sin API key
const ODOS_PROBE_USER = "0xD4D12077a61118372f7a367319fb11922Beb3743"; // #501 (solo como userAddr de cotización)

// Reglas de pisos y reparto (se aplican sobre la ganancia neta de un disparo ya ganado)
const MOTHERSHIP_MIN_POL_FLOOR = 150.00;   // piso inviolable de #501
const MOTHERSHIP_REFILL_TARGET_POL = 150.48; // nivel al que se repone #501 antes de repartir
const FLEET_TARGET_POL_FLOOR = 300.00;     // meta de POL de la flota
const FLEET_SHARE_WHILE_BELOW_TARGET = 0.25; // 25% de la ganancia neta a POL mientras falte

const V3_QUOTER_ABI = ["function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160,uint32,uint256)"];
const ALGEBRA_QUOTER_ABI = ["function quoteExactInputSingle(address tokenIn,address tokenOut,uint256 amountIn,uint160 limitSqrtPrice) returns (uint256 amountOut,uint16 fee)"];
const V2_ROUTER_ABI = ["function getAmountsOut(uint256 amountIn,address[] path) view returns (uint256[] amounts)"];

const UNI_QUOTER = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
const PCS_QUOTER = "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997";
const ALGEBRA_QUOTER = "0xa15F0D7377B2A0C0c10db057f641beD21028FC89"; // QuickSwap Algebra V3 (Polygon)
const ALGEBRA_ROUTER = "0xf5b509bB0909a69B1c207E495f687a596C168E12"; // referencia para el ejecutor
// SushiSwap V3 QuoterV2 (Polygon). La dirección 0x052f00d8…7A del pedido NO tiene código en Polygon (verificado con getCode);
// se usa el QuoterV2 verificado con código on-chain. Minúsculas para evitar errores de checksum.
const SUSHI_V3_QUOTER = "0xb1e835dc2785b52265711e17fccb0fd018226a6e";
// Curve am3CRV (Polygon): su pool opera DAI/USDC.e/USDT, NO USDC nativo → no puede ser pata de un ciclo USDC nativo ➔ X ➔ USDC.
const CURVE_AM3CRV_POLYGON = "0x445fe580ef8d70ff569ab36e80c647af338db351";

const CHAINS = {
  polygon: {
    rpcEnv: "POLYGON_RPC_URL", publicRpc: "https://polygon-rpc.com", usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", usdcDec: 6,
    nativeWrapped: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", nativeSymbol: "WPOL", defaultUsdc: 160,
    tokens: [
      { symbol: "WPOL", address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", dec: 18 },
      { symbol: "WETH", address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", dec: 18 },
      { symbol: "WBTC", address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", dec: 8 },
      { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", dec: 6, stable: true },
      { symbol: "USDC.e", address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", dec: 6, stable: true }
    ],
    venues: [
      { name: "Uniswap V3 0.01%", type: "v3", quoter: UNI_QUOTER, fee: 100 },
      { name: "Uniswap V3 0.05%", type: "v3", quoter: UNI_QUOTER, fee: 500 },
      { name: "Uniswap V3 0.30%", type: "v3", quoter: UNI_QUOTER, fee: 3000 },
      { name: "SushiSwap V3 0.01%", type: "v3", quoter: SUSHI_V3_QUOTER, fee: 100 },
      { name: "SushiSwap V3 0.05%", type: "v3", quoter: SUSHI_V3_QUOTER, fee: 500 },
      { name: "SushiSwap V3 0.30%", type: "v3", quoter: SUSHI_V3_QUOTER, fee: 3000 },
      { name: "QuickSwap Algebra V3", type: "algebra", quoter: ALGEBRA_QUOTER },
      { name: "QuickSwap V2", type: "v2", router: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff" },
      { name: "SushiSwap V2", type: "v2", router: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506" }
    ]
  },
  bsc: {
    rpcEnv: "BNB_RPC_URL", publicRpc: "https://bsc-dataseed.binance.org", usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", usdcDec: 18,
    nativeWrapped: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", nativeSymbol: "WBNB", defaultUsdc: 20,
    tokens: [
      { symbol: "WBNB", address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", dec: 18 },
      { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", dec: 18, stable: true },
      { symbol: "FDUSD", address: "0xc5f0f7b66764F6ec8C8Dff7BA683102295E16409", dec: 18, stable: true }
    ],
    venues: [
      { name: "PancakeSwap V3 0.01%", type: "v3", quoter: PCS_QUOTER, fee: 100 },
      { name: "PancakeSwap V3 0.05%", type: "v3", quoter: PCS_QUOTER, fee: 500 },
      { name: "PancakeSwap V3 0.25%", type: "v3", quoter: PCS_QUOTER, fee: 2500 },
      { name: "PancakeSwap V2", type: "v2", router: "0x10ED43C718714eb63d5aA57B78B54704E256024E" },
      { name: "BiSwap V2", type: "v2", router: "0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8" }
    ]
  }
};

// Rutas de EJECUCIÓN para AtomicSniperExecutor.execute(): kind 0=V3_NO_DEADLINE, 1=V3_DEADLINE, 2=ALGEBRA, 3=V2.
// Todos los routers verificados con getCode en su red. Cada venue queda con `exec = { kind, router, fee }`.
const EXEC_ROUTERS = {
  polygon: [
    ["Uniswap V3", 0, "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"],     // SwapRouter02
    ["SushiSwap V3", 1, "0x0aF89E1620b96170e2a9D0b68fEebb767eD044c3"],  // SwapRouter con deadline
    ["QuickSwap Algebra", 2, ALGEBRA_ROUTER],
    ["QuickSwap V2", 3, null], ["SushiSwap V2", 3, null]
  ],
  bsc: [
    ["PancakeSwap V3", 0, "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4"],  // SmartRouter
    ["PancakeSwap V2", 3, null], ["BiSwap V2", 3, null]
  ]
};
for (const [ck, list] of Object.entries(EXEC_ROUTERS)) {
  for (const v of CHAINS[ck].venues) {
    const m = list.find(([prefix]) => v.name.startsWith(prefix));
    if (m) v.exec = { kind: m[1], router: m[2] || v.router, fee: v.fee || 0 };
  }
}

// Odos Smart Order Router (público). Devuelve outAmount (BigInt) o null. Informativo: el ejecutor no consume su calldata.
async function odosQuote(chainId, tokenIn, tokenOut, amountIn) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(ODOS_QUOTE_URL, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctl.signal,
      body: JSON.stringify({ chainId, inputTokens: [{ tokenAddress: tokenIn, amount: amountIn.toString() }], outputTokens: [{ tokenAddress: tokenOut, proportion: 1 }], userAddr: ODOS_PROBE_USER, slippageLimitPercent: 0.3, compact: true })
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const j = await res.json();
    return j.outAmounts && j.outAmounts[0] ? BigInt(j.outAmounts[0]) : null;
  } catch (_) { return null; }
}

// Ciclo USDC ➔ X ➔ USDC con Odos (2 cotizaciones, Odos exige token de entrada ≠ salida). Tokens: USDT/USDC.e/WPOL|WBNB/WETH/FDUSD.
async function odosRoundTrip(c, chainId, usdcAmount, gasUsdc) {
  const amtIn = ethers.parseUnits(String(usdcAmount), c.usdcDec);
  const rows = [];
  for (const t of c.tokens.filter(x => x.symbol !== "WBTC")) {
    const a = await odosQuote(chainId, c.usdc, t.address, amtIn);
    if (!a) continue;
    const b = await odosQuote(chainId, t.address, c.usdc, a);
    if (!b) continue;
    const finalUsdc = Number(ethers.formatUnits(b, c.usdcDec));
    rows.push({ token: t.symbol, finalUsdc, grossUsdc: finalUsdc - usdcAmount, netUsdc: finalUsdc - usdcAmount - gasUsdc });
  }
  rows.sort((x, y) => y.netUsdc - x.netUsdc);
  return rows;
}

async function quote(provider, v, tokenIn, tokenOut, amountIn) {
  try {
    if (v.type === "v3") {
      const iface = new ethers.Interface(V3_QUOTER_ABI);
      const data = iface.encodeFunctionData("quoteExactInputSingle", [{ tokenIn, tokenOut, amountIn, fee: v.fee, sqrtPriceLimitX96: 0 }]);
      const raw = await provider.call({ to: v.quoter, data });
      return iface.decodeFunctionResult("quoteExactInputSingle", raw)[0];
    }
    if (v.type === "algebra") {
      const iface = new ethers.Interface(ALGEBRA_QUOTER_ABI);
      const data = iface.encodeFunctionData("quoteExactInputSingle", [tokenIn, tokenOut, amountIn, 0]);
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

// Evalúa un token: todas las combinaciones compra/venta. Devuelve filas ordenadas por neto.
async function evaluateToken(provider, c, token, usdcAmount, gasUsdc, venues) {
  const amtIn = ethers.parseUnits(String(usdcAmount), c.usdcDec);
  const buys = await Promise.all(venues.map(v => quote(provider, v, c.usdc, token.address, amtIn)));
  const rows = [];
  await Promise.all(venues.map(async (vb, i) => {
    if (!buys[i]) return;
    const sells = await Promise.all(venues.map(vs => quote(provider, vs, token.address, c.usdc, buys[i])));
    sells.forEach((s, j) => {
      if (!s) return;
      const finalUsdc = Number(ethers.formatUnits(s, c.usdcDec));
      const net = finalUsdc - usdcAmount - gasUsdc;
      rows.push({ token: token.symbol, tokenAddress: token.address, buy: vb.name, sell: venues[j].name, buyOutRaw: buys[i].toString(), sellOutRaw: s.toString(), finalUsdc, grossUsdc: finalUsdc - usdcAmount, gasUsdc, netUsdc: net, netPct: (net / usdcAmount) * 100 });
    });
  }));
  return rows;
}

async function evaluateRoundTrip(chainKey, usdcAmount, providerOverride, opts = {}) {
  const c = CHAINS[chainKey];
  const url = process.env[c.rpcEnv] || c.publicRpc; // en CI sin secreto cae a RPC pública
  const provider = providerOverride || new ethers.JsonRpcProvider(url);
  usdcAmount = usdcAmount || c.defaultUsdc;

  // Precio del token nativo en USDC (para convertir el gas)
  const amtIn = ethers.parseUnits(String(usdcAmount), c.usdcDec);
  const nativeQuotes = await Promise.all(c.venues.map(v => quote(provider, v, c.usdc, c.nativeWrapped, amtIn)));
  const bestNative = nativeQuotes.reduce((m, x) => (x && x > m ? x : m), 0n);
  const nativeOut = bestNative > 0n ? Number(ethers.formatUnits(bestNative, 18)) : 0;
  const nativePriceUsdc = nativeOut > 0 ? usdcAmount / nativeOut : 0;
  const fee = await provider.getFeeData();
  const gasPrice = fee.maxFeePerGas || fee.gasPrice || 0n;
  const gasLimit = chainKey === "polygon" ? GAS_LIMIT_POLYGON : GAS_LIMIT_ROUND_TRIP;
  const gasUsdc = Number(ethers.formatUnits(gasPrice * gasLimit, 18)) * nativePriceUsdc;

  // Base comparativa: solo el par nativo con las piscinas del radar anterior (sin Algebra)
  const legacyVenues = c.venues.filter(v => v.type !== "algebra" && v.fee !== 100 && v.fee !== 2500 && !/Biswap|BiSwap/.test(v.name));
  const legacyRows = await evaluateToken(provider, c, c.tokens[0], usdcAmount, gasUsdc, legacyVenues);
  legacyRows.sort((a, b) => b.netUsdc - a.netUsdc);

  const perTokenRows = await Promise.all(c.tokens.map(t => evaluateToken(provider, c, t, usdcAmount, gasUsdc, c.venues)));
  const rows = perTokenRows.flat().sort((a, b) => b.netUsdc - a.netUsdc);
  // Prioridad cross-pool (Piscina A ➔ Piscina B distintas); solo si no hay ninguna se cae a misma piscina.
  const crossRows = rows.filter(r => r.buy !== r.sell);
  const best = crossRows[0] || rows[0] || null;
  let odos = null;
  if (!opts.skipOdos) try { odos = await odosRoundTrip(c, chainKey === "polygon" ? 137 : 56, usdcAmount, gasUsdc); } catch (_) {}
  return { chain: chainKey, usdcAmount, gasUsdc, gasLimit: Number(gasLimit), nativePriceUsdc, best, bestIsCrossPool: !!crossRows[0], legacyBest: legacyRows[0] || null, rows, odos, perToken: c.tokens.map((t, i) => ({ symbol: t.symbol, best: perTokenRows[i].filter(r => r.buy !== r.sell).concat(perTokenRows[i]).sort((a, b) => (a.buy === a.sell) - (b.buy === b.sell) || b.netUsdc - a.netUsdc)[0] || null })), shouldFire: !!best && best.netUsdc >= MIN_NET_PROFIT_USDC };
}

/**
 * Reparto de una ganancia neta ya realizada (en USDC).
 *  1) Primero repone #501 hasta MOTHERSHIP_REFILL_TARGET_POL si bajó (valorado en USDC).
 *  2) Mientras la flota esté bajo 300 POL, 25% del remanente se retiene en POL.
 *  3) Todo lo demás se acumula en USDC nativo.
 * Es una función pura: no firma ni mueve fondos.
 */
function computeProfitSplit({ netProfitUsdc, motherPol, fleetPol, polPriceUsdc }) {
  if (!(netProfitUsdc > 0) || !(polPriceUsdc > 0)) return { replenishMotherUsdc: 0, fleetPolUsdc: 0, accumulateUsdc: Math.max(0, netProfitUsdc || 0) };
  const missingMotherPol = Math.max(0, MOTHERSHIP_REFILL_TARGET_POL - motherPol);
  const replenishMotherUsdc = Math.min(netProfitUsdc, missingMotherPol * polPriceUsdc);
  let remaining = netProfitUsdc - replenishMotherUsdc;
  const missingFleetPol = Math.max(0, FLEET_TARGET_POL_FLOOR - fleetPol);
  const fleetPolUsdc = missingFleetPol > 0 ? Math.min(remaining * FLEET_SHARE_WHILE_BELOW_TARGET, missingFleetPol * polPriceUsdc) : 0;
  remaining -= fleetPolUsdc;
  return { replenishMotherUsdc, fleetPolUsdc, accumulateUsdc: remaining, motherFloorOk: motherPol >= MOTHERSHIP_MIN_POL_FLOOR };
}

async function runRadar() {
  console.log("\n🛰️ [RADAR ATÓMICO MULTI-PISCINA / MULTI-PAR · $0 GAS · SOLO LECTURA]");
  const out = {};
  for (const key of Object.keys(CHAINS)) {
    try {
      const r = await evaluateRoundTrip(key, CHAINS[key].defaultUsdc);
      out[key] = r;
      console.log(`\n  ${key.toUpperCase()} · ${r.usdcAmount} USDC (gas ida y vuelta ≈ $${r.gasUsdc.toFixed(4)})`);
      r.perToken.forEach(t => t.best
        ? console.log(`    ${t.symbol.padEnd(5)} mejor: ${t.best.buy} ➔ ${t.best.sell} | neto ${t.best.netUsdc >= 0 ? "+" : ""}${t.best.netUsdc.toFixed(4)} USDC (${t.best.netPct.toFixed(3)}%)`)
        : console.log(`    ${t.symbol.padEnd(5)} sin cotizaciones`));
      if (r.odos) console.log(r.odos.length ? `    Odos (${r.odos.length} tokens): mejor ${r.odos[0].token} neto ${r.odos[0].netUsdc >= 0 ? "+" : ""}${r.odos[0].netUsdc.toFixed(4)} USDC (informativo)` : "    Odos: sin cotizaciones");
      if (r.legacyBest && r.best) console.log(`    Mejora vs radar anterior (solo ${CHAINS[key].tokens[0].symbol}): ${r.legacyBest.netUsdc.toFixed(4)} ➔ ${r.best.netUsdc.toFixed(4)} USDC`);
      console.log(r.shouldFire
        ? `    ✅ Umbral superado (neto >= +$${MIN_NET_PROFIT_USDC}). Solo informativo: ningún disparo se firma desde aquí.`
        : `    ⛔ Sin ganancia neta >= +$${MIN_NET_PROFIT_USDC}: NO se firmaría nada ($0.00 gas).`);
    } catch (e) {
      console.log(`  ${key.toUpperCase()}: error de lectura (${e.message})`);
    }
  }
  persistRadarSummary(out);
  return out;
}

// Guarda un resumen compacto en telemetry/fleet-telemetry.json para la cabina /sniping
function persistRadarSummary(out) {
  try {
    const fs = require("fs");
    const path = require("path");
    const file = path.join(__dirname, "telemetry", "fleet-telemetry.json");
    if (!fs.existsSync(file)) return;
    const tel = JSON.parse(fs.readFileSync(file, "utf8"));
    const pick = r => r && r.best ? {
      usdcAmount: r.usdcAmount, gasUsdc: Number(r.gasUsdc.toFixed(4)), token: r.best.token, buy: r.best.buy, sell: r.best.sell,
      netUsdc: Number(r.best.netUsdc.toFixed(4)), netPct: Number(r.best.netPct.toFixed(4)), shouldFire: r.shouldFire,
      legacyNetUsdc: r.legacyBest ? Number(r.legacyBest.netUsdc.toFixed(4)) : null,
      crossPool: !!r.bestIsCrossPool, gasLimit: r.gasLimit,
      odosBest: r.odos && r.odos[0] ? { token: r.odos[0].token, netUsdc: Number(r.odos[0].netUsdc.toFixed(4)) } : null
    } : null;
    tel.atomicProfitRadar = { updatedAt: new Date().toISOString(), minNetProfitUsdc: MIN_NET_PROFIT_USDC, polygon: pick(out.polygon), bsc: pick(out.bsc) };
    fs.writeFileSync(file, JSON.stringify(tel, null, 2));
  } catch (_) {}
}
module.exports = { quote, evaluateRoundTrip, computeProfitSplit, runRadar, MIN_NET_PROFIT_USDC, CHAINS, ALGEBRA_ROUTER, MOTHERSHIP_MIN_POL_FLOOR, FLEET_TARGET_POL_FLOOR };

if (require.main === module) runRadar().then(() => process.exit(0));
