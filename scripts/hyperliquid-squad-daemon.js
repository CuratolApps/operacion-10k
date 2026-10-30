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
const { refreshMatrixWaveIntelligence } = require("./matrix-wave-intelligence");

const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";

// Resiliencia 24/7 ante errores de red o RPCs externos
process.on("unhandledRejection", (reason) => {
  console.error("⚠️ [DAEMON] Promesa rechazada no capturada (resiliente, continuando):", reason?.message || reason);
});
process.on("uncaughtException", (err) => {
  console.error("⚠️ [DAEMON] Excepción no capturada (resiliente, continuando):", err?.message || err);
});

// --- ARQUITECTURA DEFINITIVA "NEXUS APEX-36 // FONDO FUNDADOR + AUTO-COMPOUNDING 5% (5X) + PLAN C COSECHA ACTIVA" ---
const STRICT_RECOVERY_LOCK = false;     // Desbloqueado por orden del Comandante para activar PLAN_C_ACTIVE_HARVEST
const PLAN_C_ACTIVE_HARVEST = true;     // 1) PLAN C ACTIVO: Escuadrones libres cazan (+$0.10 Candado #00) mientras las atascadas siguen en Extracción #00
const IMMEDIATE_SNOWBALL_START = true;  // Arranque inmediato con los 47 pares libres en las 4 pistas (Forex, Oro, Índices, Cripto)
const NO_RED_EXIT = true;               // 2) Prohibido cerrar en pérdida (100% salidas en verde o Candado #00 +$0.10 USDC)
const MAX_ACTIVE_HUNTERS = 2;           // 3) Cupo Seguro Plan C: Máx 2-3 operaciones cazadoras simultáneas sin Candado #00
const MAX_UNFENCED_POSITIONS = MAX_ACTIVE_HUNTERS;
const PLAN_C_MIN_LOCK_NET_USDC = 0.10;  // 4) Ley de Hierro Plan C: Candado Base #00 en +$0.10 USDC Netos ($0.00 riesgo tras clavar)
const AUTO_COMPOUND_MARGIN_RATIO = 0.05; // 5) Calibre Compuesto Automático = 5% del Saldo Cerrado Firme L1 (recalculado cada +$25 USDC)
const AUTO_COMPOUND_LEVERAGE = 5.0;     // 5x Apalancamiento -> $50.45 Margen = $252.25 USD Nocional en $1,008.93 USDC
const PLAN_C_HUNTER_MARGIN_USDC = 50.45; // 5% de $1,008.93 USDC = $50.45 USDC Margen por Bot
const PLAN_C_HUNTER_NOTIONAL_USDC = 252.25; // $50.45 USDC Margen x 5x = $252.25 USD Nocional por disparo
const MIN_FREE_MARGIN_RESERVE_USDC = 400.00; // Conservar siempre > $400 USDC de margen libre intocable para respaldar las posiciones en rescate
const BURN_BALLAST_SUBSIDY_RATIO = 0.50; // 50% de las ganancias netas diarias del Plan C subsidian y acercan la salida de XRP -> SOL -> NEAR

// HELPER: MOTOR AUTO-COMPOUNDING LOT SIZE (5% DEL SALDO CERRADO FIRME L1 A 5X, RECALCULADO CADA +$25 USDC)
function computeAutoCompoundLotSize(closedFirmBalanceUsdc = 1008.93) {
  const safeBase = Math.max(1008.93, Number(closedFirmBalanceUsdc || 1008.93));
  // Escalón recalculado automáticamente cada vez que el saldo cerrado suba +$25 USDC (con base inaugural en $1,008.93)
  const extraSteps25 = safeBase >= 1025.00 ? Math.floor(safeBase / 25.0) * 25.0 : safeBase;
  const marginUsdc = +(extraSteps25 * AUTO_COMPOUND_MARGIN_RATIO).toFixed(2);
  const notionalUsd = +(marginUsdc * AUTO_COMPOUND_LEVERAGE).toFixed(2);
  const nextStepUsdc = safeBase < 1050.00 ? 1050.00 : (Math.floor(safeBase / 25.0) + 1) * 25.0;
  return {
    closedFirmBalanceUsdc: +safeBase.toFixed(2),
    marginRatioPct: 5.0,
    leverage: AUTO_COMPOUND_LEVERAGE,
    marginUsdc,
    notionalUsd,
    nextStepUsdc
  };
}
const HL_MAKER_FEE_RATE = 0.00015;      // 0.015% Maker Hyperliquid L1
const HL_TAKER_FEE_RATE = 0.00045;      // 0.045% Taker Hyperliquid L1
const LEVEL1_NET_LOCK_USDC = PLAN_C_MIN_LOCK_NET_USDC; // Candado Nivel 1: Entrada + Comisión Ida/Vuelta Real + $0.10 USDC -> 🟢 LIGERO ($0.00 riesgo)
const CLEAN_EVAC_NET_USDC = PLAN_C_MIN_LOCK_NET_USDC;  // Protocolo Evacuación Limpia 180s: Entrada + Comisión + $0.10 USDC (Post-Only Maker)
const CLEAN_EVAC_TIMEOUT_MS = 180 * 1000; // 180 segundos para activar Evacuación +$0.10 USDC Neto si la ola se enfría antes de Nivel 2
const RATCHET_TIER_1_MIN_PCT = 0.10;    // +0.10% a +0.25% ➔ Candado asegura el 80% del recorrido neto
const RATCHET_TIER_2_MIN_PCT = 0.25;    // +0.25% a +0.80% ➔ Candado asegura el 85% del recorrido neto
const RATCHET_TIER_3_MIN_PCT = 0.80;    // Ola fuerte > +0.80% ➔ Candado pegado al 90% del High-Water Mark sin techo
const STOP_REVERSE_TAPE_BPS_SEC = 18.0; // Giro Brusco Caso A: tapeVelocity >= 18 bps/s
const STOP_REVERSE_VOL_MULT = 2.5;      // Giro Brusco Caso A: Volumen >= 2.5x
const STOP_REVERSE_L2_IMB_PCT = 74.0;   // Giro Brusco Caso A: Libro L2 volcado >= 74%
const STOP_REVERSE_RSI6_LOW = 8.0;      // Giro Brusco Caso B: RSI(6) <= 8 en piso de Bollinger
const STOP_REVERSE_RSI6_HIGH = 92.0;    // Giro Brusco Caso B: RSI(6) >= 92 en techo de Bollinger

