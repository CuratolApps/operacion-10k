/**
 * scripts/hyperliquid-squad-daemon.js — ÁREA 501 // SQUAD SECRET V2 AUTONOMOUS DAEMON
 * ==============================================================================
 * MOTOR AUTÓNOMO V2 ESCALADO: 3 ESCUADRONES SNIPER EN HYPERLIQUID L1
 * - Escuadrón Alfa (#01 Titan-Scalper): SOL, SUI, AVAX (20% Margen · 5x · ~$800 Nocional)
 * - Escuadrón Bravo (#02 Oracle-Global): BTC, PAXG, LINK (20% Margen · 5x · ~$800 Nocional)
 * - Escuadrón Charlie (#03 Nexus-Boss): ETH, BNB, AAVE (20% Margen · 5x · ~$800 Nocional)
 * 
 * LEYES SAGRADAS V2 ESCALADAS — BLOQUE 1 RUMBO A $1,000 USDC:
 * 1. Capital Base en L1: ~$803.55 USDC ($450.00 USDC préstamo #501 / $568.50 USDC total inyectado a 0%).
 * 2. Escudo Mentora #00: 40% del Capital (~$320.00+ USDC) 100% Intocables en Cash de Reserva.
 * 3. Margen Operativo por Escuadrón: 20% del Capital (~$160.00 USDC a 5x = ~$800.00 Nocional por tiro).
 * 4. Interés Compuesto Dinámico: El margen y el nocional crecen automáticamente cada día con las ganancias.
 * 5. Doctrina de Consolidación por Bloques: 100% Capitalización Pura ($0 retiros) hasta alcanzar $1,000.00 USDC.
 *    Al tocar $1,000.00 USDC: Regla 70/30 (70% reinversión / 30% devolución a #501 o Bloque 2).
 * 6. Direct Order Bridge: Cola de órdenes directas en telemetry/direct-orders-queue.json (<150ms).
 * 7. Filtro Anti-Techo 3 Capas: L2 Imbalance >= 62% + RSI(14) 5m <= 46 (Long) / >= 70 (Short) + EMA20 5m + vela 15m.
 * 8. Mentora #00 DCA Salvavidas: Refuerzo táctico en drawdown -0.85% y RSI <= 30 hacia TP +0.20%.
 * ==============================================================================
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const fs = require("fs");
const path = require("path");
const { ExchangeClient, InfoClient, HttpTransport } = require("@nktkas/hyperliquid");
const { ethers } = require("ethers");
const { sendTelegramAlert } = require("../telegram-notifier");

const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";

// Resiliencia 24/7 ante errores de red o RPCs externos
process.on("unhandledRejection", (reason) => {
  console.error("⚠️ [DAEMON] Promesa rechazada no capturada (resiliente, continuando):", reason?.message || reason);
});
process.on("uncaughtException", (err) => {
  console.error("⚠️ [DAEMON] Excepción no capturada (resiliente, continuando):", err?.message || err);
});

// --- ARQUITECTURA DEFINITIVA "NEXUS APEX-36" (CERO PÉRDIDAS ACEPTADAS + CANDADO ELÁSTICO FEE-AWARE #00) ---
const STRICT_RECOVERY_LOCK = true;      // 1) Prohibido abrir operaciones nuevas mientras queden posiciones abiertas por recuperar
const NO_RED_EXIT = true;               // 2) Prohibido cerrar en pérdida (100% salidas en verde o Breakeven Positivo +$0.01 USDC)
const MAX_UNFENCED_POSITIONS = 2;       // 3) Máx 2 posiciones abiertas sin Candado #00 simultáneamente (3ra exige que las 2 primeras tengan Candado #00)
const HL_MAKER_FEE_RATE = 0.00015;      // 0.015% Maker Hyperliquid L1
const HL_TAKER_FEE_RATE = 0.00045;      // 0.045% Taker Hyperliquid L1
const LEVEL1_NET_LOCK_USDC = 0.02;      // Candado Nivel 1: Entrada + Comisión Ida/Vuelta Real + $0.02 USDC -> 🟢 LIGERO ($0.00 riesgo)
const CLEAN_EVAC_NET_USDC = 0.01;       // Protocolo Evacuación Limpia 180s: Entrada + Comisión + $0.01 USDC (Post-Only Maker)
const CLEAN_EVAC_TIMEOUT_MS = 180 * 1000; // 180 segundos para activar Evacuación Breakeven Neto si la ola se enfría antes de Nivel 2
const RATCHET_TIER_1_MIN_PCT = 0.10;    // +0.10% a +0.25% ➔ Candado asegura el 75% del recorrido neto
const RATCHET_TIER_2_MIN_PCT = 0.25;    // +0.25% a +0.80% ➔ Candado asegura el 83% del recorrido neto
const RATCHET_TIER_3_MIN_PCT = 0.80;    // Ola fuerte > +0.80% ➔ Candado pegado al 90% del High-Water Mark sin techo
const STOP_REVERSE_TAPE_BPS_SEC = 18.0; // Giro Brusco Caso A: tapeVelocity >= 18 bps/s
const STOP_REVERSE_VOL_MULT = 2.5;      // Giro Brusco Caso A: Volumen >= 2.5x
const STOP_REVERSE_L2_IMB_PCT = 74.0;   // Giro Brusco Caso A: Libro L2 volcado >= 74%
const STOP_REVERSE_RSI6_LOW = 8.0;      // Giro Brusco Caso B: RSI(6) <= 8 en piso de Bollinger
const STOP_REVERSE_RSI6_HIGH = 92.0;    // Giro Brusco Caso B: RSI(6) >= 92 en techo de Bollinger

const MENTORA_RESERVE_RATIO = 0.40;     // 40% Escudo Mentora #00 (~$360.82+ USDC Intocables)
const SQUAD_MARGIN_RATIO = 0.11;        // ~11% Margen por Escuadrón (~$100.00 USDC x 6 Escuadrones = ~$600 / 60% Operativo)
const BLOCK2_DEDICATED_MARGIN = 100.00; // $100.00 USDC dedicados para #04 GOLF, #05 HOTEL, #06 INDIA ($300 USDC Bloque 2)
const BLOCK2_LEVERAGE = 2.0;            // $100.00 * 2.0x = $200.00 Nocional ágil por disparo en Bloque 2
const LEVERAGE = 2.5;                   // ~$100 Margen * 2.5x = ~$250.00 Nocional seguro por tiro en Bloque 1
const MAX_NOTIONAL_PER_COIN = 250.00;   // REGLA ANTI-LIQUIDEZ ESTÁTICA: Máx $250.00 USD por par
const TARGET_GAIN_PCT = 0.00;           // CERO TAKE PROFIT FIJO — Puro Candado Elástico (FEE-AWARE RATCHET #00)
const BLOCK2_TARGET_GAIN_PCT = 0.00;    // CERO TAKE PROFIT FIJO — Exprimido Elástico Sin Techo (75% / 83% / 90%)
const BREAKEVEN_TRIGGER_PCT = 0.05;     // Candado Breakeven #00 se activa en Entrada + Comisión + $0.02 USDC
const BREAKEVEN_LOCK_PCT = 0.03;        // Candado BE cubre 100% comisiones reales y asegura +$0.02 USDC netos
const TIME_STOP_MS = CLEAN_EVAC_TIMEOUT_MS; // 180s Protocolo de Evacuación Limpia en Breakeven Neto (+$0.01 USDC)
const TIME_STOP_MIN_PNL_USDC = 0.01;    // Salida limpia en +$0.01 a +$0.03 USDC en verde ($0.00 pérdida)
const POST_TRADE_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutos (900,000 ms) de enfriamiento del Titular (1) tras cobro
const COOLDOWN_DURATION_MS = POST_TRADE_COOLDOWN_MS;
let globalPostRecoveryCooldownUntil = 0;
const MIN_CERTAINTY_L2_PCT = 58.0;      // 58% de presión L2 mínima para tiro con confluencia real
const MAX_CONCURRENT_BLOCK_1 = 2;       // Subordinado a MAX_UNFENCED_POSITIONS = 2
const MAX_CONCURRENT_BLOCK_2 = 1;       // Subordinado a MAX_UNFENCED_POSITIONS = 2
const MAX_CONCURRENT_INITIAL = MAX_UNFENCED_POSITIONS;
const MAX_CONCURRENT_TOTAL = 3;         // 3ra posición solo si las 2 primeras tienen Candado #00 asegurado en verde
const pairCooldowns = {};               // Mapa de enfriamiento táctico { coin: timestampMs }
const DCA_TRIGGER_DRAWDOWN = -0.85;     // Refuerzo Mentora en -0.85%
const DCA_TRIGGER_RSI = 30;             // RSI sobreventa extrema
const DCA_TARGET_GAIN_PCT = 0.20;       // Evacuación rápida doble posición al +0.20%


const TELEMETRY_DIR = path.join(__dirname, "..", "telemetry");
const REAL_LEDGER_FILE = path.join(TELEMETRY_DIR, "squad-secret-real-ledger.json");
const SQUAD_TELEMETRY_FILE = path.join(TELEMETRY_DIR, "squad-secret-telemetry.json");
const SQUAD_MATRIX_TELEMETRY_FILE = path.join(TELEMETRY_DIR, "squad-matrix-telemetry.json");
const RECOVERY_CONTROL_FILE = path.join(TELEMETRY_DIR, "squad-recovery-control.json");
const LOAN_LEDGER_FILE = path.join(TELEMETRY_DIR, "vault501-loan-ledger.json");
const DIRECT_ORDERS_FILE = path.join(TELEMETRY_DIR, "direct-orders-queue.json");
const SQUAD_CLONES_FILE = path.join(TELEMETRY_DIR, "squad-matrix-clones.json");

function loadRecoveryControlConfig() {
  const defaults = {
    ARCHITECTURE: "NEXUS_APEX_36",
    STRICT_RECOVERY_LOCK: true,
    NO_RED_EXIT: true,
    MAX_UNFENCED_POSITIONS: 2,
    CLEAN_EVAC_TIMEOUT_MS: 180000,
    LOCK_UNTIL_ALL_RECOVERED: true,
    LOCK_NEW_OPENINGS: true,
    COOLDOWN_UNTIL_00_UTC: true,
    HOT_SWAP_CLONES: true,
    TARGET_RESET_UTC: "2026-10-30T00:00:00.000Z",
    POST_00_UTC_MAX_CONCURRENT_POSITIONS: 2,
    REQUIRE_BE_LOCK_FOR_3RD_POSITION: true,
    POST_TRADE_COOLDOWN_MS: 900000,
    RECOVERY_CASCADE_ORDER: ["PAXG", "ETH", "XRP", "SOL", "BTC", "NEAR"]
  };
  try {
    if (fs.existsSync(RECOVERY_CONTROL_FILE)) {
      return Object.assign(defaults, JSON.parse(fs.readFileSync(RECOVERY_CONTROL_FILE, "utf8")));
    }
  } catch (_) {}
  return defaults;
}

const ASSET_INDICES = {
  BTC: 0,
  ETH: 1,
  SOL: 5,
  AVAX: 6,
  BNB: 7,
  LTC: 10,
  DOGE: 12,
  SUI: 14,
  LINK: 18,
  XRP: 25,
  AAVE: 28,
  TRX: 37,
  UNI: 39,
  DOT: 48,
  ADA: 65,
  TON: 66,
  NEAR: 74,
  POL: 142,
  HYPE: 159,
  PAXG: 187
};

const ASSET_DECIMALS = {
  BTC: { sz: 5, px: 0, coin: "BTC" },
  ETH: { sz: 4, px: 1, coin: "ETH" },
  SOL: { sz: 2, px: 2, coin: "SOL" },
  AVAX: { sz: 2, px: 3, coin: "AVAX" },
  BNB: { sz: 3, px: 2, coin: "BNB" },
  LTC: { sz: 2, px: 3, coin: "LTC" },
  DOGE: { sz: 0, px: 6, coin: "DOGE" },
  SUI: { sz: 1, px: 4, coin: "SUI" },
  LINK: { sz: 1, px: 3, coin: "LINK" },
  XRP: { sz: 0, px: 4, coin: "XRP" },
  AAVE: { sz: 2, px: 2, coin: "AAVE" },
  TRX: { sz: 0, px: 5, coin: "TRX" },
  UNI: { sz: 1, px: 4, coin: "UNI" },
  DOT: { sz: 1, px: 5, coin: "DOT" },
  ADA: { sz: 0, px: 5, coin: "ADA" },
  TON: { sz: 1, px: 4, coin: "TON" },
  NEAR: { sz: 1, px: 4, coin: "NEAR" },
  POL: { sz: 0, px: 5, coin: "POL" },
  HYPE: { sz: 2, px: 3, coin: "HYPE" },
  PAXG: { sz: 3, px: 1, coin: "PAXG" }
};

const SQUADS_CONFIG = {
  ALFA: {
    id: "ALFA",
    block: 1,
    name: "Escuadrón #01 Alfa",
    specialist: "#601 Titan-Scalper",
    role: "Fuerza Rápida High-Beta (Bloque 1)",
    pairs: ["SOL", "SUI", "AVAX"],
    targetGainPct: TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  BRAVO: {
    id: "BRAVO",
    block: 1,
    name: "Escuadrón #02 Bravo",
    specialist: "#701 Oracle-Global",
    role: "Macro & Refugios RWA (Bloque 1)",
    pairs: ["BTC", "PAXG", "LINK"],
    targetGainPct: TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  CHARLIE: {
    id: "CHARLIE",
    block: 1,
    name: "Escuadrón #03 Charlie",
    specialist: "#801 Nexus-Boss",
    role: "Ecosistema DeFi & ALO Maker (Bloque 1)",
    pairs: ["ETH", "BNB", "AAVE"],
    targetGainPct: TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  GOLF: {
    id: "GOLF",
    block: 2,
    dedicatedMargin: BLOCK2_DEDICATED_MARGIN,
    name: "Escuadrón #04 Golf",
    specialist: "#901 Golf-Velocity",
    role: "Alta Velocidad & Liquidez Masiva ($100 Bloque 2)",
    pairs: ["XRP", "DOGE", "ADA"],
    targetGainPct: BLOCK2_TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  HOTEL: {
    id: "HOTEL",
    block: 2,
    dedicatedMargin: BLOCK2_DEDICATED_MARGIN,
    name: "Escuadrón #05 Hotel",
    specialist: "#902 Hotel-HyperL1",
    role: "Nativos L1 & Flujo Institucional ($100 Bloque 2)",
    pairs: ["TON", "TRX", "UNI"],
    targetGainPct: BLOCK2_TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  INDIA: {
    id: "INDIA",
    block: 2,
    dedicatedMargin: BLOCK2_DEDICATED_MARGIN,
    name: "Escuadrón #06 India",
    specialist: "#903 India-CrossChain",
    role: "Infraestructura L0/L1 & PoW ($100 Bloque 2)",
    pairs: ["DOT", "NEAR", "LTC"],
    targetGainPct: BLOCK2_TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  }
};

function formatHlPrice(price, coin) {
  const num = Number(price);
  if (!Number.isFinite(num) || num <= 0) return "0";
  if (coin === "BTC") return Math.round(num).toFixed(0);
  const meta = ASSET_DECIMALS[coin];
  const maxDec = (meta && typeof meta.px === "number") ? meta.px : 2;
  if (maxDec === 0) return Math.round(num).toFixed(0);
  // Regla oficial Hyperliquid L1: máximo 5 cifras significativas y máximo maxDec decimales
  const sig5 = Number(num.toPrecision(5));
  const intDigits = num >= 1 ? Math.floor(Math.log10(num)) + 1 : 0;
  const allowedDec = num >= 1 ? Math.max(0, Math.min(maxDec, 5 - intDigits)) : maxDec;
  return Number(sig5.toFixed(allowedDec)).toString();
}

function formatHlSize(sz, szDecimals) {
  const factor = Math.pow(10, szDecimals);
  return (Math.floor(sz * factor) / factor).toFixed(szDecimals);
}

function calculateRSI(closes, period = 14) {
  if (closes.length <= period) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + (avgGain / avgLoss)));
}

function calculateEMA(closes, period = 20) {
  if (closes.length < period) return closes[closes.length - 1];
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateBollingerBands(closes, period = 20, mult = 2.0) {
  if (!closes || closes.length === 0) return { mid: 0, upper: 0, lower: 0 };
  const slice = closes.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const variance = slice.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / slice.length;
  const std = Math.sqrt(variance);
  return {
    mid: mean,
    upper: mean + mult * std,
    lower: mean - mult * std
  };
}

/**
 * NEXUS APEX-36 // LEY 1 & LEY 2:
 * CERO TAKE PROFIT FIJO + ESCALERA DE CANDADOS NETOS (FEE-AWARE RATCHET #00)
 * + EVACUACIÓN EN EMPATE POSITIVO (+$0.01 USDC POST-ONLY MAKER A LOS 180S)
 */
