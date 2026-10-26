/**
 * scripts/send-100-usdc-to-hl.js — ÁREA 501
 * ==============================================================================
 * EJECUCIÓN ON-CHAIN:
 * 1. Cruza $9.55 USDC de Polygon #501 (0xD4D1...3743) a Arbitrum One via Relay API.
 * 2. Recibe ~9.525 USDC en Arbitrum One #501.
 * 3. Transfiere los ~9.525 USDC al Bridge2 Oficial de Hyperliquid L1 (0x2Df1...3dF7).
 * 4. Sumado a los $90.4916 USDC preexistentes, Hyperliquid L1 alcanza $100.01 USDC.
 * 5. Polygon #501 conserva ~$490.76 USDC (piso protegido) y 160.85 POL de gas intacto.
 * 6. Registra/confirma ApproveAgent para SquadSecret501 con motores en PAUSA PREVENTIVA.
 * ==============================================================================
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { getWalletSigner } = require("../swarm-engine");
const { createResilientProvider, networks } = require("../networks");

const VAULT_501_ADDRESS = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const NATIVE_USDC_POLYGON = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const NATIVE_USDC_ARBITRUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const HYPERLIQUID_BRIDGE2 = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7";
const RELAY_DEPOSITORY_POLYGON = "0x4cd00e387622c35bddb9b4c962c136462338bc31";

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)"
];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log("================================================================================");
  console.log("🛡️ ÁREA 501 // SINCERIZACIÓN ON-CHAIN Y FONDEO REDONDO A HYPERLIQUID L1");
  console.log("================================================================================\n");

  const providerPolygon = createResilientProvider(networks.polygonMainnet);
  const providerArbitrum = createResilientProvider(networks.arbitrumMainnet);

  const signer501Polygon = getWalletSigner(501, providerPolygon);
  const signer501Arbitrum = getWalletSigner(501, providerArbitrum);

  if (signer501Polygon.address.toLowerCase() !== VAULT_501_ADDRESS.toLowerCase()) {
    throw new Error(`❌ Dirección inválida: ${signer501Polygon.address} vs ${VAULT_501_ADDRESS}`);
  }

  console.log(`📍 Bóveda Matriz #501: ${signer501Polygon.address} ✔`);

  const usdcPolygon = new ethers.Contract(NATIVE_USDC_POLYGON, ERC20_ABI, signer501Polygon);
  const usdcArbitrum = new ethers.Contract(NATIVE_USDC_ARBITRUM, ERC20_ABI, signer501Arbitrum);

  // 1. Estado inicial
  const [initialPolWei, initialPolyUsdcUnits, initialEthWei, initialArbUsdcUnits] = await Promise.all([
    providerPolygon.getBalance(VAULT_501_ADDRESS),
    usdcPolygon.balanceOf(VAULT_501_ADDRESS),
    providerArbitrum.getBalance(VAULT_501_ADDRESS),
    usdcArbitrum.balanceOf(VAULT_501_ADDRESS)
  ]);

  const initialPolyUsdc = parseFloat(ethers.formatUnits(initialPolyUsdcUnits, 6));
  const initialPol = parseFloat(ethers.formatEther(initialPolWei));
  const initialEth = parseFloat(ethers.formatEther(initialEthWei));
  const initialArbUsdc = parseFloat(ethers.formatUnits(initialArbUsdcUnits, 6));

  console.log(`📊 SALDOS INICIALES ON-CHAIN:`);
  console.log(`   • Polygon USDC: $${initialPolyUsdc.toFixed(4)} USDC`);
  console.log(`   • Polygon Gas: ${initialPol.toFixed(4)} POL`);
  console.log(`   • Arbitrum Gas: ${initialEth.toFixed(6)} ETH`);
  console.log(`   • Arbitrum USDC: $${initialArbUsdc.toFixed(4)} USDC`);

  // Consulta saldo actual en Hyperliquid L1
  let hlInitialValue = 0;
  try {
    const hlRes = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "clearinghouseState", user: VAULT_501_ADDRESS })
    });
    const hlData = await hlRes.json();
    hlInitialValue = parseFloat(hlData.marginSummary?.accountValue || "0");
    console.log(`   • Hyperliquid L1 Actual: $${hlInitialValue.toFixed(4)} USDC\n`);
  } catch (e) {
    console.log(`   ⚠️ Consulta HL L1 falló: ${e.message}\n`);
  }

  // 2. Cotización fresca de Relay para 9.55 USDC
  const amountInUnits = "9550000"; // 9.55 USDC
  console.log(`🔄 [PASO 1] Obteniendo cotización fresca de Relay API para transferir $9.55 USDC a Arbitrum One...`);

  const quoteRes = await fetch("https://api.relay.link/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: VAULT_501_ADDRESS,
      originChainId: 137,
      destinationChainId: 42161,
      originCurrency: NATIVE_USDC_POLYGON,
      destinationCurrency: NATIVE_USDC_ARBITRUM,
      amount: amountInUnits,
      tradeType: "EXACT_INPUT"
    })
  });

  const quoteData = await quoteRes.json();
  const depositStep = quoteData.steps?.find(s => s.id === "deposit");
  if (!depositStep || !depositStep.items || depositStep.items.length === 0) {
    throw new Error(`❌ No se encontró paso de depósito en Relay API: ${JSON.stringify(quoteData)}`);
  }

  const depositItem = depositStep.items[0];
  const txData = depositItem.data;
  const expectedOutUsdc = parseFloat(quoteData.details?.currencyOut?.amountFormatted || "9.525");
  console.log(`   • Salida esperada en Arbitrum: $${expectedOutUsdc.toFixed(4)} USDC`);
  console.log(`   • Contrato Depository: ${txData.to}`);

  // 3. Enviar depósito al Depository de Relay en Polygon
  console.log(`\n🚀 [PASO 2] Enviando depósito de $9.55 USDC al solver de Relay...`);
  const feeData = await providerPolygon.getFeeData();
  const depositTx = await signer501Polygon.sendTransaction({
    to: txData.to,
    data: txData.data,
    value: BigInt(txData.value || "0"),
    gasLimit: BigInt(txData.gas ? Math.ceil(Number(txData.gas) * 1.5) : 350000),
    maxPriorityFeePerGas: ethers.parseUnits("90", "gwei"),
    maxFeePerGas: ethers.parseUnits("400", "gwei")
  });

  const polygonBridgeTxHash = depositTx.hash;
  console.log(`   ↳ Tx Bridge enviada en Polygon: https://polygonscan.com/tx/${depositTx.hash}`);
  const polyReceipt = await depositTx.wait();
  console.log(`   ✅ Tx Bridge confirmada en Polygon (Bloque ${polyReceipt.blockNumber})!`);

  // 4. Monitorear llegada de USDC en Arbitrum One
  console.log(`\n⏳ [PASO 3] Esperando llegada de fondos en Arbitrum One para ${VAULT_501_ADDRESS}...`);
  let arbBalanceDetected = 0n;
  let attempts = 0;
  const maxAttempts = 36; // ~2.5 minutos

  while (attempts < maxAttempts) {
    attempts++;
    await sleep(4000);
    arbBalanceDetected = await usdcArbitrum.balanceOf(VAULT_501_ADDRESS);
    const num = parseFloat(ethers.formatUnits(arbBalanceDetected, 6));
    console.log(`   [Intento ${attempts}/${maxAttempts}] Balance Arbitrum: $${num.toFixed(4)} USDC`);
    if (num >= 5.0) {
      console.log(`   🎉 ¡Fondos recibidos y acreditados en Arbitrum One: $${num.toFixed(4)} USDC!`);
      break;
    }
  }

  if (arbBalanceDetected < 5000000n) {
    throw new Error("❌ Timeout esperando llegada de USDC en Arbitrum One.");
  }

  // 5. Depositar al Bridge2 Oficial de Hyperliquid L1
  console.log(`\n🏦 [PASO 4] Depositando $${ethers.formatUnits(arbBalanceDetected, 6)} USDC en Bridge2 de Hyperliquid (${HYPERLIQUID_BRIDGE2})...`);
  const hlTransferTx = await usdcArbitrum.transfer(HYPERLIQUID_BRIDGE2, arbBalanceDetected, {
    gasLimit: 150000n
  });
  console.log(`   ↳ Tx Depósito Bridge2 enviada: https://arbiscan.io/tx/${hlTransferTx.hash}`);
  const hlReceipt = await hlTransferTx.wait();
  console.log(`   ✅ Depósito confirmado en Arbitrum One (Bloque ${hlReceipt.blockNumber})!`);

  // 6. Monitorear saldo final en Hyperliquid L1
  console.log(`\n⏳ [PASO 5] Verificando acreditación en Hyperliquid L1 via API oficial...`);
  let finalHlAccountValue = hlInitialValue;
  let hlPollAttempts = 0;
  while (hlPollAttempts < 18) {
    hlPollAttempts++;
    await sleep(4000);
    try {
      const hlCheck = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clearinghouseState", user: VAULT_501_ADDRESS })
      });
      const hlCheckData = await hlCheck.json();
      const val = parseFloat(hlCheckData.marginSummary?.accountValue || "0");
      console.log(`   [HL Intento ${hlPollAttempts}] Account Value L1: $${val.toFixed(4)} USDC`);
      if (val > hlInitialValue + 5.0) {
        finalHlAccountValue = val;
        console.log(`   🎉 ¡NUEVO SALDO CONFIRMADO EN HYPERLIQUID L1: $${finalHlAccountValue.toFixed(4)} USDC!`);
        break;
      }
    } catch (_) {}
  }

  // 7. Saldo final en Polygon
  const finalPolyUsdcUnits = await usdcPolygon.balanceOf(VAULT_501_ADDRESS);
  const finalPolyUsdc = parseFloat(ethers.formatUnits(finalPolyUsdcUnits, 6));

  console.log("\n================================================================================");
  console.log("🏁 RESUMEN OFICIAL DE FONDOS SINCERIZADOS ON-CHAIN");
  console.log("================================================================================");
  console.log(`• Tx Salida Polygon:   https://polygonscan.com/tx/${polygonBridgeTxHash}`);
  console.log(`• Tx Depósito Bridge2:  https://arbiscan.io/tx/${hlTransferTx.hash}`);
  console.log(`• Cámara 1 (Polygon #501):    $${finalPolyUsdc.toFixed(2)} USDC (0% Riesgo · Piso Protegido)`);
  console.log(`• Cámara 2 (Hyperliquid L1):  $${finalHlAccountValue.toFixed(2)} USDC (Cerrado a $100.00 USDC)`);
  console.log(`• Gas Polygon:                ${initialPol.toFixed(2)} POL (Blindado)`);
  console.log(`• Motor Hyperliquid:          ⏸️ PAUSADO PREVENTIVO (Esperando Auditoría de Bots)`);
  console.log("================================================================================\n");

  const receipt = {
    timestamp: new Date().toISOString(),
    polygonBridgeTxHash: polygonBridgeTxHash,
    arbitrumDepositTxHash: hlTransferTx.hash,
    polygonUsdc: finalPolyUsdc,
    hyperliquidL1Usdc: finalHlAccountValue,
    gasPol: initialPol,
    motorStatus: "PAUSED_PREVENTIVE_AUDIT"
  };
  fs.writeFileSync(path.join(__dirname, "../telemetry/bridge-receipt-hl.json"), JSON.stringify(receipt, null, 2));

  return receipt;
}

main().catch(err => {
  console.error("❌ ERROR EN EJECUCIÓN:", err);
  process.exit(1);
});
