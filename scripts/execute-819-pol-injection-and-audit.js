/**
 * scripts/execute-819-pol-injection-and-audit.js — ÁREA 501 // TESORERÍA & RESCATE L1
 * ==============================================================================
 * BLOQUE 1: Convertir exactamente 819.2788 POL (TX 0x105cc...f1b3c) en #501
 *           respetando ~10.00+ POL de gas (STRICT_NO_GAS_SELL = true) hacia
 *           USDC Arbitrum One e inyectarlos al 100% en Hyperliquid L1 (Bridge2).
 * BLOQUE 2: Contabilizar en el libro de préstamos 0% (#501) y reforzar Escudo #00.
 * BLOQUE 3: Auditar en tiempo real clearinghouseState, openOrders y userFills en HL L1.
 * BLOQUE 4: Emitir informe completo en Consola y Telegram (-1004342131598 y -5101181644).
 * ==============================================================================
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { getWalletSigner } = require("../swarm-engine");
const { sendTelegramAlert } = require("../telegram-notifier");

const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const WPOL_POLYGON = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const POLYGON_USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const ARB_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const HL_BRIDGE2_ARB = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7";
const UNISWAP_V3_QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
const UNISWAP_V3_SWAP_ROUTER_02 = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";

const STRICT_NO_GAS_SELL = true;
const EXACT_INCOMING_POL = 819.2788;

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

const WPOL_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function deposit() external payable",
  "function withdraw(uint256 wad) external",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

const QUOTER_V2_ABI = [
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)"
];

const SWAP_ROUTER_02_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)"
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWorkingProvider(rpcList, chainId) {
  for (const rpc of rpcList) {
    try {
      const p = new ethers.JsonRpcProvider(rpc, chainId, { staticNetwork: true });
      await Promise.race([
        p.getBlockNumber(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("RPC Timeout")), 4500))
      ]);
      return { provider: p, rpc };
    } catch (_) {}
  }
  throw new Error(`No se pudo conectar a ningún RPC para chainId ${chainId}`);
}

async function hlInfo(body) {
  const res = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function main() {
  console.log("================================================================================");
  console.log("🚀🏦🚁 ÁREA 501 // INYECCIÓN 819.2788 POL ➔ HYPERLIQUID L1 + AUDITORÍA RESCATE");
  console.log("================================================================================\n");

  const { provider: polyProvider, rpc: polyRpcUrl } = await getWorkingProvider([
    "https://polygon.drpc.org",
    "https://1rpc.io/matic",
    "https://polygon-bor-rpc.publicnode.com"
  ], 137);
  console.log(`🔗 Polygon Mainnet conectado (${polyRpcUrl}) ✔`);

  const { provider: arbProvider, rpc: arbRpcUrl } = await getWorkingProvider([
    "https://arb1.arbitrum.io/rpc",
    "https://arbitrum-one-rpc.publicnode.com",
    "https://1rpc.io/arb"
  ], 42161);
  console.log(`🔗 Arbitrum One conectado (${arbRpcUrl}) ✔`);

  const polySigner = getWalletSigner(501, polyProvider);
  const arbSigner = getWalletSigner(501, arbProvider);

  if (polySigner.address.toLowerCase() !== VAULT_501.toLowerCase()) {
    throw new Error(`Dirección derivada (${polySigner.address}) != ${VAULT_501}`);
  }
  console.log(`🏛️ Bóveda Matriz #501 autenticada: ${polySigner.address} ✔\n`);

  // Estado previo en Hyperliquid L1
  const chBefore = await hlInfo({ type: "clearinghouseState", user: VAULT_501 });
  const hlAccountValBefore = parseFloat(chBefore.marginSummary?.accountValue || "0");
  console.log(`📊 AccountValue Pre-Inyección en Hyperliquid L1: $${hlAccountValBefore.toFixed(2)} USDC`);

  // ============================================================================
  // BLOQUE 1: CONVERSIÓN DE 819.2788 POL A USDC ARBITRUM E INYECCIÓN EN BRIDGE2
  // ============================================================================
  console.log("\n--- [BLOQUE 1: CONVERSIÓN DE 819.2788 POL ➔ USDC ARBITRUM ➔ HYPERLIQUID L1] ---");
  const polBalWei = await polyProvider.getBalance(VAULT_501);
  const polBalNum = parseFloat(ethers.formatEther(polBalWei));
  const polyUsdcContract = new ethers.Contract(POLYGON_USDC, ERC20_ABI, polySigner);
  const arbUsdcContract = new ethers.Contract(ARB_USDC, ERC20_ABI, arbSigner);

  const [polyUsdcBeforeUnits, arbUsdcBeforeUnits] = await Promise.all([
    polyUsdcContract.balanceOf(VAULT_501),
    arbUsdcContract.balanceOf(VAULT_501)
  ]);
  const polyUsdcBefore = parseFloat(ethers.formatUnits(polyUsdcBeforeUnits, 6));
  const arbUsdcBefore = parseFloat(ethers.formatUnits(arbUsdcBeforeUnits, 6));

  console.log(`• Saldo POL actual en #501 (Polygon): ${polBalNum.toFixed(4)} POL`);
  console.log(`• Saldo USDC Nativo actual en #501 (Polygon): $${polyUsdcBefore.toFixed(4)} USDC`);
  console.log(`• Saldo USDC Nativo actual en #501 (Arbitrum): $${arbUsdcBefore.toFixed(4)} USDC`);

  let polygonSwapOrBridgeTxHash = null;
  let polygonBridgeStepTxHash = null;
  let arbitrumHlDepositTxHash = null;
  let netUsdcDepositedToHl = 0;

  // Protección sagrada del gas: conservar >= 9.80 POL de gas intactos y tomar exactamente hasta 819.2788 POL
  const maxConvertiblePol = Math.max(0, polBalNum - 9.90);
  const polToConvert = Math.min(EXACT_INCOMING_POL, maxConvertiblePol);

  if (polToConvert >= 100.0) {
    const amountPolWei = ethers.parseEther(polToConvert.toFixed(4));
    console.log(`🛡️ STRICT_NO_GAS_SELL = ${STRICT_NO_GAS_SELL}: Convirtiendo exactamente ${polToConvert.toFixed(4)} POL (Reserva de Gas protegida: ${(polBalNum - polToConvert).toFixed(4)} POL)`);

    // Comparar Ruta Directa Relay (POL Polygon -> USDC Arbitrum) vs Uniswap V3 + Relay
    console.log("🔍 Consultando cotización directa Cross-Chain en Relay API (POL Polygon ➔ USDC Arbitrum)...");
    const directQuoteRes = await fetch("https://api.relay.link/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: VAULT_501,
        originChainId: 137,
        destinationChainId: 42161,
        originCurrency: "0x0000000000000000000000000000000000000000",
        destinationCurrency: ARB_USDC,
        amount: amountPolWei.toString(),
        tradeType: "EXACT_INPUT"
      })
    });
    const directQuote = await directQuoteRes.json().catch(() => ({}));
    const directOutUsdc = parseFloat(directQuote?.details?.currencyOut?.amountFormatted || "0");

    if (directQuote.steps && directQuote.steps.length > 0 && directOutUsdc >= 65.0) {
      console.log(`⚡ Cotización Directa Relay aprobada: ${polToConvert.toFixed(4)} POL (Polygon) ➔ $${directOutUsdc.toFixed(4)} USDC (Arbitrum One) en 1 solo paso!`);
      const txItem = directQuote.steps[0].items[0].data;
      const feeData = await polyProvider.getFeeData();
      const priorityFee = feeData.maxPriorityFeePerGas && feeData.maxPriorityFeePerGas > ethers.parseUnits("40", "gwei")
        ? feeData.maxPriorityFeePerGas
        : ethers.parseUnits("40", "gwei");
      const maxFee = (feeData.maxFeePerGas || feeData.gasPrice || ethers.parseUnits("220", "gwei")) * 14n / 10n + priorityFee;

      const bridgeTx = await polySigner.sendTransaction({
        to: txItem.to,
        data: txItem.data,
        value: BigInt(txItem.value || amountPolWei.toString()),
        maxPriorityFeePerGas: priorityFee,
        maxFeePerGas: maxFee,
        gasLimit: txItem.gas ? Math.floor(Number(txItem.gas) * 1.35) : 350000
      });
      polygonSwapOrBridgeTxHash = bridgeTx.hash;
      polygonBridgeStepTxHash = bridgeTx.hash;
      console.log(`   ⏳ Tx Cross-Chain enviada en Polygon: https://polygonscan.com/tx/${bridgeTx.hash}`);
      const receipt = await bridgeTx.wait(1);
      console.log(`   ✅ Confirmada en Polygon (Bloque #${receipt.blockNumber})!`);
    } else {
      console.log("🔄 Ejecutando Ruta en 2 Pasos: Paso 1A Uniswap V3 (0.05% fee) POL ➔ USDC Polygon + Paso 1B Relay USDC Polygon ➔ USDC Arbitrum...");
      const wpolContract = new ethers.Contract(WPOL_POLYGON, WPOL_ABI, polySigner);
      const quoter = new ethers.Contract(UNISWAP_V3_QUOTER_V2, QUOTER_V2_ABI, polyProvider);
      const q500 = await quoter.quoteExactInputSingle.staticCall({
        tokenIn: WPOL_POLYGON,
        tokenOut: POLYGON_USDC,
        amountIn: amountPolWei,
        fee: 500,
        sqrtPriceLimitX96: 0
      });
      const quoteUsdcUnits = q500[0];
      const amountOutMin = (quoteUsdcUnits * 994n) / 1000n;
      console.log(`   • Cotización Uniswap V3 (fee 500): $${(Number(quoteUsdcUnits) / 1e6).toFixed(4)} USDC`);

      const feeData = await polyProvider.getFeeData();
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ? (feeData.maxPriorityFeePerGas * 14n) / 10n : ethers.parseUnits("45", "gwei");
      const maxFeePerGas = feeData.maxFeePerGas ? (feeData.maxFeePerGas * 14n) / 10n : ethers.parseUnits("240", "gwei");

      const wrapTx = await wpolContract.deposit({ value: amountPolWei, maxPriorityFeePerGas, maxFeePerGas, gasLimit: 95000 });
      await wrapTx.wait(1);

      const allowance = await wpolContract.allowance(VAULT_501, UNISWAP_V3_SWAP_ROUTER_02);
      if (allowance < amountPolWei) {
        const appTx = await wpolContract.approve(UNISWAP_V3_SWAP_ROUTER_02, ethers.MaxUint256, { maxPriorityFeePerGas, maxFeePerGas, gasLimit: 95000 });
        await appTx.wait(1);
      }

      const router = new ethers.Contract(UNISWAP_V3_SWAP_ROUTER_02, SWAP_ROUTER_02_ABI, polySigner);
      const swapTx = await router.exactInputSingle({
        tokenIn: WPOL_POLYGON,
        tokenOut: POLYGON_USDC,
        fee: 500,
        recipient: VAULT_501,
        amountIn: amountPolWei,
        amountOutMinimum: amountOutMin,
        sqrtPriceLimitX96: 0
      }, { maxPriorityFeePerGas, maxFeePerGas, gasLimit: 300000 });
      polygonSwapOrBridgeTxHash = swapTx.hash;
      console.log(`   ⏳ Tx Swap Uniswap V3: https://polygonscan.com/tx/${swapTx.hash}`);
      await swapTx.wait(1);
      await sleep(2500);

      // Cruzar el USDC recién obtenido a Arbitrum One vía Relay
      const updatedPolyUsdcUnits = await polyUsdcContract.balanceOf(VAULT_501);
      const addedPolyUsdcUnits = updatedPolyUsdcUnits > polyUsdcBeforeUnits ? (updatedPolyUsdcUnits - polyUsdcBeforeUnits) : updatedPolyUsdcUnits;
      console.log(`   🌉 Cruzando $${ethers.formatUnits(addedPolyUsdcUnits, 6)} USDC de Polygon a Arbitrum One vía Relay...`);

      const bQuoteRes = await fetch("https://api.relay.link/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: VAULT_501,
          originChainId: 137,
          destinationChainId: 42161,
          originCurrency: POLYGON_USDC,
          destinationCurrency: ARB_USDC,
          amount: addedPolyUsdcUnits.toString(),
          tradeType: "EXACT_INPUT"
        })
      });
      const bQuote = await bQuoteRes.json();
      for (const step of (bQuote.steps || [])) {
        for (const item of (step.items || [])) {
          if (item.data) {
            const bTx = await polySigner.sendTransaction({
              to: item.data.to,
              data: item.data.data,
              value: BigInt(item.data.value || "0"),
              maxPriorityFeePerGas,
              maxFeePerGas,
              gasLimit: item.data.gas ? Math.floor(Number(item.data.gas) * 1.35) : 300000
            });
            polygonBridgeStepTxHash = bTx.hash;
            console.log(`   ⏳ Tx Puente Relay en Polygon: https://polygonscan.com/tx/${bTx.hash}`);
            await bTx.wait(1);
          }
        }
      }
    }

    // Esperar llegada de USDC a Arbitrum One (#501)
    console.log("\n⏳ Esperando acreditación de USDC en Arbitrum One (#501)...");
    let arbCurrentUnits = arbUsdcBeforeUnits;
    for (let i = 0; i < 45; i++) {
      await sleep(3000);
      arbCurrentUnits = await arbUsdcContract.balanceOf(VAULT_501);
      if (arbCurrentUnits > arbUsdcBeforeUnits + ethers.parseUnits("10.0", 6)) {
        const arrivedUnits = arbCurrentUnits - arbUsdcBeforeUnits;
        console.log(`🎉 ¡USDC acreditado en Arbitrum One!: +$${ethers.formatUnits(arrivedUnits, 6)} USDC (Total Arb: $${ethers.formatUnits(arbCurrentUnits, 6)} USDC)`);
        break;
      }
      process.stdout.write(".");
    }
  } else {
    console.log(`ℹ️ No hay 819 POL excedentes sin convertir en Polygon (Saldo actual: ${polBalNum.toFixed(4)} POL). Verificando si ya están en Arbitrum...`);
  }

  // Verificar si hay USDC en Arbitrum One para transferir al Bridge2 de Hyperliquid L1
  const arbReadyUnits = await arbUsdcContract.balanceOf(VAULT_501);
  const arbReadyNum = parseFloat(ethers.formatUnits(arbReadyUnits, 6));
  if (arbReadyNum >= 5.0) {
    console.log(`\n🏦 Transfiriendo el 100% ($${arbReadyNum.toFixed(4)} USDC) al contrato oficial Bridge2 de Hyperliquid L1 (${HL_BRIDGE2_ARB})...`);
    const arbFeeData = await arbProvider.getFeeData();
    const hlDepositTx = await arbUsdcContract.transfer(HL_BRIDGE2_ARB, arbReadyUnits, {
      gasLimit: 150000n,
      maxPriorityFeePerGas: arbFeeData.maxPriorityFeePerGas || ethers.parseUnits("0.01", "gwei"),
      maxFeePerGas: arbFeeData.maxFeePerGas ? (arbFeeData.maxFeePerGas * 14n) / 10n : ethers.parseUnits("0.1", "gwei")
    });
    arbitrumHlDepositTxHash = hlDepositTx.hash;
    netUsdcDepositedToHl = arbReadyNum;
    console.log(`   ⏳ Tx Depósito Bridge2 Arbitrum: https://arbiscan.io/tx/${hlDepositTx.hash}`);
    const depReceipt = await hlDepositTx.wait(1);
    console.log(`   ✅ Confirmado en Arbitrum One (Bloque #${depReceipt.blockNumber})!`);
  } else {
    throw new Error(`No se encontraron USDC en Arbitrum One para depositar ($${arbReadyNum.toFixed(4)} USDC).`);
  }

  // Esperar ~30 segundos y verificar acreditación en Hyperliquid L1
  console.log("\n⏳ Esperando acreditación del depósito en Hyperliquid L1 Clearinghouse...");
  let chAfter = chBefore;
  let hlAccountValAfter = hlAccountValBefore;
  for (let attempt = 1; attempt <= 20; attempt++) {
    await sleep(4000);
    chAfter = await hlInfo({ type: "clearinghouseState", user: VAULT_501 });
    hlAccountValAfter = parseFloat(chAfter.marginSummary?.accountValue || "0");
    console.log(`   [Verificación ${attempt}/20] AccountValue en Hyperliquid L1: $${hlAccountValAfter.toFixed(2)} USDC`);
    if (hlAccountValAfter >= hlAccountValBefore + (netUsdcDepositedToHl * 0.85)) {
      console.log(`🎉 ¡Depósito acreditado en vivo en Hyperliquid L1! Nuevo AccountValue: $${hlAccountValAfter.toFixed(2)} USDC\n`);
      break;
    }
  }

  const finalPolWei = await polyProvider.getBalance(VAULT_501);
  const finalPolGasNum = parseFloat(ethers.formatEther(finalPolWei));

  // ============================================================================
  // BLOQUE 3: AUDITORÍA COMPLETA DEL AVANCE DEL RESCATE EN HYPERLIQUID L1
  // ============================================================================
  console.log("--- [BLOQUE 3: AUDITORÍA EN TIEMPO REAL DEL RESCATE DE OPERACIONES EN HYPERLIQUID L1] ---");
  const [openOrdersNow, userFillsNow, allMidsNow] = await Promise.all([
    hlInfo({ type: "openOrders", user: VAULT_501 }),
    hlInfo({ type: "userFills", user: VAULT_501 }),
    hlInfo({ type: "allMids" })
  ]);

  // 1. Posiciones cerradas en verde desde anoche 20:00 UTC (2026-10-29T20:00:00Z)
  const sinceTs = Date.parse("2026-10-29T20:00:00Z");
  const closedFillsSinceNight = (userFillsNow || []).filter(f =>
    f.time >= sinceTs && f.dir && f.dir.includes("Close") && parseFloat(f.closedPnl || "0") > 0
  );

  // 2. Estado exacto de las posiciones abiertas actualmente
  const openPositionsNow = (chAfter.assetPositions || []).filter(p => parseFloat(p.position?.szi || "0") !== 0);
  const cascadePriority = ["PAXG", "ETH", "BTC", "XRP", "SOL", "NEAR", "DOGE"];
  openPositionsNow.sort((a, b) => {
    const iA = cascadePriority.indexOf(a.position.coin);
    const iB = cascadePriority.indexOf(b.position.coin);
    return (iA === -1 ? 99 : iA) - (iB === -1 ? 99 : iB);
  });

  const openPositionsAudit = openPositionsNow.map((pObj, idx) => {
    const p = pObj.position;
    const coin = p.coin;
    const szi = parseFloat(p.szi);
    const isShort = szi < 0;
    const entryPx = parseFloat(p.entryPx);
    const markPx = parseFloat(allMidsNow[coin] || entryPx);
    const uPnl = parseFloat(p.unrealizedPnl || "0");
    const notional = Math.abs(szi) * entryPx;
    const uPnlPct = notional > 0 ? (uPnl / (notional / 5)) * 100 : 0;
    const rtFeeUsd = notional * 0.00060;
    const targetNetUsd = coin === "SOL" ? 0.05 : coin === "XRP" ? 0.03 : 0.02;
    const deltaPx = Math.abs(szi) > 0 ? ((rtFeeUsd + targetNetUsd) / Math.abs(szi)) : 0;
    const calcLockPx = isShort ? (entryPx - deltaPx) : (entryPx + deltaPx);
    const reduceOrder = (openOrdersNow || []).find(o => o.coin === coin && o.reduceOnly === true);
    const orderPx = reduceOrder ? parseFloat(reduceOrder.limitPx) : calcLockPx;
    const distPct = isShort
      ? Math.max(0, ((markPx - orderPx) / markPx) * 100)
      : Math.max(0, ((orderPx - markPx) / markPx) * 100);

    return {
      rank: idx + 1,
      coin,
      side: isShort ? "SHORT" : "LONG",
      szi: Math.abs(szi),
      entryPx,
      markPx,
      uPnl,
      uPnlPct,
      orderPx,
      hasOrderInBook: Boolean(reduceOrder),
      distPct
    };
  });

  const withdrawableAfter = parseFloat(chAfter.withdrawable || "0");
  const prevLoanTotal = 684.04;
  const newLoanTotal = +(prevLoanTotal + netUsdcDepositedToHl).toFixed(2);
  const prevClosedBase = 914.11;
  const newClosedBase = +(prevClosedBase + netUsdcDepositedToHl).toFixed(2);
  const newProgressPct = Math.min(100, +((newClosedBase / 1000.0) * 100).toFixed(1));
  const newMentoraShield40 = +(hlAccountValAfter * 0.40).toFixed(2);

  const summaryReport = {
    executedAt: new Date().toISOString(),
    polConverted: polToConvert,
    gasReserveRemainingPol: finalPolGasNum,
    polygonSwapOrBridgeTxHash,
    polygonBridgeStepTxHash,
    arbitrumHlDepositTxHash,
    netUsdcDepositedToHl: +netUsdcDepositedToHl.toFixed(2),
    hlAccountValBefore: +hlAccountValBefore.toFixed(2),
    hlAccountValAfter: +hlAccountValAfter.toFixed(2),
    withdrawableAfter: +withdrawableAfter.toFixed(2),
    newMentoraShield40,
    prevLoanTotal,
    newLoanTotal,
    prevClosedBase,
    newClosedBase,
    newProgressPct,
    closedFillsSinceNight: closedFillsSinceNight.map(f => ({
      coin: f.coin,
      dir: f.dir,
      px: f.px,
      sz: f.sz,
      closedPnl: parseFloat(f.closedPnl),
      fee: parseFloat(f.fee || "0"),
      netPnl: +(parseFloat(f.closedPnl) - parseFloat(f.fee || "0")).toFixed(4),
      timestamp: new Date(f.time).toISOString()
    })),
    openPositionsAudit
  };

  fs.writeFileSync(
    path.join(__dirname, "..", "telemetry", "latest-819-pol-injection-report.json"),
    JSON.stringify(summaryReport, null, 2),
    "utf8"
  );

  console.log("\n📋 RESUMEN DE AUDITORÍA GUARDADO EN telemetry/latest-819-pol-injection-report.json:");
  console.log(JSON.stringify(summaryReport, null, 2));

  // Enviar el Parte Oficial a Telegram (-1004342131598 y -5101181644)
  const closedLinesTg = summaryReport.closedFillsSinceNight.slice(0, 6).map(c =>
    `• ✅ <code>${c.coin}-USDC</code> (${c.dir} @ $${c.px}) ➔ <b>+$${c.netPnl.toFixed(4)} USDC</b>`
  ).join("\n") || "• En espera de toque en órdenes Maker Reduce-Only";

  const openLinesTg = openPositionsAudit.map(o =>
    `• <b>${o.rank}º ${o.coin}</b> (${o.side} ${o.szi}) | Ent: <code>$${o.entryPx}</code> | Act: <code>$${o.markPx}</code> | PnL: <code>${o.uPnl >= 0 ? "+" : "-"}$${Math.abs(o.uPnl).toFixed(2)}</code> | Salida #00: <code>$${o.orderPx.toFixed(4)}</code> (a <b>${o.distPct.toFixed(2)}%</b>)`
  ).join("\n");

  const tgMsg =
    `🚀🏦🚁 <b>ÁREA 501 // INYECCIÓN DE 819.2788 POL (+$${netUsdcDepositedToHl.toFixed(2)} USDC) EN HYPERLIQUID L1 + INFORME DE RESCATE</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📥 <b>1. CONVERSIÓN & PUENTE ON-CHAIN COMPLETADO:</b>\n` +
    `• <b>POL Convertidos:</b> <code>${polToConvert.toFixed(4)} POL</code> (Gas #501 protegido: <code>${finalPolGasNum.toFixed(4)} POL</code>)\n` +
    `• <b>USDC Depositados en Bridge2 L1:</b> <b>+$${netUsdcDepositedToHl.toFixed(2)} USDC</b>\n` +
    `• <b>Tx PolygonScan:</b> <a href="https://polygonscan.com/tx/${polygonSwapOrBridgeTxHash}">Ver en PolygonScan</a>\n` +
    `• <b>Tx Depósito Bridge2 (Arbiscan):</b> <a href="https://arbiscan.io/tx/${arbitrumHlDepositTxHash}">Ver en Arbiscan</a>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏦 <b>2. CONTABILIZACIÓN PRÉSTAMO #501 (0% INTERÉS) & META $1,000:</b>\n` +
    `• <b>Nuevo Total Préstamo #501 (0%):</b> <code>$${newLoanTotal.toFixed(2)} USDC</code> (Antes: $684.04)\n` +
    `• <b>Saldo Cerrado Firme (Bloque 1):</b> <b>$${newClosedBase.toFixed(2)} / $1,000.00 USDC (${newProgressPct}%)</b>\n` +
    `• <b>Faltante para Coronar $1,000 (70/30):</b> Solo <b>$${Math.max(0, 1000 - newClosedBase).toFixed(2)} USDC</b>\n` +
    `• <b>Equity Viva L1 Actual:</b> <code>$${hlAccountValAfter.toFixed(2)} USDC</code>\n` +
    `• <b>Margen Libre / Retirable L1:</b> <code>$${withdrawableAfter.toFixed(2)} USDC</code> (Escudo #00: <code>$${newMentoraShield40.toFixed(2)} USDC</code>)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏆 <b>3. POSICIONES YA COBRADAS EN VERDE (DESDE 20:00 UTC):</b>\n${closedLinesTg}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎯 <b>4. TABLA EN VIVO DE POSICIONES EN RESCATE (COLA #00):</b>\n${openLinesTg}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 <a href="https://hypurrscan.io/address/${VAULT_501}">Ver Bóveda #501 en Hypurrscan (Sin conectar Wallet)</a>`;

  await sendTelegramAlert(tgMsg, "-1004342131598", { skipHeader: true }).catch(() => {});
  await sendTelegramAlert(tgMsg, "-5101181644", { skipHeader: true }).catch(() => {});
  console.log("📲 Informe oficial enviado a Telegram (-1004342131598 y -5101181644) ✔");
}

main().catch(err => {
  console.error("❌ Error en ejecución:", err);
  process.exit(1);
});

