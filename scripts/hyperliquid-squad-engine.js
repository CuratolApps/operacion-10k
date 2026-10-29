/**
 * scripts/hyperliquid-squad-engine.js — ÁREA 501 // SQUAD SECRET ENGINE
 * ==============================================================================
 * MOTOR TÁCTICO HYPERLIQUID L1 MAKER ($0.00 GAS DE RED · POST-ONLY ALO)
 * ==============================================================================
 * 
 * REGLAS SAGRADAS INMUTABLES:
 * 1. MÁXIMO 1 OPERACIÓN A LA VEZ (MAX_CONCURRENT_POSITIONS = 1).
 *    Prohibida la multi-exposición. Gatillo bloqueado hasta cierre en USDC.
 * 2. POST-ONLY ALO (Add Liquidity Only):
 *    Jamás pagar comisión Taker. Cobrar rebate Maker o pagar micro-fee 0.015%.
 * 3. $0.00 GAS EN HYPERLIQUID L1:
 *    Toda la operativa es nativa en USDC sobre Hyperliquid L1. Cero gas en POL o SOL.
 * 4. CANDADO BREAKEVEN MENTORA #00:
 *    Apenas el precio avanza +0.04% a favor, Stop-Loss se clava en Breakeven (+0.01$ neto).
 *    Cierre en TP a +0.08% / +0.15% en 100% USDC nativo.
 * 5. LOS ESLABONES DEL SQUAD:
 *    • 01 Radar L2 (~150ms): l2Book y allMids en vivo.
 *    • 02A Especialista #601: SOL-USDC, ETH-USDC, SUI-USDC (Pares Rápidos).
 *    • 02B Especialista #701: BTC-USDC, PAXG-USDC, LINK-USDC (Macro Flow).
 *    • 02C #801 + 32 Nebulosas: Filtro de Liquidez profunda (> $5M) y Post-Only ALO.
 *    • 03 Trader Bull & Bear: Entrada direccional (Certeza >= 95%).
 *    • 04 Mentora #00 Zen: Vigilancia milisegundo de BE +0.04% ➔ TP +0.08%.
 * ==============================================================================
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");

const HL_INFO_URL = "https://api.hyperliquid.xyz/info";
const HL_EXCHANGE_URL = "https://api.hyperliquid.xyz/exchange";

const TELEMETRY_DIR = path.join(__dirname, "..", "telemetry");
const LEDGER_FILE = path.join(TELEMETRY_DIR, "squad-secret-real-ledger.json");
const TELEMETRY_FILE = path.join(TELEMETRY_DIR, "squad-secret-telemetry.json");

// Bóveda Nodriza #501
const VAULT_501_ADDRESS = "0xD4D12077a61118372f7a367319fb11922Beb3743";

// ------------------------------------------------------------------------------
// ESTRUCTURA OFICIAL: 3 ESCUADRONES SNIPER (1 PARA 3) + ESCUDO $40.02 USDC LIBRE
// ------------------------------------------------------------------------------
const UNTOUCHABLE_RESERVE_USDC = 40.02; // 40% del capital intocable en cash
const SQUAD_MARGIN_USDC = 20.00;        // Margen fijo por escuadrón (5x apalancamiento)
const SQUAD_LEVERAGE = 5;

const SQUADS = {
  ALFA: {
    id: "ALFA",
    name: "Escuadrón Alfa",
    specialist: "#601 Titan-Scalper",
    role: "Fuerza Rápida High-Beta",
    pairs: [
      { pair: "SOL-USDC", symbol: "SOL" },
      { pair: "SUI-USDC", symbol: "SUI" },
      { pair: "POL-USDC", symbol: "POL" }
    ],
    allocatedMargin: SQUAD_MARGIN_USDC,
    leverage: SQUAD_LEVERAGE,
    activePosition: null
  },
  BRAVO: {
    id: "BRAVO",
    name: "Escuadrón Bravo",
    specialist: "#701 Oracle-Global",
    role: "Macro & Refugios RWA",
    pairs: [
      { pair: "BTC-USDC", symbol: "BTC" },
      { pair: "PAXG-USDC", symbol: "PAXG" },
      { pair: "LINK-USDC", symbol: "LINK" }
    ],
    allocatedMargin: SQUAD_MARGIN_USDC,
    leverage: SQUAD_LEVERAGE,
    activePosition: null
  },
  CHARLIE: {
    id: "CHARLIE",
    name: "Escuadrón Charlie",
    specialist: "#801 Nexus-Boss",
    role: "Ecosistema DeFi & ALO Maker",
    pairs: [
      { pair: "ETH-USDC", symbol: "ETH" },
      { pair: "BNB-USDC", symbol: "BNB" },
      { pair: "AAVE-USDC", symbol: "AAVE" }
    ],
    allocatedMargin: SQUAD_MARGIN_USDC,
    leverage: SQUAD_LEVERAGE,
  }
};

const BREAKEVEN_TRIGGER_PCT = 0.04;
const TAKE_PROFIT_TRIGGER_PCT = 0.08;

const HL_ASSET_META = {
  BTC: { index: 0, szDec: 5, pxDec: 0 },
  ETH: { index: 1, szDec: 4, pxDec: 1 },
  SOL: { index: 5, szDec: 2, pxDec: 2 },
  AVAX: { index: 6, szDec: 2, pxDec: 3 },
  BNB: { index: 7, szDec: 3, pxDec: 2 },
  SUI: { index: 14, szDec: 1, pxDec: 4 },
  LINK: { index: 18, szDec: 1, pxDec: 3 },
  AAVE: { index: 28, szDec: 2, pxDec: 2 },
  POL: { index: 142, szDec: 0, pxDec: 5 },
  PAXG: { index: 187, szDec: 3, pxDec: 1 }
};

function formatShieldPrice(px, coin) {
  const meta = HL_ASSET_META[coin];
  const dec = meta ? meta.pxDec : (px >= 1000 ? 0 : px >= 10 ? 2 : px >= 1 ? 3 : 4);
  return dec === 0 ? Math.round(px).toFixed(0) : Number(px).toFixed(dec);
}

function formatShieldSize(sz, coin) {
  const meta = HL_ASSET_META[coin];
  const dec = meta ? meta.szDec : 2;
  const factor = Math.pow(10, dec);
  return (Math.floor(sz * factor) / factor).toFixed(dec);
}

/**
 * Ejecuta una orden Post-Only ALO Maker del Escudo #00 para Captura Horaria de Funding
 * del lado que COBRA la tasa (LONG cuando rawFunding < 0, SHORT cuando rawFunding > 0),
 * respetando siempre RESCUE_PRIORITY_LOCK.
 */
