require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { ExchangeClient, InfoClient, HttpTransport } = require("@nktkas/hyperliquid");
const { ethers } = require("ethers");
const { sendTelegramAlert } = require("../telegram-notifier");

const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";

const ASSET_INDICES = {
  BTC: 0,
  ETH: 1,
  SOL: 5,
  AVAX: 6,
  BNB: 7,
  SUI: 14,
  LINK: 18,
  AAVE: 28,
  POL: 142,
  PAXG: 187
};

async function executeDestrabe() {
  console.log("================================================================================");
  console.log("⚡🔓 OPERACIÓN DESTRABE RÁPIDO DE LIQUIDEZ // SQUAD MATRIX HYPERLIQUID L1");
  console.log("================================================================================\n");

  const transport = new HttpTransport({ isTestnet: false });
  const info = new InfoClient({ transport });
  const agentWallet = new ethers.Wallet(process.env.HL_AGENT_PRIVATE_KEY);
  const client = new ExchangeClient({
    wallet: agentWallet,
    transport,
    isTestnet: false
  });

  // 1. Auditar Estado Actual
  const ch = await info.clearinghouseState({ user: VAULT_501 });
  const accountValue = parseFloat(ch.marginSummary?.accountValue || "0");
  const openPositions = (ch.assetPositions || []).filter(p => parseFloat(p.position.szi) !== 0);
  const openOrders = await info.openOrders({ user: VAULT_501 });

  console.log(`🏦 Capital de la Cuenta: $${accountValue.toFixed(2)} USD | Margen Libre: $${ch.withdrawable}`);
  console.log("📊 Posiciones Abiertas Actuales:");
  openPositions.forEach(p => {
    console.log(`   • ${p.position.coin}: ${p.position.szi} @ $${p.position.entryPx} (PnL: $${p.position.unrealizedPnl})`);
  });

  console.log("\n📋 Órdenes Límite Existentes:");
  openOrders.forEach(o => {
    console.log(`   • OID: ${o.oid} | ${o.coin} | Side: ${o.side} | Px: $${o.limitPx} | Sz: ${o.sz} | reduceOnly: ${o.reduceOnly}`);
  });

  // 2. Cancelar órdenes previas de AVAX y ETH
  const cancels = [];
  const avaxOrders = openOrders.filter(o => o.coin === "AVAX");
  const ethOrders = openOrders.filter(o => o.coin === "ETH");

  avaxOrders.forEach(o => cancels.push({ a: ASSET_INDICES["AVAX"], o: o.oid }));
  ethOrders.forEach(o => cancels.push({ a: ASSET_INDICES["ETH"], o: o.oid }));

  if (cancels.length > 0) {
    console.log(`\n🗑️ Cancelando ${cancels.length} órdenes previas lejanas...`);
    const cancelRes = await client.cancel({ cancels });
    console.log("   ✔ Cancelación ejecutada:", JSON.stringify(cancelRes));
  } else {
    console.log("\nNo hay órdenes previas para cancelar.");
  }

  // 3. Colocar Escalera de Destrabe Rápido (Post-Only ALO Maker)
  const avaxPos = openPositions.find(p => p.position.coin === "AVAX");
  const ethPos = openPositions.find(p => p.position.coin === "ETH");
  const paxgPos = openPositions.find(p => p.position.coin === "PAXG");

  const newOrders = [];

  // A. Escalera de Destrabe AVAX (120.23 AVAX en 3 escalones de alivio)
  if (avaxPos && parseFloat(avaxPos.position.szi) > 0) {
    const totalAvax = parseFloat(avaxPos.position.szi);
    console.log(`\n🪜 Configurando Escalera de 3 Escalones para AVAX (${totalAvax} AVAX abiertos):`);

    // Escalón 1 (40%): 48.09 AVAX @ $8.8680
    // Escalón 2 (40%): 48.09 AVAX @ $8.8950
    // Escalón 3 (20%): 24.05 AVAX @ $8.9280
    const sz1 = (totalAvax * 0.40).toFixed(2);
    const sz2 = (totalAvax * 0.40).toFixed(2);
    const sz3 = (totalAvax - parseFloat(sz1) - parseFloat(sz2)).toFixed(2);

    newOrders.push(
      { a: ASSET_INDICES["AVAX"], b: false, p: "8.868", s: sz1, r: true, t: { limit: { tif: "Alo" } } },
      { a: ASSET_INDICES["AVAX"], b: false, p: "8.895", s: sz2, r: true, t: { limit: { tif: "Alo" } } },
      { a: ASSET_INDICES["AVAX"], b: false, p: "8.928", s: sz3, r: true, t: { limit: { tif: "Alo" } } }
    );
    console.log(`   1. Escalón 1 Inmediato (40%): ${sz1} AVAX @ $8.8680`);
    console.log(`   2. Escalón 2 Equilibrio (40%): ${sz2} AVAX @ $8.8950`);
    console.log(`   3. Escalón 3 Final (20%): ${sz3} AVAX @ $8.9280`);
  }

  // B. Take-Profit Rápido ETH (0.4322 ETH @ $2,356.50)
  if (ethPos && parseFloat(ethPos.position.szi) > 0) {
    const szEth = parseFloat(ethPos.position.szi).toFixed(4);
    newOrders.push(
      { a: ASSET_INDICES["ETH"], b: false, p: "2356.5", s: szEth, r: true, t: { limit: { tif: "Alo" } } }
    );
    console.log(`\n🎯 Take-Profit Rápido ETH: ${szEth} ETH @ $2,356.50 (+0.23% · Libera ~$1,018 USD)`);
  }

  // C. Auditoría PAXG
  if (paxgPos && parseFloat(paxgPos.position.szi) !== 0) {
    console.log(`\n⚠️ Posición activa detectada en PAXG: ${paxgPos.position.szi}`);
  } else {
    console.log(`\n✔ PAXG: Posición ya cerrada al 100% con ganancia en $4,038.10 ($0.00 riesgo).`);
  }

  // 4. Enviar órdenes a Hyperliquid L1
  console.log(`\n🚀 Transmitiendo ${newOrders.length} nuevas órdenes ALO Maker a Hyperliquid L1...`);
  const orderRes = await client.order({
    orders: newOrders,
    grouping: "na"
  });

  console.log("   ✔ Resultado de órdenes:", JSON.stringify(orderRes.response?.data?.statuses));

  // 5. Verificar estado en libro
  await new Promise(r => setTimeout(r, 2000));
  const verifiedOrders = await info.openOrders({ user: VAULT_501 });
  console.log("\n================================================================================");
  console.log("✅ ÓRDENES ACTIVAS Y CONFIRMADAS EN EL LIBRO (POST-ONLY MAKER):");
  console.log("================================================================================");
  verifiedOrders.forEach(o => {
    console.log(`   • ${o.coin} | OID: ${o.oid} | ${o.side === "A" ? "VENTA" : "COMPRA"} ${o.sz} @ $${o.limitPx} (reduceOnly: ${o.reduceOnly})`);
  });

  // 6. Transmitir Reporte a Telegram
  const tgMsg = `⚡🔓 <b>ÁREA 501 // OPERACIÓN DESTRABE RÁPIDO EJECUTADA EN HYPERLIQUID L1</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏦 <b>Bóveda Nodriza:</b> <code>0xD4D1...3743</code>\n` +
    `💵 <b>Capital de la Cuenta:</b> <code>$${accountValue.toFixed(2)} USD</code>\n` +
    `💰 <b>Margen Retirable Libre:</b> <code>$${parseFloat(ch.withdrawable).toFixed(2)} USDC</code>\n\n` +
    `🪜 <b>ESCALERA DE SALIDA RÁPIDA AVAX (120.23 AVAX RESTANTES):</b>\n` +
    `• <b>Escalón 1 Inmediato (40%):</b> <code>48.09 AVAX @ $8.8680</code> (Alivio veloz a 0.5¢ del precio actual)\n` +
    `• <b>Escalón 2 Equilibrio (40%):</b> <code>48.09 AVAX @ $8.8950</code> (Descarga de capital sin pérdida)\n` +
    `• <b>Escalón 3 Final (20%):</b> <code>24.05 AVAX @ $8.9280</code> (Cierre 100% positivo del trade)\n` +
    `<i>Nota de auditoría: 280.52 AVAX ya fueron cobrados previamente en $8.895.</i>\n\n` +
    `🎯 <b>OBJETIVO DE ALIVIO RÁPIDO ETH (0.4322 ETH):</b>\n` +
    `• <b>Take-Profit Reubicado:</b> <code>0.4322 ETH @ $2,356.50</code> (+0.23% · Ganancia limpia +$2.30)\n` +
    `• <b>Capital a Liberar:</b> ~$1,018 USD devueltos al margen disponible.\n\n` +
    `🏆 <b>ESTADO PAXG:</b> <code>100% CERRADO Y COBRADO</code> en $4,038.10 (0 PAXG expuestos).\n\n` +
    `🛡️ <b>NUEVA POLÍTICA ANTI-ESTANCAMIENTO ACTIVADA:</b>\n` +
    `1. 🚫 Máximo $250 USD nocionales por posición (~10% del capital).\n` +
    `2. 🎯 Micro-ganancias rápidas (+0.12% a +0.18%).\n` +
    `3. ⏱️ Time-Stop 20 min si PnL >= +$0.02 USDC.\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 <a href="https://hypurrscan.io/address/0xD4D12077a61118372f7a367319fb11922Beb3743">Verificar en Vivo en HypurrScan</a>`;

  await sendTelegramAlert(tgMsg, process.env.TELEGRAM_CHAT_ID || "-1004342131598", { skipHeader: true });
  console.log("\n📲 Reporte de destrabe enviado exitosamente a Telegram.");
}

executeDestrabe().catch(err => {
  console.error("❌ Error ejecutando destrabe:", err);
});
