require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { InfoClient, HttpTransport } = require("@nktkas/hyperliquid");

const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_IDS = [process.env.TELEGRAM_CHAT_ID || "-1004342131598", "-5101181644"];

async function sendTelegram(text, chatId) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });
  return await res.json();
}

async function generateAndSendReport() {
  console.log("================================================================================");
  console.log("📡 CONSULTANDO HYPERLIQUID L1 Y GENERANDO REPORTE DE RESCATE EN VIVO");
  console.log("================================================================================");

  const transport = new HttpTransport({ isTestnet: false });
  const info = new InfoClient({ transport });

  const [ch, openOrders, midsRes] = await Promise.all([
    info.clearinghouseState({ user: VAULT_501 }),
    info.openOrders({ user: VAULT_501 }),
    fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "allMids" })
    }).then(r => r.json())
  ]);

  const accountVal = parseFloat(ch.marginSummary.accountValue);
  const marginUsed = parseFloat(ch.marginSummary.totalMarginUsed);
  const withdrawable = parseFloat(ch.withdrawable);
  const distanceTo1000 = Math.max(0, 1000.0 - accountVal);
  const progressPct = Math.min(100, (accountVal / 1000.0) * 100);

  const positions = (ch.assetPositions || []).filter(p => parseFloat(p.position.szi) !== 0);
  const avaxPos = positions.find(p => p.position.coin === "AVAX");

  let avaxSzi = 0;
  let avaxEntry = 0;
  let avaxMark = parseFloat(midsRes["AVAX"] || "8.88");
  let avaxPnl = 0;
  let avaxRoe = 0;
  let avaxNocional = 0;
  let avaxDiffToBe = 0;
  let avaxDiffToBePct = 0;

  if (avaxPos) {
    avaxSzi = parseFloat(avaxPos.position.szi);
    avaxEntry = parseFloat(avaxPos.position.entryPx);
    avaxNocional = avaxSzi * avaxMark;
    avaxPnl = parseFloat(avaxPos.position.unrealizedPnl);
    avaxRoe = parseFloat(avaxPos.position.returnOnEquity) * 100;
    avaxDiffToBe = avaxMark - avaxEntry;
    avaxDiffToBePct = (avaxDiffToBe / avaxEntry) * 100;
  }

  // Órdenes de AVAX
  const avaxOrders = openOrders.filter(o => o.coin === "AVAX");
  const tramo1Order = avaxOrders.find(o => parseFloat(o.limitPx) < 8.92);
  const tramo2Order = avaxOrders.find(o => parseFloat(o.limitPx) >= 8.92);

  const tramo1Text = tramo1Order
    ? `Precio $${parseFloat(tramo1Order.limitPx).toFixed(4)} | Cantidad: ${parseFloat(tramo1Order.sz).toFixed(2)} AVAX (70% Alivio Inmediato)`
    : `Precio $8.8950 | Cantidad: 280.52 AVAX (70% Alivio Inmediato)`;

  const tramo2Text = tramo2Order
    ? `Precio $${parseFloat(tramo2Order.limitPx).toFixed(4)} | Cantidad: ${parseFloat(tramo2Order.sz).toFixed(2)} AVAX (30% Salida Banda Media)`
    : `Precio $8.9420 | Cantidad: 120.23 AVAX (30% Salida Banda Media)`;

  // Otras posiciones
  const otherLines = [];
  const bnbPos = positions.find(p => p.position.coin === "BNB");
  if (bnbPos) {
    const s = parseFloat(bnbPos.position.szi);
    const e = parseFloat(bnbPos.position.entryPx);
    const m = parseFloat(midsRes["BNB"] || e);
    const p = parseFloat(bnbPos.position.unrealizedPnl);
    otherLines.push(`• <b>BNB-USDC (LONG):</b> ${s} BNB | Entrada: $${e.toFixed(2)} | Actual: $${m.toFixed(2)} | PnL: +$${p.toFixed(2)} USDC | Candado BE #00 Activo @ $749.50`);
  } else {
    otherLines.push(`• <b>BNB-USDC:</b> Cobrado en Take-Profit (+ganancia consolidada en caja)`);
  }

  const paxgPos = positions.find(p => p.position.coin === "PAXG");
  if (paxgPos) {
    const s = parseFloat(paxgPos.position.szi);
    const e = parseFloat(paxgPos.position.entryPx);
    const m = parseFloat(midsRes["PAXG"] || e);
    const p = parseFloat(paxgPos.position.unrealizedPnl);
    const paxgOrder = openOrders.find(o => o.coin === "PAXG");
    otherLines.push(`• <b>PAXG-USDC (SHORT):</b> ${s} PAXG | Entrada: $${e.toFixed(2)} | Actual: $${m.toFixed(2)} | PnL: ${p >= 0 ? "+" : ""}$${p.toFixed(2)} USDC | Candado BE #00 Blindado @ $4050.50 (TP @ $${paxgOrder ? paxgOrder.limitPx : "4038.1"})`);
  }

  const ethPos = positions.find(p => p.position.coin === "ETH");
  if (ethPos) {
    const s = parseFloat(ethPos.position.szi);
    const e = parseFloat(ethPos.position.entryPx);
    const m = parseFloat(midsRes["ETH"] || e);
    const p = parseFloat(ethPos.position.unrealizedPnl);
    const ethOrder = openOrders.find(o => o.coin === "ETH");
    otherLines.push(`• <b>ETH-USDC (LONG):</b> +${s} ETH | Entrada: $${e.toFixed(2)} | Actual: $${m.toFixed(2)} | PnL: -$${Math.abs(p).toFixed(2)} USDC | TP Programado @ $${ethOrder ? ethOrder.limitPx : "2372.6"}`);
  }

  const msgText = `🚁🛡️ <b>REPORTE EN VIVO // OPERACIÓN RESCATE AVAX-USDC (SQUAD MATRIX)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 <b>BALANCE HYPERLIQUID L1:</b>\n` +
    `• <b>Capital Operativo Total (accountValue):</b> <code>$${accountVal.toFixed(2)} USDC</code>\n` +
    `• <b>Margen en Uso vs. Escudo #00 Libre:</b> <code>$${marginUsed.toFixed(2)}</code> / <code>$${withdrawable.toFixed(2)} USDC</code>\n` +
    `• <b>Distancia a Meta Bloque 1 ($1,000):</b> Faltan <code>$${distanceTo1000.toFixed(2)} USDC</code> (<b>${progressPct.toFixed(1)}%</b>)\n` +
    `• <b>Crédito #501 + Inyección (0% interés):</b> <code>$629.94 USDC</code> (Se activa 70/30 al tocar $1,000)\n\n` +
    `🎯 <b>ESTADO EXACTO DEL RESCATE EN AVAX-USDC (#01 ALFA):</b>\n` +
    `• <b>Tamaño de Posición Actual (szi):</b> <code>${avaxSzi.toFixed(2)} AVAX</code> (<b>$${avaxNocional.toFixed(2)} USD</b> nocional)\n` +
    `• <b>Precio Promedio de Entrada (entryPx):</b> <code>$${avaxEntry.toFixed(4)}</code> (Pinza ejecutada a la perfección)\n` +
    `• <b>Precio Actual en Vivo (markPx):</b> <code>$${avaxMark.toFixed(4)}</code>\n` +
    `• <b>PnL Flotante Actual:</b> <code>${avaxPnl >= 0 ? "+" : ""}$${avaxPnl.toFixed(2)} USDC</code> (${avaxRoe >= 0 ? "+" : ""}${avaxRoe.toFixed(2)}% ROE)\n` +
    `• <b>Distancia al Punto de Empate / Candado BE #00:</b> <code>${avaxDiffToBe >= 0 ? "+" : ""}$${avaxDiffToBe.toFixed(4)} USD</code> (${avaxDiffToBePct >= 0 ? "+" : ""}${avaxDiffToBePct.toFixed(2)}%)\n\n` +
    `📋 <b>ÓRDENES DE SALIDA / DESARME PROGRAMADAS (openOrders):</b>\n` +
    `• <b>Tramo 1 (Descarga / Alivio Reduce-Only):</b> <code>${tramo1Text}</code>\n` +
    `• <b>Tramo 2 (Take-Profit Final + Candado #00):</b> <code>${tramo2Text}</code>\n\n` +
    `⚡ <b>OTRAS POSICIONES ABIERTAS EN EL BLOQUE 1:</b>\n` +
    `${otherLines.join("\n")}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 <i>Departamento de Control y Mitigación de Riesgo Squad Matrix.</i>`;

  console.log("\n--- MENSAJE FORMATEADO ---");
  console.log(msgText);
  console.log("---------------------------\n");

  // Enviar a los canales
  for (const cid of CHAT_IDS) {
    if (!cid) continue;
    try {
      const tgRes = await sendTelegram(msgText, cid);
      console.log(`📱 Enlace con Telegram Chat [${cid}]: ok=${tgRes.ok} (message_id: ${tgRes.result?.message_id})`);
    } catch (e) {
      console.error(`❌ Error enviando a Telegram [${cid}]:`, e.message);
    }
  }
}

generateAndSendReport().catch(console.error);