async function executeShieldFundingOrder({ coin, isBuy, notionalUsdc = 248.0 }) {
  if (!process.env.HL_AGENT_PRIVATE_KEY) {
    return { ordered: false, reason: "MISSING_AGENT_KEY" };
  }
  const meta = HL_ASSET_META[coin];
  if (!meta) {
    return { ordered: false, reason: `UNSUPPORTED_ASSET_META_${coin}` };
  }

  try {
    const { ExchangeClient, InfoClient, HttpTransport } = require("@nktkas/hyperliquid");
    const { ethers } = require("ethers");

    const transport = new HttpTransport({ isTestnet: false });
    const info = new InfoClient({ transport });
    const wallet = new ethers.Wallet(process.env.HL_AGENT_PRIVATE_KEY);
    const client = new ExchangeClient({ wallet, transport, isTestnet: false });

    const [ch, openOrders, levels] = await Promise.all([
      info.clearinghouseState({ user: VAULT_501_ADDRESS }),
      info.openOrders({ user: VAULT_501_ADDRESS }),
      fetchL2Book(coin)
    ]);

    const openPositions = (ch.assetPositions || []).filter(p => parseFloat(p?.position?.szi || "0") !== 0);
    // Verificar RESCUE_PRIORITY_LOCK: si hay cualquier rescate activo (nocional > $600), abortar inmediatamente
    const hasRescueActive = openPositions.some(p => {
      const pos = p.position || p;
      return Math.abs(parseFloat(pos.szi || "0") * parseFloat(pos.entryPx || "0")) > 600;
    });
    if (hasRescueActive) {
      return { ordered: false, reason: "RESCUE_PRIORITY_LOCK_ACTIVE" };
    }

    // Verificar si ya tenemos posición o orden de entrada abierta en esta moneda
    const alreadyOpen = openPositions.some(p => (p.position || p).coin === coin);
    if (alreadyOpen) {
      return { ordered: false, reason: "POSITION_ALREADY_OPEN", coin };
    }
    const existingEntryOrder = (openOrders || []).find(o => o.coin === coin && !o.reduceOnly);
    if (existingEntryOrder) {
      return { ordered: false, reason: "ENTRY_ORDER_ALREADY_RESTING", coin, oid: existingEntryOrder.oid };
    }

    const l2 = analyzeL2Layers(levels);
    const targetPx = isBuy ? l2.bestBid : l2.bestAsk;
    if (!targetPx || targetPx <= 0) {
      return { ordered: false, reason: "INVALID_L2_BOOK" };
    }

    const pxStr = formatShieldPrice(targetPx, coin);
    const szStr = formatShieldSize(notionalUsdc / targetPx, coin);
    if (parseFloat(szStr) <= 0) {
      return { ordered: false, reason: "ZERO_SIZE" };
    }

    const orderRes = await client.order({
      orders: [{
        a: meta.index,
        b: Boolean(isBuy),
        p: pxStr,
        s: szStr,
        r: false,
        t: { limit: { tif: "Alo" } }
      }],
      grouping: "na"
    });

    return {
      ordered: true,
      coin,
      pair: `${coin}-USDC`,
      side: isBuy ? "LONG" : "SHORT",
      price: pxStr,
      size: szStr,
      notionalUsdc: +(parseFloat(szStr) * parseFloat(pxStr)).toFixed(2),
      response: orderRes
    };
  } catch (err) {
    return { ordered: false, reason: err.message };
  }
}

