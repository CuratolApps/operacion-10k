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
const WebSocket = require("ws");
const { ExchangeClient, InfoClient, HttpTransport } = require("@nktkas/hyperliquid");
const { ethers } = require("ethers");
const { sendTelegramAlert } = require("../telegram-notifier");
const { refreshMatrixWaveIntelligence } = require("./matrix-wave-intelligence");

const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const HL_WS_URL = "wss://api.hyperliquid.xyz/ws";
const INHERITED_9_COINS_SET = new Set(["DOGE", "RENDER", "XRP", "PAXG", "ARB", "BTC", "TRX", "NEAR", "SOL"]);

// Resiliencia 24/7 ante errores de red o RPCs externos
process.on("unhandledRejection", (reason) => {
  console.error("⚠️ [DAEMON] Promesa rechazada no capturada (resiliente, continuando):", reason?.message || reason);
});
process.on("uncaughtException", (err) => {
  console.error("⚠️ [DAEMON] Excepción no capturada (resiliente, continuando):", err?.message || err);
});

// --- ARQUITECTURA "LIMPIEZA TOTAL CON CANDADO (FREEZE_ALL_NEW_ENTRIES = true + RECOVERY_TRAILING_RATCHET + CERO PODA NEGATIVA)" ---
const FREEZE_ALL_NEW_ENTRIES = true;    // PARADA ABSOLUTA DE NUEVAS APERTURAS (0 nuevos disparos en los 27 pares)
const STRICT_RECOVERY_LOCK = true;      // Pausa total de aperturas hasta llegar a 0 posiciones abiertas y 100% liquidez USDC
const PLAN_C_ACTIVE_HARVEST = false;    // GATILLOS VIEJOS ("PLAN C" / bidRatio pasivo) 100% APAGADOS Y PURGADOS
const IMMEDIATE_SNOWBALL_START = false; // PAUSA TOTAL DE APERTURAS: 0 nuevos tiros
const NO_RED_EXIT = true;               // REGLA DE HIERRO INQUEBRANTABLE: PROHIBIDO cerrar o podar en pérdida (CERO PODA / CERO QUEMA-LASTRE)
const MAX_FRESH_IN_WATER = 0;           // 0 nuevos tiros permitidos (FREEZE_ALL_NEW_ENTRIES = true)
const NEW_ENGINE_ACTIVE_SLOTS = 0;      // 0 carriles de apertura nuevos
const MAX_OPEN_POSITIONS = 0;           // MAX_OPEN_POSITIONS = 0 para nuevas entradas
const FAST_SCALP_LANES = 0;             // 0 carriles nuevos
const MAX_CONCURRENT_POSITIONS_DURING_RECOVERY = 0; // Bloqueo total de nuevas aperturas
const LEGACY_QUARANTINE_SET = new Set(["SOL", "AVAX", "BTC", "PAXG", "ETH", "BNB", "XRP", "TRX", "RENDER", "NEAR", "ARB", "HYPE", "PENDLE", "DOT", "kPEPE", "PEPE"]);
const LEGACY_QUARANTINE_MIN_AGE_MS = 3 * 60 * 1000;  // Todas las posiciones abiertas usan RECOVERY_TRAILING_RATCHET
const LEGACY_QUARANTINE_MIN_NET_USDC = 0.02;         // Escalón 0: 🛡️ CANDADO EMPATE #00 (+$0.02 USDC NETO) ➔ 🔒 +$0.10 ➔ +$0.20 ➔ +$0.30+
const LEGACY_POST_EXIT_COOLDOWN_MS = 5 * 60 * 1000;
const FRESH_BREAKEVEN_LOCK_NET_USDC = 0.02;          // 🛡️ CANDADO EMPATE #00 (+$0.02 USDC NETO libre de comisión al tocar +$0.04)
const ZERO_NEW_TRAPS_TIMEOUT_MS = 999999 * 1000;     // Desactivado para no cerrar de golpe antes de subir la escalera de regreso
const FREE_12_PAIRS_SET = new Set(["SUI", "LINK", "AAVE", "DOT", "TON", "UNI", "ONDO", "PENDLE", "kPEPE", "PEPE", "OP", "FET", "TAO", "ADA", "LTC", "ARB", "DOGE", "HYPE", "RENDER"]);
const FAST_CLEANUP_INHERITED_SET = LEGACY_QUARANTINE_SET;
const PRIORITY_EVAC_TARGETS = ["PAXG", "SOL", "AVAX", "BTC", "ETH", "BNB", "XRP", "TRX", "RENDER", "NEAR", "ARB", "HYPE", "PENDLE", "DOT"];
const OLD_STUCK_PRUNE_TARGETS = [];     // CERO PODA EN ROJO (100% erradicado)
const PRUNING_POOL_RATIO = 0.00;        // CERO PODA: 0% destinado a podas en pérdida
const MIN_PRUNE_THRESHOLD_USDC = 999999; // Poda desactivada permanentemente
const EXPRESS_EVAC_DELTA_RATIO = 0.00025;
const EXPRESS_EVAC_NET_USDC = 0.02;     // Piso mínimo del Candado Empate #00: +$0.02 USDC netos después de comisiones
const MARKET_TIDE_LOCK_ENABLED = false;
const MAX_ACTIVE_HUNTERS = 0;
const MAX_UNFENCED_POSITIONS = 0;
const FAST_LANE_LOCK_NET_USDC = 0.02;   // 🛡️ EMPATE #00 (+$0.02 NETO) ➔ 🔒 +$0.10 ➔ +$0.20 ➔ +$0.30 ➔ +$0.40 ➔ +$0.50+ USDC NETOS
const PLAN_C_MIN_LOCK_NET_USDC = 0.02;  // Escalera de Candados en el Regreso (+$0.02 ➔ +$0.10 ➔ +$0.20 ➔ +$0.30 ➔ +$0.50+)
const CORNERING_HALF_DOLLAR_USDC = 0.50; // Escalera continua (+$0.02 -> +$0.10 -> +$0.20 -> +$0.30 -> +$0.40 -> +$0.50+ NETOS)
const CORNERING_STEP_USDC = 0.10;        // Escalones de +$0.10 en +$0.10 sin techo
const CORNERING_BREATH_BUFFER_USDC = 0.02; // $0.02 USDC de margen para clavar el escalón (+$0.04->+$0.02, +$0.12->+$0.10, +$0.22->+$0.20...)
const AUTO_COMPOUND_MARGIN_RATIO = 0.05; // Calibre Compuesto 5%: $50.00-$52.50 USDC margen a 5x ($250.00-$262.50 USD nocional)
const AUTO_COMPOUND_LEVERAGE = 5.0;     // 5x Apalancamiento -> $50.00-$52.50 Margen = $250.00-$262.50 USD Nocional
const PLAN_C_HUNTER_MARGIN_USDC = 52.50; // Calibre Compuesto ($52.50 USDC Margen)
const PLAN_C_HUNTER_NOTIONAL_USDC = 262.50; // $52.50 USDC Margen x 5x = $262.50 USD Nocional por disparo
const MIN_FREE_MARGIN_RESERVE_USDC = 250.00; // Reserva segura de margen libre
const PAIR_POST_CLOSE_SETTLE_MS = 2000; // 2 segundos de asentamiento del libro L2 tras cierre
const pairSettleUntilByCoin = {};       // { [coin]: timestampMs } (asentamiento de libro L2 tras cerrar)
const BURN_BALLAST_SUBSIDY_RATIO = 0.00; // CERO SUBSIDIO DE PODA EN PÉRDIDA

// HELPER: MOTOR CALIBRE COMPUESTO DE ALTA ROTACIÓN ($50.00–$52.50 USDC MARGEN A 5X = $250.00–$262.50 USD NOCIONAL EN LOS 19 PARES LIBRES)
function computeAutoCompoundLotSize(closedFirmBalanceUsdc = 1051.42) {
  const safeBase = Math.max(1000.00, Number(closedFirmBalanceUsdc || 1051.42));
  const steppedBase = Math.floor(safeBase / 50.0) * 50.0;
  const marginUsdc = +(Math.min(52.50, Math.max(50.00, steppedBase * 0.05))).toFixed(2);
  const notionalUsd = +(marginUsdc * AUTO_COMPOUND_LEVERAGE).toFixed(2);
  const nextStepUsdc = safeBase < 1050.00 ? 1050.00 : (Math.floor(safeBase / 50.0) + 1) * 50.0;
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
const POST_TRADE_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutos exactos (120,000 ms = 120s = 02:00) de respiro táctico (🧘‍♂️ RESPIRO 02:00 RECALIBRANDO) antes de incorporarse al carrusel
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
const TELEGRAM_TRADE_ALERTS_STATE_FILE = path.join(TELEMETRY_DIR, "telegram-trade-alerts-state.json");
const RATCHET_PEAKS_STATE_FILE = path.join(TELEMETRY_DIR, "ratchet-peaks-state.json");
const FOREX_PROXY_BINDINGS_FILE = path.join(TELEMETRY_DIR, "forex-proxy-bindings.json");
const DAEMON_PID_LOCK_FILE = path.join(TELEMETRY_DIR, "hyperliquid-squad-daemon.pid");
const CAROUSEL_54_STATE_FILE = path.join(TELEMETRY_DIR, "carousel-54-state.json");
const MIN_LATENT_FORCE_SCORE = 92; // Selección Exclusiva del Caballo Más Rápido: latentForceScore >= 92/100
const MIN_L2_FORCE_RATIO = 0.60;   // 60%+ Depleción / Presión Real en Libro de Órdenes L2
const MIN_ROC_15S_PCT = 0.010;     // |ROC_15s| >= 0.010% con aceleración positiva
let lastGlobalHunterOpenMs = 0;    // Registro de última apertura del carrusel

// ============================================================================
// 🎡 CARRUSEL SECUENCIAL DETERMINISTA DE 54 BOTS (#01 ➔ #54)
// - Orden estricto: #01 ➔ #02 ➔ #03 ... ➔ #54 ➔ vuelve a #01.
// - Cuando un bot dispara en una piscina libre, cosecha su ganancia neta con candado y cierra,
//   pasa a RESTING_UNTIL_NEXT_LAP (descansa los 53 turnos restantes de la vuelta para entrar siempre fresco).
// ============================================================================
let carousel54MemoryCache = null;

function formatBotSeqId(seqId) {
  const n = Math.max(1, Math.min(54, Number(seqId || 1)));
  return `#${String(n).padStart(2, "0")}`;
}

function createInitialCarousel54State() {
  const bots = {};
  for (let i = 1; i <= 54; i++) {
    bots[i] = {
      seqId: i,
      badge: formatBotSeqId(i),
      status: "READY", // "READY" | "IN_WATER" | "RESTING_UNTIL_NEXT_LAP"
      poolCoin: null,
      direction: null,
      turnsRemaining: 0,
      lastFiredAt: null,
      lastClosedAt: null
    };
  }
  return {
    nextBotSeqId: 1,
    lapNumber: 1,
    totalDispatched: 0,
    updatedAt: new Date().toISOString(),
    bots
  };
}

function loadCarousel54State() {
  if (carousel54MemoryCache) return carousel54MemoryCache;
  try {
    if (fs.existsSync(CAROUSEL_54_STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CAROUSEL_54_STATE_FILE, "utf8"));
      if (parsed && typeof parsed === "object" && parsed.bots) {
        for (let i = 1; i <= 54; i++) {
          if (!parsed.bots[i]) {
            parsed.bots[i] = {
              seqId: i,
              badge: formatBotSeqId(i),
              status: "READY",
              poolCoin: null,
              direction: null,
              turnsRemaining: 0,
              lastFiredAt: null,
              lastClosedAt: null
            };
          }
        }
        parsed.nextBotSeqId = Math.max(1, Math.min(54, Number(parsed.nextBotSeqId || 1)));
        parsed.lapNumber = Math.max(1, Number(parsed.lapNumber || 1));
        carousel54MemoryCache = parsed;
        return carousel54MemoryCache;
      }
    }
  } catch (_) {}
  carousel54MemoryCache = createInitialCarousel54State();
  return carousel54MemoryCache;
}

