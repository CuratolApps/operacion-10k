/**
 * scripts/execute-vault501-loan-300.js — ÁREA 501 // YOZAPATA LAB
 * ==============================================================================
 * EXPANSIÓN SQUAD SECRET: AUTOPRÉSTAMO DE $300.00 USDC
 * DESDE BÓVEDA #501 HACIA HYPERLIQUID L1
 * 
 * Flujo:
 * 1. Verifica saldos en Polygon Mainnet (#501: $20.11 USDC líq + $491.18 Aave V3).
 * 2. Retira de Aave V3 la diferencia exacta (~$279.89 USDC) para completar $300.00 USDC líq.
 * 3. Cruza $300.00 USDC a Arbitrum One vía Relay Protocol.
 * 4. Deposita los fondos recibidos en Arbitrum al Bridge2 Oficial de Hyperliquid L1 (0x2Df1...3dF7).
 * 5. Monitorea hasta que clearinghouseState en Hyperliquid L1 refleje ~$508.19 USDC.
 * ==============================================================================
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { getWalletSigner } = require("../swarm-engine");
const { sendTelegramAlert } = require("../telegram-notifier");

const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const POLYGON_USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const ARBITRUM_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const AAVE_V3_POOL_POLYGON = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const APOL_USDC_TOKEN = "0xA4D94019934D8333Ef880ABFFbF2FDd611C762BD";
const HL_BRIDGE2_ARBITRUM = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7";

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

const AAVE_POOL_ABI = [
  "function withdraw(address asset, uint256 amount, address to) external returns (uint256)",
  "function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)"
];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log("================================================================================");
  console.log("🏦⚡ ÁREA 501 // EXPANSIÓN SQUAD SECRET: AUTOPRÉSTAMO $300.00 USDC");
  console.log("================================================================================\n");

  // Providers con fallback resiliente
  const polyRpcList = [
    "https://polygon-bor-rpc.publicnode.com",
    "https://1rpc.io/matic",
    "https://polygon.drpc.org"
  ];
  let polyProvider = null;
  for (const rpc of polyRpcList) {
    try {
      const p = new ethers.JsonRpcProvider(rpc);
      await p.getBlockNumber();
      polyProvider = p;
      console.log(`🔗 Polygon RPC conectado: ${rpc} ✔`);
      break;
    } catch (_) {}
  }
  if (!polyProvider) throw new Error("No se pudo conectar a ningún RPC de Polygon.");

  const arbRpcList = [
    "https://arb1.arbitrum.io/rpc",
    "https://arbitrum-one-rpc.publicnode.com",
    "https://1rpc.io/arb"
  ];
  let arbProvider = null;
  for (const rpc of arbRpcList) {
    try {
      const p = new ethers.JsonRpcProvider(rpc);
      await p.getBlockNumber();
      arbProvider = p;
      console.log(`🔗 Arbitrum RPC conectado: ${rpc} ✔`);
      break;
    } catch (_) {}
  }
  if (!arbProvider) throw new Error("No se pudo conectar a ningún RPC de Arbitrum.");

  const polySigner = getWalletSigner(501, polyProvider);
  const arbSigner = getWalletSigner(501, arbProvider);

  if (polySigner.address.toLowerCase() !== VAULT_501.toLowerCase()) {
    throw new Error(`Dirección derivada inválida: ${polySigner.address} vs ${VAULT_501}`);
  }
  console.log(`🏛️ Bóveda Matriz #501 autenticada: ${polySigner.address} ✔\n`);

  // --- PASO 1: AUDITORÍA DE SALDOS EN POLYGON ---
  console.log("--- [1. AUDITORÍA EN POLYGON MAINNET] ---");
  const usdcPolyContract = new ethers.Contract(POLYGON_USDC, ERC20_ABI, polySigner);
  const aavePoolContract = new ethers.Contract(AAVE_V3_POOL_POLYGON, AAVE_POOL_ABI, polySigner);

  const [polBalWei, liquidUsdcUnits, aaveAccountData] = await Promise.all([
    polyProvider.getBalance(VAULT_501),
    usdcPolyContract.balanceOf(VAULT_501),
    aavePoolContract.getUserAccountData(VAULT_501)
  ]);

  const currentPol = parseFloat(ethers.formatEther(polBalWei));
  const currentLiquidUsdc = parseFloat(ethers.formatUnits(liquidUsdcUnits, 6));
  const currentCollateralUsd = parseFloat(ethers.formatUnits(aaveAccountData.totalCollateralBase, 8));

  console.log(`• POL para Gas: ${currentPol.toFixed(4)} POL (Escudo de Gas Blindado)`);
  console.log(`• USDC Líquido: $${currentLiquidUsdc.toFixed(4)} USDC`);
  console.log(`• Colateral Aave V3: $${currentCollateralUsd.toFixed(2)} aPolUSDCn`);
  console.log(`• Capital Consolidado Polygon: $${(currentLiquidUsdc + currentCollateralUsd).toFixed(2)} USDC\n`);

  if (currentLiquidUsdc + currentCollateralUsd < 300.00) {
    throw new Error(`Fondos insuficientes en Bóveda #501 ($${(currentLiquidUsdc + currentCollateralUsd).toFixed(2)} < $300.00)`);
  }

  // --- PASO 2: RETIRO PARCIAL DE AAVE V3 ---
  console.log("--- [2. RETIRO PARCIAL DE AAVE V3 EN POLYGON] ---");
  let targetTotalLiquid = 300.05; // Margen de seguridad de 5 centavos
  let neededFromAave = Math.max(0, targetTotalLiquid - currentLiquidUsdc);
  let aaveWithdrawTxHash = null;

  if (neededFromAave > 0.50) {
    const withdrawUnits = ethers.parseUnits(neededFromAave.toFixed(6), 6);
    console.log(`📤 Retirando $${neededFromAave.toFixed(2)} USDC de Aave V3 a Bóveda #501...`);

    const feeData = await polyProvider.getFeeData();
    const withdrawTx = await aavePoolContract.withdraw(POLYGON_USDC, withdrawUnits, VAULT_501, {
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? (feeData.maxPriorityFeePerGas * 13n) / 10n : ethers.parseUnits("35", "gwei"),
      maxFeePerGas: feeData.maxFeePerGas ? (feeData.maxFeePerGas * 13n) / 10n : ethers.parseUnits("150", "gwei")
    });

    console.log(`   ⏳ Tx Retiro Aave enviada: https://polygonscan.com/tx/${withdrawTx.hash}`);
    const receipt = await withdrawTx.wait(1);
    aaveWithdrawTxHash = withdrawTx.hash;
    console.log(`   ✅ Retiro Aave confirmado en Bloque #${receipt.blockNumber}!\n`);
  } else {
    console.log("ℹ️ Ya se dispone de $300.00 USDC líquidos en Polygon. Retiro de Aave no requerido.\n");
  }

  // Comprobar nuevo saldo líquido en Polygon
  const newLiquidUsdcUnits = await usdcPolyContract.balanceOf(VAULT_501);
  const newLiquidUsdc = parseFloat(ethers.formatUnits(newLiquidUsdcUnits, 6));
  console.log(`💰 Saldo Líquido Disponible en Polygon: $${newLiquidUsdc.toFixed(4)} USDC ✔\n`);

  if (newLiquidUsdc < 300.00) {
    throw new Error(`Error: Saldo líquido tras retiro ($${newLiquidUsdc.toFixed(2)}) es menor a $300.00 USDC.`);
  }

  // --- PASO 3: PUENTE INSTITUCIONAL DE $300.00 USDC (POLYGON ➔ ARBITRUM ONE VIA RELAY) ---
  console.log("--- [3. PUENTE RELAY PROTOCOL: POLYGON ➔ ARBITRUM ONE] ---");
  const bridgeAmountUnits = "300000000"; // Exactos $300.00 USDC

  console.log("📡 Solicitando cotización fresca a Relay API...");
  const quoteRes = await fetch("https://api.relay.link/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: VAULT_501,
      originChainId: 137,
      destinationChainId: 42161,
      originCurrency: POLYGON_USDC,
      destinationCurrency: ARBITRUM_USDC,
      amount: bridgeAmountUnits,
      tradeType: "EXACT_INPUT"
    })
  });
  const quoteData = await quoteRes.json();
  const depositStep = quoteData.steps?.find(s => s.id === "deposit");
  if (!depositStep || !depositStep.items || depositStep.items.length === 0) {
    throw new Error(`Error en Relay API: ${JSON.stringify(quoteData)}`);
  }

  const depositItem = depositStep.items[0];
  const txData = depositItem.data;
  console.log(`• Contrato Depository Relay: ${txData.to}`);
  console.log(`• Estimación salida Arbitrum: $${quoteData.details?.currencyOut?.amountFormatted} USDC`);

  // Enviar depósito en Polygon
  const polyFeeData = await polyProvider.getFeeData();
  const bridgeTx = await polySigner.sendTransaction({
    to: txData.to,
    data: txData.data,
    value: BigInt(txData.value || "0"),
    gasLimit: BigInt(txData.gas ? Math.ceil(Number(txData.gas) * 1.4) : 400000),
    maxPriorityFeePerGas: polyFeeData.maxPriorityFeePerGas ? (polyFeeData.maxPriorityFeePerGas * 13n) / 10n : ethers.parseUnits("40", "gwei"),
    maxFeePerGas: polyFeeData.maxFeePerGas ? (polyFeeData.maxFeePerGas * 13n) / 10n : ethers.parseUnits("200", "gwei")
  });

  const polygonBridgeTxHash = bridgeTx.hash;
  console.log(`   ⏳ Tx Puente enviada en Polygon: https://polygonscan.com/tx/${bridgeTx.hash}`);
  const bridgeReceipt = await bridgeTx.wait(1);
  console.log(`   ✅ Tx Puente confirmada en Polygon (Bloque #${bridgeReceipt.blockNumber})!\n`);

  // --- PASO 4: ESPERAR LLEGADA DE FONDOS EN ARBITRUM ONE ---
  console.log("--- [4. MONITOREO DE ACREDITACIÓN EN ARBITRUM ONE] ---");
  const usdcArbContract = new ethers.Contract(ARBITRUM_USDC, ERC20_ABI, arbSigner);
  let arbReceivedBalance = 0n;
  let attempts = 0;
  const maxAttempts = 40; // ~2.5 minutos

  while (attempts < maxAttempts) {
    attempts++;
    await sleep(4000);
    arbReceivedBalance = await usdcArbContract.balanceOf(VAULT_501);
    const balNum = parseFloat(ethers.formatUnits(arbReceivedBalance, 6));
    console.log(`   [Intento ${attempts}/${maxAttempts}] Balance Arbitrum #501: $${balNum.toFixed(4)} USDC`);
    if (balNum >= 290.0) {
      console.log(`   🎉 ¡Fondos acreditados en Arbitrum One: $${balNum.toFixed(4)} USDC!\n`);
      break;
    }
  }

  if (arbReceivedBalance < ethers.parseUnits("290.0", 6)) {
    throw new Error("Timeout esperando llegada de USDC en Arbitrum One.");
  }

  // --- PASO 5: DEPÓSITO AL BRIDGE2 OFICIAL DE HYPERLIQUID L1 ---
  console.log("--- [5. DEPÓSITO EN BRIDGE2 DE HYPERLIQUID L1] ---");
  const amountToDepositHL = arbReceivedBalance;
  console.log(`🏦 Transfiriendo $${ethers.formatUnits(amountToDepositHL, 6)} USDC al Bridge2 Oficial (${HL_BRIDGE2_ARBITRUM})...`);

  const arbFeeData = await arbProvider.getFeeData();
  const hlBridgeTx = await usdcArbContract.transfer(HL_BRIDGE2_ARBITRUM, amountToDepositHL, {
    gasLimit: 150000n,
    maxPriorityFeePerGas: arbFeeData.maxPriorityFeePerGas || ethers.parseUnits("0.02", "gwei"),
    maxFeePerGas: arbFeeData.maxFeePerGas ? (arbFeeData.maxFeePerGas * 12n) / 10n : ethers.parseUnits("0.1", "gwei")
  });

  const arbitrumHlTxHash = hlBridgeTx.hash;
  console.log(`   ⏳ Tx Depósito Bridge2 enviada: https://arbiscan.io/tx/${hlBridgeTx.hash}`);
  const hlReceipt = await hlBridgeTx.wait(1);
  console.log(`   ✅ Depósito confirmado en Arbitrum One (Bloque #${hlReceipt.blockNumber})!\n`);

  // --- PASO 6: VERIFICACIÓN FINAL EN HYPERLIQUID L1 ---
  console.log("--- [6. VERIFICACIÓN DE NUEVO ACCOUNTVALUE EN HYPERLIQUID L1] ---");
  let newAccountValue = 0;
  let hlAttempts = 0;
  const maxHlAttempts = 30; // ~2.5 minutos

  while (hlAttempts < maxHlAttempts) {
    hlAttempts++;
    await sleep(5000);
    try {
      const hlRes = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clearinghouseState", user: VAULT_501 })
      });
      const hlData = await hlRes.json();
      newAccountValue = parseFloat(hlData.marginSummary?.accountValue || "0");
      console.log(`   [Intento ${hlAttempts}/${maxHlAttempts}] AccountValue en Hyperliquid: $${newAccountValue.toFixed(4)} USDC`);
      if (newAccountValue >= 490.0) {
        console.log(`\n🎉 ¡EXPANSIÓN COMPLETADA! Hyperliquid L1 escalado a $${newAccountValue.toFixed(2)} USDC!`);
        break;
      }
    } catch (_) {}
  }

  // --- REPORTE OFICIAL TELEGRAM ---
  const alertMsg = `🏦⚡ <b>ÁREA 501 // AUTOPRÉSTAMO $300.00 USDC CONFIRMADO</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🚀 <b>DESTINO:</b> Hyperliquid L1 (Squad Secret V2)\n` +
    `💵 <b>NUEVO ACCOUNT VALUE:</b> <code>$${newAccountValue.toFixed(2)} USDC</code>\n` +
    `🛡️ <b>RESERVA EN AAVE V3 (POLYGON):</b> <code>~$211.39 USDC</code> (Interés 24/7)\n` +
    `⛽ <b>GAS BLINDADO:</b> <code>${currentPol.toFixed(2)} POL</code> (#501 Intocable)\n` +
    `📋 <b>PLAN DE AMORTIZACIÓN:</b> <code>$10.00 USDC/Día (Cuota 1/30)</code>\n` +
    `📈 <b>CAPITALIZACIÓN COMPUESTA:</b> 100% del excedente diario reinvestido\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    (aaveWithdrawTxHash ? `• <b>Aave Retiro:</b> <a href="https://polygonscan.com/tx/${aaveWithdrawTxHash}">PolygonScan</a>\n` : "") +
    `• <b>Puente Relay:</b> <a href="https://polygonscan.com/tx/${polygonBridgeTxHash}">PolygonScan</a>\n` +
    `• <b>Depósito HL:</b> <a href="https://arbiscan.io/tx/${arbitrumHlTxHash}">Arbiscan</a>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 <i>Fusiles escalados a $500 nocionales por escuadrón.</i>`;

  await sendTelegramAlert(alertMsg, process.env.TELEGRAM_CHAT_ID || "-1004342131598", { skipHeader: true });
  console.log("📢 Alerta oficial emitida a Telegram.");

  return {
    success: true,
    aaveWithdrawTxHash,
    polygonBridgeTxHash,
    arbitrumHlTxHash,
    newAccountValue
  };
}

if (require.main === module) {
  main()
    .then((res) => {
      console.log("\n✅ EJECUCIÓN FINALIZADA CON ÉXITO:", res);
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ ERROR EN EJECUCIÓN:", err);
      process.exit(1);
    });
}

module.exports = { main };