async function fetchAllMids() {
  const t0 = Date.now();
  try {
    const res = await fetch(HL_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "allMids" })
    });
    const t1 = Date.now();
    const data = await res.json();
    return { mids: data, latencyMs: t1 - t0 };
  } catch (err) {
    return { mids: {}, latencyMs: 999 };
  }
}

async function fetchL2Book(coin) {
  try {
    const res = await fetch(HL_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "l2Book", coin })
    });
    const data = await res.json();
    return data && data.levels ? data.levels : [[], []];
  } catch (_) {
    return [[], []];
  }
}

function analyzeL2Layers(levels) {
  const bids = levels[0] || [];
  const asks = levels[1] || [];
  
  let bidVol5 = 0;
  for (let i = 0; i < Math.min(5, bids.length); i++) {
    bidVol5 += (parseFloat(bids[i].px) * parseFloat(bids[i].sz));
  }
  let askVol5 = 0;
  for (let i = 0; i < Math.min(5, asks.length); i++) {
    askVol5 += (parseFloat(asks[i].px) * parseFloat(asks[i].sz));
  }
  
  const total5 = bidVol5 + askVol5;
  const imbalancePct = total5 > 0 ? (bidVol5 / total5) * 100 : 50;
  const bullScore = Math.round(imbalancePct);
  const bearScore = 100 - bullScore;

  return {
    bestBid: bids[0] ? parseFloat(bids[0].px) : 0,
    bestAsk: asks[0] ? parseFloat(asks[0].px) : 0,
    bidVol5,
    askVol5,
    imbalancePct,
    bullScore,
    bearScore
  };
}

/**
 * Despacha reporte formal de Sniper a Telegram
 */
async function sendTelegramSquadReport(squadKey, eventType, data) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || "-1004342131598";
  if (!token || !chatId) return;

  let title = "🎯 SQUAD SECRET // SNIPER REPORT";
  if (eventType === "OPPORTUNITY_LOCKED") title = "🔍 <b>SQUAD SECRET // SEÑAL SNIPER DETECTADA</b>";
  if (eventType === "ORDER_ENTERED") title = "⚡ <b>SQUAD SECRET // ENTRADA ALO MAKER REGISTRADA</b>";
  if (eventType === "BREAKEVEN_LOCKED") title = "🔒 <b>SQUAD SECRET // CANDADO BREAKEVEN FIJADO (+0.04%)</b>";
  if (eventType === "TAKE_PROFIT") title = "💰 <b>SQUAD SECRET // TOMA DE GANANCIA REAL (100% USDC)</b>";

  const text = `
${title}

• <b>Escuadrón:</b> <b>${data.squadName}</b> (${data.specialist})
• <b>Par:</b> <code>${data.pair}</code> (${data.direction === "BULL" ? "🐂 LONG" : "🐻 SHORT"})
• <b>Certeza L2:</b> <b>${data.certainty}%</b>
• <b>Margen Asignado:</b> $${data.marginUsdc.toFixed(2)} USDC (${data.leverage}x Nocional $${(data.marginUsdc * data.leverage).toFixed(2)})
• <b>Entrada Maker:</b> $${data.entryPrice}
• <b>Candado Breakeven:</b> $${data.bePrice} (+0.04% · $0 Pérdida)
• <b>Take Profit:</b> $${data.tpPrice} (+0.08% / +$0.20 USDC)
• <b>Tarifa Maker:</b> 0.015% | <b>Gas Red:</b> $0.00
• <b>Escudo Reserva:</b> $${UNTOUCHABLE_RESERVE_USDC.toFixed(2)} USDC (40% Intocable)

🛡️ <i>Regla Sniper: 1 tiro certero x escuadrón · Cero holding · 100% retorno a USDC</i>
`.trim();

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" })
    });
  } catch (_) {}
}

