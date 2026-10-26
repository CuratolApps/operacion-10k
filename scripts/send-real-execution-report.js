require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { sendTelegramAlert } = require("../telegram-notifier");

async function sendVictory() {
  const msg = `🟢 <b>ÁREA 501 // SQUAD SECRET // TIRO 1 DE PRUEBA REAL COMPLETADO</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 <b>ESCUADRÓN ALFA (#601 Fuerza Rápida) EN ACCIÓN</b>
🎯 <b>PAR OPERADO:</b> <code>SUI-USDC</code> (🐂 LONG / COMPRA MAKER)
⚡ <b>MODALIDAD:</b> <code>Post-Only ALO ($0.00 Gas de Red)</code>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 <b>FICHA TÉCNICA MILIMÉTRICA DEL TIRO REAL:</b>
• <b>Margen Asignado:</b> <code>$20.00 USDC</code> (5x · Nocional $100.00)
• <b>Tamaño Posición:</b> <code>109.7 SUI</code>
• 📥 <b>Entrada Maker ALO:</b> <code>$0.91140</code>
  ↳ <i>OrderId:</i> <code>#586696508582</code>
  ↳ <i>TxHash Entrada:</i> <a href="https://app.hyperliquid.xyz/explorer/tx/0x13ae208577c7faa7152704476e57f30211b5006b12cb1979b776cbd836cbd491">0x13ae2085...36cbd491</a>
  ↳ <i>Comisión Entrada Maker:</i> <code>-$0.0149 USDC (0.015%)</code>
  ↳ <i>Gas de Red L1:</i> <b>$0.00</b>

• 🔒 <b>Candado Breakeven Mentora #00:</b> Clavado de inmediato
• 📤 <b>Cierre Take Profit / Breakeven:</b> <code>$0.91152</code> (+$0.0131 PnL Bruto)
  ↳ <i>OrderId Salida:</i> <code>#586697160661</code>
  ↳ <i>TxHash Salida:</i> <a href="https://app.hyperliquid.xyz/explorer/tx/0x9c2b6214a62ff8c59da504476e5b0402027600fa412317973ff40d676523d2b0">0x9c2b6214...6523d2b0</a>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️ <b>TIEMPO EN MERCADO:</b> <code>59 Segundos</code> (Micro-scalp Certero)
🛡️ <b>ESTADO TRAS CIERRE:</b>
• <b>Posiciones Abiertas:</b> <code>0 (CERO RIESGO DE MERCADO)</code>
• <b>Retorno a USDC:</b> <code>100% de Fondos en USDC Nativo</code>
• <b>Saldo en Hyperliquid L1:</b> <code>$99.97 USDC</code>
• <b>Escudo de Reserva:</b> <code>$40.02 USDC (100% Intacto e Intocable)</code>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 <b>Dashboard:</b> <a href="https://area-501.curatolapps.workers.dev/squad-secret/">Squad Secret en Vivo</a>`;

  const chatId = process.env.TELEGRAM_CHAT_ID || "-1004342131598";
  console.log("Enviando reporte de victoria on-chain a Telegram:", chatId);
  await sendTelegramAlert(msg, chatId, { skipHeader: true });
  console.log("✅ Reporte militar entregado con éxito en Telegram!");
}

sendVictory().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
