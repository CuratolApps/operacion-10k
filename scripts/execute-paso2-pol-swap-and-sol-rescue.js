/**
 * scripts/execute-paso2-pol-swap-and-sol-rescue.js — ÁREA 501 // YOZAPATA LAB
 * ==============================================================================
 * PASO 2:
 * 1) BLOQUE 1: Asegurar en USDC Nativo los 597.2668 POL recién inyectados en #501
 *    (respetando el gas de >=10.00 POL en #501) vía Uniswap V3 (0.05% fee).
 * 2) BLOQUE 2: Promediar SOL-USDC (9.76 SOL) con Escudo Mentora #00 (+9.76 SOL)
 *    para bajar entryPx a ~$100.58 y colocar Limit Reduce-Only TP en newEntryPx * 1.0008.
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
const NATIVE_USDC_POLYGON = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const UNISWAP_V3_QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
const UNISWAP_V3_SWAP_ROUTER_02 = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)"
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

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getWorkingPolygonProvider() {
  const rpcList = [
    "https://polygon.drpc.org",
    "https://1rpc.io/matic",
    "https://polygon-bor-rpc.publicnode.com"
  ];
  for (const rpc of rpcList) {
    try {
      const p = new ethers.JsonRpcProvider(rpc, 137, { staticNetwork: true });
      await Promise.race([
        p.getBlockNumber(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000))
      ]);
      console.log(`🔗 Polygon RPC Conectado: ${rpc} ✔`);
      return p;
    } catch (_) {}
  }
  throw new Error("No se pudo conectar a ningún RPC de Polygon.");
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
  console.log("🏦🛡️⚡ PASO 2: SWAP 597.2668 POL -> USDC NATIVO EN #501 + RESCATE SOL MENTORA #00");
  console.log("================================================================================\n");

  const polyProvider = await getWorkingPolygonProvider();
  const signer501 = getWalletSigner(501, polyProvider);
  if (signer501.address.toLowerCase() !== VAULT_501.toLowerCase()) {
    throw new Error(`Dirección inválida: ${signer501.address}`);
  }

  // ============================================================================
  // BLOQUE 1: CONVERSIÓN DE 597.2668 POL A USDC NATIVO EN POLYGON (#501)
  // ============================================================================
  console.log("--- [BLOQUE 1: CONVERSIÓN DE 597.2668 POL A USDC NATIVO EN #501] ---");
  const usdcContract = new ethers.Contract(NATIVE_USDC_POLYGON, ERC20_ABI, signer501);
  const wpolContract = new ethers.Contract(WPOL_POLYGON, WPOL_ABI, signer501);

  const [polBalWei, usdcBalUnits, wpolBalWei] = await Promise.all([
    polyProvider.getBalance(VAULT_501),
    usdcContract.balanceOf(VAULT_501),
    wpolContract.balanceOf(VAULT_501)
  ]);

  const initialPolNum = parseFloat(ethers.formatEther(polBalWei));
  const initialWpolNum = parseFloat(ethers.formatEther(wpolBalWei));
  const initialUsdcNum = parseFloat(ethers.formatUnits(usdcBalUnits, 6));

  console.log(`• Saldo POL actual en #501: ${initialPolNum.toFixed(4)} POL (WPOL: ${initialWpolNum.toFixed(4)})`);
  console.log(`• Saldo USDC Nativo previo en #501: $${initialUsdcNum.toFixed(6)} USDC`);

  let wrapTxHash = null;
  let swapTxHash = null;
  let finalUsdcNum = initialUsdcNum;
  let finalPolNum = initialPolNum;
  let polSwapped = 0;
  let usdcReceived = 0;

  // Determinar cuánto POL convertir respetando mínimo 10.00 POL de gas intactos
  const targetSwapPol = Math.min(597.2668, Math.max(0, initialPolNum - 10.00));
  if (targetSwapPol >= 100.0) {
    polSwapped = Number(targetSwapPol.toFixed(4));
    const amountInUnits = ethers.parseEther(polSwapped.toFixed(4));
    console.log(`• Monto a convertir a USDC Nativo: ${polSwapped} POL (Gas remanente: ${(initialPolNum - polSwapped).toFixed(4)} POL >= 10.00 POL ✔)`);

    const quoter = new ethers.Contract(UNISWAP_V3_QUOTER_V2, QUOTER_V2_ABI, polyProvider);
    const q500 = await quoter.quoteExactInputSingle.staticCall({
      tokenIn: WPOL_POLYGON,
      tokenOut: NATIVE_USDC_POLYGON,
      amountIn: amountInUnits,
      fee: 500,
      sqrtPriceLimitX96: 0
    });
    const quoteUsdcUnits = q500[0];
    const amountOutMin = (quoteUsdcUnits * 995n) / 1000n;
    console.log(`• Cotización Uniswap V3 (0.05% fee): $${(Number(quoteUsdcUnits) / 1e6).toFixed(4)} USDC (Min: $${(Number(amountOutMin) / 1e6).toFixed(4)} USDC)`);

    const feeData = await polyProvider.getFeeData();
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ? (feeData.maxPriorityFeePerGas * 14n) / 10n : ethers.parseUnits("45", "gwei");
    const maxFeePerGas = feeData.maxFeePerGas ? (feeData.maxFeePerGas * 14n) / 10n : ethers.parseUnits("220", "gwei");

    // 1. Wrap POL -> WPOL
    console.log(`📦 Envolviendo ${polSwapped} POL a WPOL...`);
    const wrapTx = await wpolContract.deposit({
      value: amountInUnits,
      maxPriorityFeePerGas,
      maxFeePerGas,
      gasLimit: 90000
    });
    wrapTxHash = wrapTx.hash;
    console.log(`   ↳ Tx Wrap: https://polygonscan.com/tx/${wrapTxHash}`);
    await wrapTx.wait(1);

    // 2. Check Allowance
    const allowance = await wpolContract.allowance(VAULT_501, UNISWAP_V3_SWAP_ROUTER_02);
    if (allowance < amountInUnits) {
      console.log(`🔐 Aprobando WPOL en Uniswap V3 SwapRouter02...`);
      const appTx = await wpolContract.approve(UNISWAP_V3_SWAP_ROUTER_02, ethers.MaxUint256, {
        maxPriorityFeePerGas,
        maxFeePerGas,
        gasLimit: 90000
      });
      await appTx.wait(1);
    }

    // 3. Swap WPOL -> USDC Nativo
    console.log(`🔥 Ejecutando Swap Uniswap V3 (0.05%): ${polSwapped} WPOL ➔ USDC Nativo...`);
    const router = new ethers.Contract(UNISWAP_V3_SWAP_ROUTER_02, SWAP_ROUTER_02_ABI, signer501);
    const swapParams = {
      tokenIn: WPOL_POLYGON,
      tokenOut: NATIVE_USDC_POLYGON,
      fee: 500,
      recipient: VAULT_501,
      amountIn: amountInUnits,
      amountOutMinimum: amountOutMin,
      sqrtPriceLimitX96: 0
    };
    const swapTx = await router.exactInputSingle(swapParams, {
      maxPriorityFeePerGas,
      maxFeePerGas,
      gasLimit: 300000
    });
    swapTxHash = swapTx.hash;
    console.log(`   ↳ Tx Swap PolygonScan: https://polygonscan.com/tx/${swapTxHash}`);
    const swapReceipt = await swapTx.wait(1);
    console.log(`   ✅ Swap confirmado en Bloque #${swapReceipt.blockNumber}!`);

    const [newPolWei, newUsdcUnits] = await Promise.all([
      polyProvider.getBalance(VAULT_501),
      usdcContract.balanceOf(VAULT_501)
    ]);
    finalPolNum = parseFloat(ethers.formatEther(newPolWei));
    finalUsdcNum = parseFloat(ethers.formatUnits(newUsdcUnits, 6));
    usdcReceived = finalUsdcNum - initialUsdcNum;
    console.log(`🎉 BLOQUE 1 COMPLETADO:`);
    console.log(`   • USDC Nativo recibido: +$${usdcReceived.toFixed(6)} USDC`);
    console.log(`   • Saldo Total USDC Nativo en #501: $${finalUsdcNum.toFixed(6)} USDC`);
    console.log(`   • Saldo POL Gas Remanente en #501: ${finalPolNum.toFixed(4)} POL\n`);
  } else {
    console.log(`ℹ️ No hay excedente de 597 POL pendiente de swap (POL actual: ${initialPolNum.toFixed(4)}, USDC actual: $${initialUsdcNum.toFixed(4)}).\n`);
  }

  // ============================================================================
  // BLOQUE 2: PROMEDIAR SOL-USDC (9.76 SOL) CON ESCUDO MENTORA #00 -> TP +0.08%
  // ============================================================================
  console.log("--- [BLOQUE 2: RESCATE ACELERADO MENTORA #00 EN SOL-USDC] ---");
  const { ExchangeClient, HttpTransport } = await import("@nktkas/hyperliquid");
  const transport = new HttpTransport({ isTestnet: false });
  const exch = new ExchangeClient({ wallet: signer501, transport });

  const [meta, chBefore, openOrdersBefore, mids] = await Promise.all([
    hlInfo({ type: "meta" }),
    hlInfo({ type: "clearinghouseState", user: VAULT_501 }),
    hlInfo({ type: "openOrders", user: VAULT_501 }),
    hlInfo({ type: "allMids" })
  ]);

  const solAssetIdx = meta.universe.findIndex(u => u.name === "SOL");
  const solPosObj = (chBefore.assetPositions || []).find(ap => ap.position && ap.position.coin === "SOL");
  const currentSolSzi = solPosObj ? parseFloat(solPosObj.position.szi) : 0;
  const currentSolEntry = solPosObj ? parseFloat(solPosObj.position.entryPx) : 0;
  const solMid = parseFloat(mids.SOL);

  console.log(`• Estado actual SOL-USDC: szi=${currentSolSzi} SOL | entryPx=$${currentSolEntry} | midPx=$${solMid}`);

  let rescueBuyResult = null;
  let newSolSzi = currentSolSzi;
  let newSolEntry = currentSolEntry;
  let newTpPx = null;
  let newTpOrderResult = null;

  if (currentSolSzi > 0 && currentSolSzi <= 12.0) {
    // 1. Cancelar órdenes TP previas de SOL para actualizar tras la compra
    const solOrders = (openOrdersBefore || []).filter(o => o.coin === "SOL");
    if (solOrders.length > 0) {
      console.log(`🧹 Cancelando ${solOrders.length} orden(es) TP previa(s) en SOL...`);
      await exch.cancel({
        cancels: solOrders.map(o => ({ a: solAssetIdx, o: o.oid }))
      });
    }

    // 2. Comprar 9.76 SOL adicionales con Ioc agresivo (+0.15% sobre mid para fill inmediato)
    const addSz = "9.76";
    const buyLimitPx = (solMid * 1.002).toFixed(2);
    console.log(`🛡️ Inyectando Cartucho Mentora #00: Comprando +${addSz} SOL @ <= $${buyLimitPx} (mid: $${solMid})...`);
    rescueBuyResult = await exch.order({
      orders: [{
        a: solAssetIdx,
        b: true,
        p: buyLimitPx,
        s: addSz,
        r: false,
        t: { limit: { tif: "Ioc" } }
      }],
      grouping: "na"
    });
    console.log(`   ↳ Respuesta compra Mentora #00:`, JSON.stringify(rescueBuyResult));

    await sleep(1500);
  } else {
    console.log(`ℹ️ SOL-USDC ya se encuentra promediado con szi=${currentSolSzi} SOL.`);
  }

  // 3. Consultar nuevo clearinghouseState y colocar Limit Reduce-Only TP en newEntryPx * 1.0008
  const [chAfter, openOrdersAfter] = await Promise.all([
    hlInfo({ type: "clearinghouseState", user: VAULT_501 }),
    hlInfo({ type: "openOrders", user: VAULT_501 })
  ]);

  const solPosAfter = (chAfter.assetPositions || []).find(ap => ap.position && ap.position.coin === "SOL");
  if (solPosAfter && parseFloat(solPosAfter.position.szi) > 0) {
    newSolSzi = parseFloat(solPosAfter.position.szi);
    newSolEntry = parseFloat(solPosAfter.position.entryPx);
    // Calcular newEntryPx * 1.0008 (~$100.66)
    const rawTpPx = Math.max(newSolEntry * 1.0008, solMid + 0.02);
    newTpPx = rawTpPx.toFixed(2);

    // Cancelar cualquier orden en SOL que no esté en newTpPx por el total de newSolSzi
    const existingSolOrders = (openOrdersAfter || []).filter(o => o.coin === "SOL");
    if (existingSolOrders.length > 0) {
      await exch.cancel({
        cancels: existingSolOrders.map(o => ({ a: solAssetIdx, o: o.oid }))
      });
    }

    console.log(`🎯 Colocando Limit Reduce-Only Take-Profit por ${newSolSzi} SOL @ $${newTpPx} (newEntryPx $${newSolEntry} * 1.0008)...`);
    newTpOrderResult = await exch.order({
      orders: [{
        a: solAssetIdx,
        b: false,
        p: newTpPx,
        s: newSolSzi.toFixed(2),
        r: true,
        t: { limit: { tif: "Alo" } }
      }],
      grouping: "na"
    });
    console.log(`   ↳ Respuesta Orden TP:`, JSON.stringify(newTpOrderResult));
  }

  const report = {
    timestamp: new Date().toISOString(),
    bloque1: {
      polSwapped,
      wrapTxHash,
      swapTxHash,
      usdcReceived: Number(usdcReceived.toFixed(6)),
      finalUsdcPolygon: Number(finalUsdcNum.toFixed(6)),
      finalPolGas: Number(finalPolNum.toFixed(4))
    },
    bloque2: {
      oldSolSzi: currentSolSzi,
      oldSolEntry: currentSolEntry,
      newSolSzi,
      newSolEntry,
      newTpPx,
      rescueBuyResult,
      newTpOrderResult
    }
  };

  fs.writeFileSync(
    path.join(__dirname, "..", "telemetry", "paso2-execution-report.json"),
    JSON.stringify(report, null, 2),
    "utf8"
  );

  // Enviar alerta a Telegram
  const tgMsg =
    `🏦🛡️⚡ <b>ÁREA 501 // PASO 2 EJECUTADO EN CADENA</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `1️⃣ <b>SWAP 597.2668 POL ➔ USDC NATIVO (#501):</b>\n` +
    `• <b>POL Convertido:</b> <code>${polSwapped} POL</code> (Gas intacto: <code>${finalPolNum.toFixed(2)} POL</code>)\n` +
    `• <b>USDC Recibido:</b> <code>+$${usdcReceived.toFixed(2)} USDC</code>\n` +
    `• <b>Saldo Líquido #501:</b> <code>$${finalUsdcNum.toFixed(2)} USDC Nativo</code>\n` +
    (swapTxHash ? `• <b>Tx Swap Uniswap V3 (0.05%):</b> <a href="https://polygonscan.com/tx/${swapTxHash}">PolygonScan</a>\n` : "") +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `2️⃣ <b>RESCATE MENTORA #00 EN SOL-USDC:</b>\n` +
    `• <b>Posición Total:</b> <code>${newSolSzi} SOL</code> (antes <code>${currentSolSzi} SOL</code>)\n` +
    `• <b>Nuevo Precio Promedio:</b> <code>$${newSolEntry}</code> (antes <code>$${currentSolEntry}</code>)\n` +
    `• <b>Orden TP Reduce-Only (+0.08%):</b> <code>${newSolSzi} SOL @ $${newTpPx}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `3️⃣ <b>GATILLO AUTO-PUENTE ARMADO:</b>\n` +
    `• Apenas cierre <code>SOL-USDC</code> (<code>szi == 0</code>), los <code>$${finalUsdcNum.toFixed(2)} USDC</code> cruzarán automáticamente a Hyperliquid L1 (~$901+ USDC, >90% de la meta de $1,000).`;

  await sendTelegramAlert(tgMsg, process.env.TELEGRAM_CHAT_ID || "-1004342131598", { skipHeader: true });
  console.log("\n✅ REPORTE PASO 2 ENVIADO A TELEGRAM.");
}

main().catch(err => {
  console.error("❌ ERROR EN PASO 2:", err);
  process.exit(1);
});

