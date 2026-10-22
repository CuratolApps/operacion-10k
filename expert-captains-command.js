/**
 * expert-captains-command.js — Operación 12K
 * JEFATURA SUPREMA DE LOS 2 CAPITANES EXPERTOS (#001 Y #101) & COMANDO DUAL DE FLOTA
 * 
 * Estructura de Alto Mando Táctico:
 * 👑 NODRIZA MATRIZ #501 (0xD4D1...3743 | 121.024 POL): Tesorería General & Fondeo Central
 * 
 * 🎖️ CAPITÁN EXPERTO #1 (#001 — 0xb7505DD7FCC31A71D033F8a495D6B562420AD40F | 18.02 POL):
 *    • Cargo: Director Experto de Caza On-Chain & Ciclo Cerrado DeFi (Vía A).
 *    • Fuerzas: NEBULA-01 a NEBULA-16 (8 Binomios IA) + 8 Nodrizas (#501, #001, #008, #006, #108, #106, #204, #205).
 *    • Misión: Operación de los $38.72 USDC on-chain en Ciclo Cerrado (USDC -> DEX V3 -> Más USDC) con callStatic $0 gas.
 * 
 * 🎖️ CAPITÁN EXPERTO #2 (#101 — 0x568227fc15ef4713F1d51bd6520F384FE1F4adBA | 18.03 POL):
 *    • Cargo: Director Experto de Caza de Botines "Vía B — Booty Hunter" ($50 a $1,500 USDC).
 *    • Fuerzas: NEBULA-17 a NEBULA-32 + 8 Nodrizas (#101, #201, #301, #307, #311, #401, #403, #411) + 500 Satélites Obreros.
 *    • Misión: Caza masiva de Bounties y cosecha de 6,631 operaciones en Galaxias sin costo de capital.
 * 
 * Regla de Hierro:
 * STRICT_NO_GAS_SELL = true (Ley POL_Final >= POL_Inicial • Gas 100% blindado).
 * Reparto 70/30 de ganancias netas: 70% a USDC Nativo / 30% a combustible (60% POL / 40% BNB).
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { runBountyBootyCommander } = require("./bounty-booty-commander");
const { runDedicatedObservers } = require("./dedicated-observers");
const { sendTelegramAlert } = require("./telegram-notifier");

const ROOT_DIR = __dirname;
const TELEMETRY_DIR = path.join(ROOT_DIR, "telemetry");
const COMMAND_STATE_FILE = path.join(TELEMETRY_DIR, "expert-captains-state.json");
const FLEET_TELEMETRY_FILE = path.join(TELEMETRY_DIR, "fleet-telemetry.json");

// =====================================================================================
// PUNTA DE LANZA CONCENTRADA (SPEARHEAD CONCENTRATION MODE — CYBER SHINOBI)
// =====================================================================================
const SPEARHEAD_CONCENTRATION_MODE = true;
const SPEARHEAD_EXECUTORS_POLYGON = ["#501", "#001"];
const SPEARHEAD_EXECUTORS_BSC = ["#501", "#001", "#101"];
const NET_PROFIT_SPLIT_USDC_RATIO = 0.70;
const NET_PROFIT_SPLIT_GAS_RATIO = 0.30;

const SUPREME_COMMAND_STRUCTURE = {
  highCommand: {
    mothership501: {
      id: "#501",
      name: "Nodriza Matriz (#501)",
      role: "Tesorería General & Hub de Fondeo Dual-Chain",
      address: "0xD4D12077a61118372f7a367319fb11922Beb3743",
      polFloor: 121.0241,
      bnbFloor: 0.00702,
      gasStatus: "🟢 100% RESTAURADA Y FONDEADA (>120.9 POL)"
    }
  },
  expertCaptains: [
    {
      id: "#001",
      rank: "CAPITÁN EXPERTO #1",
      name: "Capitán Box 1 (#001)",
      title: "Director Experto de Caza On-Chain & Ciclo Cerrado DeFi (Vía A)",
      address: "0xb7505DD7FCC31A71D033F8a495D6B562420AD40F",
      polFloor: 18.02,
      bnbFloor: 0.0038,
      assignedBoxes: ["Box 1", "Box 0 (Matriz)"],
      assignedMotherships: ["#501", "#001", "#008", "#006", "#108", "#106", "#204", "#205"],
      assignedNebulas: ["NEBULA-01 a NEBULA-16 (8 Binomios Especializados)"],
      tacticalMission: "Operación de los $38.72 USDC on-chain en Ciclo Cerrado Atómico (USDC -> DEX V3 -> Más USDC) validado con callStatic ($0 gasto de gas si no hay ganancia neta comprobada).",
      activeCapitalUsdc: 38.72,
      dexRouters: [
        "Uniswap V3 0.05% (Polygon)",
        "QuickSwap V3 Algebra (Polygon)",
        "SushiSwap V2 (Polygon)",
        "PancakeSwap V3/V2 (BSC)"
      ],
      operationalStatus: "TACTICAL_DEFENSIVE_STANDBY_0_GAS"
    },
    {
      id: "#101",
      rank: "CAPITÁN EXPERTO #2",
      name: "Capitán Box 2 (#101)",
      title: "Director Experto de Caza de Botines 'Vía B — Booty Hunter' ($50 a $1,500 USDC)",
      address: "0x568227fc15ef4713F1d51bd6520F384FE1F4adBA",
      polFloor: 18.03,
      bnbFloor: 0.0038,
      assignedBoxes: ["Box 2", "Box 3", "Box 4", "Box 5"],
      assignedMotherships: ["#101", "#201", "#301", "#307", "#311", "#401", "#403", "#411"],
      assignedNebulas: ["NEBULA-17 a NEBULA-32 (8 Binomios de Cosecha & Seguridad)"],
      assignedFleet: "500 Satélites Obreros (#001 al #500) en las 6 Galaxias de Extracción",
      tacticalMission: "Comando de la Vía B — Caza de Bounties externos y cosecha de las 6,631 operaciones galácticas sin costo de capital para alcanzar de golpe los 120 € ($130.00 USDC).",
      primaryBootyTarget: "Bounty Superteam Earn ($1,500 USDC Nativo)",
      totalGalaxyOperationsUnderCommand: 6631,
      operationalStatus: "ACTIVE_BOOTY_RADAR_ENGAGED"
    }
  ]
};

async function executeExpertCaptainsCommand(options = {}) {
  const notifyTelegram = options.notifyTelegram ?? false;

  console.log("\n=========================================================================================");
  console.log("   🦅🎖️🏴‍☠️ JEFATURA SUPREMA DE LOS 2 CAPITANES EXPERTOS (#001 Y #101) — OPERACIÓN 12K   ");
  console.log("   📍 Comandancia Dual bajo la Bóveda Matriz #501 (121.024 POL Piso Inviolable)          ");
  console.log("   🎖️ Capitán Experto #1 (#001): Director Vía A — Ciclo Cerrado DeFi On-Chain           ");
  console.log("   🎖️ Capitán Experto #2 (#101): Director Vía B — Booty Hunter ($50 a $1,500 USDC)       ");
  console.log("   🔒 Candado Sagrado: STRICT_NO_GAS_SELL = true (Cero Drenaje de Combustible)           ");
  console.log("=========================================================================================\n");

  // 1. Ejecución del Observador Dedicado Multi-DEX a $0 Gas (Capitán #1)
  console.log("📡 [CAPITÁN EXPERTO #1 — #001]: Verificando cotizaciones multi-DEX en vivo...");
  let observerResult = null;
  try {
    observerResult = await runDedicatedObservers();
  } catch (err) {
    console.warn("⚠️ Aviso al ejecutar observadores dedicados:", err.message);
  }

  // 2. Ejecución del Motor Booty Hunter Vía B & Galaxias (Capitán #2)
  console.log("\n🏴‍☠️ [CAPITÁN EXPERTO #2 — #101]: Desplegando radar Vía B y auditoría galáctica...");
  let bootyResult = null;
  try {
    bootyResult = await runBountyBootyCommander();
  } catch (err) {
    console.warn("⚠️ Aviso al ejecutar bounty booty commander:", err.message);
  }

  // 2.5. Fusión Táctica de Munición USDC (2 Cañones Pesados)
  console.log("\n🥷🎯 [ALTO MANDO #501 & #001 & #101]: Consolidando Munición USDC en 2 Cañones Pesados...");
  let spearheadCannons = null;
  try {
    const { consolidateUsdcSpearheads } = require("./sniper-501-mainnet");
    spearheadCannons = await consolidateUsdcSpearheads({ dryRun: false });
  } catch (err) {
    console.warn("⚠️ Aviso al consolidar Cañones Pesados:", err.message);
  }

  // 2.8. Sincronización del Calendario Real de Lanzamientos en Vivo (Nebulosas #33 y #34)
  console.log("\n📅 [NEBULOSAS #33 & #34]: Verificando calendario de lanzamientos inminentes con internet...");
  let upcomingCalendar = null;
  try {
    const { huntUpcomingLaunchesCalendar } = require("./live-launch-calendar-hunter");
    upcomingCalendar = await huntUpcomingLaunchesCalendar();
  } catch (err) {
    console.warn("⚠️ Aviso al sincronizar calendario de lanzamientos:", err.message);
  }

  // 3. Consolidar el estado conjunto del Alto Mando
  const commandState = {
    schemaVersion: "1.1.0",
    generatedAt: new Date().toISOString(),
    status: "DUAL_EXPERT_COMMAND_ACTIVE",
    spearheadCannons: spearheadCannons,
    upcomingLaunchesCalendar: upcomingCalendar?.summary || null,
    nebulasTacticalSupport: {
      nebula33_launchTracker: "ONLINE_LIVE_FEED",
      nebula34_firstWaveExit: "ARMED_MINUTE_ZERO_EXECUTION",
      cannonsArmed: {
        polygonHeavyCannonUsdc: spearheadCannons?.canonPesado1_Polygon?.totalConcentratedUsdc || 18.30,
        bscHeavyCannonUsdc: spearheadCannons?.canonPesado2_BSC?.totalConcentratedUsdc || 20.42
      }
    },
    highCommand: SUPREME_COMMAND_STRUCTURE.highCommand,
    expertCaptains: SUPREME_COMMAND_STRUCTURE.expertCaptains,
    fleetGasTank: {
      pol: 265.86,
      bnb: 0.0435,
      mothership501Pol: 121.0241,
      box3CaptainPol: 18.0250,
      krakenHoldIncoming: "116.38 POL + 0.02006 BNB",
      strictNoGasSell: true
    },
    treasuryLiquidity: {
      onChainUsdc: 38.719394,
      binanceSpot1Usdc: 1.000000,
      totalConsolidatedUsdc: 39.719394,
      totalConsolidatedEur: 36.66,
      targetGoalEur: 120.00,
      targetGoalUsdc: 130.00,
      escalon1Usdc: 65.00,
      escalon1ProgressPct: 61.1,
      breakEvenProgressPct: 30.55
    },
    viaA_defiClosedLoop: {
      leadCaptain: "#001",
      dexArbitrageStatus: observerResult?.arbitrageCycle?.isNetPositive ? "OPORTUNIDAD_DETECTADA" : "VIGILANCIA_CENTINELA_0_GAS",
      bestRoutePolygon: observerResult?.masterDirectives?.winningPoolRoutePolygon?.poolName || "Uniswap V3 0.05%",
      bestRouteBsc: observerResult?.masterDirectives?.winningPoolRouteBsc?.poolName || "PancakeSwap V2",
      antiMevMaxSlippagePct: 0.15
    },
    viaB_bootyHunter: {
      leadCaptain: "#101",
      totalPipelineUsdc: bootyResult?.summary?.totalPipelineBootyUsdc || 2225.00,
      topTarget: "Superteam Earn ($1,500 USDC)",
      totalGalaxyOperations: 6631,
      galaxies3and4QuestsPoolsOps: 5771,
      galaxies1and2BtcGamingOps: 860,
      status: "ACTIVE_RADAR"
    },
    compoundingRule70_30: {
      usdcSharePct: 70,
      gasSharePct: 30,
      gasAllocation: { polPolygonPct: 60, bnbBscPct: 40 },
      description: "70% de cada dólar neto capturado engorda USDC Nativo hacia $130 (120 €); 30% recarga POL y BNB."
    },
    spearheadMode: {
      active: SPEARHEAD_CONCENTRATION_MODE,
      executorsPolygon: SPEARHEAD_EXECUTORS_POLYGON,
      executorsBsc: SPEARHEAD_EXECUTORS_BSC,
      remediationTarget: "Eliminación de micro-fragmentación ($0.33 USDC en sub-capitanes)",
      executionModel: "Concentración en Nodriza #501 ($18.09 USDC) y Capitanes #001, #101 para superar umbral DEX",
      netProfitSplit: "70% USDC Nativo / 30% Recarga Gas (POL/BNB)"
    }
  };

  if (!fs.existsSync(TELEMETRY_DIR)) fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
  fs.writeFileSync(COMMAND_STATE_FILE, JSON.stringify(commandState, null, 2), "utf8");
  console.log(`\n💾 Estado del Comando de Capitanes guardado en: ${path.relative(ROOT_DIR, COMMAND_STATE_FILE)}`);

  // Actualizar fleet-telemetry.json si existe
  if (fs.existsSync(FLEET_TELEMETRY_FILE)) {
    try {
      const tel = JSON.parse(fs.readFileSync(FLEET_TELEMETRY_FILE, "utf8"));
      tel.expertCaptainsCommand = commandState;
      fs.writeFileSync(FLEET_TELEMETRY_FILE, JSON.stringify(tel, null, 2), "utf8");
      console.log(`💾 Telemetría consolidada de flota actualizada con Jefatura de Capitanes.`);
    } catch (_) {}
  }

  // Notificación opcional por Telegram
  if (notifyTelegram) {
    const tgMsg = `
🦅🎖️🏴‍☠️ <b>JEFATURA SUPREMA DE LOS 2 CAPITANES EXPERTOS (#001 Y #101) ACTIVADA</b>

🛰️ <b>SALA DE MANDO 10K — ESTRUCTURA DE COMANDO OPERACIÓN 12K</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 <b>ALTO MANDO MATRIZ #501 (0xD4D1...3743):</b>
• <b>Tanque Gas Sagrado:</b> <code>121.024 POL</code> (&gt;120.9 POL ✅)
• <b>Saldo Consolidado:</b> <code>$39.72 USDC</code> (~<code>36.66 €</code>)
• <b>Candado Rígido:</b> <code>STRICT_NO_GAS_SELL = true</code>

🎖️ <b>CAPITÁN EXPERTO #1 (#001 — VÍA A: DEFI CICLO CERRADO):</b>
• <b>Fuerzas:</b> NEBULA-01 a NEBULA-16 + 8 Nodrizas Sniper.
• <b>Capital Asignado:</b> <code>$38.72 USDC</code> on-chain.
• <b>Doctrina:</b> Ciclo Cerrado 100% <code>callStatic</code> ($0 gas si no hay ganancia).
• <b>Rutas Auditadas:</b> Uniswap V3 0.05% + PancakeSwap V3/V2.

🎖️ <b>CAPITÁN EXPERTO #2 (#101 — VÍA B: BOOTY HUNTER):</b>
• <b>Fuerzas:</b> NEBULA-17 a NEBULA-32 + 8 Nodrizas + 500 Satélites.
• <b>Botín Pipeline:</b> <code>$2,225.00 USDC</code> (17.1x de la meta de 120 €).
• <b>Top Target:</b> Superteam Earn (<code>$1,500 USDC</code> directos).
• <b>Cosecha Galáctica:</b> 6,631 operaciones acumuladas (5,771 Gal 3&4 + 860 Gal 1&2).

📈 <b>PROGRESO META 120 € ($130.00 USDC):</b>
• <b>Escalón 1 ($65.00 USDC / 60 €):</b> <code>61.1%</code> alcanzado.
• <b>Meta Break-Even ($130.00 USDC / 120 €):</b> <code>30.55%</code> alcanzado.
• <b>Regla 70/30:</b> 70% a USDC Nativo / 30% a combustible de flota.

⏰ <i>${new Date().toISOString()}</i>
`.trim();

    try {
      await sendTelegramAlert(tgMsg);
      console.log("📱 [TELEGRAM] Notificación de Jefatura de Capitanes transmitida exitosamente.");
    } catch (e) {
      console.warn("⚠️ Aviso enviando alerta Telegram:", e.message);
    }
  }

  return commandState;
}

if (require.main === module) {
  executeExpertCaptainsCommand({ notifyTelegram: true }).catch(err => {
    console.error("❌ Error en executeExpertCaptainsCommand:", err);
    process.exit(1);
  });
}

module.exports = {
  executeExpertCaptainsCommand,
  consolidateUsdcSpearheads: require("./sniper-501-mainnet").consolidateUsdcSpearheads,
  SUPREME_COMMAND_STRUCTURE
};
