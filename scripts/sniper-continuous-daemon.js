/**
 * scripts/sniper-continuous-daemon.js - Operación 10k // ÁREA 501
 * BUCLE CONTINUO 24/7 EN CADENA:
 *   1. OBSERVADORES ($0 Gas vía Multicall3 en Polygon + BSC)
 *   2. 32 NEBULOSAS IA (16 Binomios Escoltas: Abridora >=95% + Guardaespaldas 5 Candados)
 *   3. SNIPER ATÓMICO (Disparo quirúrgico ante retorno neto >= +$0.03 USDC)
 *
 * Ejecución:
 *   node scripts/sniper-continuous-daemon.js [--interval 4] [--duration 0] [--dry-run]
 */

require("dotenv").config();
const path = require("path");
const fs = require("fs");

const { runDedicatedObservers } = require("../dedicated-observers");
const { runNebulaCommanders, evaluateEscortPairForRoute } = require("../nebula-ai-commanders");
const { runAutoShooter } = require("./atomic-auto-shooter");

const parseArg = (flag, def) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};

const INTERVAL_SEC = Math.max(2, Number(parseArg("--interval", 3)));
const DURATION_SEC = Number(parseArg("--duration", 0)); // 0 = infinito
const DRY_RUN = process.argv.includes("--dry-run") || process.env.AUTO_SHOOTER_DRY === "1";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runCycle(cycleNum) {
  const start = Date.now();
  const utc = new Date().toISOString().slice(11, 19) + " UTC";
  console.log(`\n🌌 [CICLO 24/7 #${cycleNum} · ${utc}] ➔ OBSERVADORES ➔ 32 NEBULOSAS (DOBLE LLAVE) ➔ SNIPER ATÓMICO`);

  try {
    await runDedicatedObservers();
  } catch (err) {
    console.warn("  ⚠️ Error en ciclo continuo:", err.message);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`  ⏱️ Ciclo #${cycleNum} completado en ${elapsed}s (Pausa: ${INTERVAL_SEC}s)`);
}

async function main() {
  console.log("=========================================================================================");
  console.log("🚀 DEMONIO CONTINUO 24/7: OBSERVADORES + 32 NEBULOSAS IA + NODRIZAS SNIPER ATÓMICAS");
  console.log(`   Cadencia: cada ${INTERVAL_SEC} segundos | Modo: ${DRY_RUN ? "SIMULACIÓN (DRY-RUN)" : "EN VIVO"}`);
  console.log(`   Duración: ${DURATION_SEC > 0 ? DURATION_SEC + " segundos" : "Ininterrumpido 24/7"}`);
  console.log("=========================================================================================");

  let cycle = 1;
  const startTime = Date.now();

  while (true) {
    if (DURATION_SEC > 0 && ((Date.now() - startTime) / 1000) >= DURATION_SEC) {
      console.log(`\n🏁 Duración límite de ${DURATION_SEC}s alcanzada. Finalizando demonio.`);
      break;
    }

    try {
      await runCycle(cycle++);
    } catch (err) {
      console.error("❌ Excepción en bucle de sniping:", err.message);
    }

    await sleep(INTERVAL_SEC * 1000);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error("Fatal demonio:", err);
    process.exit(1);
  });
}

module.exports = { runCycle, main };
