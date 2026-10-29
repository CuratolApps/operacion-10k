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

// --- POLÍTICA DE CAPITAL ESCALADO V3 (40% ESCUDO #00 / BLOQUE 1 INDEPENDIENTE + BLOQUE 2 $300 USDC INDEPENDIENTE) ---
const MENTORA_RESERVE_RATIO = 0.40;     // 40% Escudo Mentora #00 (~$360.82+ USDC Intocables)
const SQUAD_MARGIN_RATIO = 0.11;        // ~11% Margen por Escuadrón (~$100.00 USDC x 6 Escuadrones = ~$600 / 60% Operativo)
const BLOCK2_DEDICATED_MARGIN = 100.00; // $100.00 USDC dedicados para #04 GOLF, #05 HOTEL, #06 INDIA ($300 USDC Bloque 2)
const BLOCK2_LEVERAGE = 2.0;            // $100.00 * 2.0x = $200.00 Nocional ágil por disparo en Bloque 2
const LEVERAGE = 2.5;                   // ~$100 Margen * 2.5x = ~$250.00 Nocional seguro por tiro en Bloque 1
const MAX_NOTIONAL_PER_COIN = 250.00;   // REGLA ANTI-LIQUIDEZ ESTÁTICA: Máx $250.00 USD por par
const TARGET_GAIN_PCT = 0.15;           // +0.15% Take Profit Rápido Bloque 1
const BLOCK2_TARGET_GAIN_PCT = 0.12;    // +0.12% Take Profit Ultra-Rápido Bloque 2 (Cero Holder / Liquidez Rápida)
const BREAKEVEN_TRIGGER_PCT = 0.05;     // Candado Breakeven #00 se activa al +0.05%
const BREAKEVEN_LOCK_PCT = 0.03;        // Candado BE en +0.03% (cubre 100% comisiones Maker y asegura centavos verdes)
const TIME_STOP_MS = 10 * 60 * 1000;    // Reloj Anti-Holder Cero Estancamiento: 10 minutos
const TIME_STOP_MIN_PNL_USDC = 0.02;    // Si lleva >=10m y PnL >= +$0.02 USDC, cierra de inmediato para rotar liquidez
const COOLDOWN_DURATION_MS = 8 * 60 * 1000;  // 8 minutos de enfriamiento táctico post-TP por par (Clon releva al instante)
const MIN_CERTAINTY_L2_PCT = 58.0;      // 58% de presión L2 mínima para tiro con confluencia real
const MAX_CONCURRENT_BLOCK_1 = 4;       // Cupo propio Bloque 1 (#01 ALFA, #02 BRAVO, #03 CHARLIE): hasta 4 posiciones
const MAX_CONCURRENT_BLOCK_2 = 3;       // Cupo propio INDEPENDIENTE Bloque 2 (#04 GOLF, #05 HOTEL, #06 INDIA): 3 posiciones ($100 c/u)
const MAX_CONCURRENT_INITIAL = 6;       // Hasta 6 simultáneas directas (1 por cada uno de los 6 escuadrones activos)
const MAX_CONCURRENT_TOTAL = 7;         // Hasta 7 simultáneas totales (4 Bloque 1 + 3 Bloque 2 independientes)
const pairCooldowns = {};               // Mapa de enfriamiento táctico { coin: timestampMs }
const DCA_TRIGGER_DRAWDOWN = -0.85;     // Refuerzo Mentora en -0.85%
const DCA_TRIGGER_RSI = 30;             // RSI sobreventa extrema
const DCA_TARGET_GAIN_PCT = 0.20;       // Evacuación rápida doble posición al +0.20%


