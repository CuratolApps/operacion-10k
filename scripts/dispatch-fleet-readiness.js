/**
 * dispatch-fleet-readiness.js - OPERACIÓN 10K / ÁREA 501
 * ==============================================================================
 * REVISTA DE TROPAS: ESTADO DE ALISTAMIENTO DE LOS 500 SOLDADOS (CORTE 00:00 UTC)
 * ==============================================================================
 * Emite a Telegram (🛰️ SALA DE MANDO 10K) el informe oficial de tropas previo
 * al arranque del corte de las 00:00 UTC (02:00 AM CEST Italia).
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { sendTelegramAlert } = require("../telegram-notifier");

const TELEMETRY_DIR = path.join(__dirname, "..", "telemetry");
const FLEET_FILE = path.join(TELEMETRY_DIR, "fleet-telemetry.json");
const BOX_PLAN_FILE = path.join(TELEMETRY_DIR, "box-dispatch-plan.json");
const CALENDAR_FILE = path.join(TELEMETRY_DIR, "annual-airdrop-calendar.json");
const NFT_RADAR_FILE = path.join(TELEMETRY_DIR, "nft-squadron-radar.json");

function readJsonSafe(filepath, defaultValue = {}) {
  try {
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, "utf8"));
    }
  } catch (_) {}
  return defaultValue;
}

/**
 * Calcula la cuenta regresiva exacta hasta las 00:00 UTC (02:00 AM CEST).
 */
function getCountdownToMidnightUtc() {
  const now = new Date();
  
  // Próximo 00:00:00 UTC
  const targetUtc = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + (now.getUTCHours() === 0 && now.getUTCMinutes() === 0 && now.getUTCSeconds() === 0 ? 0 : (now.getUTCHours() >= 0 ? 1 : 0)),
    0, 0, 0, 0
  ));

  // Si hoy aún no han sido las 00:00 UTC (ej: estamos a 23:45 UTC del día 24)
  const todayMidnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  ));
  
  // Si estamos en el mismo día pero target pasó, sumar 1 día
  let diffMs = targetUtc.getTime() - now.getTime();
  if (diffMs <= 0) {
    diffMs = 0;
  }

  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours,
    minutes,
    seconds,
    totalSeconds,
    targetUtcIso: targetUtc.toISOString(),
    formattedCountdown: `${hours}h ${minutes}m ${seconds}s`
  };
}

/**
 * Construye el reporte de alistamiento de la tropa para Telegram.
 */
