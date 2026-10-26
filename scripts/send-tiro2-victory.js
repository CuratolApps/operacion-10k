require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { sendTelegramAlert } = require("../telegram-notifier");

async function sendVictory2() {
  const msg = `🟢 <b>ÁREA 501 // SQUAD SECRET // TIRO 2 CERRADO EN GANANCIA NETA</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 <b>LEY DEL FEE BLINDADO CUMPLIDA AL 100%</b>
🎯 <b>PAR:</b> <code>SUI-USDC</code> (Escuadrón Alfa #601)
⚡ <b>MODALIDAD:</b> <code>Doble Maker ALO (Entrada &amp; Salida a 0.015% · Cero Taker Fee)</code>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 <b>AUDITORÍA ON-CHAIN DE LA VICTORIA:</b>
• 📥 <b>Entrada Maker ALO:</b> <code>$0.91110</code> (109.7 SUI · Nocional $99.98)
  ↳ <i>OrderId:</i> <code>#586702448392</code> (crossed: false ✔)
  ↳ <i>Comisión Entrada:</i> <code>-$0.0149 USDC</code>

• 📤 <b>Salida Maker ALO (Breakeven Blindado):</b> <code>$0.91140</code>
  ↳ <i>OrderId:</i> <code>#586703853845</code> (crossed: false ✔)
  ↳ <i>Comisión Salida:</i> <code>-$0.0149 USDC</code> (Cero Taker!)
  ↳ <i>TxHash Salida:</i> <a href="https://app.hyperliquid.xyz/explorer/tx/0x7350264b44b6dd0b74c904476f3c980204630030dfb9fbdd1718d19e03bab6f6">0x7350264b...03bab6f6</a>

• 💰 <b>Ganancia Bruta en Precio:</b> <code>+$0.0329 USDC</code>
• 🏷️ <b>Total Comisiones (Ida + Vuelta Maker):</b> <code>-$0.0299 USDC</code>
• 📈 <b>RESULTADO NETO REAL:</b> <b>+$0.0029 USDC (POSITIVO ✔)</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛡️ <b>ESTADO DE CUENTA TRAS CIERRE:</b>
• <b>Saldo Previo:</b> <code>$99.9700 USDC</code>
• <b>Saldo Actual:</b> <code>$99.9716 USDC</code> (<b>SUBIÓ, NO BAJÓ</b>)
• <b>Posiciones Abiertas:</b> <code>0 (CERO HOLDING · 100% USDC)</code>
• <b>Gas Gastado en L1:</b> <b>$0.00</b>
• <b>Escudo de Reserva:</b> <code>$40.02 USDC (100% Intacto)</code>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 <b>Dashboard:</b> <a href="https://area-501.curatolapps.workers.dev/squad-secret/">Squad Secret en Vivo</a>`;

  const chatId = process.env.TELEGRAM_CHAT_ID || "-1004342131598";
  console.log("Enviando reporte de tiro 2 a Telegram:", chatId);
  await sendTelegramAlert(msg, chatId, { skipHeader: true });
  console.log("✅ Notificación entregada con éxito en Telegram!");
}

sendVictory2().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
