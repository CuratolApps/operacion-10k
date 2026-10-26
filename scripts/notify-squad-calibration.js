require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { sendTelegramAlert } = require("../telegram-notifier");

async function main() {
  const msg = `🎯 <b>ÁREA 501 // SQUAD SECRET // 3 ESCUADRONES SNIPER CALIBRADOS</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏛️ <b>ESTADO DE CALIBRACIÓN:</b> <code>100% LISTOS EN STANDBY</code>
📍 <b>PLATAFORMA:</b> Hyperliquid L1 Maker ($0.00 Gas · 0.015% Maker Fee)
🛡️ <b>ESCUDO DE RESERVA:</b> <code>$40.02 USDC</code> (40% Blindado Intocable en Cash)
💵 <b>MARGEN MÁXIMO ASIGNADO:</b> <code>$60.00 USDC</code> ($20.00 x 3 Escuadrones)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔰 <b>DESPLIEGUE TÁCTICO DE LOS 3 ESCUADRONES (1 PARA 3):</b>

⚡ <b>1. ESCUADRÓN ALFA (#601 Fuerza Rápida)</b>
• <b>Pares asignados:</b> <code>SOL-USDC</code> · <code>SUI-USDC</code> · <code>POL-USDC</code>
• <b>Margen:</b> <code>$20.00 USDC</code> (5x · Nocional $100)
• <b>Objetivo por tiro:</b> <code>+$0.18 a +$0.25 USDC</code>
• <b>Estado:</b> 🟢 <b>STANDBY CALIBRADO (0 Posiciones)</b>

🏛️ <b>2. ESCUADRÓN BRAVO (#701 Macro Refugios)</b>
• <b>Pares asignados:</b> <code>BTC-USDC</code> · <code>PAXG-USDC</code> · <code>LINK-USDC</code>
• <b>Margen:</b> <code>$20.00 USDC</code> (5x · Nocional $100)
• <b>Objetivo por tiro:</b> <code>+$0.20 a +$0.30 USDC</code>
• <b>Estado:</b> 🟢 <b>STANDBY CALIBRADO (0 Posiciones)</b>

🌌 <b>3. ESCUADRÓN CHARLIE (#801 Ecosistema DeFi)</b>
• <b>Pares asignados:</b> <code>ETH-USDC</code> · <code>BNB-USDC</code> · <code>AAVE-USDC</code>
• <b>Margen:</b> <code>$20.00 USDC</code> (5x · Nocional $100)
• <b>Objetivo por tiro:</b> <code>+$0.20 a +$0.28 USDC</code>
• <b>Estado:</b> 🟢 <b>STANDBY CALIBRADO (0 Posiciones)</b>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 <b>REGLAS SNIPER INMUTABLES (FILOSOFÍA DE EXTRACCIÓN):</b>
1. <b>CERO HOLDING:</b> Jamás nos casamos con ninguna moneda ni nos quedamos atrapados.
2. <b>TIRO CERTERO:</b> Entrada exclusiva con desequilibrio L2 >= 65% (Post-Only ALO).
3. <b>CANDADO BREAKEVEN #00:</b> Al tocar +0.04% favorable, SL a precio de entrada. Cero pérdida.
4. <b>RETORNO 100% A USDC:</b> Al tocar Take Profit (+0.08%), toda la liquidez regresa instantáneamente a USDC nativo.
5. <b>TIEMPO EN MERCADO:</b> Micro-operaciones relámpago (15s a 45s). Máximo 1 tiro por escuadrón.

🛑 <b>ESTADO OPERATIVO:</b> En espera de la orden del Comandante para dar <b>PLAY</b>.
🌐 <b>Dashboard Squad Secret:</b> <a href="https://area-501.curatolapps.workers.dev/squad-secret/">Ver Mesa de Mando Calibrada</a>`;

  const targetChatId = process.env.TELEGRAM_CHAT_ID || "-1004342131598";
  console.log("Enviando reporte de calibración a Telegram:", targetChatId);
  const success = await sendTelegramAlert(msg, targetChatId, { skipHeader: true });
  console.log("Resultado entrega:", success ? "✅ ENVIADO EXITOSAMENTE" : "❌ FALLO");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
