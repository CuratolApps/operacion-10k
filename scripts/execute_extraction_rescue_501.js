process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { getWalletSigner } = require('../swarm-engine');
const { ExchangeClient, InfoClient, HttpTransport } = require('@nktkas/hyperliquid');
const { sendTelegramAlert } = require('../telegram-notifier');

const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const POLYGON_USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const ARBITRUM_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const AAVE_V3_POOL_POLYGON = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
const APOL_USDC_TOKEN = "0xA4D94019934D8333Ef880ABFFbF2FDd611C762BD";
const HL_BRIDGE2_ARBITRUM = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7";
const LOAN_LEDGER_FILE = path.join(__dirname, "..", "telemetry", "vault501-loan-ledger.json");

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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function formatHlPrice(px, coin) {
  if (coin === "BTC" || coin === "PAXG") return Math.round(px).toString();
  if (coin === "ETH" || coin === "BNB" || coin === "AAVE") return (Math.round(px * 10) / 10).toFixed(1);
  if (coin === "SOL") return (Math.round(px * 100) / 100).toFixed(2);
  if (coin === "AVAX") return (Math.round(px * 1000) / 1000).toFixed(3);
  return (Math.round(px * 10000) / 10000).toFixed(4);
}

function formatHlSize(sz, decimals) {
  const factor = Math.pow(10, decimals);
  return (Math.floor(sz * factor) / factor).toFixed(decimals);
}