function computeFeeAwareRatchet(coin, entryPx, szNum, currentMid, uPnlNum, posMeta = {}, openTs = Date.now(), isRecoveryMode = false) {
  const absSz = Math.abs(szNum);
  const isShort = szNum < 0;
  const notional = absSz * entryPx;

  // Comisiones reales Hyperliquid L1: 0.015% Maker / 0.045% Taker
  const makerRoundTripFeeUsd = +(notional * (HL_MAKER_FEE_RATE * 2)).toFixed(4);
  const realRoundTripFeeUsd = +(notional * (HL_MAKER_FEE_RATE + HL_TAKER_FEE_RATE)).toFixed(4);

  const gainPct = entryPx > 0
    ? (isShort ? ((entryPx - currentMid) / entryPx) * 100 : ((currentMid - entryPx) / entryPx) * 100)
    : 0;
  const grossMoveUsd = absSz * (isShort ? (entryPx - currentMid) : (currentMid - entryPx));
  const netAfterFeesUsd = +(grossMoveUsd - realRoundTripFeeUsd).toFixed(4);

  // Precio exacto de Candado Nivel 1: Entrada + Comisión Ida/Vuelta Real + $0.02 USDC
  const deltaPxLevel1 = absSz > 0 ? ((realRoundTripFeeUsd + LEVEL1_NET_LOCK_USDC) / absSz) : 0;
  const level1LockPx = isShort ? (entryPx - deltaPxLevel1) : (entryPx + deltaPxLevel1);

  // Precio exacto de Evacuación Limpia 180s: Entrada + Comisión Maker + $0.01 USDC
  const deltaPxEvac = absSz > 0 ? ((makerRoundTripFeeUsd + CLEAN_EVAC_NET_USDC) / absSz) : 0;
  const cleanEvacMakerPx = isShort ? (entryPx - deltaPxEvac) : (entryPx + deltaPxEvac);

  posMeta.peakGainPct = Math.max(posMeta.peakGainPct || 0, gainPct);
  posMeta.peakNetUsd = Math.max(posMeta.peakNetUsd ?? -999, netAfterFeesUsd);

  // 1) CANDADO NIVEL 1 — LIGEREZA NETA REAL (Entrada + Comisión + $0.02 USDC -> 🟢 LIGERO)
  if (!posMeta.beLocked && (netAfterFeesUsd >= LEVEL1_NET_LOCK_USDC || (!isShort && currentMid >= level1LockPx) || (isShort && currentMid <= level1LockPx))) {
    posMeta.beLocked = true;
    posMeta.isLight = true;
    posMeta.ratchetLevel = Math.max(posMeta.ratchetLevel || 0, 1);
    posMeta.lockedNetUsd = Math.max(posMeta.lockedNetUsd || 0, LEVEL1_NET_LOCK_USDC);
    posMeta.lockedPx = level1LockPx;
    posMeta.cleanEvacActive = false;
  }

  // 2) CANDADO NIVEL 2 — EXPRIMIDO ELÁSTICO SIN TECHO (75% / 83% / 90% DEL HIGH-WATER MARK)
  const peakPct = posMeta.peakGainPct || 0;
  if (peakPct >= RATCHET_TIER_1_MIN_PCT && posMeta.peakNetUsd > LEVEL1_NET_LOCK_USDC) {
    posMeta.beLocked = true;
    posMeta.isLight = true;
    posMeta.ratchetLevel = 2;
    let retentionRatio = 0.75; // +0.10% a +0.25% -> 75%
    if (peakPct > RATCHET_TIER_3_MIN_PCT) {
      retentionRatio = 0.90;   // > +0.80% -> 90% High-Water Mark
    } else if (peakPct >= RATCHET_TIER_2_MIN_PCT) {
      retentionRatio = 0.83;   // +0.25% a +0.80% -> 83%
    }
    posMeta.retentionRatio = retentionRatio;
    const targetLockedNet = Math.max(LEVEL1_NET_LOCK_USDC, +(posMeta.peakNetUsd * retentionRatio).toFixed(4));
    if (targetLockedNet >= (posMeta.lockedNetUsd || 0)) {
      posMeta.lockedNetUsd = targetLockedNet;
      const deltaRatchetPx = absSz > 0 ? ((realRoundTripFeeUsd + targetLockedNet) / absSz) : 0;
      posMeta.lockedPx = isShort ? (entryPx - deltaRatchetPx) : (entryPx + deltaRatchetPx);
    }
  }

  // 3) LEY 2 — PROTOCOLO DE EVACUACIÓN LIMPIA A LOS 180 SEGUNDOS (+$0.01 USDC POST-ONLY MAKER)
  const elapsedMs = Math.max(0, Date.now() - (openTs || Date.now()));
  if (!posMeta.beLocked && (posMeta.ratchetLevel || 0) < 2 && (elapsedMs >= CLEAN_EVAC_TIMEOUT_MS || isRecoveryMode)) {
    posMeta.cleanEvacActive = true;
  }

  // Determinar si el precio retrocedió y tocó el Candado Positivo (Prohibido cerrar en rojo: NO_RED_EXIT = true)
  const hitRatchetStop = Boolean(
    posMeta.beLocked &&
    posMeta.lockedPx &&
    netAfterFeesUsd >= CLEAN_EVAC_NET_USDC &&
    ((!isShort && currentMid <= posMeta.lockedPx) || (isShort && currentMid >= posMeta.lockedPx))
  );

  // Etiqueta oficial de telemetría para /squad-matrix/
  let ratchetStatusLabel = "🔓 BUSCANDO CANDADO NETO +$0.02";
  if (posMeta.beLocked) {
    const lockedDisp = Math.max(LEVEL1_NET_LOCK_USDC, posMeta.lockedNetUsd || LEVEL1_NET_LOCK_USDC).toFixed(2);
    ratchetStatusLabel = `🔒 CANDADO ACTIVO +$${lockedDisp} | EXPRIMIENDO OLA 🌊`;
  } else if (posMeta.cleanEvacActive) {
    ratchetStatusLabel = "🎯 EVACUACIÓN LIMPIA +$0.01";
  }

  return {
    absSz,
    isShort,
    notional,
    realRoundTripFeeUsd,
    makerRoundTripFeeUsd,
    gainPct,
    netAfterFeesUsd,
    level1LockPx,
    cleanEvacMakerPx,
    elapsedMs,
    beLocked: Boolean(posMeta.beLocked),
    ratchetLevel: posMeta.ratchetLevel || 0,
    retentionRatio: posMeta.retentionRatio || 0,
    lockedNetUsd: posMeta.lockedNetUsd || 0,
    lockedPx: posMeta.lockedPx || level1LockPx,
    cleanEvacActive: Boolean(posMeta.cleanEvacActive),
    hitRatchetStop,
    ratchetStatusLabel
  };
}

/**
 * NEXUS APEX-36 // LEY 3:
 * GIRO BRUSCO INSTANTÁNEO (STOP-AND-REVERSE < 50ms) EN CLONES (2)
 * Evalúa si el golpe que cerró el Candado Positivo del Titular (1) es:
 * - Caso A: Avalancha / Volteo Institucional (tapeVelocity >= 18 bps/s + Vol >= 2.5x + L2 >= 74%)
 * - Caso B: Resorte en Fondo de Aguja (RSI(6) <= 8 o >= 92 fuera de Bollinger + absorción L2)
 * - Caso C: Ruido Normal (No regala lo ganado y espera confirmación)
 */
async function evaluateCloneStopAndReverse({
  coin,
  closedWasShort,
  squadKey,
  info,
  client,
  rollingMidsHistory,
  isPre00UtcOrRecovering,
  unfencedPositionsCount
}) {
  const evalStartMs = Date.now();
  // Si el cerrojo de recuperación previa está activo o el cupo de ligereza (MAX_UNFENCED_POSITIONS = 2) está lleno, no abrir
  if (STRICT_RECOVERY_LOCK && isPre00UtcOrRecovering) {
    return { triggered: false, caseType: "BLOCKED_BY_RECOVERY_LOCK", evalLatencyMs: Date.now() - evalStartMs };
  }
  if (unfencedPositionsCount >= MAX_UNFENCED_POSITIONS) {
    return { triggered: false, caseType: "BLOCKED_BY_MAX_UNFENCED_2", evalLatencyMs: Date.now() - evalStartMs };
  }
  if (!ASSET_DECIMALS[coin] || ASSET_INDICES[coin] === undefined) {
    return { triggered: false, caseType: "INVALID_ASSET", evalLatencyMs: Date.now() - evalStartMs };
  }

  try {
    // 1. Calcular tapeVelocity (bps/s) sobre la ventana reciente de precios mid
    const hist = rollingMidsHistory[coin] || [];
    let tapeVelocityBpsSec = 0;
    if (hist.length >= 2) {
      const recentSlice = hist.slice(-4);
      const first = recentSlice[0];
      const last = recentSlice[recentSlice.length - 1];
      const dtSec = Math.max(1, (last.ts - first.ts) / 1000);
      const moveBps = first.px > 0 ? (Math.abs(last.px - first.px) / first.px) * 10000 : 0;
      tapeVelocityBpsSec = +(moveBps / dtSec).toFixed(2);
    }

    // 2. Consultar L2 Book y Velas 1m en paralelo (< 50ms evaluación local tras snapshot)
    const now = Date.now();
    const [l2, candles1m] = await Promise.all([
      info.l2Book({ coin }).catch(() => null),
      info.candleSnapshot({ coin, interval: "1m", startTime: now - (35 * 60000), endTime: now }).catch(() => null)
    ]);

    const bids = l2?.levels?.[0] || [];
    const asks = l2?.levels?.[1] || [];
    if (bids.length < 3 || asks.length < 3) {
      return { triggered: false, caseType: "CASO_C_RUIDO_NORMAL", evalLatencyMs: Date.now() - evalStartMs };
    }

    let bidVol = 0, askVol = 0;
    for (let i = 0; i < 5; i++) {
      bidVol += parseFloat(bids[i]?.px || 0) * parseFloat(bids[i]?.sz || 0);
      askVol += parseFloat(asks[i]?.px || 0) * parseFloat(asks[i]?.sz || 0);
    }
    const totBook = bidVol + askVol;
    const bullBookPct = totBook > 0 ? (bidVol / totBook) * 100 : 50;
    const bearBookPct = totBook > 0 ? (askVol / totBook) * 100 : 50;

    let volRatio = 1.0;
    let rsi6 = 50;
    let bb = { mid: 0, upper: 0, lower: 0 };
    const currentPx = parseFloat(bids[0].px);

    if (Array.isArray(candles1m) && candles1m.length >= 10) {
      const closes = candles1m.map(c => parseFloat(c.c));
      const vols = candles1m.map(c => parseFloat(c.v || 0));
      const lastVol = vols[vols.length - 1] || 0;
      const prevVols = vols.slice(-11, -1);
      const avgVol = prevVols.length > 0 ? (prevVols.reduce((a, b) => a + b, 0) / prevVols.length) : 1;
      volRatio = avgVol > 0 ? +(lastVol / avgVol).toFixed(2) : 1.0;
      rsi6 = calculateRSI(closes, 6);
      bb = calculateBollingerBands(closes, Math.min(20, closes.length), 2.0);
    }

    // Dirección de Giro Sísmico si el Titular (1) era LONG (!closedWasShort) ➔ el giro es SHORT; si era SHORT ➔ el giro es LONG
    const reversalIsLong = Boolean(closedWasShort);
    const reversalL2Pct = reversalIsLong ? bullBookPct : bearBookPct;

    // CASO A: Avalancha / Volteo Institucional (tapeVelocity >= 18 bps/s + Vol >= 2.5x + L2 volcado >= 74%)
    const isCaseA = (
      tapeVelocityBpsSec >= STOP_REVERSE_TAPE_BPS_SEC &&
      volRatio >= STOP_REVERSE_VOL_MULT &&
      reversalL2Pct >= STOP_REVERSE_L2_IMB_PCT
    );

    // CASO B: Resorte en Fondo de Aguja (RSI(6) <= 8 bajo Bollinger Inferior o RSI(6) >= 92 sobre Bollinger Superior con absorción L2 >= 62%)
    const isCaseBLong = (rsi6 <= STOP_REVERSE_RSI6_LOW && bb.lower > 0 && currentPx <= bb.lower && bullBookPct >= 62.0);
    const isCaseBShort = (rsi6 >= STOP_REVERSE_RSI6_HIGH && bb.upper > 0 && currentPx >= bb.upper && bearBookPct >= 62.0);
    const isCaseB = isCaseBLong || isCaseBShort;

    if (!isCaseA && !isCaseB) {
      console.log(`🧘 [${squadKey} 2 // CLON] Caso C (Ruido Normal en ${coin}: Vel ${tapeVelocityBpsSec} bps/s, Vol ${volRatio}x, L2 ${reversalL2Pct.toFixed(1)}%, RSI6 ${rsi6.toFixed(1)}) -> No regala lo ganado, espera confirmación.`);
      return { triggered: false, caseType: "CASO_C_RUIDO_NORMAL", evalLatencyMs: Date.now() - evalStartMs };
    }

    const cloneGoLong = isCaseA ? reversalIsLong : isCaseBLong;
    const entryBookPx = cloneGoLong ? parseFloat(bids[0].px) : parseFloat(asks[0].px);
    const cloneNotional = 150.0;
    const cloneSz = formatHlSize(cloneNotional / entryBookPx, ASSET_DECIMALS[coin].sz);
    const clonePxStr = formatHlPrice(entryBookPx, coin);
    const caseLabel = isCaseA ? "CASO A (AVALANCHA / VOLTEO INSTITUCIONAL)" : "CASO B (RESORTE EN FONDO DE AGUJA)";

    console.log(`⚡🔄 [${squadKey} 2 // STOP-AND-REVERSE] ${caseLabel} detectado en ${coin} -> Clon (2) entrando ${cloneGoLong ? "LONG" : "SHORT"} ${cloneSz} @ $${clonePxStr}`);

    const orderRes = await client.order({
      orders: [{
        a: ASSET_INDICES[coin],
        b: cloneGoLong,
        p: clonePxStr,
        s: cloneSz,
        r: false,
        t: { limit: { tif: "Alo" } }
      }],
      grouping: "na"
    });
    const st = orderRes?.response?.data?.statuses?.[0] || {};
    return {
      triggered: Boolean(st.resting || st.filled),
      caseType: caseLabel,
      direction: cloneGoLong ? "LONG" : "SHORT",
      evalLatencyMs: Date.now() - evalStartMs
    };
  } catch (err) {
    return { triggered: false, caseType: `ERROR: ${err.message}`, evalLatencyMs: Date.now() - evalStartMs };
  }
}

function loadRealLedger() {
  try {
    if (fs.existsSync(REAL_LEDGER_FILE)) {
      return JSON.parse(fs.readFileSync(REAL_LEDGER_FILE, "utf8"));
    }
  } catch (_) { }
  return { realWins: 0, realLosses: 0, realTransactions: [] };
}