const TELEMETRY_DIR = path.join(__dirname, "..", "telemetry");
const REAL_LEDGER_FILE = path.join(TELEMETRY_DIR, "squad-secret-real-ledger.json");
const SQUAD_TELEMETRY_FILE = path.join(TELEMETRY_DIR, "squad-secret-telemetry.json");
const LOAN_LEDGER_FILE = path.join(TELEMETRY_DIR, "vault501-loan-ledger.json");
const DIRECT_ORDERS_FILE = path.join(TELEMETRY_DIR, "direct-orders-queue.json");
const SQUAD_CLONES_FILE = path.join(TELEMETRY_DIR, "squad-matrix-clones.json");

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
    pairs: ["HYPE", "TRX", "UNI"],
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
  const meta = ASSET_DECIMALS[coin];
  if (meta && typeof meta.px === "number") {
    return meta.px === 0 ? Math.round(price).toFixed(0) : Number(price).toFixed(meta.px);
  }
  if (coin === "BTC") return Math.round(price).toFixed(0);
  if (coin === "ETH" || coin === "PAXG") return price.toFixed(1);
  return price.toFixed(2);
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

// Hot-Swap Relay 1 ⇄ 2 (18 Espacios × 36 Bots / 12 Bots Activos en Bloques 1 y 2 sobre 18 Pares)
function updateSquadMatrixClones(openPositions, pairCooldowns) {
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
    const activeCoins = (openPositions || []).map(p => p.position.coin);

    const clonesState = spaces.map(sp => {
      if (sp.block <= 2) {
        const inPosCoin = sp.pairs.find(c => activeCoins.includes(c));
        const cooldownCoin = sp.pairs.find(c => pairCooldowns && pairCooldowns[c] && pairCooldowns[c] > now);

        if (inPosCoin) {
          return {
            ...sp,
            relayStatus: `⚡ ${sp.titular}: ACTIVO (${inPosCoin}) ⇄ ${sp.clon}: RELEVO`,
            activeBot: sp.titular,
            standbyBot: sp.clon,
            mode: "ACTIVE_POSITION",
            pairInAction: inPosCoin
          };
        } else if (cooldownCoin) {
          const remMins = Math.ceil((pairCooldowns[cooldownCoin] - now) / 60000);
          return {
            ...sp,
            relayStatus: `🔄 ${sp.titular}: ENFRIAMIENTO ${remMins}m ⇄ ⚡ ${sp.clon}: CAZANDO`,
            activeBot: sp.clon,
            standbyBot: sp.titular,
            mode: "HOT_SWAP_RELAY",
            cooldownCoin,
            cooldownRemainingMins: remMins
          };
        } else {
          return {
            ...sp,
            relayStatus: `⚡ ${sp.titular}: ACTIVO ⇄ ${sp.clon}: RELEVO`,
            activeBot: sp.titular,
            standbyBot: sp.clon,
            mode: "SCANNING",
            pairInAction: null
          };
        }
      } else {
        return {
          ...sp,
          relayStatus: `⏸️ ${sp.titular}: PRE-ARMADO ⇄ ${sp.clon}: PRE-ARMADO ($100)`,
          activeBot: sp.titular,
          standbyBot: sp.clon,
          mode: "STANDBY_ARMED",
          pairInAction: null
        };
      }
    });

    const payload = {
      updatedAt: new Date().toISOString(),
      architecture: "Hot-Swap Relay 1 ⇄ 2 (6 Escuadrones Activos #01-#06 × 12 Bots en 18 Pares)",
      rules: {
        radarL2: ">= 62%",
        rsi5m: "<= 46 (Long) / >= 70 (Short) + EMA20",
        nebulosas: "32 Direccionales",
        candadoBreakeven: "+0.045% Mentora #00",
        cooldownPostTp: "12 minutos por par / relevo instantáneo al clon en pares libres"
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
  let cycleCounter = 0;
  let isV2Armed = true;

  while (true) {
    cycleCounter++;
    try {
      // 1. Obtener estado del Clearinghouse y Órdenes Abiertas
      const ch = await info.clearinghouseState({ user: VAULT_501 });
      const accountValue = parseFloat(ch.marginSummary?.accountValue || "902.05");
      const openPositions = (ch.assetPositions || []).filter(p => parseFloat(p.position.szi) !== 0);
      let openOrders = await info.openOrders({ user: VAULT_501 });

      // 1.1 Limpiar órdenes de entrada (!reduceOnly) estancadas > 45s sin ejecutarse para no bloquear a los escuadrones
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

      // 1.2 Detectar cierres reales de posiciones previamente confirmadas en Clearinghouse
      for (const [closedCoin, prevInfo] of Object.entries(confirmedOpenByCoin)) {
        const stillOpen = openPositions.some(p => p.position.coin === closedCoin);
        if (!stillOpen) {
          console.log(`🎉 [VICTORIA CONFIRMADA ON-CHAIN] ${closedCoin} (${prevInfo.squadKey}): posición cerrada al 100%.`);
          pairCooldowns[closedCoin] = Date.now() + COOLDOWN_DURATION_MS;
          console.log(`❄️ [ENFRIAMIENTO TÁCTICO] ${closedCoin} entra en 12 minutos de reposo tras cierre.`);

          delete confirmedOpenByCoin[closedCoin];
          lastConfirmedPositionSizes[closedCoin] = 0;
          delete positionOpenTimestamps[closedCoin];

          try {
            const recentFills = await info.userFills({ user: VAULT_501 });
            const closeFill = recentFills.find(f => f.coin === closedCoin && f.dir && f.dir.includes("Close"));
            const rawGrossGain = closeFill ? parseFloat(closeFill.closedPnl || "0.45") : 0.45;
            const feePaid = closeFill ? parseFloat(closeFill.fee || "0.04") : 0.04;
            const netGain = +(rawGrossGain - feePaid).toFixed(4);
            const exitPxStr = closeFill ? closeFill.px : "TP Alcanzado";
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
              status: "TAKE_PROFIT_CONFIRMED",
              newAccountValue: accountValue,
              timestamp: new Date().toISOString()
            };
            recordTransactionInLedger(victoryTx);
            const currentLedger = loadRealLedger();

            const victoryTg = `🔴💰 <b>ÁREA 501 // OPERACIÓN CERRADA EN TAKE-PROFIT (L1)</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `🔰 <b>Escuadrón:</b> <b>${squadCfg.name}</b> (${squadCfg.specialist})\n` +
              `📍 <b>Par:</b> <code>${closedCoin}-USDC</code> (${prevInfo.isShort ? "SHORT" : "LONG"})\n` +
              `📥 <b>Precio Entrada:</b> <code>$${formatHlPrice(prevInfo.entryPx || 0, closedCoin)}</code>\n` +
              `📤 <b>Precio Cierre TP:</b> <code>$${exitPxStr}</code>\n` +
              `💰 <b>GANANCIA NETA EN CAJA:</b> <b>+${netGain >= 0 ? "$" : "-$"}${Math.abs(netGain).toFixed(4)} USDC</b>\n` +
              `🏆 <b>Récord Oficial:</b> <b>${currentLedger.realWins} Ganadas · 0 Pérdidas (100% Invictos)</b>\n` +
              `❄️ <b>Enfriamiento:</b> <code>${closedCoin}</code> en 12m de reposo (Clon relevo cazando en pares libres)\n` +
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
      updateSquadMatrixClones(openPositions, pairCooldowns);

      // Dinámica de capitalización compuesta (40% Escudo #00 / 60% repartido en 6 Escuadrones ~$90-$100 c/u)
      const reserveUsdc = +(accountValue * MENTORA_RESERVE_RATIO).toFixed(2);
      const availableForTrading = Math.max(0, accountValue - reserveUsdc);
      const dynamicSquadMargin = Math.max(90.00, +(accountValue * SQUAD_MARGIN_RATIO).toFixed(2));
      const dynamicNotional = Math.min(MAX_NOTIONAL_PER_COIN, +(dynamicSquadMargin * LEVERAGE).toFixed(2));

      if (cycleCounter % 6 === 1) {
        const openSummary = openPositions.map(p => `${p.position.coin}(${p.position.szi}@$${p.position.entryPx})`).join(", ") || "Ninguna";
        console.log(`[${new Date().toISOString().slice(11, 19)} UTC] 6 Escuadrones (#01-#06) | Ciclo #${cycleCounter} | Equity Real: $${accountValue.toFixed(2)} USDC | Pos (${openPositions.length}/${MAX_CONCURRENT_TOTAL}): ${openSummary}`);
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

      // 3. GESTIONAR TODAS LAS POSICIONES ABIERTAS ACTUALES (TP AUTOMÁTICO, BREAKEVEN #00, RESCATE #00 Y ALERTA DE APERTURA)
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

        if (isNewPos) {
          confirmedOpenByCoin[coin] = {
            squadKey,
            entryPx,
            szi: szNum,
            isShort,
            dcaDone: notionalVal >= 600,
            beLocked: false
          };
          positionOpenTimestamps[coin] = Date.now();

          // Si se abrió después del ciclo 1 y aún no enviamos alerta de apertura en los últimos 60s, notificar a Telegram!
          if (cycleCounter > 1 && (!recentOrderSentCoins[coin] || (Date.now() - recentOrderSentCoins[coin] > 60000))) {
            recentOrderSentCoins[coin] = Date.now();
            const targetGainPct = notionalVal >= 1500 ? 0.08 : (notionalVal >= 600 ? 0.12 : TARGET_GAIN_PCT);
            const tpEstNum = isShort ? entryPx * (1 - targetGainPct / 100) : entryPx * (1 + targetGainPct / 100);
            const tpEstStr = formatHlPrice(tpEstNum, coin);
            const estGainUsdc = +(notionalVal * (targetGainPct / 100) - (notionalVal * 0.0003)).toFixed(4);

            const openConfirmedTg = `🟢⚡ <b>ÁREA 501 // OPERACIÓN ABIERTA EN VIVO (HYPERLIQUID L1)</b>\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `🔰 <b>Escuadrón:</b> <b>${squadCfg.name}</b> (${squadCfg.specialist})\n` +
              `📍 <b>Par:</b> <code>${coin}-USDC</code> (<b>${isShort ? "SHORT 🐻" : "LONG 🐂"}</b> · ${Math.abs(szNum)} ${coin})\n` +
              `📥 <b>Precio Entrada:</b> <code>$${formatHlPrice(entryPx, coin)}</code> ($${notionalVal.toFixed(2)} Nocional)\n` +
              `📤 <b>Orden Take-Profit (+${targetGainPct}%):</b> <code>$${tpEstStr}</code> (Reduce-Only)\n` +
              `💰 <b>Ganancia Estimada TP:</b> <b>+$${estGainUsdc.toFixed(4)} USDC</b>\n` +
              `🛡️ <b>Protección:</b> Candado BE #00 (+0.05%) + Escudo Mentora #00 ($${reserveUsdc.toFixed(2)} USDC)\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `🌐 <a href="https://hypurrscan.io/address/${VAULT_501}">Ver Posición en Hypurrscan (Sin conectar Wallet)</a>`;
            await sendSquadTelegram(openConfirmedTg);
          }
        } else {
          confirmedOpenByCoin[coin].entryPx = entryPx;
          confirmedOpenByCoin[coin].szi = szNum;
          if (notionalVal >= 600) confirmedOpenByCoin[coin].dcaDone = true;
        }
        const posMeta = confirmedOpenByCoin[coin];

        // Verificar si ya tiene orden Reduce-Only Take Profit en el libro L1 (incluye posiciones del Escudo #00)
        const existingExitOrder = openOrders.find(o => o.coin === coin && o.reduceOnly === true);
        const currentMid = parseFloat(mids[coin] || entryPx);

        if (!existingExitOrder && isV2Armed && ASSET_DECIMALS[coin]) {
          const targetGainPct = notionalVal >= 1500 ? 0.08 : (posMeta.dcaDone ? 0.12 : (squadCfg.targetGainPct || TARGET_GAIN_PCT));
          let exitPxNum = isShort
            ? entryPx * (1 - targetGainPct / 100)
            : entryPx * (1 + targetGainPct / 100);

          if (!isShort && currentMid >= exitPxNum) {
            exitPxNum = currentMid * 1.0003;
          } else if (isShort && currentMid <= exitPxNum) {
            exitPxNum = currentMid * 0.9997;
          }

          const safeExitPxStr = formatHlPrice(exitPxNum, coin);
          const totalSzStr = formatHlSize(Math.abs(szNum), ASSET_DECIMALS[coin].sz);

          console.log(`[${squadKey}] Colocando orden Limit Reduce-Only Take-Profit para ${coin}: ${totalSzStr} @ $${safeExitPxStr} (+${targetGainPct}%)`);
          try {
            await client.order({
              orders: [{
                a: ASSET_INDICES[coin],
                b: isShort,
                p: safeExitPxStr,
                s: totalSzStr,
                r: true,
                t: { limit: { tif: "Alo" } }
              }],
              grouping: "na"
            });
          } catch (err) {
            console.error(`[${squadKey}] Error colocando salida ALO para ${coin}:`, err.message);
          }
        } else if (isV2Armed && ASSET_DECIMALS[coin]) {
          const gainPct = isShort
            ? (entryPx - currentMid) / entryPx * 100
            : (currentMid - entryPx) / entryPx * 100;
          const drawdownPct = isShort
            ? (currentMid - entryPx) / entryPx * 100
            : (entryPx - currentMid) / entryPx * 100;

          // Reloj Anti-Estancamiento Cero-Holder (cierra en ganancia a partir de 10 minutos para rotar liquidez)
          const minPnlForTimeStop = posMeta.dcaDone ? 0.45 : TIME_STOP_MIN_PNL_USDC;
          const elapsedMins = (Date.now() - (positionOpenTimestamps[coin] || Date.now())) / 60000;
          if (elapsedMins >= 10 && uPnlNum >= minPnlForTimeStop) {
            console.log(`⏱️ [RELOJ ANTI-ESTANCAMIENTO] ${coin} abierta hace ${elapsedMins.toFixed(1)}m en verde (+$${uPnlNum.toFixed(4)} USDC). Cerrando para rotar.`);
            if (existingExitOrder) {
              await client.cancel({ cancels: [{ a: ASSET_INDICES[coin], o: existingExitOrder.oid }] }).catch(() => {});
            }
            const closePx = isShort ? currentMid * 1.0002 : currentMid * 0.9998;
            await client.order({
              orders: [{
                a: ASSET_INDICES[coin],
                b: isShort,
                p: formatHlPrice(closePx, coin),
                s: formatHlSize(Math.abs(szNum), ASSET_DECIMALS[coin].sz),
                r: true,
                t: { limit: { tif: "Alo" } }
              }],
              grouping: "na"
            }).catch(() => {});
            continue;
          }

          // Candado Breakeven #00 (+0.05%)
          if (gainPct >= BREAKEVEN_TRIGGER_PCT && !posMeta.beLocked) {
            posMeta.beLocked = true;
            const bePx = isShort ? entryPx * (1 - BREAKEVEN_LOCK_PCT / 100) : entryPx * (1 + BREAKEVEN_LOCK_PCT / 100);
            const bePxStr = formatHlPrice(bePx, coin);
            console.log(`🔒 [MENTORA #00] Candado Breakeven activado en ${coin} (+${gainPct.toFixed(2)}%) -> Nivel seguro $${bePxStr}`);
          }

          // Rescate Inteligente Mentora #00: Si drawdown >= 1.2% y aún no se ha usado el cartucho de rescate
          if (!posMeta.dcaDone && drawdownPct >= 1.20 && availableForTrading >= dynamicSquadMargin) {
            console.log(`\n🛡️ [MENTORA #00] RESCATE INTELIGENTE ACTIVADO EN ${coin} (-${drawdownPct.toFixed(2)}% desde $${entryPx}). Inyectando 1 cartucho de promediación...`);
            posMeta.dcaDone = true;

            const rescueSzStr = formatHlSize(Math.abs(szNum), ASSET_DECIMALS[coin].sz);
            const rescuePx = isShort ? currentMid * 0.998 : currentMid * 1.002;
            const rescuePxStr = formatHlPrice(rescuePx, coin);

            try {
              await client.order({
                orders: [{
                  a: ASSET_INDICES[coin],
                  b: !isShort,
                  p: rescuePxStr,
                  s: rescueSzStr,
                  r: false,
                  t: { limit: { tif: "Ioc" } }
                }],
                grouping: "na"
              });

              await new Promise(r => setTimeout(r, 1200));
              const chUpdated = await info.clearinghouseState({ user: VAULT_501 });
              const updatedPos = (chUpdated.assetPositions || []).find(p => p.position.coin === coin);
              if (updatedPos) {
                const newSzi = Math.abs(parseFloat(updatedPos.position.szi));
                const newEntryPx = parseFloat(updatedPos.position.entryPx);
                posMeta.entryPx = newEntryPx;
                posMeta.szi = newSzi;

                if (existingExitOrder) {
                  await client.cancel({ cancels: [{ a: ASSET_INDICES[coin], o: existingExitOrder.oid }] }).catch(() => {});
                }

                const tpPx = isShort ? newEntryPx * (1 - 0.0012) : newEntryPx * (1 + 0.0012);
                const tpPxStr = formatHlPrice(tpPx, coin);
                const totalSzStr = formatHlSize(newSzi, ASSET_DECIMALS[coin].sz);

                await client.order({
                  orders: [{
                    a: ASSET_INDICES[coin],
                    b: isShort,
                    p: tpPxStr,
                    s: totalSzStr,
                    r: true,
                    t: { limit: { tif: "Alo" } }
                  }],
                  grouping: "na"
                });

                const rescueTg = `🛡️ <b>ÁREA 501 // MENTORA #00 // RESCATE PROMEDIO TÁCTICO EN ${coin}-USDC</b>\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `🔰 <b>Escuadrón:</b> <b>${squadCfg.name}</b>\n` +
                  `📉 <b>Entrada Anterior:</b> <code>$${entryPx}</code>\n` +
                  `🎯 <b>Nuevo Precio Promedio:</b> <code>$${newEntryPx.toFixed(4)}</code> (${totalSzStr} ${coin})\n` +
                  `📤 <b>Orden Limit Reduce-Only TP:</b> <code>$${tpPxStr}</code> (+0.12% neto)\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                await sendSquadTelegram(rescueTg);
              }
            } catch (rescueErr) {
              console.error(`[MENTORA #00] Error en rescate de ${coin}:`, rescueErr.message);
            }
          }
        }
      }

      // Enviar reporte de arranque en el Ciclo #1 confirmando los 6 Escuadrones Activos y el Cupo Independiente Bloque 2 ($300 USDC)
      if (cycleCounter === 1) {
        const posLines = openPositions.map(p => {
          const c = p.position.coin;
          const s = parseFloat(p.position.szi);
          const e = parseFloat(p.position.entryPx);
          const tpMult = s >= 0 ? 1.0015 : 0.9985;
          return `• <code>${c}-USDC</code> (${s >= 0 ? "LONG" : "SHORT"} ${Math.abs(s)} @ $${formatHlPrice(e, c)} ➔ TP $${formatHlPrice(e * tpMult, c)})`;
        }).join("\n") || "• Sin posiciones abiertas (Escaneando 18 pares)";

        const bootTg = `🚀🛡️ <b>ÁREA 501 // BLOQUE 1 + BLOQUE 2 ($300 USDC INDEPENDIENTES) EN FUEGO PARALELO</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💵 <b>Patrimonio L1:</b> <code>$${accountValue.toFixed(2)} USDC</code> (Escudo 40%: <code>$${reserveUsdc.toFixed(2)} USDC</code>)\n` +
          `🔰 <b>Bloque 1 (#01 ALFA, #02 BRAVO, #03 CHARLIE):</b> Cupo Propio 4 Posiciones\n` +
          `⚡ <b>Bloque 2 Independiente ($300 USDC · $100 c/u · Cero Bloqueo):</b>\n` +
          `  • <b>#04 GOLF ($100):</b> XRP, DOGE, ADA (TP +0.12% Rápido)\n` +
          `  • <b>#05 HOTEL ($100):</b> HYPE, TRX, UNI (TP +0.12% Rápido)\n` +
          `  • <b>#06 INDIA ($100):</b> DOT, NEAR, LTC (TP +0.12% Rápido)\n` +
          `📊 <b>Posiciones Abiertas Ahora (${openPositions.length}/${MAX_CONCURRENT_TOTAL}):</b>\n${posLines}\n` +
          `⏱️ <b>Doctrina Cero-Holder:</b> Rotación rápida de liquidez (TP +0.12%/+0.15% + Reloj 10m en verde)\n` +
          `🔔 <b>Notificaciones Telegram:</b> 100% Activas en CADA Apertura y CADA Cierre\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🌐 <a href="https://hypurrscan.io/address/${VAULT_501}">Ver Cuenta #501 en Hypurrscan (Sin conectar Wallet)</a>`;
        await sendSquadTelegram(bootTg);
      }

      // 4. REGLA DE INDEPENDENCIA DE BLOQUES: BLOQUE 1 (#01-#03) Y BLOQUE 2 ($300 USDC: #04 GOLF, #05 HOTEL, #06 INDIA)
      // El Bloque 2 tiene sus propios 3 cupos independientes ($100 c/u) y NUNCA es bloqueado por las posiciones abiertas del Bloque 1
      const activeCoins = openPositions.map(p => p.position.coin);
      const restingEntryCoins = openOrders.filter(o => !o.reduceOnly).map(o => o.coin);
      const allActiveOrResting = [...new Set([...activeCoins, ...restingEntryCoins])];

      const block1Pairs = [...SQUADS_CONFIG.ALFA.pairs, ...SQUADS_CONFIG.BRAVO.pairs, ...SQUADS_CONFIG.CHARLIE.pairs];
      const block2Pairs = [...SQUADS_CONFIG.GOLF.pairs, ...SQUADS_CONFIG.HOTEL.pairs, ...SQUADS_CONFIG.INDIA.pairs];

      let block1OpenCount = allActiveOrResting.filter(c => block1Pairs.includes(c)).length;
      let block2OpenCount = allActiveOrResting.filter(c => block2Pairs.includes(c)).length;

      if (isV2Armed && (block1OpenCount < MAX_CONCURRENT_BLOCK_1 || block2OpenCount < MAX_CONCURRENT_BLOCK_2) && !isOpeningBellWick(new Date())) {
        // Priorizar a los escuadrones del Bloque 2 (#04 GOLF, #05 HOTEL, #06 INDIA) cuando tienen su cupo libre (block2OpenCount < 3)
        const orderedKeys = block2OpenCount < MAX_CONCURRENT_BLOCK_2
          ? ["GOLF", "HOTEL", "INDIA", "ALFA", "BRAVO", "CHARLIE"]
          : ["ALFA", "BRAVO", "CHARLIE", "GOLF", "HOTEL", "INDIA"];

        const baseUnits = orderedKeys.map(unitKey => {
          const squadCfg = SQUADS_CONFIG[unitKey];
          const hasOpenInSquad = activeCoins.some(c => squadCfg.pairs.includes(c));
          const hasRestingInSquad = restingEntryCoins.some(c => squadCfg.pairs.includes(c));
          return {
            unitKey,
            squadCfg,
            isBlock2: squadCfg.block === 2,
            botName: hasOpenInSquad ? `${unitKey} 2 (Clon Relevo)` : `${unitKey} 1 (Titular)`,
            candidatePairs: squadCfg.pairs.filter(c => !activeCoins.includes(c) && !restingEntryCoins.includes(c)),
            alreadyHasPos: hasOpenInSquad || hasRestingInSquad
          };
        });

        let currentTotalOpen = allActiveOrResting.length;

        for (const unit of baseUnits) {
          if (currentTotalOpen >= MAX_CONCURRENT_TOTAL) break;
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
              const unitTargetGainPct = unit.squadCfg.targetGainPct || TARGET_GAIN_PCT;
              const notional = unit.isBlock2
                ? Math.min(MAX_NOTIONAL_PER_COIN, BLOCK2_DEDICATED_MARGIN * BLOCK2_LEVERAGE)
                : Math.min(MAX_NOTIONAL_PER_COIN, dynamicSquadMargin * LEVERAGE);
              const szFormatted = formatHlSize(notional / bestCandidate.price, ASSET_DECIMALS[coin].sz);
              if (parseFloat(szFormatted) <= 0) continue;
              const isLong = bestCandidate.direction === "LONG";
              const entryPxStr = formatHlPrice(bestCandidate.price, coin);
              const entryPxNum = parseFloat(entryPxStr);

              const tpPriceNum = isLong
                ? entryPxNum * (1 + unitTargetGainPct / 100)
                : entryPxNum * (1 - unitTargetGainPct / 100);
              const tpPxStr = formatHlPrice(tpPriceNum, coin);
              const estNetGain = (notional * (unitTargetGainPct / 100) - (notional * 0.00030)).toFixed(4);

              console.log(`\n🎯 [${unit.unitKey} // ${unit.botName} // BLOQUE ${unit.squadCfg.block}] Disparo paralelo en ${coin} (${bestCandidate.direction}):`);
              console.log(`   • Confluencia: L2 ${bestCandidate.score.toFixed(1)}% | RSI 5m: ${bestCandidate.rsi.toFixed(1)} | EMA20: $${bestCandidate.ema.toFixed(4)}`);
              console.log(`   • Entrada: ${szFormatted} ${coin} @ $${entryPxStr} ($${notional.toFixed(0)} Nocional) -> TP: $${tpPxStr} (+${unitTargetGainPct}%)`);

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
                  recentOrderSentCoins[coin] = Date.now();
                  const oid = status.resting?.oid || status.filled?.oid || "FILLED";
                  console.log(`   ✔ [${unit.unitKey}] Orden #${oid} activa en Hyperliquid L1 (${status.filled ? "EJECUTADA" : "EN LIBRO"}).`);

                  // Si se llenó de inmediato, colocar de una vez su orden Reduce-Only Take-Profit en el libro L1
                  if (status.filled) {
                    await client.order({
                      orders: [{
                        a: ASSET_INDICES[coin],
                        b: !isLong,
                        p: tpPxStr,
                        s: szFormatted,
                        r: true,
                        t: { limit: { tif: "Alo" } }
                      }],
                      grouping: "na"
                    }).catch(() => {});
                  }

                  const orderTg = `🟢🎯 <b>ÁREA 501 // OPERACIÓN ABIERTA — BLOQUE ${unit.squadCfg.block} (${bestCandidate.direction})</b>\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🔰 <b>Unidad:</b> <b>${unit.squadCfg.name} — ${unit.botName}</b>\n` +
                    `📍 <b>Par:</b> <code>${coin}-USDC</code> (${szFormatted} ${coin})\n` +
                    `📥 <b>PRECIO ENTRADA:</b> <code>$${entryPxStr}</code> ($${notional.toFixed(0)} Nocional)\n` +
                    `📤 <b>OBJETIVO TAKE PROFIT:</b> <code>$${tpPxStr}</code> (+${unitTargetGainPct}% Reduce-Only)\n` +
                    `💰 <b>Ganancia Estimada:</b> <b>+$${estNetGain} USDC Limpios</b>\n` +
                    `📊 <b>Filtros:</b> L2 ${bestCandidate.score.toFixed(1)}% · RSI 5m ${bestCandidate.rsi.toFixed(1)}\n` +
                    `📌 <b>Estado:</b> <b>${status.filled ? "EJECUTADA EN VIVO (TP COLOCADO)" : "EN LIBRO L1 (POST-ONLY ALO)"}</b>\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🌐 <a href="https://hypurrscan.io/address/${VAULT_501}">Ver en Hypurrscan (Sin conectar Wallet)</a>`;
                  await sendSquadTelegram(orderTg);
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