async function main() {
  console.log("================================================================================");
  console.log("🚁🏦⚡ ÁREA 501 // OPERACIÓN EXTRACCIÓN Y RESCATE CON REMANENTE BÓVEDA #501");
  console.log("================================================================================\n");

  const polyProvider = new ethers.JsonRpcProvider("https://1rpc.io/matic", 137, { staticNetwork: true });
  const arbProvider = new ethers.JsonRpcProvider("https://arb1.arbitrum.io/rpc", 42161, { staticNetwork: true });

  const polySigner = getWalletSigner(501, polyProvider);
  const arbSigner = getWalletSigner(501, arbProvider);

  if (polySigner.address.toLowerCase() !== VAULT_501.toLowerCase()) {
    throw new Error(`Dirección signer inválida: ${polySigner.address} vs ${VAULT_501}`);
  }
  console.log(`🏛️ Bóveda Matriz #501 autenticada: ${polySigner.address} ✔\n`);

  // --- PASO 1: AUDITORÍA EN POLYGON MAINNET ---
  console.log("--- [1. AUDITORÍA EN POLYGON MAINNET] ---");
  const usdcPolyContract = new ethers.Contract(POLYGON_USDC, ERC20_ABI, polySigner);
  const aPolContract = new ethers.Contract(APOL_USDC_TOKEN, ERC20_ABI, polySigner);
  const aavePoolContract = new ethers.Contract(AAVE_V3_POOL_POLYGON, AAVE_POOL_ABI, polySigner);

  const [polBalWei, liquidUsdcUnits, aPolBalUnits, aaveAccountData] = await Promise.all([
    polyProvider.getBalance(VAULT_501),
    usdcPolyContract.balanceOf(VAULT_501),
    aPolContract.balanceOf(VAULT_501),
    aavePoolContract.getUserAccountData(VAULT_501)
  ]);

  const currentPol = parseFloat(ethers.formatEther(polBalWei));
  const currentLiquidUsdc = parseFloat(ethers.formatUnits(liquidUsdcUnits, 6));
  const aPolBal = parseFloat(ethers.formatUnits(aPolBalUnits, 6));
  const collateralUsd = parseFloat(ethers.formatUnits(aaveAccountData.totalCollateralBase, 8));

  console.log(`• POL para Gas (Intocable): ${currentPol.toFixed(4)} POL`);
  console.log(`• USDC Líquido en #501: $${currentLiquidUsdc.toFixed(4)} USDC`);
  console.log(`• Colateral Aave V3: $${aPolBal.toFixed(4)} aPolUSDCn (Valor Base: $${collateralUsd.toFixed(2)})`);

  if (aPolBal < 1.0 && currentLiquidUsdc < 1.0) {
    throw new Error("No hay saldo de USDC disponible para rescatar en Polygon.");
  }

  // --- PASO 2: RETIRO DEL 100% DE AAVE V3 ---
  let aaveWithdrawTxHash = null;
  if (aPolBal > 0.5) {
    console.log(`\n📤 Retirando 100% de Aave V3 ($${aPolBal.toFixed(2)} USDC) hacia Bóveda #501...`);
    const feeData = await polyProvider.getFeeData();
    const withdrawTx = await aavePoolContract.withdraw(POLYGON_USDC, ethers.MaxUint256, VAULT_501, {
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? (feeData.maxPriorityFeePerGas * 15n) / 10n : ethers.parseUnits("45", "gwei"),
      maxFeePerGas: feeData.maxFeePerGas ? (feeData.maxFeePerGas * 15n) / 10n : ethers.parseUnits("220", "gwei")
    });
    console.log(`   ⏳ Tx Retiro Aave enviada: https://polygonscan.com/tx/${withdrawTx.hash}`);
    const receipt = await withdrawTx.wait(1);
    aaveWithdrawTxHash = withdrawTx.hash;
    console.log(`   ✅ Retiro Aave confirmado en Bloque #${receipt.blockNumber}!`);
  }

  // Verificar nuevo saldo líquido total en Polygon
  const totalLiquidUnits = await usdcPolyContract.balanceOf(VAULT_501);
  const totalLiquidUsdc = parseFloat(ethers.formatUnits(totalLiquidUnits, 6));
  console.log(`\n💰 Saldo Líquido Total Disponible en Polygon: $${totalLiquidUsdc.toFixed(4)} USDC ✔`);

  // --- PASO 3: PUENTE A ARBITRUM ONE VIA RELAY PROTOCOL ---
  console.log("\n--- [2. PUENTE INSTITUCIONAL: POLYGON ➔ ARBITRUM ONE VIA RELAY] ---");
  const bridgeUnits = totalLiquidUnits.toString();
  console.log(`📡 Solicitando cotización Relay para $${totalLiquidUsdc.toFixed(2)} USDC...`);

  const quoteRes = await fetch("https://api.relay.link/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: VAULT_501,
      originChainId: 137,
      destinationChainId: 42161,
      originCurrency: POLYGON_USDC,
      destinationCurrency: ARBITRUM_USDC,
      amount: bridgeUnits,
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
    maxPriorityFeePerGas: polyFeeData.maxPriorityFeePerGas ? (polyFeeData.maxPriorityFeePerGas * 15n) / 10n : ethers.parseUnits("45", "gwei"),
    maxFeePerGas: polyFeeData.maxFeePerGas ? (polyFeeData.maxFeePerGas * 15n) / 10n : ethers.parseUnits("220", "gwei")
  });

  const polygonBridgeTxHash = bridgeTx.hash;
  console.log(`   ⏳ Tx Puente enviada en Polygon: https://polygonscan.com/tx/${bridgeTx.hash}`);
  const bridgeReceipt = await bridgeTx.wait(1);
  console.log(`   ✅ Tx Puente confirmada en Polygon (Bloque #${bridgeReceipt.blockNumber})!\n`);

  // --- PASO 4: ESPERAR LLEGADA DE FONDOS EN ARBITRUM ONE ---
  console.log("--- [3. MONITOREO DE ACREDITACIÓN EN ARBITRUM ONE] ---");
  const usdcArbContract = new ethers.Contract(ARBITRUM_USDC, ERC20_ABI, arbSigner);
  let arbReceivedBalance = 0n;
  let attempts = 0;
  const maxAttempts = 35; // ~2.5 minutos

  while (attempts < maxAttempts) {
    attempts++;
    await sleep(4000);
    arbReceivedBalance = await usdcArbContract.balanceOf(VAULT_501);
    const balNum = parseFloat(ethers.formatUnits(arbReceivedBalance, 6));
    console.log(`   [Intento ${attempts}/${maxAttempts}] Balance Arbitrum #501: $${balNum.toFixed(4)} USDC`);
    if (balNum >= (totalLiquidUsdc - 1.5)) {
      console.log(`   🎉 ¡Fondos acreditados en Arbitrum One: $${balNum.toFixed(4)} USDC!\n`);
      break;
    }
  }

  if (arbReceivedBalance < ethers.parseUnits("1.0", 6)) {
    throw new Error("Timeout esperando llegada de USDC en Arbitrum One.");
  }

  // --- PASO 5: DEPÓSITO AL BRIDGE2 OFICIAL DE HYPERLIQUID L1 ---
  console.log("--- [4. DEPÓSITO EN BRIDGE2 DE HYPERLIQUID L1] ---");
  const amountToDepositHL = arbReceivedBalance;
  console.log(`🏦 Transfiriendo $${ethers.formatUnits(amountToDepositHL, 6)} USDC al Bridge2 Oficial (${HL_BRIDGE2_ARBITRUM})...`);

  const arbFeeData = await arbProvider.getFeeData();
  const hlBridgeTx = await usdcArbContract.transfer(HL_BRIDGE2_ARBITRUM, amountToDepositHL, {
    gasLimit: 150000n,
    maxPriorityFeePerGas: arbFeeData.maxPriorityFeePerGas || ethers.parseUnits("0.02", "gwei"),
    maxFeePerGas: arbFeeData.maxFeePerGas ? (arbFeeData.maxFeePerGas * 13n) / 10n : ethers.parseUnits("0.1", "gwei")
  });

  const arbitrumHlTxHash = hlBridgeTx.hash;
  console.log(`   ⏳ Tx Depósito Bridge2 enviada: https://arbiscan.io/tx/${hlBridgeTx.hash}`);
  const hlReceipt = await hlBridgeTx.wait(1);
  console.log(`   ✅ Depósito confirmado en Arbitrum One (Bloque #${hlReceipt.blockNumber})!\n`);

  // --- PASO 6: VERIFICACIÓN EN HYPERLIQUID L1 ---
  console.log("--- [5. VERIFICACIÓN DE FONDOS EN HYPERLIQUID L1] ---");
  let hlAttempts = 0;
  let currentAccountValue = 0;
  const maxHlAttempts = 30; // ~2.5 minutos
  const transport = new HttpTransport({ isTestnet: false });
  const info = new InfoClient({ transport });

  while (hlAttempts < maxHlAttempts) {
    hlAttempts++;
    await sleep(5000);
    try {
      const hlState = await info.clearinghouseState({ user: VAULT_501 });
      currentAccountValue = parseFloat(hlState.marginSummary?.accountValue || "0");
      console.log(`   [Intento ${hlAttempts}/${maxHlAttempts}] AccountValue Hyperliquid: $${currentAccountValue.toFixed(2)} USDC`);
      if (currentAccountValue >= 770.0) {
        console.log(`   🎉 ¡Fondos confirmados en Hyperliquid L1: $${currentAccountValue.toFixed(2)} USDC!\n`);
        break;
      }
    } catch (_) {}
  }

  // --- PASO 7: PINZA DE PROMEDIO EN AVAX-USDC Y DESARME ESCALONADO ---
  console.log("--- [6. PINZA DE PROMEDIO EN AVAX-USDC ($8.79) & SALIDA EN REBOTE] ---");
  const agentWallet = new ethers.Wallet(process.env.HL_AGENT_PRIVATE_KEY);
  const client = new ExchangeClient({ wallet: agentWallet, transport, isTestnet: false });

  // 1. Obtener posición actual de AVAX
  const chState = await info.clearinghouseState({ user: VAULT_501 });
  const avaxPos = (chState.assetPositions || []).find(p => p.position.coin === "AVAX");
  const currentOpenOrders = await info.openOrders({ user: VAULT_501 });

  if (!avaxPos || parseFloat(avaxPos.position.szi) === 0) {
    console.log("No se encontró posición activa de AVAX.");
    return;
  }

  const prevSz = parseFloat(avaxPos.position.szi);
  const prevEntry = parseFloat(avaxPos.position.entryPx);

  // Obtener cotización de libro en AVAX
  const l2 = await info.l2Book({ coin: "AVAX" });
  const bestBid = parseFloat(l2.levels[0][0].px);
  const bestAsk = parseFloat(l2.levels[1][0].px);
  const currentAvaxPx = parseFloat(formatHlPrice(bestAsk, "AVAX"));

  console.log(`• Posición Previa: ${prevSz} AVAX @ $${prevEntry.toFixed(4)}`);
  console.log(`• Precio Actual AVAX: $${currentAvaxPx} (Bid: $${bestBid} / Ask: $${bestAsk})`);

  // Cancelar órdenes anteriores de AVAX para recolocar tras la pinza
  const prevAvaxOrders = currentOpenOrders.filter(o => o.coin === "AVAX");
  if (prevAvaxOrders.length > 0) {
    console.log(`🗑️ Cancelando ${prevAvaxOrders.length} orden(es) previa(s) de AVAX...`);
    await client.cancel({ cancels: prevAvaxOrders.map(o => ({ a: 6, o: o.oid })) });
    console.log("✔ Órdenes previas canceladas.");
  }

  // Comprar refuerzo con el remanente inyectado: ~$450 USD nocional (~51 AVAX @ $8.79)
  const pinzaNocional = 450.0;
  const pinzaSz = parseFloat(formatHlSize(pinzaNocional / currentAvaxPx, 2));
  const pinzaPxStr = formatHlPrice(currentAvaxPx, "AVAX");

  console.log(`\n🎯 Ejecutando Pinza de Refuerzo: Comprando ${pinzaSz} AVAX @ $${pinzaPxStr}...`);
  const buyRes = await client.order({
    orders: [{
      a: 6, // AVAX
      b: true, // BUY
      p: pinzaPxStr,
      s: pinzaSz.toFixed(2),
      r: false,
      t: { limit: { tif: "Ioc" } } // Inmediata para promediar al instante
    }],
    grouping: "na"
  });
  console.log("✔ Resultado orden pinza:", JSON.stringify(buyRes.response?.data?.statuses || buyRes));

  await sleep(2500);

  // Consultar nuevo precio promedio exacto
  const updatedChState = await info.clearinghouseState({ user: VAULT_501 });
  const updatedAvaxPos = (updatedChState.assetPositions || []).find(p => p.position.coin === "AVAX");
  const newTotalSz = parseFloat(updatedAvaxPos.position.szi);
  const newAvgEntry = parseFloat(updatedAvaxPos.position.entryPx);

  console.log(`\n🎉 NUEVA POSICIÓN AVAX PROMEDIADA:`);
  console.log(`• Tamaño Total: ${newTotalSz} AVAX`);
  console.log(`• Nuevo Precio Promedio (entryPx): $${newAvgEntry.toFixed(4)} (Bajó de $${prevEntry.toFixed(4)})`);
  console.log(`• Nocional Total: $${(newTotalSz * newAvgEntry).toFixed(2)} USD`);

  // Salida Escalonada:
  // Tramo 1 (70% Desarme y Alivio en rebote corto): $8.895
  // Tramo 2 (30% Salida Banda Media 1H): $8.942
  const szTramo1 = parseFloat(formatHlSize(newTotalSz * 0.70, 2));
  const szTramo2 = parseFloat(formatHlSize(newTotalSz - szTramo1, 2));
  const pxTramo1 = formatHlPrice(Math.min(newAvgEntry + 0.015, 8.895), "AVAX");
  const pxTramo2 = formatHlPrice(8.942, "AVAX");

  console.log(`\n🎯 PROGRAMANDO SALIDA ESCALONADA DE RESCATE:`);
  console.log(`• Tramo 1 (70% Alivio Inmediato): ${szTramo1} AVAX @ $${pxTramo1} (ReduceOnly ALO)`);
  console.log(`• Tramo 2 (30% Salida Banda Media): ${szTramo2} AVAX @ $${pxTramo2} (ReduceOnly ALO)`);

  const exitLadderRes = await client.order({
    orders: [
      { a: 6, b: false, p: pxTramo1, s: szTramo1.toFixed(2), r: true, t: { limit: { tif: "Alo" } } },
      { a: 6, b: false, p: pxTramo2, s: szTramo2.toFixed(2), r: true, t: { limit: { tif: "Alo" } } }
    ],
    grouping: "na"
  });
  console.log("✔ Salida escalonada registrada en el libro:", JSON.stringify(exitLadderRes.response?.data?.statuses || exitLadderRes));

  // --- PASO 8: ACTUALIZAR REGISTRO DE DEUDA 0% HACIA LA #501 ---
  console.log("\n--- [7. ACTUALIZACIÓN DEL LIBRO MAYOR DE PRÉSTAMO #501] ---");
  const extraInjected = totalLiquidUsdc;
  let ledger = {
    totalInjectedUsdc: 568.50,
    credit501Usdc: 450.00,
    polGasReserveUsdc: 110.50,
    repaidUsdc: 0.00,
    remainingDebtUsdc: 568.50,
    transactions: []
  };

  if (fs.existsSync(LOAN_LEDGER_FILE)) {
    try { ledger = JSON.parse(fs.readFileSync(LOAN_LEDGER_FILE, "utf8")); } catch (_) {}
  }

  const prevInjected = ledger.totalInjectedUsdc || 568.50;
  const newInjected = +(prevInjected + extraInjected).toFixed(2);
  const newCredit501 = +((ledger.credit501Usdc || 450.00) + extraInjected).toFixed(2);
  const newRemaining = +(newInjected - (ledger.repaidUsdc || 0)).toFixed(2);

  ledger.totalInjectedUsdc = newInjected;
  ledger.credit501Usdc = newCredit501;
  ledger.remainingDebtUsdc = newRemaining;
  ledger.lastUpdated = new Date().toISOString();
  ledger.doctrine = "100% Capitalización Pura hasta $1,000 USDC. Al cruzar $1,000: 70% Compuesto / 30% Devolución Bóveda #501";
  ledger.transactions = ledger.transactions || [];
  ledger.transactions.unshift({
    timestamp: new Date().toISOString(),
    action: "OPERACION_RESCATE_AVAX_501_REMANENTE",
    amountUsdc: +extraInjected.toFixed(2),
    aaveWithdrawTx: aaveWithdrawTxHash,
    polygonBridgeTx: polygonBridgeTxHash,
    arbitrumDepositTx: arbitrumHlTxHash,
    newAvgPriceAvax: newAvgEntry,
    exitTramo1: `${szTramo1} @ $${pxTramo1}`,
    exitTramo2: `${szTramo2} @ $${pxTramo2}`,
    totalInjected: newInjected
  });

  fs.writeFileSync(LOAN_LEDGER_FILE, JSON.stringify(ledger, null, 2), "utf8");
  console.log(`✔ Libro mayor actualizado: Inyectado $${newInjected} USDC | Pendiente $${newRemaining} USDC`);

  // --- PASO 9: NOTIFICACIÓN OFICIAL A TELEGRAM ---
  const tgMsg = `🚁🏦⚡ <b>ÁREA 501 // OPERACIÓN EXTRACCIÓN Y RESCATE #00</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏛️ <b>Origen:</b> Bóveda Matriz #501 (Aave V3 Polygon)\n` +
    `💵 <b>Capital Rescatado:</b> <code>+$${extraInjected.toFixed(2)} USDC</code> (100% remanente)\n` +
    `⛽ <b>Gas POL:</b> <code>${currentPol.toFixed(2)} POL</code> (100% Intocable)\n` +
    `⛓️ <b>Ruta Ejecutada:</b> Polygon Aave ➔ Relay Bridge ➔ Arbitrum ➔ Hyperliquid L1\n\n` +
    `🎯 <b>PINZA DE PROMEDIO EN AVAX-USDC:</b>\n` +
    `• <b>Tamaño Consolidado:</b> <code>${newTotalSz} AVAX</code> (~$${(newTotalSz * newAvgEntry).toFixed(0)} USD)\n` +
    `• <b>Precio Promedio Reducido:</b> <code>$${newAvgEntry.toFixed(4)}</code> (vs $${prevEntry.toFixed(4)})\n` +
    `• <b>Tramo 1 (70% Alivio):</b> <code>${szTramo1} AVAX @ $${pxTramo1}</code>\n` +
    `• <b>Tramo 2 (30% Banda Media):</b> <code>${szTramo2} AVAX @ $${pxTramo2}</code>\n\n` +
    `📊 <b>CONTROL DE CRÉDITO #501 (0% INTERÉS):</b>\n` +
    `• Inyectado Total: <code>$${newInjected} USDC</code>\n` +
    `• Meta de Coronación: <code>$1,000.00 USDC</code> (Resta solo ~$${(1000 - currentAccountValue).toFixed(0)} USDC)\n` +
    `• Doctrina: 100% Capitalización hasta $1,000 ➔ luego 70/30\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔗 <b>Tx Polygon:</b> <a href="https://polygonscan.com/tx/${polygonBridgeTxHash}">PolygonScan</a>\n` +
    `🔗 <b>Tx Arbitrum:</b> <a href="https://arbiscan.io/tx/${arbitrumHlTxHash}">ArbiScan</a>`;

  await sendTelegramAlert(tgMsg, process.env.TELEGRAM_CHAT_ID || "-1004342131598", { skipHeader: true });
  console.log("\n📱 Alerta oficial enviada a Telegram con éxito!");
}

main().catch(err => {
  console.error("\n❌ Error en Operación Rescate:", err);
  process.exit(1);
});
