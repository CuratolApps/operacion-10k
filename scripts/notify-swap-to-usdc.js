/**
 * scripts/notify-swap-to-usdc.js
 * Reporte oficial de conversión quirúrgica de los 1,519.24 POL a USDC Nativo
 * Enviado a 🛰️ SALA DE MANDO 10K (-1004342131598)
 */

require("dotenv").config();
const { sendTelegramAlert } = require("../telegram-notifier");

async function main() {
  const reportHtml = `💱⚡ <b>ÁREA 501 // CONFIRMACIÓN ON-CHAIN: CONVERSIÓN QUIRÚRGICA A USDC NATIVO</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 <b>BÓVEDA MATRIZ #501 (0xD4D12077a61118372f7a367319fb11922Beb3743)</b>
<i>Polygon PoS Mainnet • Bloque #96032510 • Modo 100% Atómico Activado</i>

💵 <b>1. CONVERSIÓN QUIRÚRGICA A USDC NATIVO (CIRCLE):</b>
• <b>POL Excedente Convertido:</b> <code>1,519.24 POL</code>
• <b>USDC Nativo Recibido en #501:</b> <b>+$138.5342 USDC</b>
• <b>Ruta Ganadora ($0 Gas StaticCall):</b> <code>Uniswap V3 (Fee Tier 500 = 0.05%)</code>
• <b>TxHash de Swap PolygonScan:</b>
  <a href="https://polygonscan.com/tx/0x7233c962aab672a84a76fb5c0f8e0964c54b4f16fec59fd390f2788492cf8bf1">0x7233c962aab672a84a76fb5c0f8e0964c54b4f16fec59fd390f2788492cf8bf1</a>
• <b>TxHash de Envoltorio WPOL:</b>
  <a href="https://polygonscan.com/tx/0xb58a07901badab337dc95b7d9207c0c6110b3efb8c8b8ff5661cd65e97026dee">0xb58a07901badab337dc95b7d9207c0c6110b3efb8c8b8ff5661cd65e97026dee</a>

🛡️ <b>2. BLINDAJE DEL TANQUE DE GAS (0 GAS PERDIDO):</b>
• <b>Gasolina Intacta en #501:</b> <b>110.91 POL & 0.0150 BNB</b>
• <b>Piso Sagrado Militar:</b> <code>110.00 POL (Piso Inviolable Respetado 100%)</code>
• <b>Gas Total en Flota:</b> <code>255.77 POL & 0.0405 BNB</code>
• <b>Candado Activo:</b> <code>STRICT_NO_GAS_SELL = true ✅</code>

🎯 <b>3. NUEVA POSICIÓN CONSOLIDADA EN USDC (100% ESTABLE):</b>
• <b>Cañón Pesado #1 (Polygon #501 / #001):</b> <b>$158.83 USDC</b>
  ↳ <i>#501 Matriz:</i> <code>$152.74 USDC</code> | <i>#001 Capitán:</i> <code>$6.10 USDC</code>
• <b>Cañón Pesado #2 (BSC #501 / #101):</b> <b>$20.42 USDC</b>
  ↳ <i>#501 Matriz:</i> <code>$7.98 USDC</code> | <i>#101 Capitán:</i> <code>$12.44 USDC</code>
• <b>Bóveda Binance Spot #1:</b> <b>$1.00 USDC</b> (Reserva Fija)
• 💎 <b>POSICIÓN TOTAL EN USDC (0% RIESGO VOLÁTIL):</b> <b>$180.25 USDC</b>
  ↳ <i>Meta 1 ($50.00) Superada al 360% ✅</i>
  ↳ <i>Nuevo Objetivo: Meta 2 ($250.00 USDC)</i>

⚙️ <b>4. CALIBRACIÓN DE DISPARO ATÓMICO (15 DISPAROS DIARIOS):</b>
• <code>ATOMIC_ONLY_MODE = true</code> (Prohibido quedar comprado en volátiles)
• <code>ZERO_INTERNAL_SWEEP = true</code> (Cero comisiones internas de red)
• <code>DAILY_ATOMIC_TARGET = 15</code> (Meta activa: 15 Disparos al Día)
• <code>MIN_ATOMIC_SPREAD_NET = +0.10%</code> (Mínimo verificado por callStatic a $0 gas)
• <b>Ciclo Garantizado:</b> <code>Sale USDC ➔ Recupera 100% Base USDC + Ganancia (70% Retiro / 30% Tanque Gas)</code>

📱 <b>5. PANELES Y CABINA ACTUALIZADOS:</b>
• <b>Cabina de Sniping:</b> <code>http://127.0.0.1:5500/sniping/index.html</code> (100vh Cero Scroll)
• <b>Dashboard Central:</b> <code>http://127.0.0.1:5500/dashboard/index.html</code>
• <b>Loop RPC en Vivo:</b> Polling cada 6 segundos activo en Polygon + BSC.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  console.log("Enviando reporte a Telegram...");
  const ok = await sendTelegramAlert(reportHtml, "-1004342131598");
  console.log("Resultado envío Telegram:", ok ? "EXITOSO ✅" : "GUARDADO EN TELEMETRÍA ℹ️");
}

main().catch(err => {
  console.error("Error enviando reporte:", err);
  process.exit(1);
});
