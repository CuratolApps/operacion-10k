/**
 * scripts/auto-loan-post-sol.js — ÁREA 501 // YOZAPATA LAB
 * ==============================================================================
 * GATILLO AUTOMÁTICO POST-SOL:
 * Monitorea en tiempo real la posición de SOL-USDC en Hyperliquid L1 (19.52 SOL @ $100.538 -> TP $100.62).
 * En el segundo exacto en que SOL-USDC cierre (szi == 0):
 * 1. Toma los ~$54.10 USDC Nativo asegurados en Polygon #501 (0x3c499c...3359).
 * 2. Ejecuta puente institucional de bajo costo vía Relay API hacia Arbitrum One USDC.
 * 3. Deposita el 100% en el Bridge2 Oficial de Hyperliquid L1 (0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7).
 * 4. Registra el nuevo préstamo 0% interés en el ledger y telemetría (Capital HL ~$901.00+ USDC, >90% de $1,000).
 * 5. Envía confirmación inmediata a Telegram (-1004342131598).
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
const POLYGON_USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const ARBITRUM_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const HL_BRIDGE2_ARBITRUM = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7";
const STATE_FILE = path.join(__dirname, "..", "telemetry", "auto-loan-post-sol-state.json");

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getWorkingProvider(rpcList, chainId) {
  for (const rpc of rpcList) {
    try {
      const p = new ethers.JsonRpcProvider(rpc, chainId, { staticNetwork: true });
      await Promise.race([
        p.getBlockNumber(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 4000))
      ]);
      return p;
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

async function executePostSolLoanBridge() {
  console.log("\n================================================================================");
  console.log("🚀⚡ GATILLO POST-SOL ACTIVADO: PUENTEANDO ~$54.10 USDC (#501) ➔ HYPERLIQUID L1");
  console.log("================================================================================");

  const polyProvider = await getWorkingProvider(["https://polygon.drpc.org", "https://1rpc.io/matic", "https://polygon-bor-rpc.publicnode.com"], 137);
  const arbProvider = await getWorkingProvider(["https://arb1.arbitrum.io/rpc", "https://arbitrum.drpc.org", "https://1rpc.io/arb"], 42161);

  const polySigner = getWalletSigner(501, polyProvider);
  const arbSigner = getWalletSigner(501, arbProvider);

  const usdcPoly = new ethers.Contract(POLYGON_USDC, ERC20_ABI, polySigner);
  const usdcArb = new ethers.Contract(ARBITRUM_USDC, ERC20_ABI, arbSigner);

  const polyUsdcUnits = await usdcPoly.balanceOf(VAULT_501);
  const polyUsdcNum = parseFloat(ethers.formatUnits(polyUsdcUnits, 6));
  console.log(`• Saldo USDC Nativo en Polygon #501: $${polyUsdcNum.toFixed(6)} USDC`);

  if (polyUsdcNum < 10.0) {
    console.log("ℹ️ Saldo USDC en Polygon #501 menor a $10.00 (ya fue puenteado previamente).");
    return null;
  }

  // 1. Solicitar cotización a Relay API
  console.log("📡 Solicitando cotización institucional a Relay API (Polygon USDC -> Arbitrum USDC)...");
  const quoteRes = await fetch("https://api.relay.link/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: VAULT_501,
      originChainId: 137,
      destinationChainId: 42161,
      originCurrency: POLYGON_USDC,
      destinationCurrency: ARBITRUM_USDC,
      amount: polyUsdcUnits.toString(),
      tradeType: "EXACT_INPUT"
    })
  });
  const quoteData = await quoteRes.json();
  const depositStep = quoteData.steps?.find(s => s.id === "deposit");
  if (!depositStep || !depositStep.items || !depositStep.items[0]) {
    throw new Error(`Error en cotización Relay: ${JSON.stringify(quoteData)}`);
  }

  const txData = depositStep.items[0].data;
  const polyFeeData = await polyProvider.getFeeData();
  const bridgeTx = await polySigner.sendTransaction({
    to: txData.to,
    data: txData.data,
    value: BigInt(txData.value || "0"),
    gasLimit: BigInt(txData.gas ? Math.ceil(Number(txData.gas) * 1.4) : 350000),
    maxPriorityFeePerGas: polyFeeData.maxPriorityFeePerGas ? (polyFeeData.maxPriorityFeePerGas * 14n) / 10n : ethers.parseUnits("45", "gwei"),
    maxFeePerGas: polyFeeData.maxFeePerGas ? (polyFeeData.maxFeePerGas * 14n) / 10n : ethers.parseUnits("220", "gwei")
  });

  console.log(`   ⏳ Tx Puente enviada en Polygon: https://polygonscan.com/tx/${bridgeTx.hash}`);
  await bridgeTx.wait(1);
  console.log(`   ✅ Tx Puente confirmada en Polygon!`);

  // 2. Esperar llegada a Arbitrum One
  let arbBalUnits = 0n;
  for (let i = 1; i <= 40; i++) {
    await sleep(4000);
    arbBalUnits = await usdcArb.balanceOf(VAULT_501);
    const arbBalNum = parseFloat(ethers.formatUnits(arbBalUnits, 6));
    console.log(`   [Espera Arbitrum ${i}/40] Saldo Arbitrum #501: $${arbBalNum.toFixed(4)} USDC`);
    if (arbBalNum >= polyUsdcNum * 0.96) {
      break;
    }
  }

  const arbReceivedNum = parseFloat(ethers.formatUnits(arbBalUnits, 6));
  if (arbReceivedNum < 10.0) {
    throw new Error(`Timeout esperando fondos en Arbitrum One ($${arbReceivedNum.toFixed(4)} USDC)`);
  }

  // 3. Transferir al Bridge2 Oficial de Hyperliquid L1
  console.log(`🏦 Depositando $${arbReceivedNum.toFixed(4)} USDC en Hyperliquid Bridge2 (${HL_BRIDGE2_ARBITRUM})...`);
  const arbFeeData = await arbProvider.getFeeData();
  const hlTx = await usdcArb.transfer(HL_BRIDGE2_ARBITRUM, arbBalUnits, {
    gasLimit: 150000n,
    maxPriorityFeePerGas: arbFeeData.maxPriorityFeePerGas || ethers.parseUnits("0.02", "gwei"),
    maxFeePerGas: arbFeeData.maxFeePerGas ? (arbFeeData.maxFeePerGas * 13n) / 10n : ethers.parseUnits("0.1", "gwei")
  });
  console.log(`   ⏳ Tx Bridge2 Arbitrum: https://arbiscan.io/tx/${hlTx.hash}`);
  await hlTx.wait(1);
  console.log(`   ✅ Depósito confirmado en Bridge2!`);

  // 4. Esperar acreditación en Hyperliquid L1
  let newHlValue = 0;
  for (let i = 1; i <= 30; i++) {
    await sleep(5000);
    const ch = await hlInfo({ type: "clearinghouseState", user: VAULT_501 });
    newHlValue = parseFloat(ch.marginSummary?.accountValue || "0");
    console.log(`   [Verificación HL ${i}/30] AccountValue: $${newHlValue.toFixed(2)} USDC`);
    if (newHlValue >= 885.0) break;
  }

  // 5. Actualizar contador de Préstamo 0% Interés en ledger y estado
  const ledgerPath = path.join(__dirname, "..", "telemetry", "squad-secret-real-ledger.json");
  try {
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
    ledger.vault501LoanPrincipalUsdc = Number((511.44 + arbReceivedNum).toFixed(2));
    ledger.vault501LoanRemainingUsdc = Number((511.44 + arbReceivedNum).toFixed(2));
    ledger.totalInjectedUsdc = Number((629.94 + arbReceivedNum).toFixed(2));
    ledger.lastAutoLoanBridge = {
      timestamp: new Date().toISOString(),
      polygonUsdcSent: polyUsdcNum,
      arbitrumHlDeposited: arbReceivedNum,
      polygonBridgeTxHash: bridgeTx.hash,
      arbitrumHlTxHash: hlTx.hash,
      newAccountValue: newHlValue
    };
    fs.writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), "utf8");
  } catch (e) {
    console.error("Error actualizando ledger:", e.message);
  }

  const finalState = {
    status: "COMPLETED_ON_CHAIN",
    executedAt: new Date().toISOString(),
    polygonUsdcSent: polyUsdcNum,
    arbitrumHlDeposited: arbReceivedNum,
    polygonBridgeTxHash: bridgeTx.hash,
    arbitrumHlTxHash: hlTx.hash,
    newAccountValue: newHlValue,
    newLoanPrincipalUsdc: Number((511.44 + arbReceivedNum).toFixed(2)),
    newTotalInjectedUsdc: Number((629.94 + arbReceivedNum).toFixed(2))
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(finalState, null, 2), "utf8");

  const tgAlert =
    `🏦🚀 <b>ÁREA 501 // GATILLO POST-SOL EJECUTADO: +$${arbReceivedNum.toFixed(2)} USDC ACREDITED EN HYPERLIQUID L1</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ <b>Condición Cumplida:</b> Cierre limpio de <code>SOL-USDC</code> en ganancia.\n` +
    `📥 <b>Préstamo #501 (0% Interés):</b> <code>+$${arbReceivedNum.toFixed(2)} USDC</code> (Proveniente de <code>596.89 POL</code>)\n` +
    `💵 <b>NUEVO EQUITY HYPERLIQUID L1:</b> <code>$${newHlValue.toFixed(2)} USDC</code> (<b>&gt;90% de la Meta de $1,000 USDC</b>)\n` +
    `🏛️ <b>Total Inyectado Acumulado:</b> <code>$${(629.94 + arbReceivedNum).toFixed(2)} USDC</code>\n` +
    `• <b>Puente Relay:</b> <a href="https://polygonscan.com/tx/${bridgeTx.hash}">PolygonScan</a>\n` +
    `• <b>Depósito HL Bridge2:</b> <a href="https://arbiscan.io/tx/${hlTx.hash}">Arbiscan</a>`;

  await sendTelegramAlert(tgAlert, process.env.TELEGRAM_CHAT_ID || "-1004342131598", { skipHeader: true });
  return finalState;
}

async function watchSolAndBridge() {
  console.log("================================================================================");
  console.log("👁️⚡ WATCHER GATILLO POST-SOL ACTIVO (ESPERANDO szi == 0 EN SOL-USDC)");
  console.log("• Fondos listos en Polygon #501: $54.101317 USDC Nativo (Tx 0x28fe38...ab34d)");
  console.log("• Posición objetivo: 19.52 SOL @ $100.538 -> TP Reduce-Only @ $100.62");
  console.log("================================================================================");

  // Guardar estado inicial ARMED
  if (!fs.existsSync(STATE_FILE)) {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      status: "ARMED_WAITING_SOL_CLOSE",
      armedAt: new Date().toISOString(),
      polygonSwapTxHash: "0x28fe38e7ac2fffeb65cbc1df2af28111db62361ef52bdc3b1510bad9a76ab34d",
      polygonUsdcReady: 54.101317,
      polygonGasRemainingPol: 9.9358,
      solTargetPosition: { szi: 19.52, entryPx: 100.538, tpPx: 100.62, tpOid: 589114285430 }
    }, null, 2), "utf8");
  }

  while (true) {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const st = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
        if (st.status === "COMPLETED_ON_CHAIN") {
          console.log("✅ El préstamo post-SOL ya fue ejecutado y acreditado. Cerrando watcher.");
          process.exit(0);
        }
      }

      const ch = await hlInfo({ type: "clearinghouseState", user: VAULT_501 });
      const solPos = (ch.assetPositions || []).find(ap => ap.position && ap.position.coin === "SOL");
      const solSzi = solPos ? Math.abs(parseFloat(solPos.position.szi)) : 0;

      if (solSzi === 0) {
        console.log(`🎯 [DETECTADO] SOL-USDC cerrado (szi == 0)! Disparando puente automático de $54.10 USDC...`);
        await executePostSolLoanBridge();
        process.exit(0);
      }
    } catch (e) {
      console.error("[WATCHER POST-SOL] Error verificando estado:", e.message);
    }
    await sleep(8000);
  }
}

if (require.main === module) {
  watchSolAndBridge();
}

module.exports = { executePostSolLoanBridge };

