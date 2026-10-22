/**
 * scripts/keep-alive-loop.js - Operación 10k
 * Demonio de respaldo local en segundo plano.
 * Dispara la ronda completa cada 25 minutos como respaldo mientras la PC esté encendida.
 *
 * Mantiene la Sala de Mando informada y actualiza constantemente la telemetría histórica.
 */

require("dotenv").config();
const fs = require("fs");
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
    runCommand("node dedicated-observers.js", "Cuerpo de Observadores Dedicados (Multi-DEX $0 Gas)");
    runCommand("node security-fortress-shield.js", "Escudo Militar de Seguridad & Latencia RPC (< 250ms)");
    runCommand("node omni-sniper-5models.js", "Omni-Sniper 5 Modelos On-Chain (Lectura Dinámica $0 Gas)");
    runCommand("node nebula-ai-commanders.js", "Las 34 Nebulosas IA (Actualización de Directrices)");
    runCommand("node expert-captains-command.js", "Jefatura de Capitanes Expertos (#001 y #101)");
    runCommand("node dual-capitalizer-engine.js", "Motor Dual-Capitalizador (70/30 Compounding)");
    runCommand("node live-launch-calendar-hunter.js", "Cazador en Vivo de Lanzamientos Próximos (#33 & #34)");
    runCommand("node cybershinobi-swarm-strike.js", "CyberShinobi Genesis Swarm Strike X500");
    runCommand("node bounty-booty-commander.js", "Bounty Booty Commander (Vía B $2,225 USDC)");
    runCommand("node scripts/onchain-snapshot.js", "Snapshot On-Chain Consolidado");
    runCommand("node scripts/ai-telemetry-feed.js", "AI Telemetry Feed Sync (Modo Pasivo)");
    runCommand("node harvest-rewards.js --scan", "Escaneo Pasivo de Recompensas");
    console.log(`⏳ Esperando a que transcurran > 25-30 min desde la última corrida on-chain para tomar turno automático.`);
    return;
  }

  console.log(`⚡ [TURNO ON-CHAIN HABILITADO] Han transcurrido ${collisionLock.elapsedMin} min desde la última corrida. Procediendo con la ronda completa.`);

  // 00. Cuerpo de Observadores Dedicados (Multi-DEX $0 Gas - On-Chain Sentinels)
  runCommand("node dedicated-observers.js", "Cuerpo de Observadores Dedicados (Multi-DEX $0 Gas)");

  // 01. Escudo Militar de Seguridad & Conmutador RPC < 250ms
  runCommand("node security-fortress-shield.js", "Escudo Militar de Seguridad & Latencia RPC (< 250ms)");

  // 02. Omni-Sniper 5 Modelos On-Chain (Lectura Dinámica $0 Gas)
  runCommand("node omni-sniper-5models.js", "Omni-Sniper 5 Modelos On-Chain (Lectura Dinámica $0 Gas)");

  // 03. Las 34 Nebulosas IA (Directrices Estratégicas y Asignaciones)
  runCommand("node nebula-ai-commanders.js", "Las 34 Nebulosas IA (Directrices Estratégicas)");

  // 04. Jefatura Suprema de Capitanes Expertos (#001 y #101) & Modo Punta de Lanza
  runCommand("node expert-captains-command.js", "Jefatura de Capitanes Expertos (#001 y #101)");

  // 05. Motor Dual-Capitalizador (Regla 70/30 Compounding & Crecimiento USDC)
  runCommand("node dual-capitalizer-engine.js", "Motor Dual-Capitalizador (70/30 Compounding)");

  // 05.5. Cazador en Vivo de Lanzamientos Próximos (#33 y #34)
  runCommand("node live-launch-calendar-hunter.js", "Cazador en Vivo de Lanzamientos Próximos (#33 & #34)");

  // 06. Monolito CyberShinobi Génesis X500 (Ejecución Vectorial Sub-Segundo)
  runCommand("node cybershinobi-swarm-strike.js", "CyberShinobi Genesis Swarm Strike X500");

  // 07. Solana Devnet Faucet Refuel
  runCommand("node solana-faucet-refuel.js", "Solana Devnet Faucet");

  // 08. Task Runner (Ronda Omnichain)
  runCommand("node task-runner.js", "Task Runner Omnichain");

  // 09. Bot Miner Swarm (Minería On-Chain, Firmas Gasless, Granja Bitcoin L2 & Vigía 501)
  runCommand("node bot-miner-swarm.js", "Bot Miner Swarm");

  // 10. Motor GameFi Bot Swarm (Juegos Web3, Metaverso & Reclamos)
  runCommand("node gamefi-bot-swarm.js", "GameFi Bot Swarm (Galaxia 2)");

  // 11. Motor Lomo 4: ROI Gas $50, Velocímetro $5.50/bot & Bounties Mainnet
  runCommand("node bounty-and-quota-engine.js", "Bounty & Quota Engine (Lomo 4)");

  // 12. Motor Lomo 5: Cerebro Autónomo, ADN Anti-Sybil & Auto-Liquidador DEX a USDC
  runCommand("node autonomous-brain-lomo5.js", "Cerebro Autónomo & Anti-Sybil (Lomo 5)");

  // 13. Motor de Saturación Multidepartamento X500 (6 Departamentos de Extracción)
  runCommand("node saturation-liquidity-engine.js", "Motor de Saturación de Liquidez X500");

  // 14. Sniper 501 Mainnet (Punta de Lanza USDC, Escudo Sagrado 25 POL & Radar)
  runCommand("node sniper-501-mainnet.js --scan", "Sniper 501 Mainnet (Punta de Lanza USDC & Escudo)");

  // 15. Bounty Booty Commander (Acelerador de Cobro Vía B $2,225 USDC)
  runCommand("node bounty-booty-commander.js", "Bounty Booty Commander (Vía B $2,225 USDC)");

  // 16. Escaneo de Cosechas (Embudo USDC a Binance)
  runCommand("node harvest-rewards.js --scan", "Escaneo de Recompensas");

  // 17. Auto-Recarga Bóveda Matriz #501 & Dispersión Intra-Box
  runCommand("node master-refuel.js --intra-box", "Auto-Recarga Bóveda Matriz #501 & Dispersión Intra-Box");

  // 18. Vanguard Hunter (Reporte Táctico y Notificación a Telegram)
  runCommand("node vanguard-hunter.js", "10K Vanguard Hunter");

  // 19. Snapshot On-Chain Consolidado
  runCommand("node scripts/onchain-snapshot.js", "Snapshot On-Chain Consolidado");

  // 20. Sincronización AI Telemetry Feed
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