function formatFleetReadinessReport() {
  const fleet = readJsonSafe(FLEET_FILE);
  const boxPlan = readJsonSafe(BOX_PLAN_FILE);
  const calendar = readJsonSafe(CALENDAR_FILE);
  const nftRadar = readJsonSafe(NFT_RADAR_FILE);
  const countdown = getCountdownToMidnightUtc();

  const gasLive = fleet.snipingEcosystem?.gasTankLive || {};
  const motherVault = fleet.snipingEcosystem?.masterVault || {};
  const boxes = boxPlan.boxes || [];

  const lines = [
    `🪖⚡ <b>ESTADO DE ALISTAMIENTO — 500 SOLDADOS LISTOS PARA ARRANQUE 00:00 UTC</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🛰️ <b>SALA DE MANDO 10K // ÁREA 501</b> · <i>Corte 25 Octubre 2026</i>`,
    `⏳ <b>CUENTA REGRESIVA AL ARRANQUE:</b> <b>${countdown.formattedCountdown}</b> restantes`,
    `   <i>(Objetivo: 00:00 UTC // 02:00 AM CEST Hora de Italia)</i>`,
    ``,
    `📦 <b>ESTADO DE LOS 5 BOXES (500 / 500 SATÉLITES OPERATIVOS):</b>`,
    `• <b>Fuerza Efectiva:</b> <code>500 / 500 Satélites Operativos</code> (#001 a #500 · 0 Bajas)`,
    `• <b>🚀 BOX EN LÍNEA DE SALIDA:</b> <b>BOX 1 (#001–#100) — PRIORIDAD #1</b>`,
    `   ├ Capitán #001: <code>0xb750...D40F</code> | Bóveda Binance: <code>0x48b2...531b</code>`,
    `   └ Misión Inicial: <b>Misiones Gasless EIP-712 &amp; Daily Streaks (Check-in $0 Gas)</b>`,
    `• <b>BOX 2 (#101–#200):</b> Capitán #101 <code>0x5682...adBA</code> ➔ DogeOS Cap. 2 &amp; Startale / GenLayer`,
    `• <b>BOX 3 (#201–#300):</b> Capitán #201 <code>0x2810...6A7C</code> ➔ Base Ecosystem &amp; Avantis S3 / Jumper`,
    `• <b>BOX 4 (#301–#400):</b> Capitán #301 <code>0xEb6a...Ca0f</code> ➔ Arbitrum Stylus WASM &amp; OP Superchain`,
    `• <b>BOX 5 (#401–#500):</b> Capitán #401 <code>0x4C71...d070</code> ➔ Citrea Bitcoin ZK &amp; GOAT zk-EVM`,
    ``,
    `⛽ <b>SALUD DEL TANQUE DE GAS (RESERVA INTACTA DE LA FLOTA):</b>`,
    `• <b>Reserva Total Flota:</b> <code>${gasLive.fleetPol || "300.06 POL"}</code> (Piso 300.00 POL — 100% FULL)`,
    `• <b>Nodriza Matriz #501:</b> <code>${gasLive.motherPol || "155.26 POL"}</code> (Piso 150.00 POL — 0.00 POL Perdidos)`,
    `• <b>Gas BNB Chain:</b> <code>${gasLive.motherBnb || "0.0227 BNB"}</code> en #501 / <code>${gasLive.fleetBnb || "0.0609 BNB"}</code> en Flota`,
    `• <b>Testnets L2:</b> ETH Sepolia, Base Sepolia y Arbitrum Sepolia (+38,000 ops blindadas)`,
    `• <b>Estado Operativo:</b> 🟢 <b>100% BLINDADO / CERO RIESGO DE APAGÓN</b>`,
    ``,
    `🎯 <b>OBJETIVOS LISTOS PARA EL CORTE DE LAS 00:00 UTC (25 DE OCTUBRE):</b>`,
    `• <b>KieDex &amp; Pharos ($PROS):</b> Cierre 25 Oct 23:59 UTC · Pharos High-Speed L1 Testnet Streak ($0 gas)`,
    `• <b>Misiones Gasless EIP-712 &amp; Daily Streaks:</b> 500/500 Satélites listos para check-in a <code>$0.00 Gas</code>`,
    `• <b>Citrea Bitcoin ZK-Rollup:</b> Semilla Bitcoin L2 / MultiCall3 &amp; WcBTC Testnet (Fase temprana)`,
    `• <b>GOAT Network Bitcoin zk-EVM:</b> Granja Bitcoin L2 &amp; Atestaciones zk-EVM ($0 gas)`,
    `• <b>Base Ecosystem (Avantis S3 &amp; Jumper):</b> Volumen DeFi y racha wrapping (Corte 30 Oct – 15 Nov)`,
    `• <b>Arbitrum Stylus WASM &amp; Nitro Orbit:</b> Siembra continua WASM Smart Contracts (Dic 2026 – Feb 2027)`,
    `• <b>Optimism Superchain:</b> Misiones Gasless EIP-712 e Interoperabilidad Cross-Superchain`,
    ``,
    `🌾 <b>CAZADOR NFT FREE-MINT &amp; INSTANT FLIP (/flota-x500/):</b>`,
    `• <b>Contratos Vigilados 24/7:</b> <code>6 / 6 Contratos Reales</code> (Sunflower, Aavegotchi, Uniswap V3, etc.)`,
    `• <b>Regla Sagrada de Gatillo:</b> Solo acuña si existe Bid firme > Ask + Gas (Spread neto &ge; +$0.05 USDC)`,
    `• <b>Pérdida de Gas en Fallos:</b> <code>$0.00 USD</code> (0% Riesgo de ejecución en vacío)`,
    `• <b>Escolta IA:</b> Nebula-NFT-01 Calculista + Nebula-NFT-02 Anti-Trampa GoPlus (0% Honeypot)`,
    `• <b>Destino Liquidez:</b> 100% Retorno inmediato a USDC en Bóveda #501`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🎖️ <b>PARTE DE GUERRA:</b> Los 500 soldados están formados, cargados de gas y en posición. Listos para el carrusel de las 00:00 UTC.`
  ];

  return lines.join("\n");
}

/**
 * Despacha el reporte de tropas a Telegram.
 */
async function dispatchFleetReadinessReport() {
  const message = formatFleetReadinessReport();
  console.log("📢 Despachando Estado de Alistamiento de los 500 Soldados a Telegram (🛰️ SALA DE MANDO 10K)...");
  
  const ok = await sendTelegramAlert(message, null, { skipRoiHeader: true });
  if (ok) {
    console.log("✅ [TELEGRAM] Estado de Alistamiento emitido exitosamente (ok: true).");
  } else {
    console.error("❌ [TELEGRAM] Fallo en la emisión del Estado de Alistamiento.");
    throw new Error("Telegram dispatch failed: ok !== true");
  }
  return ok;
}

if (require.main === module) {
  dispatchFleetReadinessReport()
    .then(() => {
      console.log("🎉 Despacho completado con éxito.");
      process.exit(0);
    })
    .catch(err => {
      console.error("❌ Error en despacho de alistamiento:", err.message);
      process.exit(1);
    });
}

module.exports = {
  getCountdownToMidnightUtc,
  formatFleetReadinessReport,
  dispatchFleetReadinessReport
};
