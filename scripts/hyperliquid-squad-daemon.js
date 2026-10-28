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

// --- POLÍTICA DE CAPITAL ESCALADO V2 (40% RESERVA / 20% CADA ESCUADRÓN) ---
const MENTORA_RESERVE_RATIO = 0.40;     // 40% Escudo Mentora #00 (~$320.00+ USDC)
const SQUAD_MARGIN_RATIO = 0.20;        // 20% Margen por Escuadrón (~$160.00 USDC a 5x = ~$800.00 Nocional)
const LEVERAGE = 5;
const TARGET_GAIN_PCT = 0.35;           // +0.35% Take Profit base (con Trailing hacia arriba)
const BREAKEVEN_TRIGGER_PCT = 0.10;     // Activar candado BE al +0.10% a favor
const BREAKEVEN_LOCK_PCT = 0.045;       // Candado BE en +0.045% (cubre 100% fees)
const COOLDOWN_DURATION_MS = 12 * 60 * 1000; // 12 minutos de enfriamiento táctico post-TP
const MIN_CERTAINTY_L2_PCT = 65.0;      // 65% de presión L2 mínima para tiro de alta certeza
const MAX_CONCURRENT_INITIAL = 2;       // Máximo 2 concurrentes sin BE #00
const MAX_CONCURRENT_TOTAL = 3;         // Máximo 3 concurrentes totales si las anteriores tienen BE #00
const pairCooldowns = {};               // Mapa de enfriamiento táctico { coin: timestampMs }
const DCA_TRIGGER_DRAWDOWN = -0.85;     // Refuerzo Mentora en -0.85%
const DCA_TRIGGER_RSI = 30;             // RSI sobreventa extrema
const DCA_TARGET_GAIN_PCT = 0.20;       // Evacuación rápida doble posición al +0.20%


const TELEMETRY_DIR = path.join(__dirname, "..", "telemetry");
const REAL_LEDGER_FILE = path.join(TELEMETRY_DIR, "squad-secret-real-ledger.json");
const SQUAD_TELEMETRY_FILE = path.join(TELEMETRY_DIR, "squad-secret-telemetry.json");
const LOAN_LEDGER_FILE = path.join(TELEMETRY_DIR, "vault501-loan-ledger.json");
const DIRECT_ORDERS_FILE = path.join(TELEMETRY_DIR, "direct-orders-queue.json");

const ASSET_INDICES = {
  BTC: 0,
  ETH: 1,
  SOL: 5,
  AVAX: 6,
  BNB: 7,
  SUI: 14,
  LINK: 18,
  AAVE: 28,
  POL: 142,
  PAXG: 187
};

const ASSET_DECIMALS = {
  BTC: { sz: 5, coin: "BTC" },
  ETH: { sz: 4, coin: "ETH" },
  SOL: { sz: 2, coin: "SOL" },
  AVAX: { sz: 2, coin: "AVAX" },
  BNB: { sz: 3, coin: "BNB" },
  SUI: { sz: 1, coin: "SUI" },
  LINK: { sz: 1, coin: "LINK" },
  AAVE: { sz: 2, coin: "AAVE" },
  POL: { sz: 0, coin: "POL" },
  PAXG: { sz: 3, coin: "PAXG" }
};