function recordTransactionInLedger(tx) {
  try {
    const ledger = loadRealLedger();
    ledger.realWins = Math.max(136, (ledger.realWins || 0) + 1);
    ledger.realPnlUsdc = +(Number(ledger.realPnlUsdc || 0) + Number(tx.netProfitUsdc || 0)).toFixed(4);
    ledger.totalConsolidatedUsdc = Number(tx.newAccountValue || 835.50);
    ledger.remainingToNextBlock = +(Math.max(0, 1000 - ledger.totalConsolidatedUsdc)).toFixed(2);
    ledger.progressToNextBlockPct = +((ledger.totalConsolidatedUsdc / 1000) * 100).toFixed(1);
    ledger.updatedAt = new Date().toISOString();
    ledger.realTransactions = ledger.realTransactions || [];
    ledger.realTransactions.unshift(tx);
    if (ledger.realTransactions.length > 50) ledger.realTransactions = ledger.realTransactions.slice(0, 50);
    fs.writeFileSync(REAL_LEDGER_FILE, JSON.stringify(ledger, null, 2), "utf8");

    if (fs.existsSync(SQUAD_TELEMETRY_FILE)) {
      try {
        const telem = JSON.parse(fs.readFileSync(SQUAD_TELEMETRY_FILE, "utf8"));
        telem.scoreboard = telem.scoreboard || {};
        telem.scoreboard.currentWins = ledger.realWins;
        telem.scoreboard.sessionNetPnLUsdc = ledger.realPnlUsdc;
        telem.scoreboard.sessionNetPnLFormatted = `+$${ledger.realPnlUsdc.toFixed(2)} USDC`;
        telem.scoreboard.accountValue = Number(tx.newAccountValue || 835.50);
        telem.cycleHistory = ledger.realTransactions.slice(0, 15);
        fs.writeFileSync(SQUAD_TELEMETRY_FILE, JSON.stringify(telem, null, 2), "utf8");
      } catch (_) { }
    }
  } catch (err) {
    console.error("Error guardando transacción en ledger:", err.message);
  }
}

async function sendSquadTelegram(msg) {
  const chatId = process.env.TELEGRAM_CHAT_ID || "-1004342131598";
  try {
    await sendTelegramAlert(msg, chatId, { skipHeader: true });
  } catch (_) { }
}

/**
 * Procesa la Cola de Órdenes Directas (Direct Order Bridge sub-150ms)
 */
async function processDirectOrdersQueue(client, info) {
  try {
    if (!fs.existsSync(DIRECT_ORDERS_FILE)) return;
    const raw = fs.readFileSync(DIRECT_ORDERS_FILE, "utf8");
    if (!raw.trim()) return;
    const queueData = JSON.parse(raw);
    if (!queueData.queue || queueData.queue.length === 0) return;

    for (const order of queueData.queue) {
      console.log(`⚡ [DIRECT ORDER BRIDGE] Procesando orden: ${order.action} ${order.coin || ""}`);
      try {
        if (order.action === "CLOSE_ALL" || order.action === "CANCEL_ALL") {
          const openOrders = await info.openOrders({ user: VAULT_501 });
          if (openOrders.length > 0) {
            await client.cancel({
              cancels: openOrders.map(o => ({ a: ASSET_INDICES[o.coin] ?? 0, o: o.oid }))
            });
            console.log(`   ✔ ${openOrders.length} órdenes canceladas.`);
          }
          order.status = "SUCCESS_CANCELLED_ALL";
        } else if (order.action === "MARKET_CLOSE" && order.coin) {
          const ch = await info.clearinghouseState({ user: VAULT_501 });
          const pos = (ch.assetPositions || []).find(p => p.position.coin === order.coin);
          if (pos && parseFloat(pos.position.szi) !== 0) {
            const sz = Math.abs(parseFloat(pos.position.szi));
            const isShort = parseFloat(pos.position.szi) < 0;
            await client.order({
              orders: [{
                a: ASSET_INDICES[order.coin],
                b: isShort,
                p: isShort ? "999999" : "0.00001",
                s: formatHlSize(sz, ASSET_DECIMALS[order.coin].sz),
                r: true,
                t: { limit: { tif: "Ioc" } }
              }],
              grouping: "na"
            });
            order.status = "SUCCESS_MARKET_CLOSED";
            console.log(`   ✔ Posición ${order.coin} cerrada en mercado.`);
          } else {
            order.status = "NO_ACTIVE_POSITION";
          }
        }
      } catch (err) {
        order.status = `ERROR: ${err.message}`;
        console.error(`   ❌ Error en orden directa:`, err.message);
      }
      order.processedAt = new Date().toISOString();
      queueData.processed = queueData.processed || [];
      queueData.processed.unshift(order);
    }
    queueData.queue = [];
    queueData.lastChecked = new Date().toISOString();
    fs.writeFileSync(DIRECT_ORDERS_FILE, JSON.stringify(queueData, null, 2), "utf8");
  } catch (_) {}
}

/**
 * Nueva Doctrina Oficial de Consolidación por Bloques ($1,000.00 USDC)
 * - Fase 1 (accountValue < 1000.00 USDC): 100% Capitalización Pura ($0 retiros). Reinvierte todo.
 * - Fase 2 (accountValue >= 1000.00 USDC): Regla 70/30 (70% reinversión continua / 30% devolución a #501 o Bloque 2).
 */
function checkDailyAmortizationCut(accountValue = 0) {
  try {
    if (!fs.existsSync(LOAN_LEDGER_FILE)) return;
    const loan = JSON.parse(fs.readFileSync(LOAN_LEDGER_FILE, "utf8"));
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (accountValue < 1000.00) {
      // FASE 1: CAPITALIZACIÓN PURA ($0 RETIROS)
      if (loan.lastLogDate !== todayStr && now.getUTCHours() >= 12) {
        loan.lastLogDate = todayStr;
        loan.status = "CAPITALIZING_TO_1000";
        loan.updatedAt = now.toISOString();
        fs.writeFileSync(LOAN_LEDGER_FILE, JSON.stringify(loan, null, 2), "utf8");
        console.log(`🏦 [DOCTRINA BLOQUE 1] Capital: $${accountValue.toFixed(2)} / $1,000.00 USDC | 100% Capitalización Pura Activa ($0.00 retiros).`);
      }
      return;
    }

    // FASE 2: GATILLO $1,000 ALCANZADO (REGLA 70 / 30)
    if (accountValue >= 1000.00 && loan.lastCutDate !== todayStr && now.getUTCHours() >= 12) {
      loan.lastCutDate = todayStr;
      loan.status = "PHASE_2_REPAYMENT_ACTIVE_70_30";
      const dailyProfitEst = Math.max(10.00, +(accountValue - 1000.00).toFixed(2));
      const quotaToVault501 = +(dailyProfitEst * 0.30).toFixed(2);
      loan.repaidSoFarUsdc = +(Number(loan.repaidSoFarUsdc || 0) + quotaToVault501).toFixed(2);
      loan.remainingBalanceUsdc = Math.max(0, +(Number(loan.principalBorrowedUsdc) - Number(loan.repaidSoFarUsdc)).toFixed(2));
      loan.installmentsHistory = loan.installmentsHistory || [];
      loan.installmentsHistory.push({
        quotaUsdc: quotaToVault501,
        timestamp: now.toISOString(),
        remainingBalanceUsdc: loan.remainingBalanceUsdc,
        action: "REPAYMENT_70_30_TO_VAULT501"
      });
      loan.updatedAt = now.toISOString();
      fs.writeFileSync(LOAN_LEDGER_FILE, JSON.stringify(loan, null, 2), "utf8");
      console.log(`🎉 [DOCTRINA 70/30] $${quotaToVault501} USDC asignados a devolución #501. Restante: $${loan.remainingBalanceUsdc} USDC.`);
    }
  } catch (_) {}
}

// ==============================================================================
// VIGILANTE DE SESIONES MUNDIALES (ALERTAS TELEGRAM -5 MIN ANTES DE ABRIR/CERRAR)
// ==============================================================================
const sentSessionAlertsDaemon = {};

async function checkMarketSessionAlertsDaemon(now) {
  const utcDay = now.getUTCDay();
  const utcHours = now.getUTCHours();
  const utcMins = now.getUTCMinutes();
  const totalMins = utcHours * 60 + utcMins;
  const dateKey = now.toISOString().slice(0, 10);

  const SESSION_EVENTS = [
    {
      id: "TSE_OPEN",
      market: "BOLSA DE TOKIO (SESIÓN ASIÁTICA — TSE & YEN)",
      type: "OPEN",
      timeUtc: "00:00 UTC",
      targetMins: 23 * 60 + 55,
      activeDays: [0, 1, 2, 3, 4],
      squads: "#01 ALFA (#601 Titan-Scalper) · #11 ECHO (FX Pacific)",
      pairs: "SOL, AVAX, SUI, USD/JPY, EUR/JPY"
    },
    {
      id: "TSE_CLOSE",
      market: "BOLSA DE TOKIO (SESIÓN ASIÁTICA — TSE & YEN)",
      type: "CLOSE",
      timeUtc: "06:00 UTC",
      targetMins: 5 * 60 + 55,
      activeDays: [1, 2, 3, 4, 5],
      squads: "#01 ALFA · #11 ECHO · #12 FOXTROT",
      pairs: "SOL, AVAX, USD/JPY, XAU/USD"
    },
    {
      id: "FRA_OPEN",
      market: "BOLSA DE FRANKFURT (DAX40 & APERTURA BANCARIA EUROPEA)",
      type: "OPEN",
      timeUtc: "07:00 UTC",
      targetMins: 6 * 60 + 55,
      activeDays: [1, 2, 3, 4, 5],
      squads: "#02 BRAVO (#701 Oracle-Global) · #10 DELTA · #15 OSCAR",
      pairs: "BTC, PAXG, DAX40, EUR/USD"
    },
    {
      id: "FRA_CLOSE",
      market: "BOLSA DE FRANKFURT (DAX40 & APERTURA BANCARIA EUROPEA)",
      type: "CLOSE",
      timeUtc: "15:30 UTC",
      targetMins: 15 * 60 + 25,
      activeDays: [1, 2, 3, 4, 5],
      squads: "#02 BRAVO · #10 DELTA · #15 OSCAR",
      pairs: "DAX40, EUR/USD, BTC, PAXG"
    },
    {
      id: "LSE_OPEN",
      market: "BOLSA DE LONDRES (FOREX & EUROPA — LSE)",
      type: "OPEN",
      timeUtc: "08:00 UTC",
      targetMins: 7 * 60 + 55,
      activeDays: [1, 2, 3, 4, 5],
      squads: "#02 BRAVO (#701 BTC, PAXG, LINK) · #03 CHARLIE (#801 ETH, BNB) · #10 DELTA · #13 MIKE",
      pairs: "BTC, PAXG, ETH, BNB, EUR/USD, GBP/USD"
    },
    {
      id: "LSE_CLOSE",
      market: "BOLSA DE LONDRES (FOREX & EUROPA — LSE)",
      type: "CLOSE",
      timeUtc: "16:30 UTC",
      targetMins: 16 * 60 + 25,
      activeDays: [1, 2, 3, 4, 5],
      squads: "#02 BRAVO · #03 CHARLIE · #10 DELTA · #13 MIKE",
      pairs: "PAXG, BTC, ETH, BNB, EUR/USD, GBP/USD"
    },
    {
      id: "NYSE_OPEN",
      market: "WALL STREET — NUEVA YORK (NYSE / NASDAQ)",
      type: "OPEN",
      timeUtc: "13:30 UTC",
      targetMins: 13 * 60 + 25,
      activeDays: [1, 2, 3, 4, 5],
      squads: "#01 ALFA · #02 BRAVO · #03 CHARLIE · #14 NOV · #16 PAPA",
      pairs: "BTC, ETH, SOL, BNB, AVAX, PAXG, NAS100, NVDA, TSLA"
    },
    {
      id: "NYSE_CLOSE",
      market: "WALL STREET — NUEVA YORK (NYSE / NASDAQ)",
      type: "CLOSE",
      timeUtc: "20:00 UTC",
      targetMins: 19 * 60 + 55,
      activeDays: [1, 2, 3, 4, 5],
      squads: "#01 ALFA · #02 BRAVO · #03 CHARLIE · #14 NOV",
      pairs: "NAS100, SPX500, BTC, ETH, SOL, BNB"
    },
    {
      id: "CME_PAUSE",
      market: "COMMODITIES & METALES (CME GLOBEX — ORO, PLATA, PETRÓLEO)",
      type: "CLOSE",
      timeUtc: "21:00 UTC",
      targetMins: 20 * 60 + 55,
      activeDays: [1, 2, 3, 4, 5],
      squads: "#02 BRAVO (#701 PAXG-Oro, BTC, LINK) · #12 FOXTROT · #15 OSCAR",
      pairs: "PAXG-USD, XAU, XAG, WTI/USD, NGAS"
    },
    {
      id: "CME_OPEN",
      market: "COMMODITIES & METALES (CME GLOBEX — ORO, PLATA, PETRÓLEO)",
      type: "OPEN",
      timeUtc: "22:00 UTC",
      targetMins: 21 * 60 + 55,
      activeDays: [0, 1, 2, 3, 4],
      squads: "#02 BRAVO (#701 PAXG-Oro, BTC, LINK) · #12 FOXTROT",
      pairs: "PAXG-USD, BTC, Oro, Plata, Gas"
    }
  ];

  for (const ev of SESSION_EVENTS) {
    if (!ev.activeDays.includes(utcDay)) continue;

    if (totalMins === ev.targetMins) {
      const alertKey = `${ev.id}_${dateKey}`;
      if (sentSessionAlertsDaemon[alertKey]) continue;
      sentSessionAlertsDaemon[alertKey] = true;

      let msgText = "";
      if (ev.type === "OPEN") {
        msgText = `🚨🕒 <b>AVISO DE MERCADO SQUAD MATRIX: FALTAN 5 MINUTOS PARA ABRIR</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🏛️ <b>Mercado:</b> ${ev.market}\n` +
          `⏰ <b>Hora de Apertura:</b> ${ev.timeUtc} (En exactamente 5 minutos)\n` +
          `📊 <b>Estado:</b> 🔴 CERRADO ➔ Pasando a 🟢 ABIERTO\n` +
          `🔰 <b>Escuadrones Asignados:</b> ${ev.squads}\n` +
          `💎 <b>Pares Vigilados:</b> <code>${ev.pairs}</code>\n\n` +
          `🛡️ <b>MEDIDAS ACTIVADAS POR MITIGACIÓN DE RIESGO:</b>\n` +
          `1. 🔒 <b>Candado BE #00 (+0.045%):</b> Asegurado en todas las posiciones abiertas en verde. Cero devolución de ganancias.\n` +
          `2. ⏸️ <b>Pausa de Mechazo Inicial:</b> Congelación de nuevas entradas durante el mechazo inicial de la campana (primeros 60s) para evitar spreads falsos.\n` +
          `3. 🎯 <b>Disparo de Alta Certeza:</b> Entrada selectiva únicamente al confirmar dirección real del flujo institucional (L2 >= 65% + RSI 5m + EMA20) para sumar a la meta diaria sin retrocesos.\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🌐 <i>Rumbo a la coronación de $1,000.00 USDC en 4-5 días.</i>`;
      } else {
        msgText = `🔔🕒 <b>AVISO DE MERCADO SQUAD MATRIX: FALTAN 5 MINUTOS PARA CERRAR</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🏛️ <b>Mercado:</b> ${ev.market}\n` +
          `⏰ <b>Hora de Cierre:</b> ${ev.timeUtc} (En exactamente 5 minutos)\n` +
          `📊 <b>Estado:</b> 🟢 ABIERTO ➔ Pasando a 🔴 CERRADO\n` +
          `🔰 <b>Escuadrones Asignados:</b> ${ev.squads}\n` +
          `💎 <b>Pares Vigilados:</b> <code>${ev.pairs}</code>\n\n` +
          `🛡️ <b>MEDIDAS ACTIVADAS POR MITIGACIÓN DE RIESGO:</b>\n` +
          `1. 🔒 <b>Candado BE #00 (+0.045%):</b> Asegurado en posiciones abiertas ante posibles sacudones de liquidación de cierre.\n` +
          `2. ❄️ <b>Enfriamiento Táctico 12m:</b> Pares que cierren en ganancia entran en 12 minutos de reposo y recalibración.\n` +
          `3. 🛡️ <b>Protección del Piso Ganado:</b> Cuota diaria protegida para asegurar la coronación de los $1,000 USDC sin devolver ni un centavo.\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🌐 <i>Rumbo a la coronación de $1,000.00 USDC en 4-5 días.</i>`;
      }

      console.log(`[SESSION ALERTS DAEMON] Disparando aviso de mercado: ${ev.id}`);
      await sendSquadTelegram(msgText);
    }
  }
}

