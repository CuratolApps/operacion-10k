/**
 * trading-sentinel-loop.js - OPERACIÓN 12K
 * ==============================================================================
 * CENTINELA UNIFICADO DE TRADING CUANTITATIVO & REPORTE TELEGRAM EN VIVO
 * ==============================================================================
 * 
 * ORQUESTA:
 * 1. 👑 NEBULA-MENTOR: SIMONS-MEDALLION #00 (Supervisión fría, cero trampas, 5 axiomas)
 * 2. ⚡ BOX 6: TITAN-SCALPER #601 (Entradas y salidas spot con reporte Telegram de profit)
 * 3. 🏛️ BOX 7: ORACLE-GLOBAL #701 (Estudio de Wall Street y propuestas de mediano plazo)
 * 4. 📊 SINCRONIZACIÓN DE TELEMETRÍA (Dashboard y fleet-telemetry.json)
 */

require("dotenv").config();
const { runTradingMentorEvaluation } = require("./trading-mentor-nebula");
const { runTitanScalperCycle } = require("./titan-pair-trader");
const { runOracleMarketAnalysis } = require("./oracle-global-stocks");
const { generateUnifiedTelemetry } = require("./scripts/ai-telemetry-feed");

async function runSentinelCycle() {
  console.log("\n=========================================================================================");
  console.log("   🌐🛰️ EJECUTANDO CICLO CENTINELA DE TRADING CUANTITATIVO (MENTOR + BOX 6 + BOX 7)    ");
  console.log("   ⏰ Marca de Tiempo: " + new Date().toISOString());
  console.log("=========================================================================================\n");

  try {
    // 1. EVALUACIÓN Y DIRECTRICES DEL MENTOR SUPREMO
    console.log("👑 [PASO 1/4]: Evaluando régimen de mercado con el Mentor Simons-Medallion #00...");
    await runTradingMentorEvaluation();

    // 2. CICLO DEL BOX 6: TITAN-SCALPER
    console.log("\n⚡ [PASO 2/4]: Ejecutando escaneo y gestión de posiciones de Titan-Scalper #601...");
    await runTitanScalperCycle();

    // 3. ANÁLISIS DEL BOX 7: ORACLE-GLOBAL (WALL STREET)
    console.log("\n🏛️ [PASO 3/4]: Analizando activos globales de Wall Street con Oracle-Global #701...");
    await runOracleMarketAnalysis();

    // 4. ACTUALIZACIÓN DE TELEMETRÍA GLOBAL DE LA FLOTA
    console.log("\n📊 [PASO 4/4]: Sincronizando telemetría de la flota y el Dashboard...");
    await generateUnifiedTelemetry();

    console.log("\n✅ [CICLO CENTINELA COMPLETADO]: Todos los módulos reportados y en sincronía.");
  } catch (err) {
    console.error("❌ Error en ciclo centinela:", err.message);
  }
}

async function main() {
  const isLoop = process.argv.includes("--loop");
  const intervalSeconds = 60;

  if (isLoop) {
    console.log(`🚀 Iniciando Centinela en bucle cada ${intervalSeconds} segundos... (Ctrl+C para detener)`);
    await runSentinelCycle();
    setInterval(async () => {
      await runSentinelCycle();
    }, intervalSeconds * 1000);
  } else {
    await runSentinelCycle();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  runSentinelCycle
};
