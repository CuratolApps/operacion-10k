/**
 * scripts/keep-alive-loop.js - Operación 10k
 * Demonio de respaldo local en segundo plano.
 * Dispara la ronda completa cada 25 minutos como respaldo mientras la PC esté encendida.
 *
 * Mantiene la Sala de Mando informada y actualiza constantemente la telemetría histórica.
 */

require("dotenv").config();
const { execSync } = require("child_process");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");
const REPORT_FILE = path.join(ROOT_DIR, "last-run-report.json");

/**
 * Verificador inteligente Anti-Colisión (Keep-Alive vs GitHub Actions / Cloud Runner)
 * Previene colisiones de nonce e impactos dobles si la nube o una ronda previa corrió recientemente.
 */
function checkAntiCollisionLock() {
  if (!fs.existsSync(REPORT_FILE)) return { canRunOnChain: true, elapsedMin: 999 };
  try {
    const report = JSON.parse(fs.readFileSync(REPORT_FILE, "utf8"));
    if (!report.timestamp) return { canRunOnChain: true, elapsedMin: 999 };
    const lastRunTime = new Date(report.timestamp).getTime();
    const elapsedMs = Date.now() - lastRunTime;
    const elapsedMin = elapsedMs / (60 * 1000);
    return {
      canRunOnChain: elapsedMin >= 25,
      elapsedMin: parseFloat(elapsedMin.toFixed(1)),
      lastTimestamp: report.timestamp
    };
  } catch (_) {
    return { canRunOnChain: true, elapsedMin: 999 };
  }
}

function runCommand(command, description) {
  const time = new Date().toISOString();
  console.log(`\n[${time}] ▶️  ${description} (${command})...`);
  try {
    execSync(command, {
      cwd: ROOT_DIR,
      stdio: "inherit",
      timeout: 300000 // 5 minutos de timeout por comando
    });
    console.log(`[${new Date().toISOString()}] ✅  ${description} completado.`);
    return true;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ⚠️  Error ejecutando ${description}:`, err.message);
    return false;
  }
}

async function executeFullCycle(cycleNumber, forceOnChain = false) {
  const startTime = new Date();
  console.log("\n=========================================================================================");
  console.log(`🔁 VERIFICANDO TURNO DE CICLO LOCAL #${cycleNumber} — ${startTime.toISOString()}`);
  console.log("=========================================================================================");

  const collisionLock = checkAntiCollisionLock();

  if (!forceOnChain && !collisionLock.canRunOnChain) {
    console.log(`🔒 [ANTI-COLLISION LOCK ACTIVO] Última corrida on-chain detectada hace ${collisionLock.elapsedMin} min (< 25 min).`);
    console.log(`ℹ️ Evitando colisión de nonce con la nube / ronda previa. Sincronizando telemetría y dashboard pasivo...`);

    // Sincronización pasiva de telemetría sin disparar transacciones on-chain
    runCommand("node scripts/ai-telemetry-feed.js", "AI Telemetry Feed Sync (Modo Pasivo)");
    runCommand("node harvest-rewards.js --scan", "Escaneo Pasivo de Recompensas");
    console.log(`⏳ Esperando a que transcurran > 25-30 min desde la última corrida on-chain para tomar turno automático.`);
    return;
  }

  console.log(`⚡ [TURNO ON-CHAIN HABILITADO] Han transcurrido ${collisionLock.elapsedMin} min desde la última corrida. Procediendo con la ronda completa.`);

  // 1. Solana Devnet Faucet Refuel
  runCommand("node solana-faucet-refuel.js", "Solana Devnet Faucet");

  // 2. Task Runner (Ronda Omnichain)
  runCommand("node task-runner.js", "Task Runner Omnichain");

  // 3. Bot Miner Swarm (Minería On-Chain, Firmas Gasless, Granja Bitcoin L2 & Vigía 501)
  runCommand("node bot-miner-swarm.js", "Bot Miner Swarm");

  // 3.2. Motor GameFi Bot Swarm (Juegos Web3, Metaverso & Reclamos)
  runCommand("node gamefi-bot-swarm.js", "GameFi Bot Swarm (Galaxia 2)");

  // 3.5. Motor Lomo 4: ROI Gas $50, Velocímetro $5.50/bot & Bounties Mainnet
  runCommand("node bounty-and-quota-engine.js", "Bounty & Quota Engine (Lomo 4)");

  // 3.8. Motor Lomo 5: Cerebro Autónomo, ADN Anti-Sybil & Auto-Liquidador DEX a USDC
  runCommand("node autonomous-brain-lomo5.js", "Cerebro Autónomo & Anti-Sybil (Lomo 5)");

  // 3.9. Motor de Saturación Multidepartamento X500 (6 Departamentos de Extracción)
  runCommand("node saturation-liquidity-engine.js", "Motor de Saturación de Liquidez X500");

  // 4. Escaneo de Cosechas (Embudo USDC a Binance)
  runCommand("node harvest-rewards.js --scan", "Escaneo de Recompensas");

  // 5. Auto-Recarga Bóveda Matriz #501 & Dispersión Intra-Box
  runCommand("node master-refuel.js --intra-box", "Auto-Recarga Bóveda Matriz #501 & Dispersión Intra-Box");

  // 6. Vanguard Hunter (Reporte Táctico y Notificación a Telegram)
  runCommand("node vanguard-hunter.js", "10K Vanguard Hunter");

  // 7. Sincronización AI Telemetry Feed
  runCommand("node scripts/ai-telemetry-feed.js", "AI Telemetry Feed Sync");

  const durationMin = ((Date.now() - startTime.getTime()) / 60000).toFixed(2);
  console.log("\n=========================================================================================");
  console.log(`🎉 CICLO #${cycleNumber} FINALIZADO (${durationMin} min)`);
  console.log(`⏳ Próximo ciclo programado en 25 minutos (${new Date(Date.now() + INTERVAL_MS).toLocaleTimeString("es-ES")})...`);
  console.log("=========================================================================================\n");
}

async function main() {
  console.log("=========================================================================================");
  console.log("       🛰️ OPERACIÓN 10K — DEMONIO LOCAL DE RESPALDO CONTINUO (KEEP-ALIVE LOOP)          ");
  console.log("=========================================================================================");
  console.log(`⏱️ Intervalo configurado: Cada 25 minutos (${INTERVAL_MS / 1000}s)`);
  console.log(`📂 Directorio base      : ${ROOT_DIR}`);
  console.log(`📱 Destino Telegram     : Sala de Mando 10K\n`);

  let cycleCounter = 1;
  const runNow = process.argv.includes("--now") || process.argv.includes("--force");

  if (runNow) {
    console.log("⚡ Flag --now / --force detectado: Ejecutando ciclo forzado inmediatamente...");
    await executeFullCycle(cycleCounter++, true);
  } else {
    console.log(`⏳ Primer ciclo de respaldo programado para dentro de 25 minutos (${new Date(Date.now() + INTERVAL_MS).toLocaleTimeString("es-ES")})...`);
  }

  // Loop programado cada 25 minutos
  setInterval(async () => {
    try {
      await executeFullCycle(cycleCounter++);
    } catch (e) {
      console.error("❌ Error en loop de respaldo:", e.message);
    }
  }, INTERVAL_MS);
}

process.on("SIGINT", () => {
  console.log("\n🛑 Demonio de respaldo detenido por el usuario.");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Demonio de respaldo finalizado.");
  process.exit(0);
});

if (require.main === module) {
  main().catch(err => {
    console.error("❌ Error fatal en keep-alive daemon:", err);
    process.exit(1);
  });
}

module.exports = { executeFullCycle };