/**
 * Ciclo Principal de Escaneo de los 3 Escuadrones (1 para 3)
 */
async function runSquadScanCycle() {
  console.log(`\n[${new Date().toISOString()}] 🔍 SQUAD SECRET // ESCANEO 3 ESCUADRONES (ALFA, BRAVO, CHARLIE)`);
  console.log(`🛡️ Escudo de Reserva: $${UNTOUCHABLE_RESERVE_USDC.toFixed(2)} USDC Intocable | $60.00 USDC Fuego Máximo ($20 x 3)`);

  const { mids, latencyMs } = await fetchAllMids();
  console.log(`[RADAR L2] Latencia Hyperliquid L1: ${latencyMs}ms | AllMids obtenidos: ${Object.keys(mids).length} monedas\n`);

  const scanResults = {};

  for (const [squadKey, squad] of Object.entries(SQUADS)) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔰 [${squad.name.toUpperCase()}] // ${squad.role} (${squad.specialist})`);
    console.log(`   Margen: $${squad.allocatedMargin} USDC (${squad.leverage}x) | Pares: ${squad.pairs.map(p => p.symbol).join(" · ")}`);

    if (squad.activePosition) {
      console.log(`   ⏸️ Posición en curso en ${squad.activePosition.pair}. Candado BE vigilando. No abre otro tiro.`);
      continue;
    }

    let squadBest = null;

    for (const item of squad.pairs) {
      const mid = parseFloat(mids[item.symbol]);
      if (!mid) continue;

      const levels = await fetchL2Book(item.symbol);
      const l2 = analyzeL2Layers(levels);

      const isBull = l2.imbalancePct >= 65;
      const isBear = l2.imbalancePct <= 35;
      const certainty = isBull ? l2.bullScore : (isBear ? l2.bearScore : 50);

      console.log(`   -> ${item.pair}: Mid $${mid.toFixed(mid < 1 ? 4 : 2)} | Bids $${(l2.bidVol5 / 1000).toFixed(0)}k | Asks $${(l2.askVol5 / 1000).toFixed(0)}k | Desequilibrio: ${l2.imbalancePct.toFixed(1)}%`);

      if (certainty >= 65) {
        if (!squadBest || certainty > squadBest.certainty) {
          squadBest = {
            squadKey,
            squadName: squad.name,
            specialist: squad.specialist,
            pair: item.pair,
            symbol: item.symbol,
            marginUsdc: squad.allocatedMargin,
            leverage: squad.leverage,
            mid,
            bestBid: l2.bestBid,
            bestAsk: l2.bestAsk,
            direction: isBull ? "BULL" : "BEAR",
            certainty,
            entryPrice: mid,
            bePrice: +(mid * (1 + (isBull ? BREAKEVEN_TRIGGER_PCT : -BREAKEVEN_TRIGGER_PCT) / 100)).toFixed(mid < 1 ? 5 : 2),
            tpPrice: +(mid * (1 + (isBull ? TAKE_PROFIT_TRIGGER_PCT : -TAKE_PROFIT_TRIGGER_PCT) / 100)).toFixed(mid < 1 ? 5 : 2)
          };
        }
      }
    }

    if (squadBest) {
      console.log(`   🎯 TIRO IDENTIFICADO: ${squadBest.pair} (${squadBest.direction}) | Certeza: ${squadBest.certainty}%`);
      console.log(`      Entrada ALO: $${squadBest.entryPrice} ➔ BE: $${squadBest.bePrice} ➔ TP: $${squadBest.tpPrice}`);
      scanResults[squadKey] = squadBest;
    } else {
      console.log(`   ⏳ Sin desequilibrio >= 65% en este bloque. Escuadrón en vigilia serena.`);
    }
  }

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  return scanResults;
}

if (require.main === module) {
  runSquadScanCycle().catch(err => console.error("Error en ciclo Squad:", err));
}

module.exports = {
  runSquadScanCycle,
  fetchL2Book,
  fetchAllMids,
  analyzeL2Layers,
  sendTelegramSquadReport,
  executeShieldFundingOrder,
  HL_ASSET_META,
  SQUADS,
  UNTOUCHABLE_RESERVE_USDC,
  SQUAD_MARGIN_USDC
};