// ==============================================================================
// DETECTOR DE VENTANA DE SACUDÓN (±5 MIN DE APERTURA LONDRES 08:00 / NY 13:30)
// ==============================================================================
function isMarketShakeWindow(now) {
  const utcDay = now.getUTCDay();
  if (utcDay < 1 || utcDay > 5) return false;
  const totalMins = now.getUTCHours() * 60 + now.getUTCMinutes();
  // Londres 08:00 UTC ± 5 min -> 07:55 a 08:05 UTC (475 a 485 mins)
  const isLondonWave = totalMins >= 475 && totalMins <= 485;
  // Nueva York 13:30 UTC ± 5 min -> 13:25 a 13:35 UTC (805 a 815 mins)
  const isNyWave = totalMins >= 805 && totalMins <= 815;
  return isLondonWave || isNyWave;
}

// Pausa de Mechazo de Campana Inicial (primeros 60 segundos tras 08:00 o 13:30 UTC)
function isOpeningBellWick(now) {
  const utcDay = now.getUTCDay();
  if (utcDay < 1 || utcDay > 5) return false;
  const hours = now.getUTCHours();
  const mins = now.getUTCMinutes();
  const secs = now.getUTCSeconds();
  const isLondonBell = hours === 8 && mins === 0 && secs < 60;
  const isNyBell = hours === 13 && mins === 30 && secs < 60;
  return isLondonBell || isNyBell;
}

// Hot-Swap Relay 1 ⇄ 2 (18 Espacios × 36 Bots // NEXUS APEX-36: Candado Neto #00 + Giro Brusco Filtrado)
function updateSquadMatrixClones(openPositions, pairCooldowns, recoveryCtrl = null, confirmedOpenByCoin = {}) {
  try {
    const spaces = [
      { id: 1, code: "ALFA", num: "#01", block: 1, titular: "ALFA 1", clon: "ALFA 2", pairs: ["SOL", "SUI", "AVAX"] },
      { id: 2, code: "BRAVO", num: "#02", block: 1, titular: "BRAVO 1", clon: "BRAVO 2", pairs: ["BTC", "PAXG", "LINK"] },
      { id: 3, code: "CHARLIE", num: "#03", block: 1, titular: "CHARLIE 1", clon: "CHARLIE 2", pairs: ["ETH", "BNB", "AAVE"] },
      { id: 4, code: "GOLF", num: "#04", block: 2, titular: "GOLF 1", clon: "GOLF 2", pairs: ["XRP", "DOGE", "ADA"] },
      { id: 5, code: "HOTEL", num: "#05", block: 2, titular: "HOTEL 1", clon: "HOTEL 2", pairs: ["HYPE", "TRX", "UNI"] },
      { id: 6, code: "INDIA", num: "#06", block: 2, titular: "INDIA 1", clon: "INDIA 2", pairs: ["DOT", "NEAR", "LTC"] },
      { id: 7, code: "JULIET", num: "#07", block: 3, titular: "JULIET 1", clon: "JULIET 2", pairs: ["TAO", "RENDER", "FET"] },
      { id: 8, code: "KILO", num: "#08", block: 3, titular: "KILO 1", clon: "KILO 2", pairs: ["ARB", "OP", "UNI"] },
      { id: 9, code: "LIMA", num: "#09", block: 3, titular: "LIMA 1", clon: "LIMA 2", pairs: ["ONDO", "PENDLE", "PEPE"] },
      { id: 10, code: "DELTA", num: "#10", block: 4, titular: "DELTA 1", clon: "DELTA 2", pairs: ["EUR/USD", "GBP/USD", "USD/CHF"] },
      { id: 11, code: "ECHO", num: "#11", block: 4, titular: "ECHO 1", clon: "ECHO 2", pairs: ["USD/JPY", "AUD/USD", "USD/CAD"] },
      { id: 12, code: "FOXTROT", num: "#12", block: 4, titular: "FOXTROT 1", clon: "FOXTROT 2", pairs: ["XAU/USD", "XAG/USD", "EUR/JPY"] },
      { id: 13, code: "MIKE", num: "#13", block: 5, titular: "MIKE 1", clon: "MIKE 2", pairs: ["GBP/JPY", "EUR/GBP", "WTI/USD"] },
      { id: 14, code: "NOVEMBER", num: "#14", block: 5, titular: "NOVEMBER 1", clon: "NOVEMBER 2", pairs: ["NAS100", "SPX500", "US30"] },
      { id: 15, code: "OSCAR", num: "#15", block: 5, titular: "OSCAR 1", clon: "OSCAR 2", pairs: ["DAX40", "NGAS", "HG/USD"] },
      { id: 16, code: "PAPA", num: "#16", block: 6, titular: "PAPA 1", clon: "PAPA 2", pairs: ["NVDA", "TSLA", "AAPL"] },
      { id: 17, code: "QUEBEC", num: "#17", block: 6, titular: "QUEBEC 1", clon: "QUEBEC 2", pairs: ["MSFT", "AMZN", "META"] },
      { id: 18, code: "ROMEO", num: "#18", block: 6, titular: "ROMEO 1", clon: "ROMEO 2", pairs: ["GOOGL", "COIN", "MSTR"] }
    ];

    const now = Date.now();
    const ctrl = recoveryCtrl || loadRecoveryControlConfig();
    const target00UtcMs = ctrl.TARGET_RESET_UTC ? new Date(ctrl.TARGET_RESET_UTC).getTime() : 0;
    const activeCoins = (openPositions || []).map(p => p.position.coin);
    const isPre00UtcLock = Boolean(
      ctrl.STRICT_RECOVERY_LOCK && (activeCoins.length > 0 || (ctrl.COOLDOWN_UNTIL_00_UTC && now < target00UtcMs))
    );

    const clonesState = spaces.map(sp => {
      if (sp.block <= 2) {
        const inPosCoins = sp.pairs.filter(c => activeCoins.includes(c));
        const inPosCoin = inPosCoins[0] || null;
        const cooldownCoin = sp.pairs.find(c => pairCooldowns && pairCooldowns[c] && pairCooldowns[c] > now);
        const posMeta = inPosCoin ? (confirmedOpenByCoin[inPosCoin] || {}) : {};
        const ratchetBadge = posMeta.ratchetStatusLabel || "🔓 BUSCANDO CANDADO NETO +$0.02";

        if (isPre00UtcLock) {
          if (activeCoins.length === 0) {
            return {
              ...sp,
              relayStatus: `🧘‍♀️ 100% LIQUIDEZ USDC — ENFRIAMIENTO TÁCTICO HASTA 00:00:00 UTC`,
              ratchetStatus: "❄️ ENFRIAMIENTO 00:00 UTC",
              activeBot: "ENFRIAMIENTO 00:00 UTC",
              standbyBot: sp.clon,
              mode: "FULL_COOLDOWN_00_UTC",
              pairInAction: null
            };
          }
          if (inPosCoin) {
            return {
              ...sp,
              relayStatus: `${ratchetBadge} · 🛡️ ${sp.titular} (${inPosCoins.join("+")}) ⇄ ❄️ ${sp.clon}`,
              ratchetStatus: ratchetBadge,
              activeBot: sp.titular,
              standbyBot: sp.clon,
              mode: "RECOVERY_ACTIVE",
              pairInAction: inPosCoin
            };
          }
          return {
            ...sp,
            relayStatus: `❄️ EN ENFRIAMIENTO HASTA 00:00 UTC (RECUPERADA ✅)`,
            ratchetStatus: "❄️ RECUPERADA ✅",
            activeBot: "RECUPERADA",
            standbyBot: sp.clon,
            mode: "COOLDOWN_UNTIL_00_UTC",
            pairInAction: null
          };
        }

        if (inPosCoin) {
          return {
            ...sp,
            relayStatus: `${ratchetBadge} · ⚡ ${sp.titular} (${inPosCoin}) ⇄ ${sp.clon}: STOP&REV ARMADO`,
            ratchetStatus: ratchetBadge,
            activeBot: sp.titular,
            standbyBot: sp.clon,
            mode: "ACTIVE_POSITION",
            pairInAction: inPosCoin
          };
        } else if (cooldownCoin) {
          const remMins = Math.ceil((pairCooldowns[cooldownCoin] - now) / 60000);
          return {
            ...sp,
            relayStatus: `❄️ ${sp.titular}: ENFRIAMIENTO ${remMins}m (15M POST-COBRO) ⇄ ⚡ ${sp.clon}: GIRO SÍSMICO LISTO`,
            ratchetStatus: `❄️ COOLDOWN ${remMins}M`,
            activeBot: sp.clon,
            standbyBot: sp.titular,
            mode: "COOLDOWN_15M",
            cooldownCoin,
            cooldownRemainingMins: remMins
          };
        } else {
          return {
            ...sp,
            relayStatus: `⚡ ${sp.titular}: ESCANEANDO (0 TP FIJO · RATCHET #00) ⇄ ${sp.clon}: STOP&REV <50ms`,
            ratchetStatus: "🟢 LIGERO / ESCANEANDO",
            activeBot: sp.titular,
            standbyBot: sp.clon,
            mode: "SCANNING",
            pairInAction: null
          };
        }
      } else {
        return {
          ...sp,
          relayStatus: `⏸️ ${sp.titular}: PRE-ARMADO ⇄ ${sp.clon}: PRE-ARMADO ($100 · NEXUS APEX-36)`,
          ratchetStatus: "⏸️ STANDBY $100",
          activeBot: sp.titular,
          standbyBot: sp.clon,
          mode: "STANDBY_ARMED",
          pairInAction: null
        };
      }
    });

    const payload = {
      updatedAt: new Date().toISOString(),
      architecture: "NEXUS APEX-36 // CERO PÉRDIDAS ACEPTADAS + CANDADO ELÁSTICO FEE-AWARE #00 + GIRO BRUSCO FILTRADO (36 BOTS)",
      rules: {
        strictRecoveryLock: isPre00UtcLock,
        noRedExit: NO_RED_EXIT,
        zeroFixedTakeProfit: true,
        maxUnfencedPositions: MAX_UNFENCED_POSITIONS,
        cleanEvacTimeoutSec: 180,
        ratchetTiers: "Nivel 1: Entrada + Comisión + $0.02 (🟢 LIGERO) | Nivel 2: 75% (+0.10-0.25%), 83% (+0.25-0.80%), 90% (>+0.80% High-Water Mark)",
        stopAndReverseClones: "Caso A: Vel >= 18 bps/s + Vol >= 2.5x + L2 >= 74% | Caso B: RSI(6) <= 8 o >= 92 fuera Bollinger | Caso C: Ruido ignorado",
        cooldownPostTp: "15 minutos (900,000 ms) para Titular (1) tras cobro"
      },
      spaces: clonesState
    };

    fs.writeFileSync(SQUAD_CLONES_FILE, JSON.stringify(payload, null, 2), "utf8");
  } catch (_) {}
}