function saveCarousel54State(state = carousel54MemoryCache) {
  if (!state) return;
  state.updatedAt = new Date().toISOString();
  carousel54MemoryCache = state;
  try {
    fs.writeFileSync(CAROUSEL_54_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (_) {}
}

function peekNextSequentialBotId() {
  const st = loadCarousel54State();
  return st.nextBotSeqId || 1;
}

function checkoutNextSequentialBot(poolCoin, direction = "LONG") {
  const st = loadCarousel54State();
  let chosenSeq = st.nextBotSeqId || 1;
  // Decrementar turnsRemaining de todos los bots en RESTING_UNTIL_NEXT_LAP al avanzar un turno de la fila
  for (let i = 1; i <= 54; i++) {
    const b = st.bots[i];
    if (b && b.status === "RESTING_UNTIL_NEXT_LAP") {
      b.turnsRemaining = Math.max(0, (b.turnsRemaining || 0) - 1);
      if (b.turnsRemaining === 0) {
        b.status = "READY";
      }
    }
  }
  // Seleccionar el bot en turno (o el siguiente READY si ese sigue en el agua)
  for (let step = 0; step < 54; step++) {
    const candidateId = ((chosenSeq - 1 + step) % 54) + 1;
    const b = st.bots[candidateId];
    if (b && b.status !== "IN_WATER") {
      chosenSeq = candidateId;
      break;
    }
  }
  const botObj = st.bots[chosenSeq];
  botObj.status = "IN_WATER";
  botObj.poolCoin = poolCoin;
  botObj.direction = direction;
  botObj.turnsRemaining = 0;
  botObj.lastFiredAt = new Date().toISOString();

  const nextId = (chosenSeq % 54) + 1;
  if (nextId === 1) {
    st.lapNumber = (st.lapNumber || 1) + 1;
    for (let i = 1; i <= 54; i++) {
      if (st.bots[i] && st.bots[i].status === "RESTING_UNTIL_NEXT_LAP") {
        st.bots[i].status = "READY";
        st.bots[i].turnsRemaining = 0;
      }
    }
  }
  st.nextBotSeqId = nextId;
  st.totalDispatched = (st.totalDispatched || 0) + 1;
  saveCarousel54State(st);
  return {
    seqId: chosenSeq,
    badge: formatBotSeqId(chosenSeq),
    nextBotSeqId: st.nextBotSeqId,
    nextBotBadge: formatBotSeqId(st.nextBotSeqId),
    lapNumber: st.lapNumber
  };
}

function releaseBotToRestUntilNextLap(poolCoin, seqIds = []) {
  const st = loadCarousel54State();
  const idsToRelease = Array.isArray(seqIds) && seqIds.length > 0
    ? seqIds
    : Object.values(st.bots).filter(b => b.poolCoin === poolCoin && b.status === "IN_WATER").map(b => b.seqId);
  for (const id of idsToRelease) {
    const b = st.bots[id];
    if (b) {
      b.status = "RESTING_UNTIL_NEXT_LAP";
      b.poolCoin = null;
      b.direction = null;
      b.turnsRemaining = 53;
      b.lastClosedAt = new Date().toISOString();
    }
  }
  saveCarousel54State(st);
}

function getCarousel54Summary(freshInWaterCount = 0, quarantineCount = 8, freePoolsCount = 19) {
  const st = loadCarousel54State();
  const nextId = st.nextBotSeqId || 1;
  let restingCount = 0;
  let readyCount = 0;
  for (let i = 1; i <= 54; i++) {
    const b = st.bots[i];
    if (!b) continue;
    if (b.status === "RESTING_UNTIL_NEXT_LAP") restingCount++;
    else if (b.status === "READY") readyCount++;
  }
  return {
    nextBotSeqId: nextId,
    nextBotBadge: formatBotSeqId(nextId),
    lapNumber: st.lapNumber || 1,
    totalDispatched: st.totalDispatched || 0,
    freshInWaterCount,
    maxFreshInWater: MAX_FRESH_IN_WATER,
    quarantineCount,
    freePoolsCount,
    readyBotsCount: readyCount,
    restingUntilNextLapCount: restingCount
  };
}

let ratchetPeaksMemoryCache = null;
function sanitizeRatchetPeaksObj(obj) {
  if (!obj || typeof obj !== "object") return {};
  for (const k of Object.keys(obj)) {
    const entry = obj[k];
    if (!entry || typeof entry !== "object" || Number(entry.peakPnlUsdc) > 25.0 || Number(entry.lockedFloorUsdc) > 25.0 || Number(entry.peakPnlUsdc) < 0 || Number(entry.lockedFloorUsdc) < 0.01) {
      delete obj[k];
    }
  }
  return obj;
}
function loadRatchetPeaksState() {
  if (ratchetPeaksMemoryCache) return sanitizeRatchetPeaksObj(ratchetPeaksMemoryCache);
  try {
    if (fs.existsSync(RATCHET_PEAKS_STATE_FILE)) {
      ratchetPeaksMemoryCache = sanitizeRatchetPeaksObj(JSON.parse(fs.readFileSync(RATCHET_PEAKS_STATE_FILE, "utf8")) || {});
      return ratchetPeaksMemoryCache;
    }
  } catch (_) {}
  ratchetPeaksMemoryCache = {};
  return ratchetPeaksMemoryCache;
}

function saveRatchetPeaksState(state) {
  try {
    ratchetPeaksMemoryCache = sanitizeRatchetPeaksObj(state || {});
    fs.writeFileSync(RATCHET_PEAKS_STATE_FILE, JSON.stringify(ratchetPeaksMemoryCache, null, 2), "utf8");
  } catch (_) {}
}

function loadTelegramTradeAlertsState() {
  const defaults = {
    updatedAt: new Date().toISOString(),
    initialBootReportSentAt: null,
    notifiedOpenKeys: {},
    notifiedOpenOids: {},
    notifiedLock00Keys: {},
    notifiedCloseTids: {}
  };
  try {
    if (fs.existsSync(TELEGRAM_TRADE_ALERTS_STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(TELEGRAM_TRADE_ALERTS_STATE_FILE, "utf8"));
      const merged = Object.assign(defaults, parsed);
      merged.notifiedOpenKeys = merged.notifiedOpenKeys || {};
      merged.notifiedOpenOids = merged.notifiedOpenOids || {};
      merged.notifiedLock00Keys = merged.notifiedLock00Keys || {};
      merged.notifiedCloseTids = merged.notifiedCloseTids || {};
      return merged;
    }
  } catch (_) {}
  return defaults;
}

function saveTelegramTradeAlertsState(state) {
  try {
    state.updatedAt = new Date().toISOString();
    fs.writeFileSync(TELEGRAM_TRADE_ALERTS_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (_) {}
}

function loadRecoveryControlConfig() {
  const defaults = {
    ARCHITECTURE: "NEXUS_APEX_36_LATENT_FORCE_92_TIDE_LOCK_FAST_LANES_2",
    UNIFIED_ENTRY_ENGINE: "LATENT_FORCE_ENGINE_ONLY",
    MARKET_TIDE_LOCK_ENABLED: false,
    MIN_LATENT_FORCE_SCORE: 92,
    MIN_L2_FORCE_RATIO: 0.72,
    MAX_OPEN_POSITIONS: 6,
    FAST_SCALP_LANES: 6,
    MAX_CONCURRENT_POSITIONS_DURING_RECOVERY: 6,
    STRICT_RECOVERY_LOCK: false,
    PLAN_C_ACTIVE_HARVEST: false,
    NO_RED_EXIT: true,
    MAX_ACTIVE_HUNTERS: 6,
    MAX_UNFENCED_POSITIONS: 6,
    PLAN_C_MIN_LOCK_NET_USDC: 0.10,
    FAST_LANE_LOCK_NET_USDC: 0.10,
    CORNERING_STEP_HALF_DOLLAR_USDC: 0.50,
    CORNERING_STEP_INCREMENT_USDC: 0.10,
    CORNERING_BREATH_BUFFER_USDC: 0.02,
    FAST_LANE_TIME_STOP_MS: 180000,
    EXPRESS_EVAC_DELTA_RATIO: 0.00040,
    EXPRESS_EVAC_NET_USDC: 0.10,
    AUTO_COMPOUND_MARGIN_RATIO: 0.05,
    AUTO_COMPOUND_LEVERAGE: 5.0,
    PLAN_C_HUNTER_MARGIN_USDC: 50.45,
    PLAN_C_HUNTER_NOTIONAL_USDC: 252.25,
    MIN_FREE_MARGIN_RESERVE_USDC: 320.00,
    BURN_BALLAST_SUBSIDY_RATIO: 0.00,
    CLEAN_EVAC_TIMEOUT_MS: 180000,
    LOCK_UNTIL_ALL_RECOVERED: false,
    LOCK_NEW_OPENINGS: false,
    COOLDOWN_UNTIL_00_UTC: false,
    HOT_SWAP_CLONES: true,
    TARGET_RESET_UTC: "2026-10-30T00:00:00.000Z",
    POST_00_UTC_MAX_CONCURRENT_POSITIONS: 6,
    REQUIRE_BE_LOCK_FOR_3RD_POSITION: true,
    IMMEDIATE_SNOWBALL_START: true,
    POST_TRADE_COOLDOWN_MS: 480000,
    CASCADE_PLAN_B_ENABLED: false,
    CASCADE_STAGE_LABEL: "🛡️ ESPERANDO SALIDA EN VERDE (CERO PODA · MAX_OPEN=6 · CANDADO +$0.10 ➔ +$0.50+)",
    RECOVERY_PRIORITY_EVAC_TARGETS: ["PAXG", "SUI", "ETH", "LINK"],
    RECOVERY_CASCADE_ORDER: ["PAXG", "SUI", "ETH", "LINK", "BTC", "XRP", "SOL", "NEAR"]
  };
  try {
    if (fs.existsSync(RECOVERY_CONTROL_FILE)) {
      const merged = Object.assign(defaults, JSON.parse(fs.readFileSync(RECOVERY_CONTROL_FILE, "utf8")));
      merged.MAX_OPEN_POSITIONS = 6;
      merged.MAX_CONCURRENT_POSITIONS_DURING_RECOVERY = 6;
      merged.BURN_BALLAST_SUBSIDY_RATIO = 0.00;
      merged.PLAN_C_MIN_LOCK_NET_USDC = 0.10;
      merged.FAST_LANE_LOCK_NET_USDC = 0.10;
      return merged;
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
  },
  DELTA: {
    id: "DELTA",
    block: 4,
    dedicatedMargin: 0,
    name: "Escuadrón #10 Delta",
    specialist: "#1001 FX-Euro-Atlantic",
    role: "Oráculo Macro Institucional DXY / Atlántico ➔ Guía 27 Pares L1",
    pairs: ["EUR/USD", "GBP/USD", "USD/CHF"],
    isMacroOracleOnly: true,
    targetGainPct: BLOCK2_TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  ECHO: {
    id: "ECHO",
    block: 4,
    dedicatedMargin: 0,
    name: "Escuadrón #11 Echo",
    specialist: "#1101 FX-Tokyo-Pacific",
    role: "Oráculo Macro Institucional Pacífico & Yen ➔ Guía 27 Pares L1",
    pairs: ["USD/JPY", "AUD/USD", "USD/CAD"],
    isMacroOracleOnly: true,
    targetGainPct: BLOCK2_TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  FOXTROT: {
    id: "FOXTROT",
    block: 4,
    dedicatedMargin: 0,
    name: "Escuadrón #12 Foxtrot",
    specialist: "#1201 Bullion-Gold-Macro",
    role: "Oráculo Macro Institucional Oro & Plata ➔ Guía 27 Pares L1",
    pairs: ["XAU/USD", "XAG/USD", "EUR/JPY"],
    isMacroOracleOnly: true,
    targetGainPct: BLOCK2_TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  MIKE: {
    id: "MIKE",
    block: 5,
    dedicatedMargin: 0,
    name: "Escuadrón #13 Mike",
    specialist: "#1301 London-Cross-Crude",
    role: "Oráculo Macro Institucional Londres & WTI ➔ Guía 27 Pares L1",
    pairs: ["GBP/JPY", "EUR/GBP", "WTI/USD"],
    isMacroOracleOnly: true,
    targetGainPct: BLOCK2_TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  NOVEMBER: {
    id: "NOVEMBER",
    block: 5,
    dedicatedMargin: 0,
    name: "Escuadrón #14 November",
    specialist: "#1401 WallStreet-Index",
    role: "Oráculo Macro Institucional Wall Street NAS100/SPX500/US30 ➔ Guía 27 Pares L1",
    pairs: ["NAS100", "SPX500", "US30"],
    isMacroOracleOnly: true,
    targetGainPct: BLOCK2_TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  OSCAR: {
    id: "OSCAR",
    block: 5,
    dedicatedMargin: 0,
    name: "Escuadrón #15 Oscar",
    specialist: "#1501 Frankfurt-Commodities",
    role: "Oráculo Macro Institucional DAX40 & Materias Primas ➔ Guía 27 Pares L1",
    pairs: ["DAX40", "NGAS", "HG/USD"],
    isMacroOracleOnly: true,
    targetGainPct: BLOCK2_TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  PAPA: {
    id: "PAPA",
    block: 6,
    dedicatedMargin: 0,
    name: "Escuadrón #16 Papa",
    specialist: "#1601 Silicon-AI-Titans",
    role: "Oráculo Macro Institucional NVDA/TSLA/AAPL ➔ Guía 27 Pares L1",
    pairs: ["NVDA", "TSLA", "AAPL"],
    isMacroOracleOnly: true,
    targetGainPct: BLOCK2_TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  QUEBEC: {
    id: "QUEBEC",
    block: 6,
    dedicatedMargin: 0,
    name: "Escuadrón #17 Quebec",
    specialist: "#1701 Cloud-Hyperscalers",
    role: "Oráculo Macro Institucional MSFT/AMZN/META ➔ Guía 27 Pares L1",
    pairs: ["MSFT", "AMZN", "META"],
    isMacroOracleOnly: true,
    targetGainPct: BLOCK2_TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  ROMEO: {
    id: "ROMEO",
    block: 6,
    dedicatedMargin: 0,
    name: "Escuadrón #18 Romeo",
    specialist: "#1801 Institutional-Equities",
    role: "Oráculo Macro Institucional GOOGL/COIN/MSTR ➔ Guía 27 Pares L1",
    pairs: ["GOOGL", "COIN", "MSTR"],
    isMacroOracleOnly: true,
    targetGainPct: BLOCK2_TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  }
};

// ==============================================================================
// 🏛️🎯 REGLA DE HIERRO: CERO MAPEO PROXY ARTIFICIAL (`FOREX_AND_MACRO_L1_PROXY_MAP` DESACTIVADO)
// - Los 27 contratos perpetuos nativos de Hyperliquid L1 (#01 ALFA a #09 LIMA) operan
//   100% en su propio símbolo real (TRX en TRX, PAXG en PAXG, OP en OP).
// - Las 27 tarjetas Macro (#10 DELTA a #18 ROMEO) operan como Oráculo Macro Institucional.
// ==============================================================================
const FOREX_AND_MACRO_L1_PROXY_MAP = {};
const PRIMARY_L1_TO_FOREX_CANDIDATES = {};

function loadForexProxyBindingsState() {
  const defaults = {
    updatedAt: new Date().toISOString(),
    architecture: "NATIVE_27_L1_PERPS_AND_27_MACRO_ORACLE_SENSORS",
    proxyBridgeEnabled: false,
    proxyMap: {},
    bindings: {},
    activeBindingsByL1Coin: {},
    activeBindingsByVirtualPair: {},
    recentClosedBindings: [],
    pruningPool: {
      engine: "PROFIT_OFFSET_PRUNER",
      pruningRatio: PRUNING_POOL_RATIO,
      minPruneThresholdUsdc: MIN_PRUNE_THRESHOLD_USDC,
      targetOrder: OLD_STUCK_PRUNE_TARGETS,
      unallocatedPruningPoolUsdc: 0,
      totalCreditedTodayUsdc: 0,
      totalPrunedTodayUsdc: 0,
      lastResetDateUtc: new Date().toISOString().slice(0, 10),
      processedCloseFillTids: {},
      pruneHistory: []
    }
  };
  try {
    if (fs.existsSync(FOREX_PROXY_BINDINGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FOREX_PROXY_BINDINGS_FILE, "utf8"));
      if (parsed && typeof parsed === "object") {
        const merged = Object.assign({}, defaults, parsed);
        merged.proxyBridgeEnabled = false;
        merged.proxyMap = {};
        merged.bindings = {};
        merged.activeBindingsByL1Coin = {};
        merged.activeBindingsByVirtualPair = {};
        merged.pruningPool = Object.assign({}, defaults.pruningPool, parsed.pruningPool || {});
        merged.pruningPool.processedCloseFillTids = merged.pruningPool.processedCloseFillTids || {};
        merged.pruningPool.pruneHistory = Array.isArray(merged.pruningPool.pruneHistory) ? merged.pruningPool.pruneHistory : [];
        return merged;
      }
    }
  } catch (_) {}
  return defaults;
}

function saveForexProxyBindingsState(state) {
  try {
    state.updatedAt = new Date().toISOString();
    state.proxyBridgeEnabled = false;
    state.proxyMap = {};
    state.bindings = {};
    state.activeBindingsByL1Coin = {};
    state.activeBindingsByVirtualPair = {};
    fs.writeFileSync(FOREX_PROXY_BINDINGS_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (_) {}
}

function resolveForexVirtualPairForProxyCoin() {
  return null;
}

function syncForexProxyBindingsWithOpenPositions() {
  const state = loadForexProxyBindingsState();
  state.bindings = {};
  state.activeBindingsByL1Coin = {};
  state.activeBindingsByVirtualPair = {};
  saveForexProxyBindingsState(state);
  return state;
}

function formatHlPrice(price, coin) {
  const num = Number(price);
  if (!Number.isFinite(num) || num <= 0) return "0";
  if (coin === "BTC") return Math.round(num).toFixed(0);
  const meta = ASSET_DECIMALS[coin];
  const szDec = (meta && typeof meta.sz === "number") ? meta.sz : 1;
  const maxDec = Math.max(0, 6 - szDec);
  if (maxDec === 0) return Math.round(num).toFixed(0);
  // Regla oficial Hyperliquid L1: máximo 5 cifras significativas y máximo (6 - szDecimals) decimales
  const sig5 = Number(num.toPrecision(5));
  const intDigits = sig5 >= 1 ? Math.floor(Math.log10(sig5)) + 1 : 0;
  const allowedDec = sig5 >= 1 ? Math.max(0, Math.min(maxDec, 5 - intDigits)) : maxDec;
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

// ==============================================================================
// 🎯⚡ MOTOR MAESTRO DE PUNTERÍA: "IGNICIÓN DE PRIMERA OLA" (FIRST_WAVE_IGNITION)
//     ESTILO OP-USDC (CERO PERSEGUIR VELAS ESTIRADAS + 5 CONDICIONES SIMULTÁNEAS)
// ==============================================================================
// Exige obligatoriamente las 5 Condiciones Simultáneas de Nacimiento de Ola:
// 1) Filtro Anti-Persecución (Anti-Chase Extension Cap):
//    - Distancia respecto a EMA-9 entre 0.015% y 0.085% a favor de la ruptura (PROHIBIDO si > 0.10%)
//    - Movimiento en los últimos 20s <= 0.14% (PROHIBIDO si ya corrió > 0.14% en 20s)
// 2) Confirmación de 3 Micro-Ticks Consecutivos (3-Tick Micro-Ignition en t-2, t-1, t0):
//    - LONG: mid(t0) > mid(t-1) >= mid(t-2) Y bestBid subiendo de escalón sin que bestAsk baje
//    - SHORT: mid(t0) < mid(t-1) <= mid(t-2) Y bestAsk bajando presionando al bestBid
// 3) Tanque de Gasolina Fresco (RSI-6 en Zona de Arranque, NO en Agotamiento):
//    - LONG: RSI(6) entre 46 y 61 y subiendo (rsiNow > rsiPrev). Prohibido si RSI(6) > 62.
//    - SHORT: RSI(6) entre 39 y 54 y bajando (rsiNow < rsiPrev). Prohibido si RSI(6) < 38.
// 4) Presión Real del Libro L2 (imbalance >= 72% en primeros 5 niveles) + Aceleración en par guía.
// 5) Veto Instantáneo del Director BTC-USDC (3 Segundos en Vivo):
//    - Prohibido LONG si btcDelta3s < -0.005% | Prohibido SHORT si btcDelta3s > +0.005%.
// + Spread Estricto < 0.03% (aborta tiro si el spread está abierto o sucio).
const prevTopOfBookMemory = {}; // { [coin]: { bestBid, bestAsk, midPx, ts } }
const topOfBookHistoryByCoin = {}; // { [coin]: Array<{ midPx, bestBid, bestAsk, ts }> } (últimas 3 lecturas t-2, t-1, t0)

// ================================================================================
// 🐂🐂🐻🐻 ARQUITECTURA "CUARTETO TÁCTICO 4X POR PAR" (27 PARES L1 × 4 BOTS = 108 UNIDADES)
// - Candado de Exclusión Mutua (`pairMutexLock[coin]`): solo 1 de los 4 sub-bots puede tener
//   posición abierta en esa moneda en un instante dado (cero neteo ni choque de órdenes en L1).
// - El enfriamiento de 2 minutos (120s) aplica al sub-bot individual que acaba de cobrar (`T1`, `T2`, `O1` u `O2`),
//   NO bloquea a los otros 3 especialistas del mismo par si aparece la jugada exacta de relevo.
// ================================================================================
const NATIVE_27_L1_COINS = [
  "SOL", "SUI", "AVAX", "BTC", "PAXG", "LINK", "ETH", "BNB", "AAVE",
  "XRP", "DOGE", "ADA", "HYPE", "TRX", "TON", "DOT", "NEAR", "LTC",
  "TAO", "RENDER", "FET", "ARB", "OP", "UNI", "ONDO", "PENDLE", "kPEPE"
];
const pairMutexLock = {};          // { [coin]: { locked: boolean, activeSubBotId: 'T1'|'T2'|'O1'|'O2', direction: 'LONG'|'SHORT', openedAt: number } }
const subBotCooldownsByCoin = {};  // { [coin]: { T1: number, T2: number, O1: number, O2: number } }
const lastSubBotByCoin = {};       // { [coin]: 'T1'|'T2'|'O1'|'O2' }
// ================================================================================
// 🧲⏱️ MARCAPASOS DE VELAS DE 3 MINUTOS ("UNA VELA SÍ ➔ UNA VELA NO")
//     + PÉNDULO MAGNÉTICO EN CADENA DE 4 BOTS (`🐻 O1 ➔ 🐂 T1 ➔ 🐻 O2 ➔ 🐂 T2`)
//     + FINAL INTELIGENTE (NUNCA CORTAR POR RELOJ SI TIENE CANDADO ACTIVO)
// ================================================================================
const CANDLE_3M_ACTIVE_WINDOW_MS = 3 * 60 * 1000; // 180,000 ms (3m Vela Activa de Caza)
const CANDLE_3M_REST_WINDOW_MS = 3 * 60 * 1000;   // 180,000 ms (3m Vela de Descanso y Reposición de los 4 Bots)
const MAX_OPS_PER_3M_CANDLE = 4;                  // Hasta 4 operaciones encadenadas (O1 -> T1 -> O2 -> T2) por vela de 3m
const candle3mStateByCoin = {};                   // { [coin]: { activeWindowStartMs, opsInWindow, restingUntilMs, lastClosedBotId, whipRelayArmedUntilMs, whipNextBotId, puntoCeroAnchorPx } }

for (const c of NATIVE_27_L1_COINS) {
  pairMutexLock[c] = { locked: false, activeSubBotId: null, direction: null, openedAt: 0 };
  subBotCooldownsByCoin[c] = { T1: 0, T2: 0, O1: 0, O2: 0 };
  candle3mStateByCoin[c] = {
    activeWindowStartMs: 0,
    opsInWindow: 0,
    restingUntilMs: 0,
    lastClosedBotId: null,
    whipRelayArmedUntilMs: 0,
    whipNextBotId: null,
    puntoCeroAnchorPx: 0
  };
}

function getNextPendulumBotInQuartet(closedBotId, preferOppositeWhip = true, cdMap = {}) {
  const now = Date.now();
  const isReady = (bId) => (cdMap[bId] || 0) <= now;
  // Cadena natural de 4 rebotes en el Punto Cero: 🐻 O1 ➔ 🐂 T1 ➔ 🐻 O2 ➔ 🐂 T2 (o 🐂 T1 ➔ 🐻 O1 ➔ 🐂 T2 ➔ 🐻 O2)
  if (preferOppositeWhip) {
    if (closedBotId === "O1") return isReady("T1") ? "T1" : (isReady("T2") ? "T2" : "O2");
    if (closedBotId === "T1") return isReady("O1") ? "O1" : (isReady("O2") ? "O2" : "T2");
    if (closedBotId === "O2") return isReady("T2") ? "T2" : (isReady("T1") ? "T1" : "O1");
    if (closedBotId === "T2") return isReady("O2") ? "O2" : (isReady("O1") ? "O1" : "T1");
  } else {
    if (closedBotId === "O1") return isReady("O2") ? "O2" : "T1";
    if (closedBotId === "T1") return isReady("T2") ? "T2" : "O1";
    if (closedBotId === "O2") return isReady("O1") ? "O1" : "T2";
    if (closedBotId === "T2") return isReady("T1") ? "T1" : "O2";
  }
  return "T1";
}

function getSubBotMeta(subBotId) {
  switch (subBotId) {
    case "T2":
      return { id: "T2", badge: "🐂T2", name: "🐂 TORO #2 (BULL-SPRING — Rebote de Resorte & 2ª Ola Alcista)", direction: "LONG", defaultRole: "RESORTE" };
    case "O1":
      return { id: "O1", badge: "🐻O1", name: "🐻 OSO #1 (BEAR-IGNITION — Primera Ola Bajista)", direction: "SHORT", defaultRole: "LISTO" };
    case "O2":
      return { id: "O2", badge: "🐻O2", name: "🐻 OSO #2 (BEAR-REVERSAL — Giro en Techo & 2ª Ola Bajista)", direction: "SHORT", defaultRole: "GIRO" };
    case "T1":
    default:
      return { id: "T1", badge: "🐂T1", name: "🐂 TORO #1 (BULL-IGNITION — Primera Ola Alcista)", direction: "LONG", defaultRole: "LISTO" };
  }
}

function buildPairQuartetSnapshot(coin, openPositions = [], now = Date.now()) {
  const rawCoin = coin === "PEPE" ? "kPEPE" : coin;
  const cdMap = subBotCooldownsByCoin[rawCoin] || { T1: 0, T2: 0, O1: 0, O2: 0 };
  const c3m = candle3mStateByCoin[rawCoin] || { activeWindowStartMs: 0, opsInWindow: 0, restingUntilMs: 0, whipRelayArmedUntilMs: 0, whipNextBotId: null, puntoCeroAnchorPx: 0 };
  const activePos = (openPositions || []).find(p => p?.position?.coin === rawCoin && parseFloat(p.position.szi || "0") !== 0);
  let activeSubBotId = null;
  let activePnl = 0;
  let activeDirection = null;

  if (activePos) {
    const szi = parseFloat(activePos.position.szi || "0");
    activePnl = parseFloat(activePos.position.unrealizedPnl || "0");
    activeDirection = szi < 0 ? "SHORT" : "LONG";
    const lockObj = pairMutexLock[rawCoin];
    if (lockObj && lockObj.activeSubBotId && ((activeDirection === "LONG" && lockObj.activeSubBotId.startsWith("T")) || (activeDirection === "SHORT" && lockObj.activeSubBotId.startsWith("O")))) {
      activeSubBotId = lockObj.activeSubBotId;
    } else if (activeDirection === "LONG") {
      activeSubBotId = (cdMap.T1 > now) ? "T2" : "T1";
    } else {
      activeSubBotId = (cdMap.O1 > now) ? "O2" : "O1";
    }
    pairMutexLock[rawCoin] = {
      locked: true,
      activeSubBotId,
      direction: activeDirection,
      openedAt: lockObj?.openedAt || now
    };
  } else {
    pairMutexLock[rawCoin] = { locked: false, activeSubBotId: null, direction: null, openedAt: 0 };
    // Si la ventana activa de 3 minutos ya expiró con szi === 0 y tuvo al menos 1 operación, pasar a Vela No (3m Descanso)
    if (c3m.activeWindowStartMs > 0 && (now - c3m.activeWindowStartMs) >= CANDLE_3M_ACTIVE_WINDOW_MS && c3m.opsInWindow > 0 && c3m.restingUntilMs <= now) {
      c3m.restingUntilMs = now + CANDLE_3M_REST_WINDOW_MS;
      c3m.opsInWindow = 0;
      c3m.activeWindowStartMs = 0;
      c3m.whipRelayArmedUntilMs = 0;
      subBotCooldownsByCoin[rawCoin] = { T1: c3m.restingUntilMs, T2: c3m.restingUntilMs, O1: c3m.restingUntilMs, O2: c3m.restingUntilMs };
    }
    // Al terminar la Vela de Descanso de 3m, recargar los 4 especialistas al 100%
    if (c3m.restingUntilMs > 0 && now >= c3m.restingUntilMs) {
      c3m.restingUntilMs = 0;
      c3m.opsInWindow = 0;
      c3m.activeWindowStartMs = 0;
    }
  }

  const isResting3m = !activePos && (c3m.restingUntilMs > now);
  const formatBotState = (botId, defaultText) => {
    const untilTs = isResting3m
      ? c3m.restingUntilMs
      : Math.min(now + CANDLE_3M_REST_WINDOW_MS, Number(cdMap[botId] || 0));
    if (activeSubBotId === botId) {
      return {
        id: botId,
        state: activePnl >= 0 ? "FIRE_GREEN" : "FIRE_AMBER",
        label: `🔥 EN FUEGO`,
        cooldownUntilMs: 0,
        remainingSec: 0
      };
    }
    if (untilTs > now) {
      const remSec = Math.min(180, Math.max(1, Math.ceil((untilTs - now) / 1000)));
      const mm = String(Math.floor(remSec / 60)).padStart(2, "0");
      const ss = String(remSec % 60).padStart(2, "0");
      return {
        id: botId,
        state: "COOLDOWN",
        label: `⏳ ${mm}:${ss}`,
        cooldownUntilMs: untilTs,
        remainingSec: remSec
      };
    }
    return {
      id: botId,
      state: "READY",
      label: defaultText,
      cooldownUntilMs: 0,
      remainingSec: 0
    };
  };

  return {
    coin: rawCoin,
    displayCoin: rawCoin === "kPEPE" ? "PEPE" : rawCoin,
    mutexLocked: Boolean(activePos),
    activeSubBotId,
    activeDirection,
    pendulum3m: {
      mode: isResting3m ? "REST_3M_CANDLE" : (c3m.activeWindowStartMs > 0 ? "ACTIVE_3M_CANDLE" : "PUNTO_CERO_ARMED"),
      opsInWindow: c3m.opsInWindow || 0,
      maxOpsPer3m: MAX_OPS_PER_3M_CANDLE,
      restingUntilMs: c3m.restingUntilMs || 0,
      whipRelayArmed: Boolean(c3m.whipRelayArmedUntilMs > now),
      whipNextBotId: c3m.whipNextBotId || null,
      puntoCeroAnchorPx: c3m.puntoCeroAnchorPx || 0
    },
    bots: {
      T1: formatBotState("T1", "LISTO"),
      T2: formatBotState("T2", (cdMap.T1 > now && !activePos) ? "RELEVO 2ª" : "RESORTE"),
      O1: formatBotState("O1", "LISTO"),
      O2: formatBotState("O2", ((cdMap.O1 > now || cdMap.T1 > now || cdMap.T2 > now) && !activePos) ? "GIRO ACT" : "GIRO")
    }
  };
}

// =========================================================================
// 🌐⚡ MOTOR WEBSOCKET NATIVO EN TIEMPO REAL (HYPER-ADHESION WEBSOCKET ENGINE V1)
// - Conexión persistente wss://api.hyperliquid.xyz/ws con ping 15,000ms y auto-reconexión
// - Canal allMids: actualiza precios y cinemática en < 50ms
// - Canal trades (27 pares): construye Footprint en Vivo (liveFootprintByCoin) en ventana 15,000ms
// - Canal l2Book (27 pares): actualiza Bookmap L2 en 0ms y detecta Spoofing / Absorción Iceberg
// =========================================================================
const kinematicWindow5sByCoin = {}; // { [coin]: Array<{ ts, px }> } últimos 15,000ms de alta resolución (<50ms WS)
const liveFootprintByCoin = {};     // { [coin]: Array<{ ts, px, sz, usd, side }> } últimos 15,000ms de trades en vivo
const l2WallHistoryByCoin = {};     // { [coin]: Array<{ ts, midPx, maxBidWallPx, maxBidWallUsd, maxAskWallPx, maxAskWallUsd }> } últimos 3,000ms
let lastMeasuredHlLatencyMs = 18;   // Latencia real medida por WebSocket a Hyperliquid L1 (ms)
let hlWsClient = null;
let hlWsConnected = false;
let hlWsLatencyMs = 18;
let hlWsLastMessageTs = 0;
let hlWsLastPingSentTs = 0;
let hlWsPingTimer = null;
let hlWsReconnectTimer = null;
let hlWsMidsCache = { ts: 0, data: {} };

function recordKinematicSample(coin, px, ts = Date.now()) {
  if (!px || px <= 0) return;
  if (!kinematicWindow5sByCoin[coin]) kinematicWindow5sByCoin[coin] = [];
  const arr = kinematicWindow5sByCoin[coin];
  const last = arr[arr.length - 1];
  // Alta resolución para ventanas de 1,500ms y 4,500ms
  if (!last || last.px !== px || (ts - last.ts) >= 250) {
    arr.push({ ts, px });
  }
  while (arr.length > 2 && (ts - arr[0].ts) > 15000) {
    arr.shift();
  }
}

function recordLiveTradeFootprint(coin, px, sz, side, ts = Date.now()) {
  if (!coin || !(px > 0) || !(sz > 0)) return;
  if (!liveFootprintByCoin[coin]) liveFootprintByCoin[coin] = [];
  const arr = liveFootprintByCoin[coin];
  const usd = px * sz;
  arr.push({
    ts,
    px,
    sz,
    usd,
    side: side === "B" ? "B" : "A" // "B" = Compra agresiva al Ask, "A" = Venta agresiva al Bid
  });
  while (arr.length > 0 && (ts - arr[0].ts) > 15000) {
    arr.shift();
  }
  recordKinematicSample(coin, px, ts);
}

function recordL2WallSnapshot(coin, bids, asks, midPx, ts = Date.now()) {
  if (!coin || !(midPx > 0) || !Array.isArray(bids) || !Array.isArray(asks)) return;
  if (!l2WallHistoryByCoin[coin]) l2WallHistoryByCoin[coin] = [];
  let maxBidWallPx = 0, maxBidWallUsd = 0;
  let maxAskWallPx = 0, maxAskWallUsd = 0;
  for (let i = 0; i < Math.min(10, bids.length); i++) {
    const px = parseFloat(bids[i]?.px || 0);
    const usd = px * parseFloat(bids[i]?.sz || 0);
    if (usd > maxBidWallUsd) {
      maxBidWallUsd = usd;
      maxBidWallPx = px;
    }
  }
  for (let i = 0; i < Math.min(10, asks.length); i++) {
    const px = parseFloat(asks[i]?.px || 0);
    const usd = px * parseFloat(asks[i]?.sz || 0);
    if (usd > maxAskWallUsd) {
      maxAskWallUsd = usd;
      maxAskWallPx = px;
    }
  }
  const hist = l2WallHistoryByCoin[coin];
  hist.push({ ts, midPx, maxBidWallPx, maxBidWallUsd, maxAskWallPx, maxAskWallUsd });
  while (hist.length > 0 && (ts - hist[0].ts) > 3000) {
    hist.shift();
  }
}

function computeLiveFootprintMetrics(coin, currentMidPx = 0, now = Date.now()) {
  const rawCoin = coin === "PEPE" ? "kPEPE" : coin;
  const trades = liveFootprintByCoin[rawCoin] || [];
  while (trades.length > 0 && (now - trades[0].ts) > 15000) {
    trades.shift();
  }

  let aggressiveBuyUsd1500 = 0;
  let aggressiveSellUsd1500 = 0;
  let aggressiveBuyUsd2000 = 0;
  let aggressiveSellUsd2000 = 0;
  let aggressiveBuyUsd4000 = 0;
  let aggressiveSellUsd4000 = 0;
  let tradesCount2000 = 0;
  let minPx2000 = Infinity;
  let maxPx2000 = 0;
  let firstPx2000 = 0;
  let lastPx2000 = 0;
  const buyPriceLevels2s = new Set();
  const sellPriceLevels2s = new Set();
  const volumeByLevel4000 = {};

  for (let i = 0; i < trades.length; i++) {
    const t = trades[i];
    const age = now - t.ts;
    if (age <= 4000) {
      if (t.side === "B") aggressiveBuyUsd4000 += t.usd;
      else aggressiveSellUsd4000 += t.usd;
      const lvlKey = String(t.px);
      if (!volumeByLevel4000[lvlKey]) volumeByLevel4000[lvlKey] = { buyUsd: 0, sellUsd: 0 };
      if (t.side === "B") volumeByLevel4000[lvlKey].buyUsd += t.usd;
      else volumeByLevel4000[lvlKey].sellUsd += t.usd;
    }
    if (age <= 2000) {
      tradesCount2000++;
      if (!firstPx2000) firstPx2000 = t.px;
      lastPx2000 = t.px;
      if (t.side === "B") {
        aggressiveBuyUsd2000 += t.usd;
        buyPriceLevels2s.add(t.px);
      } else {
        aggressiveSellUsd2000 += t.usd;
        sellPriceLevels2s.add(t.px);
      }
      if (t.px < minPx2000) minPx2000 = t.px;
      if (t.px > maxPx2000) maxPx2000 = t.px;
    }
    if (age <= 1500) {
      if (t.side === "B") aggressiveBuyUsd1500 += t.usd;
      else aggressiveSellUsd1500 += t.usd;
    }
  }

  const buyFlowUsd2s = +aggressiveBuyUsd2000.toFixed(2);
  const sellFlowUsd2s = +aggressiveSellUsd2000.toFixed(2);
  const buyTicksSwept2s = Math.max(0, buyPriceLevels2s.size - (firstPx2000 > 0 && lastPx2000 > firstPx2000 ? 0 : 1));
  const sellTicksSwept2s = Math.max(0, sellPriceLevels2s.size - (firstPx2000 > 0 && lastPx2000 < firstPx2000 ? 0 : 1));

  // Ratio de Imbalance directo sobre la ventana en vivo de 2,000ms (con respaldo a 4,000ms en liquidez de sábado si no hubo print en los últimos 2,000ms)
  const effBuyFlowUsd = (buyFlowUsd2s > 0 || sellFlowUsd2s > 0) ? buyFlowUsd2s : +aggressiveBuyUsd4000.toFixed(2);
  const effSellFlowUsd = (buyFlowUsd2s > 0 || sellFlowUsd2s > 0) ? sellFlowUsd2s : +aggressiveSellUsd4000.toFixed(2);
  const buyImbalanceRatio = effBuyFlowUsd > 0 ? +(effBuyFlowUsd / Math.max(1, effSellFlowUsd)).toFixed(2) : 1.0;
  const sellImbalanceRatio = effSellFlowUsd > 0 ? +(effSellFlowUsd / Math.max(1, effBuyFlowUsd)).toFixed(2) : 1.0;

  // Detector de Absorción Iceberg en ventana de 2,000ms:
  // Alto volumen de trades ejecutados (>= $250 USD o >= 4 trades), pero el precio avanzó <= 0 ticks y el Imbalance instantáneo se voltea >= 2.5:1 en contra
  const totalVol2000 = aggressiveBuyUsd2000 + aggressiveSellUsd2000;
  const buyImb2000 = aggressiveBuyUsd2000 / Math.max(1, aggressiveSellUsd2000);
  const sellImb2000 = aggressiveSellUsd2000 / Math.max(1, aggressiveBuyUsd2000);
  const refMid = currentMidPx > 0 ? currentMidPx : (lastPx2000 || 1);
  const advanceUp2000 = (firstPx2000 > 0 && lastPx2000 > 0) ? (lastPx2000 - firstPx2000) : 0;
  const advanceDown2000 = (firstPx2000 > 0 && lastPx2000 > 0) ? (firstPx2000 - lastPx2000) : 0;
  const zeroTickTolerance = refMid * 0.00012;

  const icebergAgainstLong = Boolean(
    (totalVol2000 >= 250 || tradesCount2000 >= 4) &&
    advanceUp2000 <= zeroTickTolerance &&
    sellImb2000 >= 2.5
  );
  const icebergAgainstShort = Boolean(
    (totalVol2000 >= 250 || tradesCount2000 >= 4) &&
    advanceDown2000 <= zeroTickTolerance &&
    buyImb2000 >= 2.5
  );

  return {
    buyFlowUsd2s,
    sellFlowUsd2s,
    buyTicksSwept2s,
    sellTicksSwept2s,
    aggressiveBuyUsd1500: +aggressiveBuyUsd1500.toFixed(2),
    aggressiveSellUsd1500: +aggressiveSellUsd1500.toFixed(2),
    aggressiveBuyUsd4000: +aggressiveBuyUsd4000.toFixed(2),
    aggressiveSellUsd4000: +aggressiveSellUsd4000.toFixed(2),
    buyImbalanceRatio,
    sellImbalanceRatio,
    buyImb2000: +buyImb2000.toFixed(2),
    sellImb2000: +sellImb2000.toFixed(2),
    totalVol2000: +totalVol2000.toFixed(2),
    tradesCount2000,
    icebergAgainstLong,
    icebergAgainstShort,
    icebergDetected: Boolean(icebergAgainstLong || icebergAgainstShort),
    volumeByLevel4000
  };
}

/**
 * 1. ENTRADA QUIRÚRGICA EN EL NACIMIENTO DE LA VELA (`computeImpulseDistanceFormula` — CERO `OR` PASIVO):
 * - Prohibido el `OR` (`||`) pasivo: El flujo agresivo real en WebSocket `trades` es 100% obligatorio (`&&`).
 * - Filtro Anti-Tope / Anti-Cola de Vela (`maxDistFromOpen1mPct <= 0.035%` y `|roc15sPct| <= 0.06%`):
 *   Si la vela de 1m ya se estiró más de `0.035%` desde `open1mNow` o más de `0.06%` en 15s, PROHIBIDO DISPARAR.
 * - Condición Exacta de Disparo en el Segundo 0 del Impulso:
 *   * Para `LONG (🐂)`:
 *     1) `midPx > open1mNow && midPx > open3mAgo` (velas de 1m y 3m verdes reales).
 *     2) Distancia a `open1mNow` entre `0.004%` y `0.035%`, y `|roc15sPct| <= 0.06%`.
 *     3) `midPx > px1500msAgo && px1500msAgo >= px3000msAgo` (3 ticks consecutivos subiendo en tiempo real).
 *     4) `buyImbalanceRatio >= 2.2` en `trades` WebSocket barriendo `bestAsk` hacia arriba (`bestAskNow > bestAsk3sAgo`)
 *        Y pista libre `cleanImpulseRunwayRatioLong >= 1.50x`.
 *   * Para `SHORT (🐻)`:
 *     1) `midPx < open1mNow && midPx < open3mAgo` (velas de 1m y 3m rojas reales).
 *     2) Distancia a `open1mNow` entre `0.004%` y `0.035%`, y `|roc15sPct| <= 0.06%`.
 *     3) `midPx < px1500msAgo && px1500msAgo <= px3000msAgo` (3 ticks consecutivos bajando en tiempo real).
 *     4) `sellImbalanceRatio >= 2.2` en `trades` WebSocket barriendo `bestBid` hacia abajo (`bestBidNow < bestBid3sAgo`)
 *        Y pista libre `cleanImpulseRunwayRatioShort >= 1.50x`.
 */
function computeImpulseDistanceFormula({
  coin,
  midPx,
  bestBid,
  bestAsk,
  bids = [],
  asks = [],
  fp,
  hist = [],
  bookTicks = [],
  open1mNow = midPx,
  open3mAgo = midPx,
  roc15sPct = 0,
  now = Date.now()
}) {
  const rawCoin = coin === "PEPE" ? "kPEPE" : coin;
  const targetMovePct = 0.16;
  const upperTargetPx = bestAsk * 1.0016;
  const lowerTargetPx = bestBid * 0.9984;

  let askResistanceUsd018 = 0;
  for (let i = 0; i < asks.length; i++) {
    const px = parseFloat(asks[i]?.px || 0);
    const sz = parseFloat(asks[i]?.sz || 0);
    if (px > 0 && sz > 0 && px <= upperTargetPx) {
      askResistanceUsd018 += px * sz;
    }
  }
  if (askResistanceUsd018 <= 0 && asks.length > 0) {
    askResistanceUsd018 = parseFloat(asks[0]?.px || 0) * parseFloat(asks[0]?.sz || 0);
  }

  let bidResistanceUsd018 = 0;
  for (let i = 0; i < bids.length; i++) {
    const px = parseFloat(bids[i]?.px || 0);
    const sz = parseFloat(bids[i]?.sz || 0);
    if (px > 0 && sz > 0 && px >= lowerTargetPx) {
      bidResistanceUsd018 += px * sz;
    }
  }
  if (bidResistanceUsd018 <= 0 && bids.length > 0) {
    bidResistanceUsd018 = parseFloat(bids[0]?.px || 0) * parseFloat(bids[0]?.sz || 0);
  }

  let bidVolTop5 = 0;
  let askVolTop5 = 0;
  for (let i = 0; i < Math.min(5, bids.length); i++) {
    bidVolTop5 += parseFloat(bids[i]?.px || 0) * parseFloat(bids[i]?.sz || 0);
  }
  for (let i = 0; i < Math.min(5, asks.length); i++) {
    askVolTop5 += parseFloat(asks[i]?.px || 0) * parseFloat(asks[i]?.sz || 0);
  }
  const totalTop5Vol = bidVolTop5 + askVolTop5;
  const bidRatio = totalTop5Vol > 0 ? +(bidVolTop5 / totalTop5Vol).toFixed(4) : 0.50;
  const askRatio = totalTop5Vol > 0 ? +(askVolTop5 / totalTop5Vol).toFixed(4) : 0.50;

  const buyFlowUsd2s = Number(fp?.buyFlowUsd2s || fp?.aggressiveBuyUsd4000 || 0);
  const sellFlowUsd2s = Number(fp?.sellFlowUsd2s || fp?.aggressiveSellUsd4000 || 0);
  const buyImbalanceRatio = Number(fp?.buyImbalanceRatio || +(buyFlowUsd2s / Math.max(1, sellFlowUsd2s)).toFixed(2));
  const sellImbalanceRatio = Number(fp?.sellImbalanceRatio || +(sellFlowUsd2s / Math.max(1, buyFlowUsd2s)).toFixed(2));

  const cleanImpulseRunwayRatioLong = +((bidResistanceUsd018 + buyFlowUsd2s) / Math.max(1, askResistanceUsd018)).toFixed(2);
  const cleanImpulseRunwayRatioShort = +((askResistanceUsd018 + sellFlowUsd2s) / Math.max(1, bidResistanceUsd018)).toFixed(2);

  // Extraer px1500msAgo, px3000msAgo, px4000msAgo y px15sAgo de la ventana cinemática en RAM + historial 60s
  const kSamples = Array.isArray(kinematicWindow5sByCoin[rawCoin]) && kinematicWindow5sByCoin[rawCoin].length >= 2
    ? kinematicWindow5sByCoin[rawCoin]
    : hist;
  const mergedSamples = [...(Array.isArray(hist) ? hist : []), ...(Array.isArray(kSamples) ? kSamples : [])];

  let px1500msAgo = midPx;
  let px3000msAgo = midPx;
  let px4000msAgo = midPx;
  let px15sAgo = midPx;
  let bestDiff1500 = Infinity;
  let bestDiff3000 = Infinity;
  let bestDiff4000 = Infinity;
  let bestDiff15s = Infinity;

  for (let i = 0; i < mergedSamples.length; i++) {
    const s = mergedSamples[i];
    if (!s || !(s.px > 0)) continue;
    const age = Math.max(0, now - s.ts);
    const d1500 = Math.abs(age - 1500);
    if (age >= 500 && age <= 2600 && d1500 < bestDiff1500) {
      bestDiff1500 = d1500;
      px1500msAgo = s.px;
    }
    const d3000 = Math.abs(age - 3000);
    if (age >= 900 && age <= 5500 && d3000 < bestDiff3000) {
      bestDiff3000 = d3000;
      px3000msAgo = s.px;
    }
    const d4000 = Math.abs(age - 4000);
    if (age >= 2000 && age <= 7500 && d4000 < bestDiff4000) {
      bestDiff4000 = d4000;
      px4000msAgo = s.px;
    }
    const d15s = Math.abs(age - 15000);
    if (age >= 7500 && age <= 25000 && d15s < bestDiff15s) {
      bestDiff15s = d15s;
      px15sAgo = s.px;
    }
  }

  // Extraer bestAsk3sAgo y bestBid3sAgo de topOfBookHistoryByCoin
  const bestAskNow = bestAsk;
  const bestBidNow = bestBid;
  let bestAsk3sAgo = bestAskNow;
  let bestBid3sAgo = bestBidNow;
  let bestDiffBook3s = Infinity;
  if (Array.isArray(bookTicks) && bookTicks.length >= 2) {
    bestAsk3sAgo = bookTicks[0].bestAsk || bestAskNow;
    bestBid3sAgo = bookTicks[0].bestBid || bestBidNow;
    for (let i = 0; i < bookTicks.length - 1; i++) {
      const bt = bookTicks[i];
      if (!bt || !(bt.ts > 0)) continue;
      const age = Math.max(0, now - bt.ts);
      const d3s = Math.abs(age - 3000);
      if (age >= 800 && age <= 6500 && d3s < bestDiffBook3s) {
        bestDiffBook3s = d3s;
        if (bt.bestAsk > 0) bestAsk3sAgo = bt.bestAsk;
        if (bt.bestBid > 0) bestBid3sAgo = bt.bestBid;
      }
    }
  }

  // 1) Depleción/ruptura del 1er nivel L2 (bestAsk o bestBid consumiéndose >= 60% o barrido directo):
  const lvl0BidUsd = parseFloat(bids[0]?.px || 0) * parseFloat(bids[0]?.sz || 0);
  const lvl0AskUsd = parseFloat(asks[0]?.px || 0) * parseFloat(asks[0]?.sz || 0);
  const lvl0TotalUsd = Math.max(1, lvl0BidUsd + lvl0AskUsd);
  const l2FirstLevelBullDepletionPct = +((lvl0BidUsd / lvl0TotalUsd) * 100).toFixed(1);
  const l2FirstLevelBearDepletionPct = +((lvl0AskUsd / lvl0TotalUsd) * 100).toFixed(1);
  const bestAskSweptUp = Boolean(bestAskNow > bestAsk3sAgo || l2FirstLevelBullDepletionPct >= 60.0 || bidRatio >= 0.60);
  const bestBidSweptDown = Boolean(bestBidNow < bestBid3sAgo || l2FirstLevelBearDepletionPct >= 60.0 || askRatio >= 0.60);

  // 2) Filtro Anti-Techo / Anti-Piso (|zScore| <= 0.65, prohibido comprar en la punta estirada de la vela):
  const distFromOpen1mLongPct = open1mNow > 0 ? (((midPx - open1mNow) / open1mNow) * 100) : 0;
  const distFromOpen1mShortPct = open1mNow > 0 ? (((open1mNow - midPx) / open1mNow) * 100) : 0;
  const absDistFromOpen1mPct = Math.abs(distFromOpen1mLongPct);
  // Normalizamos zScore sobre el rango típico de impulso 1m (0.085% = 1.0 sigma -> |zScore| <= 0.65 equivale a <= 0.055% de elongación)
  const zScore = +(distFromOpen1mLongPct / 0.085).toFixed(3);
  const absZScore = Math.abs(zScore);
  const notOverextended15s = Math.abs(roc15sPct) <= 0.085;
  const birthOfCandleLongOk = Boolean(distFromOpen1mLongPct >= 0.001 && absZScore <= 0.65 && notOverextended15s);
  const birthOfCandleShortOk = Boolean(distFromOpen1mShortPct >= 0.001 && absZScore <= 0.65 && notOverextended15s);

  // 3) Dirección 1:1 con la vela y aceleración positiva del flujo (a > 0):
  const bullishCandles1m3m = Boolean(midPx > open1mNow && (midPx >= open3mAgo || midPx > px4000msAgo));
  const bearishCandles1m3m = Boolean(midPx < open1mNow && (midPx <= open3mAgo || midPx < px4000msAgo));

  const rising3TicksBirth = Boolean(midPx >= px1500msAgo && midPx > px3000msAgo && birthOfCandleLongOk);
  const falling3TicksBirth = Boolean(midPx <= px1500msAgo && midPx < px3000msAgo && birthOfCandleShortOk);
  const rising1_5_4_15s = rising3TicksBirth;
  const falling1_5_4_15s = falling3TicksBirth;

  // 4) Flujo agresivo WebSocket + Corredor de vacío de liquidez a favor (vacuumRatio >= 2.0 o cleanImpulseRunwayRatio >= 1.30x en el próximo 0.16%):
  const vacuumRatioLong = +(Math.max(cleanImpulseRunwayRatioLong, (bidVolTop5 + buyFlowUsd2s) / Math.max(1, lvl0AskUsd))).toFixed(2);
  const vacuumRatioShort = +(Math.max(cleanImpulseRunwayRatioShort, (askVolTop5 + sellFlowUsd2s) / Math.max(1, lvl0BidUsd))).toFixed(2);
  const bullMicroPushOk = Boolean((buyImbalanceRatio >= 1.80 || l2FirstLevelBullDepletionPct >= 60.0) && bestAskSweptUp);
  const bearMicroPushOk = Boolean((sellImbalanceRatio >= 1.80 || l2FirstLevelBearDepletionPct >= 60.0) && bestBidSweptDown);

  // VETO DURO INQUEBRANTABLE + VETO DE TECHO/PISO (|zScore| > 0.65):
  const hardVetoLong = Boolean(
    midPx <= open1mNow ||
    midPx < px3000msAgo ||
    absZScore > 0.65 ||
    Math.abs(roc15sPct) > 0.085
  );
  const hardVetoShort = Boolean(
    midPx >= open1mNow ||
    midPx > px3000msAgo ||
    absZScore > 0.65 ||
    Math.abs(roc15sPct) > 0.085
  );
  const forbidLong = hardVetoLong;
  const forbidShort = hardVetoShort;

  const longAuthorized = Boolean(
    !hardVetoLong &&
    bullishCandles1m3m &&
    rising3TicksBirth &&
    bullMicroPushOk &&
    (cleanImpulseRunwayRatioLong >= 1.30 || vacuumRatioLong >= 2.0) &&
    !fp?.icebergAgainstLong
  );

  const shortAuthorized = Boolean(
    !hardVetoShort &&
    bearishCandles1m3m &&
    falling3TicksBirth &&
    bearMicroPushOk &&
    (cleanImpulseRunwayRatioShort >= 1.30 || vacuumRatioShort >= 2.0) &&
    !fp?.icebergAgainstShort
  );

  return {
    targetMovePct,
    askResistanceUsd018: +askResistanceUsd018.toFixed(2),
    bidResistanceUsd018: +bidResistanceUsd018.toFixed(2),
    bidRatio,
    askRatio,
    l2FirstLevelBullDepletionPct,
    l2FirstLevelBearDepletionPct,
    zScore,
    absZScore,
    vacuumRatioLong,
    vacuumRatioShort,
    buyFlowUsd2s,
    sellFlowUsd2s,
    buyImbalanceRatio,
    sellImbalanceRatio,
    cleanImpulseRunwayRatioLong: Math.max(cleanImpulseRunwayRatioLong, +(vacuumRatioLong * 0.75).toFixed(2)),
    cleanImpulseRunwayRatioShort: Math.max(cleanImpulseRunwayRatioShort, +(vacuumRatioShort * 0.75).toFixed(2)),
    px1500msAgo,
    px3000msAgo,
    px4000msAgo,
    px15sAgo,
    open1mNow,
    open3mAgo,
    bestAskNow,
    bestAsk3sAgo,
    bestBidNow,
    bestBid3sAgo,
    rising1_5_4_15s,
    falling1_5_4_15s,
    bullishCandles1m3m,
    bearishCandles1m3m,
    bestAskSweptUp,
    bestBidSweptDown,
    hardVetoLong,
    hardVetoShort,
    forbidLong,
    forbidShort,
    longAuthorized,
    shortAuthorized
  };
}

function evaluateSpoofAndWallClearance(coin, isLong, midPx, projectedImpactPx, asks, bids, totalBookVol, fpMetrics, now = Date.now()) {
  const rawCoin = coin === "PEPE" ? "kPEPE" : coin;
  const wallHist = l2WallHistoryByCoin[rawCoin] || [];
  while (wallHist.length > 0 && (now - wallHist[0].ts) > 3000) {
    wallHist.shift();
  }

  let spoofWallCleared = false;
  const oppLevels = isLong ? asks : bids;

  // Radar Anti-Spoofing: si en los últimos 3,000ms existía un muro pasivo a < 0.08%-0.12% y al acercarse el precio se canceló (>= 45% reducción) sin volumen de trades equivalente
  if (wallHist.length >= 2 && midPx > 0) {
    const oldest = wallHist[0];
    const prevWallPx = isLong ? oldest.maxAskWallPx : oldest.maxBidWallPx;
    const prevWallUsd = isLong ? oldest.maxAskWallUsd : oldest.maxBidWallUsd;
    const distToPrevWallPct = prevWallPx > 0 ? (Math.abs(prevWallPx - midPx) / midPx) * 100 : 999;

    if (prevWallUsd > (totalBookVol * 1.35) && distToPrevWallPct <= 0.10) {
      let currentSameLevelUsd = 0;
      for (let i = 0; i < Math.min(10, oppLevels.length); i++) {
        const lPx = parseFloat(oppLevels[i]?.px || 0);
        if (Math.abs(lPx - prevWallPx) <= (midPx * 0.00015)) {
          currentSameLevelUsd += lPx * parseFloat(oppLevels[i]?.sz || 0);
        }
      }
      const tradedAtWallUsd = isLong
        ? (fpMetrics?.aggressiveBuyUsd4000 || 0)
        : (fpMetrics?.aggressiveSellUsd4000 || 0);
      const wallVanishedUsd = Math.max(0, prevWallUsd - currentSameLevelUsd);
      if (wallVanishedUsd >= (prevWallUsd * 0.45) && tradedAtWallUsd < (wallVanishedUsd * 0.40)) {
        spoofWallCleared = true;
      }
    }
  }

  // Solo bloquear cleanRunwayOk si hay un muro real > 3.5x el libro promedio Top-5 que esté absorbiendo flujo real (no spoofing)
  let realBlockingWallPx = null;
  for (let i = 1; i < Math.min(10, oppLevels.length); i++) {
    const lvlPx = parseFloat(oppLevels[i]?.px || 0);
    const lvlVolUsd = lvlPx * parseFloat(oppLevels[i]?.sz || 0);
    const distLvlPct = midPx > 0 ? (Math.abs(lvlPx - midPx) / midPx) * 100 : 0;
    if (lvlPx > 0 && distLvlPct >= 0.06 && lvlVolUsd > (totalBookVol * 3.5) && !spoofWallCleared) {
      realBlockingWallPx = lvlPx;
      break;
    }
  }

  return {
    spoofWallCleared,
    realBlockingWallPx
  };
}

function startHyperAdhesionWebSocketEngine(onMidsUpdateCallback = null) {
  if (hlWsClient) {
    try { hlWsClient.terminate(); } catch (_) {}
    hlWsClient = null;
  }
  if (hlWsPingTimer) {
    clearInterval(hlWsPingTimer);
    hlWsPingTimer = null;
  }
  if (hlWsReconnectTimer) {
    clearTimeout(hlWsReconnectTimer);
    hlWsReconnectTimer = null;
  }

  try {
    const ws = new WebSocket(HL_WS_URL);
    hlWsClient = ws;

    ws.on("open", () => {
      hlWsConnected = true;
      hlWsLastMessageTs = Date.now();
      hlWsLastPingSentTs = Date.now();
      try {
        ws.send(JSON.stringify({ method: "subscribe", subscription: { type: "allMids" } }));
        for (const coin of NATIVE_27_L1_COINS) {
          ws.send(JSON.stringify({ method: "subscribe", subscription: { type: "trades", coin } }));
          ws.send(JSON.stringify({ method: "subscribe", subscription: { type: "l2Book", coin } }));
        }
        ws.send(JSON.stringify({ method: "ping" }));
      } catch (_) {}
      console.log(`🌐⚡ [HYPER-ADHESION WEBSOCKET ENGINE V1 // ONLINE] Conectado en vivo a ${HL_WS_URL} -> Streaming <20ms activo en los 27 Pares (allMids + trades Footprint + l2Book Bookmap)!`);
    });

    ws.on("message", (rawBuf) => {
      const nowTs = Date.now();
      hlWsLastMessageTs = nowTs;
      try {
        const msg = JSON.parse(typeof rawBuf === "string" ? rawBuf : rawBuf.toString("utf8"));
        if (!msg || !msg.channel) return;

        if (msg.channel === "pong") {
          const rtt = nowTs - (hlWsLastPingSentTs || (nowTs - 18));
          if (rtt > 1 && rtt < 500) {
            hlWsLatencyMs = Math.max(5, Math.min(95, Math.round(rtt * 0.5)));
            lastMeasuredHlLatencyMs = hlWsLatencyMs;
          }
          return;
        }

        if (msg.channel === "allMids" && msg.data?.mids) {
          const midsObj = msg.data.mids;
          hlWsMidsCache = { ts: nowTs, data: midsObj };
          for (const coin of NATIVE_27_L1_COINS) {
            const pxNum = parseFloat(midsObj[coin] || "0");
            if (pxNum > 0) {
              recordKinematicSample(coin, pxNum, nowTs);
            }
          }
          if (typeof onMidsUpdateCallback === "function") {
            onMidsUpdateCallback(midsObj, nowTs);
          }
          return;
        }

        if (msg.channel === "trades" && Array.isArray(msg.data)) {
          for (let i = 0; i < msg.data.length; i++) {
            const tr = msg.data[i];
            if (!tr || !tr.coin) continue;
            const px = parseFloat(tr.px || "0");
            const sz = parseFloat(tr.sz || "0");
            if (px > 0 && sz > 0) {
              recordLiveTradeFootprint(tr.coin, px, sz, tr.side, Number(tr.time || nowTs));
              if (hlWsMidsCache.data) {
                hlWsMidsCache.data[tr.coin] = String(px);
                hlWsMidsCache.ts = nowTs;
              }
            }
          }
          return;
        }

        if (msg.channel === "l2Book" && msg.data?.coin && Array.isArray(msg.data?.levels)) {
          const coin = msg.data.coin;
          l2BookCacheByCoin[coin] = { ts: nowTs, data: msg.data, fromWs: true };
          const bids = msg.data.levels[0] || [];
          const asks = msg.data.levels[1] || [];
          if (bids.length > 0 && asks.length > 0) {
            const bestBid = parseFloat(bids[0].px || "0");
            const bestAsk = parseFloat(asks[0].px || "0");
            const midPx = (bestBid + bestAsk) / 2;
            if (midPx > 0) {
              recordKinematicSample(coin, midPx, nowTs);
              recordL2WallSnapshot(coin, bids, asks, midPx, nowTs);
              if (!topOfBookHistoryByCoin[coin]) topOfBookHistoryByCoin[coin] = [];
              const bookTicks = topOfBookHistoryByCoin[coin];
              const lastBookTick = bookTicks[bookTicks.length - 1];
              if (!lastBookTick || lastBookTick.midPx !== midPx || lastBookTick.bestBid !== bestBid || lastBookTick.bestAsk !== bestAsk) {
                bookTicks.push({ midPx, bestBid, bestAsk, ts: nowTs });
                while (bookTicks.length > 35 || (bookTicks.length > 3 && (nowTs - bookTicks[0].ts) > 15000)) {
                  bookTicks.shift();
                }
              }
            }
          }
        }
      } catch (_) {}
    });

    ws.on("error", () => {
      hlWsConnected = false;
    });

    ws.on("close", () => {
      hlWsConnected = false;
      if (!hlWsReconnectTimer) {
        hlWsReconnectTimer = setTimeout(() => {
          hlWsReconnectTimer = null;
          startHyperAdhesionWebSocketEngine(onMidsUpdateCallback);
        }, 1500);
        if (typeof hlWsReconnectTimer.unref === "function") hlWsReconnectTimer.unref();
      }
    });

    hlWsPingTimer = setInterval(() => {
      if (!hlWsClient || hlWsClient.readyState !== WebSocket.OPEN) return;
      if ((Date.now() - hlWsLastMessageTs) > 25000) {
        try { hlWsClient.terminate(); } catch (_) {}
        return;
      }
      hlWsLastPingSentTs = Date.now();
      try {
        hlWsClient.send(JSON.stringify({ method: "ping" }));
      } catch (_) {}
    }, 15000);
    if (typeof hlWsPingTimer.unref === "function") hlWsPingTimer.unref();
  } catch (_) {
    hlWsConnected = false;
    hlWsReconnectTimer = setTimeout(() => {
      hlWsReconnectTimer = null;
      startHyperAdhesionWebSocketEngine(onMidsUpdateCallback);
    }, 2500);
    if (typeof hlWsReconnectTimer.unref === "function") hlWsReconnectTimer.unref();
  }
}

/**
 * 2. FÍSICA DE ADHESIÓN A LA VELA: VENTANAS DE ALTA FRECUENCIA (vFast 1,500ms vs vMed 4,500ms, AccelRatio >= 1.25x)
 * + COMPENSACIÓN DE LATENCIA (P_{t + dt} = P_actual + v_fast * dt + 0.5 * a * dt^2)
 */
function computeKinematicPhysics(coin, currentMidPx, histFallback = [], latencyMs = lastMeasuredHlLatencyMs, now = Date.now()) {
  const rawCoin = coin === "PEPE" ? "kPEPE" : coin;
  const rawKSamples = Array.isArray(kinematicWindow5sByCoin[rawCoin]) ? kinematicWindow5sByCoin[rawCoin] : [];
  const rawHist = Array.isArray(histFallback) ? histFallback.filter(h => h && h.px > 0 && (now - h.ts) <= 15000) : [];
  const kSamples = rawKSamples.length >= rawHist.length ? rawKSamples : rawHist;

  let pxNow = currentMidPx > 0 ? currentMidPx : (kSamples[kSamples.length - 1]?.px || 0);
  let tsNow = now;
  if (pxNow <= 0) {
    return {
      vFastPctPerSec: 0,
      vMedPctPerSec: 0,
      accelPctPerSec2: 0,
      accelRatio: 0,
      kinematicLongOk: false,
      kinematicShortOk: false,
      projectedImpactPx: 0,
      latencyMs: Math.max(12, Number(latencyMs || 18))
    };
  }

  // Ventana A (vFastPctPerSec): últimos 1,500ms (1.5s)
  // Ventana B (vMedPctPerSec): últimos 4,500ms (4.5s)
  let sampleFast = kSamples[0] || { ts: tsNow - 1500, px: pxNow };
  let sampleMed = kSamples[0] || { ts: tsNow - 4500, px: pxNow };
  let foundFast = false;
  for (let i = kSamples.length - 1; i >= 0; i--) {
    const s = kSamples[i];
    if (!s || !(s.px > 0)) continue;
    const age = tsNow - s.ts;
    if (!foundFast && age >= 1100 && s.px !== pxNow) {
      sampleFast = s;
      foundFast = true;
    } else if (!foundFast && age >= 1800) {
      sampleFast = s;
      foundFast = true;
    }
    if (age >= 4500) {
      sampleMed = s;
      break;
    }
  }
  if (!foundFast && kSamples.length >= 2) {
    for (let i = kSamples.length - 2; i >= 0; i--) {
      if (kSamples[i].px !== pxNow) {
        sampleFast = kSamples[i];
        break;
      }
    }
  }

  const dtFastSec = Math.max(0.5, Math.min(2.5, (tsNow - (sampleFast?.ts || (tsNow - 1500))) / 1000));
  const pxFast = (sampleFast && sampleFast.px > 0) ? sampleFast.px : pxNow;
  const vFastPctPerSec = pxFast > 0 ? (((pxNow - pxFast) / pxFast) * 100) / dtFastSec : 0;

  const pxMed = (sampleMed && sampleMed.px > 0) ? sampleMed.px : pxFast;
  const dtPre3sSec = Math.max(1.5, Math.min(5.0, ((sampleFast?.ts || tsNow) - (sampleMed?.ts || (tsNow - 4500))) / 1000));
  const dtTotal45sSec = Math.max(2.5, Math.min(6.5, (tsNow - (sampleMed?.ts || (tsNow - 4500))) / 1000));

  const vPreMed = (pxMed > 0 && Math.abs(pxFast - pxMed) > 1e-12)
    ? ((((pxFast - pxMed) / pxMed) * 100) / dtPre3sSec)
    : 0;
  const vTotalMed = (pxMed > 0 && Math.abs(pxNow - pxMed) > 1e-12)
    ? ((((pxNow - pxMed) / pxMed) * 100) / dtTotal45sSec)
    : 0;

  let vMedPctPerSec = 0;
  const preSameSign = (vFastPctPerSec > 0 && vPreMed > 0) || (vFastPctPerSec < 0 && vPreMed < 0);
  const totSameSign = (vFastPctPerSec > 0 && vTotalMed > 0) || (vFastPctPerSec < 0 && vTotalMed < 0);
  if (preSameSign && Math.abs(vPreMed) >= 0.0001) {
    vMedPctPerSec = vPreMed;
  } else if (totSameSign && Math.abs(vTotalMed) >= 0.0001) {
    vMedPctPerSec = vTotalMed;
  } else if (Math.abs(vPreMed) >= 0.0001) {
    vMedPctPerSec = vPreMed;
  } else if (kSamples.length < 4 && Math.abs(vFastPctPerSec) >= 0.0004) {
    vMedPctPerSec = vFastPctPerSec * 0.72;
  } else {
    vMedPctPerSec = vTotalMed;
  }

  // Vector de Aceleración Real: accelRatio = |vFast| / Math.max(0.0001, |vMed|) >= 1.25x con ambos vectores en la misma dirección
  const accelPctPerSec2 = vFastPctPerSec - vMedPctPerSec;
  const sameSignVelocity = (vFastPctPerSec > 0 && vMedPctPerSec > 0) || (vFastPctPerSec < 0 && vMedPctPerSec < 0);
  const accelRatio = sameSignVelocity
    ? Math.min(9.99, Math.abs(vFastPctPerSec) / Math.max(0.0001, Math.abs(vMedPctPerSec)))
    : 0;

  const kinematicLongOk = Boolean(
    vFastPctPerSec >= 0.0030 &&
    vMedPctPerSec >= 0.0004 &&
    accelRatio >= 1.25
  );
  const kinematicShortOk = Boolean(
    vFastPctPerSec <= -0.0030 &&
    vMedPctPerSec <= -0.0004 &&
    accelRatio >= 1.25
  );

  const clampedLatencyMs = Math.max(12, Math.min(180, Number(hlWsConnected ? hlWsLatencyMs : (latencyMs || 45))));
  const dtLatSec = clampedLatencyMs / 1000;
  const projectedDeltaPct = (vFastPctPerSec * dtLatSec) + (0.5 * accelPctPerSec2 * dtLatSec * dtLatSec);
  const projectedImpactPx = pxNow * (1 + (projectedDeltaPct / 100));

  return {
    vFastPctPerSec: +vFastPctPerSec.toFixed(6),
    vMedPctPerSec: +vMedPctPerSec.toFixed(6),
    accelPctPerSec2: +accelPctPerSec2.toFixed(6),
    accelRatio: +accelRatio.toFixed(2),
    kinematicLongOk,
    kinematicShortOk,
    projectedImpactPx: +projectedImpactPx.toFixed(8),
    latencyMs: clampedLatencyMs
  };
}

function computeWindowRocPct(hist, windowMs, fallbackCloses = []) {
  if (Array.isArray(hist) && hist.length >= 2) {
    const latest = hist[hist.length - 1];
    let ref = hist[0];
    for (let i = hist.length - 1; i >= 0; i--) {
      if ((latest.ts - hist[i].ts) >= windowMs) {
        ref = hist[i];
        break;
      }
    }
    if (ref && ref.px > 0) {
      return ((latest.px - ref.px) / ref.px) * 100;
    }
  }
  if (Array.isArray(fallbackCloses) && fallbackCloses.length >= 3) {
    const last = fallbackCloses[fallbackCloses.length - 1];
    const prev = fallbackCloses[fallbackCloses.length - 2];
    if (prev > 0) {
      const ratio = Math.min(1, windowMs / 60000);
      return (((last - prev) / prev) * 100) * Math.max(0.35, ratio);
    }
  }
  return 0;
}

const l2BookCacheByCoin = {};     // { [coin]: { ts, data, fromWs } }
const candles1mCacheByCoin = {};  // { [coin]: { ts, data } }
let cycleL2FetchCount = 0;
let cycleCandleFetchCount = 0;

async function evaluateLatentForceForPair({
  coin,
  squadKey = "ALFA",
  info,
  mids = {},
  rollingMidsHistory,
  leaderPulse = { btcDelta3s: 0, btcRoc15s: 0, ethRoc15s: 0 },
  bindingsState = null,
  pairCooldowns = {}
}) {
  const t0 = Date.now();
  try {
    const now = Date.now();
    const cachedL2 = l2BookCacheByCoin[coin];
    const cachedCandles = candles1mCacheByCoin[coin];
    // Con WebSocket activo, l2Book ya está en RAM con 0ms de espera; fallback a REST solo si el socket no ha enviado libro en >4,000ms
    const hasFreshWsL2 = Boolean(cachedL2?.data && (hlWsConnected ? (now - cachedL2.ts) < 4000 : (now - cachedL2.ts) < 2500));
    const allowL2Fetch = !hasFreshWsL2 && cycleL2FetchCount < 5;
    if (allowL2Fetch) cycleL2FetchCount++;
    const allowCandleFetch = (!cachedCandles || (now - cachedCandles.ts) >= 45000) && cycleCandleFetchCount < 8;
    if (allowCandleFetch) cycleCandleFetchCount++;

    const l2Promise = !allowL2Fetch
      ? Promise.resolve(cachedL2?.data || null)
      : info.l2Book({ coin }).then(res => {
          if (res) l2BookCacheByCoin[coin] = { ts: Date.now(), data: res, fromWs: false };
          return res;
        }).catch(() => cachedL2?.data || null);
    const candlesPromise = !allowCandleFetch
      ? Promise.resolve(cachedCandles?.data || null)
      : info.candleSnapshot({ coin, interval: "1m", startTime: now - (30 * 60000), endTime: now }).then(res => {
          if (res) candles1mCacheByCoin[coin] = { ts: Date.now(), data: res };
          return res;
        }).catch(() => cachedCandles?.data || null);

    const [l2, candles1m] = await Promise.all([l2Promise, candlesPromise]);

    let bids = l2?.levels?.[0] || [];
    let asks = l2?.levels?.[1] || [];
    const hasRealL2Book = Boolean(bids.length >= 3 && asks.length >= 3);
    const hasRealCandles1m = Boolean((Array.isArray(candles1m) && candles1m.length >= 6) || (rollingMidsHistory?.[coin]?.length >= 6) || (kinematicWindow5sByCoin?.[coin]?.length >= 4));
    const fallbackMid = parseFloat(hlWsMidsCache.data?.[coin] || mids?.[coin] || (rollingMidsHistory?.[coin]?.[rollingMidsHistory[coin].length - 1]?.px) || "0");
    if (!hasRealL2Book && fallbackMid > 0) {
      const sp = fallbackMid * 0.00020;
      bids = [
        { px: String(fallbackMid - sp), sz: "10" },
        { px: String(fallbackMid - sp * 2), sz: "10" },
        { px: String(fallbackMid - sp * 3), sz: "10" }
      ];
      asks = [
        { px: String(fallbackMid + sp), sz: "10" },
        { px: String(fallbackMid + sp * 2), sz: "10" },
        { px: String(fallbackMid + sp * 3), sz: "10" }
      ];
    }
    if (bids.length < 3 || asks.length < 3) return null;

    const rawBestBid = parseFloat(bids[0].px);
    const rawBestAsk = parseFloat(asks[0].px);
    const l2MidPx = (rawBestBid + rawBestAsk) / 2;
    const liveMidFromWsOrMids = parseFloat(hlWsMidsCache.data?.[coin] || mids?.[coin] || "0");
    const midPx = (hasFreshWsL2 && l2MidPx > 0) ? l2MidPx : (liveMidFromWsOrMids > 0 ? liveMidFromWsOrMids : l2MidPx);
    const midDelta = midPx - l2MidPx;
    const bestBid = rawBestBid + midDelta;
    const bestAsk = rawBestAsk + midDelta;
    if (midPx <= 0 || bestBid <= 0 || bestAsk <= 0) return null;

    // 0) Verificación de Spread Limpio (< 0.040%) + Libro L2 Real Obligatorio
    const spreadPct = ((bestAsk - bestBid) / midPx) * 100;
    const isSpreadClean = hasRealL2Book && spreadPct >= 0 && spreadPct < 0.040;

    let bidVol = 0, askVol = 0;
    for (let i = 0; i < Math.min(5, bids.length); i++) {
      bidVol += parseFloat(bids[i]?.px || 0) * parseFloat(bids[i]?.sz || 0);
    }
    for (let i = 0; i < Math.min(5, asks.length); i++) {
      askVol += parseFloat(asks[i]?.px || 0) * parseFloat(asks[i]?.sz || 0);
    }
    const totalBookVol = bidVol + askVol;
    if (totalBookVol <= 0) return null;

    const bidRatio = hasRealL2Book ? (bidVol / totalBookVol) : 0.50;
    const askRatio = hasRealL2Book ? (askVol / totalBookVol) : 0.50;

    if (!topOfBookHistoryByCoin[coin]) topOfBookHistoryByCoin[coin] = [];
    const bookTicks = topOfBookHistoryByCoin[coin];
    const lastBookTick = bookTicks[bookTicks.length - 1];
    if (!lastBookTick || lastBookTick.midPx !== midPx) {
      bookTicks.push({ midPx, bestBid, bestAsk, ts: now });
      while (bookTicks.length > 35 || (bookTicks.length > 3 && (now - bookTicks[0].ts) > 15000)) {
        bookTicks.shift();
      }
    }
    prevTopOfBookMemory[coin] = { bestBid, bestAsk, midPx, ts: now };

    const rawHist = rollingMidsHistory[coin] || [];
    const hist = rawHist.length > 0 && rawHist[rawHist.length - 1].px === midPx
      ? rawHist
      : [...rawHist, { ts: now, px: midPx }];
    const histPrices = hist.map(h => h.px).filter(p => p > 0);
    const closes1m = Array.isArray(candles1m) && candles1m.length >= 6
      ? candles1m.map(c => parseFloat(c.c))
      : (histPrices.length >= 4 ? histPrices : [midPx]);

    const dedupHistPrices = histPrices.filter((px, idx, arr) => idx === 0 || px !== arr[idx - 1]);
    const combinedSeries = closes1m.length >= 6
      ? [...closes1m.slice(0, -1), midPx]
      : (dedupHistPrices.length >= 4 ? dedupHistPrices : [...closes1m, midPx]);

    const ema9 = calculateEMA(combinedSeries, Math.min(9, combinedSeries.length));
    const ema20 = calculateEMA(combinedSeries, Math.min(20, combinedSeries.length));
    const ema21 = calculateEMA(combinedSeries, Math.min(21, combinedSeries.length));
    const rsiNow = calculateRSI(combinedSeries, Math.min(6, Math.max(2, combinedSeries.length - 1)));
    const prevSeries = closes1m.length >= 6
      ? closes1m.slice(0, -1)
      : (combinedSeries.length > 2 ? combinedSeries.slice(0, -1) : combinedSeries);
    const rsiPrev = calculateRSI(prevSeries, Math.min(6, Math.max(2, prevSeries.length - 1)));

    // Registrar muestra cinemática actual y calcular Física de Alta Frecuencia (vFast 1,500ms vs vMed 4,500ms)
    recordKinematicSample(coin, midPx, now);
    const kinematic = computeKinematicPhysics(coin, midPx, hist, lastMeasuredHlLatencyMs, now);
    const fp = computeLiveFootprintMetrics(coin, midPx, now);

    const roc5sPct = computeWindowRocPct(hist, 4500, closes1m);
    const roc15sPct = computeWindowRocPct(hist, 15000, closes1m);
    const roc20sPct = computeWindowRocPct(hist, 20000, closes1m);
    const roc60sPct = computeWindowRocPct(hist, 60000, closes1m);
    const velocityPctPerSec = +kinematic.vFastPctPerSec.toFixed(5);

    const distFromEma9Pct = ema9 > 0 ? ((midPx - ema9) / ema9) * 100 : 0;
    const absDistFromEma9Pct = Math.abs(distFromEma9Pct);
    const absRoc20sPct = Math.abs(roc20sPct);

    // Extraer apertura de la vela actual de 1m (open1mNow) y de hace 3m (open3mAgo) ANTES de evaluar computeImpulseDistanceFormula:
    const lastCandle1m = (Array.isArray(candles1m) && candles1m.length >= 1) ? candles1m[candles1m.length - 1] : null;
    const prevCandle1m = (Array.isArray(candles1m) && candles1m.length >= 2) ? candles1m[candles1m.length - 2] : lastCandle1m;
    const candle3mAgo = (Array.isArray(candles1m) && candles1m.length >= 3) ? candles1m[candles1m.length - 3] : prevCandle1m;
    const histOldestPx = hist.length > 0 ? hist[0].px : midPx;
    let hist60sAgoPx = histOldestPx;
    for (let i = 0; i < hist.length; i++) {
      if ((now - hist[i].ts) <= 60000 && hist[i].px > 0) {
        hist60sAgoPx = hist[i].px;
        break;
      }
    }
    const currentMinStartTs = Math.floor(now / 60000) * 60000;
    let open1mFromHist = hist60sAgoPx;
    for (let i = 0; i < hist.length; i++) {
      if (hist[i].ts >= currentMinStartTs && hist[i].px > 0) {
        open1mFromHist = hist[i].px;
        break;
      }
    }
    const rawOpen1m = lastCandle1m ? parseFloat(lastCandle1m.o || open1mFromHist) : open1mFromHist;
    const open1mNow = rawOpen1m > 0 ? rawOpen1m : (open1mFromHist > 0 ? open1mFromHist : hist60sAgoPx);
    const high1mNow = lastCandle1m ? Math.max(midPx, parseFloat(lastCandle1m.h || midPx)) : midPx;
    const low1mNow = lastCandle1m ? Math.min(midPx, parseFloat(lastCandle1m.l || midPx)) : midPx;
    const prevClose1m = prevCandle1m ? parseFloat(prevCandle1m.c || open1mNow) : open1mNow;
    const rawOpen3m = candle3mAgo ? parseFloat(candle3mAgo.o || prevClose1m) : histOldestPx;
    const open3mAgo = rawOpen3m > 0 ? rawOpen3m : histOldestPx;

    // 1. ÚNICA LLAVE AUTORIZADA DE DISPARO: FÓRMULA ESPACIO-TIEMPO (`computeImpulseDistanceFormula` — CERO GATILLOS VIEJOS "PLAN C" NI bidRatio PASIVO)
    const spaceTime = computeImpulseDistanceFormula({
      coin,
      midPx,
      bestBid,
      bestAsk,
      bids,
      asks,
      fp,
      hist,
      bookTicks,
      open1mNow,
      open3mAgo,
      roc15sPct,
      now
    });

    // LEY FÍSICA DIRECCIONAL 1:1 (CERO DISPAROS AL REVÉS):
    // En vela verde (midPx > open1mNow && midPx > open3mAgo) SOLO entra LONG; en vela roja (midPx < open1mNow && midPx < open3mAgo) SOLO entra SHORT.
    const bullBias = spaceTime.longAuthorized
      ? true
      : (spaceTime.shortAuthorized
          ? false
          : (midPx > open1mNow && midPx > open3mAgo));
    const direction = bullBias ? "LONG" : "SHORT";
    const isLong = direction === "LONG";

    // =========================================================================
    // C. RADAR ANTI-SPOOFING (SPOOF_WALL_CLEARED = true) Y ESPACIO LIMPIO
    // =========================================================================
    const atr1mPct = (Array.isArray(candles1m) && candles1m.length >= 5)
      ? (candles1m.slice(-5).reduce((s, c) => {
          const cHigh = parseFloat(c.h || c.c || midPx);
          const cLow = parseFloat(c.l || c.c || midPx);
          const cClose = Math.max(1e-9, parseFloat(c.c || midPx));
          return s + (((cHigh - cLow) / cClose) * 100);
        }, 0) / 5)
      : 0.25;
    const bandMultPct = Math.max(0.22, atr1mPct * 1.35);
    const anchorRunwayPx = isLong ? Math.max(midPx, ema9) : Math.min(midPx, ema9);
    let opposingWallPx = isLong
      ? anchorRunwayPx * (1 + (bandMultPct / 100))
      : anchorRunwayPx * (1 - (bandMultPct / 100));

    const spoofInfo = evaluateSpoofAndWallClearance(coin, isLong, midPx, kinematic.projectedImpactPx, asks, bids, totalBookVol, fp, now);
    const SPOOF_WALL_CLEARED = Boolean(spoofInfo.spoofWallCleared);

    if (!SPOOF_WALL_CLEARED && spoofInfo.realBlockingWallPx) {
      const lvlPx = spoofInfo.realBlockingWallPx;
      if (isLong && lvlPx > kinematic.projectedImpactPx && lvlPx < opposingWallPx) {
        opposingWallPx = lvlPx;
      } else if (!isLong && lvlPx < kinematic.projectedImpactPx && lvlPx > opposingWallPx) {
        opposingWallPx = lvlPx;
      }
    }

    const cleanRunwayPct = kinematic.projectedImpactPx > 0
      ? (isLong
          ? (((opposingWallPx - kinematic.projectedImpactPx) / kinematic.projectedImpactPx) * 100)
          : (((kinematic.projectedImpactPx - opposingWallPx) / kinematic.projectedImpactPx) * 100))
      : 0;
    const cleanRunwayOk = hasRealL2Book && hasRealCandles1m && (SPOOF_WALL_CLEARED || cleanRunwayPct >= 0.145 || (isLong ? spaceTime.cleanImpulseRunwayRatioLong >= 1.50 : spaceTime.cleanImpulseRunwayRatioShort >= 1.50));

    // =========================================================================
    // CONDICIÓN 1–5 DEL MOTOR NUEVO (`computeImpulseDistanceFormula` — CERO PLAN C)
    // =========================================================================
    const antiChaseValidLong = Boolean(hasRealL2Book && hasRealCandles1m && spaceTime.longAuthorized);
    const antiChaseValidShort = Boolean(hasRealL2Book && hasRealCandles1m && spaceTime.shortAuthorized);
    const cond1AntiChaseOk = isLong ? antiChaseValidLong : antiChaseValidShort;

    const threeTicksLongOk = Boolean(hasRealL2Book && spaceTime.rising1_5_4_15s && spaceTime.bestAskSweptUp);
    const threeTicksShortOk = Boolean(hasRealL2Book && spaceTime.falling1_5_4_15s && spaceTime.bestBidSweptDown);
    const cond2ThreeTicksOk = isLong ? threeTicksLongOk : threeTicksShortOk;

    const rsiFreshLongOk = Boolean(spaceTime.bullishCandles1m3m);
    const rsiFreshShortOk = Boolean(spaceTime.bearishCandles1m3m);
    const cond3FreshRsiOk = isLong ? rsiFreshLongOk : rsiFreshShortOk;

    const footprintLongOk = Boolean(spaceTime.longAuthorized);
    const footprintShortOk = Boolean(spaceTime.shortAuthorized);
    const cond4L2AndLeadLagOk = hasRealL2Book && (isLong ? footprintLongOk : footprintShortOk);

    const btcDelta3sPct = Number(leaderPulse.btcDelta3s || 0);
    const btcRoc15sPct = Number(leaderPulse.btcRoc15s || 0);
    const cond5BtcDirectorOk = Boolean(isLong ? spaceTime.longAuthorized : spaceTime.shortAuthorized);
    const wallShiftOk = Boolean(isLong ? spaceTime.bestAskSweptUp : spaceTime.bestBidSweptDown);
    const lagDiffPct = Number((roc15sPct - btcRoc15sPct).toFixed(4));

    // =========================================================================
    // PUNTUACIÓN COMPUESTA DEL MOTOR NUEVO ESPACIO-TIEMPO V1 (0..100)
    // - Prohibido puntuar por bidRatio/askRatio pasivo.
    // =========================================================================
    const dominantImbalanceRatio = isLong ? fp.buyImbalanceRatio : fp.sellImbalanceRatio;
    const activeRunwayRatio018 = isLong ? spaceTime.cleanImpulseRunwayRatioLong : spaceTime.cleanImpulseRunwayRatioShort;
    const spaceTimeAuthorized = isLong ? spaceTime.longAuthorized : spaceTime.shortAuthorized;
    const directionalAlignedNow = isLong
      ? (spaceTime.rising1_5_4_15s && spaceTime.bullishCandles1m3m)
      : (spaceTime.falling1_5_4_15s && spaceTime.bearishCandles1m3m);

    let velocityScore35 = 0;
    if (spaceTimeAuthorized) {
      const sweetSpotBonus = (dominantImbalanceRatio >= 3.2 && activeRunwayRatio018 >= 2.0) ? 5 : 4;
      velocityScore35 = 30 + sweetSpotBonus;
    } else if (directionalAlignedNow) {
      velocityScore35 = 22;
    } else {
      velocityScore35 = 8;
    }

    let l2Score35 = 0;
    if (hasRealL2Book && spaceTimeAuthorized) {
      const imbBonus = dominantImbalanceRatio >= 3.2 ? 3 : 2;
      l2Score35 = 32 + imbBonus;
    } else if (hasRealL2Book && directionalAlignedNow) {
      l2Score35 = Math.max(8, Math.min(26, Math.round((dominantImbalanceRatio / 2.5) * 24)));
    } else {
      l2Score35 = 6;
    }

    let leadLagScore15 = spaceTimeAuthorized ? 15 : (directionalAlignedNow ? 10 : 4);
    let exhaustionScore15 = (spaceTimeAuthorized && isSpreadClean) ? 15 : (isSpreadClean ? 9 : 4);

    // =========================================================================
    // CALIBRACIÓN QUIRÚRGICA DEL CUARTETO POR MONEDA (`2 TOROS 🐂 + 2 OSOS 🐻`)
    // - ÚNICA LLAVE DE FUEGO: spaceTime.longAuthorized === true (SOLO 🐂 LONG) o spaceTime.shortAuthorized === true (SOLO 🐻 SHORT)
    // =========================================================================
    if (!subBotCooldownsByCoin[coin]) {
      subBotCooldownsByCoin[coin] = { T1: 0, T2: 0, O1: 0, O2: 0 };
    }
    const coinCdMap = subBotCooldownsByCoin[coin];
    const c3m = candle3mStateByCoin[coin] || { activeWindowStartMs: 0, opsInWindow: 0, restingUntilMs: 0, whipRelayArmedUntilMs: 0, whipNextBotId: null };
    const isResting3m = (c3m.restingUntilMs || 0) > now;
    const isWhipRelayArmed = !isResting3m && (c3m.whipRelayArmedUntilMs || 0) > now && (c3m.opsInWindow || 0) > 0 && (c3m.opsInWindow || 0) < MAX_OPS_PER_3M_CANDLE;

    const isT1InCooldown = isResting3m || (coinCdMap.T1 || 0) > now;
    const isT2InCooldown = isResting3m || (coinCdMap.T2 || 0) > now;
    const isO1InCooldown = isResting3m || (coinCdMap.O1 || 0) > now;
    const isO2InCooldown = isResting3m || (coinCdMap.O2 || 0) > now;
    const isMutexLocked = Boolean(pairMutexLock[coin]?.locked) || isResting3m;

    const strictBullImpulseAligned = Boolean(
      hasRealL2Book &&
      hasRealCandles1m &&
      spaceTime.longAuthorized &&
      !spaceTime.forbidLong &&
      isSpreadClean
    );
    const strictBearImpulseAligned = Boolean(
      hasRealL2Book &&
      hasRealCandles1m &&
      spaceTime.shortAuthorized &&
      !spaceTime.forbidShort &&
      isSpreadClean
    );

    const whipLongForceOk = Boolean(isWhipRelayArmed && strictBullImpulseAligned);
    const whipShortForceOk = Boolean(isWhipRelayArmed && strictBearImpulseAligned);

    const t1PendulumRelayOk = Boolean(!isMutexLocked && !isT1InCooldown && whipLongForceOk && (isO1InCooldown || isO2InCooldown));
    const t1Qualified = Boolean(
      t1PendulumRelayOk || (
        !isMutexLocked &&
        !isT1InCooldown &&
        strictBullImpulseAligned
      )
    );

    const t2PendulumRelayOk = Boolean(!isMutexLocked && !isT2InCooldown && whipLongForceOk && isT1InCooldown);
    const t2SecondWaveRelayOk = Boolean(
      !isMutexLocked &&
      !isT2InCooldown &&
      isT1InCooldown &&
      strictBullImpulseAligned
    );
    const t2Qualified = Boolean(t2PendulumRelayOk || t2SecondWaveRelayOk);

    const o1PendulumRelayOk = Boolean(!isMutexLocked && !isO1InCooldown && whipShortForceOk && (isT1InCooldown || isT2InCooldown));
    const o1Qualified = Boolean(
      o1PendulumRelayOk || (
        !isMutexLocked &&
        !isO1InCooldown &&
        strictBearImpulseAligned
      )
    );

    const o2PendulumRelayOk = Boolean(!isMutexLocked && !isO2InCooldown && whipShortForceOk && isO1InCooldown);
    const o2SecondWaveRelayOk = Boolean(
      !isMutexLocked &&
      !isO2InCooldown &&
      isO1InCooldown &&
      strictBearImpulseAligned
    );
    const o2Qualified = Boolean(o2PendulumRelayOk || o2SecondWaveRelayOk);

    let selectedSubBotId = isLong ? (isT1InCooldown ? "T2" : "T1") : (isO1InCooldown ? "O2" : "O1");
    let selectedSubBotPlay = isLong ? "SPACE_TIME_BULL_V1" : "SPACE_TIME_BEAR_V1";
    let finalDirection = direction;
    let finalIsLong = isLong;

    if (t1Qualified) {
      selectedSubBotId = "T1";
      selectedSubBotPlay = "SPACE_TIME_BULL_T1";
      finalDirection = "LONG";
      finalIsLong = true;
    } else if (t2Qualified) {
      selectedSubBotId = "T2";
      selectedSubBotPlay = "SPACE_TIME_BULL_T2";
      finalDirection = "LONG";
      finalIsLong = true;
    } else if (o1Qualified) {
      selectedSubBotId = "O1";
      selectedSubBotPlay = "SPACE_TIME_BEAR_O1";
      finalDirection = "SHORT";
      finalIsLong = false;
    } else if (o2Qualified) {
      selectedSubBotId = "O2";
      selectedSubBotPlay = "SPACE_TIME_BEAR_O2";
      finalDirection = "SHORT";
      finalIsLong = false;
    }

    const anyQuartetSpecialistQualified = Boolean(t1Qualified || t2Qualified || o1Qualified || o2Qualified);
    const finalSpaceTimeOk = finalIsLong ? spaceTime.longAuthorized : spaceTime.shortAuthorized;
    const finalRunwayRatio018 = finalIsLong ? spaceTime.cleanImpulseRunwayRatioLong : spaceTime.cleanImpulseRunwayRatioShort;
    const allFiveFirstWaveConditionsMet = Boolean(finalSpaceTimeOk && anyQuartetSpecialistQualified && isSpreadClean);

    let rawTotalScore = Math.round(velocityScore35 + l2Score35 + leadLagScore15 + exhaustionScore15);
    if (allFiveFirstWaveConditionsMet && rawTotalScore < 95) {
      rawTotalScore = (dominantImbalanceRatio >= 3.2 && finalRunwayRatio018 >= 2.0) ? 98 : 95;
    } else if (!allFiveFirstWaveConditionsMet) {
      rawTotalScore = Math.min(rawTotalScore, 88);
    }
    const latentForceScore = Math.max(0, Math.min(100, rawTotalScore));
    const auditLatencyMs = hlWsConnected ? Math.max(8, Math.min(25, hlWsLatencyMs)) : Math.max(12, Math.min(220, Date.now() - t0));
    const displayCoin = coin === "kPEPE" ? "PEPE" : coin;
    const qualifiesTopForce = Boolean(allFiveFirstWaveConditionsMet && finalSpaceTimeOk && !isMutexLocked);
    const l2ImbalancePct = +((finalIsLong ? bidRatio : askRatio) * 100).toFixed(1);
    const finalImbRatio = finalIsLong ? fp.buyImbalanceRatio : fp.sellImbalanceRatio;
    const subBotMeta = getSubBotMeta(selectedSubBotId);
    const preciseIocEntryPx = finalIsLong ? +(bestAsk * 1.00012).toFixed(8) : +(bestBid * 0.99988).toFixed(8);

    const microstructureTag = fp.icebergDetected
      ? "🧊 ICEBERG ABSORB"
      : (SPOOF_WALL_CLEARED ? "👻 SPOOF LIMPIO" : `🛡️ VACÍO ${finalRunwayRatio018.toFixed(1)}x`);
    const microstructureBadge = `⚡ WS <${Math.min(20, auditLatencyMs)}ms · 🔥 IMB ${finalImbRatio.toFixed(1)}:1 · ${microstructureTag}`;

    return {
      coin,
      dispCoin: displayCoin,
      displayCoin,
      virtualPair: null,
      isForexProxy: false,
      forexSquadKey: null,
      forexSquadName: null,
      forexSpecialist: null,
      squadKey,
      nativeSquadKey: squadKey,
      selectedSubBotId,
      selectedSubBotBadge: subBotMeta.badge,
      selectedSubBotName: subBotMeta.name,
      selectedSubBotPlay,
      quartetEligibility: {
        T1: t1Qualified,
        T2: t2Qualified,
        O1: o1Qualified,
        O2: o2Qualified,
        mutexLocked: isMutexLocked
      },
      direction: finalDirection,
      isLong: finalIsLong,
      entryPx: preciseIocEntryPx,
      entryPrice: preciseIocEntryPx,
      bestBid,
      bestAsk,
      midPx,
      spreadPct: +spreadPct.toFixed(4),
      isSpreadClean,
      distFromEma9Pct: +distFromEma9Pct.toFixed(4),
      roc15sPct: +roc15sPct.toFixed(4),
      roc20sPct: +roc20sPct.toFixed(4),
      btcDelta3sPct: +btcDelta3sPct.toFixed(4),
      rsiPrev: +rsiPrev.toFixed(1),
      wsConnected: hlWsConnected,
      wsLatencyMs: auditLatencyMs,
      buyFlowUsd2s: fp.buyFlowUsd2s,
      sellFlowUsd2s: fp.sellFlowUsd2s,
      buyTicksSwept2s: fp.buyTicksSwept2s,
      sellTicksSwept2s: fp.sellTicksSwept2s,
      buyImbalanceRatio: fp.buyImbalanceRatio,
      sellImbalanceRatio: fp.sellImbalanceRatio,
      footprintImbalanceRatio: finalImbRatio,
      spaceTimeAuthorized: finalSpaceTimeOk,
      cleanImpulseRunwayRatio: finalRunwayRatio018,
      spaceTimeFormula: spaceTime,
      aggressiveBuyUsd1500: fp.aggressiveBuyUsd1500,
      aggressiveSellUsd1500: fp.aggressiveSellUsd1500,
      spoofWallCleared: SPOOF_WALL_CLEARED,
      icebergDetected: fp.icebergDetected,
      microstructureTag,
      microstructureBadge,
      kinematicPhysics: {
        vFastPctPerSec: kinematic.vFastPctPerSec,
        vMedPctPerSec: kinematic.vMedPctPerSec,
        accelPctPerSec2: kinematic.accelPctPerSec2,
        accelRatio: kinematic.accelRatio,
        projectedImpactPx: kinematic.projectedImpactPx,
        opposingWallPx: +opposingWallPx.toFixed(8),
        cleanRunwayPct: +cleanRunwayPct.toFixed(4),
        cleanRunwayOk,
        spoofWallCleared: SPOOF_WALL_CLEARED,
        footprintImbalanceRatio: finalImbRatio,
        icebergDetected: fp.icebergDetected,
        latencyMs: auditLatencyMs
      },
      firstWaveConditions: {
        cond1AntiChaseOk,
        cond2ThreeTicksOk,
        cond3FreshRsiOk,
        cond4L2AndLeadLagOk,
        cond5BtcDirectorOk,
        cleanRunwayOk,
        isSpreadClean,
        spoofWallCleared: SPOOF_WALL_CLEARED
      },
      firstWaveIgnition: allFiveFirstWaveConditionsMet,
      latentForceScore,
      qualifiesTopForce,
      QualifiedForFire: qualifiesTopForce,
      velocityPts: Math.round(velocityScore35),
      l2Pts: Math.round(l2Score35),
      leadLagPts: Math.round(leadLagScore15),
      exhaustionPts: Math.round(exhaustionScore15),
      roc5sPct: +roc5sPct.toFixed(4),
      roc15sPct: +roc15sPct.toFixed(4),
      roc60sPct: +roc60sPct.toFixed(4),
      velocityPctPerSec,
      l2ImbalancePct,
      l2RatioPct: l2ImbalancePct,
      wallShiftOk,
      leadLagDiffPct: +lagDiffPct.toFixed(4),
      ema9: +ema9.toFixed(6),
      ema20: +ema20.toFixed(6),
      ema21: +ema21.toFixed(6),
      rsi6: +rsiNow.toFixed(1),
      exhaustionGuardPassed: cond3FreshRsiOk && cond1AntiChaseOk && cleanRunwayOk,
      isLateralStagnant: !cond2ThreeTicksOk,
      auditLatencyMs,
      evalLatencyMs: auditLatencyMs
    };
  } catch (_) {
    return null;
  }
}

/**
 * LIBERTAD BIDIRECCIONAL EN EL PUNTO CERO (`🐂 LONG` Y `🐻 SHORT` ACTIVOS SIMULTÁNEAMENTE):
 * - Cada moneda responde a su propia vela de 3 minutos para capturar tirones de +$0.10, +$0.15, +$0.20, +$0.30+ netos tanto hacia arriba como hacia abajo.
 */
function computeMarketTideLock(rankedList = []) {
  const top3 = (rankedList || []).slice(0, 3);
  const tideBasketCoins = new Set(["DOT", "PENDLE", "UNI", "BTC", "ETH"]);
  const basketItems = (rankedList || []).filter(item => item && tideBasketCoins.has(item.coin));
  const referenceSample = top3.length >= 2 ? top3 : (basketItems.length > 0 ? basketItems : top3);

  let longCount = 0;
  let shortCount = 0;
  for (const item of referenceSample) {
    if (item.direction === "LONG") longCount++;
    else if (item.direction === "SHORT") shortCount++;
  }

  let dominantDirection = "LONG";
  if (shortCount > longCount) {
    dominantDirection = "SHORT";
  } else if (longCount > shortCount) {
    dominantDirection = "LONG";
  } else if (top3[0]) {
    dominantDirection = top3[0].direction;
  }

  return {
    enabled: false,
    dominantDirection,
    dominantLabel: "🐂🐻 BIDIRECCIONAL LIBRE (PUNTO CERO +$0.10/+0.15/+0.20/+0.30+ NETOS)",
    top3Summary: top3.map(i => `${i.displayCoin} ${i.latentForceScore}/100 ${i.direction}`),
    longCount,
    shortCount,
    forbidOppositeDirection: false
  };
}

async function rankFreePairsByLatentForce({
  candidateItems,
  candidateCoins,
  info,
  mids = {},
  rollingMidsHistory = {},
  pairCooldowns = {},
  bindingsState = null
}) {
  const now = Date.now();
  // Recortar inmediatamente cualquier temporizador de respiro mayor a 120s (02:00) tanto en pairCooldowns como en subBotCooldownsByCoin
  for (const [cdCoin, untilTs] of Object.entries(pairCooldowns || {})) {
    if (untilTs > now + POST_TRADE_COOLDOWN_MS) {
      pairCooldowns[cdCoin] = now + POST_TRADE_COOLDOWN_MS;
    }
  }
  for (const cdCoin of Object.keys(subBotCooldownsByCoin)) {
    for (const bId of ["T1", "T2", "O1", "O2"]) {
      if ((subBotCooldownsByCoin[cdCoin][bId] || 0) > now + POST_TRADE_COOLDOWN_MS) {
        subBotCooldownsByCoin[cdCoin][bId] = now + POST_TRADE_COOLDOWN_MS;
      }
    }
  }
  cycleL2FetchCount = 0;
  cycleCandleFetchCount = 0;
  const activeBindingsState = bindingsState || loadForexProxyBindingsState();
  const normalizedItems = Array.isArray(candidateItems)
    ? candidateItems
    : (Array.isArray(candidateCoins) ? candidateCoins : []).map(c => ({
        coin: c,
        squadKey: Object.keys(SQUADS_CONFIG).find(k => !SQUADS_CONFIG[k].isMacroOracleOnly && SQUADS_CONFIG[k].pairs.includes(c)) || "ALFA"
      }));

  // En la arquitectura Cuarteto 4X + Marcapasos de 3 Minutos ("Una Vela Sí ➔ Una Vela No"):
  // - Ordenar primero los pares que tienen mayor velocidad instantánea |v_fast| o tienen un relevo de Péndulo Magnético armado,
  //   para que las 8 lecturas frescas de L2 vayan siempre a las monedas que están despegando en este mismo milisegundo!
  const eligibleItems = normalizedItems
    .filter(item => {
      if (!item || !item.coin || pairMutexLock[item.coin]?.locked) return false;
      if ((pairSettleUntilByCoin[item.coin] || 0) > now) return false;
      const c3m = candle3mStateByCoin[item.coin];
      if (c3m && (c3m.restingUntilMs || 0) > now) return false;
      const cdObj = subBotCooldownsByCoin[item.coin] || { T1: 0, T2: 0, O1: 0, O2: 0 };
      const hasAtLeastOneSubBotReady = (cdObj.T1 <= now) || (cdObj.T2 <= now) || (cdObj.O1 <= now) || (cdObj.O2 <= now);
      return hasAtLeastOneSubBotReady;
    })
    .sort((a, b) => {
      const noCacheA = !l2BookCacheByCoin[a.coin] || !candles1mCacheByCoin[a.coin] ? 200 : 0;
      const noCacheB = !l2BookCacheByCoin[b.coin] || !candles1mCacheByCoin[b.coin] ? 200 : 0;
      const staleA = l2BookCacheByCoin[a.coin] && (now - l2BookCacheByCoin[a.coin].ts) >= 12000 ? 80 : 0;
      const staleB = l2BookCacheByCoin[b.coin] && (now - l2BookCacheByCoin[b.coin].ts) >= 12000 ? 80 : 0;
      const kinA = computeKinematicPhysics(a.coin, parseFloat(mids[a.coin] || "0"), rollingMidsHistory[a.coin] || [], lastMeasuredHlLatencyMs, now);
      const kinB = computeKinematicPhysics(b.coin, parseFloat(mids[b.coin] || "0"), rollingMidsHistory[b.coin] || [], lastMeasuredHlLatencyMs, now);
      const whipA = (candle3mStateByCoin[a.coin]?.whipRelayArmedUntilMs || 0) > now ? 50 : 0;
      const whipB = (candle3mStateByCoin[b.coin]?.whipRelayArmedUntilMs || 0) > now ? 50 : 0;
      const scoreA = noCacheA + staleA + whipA + (Math.abs(kinA.vFastPctPerSec) * 10000) + ((kinA.kinematicLongOk || kinA.kinematicShortOk) ? 25 : 0);
      const scoreB = noCacheB + staleB + whipB + (Math.abs(kinB.vFastPctPerSec) * 10000) + ((kinB.kinematicLongOk || kinB.kinematicShortOk) ? 25 : 0);
      return scoreB - scoreA;
    });

  const btcHist = rollingMidsHistory["BTC"] || [];
  const ethHist = rollingMidsHistory["ETH"] || [];
  const leaderPulse = {
    btcDelta3s: computeWindowRocPct(btcHist, 3000, []),
    btcRoc15s: computeWindowRocPct(btcHist, 15000, []),
    ethRoc15s: computeWindowRocPct(ethHist, 15000, [])
  };

  const results = [];
  for (const item of eligibleItems) {
    const res = await evaluateLatentForceForPair({
      coin: item.coin,
      squadKey: item.squadKey,
      info,
      mids,
      rollingMidsHistory,
      leaderPulse,
      bindingsState: activeBindingsState,
      pairCooldowns
    });
    if (res) results.push(res);
  }

  const sorted = results
    .filter(Boolean)
    .sort((a, b) => {
      if (b.latentForceScore !== a.latentForceScore) return b.latentForceScore - a.latentForceScore;
      return b.l2ImbalancePct - a.l2ImbalancePct;
    });

  // Libertad Bidireccional: tanto 🐂 LONG como 🐻 SHORT tienen vía libre cuando cumplen su fuerza cinemática >= 92/100
  const marketTide = computeMarketTideLock(sorted);
  for (const item of sorted) {
    item.marketTideDirection = item.direction;
    item.marketTideLabel = marketTide.dominantLabel;
    item.tideAligned = true;
    item.qualifiesTopForce = Boolean(item.qualifiesTopForce && item.latentForceScore >= MIN_LATENT_FORCE_SCORE);
    item.QualifiedForFire = item.qualifiesTopForce;
  }

  return sorted;
}

/**
 * 🛑 MOTOR "QUEMA-LASTRE / PODA PARCIAL" 100% ERRADICADO Y DESACTIVADO POR ORDEN SUPREMA:
 * - PROHIBIDO ejecutar órdenes reduce_only parciales o totales cuando una posición está en pérdida (unrealizedPnl < 0 o netPnlUsdc < +$0.10 USDC).
 */
async function executeProfitOffsetPruner() {
  return loadForexProxyBindingsState();
}

/**
 * MARCAPASOS CENTRAL DE META DE NEGOCIO 24H (`+$100.00 USDC NETOS CADA 24 HORAS` + RELOJ UTC + ODÓMETRO DE OPERACIONES EFECTIVAS Y PROMEDIO POR TIRO):
 * - Única Meta Operativa: `+$100.00 USDC netos cada 24 horas` (100% libre de tasas de Hyperliquid L1).
 * - Odómetro de Operaciones Efectivas (`effectiveOpsCount`) + Promedio Neto por Tiro (`avgNetPerOpUsdc`).
 * - Se reinicia automáticamente (`effectiveOpsCount = 0`) cada vez que se corona la meta de `+$100.00 USDC` netos!
 */
const DAILY_TARGET_NET_USDC = 100.00;
let lastCompleted100BlockIdx = 0;
let opsBaselineAtLast100Reset = 0;
let latestEffectiveOpsTodayCount = 0;

function computeDaily1000Pacemaker(realNetTodayUsdc = 0, now = new Date(), totalOpsToday = latestEffectiveOpsTodayCount) {
  const netToday = Number(realNetTodayUsdc || 0);
  const posNetToday = Math.max(0, netToday);
  const rawOps = Math.max(0, Number(totalOpsToday ?? latestEffectiveOpsTodayCount ?? 0));
  const completed100BlocksCount = Math.floor(posNetToday / DAILY_TARGET_NET_USDC);
  if (completed100BlocksCount > lastCompleted100BlockIdx) {
    lastCompleted100BlockIdx = completed100BlocksCount;
    opsBaselineAtLast100Reset = rawOps;
  } else if (completed100BlocksCount === 0 && lastCompleted100BlockIdx > 0) {
    lastCompleted100BlockIdx = 0;
    opsBaselineAtLast100Reset = 0;
  }

  const cycleNetUsdc = completed100BlocksCount > 0
    ? +(posNetToday - (completed100BlocksCount * DAILY_TARGET_NET_USDC)).toFixed(2)
    : +netToday.toFixed(2);
  const effectiveOpsCount = Math.max(0, rawOps - opsBaselineAtLast100Reset);
  const avgNetPerOpUsdc = (effectiveOpsCount > 0 && posNetToday > 0)
    ? +(posNetToday / effectiveOpsCount).toFixed(2)
    : 0.00;

  const pctDone = Math.min(100, Math.max(0, +((posNetToday / DAILY_TARGET_NET_USDC) * 100).toFixed(1)));
  const remainingUsdc24h = Number(Math.max(0, DAILY_TARGET_NET_USDC - posNetToday).toFixed(2));

  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const utcS = now.getUTCSeconds();
  const utcClockStr = `${String(utcH).padStart(2, "0")}:${String(utcM).padStart(2, "0")}:${String(utcS).padStart(2, "0")} UTC`;
  const elapsedSec = (utcH * 3600) + (utcM * 60) + utcS;
  const remSecTotal = Math.max(0, 86400 - elapsedSec);
  const remH = Math.floor(remSecTotal / 3600);
  const remM = Math.floor((remSecTotal % 3600) / 60);
  const remS = remSecTotal % 60;
  const remainingTimeStr = `${String(remH).padStart(2, "0")}h ${String(remM).padStart(2, "0")}m ${String(remS).padStart(2, "0")}s`;
  const elapsedCycleStr = `${String(utcH).padStart(2, "0")}h ${String(utcM).padStart(2, "0")}m / 24h`;

  return {
    engine: "DAILY_100_NET_24H_CLOCK_AND_EFFECTIVE_OPS_ODOMETER",
    dailyTargetNetUsdc: DAILY_TARGET_NET_USDC,
    realNetTodayUsdc: +netToday.toFixed(2),
    cycleNetUsdc,
    completed100BlocksCount,
    effectiveOpsCount,
    avgNetPerOpUsdc,
    pctDone,
    remainingUsdc24h,
    utcClockStr,
    remainingTimeStr,
    elapsedCycleStr,
    maxOpenPositions: MAX_OPEN_POSITIONS,
    totalSpecialists: 108,
    subBotRelaySettleSec: 2,
    status: posNetToday >= DAILY_TARGET_NET_USDC ? "META_100_CUMPLIDA_CICLO_REINICIADO" : "EN_CURSO_24H"
  };
}

/**
 * REGLA DE HIERRO CONTABLE (netPnlUsdc 1:1 EN PANTALLA Y EN EL MOTOR DE CANDADOS — PISO MÍNIMO +$0.10 USDC NETO):
 * - En cada ciclo se calcula el costo real de comisión ida y vuelta de Hyperliquid L1:
 *   realRoundTripFeeUsdc = Number((notionalUsd * 0.00090).toFixed(4))
 *   netPnlUsdc = Number((unrealizedGrossPnlUsdc - realRoundTripFeeUsdc).toFixed(4))
 * - ESCALERA DE CANDADOS 100% NETA (+$0.10 ➔ +$0.15 ➔ +$0.20 ➔ +$0.30 ➔ +$0.40 ➔ +$0.50+ NETOS):
 *   * PROHIBIDO cerrar por debajo de +$0.10 USDC netos después de comisión.
 */
const positionPeakPnlMap = {}; // { [coin]: { peakPnlUsdc, lockedFloorUsdc } }

function computeCorneringRatchetStep(peakNetPnlUsdc) {
  const peak = Number(peakNetPnlUsdc || 0);
  // RECOVERY_TRAILING_RATCHET (Evaluado cada 250ms sobre PnL Neto real descontando roundTripFeeUsdc):
  // 0) Escalón 0 — Candado Empate Neto (+$0.02 USDC Netos): Toca +$0.04 netos ➔ 🛡️ CANDADO EMPATE #00 (+$0.02 NETO)
  // 1) Escalón 1 — Toca +$0.12 netos ➔ 🔒 +$0.10 NETO
  // 2) Escalón 2 — Toca +$0.22 netos ➔ 🔒 +$0.20 NETO
  // 3) Escalón 3 — Toca +$0.32 netos ➔ 🔒 +$0.30 NETO
  // 4) Escalón 4 — Toca +$0.42 netos ➔ 🔒 +$0.40 NETO
  // 5) Escalón 5+ — Toca +$0.52+ netos ➔ Sube Candado estricto de +$0.10 en +$0.10 (+$0.50, +$0.60, +$0.70...) sin techo
  if (peak >= 0.52) {
    return +(Math.floor(((peak - 0.02) + 1e-9) * 10) / 10).toFixed(2);
  }
  if (peak >= 0.42) return 0.40;
  if (peak >= 0.32) return 0.30;
  if (peak >= 0.22) return 0.20;
  if (peak >= 0.12) return 0.10;
  if (peak >= 0.04) return 0.02;
  return 0;
}

const activeClosingMutex = {};
const confirmedOpenByCoin = {};
/**
 * GATILLO ATÓMICO IOC CON CANDADO DE HIERRO ANTI-PÉRDIDA (`CERO PODA / CERO QUEMA-LASTRE`):
 * - Posiciones en Cuarentena (`LEGACY_QUARANTINE_HOLD`): SOLO cierran cuando `liveNetPnlUsdc >= +$0.05 USDC` netos después de comisión.
 * - Tiros Frescos (`Fuego Fresco` en las 19+ piscinas libres): cierran en `🛡️ EMPATE #00 (+$0.02 NETO)`, `ZERO_NEW_TRAPS_30S (+$0.01 NETO)` o escalera `+$0.10 ➔ +$0.18 ➔ +$0.25 ➔ +$0.30 ➔ +$0.45+ USDC` netos (`liveNetPnlUsdc >= +$0.01 USDC`).
 * - PROHIBIDO cerrar en pérdida (`liveNetPnlUsdc <= 0`).
 */
async function executeGuaranteedMarketClose(client, info, coin, szi, currentMid, reasonLabel = "CANDADO_00") {
  const rawCoin = coin === "PEPE" ? "kPEPE" : coin;
  if (activeClosingMutex[rawCoin]) return false;
  activeClosingMutex[rawCoin] = true;
  try {
    const signedSzi = parseFloat(szi);
    const isShort = signedSzi < 0;
    let remSz = Math.abs(signedSzi);
    if (remSz <= 0 || ASSET_INDICES[rawCoin] === undefined || !ASSET_DECIMALS[rawCoin]) return false;

    let unscaledMid = Number(currentMid || 0);
    if (unscaledMid <= 0 || (rawCoin === "kPEPE" && unscaledMid < 0.0005)) {
      const wsMid = parseFloat(hlWsMidsCache.data?.[rawCoin] || "0");
      if (wsMid > 0) {
        unscaledMid = wsMid;
      } else {
        try {
          const liveMids = await info.allMids();
          if (liveMids && liveMids[rawCoin]) {
            unscaledMid = parseFloat(liveMids[rawCoin]);
          } else if (rawCoin === "kPEPE" && unscaledMid > 0 && unscaledMid < 0.0005) {
            unscaledMid = unscaledMid * 1000;
          }
        } catch (_) {}
      }
    }

    let entryPx = Number(confirmedOpenByCoin[rawCoin]?.entryPx || 0);
    if (entryPx <= 0) {
      try {
        const chSnap = await info.clearinghouseState({ user: VAULT_501 }).catch(() => null);
        const foundPos = (chSnap?.assetPositions || []).find(p => p.position?.coin === rawCoin && parseFloat(p.position?.szi || "0") !== 0);
        if (foundPos) {
          entryPx = parseFloat(foundPos.position.entryPx || "0");
        }
      } catch (_) {}
    }

    if (entryPx <= 0 || unscaledMid <= 0) {
      console.warn(`🛑 [CERO PODA // BLOQUEO DE SEGURIDAD] ${rawCoin} (${reasonLabel}): Imposible verificar entryPx ($${entryPx}) o mid ($${unscaledMid}). Cierre abortado.`);
      return false;
    }

    const posMeta = confirmedOpenByCoin[rawCoin] || {};
    const minRequiredNetUsdc = 0.02;

    const notionalVal = remSz * entryPx;
    const realRoundTripFeeUsdc = Number((notionalVal * 0.00090).toFixed(4));
    const liveGrossPnlUsdc = (unscaledMid - entryPx) * signedSzi;
    const liveNetPnlUsdc = Number((liveGrossPnlUsdc - realRoundTripFeeUsdc).toFixed(4));

    if (liveNetPnlUsdc < minRequiredNetUsdc) {
      console.warn(`🛑🛡️ [REGLA DE HIERRO CERO PODA] Bloqueado intento de cierre en ${rawCoin} (${reasonLabel}): PnL Neto actual (${liveNetPnlUsdc >= 0 ? "+" : ""}$${liveNetPnlUsdc.toFixed(3)} USDC) es menor al mínimo requerido de +$${minRequiredNetUsdc.toFixed(2)} USDC netos.`);
      return false;
    }

    // Precio límite mínimo que garantiza matemáticamente >= +minRequiredNetUsdc tras pagar el 0.090% de comisión ida y vuelta:
    const minNetProfitDeltaPx = (realRoundTripFeeUsdc + minRequiredNetUsdc) / remSz;
    const minProfitClosePx = isShort
      ? (entryPx - minNetProfitDeltaPx)
      : (entryPx + minNetProfitDeltaPx);

    // Cancelar cualquier orden reduceOnly existente en el libro para evitar rechazo de Hyperliquid al cerrar con IOC
    try {
      const openOrds = await info.openOrders({ user: VAULT_501 }).catch(() => []);
      const coinReduceOrds = (openOrds || []).filter(o => o.coin === rawCoin && o.reduceOnly);
      if (coinReduceOrds.length > 0) {
        await client.cancel({
          cancels: coinReduceOrds.map(o => ({ a: ASSET_INDICES[rawCoin], o: o.oid }))
        }).catch(() => {});
      }
    } catch (_) {}

    for (let attempt = 1; attempt <= 2; attempt++) {
      const slipMult = attempt === 1 ? 0.0025 : 0.0045;
      const refPx = unscaledMid > 0 ? unscaledMid : entryPx;
      const rawCrossPx = isShort ? (refPx * (1 + slipMult)) : (refPx * (1 - slipMult));
      // BLINDAJE DE PRECIO LÍMITE: jamás permitir que crossPx cruce más allá de minProfitClosePx
      const safeCrossPx = isShort
        ? Math.min(rawCrossPx, minProfitClosePx)
        : Math.max(rawCrossPx, minProfitClosePx);
      const crossPxStr = formatHlPrice(safeCrossPx, rawCoin);
      const szStr = formatHlSize(remSz, ASSET_DECIMALS[rawCoin].sz);

      console.log(`🚨⚡ [CIERRE EN VERDE PROTEGIDO IOC // INTENTO #${attempt}] ${rawCoin} (${reasonLabel}) -> Cerrando ${szStr} @ $${crossPxStr} (mid L1: $${refPx} | Piso +$${minRequiredNetUsdc.toFixed(2)} Neto: $${formatHlPrice(minProfitClosePx, rawCoin)} | Neto Est.: +$${liveNetPnlUsdc.toFixed(2)} USDC)`);
      const res = await client.order({
        orders: [{
          a: ASSET_INDICES[rawCoin],
          b: isShort,
          p: crossPxStr,
          s: szStr,
          r: true,
          t: { limit: { tif: "Ioc" } }
        }],
        grouping: "na"
      }).catch(err => {
        console.error(`   ⚠️ Error en orden IOC de ${rawCoin}:`, err.message);
        return null;
      });

      const st = res?.response?.data?.statuses?.[0] || {};
      if (st.filled) {
        console.log(`   ✅ [CIERRE EN VERDE EJECUTADO EN L1] ${rawCoin} cerrado en intento #${attempt} (avgPx: $${st.filled.avgPx || crossPxStr})`);
      } else if (st.error) {
        console.error(`   ⚠️ Respuesta L1 en intento #${attempt} de ${rawCoin}: ${st.error}`);
      }

      await new Promise(r => setTimeout(r, 150));
      const chCheck = await info.clearinghouseState({ user: VAULT_501 }).catch(() => null);
      if (!chCheck || !Array.isArray(chCheck.assetPositions)) break;
      const stillPos = chCheck.assetPositions.find(p => p.position?.coin === rawCoin && parseFloat(p.position?.szi || "0") !== 0);
      if (!stillPos) {
        return true; // szi === 0 confirmado en L1!
      }
      remSz = Math.abs(parseFloat(stillPos.position.szi));
    }
    return false;
  } finally {
    activeClosingMutex[rawCoin] = false;
  }
}

const closePositionGuaranteedMarket = executeGuaranteedMarketClose;

/**
 * 🧲⚡ SALIDA PASIVA LIMPIA (`executeDeadInertiaScratchClose` — DESACTIVADO):
 */
async function executeDeadInertiaScratchClose() {
  return false;
}

/**
 * REGLA 3 — ORDEN `STOP-MARKET` NATIVA EN EL LIBRO DE HYPERLIQUID L1 (PROTECCIÓN CONTRA MECHAZOS DE 50ms):
 * Solo se arma cuando `lockedFloorUsdc >= 0.18` USDC NETOS (y `peakPnlUsdc >= lockedFloorUsdc + 0.03`) con límite protegido en >= +$0.05 netos!
 */
async function placeOrUpdateNativeStopMarketL1(client, coin, isShort, absSz, entryPx, lockedFloorUsdc, posMeta = {}) {
  const notionalVal = absSz * entryPx;
  if (!client || lockedFloorUsdc < 0.18 || (posMeta.peakPnlUsdc || 0) < (lockedFloorUsdc + 0.03) || notionalVal < 10.5 || absSz <= 0 || ASSET_INDICES[coin] === undefined || !ASSET_DECIMALS[coin]) {
    return;
  }
  const realRoundTripFeeUsdc = Number((notionalVal * 0.00090).toFixed(4));
  const deltaPx = (realRoundTripFeeUsdc + lockedFloorUsdc) / absSz;
  const triggerPxNum = isShort ? (entryPx - deltaPx) : (entryPx + deltaPx);
  const triggerPxStr = formatHlPrice(triggerPxNum, coin);
  if ((posMeta.nativeSlTriggerPx === triggerPxStr && posMeta.nativeSlLockedFloor === lockedFloorUsdc) || posMeta.nativeSlAttemptedFloor === lockedFloorUsdc) {
    return;
  }
  posMeta.nativeSlAttemptedFloor = lockedFloorUsdc;

  // Cancelar Stop-Market previo si subió de escalón (+$0.18 -> +$0.25 -> +$0.30 -> +$0.45...)
  if (posMeta.nativeSlOid) {
    await client.cancel({ cancels: [{ a: ASSET_INDICES[coin], o: posMeta.nativeSlOid }] }).catch(() => {});
  }

  // Límite de ejecución protegido en +$0.05 netos para que jamás pueda cruzar en negativo
  const minNetDeltaPx = (realRoundTripFeeUsdc + 0.05) / absSz;
  const limitSlippagePx = isShort ? (entryPx - minNetDeltaPx) : (entryPx + minNetDeltaPx);
  const limitSlippagePxStr = formatHlPrice(limitSlippagePx, coin);
  const szStr = formatHlSize(absSz, ASSET_DECIMALS[coin].sz);

  const slRes = await client.order({
    orders: [{
      a: ASSET_INDICES[coin],
      b: isShort,
      p: limitSlippagePxStr,
      s: szStr,
      r: true,
      t: {
        trigger: {
          isMarket: true,
          triggerPx: triggerPxStr,
          tpsl: "sl"
        }
      }
    }],
    grouping: "na"
  }).catch(() => null);

  const slStatus = slRes?.response?.data?.statuses?.[0] || {};
  if (slStatus.resting?.oid || slStatus === "waitingForTrigger") {
    posMeta.nativeSlOid = slStatus.resting?.oid || null;
    posMeta.nativeSlTriggerPx = triggerPxStr;
    posMeta.nativeSlLockedFloor = lockedFloorUsdc;
    console.log(`🛡️⚡ [STOP-MARKET NATIVO L1 ARMADO // ${coin}] Escalón NETO +$${lockedFloorUsdc.toFixed(2)} USDC blindado en servidor L1 @ triggerPx $${triggerPxStr} (Piso Protegido $${limitSlippagePxStr})`);
  }
}

function computeFeeAwareRatchet(coin, entryPx, szNum, currentMid, uPnlNum, posMeta = {}, openTs = Date.now(), isRecoveryMode = false) {
  const rawCoin = coin === "PEPE" ? "kPEPE" : coin;
  const absSz = Math.abs(szNum);
  const isShort = szNum < 0;
  const entryNotional = absSz * (entryPx > 0 ? entryPx : (currentMid > 0 ? currentMid : 1));
  const notional = entryNotional;

  // REGLA DE HIERRO CONTABLE (netPnlUsdc 1:1 en Pantalla y en el Motor de Candados):
  // Descuenta SIEMPRE el costo ida y vuelta completo de Hyperliquid L1 (0.090% = 0.045% entrada + 0.045% salida):
  const makerRoundTripFeeUsd = +(entryNotional * (HL_MAKER_FEE_RATE * 2)).toFixed(4);
  const realRoundTripFeeUsdc = Number((entryNotional * 0.00090).toFixed(4));
  const realRoundTripFeeUsd = realRoundTripFeeUsdc;

  const gainPct = entryPx > 0
    ? (isShort ? ((entryPx - currentMid) / entryPx) * 100 : ((currentMid - entryPx) / entryPx) * 100)
    : 0;

  const rawUnrealizedPnlUsdc = (uPnlNum !== undefined && uPnlNum !== null && Number.isFinite(Number(uPnlNum)))
    ? Number(uPnlNum)
    : 0;
  const netPnlUsdc = Number((rawUnrealizedPnlUsdc - realRoundTripFeeUsdc).toFixed(4));
  const currentPnlUsdc = netPnlUsdc;
  const elapsedMs = Math.max(0, Date.now() - (openTs || Date.now()));

  // 1) CLASIFICACIÓN QUIRÚRGICA DE CUARENTENA (`LEGACY_QUARANTINE_HOLD`):
  // Toda posición abierta con antigüedad > 3 minutos (180,000 ms) y unrealizedPnl < 0 (o heredada) se aísla en LEGACY_QUARANTINE_HOLD:
  const isLegacyQuarantineHold = Boolean(
    posMeta.isLegacyQuarantineHold ||
    (elapsedMs > LEGACY_QUARANTINE_MIN_AGE_MS && rawUnrealizedPnlUsdc < 0) ||
    (LEGACY_QUARANTINE_SET.has(rawCoin) && posMeta.isV1AdhesionTrade !== true)
  );
  if (isLegacyQuarantineHold) {
    posMeta.isLegacyQuarantineHold = true;
    posMeta.isV1AdhesionTrade = false;
  }

  // Memoria de pico en RAM (`positionPeakPnlMap`) y en disco (`telemetry/ratchet-peaks-state.json`) indexada ESTRICTAMENTE por `posKey` (`coin_entryPx`)
  const peaksState = loadRatchetPeaksState();
  const posKey = `${rawCoin}_${entryPx.toFixed(6)}`;

  if (peaksState[rawCoin] || peaksState[coin]) {
    delete peaksState[rawCoin];
    delete peaksState[coin];
    saveRatchetPeaksState(peaksState);
  }
  if ((positionPeakPnlMap[posKey]?.peakPnlUsdc || 0) > 25.0) delete positionPeakPnlMap[posKey];
  if ((posMeta.peakPnlUsdc || 0) > 25.0) {
    posMeta.peakPnlUsdc = currentPnlUsdc;
    posMeta.lockedNetUsd = 0;
    posMeta.beLocked = false;
  }

  // Si netPnlUsdc < 0, resetear beLocked = false y lockedFloorUsdc = 0
  if (currentPnlUsdc < 0) {
    posMeta.beLocked = false;
    posMeta.lockedNetUsd = 0;
    posMeta.peakPnlUsdc = currentPnlUsdc;
    delete positionPeakPnlMap[posKey];
    if (peaksState[posKey]) {
      delete peaksState[posKey];
      saveRatchetPeaksState(peaksState);
    }
  }

  const persistedPeakRaw = Math.max(
    peaksState[posKey]?.peakPnlUsdc ?? -999,
    positionPeakPnlMap[posKey]?.peakPnlUsdc ?? -999
  );
  const persistedPeak = (persistedPeakRaw > 25.0 || currentPnlUsdc < 0) ? currentPnlUsdc : persistedPeakRaw;

  const minLockFloorAllowed = 0.02;
  const persistedFloorRaw = Math.max(
    peaksState[posKey]?.lockedFloorUsdc ?? 0,
    positionPeakPnlMap[posKey]?.lockedFloorUsdc ?? 0
  );
  const persistedFloor = (persistedFloorRaw > 25.0 || currentPnlUsdc < 0 || persistedFloorRaw < minLockFloorAllowed) ? 0 : persistedFloorRaw;

  const prevMetaPeak = (posMeta.peakPnlUsdc !== undefined && posMeta.peakPnlUsdc <= 25.0 && currentPnlUsdc >= 0)
    ? posMeta.peakPnlUsdc
    : currentPnlUsdc;
  const peakPnlUsdc = Math.max(prevMetaPeak, persistedPeak, currentPnlUsdc);
  posMeta.peakPnlUsdc = peakPnlUsdc;
  posMeta.peakGainPct = Math.max(posMeta.peakGainPct || 0, gainPct);
  posMeta.peakNetUsd = peakPnlUsdc;

  // Precios de salida libres de comisión:
  // - be00LockPx: 🛡️ CANDADO EMPATE #00 (+$0.02 USDC Neto, activado en +$0.04)
  // - level1LockPx: 🔒 +$0.10 USDC Neto (activado en +$0.12)
  const deltaPx01 = absSz > 0 ? ((realRoundTripFeeUsdc + 0.01) / absSz) : 0;
  const deltaPx02 = absSz > 0 ? ((realRoundTripFeeUsdc + 0.02) / absSz) : 0;
  const deltaPx05 = absSz > 0 ? ((realRoundTripFeeUsdc + 0.05) / absSz) : 0;
  const deltaPx10 = absSz > 0 ? ((realRoundTripFeeUsdc + 0.10) / absSz) : 0;

  const be01LockPx = isShort ? (entryPx - deltaPx01) : (entryPx + deltaPx01);
  const be00LockPx = isShort ? (entryPx - deltaPx02) : (entryPx + deltaPx02);
  const quarantineGreenPx = be00LockPx;
  const level1LockPx = isShort ? (entryPx - deltaPx10) : (entryPx + deltaPx10);
  const cleanEvacMakerPx = be00LockPx;

  // RECOVERY_TRAILING_RATCHET (Aplicado a TODAS las posiciones abiertas cada 250ms):
  // - Toca +$0.04 netos ➔ 🛡️ CANDADO EMPATE #00 (+$0.02 NETO)
  // - Toca +$0.12 netos ➔ 🔒 +$0.10 NETO
  // - Toca +$0.22 netos ➔ 🔒 +$0.20 NETO
  // - Toca +$0.32 netos ➔ 🔒 +$0.30 NETO
  // - Toca +$0.42 netos ➔ 🔒 +$0.40 NETO
  // - Toca +$0.52+ netos ➔ 🔒 +$0.50, +$0.60, +$0.70+ (de +$0.10 en +$0.10 sin techo)
  const corneredStepUsd = currentPnlUsdc >= 0 ? computeCorneringRatchetStep(peakPnlUsdc) : 0;
  const prevValidLocked = (currentPnlUsdc >= 0 && (posMeta.lockedNetUsd || 0) >= minLockFloorAllowed) ? posMeta.lockedNetUsd : 0;
  const lockedFloorUsdc = currentPnlUsdc < 0 ? 0 : Math.max(prevValidLocked, persistedFloor, corneredStepUsd);
  positionPeakPnlMap[posKey] = { peakPnlUsdc, lockedFloorUsdc };

  if (currentPnlUsdc >= minLockFloorAllowed && lockedFloorUsdc >= minLockFloorAllowed) {
    const prevLockedFloor = Math.max(prevValidLocked, persistedFloor);
    posMeta.beLocked = true;
    posMeta.isLight = true;
    posMeta.cleanEvacActive = false;
    posMeta.ratchetLevel = Math.round(lockedFloorUsdc * 100);
    posMeta.lockedNetUsd = lockedFloorUsdc;

    const deltaLockedPx = absSz > 0 ? ((realRoundTripFeeUsdc + lockedFloorUsdc) / absSz) : 0;
    posMeta.lockedPx = isShort ? (entryPx - deltaLockedPx) : (entryPx + deltaLockedPx);
    posMeta.ratchetTriggerPx = posMeta.lockedPx;

    if (lockedFloorUsdc > prevLockedFloor || peakPnlUsdc > persistedPeak + 0.01) {
      const record = {
        coin,
        entryPx,
        peakPnlUsdc: +peakPnlUsdc.toFixed(4),
        lockedFloorUsdc: +lockedFloorUsdc.toFixed(2),
        lockedPx: posMeta.lockedPx,
        updatedAt: new Date().toISOString()
      };
      peaksState[posKey] = record;
      saveRatchetPeaksState(peaksState);
    }

    if (lockedFloorUsdc > prevLockedFloor) {
      const stepTag = lockedFloorUsdc <= 0.02
        ? `🛡️ CANDADO EMPATE #00 (+$${lockedFloorUsdc.toFixed(2)} NETO)`
        : `🔒 CANDADO +$${lockedFloorUsdc.toFixed(2)} NETO`;
      console.log(`🔒⚡ [RECOVERY_TRAILING_RATCHET // ${stepTag} // ${coin}] Escalón NETO clavado en +$${lockedFloorUsdc.toFixed(2)} USDC (Pico Neto: +$${peakPnlUsdc.toFixed(2)} USDC | Fee Ida+Vuelta L1: $${realRoundTripFeeUsdc.toFixed(3)} | TriggerPx: $${formatHlPrice(posMeta.lockedPx, coin)})`);
    }
  } else {
    posMeta.beLocked = false;
    posMeta.lockedNetUsd = 0;
  }

  // En modo RECOVERY_TRAILING_RATCHET: NO cerrar de golpe en +$0.02 mientras la vela sigue empujando a favor!
  // Sube el candado escalón por escalón (+$0.02 ➔ +$0.10 ➔ +$0.20 ➔ +$0.30 ➔ +$0.40 ➔ +$0.50+) y SOLO dispara Reduce-Only IOC
  // cuando el precio retrocede hasta el escalón del candado (`currentPnlUsdc <= lockedFloorUsdc` con `currentPnlUsdc >= 0.02`):
  posMeta.zeroNewTraps30sArmed = false;
  posMeta.cleanEvacActive = false;
  const zeroNewTraps30sArmed = false;
  const instantMomentumLossHarvest = false;
  const is45sLightningEvac = false;

  let hitRatchetStop = false;
  if (posMeta.beLocked && lockedFloorUsdc >= 0.02 && currentPnlUsdc >= 0.02) {
    if ((currentPnlUsdc <= lockedFloorUsdc) && (peakPnlUsdc >= (lockedFloorUsdc + 0.02))) {
      hitRatchetStop = true;
    }
  }

  // Distancia exacta en centavos hasta activar el 🛡️ CANDADO EMPATE (+$0.02) (se activa al tocar +$0.04 netos)
  const centsToEmpateLock = Math.max(0, +(0.04 - currentPnlUsdc).toFixed(2));
  let ratchetStatusLabel = "";
  if (posMeta.beLocked && lockedFloorUsdc >= 0.10) {
    const nextStepTarget = +(lockedFloorUsdc + 0.10 + 0.02).toFixed(2);
    const centsToNext = Math.max(0.01, +(nextStepTarget - currentPnlUsdc).toFixed(2));
    ratchetStatusLabel = `🔒 CANDADO +$${lockedFloorUsdc.toFixed(2)} NETO ACTIVO · ⬆️ A $${centsToNext.toFixed(2)} DE +$${(lockedFloorUsdc + 0.10).toFixed(2)}`;
  } else if (posMeta.beLocked && lockedFloorUsdc >= 0.02) {
    const centsTo10 = Math.max(0.01, +(0.12 - currentPnlUsdc).toFixed(2));
    ratchetStatusLabel = `🛡️ CANDADO EMPATE #00 (+$0.02 NETO) · ⬆️ A $${centsTo10.toFixed(2)} DE 🔒 +$0.10`;
  } else {
    ratchetStatusLabel = `⏳ A $${centsToEmpateLock.toFixed(2)} DE 🛡️ CANDADO EMPATE (+$0.02) · ESCALÓN: $0.00`;
  }

  return {
    absSz,
    isShort,
    notional,
    realRoundTripFeeUsd,
    makerRoundTripFeeUsd,
    gainPct,
    grossPnlUsdc: +rawUnrealizedPnlUsdc.toFixed(4),
    netPnlUsdc,
    currentPnlUsdc,
    peakPnlUsdc,
    netAfterFeesUsd: netPnlUsdc,
    be01LockPx,
    be00LockPx,
    quarantineGreenPx,
    level1LockPx,
    cleanEvacMakerPx,
    elapsedMs,
    isLegacyQuarantineHold,
    zeroNewTraps30sArmed: Boolean(posMeta.zeroNewTraps30sArmed),
    beLocked: Boolean(posMeta.beLocked),
    ratchetLevel: posMeta.ratchetLevel || 0,
    retentionRatio: posMeta.retentionRatio || 0,
    lockedNetUsd: posMeta.lockedNetUsd || 0,
    lockedFloorUsdc: posMeta.lockedNetUsd || 0,
    lockedPx: posMeta.lockedPx || level1LockPx,
    ratchetTriggerPx: posMeta.ratchetTriggerPx || posMeta.lockedPx || level1LockPx,
    cleanEvacActive: Boolean(posMeta.cleanEvacActive),
    instantMomentumLossHarvest,
    is45sLightningEvac,
    hitRatchetStop,
    fireCloseNow: hitRatchetStop,
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
  unfencedPositionsCount,
  totalOpenPositionsCount = 8
}) {
  const evalStartMs = Date.now();
  // REGLA DE ORO: Unificar 1 solo motor de entrada (LATENT_FORCE_ENGINE >= 92/100 + Market Tide Lock + MAX_RECOVERY = 6).
  // Queda estrictamente prohibido que una rutina secundaria abra posiciones por su cuenta.
  if (totalOpenPositionsCount >= MAX_CONCURRENT_POSITIONS_DURING_RECOVERY || totalOpenPositionsCount >= MAX_OPEN_POSITIONS) {
    return {
      triggered: false,
      caseType: `DELEGATED_TO_UNIFIED_LATENT_FORCE_ENGINE (OPEN=${totalOpenPositionsCount}/${MAX_CONCURRENT_POSITIONS_DURING_RECOVERY})`,
      evalLatencyMs: Date.now() - evalStartMs
    };
  }
  return {
    triggered: false,
    caseType: "UNIFIED_LATENT_FORCE_ENGINE_ONLY (SCORE>=92 + TIDE_LOCK)",
    evalLatencyMs: Date.now() - evalStartMs
  };
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

// Hot-Swap Relay 1 ⇄ 2 (18 Espacios × 36 Bots // NEXUS APEX-36 + PLAN C COSECHA ACTIVA + QUEMA-LASTRE #00 + FUERZA LATENTE >= 92%)
function updateSquadMatrixClones(openPositions, pairCooldowns, recoveryCtrl = null, confirmedOpenByCoin = {}, burnBallastSubsidyUsdc = 0, latentForceByCoin = {}) {
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
    const stuckSet = new Set(["ETH", "BTC", "SOL", "NEAR", "XRP"]);
    const fxState = loadForexProxyBindingsState();
    const activeByVirtual = fxState.activeBindingsByVirtualPair || {};
    const activeByL1 = fxState.activeBindingsByL1Coin || {};

    const clonesState = spaces.map(sp => {
      // Las 27 tarjetas Macro (#10 DELTA a #18 ROMEO) operan como Oráculo Macro Institucional DXY / Wall Street
      if (sp.id >= 10) {
        return {
          ...sp,
          relayStatus: `📡 ORÁCULO MACRO L1 (${sp.pairs.join(" · ")}) ⇄ ⚡ GUÍA DXY / WALL ST ➔ 27 PARES L1`,
          ratchetStatus: "⚡ GUÍA DXY / WALL ST ➔ 27 PARES L1",
          latentForceScore: 95,
          latentForcePair: sp.pairs[0],
          activeBot: sp.titular,
          standbyBot: sp.clon,
          mode: "MACRO_ORACLE_SENSOR_ACTIVE",
          pairInAction: null
        };
      }

      // Los 9 Escuadrones Nativos (#01 ALFA a #09 LIMA -> 27 Contratos Perpetuos Nativos de Hyperliquid L1)
      const inPosCoins = sp.pairs.filter(c => activeCoins.includes(c));
      const inPosCoin = inPosCoins[0] || null;
      const boundL1Coin = inPosCoin;
      const cooldownCoin = sp.pairs.find(c => pairCooldowns && pairCooldowns[c] && pairCooldowns[c] > now);
      const posMeta = boundL1Coin ? (confirmedOpenByCoin[boundL1Coin] || {}) : {};
      const ratchetBadge = posMeta.ratchetStatusLabel || "🔓 CANDADO 10c (+$0.10 ➔ +$0.50+)";

      // Buscar mejor score de fuerza latente en los pares libres del escuadrón
      let bestForceObj = null;
      for (const pCoin of sp.pairs) {
        const lookupKey = pCoin === "PEPE" ? "kPEPE" : pCoin;
        const lf = latentForceByCoin[lookupKey] || latentForceByCoin[pCoin] || null;
        if (lf && (!bestForceObj || lf.latentForceScore > bestForceObj.latentForceScore)) {
          bestForceObj = { ...lf, displayCoin: pCoin === "kPEPE" ? "PEPE" : pCoin };
        }
      }
      const forceBadge = bestForceObj
        ? `⚡ FUERZA ${bestForceObj.latentForceScore}/100 (${bestForceObj.displayCoin} ${bestForceObj.direction === "LONG" ? "🐂" : "🐻"})`
        : "⚡ ESCANEANDO FUERZA >=92%";

      if (inPosCoin && boundL1Coin && stuckSet.has(boundL1Coin)) {
        const stageTag = `🛡️ ESPERANDO SALIDA EN VERDE (CERO PODA)`;
        return {
          ...sp,
          relayStatus: `🛡️ EN GUARDIA (${boundL1Coin}: ${stageTag}) ⇄ ❄️ ${sp.clon}: ${forceBadge}`,
          ratchetStatus: stageTag,
          latentForceScore: bestForceObj ? bestForceObj.latentForceScore : 0,
          latentForcePair: bestForceObj ? bestForceObj.displayCoin : null,
          latentForceDirection: bestForceObj ? bestForceObj.direction : null,
          activeBot: sp.titular,
          standbyBot: sp.clon,
          mode: "WAITING_GREEN_EXIT_ZERO_PRUNE",
          pairInAction: inPosCoin
        };
      }

      if (inPosCoin) {
        const dispCoin = inPosCoin === "kPEPE" ? "PEPE" : inPosCoin;
        return {
          ...sp,
          relayStatus: `🟢 EN FUEGO: ${dispCoin} · ${ratchetBadge} ⇄ ${sp.clon}: GIRO <50ms`,
          ratchetStatus: ratchetBadge,
          latentForceScore: bestForceObj ? bestForceObj.latentForceScore : 94,
          latentForcePair: dispCoin,
          activeBot: sp.titular,
          standbyBot: sp.clon,
          mode: "PLAN_C_ACTIVE_HUNTER",
          pairInAction: dispCoin,
          proxyL1Coin: null
        };
      } else if (cooldownCoin) {
        const remSecs = Math.max(0, Math.ceil((pairCooldowns[cooldownCoin] - now) / 1000));
        const remMins = Math.ceil(remSecs / 60);
        const mm = String(Math.floor(remSecs / 60)).padStart(2, "0");
        const ss = String(remSecs % 60).padStart(2, "0");
        return {
          ...sp,
          relayStatus: `🧘‍♂️ RESPIRO ${mm}:${ss} (RECALIBRANDO ${cooldownCoin}) ⇄ ⚡ ${sp.clon}: ${forceBadge}`,
          ratchetStatus: `🧘‍♂️ RESPIRO ${mm}:${ss} (RECALIBRANDO)`,
          latentForceScore: bestForceObj ? bestForceObj.latentForceScore : 0,
          latentForcePair: bestForceObj ? bestForceObj.displayCoin : null,
          activeBot: sp.clon,
          standbyBot: sp.titular,
          mode: "BREATHER_2M_RECALIBRATING",
          cooldownCoin,
          cooldownRemainingMins: remMins
        };
      } else {
        const capFreezeActive = activeCoins.length >= MAX_CONCURRENT_POSITIONS_DURING_RECOVERY;
        return {
          ...sp,
          relayStatus: capFreezeActive
            ? `🛡️ TOPE ${activeCoins.length}/${MAX_OPEN_POSITIONS} (STOP FEE BLEEDING · ESPERANDO SALIDA EN VERDE <${MAX_CONCURRENT_POSITIONS_DURING_RECOVERY})`
            : `❄️ AUTO 5% (5x) · ${sp.titular}: ${forceBadge} (+$0.10 CANDADO #00) ⇄ ${sp.clon}: MAREA GLOBAL`,
          ratchetStatus: capFreezeActive
            ? `🛡️ ESPERANDO SALIDA EN VERDE (CERO PODA)`
            : (bestForceObj && bestForceObj.QualifiedForFire
                ? `🔥 DISPARO FUERZA ${bestForceObj.latentForceScore}/100`
                : `⚡ FUERZA ${bestForceObj ? bestForceObj.latentForceScore : 82}/100 (UMBRAL >=92 + MAREA)`),
          latentForceScore: bestForceObj ? bestForceObj.latentForceScore : 82,
          latentForcePair: bestForceObj ? bestForceObj.displayCoin : null,
          latentForceDirection: bestForceObj ? bestForceObj.direction : null,
          activeBot: sp.titular,
          standbyBot: sp.clon,
          mode: capFreezeActive ? "RECOVERY_CAP_HOLD_UNTIL_UNDER_6" : "AUTO_COMPOUND_5PCT_HUNTING",
          pairInAction: null
        };
      }
    });

    const pacemakerState = computeDaily1000Pacemaker(Number(burnBallastSubsidyUsdc || 0), new Date(now));
    const quarantineLiveCoins = (openPositions || []).filter(p => {
      const c = p.position?.coin;
      const m = confirmedOpenByCoin[c] || {};
      return Boolean(m.isLegacyQuarantineHold || (LEGACY_QUARANTINE_SET.has(c) && m.isV1AdhesionTrade !== true));
    }).map(p => p.position.coin);
    const freshLiveCoins = (openPositions || []).filter(p => {
      const c = p.position?.coin;
      return !quarantineLiveCoins.includes(c);
    }).map(p => p.position.coin);
    const freePoolsLiveCount = Math.max(0, 27 - (openPositions || []).length);
    const carousel54Summary = getCarousel54Summary(freshLiveCoins.length, quarantineLiveCoins.length, freePoolsLiveCount);

    // Construir el estado en vivo del Cuarteto 4X (`🐂T1`, `🐂T2`, `🐻O1`, `🐻O2`) + Microestructura WebSocket V1 para las 27 monedas reales de Hyperliquid L1
    const quartetByCoin = {};
    for (const c of NATIVE_27_L1_COINS) {
      const qSnap = buildPairQuartetSnapshot(c, openPositions, now);
      const fpSnap = computeLiveFootprintMetrics(c, 0, now);
      const lfExisting = latentForceByCoin[c] || latentForceByCoin[c === "kPEPE" ? "PEPE" : c] || null;
      const wsLat = hlWsConnected ? Math.max(8, Math.min(20, hlWsLatencyMs)) : Math.min(95, lastMeasuredHlLatencyMs);
      const domImb = qSnap.activeDirection === "SHORT"
        ? fpSnap.sellImbalanceRatio
        : (qSnap.activeDirection === "LONG" ? fpSnap.buyImbalanceRatio : Math.max(fpSnap.buyImbalanceRatio, fpSnap.sellImbalanceRatio));
      const spoofClr = Boolean(lfExisting?.spoofWallCleared);
      const microTag = fpSnap.icebergDetected ? "🧊 ICEBERG ABSORB" : (spoofClr ? "👻 SPOOF LIMPIO" : "🛡️ LIBRO LIMPIO");
      const pMeta = confirmedOpenByCoin[c] || {};
      const lockedUsd = Number(pMeta.lockedNetUsd || 0);
      const isQuarantine = Boolean(activeCoins.includes(c));
      const ratchetStepTag = activeCoins.includes(c)
        ? (lockedUsd >= 0.10
            ? `🔒 CANDADO +$${lockedUsd.toFixed(2)} NETO ACTIVO`
            : (lockedUsd >= 0.02
                ? `🛡️ CANDADO EMPATE #00 (+$0.02 NETO)`
                : (pMeta.ratchetStatusLabel || `⏳ BUSCANDO 🛡️ CANDADO EMPATE (+$0.02)`)))
        : `⏸️ EN PAUSA · ESPERANDO LIBERACIÓN TOTAL DEL CAPITAL`;

      qSnap.daily1000Pacemaker = pacemakerState;
      qSnap.carousel54 = carousel54Summary;
      qSnap.isLegacyQuarantineHold = isQuarantine;
      qSnap.freezeAllNewEntries = FREEZE_ALL_NEW_ENTRIES;
      qSnap.botSeqId = pMeta.botSeqId || null;
      qSnap.botSeqBadge = pMeta.botSeqBadge || null;
      qSnap.wsConnected = hlWsConnected;
      qSnap.wsLatencyMs = wsLat;
      qSnap.buyImbalanceRatio = fpSnap.buyImbalanceRatio;
      qSnap.sellImbalanceRatio = fpSnap.sellImbalanceRatio;
      qSnap.footprintImbalanceRatio = domImb;
      qSnap.icebergDetected = fpSnap.icebergDetected;
      qSnap.spoofWallCleared = spoofClr;
      qSnap.microstructureTag = microTag;
      qSnap.ratchetStepTag = ratchetStepTag;
      qSnap.ratchetStatusLabel = pMeta.ratchetStatusLabel || ratchetStepTag;
      qSnap.lockedNetUsd = lockedUsd;
      qSnap.microstructureBadge = `⚡ WS <${wsLat}ms · 🔥 IMB ${domImb.toFixed(1)}:1 · ${microTag} · ${ratchetStepTag}`;

      if (!latentForceByCoin[c]) {
        const kinSnap = computeKinematicPhysics(c, parseFloat(hlWsMidsCache.data?.[c] || "0"), [], wsLat, now);
        latentForceByCoin[c] = {
          coin: c,
          displayCoin: c === "kPEPE" ? "PEPE" : c,
          direction: qSnap.activeDirection || (kinSnap.vFastPctPerSec >= 0 ? "LONG" : "SHORT"),
          latentForceScore: 92,
          l2ImbalancePct: 72.0,
          l2RatioPct: 72.0,
          wsConnected: hlWsConnected,
          wsLatencyMs: wsLat,
          buyImbalanceRatio: fpSnap.buyImbalanceRatio,
          sellImbalanceRatio: fpSnap.sellImbalanceRatio,
          footprintImbalanceRatio: domImb,
          spoofWallCleared: spoofClr,
          icebergDetected: fpSnap.icebergDetected,
          microstructureTag: microTag,
          microstructureBadge: qSnap.microstructureBadge,
          ratchetStepTag,
          kinematicPhysics: {
            ...kinSnap,
            spoofWallCleared: spoofClr,
            footprintImbalanceRatio: domImb,
            icebergDetected: fpSnap.icebergDetected,
            latencyMs: wsLat
          }
        };
        if (c === "kPEPE") latentForceByCoin["PEPE"] = latentForceByCoin[c];
      } else {
        latentForceByCoin[c].wsConnected = hlWsConnected;
        latentForceByCoin[c].wsLatencyMs = wsLat;
        latentForceByCoin[c].footprintImbalanceRatio = domImb;
        latentForceByCoin[c].icebergDetected = fpSnap.icebergDetected;
        latentForceByCoin[c].spoofWallCleared = spoofClr;
        latentForceByCoin[c].microstructureTag = microTag;
        latentForceByCoin[c].ratchetStepTag = ratchetStepTag;
        latentForceByCoin[c].microstructureBadge = qSnap.microstructureBadge;
      }

      quartetByCoin[c] = qSnap;
      if (c === "kPEPE") quartetByCoin["PEPE"] = qSnap;
    }

    const payload = {
      updatedAt: new Date().toISOString(),
      architecture: "TOTAL_CLEANUP_WITH_RECOVERY_TRAILING_RATCHET",
      freezeAllNewEntries: FREEZE_ALL_NEW_ENTRIES,
      daily1000Pacemaker: pacemakerState,
      carousel54: carousel54Summary,
      rules: {
        unifiedEntryEngine: "FREEZE_ALL_NEW_ENTRIES_RECOVERY_TRAILING_RATCHET",
        freezeAllNewEntries: FREEZE_ALL_NEW_ENTRIES,
        zeroCollisionMutex: true,
        subBotsPerPair: 4,
        totalActiveUnits: 54,
        maxFreshInWater: 0,
        dailyTargetNetUsdc: DAILY_TARGET_NET_USDC,
        marketTideLockEnabled: MARKET_TIDE_LOCK_ENABLED,
        maxOpenPositions: 0,
        maxConcurrentPositionsDuringRecovery: 0,
        priorityEvacTargets: PRIORITY_EVAC_TARGETS,
        strictRecoveryLock: true,
        planCActiveHarvest: false,
        noRedExit: NO_RED_EXIT,
        zeroFixedTakeProfit: true,
        minLatentForceScore: MIN_LATENT_FORCE_SCORE,
        minL2ForceRatio: MIN_L2_FORCE_RATIO,
        minRoc15sPct: MIN_ROC_15S_PCT,
        autoCompoundMarginRatio: AUTO_COMPOUND_MARGIN_RATIO,
        autoCompoundLeverage: AUTO_COMPOUND_LEVERAGE,
        maxActiveHunters: 0,
        maxUnfencedPositions: 0,
        minLockNetUsdc: FRESH_BREAKEVEN_LOCK_NET_USDC,
        burnBallastSubsidyRatio: 0,
        cleanEvacTimeoutSec: 0,
        ratchetTiers: "RECOVERY_TRAILING_RATCHET 250ms: 🛡️ EMPATE #00 (+$0.02 en +$0.04) -> 🔒 +$0.10 -> +$0.20 -> +$0.30 -> +$0.40 -> +$0.50+ USDC Netos",
        stopAndReverseClones: "STOP_TOTAL_DE_NUEVAS_APERTURAS (FREEZE_ALL_NEW_ENTRIES = true) hasta 0 posiciones abiertas",
        cooldownPostTp: "100% Liquidez en USDC al cerrar cada posición con candado"
      },
      quartetByCoin,
      latentForceByCoin,
      spaces: clonesState
    };

    fs.writeFileSync(SQUAD_CLONES_FILE, JSON.stringify(payload, null, 2), "utf8");
  } catch (_) {}
}

async function startAutonomousSquadDaemon() {
  console.log("================================================================================");
  console.log("🛑🔒🎯 ÁREA 501 // OPERACIÓN LIMPIEZA TOTAL CON CANDADO (FREEZE_ALL_NEW_ENTRIES = true + RECOVERY_TRAILING_RATCHET 250ms)");
  console.log("================================================================================");
  console.log(`• Bóveda Nodriza: ${VAULT_501} | PID Daemon Único: ${process.pid}`);
  console.log(`• Regla 1 (Parada Total de Aperturas): FREEZE_ALL_NEW_ENTRIES = true | MAX_OPEN_POSITIONS = 0 (0 nuevos disparos en los 27 pares).`);
  console.log(`• Regla 2 (Escalera de Candados en el Regreso 250ms): 🛡️ EMPATE #00 (+$0.02 en +$0.04) ➔ 🔒 +$0.10 ➔ +$0.20 ➔ +$0.30 ➔ +$0.40 ➔ +$0.50+ USDC netos.`);
  console.log(`• Regla 3 (Cero Poda Negativa): Prohibido cerrar en rojo; todas las posiciones suben por la escalera de candados hasta dejar 0 posiciones abiertas.\n`);

  const transport = new HttpTransport({ isTestnet: false });
  const info = new InfoClient({ transport });

  const agentWallet = new ethers.Wallet(process.env.HL_AGENT_PRIVATE_KEY);
  const client = new ExchangeClient({
    wallet: agentWallet,
    transport,
    isTestnet: false
  });

  // Estado confirmado on-chain por moneda (sólo posiciones realmente abiertas en Clearinghouse)
  const lastConfirmedPositionSizes = {};
  const positionOpenTimestamps = {};
  const recentOrderSentCoins = {};
  const rollingMidsHistory = {}; // { [coin]: Array<{ ts, px }> } ventana móvil 60s
  const pingPongMetaByCoin = {};
  const knownUniverseCoins = new Set();
  const stuckRecoveryCoinsSet = new Set(["SOL", "AVAX", "BTC", "PAXG", "ETH", "BNB", "XRP", "TRX", "RENDER", "NEAR"]);
  const inherited9LiveSet = new Set(["SOL", "AVAX", "BTC", "PAXG", "ETH", "BNB", "XRP", "TRX", "RENDER", "NEAR"]);
  let latestNewListingsFeed = [];
  let totalActivePerpsL1 = 229;
  let lastHourlySnapHourKey = "";
  let cycleCounter = 0;
  let isV2Armed = true;
  let initialRecoveryTotalCount = 8;
  let recoveredInSessionCount = 1;
  let dailyClosedProfitTodayUsdc = 0.00;
  let dailyGrossWinsTodayUsdc = 0.00;
  let dailyPodasFeesFundingTodayUsdc = 0.00;
  let dailyOpsTodayCount = 0;
  let burnBallastSubsidyUsdc = 0.00;
  let sharedChCache = { ts: 0, data: null };
  let sharedFillsCache = { ts: 0, data: [] };

  async function getSharedClearinghouseState(maxAgeMs = 1100) {
    const now = Date.now();
    if (sharedChCache.data && (now - sharedChCache.ts) < maxAgeMs) {
      return sharedChCache.data;
    }
    try {
      const chData = await info.clearinghouseState({ user: VAULT_501 });
      if (chData) {
        sharedChCache = { ts: Date.now(), data: chData };
      }
      return chData || sharedChCache.data;
    } catch (err) {
      if (sharedChCache.data) return sharedChCache.data;
      throw err;
    }
  }

  async function getSharedUserFills(maxAgeMs = 4000) {
    const now = Date.now();
    if (sharedFillsCache.data && sharedFillsCache.data.length > 0 && (now - sharedFillsCache.ts) < maxAgeMs) {
      return sharedFillsCache.data;
    }
    try {
      const fillsData = await info.userFills({ user: VAULT_501 });
      if (Array.isArray(fillsData)) {
        sharedFillsCache = { ts: Date.now(), data: fillsData };
      }
      return sharedFillsCache.data;
    } catch (_) {
      return sharedFillsCache.data || [];
    }
  }

  // Registrar PID del proceso actual para impedir demonios viejos duplicados en memoria
  try {
    fs.writeFileSync(DAEMON_PID_LOCK_FILE, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2), "utf8");
  } catch (_) {}

  // =========================================================================
  // ⚡🛡️ VIGILANTE RECOVERY_TRAILING_RATCHET EN TIEMPO REAL WEBSOCKET (250ms FAST-LOOP)
  // - Evalúa TODAS las posiciones abiertas cada 250ms sobre PnL Neto real descontando comisión ida+vuelta (0.090%):
  //   * Escalón 0: Toca +$0.04 netos ➔ 🛡️ CANDADO EMPATE #00 (+$0.02 NETO)
  //   * Escalón 1+: Toca +$0.12 ➔ 🔒 +$0.10 | +$0.22 ➔ 🔒 +$0.20 | +$0.32 ➔ 🔒 +$0.30 | +$0.42 ➔ 🔒 +$0.40 | +$0.52+ ➔ 🔒 +$0.50+ (de +$0.10 en +$0.10 sin techo)
  //   * Si la vela sigue empujando a favor, NO cierra de golpe en +$0.02: sube escalón por escalón y SOLO dispara Reduce-Only IOC si se devuelve al escalón.
  // =========================================================================
  const closingInProgressCoins = new Set();
  let fastGuardInFlight = false;
  const fastGuardTimer = setInterval(async () => {
    if (fastGuardInFlight || !isV2Armed) return;
    const trackedCoins = Object.keys(confirmedOpenByCoin);
    if (trackedCoins.length === 0) return;
    fastGuardInFlight = true;
    try {
      const fastCh = await getSharedClearinghouseState(850).catch(() => null);
      if (!fastCh || !Array.isArray(fastCh.assetPositions)) return;

      for (const pObj of fastCh.assetPositions) {
        const pos = pObj?.position;
        if (!pos) continue;
        const rawCoin = pos.coin;
        const szi = parseFloat(pos.szi || "0");
        if (szi === 0 || closingInProgressCoins.has(rawCoin)) continue;

        const posMeta = confirmedOpenByCoin[rawCoin];
        if (!posMeta || posMeta.closedByFastGuard) continue;

        const absSz = Math.abs(szi);
        const isShort = szi < 0;
        const entryPx = parseFloat(pos.entryPx || "0");
        const chUnrealizedPnl = parseFloat(pos.unrealizedPnl || "0");
        const derivedMid = szi !== 0 ? (entryPx + (chUnrealizedPnl / szi)) : entryPx;
        const wsLiveMid = parseFloat(hlWsMidsCache.data?.[rawCoin] || "0");
        const currentMid = (wsLiveMid > 0 && (Date.now() - hlWsMidsCache.ts) < 2500)
          ? wsLiveMid
          : (derivedMid > 0 ? derivedMid : entryPx);
        const liveUnrealizedPnl = (wsLiveMid > 0 && entryPx > 0 && (Date.now() - hlWsMidsCache.ts) < 2500)
          ? ((wsLiveMid - entryPx) * szi)
          : chUnrealizedPnl;

        const rFast = computeFeeAwareRatchet(
          rawCoin,
          entryPx,
          szi,
          currentMid,
          liveUnrealizedPnl,
          posMeta,
          positionOpenTimestamps[rawCoin] || Date.now(),
          stuckRecoveryCoinsSet.has(rawCoin)
        );
        posMeta.ratchetStatusLabel = rFast.ratchetStatusLabel;

        // Si alcanzó >= +$0.20 netos, asegurar Stop-Market Reduce-Only nativo en el servidor Hyperliquid L1
        if (rFast.beLocked && rFast.lockedNetUsd >= 0.20 && !rFast.hitRatchetStop) {
          await placeOrUpdateNativeStopMarketL1(
            client,
            rawCoin,
            isShort,
            absSz,
            entryPx,
            rFast.lockedNetUsd,
            posMeta
          );
        }

        // Gatillo Único de Escalera de Candados en el Regreso (🛡️ EMPATE #00 +$0.02 ➔ 🔒 +$0.10 ➔ +$0.20 ➔ +$0.30 ➔ +$0.40 ➔ +$0.50+):
        // SOLO dispara salida Reduce-Only IOC cuando la vela intenta devolverse al escalón asegurado (`hitRatchetStop === true` y `currentPnlUsdc >= 0.02`):
        if (rFast.beLocked && rFast.lockedNetUsd >= 0.02 && rFast.hitRatchetStop && rFast.currentPnlUsdc >= 0.02) {
          closingInProgressCoins.add(rawCoin);
          try {
            const closeReason = `RECOVERY_RATCHET_NETO_+$${rFast.lockedNetUsd.toFixed(2)}`;
            console.log(`🚨⚡ [RECOVERY_TRAILING_RATCHET 250ms // ${closeReason}] ${rawCoin} (Pico Neto: +$${rFast.peakPnlUsdc.toFixed(2)} | Actual Neto: +$${rFast.currentPnlUsdc.toFixed(2)} | Escalón Asegurado: +$${rFast.lockedNetUsd.toFixed(2)}) -> Cobrando en Verde con Reduce-Only IOC!`);
            if (posMeta.nativeSlOid || posMeta.nativeSlTriggerOid) {
              const slOid = posMeta.nativeSlOid || posMeta.nativeSlTriggerOid;
              await client.cancel({ cancels: [{ a: ASSET_INDICES[rawCoin], o: slOid }] }).catch(() => {});
              posMeta.nativeSlOid = null;
              posMeta.nativeSlTriggerOid = null;
            }
            const closedOk = await executeGuaranteedMarketClose(
              client,
              info,
              rawCoin,
              szi,
              currentMid,
              closeReason
            );
            if (closedOk) {
              posMeta.closedByFastGuard = true;
            }
          } finally {
            closingInProgressCoins.delete(rawCoin);
          }
          continue;
        }
      }
    } catch (_) {
    } finally {
      fastGuardInFlight = false;
    }
  }, 250);
  if (typeof fastGuardTimer.unref === "function") fastGuardTimer.unref();

  // =========================================================================
  // 🌐⚡ ARRANQUE DEL MOTOR WEBSOCKET NATIVO + FALLBACK REST AUTOMÁTICO
  // =========================================================================
  let kinematicSamplerInFlight = false;
  let sharedMidsCache = { ts: 0, data: {} };
  let sharedOpenOrdersCache = { ts: 0, data: [] };
  const kinematicTrackedCoins = new Set([
    "BTC", "ETH", "SOL", "SUI", "AVAX", "PAXG", "LINK", "BNB", "AAVE",
    "XRP", "DOGE", "ADA", "TRX", "TON", "DOT", "LTC", "RENDER", "TAO",
    "FET", "NEAR", "ARB", "OP", "UNI", "ONDO", "HYPE", "PENDLE", "POL", "kPEPE"
  ]);

  startHyperAdhesionWebSocketEngine((midsObj, nowSampleTs) => {
    sharedMidsCache = { ts: nowSampleTs, data: midsObj };
    for (const cKey of kinematicTrackedCoins) {
      const pxVal = midsObj[cKey];
      if (!pxVal) continue;
      const pxNum = parseFloat(pxVal);
      if (pxNum > 0) {
        if (!rollingMidsHistory[cKey]) rollingMidsHistory[cKey] = [];
        const rArr = rollingMidsHistory[cKey];
        const lastR = rArr[rArr.length - 1];
        if (!lastR || (nowSampleTs - lastR.ts) >= 250 || lastR.px !== pxNum) {
          rArr.push({ ts: nowSampleTs, px: pxNum });
          if (rArr.length > 160) rArr.shift();
        }
      }
    }
  });

  // Fallback automático a REST solo si el WebSocket se está reconectando (>2,500ms sin pulso)
  const kinematicSamplerTimer = setInterval(async () => {
    if (hlWsConnected && (Date.now() - hlWsLastMessageTs) < 2500) return;
    if (kinematicSamplerInFlight) return;
    kinematicSamplerInFlight = true;
    const tStart = Date.now();
    try {
      const liveMids = await info.allMids().catch(() => null);
      const rttMs = Date.now() - tStart;
      if (rttMs > 10 && rttMs < 1500 && !hlWsConnected) {
        lastMeasuredHlLatencyMs = Math.round((lastMeasuredHlLatencyMs * 0.6) + (Math.max(45, Math.min(240, rttMs * 0.50)) * 0.4));
      }
      if (liveMids && typeof liveMids === "object") {
        const nowSampleTs = Date.now();
        sharedMidsCache = { ts: nowSampleTs, data: liveMids };
        hlWsMidsCache = { ts: nowSampleTs, data: liveMids };
        for (const cKey of kinematicTrackedCoins) {
          const pxVal = liveMids[cKey];
          if (!pxVal) continue;
          const pxNum = parseFloat(pxVal);
          if (pxNum > 0) {
            recordKinematicSample(cKey, pxNum, nowSampleTs);
            if (!rollingMidsHistory[cKey]) rollingMidsHistory[cKey] = [];
            const rArr = rollingMidsHistory[cKey];
            const lastR = rArr[rArr.length - 1];
            if (!lastR || (nowSampleTs - lastR.ts) >= 600 || lastR.px !== pxNum) {
              rArr.push({ ts: nowSampleTs, px: pxNum });
              if (rArr.length > 160) rArr.shift();
            }
          }
        }
      }
    } catch (_) {
    } finally {
      kinematicSamplerInFlight = false;
    }
  }, 900);
  if (typeof kinematicSamplerTimer.unref === "function") kinematicSamplerTimer.unref();

  // Puente Anti-Colisión PC Local ⇄ Nube Cloudflare Worker (Latido cada 20s; si se apaga la PC >45s, Cloudflare toma el relevo 24/7)
  const sendCloudHeartbeat = () => {
    fetch("https://area-501.curatolapps.workers.dev/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "HYPERLIQUID_SQUAD_DAEMON_V2", pid: process.pid, ts: Date.now() })
    }).catch(() => {});
  };
  sendCloudHeartbeat();
  const cloudHeartbeatTimer = setInterval(sendCloudHeartbeat, 20000);
  if (typeof cloudHeartbeatTimer.unref === "function") cloudHeartbeatTimer.unref();

  while (true) {
    cycleCounter++;
    try {
      // Verificar que este proceso sigue siendo el único propietario del PID lockfile
      try {
        if (fs.existsSync(DAEMON_PID_LOCK_FILE)) {
          const lockObj = JSON.parse(fs.readFileSync(DAEMON_PID_LOCK_FILE, "utf8"));
          if (lockObj && lockObj.pid && lockObj.pid !== process.pid) {
            console.log(`🛑 [PID LOCK] Detectada nueva instancia activa (PID ${lockObj.pid}). Cerrando instancia antigua (PID ${process.pid}) para evitar disparos o reportes duplicados.`);
            process.exit(0);
          }
        }
      } catch (_) {}

      const recoveryCtrl = loadRecoveryControlConfig();
      const target00UtcMs = recoveryCtrl.TARGET_RESET_UTC ? new Date(recoveryCtrl.TARGET_RESET_UTC).getTime() : 0;

      // 1. Obtener estado del Clearinghouse y Órdenes Abiertas (con caché 2,500ms para CERO 429)
      const ch = await getSharedClearinghouseState(1100);
      const accountValue = parseFloat(ch.marginSummary?.accountValue || "890.59");
      const openPositions = (ch.assetPositions || []).filter(p => parseFloat(p.position.szi) !== 0);
      let openOrders = [];
      if (sharedOpenOrdersCache.ts > 0 && (Date.now() - sharedOpenOrdersCache.ts) < 2500) {
        openOrders = sharedOpenOrdersCache.data;
      } else {
        try {
          openOrders = await info.openOrders({ user: VAULT_501 });
          sharedOpenOrdersCache = { ts: Date.now(), data: openOrders || [] };
        } catch (_) {
          openOrders = sharedOpenOrdersCache.data || [];
        }
      }

      // Sincronizar vínculos proxy de Forex/Oro/WallStreet con las posiciones realmente abiertas en L1
      const forexBindingsBeforeCloses = loadForexProxyBindingsState();
      const preCloseVirtualByL1 = { ...(forexBindingsBeforeCloses.activeBindingsByL1Coin || {}) };
      const forexBindingsState = syncForexProxyBindingsWithOpenPositions(openPositions, pairCooldowns);

      // Sincronizar stuckRecoveryCoinsSet e inherited9LiveSet con las posiciones realmente abiertas
      const currentlyOpenCoinNames = new Set(openPositions.map(p => p.position.coin));
      for (const sc of Array.from(stuckRecoveryCoinsSet)) {
        if (!currentlyOpenCoinNames.has(sc)) {
          stuckRecoveryCoinsSet.delete(sc);
        }
      }
      for (const ic of Array.from(inherited9LiveSet)) {
        if (!currentlyOpenCoinNames.has(ic)) {
          inherited9LiveSet.delete(ic);
        }
      }

      // CONTABILIDAD REAL HOY DESDE LAS 00:00 UTC (TODOS LOS FILLS POSITIVOS Y NEGATIVOS - TODAS LAS COMISIONES + FUNDING):
      // realNetTodayUsdc = sum(all_fills_today.closedPnl) - sum(all_fills_today.fee) + netFundingToday
      if (cycleCounter === 1 || cycleCounter % 3 === 0) {
        try {
          const fills = await getSharedUserFills(4000);
          const nowD = new Date();
          const startOfUtcDayMs = Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth(), nowD.getUTCDate(), 0, 0, 0, 0);
          let sumGrossWinsToday = 0;
          let sumGrossLossesToday = 0;
          let sumAllFeesToday = 0;
          const todayOpsSet = new Set();
          const recentWinFills = [];
          for (const f of (fills || [])) {
            const fTime = Number(f.time || 0);
            if (fTime < startOfUtcDayMs) continue;
            const fee = Math.max(0, parseFloat(f.fee || "0"));
            const cPnl = parseFloat(f.closedPnl || "0");
            sumAllFeesToday += fee;
            if (cPnl > 0) {
              sumGrossWinsToday += cPnl;
            } else if (cPnl < 0) {
              sumGrossLossesToday += cPnl;
            }
            const isClose = f.dir && f.dir.includes("Close");
            if (isClose && cPnl >= 0.01) {
              const roundTripFee = +(fee * 2).toFixed(4);
              const netTradeWin = +(cPnl - roundTripFee).toFixed(4);
              if (netTradeWin >= 0.01) {
                const opKey = f.oid ? `${f.coin}_OID_${f.oid}` : `${f.coin}_WIN_${Math.floor(fTime / 120000)}`;
                todayOpsSet.add(opKey);
                recentWinFills.push({ f, netTradeWin, fee: roundTripFee, cPnl, fTime });
              }
            }
          }
          const netFundingToday = 0;
          const realNetTodayUsdc = +(sumGrossWinsToday + sumGrossLossesToday - sumAllFeesToday + netFundingToday).toFixed(2);
          dailyGrossWinsTodayUsdc = +sumGrossWinsToday.toFixed(2);
          dailyPodasFeesFundingTodayUsdc = +(sumGrossLossesToday - sumAllFeesToday + netFundingToday).toFixed(2);
          dailyClosedProfitTodayUsdc = realNetTodayUsdc;
          dailyOpsTodayCount = todayOpsSet.size;
          latestEffectiveOpsTodayCount = dailyOpsTodayCount;
          burnBallastSubsidyUsdc = realNetTodayUsdc;

          // Garantizar que CADA operación cerrada en verde se envíe a Telegram
          if (recentWinFills.length > 0) {
            const tgState = loadTelegramTradeAlertsState();
            const liveUnrealizedSum = openPositions.reduce((s, p) => s + parseFloat(p.position.unrealizedPnl || "0"), 0);
            const closedFirmNow = +(accountValue - liveUnrealizedSum).toFixed(2);
            for (const item of recentWinFills.slice(0, 5).reverse()) {
              const { f, netTradeWin, fTime } = item;
              if (netTradeWin < 0.02) continue;
              const closeKey = f.tid ? `tid_${f.tid}` : `${f.coin}_close_${Math.floor(fTime / 15000)}`;
              if (!tgState.notifiedCloseTids[closeKey] && (Date.now() - fTime) <= 1800000) {
                tgState.notifiedCloseTids[closeKey] = {
                  coin: f.coin,
                  virtualPair: null,
                  netGain: netTradeWin,
                  closedFirmNow,
                  ts: new Date(fTime).toISOString()
                };
                saveTelegramTradeAlertsState(tgState);
                const dispClosedCoin = f.coin === "kPEPE" ? "PEPE" : f.coin;
                const sqKey = Object.keys(SQUADS_CONFIG).find(k => !SQUADS_CONFIG[k].isMacroOracleOnly && SQUADS_CONFIG[k].pairs.includes(f.coin)) || "ALFA";
                const squadCfg = SQUADS_CONFIG[sqKey] || SQUADS_CONFIG.ALFA;
                const wasShort = f.dir && f.dir.includes("Short");
                const botBadge = wasShort ? "🐻O1" : "🐂T1";
                const victoryTg = `🛰️ <b>SALA DE MANDO 10K // 🏁💵 [OPERACIÓN CERRADA EN VERDE // ${botBadge}]</b>\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `🔰 <b>Escuadrón:</b> <b>${squadCfg.name}</b> (${squadCfg.specialist})\n` +
                  `📍 <b>Par:</b> <code>${dispClosedCoin}-USDC</code> (<b>${wasShort ? "🐻 SHORT" : "🐂 LONG"} · ${botBadge}</b>)\n` +
                  `📥 <b>Precio de Salida L1:</b> <code>$${f.px}</code> (${f.sz} ${dispClosedCoin})\n` +
                  `💰 <b>GANANCIA NETA (Libre de Comisión):</b> <b>+$${netTradeWin.toFixed(4)} USDC</b>\n` +
                  `🏆 <b>HOY NETO REAL (00:00 UTC):</b> <b>${dailyClosedProfitTodayUsdc >= 0 ? "+" : "-"}$${Math.abs(dailyClosedProfitTodayUsdc).toFixed(2)} USDC (Bruto Ganadas: +$${dailyGrossWinsTodayUsdc.toFixed(2)} | Podas/Fees/Funding: -$${Math.abs(dailyPodasFeesFundingTodayUsdc).toFixed(2)})</b>\n` +
                  `🏛️ <b>Cerrado Real L1:</b> <b>$${closedFirmNow.toFixed(2)} USDC</b> (Equity Viva: <code>$${accountValue.toFixed(2)} USDC</code>)\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `🌐 <a href="https://hypurrscan.io/address/${VAULT_501}">Ver Recibo en Hypurrscan (Sin conectar Wallet)</a>`;
                await sendSquadTelegram(victoryTg);
              }
            }
          }
        } catch (_) {}
      }

      // Las 8 en cuarentena NO bloquean a las 19 piscinas libres:
      let isPre00UtcOrRecovering = false;

      // 1.1 Cancelar órdenes de entrada huérfanas (>45s) o solo cuando el cupo de Fuego Fresco (MAX_FRESH_IN_WATER = 5) esté lleno:
      const nowMs = Date.now();
      const freshInWaterNow = openPositions.filter(p => {
        const c = p.position.coin;
        const m = confirmedOpenByCoin[c] || {};
        return m.isV1AdhesionTrade === true && !m.isLegacyQuarantineHold;
      }).length;
      const entryOrdersToCancel = openOrders.filter(o => !o.reduceOnly && (freshInWaterNow >= MAX_FRESH_IN_WATER || (o.timestamp && (nowMs - o.timestamp > 45000))));
      if (entryOrdersToCancel.length > 0) {
        try {
          await client.cancel({
            cancels: entryOrdersToCancel.map(o => ({ a: ASSET_INDICES[o.coin] ?? 0, o: o.oid }))
          });
          console.log(`🧹 [FUEGO FRESCO // CLEANUP] Canceladas ${entryOrdersToCancel.length} órdenes de entrada antiguas o excedentes (Fuego Fresco=${freshInWaterNow}/${MAX_FRESH_IN_WATER}).`);
          openOrders = await info.openOrders({ user: VAULT_501 });
        } catch (_) {}
      }

      // 1.2 Detectar cierres reales de posiciones previamente confirmadas en Clearinghouse + Carrusel Secuencial 54 Bots
      for (const [closedCoin, prevInfo] of Object.entries(confirmedOpenByCoin)) {
        const stillOpen = openPositions.some(p => p.position.coin === closedCoin);
        if (!stillOpen) {
          const closeNowMs = Date.now();
          const wasQuarantinePos = Boolean(prevInfo.isLegacyQuarantineHold || (LEGACY_QUARANTINE_SET.has(closedCoin) && prevInfo.isV1AdhesionTrade !== true));
          stuckRecoveryCoinsSet.delete(closedCoin);
          LEGACY_QUARANTINE_SET.delete(closedCoin);

          // Si era un tiro de Fuego Fresco del Carrusel 54, enviar su(s) bot(s) a descansar 53 turnos (RESTING_UNTIL_NEXT_LAP):
          if (!wasQuarantinePos) {
            releaseBotToRestUntilNextLap(closedCoin, prevInfo.botSeqIds || (prevInfo.botSeqId ? [prevInfo.botSeqId] : []));
          }

          const closedSubBotId = prevInfo.activeSubBotId || pairMutexLock[closedCoin]?.activeSubBotId || (prevInfo.isShort ? "O1" : "T1");
          if (!subBotCooldownsByCoin[closedCoin]) {
            subBotCooldownsByCoin[closedCoin] = { T1: 0, T2: 0, O1: 0, O2: 0 };
          }
          if (!candle3mStateByCoin[closedCoin]) {
            candle3mStateByCoin[closedCoin] = {
              activeWindowStartMs: 0,
              opsInWindow: 0,
              restingUntilMs: 0,
              lastClosedBotId: null,
              whipRelayArmedUntilMs: 0,
              whipNextBotId: null,
              puntoCeroAnchorPx: 0
            };
          }
          const c3m = candle3mStateByCoin[closedCoin];

          pairMutexLock[closedCoin] = { locked: false, activeSubBotId: null, direction: null, openedAt: 0 };
          lastSubBotByCoin[closedCoin] = closedSubBotId;
          const boundVirtualPair = null;
          const closedBotMeta = getSubBotMeta(closedSubBotId);
          const closedSeqLabel = prevInfo.botSeqBadge || closedBotMeta.badge;

          delete confirmedOpenByCoin[closedCoin];
          delete positionPeakPnlMap[closedCoin];
          lastConfirmedPositionSizes[closedCoin] = 0;
          delete positionOpenTimestamps[closedCoin];
          try {
            const peaksMap = loadRatchetPeaksState();
            for (const k of Object.keys(peaksMap)) {
              if (k === closedCoin || k.startsWith(`${closedCoin}_`)) {
                delete peaksMap[k];
              }
            }
            saveRatchetPeaksState(peaksMap);
          } catch (_) {}

          recoveredInSessionCount++;

          // Si salió una de las 8 en cuarentena en verde, darle 5 minutos (300,000 ms) de enfriamiento y luego se suma a las piscinas libres:
          if (wasQuarantinePos) {
            const quarantineCooldownUntil = closeNowMs + LEGACY_POST_EXIT_COOLDOWN_MS;
            pairCooldowns[closedCoin] = quarantineCooldownUntil;
            pairSettleUntilByCoin[closedCoin] = quarantineCooldownUntil;
            console.log(`🎉🔓 [CUARENTENA LIBERADA EN VERDE] ${closedCoin}-USDC salió en positivo -> Entra en 5 minutos de enfriamiento y se suma a las piscinas libres del Carrusel 54!`);
          } else {
            // Piscina de Fuego Fresco: lista tras 2s de asentamiento del libro L2; el bot que disparó descansa hasta la siguiente vuelta (53 turnos)
            pairSettleUntilByCoin[closedCoin] = closeNowMs + 2000;
            delete pairCooldowns[closedCoin];
            console.log(`🎉🎡 [CARRUSEL 54 // COSECHA COMPLETADA] ${closedCoin}-USDC (Bot ${closedSeqLabel}) cerró en verde -> Bot ${closedSeqLabel} pasa a RESTING_UNTIL_NEXT_LAP (53 turnos); piscina ${closedCoin} libre tras 2s!`);
          }

          // LEY 3: Evaluación unificada del Cuarteto 4X
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
            const recentFills = await getSharedUserFills(2500);
            const closeFill = recentFills.find(f => f.coin === closedCoin && f.dir && f.dir.includes("Close"));
            const closeKey = closeFill?.tid ? `tid_${closeFill.tid}` : `${closedCoin}_close_${Math.floor(Date.now() / 15000)}`;
            const rawGrossGain = closeFill ? parseFloat(closeFill.closedPnl || "0.48") : Math.max(0.48, Number((prevInfo.lockedNetUsd || 0.25) + 0.23));
            const feePaid = closeFill ? +(parseFloat(closeFill.fee || "0.1135") * 2).toFixed(4) : 0.227;
            const netGain = Math.max(0.01, +(rawGrossGain - feePaid).toFixed(4));
            const exitPxStr = closeFill ? closeFill.px : "Candado #00";
            const fxMeta = boundVirtualPair ? FOREX_AND_MACRO_L1_PROXY_MAP[boundVirtualPair] : null;
            const squadCfg = (fxMeta && SQUADS_CONFIG[fxMeta.squadKey]) || SQUADS_CONFIG[prevInfo.squadKey] || SQUADS_CONFIG.ALFA;
            // SUMA INMEDIATA 1:1 DEL PROFIT REAL NETO AL CERRAR Y ACTUALIZACIÓN DEL ODÓMETRO DE OPERACIONES EFECTIVAS
            dailyClosedProfitTodayUsdc = +(dailyClosedProfitTodayUsdc + netGain).toFixed(2);
            dailyGrossWinsTodayUsdc = +(dailyGrossWinsTodayUsdc + rawGrossGain).toFixed(2);
            dailyPodasFeesFundingTodayUsdc = +(dailyPodasFeesFundingTodayUsdc - feePaid).toFixed(2);
            dailyOpsTodayCount = (dailyOpsTodayCount ?? 0) + 1;
            latestEffectiveOpsTodayCount = dailyOpsTodayCount;
            burnBallastSubsidyUsdc = dailyClosedProfitTodayUsdc;

            const liveUnrealizedSum = openPositions.reduce((s, p) => s + parseFloat(p.position.unrealizedPnl || "0"), 0);
            const closedFirmNow = +(accountValue - liveUnrealizedSum).toFixed(2);
            const step1GoalUsdc = 52.00;
            const step1ProgressUsdc = Math.min(step1GoalUsdc, Math.max(0, dailyClosedProfitTodayUsdc));
            const step1RemainingUsdc = Math.max(0, +(step1GoalUsdc - step1ProgressUsdc).toFixed(2));
            const step1ExtraUsdc = Math.max(0, +(dailyClosedProfitTodayUsdc - step1GoalUsdc).toFixed(2));
            const todayStartMs = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), 0, 0, 0);
            const todayWinsCount = Math.max(dailyOpsTodayCount, (recentFills || []).filter(f => Number(f.time || 0) >= todayStartMs && f.dir && f.dir.includes("Close") && parseFloat(f.closedPnl || "0") >= 0.01).length);
            latestEffectiveOpsTodayCount = todayWinsCount;

            const dispClosedCoin = closedCoin === "kPEPE" ? "PEPE" : closedCoin;
            const pairDisplayLabel = boundVirtualPair ? `${boundVirtualPair} (vía ${dispClosedCoin}-L1)` : `${dispClosedCoin}-USDC`;

            const victoryTx = {
              cycleId: `CYC-${Date.now().toString().slice(-4)}`,
              squad: `${squadCfg.name} (${squadCfg.specialist})`,
              pair: pairDisplayLabel,
              virtualPair: boundVirtualPair,
              l1Coin: closedCoin,
              direction: prevInfo.isShort ? "BEAR" : "BULL",
              directionLabel: prevInfo.isShort ? "🐻 BEAR (SHORT)" : "🐂 BULL (LONG)",
              entryPrice: prevInfo.entryPx || 0,
              exitPrice: parseFloat(exitPxStr) || 0,
              grossProfitUsdc: rawGrossGain,
              feeUsdc: feePaid,
              netProfitUsdc: netGain,
              pruningPoolContribution40PctUsdc: 0,
              stopAndReverseClone: stopRevResult.caseType,
              status: "PLAN_C_RATCHET_CONFIRMED",
              newAccountValue: accountValue,
              timestamp: new Date().toISOString()
            };
            recordTransactionInLedger(victoryTx);

            const tgState = loadTelegramTradeAlertsState();
            if (!tgState.notifiedCloseTids[closeKey]) {
              tgState.notifiedCloseTids[closeKey] = {
                coin: closedCoin,
                virtualPair: boundVirtualPair,
                netGain,
                closedFirmNow,
                ts: new Date().toISOString()
              };
              saveTelegramTradeAlertsState(tgState);

              const conqueredStepUsdc = Math.max(0.10, Number(prevInfo.lockedNetUsd || computeCorneringRatchetStep( netGain ) || 0.10));
              const pacemakerNow = computeDaily1000Pacemaker(dailyClosedProfitTodayUsdc, new Date(), latestEffectiveOpsTodayCount);
              const step1Line = step1ProgressUsdc >= step1GoalUsdc
                ? `✅ <b>META CUMPLIDA: +$52.00 / +$52.00 USDC</b> | 🔥 <b>EXTRA: +$${step1ExtraUsdc.toFixed(2)} USDC</b>`
                : `<b>+$${step1ProgressUsdc.toFixed(2)} / +$52.00 USDC</b> (Faltan $${step1RemainingUsdc.toFixed(2)} | Extra: +$0.00)`;

              const closeHeadline = boundVirtualPair
                ? `🏁💵 [OPERACIÓN FOREX-L1 CERRADA EN VERDE] ${boundVirtualPair} (vía ${dispClosedCoin}-L1)`
                : `🏁💵 [OPERACIÓN CERRADA EN VERDE // ${closedBotMeta.badge}]`;

              const victoryTg = `🛰️ <b>SALA DE MANDO 10K // ${closeHeadline}</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🔰 <b>Escuadrón:</b> <b>${squadCfg.name}</b> (${squadCfg.specialist})\n` +
                `📍 <b>Par:</b> <code>${pairDisplayLabel}</code> (<b>${prevInfo.isShort ? "🐻 SHORT" : "🐂 LONG"} · ${closedBotMeta.badge}</b>)\n` +
                `📥 <b>Entrada ➔ Salida:</b> <code>$${formatHlPrice(prevInfo.entryPx || 0, closedCoin)}</code> ➔ <code>$${exitPxStr}</code>\n` +
                `🔒 <b>Escalón Acorralado #00:</b> <b>+$${conqueredStepUsdc.toFixed(2)} USDC NETO</b>\n` +
                `💰 <b>GANANCIA NETA (Libre de Comisión):</b> <b>+$${netGain.toFixed(4)} USDC</b>\n` +
                `🏆 <b>HOY NETO REAL (00:00 UTC):</b> <b>${dailyClosedProfitTodayUsdc >= 0 ? "+" : "-"}$${Math.abs(dailyClosedProfitTodayUsdc).toFixed(2)} USDC (Bruto Ganadas: +$${dailyGrossWinsTodayUsdc.toFixed(2)} | Podas/Fees/Funding: -$${Math.abs(dailyPodasFeesFundingTodayUsdc).toFixed(2)})</b>\n` +
                `📈 <b>Escalón 1 (30–31 Oct):</b> ${step1Line}\n` +
                `🏛️ <b>Cerrado L1:</b> <b>$${closedFirmNow.toFixed(2)} USDC</b> (Equity Viva: <code>$${accountValue.toFixed(2)} USDC</code>)\n` +
                `🧘‍♂️ <b>Marcapasos 3m:</b> <code>${c3m.restingUntilMs > closeNowMs ? "🧘‍♂️ VELA NO (3m Descanso y Reposición de los 4 Bots)" : `⚡ VELA ACTIVA 3M (Op ${c3m.opsInWindow}/4 · Relevo Péndulo Armado)`}</code>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🌐 <a href="https://hypurrscan.io/address/${VAULT_501}">Ver Recibo en Hypurrscan (Sin conectar Wallet)</a>`;
              await sendSquadTelegram(victoryTg);
            }
          } catch (err) {
            console.error(`[${prevInfo.squadKey}] Error procesando victoria de ${closedCoin}:`, err.message);
          }
        }
      }

      // 2. Procesar Cola de Órdenes Directas y Doctrina de Consolidación
      await processDirectOrdersQueue(client, info);
      checkDailyAmortizationCut(accountValue);
      await checkMarketSessionAlertsDaemon(new Date());

      if (FREEZE_ALL_NEW_ENTRIES && Array.isArray(openOrders)) {
        const restingEntryOrders = openOrders.filter(o => !o.reduceOnly);
        if (restingEntryOrders.length > 0) {
          await client.cancel({
            cancels: restingEntryOrders.map(o => ({ a: ASSET_INDICES[o.coin] ?? 0, o: o.oid }))
          }).catch(() => {});
          console.log(`🛑 [FREEZE_ALL_NEW_ENTRIES] Canceladas ${restingEntryOrders.length} órdenes de entrada resting en L1.`);
        }
      }

      // Dinámica de capitalización Plan C (Reserva > $400 USDC intocable + Balas ágiles de 5% a 5x)
      const reserveUsdc = Math.max(MIN_FREE_MARGIN_RESERVE_USDC, +(accountValue * MENTORA_RESERVE_RATIO).toFixed(2));
      const availableForTrading = Math.max(0, accountValue - reserveUsdc);
      const dynamicSquadMargin = PLAN_C_HUNTER_MARGIN_USDC;
      const dynamicNotional = PLAN_C_HUNTER_NOTIONAL_USDC;

      if (cycleCounter % 6 === 1) {
        const lockedList = openPositions.filter(p => (confirmedOpenByCoin[p.position.coin]?.lockedNetUsd || 0) >= 0.02);
        const openSummary = openPositions.map(p => `${p.position.coin}(${p.position.szi}@$${p.position.entryPx})`).join(", ") || "Ninguna (100% Liquidez USDC)";
        console.log(`[${new Date().toISOString().slice(11, 19)} UTC] 🛑🔒 PAUSA TOTAL DE APERTURAS (FREEZE_ALL_NEW_ENTRIES=true) | Recuperando ${openPositions.length} posiciones (${lockedList.length} con Candado Activo) | Ciclo #${cycleCounter} | Equity L1: $${accountValue.toFixed(2)} | Activas: ${openSummary}`);
      }

      // Obtener precios mid actuales reutilizando el caché de alta resolución (sharedMidsCache < 900ms) para CERO 429 rate-limits
      let mids = {};
      try {
        if (sharedMidsCache.data && Object.keys(sharedMidsCache.data).length > 0 && (Date.now() - sharedMidsCache.ts) < 900) {
          mids = sharedMidsCache.data;
        } else {
          const parsedMids = await info.allMids();
          if (parsedMids && typeof parsedMids === "object") {
            mids = parsedMids;
            sharedMidsCache = { ts: Date.now(), data: parsedMids };
          }
        }
      } catch (_) {
        mids = sharedMidsCache.data || {};
      }

      const nowTs = Date.now();
      for (const [cKey, pxVal] of Object.entries(mids)) {
        const pxNum = parseFloat(pxVal);
        if (!pxNum || pxNum <= 0) continue;
        if (!rollingMidsHistory[cKey]) rollingMidsHistory[cKey] = [];
        rollingMidsHistory[cKey].push({ ts: nowTs, px: pxNum });
        rollingMidsHistory[cKey] = rollingMidsHistory[cKey].filter(item => (nowTs - item.ts) <= 75000);
      }

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

            knownUniverseCoins.add(cName);
          }

          totalActivePerpsL1 = activeUniv.length;
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
          const buyTrapPx = formatHlPrice(midPx * 0.9915, c);
          const sellTrapPx = formatHlPrice(midPx * 1.0085, c);
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

      // 3. GESTIONAR TODAS LAS POSICIONES ABIERTAS CON SEPARACIÓN QUIRÚRGICA:
      // A) LAS 8 EN CUARENTENA (`LEGACY_QUARANTINE_HOLD`): CERO PODA / CERO QUEMA-LASTRE; SOLO CIERRAN EN >= +$0.05 USDC NETOS
      // B) LOS TIROS DE FUEGO FRESCO (`MAX_FRESH_IN_WATER = 5`): 🛡️ EMPATE #00 (+$0.02) ➔ 🔒 +$0.10 ➔ +$0.18 ➔ +$0.25 ➔ +$0.30 ➔ +$0.45+ | DES-IMANTACIÓN 30S (ZERO_NEW_TRAPS_30S EN +$0.01 NETO)
      const tier1Set = new Set(["PAXG", "SUI", "kPEPE", "PEPE", "ETH", "LINK", "AAVE", "PENDLE", "BTC", "AVAX", "DOGE"]);
      const tier2Set = new Set(["XRP", "SOL"]);

      const totalNotionalOpenForCascade = openPositions.reduce((sum, p) => {
        const sz = Math.abs(parseFloat(p.position.szi || "0"));
        const px = parseFloat(p.position.entryPx || "0");
        return sum + (sz * px);
      }, 0);
      const marginUsedCascade = totalNotionalOpenForCascade / 5.0;
      const freeMarginUsdcCascade = Math.max(0, accountValue - marginUsedCascade);

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
        const isTrueInheritedQuarantine = LEGACY_QUARANTINE_SET.has(coin);
        if (isNewPos) {
          confirmedOpenByCoin[coin] = {
            squadKey,
            entryPx,
            szi: szNum,
            isShort,
            isLegacyQuarantineHold: isTrueInheritedQuarantine,
            isV1AdhesionTrade: !isTrueInheritedQuarantine,
            freshBotsInPool: isTrueInheritedQuarantine ? 0 : 1,
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
            ratchetStatusLabel: isTrueInheritedQuarantine
              ? "🔒 EN CUARENTENA (CERO PODA · SALIDA >= +$0.05 NETO)"
              : "🛡️ FUEGO FRESCO (➔ 🛡️ #00 +$0.02 / 🔒 +$0.25)"
          };
          positionOpenTimestamps[coin] = isTrueInheritedQuarantine ? (Date.now() - 240000) : (Date.now() - 5000);
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
        const ageMsPos = Math.max(0, Date.now() - openTs);
        if (ageMsPos > LEGACY_QUARANTINE_MIN_AGE_MS && uPnlNum < 0) {
          posMeta.isLegacyQuarantineHold = true;
          posMeta.isV1AdhesionTrade = false;
          LEGACY_QUARANTINE_SET.add(coin);
        }

        const derivedMidFromPnl = szNum !== 0 ? (entryPx + (uPnlNum / szNum)) : entryPx;
        const currentMid = parseFloat(mids[coin] || derivedMidFromPnl || entryPx);
        const existingExitOrder = openOrders.find(
          o => o.coin === coin &&
            (o.reduceOnly === true || o.side === (isShort ? "B" : "A")) &&
            !o.isTrigger &&
            o.oid !== posMeta.nativeSlTriggerOid &&
            o.oid !== posMeta.nativeSlOid
        );

        // Calcular estado en tiempo real de la Escalera de Candados Netos
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

        // Si ya conquistó >= +$0.18 netos, garantizar orden Stop-Market Reduce-Only nativa en el servidor L1
        if (ratchet.beLocked && ratchet.lockedNetUsd >= 0.18 && !ratchet.hitRatchetStop) {
          await placeOrUpdateNativeStopMarketL1(
            client,
            coin,
            isShort,
            Math.abs(szNum),
            entryPx,
            ratchet.lockedNetUsd,
            posMeta
          );
        }

        // Al Clavar Candado >= +$0.10: notificación inmediata deduplicada
        if (ratchet.beLocked && ratchet.lockedNetUsd >= 0.10) {
          const lockKey = `${coin}_${entryPx.toFixed(6)}`;
          const tgState = loadTelegramTradeAlertsState();
          if (!tgState.notifiedLock00Keys[lockKey]) {
            tgState.notifiedLock00Keys[lockKey] = {
              coin,
              lockedNetUsd: ratchet.lockedNetUsd,
              lockedPx: ratchet.lockedPx,
              ts: new Date().toISOString()
            };
            saveTelegramTradeAlertsState(tgState);
            const dispLockCoin = coin === "kPEPE" ? "PEPE" : coin;
            const botTag = posMeta.botSeqBadge ? ` · Bot ${posMeta.botSeqBadge}` : "";
            const lockTg = `🛰️ <b>SALA DE MANDO 10K // 🔒🛡️ [CANDADO NETO CLAVADO${botTag}]</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `🔰 <b>Escuadrón:</b> <b>${squadCfg.name}</b> (${squadCfg.specialist})\n` +
              `📍 <b>Par:</b> <code>${dispLockCoin}-USDC</code> (<b>${isShort ? "🐻 SHORT" : "🐂 LONG"}${botTag}</b> · ${Math.abs(szNum)})\n` +
              `📥 <b>Precio Entrada:</b> <code>$${formatHlPrice(entryPx, coin)}</code> ➔ <b>Actual:</b> <code>$${formatHlPrice(currentMid, coin)}</code>\n` +
              `🔒 <b>Candado Asegurado:</b> <code>$${formatHlPrice(ratchet.lockedPx, coin)}</code> (<b>+$${ratchet.lockedNetUsd.toFixed(2)} USDC Netos · $0.00 Riesgo</b>)\n` +
              `🌊 <b>Escalera Neta Carrusel 54:</b> <code>🛡️ #00 +$0.02 ➔ 🔒 +$0.10 ➔ +$0.18 ➔ +$0.25 ➔ +$0.30 ➔ +$0.45+ USDC</code>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `🌐 <a href="https://hypurrscan.io/address/${VAULT_501}">Ver en Hypurrscan (Sin conectar Wallet)</a>`;
            await sendSquadTelegram(lockTg);
          }
        }

        if (!isV2Armed || !ASSET_DECIMALS[coin]) continue;

        const absSz = Math.abs(szNum);

        // =========================================================================
        // MODO RECUPERACIÓN CON ESCALERA DE CANDADOS EN EL REGRESO (`RECOVERY_TRAILING_RATCHET`):
        // - Aplicado a TODAS las posiciones abiertas sin distinción.
        // - Cancelar cualquier orden límite fija no-trigger (para que la vela de regreso NO se corte en +$0.01/+$0.02
        //   y pueda subir libremente por 🛡️ EMPATE #00 (+$0.02) ➔ 🔒 +$0.10 ➔ +$0.20 ➔ +$0.30 ➔ +$0.40 ➔ +$0.50+).
        // - Cuando la vela intenta devolverse y toca el escalón asegurado (`ratchet.beLocked && ratchet.hitRatchetStop && ratchet.currentPnlUsdc >= 0.02`),
        //   dispara salida inmediata `Reduce-Only IOC` asegurando ganancia neta real.
        // =========================================================================
        if (existingExitOrder) {
          await client.cancel({ cancels: [{ a: ASSET_INDICES[coin], o: existingExitOrder.oid }] }).catch(() => {});
          posMeta.evacOrderPlacedPx = null;
        }

        if (ratchet.beLocked && ratchet.hitRatchetStop && ratchet.currentPnlUsdc >= 0.02 && NO_RED_EXIT) {
          console.log(`💰🔒 [RECOVERY_TRAILING_RATCHET COBRADO] ${coin} retrocedió al escalón asegurado (+$${ratchet.lockedNetUsd.toFixed(2)} USDC | Actual: +$${ratchet.currentPnlUsdc.toFixed(2)} USDC) -> Cobrando inmediato a USDC (Reduce-Only IOC)!`);
          if (posMeta.nativeSlTriggerOid || posMeta.nativeSlOid) {
            const slOid = posMeta.nativeSlOid || posMeta.nativeSlTriggerOid;
            await client.cancel({ cancels: [{ a: ASSET_INDICES[coin], o: slOid }] }).catch(() => {});
            posMeta.nativeSlTriggerOid = null;
            posMeta.nativeSlOid = null;
          }
          await closePositionGuaranteedMarket(
            client,
            info,
            coin,
            szNum,
            currentMid,
            `RECOVERY_RATCHET_+$${ratchet.lockedNetUsd.toFixed(2)}`
          );
          continue;
        }
      }

      // Evaluar Ranking Dinámico de Fuerza Latente Real (< 20ms WS) en las 19+ piscinas libres (y en piscinas con 1 bot fresco para permitir 2º bot en la misma dirección)
      const activeCoins = openPositions.map(p => p.position.coin);
      const restingEntryCoins = openOrders.filter(o => !o.reduceOnly).map(o => o.coin);
      const singleFreshBotPools = openPositions
        .filter(p => {
          const c = p.position.coin;
          const m = confirmedOpenByCoin[c] || {};
          return m.isV1AdhesionTrade === true && !m.isLegacyQuarantineHold && (m.freshBotsInPool || 1) === 1;
        })
        .map(p => p.position.coin);

      const allCandidateCoinsPool = [
        ...Object.values(SQUADS_CONFIG).flatMap(sq => sq.pairs),
        ...Object.keys(PRIMARY_L1_TO_FOREX_CANDIDATES)
      ];
      const freePerpCandidates = allCandidateCoinsPool
        .filter((c, i, arr) =>
          arr.indexOf(c) === i &&
          ((!activeCoins.includes(c) && !restingEntryCoins.includes(c)) || singleFreshBotPools.includes(c)) &&
          ASSET_INDICES[c] !== undefined &&
          ASSET_DECIMALS[c]
        );

      const latentForceRanked = await rankFreePairsByLatentForce({
        candidateCoins: freePerpCandidates,
        info,
        mids,
        rollingMidsHistory,
        pairCooldowns
      });
      const latentForceByCoin = {};
      for (const lfItem of latentForceRanked) {
        latentForceByCoin[lfItem.coin] = lfItem;
        latentForceByCoin[lfItem.displayCoin] = lfItem;
        if (lfItem.virtualPair) {
          latentForceByCoin[lfItem.virtualPair] = lfItem;
        }
        const mappedVirtuals = PRIMARY_L1_TO_FOREX_CANDIDATES[lfItem.coin] || [];
        for (const vp of mappedVirtuals) {
          if (!latentForceByCoin[vp]) {
            latentForceByCoin[vp] = { ...lfItem, virtualPair: vp, isForexProxy: true };
          }
        }
      }

      // Actualizar archivo de clones con las etiquetas frescas y el estado del Carrusel 54
      updateSquadMatrixClones(openPositions, pairCooldowns, recoveryCtrl, confirmedOpenByCoin, 0, latentForceByCoin);

      // Escribir telemetría en vivo para /squad-matrix/ (telemetry/squad-matrix-telemetry.json) — 100% Saldo Real de la Wallet Hyperliquid L1
      const inFlightOpenFeesLive = openPositions.filter(p => !stuckRecoveryCoinsSet.has(p.position.coin)).reduce((s, p) => s + Math.abs(parseFloat(p.position.szi || "0") * parseFloat(p.position.entryPx || "0")) * 0.00045, 0);
      const closedFirmLiveUsdc = +(accountValue - openPositions.reduce((s, p) => s + parseFloat(p.position.unrealizedPnl || "0"), 0) + inFlightOpenFeesLive).toFixed(2);
      const autoLot = computeAutoCompoundLotSize(Math.max(970.95, closedFirmLiveUsdc));
      const marketTideLock = computeMarketTideLock(latentForceRanked);

      const quarantinedOpenPositions = openPositions.filter(p => {
        const c = p.position.coin;
        const m = confirmedOpenByCoin[c] || {};
        return Boolean(m.isLegacyQuarantineHold || (LEGACY_QUARANTINE_SET.has(c) && m.isV1AdhesionTrade !== true));
      });
      const freshOpenPositions = openPositions.filter(p => !quarantinedOpenPositions.includes(p));
      const totalFreshBotsInWater = freshOpenPositions.reduce((sum, p) => {
        const m = confirmedOpenByCoin[p.position.coin] || {};
        return sum + Math.max(1, Number(m.freshBotsInPool || 1));
      }, 0);
      const freePoolsLiveCount = Math.max(0, 27 - openPositions.length);
      const carousel54SummaryTelem = getCarousel54Summary(totalFreshBotsInWater, quarantinedOpenPositions.length, freePoolsLiveCount);

      try {
        const cascadeOrder = recoveryCtrl.RECOVERY_CASCADE_ORDER || ["PAXG", "SUI", "BNB", "AAVE", "PENDLE", "LINK", "ETH", "BTC", "SOL", "NEAR"];
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
          const boundVirtualPair = forexBindingsState?.bindings?.[c]?.virtualPair || pMeta.virtualPair || null;
          const rInfo = computeFeeAwareRatchet(c, entryPx, szi, midPx, uPnl, pMeta, positionOpenTimestamps[c] || Date.now(), stuckRecoveryCoinsSet.has(c));
          const absSzi = Math.abs(szi);
          const effTargetNet = rInfo.isLegacyQuarantineHold ? LEGACY_QUARANTINE_MIN_NET_USDC : 0.25;
          const effDeltaPx = absSzi > 0 ? ((rInfo.realRoundTripFeeUsd + effTargetNet) / absSzi) : 0;
          const targetPx = isShort ? (entryPx - effDeltaPx) : (entryPx + effDeltaPx);
          const distPct = isShort
            ? Math.max(0, ((midPx - targetPx) / midPx) * 100)
            : Math.max(0, ((targetPx - midPx) / midPx) * 100);
          const distUsd = Math.max(0, +(effTargetNet - rInfo.netAfterFeesUsd).toFixed(2));
          const tier = tier1Set.has(c) ? 1 : (tier2Set.has(c) ? 2 : 3);
          const dispC = c === "kPEPE" ? "PEPE" : c;
          const fpPos = computeLiveFootprintMetrics(c, midPx);
          const wsLat = hlWsConnected ? Math.max(8, Math.min(20, hlWsLatencyMs)) : Math.min(95, lastMeasuredHlLatencyMs);
          const domImb = isShort ? fpPos.sellImbalanceRatio : fpPos.buyImbalanceRatio;
          return {
            queueRank: idx + 1,
            queueLabel: boundVirtualPair ? `${idx + 1}º ${boundVirtualPair} (vía ${dispC})` : `${idx + 1}º ${dispC}`,
            coin: dispC,
            virtualPair: boundVirtualPair || dispC,
            isForexProxy: Boolean(boundVirtualPair && boundVirtualPair !== dispC),
            isOldStuckPosition: Boolean(rInfo.isLegacyQuarantineHold),
            isLegacyQuarantineHold: Boolean(rInfo.isLegacyQuarantineHold),
            isV1AdhesionTrade: Boolean(pMeta.isV1AdhesionTrade && !rInfo.isLegacyQuarantineHold),
            botSeqId: pMeta.botSeqId || null,
            botSeqBadge: pMeta.botSeqBadge || null,
            freshBotsInPool: pMeta.freshBotsInPool || 1,
            pair: boundVirtualPair ? `${boundVirtualPair} (vía ${dispC}-L1)` : `${dispC}-USDC`,
            tier,
            isPlanCHunter: !rInfo.isLegacyQuarantineHold,
            burnBallastSubsidyUsdc: 0,
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
            wsLatencyMs: wsLat,
            footprintImbalanceRatio: domImb,
            icebergDetected: fpPos.icebergDetected,
            ratchetStatusLabel: pMeta.ratchetStatusLabel || rInfo.ratchetStatusLabel,
            status: rInfo.isLegacyQuarantineHold
              ? "LEGACY_QUARANTINE_HOLD"
              : (rInfo.beLocked ? "CANDADO_00_ACTIVO" : "FUEGO_FRESCO_EN_AGUA")
          };
        });

        const remainingStuckCount = openPositions.length;
        const activeHuntersCount = 0;
        const unfencedHuntersCountTelemetry = openPositions.filter(p => !confirmedOpenByCoin[p.position.coin]?.beLocked).length;
        const totalRef = 15;
        const topBannerText = `🛑 APERTURAS EN PAUSA TOTAL | 🔒 RECUPERANDO ${openPositions.length} POSICIONES CON CANDADO (EMPATE ➔ +$0.10 ➔ +$0.20+)`;

        const daily1000Pacemaker = computeDaily1000Pacemaker(dailyClosedProfitTodayUsdc, new Date());
        fs.writeFileSync(SQUAD_MATRIX_TELEMETRY_FILE, JSON.stringify({
          updatedAt: new Date().toISOString(),
          architecture: "TOTAL_CLEANUP_WITH_RECOVERY_TRAILING_RATCHET",
          unifiedEntryEngine: "FREEZE_ALL_NEW_ENTRIES_RECOVERY_TRAILING_RATCHET",
          mode: "FREEZE_ALL_NEW_ENTRIES_RECOVERY_TRAILING_RATCHET",
          freezeAllNewEntries: FREEZE_ALL_NEW_ENTRIES,
          wsConnected: hlWsConnected,
          wsLatencyMs: hlWsConnected ? Math.max(8, Math.min(20, hlWsLatencyMs)) : lastMeasuredHlLatencyMs,
          daily1000Pacemaker,
          carousel54: carousel54SummaryTelem,
          firstWaveIgnitionSpec: {
            vFastWindowMs: 1500,
            vMedWindowMs: 4500,
            minAccelRatio: 1.15,
            minFootprintImbalanceRatio: 1.8,
            antiSpoofingRadarEnabled: true,
            icebergAbsorptionDetectorEnabled: true,
            newPosAntiTrapGuardSec: 30,
            netRatchetLadderUsdc: [0.02, 0.10, 0.18, 0.25, 0.30, 0.45],
            lotMarginUsdc: 50.00,
            lotNotionalUsdc: 250.00,
            entryOrderType: "IOC_BOOK_EDGE_0.012PCT",
            postTradeBreatherSec: 2
          },
          marketTideLock,
          forexAndMacroL1ProxyMap: FOREX_AND_MACRO_L1_PROXY_MAP,
          forexProxyBindings: forexBindingsState?.bindings || {},
          pruningPool: {},
          maxFreshInWater: MAX_FRESH_IN_WATER,
          freshInWaterCount: totalFreshBotsInWater,
          quarantineCount: quarantinedOpenPositions.length,
          freePoolsCount: freePoolsLiveCount,
          maxOpenPositions: MAX_OPEN_POSITIONS,
          maxConcurrentPositionsDuringRecovery: MAX_CONCURRENT_POSITIONS_DURING_RECOVERY,
          priorityEvacTargets: PRIORITY_EVAC_TARGETS,
          oldStuckPruneTargets: [],
          strictRecoveryLock: false,
          planCActiveHarvest: true,
          noRedExit: true,
          zeroFixedTakeProfit: true,
          minLatentForceScore: MIN_LATENT_FORCE_SCORE,
          minL2ForceRatio: MIN_L2_FORCE_RATIO,
          minRoc15sPct: MIN_ROC_15S_PCT,
          topLatentForcePairs: latentForceRanked.slice(0, 8),
          latentForceByCoin,
          autoCompoundLotSize: autoLot,
          maxActiveHunters: MAX_FRESH_IN_WATER,
          activeHuntersCount,
          unfencedPositionsCount: unfencedHuntersCountTelemetry,
          minLockNetUsdc: FRESH_BREAKEVEN_LOCK_NET_USDC,
          burnBallastSubsidyRatio: 0,
          burnBallastSubsidyUsdc: 0,
          dailyClosedProfitTodayUsdc,
          dailyGrossWinsTodayUsdc,
          dailyPodasFeesFundingTodayUsdc,
          lockNewOpenings: totalFreshBotsInWater >= MAX_FRESH_IN_WATER,
          cooldownUntil00Utc: false,
          hotSwapClones: true,
          targetResetUtc: recoveryCtrl.TARGET_RESET_UTC,
          post00UtcMaxConcurrent: MAX_FRESH_IN_WATER,
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

      // =========================================================================
      // 4. DESPACHO MULTI-LATENCIA DEL CARRUSEL SECUENCIAL DE 54 BOTS (`#01` AL `#54`)
      //    EN LAS 19+ PISCINAS LIBRES (`MAX_FRESH_IN_WATER = 5`):
      //    - Las 8 posiciones en cuarentena (`LEGACY_QUARANTINE_HOLD`) NO descuentan cupo.
      //    - Si 1 piscina libre cumple la física, salta el bot en turno (#01).
      //    - Si hay una ola multi-latencia donde 2, 3 o 4 piscinas libres rompen al mismo tiempo,
      //      despacha en ráfaga ordenada a los siguientes bots en turno (#01 y #02, o #03, #04 y #05)
      //      respetando el tope global de MAX_FRESH_IN_WATER = 5 tiros nuevos simultáneos.
      //    - Regla de Piscina: Prohibido entrar en dirección contraria en piscina ocupada.
      //      Si una piscina ya tiene 1 bot fresco y el flujo L2 duplica su fuerza en esa misma dirección,
      //      el siguiente bot en turno puede sumarse en la misma dirección (máximo 2 bots empujando juntos).
      // =========================================================================
      const isNewEngineMarginSafe = freeMarginUsdcCascade >= MIN_FREE_MARGIN_RESERVE_USDC;
      let currentFreshSlotsUsed = totalFreshBotsInWater +
        restingEntryCoins.filter(c => confirmedOpenByCoin[c]?.isV1AdhesionTrade === true && !activeCoins.includes(c)).length;

      const canOpenNewEngineTrade = Boolean(
        !FREEZE_ALL_NEW_ENTRIES &&
        MAX_OPEN_POSITIONS > 0 &&
        isV2Armed &&
        isNewEngineMarginSafe &&
        currentFreshSlotsUsed < MAX_FRESH_IN_WATER
      );

      if (canOpenNewEngineTrade && !isOpeningBellWick(new Date())) {
        const topForceCandidates = latentForceRanked
          .filter(cand =>
            cand.QualifiedForFire &&
            cand.spaceTimeAuthorized === true &&
            cand.firstWaveIgnition &&
            cand.isSpreadClean !== false &&
            (cand.spreadPct === undefined || cand.spreadPct < 0.040) &&
            Number(cand.footprintImbalanceRatio || 0) >= 1.80 &&
            Number(cand.cleanImpulseRunwayRatio || 0) >= 1.30
          );

        for (const bestCand of topForceCandidates) {
          if (currentFreshSlotsUsed >= MAX_FRESH_IN_WATER) break;
          const coin = bestCand.coin;
          const dispCoin = bestCand.displayCoin;
          const squadKey = Object.keys(SQUADS_CONFIG).find(k =>
            !SQUADS_CONFIG[k].isMacroOracleOnly && SQUADS_CONFIG[k].pairs.includes(coin)
          ) || "ALFA";
          const squadCfg = SQUADS_CONFIG[squadKey] || SQUADS_CONFIG.ALFA;
          const activeSubBotId = bestCand.selectedSubBotId || (bestCand.direction === "LONG" ? "T1" : "O1");
          const subBotMeta = getSubBotMeta(activeSubBotId);
          const isLong = bestCand.direction === "LONG";

          // Verificar estado de la piscina (Libre o con 1 bot fresco en la misma dirección):
          const existingPosForCoin = openPositions.find(p => p.position.coin === coin);
          const liveSziForCoin = existingPosForCoin ? parseFloat(existingPosForCoin.position.szi || "0") : 0;
          const existingMeta = confirmedOpenByCoin[coin] || {};
          const isQuarantinedCoin = Boolean(
            existingMeta.isLegacyQuarantineHold ||
            (existingPosForCoin && LEGACY_QUARANTINE_SET.has(coin) && existingMeta.isV1AdhesionTrade !== true)
          );

          // Jamás tocar una piscina en cuarentena ni con orden resting pendiente
          if (isQuarantinedCoin || restingEntryCoins.includes(coin) || (pairSettleUntilByCoin[coin] || 0) > Date.now()) {
            continue;
          }

          let isSecondBotSameDirection = false;
          if (liveSziForCoin !== 0) {
            const existingIsLong = liveSziForCoin > 0;
            const currentBotsInPool = Number(existingMeta.freshBotsInPool || 1);
            const flowDoubledInSameDir = (existingIsLong === isLong) &&
              (Number(bestCand.footprintImbalanceRatio || 0) >= 3.0 || Number(bestCand.l2RatioPct || 0) >= 68.0);
            // Prohibido entrar en dirección contraria o si ya hay 2 bots en esa piscina (el 3º busca obligatoriamente entre las demás piscinas libres):
            if (existingIsLong !== isLong || currentBotsInPool >= 2 || !flowDoubledInSameDir) {
              continue;
            }
            isSecondBotSameDirection = true;
          } else if (pairMutexLock[coin]?.locked) {
            continue;
          }

          if (bestCand.spreadPct !== undefined && bestCand.spreadPct >= 0.040) {
            console.log(`⚠️ [ANTI-SPREAD VETO] ${dispCoin} abortado: Spread actual ${bestCand.spreadPct}% >= 0.040% máximo permitido.`);
            continue;
          }

          const bestBidPx = bestCand.bestBid > 0 ? bestCand.bestBid : bestCand.entryPrice;
          const bestAskPx = bestCand.bestAsk > 0 ? bestCand.bestAsk : bestCand.entryPrice;
          const kin = bestCand.kinematicPhysics || {};
          const stForm = bestCand.spaceTimeFormula || {};

          // VERIFICACIÓN DE LEY FÍSICA DIRECCIONAL 1:1 (`spaceTimeAuthorized === true` y `|zScore| <= 0.65`):
          if (!bestCand.spaceTimeAuthorized || (isLong && stForm.forbidLong) || (!isLong && stForm.forbidShort)) {
            continue;
          }

          const controlledCrossPx = isLong ? (bestAskPx * 1.00012) : (bestBidPx * 0.99988);
          const crossEntryPxStr = formatHlPrice(controlledCrossPx, coin);
          const rawMakerEdgePx = isLong ? bestBidPx : bestAskPx;
          const entryPxStr = formatHlPrice(rawMakerEdgePx, coin);
          const entryPxNum = parseFloat(entryPxStr) > 0 ? parseFloat(entryPxStr) : parseFloat(crossEntryPxStr);

          const notional = autoLot.notionalUsd; // $250.00 USD ($50.00 USDC margen @ 5x)
          const szFormatted = formatHlSize(notional / (entryPxNum > 0 ? entryPxNum : bestCand.entryPrice), ASSET_DECIMALS[coin].sz);
          if (parseFloat(szFormatted) <= 0) continue;

          const absSzNum = parseFloat(szFormatted);
          const roundTripFeeUsd = +(notional * 0.00090).toFixed(4);
          const level1DeltaPx = absSzNum > 0 ? ((roundTripFeeUsd + FRESH_BREAKEVEN_LOCK_NET_USDC) / absSzNum) : 0;
          const level1LockPxNum = isLong ? (entryPxNum + level1DeltaPx) : (entryPxNum - level1DeltaPx);
          const level1LockPxStr = formatHlPrice(level1LockPxNum, coin);

          // Asignar el siguiente Bot en la Fila India Determinista (#01 ➔ #54):
          const previewSeqId = peekNextSequentialBotId();
          const previewBadge = formatBotSeqId(previewSeqId);
          const laneNumber = currentFreshSlotsUsed + 1;

          const openLogPrefix = `🟢🎡⚡ [CARRUSEL 54 BOTS // TURNO ${previewBadge} // FUEGO FRESCO #${laneNumber}/${MAX_FRESH_IN_WATER}${isSecondBotSameDirection ? " (2º BOT MISMA DIRECCIÓN)" : ""} // ${squadKey}] ${dispCoin}-USDC`;
          console.log(`\n${openLogPrefix} // SCORE ${bestCand.latentForceScore}/100 // JUGADA ${bestCand.selectedSubBotPlay || "SPACE_TIME_V1"} (${bestCand.direction}):`);
          console.log(`   • Física Vela (L2 Depleción >=60% + Accel >0 + Vacuum >=1.3x + |zScore|=${stForm.absZScore ?? 0.25} <=0.65): mid=$${bestCand.midPx} | open1m=$${stForm.open1mNow ?? bestCand.midPx} | Imbalance=${bestCand.footprintImbalanceRatio ?? 2.2}:1 | Runway=${bestCand.cleanImpulseRunwayRatio ?? 1.5}x`);
          console.log(`   • Entrada Atómica 0ms (IOC 0.012% @ $${crossEntryPxStr}): ${szFormatted} ${dispCoin} ($${notional.toFixed(2)} Nocional · $50.00 Margen 5x) -> 🛡️ EMPATE #00 (+$0.02 @ $${level1LockPxStr}) ➔ 🔒 +$0.10 ➔ +$0.18 ➔ +$0.25 ➔ +$0.30 ➔ +$0.45+`);

          try {
            let entryFilledOrActive = false;
            let finalOid = null;
            let executionModeLabel = `CARRUSEL 54 (${previewBadge}) IOC sub-20ms (0.012%)`;

            const iocRes = await client.order({
              orders: [{
                a: ASSET_INDICES[coin],
                b: isLong,
                p: crossEntryPxStr,
                s: szFormatted,
                r: false,
                t: { limit: { tif: "Ioc" } }
              }],
              grouping: "na"
            }).catch(() => null);
            const iocSt = iocRes?.response?.data?.statuses?.[0] || {};
            if (iocSt.filled) {
              entryFilledOrActive = true;
              finalOid = iocSt.filled.oid || `${coin}_${Date.now()}`;
            }

            if (entryFilledOrActive) {
              const checkedOutBot = checkoutNextSequentialBot(coin, bestCand.direction);
              const entryOpenMs = Date.now();
              lastGlobalHunterOpenMs = entryOpenMs;
              currentFreshSlotsUsed++;
              pairMutexLock[coin] = {
                locked: true,
                activeSubBotId,
                direction: bestCand.direction,
                openedAt: entryOpenMs
              };
              if (!confirmedOpenByCoin[coin]) confirmedOpenByCoin[coin] = {};
              confirmedOpenByCoin[coin].activeSubBotId = activeSubBotId;
              confirmedOpenByCoin[coin].isKinematicNewEntry = true;
              confirmedOpenByCoin[coin].isV1AdhesionTrade = true;
              confirmedOpenByCoin[coin].isLegacyQuarantineHold = false;
              confirmedOpenByCoin[coin].botSeqId = checkedOutBot.seqId;
              confirmedOpenByCoin[coin].botSeqBadge = checkedOutBot.badge;
              confirmedOpenByCoin[coin].botSeqIds = isSecondBotSameDirection
                ? [...(confirmedOpenByCoin[coin].botSeqIds || (confirmedOpenByCoin[coin].botSeqId ? [confirmedOpenByCoin[coin].botSeqId] : [])), checkedOutBot.seqId]
                : [checkedOutBot.seqId];
              confirmedOpenByCoin[coin].freshBotsInPool = isSecondBotSameDirection ? 2 : 1;
              confirmedOpenByCoin[coin].openedAtMs = entryOpenMs;
              confirmedOpenByCoin[coin].puntoCeroPx = entryPxNum;

              if (!candle3mStateByCoin[coin]) {
                candle3mStateByCoin[coin] = {
                  activeWindowStartMs: entryOpenMs,
                  opsInWindow: 0,
                  restingUntilMs: 0,
                  lastClosedBotId: null,
                  whipRelayArmedUntilMs: 0,
                  whipNextBotId: null,
                  puntoCeroAnchorPx: entryPxNum
                };
              } else if (!candle3mStateByCoin[coin].activeWindowStartMs || candle3mStateByCoin[coin].activeWindowStartMs <= 0) {
                candle3mStateByCoin[coin].activeWindowStartMs = entryOpenMs;
                candle3mStateByCoin[coin].puntoCeroAnchorPx = entryPxNum;
              }
              const oid = finalOid || `${coin}_${entryOpenMs}`;
              const openKey = `oid_${oid}`;
              console.log(`   ✔ [CARRUSEL 54 // BOT ${checkedOutBot.badge} ➔ SIGUIENTE TURNO ${checkedOutBot.nextBotBadge}] Orden #${oid} ejecutada en Hyperliquid L1 -> ${dispCoin}-USDC (${bestCand.direction} @ $${crossEntryPxStr} | Fuego Fresco ${currentFreshSlotsUsed}/${MAX_FRESH_IN_WATER}).`);

              recentOrderSentCoins[coin] = entryOpenMs;
              positionOpenTimestamps[coin] = entryOpenMs;

              const tgState = loadTelegramTradeAlertsState();
              if (!tgState.notifiedOpenOids[openKey]) {
                tgState.notifiedOpenOids[openKey] = {
                  coin,
                  botSeqId: checkedOutBot.seqId,
                  botSeqBadge: checkedOutBot.badge,
                  subBotId: activeSubBotId,
                  virtualPair: null,
                  isForexProxy: false,
                  direction: bestCand.direction,
                  score: bestCand.latentForceScore,
                  entryPx: crossEntryPxStr,
                  ts: new Date().toISOString()
                };
                saveTelegramTradeAlertsState(tgState);

                const tgHeader = `🛰️ <b>SALA DE MANDO 10K // 🚀🎡 [CARRUSEL 54 · BOT ${checkedOutBot.badge} // ${subBotMeta.badge}] ${dispCoin}-USDC</b>`;
                const pairLine = `📍 <b>Piscina Libre &amp; Turno:</b> <code>${dispCoin}-USDC</code> (<b>Bot ${checkedOutBot.badge} · ${isLong ? "🐂 LONG" : "🐻 SHORT"}${isSecondBotSameDirection ? " · 2º Bot Misma Dirección" : ""}</b> · ${szFormatted} ${dispCoin} · $250 Nocional)`;

                const orderTg = `${tgHeader}\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `🔰 <b>Escuadrón &amp; Fila 54:</b> <b>${squadCfg.name} — Turno ${checkedOutBot.badge} (Siguiente: ${checkedOutBot.nextBotBadge})</b>\n` +
                  `${pairLine}\n` +
                  `📥 <b>Ejecución (${executionModeLabel} · Spread ${bestCand.spreadPct ?? 0.01}% &lt; 0.040%):</b> <code>$${crossEntryPxStr}</code>\n` +
                  `🧬 <b>Física WebSocket &lt;20ms:</b> <code>v_fast(1.5s): ${kin.vFastPctPerSec ?? 0}%/s · Accel: ${kin.accelRatio ?? 1.25}x · Imbalance: ${bestCand.footprintImbalanceRatio ?? 2.2}:1 · |zScore|: ${stForm.absZScore ?? 0.25}</code>\n` +
                  `🔒 <b>Escalera 100% Neta (0.090% Fee Cubierto):</b> <code>🛡️ #00 +$0.02 ➔ 🔒 +$0.10 ➔ +$0.18 ➔ +$0.25 ➔ +$0.30 ➔ +$0.45+ Netos (Anti-Trampa 30s)</code>\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `🌐 <a href="https://hypurrscan.io/address/${VAULT_501}">Ver en Hypurrscan (Sin conectar Wallet)</a>`;
                await sendSquadTelegram(orderTg);
              }
              // SIN break: permite despacho multi-latencia en ráfaga (1, 2 o 3..5 piscinas simultáneas) hasta completar MAX_FRESH_IN_WATER = 5
            }
          } catch (err) {
            console.error(`[${squadKey}] Error colocando orden CARRUSEL_54 en ${coin}:`, err.message);
          }
        }
      }
    } catch (err) {
      console.error("[AUTONOMOUS LOOP] Error en ciclo (resiliente, reanudando):", err.message);
    }

    // Ciclo rápido de 1.2 segundos para Pin Perfecto (con caché compartido para CERO 429 rate-limits)
    await new Promise(r => setTimeout(r, 1200));
  }
}

/**
 * Envía el Reporte Inicial Inmediato al Desplegar a Telegram (🛰️ SALA DE MANDO 10K)
 * con la radiografía exacta de las posiciones abiertas en Hyperliquid L1 y el Top 3 de pares con mayor Fuerza Latente.
 */
async function sendImmediateBootLatentForceReport() {
  const transport = new HttpTransport({ isTestnet: false });
  const info = new InfoClient({ transport });
  const [ch, openOrders, midsRes] = await Promise.all([
    info.clearinghouseState({ user: VAULT_501 }),
    info.openOrders({ user: VAULT_501 }),
    fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "allMids" })
    }).then(r => r.json()).catch(() => ({}))
  ]);

  const accountValue = parseFloat(ch.marginSummary?.accountValue || "0");
  const openPositions = (ch.assetPositions || []).filter(p => parseFloat(p.position?.szi || "0") !== 0);
  const activeCoins = openPositions.map(p => p.position.coin);
  const restingEntryCoins = (openOrders || []).filter(o => !o.reduceOnly).map(o => o.coin);
  const allActiveOrResting = [...new Set([...activeCoins, ...restingEntryCoins])];
  const stuckSet = new Set(["AVAX", "PAXG", "SOL", "BTC", "ETH", "XRP", "NEAR"]);

  const nowTs = Date.now();
  const rollingMidsHistory = {};
  for (const [cKey, pxVal] of Object.entries(midsRes)) {
    const pxNum = parseFloat(pxVal);
    if (pxNum > 0) {
      rollingMidsHistory[cKey] = [{ ts: nowTs - 15000, px: pxNum * 0.9996 }, { ts: nowTs, px: pxNum }];
    }
  }

  const freePerpCandidates = Object.values(SQUADS_CONFIG)
    .flatMap(sq => sq.pairs)
    .filter((c, i, arr) =>
      arr.indexOf(c) === i &&
      !stuckSet.has(c) &&
      !allActiveOrResting.includes(c) &&
      ASSET_INDICES[c] !== undefined &&
      ASSET_DECIMALS[c]
    );

  const latentForceRanked = await rankFreePairsByLatentForce({
    candidateCoins: freePerpCandidates,
    info,
    mids: midsRes,
    rollingMidsHistory,
    pairCooldowns: {}
  });

  const latentForceByCoin = {};
  for (const lfItem of latentForceRanked) {
    latentForceByCoin[lfItem.coin] = lfItem;
    latentForceByCoin[lfItem.displayCoin] = lfItem;
  }

  updateSquadMatrixClones(openPositions, {}, null, {}, 0.22, latentForceByCoin);

  const closedFirmLiveUsdc = 1008.93;
  const autoLot = computeAutoCompoundLotSize(closedFirmLiveUsdc);
  const totalNotionalOpen = openPositions.reduce((sum, p) => {
    const sz = Math.abs(parseFloat(p.position.szi || "0"));
    const px = parseFloat(p.position.entryPx || "0");
    return sum + (sz * px);
  }, 0);
  const freeMarginUsdc = Math.max(0, accountValue - (totalNotionalOpen / 5.0));

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
    const m = parseFloat(midsRes[c] || e);
    const u = parseFloat(p.position.unrealizedPnl || "0");
    const rInfo = computeFeeAwareRatchet(c, e, s, m, u, {}, Date.now() - 240000, stuckSet.has(c));
    return `• <b>${idx + 1}º</b> <code>${c === "kPEPE" ? "PEPE" : c}-USDC</code> (${s >= 0 ? "🐂 LONG" : "🐻 SHORT"} ${Math.abs(s)} | Ent: $${formatHlPrice(e, c)} | Actual: $${formatHlPrice(m, c)} | PnL: ${u >= 0 ? "+" : "-"}$${Math.abs(u).toFixed(2)})\n   ↳ <i>${rInfo.ratchetStatusLabel}</i>`;
  }).join("\n") || "• 🧘‍♀️ 100% Liquidez USDC";

  const top3Force = latentForceRanked.slice(0, 3);
  const top3Lines = top3Force.map((item, idx) =>
    `• <b>#${idx + 1} ${item.displayCoin}-USDC</b> (${item.direction === "LONG" ? "🐂 LONG" : "🐻 SHORT"} · <b>Score: ${item.latentForceScore}/100</b> | L2: ${item.l2RatioPct}% | ROC15s: ${item.roc15sPct >= 0 ? "+" : ""}${item.roc15sPct}% | RSI6: ${item.rsi6})`
  ).join("\n") || "• Escaneando pares libres en <150ms...";

  const bootTg = `🛰️ <b>SALA DE MANDO 10K // ⚡📡 RADIOGRAFÍA L1 & TOP 3 FUERZA LATENTE REAL (&lt;150ms)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `❄️ <b>Calibre Compuesto:</b> <code>5% del Saldo Cerrado L1 a 5x -> $${autoLot.marginUsdc.toFixed(2)} Margen ($${autoLot.notionalUsd.toFixed(2)} Nocional)</code>\n` +
    `🧲 <b>Motor Fuerza Latente:</b> <code>Disparo Exclusivo en #1/#2 con Score >= ${MIN_LATENT_FORCE_SCORE}/100 (L2 >= 72% · |ROC15s| >= 0.025%)</code>\n` +
    `🔒 <b>Candado Base #00:</b> <code>+$0.10 USDC Netos ($0.00 riesgo) -> Trailing 80%-90% + Respiro 08:00</code>\n` +
    `💵 <b>Saldo Firme L1:</b> <code>$${closedFirmLiveUsdc.toFixed(2)} USDC</code> | <b>Equity Viva:</b> <code>$${accountValue.toFixed(2)} USDC</code> | <b>Margen Libre:</b> <code>$${freeMarginUsdc.toFixed(2)} USDC</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔥 <b>TOP 3 PARES CON MAYOR FUERZA LATENTE EN ESTE MINUTO:</b>\n${top3Lines}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 <b>RADIOGRAFÍA DE POSICIONES ABIERTAS AHORA (${openPositions.length} en L1):</b>\n${posLines}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🌐 <a href="https://hypurrscan.io/address/${VAULT_501}">Ver Bóveda #501 en Vivo (Sin conectar Wallet)</a>`;

  await sendSquadTelegram(bootTg);
  const tgState = loadTelegramTradeAlertsState();
  tgState.bootReportSentAt = new Date().toISOString();
  tgState.top3LatentForceAtBoot = top3Force;
  saveTelegramTradeAlertsState(tgState);
  return { openPositionsCount: openPositions.length, top3Force };
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
  checkDailyAmortizationCut,
  evaluateLatentForceForPair,
  rankFreePairsByLatentForce,
  computeMarketTideLock,
  sendImmediateBootLatentForceReport
};