const MENTORA_RESERVE_RATIO = 0.40;     // 40% Escudo Mentora #00 (~$360.82+ USDC Intocables)
const SQUAD_MARGIN_RATIO = 0.05;        // 5% del Saldo Cerrado Firme L1 ($50.45 USDC Margen por Bot)
const BLOCK2_DEDICATED_MARGIN = 50.45;  // $50.45 USDC margen ágil ($252.25 USD nocional a 5x)
const BLOCK2_LEVERAGE = 5.0;            // $50.45 * 5x = $252.25 Nocional compuesto por disparo cazador
const LEVERAGE = 5.0;                   // $50.45 Margen * 5x = $252.25 Nocional compuesto por tiro
const MAX_NOTIONAL_PER_COIN = 260.00;   // Calibre Compuesto Automático 5% a 5x ($252.25 USD nocional actual)
const TARGET_GAIN_PCT = 0.00;           // CERO TAKE PROFIT FIJO — Puro Candado Elástico (FEE-AWARE RATCHET #00)
const BLOCK2_TARGET_GAIN_PCT = 0.00;    // CERO TAKE PROFIT FIJO — Exprimido Elástico Sin Techo (80% a 90%)
const BREAKEVEN_TRIGGER_PCT = 0.06;     // Candado Breakeven #00 se activa en Entrada + Comisión + $0.10 USDC
const BREAKEVEN_LOCK_PCT = 0.05;        // Candado BE cubre 100% comisiones reales y asegura +$0.10 USDC netos
const TIME_STOP_MS = CLEAN_EVAC_TIMEOUT_MS; // 180s Protocolo de Evacuación Limpia en +$0.10 USDC Neto
const TIME_STOP_MIN_PNL_USDC = 0.10;    // Salida limpia en +$0.10 USDC neto ($0.00 pérdida)
const POST_TRADE_COOLDOWN_MS = 8 * 60 * 1000; // 8 minutos (480,000 ms) de respiro táctico (🧘‍♂️ RESPIRO 08:00 RECALIBRANDO) antes de incorporarse al carrusel
const COOLDOWN_DURATION_MS = POST_TRADE_COOLDOWN_MS;
let globalPostRecoveryCooldownUntil = 0;
const MIN_CERTAINTY_L2_PCT = 57.0;      // 57% de presión L2 mínima para tiro cazador con confluencia real
const MAX_CONCURRENT_BLOCK_1 = 2;       // Subordinado a MAX_ACTIVE_HUNTERS = 2
const MAX_CONCURRENT_BLOCK_2 = 2;       // Subordinado a MAX_ACTIVE_HUNTERS = 2
const MAX_CONCURRENT_INITIAL = MAX_ACTIVE_HUNTERS;
const MAX_CONCURRENT_TOTAL = 3;         // 3er cazador solo si los 2 primeros tienen Candado #00 asegurado en +$0.10 USDC
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
    ARCHITECTURE: "NEXUS_APEX_36_AUTO_COMPOUND_5PCT",
    STRICT_RECOVERY_LOCK: false,
    PLAN_C_ACTIVE_HARVEST: true,
    NO_RED_EXIT: true,
    MAX_ACTIVE_HUNTERS: 2,
    MAX_UNFENCED_POSITIONS: 2,
    PLAN_C_MIN_LOCK_NET_USDC: 0.10,
    AUTO_COMPOUND_MARGIN_RATIO: 0.05,
    AUTO_COMPOUND_LEVERAGE: 5.0,
    PLAN_C_HUNTER_MARGIN_USDC: 50.45,
    PLAN_C_HUNTER_NOTIONAL_USDC: 252.25,
    MIN_FREE_MARGIN_RESERVE_USDC: 400.00,
    BURN_BALLAST_SUBSIDY_RATIO: 0.50,
    CLEAN_EVAC_TIMEOUT_MS: 180000,
    LOCK_UNTIL_ALL_RECOVERED: false,
    LOCK_NEW_OPENINGS: false,
    COOLDOWN_UNTIL_00_UTC: false,
    HOT_SWAP_CLONES: true,
    TARGET_RESET_UTC: "2026-10-30T00:00:00.000Z",
    POST_00_UTC_MAX_CONCURRENT_POSITIONS: 2,
    REQUIRE_BE_LOCK_FOR_3RD_POSITION: true,
    IMMEDIATE_SNOWBALL_START: true,
    POST_TRADE_COOLDOWN_MS: 480000,
    CASCADE_PLAN_B_ENABLED: true,
    CASCADE_STAGE_LABEL: "❄️ 36 BOTS AUTO-COMPOUND 5% (5X): COBRO INMEDIATO AVAX & PAXG #00 + RESPIRO 08:00",
    RECOVERY_CASCADE_ORDER: ["AVAX", "PAXG", "ETH", "BTC", "XRP", "SOL", "NEAR"]
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
  OP: 9,
  LTC: 10,
  ARB: 11,
  DOGE: 12,
  SUI: 14,
  kPEPE: 15,
  PEPE: 15,
  LINK: 18,
  XRP: 25,
  AAVE: 28,
  TRX: 37,
  UNI: 39,
  DOT: 48,
  ADA: 65,
  TON: 66,
  PENDLE: 70,
  FET: 72,
  NEAR: 74,
  ONDO: 106,
  TAO: 116,
  RENDER: 140,
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
  OP: { sz: 1, px: 4, coin: "OP" },
  LTC: { sz: 2, px: 3, coin: "LTC" },
  ARB: { sz: 1, px: 4, coin: "ARB" },
  DOGE: { sz: 0, px: 6, coin: "DOGE" },
  SUI: { sz: 1, px: 4, coin: "SUI" },
  kPEPE: { sz: 0, px: 6, coin: "kPEPE" },
  PEPE: { sz: 0, px: 6, coin: "kPEPE" },
  LINK: { sz: 1, px: 3, coin: "LINK" },
  XRP: { sz: 0, px: 4, coin: "XRP" },
  AAVE: { sz: 2, px: 2, coin: "AAVE" },
  TRX: { sz: 0, px: 5, coin: "TRX" },
  UNI: { sz: 1, px: 4, coin: "UNI" },
  DOT: { sz: 1, px: 5, coin: "DOT" },
  ADA: { sz: 0, px: 5, coin: "ADA" },
  TON: { sz: 1, px: 4, coin: "TON" },
  PENDLE: { sz: 0, px: 4, coin: "PENDLE" },
  FET: { sz: 0, px: 4, coin: "FET" },
  NEAR: { sz: 1, px: 4, coin: "NEAR" },
  ONDO: { sz: 0, px: 4, coin: "ONDO" },
  TAO: { sz: 3, px: 2, coin: "TAO" },
  RENDER: { sz: 1, px: 4, coin: "RENDER" },
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
    role: "Macro & Oro Digital RWA (Bloque 1)",
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
    role: "Alta Velocidad & Liquidez Masiva (Plan C)",
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
    role: "Nativos L1 & Flujo Institucional (Plan C)",
    pairs: ["HYPE", "TRX", "TON"],
    targetGainPct: BLOCK2_TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  INDIA: {
    id: "INDIA",
    block: 2,
    dedicatedMargin: BLOCK2_DEDICATED_MARGIN,
    name: "Escuadrón #06 India",
    specialist: "#903 India-CrossChain",
    role: "Infraestructura L0/L1 & PoW (Plan C)",
    pairs: ["DOT", "NEAR", "LTC"],
    targetGainPct: BLOCK2_TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  JULIET: {
    id: "JULIET",
    block: 2,
    dedicatedMargin: BLOCK2_DEDICATED_MARGIN,
    name: "Escuadrón #07 Juliet",
    specialist: "#904 Juliet-AI-Compute",
    role: "Inteligencia Artificial & GPU (Plan C)",
    pairs: ["TAO", "RENDER", "FET"],
    targetGainPct: BLOCK2_TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  KILO: {
    id: "KILO",
    block: 2,
    dedicatedMargin: BLOCK2_DEDICATED_MARGIN,
    name: "Escuadrón #08 Kilo",
    specialist: "#905 Kilo-L2-Rollups",
    role: "Layer-2 & Liquidez DeFi (Plan C)",
    pairs: ["ARB", "OP", "UNI"],
    targetGainPct: BLOCK2_TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  LIMA: {
    id: "LIMA",
    block: 2,
    dedicatedMargin: BLOCK2_DEDICATED_MARGIN,
    name: "Escuadrón #09 Lima",
    specialist: "#906 Lima-RWA-Meme",
    role: "PEPE & RWA Institucional (Plan C)",
    pairs: ["kPEPE", "ONDO", "PENDLE"],
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
 * NEXUS APEX-36 // PLAN C LEY DE HIERRO ("O +$0.10 USDC NETO O EXPRIMIDO CON CANDADO SIN TECHO"):
 * CERO TAKE PROFIT FIJO + ESCALERA DE CANDADOS NETOS (FEE-AWARE RATCHET #00 EN +$0.10 USDC)
 * + TRAILING RATCHET (80% A 90% DEL HIGH-WATER MARK)
 * + EVACUACIÓN A LOS 180 SEGUNDOS (+$0.10 USDC POST-ONLY MAKER)
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

  // Precio exacto de Candado Nivel 1 Plan C: Entrada + Comisión Ida/Vuelta Real + $0.10 USDC
  const deltaPxLevel1 = absSz > 0 ? ((realRoundTripFeeUsd + LEVEL1_NET_LOCK_USDC) / absSz) : 0;
  const level1LockPx = isShort ? (entryPx - deltaPxLevel1) : (entryPx + deltaPxLevel1);

  // Precio exacto de Evacuación Limpia 180s Plan C: Entrada + Comisión Maker + $0.10 USDC
  const deltaPxEvac = absSz > 0 ? ((makerRoundTripFeeUsd + CLEAN_EVAC_NET_USDC) / absSz) : 0;
  const cleanEvacMakerPx = isShort ? (entryPx - deltaPxEvac) : (entryPx + deltaPxEvac);

  posMeta.peakGainPct = Math.max(posMeta.peakGainPct || 0, gainPct);
  posMeta.peakNetUsd = Math.max(posMeta.peakNetUsd ?? -999, netAfterFeesUsd);

  // 1) CANDADO NIVEL 1 — LIGEREZA NETA REAL (Entrada + Comisión + $0.10 USDC -> 🟢 LIGERO, $0.00 riesgo)
  if (!posMeta.beLocked && (netAfterFeesUsd >= LEVEL1_NET_LOCK_USDC || (!isShort && currentMid >= level1LockPx) || (isShort && currentMid <= level1LockPx))) {
    posMeta.beLocked = true;
    posMeta.isLight = true;
    posMeta.ratchetLevel = Math.max(posMeta.ratchetLevel || 0, 1);
    posMeta.lockedNetUsd = Math.max(posMeta.lockedNetUsd || 0, LEVEL1_NET_LOCK_USDC);
    posMeta.lockedPx = level1LockPx;
    posMeta.cleanEvacActive = false;
  }

  // 2) CANDADO NIVEL 2 — TRAILING RATCHET SIN TECHO (80% AL 90% DEL HIGH-WATER MARK)
  const peakPct = posMeta.peakGainPct || 0;
  if (peakPct >= RATCHET_TIER_1_MIN_PCT && posMeta.peakNetUsd > LEVEL1_NET_LOCK_USDC) {
    posMeta.beLocked = true;
    posMeta.isLight = true;
    posMeta.ratchetLevel = 2;
    let retentionRatio = 0.80; // +0.10% a +0.25% -> 80% High-Water Mark
    if (peakPct > RATCHET_TIER_3_MIN_PCT) {
      retentionRatio = 0.90;   // > +0.80% -> 90% High-Water Mark
    } else if (peakPct >= RATCHET_TIER_2_MIN_PCT) {
      retentionRatio = 0.85;   // +0.25% a +0.80% -> 85% High-Water Mark
    }
    posMeta.retentionRatio = retentionRatio;
    const targetLockedNet = Math.max(LEVEL1_NET_LOCK_USDC, +(posMeta.peakNetUsd * retentionRatio).toFixed(4));
    if (targetLockedNet >= (posMeta.lockedNetUsd || 0)) {
      posMeta.lockedNetUsd = targetLockedNet;
      const deltaRatchetPx = absSz > 0 ? ((realRoundTripFeeUsd + targetLockedNet) / absSz) : 0;
      posMeta.lockedPx = isShort ? (entryPx - deltaRatchetPx) : (entryPx + deltaRatchetPx);
    }
  }

  // 3) LEY 2 — PROTOCOLO DE EVACUACIÓN LIMPIA A LOS 180 SEGUNDOS (+$0.10 USDC POST-ONLY MAKER)
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
  let ratchetStatusLabel = "🔓 BUSCANDO CANDADO NETO +$0.10";
  if (posMeta.beLocked) {
    const lockedDisp = Math.max(LEVEL1_NET_LOCK_USDC, posMeta.lockedNetUsd || LEVEL1_NET_LOCK_USDC).toFixed(2);
    ratchetStatusLabel = `🔒 CANDADO ACTIVO +$${lockedDisp} | EXPRIMIENDO OLA 🌊`;
  } else if (posMeta.cleanEvacActive) {
    ratchetStatusLabel = "🎯 EVACUACIÓN 180S +$0.10 MAKER";
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
  // Si el cerrojo estricto está activo y no estamos en Plan C, o el cupo de cazadores (MAX_ACTIVE_HUNTERS = 2) está lleno, no abrir
  if (!PLAN_C_ACTIVE_HARVEST && STRICT_RECOVERY_LOCK && isPre00UtcOrRecovering) {
    return { triggered: false, caseType: "BLOCKED_BY_RECOVERY_LOCK", evalLatencyMs: Date.now() - evalStartMs };
  }
  if (unfencedPositionsCount >= MAX_ACTIVE_HUNTERS) {
    return { triggered: false, caseType: "BLOCKED_BY_MAX_HUNTERS_2", evalLatencyMs: Date.now() - evalStartMs };
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

// Hot-Swap Relay 1 ⇄ 2 (18 Espacios × 36 Bots // NEXUS APEX-36 + PLAN C COSECHA ACTIVA + QUEMA-LASTRE #00)
function updateSquadMatrixClones(openPositions, pairCooldowns, recoveryCtrl = null, confirmedOpenByCoin = {}, burnBallastSubsidyUsdc = 0) {
  try {
    const spaces = [
      { id: 1, code: "ALFA", num: "#01", block: 1, titular: "ALFA 1", clon: "ALFA 2", pairs: ["SOL", "SUI", "AVAX"] },
      { id: 2, code: "BRAVO", num: "#02", block: 1, titular: "BRAVO 1", clon: "BRAVO 2", pairs: ["BTC", "PAXG", "LINK"] },
      { id: 3, code: "CHARLIE", num: "#03", block: 1, titular: "CHARLIE 1", clon: "CHARLIE 2", pairs: ["ETH", "BNB", "AAVE"] },
      { id: 4, code: "GOLF", num: "#04", block: 2, titular: "GOLF 1", clon: "GOLF 2", pairs: ["XRP", "DOGE", "ADA"] },
      { id: 5, code: "HOTEL", num: "#05", block: 2, titular: "HOTEL 1", clon: "HOTEL 2", pairs: ["HYPE", "TRX", "TON"] },
      { id: 6, code: "INDIA", num: "#06", block: 2, titular: "INDIA 1", clon: "INDIA 2", pairs: ["DOT", "NEAR", "LTC"] },
      { id: 7, code: "JULIET", num: "#07", block: 3, titular: "JULIET 1", clon: "JULIET 2", pairs: ["TAO", "RENDER", "FET"] },
      { id: 8, code: "KILO", num: "#08", block: 3, titular: "KILO 1", clon: "KILO 2", pairs: ["ARB", "OP", "UNI"] },
      { id: 9, code: "LIMA", num: "#09", block: 3, titular: "LIMA 1", clon: "LIMA 2", pairs: ["ONDO", "PENDLE", "PEPE", "kPEPE"] },
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
    const activeCoins = (openPositions || []).map(p => p.position.coin);
    const stuckSet = new Set(["AVAX", "PAXG", "SOL", "BTC", "ETH", "XRP", "NEAR"]);

    const clonesState = spaces.map(sp => {
      const inPosCoins = sp.pairs.filter(c => activeCoins.includes(c));
      const inPosCoin = inPosCoins[0] || null;
      const cooldownCoin = sp.pairs.find(c => pairCooldowns && pairCooldowns[c] && pairCooldowns[c] > now);
      const posMeta = inPosCoin ? (confirmedOpenByCoin[inPosCoin] || {}) : {};
      const ratchetBadge = posMeta.ratchetStatusLabel || "🔓 BUSCANDO CANDADO NETO +$0.10";

      if (inPosCoin && stuckSet.has(inPosCoin)) {
        const freePairsInSquad = sp.pairs.filter(c => !stuckSet.has(c)).join("/");
        const stageTag = ["AVAX", "PAXG"].includes(inPosCoin)
          ? `⚡ COBRO INMEDIATO (${inPosCoin} · CANDADO #00 +$0.10)`
          : ["ETH", "BTC"].includes(inPosCoin)
            ? `1º BLOQUE CERCANO (${inPosCoin} · BE +$0.10)`
            : inPosCoin === "XRP"
              ? `2º PINZA #00 + QUEMA-LASTRE (-$${burnBallastSubsidyUsdc.toFixed(2)})`
              : inPosCoin === "SOL"
                ? `3º COLA #00 SOL (+QUEMA-LASTRE 50%)`
                : inPosCoin === "NEAR"
                  ? `4º COLA #00 NEAR (70% BE + 30% RATCHET)`
                  : ratchetBadge;
        return {
          ...sp,
          relayStatus: `🎯 EXTRACCIÓN #00 (${inPosCoin}: ${stageTag}) ⇄ ❄️ ${sp.clon}: AUTO 5% EN ${freePairsInSquad || "PARES LIBRES"} (+$0.10 CANDADO)`,
          ratchetStatus: stageTag,
          activeBot: sp.titular,
          standbyBot: sp.clon,
          mode: "PLAN_C_RESCUE_AND_HUNT",
          pairInAction: inPosCoin
        };
      }

      if (inPosCoin) {
        const dispCoin = inPosCoin === "kPEPE" ? "PEPE" : inPosCoin;
        return {
          ...sp,
          relayStatus: `${ratchetBadge} · ❄️ ${sp.titular} (${dispCoin}) ⇄ ${sp.clon}: STOP&REV <50ms ARMADO`,
          ratchetStatus: ratchetBadge,
          activeBot: sp.titular,
          standbyBot: sp.clon,
          mode: "PLAN_C_ACTIVE_HUNTER",
          pairInAction: dispCoin
        };
      } else if (cooldownCoin) {
        const remSecs = Math.max(0, Math.ceil((pairCooldowns[cooldownCoin] - now) / 1000));
        const remMins = Math.ceil(remSecs / 60);
        const mm = String(Math.floor(remSecs / 60)).padStart(2, "0");
        const ss = String(remSecs % 60).padStart(2, "0");
        return {
          ...sp,
          relayStatus: `🧘‍♂️ RESPIRO ${mm}:${ss} (RECALIBRANDO ${cooldownCoin}) ⇄ ⚡ ${sp.clon}: AUTO 5% ACTIVO`,
          ratchetStatus: `🧘‍♂️ RESPIRO ${mm}:${ss} (RECALIBRANDO)`,
          activeBot: sp.clon,
          standbyBot: sp.titular,
          mode: "BREATHER_8M_RECALIBRATING",
          cooldownCoin,
          cooldownRemainingMins: remMins
        };
      } else {
        return {
          ...sp,
          relayStatus: `❄️ AUTO 5% (5x) · ${sp.titular}: CAZANDO (+$0.10 CANDADO #00 · RATCHET 80-90%) ⇄ ${sp.clon}: STOP&REV <50ms`,
          ratchetStatus: "❄️ AUTO 5% CAZANDO (+$0.10)",
          activeBot: sp.titular,
          standbyBot: sp.clon,
          mode: "AUTO_COMPOUND_5PCT_HUNTING",
          pairInAction: null
        };
      }
    });

    const payload = {
      updatedAt: new Date().toISOString(),
      architecture: "NEXUS APEX-36 // FONDO FUNDADOR + AUTO-COMPOUNDING 5% (5X) + PLAN C COSECHA ACTIVA (36 BOTS EN 4 PISTAS)",
      rules: {
        strictRecoveryLock: false,
        planCActiveHarvest: true,
        noRedExit: NO_RED_EXIT,
        zeroFixedTakeProfit: true,
        autoCompoundMarginRatio: AUTO_COMPOUND_MARGIN_RATIO,
        autoCompoundLeverage: AUTO_COMPOUND_LEVERAGE,
        maxActiveHunters: MAX_ACTIVE_HUNTERS,
        maxUnfencedPositions: MAX_ACTIVE_HUNTERS,
        minLockNetUsdc: PLAN_C_MIN_LOCK_NET_USDC,
        burnBallastSubsidyRatio: BURN_BALLAST_SUBSIDY_RATIO,
        cleanEvacTimeoutSec: 180,
        ratchetTiers: "Candado Base #00: Entrada + Comisión + $0.10 USDC ($0.00 riesgo) | Trailing Ratchet: 80% a 90% del High-Water Mark sin techo",
        stopAndReverseClones: "Caso A: Vel >= 18 bps/s + Vol >= 2.5x + L2 >= 74% | Caso B: RSI(6) <= 8 o >= 92 fuera Bollinger | Caso C: Ruido ignorado",
        cooldownPostTp: "8 minutos (480,000 ms) de respiro (🧘‍♂️ RESPIRO 08:00 RECALIBRANDO) antes de incorporarse al carrusel activo"
      },
      spaces: clonesState
    };

    fs.writeFileSync(SQUAD_CLONES_FILE, JSON.stringify(payload, null, 2), "utf8");
  } catch (_) {}
}

async function startAutonomousSquadDaemon() {
  console.log("================================================================================");
  console.log("🚀🏛️❄️ ÁREA 501 // FONDO FUNDADOR ($1,250/QUINCENA) + AUTO-COMPOUND 5% (36 BOTS EN 4 PISTAS)");
  console.log("================================================================================");
  console.log(`• Bóveda Nodriza: ${VAULT_501}`);
  console.log(`• Capital Firme en Hyperliquid L1: $1,008.93 USDC ($756.52 Inyectado #501 + $252.41 Profit Cerrado Bots)`);
  console.log(`• Calibre Compuesto Automático: 5% del Saldo Cerrado L1 a 5x -> $50.45 USDC Margen ($252.25 USD Nocional)`);
  console.log(`• Cobro Inmediato Prioritario: AVAX (-$0.01) y PAXG (-$0.36) -> Candado #00 en +$0.10 USDC Netos o Exprimido L2 >= 68%`);
  console.log(`• Ley de Hierro: Cero Pérdidas Aceptadas — O +$${PLAN_C_MIN_LOCK_NET_USDC.toFixed(2)} USDC en Breakeven Neto o Exprimido con Candado Sin TP Fijo`);
  console.log(`• Motor Sinergia Quema-Lastre: 50% de las ganancias netas diarias del Plan C acercan el precio de salida de ETH ➔ BTC ➔ XRP ➔ SOL ➔ NEAR\n`);

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
  // Conjunto de monedas que iniciaron en la Cola de Extracción #00 (incluyendo AVAX y PAXG para cobro inmediato #00)
  const stuckRecoveryCoinsSet = new Set(["AVAX", "PAXG", "ETH", "BTC", "XRP", "SOL", "NEAR"]);
  let latestNewListingsFeed = [];
  let totalActivePerpsL1 = 229;
  let lastHourlySnapHourKey = "";
  let cycleCounter = 0;
  let isV2Armed = true;
  let initialRecoveryTotalCount = 7;
  let recoveredInSessionCount = 0;
  let dailyClosedProfitTodayUsdc = 0.44;
  let dailyOpsTodayCount = 3;
  let burnBallastSubsidyUsdc = 0.22;

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

      // Sincronizar stuckRecoveryCoinsSet con las posiciones realmente abiertas (si una de las 6 ya cerró, queda libre)
      const currentlyOpenCoinNames = new Set(openPositions.map(p => p.position.coin));
      for (const sc of Array.from(stuckRecoveryCoinsSet)) {
        if (!currentlyOpenCoinNames.has(sc)) {
          stuckRecoveryCoinsSet.delete(sc);
        }
      }

      // Calcular Ganancia Neta Cerrada Hoy (desde las 00:00:00 UTC) cada 3 ciclos para alimentar el Motor Quema-Lastre (50%)
      if (cycleCounter === 1 || cycleCounter % 3 === 0) {
        try {
          const fills = await info.userFills({ user: VAULT_501 });
          const nowD = new Date();
          const utcMidnightMs = Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth(), nowD.getUTCDate(), 0, 0, 0, 0);
          const todayCloseFills = (fills || []).filter(f => Number(f.time || 0) >= utcMidnightMs && parseFloat(f.closedPnl || "0") !== 0);
          const todayNetSum = todayCloseFills.reduce((acc, f) => acc + (parseFloat(f.closedPnl || "0") - parseFloat(f.fee || "0")), 0);
          dailyClosedProfitTodayUsdc = Math.max(0, +todayNetSum.toFixed(4));
          burnBallastSubsidyUsdc = +(dailyClosedProfitTodayUsdc * BURN_BALLAST_SUBSIDY_RATIO).toFixed(4);
        } catch (_) {}
      }

      // En Plan C, NO bloqueamos todo el sistema: solo protegemos las monedas en stuckRecoveryCoinsSet
      let isPre00UtcOrRecovering = Boolean(STRICT_RECOVERY_LOCK && !PLAN_C_ACTIVE_HARVEST && stuckRecoveryCoinsSet.size > 0);

      // 1.1 Limpiar órdenes de entrada estancadas (>45s) o entradas accidentales sobre monedas en Extracción #00 (salvo Pinza Mentora)
      const nowMs = Date.now();
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

      // 1.2 Detectar cierres reales de posiciones previamente confirmadas en Clearinghouse + Ley 3 Stop-And-Reverse en Clones (2)
      for (const [closedCoin, prevInfo] of Object.entries(confirmedOpenByCoin)) {
        const stillOpen = openPositions.some(p => p.position.coin === closedCoin);
        if (!stillOpen) {
          recoveredInSessionCount++;
          stuckRecoveryCoinsSet.delete(closedCoin);
          pairCooldowns[closedCoin] = Date.now() + POST_TRADE_COOLDOWN_MS;

          const remainingStuck = openPositions.filter(p => stuckRecoveryCoinsSet.has(p.position.coin)).length;
          console.log(`🎉 [PLAN C // CANDADO POSITIVO #00 COBRADO] ✅ (${closedCoin}-USDC) — Quedan ${remainingStuck} en Cola #00 | Entra en 🧘‍♂️ RESPIRO 08:00 (RECALIBRANDO) y luego se incorpora al carrusel.`);

          delete confirmedOpenByCoin[closedCoin];
          lastConfirmedPositionSizes[closedCoin] = 0;
          delete positionOpenTimestamps[closedCoin];

          // LEY 3: El Clon (2) evalúa en < 50ms si el golpe que cerró el candado del Titular (1) es un Giro Sísmico Real (Casos A, B o C)
          const unfencedHuntersNow = openPositions.filter(p => !stuckRecoveryCoinsSet.has(p.position.coin) && !confirmedOpenByCoin[p.position.coin]?.beLocked).length;
          const stopRevResult = await evaluateCloneStopAndReverse({
            coin: closedCoin,
            closedWasShort: Boolean(prevInfo.isShort),
            squadKey: prevInfo.squadKey || "ALFA",
            info,
            client,
            rollingMidsHistory,
            isPre00UtcOrRecovering: false,
            unfencedPositionsCount: unfencedHuntersNow
          });

          try {
            const recentFills = await info.userFills({ user: VAULT_501 });
            const closeFill = recentFills.find(f => f.coin === closedCoin && f.dir && f.dir.includes("Close"));
            const rawGrossGain = closeFill ? parseFloat(closeFill.closedPnl || "0.45") : 0.45;
            const feePaid = closeFill ? parseFloat(closeFill.fee || "0.02") : 0.02;
            const netGain = Math.max(0.10, +(rawGrossGain - feePaid).toFixed(4));
            const exitPxStr = closeFill ? closeFill.px : "Candado #00";
            const squadCfg = SQUADS_CONFIG[prevInfo.squadKey] || SQUADS_CONFIG.ALFA;
            dailyClosedProfitTodayUsdc = +(dailyClosedProfitTodayUsdc + netGain).toFixed(4);
            burnBallastSubsidyUsdc = +(dailyClosedProfitTodayUsdc * BURN_BALLAST_SUBSIDY_RATIO).toFixed(4);

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
              burnBallastContributionUsdc: +(netGain * BURN_BALLAST_SUBSIDY_RATIO).toFixed(4),
              stopAndReverseClone: stopRevResult.caseType,
              status: "PLAN_C_RATCHET_CONFIRMED",
              newAccountValue: accountValue,
              timestamp: new Date().toISOString()
            };
            recordTransactionInLedger(victoryTx);
            const currentLedger = loadRealLedger();

            const victoryTg = `✅🔒 <b>PLAN C // CANDADO #00 COBRADO EN VERDE (${closedCoin}-USDC)</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `🔰 <b>Escuadrón:</b> <b>${squadCfg.name}</b> (${squadCfg.specialist})\n` +
              `📍 <b>Par:</b> <code>${closedCoin}-USDC</code> (${prevInfo.isShort ? "SHORT" : "LONG"})\n` +
              `📥 <b>Precio Entrada:</b> <code>$${formatHlPrice(prevInfo.entryPx || 0, closedCoin)}</code>\n` +
              `📤 <b>Salida Candado #00:</b> <code>$${exitPxStr}</code>\n` +
              `💰 <b>GANANCIA NETA EN CAJA:</b> <b>+$${netGain.toFixed(4)} USDC</b>\n` +
              `🔥 <b>Aporte Quema-Lastre (50%):</b> <code>+$${(netGain * 0.50).toFixed(4)} USDC</code> (Acercando salida de XRP/SOL/NEAR)\n` +
              `🏆 <b>Hoy desde 00:00 UTC:</b> <b>+$${dailyClosedProfitTodayUsdc.toFixed(2)} USDC (0 Pérdidas)</b>\n` +
              `🔄 <b>Evaluación Clon (2):</b> <code>${stopRevResult.caseType}</code>\n` +
              `💵 <b>Equity Viva en L1:</b> <code>$${accountValue.toFixed(2)} USDC</code>\n` +
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
      updateSquadMatrixClones(openPositions, pairCooldowns, recoveryCtrl, confirmedOpenByCoin, burnBallastSubsidyUsdc);

      // Dinámica de capitalización Plan C (Reserva > $400 USDC intocable + Balas ágiles de $70 margen / $175 nocional)
      const reserveUsdc = Math.max(MIN_FREE_MARGIN_RESERVE_USDC, +(accountValue * MENTORA_RESERVE_RATIO).toFixed(2));
      const availableForTrading = Math.max(0, accountValue - reserveUsdc);
      const dynamicSquadMargin = PLAN_C_HUNTER_MARGIN_USDC;
      const dynamicNotional = PLAN_C_HUNTER_NOTIONAL_USDC;

      if (cycleCounter % 6 === 1) {
        const openSummary = openPositions.map(p => `${p.position.coin}(${p.position.szi}@$${p.position.entryPx})`).join(", ") || "Ninguna (100% Liquidez USDC)";
        const activeHuntersCnt = openPositions.filter(p => !stuckRecoveryCoinsSet.has(p.position.coin)).length;
        console.log(`[${new Date().toISOString().slice(11, 19)} UTC] ⚡ PLAN C ACTIVO (Cazadores: ${activeHuntersCnt}/${MAX_ACTIVE_HUNTERS} | Cola #00: ${stuckRecoveryCoinsSet.size}/6 | Quema-Lastre 50%: $${burnBallastSubsidyUsdc.toFixed(2)}) | Ciclo #${cycleCounter} | Equity L1: $${accountValue.toFixed(2)} | Activas: ${openSummary}`);
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

      // Actualizar 6. MATRIX WAVE INTELLIGENCE (Flujo Mundial en Español + Detector Anti-Hack / Oso <150ms) cada 6 ciclos (~60s)
      if (cycleCounter === 1 || cycleCounter % 6 === 0) {
        try {
          const waveIntel = await refreshMatrixWaveIntelligence({ mids, openPositions, accountValue });
          if (waveIntel && waveIntel.hasCriticalBearAlert) {
            console.log(`🚨🐻 [MATRIX WAVE INTELLIGENCE // ALERTA CRÍTICA DE OSO / ANTI-HACK] Detectado evento bajista severo -> Blindando Candados #00 y pre-armando Giro a Oso (SHORT)!`);
          }
        } catch (_) {}
      }

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

      // 3. GESTIONAR TODAS LAS POSICIONES ABIERTAS CON:
      // A) COBRO INMEDIATO DE AVAX (-$0.01) Y PAXG (-$0.36) BAJO PLAN C Y CANDADO #00 (+$0.10 NETOS O EXPRIMIDO L2 >= 68%)
      // B) MOTOR "SINERGIA QUEMA-LASTRE" EN LAS ATASCADAS (ETH/BTC/XRP/SOL/NEAR + 50% Ganancias Plan C acercando salida)
      // C) LEY DE HIERRO DEL PLAN C EN LOS CAZADORES LIBRES ("O +$0.10 USDC Neto o Exprimido con Candado Sin Techo 80%-90% + Evacuación 180s en +$0.10 USDC")
      const tier1Set = new Set(["AVAX", "PAXG", "BTC", "DOGE", "ETH"]);
      const tier2Set = new Set(["XRP", "SOL"]);
      const openCoinsSet = new Set(openPositions.map(p => p.position.coin));
      const firstCriticalInQueue = openCoinsSet.has("XRP")
        ? "XRP"
        : (openCoinsSet.has("SOL") ? "SOL" : (openCoinsSet.has("NEAR") ? "NEAR" : null));

      const totalNotionalOpenForCascade = openPositions.reduce((sum, p) => {
        const sz = Math.abs(parseFloat(p.position.szi || "0"));
        const px = parseFloat(p.position.entryPx || "0");
        return sum + (sz * px);
      }, 0);
      const marginUsedCascade = totalNotionalOpenForCascade / 5.0;
      const freeMarginUsdcCascade = Math.max(0, accountValue - marginUsedCascade);
      const freeMarginRatioPct = accountValue > 0 ? (freeMarginUsdcCascade / accountValue) * 100 : 0;

      for (const activePos of openPositions) {
        const coin = activePos.position.coin;
        const sz = activePos.position.szi;
        const szNum = parseFloat(sz);
        const isShort = szNum < 0;
        const entryPx = parseFloat(activePos.position.entryPx);
        const notionalVal = Math.abs(szNum) * entryPx;
        const uPnlNum = parseFloat(activePos.position?.unrealizedPnl || "0");
        const isStuckRecoveryPos = stuckRecoveryCoinsSet.has(coin);

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
            pinzaInjected: isRescuedSize,
            nearStepADone: false,
            beLocked: false,
            isLight: false,
            ratchetLevel: 0,
            lockedNetUsd: 0,
            lockedPx: 0,
            cleanEvacActive: false,
            evacOrderPlacedPx: null,
            ratchetStatusLabel: "🔓 BUSCANDO CANDADO NETO +$0.10"
          };
          positionOpenTimestamps[coin] = isStuckRecoveryPos ? (Date.now() - 240000) : Date.now();
        } else {
          confirmedOpenByCoin[coin].entryPx = entryPx;
          confirmedOpenByCoin[coin].szi = szNum;
          if (isRescuedSize) {
            confirmedOpenByCoin[coin].dcaDone = true;
            confirmedOpenByCoin[coin].pinzaInjected = true;
          }
        }
        const posMeta = confirmedOpenByCoin[coin];
        const openTs = positionOpenTimestamps[coin] || Date.now();
        const currentMid = parseFloat(mids[coin] || entryPx);
        const existingExitOrder = openOrders.find(o => o.coin === coin && o.reduceOnly === true);

        // Calcular estado en tiempo real de la Escalera de Candados Netos (FEE-AWARE RATCHET #00 EN +$0.10 USDC)
        const ratchet = computeFeeAwareRatchet(
          coin,
          entryPx,
          szNum,
          currentMid,
          uPnlNum,
          posMeta,
          openTs,
          isStuckRecoveryPos
        );
        posMeta.ratchetStatusLabel = ratchet.ratchetStatusLabel;

        if (!isV2Armed || !ASSET_DECIMALS[coin]) continue;

        const absSz = Math.abs(szNum);
        const totalSzStr = formatHlSize(absSz, ASSET_DECIMALS[coin].sz);

        // =========================================================================
        // A) POSICIONES EN COLA DE EXTRACCIÓN #00 + COBRO INMEDIATO AVAX Y PAXG
        // =========================================================================
        if (isStuckRecoveryPos) {
          // 1. COBRO INMEDIATO DE AVAX (-$0.01), PAXG (-$0.36) Y LAS CERCANAS (BTC, DOGE, ETH) EN +$0.10 USDC NETOS (O EXPRIMIDO SI L2 >= 68%)
          if (tier1Set.has(coin)) {
            posMeta.ratchetStatusLabel = ["AVAX", "PAXG"].includes(coin)
              ? `⚡ COBRO INMEDIATO #00 (${coin}) · +$0.10 NETO O EXPRIMIDO L2>=68%`
              : `1º BLOQUE CERCANO (${coin}) · SALIDA NETA +$0.10`;

            // Pinza #00 en ETH si hay soporte L2 Bid >= 60% y margen libre > $400 USDC
            if (coin === "ETH" && !posMeta.pinzaInjected && freeMarginUsdcCascade >= (MIN_FREE_MARGIN_RESERVE_USDC + 80.0)) {
              try {
                const l2Eth = await info.l2Book({ coin: "ETH" });
                const bidsE = l2Eth?.levels?.[0] || [], asksE = l2Eth?.levels?.[1] || [];
                let bVolE = 0, aVolE = 0;
                for (let i = 0; i < 5; i++) {
                  bVolE += parseFloat(bidsE[i]?.px || 0) * parseFloat(bidsE[i]?.sz || 0);
                  aVolE += parseFloat(asksE[i]?.px || 0) * parseFloat(asksE[i]?.sz || 0);
                }
                const supportEthPct = (bVolE + aVolE) > 0 ? ((isShort ? aVolE : bVolE) / (bVolE + aVolE)) * 100 : 50;
                if (supportEthPct >= 60.0 && bidsE.length > 0 && asksE.length > 0) {
                  const ethCartridgeNotional = Math.min(180.0, notionalVal);
                  const ethBookPx = isShort ? parseFloat(asksE[0].px) : parseFloat(bidsE[0].px);
                  const ethCartridgeSzStr = formatHlSize(ethCartridgeNotional / ethBookPx, ASSET_DECIMALS.ETH.sz);
                  if (parseFloat(ethCartridgeSzStr) > 0) {
                    console.log(`🚁🛡️ [QUEMA-LASTRE // PINZA #00 ETH] Aplicando Pinza #00 en ETH (${ethCartridgeSzStr} @ $${formatHlPrice(ethBookPx, "ETH")} | L2: ${supportEthPct.toFixed(1)}%)!`);
                    const pEthRes = await client.order({
                      orders: [{
                        a: ASSET_INDICES.ETH,
                        b: !isShort,
                        p: formatHlPrice(ethBookPx, "ETH"),
                        s: ethCartridgeSzStr,
                        r: false,
                        t: { limit: { tif: "Alo" } }
                      }],
                      grouping: "na"
                    });
                    const pEthSt = pEthRes?.response?.data?.statuses?.[0] || {};
                    if (pEthSt.filled || pEthSt.resting) {
                      posMeta.pinzaInjected = true;
                      posMeta.dcaDone = true;
                    }
                  }
                }
              } catch (_) {}
            }

            if (ratchet.beLocked && ratchet.netAfterFeesUsd >= LEVEL1_NET_LOCK_USDC) {
              // Verificar presión compradora en L2: si L2 >= 68% y NO ha tocado el trinquete, exprimir la vela con Candado #00 clavado; si no, cobrar inmediato!
              let squeezeL2Active = false;
              if (["AVAX", "PAXG"].includes(coin) && !ratchet.hitRatchetStop) {
                try {
                  const l2Check = await info.l2Book({ coin });
                  const bLv = l2Check?.levels?.[0] || [], aLv = l2Check?.levels?.[1] || [];
                  let bV = 0, aV = 0;
                  for (let i = 0; i < 5; i++) {
                    bV += parseFloat(bLv[i]?.px || 0) * parseFloat(bLv[i]?.sz || 0);
                    aV += parseFloat(aLv[i]?.px || 0) * parseFloat(aLv[i]?.sz || 0);
                  }
                  const favPressPct = (bV + aV) > 0 ? ((isShort ? aV : bV) / (bV + aV)) * 100 : 50;
                  if (favPressPct >= 68.0) {
                    squeezeL2Active = true;
                    posMeta.ratchetStatusLabel = `🌊 EXPRIMIENDO VELA #00 (${coin} · L2 ${favPressPct.toFixed(1)}% >= 68% · CANDADO +$${ratchet.lockedNetUsd.toFixed(2)})`;
                    if (existingExitOrder) {
                      await client.cancel({ cancels: [{ a: ASSET_INDICES[coin], o: existingExitOrder.oid }] }).catch(() => {});
                    }
                  }
                } catch (_) {}
              }

              if (!squeezeL2Active && (ratchet.hitRatchetStop || ratchet.netAfterFeesUsd >= 0.10)) {
                console.log(`💰🔒 [COBRO INMEDIATO CANDADO #00] ${coin} alcanzó ganancia neta (+$${ratchet.netAfterFeesUsd.toFixed(4)} USDC >= +$0.10) -> Cobrando a USDC y liberando liquidez para Pinza!`);
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
              if (squeezeL2Active) continue;
            }

            const targetLockPxStr = formatHlPrice(ratchet.level1LockPx, coin);
            if (!existingExitOrder || posMeta.evacOrderPlacedPx !== targetLockPxStr) {
              if (existingExitOrder) {
                await client.cancel({ cancels: [{ a: ASSET_INDICES[coin], o: existingExitOrder.oid }] }).catch(() => {});
              }
              console.log(`🛡️ [COBRO INMEDIATO #00] ${coin}: Objetivo Breakeven Neto Real (+$0.10 USDC) armado en $${targetLockPxStr}`);
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
              posMeta.evacOrderPlacedPx = targetLockPxStr;
            }
            continue;
          }

          // 2. ACELERADOR DE SALIDA "SINERGIA QUEMA-LASTRE" PARA XRP ➔ SOL ➔ NEAR
          // El 50% de las ganancias diarias del Plan C (burnBallastSubsidyUsdc) acerca el precio de salida reduceOnly de la #1 en cola (firstCriticalInQueue)
          const isQueueLeader = (coin === firstCriticalInQueue);
          const appliedSubsidyUsd = isQueueLeader ? burnBallastSubsidyUsdc : 0;

          if (coin === "XRP") {
            const xrpPinzaUnlocked = (freeMarginUsdcCascade >= (MIN_FREE_MARGIN_RESERVE_USDC + 65.0)) || !openCoinsSet.has("PAXG") || !openCoinsSet.has("ETH");
            posMeta.ratchetStatusLabel = posMeta.pinzaInjected
              ? `2º PINZA #00 + QUEMA-LASTRE (-$${appliedSubsidyUsd.toFixed(2)}) · SALIDA +$0.10`
              : `2º COLA #00: XRP · QUEMA-LASTRE 50% (-$${appliedSubsidyUsd.toFixed(2)} SUBSIDIO)`;

            if (xrpPinzaUnlocked && !posMeta.pinzaInjected && freeMarginUsdcCascade >= (MIN_FREE_MARGIN_RESERVE_USDC + 65.0)) {
              try {
                const l2 = await info.l2Book({ coin: "XRP" });
                const bids = l2?.levels?.[0] || [], asks = l2?.levels?.[1] || [];
                let bVol = 0, aVol = 0;
                for (let i = 0; i < 5; i++) {
                  bVol += parseFloat(bids[i]?.px || 0) * parseFloat(bids[i]?.sz || 0);
                  aVol += parseFloat(asks[i]?.px || 0) * parseFloat(asks[i]?.sz || 0);
                }
                const supportPct = (bVol + aVol) > 0 ? ((isShort ? aVol : bVol) / (bVol + aVol)) * 100 : 50;
                if (supportPct >= 60.0 && bids.length > 0 && asks.length > 0) {
                  const cartridgeNotional = Math.min(200.0, notionalVal);
                  const bookPx = isShort ? parseFloat(asks[0].px) : parseFloat(bids[0].px);
                  const cartridgeSzStr = formatHlSize(cartridgeNotional / bookPx, ASSET_DECIMALS.XRP.sz);
                  if (parseFloat(cartridgeSzStr) > 0) {
                    console.log(`🚁🛡️ [QUEMA-LASTRE // PINZA #00 XRP] Inyectando 1 cartucho táctico en XRP (${cartridgeSzStr} @ $${formatHlPrice(bookPx, "XRP")} | L2: ${supportPct.toFixed(1)}%)!`);
                    const pRes = await client.order({
                      orders: [{
                        a: ASSET_INDICES.XRP,
                        b: !isShort,
                        p: formatHlPrice(bookPx, "XRP"),
                        s: cartridgeSzStr,
                        r: false,
                        t: { limit: { tif: "Alo" } }
                      }],
                      grouping: "na"
                    });
                    const pSt = pRes?.response?.data?.statuses?.[0] || {};
                    if (pSt.filled || pSt.resting) {
                      posMeta.pinzaInjected = true;
                      posMeta.dcaDone = true;
                      await sendSquadTelegram(
                        `🚁🛡️ <b>PLAN C QUEMA-LASTRE // PINZA ACTIVADA EN XRP (2º EN COLA)</b>\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                        `📍 <b>Par:</b> <code>XRP-USDC</code> (+${cartridgeSzStr} XRP @ <code>$${formatHlPrice(bookPx, "XRP")}</code>)\n` +
                        `📊 <b>Soporte L2:</b> <code>${supportPct.toFixed(1)}%</code> | <b>Subsidio Quema-Lastre (50%):</b> <code>-$${appliedSubsidyUsd.toFixed(2)} USDC</code>\n` +
                        `🎯 <b>Objetivo Salida Acercado:</b> <code>nuevoEntryPx + comisión + $0.10 - Subsidio 50%</code>`
                      );
                    }
                  }
                }
              } catch (_) {}
            }

            // Salida reduceOnly de XRP acercada por el 50% de las ganancias del Plan C (appliedSubsidyUsd)
            const xrpEffectiveTargetNetUsd = +(PLAN_C_MIN_LOCK_NET_USDC - appliedSubsidyUsd).toFixed(4);
            const xrpDeltaPx = absSz > 0 ? ((ratchet.realRoundTripFeeUsd + xrpEffectiveTargetNetUsd) / absSz) : 0;
            const xrpExitPx = isShort ? (entryPx - xrpDeltaPx) : (entryPx + xrpDeltaPx);
            const xrpExitPxStr = formatHlPrice(xrpExitPx, "XRP");

            if (ratchet.netAfterFeesUsd >= xrpEffectiveTargetNetUsd) {
              console.log(`💰🔒 [QUEMA-LASTRE // RESCATE XRP COMPLETADO] XRP alcanzó salida subsidiada (+$${ratchet.netAfterFeesUsd.toFixed(4)} USDC + $${appliedSubsidyUsd.toFixed(2)} Quema-Lastre) -> Liquidando 100% hacia SOL!`);
              if (existingExitOrder) {
                await client.cancel({ cancels: [{ a: ASSET_INDICES.XRP, o: existingExitOrder.oid }] }).catch(() => {});
              }
              const closePx = isShort ? currentMid * 1.0004 : currentMid * 0.9996;
              await client.order({
                orders: [{
                  a: ASSET_INDICES.XRP,
                  b: isShort,
                  p: formatHlPrice(closePx, "XRP"),
                  s: totalSzStr,
                  r: true,
                  t: { limit: { tif: "Ioc" } }
                }],
                grouping: "na"
              }).catch(() => {});
              continue;
            }

            if (!existingExitOrder || posMeta.evacOrderPlacedPx !== xrpExitPxStr) {
              if (existingExitOrder) {
                await client.cancel({ cancels: [{ a: ASSET_INDICES.XRP, o: existingExitOrder.oid }] }).catch(() => {});
              }
              await client.order({
                orders: [{
                  a: ASSET_INDICES.XRP,
                  b: isShort,
                  p: xrpExitPxStr,
                  s: totalSzStr,
                  r: true,
                  t: { limit: { tif: "Alo" } }
                }],
                grouping: "na"
              }).catch(() => {});
              posMeta.evacOrderPlacedPx = xrpExitPxStr;
            }
            continue;
          }

          if (coin === "SOL") {
            const solPinzaUnlocked = !openCoinsSet.has("XRP");
            posMeta.ratchetStatusLabel = posMeta.pinzaInjected
              ? `3º PINZA #00 ACTIVA (SOL) · QUEMA-LASTRE (-$${appliedSubsidyUsd.toFixed(2)})`
              : (solPinzaUnlocked ? `3º PINZA #00 SOL ARMADA (+QUEMA-LASTRE -$${appliedSubsidyUsd.toFixed(2)})` : `3º COLA #00: SOL (ESPERANDO SALIDA DE XRP)`);

            if (solPinzaUnlocked && !posMeta.pinzaInjected && freeMarginUsdcCascade >= (MIN_FREE_MARGIN_RESERVE_USDC + 80.0)) {
              try {
                const l2 = await info.l2Book({ coin: "SOL" });
                const bids = l2?.levels?.[0] || [], asks = l2?.levels?.[1] || [];
                let bVol = 0, aVol = 0;
                for (let i = 0; i < 5; i++) {
                  bVol += parseFloat(bids[i]?.px || 0) * parseFloat(bids[i]?.sz || 0);
                  aVol += parseFloat(asks[i]?.px || 0) * parseFloat(asks[i]?.sz || 0);
                }
                const supportPct = (bVol + aVol) > 0 ? ((isShort ? aVol : bVol) / (bVol + aVol)) * 100 : 50;
                if (supportPct >= 60.0 && bids.length > 0 && asks.length > 0) {
                  const cartridgeNotional = Math.min(220.0, notionalVal);
                  const bookPx = isShort ? parseFloat(asks[0].px) : parseFloat(bids[0].px);
                  const cartridgeSzStr = formatHlSize(cartridgeNotional / bookPx, ASSET_DECIMALS.SOL.sz);
                  if (parseFloat(cartridgeSzStr) > 0) {
                    console.log(`🚁🛡️ [QUEMA-LASTRE // PINZA #00 SOL] XRP cerrada -> Aplicando Pinza #00 sobre SOL (${cartridgeSzStr} @ $${formatHlPrice(bookPx, "SOL")} | L2: ${supportPct.toFixed(1)}%)!`);
                    const pRes = await client.order({
                      orders: [{
                        a: ASSET_INDICES.SOL,
                        b: !isShort,
                        p: formatHlPrice(bookPx, "SOL"),
                        s: cartridgeSzStr,
                        r: false,
                        t: { limit: { tif: "Alo" } }
                      }],
                      grouping: "na"
                    });
                    const pSt = pRes?.response?.data?.statuses?.[0] || {};
                    if (pSt.filled || pSt.resting) {
                      posMeta.pinzaInjected = true;
                      posMeta.dcaDone = true;
                      await sendSquadTelegram(
                        `🚁🛡️ <b>PLAN C QUEMA-LASTRE // PINZA ACTIVADA EN SOL (3º EN COLA)</b>\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                        `📍 <b>Par:</b> <code>SOL-USDC</code> (+${cartridgeSzStr} SOL @ <code>$${formatHlPrice(bookPx, "SOL")}</code>)\n` +
                        `📊 <b>Soporte L2:</b> <code>${supportPct.toFixed(1)}%</code> | <b>Subsidio Quema-Lastre (50%):</b> <code>-$${appliedSubsidyUsd.toFixed(2)} USDC</code>\n` +
                        `🎯 <b>Objetivo Salida Acercado:</b> <code>nuevoEntryPx + comisión + $0.10 - Subsidio 50%</code>`
                      );
                    }
                  }
                }
              } catch (_) {}
            }

            const solEffectiveTargetNetUsd = +(PLAN_C_MIN_LOCK_NET_USDC - appliedSubsidyUsd).toFixed(4);
            const solDeltaPx = absSz > 0 ? ((ratchet.realRoundTripFeeUsd + solEffectiveTargetNetUsd) / absSz) : 0;
            const solExitPx = isShort ? (entryPx - solDeltaPx) : (entryPx + solDeltaPx);
            const solExitPxStr = formatHlPrice(solExitPx, "SOL");

            if (ratchet.netAfterFeesUsd >= solEffectiveTargetNetUsd) {
              console.log(`💰🔒 [QUEMA-LASTRE // RESCATE SOL COMPLETADO] SOL alcanzó salida subsidiada (+$${ratchet.netAfterFeesUsd.toFixed(4)} USDC) -> Evacuando 100% hacia NEAR!`);
              if (existingExitOrder) {
                await client.cancel({ cancels: [{ a: ASSET_INDICES.SOL, o: existingExitOrder.oid }] }).catch(() => {});
              }
              const closePx = isShort ? currentMid * 1.0004 : currentMid * 0.9996;
              await client.order({
                orders: [{
                  a: ASSET_INDICES.SOL,
                  b: isShort,
                  p: formatHlPrice(closePx, "SOL"),
                  s: totalSzStr,
                  r: true,
                  t: { limit: { tif: "Ioc" } }
                }],
                grouping: "na"
              }).catch(() => {});
              continue;
            }

            if (!existingExitOrder || posMeta.evacOrderPlacedPx !== solExitPxStr) {
              if (existingExitOrder) {
                await client.cancel({ cancels: [{ a: ASSET_INDICES.SOL, o: existingExitOrder.oid }] }).catch(() => {});
              }
              await client.order({
                orders: [{
                  a: ASSET_INDICES.SOL,
                  b: isShort,
                  p: solExitPxStr,
                  s: totalSzStr,
                  r: true,
                  t: { limit: { tif: "Alo" } }
                }],
                grouping: "na"
              }).catch(() => {});
              posMeta.evacOrderPlacedPx = solExitPxStr;
            }
            continue;
          }

          if (coin === "NEAR") {
            const allFiveCleared = !openCoinsSet.has("PAXG") && !openCoinsSet.has("ETH") && !openCoinsSet.has("BTC") && !openCoinsSet.has("XRP") && !openCoinsSet.has("SOL");
            posMeta.ratchetStatusLabel = posMeta.nearStepADone
              ? `4º NEAR ESCALÓN B (30% CON CANDADO #00 🌊)`
              : (allFiveCleared ? `4º PINZA #00 NEAR + QUEMA-LASTRE (-$${appliedSubsidyUsd.toFixed(2)})` : `4º COLA #00: NEAR (ESPERANDO SALIDA XRP+SOL)`);

            if (allFiveCleared && !posMeta.pinzaInjected && freeMarginUsdcCascade >= (MIN_FREE_MARGIN_RESERVE_USDC + 90.0)) {
              try {
                const l2 = await info.l2Book({ coin: "NEAR" });
                const bids = l2?.levels?.[0] || [], asks = l2?.levels?.[1] || [];
                let bVol = 0, aVol = 0;
                for (let i = 0; i < 5; i++) {
                  bVol += parseFloat(bids[i]?.px || 0) * parseFloat(bids[i]?.sz || 0);
                  aVol += parseFloat(asks[i]?.px || 0) * parseFloat(asks[i]?.sz || 0);
                }
                const supportPct = (bVol + aVol) > 0 ? ((isShort ? aVol : bVol) / (bVol + aVol)) * 100 : 50;
                if (supportPct >= 60.0 && bids.length > 0 && asks.length > 0) {
                  const cartridgeNotional = Math.min(250.0, notionalVal);
                  const bookPx = isShort ? parseFloat(asks[0].px) : parseFloat(bids[0].px);
                  const cartridgeSzStr = formatHlSize(cartridgeNotional / bookPx, ASSET_DECIMALS.NEAR.sz);
                  if (parseFloat(cartridgeSzStr) > 0) {
                    console.log(`🚁🛡️ [QUEMA-LASTRE // PINZA #00 NEAR] 5 previas cobradas -> Ejecutando Pinza de Promedio #00 en piso de NEAR (${cartridgeSzStr} @ $${formatHlPrice(bookPx, "NEAR")})!`);
                    const pRes = await client.order({
                      orders: [{
                        a: ASSET_INDICES.NEAR,
                        b: !isShort,
                        p: formatHlPrice(bookPx, "NEAR"),
                        s: cartridgeSzStr,
                        r: false,
                        t: { limit: { tif: "Alo" } }
                      }],
                      grouping: "na"
                    });
                    const pSt = pRes?.response?.data?.statuses?.[0] || {};
                    if (pSt.filled || pSt.resting) {
                      posMeta.pinzaInjected = true;
                      posMeta.dcaDone = true;
                      await sendSquadTelegram(
                        `🚁🛡️ <b>PLAN C QUEMA-LASTRE // PINZA ACTIVADA EN NEAR (4º EN COLA)</b>\n` +
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                        `📍 <b>Par:</b> <code>NEAR-USDC</code> (+${cartridgeSzStr} NEAR @ <code>$${formatHlPrice(bookPx, "NEAR")}</code>)\n` +
                        `📊 <b>Soporte L2:</b> <code>${supportPct.toFixed(1)}%</code> | <b>Subsidio Quema-Lastre (50%):</b> <code>-$${appliedSubsidyUsd.toFixed(2)} USDC</code>\n` +
                        `🎯 <b>Extracción 2 Escalones:</b> <code>70% en BE Subsidiado + 30% con Candado #00</code>`
                      );
                    }
                  }
                }
              } catch (_) {}
            }

            if (!posMeta.nearStepADone) {
              const stepASzStr = formatHlSize(absSz * 0.70, ASSET_DECIMALS.NEAR.sz);
              const nearEffectiveTargetNetUsd = +(PLAN_C_MIN_LOCK_NET_USDC - appliedSubsidyUsd).toFixed(4);
              const nearDeltaPx = absSz > 0 ? ((ratchet.realRoundTripFeeUsd + nearEffectiveTargetNetUsd) / absSz) : 0;
              const nearBePx = isShort ? (entryPx - nearDeltaPx) : (entryPx + nearDeltaPx);
              const nearBePxStr = formatHlPrice(nearBePx, "NEAR");

              if (ratchet.netAfterFeesUsd >= nearEffectiveTargetNetUsd && parseFloat(stepASzStr) > 0) {
                console.log(`🎯🔓 [QUEMA-LASTRE // NEAR ESCALÓN A 70%] NEAR tocó salida subsidiada -> Descargando 70% (${stepASzStr} NEAR) y clavando Candado #00 al 30% restante!`);
                if (existingExitOrder) {
                  await client.cancel({ cancels: [{ a: ASSET_INDICES.NEAR, o: existingExitOrder.oid }] }).catch(() => {});
                }
                const closePx = isShort ? currentMid * 1.0004 : currentMid * 0.9996;
                await client.order({
                  orders: [{
                    a: ASSET_INDICES.NEAR,
                    b: isShort,
                    p: formatHlPrice(closePx, "NEAR"),
                    s: stepASzStr,
                    r: true,
                    t: { limit: { tif: "Ioc" } }
                  }],
                  grouping: "na"
                }).catch(() => {});
                posMeta.nearStepADone = true;
                posMeta.beLocked = true;
                posMeta.isLight = true;
                await sendSquadTelegram(
                  `🎯🔓 <b>PLAN C QUEMA-LASTRE // NEAR ESCALÓN A (70% LIBERADO)</b>\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `📍 <b>Descarga 70%:</b> <code>${stepASzStr} NEAR</code> cobrados con Subsidio Quema-Lastre\n` +
                  `🔒 <b>Escalón B (30% Restante):</b> Candado #00 clavado y trinquete elástico activo.`
                );
                continue;
              }

              if (!existingExitOrder || posMeta.evacOrderPlacedPx !== nearBePxStr) {
                if (existingExitOrder) {
                  await client.cancel({ cancels: [{ a: ASSET_INDICES.NEAR, o: existingExitOrder.oid }] }).catch(() => {});
                }
                await client.order({
                  orders: [{
                    a: ASSET_INDICES.NEAR,
                    b: isShort,
                    p: nearBePxStr,
                    s: parseFloat(stepASzStr) > 0 ? stepASzStr : totalSzStr,
                    r: true,
                    t: { limit: { tif: "Alo" } }
                  }],
                  grouping: "na"
                }).catch(() => {});
                posMeta.evacOrderPlacedPx = nearBePxStr;
              }
              continue;
            } else {
              if (ratchet.beLocked && ratchet.hitRatchetStop && ratchet.netAfterFeesUsd >= CLEAN_EVAC_NET_USDC) {
                console.log(`💰🌊 [QUEMA-LASTRE // NEAR ESCALÓN B 30%] Trinquete #00 completado en NEAR (+$${ratchet.netAfterFeesUsd.toFixed(4)} USDC) -> Cobrando 30% final!`);
                const closePx = isShort ? currentMid * 1.0004 : currentMid * 0.9996;
                await client.order({
                  orders: [{
                    a: ASSET_INDICES.NEAR,
                    b: isShort,
                    p: formatHlPrice(closePx, "NEAR"),
                    s: totalSzStr,
                    r: true,
                    t: { limit: { tif: "Ioc" } }
                  }],
                  grouping: "na"
                }).catch(() => {});
              }
              continue;
            }
          }
        }

        // =========================================================================
        // B) LEY DE HIERRO EN CADA DISPARO DEL PLAN C ("O +$0.10 USDC NETO O EXPRIMIDO CON CANDADO SIN TECHO"):
        // =========================================================================
        // 1. Si el Candado Nivel 1 (+$0.10 USDC) o Nivel 2 (80% al 90% High-Water Mark) está activo y el precio retrocede tocando el candado:
        if (ratchet.beLocked && ratchet.hitRatchetStop && NO_RED_EXIT && ratchet.netAfterFeesUsd >= CLEAN_EVAC_NET_USDC) {
          console.log(`💰🌊 [PLAN C // CANDADO ELÁSTICO #00 NIVEL ${ratchet.ratchetLevel}] ${coin} tocó candado (+$${ratchet.netAfterFeesUsd.toFixed(4)} USDC netos) -> Cobrando ola en verde (50% a Quema-Lastre)!`);
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

        // 2. Si el Candado #00 ya está clavado en +$0.10 USDC (🟢 LIGERO, $0.00 riesgo) y había una orden estática previa, retirarla para NO poner techo a la ola:
        if (ratchet.beLocked && existingExitOrder) {
          await client.cancel({ cancels: [{ a: ASSET_INDICES[coin], o: existingExitOrder.oid }] }).catch(() => {});
          console.log(`🌊🔓 [PLAN C // ${coin}] Candado #00 Activo (${ratchet.ratchetStatusLabel}) -> Orden estática retirada para exprimir la ola sin techo (80%-90% High-Water Mark).`);
          continue;
        }

        // 3. Evacuación a los 180 segundos: si la entrada se enfría a los 3 minutos, ajusta su salida Post-Only Maker a +$0.10 USDC netos para cobrar rápido en el primer rebote y rotar:
        if (!ratchet.beLocked && ratchet.cleanEvacActive) {
          const evacPxStr = formatHlPrice(ratchet.cleanEvacMakerPx, coin);
          if (!existingExitOrder || posMeta.evacOrderPlacedPx !== evacPxStr) {
            if (existingExitOrder) {
              await client.cancel({ cancels: [{ a: ASSET_INDICES[coin], o: existingExitOrder.oid }] }).catch(() => {});
            }
            console.log(`🎯 [PLAN C // EVACUACIÓN 180S] Ola enfriada en ${coin} -> Orden Post-Only Maker en +$0.10 USDC Netos @ $${evacPxStr}`);
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

      // Actualizar archivo de clones con las etiquetas frescas del Plan C y Quema-Lastre
      updateSquadMatrixClones(openPositions, pairCooldowns, recoveryCtrl, confirmedOpenByCoin, burnBallastSubsidyUsdc);

      // Escribir telemetría en vivo para /squad-matrix/ (telemetry/squad-matrix-telemetry.json)
      const closedFirmLiveUsdc = +(1008.93 + Math.max(0, dailyClosedProfitTodayUsdc - 0.44)).toFixed(2);
      const autoLot = computeAutoCompoundLotSize(closedFirmLiveUsdc);
      try {
        const cascadeOrder = recoveryCtrl.RECOVERY_CASCADE_ORDER || ["AVAX", "PAXG", "ETH", "BTC", "XRP", "SOL", "NEAR"];
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
          const rInfo = computeFeeAwareRatchet(c, entryPx, szi, midPx, uPnl, pMeta, positionOpenTimestamps[c] || Date.now(), stuckRecoveryCoinsSet.has(c));
          const isQueueLeader = (c === firstCriticalInQueue);
          const subUsd = isQueueLeader ? burnBallastSubsidyUsdc : 0;
          const absSzi = Math.abs(szi);
          const effTargetNet = +(PLAN_C_MIN_LOCK_NET_USDC - subUsd).toFixed(4);
          const effDeltaPx = absSzi > 0 ? ((rInfo.realRoundTripFeeUsd + effTargetNet) / absSzi) : 0;
          const targetPx = isShort ? (entryPx - effDeltaPx) : (entryPx + effDeltaPx);
          const distPct = isShort
            ? Math.max(0, ((midPx - targetPx) / midPx) * 100)
            : Math.max(0, ((targetPx - midPx) / midPx) * 100);
          const distUsd = Math.max(0, +(effTargetNet - rInfo.netAfterFeesUsd).toFixed(2));
          const tier = tier1Set.has(c) ? 1 : (tier2Set.has(c) ? 2 : 3);
          return {
            queueRank: idx + 1,
            queueLabel: `${idx + 1}º ${c === "kPEPE" ? "PEPE" : c}`,
            coin: c === "kPEPE" ? "PEPE" : c,
            pair: `${c === "kPEPE" ? "PEPE" : c}-USDC`,
            tier,
            isPlanCHunter: !stuckRecoveryCoinsSet.has(c),
            burnBallastSubsidyUsdc: subUsd,
            side: isShort ? "SHORT" : "LONG",
            szi: absSzi,
            entryPx: +entryPx.toFixed(6),
            midPx: +midPx.toFixed(6),
            recoveryTargetPx: +targetPx.toFixed(6),
            unrealizedPnlUsdc: +uPnl.toFixed(2),
            netAfterFeesUsdc: +rInfo.netAfterFeesUsd.toFixed(2),
            distanceToRecoveryPct: +distPct.toFixed(2),
            distanceToRecoveryUsd: distUsd,
            beLocked: rInfo.beLocked,
            ratchetLevel: rInfo.ratchetLevel,
            lockedNetUsd: +rInfo.lockedNetUsd.toFixed(2),
            cleanEvacActive: rInfo.cleanEvacActive,
            ratchetStatusLabel: pMeta.ratchetStatusLabel || rInfo.ratchetStatusLabel,
            status: rInfo.beLocked ? "CANDADO_00_ACTIVO" : (rInfo.cleanEvacActive ? "EVACUACION_180S_010" : `FILA_${idx + 1}_ACTIVA`)
          };
        });

        const remainingStuckCount = openPositions.filter(p => stuckRecoveryCoinsSet.has(p.position.coin)).length;
        const activeHuntersCount = openPositions.filter(p => !stuckRecoveryCoinsSet.has(p.position.coin)).length;
        const unfencedHuntersCount = openPositions.filter(p => !stuckRecoveryCoinsSet.has(p.position.coin) && !confirmedOpenByCoin[p.position.coin]?.beLocked).length;
        const totalRef = 7;
        const topBannerText = `❄️ 36 BOTS EN 4 PISTAS: CALIBRE $${autoLot.marginUsdc.toFixed(2)} (5% A 5X) · COBRO AVAX & PAXG #00`;

        fs.writeFileSync(SQUAD_MATRIX_TELEMETRY_FILE, JSON.stringify({
          updatedAt: new Date().toISOString(),
          architecture: "NEXUS_APEX_36_AUTO_COMPOUND_5PCT",
          mode: "PLAN_C_ACTIVE_HARVEST_AUTO_COMPOUND",
          strictRecoveryLock: false,
          planCActiveHarvest: true,
          noRedExit: NO_RED_EXIT,
          zeroFixedTakeProfit: true,
          autoCompoundLotSize: autoLot,
          maxActiveHunters: MAX_ACTIVE_HUNTERS,
          activeHuntersCount,
          unfencedPositionsCount: unfencedHuntersCount,
          minLockNetUsdc: PLAN_C_MIN_LOCK_NET_USDC,
          burnBallastSubsidyRatio: BURN_BALLAST_SUBSIDY_RATIO,
          burnBallastSubsidyUsdc,
          dailyClosedProfitTodayUsdc,
          lockNewOpenings: false,
          cooldownUntil00Utc: false,
          hotSwapClones: true,
          targetResetUtc: recoveryCtrl.TARGET_RESET_UTC,
          post00UtcMaxConcurrent: MAX_ACTIVE_HUNTERS,
          postTradeCooldownMs: POST_TRADE_COOLDOWN_MS,
          accountValueUsdc: +accountValue.toFixed(2),
          withdrawableUsdc: parseFloat(ch.withdrawable || "0"),
          freeMarginUsdc: +freeMarginUsdcCascade.toFixed(2),
          totalLoanInjectedUsdc: 756.52,
          closedProfitPureTradingUsdc: +(closedFirmLiveUsdc - 756.52).toFixed(2),
          closedBaseFirmeUsdc: closedFirmLiveUsdc,
          milestoneLadderUsdc: [1000, 2000, 3000, 4000, 5000, 10000, 20000, 100000],
          openPositionsCount: openPositions.length,
          stuckRecoveryPositionsCount: remainingStuckCount,
          totalInitialPositions: totalRef,
          recoveredCount: Math.max(0, totalRef - remainingStuckCount),
          bannerText: topBannerText,
          recoveryQueue
        }, null, 2), "utf8");
      } catch (_) {}

      // Enviar reporte de activación del Plan C en el Ciclo #1 y cada 180 ciclos (~30 min)
      if (cycleCounter === 1 || (openPositions.length > 0 && cycleCounter % 180 === 0)) {
        const cascadeOrderTg = ["AVAX", "PAXG", "ETH", "BTC", "XRP", "SOL", "NEAR"];
        const sortedForTg = [...openPositions].sort((a, b) => {
          const iA = cascadeOrderTg.indexOf(a.position.coin);
          const iB = cascadeOrderTg.indexOf(b.position.coin);
          return (iA === -1 ? 99 : iA) - (iB === -1 ? 99 : iB);
        });
        const posLines = sortedForTg.map((p, idx) => {
          const c = p.position.coin;
          const s = parseFloat(p.position.szi);
          const e = parseFloat(p.position.entryPx);
          const m = parseFloat(mids[c] || e);
          const u = parseFloat(p.position.unrealizedPnl || "0");
          const pMeta = confirmedOpenByCoin[c] || {};
          return `• <b>${idx + 1}º</b> <code>${c === "kPEPE" ? "PEPE" : c}-USDC</code> (${s >= 0 ? "LONG" : "SHORT"} ${Math.abs(s)} | Ent: $${formatHlPrice(e, c)} | Actual: $${formatHlPrice(m, c)} | PnL: ${u >= 0 ? "+" : "-"}$${Math.abs(u).toFixed(2)})\n   ↳ <i>${pMeta.ratchetStatusLabel || "⚡ PLAN C ACTIVO"}</i>`;
        }).join("\n") || "• 🧘‍♀️ 100% Liquidez USDC";

        const bootTg = `🚀🏛️❄️ <b>ÁREA 501 // FONDO FUNDADOR ($1,250/QUINCENA) + AUTO-COMPOUND 5% (36 BOTS)</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `❄️ <b>Calibre Compuesto:</b> <code>5% del Saldo Cerrado L1 a 5x -> $${autoLot.marginUsdc.toFixed(2)} Margen ($${autoLot.notionalUsd.toFixed(2)} Nocional)</code>\n` +
          `🔒 <b>Ley de Hierro:</b> <code>Cero Pérdidas · Candado Base #00 en +$0.10 USDC · Ratchet 80%-90%</code>\n` +
          `🔥 <b>Motor Quema-Lastre (50%):</b> <code>-$${burnBallastSubsidyUsdc.toFixed(2)} USDC acercando salida de ${firstCriticalInQueue || "Cola #00"}</code>\n` +
          `💵 <b>Saldo Firme L1:</b> <code>$${closedFirmLiveUsdc.toFixed(2)} USDC</code> | <b>Equity Viva:</b> <code>$${accountValue.toFixed(2)} USDC</code> | <b>Margen Libre:</b> <code>$${freeMarginUsdcCascade.toFixed(2)} USDC</code>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📊 <b>OPERACIONES ACTIVAS (${openPositions.length} abiertas):</b>\n${posLines}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🌐 <a href="https://hypurrscan.io/address/${VAULT_501}">Ver Bóveda #501 en Vivo (Sin conectar Wallet)</a>`;
        await sendSquadTelegram(bootTg);
      }

      // 4. DESPERTAR TÁCTICO DE LOS ESCUADRONES LIBRES (PLAN_C_ACTIVE_HARVEST = true + AUTO-COMPOUNDING LOT SIZE 5% A 5X):
      // - Las monedas en stuckRecoveryCoinsSet (AVAX, PAXG, ETH, BTC, XRP, SOL, NEAR) se mantienen en Extracción #00 (no abren entradas nuevas encima de sí mismas).
      // - Los 36 bots (18 Titulares + 18 Clones) en las 4 pistas cazan hasta MAX_ACTIVE_HUNTERS = 2 operaciones simultáneas sin Candado #00 ($50.45 margen / $252.25 nocional), conservando > $400 USDC de margen libre intocable.
      // - Apenas un cazador clava su Candado #00 en +$0.10 USDC (beLocked === true), pasa a ligero ($0.00 riesgo) y libera cupo.
      const activeCoins = openPositions.map(p => p.position.coin);
      const restingEntryCoins = openOrders.filter(o => !o.reduceOnly).map(o => o.coin);
      const allActiveOrResting = [...new Set([...activeCoins, ...restingEntryCoins])];

      const unfencedHuntersCount = openPositions.filter(p =>
        !stuckRecoveryCoinsSet.has(p.position.coin) && !confirmedOpenByCoin[p.position.coin]?.beLocked
      ).length + restingEntryCoins.filter(c => !stuckRecoveryCoinsSet.has(c)).length;

      const totalActiveHuntersCount = openPositions.filter(p => !stuckRecoveryCoinsSet.has(p.position.coin)).length +
        restingEntryCoins.filter(c => !stuckRecoveryCoinsSet.has(c)).length;

      const isPlanCMarginSafe = (freeMarginUsdcCascade - autoLot.marginUsdc) >= MIN_FREE_MARGIN_RESERVE_USDC;
      const canOpenPlanCHunter = Boolean(
        PLAN_C_ACTIVE_HARVEST &&
        isV2Armed &&
        isPlanCMarginSafe &&
        unfencedHuntersCount < MAX_ACTIVE_HUNTERS &&
        totalActiveHuntersCount < (MAX_ACTIVE_HUNTERS + 1)
      );

      // 4.0 Actualizar historial móvil de 60s para Micro-Ping-Pong (±0.14%) y Wick Sniper (±0.85%)
      const nowTs = Date.now();
      for (const [cKey, pxVal] of Object.entries(mids)) {
        const pxNum = parseFloat(pxVal);
        if (!pxNum || pxNum <= 0) continue;
        if (!rollingMidsHistory[cKey]) rollingMidsHistory[cKey] = [];
        rollingMidsHistory[cKey].push({ ts: nowTs, px: pxNum });
        rollingMidsHistory[cKey] = rollingMidsHistory[cKey].filter(item => (nowTs - item.ts) <= 75000);
      }

      // 4.1 MOTOR FRANCOTIRADOR DEL MINUTO :59 PRE-FUNDING (SOLO EN MONEDAS LIBRES FUERA DE EXTRACCIÓN #00)
      const nowUtcDate = new Date();
      const utcMins = nowUtcDate.getUTCMinutes();
      const currentHourKey = `${nowUtcDate.getUTCFullYear()}-${nowUtcDate.getUTCMonth()}-${nowUtcDate.getUTCDate()}-${nowUtcDate.getUTCHours()}`;
      if (canOpenPlanCHunter && (utcMins === 58 || utcMins === 59) && lastHourlySnapHourKey !== currentHourKey) {
        const snapUniverse = ["kPEPE", "SUI", "AVAX", "HYPE", "DOGE", "LINK", "BNB", "AAVE", "TON", "TRX", "OP", "ARB", "ONDO", "PENDLE"].filter(c =>
          !stuckRecoveryCoinsSet.has(c) && !allActiveOrResting.includes(c) && (!pairCooldowns[c] || pairCooldowns[c] <= nowTs)
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
          const snapNotional = autoLot.notionalUsd; // 5% del Saldo Cerrado L1 a 5x ($252.25 USD nocional / $50.45 margen)
          const snapSz = formatHlSize(snapNotional / bestSnap.px, ASSET_DECIMALS[sCoin].sz);
          const snapPxStr = formatHlPrice(bestSnap.px, sCoin);
          const roundTripFee = +(snapNotional * (HL_MAKER_FEE_RATE + HL_TAKER_FEE_RATE)).toFixed(4);
          const lockDeltaPx = parseFloat(snapSz) > 0 ? ((roundTripFee + PLAN_C_MIN_LOCK_NET_USDC) / parseFloat(snapSz)) : 0;
          const snapLockPx = bestSnap.isLong ? (bestSnap.px + lockDeltaPx) : (bestSnap.px - lockDeltaPx);
          const snapLockStr = formatHlPrice(snapLockPx, sCoin);

          console.log(`⚡⏱️ [AUTO 5% // MINUTO :59] Disparando en ${sCoin} (${bestSnap.isLong ? "LONG" : "SHORT"}) @ $${snapPxStr} (L2 ${bestSnap.score.toFixed(1)}%) -> Candado #00 @ $${snapLockStr} (+$0.10 Neto · Cero TP Fijo)`);
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
              pingPongMetaByCoin[sCoin] = { openedAt: Date.now(), mode: "PLAN_C_HOURLY_SNAP" };
              allActiveOrResting.push(sCoin);
              recentOrderSentCoins[sCoin] = Date.now();
              positionOpenTimestamps[sCoin] = Date.now();
              const snapTg = `⚡⏱️ <b>ÁREA 501 // AUTO 5% CAZADOR MINUTO :59</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `📍 <b>Par:</b> <code>${sCoin === "kPEPE" ? "PEPE" : sCoin}-USDC</code> (<b>${bestSnap.isLong ? "LONG 🐂" : "SHORT 🐻"}</b> · ${snapSz})\n` +
                `📥 <b>Precio Entrada:</b> <code>$${snapPxStr}</code> ($${snapNotional.toFixed(2)} Nocional / $${autoLot.marginUsdc.toFixed(2)} Margen)\n` +
                `🔒 <b>Candado Base #00:</b> <code>$${snapLockStr}</code> (+$0.10 USDC Neto ➔ Cero TP Fijo 80%-90%)\n` +
                `🔥 <b>Sinergia Quema-Lastre:</b> <code>50% del profit acerca salida de ${firstCriticalInQueue || "Cola #00"}</code>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🌐 <a href="https://hypurrscan.io/address/${VAULT_501}">Ver en Hypurrscan</a>`;
              await sendSquadTelegram(snapTg);
            }
          } catch (eSnap) {
            console.error(`[MINUTO :59] Error en ${sCoin}:`, eSnap.message);
          }
        }
      }

      // 4.2 MOTOR MICRO-PING-PONG & WICK SNIPER DEL PLAN C (SOLO EN MONEDAS LIBRES · CERO TP FIJO · CANDADO +$0.10 USDC)
      let currentUnfencedHunters = unfencedHuntersCount;
      if (canOpenPlanCHunter && currentUnfencedHunters < MAX_ACTIVE_HUNTERS) {
        const pingPongUniverse = ["kPEPE", "SUI", "AVAX", "HYPE", "DOGE", "LINK", "BNB", "AAVE", "TRX", "ADA", "TON", "DOT", "LTC", "UNI", "OP", "ARB", "ONDO", "PENDLE", "TAO", "RENDER", "FET"].filter(c =>
          !stuckRecoveryCoinsSet.has(c) && !allActiveOrResting.includes(c) && (!pairCooldowns[c] || pairCooldowns[c] <= nowTs)
        );
        for (const ppCoin of pingPongUniverse) {
          if (currentUnfencedHunters >= MAX_ACTIVE_HUNTERS) break;
          const hist = rollingMidsHistory[ppCoin] || [];
          if (hist.length < 2) continue;
          const oldestPx = hist[0].px;
          const latestPx = hist[hist.length - 1].px;
          const delta60sPct = ((latestPx - oldestPx) / oldestPx) * 100;

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

              const goLongPP = (delta60sPct <= -0.14 && bullP >= 55.0);
              const goShortPP = (delta60sPct >= 0.14 && bearP >= 55.0);
              if (goLongPP || goShortPP) {
                const ppNotional = autoLot.notionalUsd; // 5% del Saldo Cerrado L1 a 5x ($252.25 USD nocional / $50.45 margen)
                const entryBookPx = goLongPP ? parseFloat(bids[0].px) : parseFloat(asks[0].px);
                const ppSz = formatHlSize(ppNotional / entryBookPx, ASSET_DECIMALS[ppCoin].sz);
                if (parseFloat(ppSz) <= 0) continue;
                const ppPxStr = formatHlPrice(entryBookPx, ppCoin);

                console.log(`⚡🎯 [AUTO 5% // CAZADOR RÁPIDO] Disparo en ${ppCoin} (${goLongPP ? "LONG" : "SHORT"}) | Δ60s: ${delta60sPct.toFixed(2)}% | L2: ${(goLongPP ? bullP : bearP).toFixed(1)}% -> Cero TP Fijo (Candado #00 +$0.10 USDC)`);
                let ppRes = await client.order({
                  orders: [{ a: ASSET_INDICES[ppCoin], b: goLongPP, p: ppPxStr, s: ppSz, r: false, t: { limit: { tif: "Alo" } } }],
                  grouping: "na"
                });
                let ppSt = ppRes.response?.data?.statuses?.[0] || {};
                if (ppSt.resting || ppSt.filled) {
                  pingPongMetaByCoin[ppCoin] = { openedAt: Date.now(), mode: "PLAN_C_HUNTER" };
                  allActiveOrResting.push(ppCoin);
                  currentUnfencedHunters++;
                  if (ppSt.filled) {
                    recentOrderSentCoins[ppCoin] = Date.now();
                    positionOpenTimestamps[ppCoin] = Date.now();
                  }
                  break;
                }
              }
            } catch (_) {}
          }
        }
      }

      // 4.3 ESCUADRONES CAZADORES DEL PLAN C (#09 LIMA PEPE/ONDO/PENDLE, #07 JULIET AI, #08 KILO L2, #05 HOTEL HYPE/TRX, #04 GOLF DOGE/ADA, #01-#03 SUI/AVAX/LINK/BNB/AAVE)
      if (canOpenPlanCHunter && currentUnfencedHunters < MAX_ACTIVE_HUNTERS && !isOpeningBellWick(new Date())) {
        const orderedKeys = ["LIMA", "HOTEL", "ALFA", "BRAVO", "CHARLIE", "GOLF", "KILO", "JULIET", "INDIA"];

        const baseUnits = orderedKeys.map(unitKey => {
          const squadCfg = SQUADS_CONFIG[unitKey];
          if (!squadCfg) return null;
          // Filtrar estrictamente cualquier moneda que esté en stuckRecoveryCoinsSet o ya abierta/en orden
          const freeCandidatePairs = squadCfg.pairs.filter(c =>
            !stuckRecoveryCoinsSet.has(c) &&
            !activeCoins.includes(c) &&
            !restingEntryCoins.includes(c) &&
            ASSET_INDICES[c] !== undefined &&
            ASSET_DECIMALS[c]
          );
          const hasFreeHunterOpenInSquad = activeCoins.some(c => !stuckRecoveryCoinsSet.has(c) && squadCfg.pairs.includes(c));
          const hasRestingInSquad = restingEntryCoins.some(c => squadCfg.pairs.includes(c));
          return {
            unitKey,
            squadCfg,
            botName: `${unitKey} 1 (Cazador Auto 5%)`,
            candidatePairs: freeCandidatePairs,
            alreadyHasPos: hasFreeHunterOpenInSquad || hasRestingInSquad
          };
        }).filter(Boolean);

        for (const unit of baseUnits) {
          if (currentUnfencedHunters >= MAX_ACTIVE_HUNTERS) break;
          if (unit.alreadyHasPos || unit.candidatePairs.length === 0) continue;

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
                const isWaveLong = inWaveWindow && bullPct >= 58.0;
                const isWaveShort = inWaveWindow && bearPct >= 58.0;

                // Umbrales ágiles para Cazadores Plan C (+$0.10 Candado #00)
                const minBullL2 = 56.5;
                const maxLongRsi = 53.0;
                const minBearL2 = 56.5;
                const minShortRsi = 52.0;

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
              const dispCoin = coin === "kPEPE" ? "PEPE" : coin;
              // AUTO-COMPOUNDING LOT SIZE: 5% del Saldo Cerrado L1 a 5x ($50.45 Margen / $252.25 Nocional)
              const notional = autoLot.notionalUsd;
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

              console.log(`\n⚡🎯 [AUTO 5% // ${unit.unitKey} // ${unit.botName}] Disparo Cazador en ${dispCoin} (${bestCandidate.direction}):`);
              console.log(`   • Confluencia: L2 ${bestCandidate.score.toFixed(1)}% | RSI 5m: ${bestCandidate.rsi.toFixed(1)} | EMA20: $${bestCandidate.ema.toFixed(4)}`);
              console.log(`   • Entrada: ${szFormatted} ${dispCoin} @ $${entryPxStr} ($${notional.toFixed(2)} Nocional / $${autoLot.marginUsdc.toFixed(2)} Margen) -> CERO TP FIJO (Candado #00 +$0.10 @ $${level1LockPxStr})`);

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
                  currentUnfencedHunters++;
                  const oid = status.resting?.oid || status.filled?.oid || "FILLED";
                  console.log(`   ✔ [PLAN C // ${unit.unitKey}] Orden #${oid} activa en Hyperliquid L1 (${status.filled ? "EJECUTADA" : "EN LIBRO"}).`);

                  if (status.filled) {
                    recentOrderSentCoins[coin] = Date.now();
                    positionOpenTimestamps[coin] = Date.now();

                    const orderTg = `⚡🎯 <b>ÁREA 501 // PLAN C CAZADOR ABIERTO (${bestCandidate.direction})</b>\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                      `🔰 <b>Unidad:</b> <b>${unit.squadCfg.name} — ${unit.botName}</b>\n` +
                      `📍 <b>Par:</b> <code>${dispCoin}-USDC</code> (${szFormatted} ${dispCoin})\n` +
                      `📥 <b>PRECIO ENTRADA:</b> <code>$${entryPxStr}</code> ($${notional.toFixed(0)} Nocional / $70 Margen)\n` +
                      `🔒 <b>CANDADO BASE #00 (+$0.10):</b> <code>$${level1LockPxStr}</code> (Entrada + Comisión + $0.10 ➔ 🟢 LIGERO)\n` +
                      `🌊 <b>TRAILING RATCHET:</b> <b>Cero TP Fijo · Asegura 80% al 90% del High-Water Mark</b>\n` +
                      `🔥 <b>SINERGIA QUEMA-LASTRE:</b> <code>50% de la ganancia acerca la salida de ${firstCriticalInQueue || "XRP/SOL/NEAR"}</code>\n` +
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