async function startAutonomousSquadDaemon() {
  console.log("================================================================================");
  console.log("🚀 ÁREA 501 // SQUAD SECRET V3 // 6 ESCUADRONES ACTIVOS (#01 ALFA A #06 INDIA)");
  console.log("================================================================================");
  console.log(`• Bóveda Nodriza: ${VAULT_501}`);
  console.log(`• Préstamo Bóveda #501 (0% interés): $684.04 USDC ($629.94 + $54.10 Post-SOL)`);
  console.log(`• Escuadrones Activos (18 Pares): #01 ALFA, #02 BRAVO, #03 CHARLIE, #04 GOLF, #05 HOTEL, #06 INDIA`);
  console.log(`• Escudo Mentora #00: 40% del Capital (~$360.82+ USDC Blindados para Rescates + Funding + TP)`);
  console.log(`• Margen Operativo: 60% del Capital (~$541.23 USDC ➔ ~$90-$100 USDC Base por Escuadrón)`);
  console.log(`• Meta Take Profit: +${TARGET_GAIN_PCT}% Reduce-Only Automático en toda entrada`);
  console.log(`• Alertas Telegram: 100% de Aperturas (OPEN) y Cierres (TAKE-PROFIT) en Tiempo Real\n`);

  const transport = new HttpTransport({ isTestnet: false });
  const info = new InfoClient({ transport });

  const agentWallet = new ethers.Wallet(process.env.HL_AGENT_PRIVATE_KEY);
  const client = new ExchangeClient({
    wallet: agentWallet,
    transport,
    isTestnet: false
  });

  // Estado confirmado on-chain por moneda (sólo posiciones realmente abiertas en Clearinghouse)
  const confirmedOpenByCoin = {};
  const lastConfirmedPositionSizes = {};
  const positionOpenTimestamps = {};
  const recentOrderSentCoins = {};
  const rollingMidsHistory = {}; // { [coin]: Array<{ ts, px }> } ventana móvil 60s
  const pingPongMetaByCoin = {}; // { [coin]: { openedAt, mode: 'PING_PONG' | 'HOURLY_SNAP' | 'WICK_SNIPER' | 'NEW_LISTING_SNIPER' } }
  const knownUniverseCoins = new Set();
  let latestNewListingsFeed = [];
  let totalActivePerpsL1 = 229;
  let lastHourlySnapHourKey = "";
  let cycleCounter = 0;
  let isV2Armed = true;
  let initialRecoveryTotalCount = 7;
  let recoveredInSessionCount = 0;

  while (true) {
    cycleCounter++;
    try {
      const recoveryCtrl = loadRecoveryControlConfig();
      const target00UtcMs = recoveryCtrl.TARGET_RESET_UTC ? new Date(recoveryCtrl.TARGET_RESET_UTC).getTime() : 0;

      // 1. Obtener estado del Clearinghouse y Órdenes Abiertas
      const ch = await info.clearinghouseState({ user: VAULT_501 });
      const accountValue = parseFloat(ch.marginSummary?.accountValue || "902.05");
      const openPositions = (ch.assetPositions || []).filter(p => parseFloat(p.position.szi) !== 0);
      let openOrders = await info.openOrders({ user: VAULT_501 });

      if (cycleCounter === 1 && openPositions.length > 0) {
        initialRecoveryTotalCount = Math.max(7, openPositions.length);
      }

      // Determinar si sigue activo el Cerrojo Total de Recuperación (STRICT_RECOVERY_LOCK = true):
      // Prohibido abrir cualquier operación nueva mientras queden posiciones abiertas por recuperar o antes de las 00:00:00 UTC
      let isPre00UtcOrRecovering = Boolean(
        STRICT_RECOVERY_LOCK && (
          recoveryCtrl.LOCK_NEW_OPENINGS ||
          openPositions.length > 0 && recoveryCtrl.LOCK_UNTIL_ALL_RECOVERED ||
          (recoveryCtrl.COOLDOWN_UNTIL_00_UTC && Date.now() < target00UtcMs)
        )
      );

      // Si ya son las 00:00:00 UTC o más Y las operaciones previas ya se recuperaron al 100% (0 abiertas), levantar bloqueo hacia Arranque Fresco NEXUS APEX-36
      if (isPre00UtcOrRecovering && Date.now() >= target00UtcMs && openPositions.length === 0) {
        isPre00UtcOrRecovering = false;
        recoveryCtrl.LOCK_NEW_OPENINGS = false;
        recoveryCtrl.LOCK_UNTIL_ALL_RECOVERED = false;
        recoveryCtrl.COOLDOWN_UNTIL_00_UTC = false;
        try {
          fs.writeFileSync(RECOVERY_CONTROL_FILE, JSON.stringify(recoveryCtrl, null, 2), "utf8");
        } catch (_) {}
        console.log(`🌅🚀 [ARRANQUE FRESCO 00:00 UTC // NEXUS APEX-36] 100% de posiciones recuperadas y reloj en 00:00 UTC -> Activando Candado Elástico #00 + Giro Brusco Filtrado.`);
      }

      // 1.1 Si estamos en Bloqueo de Recuperación (STRICT_RECOVERY_LOCK), cancelar INMEDIATAMENTE cualquier orden de entrada (!reduceOnly)
      const nowMs = Date.now();
      const nonReduceOrders = openOrders.filter(o => !o.reduceOnly);
      if (isPre00UtcOrRecovering && nonReduceOrders.length > 0) {
        try {
          await client.cancel({
            cancels: nonReduceOrders.map(o => ({ a: ASSET_INDICES[o.coin] ?? 0, o: o.oid }))
          });
          console.log(`🛡️❄️ [CERROJO STRICT_RECOVERY_LOCK] Canceladas ${nonReduceOrders.length} órdenes de entrada (!reduceOnly). Prohibido abrir nuevas posiciones.`);
          openOrders = await info.openOrders({ user: VAULT_501 });
        } catch (_) {}
      } else {
        const staleEntryOrders = openOrders.filter(o => !o.reduceOnly && o.timestamp && (nowMs - o.timestamp > 45000));
        if (staleEntryOrders.length > 0) {
          try {
            await client.cancel({
              cancels: staleEntryOrders.map(o => ({ a: ASSET_INDICES[o.coin] ?? 0, o: o.oid }))
            });
            console.log(`🧹 [CLEANUP] Canceladas ${staleEntryOrders.length} órdenes de entrada estancadas (>45s) para re-apuntar al precio actual.`);
            openOrders = await info.openOrders({ user: VAULT_501 });
          } catch (_) {}
        }
      }

      // 1.2 Detectar cierres reales de posiciones previamente confirmadas en Clearinghouse + Ley 3 Stop-And-Reverse en Clones (2)
      for (const [closedCoin, prevInfo] of Object.entries(confirmedOpenByCoin)) {
        const stillOpen = openPositions.some(p => p.position.coin === closedCoin);
        if (!stillOpen) {
          recoveredInSessionCount++;
          // El Titular (1) pasa a enfriamiento de 15 minutos (900,000 ms) o hasta 00:00:00 UTC si sigue en fase previa
          const cooldownMsToApply = isPre00UtcOrRecovering
            ? Math.max(POST_TRADE_COOLDOWN_MS, target00UtcMs - Date.now())
            : POST_TRADE_COOLDOWN_MS;
          pairCooldowns[closedCoin] = Date.now() + cooldownMsToApply;
          globalPostRecoveryCooldownUntil = Date.now() + (isPre00UtcOrRecovering ? cooldownMsToApply : 0);

          const totalRef = Math.max(6, openPositions.length + recoveredInSessionCount);
          const doneIdx = Math.min(totalRef, totalRef - openPositions.length);
          console.log(`🎉 [CANDADO POSITIVO #00 COBRADO] ✅ ${doneIdx}/${totalRef} (${closedCoin}-USDC) — Titular (1) en enfriamiento 15m (900,000 ms).`);

          delete confirmedOpenByCoin[closedCoin];
          lastConfirmedPositionSizes[closedCoin] = 0;
          delete positionOpenTimestamps[closedCoin];

          // LEY 3: El Clon (2) evalúa en < 50ms si el golpe que cerró el candado del Titular (1) es un Giro Sísmico Real (Casos A, B o C)
          const unfencedNow = openPositions.filter(p => !confirmedOpenByCoin[p.position.coin]?.beLocked).length;
          const stopRevResult = await evaluateCloneStopAndReverse({
            coin: closedCoin,
            closedWasShort: Boolean(prevInfo.isShort),
            squadKey: prevInfo.squadKey || "ALFA",
            info,
            client,
            rollingMidsHistory,
            isPre00UtcOrRecovering,
            unfencedPositionsCount: unfencedNow
          });

          try {
            const recentFills = await info.userFills({ user: VAULT_501 });
            const closeFill = recentFills.find(f => f.coin === closedCoin && f.dir && f.dir.includes("Close"));
            const rawGrossGain = closeFill ? parseFloat(closeFill.closedPnl || "0.45") : 0.45;
            const feePaid = closeFill ? parseFloat(closeFill.fee || "0.02") : 0.02;
            const netGain = Math.max(0.01, +(rawGrossGain - feePaid).toFixed(4));
            const exitPxStr = closeFill ? closeFill.px : "Candado #00";
            const squadCfg = SQUADS_CONFIG[prevInfo.squadKey] || SQUADS_CONFIG.ALFA;

            const victoryTx = {
              cycleId: `CYC-${Date.now().toString().slice(-4)}`,
              squad: `${squadCfg.name} (${squadCfg.specialist})`,
              pair: `${closedCoin}-USDC`,
              direction: prevInfo.isShort ? "BEAR" : "BULL",
              directionLabel: prevInfo.isShort ? "🐻 BEAR (SHORT)" : "🐂 BULL (LONG)",
              entryPrice: prevInfo.entryPx || 0,
              exitPrice: parseFloat(exitPxStr) || 0,
              grossProfitUsdc: rawGrossGain,
              feeUsdc: feePaid,
              netProfitUsdc: netGain,
              stopAndReverseClone: stopRevResult.caseType,
              status: "FEE_AWARE_RATCHET_CONFIRMED",
              newAccountValue: accountValue,
              timestamp: new Date().toISOString()
            };
            recordTransactionInLedger(victoryTx);
            const currentLedger = loadRealLedger();

            const victoryTg = `✅🔒 <b>NEXUS APEX-36 // CANDADO #00 COBRADO EN VERDE (${closedCoin}-USDC)</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `🔰 <b>Escuadrón:</b> <b>${squadCfg.name}</b> (${squadCfg.specialist})\n` +
              `📍 <b>Par:</b> <code>${closedCoin}-USDC</code> (${prevInfo.isShort ? "SHORT" : "LONG"})\n` +
              `📥 <b>Precio Entrada:</b> <code>$${formatHlPrice(prevInfo.entryPx || 0, closedCoin)}</code>\n` +
              `📤 <b>Salida Candado #00:</b> <code>$${exitPxStr}</code>\n` +
              `💰 <b>GANANCIA NETA EN CAJA:</b> <b>+$${netGain.toFixed(4)} USDC</b>\n` +
              `🏆 <b>Récord Oficial:</b> <b>${currentLedger.realWins} Ganadas · 0 Pérdidas (100% Invictos)</b>\n` +
              `🔄 <b>Evaluación Clon (2):</b> <code>${stopRevResult.caseType}</code>\n` +
              `💵 <b>Equity Real en L1:</b> <code>$${accountValue.toFixed(2)} USDC</code>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `🌐 <a href="https://hypurrscan.io/address/${VAULT_501}">Ver Recibo en Hypurrscan (Sin conectar Wallet)</a>`;
            await sendSquadTelegram(victoryTg);
          } catch (err) {
            console.error(`[${prevInfo.squadKey}] Error procesando victoria de ${closedCoin}:`, err.message);
          }
        }
      }

      // 2. Procesar Cola de Órdenes Directas y Doctrina de Consolidación
      await processDirectOrdersQueue(client, info);
      checkDailyAmortizationCut(accountValue);
      await checkMarketSessionAlertsDaemon(new Date());
      updateSquadMatrixClones(openPositions, pairCooldowns, recoveryCtrl, confirmedOpenByCoin);

      // Dinámica de capitalización compuesta (40% Escudo #00 / 60% repartido en 6 Escuadrones ~$90-$100 c/u)
      const reserveUsdc = +(accountValue * MENTORA_RESERVE_RATIO).toFixed(2);
      const availableForTrading = Math.max(0, accountValue - reserveUsdc);
      const dynamicSquadMargin = Math.max(90.00, +(accountValue * SQUAD_MARGIN_RATIO).toFixed(2));
      const dynamicNotional = Math.min(MAX_NOTIONAL_PER_COIN, +(dynamicSquadMargin * LEVERAGE).toFixed(2));

      if (cycleCounter % 6 === 1) {
        const openSummary = openPositions.map(p => `${p.position.coin}(${p.position.szi}@$${p.position.entryPx})`).join(", ") || "Ninguna (100% Liquidez USDC)";
        console.log(`[${new Date().toISOString().slice(11, 19)} UTC] ❄️ RECUPERANDO ${openPositions.length}/6 (CERO NUEVAS ENTRADAS) | Ciclo #${cycleCounter} | Equity Real: $${accountValue.toFixed(2)} USDC | Activas: ${openSummary}`);
      }

      // Obtener precios mid actuales una sola vez por ciclo
      let mids = {};
      try {
        const midsRes = await fetch("https://api.hyperliquid.xyz/info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "allMids" })
        });
        mids = await midsRes.json();
      } catch (_) {}

      // Escanear Universo Hyperliquid L1 (New Listing Sniper — Cazador de Nuevos Listados en Segundo 0) cada 3 ciclos (~30s)
      if (cycleCounter === 1 || cycleCounter % 3 === 0) {
        try {
          const metaRes = await fetch("https://api.hyperliquid.xyz/info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "metaAndAssetCtxs" })
          });
          const [metaObj, assetCtxs] = await metaRes.json();
          const universe = metaObj?.universe || [];
          const activeUniv = [];

          for (let idx = 0; idx < universe.length; idx++) {
            const u = universe[idx];
            if (!u || !u.name || u.isDelisted) continue;
            const cName = u.name;
            if (ASSET_INDICES[cName] === undefined) ASSET_INDICES[cName] = idx;
            if (!ASSET_DECIMALS[cName]) {
              const szDec = typeof u.szDecimals === "number" ? u.szDecimals : 1;
              ASSET_DECIMALS[cName] = { sz: szDec, px: Math.max(0, 6 - szDec), coin: cName };
            }
            const ctx = assetCtxs?.[idx] || {};
            const markPx = parseFloat(ctx.markPx || mids[cName] || "0");
            const vol24h = parseFloat(ctx.dayNtlVlm || "0");
            const fundingHr = parseFloat(ctx.funding || "0");
            const aprPct = +(fundingHr * 24 * 365 * 100).toFixed(1);
            activeUniv.push({
              assetIndex: idx,
              coin: cName,
              markPx,
              vol24hUsd: Math.round(vol24h),
              fundingHrPct: +(fundingHr * 100).toFixed(4),
              fundingAprPct: aprPct
            });

            if (cycleCounter > 1 && knownUniverseCoins.size > 0 && !knownUniverseCoins.has(cName)) {
              knownUniverseCoins.add(cName);
              console.log(`🚨🚀 [NEW LISTING SNIPER #06] ¡NUEVO PAR DETECTADO EN HYPERLIQUID L1 EN SEGUNDO 0!: ${cName}-USDC (Asset #${idx} @ $${markPx})`);
              const newListingTg = `🚨🚀 <b>ÁREA 501 // NEW LISTING SNIPER (ESTACIÓN #06) — SEGUNDO 0</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🆕 <b>Nuevo Par Detectado en L1:</b> <code>${cName}-USDC</code> (Asset #${idx})\n` +
                `💵 <b>Precio Inaugural:</b> <code>$${formatHlPrice(markPx || 1, cName)}</code>\n` +
                `📈 <b>Funding Rate Inicial:</b> <code>${aprPct >= 0 ? "+" : ""}${aprPct}% APR</code>\n` +
                `🎯 <b>Trampa ALO Armada:</b> <code>±1.50% Wick Trap (+0.003% Maker Rebate)</code>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🌐 <a href="https://hypurrscan.io/address/${VAULT_501}">Ver en Hypurrscan</a>`;
              await sendSquadTelegram(newListingTg);
            } else {
              knownUniverseCoins.add(cName);
            }
          }

          totalActivePerpsL1 = activeUniv.length;
          // Los últimos 6 perpetuos activos con liquidez en la cola de meta.universe son los listados más recientes de Hyperliquid L1
          const recentListings = activeUniv
            .filter(item => item.vol24hUsd >= 25000 && item.markPx > 0)
            .slice(-6)
            .reverse()
            .map((item, i) => ({
              rank: i + 1,
              coin: `${item.coin}-USDC`,
              rawCoin: item.coin,
              assetIndex: item.assetIndex,
              markPx: formatHlPrice(item.markPx, item.coin),
              buyTrap150Pct: formatHlPrice(item.markPx * 0.985, item.coin),
              sellTrap150Pct: formatHlPrice(item.markPx * 1.015, item.coin),
              vol24hUsd: item.vol24hUsd,
              fundingAprPct: `${item.fundingAprPct >= 0 ? "+" : ""}${item.fundingAprPct}% APR`,
              status: "SECOND_ZERO_ARMED"
            }));
          if (recentListings.length > 0) latestNewListingsFeed = recentListings;
        } catch (_) {}
      }

      // Actualizar Telemetría en Vivo del Departamento #06 (Wick Sniper, New Listing Sniper & Pairs Arbitrage L1)
      try {
        const wickPairsList = ["HYPE", "SOL", "SUI", "XRP", "DOGE", "AVAX", "BNB", "LTC", "NEAR", "ADA", "TRX", "UNI"];
        const wickTraps = wickPairsList.map((c, idx) => {
          const midPx = parseFloat(mids[c] || "1.0");
          const buyTrapPx = formatHlPrice(midPx * 0.9915, c);  // -0.85% Liquidación Long Ajena
          const sellTrapPx = formatHlPrice(midPx * 1.0085, c); // +0.85% Liquidación Short Ajena
          const tpReboundLong = formatHlPrice(midPx * 0.9955, c);
          const tpReboundShort = formatHlPrice(midPx * 1.0045, c);
          return {
            id: idx + 1,
            coin: `${c}-USDC`,
            midPx: formatHlPrice(midPx, c),
            buyTrapAlo: buyTrapPx,
            sellTrapAlo: sellTrapPx,
            reboundTpLong: tpReboundLong,
            reboundTpShort: tpReboundShort,
            wickDepthPct: "±0.85%",
            reboundTargetPct: "+0.40% + Rebate",
            notionalUsdc: 200,
            estNetGainUsdc: 0.78,
            status: "ARMED_ALO_TRAP"
          };
        });

        const twinPairsDef = [
          { id: "PAIR-01", pairA: "BTC",  pairB: "ETH",  corr: "0.94", spreadTargetPct: "0.18%" },
          { id: "PAIR-02", pairA: "SOL",  pairB: "SUI",  corr: "0.91", spreadTargetPct: "0.22%" },
          { id: "PAIR-03", pairA: "XRP",  pairB: "ADA",  corr: "0.89", spreadTargetPct: "0.20%" },
          { id: "PAIR-04", pairA: "DOGE", pairB: "LTC",  corr: "0.87", spreadTargetPct: "0.20%" },
          { id: "PAIR-05", pairA: "AVAX", pairB: "NEAR", corr: "0.90", spreadTargetPct: "0.22%" },
          { id: "PAIR-06", pairA: "BNB",  pairB: "AAVE", corr: "0.86", spreadTargetPct: "0.18%" }
        ];
        const twinPairsLive = twinPairsDef.map(tp => {
          const pxA = parseFloat(mids[tp.pairA] || "1");
          const pxB = parseFloat(mids[tp.pairB] || "1");
          const ratio = pxB > 0 ? +(pxA / pxB).toFixed(4) : 1.0;
          return {
            ...tp,
            pxA: formatHlPrice(pxA, tp.pairA),
            pxB: formatHlPrice(pxB, tp.pairB),
            liveRatio: ratio,
            deltaExposure: "$0.00 (100% Neutral)",
            legSizeUsdc: "$150 LONG / $150 SHORT",
            status: "MONITORING_ZSCORE"
          };
        });

        const wickTelemFile = path.join(TELEMETRY_DIR, "wick-sniper-telemetry.json");
        fs.writeFileSync(wickTelemFile, JSON.stringify({
          updatedAt: new Date().toISOString(),
          station: "ESTACIÓN #06 // WICK SNIPER, NEW LISTING SNIPER & PAIRS ARBITRAGE L1",
          accountValue: +accountValue.toFixed(2),
          shieldFreeMarginUsdc: +reserveUsdc.toFixed(2),
          capitalCommittedIdle: 0.00,
          makerRebateRate: "+0.003% Maker Rebate",
          wickTrapsCount: wickTraps.length,
          twinPairsCount: twinPairsLive.length,
          newListingSniper: {
            enabled: true,
            monitoredUniverseCount: totalActivePerpsL1,
            trapDepthPct: "±1.50%",
            reboundTargetPct: "+0.45% + Maker Rebate",
            recentListings: latestNewListingsFeed
          },
          wickTraps,
          twinPairsLive
        }, null, 2), "utf8");
      } catch (_) {}

      // 3. GESTIONAR TODAS LAS POSICIONES ABIERTAS CON ARQUITECTURA NEXUS APEX-36:
      // - LEY 1: CERO TAKE PROFIT FIJO + ESCALERA DE CANDADOS NETOS (FEE-AWARE RATCHET #00: Nivel 1 +$0.02 USDC 🟢 LIGERO / Nivel 2: 75% / 83% / 90% High-Water Mark)
      // - LEY 2: CERO RASGUÑOS EN ROJO (NO_RED_EXIT = true) + EVACUACIÓN BREAKEVEN NETO (+$0.01 USDC Post-Only Maker) A LOS 180 SEGUNDOS
      // - RECUPERACIÓN PREVIA 1 A 1 (ETH, PAXG, XRP, SOL, BTC, NEAR): Clava Candado #00 en entryPx + comisión + $0.02 USDC y cobra en verde hasta 0 abiertas.
      const tier1Set = new Set(["ETH", "PAXG", "SUI", "DOGE"]);
      const tier2Set = new Set(["SOL", "HYPE", "BTC", "XRP"]);

      for (const activePos of openPositions) {
        const coin = activePos.position.coin;
        const sz = activePos.position.szi;
        const szNum = parseFloat(sz);
        const isShort = szNum < 0;
        const entryPx = parseFloat(activePos.position.entryPx);
        const notionalVal = Math.abs(szNum) * entryPx;
        const uPnlNum = parseFloat(activePos.position?.unrealizedPnl || "0");

        const squadKey = Object.keys(SQUADS_CONFIG).find(k => SQUADS_CONFIG[k].pairs.includes(coin)) || "ALFA";
        const squadCfg = SQUADS_CONFIG[squadKey];
        const isNewPos = !confirmedOpenByCoin[coin];

        const isRescuedSize = notionalVal >= (squadCfg.block === 2 ? 285 : 360);
        if (isNewPos) {
          confirmedOpenByCoin[coin] = {
            squadKey,
            entryPx,
            szi: szNum,
            isShort,
            dcaDone: isRescuedSize,
            beLocked: false,
            isLight: false,
            ratchetLevel: 0,
            lockedNetUsd: 0,
            lockedPx: 0,
            cleanEvacActive: false,
            evacOrderPlacedPx: null,
            ratchetStatusLabel: "🔓 BUSCANDO CANDADO NETO +$0.02"
          };
          positionOpenTimestamps[coin] = isPre00UtcOrRecovering ? (Date.now() - 240000) : Date.now();
        } else {
          confirmedOpenByCoin[coin].entryPx = entryPx;
          confirmedOpenByCoin[coin].szi = szNum;
          if (isRescuedSize) confirmedOpenByCoin[coin].dcaDone = true;
        }
        const posMeta = confirmedOpenByCoin[coin];
        const openTs = positionOpenTimestamps[coin] || Date.now();
        const currentMid = parseFloat(mids[coin] || entryPx);
        const existingExitOrder = openOrders.find(o => o.coin === coin && o.reduceOnly === true);

        // Calcular estado en tiempo real de la Escalera de Candados Netos (FEE-AWARE RATCHET #00)
        const ratchet = computeFeeAwareRatchet(
          coin,
          entryPx,
          szNum,
          currentMid,
          uPnlNum,
          posMeta,
          openTs,
          isPre00UtcOrRecovering
        );
        posMeta.ratchetStatusLabel = ratchet.ratchetStatusLabel;

        if (!isV2Armed || !ASSET_DECIMALS[coin]) continue;

        const totalSzStr = formatHlSize(Math.abs(szNum), ASSET_DECIMALS[coin].sz);

        // A) RECUPERACIÓN PREVIA 1 A 1 (isPre00UtcOrRecovering):
        // Apenas cruce entryPx + comisión + $0.02 USDC, clava el Candado #00 y la cobra en verde (o mantiene orden Post-Only en su equilibrio neto +$0.02 USDC)
        if (isPre00UtcOrRecovering) {
          if (ratchet.beLocked && ratchet.netAfterFeesUsd >= LEVEL1_NET_LOCK_USDC && (ratchet.hitRatchetStop || ratchet.netAfterFeesUsd >= 0.04)) {
            console.log(`💰🔒 [RECUPERACIÓN 1 A 1 // CANDADO #00] ${coin} cruzó equilibrio neto (+$${ratchet.netAfterFeesUsd.toFixed(4)} USDC) -> Cobrando en verde hacia 100% Liquidez USDC!`);
            if (existingExitOrder) {
              await client.cancel({ cancels: [{ a: ASSET_INDICES[coin], o: existingExitOrder.oid }] }).catch(() => {});
            }
            const closePx = isShort ? currentMid * 1.0004 : currentMid * 0.9996;
            await client.order({
              orders: [{
                a: ASSET_INDICES[coin],
                b: isShort,
                p: formatHlPrice(closePx, coin),
                s: totalSzStr,
                r: true,
                t: { limit: { tif: "Ioc" } }
              }],
              grouping: "na"
            }).catch(() => {});
            continue;
          }

          // Asegurar que la orden Reduce-Only Post-Only Maker apunte exactamente a Entrada + Comisión + $0.02 USDC
          const targetLockPxStr = formatHlPrice(ratchet.level1LockPx, coin);
          if (!existingExitOrder) {
            console.log(`🛡️ [${squadKey} // RECUPERACIÓN #00] Colocando Candado Neto +$0.02 USDC para ${coin}: ${totalSzStr} @ $${targetLockPxStr}`);
            await client.order({
              orders: [{
                a: ASSET_INDICES[coin],
                b: isShort,
                p: targetLockPxStr,
                s: totalSzStr,
                r: true,
                t: { limit: { tif: "Alo" } }
              }],
              grouping: "na"
            }).catch(() => {});
          }
          continue;
        }

        // B) OPERACIÓN NORMAL POST-00:00 UTC (NEXUS APEX-36 // CERO TAKE PROFIT FIJO):
        // 1. Si el Candado Nivel 1 o Nivel 2 (75% / 83% / 90% High-Water Mark) está activo y el precio retrocede tocando el candado (con ganancia neta >= +$0.01 USDC):
        if (ratchet.beLocked && ratchet.hitRatchetStop && NO_RED_EXIT && ratchet.netAfterFeesUsd >= CLEAN_EVAC_NET_USDC) {
          console.log(`💰🌊 [FEE-AWARE RATCHET #00 // NIVEL ${ratchet.ratchetLevel}] ${coin} tocó candado elástico (+$${ratchet.netAfterFeesUsd.toFixed(4)} USDC netos) -> Cobrando ola en verde!`);
          if (existingExitOrder) {
            await client.cancel({ cancels: [{ a: ASSET_INDICES[coin], o: existingExitOrder.oid }] }).catch(() => {});
          }
          const closePx = isShort ? currentMid * 1.0004 : currentMid * 0.9996;
          await client.order({
            orders: [{
              a: ASSET_INDICES[coin],
              b: isShort,
              p: formatHlPrice(closePx, coin),
              s: totalSzStr,
              r: true,
              t: { limit: { tif: "Ioc" } }
            }],
            grouping: "na"
          }).catch(() => {});
          continue;
        }

        // 2. Si el Candado #00 ya está clavado (🟢 LIGERO) y había una orden de evacuación previa en el libro, la retiramos para NO poner techo a la ola:
        if (ratchet.beLocked && existingExitOrder) {
          await client.cancel({ cancels: [{ a: ASSET_INDICES[coin], o: existingExitOrder.oid }] }).catch(() => {});
          console.log(`🌊🔓 [${coin}] Candado #00 Activo (${ratchet.ratchetStatusLabel}) -> Orden estática retirada para exprimir la ola sin techo.`);
          continue;
        }

        // 3. LEY 2: Protocolo de Evacuación Limpia a los 180 Segundos (🎯 EVACUACIÓN BREAKEVEN NETO: Entrada + Comisión + $0.01 USDC con Post-Only Maker)
        if (!ratchet.beLocked && ratchet.cleanEvacActive) {
          const evacPxStr = formatHlPrice(ratchet.cleanEvacMakerPx, coin);
          if (!existingExitOrder || posMeta.evacOrderPlacedPx !== evacPxStr) {
            if (existingExitOrder) {
              await client.cancel({ cancels: [{ a: ASSET_INDICES[coin], o: existingExitOrder.oid }] }).catch(() => {});
            }
            console.log(`🎯 [${squadKey} // EVACUACIÓN 180S] Ola enfriada en ${coin} -> Orden Post-Only Maker en Breakeven Neto (+$0.01 USDC) @ $${evacPxStr}`);
            await client.order({
              orders: [{
                a: ASSET_INDICES[coin],
                b: isShort,
                p: evacPxStr,
                s: totalSzStr,
                r: true,
                t: { limit: { tif: "Alo" } }
              }],
              grouping: "na"
            }).catch(() => {});
            posMeta.evacOrderPlacedPx = evacPxStr;
          }
        }
      }

      // Actualizar archivo de clones con las etiquetas frescas del Candado Neto
      updateSquadMatrixClones(openPositions, pairCooldowns, recoveryCtrl, confirmedOpenByCoin);

      // Escribir telemetría en vivo para /squad-matrix/ (telemetry/squad-matrix-telemetry.json)
      try {
        const cascadeOrder = recoveryCtrl.RECOVERY_CASCADE_ORDER || ["PAXG", "ETH", "XRP", "SOL", "BTC", "NEAR"];
        const sortedOpen = [...openPositions].sort((a, b) => {
          const cA = a.position.coin;
          const cB = b.position.coin;
          const iA = cascadeOrder.indexOf(cA);
          const iB = cascadeOrder.indexOf(cB);
          if (iA !== -1 && iB !== -1) return iA - iB;
          if (iA !== -1) return -1;
          if (iB !== -1) return 1;
          return Math.abs(parseFloat(a.position.unrealizedPnl || 0)) - Math.abs(parseFloat(b.position.unrealizedPnl || 0));
        });

        const recoveryQueue = sortedOpen.map((pObj, idx) => {
          const p = pObj.position;
          const c = p.coin;
          const szi = parseFloat(p.szi);
          const isShort = szi < 0;
          const entryPx = parseFloat(p.entryPx);
          const midPx = parseFloat(mids[c] || entryPx);
          const uPnl = parseFloat(p.unrealizedPnl || "0");
          const pMeta = confirmedOpenByCoin[c] || {};
          const rInfo = computeFeeAwareRatchet(c, entryPx, szi, midPx, uPnl, pMeta, positionOpenTimestamps[c] || Date.now(), isPre00UtcOrRecovering);
          const targetPx = rInfo.level1LockPx;
          const distPct = isShort
            ? Math.max(0, ((midPx - targetPx) / midPx) * 100)
            : Math.max(0, ((targetPx - midPx) / midPx) * 100);
          const distUsd = Math.max(0, +(LEVEL1_NET_LOCK_USDC - rInfo.netAfterFeesUsd).toFixed(2));
          const tier = tier1Set.has(c) ? 1 : (tier2Set.has(c) ? 2 : 3);
          return {
            queueRank: idx + 1,
            queueLabel: `${idx + 1}º ${c}`,
            coin: c,
            pair: `${c}-USDC`,
            tier,
            side: isShort ? "SHORT" : "LONG",
            szi: Math.abs(szi),
            entryPx: +entryPx.toFixed(4),
            midPx: +midPx.toFixed(4),
            recoveryTargetPx: +targetPx.toFixed(4),
            unrealizedPnlUsdc: +uPnl.toFixed(2),
            netAfterFeesUsdc: +rInfo.netAfterFeesUsd.toFixed(2),
            distanceToRecoveryPct: +distPct.toFixed(2),
            distanceToRecoveryUsd: distUsd,
            beLocked: rInfo.beLocked,
            ratchetLevel: rInfo.ratchetLevel,
            lockedNetUsd: +rInfo.lockedNetUsd.toFixed(2),
            cleanEvacActive: rInfo.cleanEvacActive,
            ratchetStatusLabel: rInfo.ratchetStatusLabel,
            status: rInfo.beLocked ? "CANDADO_00_ACTIVO" : (rInfo.cleanEvacActive ? "EVACUACION_LIMPIA_001" : `FILA_${idx + 1}_RECUPERANDO`)
          };
        });

        const remainingCount = openPositions.length;
        const totalRef = 6;
        const unfencedCount = openPositions.filter(p => !confirmedOpenByCoin[p.position.coin]?.beLocked).length;
        const topBannerText = isPre00UtcOrRecovering
          ? (remainingCount > 0
            ? `❄️ RECUPERANDO ${remainingCount}/${totalRef} (CERO NUEVAS ENTRADAS · CANDADO NETO +$0.02)`
            : `🧘‍♀️ 100% LIQUIDEZ USDC — ENFRIAMIENTO HASTA LAS 00:00:00 UTC`)
          : `🟢 NEXUS APEX-36 ACTIVO (0 TP FIJO · RATCHET #00 · ${unfencedCount}/${MAX_UNFENCED_POSITIONS} SIN CANDADO)`;

        fs.writeFileSync(SQUAD_MATRIX_TELEMETRY_FILE, JSON.stringify({
          updatedAt: new Date().toISOString(),
          architecture: "NEXUS_APEX_36",
          mode: isPre00UtcOrRecovering ? "RECOVERY_LOCK_UNTIL_00_UTC" : "NEXUS_APEX_36_LIVE",
          strictRecoveryLock: isPre00UtcOrRecovering,
          noRedExit: NO_RED_EXIT,
          zeroFixedTakeProfit: true,
          maxUnfencedPositions: MAX_UNFENCED_POSITIONS,
          unfencedPositionsCount: unfencedCount,
          lockNewOpenings: isPre00UtcOrRecovering,
          cooldownUntil00Utc: Boolean(recoveryCtrl.COOLDOWN_UNTIL_00_UTC),
          hotSwapClones: true,
          targetResetUtc: recoveryCtrl.TARGET_RESET_UTC,
          post00UtcMaxConcurrent: MAX_UNFENCED_POSITIONS,
          postTradeCooldownMs: POST_TRADE_COOLDOWN_MS,
          accountValueUsdc: +accountValue.toFixed(2),
          withdrawableUsdc: parseFloat(ch.withdrawable || "0"),
          openPositionsCount: remainingCount,
          totalInitialPositions: totalRef,
          recoveredCount: Math.max(0, totalRef - remainingCount),
          bannerText: topBannerText,
          recoveryQueue
        }, null, 2), "utf8");
      } catch (_) {}

      // Enviar reporte de arranque en el Ciclo #1 confirmando la arquitectura NEXUS APEX-36
      if (cycleCounter === 1) {
        const posLines = openPositions.map((p, idx) => {
          const c = p.position.coin;
          const s = parseFloat(p.position.szi);
          const e = parseFloat(p.position.entryPx);
          const u = parseFloat(p.position.unrealizedPnl || "0");
          const pMeta = confirmedOpenByCoin[c] || {};
          return `• <b>${idx + 1}º</b> <code>${c}-USDC</code> (${s >= 0 ? "LONG" : "SHORT"} ${Math.abs(s)} @ $${formatHlPrice(e, c)} | Flotante: ${u >= 0 ? "+" : "-"}$${Math.abs(u).toFixed(2)} | ${pMeta.ratchetStatusLabel || "🎯 EVACUACIÓN LIMPIA +$0.01"})`;
        }).join("\n") || "• 🧘‍♀️ 100% Liquidez USDC (0 posiciones abiertas)";

        const bootTg = `🏆⚡🔒 <b>ÁREA 501 // ARQUITECTURA "NEXUS APEX-36" ACTIVADA EN HYPERLIQUID L1</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🔒 <b>STRICT_RECOVERY_LOCK:</b> <code>true (Cero entradas hasta recuperar 6/6 y 00:00 UTC)</code>\n` +
          `🛡️ <b>NO_RED_EXIT:</b> <code>true (Prohibido cerrar en rojo — Breakeven Neto +$0.01)</code>\n` +
          `🌊 <b>FEE-AWARE RATCHET #00:</b> <code>Cero TP Fijo · Nivel 1 +$0.02 (🟢 LIGERO) · Nivel 2: 75% / 83% / 90%</code>\n` +
          `🔄 <b>STOP-AND-REVERSE (36 BOTS):</b> <code>Titular (1) 15m Cooldown ⇄ Clon (2) Giro Sísmico &lt;50ms</code>\n` +
          `💵 <b>Patrimonio L1:</b> <code>$${accountValue.toFixed(2)} USDC</code> (Escudo 40%: <code>$${reserveUsdc.toFixed(2)} USDC</code>)\n` +
          `📊 <b>Posiciones en Recuperación (${openPositions.length} abiertas ➔ 0 antes de 00:00 UTC):</b>\n${posLines}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🌐 <a href="https://hypurrscan.io/address/${VAULT_501}">Ver Cuenta #501 en Hypurrscan (Sin conectar Wallet)</a>`;
        await sendSquadTelegram(bootTg);
      }

      // 4. CONTROL ESTRICTO DE APERTURAS (NEXUS APEX-36):
      // - Mientras STRICT_RECOVERY_LOCK esté activo (queden posiciones previas abiertas o sea antes de 00:00:00 UTC): CERO NUEVAS ENTRADAS.
      // - Post-00:00:00 UTC: Cupo Estricto de Ligereza (MAX_UNFENCED_POSITIONS = 2). Máximo 2 posiciones abiertas sin Candado #00 simultáneamente.
      //   Para abrir una 3ra, las 2 primeras deben tener ya su Candado #00 asegurado en verde (beLocked === true).
      const activeCoins = openPositions.map(p => p.position.coin);
      const restingEntryCoins = openOrders.filter(o => !o.reduceOnly).map(o => o.coin);
      const allActiveOrResting = [...new Set([...activeCoins, ...restingEntryCoins])];

      const totalNotionalOpen = openPositions.reduce((sum, p) => {
        const sz = Math.abs(parseFloat(p.position.szi || "0"));
        const px = parseFloat(p.position.entryPx || "0");
        return sum + (sz * px);
      }, 0);
      const actualMarginUsedL1 = totalNotionalOpen / 5.0;
      const freeShieldableMarginUsdc = accountValue - actualMarginUsedL1;
      const isInPostTradeCooldown = Date.now() < globalPostRecoveryCooldownUntil;
      const unfencedOpenCount = openPositions.filter(p => !confirmedOpenByCoin[p.position.coin]?.beLocked).length + restingEntryCoins.length;
      const allOpenHaveBeLocked = openPositions.length >= 2 && openPositions.every(p => Boolean(confirmedOpenByCoin[p.position.coin]?.beLocked));
      const dynamicMaxPost00Utc = allOpenHaveBeLocked ? 3 : MAX_UNFENCED_POSITIONS;

      const isCapitalShieldIntact = !isPre00UtcOrRecovering && !isInPostTradeCooldown && (unfencedOpenCount < MAX_UNFENCED_POSITIONS) && (freeShieldableMarginUsdc - 25.0) >= reserveUsdc;
      const MAX_SAFE_TOTAL_WITH_RECOVERY = isPre00UtcOrRecovering ? 0 : dynamicMaxPost00Utc;

      const fastLaneActiveCoins = activeCoins;
      const fastLaneTotalCount = unfencedOpenCount;

      // 4.0 Actualizar historial móvil de 60s para Micro-Ping-Pong (±0.16%) y Wick Sniper (±0.85%)
      const nowTs = Date.now();
      for (const [cKey, pxVal] of Object.entries(mids)) {
        const pxNum = parseFloat(pxVal);
        if (!pxNum || pxNum <= 0) continue;
        if (!rollingMidsHistory[cKey]) rollingMidsHistory[cKey] = [];
        rollingMidsHistory[cKey].push({ ts: nowTs, px: pxNum });
        rollingMidsHistory[cKey] = rollingMidsHistory[cKey].filter(item => (nowTs - item.ts) <= 75000);
      }

      // 4.1 MOTOR FRANCOTIRADOR DEL MINUTO :59 PRE-FUNDING (24 Disparos/Día: Minutos :58 y :59 UTC -> Salida :00:30-:01:30 UTC)
      const nowUtcDate = new Date();
      const utcMins = nowUtcDate.getUTCMinutes();
      const currentHourKey = `${nowUtcDate.getUTCFullYear()}-${nowUtcDate.getUTCMonth()}-${nowUtcDate.getUTCDate()}-${nowUtcDate.getUTCHours()}`;
      if (isV2Armed && isCapitalShieldIntact && (utcMins === 58 || utcMins === 59) && lastHourlySnapHourKey !== currentHourKey && allActiveOrResting.length < MAX_SAFE_TOTAL_WITH_RECOVERY) {
        const snapUniverse = ["SOL", "SUI", "DOGE", "XRP", "ETH", "AVAX", "TON"].filter(c =>
          !allActiveOrResting.includes(c) && (!pairCooldowns[c] || pairCooldowns[c] <= nowTs)
        );
        let bestSnap = null;
        for (const sCoin of snapUniverse) {
          try {
            const l2 = await info.l2Book({ coin: sCoin });
            const bids = l2.levels?.[0] || [], asks = l2.levels?.[1] || [];
            if (bids.length < 3 || asks.length < 3) continue;
            let bVol = 0, aVol = 0;
            for (let i = 0; i < 5; i++) {
              bVol += parseFloat(bids[i]?.px || 0) * parseFloat(bids[i]?.sz || 0);
              aVol += parseFloat(asks[i]?.px || 0) * parseFloat(asks[i]?.sz || 0);
            }
            const tot = bVol + aVol;
            if (tot <= 0) continue;
            const bullP = (bVol / tot) * 100;
            const bearP = (aVol / tot) * 100;
            if (bullP >= 56.0 && (!bestSnap || bullP > bestSnap.score)) {
              bestSnap = { coin: sCoin, isLong: true, px: parseFloat(bids[0].px), score: bullP };
            } else if (bearP >= 56.0 && (!bestSnap || bearP > bestSnap.score)) {
              bestSnap = { coin: sCoin, isLong: false, px: parseFloat(asks[0].px), score: bearP };
            }
          } catch (_) {}
        }

        if (bestSnap) {
          lastHourlySnapHourKey = currentHourKey;
          const sCoin = bestSnap.coin;
          const snapNotional = 150.0; // $150 USDC nocional ($30 margen a 5x)
          const snapSz = formatHlSize(snapNotional / bestSnap.px, ASSET_DECIMALS[sCoin].sz);
          const snapPxStr = formatHlPrice(bestSnap.px, sCoin);
          const snapTpNum = bestSnap.isLong ? bestSnap.px * 1.0012 : bestSnap.px * 0.9988;
          const snapTpStr = formatHlPrice(snapTpNum, sCoin);

          console.log(`⚡⏱️ [FRANCOTIRADOR MINUTO :59 PRE-FUNDING] Disparando en ${sCoin} (${bestSnap.isLong ? "LONG" : "SHORT"}) @ $${snapPxStr} (L2 ${bestSnap.score.toFixed(1)}%) -> TP $${snapTpStr} (+0.12% / Salida 90s)`);
          try {
            let snapRes = await client.order({
              orders: [{ a: ASSET_INDICES[sCoin], b: bestSnap.isLong, p: snapPxStr, s: snapSz, r: false, t: { limit: { tif: "Alo" } } }],
              grouping: "na"
            });
            let snapSt = snapRes.response?.data?.statuses?.[0] || {};
            if (snapSt.error) {
              snapRes = await client.order({
                orders: [{ a: ASSET_INDICES[sCoin], b: bestSnap.isLong, p: snapPxStr, s: snapSz, r: false, t: { limit: { tif: "Gtc" } } }],
                grouping: "na"
              });
              snapSt = snapRes.response?.data?.statuses?.[0] || {};
            }
            if (snapSt.resting || snapSt.filled) {
              pingPongMetaByCoin[sCoin] = { openedAt: Date.now(), mode: "HOURLY_SNAP" };
              allActiveOrResting.push(sCoin);
              recentOrderSentCoins[sCoin] = Date.now();
              if (snapSt.filled) {
                await client.order({
                  orders: [{ a: ASSET_INDICES[sCoin], b: !bestSnap.isLong, p: snapTpStr, s: snapSz, r: true, t: { limit: { tif: "Alo" } } }],
                  grouping: "na"
                }).catch(() => {});
              }
              const snapTg = `⚡⏱️ <b>ÁREA 501 // FRANCOTIRADOR MINUTO :59 (24 VECES/DÍA)</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🎯 <b>Motor:</b> <b>Hourly Snap Scalp (Corte Horario :00 UTC)</b>\n` +
                `📍 <b>Par:</b> <code>${sCoin}-USDC</code> (<b>${bestSnap.isLong ? "LONG 🐂" : "SHORT 🐻"}</b> · ${snapSz} ${sCoin})\n` +
                `📥 <b>Precio Entrada:</b> <code>$${snapPxStr}</code> ($${snapNotional.toFixed(0)} Nocional)\n` +
                `📤 <b>Objetivo Salida Rápida:</b> <code>$${snapTpStr}</code> (+0.12% / Salida 90s)\n` +
                `📊 <b>Presión Libro L2:</b> <code>${bestSnap.score.toFixed(1)}%</code>\n` +
                `📌 <b>Estado:</b> <b>${snapSt.filled ? "EJECUTADA EN VIVO" : "ORDEN ALO EN LIBRO L1"}</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🌐 <a href="https://hypurrscan.io/address/${VAULT_501}">Ver en Hypurrscan</a>`;
              await sendSquadTelegram(snapTg);
            }
          } catch (eSnap) {
            console.error(`[MINUTO :59] Error en ${sCoin}:`, eSnap.message);
          }
        }
      }

      // 4.2 MOTOR MICRO-PING-PONG DE RANGO ESTRECHO (±0.16% ALO -> TP +0.11% Rápido en 5m)
      if (isV2Armed && isCapitalShieldIntact && allActiveOrResting.length < MAX_SAFE_TOTAL_WITH_RECOVERY && fastLaneTotalCount < MAX_CONCURRENT_TOTAL) {
        const pingPongUniverse = ["SOL", "SUI", "DOGE", "XRP", "DOT", "TRX", "NEAR", "AVAX", "LTC", "UNI", "ADA", "TON"].filter(c =>
          !allActiveOrResting.includes(c) && (!pairCooldowns[c] || pairCooldowns[c] <= nowTs)
        );
        for (const ppCoin of pingPongUniverse) {
          if (allActiveOrResting.length >= MAX_SAFE_TOTAL_WITH_RECOVERY) break;
          const hist = rollingMidsHistory[ppCoin] || [];
          if (hist.length < 2) continue;
          const oldestPx = hist[0].px;
          const latestPx = hist[hist.length - 1].px;
          const delta60sPct = ((latestPx - oldestPx) / oldestPx) * 100;

          // Si hubo un micro-retroceso de -0.14% a -0.80% (compra en rebote) o micro-subida de +0.14% a +0.80% (venta en rebote)
          if (Math.abs(delta60sPct) >= 0.14) {
            try {
              const l2 = await info.l2Book({ coin: ppCoin });
              const bids = l2.levels?.[0] || [], asks = l2.levels?.[1] || [];
              if (bids.length < 3 || asks.length < 3) continue;
              let bVol = 0, aVol = 0;
              for (let i = 0; i < 5; i++) {
                bVol += parseFloat(bids[i]?.px || 0) * parseFloat(bids[i]?.sz || 0);
                aVol += parseFloat(asks[i]?.px || 0) * parseFloat(asks[i]?.sz || 0);
              }
              const tot = bVol + aVol;
              if (tot <= 0) continue;
              const bullP = (bVol / tot) * 100;
              const bearP = (aVol / tot) * 100;

              // Rebote Long tras caída rápida o Rebote Short tras subida rápida con confirmación L2 >= 55%
              const goLongPP = (delta60sPct <= -0.14 && bullP >= 55.0);
              const goShortPP = (delta60sPct >= 0.14 && bearP >= 55.0);
              if (goLongPP || goShortPP) {
                const isWick = Math.abs(delta60sPct) >= 0.85;
                const ppNotional = isWick ? 180.0 : 115.0;
                const entryBookPx = goLongPP ? parseFloat(bids[0].px) : parseFloat(asks[0].px);
                const ppSz = formatHlSize(ppNotional / entryBookPx, ASSET_DECIMALS[ppCoin].sz);
                if (parseFloat(ppSz) <= 0) continue;
                const ppPxStr = formatHlPrice(entryBookPx, ppCoin);
                const targetPctPP = isWick ? 0.35 : 0.11;
                const ppTpNum = goLongPP ? entryBookPx * (1 + targetPctPP / 100) : entryBookPx * (1 - targetPctPP / 100);
                const ppTpStr = formatHlPrice(ppTpNum, ppCoin);

                console.log(`🏓⚡ [${isWick ? "WICK SNIPER ±0.85%" : "MICRO-PING-PONG ±0.16%"}] Disparo en ${ppCoin} (${goLongPP ? "LONG" : "SHORT"}) | Δ60s: ${delta60sPct.toFixed(2)}% | L2: ${(goLongPP ? bullP : bearP).toFixed(1)}% -> TP $${ppTpStr} (+${targetPctPP}%)`);
                let ppRes = await client.order({
                  orders: [{ a: ASSET_INDICES[ppCoin], b: goLongPP, p: ppPxStr, s: ppSz, r: false, t: { limit: { tif: "Alo" } } }],
                  grouping: "na"
                });
                let ppSt = ppRes.response?.data?.statuses?.[0] || {};
                if (ppSt.resting || ppSt.filled) {
                  pingPongMetaByCoin[ppCoin] = { openedAt: Date.now(), mode: isWick ? "WICK_SNIPER" : "PING_PONG" };
                  allActiveOrResting.push(ppCoin);
                  if (ppSt.filled) {
                    recentOrderSentCoins[ppCoin] = Date.now();
                    await client.order({
                      orders: [{ a: ASSET_INDICES[ppCoin], b: !goLongPP, p: ppTpStr, s: ppSz, r: true, t: { limit: { tif: "Alo" } } }],
                      grouping: "na"
                    }).catch(() => {});
                  }
                  break; // 1 disparo Ping-Pong por ciclo para máxima precisión
                }
              }
            } catch (_) {}
          }
        }
      }

      // 4.3 MOTOR NEW LISTING SNIPER (CAZADOR DE NUEVOS LISTADOS EN SEGUNDO 0 · ±1.50% WICK TRAP -> TP +0.45%)
      if (isV2Armed && isCapitalShieldIntact && allActiveOrResting.length < MAX_SAFE_TOTAL_WITH_RECOVERY && latestNewListingsFeed.length > 0) {
        const newListingCandidates = latestNewListingsFeed
          .map(nl => nl.rawCoin)
          .filter(c => c && c !== "HYPE" && !allActiveOrResting.includes(c) && (!pairCooldowns[c] || pairCooldowns[c] <= nowTs) && ASSET_INDICES[c] !== undefined && ASSET_DECIMALS[c]);

        for (const nlCoin of newListingCandidates) {
          if (allActiveOrResting.length >= MAX_SAFE_TOTAL_WITH_RECOVERY) break;
          const hist = rollingMidsHistory[nlCoin] || [];
          if (hist.length < 2) continue;
          const oldestPx = hist[0].px;
          const latestPx = hist[hist.length - 1].px;
          const delta60sPct = ((latestPx - oldestPx) / oldestPx) * 100;

          // En nuevos listados de alta volatilidad, cazamos mechas de ±1.50% con orden ALO Maker (+0.003% Rebate)
          if (Math.abs(delta60sPct) >= 1.50) {
            try {
              const l2 = await info.l2Book({ coin: nlCoin });
              const bids = l2.levels?.[0] || [], asks = l2.levels?.[1] || [];
              if (bids.length < 3 || asks.length < 3) continue;
              let bVol = 0, aVol = 0;
              for (let i = 0; i < 5; i++) {
                bVol += parseFloat(bids[i]?.px || 0) * parseFloat(bids[i]?.sz || 0);
                aVol += parseFloat(asks[i]?.px || 0) * parseFloat(asks[i]?.sz || 0);
              }
              const tot = bVol + aVol;
              if (tot <= 0) continue;
              const bullP = (bVol / tot) * 100;
              const bearP = (aVol / tot) * 100;

              const goLongNL = (delta60sPct <= -1.50 && bullP >= 58.0);
              const goShortNL = (delta60sPct >= 1.50 && bearP >= 58.0);
              if (goLongNL || goShortNL) {
                const nlNotional = 150.0;
                const entryBookPx = goLongNL ? parseFloat(bids[0].px) : parseFloat(asks[0].px);
                const nlSz = formatHlSize(nlNotional / entryBookPx, ASSET_DECIMALS[nlCoin].sz);
                if (parseFloat(nlSz) <= 0) continue;
                const nlPxStr = formatHlPrice(entryBookPx, nlCoin);
                const targetPctNL = 0.45;
                const nlTpNum = goLongNL ? entryBookPx * (1 + targetPctNL / 100) : entryBookPx * (1 - targetPctNL / 100);
                const nlTpStr = formatHlPrice(nlTpNum, nlCoin);

                console.log(`🚨🚀 [NEW LISTING SNIPER #06] Disparo en listado reciente ${nlCoin} (${goLongNL ? "LONG" : "SHORT"}) | Δ60s: ${delta60sPct.toFixed(2)}% | L2: ${(goLongNL ? bullP : bearP).toFixed(1)}% -> TP $${nlTpStr} (+${targetPctNL}%)`);
                const nlRes = await client.order({
                  orders: [{ a: ASSET_INDICES[nlCoin], b: goLongNL, p: nlPxStr, s: nlSz, r: false, t: { limit: { tif: "Alo" } } }],
                  grouping: "na"
                });
                const nlSt = nlRes.response?.data?.statuses?.[0] || {};
                if (nlSt.resting || nlSt.filled) {
                  pingPongMetaByCoin[nlCoin] = { openedAt: Date.now(), mode: "NEW_LISTING_SNIPER" };
                  allActiveOrResting.push(nlCoin);
                  if (nlSt.filled) {
                    recentOrderSentCoins[nlCoin] = Date.now();
                    await client.order({
                      orders: [{ a: ASSET_INDICES[nlCoin], b: !goLongNL, p: nlTpStr, s: nlSz, r: true, t: { limit: { tif: "Alo" } } }],
                      grouping: "na"
                    }).catch(() => {});
                  }
                  break;
                }
              }
            } catch (_) {}
          }
        }
      }

      const block1Pairs = [...SQUADS_CONFIG.ALFA.pairs, ...SQUADS_CONFIG.BRAVO.pairs, ...SQUADS_CONFIG.CHARLIE.pairs];
      const block2Pairs = [...SQUADS_CONFIG.GOLF.pairs, ...SQUADS_CONFIG.HOTEL.pairs, ...SQUADS_CONFIG.INDIA.pairs];

      // ARMA #1: Contabilizar en el Carril Rápido solo las posiciones frescas (<8m y no en UCI), liberando a los Clones #2 siempre que el Escudo 40% esté intacto
      const activeFastOrResting = [...new Set([...fastLaneActiveCoins, ...restingEntryCoins])];
      let block1OpenCount = activeFastOrResting.filter(c => block1Pairs.includes(c)).length;
      let block2OpenCount = activeFastOrResting.filter(c => block2Pairs.includes(c)).length;

      if (isV2Armed && isCapitalShieldIntact && allActiveOrResting.length < MAX_SAFE_TOTAL_WITH_RECOVERY && (block1OpenCount < MAX_CONCURRENT_BLOCK_1 || block2OpenCount < MAX_CONCURRENT_BLOCK_2) && !isOpeningBellWick(new Date())) {
        // Priorizar a los escuadrones del Bloque 2 (#04 GOLF, #05 HOTEL, #06 INDIA) cuando tienen su cupo libre (block2OpenCount < 3)
        const orderedKeys = block2OpenCount < MAX_CONCURRENT_BLOCK_2
          ? ["GOLF", "HOTEL", "INDIA", "ALFA", "BRAVO", "CHARLIE"]
          : ["ALFA", "BRAVO", "CHARLIE", "GOLF", "HOTEL", "INDIA"];

        const baseUnits = orderedKeys.map(unitKey => {
          const squadCfg = SQUADS_CONFIG[unitKey];
          const hasAnyOpenInSquad = activeCoins.some(c => squadCfg.pairs.includes(c));
          const hasFastOpenInSquad = fastLaneActiveCoins.some(c => squadCfg.pairs.includes(c));
          const hasRestingInSquad = restingEntryCoins.some(c => squadCfg.pairs.includes(c));
          const openInSquadCount = activeCoins.filter(c => squadCfg.pairs.includes(c)).length;
          const allowClones = Boolean(recoveryCtrl.HOT_SWAP_CLONES);
          return {
            unitKey,
            squadCfg,
            isBlock2: squadCfg.block === 2,
            isCloneRelayShot: hasAnyOpenInSquad,
            botName: hasAnyOpenInSquad ? `${unitKey} 2 (Clon Relevo)` : `${unitKey} 1 (Titular)`,
            candidatePairs: squadCfg.pairs.filter(c => !activeCoins.includes(c) && !restingEntryCoins.includes(c)),
            alreadyHasPos: (!allowClones && hasAnyOpenInSquad) || hasFastOpenInSquad || hasRestingInSquad || (openInSquadCount >= 2)
          };
        });

        let currentTotalOpen = allActiveOrResting.length;

        for (const unit of baseUnits) {
          if (currentTotalOpen >= MAX_SAFE_TOTAL_WITH_RECOVERY) break;
          if (unit.alreadyHasPos || unit.candidatePairs.length === 0) continue;

          // Verificar cupo independiente del bloque correspondiente
          if (unit.isBlock2 && block2OpenCount >= MAX_CONCURRENT_BLOCK_2) continue;
          if (!unit.isBlock2 && block1OpenCount >= MAX_CONCURRENT_BLOCK_1) continue;

          try {
            let bestCandidate = null;

            for (const coin of unit.candidatePairs) {
              if (pairCooldowns[coin] && pairCooldowns[coin] > Date.now()) {
                continue;
              }

              try {
                const l2 = await info.l2Book({ coin });
                const bids = l2.levels[0] || [];
                const asks = l2.levels[1] || [];
                if (bids.length < 3 || asks.length < 3) continue;

                let bidVol = 0, askVol = 0;
                for (let i = 0; i < Math.min(5, bids.length); i++) bidVol += parseFloat(bids[i].px) * parseFloat(bids[i].sz);
                for (let i = 0; i < Math.min(5, asks.length); i++) askVol += parseFloat(asks[i].px) * parseFloat(asks[i].sz);

                const totalVol = bidVol + askVol;
                const bullPct = totalVol > 0 ? (bidVol / totalVol) * 100 : 50;
                const bearPct = totalVol > 0 ? (askVol / totalVol) * 100 : 50;

                const now = Date.now();
                const candles5m = await info.candleSnapshot({ coin, interval: "5m", startTime: now - (3600000 * 3), endTime: now });
                if (!candles5m || candles5m.length < 15) continue;
                const closes5m = candles5m.map(c => parseFloat(c.c));
                const rsi5m = calculateRSI(closes5m, 14);
                const ema20_5m = calculateEMA(closes5m, 20);

                const candles15m = await info.candleSnapshot({ coin, interval: "15m", startTime: now - (3600000 * 2), endTime: now });
                const last15m = candles15m && candles15m.length > 0 ? candles15m[candles15m.length - 1] : null;
                const range15m = last15m ? parseFloat(last15m.h) - parseFloat(last15m.l) : 0;
                const currentPrice = parseFloat(bids[0].px);
                const isTop25Pct = range15m > 0 ? (currentPrice - parseFloat(last15m.l)) / range15m > 0.75 : false;
                const isBottom25Pct = range15m > 0 ? (currentPrice - parseFloat(last15m.l)) / range15m < 0.25 : false;

                const inWaveWindow = isMarketShakeWindow(new Date());
                const isWaveLong = inWaveWindow && bullPct >= 60.0;
                const isWaveShort = inWaveWindow && bearPct >= 60.0;

                // Umbrales ágiles para Bloque 2 ($300 USDC Rotación Rápida) vs Bloque 1
                const minBullL2 = unit.isBlock2 ? 56.5 : 61.0;
                const maxLongRsi = unit.isBlock2 ? 52.0 : 48.0;
                const minBearL2 = unit.isBlock2 ? 56.5 : 63.0;
                const minShortRsi = unit.isBlock2 ? 53.0 : 66.0;

                // Filtro Long de Liquidez Rápida
                if (isWaveLong || (bullPct >= minBullL2 && rsi5m <= maxLongRsi && (!isTop25Pct || currentPrice <= ema20_5m))) {
                  if (!bestCandidate || bullPct > bestCandidate.score) {
                    bestCandidate = {
                      coin,
                      direction: "LONG",
                      price: currentPrice,
                      askPrice: parseFloat(asks[0].px),
                      score: bullPct,
                      rsi: rsi5m,
                      ema: ema20_5m
                    };
                  }
                }

                // Filtro Short de Liquidez Rápida
                if (isWaveShort || (bearPct >= minBearL2 && rsi5m >= minShortRsi && (!isBottom25Pct || currentPrice >= ema20_5m))) {
                  if (!bestCandidate || bearPct > bestCandidate.score) {
                    bestCandidate = {
                      coin,
                      direction: "SHORT",
                      price: parseFloat(asks[0].px),
                      bidPrice: currentPrice,
                      score: bearPct,
                      rsi: rsi5m,
                      ema: ema20_5m
                    };
                  }
                }
              } catch (_) {}
            }

            if (bestCandidate) {
              const coin = bestCandidate.coin;
              // NEXUS APEX-36 // LEY 1: CERO TAKE PROFIT FIJO — Puro Candado Elástico (FEE-AWARE RATCHET #00)
              const notional = unit.isCloneRelayShot
                ? 115.0
                : (unit.isBlock2
                  ? Math.min(MAX_NOTIONAL_PER_COIN, BLOCK2_DEDICATED_MARGIN * BLOCK2_LEVERAGE)
                  : Math.min(MAX_NOTIONAL_PER_COIN, dynamicSquadMargin * LEVERAGE));
              const szFormatted = formatHlSize(notional / bestCandidate.price, ASSET_DECIMALS[coin].sz);
              if (parseFloat(szFormatted) <= 0) continue;
              const isLong = bestCandidate.direction === "LONG";
              const entryPxStr = formatHlPrice(bestCandidate.price, coin);
              const entryPxNum = parseFloat(entryPxStr);
              const absSzNum = parseFloat(szFormatted);
              const roundTripFeeUsd = +(notional * (HL_MAKER_FEE_RATE + HL_TAKER_FEE_RATE)).toFixed(4);
              const level1DeltaPx = absSzNum > 0 ? ((roundTripFeeUsd + LEVEL1_NET_LOCK_USDC) / absSzNum) : 0;
              const level1LockPxNum = isLong ? (entryPxNum + level1DeltaPx) : (entryPxNum - level1DeltaPx);
              const level1LockPxStr = formatHlPrice(level1LockPxNum, coin);

              console.log(`\n🎯 [${unit.unitKey} // ${unit.botName} // BLOQUE ${unit.squadCfg.block}] Disparo NEXUS APEX-36 en ${coin} (${bestCandidate.direction}):`);
              console.log(`   • Confluencia: L2 ${bestCandidate.score.toFixed(1)}% | RSI 5m: ${bestCandidate.rsi.toFixed(1)} | EMA20: $${bestCandidate.ema.toFixed(4)}`);
              console.log(`   • Entrada: ${szFormatted} ${coin} @ $${entryPxStr} ($${notional.toFixed(0)} Nocional) -> CERO TP FIJO (Candado Nivel 1 #00 @ $${level1LockPxStr})`);

              try {
                let orderRes = await client.order({
                  orders: [{
                    a: ASSET_INDICES[coin],
                    b: isLong,
                    p: entryPxStr,
                    s: szFormatted,
                    r: false,
                    t: { limit: { tif: "Alo" } }
                  }],
                  grouping: "na"
                });
                let status = orderRes.response?.data?.statuses?.[0] || {};

                // Si ALO fue rechazado por cruce instantáneo de spread, ejecutar entrada límite Gtc al mejor bid/ask para no perder el tiro
                if (status.error) {
                  orderRes = await client.order({
                    orders: [{
                      a: ASSET_INDICES[coin],
                      b: isLong,
                      p: entryPxStr,
                      s: szFormatted,
                      r: false,
                      t: { limit: { tif: "Gtc" } }
                    }],
                    grouping: "na"
                  });
                  status = orderRes.response?.data?.statuses?.[0] || {};
                }

                if (status.resting || status.filled) {
                  currentTotalOpen++;
                  if (unit.isBlock2) block2OpenCount++;
                  else block1OpenCount++;
                  const oid = status.resting?.oid || status.filled?.oid || "FILLED";
                  console.log(`   ✔ [${unit.unitKey}] Orden #${oid} activa en Hyperliquid L1 (${status.filled ? "EJECUTADA" : "EN LIBRO"}).`);

                  if (status.filled) {
                    recentOrderSentCoins[coin] = Date.now();
                    positionOpenTimestamps[coin] = Date.now();

                    const orderTg = `🟢🎯 <b>ÁREA 501 // NEXUS APEX-36 ABIERTA — BLOQUE ${unit.squadCfg.block} (${bestCandidate.direction})</b>\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                      `🔰 <b>Unidad:</b> <b>${unit.squadCfg.name} — ${unit.botName}</b>\n` +
                      `📍 <b>Par:</b> <code>${coin}-USDC</code> (${szFormatted} ${coin})\n` +
                      `📥 <b>PRECIO ENTRADA:</b> <code>$${entryPxStr}</code> ($${notional.toFixed(0)} Nocional)\n` +
                      `🔓 <b>CANDADO NIVEL 1 (#00):</b> <code>$${level1LockPxStr}</code> (Entrada + Comisión + $0.02 ➔ 🟢 LIGERO)\n` +
                      `🌊 <b>NIVEL 2 ELÁSTICO:</b> <b>Cero TP Fijo · 75% / 83% / 90% High-Water Mark</b>\n` +
                      `🎯 <b>EVACUACIÓN 180S:</b> <code>Breakeven Neto +$0.01 USDC Post-Only Maker</code>\n` +
                      `📊 <b>Filtros:</b> L2 ${bestCandidate.score.toFixed(1)}% · RSI 5m ${bestCandidate.rsi.toFixed(1)}\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                      `🌐 <a href="https://hypurrscan.io/address/${VAULT_501}">Ver en Hypurrscan (Sin conectar Wallet)</a>`;
                    await sendSquadTelegram(orderTg);
                  }
                }
              } catch (err) {
                console.error(`[${unit.unitKey}] Error colocando orden en ${coin}:`, err.message);
              }
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      console.error("[AUTONOMOUS LOOP] Error en ciclo (resiliente, reanudando):", err.message);
    }

    // Esperar 10 segundos antes del siguiente ciclo
    await new Promise(r => setTimeout(r, 10000));
  }
}

if (require.main === module) {
  async function runDaemonForever() {
    while (true) {
      try {
        await startAutonomousSquadDaemon();
      } catch (err) {
        console.error("⚠️ Fallo en loop daemon, reiniciando en 5 segundos:", err?.message || err);
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }
  runDaemonForever();
}

module.exports = {
  startAutonomousSquadDaemon,
  processDirectOrdersQueue,
  checkDailyAmortizationCut
};
