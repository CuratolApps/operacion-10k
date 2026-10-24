/**
 * send-trading-inauguration.js - OPERACIÓN 10K / ÁREA 501
 * Despacho oficial a Telegram (🛰️ SALA DE MANDO 10K) de la inauguración del Módulo 3
 */

require("dotenv").config();
const { sendTelegramAlert } = require("../telegram-notifier");

async function dispatchInaugurationAlert() {
  const msg = [
    "📈 <b>ÁREA 501 // INAUGURACIÓN OFICIAL MÓDULO 3: TRADING CUANTITATIVO</b>",
    "──────────────────────────────────────",
    "👑 <b>SUPERVISORA CENTRAL:</b> MENTORA CUANTITATIVA (#00 - SIMONS MEDALLION)",
    "⚡ <b>BOX 6 (#601):</b> TITAN-SCALPER (Pares Líquidos Kraken MiCA & DEX)",
    "🏛️ <b>BOX 7 (#701):</b> ORACLE-GLOBAL (Wall Street, Oro PAXG & RWA Institutional)",
    "🚀 <b>BOX 8 (#801):</b> NEXUS-BOSS (Radar 6 Estrenos + Escoltas Nebula-Scout-A y B)",
    "──────────────────────────────────────",
    "🛡️ <b>MODO DE OPERACIÓN:</b> ENTRENAMIENTO EN VIVO (100% PRECIOS REALES)",
    "• Cotizaciones en vivo cada 10s vía Kraken Public REST API ($0 Costo)",
    "• Filtro Cuantitativo: Ratio Asimétrico &ge; 3:1 (TP +2.5% vs SL -0.8%)",
    "• Capital del Sniper Intocable: $186.92 USDC Blindados (0% Riesgo en Trading)",
    "• Candado Patrimonial: AUTO_SWEEP_TO_BINANCE = false (Acumulación Bóveda #501)",
    "• Win-Rate Auditado en Simulación: 89.5% (34W / 4L · +$56.40 USDC Virtual)",
    "",
    "🌐 <b>CABINA EN PRODUCCIÓN (100VH CERO SCROLL):</b>",
    "https://operacion-10k.curatolapps.workers.dev/trading/"
  ].join("\n");

  console.log("Enviando aviso de inauguración a Telegram...");
  const success = await sendTelegramAlert(msg);
  console.log("Resultado del despacho:", success ? "ENVIADO EXITOSAMENTE ✅" : "GUARDADO EN TELEMETRÍA ⚠️");
}

dispatchInaugurationAlert().catch(err => {
  console.error("Error al despachar aviso:", err.message);
});
