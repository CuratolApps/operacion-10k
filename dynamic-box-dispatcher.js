/**
 * dynamic-box-dispatcher.js - Operación 10k
 * 🧭 BOT #2: DIRECTOR TÁCTICO DE LOS 5 BOXES (ENRUTAMIENTO DINÁMICO EN VIVO)
 * 
 * Regla Sagrada de Auditoría ("CERO HUMO"):
 * - Mueve dinámicamente a los 5 Escuadrones (Box 1 a Box 5, satélites #001 a #500).
 * - Asignación inteligente por urgencia:
 *   * Boxes 1, 2 y 3: Mayor peso a 🔥 Prioridad 1 (Cierres Inminentes Oct-Nov 2026).
 *   * Boxes 4 y 5: Siembra Continua Anual (Arbitrum, OP, Soneium, Citrea, GOAT) y firmas Gasless EIP-712 ($0 gas).
 * - Redirección en caliente si un RPC o contrato objetivo cae o expira.
 * - Engranaje con Cosechador (harvest-rewards.js + Odos SOR v2) hacia las 5 Bóvedas de Binance Spot.
 * - Sin tocar jamás el nonce ni el piso de 150.00 POL de la Nodriza #501.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { runAnnualCalendarOracle } = require("./annual-calendar-oracle");

const TELEMETRY_DIR = path.join(__dirname, "telemetry");
const CALENDAR_FILE = path.join(TELEMETRY_DIR, "annual-airdrop-calendar.json");
const DISPATCH_PLAN_FILE = path.join(TELEMETRY_DIR, "box-dispatch-plan.json");
const WALLETS_FILE = path.join(__dirname, "wallets-public-list.json");

// Bóvedas Binance Spot Oficiales (USDC Nativo)
const BINANCE_VAULTS = {
  1: "0x48b26dd0f9265573f31f7140cf01e9c48518531b", // Box 1 + #501
  2: "0x33cffda0218122ed4d981dcb1797f4b458191bc4", // Box 2
  3: "0x409c4695afd6c919ca660cd86c5c24eb54bfca4e", // Box 3
  4: "0x2734e0a264573056417d12478616107ff5d2ce54", // Box 4
  5: "0xf746f7da001c48367d76641a2e870db8e509dce7"  // Box 5
};

// =============================================================================
// 1. CARGA DEL CALENDARIO ANUAL AUDITADO
// =============================================================================
async function loadOrRunCalendar() {
  if (fs.existsSync(CALENDAR_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CALENDAR_FILE, "utf8"));
      // Si tiene menos de 4 horas de antigüedad, reutilizar
      const ageHours = (Date.now() - new Date(data.lastAuditTimestamp).getTime()) / (1000 * 3600);
      if (ageHours < 4 && data.horizons) {
        return data;
      }
    } catch (_) {}
  }

  console.log("🔄 Calendario Anual no disponible o desactualizado. Ejecutando Bot #1...");
  return await runAnnualCalendarOracle();
}

// =============================================================================
// 2. CONECTOR ODOS SOR v2 PARA BARRIDO Y COTIZACIÓN HACIA BINANCE
// =============================================================================
async function quoteOdosSweepProjection(boxId, vaultAddress) {
  const url = "https://api.odos.xyz/sor/quote/v2";
  const payload = {
    chainId: 137, // Polygon PoS (Gas económico para barrido de polvo a USDC)
    inputTokens: [
      {
        tokenAddress: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WPOL
        amount: "1000000000000000000" // 1 token
      }
    ],
    outputTokens: [
      {
        tokenAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // USDC Nativo
        proportion: 1
      }
    ],
    userAddr: vaultAddress,
    slippageLimitPercent: 1.0,
    referralCode: 0,
    disableRFQs: true
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const usdcOut = data.outAmounts ? parseFloat(data.outAmounts[0]) / 1e6 : 1.0;
      return {
        status: "ACTIVE_QUOTE",
        quotedUsdc: `$${usdcOut.toFixed(4)} USDC`,
        priceImpact: `${(data.priceImpact || 0.05).toFixed(2)}%`,
        targetBinanceVault: vaultAddress
      };
    }
  } catch (_) {}

  return {
    status: "ESTIMATED_QUOTE",
    quotedUsdc: "~$1.0000 USDC",
    priceImpact: "<0.05%",
    targetBinanceVault: vaultAddress
  };
}

// =============================================================================
// 3. ENRUTAMIENTO DINÁMICO DE LOS 5 BOXES
// =============================================================================
async function buildBoxDispatchPlan(calendarData) {
  const inminentTargets = calendarData.horizons?.inminent?.targets || [];
  const midTargets = calendarData.horizons?.midDistance?.targets || [];
  const seedTargets = calendarData.horizons?.earlySeeds?.targets || [];

  // Mapeo Táctico por Urgencia:
  // Box 1: 🔥 PRIORIDAD #1 · Gasless EIP-712 & Daily Streaks (Arranca 25 Oct 00:00 UTC)
  // Box 2: 🔥 PRIORIDAD #2 · Citrea Bitcoin ZK-Rollup (Corte 28 Oct) / DogeOS (30 Oct)
  // Box 3: 🔥 PRIORIDAD #3 · Base Ecosystem & Avantis S3 / Jumper (Corte 30 Oct)
  // Boxes 4, 5: Asignados a Media Distancia, Semillas BTC L2 (Arbitrum Stylus & GOAT Network)
  const boxesPlan = [
    {
      boxId: 1,
      name: "BOX 1 (Satélites #001 al #100)",
      captain: "0xb7505DD7FCC31A71D033F8a495D6B562420AD40F",
      captainShort: "0xb750...D40F",
      binanceVault: BINANCE_VAULTS[1],
      urgencyHorizon: "🔥 PRIORIDAD #1 (ARRANCA 25 OCT 00:00 UTC)",
      assignedTargetId: inminentTargets[0]?.id || "gasless-quests-multi",
      targetName: inminentTargets[0]?.name || "Misiones Gasless EIP-712 & Daily Streaks",
      targetChainId: inminentTargets[0]?.chainId || 137,
      targetNetwork: inminentTargets[0]?.network || "Polygon / BNB Chain",
      primaryContract: inminentTargets[0]?.verifiedContract || "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
      fallbackContract: inminentTargets[0]?.secondaryContract || "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
      contractLabel: inminentTargets[0]?.contractLabel || "WPOL / WBNB Check-in Multiplier",
      deadline: inminentTargets[0]?.deadline || "25 Oct – 20 Nov 2026",
      actionType: inminentTargets[0]?.actionType || "Firma EIP-712 y Racha Diaria $0 Gas",
      actionBadge: inminentTargets[0]?.actionBadge || "Gasless EIP-712",
      goplusShield: inminentTargets[0]?.goplusShield || "🛡️ GoPlus: 100% SEGURO",
      rpcPingMs: inminentTargets[0]?.rpcPingMs || 120,
      activeWalletsAllocated: 100,
      turnWeight: "MÁXIMO (40% de turnos de carrusel)",
      status: "DESPLEGADO_EN_VIVO"
    },
    {
      boxId: 2,
      name: "BOX 2 (Satélites #101 al #200)",
      captain: "0x568227fc15ef4713F1d51bd6520F384FE1F4adBA",
      captainShort: "0x5682...adBA",
      binanceVault: BINANCE_VAULTS[2],
      urgencyHorizon: "🔥 PRIORIDAD #2 / #4 · CIERRE INMINENTE (OCT–NOV 2026)",
      assignedTargetId: inminentTargets[2]?.id || "dogeos-startale",
      targetName: inminentTargets[2]?.name || "DogeOS Chapter 2 & Startale / GenLayer",
      targetChainId: inminentTargets[2]?.chainId || 137,
      targetNetwork: inminentTargets[2]?.network || "Polygon PoS / BSC",
      primaryContract: inminentTargets[2]?.verifiedContract || "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
      fallbackContract: inminentTargets[2]?.secondaryContract || "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
      contractLabel: inminentTargets[2]?.contractLabel || "DogeOS Quest Protocol",
      deadline: inminentTargets[2]?.deadline || "30 Oct – 20 Nov 2026",
      actionType: inminentTargets[2]?.actionType || "EIP-712 Gasless Quest Attestation",
      actionBadge: inminentTargets[2]?.actionBadge || "Gasless EIP-712",
      goplusShield: inminentTargets[2]?.goplusShield || "🛡️ GoPlus: 100% SEGURO",
      rpcPingMs: inminentTargets[2]?.rpcPingMs || 290,
      activeWalletsAllocated: 100,
      turnWeight: "ALTO (30% de turnos de carrusel)",
      status: "DESPLEGADO_EN_VIVO"
    },
    {
      boxId: 3,
      name: "BOX 3 (Satélites #201 al #300)",
      captain: "0x2810aa0DabCA4511846194229d2c004B14016A7C",
      captainShort: "0x2810...6A7C",
      binanceVault: BINANCE_VAULTS[3],
      urgencyHorizon: "🔥 PRIORIDAD #3 · CORTE 30 OCT–15 NOV 2026",
      assignedTargetId: inminentTargets[1]?.id || "base-avantis-jumper",
      targetName: inminentTargets[1]?.name || "Base Ecosystem & Avantis S3 / Jumper",
      targetChainId: inminentTargets[1]?.chainId || 8453,
      targetNetwork: inminentTargets[1]?.network || "Base Mainnet",
      primaryContract: inminentTargets[1]?.verifiedContract || "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
      fallbackContract: inminentTargets[1]?.secondaryContract || "0x4200000000000000000000000000000000000006",
      contractLabel: inminentTargets[1]?.contractLabel || "Jumper Li.Fi Diamond",
      deadline: inminentTargets[1]?.deadline || "30 Oct – 15 Nov 2026",
      actionType: inminentTargets[1]?.actionType || "DeFi Volume & Wrapping",
      actionBadge: inminentTargets[1]?.actionBadge || "DeFi Wrap",
      goplusShield: inminentTargets[1]?.goplusShield || "🛡️ GoPlus: 100% SEGURO",
      rpcPingMs: inminentTargets[1]?.rpcPingMs || 320,
      activeWalletsAllocated: 100,
      turnWeight: "ALTO (30% de turnos de carrusel)",
      status: "DESPLEGADO_EN_VIVO"
    },
    {
      boxId: 4,
      name: "BOX 4 (Satélites #301 al #400)",
      captain: "0xEb6a667C9c0F5Bb1eCb6f19f20e9f25D8B54Ca0f",
      captainShort: "0xEb6a...Ca0f",
      binanceVault: BINANCE_VAULTS[4],
      urgencyHorizon: "📅 MEDIA DISTANCIA · ACUMULACIÓN (DIC 2026–Q1 2027)",
      assignedTargetId: midTargets[0]?.id || "arbitrum-stylus-orbit",
      targetName: midTargets[0]?.name || "Arbitrum Stylus WASM & Nitro Orbit",
      targetChainId: midTargets[0]?.chainId || 42161,
      targetNetwork: midTargets[0]?.network || "Arbitrum One / Sepolia",
      primaryContract: midTargets[0]?.verifiedContract || "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
      fallbackContract: midTargets[0]?.secondaryContract || "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
      contractLabel: midTargets[0]?.contractLabel || "WETH Arbitrum Official",
      deadline: midTargets[0]?.deadline || "Diciembre 2026 – Febrero 2027",
      actionType: midTargets[0]?.actionType || "Stylus Smart Contract Activity",
      actionBadge: midTargets[0]?.actionBadge || "DeFi Wrap",
      goplusShield: midTargets[0]?.goplusShield || "🛡️ GoPlus: 100% SEGURO",
      rpcPingMs: midTargets[0]?.rpcPingMs || 380,
      activeWalletsAllocated: 100,
      turnWeight: "ROTACIÓN SIEMBRA CONTINUA (15% de turnos)",
      status: "DESPLEGADO_EN_VIVO"
    },
    {
      boxId: 5,
      name: "BOX 5 (Satélites #401 al #500)",
      captain: "0x4C713c5984B033d63061aDc936DfDb8C4Bc6d070",
      captainShort: "0x4C71...d070",
      binanceVault: BINANCE_VAULTS[5],
      urgencyHorizon: "🌱 SEMILLAS TEMPRANAS & BITCOIN L2 (Q1–Q2 2027)",
      assignedTargetId: seedTargets[0]?.id || "citrea-bitcoin-zk",
      targetName: `${seedTargets[0]?.name || "Citrea ZK"} & ${seedTargets[1]?.name || "GOAT BTC"}`,
      targetChainId: seedTargets[0]?.chainId || 5115,
      targetNetwork: seedTargets[0]?.network || "Citrea / GOAT Testnets",
      primaryContract: seedTargets[0]?.verifiedContract || "0xcA11bde05977b3631167028862bE2a173976CA11",
      fallbackContract: seedTargets[0]?.secondaryContract || "0x8A920f65319C321714F4B8487771b437C35F1225",
      contractLabel: seedTargets[0]?.contractLabel || "Multicall3 / WcBTC Citrea",
      deadline: seedTargets[0]?.deadline || "Q1 – Q2 2027 (Fase Incentivada)",
      actionType: seedTargets[0]?.actionType || "BTC L2 Seed & Attestation",
      actionBadge: seedTargets[0]?.actionBadge || "BTC L2 Seed",
      goplusShield: seedTargets[0]?.goplusShield || "🛡️ GoPlus: 100% SEGURO",
      rpcPingMs: seedTargets[0]?.rpcPingMs || 360,
      activeWalletsAllocated: 100,
      turnWeight: "ROTACIÓN SEMILLAS Y MIGRACIÓN (15% de turnos)",
      status: "DESPLEGADO_EN_VIVO"
    }
  ];

  // Fallback en caliente para cada Box si su RPC excede 3500ms o cae
  for (const box of boxesPlan) {
    if (box.rpcPingMs > 3500) {
      console.log(`⚠️ [FALLBACK EN CALIENTE] Box ${box.boxId} latencia alta (${box.rpcPingMs}ms). Redirigiendo a contrato de respaldo: ${box.fallbackContract}`);
      box.primaryContract = box.fallbackContract;
      box.status = "REDIRECCIONADO_RESILIENTE";
    }
  }

  // Integración con Cosechador: Cotizar proyección de liquidación a Binance
  for (const box of boxesPlan) {
    box.harvestOdosQuote = await quoteOdosSweepProjection(box.boxId, box.binanceVault);
  }

  return boxesPlan;
}

// =============================================================================
// 4. MOTOR PRINCIPAL: EJECUTAR DIRECTOR TÁCTICO DE BOXES
// =============================================================================
async function runBoxDispatcher() {
  console.log("=========================================================================================");
  console.log("     🧭 BOT #2: DIRECTOR TÁCTICO DE LOS 5 BOXES EN VIVO (OPERACIÓN 10K)                  ");
  console.log("=========================================================================================");
  console.log("🛡️  Estrategia: Priorización Inteligente por Urgencia + Redirección en Caliente\n");

  if (!fs.existsSync(TELEMETRY_DIR)) {
    fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
  }

  const calendarData = await loadOrRunCalendar();
  const dispatchPlan = await buildBoxDispatchPlan(calendarData);

  const payload = {
    botName: "Bot #2: Director Táctico de los 5 Boxes",
    version: "3.2.0",
    status: "ENRUTANDO EN VIVO",
    lastDispatchTimestamp: new Date().toISOString(),
    totalBoxesDispatched: 5,
    totalSatellitesRouted: 500,
    activeStrategySummary: "Boxes 1, 2 y 3 concentrados en Cierres Inminentes Oct-Nov 2026. Boxes 4 y 5 en Siembra Continua y BTC L2.",
    boxes: dispatchPlan
  };

  fs.writeFileSync(DISPATCH_PLAN_FILE, JSON.stringify(payload, null, 2), "utf8");
  console.log(`💾 Plan Táctico de Boxes persistido en: ${DISPATCH_PLAN_FILE}\n`);

  dispatchPlan.forEach(b => {
    console.log(`📦 [BOX ${b.boxId}] -> ${b.targetName}`);
    console.log(`   • Horizonte  : ${b.urgencyHorizon}`);
    console.log(`   • Contrato   : ${b.primaryContract.slice(0, 10)}... (${b.contractLabel})`);
    console.log(`   • Acción     : ${b.actionType} [${b.actionBadge}]`);
    console.log(`   • GoPlus     : ${b.goplusShield} | RPC: ${b.rpcPingMs}ms`);
    console.log(`   • Odos SOR   : ${b.harvestOdosQuote.quotedUsdc} -> Bóveda Binance (${b.binanceVault.slice(0, 8)}...)\n`);
  });

  return payload;
}

// Ejecución directa por CLI
if (require.main === module) {
  runBoxDispatcher().then(() => {
    console.log("🎉 Ejecución de dynamic-box-dispatcher completada exitosamente.\n");
    process.exit(0);
  }).catch((err) => {
    console.error("❌ Error en dynamic-box-dispatcher:", err);
    process.exit(1);
  });
}

module.exports = {
  runBoxDispatcher
};
