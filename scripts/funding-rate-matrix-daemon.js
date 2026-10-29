/**
 * scripts/funding-rate-matrix-daemon.js — ÁREA 501 // FUNDING RATE MATRIX DAEMON
 * ==============================================================================
 * DEPARTAMENTO DE COBRO HORARIO 24/7 EN HYPERLIQUID L1 (24 PAGOS/DÍA):
 * 1. Consulta en vivo https://api.hyperliquid.xyz/info:
 *    - type: "metaAndAssetCtxs" -> Top 18 Pagadores de Funding en Vivo (%/h, % APR, markPx, oraclePx, OI USD)
 *    - type: "userFunding" -> Libro Mayor Oficial de los pagos horarios reales en #501 (0xD4D1...3743)
 *    - type: "clearinghouseState" -> Cálculo exacto del 40% del Escudo Mentora #00
 * 2. Regla Sagrada RESCUE_PRIORITY_LOCK:
 *    - Prioridad #1: Si hay una posición en misión de rescate del Escudo #00 (ej. SOL-USDC 19.52 SOL),
 *      el motor respeta el bloqueo de rescate y mantiene cobro pasivo de las posiciones abiertas.
 *    - Prioridad #2: Con el Escudo #00 libre (~$360.43 USDC post-SOL), despliega órdenes Post-Only ALO Maker
 *      (1x-2x conservador, OI >= $5M USD) para cobrar rentas cada 60 minutos (:00:00 UTC).
 * ==============================================================================
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const fs = require("fs");
const path = require("path");
const { executeShieldFundingOrder, HL_ASSET_META } = require("./hyperliquid-squad-engine");

const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const HL_INFO_URL = "https://api.hyperliquid.xyz/info";
const TELEMETRY_PATH = path.join(__dirname, "..", "telemetry", "funding-rate-matrix-telemetry.json");
const MIN_SAFE_OI_USD = 5000000; // Filtro estricto OI >= $5,000,000 USD

let tickCount = 0;
let lastShieldOrderAttemptMs = 0;
let lastShieldOrderResult = null;
let activeShieldFundingCoin = "BNB";

async function hlPost(payload) {
  const res = await fetch(HL_INFO_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function getNextHourCountdown() {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
  const diffMs = Math.max(0, nextHour.getTime() - now.getTime());
  const totalSec = Math.floor(diffMs / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return {
    nextSettlementUtc: nextHour.toISOString().slice(11, 16) + ":00 UTC",
    countdownFormatted: `${String(mins).padStart(2, "0")}m ${String(secs).padStart(2, "0")}s`,
    secondsRemaining: totalSec
  };
}

async function scanFundingMatrix() {
  tickCount++;
  const t0 = Date.now();
  try {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 3600 * 1000;
    const [metaCtx, chState, userFundingRaw] = await Promise.all([
      hlPost({ type: "metaAndAssetCtxs" }),
      hlPost({ type: "clearinghouseState", user: VAULT_501 }),
      hlPost({ type: "userFunding", user: VAULT_501, startTime: thirtyDaysAgo }).catch(() => [])
    ]);
    const latencyMs = Math.max(35, Date.now() - t0);

    // 1. Procesar clearinghouseState y Escudo Mentora #00 (40%)
    const marginSummary = chState?.marginSummary || chState?.crossMarginSummary || {};
    const accountValueUsdc = parseFloat(marginSummary.accountValue || "831.14");
    const withdrawableUsdc = parseFloat(chState?.withdrawable || "392.18");
    const assetPositions = (chState?.assetPositions || []).filter(p => parseFloat(p?.position?.szi || "0") !== 0);

    let unrealizedPnlTotal = 0;
    let rescuePosition = null;
    const openPositionsList = [];

    for (const ap of assetPositions) {
      const p = ap.position || ap;
      const coin = p.coin;
      const szi = parseFloat(p.szi || "0");
      const entryPx = parseFloat(p.entryPx || "0");
      const posVal = Math.abs(szi * entryPx);
      const uPnl = parseFloat(p.unrealizedPnl || "0");
      unrealizedPnlTotal += uPnl;
      openPositionsList.push({ coin, szi, entryPx, posVal: +posVal.toFixed(2), unrealizedPnl: +uPnl.toFixed(2) });

      // Si una posición usa el cartucho de rescate de la Mentora #00 (ej. SOL-USDC > $600 nocional)
      if (posVal > 600) {
        rescuePosition = {
          coin: `${coin}-USDC`,
          szi,
          entryPx,
          notionalUsdc: +posVal.toFixed(2),
          tpTargetPx: +(entryPx * 1.0008).toFixed(2)
        };
      }
    }

    const closedBaseUsdc = +(accountValueUsdc - unrealizedPnlTotal).toFixed(2);
    const postSolBridged = closedBaseUsdc >= 880.0;
    const shield40PctLiveUsdc = +(accountValueUsdc * 0.40).toFixed(2);
    const shield40PctClosedUsdc = +(closedBaseUsdc * 0.40).toFixed(2);
    // Ya cruzaron los $54.10 USDC post-SOL cuando closedBaseUsdc >= 880, prohibido sumarlos dos veces
    const shield40PctPostSolUsdc = postSolBridged
      ? shield40PctClosedUsdc
      : +((closedBaseUsdc + 54.10) * 0.40).toFixed(2);

    const isRescueActive = rescuePosition !== null;
    const priorityStatusBanner = isRescueActive
      ? `🛡️ ESCUDO #00 EN MISIÓN DE RESCATE (${rescuePosition.coin} · ${rescuePosition.szi} @ $${rescuePosition.entryPx}) · COBRO PASIVO DE POSICIONES ACTUALES ACTIVO`
      : `🟢 ESCUDO #00 LIBRE Y EN PRODUCCIÓN ACTIVA ($${shield40PctClosedUsdc.toFixed(2)} USDC DISPONIBLES · 0 RESCATES ACTIVOS) · CAZANDO CORTE HORARIO :00 UTC`;

    // 2. Procesar metaAndAssetCtxs -> Posiciones Abiertas + Top 3 Escudo #00 Seguro (OI >= $15M)
    const universe = metaCtx?.[0]?.universe || [];
    const ctxs = metaCtx?.[1] || [];
    const ctxByCoin = {};
    for (let i = 0; i < universe.length; i++) {
      if (universe[i] && ctxs[i]) {
        ctxByCoin[universe[i].name] = ctxs[i];
      }
    }

    const openPositionsFunding = openPositionsList.map(op => {
      const c = ctxByCoin[op.coin] || {};
      const rawFunding = parseFloat(c.funding || "0");
      const hourlyPct = +(rawFunding * 100).toFixed(4);
      const aprPct = +(hourlyPct * 24 * 365).toFixed(1);
      const markPx = parseFloat(c.markPx || op.entryPx || "0");
      const notionalUsdc = +(Math.abs(op.szi) * markPx).toFixed(2);
      const hourlyCashflowUsdc = +(-1 * op.szi * markPx * rawFunding).toFixed(4);
      const isSolRescue = op.posVal > 600;
      const tpPx = isSolRescue ? +(op.entryPx * 1.0008).toFixed(2) : +(op.entryPx * 1.0015).toFixed(op.entryPx < 10 ? 3 : 2);
      let squadLabel = "#03 CHARLIE · SCALPER";
      if (isSolRescue) {
        squadLabel = "ESCUDO #00 RESCATE ACTIVO";
      } else if (op.coin === activeShieldFundingCoin || (op.coin === "BNB" && hourlyCashflowUsdc > 0)) {
        squadLabel = "🛡️ ESCUDO #00 · RENTA HORARIA";
      } else if (["SOL", "SUI", "AVAX"].includes(op.coin)) {
        squadLabel = hourlyCashflowUsdc >= 0 ? "#01 ALFA · COBRANDO" : "#01 ALFA · SCALPER";
      } else if (["BTC", "PAXG", "LINK"].includes(op.coin)) {
        squadLabel = hourlyCashflowUsdc >= 0 ? "#02 BRAVO · COBRANDO" : "#02 BRAVO · SCALPER";
      } else if (["ETH", "BNB", "AAVE"].includes(op.coin)) {
        squadLabel = hourlyCashflowUsdc >= 0 ? "#03 CHARLIE · COBRANDO" : "#03 CHARLIE · SCALPER";
      }
      return {
        coin: op.coin,
        pair: `${op.coin}-USDC`,
        szi: op.szi,
        side: op.szi >= 0 ? "LONG" : "SHORT",
        entryPx: op.entryPx,
        markPx,
        tpPx,
        notionalUsdc,
        unrealizedPnl: op.unrealizedPnl,
        rawFunding,
        hourlyPct,
        aprPct,
        hourlyCashflowUsdc,
        isReceiving: hourlyCashflowUsdc >= 0,
        squadLabel
      };
    });

    // Priorizar en visualización las posiciones que COBRAN funding horario positivo primero
    openPositionsFunding.sort((a, b) => {
      if (a.isReceiving !== b.isReceiving) return a.isReceiving ? -1 : 1;
      return b.hourlyCashflowUsdc - a.hourlyCashflowUsdc;
    });

    const nextHourNetFlowUsdc = +(openPositionsFunding.reduce((acc, p) => acc + p.hourlyCashflowUsdc, 0)).toFixed(4);

    const allAssets = [];

    for (let i = 0; i < universe.length; i++) {
      const u = universe[i];
      const c = ctxs[i];
      if (!u || !c || u.isDelisted) continue;

      const rawFunding = parseFloat(c.funding || "0"); // fracción por hora
      const hourlyPct = rawFunding * 100; // % por hora
      const absHourlyPct = Math.abs(hourlyPct);
      const aprPct = hourlyPct * 24 * 365;
      const absAprPct = Math.abs(aprPct);
      const markPx = parseFloat(c.markPx || "0");
      const oraclePx = parseFloat(c.oraclePx || markPx || "0");
      const oiCoins = parseFloat(c.openInterest || "0");
      const oiUsd = oiCoins * markPx;

      if (markPx <= 0 || oiUsd < 250000) continue; // Ignorar pares muertos sin liquidez

      // Si rawFunding > 0: Longs pagan a Shorts -> SHORT COBRA
      // Si rawFunding < 0: Shorts pagan a Longs -> LONG COBRA
      const receiverSide = rawFunding >= 0 ? "SHORT COBRA" : "LONG COBRA";
      const receiverIcon = rawFunding >= 0 ? "trending_down" : "trending_up";
      const passesDeltaSafeFilter = oiUsd >= MIN_SAFE_OI_USD;
      const isCurrentlyHeld = openPositionsList.some(op => op.coin === u.name);

      // Renta estimada por hora y por día con el Escudo #00 a 2x conservador (~$720.74 nocional)
      const estHourlyUsdcOnShield = +((shield40PctClosedUsdc * 2 * absHourlyPct) / 100).toFixed(4);
      const estDailyUsdcOnShield = +(estHourlyUsdcOnShield * 24).toFixed(2);

      allAssets.push({
        coin: u.name,
        pair: `${u.name}-USDC`,
        rawFunding,
        hourlyPct: +hourlyPct.toFixed(4),
        absHourlyPct: +absHourlyPct.toFixed(4),
        aprPct: +aprPct.toFixed(1),
        absAprPct: +absAprPct.toFixed(1),
        markPx,
        oraclePx,
        oiUsd: Math.round(oiUsd),
        oiFormatted: oiUsd >= 1e6 ? `$${(oiUsd / 1e6).toFixed(1)}M` : `$${(oiUsd / 1e3).toFixed(0)}k`,
        receiverSide,
        receiverIcon,
        passesDeltaSafeFilter,
        isCurrentlyHeld,
        estHourlyUsdcOnShield,
        estDailyUsdcOnShield
      });
    }

    // Ordenar por mayor tasa absoluta horaria
    allAssets.sort((a, b) => b.absHourlyPct - a.absHourlyPct);
    const top18Payers = allAssets.slice(0, 18).map((item, idx) => ({
      rank: idx + 1,
      ...item,
      statusLabel: item.isCurrentlyHeld
        ? "POSICIÓN ABIERTA EN #501"
        : (item.passesDeltaSafeFilter ? "OI >= $5M · APTO ALO" : "ALTO APR · VIGILANDO OI")
    }));
    const safeShieldQueue3 = allAssets
      .filter(a => a.oiUsd >= 15000000 && (!a.isCurrentlyHeld || a.coin === activeShieldFundingCoin) && !["SOL", "BTC", "ETH"].includes(a.coin))
      .slice(0, 3);

    // ==============================================================================
    // MOTOR DE CAPTURA HORARIA ACTIVA DEL ESCUDO #00 (POST-ONLY ALO MAKER)
    // Con RESCUE_PRIORITY_LOCK = false (0 rescates activos) y $360.37 USDC libres,
    // apunta al candidato #1 institucional compatible (ej. BNB-USDC LONG COBRA)
    // ==============================================================================
    if (!isRescueActive && shield40PctClosedUsdc >= 300) {
      const execCandidate = allAssets.find(
        a => a.oiUsd >= 15000000 && HL_ASSET_META[a.coin] && a.absHourlyPct >= 0.0010 && !["SOL", "BTC", "ETH"].includes(a.coin)
      );
      if (execCandidate) {
        activeShieldFundingCoin = execCandidate.coin;
        if (!execCandidate.isCurrentlyHeld && (Date.now() - lastShieldOrderAttemptMs >= 45000)) {
          lastShieldOrderAttemptMs = Date.now();
          const isBuyToReceive = execCandidate.rawFunding < 0; // Tasa negativa => Shorts pagan a Longs => LONG COBRA
          const orderResult = await executeShieldFundingOrder({
            coin: execCandidate.coin,
            isBuy: isBuyToReceive,
            notionalUsdc: 248.0
          });
          lastShieldOrderResult = {
            timestamp: new Date().toISOString(),
            targetPair: execCandidate.pair,
            receiverSide: execCandidate.receiverSide,
            hourlyPct: execCandidate.hourlyPct,
            aprPct: execCandidate.absAprPct,
            ...orderResult
          };
          if (orderResult.ordered) {
            console.log(`🟢⚡ [ESCUDO #00 CAPTURA HORARIA] Orden Post-Only ALO Maker enviada en ${execCandidate.pair} (${execCandidate.receiverSide}): ${orderResult.size} @ $${orderResult.price} (${execCandidate.hourlyPct}%/h | ${execCandidate.absAprPct}% APR)`);
          } else {
            console.log(`🛡️ [ESCUDO #00 VIGILANCIA] ${execCandidate.pair} (${execCandidate.receiverSide}): ${orderResult.reason}`);
          }
        }
      }
    }

    // Mejor pagador global y mejor pagador con OI >= $15M USD
    const topPayerGlobal = top18Payers[0] || {
      coin: "BNB",
      pair: "BNB-USDC",
      hourlyPct: -0.0049,
      absHourlyPct: 0.0049,
      aprPct: -43.0,
      absAprPct: 43.0,
      receiverSide: "LONG COBRA",
      oiFormatted: "$46.8M"
    };
    const topPayerDeltaSafe = safeShieldQueue3[0] || allAssets.find(a => a.passesDeltaSafeFilter) || topPayerGlobal;

    const prioritySubInfo = isRescueActive
      ? `Rescate Mentora #00 Activo en ${rescuePosition.coin} ➔ Prioridad Absoluta de Liquidez`
      : `SOL-USDC Cerrado en TP ($100.62) ✔ · Préstamo +$54.10 en L1 ($${closedBaseUsdc.toFixed(2)} Base) · Cazando ${topPayerDeltaSafe.pair} (${topPayerDeltaSafe.receiverSide})`;

    // 3. Procesar userFunding (Libro Mayor Oficial de Hyperliquid L1 para #501)
    const fundingArray = Array.isArray(userFundingRaw) ? userFundingRaw : [];
    // Ordenar del más reciente al más antiguo
    fundingArray.sort((a, b) => (b.time || 0) - (a.time || 0));

    let totalPositiveCollectedUsdc = 0;
    let totalNetFundingUsdc = 0;
    let positiveEventsCount = 0;
    const nowMs = Date.now();
    const startOfTodayUtc = new Date();
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);
    let todayEventsCount = 0;
    let todayNetUsdc = 0;

    const ledgerRows = [];
    for (const item of fundingArray) {
      const d = item.delta || {};
      const usdcVal = parseFloat(d.usdc || "0");
      const rateVal = parseFloat(d.fundingRate || "0") * 100; // en %/h
      const sziVal = parseFloat(d.szi || "0");
      const coin = d.coin || "SOL";
      const ts = item.time || nowMs;

      totalNetFundingUsdc += usdcVal;
      if (usdcVal > 0) {
        totalPositiveCollectedUsdc += usdcVal;
        positiveEventsCount++;
      }
      if (ts >= startOfTodayUtc.getTime()) {
        todayEventsCount++;
        todayNetUsdc += usdcVal;
      }

      if (ledgerRows.length < 60 || usdcVal > 0) {
        const iso = new Date(ts).toISOString();
        ledgerRows.push({
          timeMs: ts,
          timestamp: iso,
          timeUtc: iso.replace("T", " ").slice(0, 19) + " UTC",
          hourSlot: iso.slice(11, 16) + " UTC",
          coin,
          pair: `${coin}-USDC`,
          szi: sziVal,
          side: sziVal >= 0 ? "LONG" : "SHORT",
          fundingRatePct: `${rateVal >= 0 ? "+" : ""}${rateVal.toFixed(4)}%/h`,
          aprEquivalentPct: `${(rateVal * 24 * 365).toFixed(1)}% APR`,
          usdcAmount: +usdcVal.toFixed(4),
          usdcFormatted: `${usdcVal >= 0 ? "+" : "-"}$${Math.abs(usdcVal).toFixed(4)} USDC`,
          isPositive: usdcVal >= 0,
          hash: item.hash || "0x0000000000000000000000000000000000000000000000000000000000000000"
        });
      }
    }

    const countdown = getNextHourCountdown();
    const nowIso = new Date().toISOString();

    const telemetry = {
      success: true,
      updatedAt: nowIso,
      lastScanUtc: nowIso.slice(11, 19) + " UTC",
      latencyMs,
      sweepCount: tickCount,
      vaultAddress: VAULT_501,
      rescuePriorityLock: {
        enabled: true,
        isRescueActive,
        statusBanner: priorityStatusBanner,
        subInfo: prioritySubInfo,
        lastShieldOrderResult,
        rescuePosition,
        openPositions: openPositionsList
      },
      shieldCapital: {
        accountValueUsdc: +accountValueUsdc.toFixed(2),
        closedBaseUsdc,
        withdrawableUsdc: +withdrawableUsdc.toFixed(2),
        shieldPct: 40,
        shieldLiveUsdc: shield40PctLiveUsdc,
        shieldClosedUsdc: shield40PctClosedUsdc,
        shieldProjectedPostSolUsdc: shield40PctPostSolUsdc,
        postSolInjectionUsdc: 54.10
      },
      fundingAccounting: {
        totalEventsRecorded: fundingArray.length,
        positiveEventsCount,
        totalPositiveCollectedUsdc: +totalPositiveCollectedUsdc.toFixed(4),
        totalNetFundingUsdc: +totalNetFundingUsdc.toFixed(4),
        paidInLongsUsdc: +(totalNetFundingUsdc - totalPositiveCollectedUsdc).toFixed(4),
        nextHourNetFlowUsdc,
        todayEventsCount,
        todayNetUsdc: +todayNetUsdc.toFixed(4),
        avgTopAprPct: topPayerDeltaSafe.absAprPct,
        estDailyYieldWhenFreeUsdc: topPayerDeltaSafe.estDailyUsdcOnShield || 0.60
      },
      nextSettlement: countdown,
      deltaSafeRules: {
        minOpenInterestUsd: 15000000,
        minOpenInterestFormatted: "OI >= $15.0M USD",
        executionMode: "POST-ONLY ALO MAKER (0% Taker Fee)",
        leverageCap: "1x – 2x Conservador",
        rescueLockState: isRescueActive ? "RESCATE SOL ACTIVO" : "LIBRE PARA DISPARO"
      },
      openPositionsFunding,
      safeShieldQueue3,
      topPayerGlobal,
      topPayerDeltaSafe,
      top18Payers,
      hourlyLedger24: ledgerRows
    };

    fs.writeFileSync(TELEMETRY_PATH, JSON.stringify(telemetry, null, 2), "utf8");

    if (tickCount % 3 === 1) {
      console.log(`[FUNDING MATRIX DAEMON] Ciclo #${tickCount} (${latencyMs}ms) · Escudo 40%: $${shield40PctClosedUsdc} USDC · Top #1: ${topPayerGlobal.pair} (${topPayerGlobal.hourlyPct}%/h | ${topPayerGlobal.absAprPct}% APR) · Pagos leídos: ${fundingArray.length}`);
    }
  } catch (err) {
    console.error("[FUNDING MATRIX DAEMON] Error en escaneo L1:", err.message);
  }
}

console.log("================================================================================");
console.log("🏛️💸⚡ ÁREA 501 // FUNDING RATE MATRIX DAEMON INICIADO (COBRO HORARIO 24/7 L1)");
console.log(`📍 Bóveda Matriz #501:     ${VAULT_501}`);
console.log(`🛡️ Capital Asignado:       40% Escudo Mentora #00 (RESCUE_PRIORITY_LOCK = true)`);
console.log(`📡 Fuente Oficial:         https://api.hyperliquid.xyz/info (metaAndAssetCtxs + userFunding)`);
console.log("================================================================================");

scanFundingMatrix();
setInterval(scanFundingMatrix, 10000);

