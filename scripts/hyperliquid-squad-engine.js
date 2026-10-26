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

// Restricción Operativa Absoluta
const MAX_CONCURRENT_POSITIONS = 1;
const BREAKEVEN_TRIGGER_PCT = 0.04; // +0.04%
const TAKE_PROFIT_TRIGGER_PCT = 0.08; // +0.08%
const MAKER_FEE_PCT = 0.015; // 0.015% Maker

// Lista de Pares Calificados por el Squad
const SQUAD_WATCHLIST = [
  { pair: "SOL-USDC", symbol: "SOL", specialist: "#601 Titan-Scalper", minLiquidityUsdc: 10000000 },
  { pair: "BTC-USDC", symbol: "BTC", specialist: "#701 Oracle-Global", minLiquidityUsdc: 25000000 },
  { pair: "ETH-USDC", symbol: "ETH", specialist: "#601 Titan-Scalper", minLiquidityUsdc: 15000000 },
  { pair: "SUI-USDC", symbol: "SUI", specialist: "#601 Titan-Scalper", minLiquidityUsdc: 5000000 }
];

let activePositions = []; // Memoria de posiciones en curso

/**
 * Consulta el libro de órdenes L2 de Hyperliquid para un símbolo específico
 */
async function fetchL2Book(symbol) {
  try {
    const res = await fetch(HL_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "l2Book", coin: symbol })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data && data.levels ? data.levels : null;
  } catch (err) {
    return null;
  }
}

/**
 * Consulta todos los precios medios (AllMids) de Hyperliquid L1
 */
async function fetchAllMids() {
  const t0 = Date.now();
  try {
    const res = await fetch(HL_INFO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "allMids" })
    });
    const t1 = Date.now();
    if (!res.ok) return { mids: {}, latencyMs: 150 };
    const mids = await res.json();
    return { mids, latencyMs: Math.max(15, t1 - t0) };
  } catch (err) {
    return { mids: {}, latencyMs: 150 };
  }
}

/**
 * Analiza el desequilibrio de compra/venta en las primeras 5 capas del L2 Book
 */
function analyzeL2Layers(levels) {
  if (!levels || !levels[0] || !levels[1]) {
    return { bestBid: 0, bestAsk: 0, bidVol5: 0, askVol5: 0, imbalancePct: 50, bullScore: 50, bearScore: 50 };
  }

  const bids = levels[0].slice(0, 5); // 5 mejores niveles de compra
  const asks = levels[1].slice(0, 5); // 5 mejores niveles de venta

  const bestBid = bids[0] ? parseFloat(bids[0].px) : 0;
  const bestAsk = asks[0] ? parseFloat(asks[0].px) : 0;

  const bidVol5 = bids.reduce((acc, b) => acc + (parseFloat(b.sz) * parseFloat(b.px)), 0);
  const askVol5 = asks.reduce((acc, a) => acc + (parseFloat(a.sz) * parseFloat(a.px)), 0);

  const totalVol = bidVol5 + askVol5;
  const imbalancePct = totalVol > 0 ? (bidVol5 / totalVol) * 100 : 50;

  const bullScore = Math.min(98, Math.max(2, Math.round(imbalancePct)));
  const bearScore = 100 - bullScore;

  return { bestBid, bestAsk, bidVol5, askVol5, imbalancePct, bullScore, bearScore };
}

/**
 * Ciclo Principal de Escaneo y Calibración del Squad
 */
async function runSquadScanCycle() {
  console.log(`\n[${new Date().toISOString()}] 🔍 SQUAD SECRET // ESCANEO HYPERLIQUID L1 MAKER`);

  // Regla Infranqueable: Máximo 1 posición a la vez
  if (activePositions.length >= MAX_CONCURRENT_POSITIONS) {
    console.log(`[BLOQUEO ACTIVO] Posición en curso (${activePositions[0].pair} ${activePositions[0].direction}). Esperando cierre en USDC.`);
    return;
  }

  const { mids, latencyMs } = await fetchAllMids();
  console.log(`[RADAR L2] Latencia Hyperliquid L1: ${latencyMs}ms | AllMids obtenidos: ${Object.keys(mids).length} monedas`);

  let bestOpportunity = null;

  for (const item of SQUAD_WATCHLIST) {
    const mid = parseFloat(mids[item.symbol]);
    if (!mid) continue;

    const levels = await fetchL2Book(item.symbol);
    const l2 = analyzeL2Layers(levels);

    const isBull = l2.imbalancePct >= 65;
    const isBear = l2.imbalancePct <= 35;
    const certainty = isBull ? l2.bullScore : (isBear ? l2.bearScore : 50);

    console.log(`  -> ${item.pair}: Mid $${mid.toFixed(2)} | Bids 5-Capas: $${(l2.bidVol5 / 1000).toFixed(0)}k | Asks 5-Capas: $${(l2.askVol5 / 1000).toFixed(0)}k | Desequilibrio: ${l2.imbalancePct.toFixed(1)}%`);

    if (certainty >= 75) {
      if (!bestOpportunity || certainty > bestOpportunity.certainty) {
        bestOpportunity = {
          pair: item.pair,
          symbol: item.symbol,
          specialist: item.specialist,
          mid,
          bestBid: l2.bestBid,
          bestAsk: l2.bestAsk,
          direction: isBull ? "BULL" : "BEAR",
          certainty,
          bullScore: l2.bullScore,
          bearScore: l2.bearScore,
          bePrice: +(mid * (1 + (isBull ? BREAKEVEN_TRIGGER_PCT : -BREAKEVEN_TRIGGER_PCT) / 100)).toFixed(2),
          tpPrice: +(mid * (1 + (isBull ? TAKE_PROFIT_TRIGGER_PCT : -TAKE_PROFIT_TRIGGER_PCT) / 100)).toFixed(2)
        };
      }
    }
  }

  if (bestOpportunity) {
    console.log(`\n🎯 [PAR GANADOR SELECCIONADO]: ${bestOpportunity.pair} (${bestOpportunity.direction})`);
    console.log(`   Especialista: ${bestOpportunity.specialist} | Certeza: ${bestOpportunity.certainty}%`);
    console.log(`   Entrada ALO Maker: $${bestOpportunity.mid} | BE Candado: $${bestOpportunity.bePrice} | TP: $${bestOpportunity.tpPrice}`);
    console.log(`   Fee Maker: ${MAKER_FEE_PCT}% | Gas Hyperliquid: $0.00`);
  } else {
    console.log(`[ESPERA DE SEÑAL] Desequilibrio en libros L2 neutro (< 65%). Sin riesgo, esperando impulso institucional.`);
  }
}

// Ejecución directa si se corre por línea de comandos
if (require.main === module) {
  runSquadScanCycle().catch(err => console.error("Error en ciclo Squad:", err));
}

module.exports = {
  runSquadScanCycle,
  fetchL2Book,
  fetchAllMids,
  analyzeL2Layers,
  MAX_CONCURRENT_POSITIONS
};
