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
const INTERVAL_MS = 25 * 60 * 1000; // 25 minutos

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

async function executeFullCycle(cycleNumber) {
  const startTime = new Date();
  console.log("\n=========================================================================================");
  console.log(`🔁 INICIANDO CICLO DE RESPALDO LOCAL #${cycleNumber} — ${startTime.toISOString()}`);
  console.log("=========================================================================================");

  // 1. Task Runner (Ronda Omnichain)
  runCommand("node task-runner.js", "Task Runner Omnichain");

  // 2. Escaneo de Cosechas
  runCommand("node harvest-rewards.js --scan", "Escaneo de Recompensas");

  // 3. Chequeo de Bóveda Matriz #501
  runCommand("node master-refuel.js --check", "Chequeo Bóveda Matriz #501");

  // 4. Solana Faucet
  runCommand("node solana-faucet-refuel.js", "Solana Devnet Faucet");

  // 5. Vanguard Hunter (Reporte Táctico y Notificación a Telegram)
  runCommand("node vanguard-hunter.js", "10K Vanguard Hunter");

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
  const runNow = process.argv.includes("--now");

  if (runNow) {
    console.log("⚡ Flag --now detectado: Ejecutando primer ciclo inmediatamente...");
    await executeFullCycle(cycleCounter++);
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