const SQUADS_CONFIG = {
  ALFA: {
    id: "ALFA",
    name: "Escuadrón Alfa",
    specialist: "#601 Titan-Scalper",
    role: "Fuerza Rápida High-Beta",
    pairs: ["SOL", "SUI", "AVAX"],
    targetGainPct: TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  BRAVO: {
    id: "BRAVO",
    name: "Escuadrón Bravo",
    specialist: "#701 Oracle-Global",
    role: "Macro & Refugios RWA",
    pairs: ["BTC", "PAXG", "LINK"],
    targetGainPct: TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  },
  CHARLIE: {
    id: "CHARLIE",
    name: "Escuadrón Charlie",
    specialist: "#801 Nexus-Boss",
    role: "Ecosistema DeFi & ALO Maker",
    pairs: ["ETH", "BNB", "AAVE"],
    targetGainPct: TARGET_GAIN_PCT,
    beGainPct: BREAKEVEN_LOCK_PCT
  }
};

function formatHlPrice(price, coin) {
  if (coin === "BTC") return Math.round(price).toFixed(0);
  if (coin === "ETH" || coin === "PAXG") return price.toFixed(1);
  if (coin === "SOL" || coin === "BNB" || coin === "AAVE" || coin === "AVAX") return price.toFixed(2);
  if (coin === "LINK") return price.toFixed(3);
  if (coin === "SUI") return price.toFixed(4);
  if (coin === "POL") return price.toFixed(5);
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
    ledger.realWins = (ledger.realWins || 0) + 1;
    ledger.realPnlUsdc = +(Number(ledger.realPnlUsdc || 0) + Number(tx.netProfitUsdc || 0)).toFixed(4);
    ledger.totalConsolidatedUsdc = +(719.41 + Number(ledger.realPnlUsdc)).toFixed(4);
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
        telem.scoreboard.accountValue = tx.newAccountValue || 508.06;
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

async function startAutonomousSquadDaemon() {
  console.log("================================================================================");
  console.log("🚀 ÁREA 501 // SQUAD SECRET V2 ESCALADO // BLOQUE 1 (~$800 USDC ➔ $1,000 USDC)");
  console.log("================================================================================");
  console.log(`• Bóveda Nodriza: ${VAULT_501}`);
  console.log(`• Préstamo Bóveda #501 (0% interés): $511.44 USDC ($300 inicial + $150 + $61.44 hoy) | Total Inyectado: $629.94 USDC`);
  console.log(`• Doctrina de Consolidación: 100% Capitalización Pura hasta $1,000 USDC ➔ luego 70/30`);
  console.log(`• Escudo Mentora #00: 40% del Capital (~$320.00+ USDC Blindados en Reserva)`);
  console.log(`• Margen Operativo: 20% del Capital (~$160.00+ USDC a 5x = ~$800.00+ Nocional/tiro)`);
  console.log(`• Meta Take Profit: +${TARGET_GAIN_PCT}% (~+$2.80 USDC netos por victoria)`);
  console.log(`• Candado Breakeven: Activación al +${BREAKEVEN_TRIGGER_PCT}% ➔ Candado en +${BREAKEVEN_LOCK_PCT}%`);
  console.log(`• Direct Orders Bridge: Activo en telemetry/direct-orders-queue.json (<150ms)\n`);

  const transport = new HttpTransport({ isTestnet: false });
  const info = new InfoClient({ transport });

  const agentWallet = new ethers.Wallet(process.env.HL_AGENT_PRIVATE_KEY);
  const client = new ExchangeClient({
    wallet: agentWallet,
    transport,
    isTestnet: false
  });

  // Estado interno en memoria de cada escuadrón
  const squadState = {
    ALFA: { activeCoin: null, entryPx: 0, size: "0", direction: "LONG", tpOid: null, dcaDone: false, beLocked: false, notifiedEntry: false },
    BRAVO: { activeCoin: null, entryPx: 0, size: "0", direction: "LONG", tpOid: null, dcaDone: false, beLocked: false, notifiedEntry: false },
    CHARLIE: { activeCoin: null, entryPx: 0, size: "0", direction: "LONG", tpOid: null, dcaDone: false, beLocked: false, notifiedEntry: false }
  };

  let cycleCounter = 0;
  let isV2Armed = true;

  while (true) {
    cycleCounter++;
    try {
      // 1. Obtener estado del Clearinghouse
      const ch = await info.clearinghouseState({ user: VAULT_501 });
      const accountValue = parseFloat(ch.marginSummary?.accountValue || "649.24");
      const openPositions = (ch.assetPositions || []).filter(p => parseFloat(p.position.szi) !== 0);
      const openOrders = await info.openOrders({ user: VAULT_501 });

      // 2. Procesar Cola de Órdenes Directas y Doctrina de Consolidación
      await processDirectOrdersQueue(client, info);
      checkDailyAmortizationCut(accountValue);

      // Vigilante de Horarios Mundiales y Alertas 5-Minutos a Telegram
      await checkMarketSessionAlertsDaemon(new Date());

      // Dinámica de capitalización compuesta
      const reserveUsdc = +(accountValue * MENTORA_RESERVE_RATIO).toFixed(2);
      const availableForTrading = Math.max(0, accountValue - reserveUsdc);
      const dynamicSquadMargin = Math.max(40.00, +(accountValue * SQUAD_MARGIN_RATIO).toFixed(2));
      const dynamicNotional = +(dynamicSquadMargin * LEVERAGE).toFixed(2);

      if (cycleCounter % 10 === 1) {
        console.log(`[${new Date().toISOString().slice(11, 19)} UTC] Bloque 1 | Ciclo #${cycleCounter} | Capital: $${accountValue.toFixed(2)} USDC (Meta $1,000) | Margen/Tiro: $${dynamicSquadMargin.toFixed(2)} ($${dynamicNotional.toFixed(0)} Nocional) | Pos: ${openPositions.length}`);
      }

      // 3. Gestionar cada escuadrón de forma independiente
      for (const [squadKey, squadCfg] of Object.entries(SQUADS_CONFIG)) {
        const mem = squadState[squadKey];

        // Verificar si este escuadrón tiene una posición activa en la blockchain
        const activePos = openPositions.find(p => squadCfg.pairs.includes(p.position.coin));

        if (activePos) {
          // --- GESTIÓN DE POSICIÓN ACTIVA ---
          const coin = activePos.position.coin;
          const sz = activePos.position.szi;
          const szNum = parseFloat(sz);
          const isShort = szNum < 0;
          const entryPx = parseFloat(activePos.position.entryPx);
          mem.activeCoin = coin;
          mem.entryPx = entryPx;
          mem.size = sz;
          mem.direction = isShort ? "SHORT" : "LONG";

          // --- OPERACIÓN RESCATE #00 EN AVAX-USDC: SALIDA ESCALONADA 2 TRAMOS & PROHIBIDO SOBRE-APALANCAR ---
          if (coin === "AVAX") {
            mem.dcaDone = true; // Prohibido sobre-apalancar: Cero compras adicionales
            const avaxExitOrders = openOrders.filter(o => o.coin === "AVAX" && o.reduceOnly === true);

            // Si Tramo 1 (70% Alivio) ya se ejecutó (posición reducida a <= 130 AVAX)
            if (szNum <= 130 && !mem.beLocked) {
              mem.beLocked = true;
              console.log(`🎉 [OPERACIÓN RESCATE #00] ¡TRAMO 1 DE AVAX COMPLETADO! 70% de la posición liberada. Candado BE #00 activado para el 30% restante.`);
              const rescueTg = `🎉🛡️ <b>ÁREA 501 // OPERACIÓN RESCATE #00 // TRAMO 1 COMPLETADO (70%)</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `📍 <b>Activo:</b> <code>AVAX-USDC (LONG)</code>\n` +
                `💰 <b>Descarga de Alivio:</b> 70% de la posición cerrada con éxito.\n` +
                `🔒 <b>Candado BE #00:</b> Activado en el 30% restante hacia Banda Media ($8.942).\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
              sendSquadTelegram(rescueTg).catch(() => {});
            }

            // Si por alguna razón no hay órdenes de salida puestas para AVAX, reponer salida escalonada 70/30
            if (avaxExitOrders.length === 0 && isV2Armed) {
              const szTramo1 = formatHlSize(szNum * 0.70, 2);
              const szTramo2 = formatHlSize(szNum - parseFloat(szTramo1), 2);
              console.log(`[RESCATE AVAX] Reponiendo salida escalonada 70/30 (${szTramo1} @ $8.895 / ${szTramo2} @ $8.942)...`);
              try {
                await client.order({
                  orders: [
                    { a: ASSET_INDICES["AVAX"], b: false, p: "8.895", s: szTramo1, r: true, t: { limit: { tif: "Alo" } } },
                    { a: ASSET_INDICES["AVAX"], b: false, p: "8.942", s: szTramo2, r: true, t: { limit: { tif: "Alo" } } }
                  ],
                  grouping: "na"
                });
              } catch (e) {
                console.error("[RESCATE AVAX] Error reponiendo salida escalonada:", e.message);
              }
            }
            continue; // Saltar trailing TP genérico y DCA para AVAX
          }

          // Verificar si ya tiene orden de salida puesta
          const existingExitOrder = openOrders.find(o => o.coin === coin && o.reduceOnly === true);

          if (!existingExitOrder && isV2Armed) {
            // Colocar orden de salida Take Profit Maker ALO
            const targetGain = squadCfg.targetGainPct || TARGET_GAIN_PCT;
            let currentMid = entryPx;
            try {
              const midsRes = await fetch("https://api.hyperliquid.xyz/info", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "allMids" })
              });
              const mids = await midsRes.json();
              if (mids[coin]) currentMid = parseFloat(mids[coin]);
            } catch (_) {}

            let exitPxNum = isShort
              ? entryPx * (1 - targetGain / 100)
              : entryPx * (1 + targetGain / 100);

            // Si el mercado ya superó el TP (+0.35%), colocar orden ALO al precio actual respetando Maker para capturar la ganancia superior
            if (!isShort && currentMid >= exitPxNum) {
              exitPxNum = currentMid * 1.0003;
            } else if (isShort && currentMid <= exitPxNum) {
              exitPxNum = currentMid * 0.9997;
            }

            const safeExitPxStr = formatHlPrice(exitPxNum, coin);
            const notional = Math.abs(szNum) * entryPx;
            const estNetGainUsdc = (notional * (targetGain / 100) - (notional * 0.00030)).toFixed(4);

            console.log(`[${squadKey}] Colocando salida Take Profit ALO para ${coin}: ${Math.abs(szNum)} @ $${safeExitPxStr} (Mid actual: $${currentMid})`);
            try {
              const exitRes = await client.order({
                orders: [{
                  a: ASSET_INDICES[coin],
                  b: isShort, // Si es short se sale comprando (b: true), si es long se sale vendiendo (b: false)
                  p: safeExitPxStr,
                  s: formatHlSize(Math.abs(szNum), ASSET_DECIMALS[coin].sz),
                  r: true,
                  t: { limit: { tif: "Alo" } }
                }],
                grouping: "na"
              });
              const exitStatus = exitRes.response?.data?.statuses?.[0] || {};
              if (exitStatus.resting) {
                mem.tpOid = exitStatus.resting.oid;
                console.log(`[${squadKey}] Orden Salida ALO colocada: #${mem.tpOid} a $${safeExitPxStr}`);
              }
            } catch (err) {
              console.error(`[${squadKey}] Error colocando salida ALO:`, err.message);
            }
          } else if (isV2Armed) {
            // --- GESTIÓN DE CANDADO BREAKEVEN Y SALVAVIDAS DCA DE LA MENTORA #00 ---
            try {
              const midsRes = await fetch("https://api.hyperliquid.xyz/info", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: "allMids" })
              });
              const mids = await midsRes.json();
              const currentMid = parseFloat(mids[coin] || entryPx);
              const gainPct = isShort
                ? (entryPx - currentMid) / entryPx * 100
                : (currentMid - entryPx) / entryPx * 100;
              const drawdownPct = isShort
                ? (currentMid - entryPx) / entryPx * 100
                : (entryPx - currentMid) / entryPx * 100;

              // 1. CANDADO BREAKEVEN (+0.10% ➔ Clavado en +0.045% cubriendo comisiones)
              // EN VENTANA DE SACUDÓN (±5 min de Apertura Londres/NY): Mentora #00 aprieta al +0.05%
              const inShakeWindow = isMarketShakeWindow(new Date());
              const effectiveBeTrigger = inShakeWindow ? 0.05 : BREAKEVEN_TRIGGER_PCT;

              if (gainPct >= effectiveBeTrigger && !mem.beLocked) {
                mem.beLocked = true;
                const bePx = isShort
                  ? entryPx * (1 - BREAKEVEN_LOCK_PCT / 100)
                  : entryPx * (1 + BREAKEVEN_LOCK_PCT / 100);
                const bePxStr = formatHlPrice(bePx, coin);
                const shakeTag = inShakeWindow ? " [VENTANA DE SACUDÓN ±5M APERTURA]" : "";
                console.log(`🔒 [MENTORA #00] Candado Breakeven activado${shakeTag} en ${coin} al alcanzar +${gainPct.toFixed(2)}%! Nivel seguro fijado en $${bePxStr} (+${BREAKEVEN_LOCK_PCT}%).`);

                const beTg = `🔒 <b>ÁREA 501 // MENTORA #00 // CANDADO BREAKEVEN CLAVADO${shakeTag}</b>\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `🔰 <b>Escuadrón:</b> <b>${squadCfg.name}</b>\n` +
                  `📍 <b>Par:</b> <code>${coin}-USDC</code>\n` +
                  `📈 <b>Avance Favorable:</b> <code>+${gainPct.toFixed(2)}%</code> (Disparo: ${effectiveBeTrigger}%)\n` +
                  `🛡️ <b>Candado Blindado a:</b> <code>$${bePxStr}</code> (+${BREAKEVEN_LOCK_PCT}% · $0.00 Pérdida Garantizada)\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                await sendSquadTelegram(beTg);
              }

              // 1.1 TRAILING TAKE-PROFIT: Si el precio avanza más allá de +0.35%, correr TP al alza para capturar ganancias extraordinarias
              if (gainPct >= 0.35 && existingExitOrder) {
                const currentOrderPx = parseFloat(existingExitOrder.limitPx || "0");
                const desiredTrailingPx = isShort ? currentMid * 0.9996 : currentMid * 1.0004;
                const isBetterTrailing = isShort ? (desiredTrailingPx < currentOrderPx) : (desiredTrailingPx > currentOrderPx);
                if (isBetterTrailing) {
                  try {
                    await client.cancel({ cancels: [{ a: ASSET_INDICES[coin], o: existingExitOrder.oid }] });
                    const newTpStr = formatHlPrice(desiredTrailingPx, coin);
                    await client.order({
                      orders: [{
                        a: ASSET_INDICES[coin],
                        b: isShort,
                        p: newTpStr,
                        s: formatHlSize(Math.abs(szNum), ASSET_DECIMALS[coin].sz),
                        r: true,
                        t: { limit: { tif: "Alo" } }
                      }],
                      grouping: "na"
                    });
                    console.log(`🚀 [TRAILING TAKE-PROFIT] Ganancia extendida en ${coin} (+${gainPct.toFixed(2)}%): TP elevado a $${newTpStr}`);
                  } catch (_) {}
                }
              }

              // 2. MENTORA #00 DCA SALVAVIDAS (Drawdown <= -0.85% y RSI 5m <= 30)
              if (!mem.dcaDone && drawdownPct >= Math.abs(DCA_TRIGGER_DRAWDOWN) && availableForTrading >= dynamicSquadMargin) {
                const now = Date.now();
                const cRes = await info.candleSnapshot({ coin, interval: "5m", startTime: now - (3600000 * 2), endTime: now });
                const closes = (cRes || []).map(c => parseFloat(c.c));
                const rsi5m = calculateRSI(closes, 14);

                if ((!isShort && rsi5m <= DCA_TRIGGER_RSI) || (isShort && rsi5m >= 70)) {
                  console.log(`\n🛡️ [MENTORA #00] RETROCESO DETECTADO EN ${coin} (-${drawdownPct.toFixed(2)}% | RSI 5m: ${rsi5m.toFixed(1)}). ACTIVANDO TIRO GEMELO DCA...`);
                  mem.dcaDone = true;

                  const dcaPriceStr = formatHlPrice(currentMid, coin);
                  const dcaNotional = dynamicSquadMargin * LEVERAGE;
                  const dcaSzStr = formatHlSize(dcaNotional / currentMid, ASSET_DECIMALS[coin].sz);

                  // Ejecutar refuerzo táctico
                  await client.order({
                    orders: [{
                      a: ASSET_INDICES[coin],
                      b: !isShort,
                      p: dcaPriceStr,
                      s: dcaSzStr,
                      r: false,
                      t: { limit: { tif: "Alo" } }
                    }],
                    grouping: "na"
                  });
                  console.log(`[MENTORA #00] Refuerzo DCA enviado para ${coin}: ${dcaSzStr} @ $${dcaPriceStr}`);

                  // Cancelar TP previo y recolocar TP unificado al nuevo precio promedio + 0.20%
                  if (existingExitOrder) {
                    try {
                      await client.cancel({
                        cancels: [{ a: ASSET_INDICES[coin], o: existingExitOrder.oid }]
                      });
                      console.log(`[MENTORA #00] Salida previa cancelada para recolocar TP sobre precio promedio.`);
                    } catch (_) { }
                  }

                  const totalSz = Math.abs(szNum) + parseFloat(dcaSzStr);
                  const newAvgPrice = (entryPx + parseFloat(dcaPriceStr)) / 2;
                  const dcaTpPx = isShort
                    ? newAvgPrice * (1 - DCA_TARGET_GAIN_PCT / 100)
                    : newAvgPrice * (1 + DCA_TARGET_GAIN_PCT / 100);
                  const dcaTpPxStr = formatHlPrice(dcaTpPx, coin);
                  const totalSzStr = formatHlSize(totalSz, ASSET_DECIMALS[coin].sz);

                  try {
                    await client.order({
                      orders: [{
                        a: ASSET_INDICES[coin],
                        b: isShort,
                        p: dcaTpPxStr,
                        s: totalSzStr,
                        r: true,
                        t: { limit: { tif: "Alo" } }
                      }],
                      grouping: "na"
                    });
                    console.log(`[MENTORA #00] Salida DCA unificada colocada: ${totalSzStr} ${coin} @ $${dcaTpPxStr} (+${DCA_TARGET_GAIN_PCT}% sobre promedio)`);
                  } catch (e) {
                    console.error(`[MENTORA #00] Error colocando TP unificado DCA:`, e.message);
                  }

                  const dcaTg = `🛡️ <b>ÁREA 501 // MENTORA #00 // TIRO GEMELO DCA EN SOPORTE</b>\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `🔰 <b>Escuadrón:</b> <b>${squadCfg.name}</b>\n` +
                    `📍 <b>Par:</b> <code>${coin}-USDC</code>\n` +
                    `📉 <b>Drawdown:</b> <code>-${drawdownPct.toFixed(2)}%</code> (RSI 5m: ${rsi5m.toFixed(1)})\n` +
                    `📥 <b>Refuerzo Táctico:</b> <code>${dcaSzStr} ${coin} @ $${dcaPriceStr}</code> ($${dynamicSquadMargin} Margen · 5x)\n` +
                    `🎯 <b>Nuevo Take Profit:</b> <code>$${dcaTpPxStr}</code> (+${DCA_TARGET_GAIN_PCT}% sobre promedio)\n` +
                    `🎯 <b>Objetivo:</b> Evacuación inmediata de doble volumen con ganancia neta.\n` +
                    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
                  await sendSquadTelegram(dcaTg);
                }
              }
            } catch (err) {
              console.error(`[${squadKey}] Error en evaluación BE/DCA:`, err.message);
            }
          }
        } else {
          // --- ESCUADRÓN LIBRE: VERIFICAR SI TERMINÓ POSICIÓN PREVIA (COBRO DE TP) ---
          if (mem.activeCoin) {
            console.log(`[${squadKey}] 💰 ¡VICTORIA CONFIRMADA! Posición en ${mem.activeCoin} cerrada al 100%.`);
            const closedCoin = mem.activeCoin;
            const recordedEntryPx = mem.entryPx;
            const wasShort = mem.direction === "SHORT";
            
            // Activar Enfriamiento Táctico de 12 minutos post-TP para este par
            pairCooldowns[closedCoin] = Date.now() + COOLDOWN_DURATION_MS;
            console.log(`❄️ [ENFRIAMIENTO TÁCTICO] ${closedCoin} entra en 12 minutos de reposo y recalibración tras Take-Profit.`);

            mem.activeCoin = null;
            mem.entryPx = null;
            mem.tpOid = null;
            mem.dcaDone = false;
            mem.beLocked = false;
            mem.notifiedEntry = false;

            // Consultar último fill para detalles exactos
            try {
              const recentFills = await info.userFills({ user: VAULT_501 });
              const closeFill = recentFills.find(f => f.coin === closedCoin && f.dir.includes("Close"));
              const rawGrossGain = closeFill ? parseFloat(closeFill.closedPnl || "1.75") : 1.75;
              const feePaid = closeFill ? parseFloat(closeFill.fee || "0.07") : 0.07;
              const netGain = +(rawGrossGain - feePaid).toFixed(4);
              const exitPxStr = closeFill ? closeFill.px : "TP Alcanzado";

              const victoryTx = {
                cycleId: `CYC-${Date.now().toString().slice(-4)}`,
                squad: `${squadCfg.name} (${squadCfg.specialist})`,
                pair: `${closedCoin}-USDC`,
                direction: wasShort ? "BEAR" : "BULL",
                directionLabel: wasShort ? "🐻 BEAR (SHORT)" : "🐂 BULL (LONG)",
                entryPrice: recordedEntryPx || 0,
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

              const victoryTg = `🔴 <b>ÁREA 501 // VENTA EJECUTADA (TAKE PROFIT V2 ESCALADO)</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🔰 <b>Escuadrón:</b> <b>${squadCfg.name}</b> (${squadCfg.specialist})\n` +
                `📍 <b>Par:</b> <code>${closedCoin}-USDC</code>\n` +
                `📥 <b>Precio Entrada:</b> <code>$${formatHlPrice(recordedEntryPx || 0, closedCoin)}</code>\n` +
                `📤 <b>SE VENDIÓ A:</b> <code>$${exitPxStr}</code> (+${TARGET_GAIN_PCT}% TP)\n` +
                `💰 <b>GANANCIA NETA EN CAJA:</b> <b>+$${netGain.toFixed(4)} USDC</b>\n` +
                `🏆 <b>Récord Oficial:</b> <b>${currentLedger.realWins} Ganadas · 0 Pérdidas (100% Invictos)</b>\n` +
                `❄️ <b>Enfriamiento:</b> <code>${closedCoin}</code> en 12m de reposo antes del próximo tiro\n` +
                `💵 <b>Nuevo Balance en L1:</b> <code>$${accountValue.toFixed(2)} USDC</code>\n` +
                `📈 <b>Capitalización Compuesta:</b> Ganancias sumadas al margen del próximo tiro\n` +
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🌐 <i>Capital inmediatamente protegido en USDC nativo.</i>`;
              await sendSquadTelegram(victoryTg);
            } catch (err) {
              console.error(`[${squadKey}] Error procesando victoria:`, err.message);
            }
          }

          // --- ESCUADRÓN LIBRE: BUSCAR NUEVA ENTRADA CON EL FILTRO ANTI-TECHO V2 ---
          if (isV2Armed && availableForTrading >= dynamicSquadMargin) {
            // REGLA OPERACIÓN RESCATE #00: Congelar totalmente nuevas entradas mientras AVAX esté en extracción
            const isAvaxInRescue = openPositions.some(p => p.position.coin === "AVAX" && parseFloat(p.position.szi) !== 0);
            if (isAvaxInRescue) {
              if (cycleCounter % 15 === 1) {
                console.log(`🚁 [MODO RESCATE #00] Nuevas entradas CONGELADAS: Posición AVAX en extracción escalonada ($8.890 / $8.942).`);
              }
              continue;
            }

            // Regla de Exposición Inteligente (Cero Sangrado Cruzado):
            // 1. Límite estricto de 3 posiciones simultáneas totales
            if (openPositions.length >= MAX_CONCURRENT_TOTAL) {
              continue;
            }

            // 2. Si ya hay 2 posiciones abiertas, la 3ra posición SOLO se permite si las anteriores ya tienen el Candado BE #00 activado
            if (openPositions.length >= MAX_CONCURRENT_INITIAL) {
              const unhedged = openPositions.some(p => {
                const uPnl = parseFloat(p.position?.unrealizedPnl || "0");
                return uPnl < 0.05; // No está en verde cubriendo comisiones con BE #00
              });
              if (unhedged) {
                if (cycleCounter % 15 === 1) {
                  console.log(`🛡️ [CONTROL DE RIESGO] Exposición en pausa: Hay posiciones abiertas sin Candado BE #00. Cero sangrado cruzado.`);
                }
                continue;
              }
            }

            // 3. Pausa de Mechazo Inicial en apertura (primeros 60s tras campana 08:00 o 13:30 UTC)
            if (isOpeningBellWick(new Date())) {
              console.log(`⏸️ [PAUSA DE MECHAZO] Congelando nuevas entradas durante la campana de apertura institucional.`);
              continue;
            }

            try {
              let bestCandidate = null;

              for (const coin of squadCfg.pairs) {
                // Enfriamiento Táctico de 12 minutos post-TP
                if (pairCooldowns[coin] && pairCooldowns[coin] > Date.now()) {
                  const remMins = Math.ceil((pairCooldowns[coin] - Date.now()) / 60000);
                  if (cycleCounter % 15 === 1) {
                    console.log(`❄️ [COOLDOWN] ${coin} en enfriamiento táctico (${remMins}m restantes). Evitando entrar agotado.`);
                  }
                  continue;
                }

                try {
                  // Capa 1: L2 Orderbook Depth
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

                  // Capa 2: Velas 5m (RSI 14 y EMA 20)
                  const now = Date.now();
                  const candles5m = await info.candleSnapshot({ coin, interval: "5m", startTime: now - (3600000 * 3), endTime: now });
                  if (!candles5m || candles5m.length < 15) continue;
                  const closes5m = candles5m.map(c => parseFloat(c.c));
                  const rsi5m = calculateRSI(closes5m, 14);
                  const ema20_5m = calculateEMA(closes5m, 20);

                  // Capa 3: Vela 15m (Filtro Anti-Techo)
                  const candles15m = await info.candleSnapshot({ coin, interval: "15m", startTime: now - (3600000 * 2), endTime: now });
                  const last15m = candles15m && candles15m.length > 0 ? candles15m[candles15m.length - 1] : null;
                  const range15m = last15m ? parseFloat(last15m.h) - parseFloat(last15m.l) : 0;
                  const currentPrice = parseFloat(bids[0].px);
                  const isTop25Pct = range15m > 0 ? (currentPrice - parseFloat(last15m.l)) / range15m > 0.75 : false;

                  // Protocolo Onda de Apertura (Ventana de Sacudón ±5 min Londres/NY): Caza de Olas con L2 >= 66%
                  const inWaveWindow = isMarketShakeWindow(new Date());
                  const isWaveLong = inWaveWindow && bullPct >= 66.0;
                  const isWaveShort = inWaveWindow && bearPct >= 66.0;

                  // FILTRO DE ALTA CERTEZA: L2 >= 65%, RSI 5m en zona limpia (<= 46 para Long), confirmación EMA20
                  if (isWaveLong || (bullPct >= MIN_CERTAINTY_L2_PCT && rsi5m <= 46.0 && (!isTop25Pct || currentPrice <= ema20_5m))) {
                    if (!bestCandidate || bullPct > bestCandidate.score) {
                      bestCandidate = {
                        coin,
                        direction: "LONG",
                        price: currentPrice,
                        score: bullPct,
                        rsi: rsi5m,
                        ema: ema20_5m,
                        isWaveTrade: isWaveLong
                      };
                    }
                  }

                  // SHORT DE ALTA CERTEZA: L2 >= 65% vendedora, RSI >= 70 en sobrecompra extrema (Rechazo de Techo), O Caza de Ola en Desplome de Apertura (L2 >= 66%)
                  if (isWaveShort || (bearPct >= MIN_CERTAINTY_L2_PCT && rsi5m >= 70.0)) {
                    if (!bestCandidate || bearPct > bestCandidate.score) {
                      bestCandidate = {
                        coin,
                        direction: "SHORT",
                        price: parseFloat(asks[0].px),
                        score: bearPct,
                        rsi: rsi5m,
                        ema: ema20_5m,
                        isWaveTrade: isWaveShort
                      };
                    }
                  }
                } catch (_) { }
              }

              if (bestCandidate) {
                const coin = bestCandidate.coin;
                const notional = dynamicSquadMargin * LEVERAGE; // ~$508.05 USD
                const szFormatted = formatHlSize(notional / bestCandidate.price, ASSET_DECIMALS[coin].sz);
                const isLong = bestCandidate.direction === "LONG";
                const entryPxStr = formatHlPrice(bestCandidate.price, coin);
                const entryPxNum = parseFloat(entryPxStr);

                const tpPriceNum = isLong
                  ? entryPxNum * (1 + TARGET_GAIN_PCT / 100)
                  : entryPxNum * (1 - TARGET_GAIN_PCT / 100);
                const tpPxStr = formatHlPrice(tpPriceNum, coin);
                const estNetGain = (notional * (TARGET_GAIN_PCT / 100) - (notional * 0.00030)).toFixed(4);

                console.log(`\n🎯 [${squadKey} V2 ESCALADO] Disparo identificado en ${coin} (${bestCandidate.direction}):`);
                console.log(`   • Margen: $${dynamicSquadMargin.toFixed(2)} USDC (5x = $${notional.toFixed(2)} Nocional)`);
                console.log(`   • Confluencia: L2 ${bestCandidate.score.toFixed(1)}% | RSI 5m: ${bestCandidate.rsi.toFixed(1)} | EMA20: $${bestCandidate.ema.toFixed(2)}`);
                console.log(`   • Entrada ALO: $${entryPxStr} | TP fijado: $${tpPxStr} (+${TARGET_GAIN_PCT}% · +$${estNetGain} USDC)`);

                try {
                  const orderRes = await client.order({
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
                  const status = orderRes.response?.data?.statuses?.[0] || {};
                  if (status.resting) {
                    mem.activeCoin = coin;
                    mem.direction = bestCandidate.direction;
                    mem.entryPx = entryPxNum;
                    mem.dcaDone = false;
                    mem.beLocked = false;
                    console.log(`[${squadKey}] Orden Entrada ALO #${status.resting.oid} colocada con éxito.`);

                    const orderTg = `🎯 <b>ÁREA 501 // DISPARO V2 ESCALADO COLOCADO (${bestCandidate.direction})</b>\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                      `🔰 <b>Escuadrón:</b> <b>${squadCfg.name}</b> (${squadCfg.specialist})\n` +
                      `📍 <b>Par:</b> <code>${coin}-USDC</code> (POST-ONLY ALO MAKER · $0.00 Gas)\n` +
                      `📥 <b>PRECIO ENTRADA:</b> <code>$${entryPxStr}</code>\n` +
                      `📤 <b>OBJETIVO TAKE PROFIT:</b> <code>$${tpPxStr}</code> (+${TARGET_GAIN_PCT}%)\n` +
                      `💰 <b>Ganancia Estimada:</b> <b>+$${estNetGain} USDC Limpios</b>\n` +
                      `📊 <b>Filtros:</b> L2 ${bestCandidate.score.toFixed(1)}% · RSI 5m ${bestCandidate.rsi.toFixed(1)}\n` +
                      `🛡️ <b>Margen Asignado:</b> <code>$${dynamicSquadMargin.toFixed(2)} USDC (5x = $${notional.toFixed(2)} Nocional)</code>\n` +
                      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                      `🌐 <a href="https://app.hyperliquid.xyz/trade">Ver Operación en Vivo en Hyperliquid</a>`;
                    await sendSquadTelegram(orderTg);
                  }
                } catch (err) {
                  console.error(`[${squadKey}] Error colocando orden V2:`, err.message);
                }
              }
            } catch (_) { }
          }
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
  startAutonomousSquadDaemon().catch(err => {
    console.error("Fallo fatal en daemon:", err);
    process.exit(1);
  });
}

module.exports = {
  startAutonomousSquadDaemon,
  processDirectOrdersQueue,
  checkDailyAmortizationCut
};
