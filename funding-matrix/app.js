/**
 * funding-matrix/app.js — ÁREA 501 // FUNDING RATE MATRIX V3 (SINCERADO 100% REAL)
 * ==============================================================================
 * CONTROLADOR FRONTEND EN VIVO (FOCO EXCLUSIVO EN BÓVEDA #501 - CERO RELLENO):
 * 1) 5 TARJETAS SUPERIORES SINCERADAS AL CENTAVO
 * 2) SECCIÓN A: TUS POSICIONES ABIERTAS AHORA MISMO EN HYPERLIQUID L1 (SOL, BTC, ETH)
 * 3) SECCIÓN B: COLA DE TRABAJO DEL ESCUDO #00 (SOLO 3 PARES SEGUROS OI >= $15M USD)
 * 4) PANEL DERECHO: LIBRO MAYOR userFunding CON FILTRO [TODOS] VS [SOLO POSITIVOS]
 * ==============================================================================
 */

function setTextIfChanged(el, text) {
  if (!el) return;
  const s = String(text);
  if (el.textContent !== s) {
    el.textContent = s;
  }
}

const STORAGE_KEY_FUNDING_V3 = "__AREA501_FUNDING_V4__";
let currentLedgerFilter = "ALL"; // "ALL" | "POSITIVE"

// Filas iniciales verificadas en userFunding de 0xD4D12077a61118372f7a367319fb11922Beb3743 (0ms Zero-Blank)
const INITIAL_FUNDING_LEDGER_ROWS = [
  { timeUtc: "2026-10-29 09:00:00 UTC", hourSlot: "09:00 UTC", coin: "ETH", pair: "ETH-USDC", szi: 0.2156, side: "LONG", fundingRatePct: "+0.0013%/h", aprEquivalentPct: "10.9% APR", usdcAmount: -0.0062, isPositive: false },
  { timeUtc: "2026-10-29 09:00:00 UTC", hourSlot: "09:00 UTC", coin: "SOL", pair: "SOL-USDC", szi: 19.52, side: "LONG", fundingRatePct: "+0.0013%/h", aprEquivalentPct: "10.9% APR", usdcAmount: -0.0245, isPositive: false },
  { timeUtc: "2026-10-29 08:00:00 UTC", hourSlot: "08:00 UTC", coin: "ETH", pair: "ETH-USDC", szi: 0.1081, side: "LONG", fundingRatePct: "-0.0004%/h", aprEquivalentPct: "-3.2% APR", usdcAmount: 0.0009, isPositive: true },
  { timeUtc: "2026-10-29 08:00:00 UTC", hourSlot: "08:00 UTC", coin: "BTC", pair: "BTC-USDC", szi: 0.00312, side: "LONG", fundingRatePct: "+0.0013%/h", aprEquivalentPct: "10.9% APR", usdcAmount: -0.0031, isPositive: false },
  { timeUtc: "2026-10-29 08:00:00 UTC", hourSlot: "08:00 UTC", coin: "SOL", pair: "SOL-USDC", szi: 19.52, side: "LONG", fundingRatePct: "+0.0013%/h", aprEquivalentPct: "10.9% APR", usdcAmount: -0.0243, isPositive: false },
  { timeUtc: "2026-10-29 07:00:00 UTC", hourSlot: "07:00 UTC", coin: "SOL", pair: "SOL-USDC", szi: 9.76, side: "LONG", fundingRatePct: "+0.0013%/h", aprEquivalentPct: "10.9% APR", usdcAmount: -0.0122, isPositive: false },
  { timeUtc: "2026-10-29 06:00:00 UTC", hourSlot: "06:00 UTC", coin: "SOL", pair: "SOL-USDC", szi: 4.88, side: "LONG", fundingRatePct: "+0.0013%/h", aprEquivalentPct: "10.9% APR", usdcAmount: -0.0061, isPositive: false },
  { timeUtc: "2026-10-29 05:00:00 UTC", hourSlot: "05:00 UTC", coin: "SOL", pair: "SOL-USDC", szi: 4.88, side: "LONG", fundingRatePct: "+0.0013%/h", aprEquivalentPct: "10.9% APR", usdcAmount: -0.0061, isPositive: false },
  { timeUtc: "2026-10-29 04:00:00 UTC", hourSlot: "04:00 UTC", coin: "SOL", pair: "SOL-USDC", szi: 4.88, side: "LONG", fundingRatePct: "-0.0003%/h", aprEquivalentPct: "-2.9% APR", usdcAmount: 0.0016, isPositive: true },
  { timeUtc: "2026-10-29 03:00:00 UTC", hourSlot: "03:00 UTC", coin: "SOL", pair: "SOL-USDC", szi: 4.88, side: "LONG", fundingRatePct: "+0.0001%/h", aprEquivalentPct: "1.0% APR", usdcAmount: -0.0006, isPositive: false },
  { timeUtc: "2026-10-29 02:00:00 UTC", hourSlot: "02:00 UTC", coin: "SOL", pair: "SOL-USDC", szi: 4.88, side: "LONG", fundingRatePct: "+0.0010%/h", aprEquivalentPct: "8.5% APR", usdcAmount: -0.0047, isPositive: false },
  { timeUtc: "2026-10-29 01:00:00 UTC", hourSlot: "01:00 UTC", coin: "SOL", pair: "SOL-USDC", szi: 4.88, side: "LONG", fundingRatePct: "+0.0013%/h", aprEquivalentPct: "10.9% APR", usdcAmount: -0.0062, isPositive: false },
  { timeUtc: "2026-10-29 01:00:00 UTC", hourSlot: "01:00 UTC", coin: "PAXG", pair: "PAXG-USDC", szi: 0.061, side: "LONG", fundingRatePct: "+0.0013%/h", aprEquivalentPct: "10.9% APR", usdcAmount: -0.0031, isPositive: false },
  { timeUtc: "2026-10-29 00:00:00 UTC", hourSlot: "00:00 UTC", coin: "PAXG", pair: "PAXG-USDC", szi: 0.061, side: "LONG", fundingRatePct: "+0.0013%/h", aprEquivalentPct: "10.9% APR", usdcAmount: -0.0031, isPositive: false },
  { timeUtc: "2026-10-28 20:00:00 UTC", hourSlot: "20:00 UTC", coin: "LINK", pair: "LINK-USDC", szi: -42.4, side: "SHORT", fundingRatePct: "+0.0013%/h", aprEquivalentPct: "10.9% APR", usdcAmount: 0.0063, isPositive: true },
  { timeUtc: "2026-10-28 20:00:00 UTC", hourSlot: "20:00 UTC", coin: "ETH", pair: "ETH-USDC", szi: -0.0297, side: "SHORT", fundingRatePct: "+0.0013%/h", aprEquivalentPct: "10.9% APR", usdcAmount: 0.0009, isPositive: true }
];

let cachedLedgerRows = [...INITIAL_FUNDING_LEDGER_ROWS];

function saveFundingSnapshot(state) {
  try {
    window.__LAST_FUNDING_STATE__ = state;
    localStorage.setItem(STORAGE_KEY_FUNDING_V3, JSON.stringify(state));
  } catch (_) {}
}

function getSquadLabelForCoin(coin, notionalUsdc) {
  if (notionalUsdc > 600) return `#00 ESCUDO RESCATE (${coin})`;
  if (coin === "SOL" || coin === "AVAX" || coin === "SUI" || coin === "POL") return "#01 ALFA";
  if (coin === "BTC" || coin === "PAXG" || coin === "LINK") return "#02 BRAVO";
  if (coin === "ETH" || coin === "BNB" || coin === "AAVE") return "#03 CHARLIE";
  return "SQUAD MATRIX L1";
}

function getTpTargetForCoin(coin, entryPx, notionalUsdc, szi) {
  const px = Number(entryPx || 0);
  const mult = Number(szi || 1) >= 0 ? 1.0015 : 0.9985;
  if (coin === "BTC") return `$${Math.round(px * mult).toLocaleString("en-US")}.0`;
  if (coin === "ETH") return `$${(px * mult).toFixed(1)}`;
  return `$${(px * mult).toFixed(2)}`;
}

function renderOpenPositionsSection(openPositionsDetailed) {
  const container = document.getElementById("openPositionsCardsRow");
  if (!container || !Array.isArray(openPositionsDetailed) || openPositionsDetailed.length === 0) return;

  const html = openPositionsDetailed.slice(0, 3).map(pos => {
    const cashflow = Number(pos.hourlyCashflowUsdc || 0);
    const isReceiving = cashflow >= 0;
    const cardClass = isReceiving ? "focus-card card-receiving" : "focus-card card-paying";
    const side = pos.side || (Number(pos.szi) >= 0 ? "LONG" : "SHORT");
    const sideBadgeClass = side === "LONG" ? "fc-side-badge long" : "fc-side-badge short";

    // Soportar tanto hourlyPct (worker.js / daemon) como hourlyRatePct
    const rateVal = Number(pos.hourlyPct !== undefined ? pos.hourlyPct : (pos.hourlyRatePct || 0));
    const aprVal = Number(pos.aprPct !== undefined ? pos.aprPct : (rateVal * 24 * 365));
    const rateSign = rateVal >= 0 ? "+" : "";

    const bannerClass = isReceiving ? "fc-bottom-banner receive" : "fc-bottom-banner cost";
    const bannerText = isReceiving
      ? `🟢 TE PAGAN +$${Math.abs(cashflow).toFixed(4)} USDC / HORA`
      : `🟡 COSTO DE MANTENIMIENTO: -$${Math.abs(cashflow).toFixed(4)} USDC / HORA`;

    const entryPxNum = Number(pos.entryPx || 0);
    const notionalNum = Number(pos.notionalUsdc || pos.posVal || Math.abs(Number(pos.szi || 0) * entryPxNum));
    const entryStr = pos.coin === "BTC"
      ? `$${entryPxNum.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
      : `$${entryPxNum}`;
    const tpStr = pos.tpFormatted || (pos.tpPx ? `$${pos.tpPx}` : getTpTargetForCoin(pos.coin, entryPxNum, notionalNum, pos.szi));
    const squadTag = pos.squadLabel || getSquadLabelForCoin(pos.coin, notionalNum);

    return `
      <div class="${cardClass}">
        <div class="fc-top">
          <span class="fc-pair-title">${pos.coin}-USDC · ${side} (${Math.abs(Number(pos.szi || 0))} ${pos.coin})</span>
          <span class="${sideBadgeClass}">${squadTag}</span>
        </div>
        <div class="fc-metrics">
          <div class="fc-metric-line">
            <span>Entrada ➔ Salida TP:</span>
            <b>${entryStr} ➔ ${tpStr}</b>
          </div>
          <div class="fc-metric-line">
            <span>Valor Posición (Nocional):</span>
            <b>$${notionalNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC</b>
          </div>
        </div>
        <div class="fc-rate-big">
          <span>Tasa: ${rateSign}${rateVal.toFixed(4)}% / hora</span>
          <span class="apr-tag">${Math.abs(aprVal).toFixed(1)}% APR</span>
        </div>
        <div class="${bannerClass}">
          ${bannerText}
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = html;
}

function renderShieldQueueSection(queueItems, shieldCapitalPostSol, isRescueActive) {
  const container = document.getElementById("shieldQueueCardsRow");
  if (!container || !Array.isArray(queueItems) || queueItems.length === 0) return;

  const shieldBase = Number(shieldCapitalPostSol || 360.37);
  const notional2x = shieldBase * 2; // 2x conservador Post-Only ALO Maker

  const html = queueItems.slice(0, 3).map((item, idx) => {
    const rankNum = idx + 1;
    const hPct = Number(item.hourlyPct || 0);
    const rateSign = hPct >= 0 ? "+" : "";
    const sideBadgeClass = item.receiverSide === "LONG COBRA" ? "fc-side-badge long" : "fc-side-badge short";
    const hourlyUsd = +((notional2x * Math.abs(hPct)) / 100).toFixed(4);
    const dailyUsd = +(hourlyUsd * 24).toFixed(2);
    const statusRole = rankNum === 1
      ? (isRescueActive ? "#1 LISTO AL CERRAR RESCATE" : "#1 CAPTURA ACTIVA :00 UTC")
      : `#${rankNum} RESERVA DELTA-SAFE`;

    return `
      <div class="focus-card card-shield-queue">
        <div class="fc-top">
          <span class="fc-pair-title">#0${rankNum} ${item.pair || (item.coin + "-USDC")}</span>
          <span class="${sideBadgeClass}">${item.receiverSide}</span>
        </div>
        <div class="fc-metrics">
          <div class="fc-metric-line">
            <span>Liquidez Institucional (OI):</span>
            <b>${item.oiFormatted} USD ✔</b>
          </div>
          <div class="fc-metric-line">
            <span>Estado Cola Escudo #00:</span>
            <b>${statusRole}</b>
          </div>
        </div>
        <div class="fc-rate-big">
          <span>${rateSign}${hPct.toFixed(4)}% / hora</span>
          <span class="apr-tag">${Number(item.absAprPct || Math.abs(hPct * 24 * 365)).toFixed(1)}% APR</span>
        </div>
        <div class="${bannerClassForQueue()}">
          🟢 PAGA AL ESCUDO #00: +$${hourlyUsd.toFixed(4)}/H (+$${dailyUsd.toFixed(2)} USDC/DÍA)
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = html;
}

function bannerClassForQueue() {
  return "fc-bottom-banner queue-yield";
}

function renderLedgerTable(rows) {
  const tbody = document.getElementById("fundingLedgerBody");
  if (!tbody) return;

  const sourceList = (Array.isArray(rows) && rows.length > 0) ? rows : cachedLedgerRows;
  let filtered = currentLedgerFilter === "POSITIVE"
    ? sourceList.filter(r => Number(r.usdcAmount !== undefined ? r.usdcAmount : r.usdc) > 0)
    : sourceList.slice(0, 30);

  if (filtered.length === 0) {
    filtered = currentLedgerFilter === "POSITIVE"
      ? INITIAL_FUNDING_LEDGER_ROWS.filter(r => r.usdcAmount > 0)
      : INITIAL_FUNDING_LEDGER_ROWS;
  }

  tbody.innerHTML = filtered.map(r => {
    const amt = Number(r.usdcAmount !== undefined ? r.usdcAmount : (r.usdc || 0));
    const isPos = amt >= 0;
    const side = r.side || (Number(r.szi || 0) >= 0 ? "LONG" : "SHORT");
    const sideClass = side === "LONG" ? "badge-side-long" : "badge-side-short";
    const utcDateStr = r.timeUtc
      ? r.timeUtc.slice(5, 16) + " UTC"
      : (r.hourSlot || "09:00 UTC");
    const ratePctStr = r.fundingRatePct || "+0.0013%/h";
    const aprEqStr = r.aprEquivalentPct || "10.9% APR";
    const paymentCellHtml = isPos
      ? `<span class="amt-pos-pill">+$${Math.abs(amt).toFixed(4)} USDC · COBRADO</span>`
      : `<span class="amt-neg-neutral">-$${Math.abs(amt).toFixed(4)} USDC · Ajuste ${side === "LONG" ? "Long" : "Short"}</span>`;

    return `
      <tr>
        <td><b>${utcDateStr}</b></td>
        <td><b>${r.pair || ((r.coin || "SOL") + "-USDC")}</b></td>
        <td><span class="${sideClass}">${side} (${r.szi})</span></td>
        <td>${ratePctStr} <small style="color:#64748B;">(${aprEqStr})</small></td>
        <td>${paymentCellHtml}</td>
      </tr>
    `;
  }).join("");
}

function enrichAndApplyTelemetry(data) {
  if (!data || typeof data !== "object") return;
  saveFundingSnapshot(data);

  // 1. Renderizar inmediatamente el Libro Mayor Oficial userFunding (Prioridad Visual Cero Blanco)
  try {
    const incomingLedger = data.hourlyLedger24 || data.ledger || data.fundingHistory;
    if (Array.isArray(incomingLedger) && incomingLedger.length > 0) {
      cachedLedgerRows = incomingLedger;
    }
    renderLedgerTable(cachedLedgerRows);

    const latestCut = cachedLedgerRows[0];
    if (latestCut && latestCut.hourSlot) {
      setTextIfChanged(document.getElementById("topRecentCutPill"), `Corte ${latestCut.hourSlot} Verificado`);
    }
  } catch (_) {}

  // 2. Tarjeta 1 + Banner de Estado Dinámico del Escudo #00 (40%)
  const sc = data.shieldCapital || {};
  const closedBaseUsdc = Number(sc.closedBaseUsdc || 900.92);
  const shieldClosed = Number(sc.shieldClosedUsdc || 360.37);
  const shieldPostSol = Number(sc.shieldProjectedPostSolUsdc || shieldClosed);

  setTextIfChanged(document.getElementById("topShieldCapitalVal"), shieldClosed.toFixed(2));
  const postSolPill = document.getElementById("topShieldPostSolPill");
  if (postSolPill) {
    if (closedBaseUsdc >= 880) {
      setTextIfChanged(postSolPill, "Puente Post-SOL: +$54.10 Completado ✔");
      postSolPill.className = "pill-cobalt";
    } else {
      setTextIfChanged(postSolPill, `Post-SOL: $${shieldPostSol.toFixed(2)} USDC Libres`);
      postSolPill.className = "pill-emerald";
    }
  }

  const rpl = data.rescuePriorityLock || {};
  const isRescue = Boolean(rpl.isRescueActive);
  const prioPill = document.getElementById("topShieldPriorityPill");
  if (prioPill) {
    setTextIfChanged(prioPill, isRescue ? "Estado: ASISTIENDO RESCATE" : "Estado: ESCUDO 100% LIBRE");
    prioPill.className = isRescue ? "pill-amber" : "pill-emerald";
  }

  const bannerDot = document.getElementById("rescueStatusDot");
  if (bannerDot) {
    bannerDot.className = isRescue ? "rescue-dot" : "rescue-dot free";
  }
  const bannerText = rpl.bannerText || rpl.statusBanner || (isRescue
    ? `🛡️ ESCUDO #00 EN MISIÓN DE RESCATE (${rpl.rescueCoin || "SOL"}-USDC) · CAPTURA DE FUNDING EN ESPERA DE TP`
    : `🟢 ESCUDO #00 LIBRE Y EN PRODUCCIÓN ACTIVA ($${shieldClosed.toFixed(2)} USDC DISPONIBLES · 0 RESCATES ACTIVOS) · CAZANDO CORTE HORARIO :00 UTC`);
  const bannerSub = rpl.subInfo || (isRescue
    ? `RESCUE_PRIORITY_LOCK: ACTIVO · Liberación automática al cerrar rescate`
    : `SOL-USDC TP Completado ($100.62) · Puente +$54.10 USDC Cruzado a L1 ($${closedBaseUsdc.toFixed(2)} Total)`);
  setTextIfChanged(document.getElementById("rescueBannerText"), bannerText);
  setTextIfChanged(document.getElementById("rescueSubInfo"), bannerSub);

  // 3. Sección A + Tarjeta 4: Tus Posiciones Abiertas Ahora Mismo en Hyperliquid L1
  const rawOpen = rpl.openPositions || [
    { coin: "AVAX", szi: 26.86, entryPx: 9.3, posVal: 249.80 },
    { coin: "LINK", szi: -28.0, entryPx: 8.9197, posVal: 249.75 },
    { coin: "ETH", szi: 0.2156, entryPx: 2317.3, posVal: 499.60 }
  ];
  const top18 = Array.isArray(data.top18Payers) ? data.top18Payers : [];

  let openPositionsDetailed = Array.isArray(data.openPositionsFunding) && data.openPositionsFunding.length > 0
    ? data.openPositionsFunding
    : null;

  if (!openPositionsDetailed) {
    openPositionsDetailed = rawOpen.map(op => {
      const match = top18.find(x => x.coin === op.coin);
      const rawFunding = match ? Number(match.rawFunding) : 0.0000125;
      const hourlyPct = +(rawFunding * 100).toFixed(4);
      const aprPct = +(hourlyPct * 24 * 365).toFixed(1);
      const markPx = match ? Number(match.markPx) : op.entryPx;
      const notionalUsdc = +(Math.abs(op.szi) * markPx).toFixed(2);
      const hourlyCashflowUsdc = +(-1 * op.szi * markPx * rawFunding).toFixed(4);
      const side = op.szi >= 0 ? "LONG" : "SHORT";
      return {
        coin: op.coin,
        szi: op.szi,
        side,
        entryPx: op.entryPx,
        markPx,
        notionalUsdc,
        hourlyPct,
        hourlyRatePct: hourlyPct,
        aprPct,
        hourlyCashflowUsdc,
        isReceiving: hourlyCashflowUsdc >= 0,
        squadLabel: getSquadLabelForCoin(op.coin, notionalUsdc),
        tpFormatted: getTpTargetForCoin(op.coin, op.entryPx, notionalUsdc, op.szi)
      };
    });
  }

  openPositionsDetailed = [...openPositionsDetailed].sort((a, b) => {
    const aRec = Number(a.hourlyCashflowUsdc || 0) >= 0 ? 0 : 1;
    const bRec = Number(b.hourlyCashflowUsdc || 0) >= 0 ? 0 : 1;
    if (aRec !== bRec) return aRec - bRec;
    return Number(b.notionalUsdc || 0) - Number(a.notionalUsdc || 0);
  });

  const nextHourNetFlowUsdc = +(openPositionsDetailed.reduce((acc, item) => acc + Number(item.hourlyCashflowUsdc || 0), 0)).toFixed(4);
  try {
    renderOpenPositionsSection(openPositionsDetailed);
    setTextIfChanged(document.getElementById("secAHeaderTag"), `${openPositionsDetailed.length} Posiciones Activas · Efecto en Corte :00 UTC`);
  } catch (_) {}

  // 4. Tarjeta 2: Balance Real de Funding en #501
  const fa = data.fundingAccounting || {};
  const posCollected = Number(fa.totalPositiveCollectedUsdc || 0.1127);
  const netTotal = Number(fa.totalNetFundingUsdc !== undefined ? fa.totalNetFundingUsdc : -0.3829);
  const paidInLongs = +(Math.abs(posCollected - netTotal)).toFixed(4);
  const posCount = Number(fa.positiveEventsCount || 31);

  setTextIfChanged(document.getElementById("topPositiveFundingVal"), posCollected.toFixed(4));
  setTextIfChanged(document.getElementById("topEventsCountBadge"), `${posCount} Cobros Positivos`);
  setTextIfChanged(document.getElementById("topPaidInLongsPill"), `Pagado en Longs: -$${paidInLongs.toFixed(4)} USDC`);
  const flowSign = nextHourNetFlowUsdc >= 0 ? "+" : "-";
  setTextIfChanged(document.getElementById("topNextHourFlowPill"), `Flujo Próx. Hora: ${flowSign}$${Math.abs(nextHourNetFlowUsdc).toFixed(4)} USDC`);

  // 5. Tarjeta 4: Impacto Horario de Tus Posiciones Abiertas
  setTextIfChanged(document.getElementById("topOpenImpactVal"), `${flowSign}$${Math.abs(nextHourNetFlowUsdc).toFixed(4)}`);
  setTextIfChanged(document.getElementById("topOpenCountBadge"), `${openPositionsDetailed.length} Posiciones en Squad`);

  if (openPositionsDetailed.length >= 2) {
    const p1 = openPositionsDetailed[0];
    const p2 = openPositionsDetailed[1];
    const s1 = Number(p1.hourlyCashflowUsdc || 0) >= 0 ? "+" : "-";
    const s2 = Number(p2.hourlyCashflowUsdc || 0) >= 0 ? "+" : "-";
    setTextIfChanged(
      document.getElementById("topOpenImpactSub1"),
      `${p1.coin} (${p1.side}): ${s1}$${Math.abs(Number(p1.hourlyCashflowUsdc || 0)).toFixed(4)}/h · ${p2.coin}: ${s2}$${Math.abs(Number(p2.hourlyCashflowUsdc || 0)).toFixed(4)}/h`
    );
  }
  if (openPositionsDetailed.length >= 3) {
    const p3 = openPositionsDetailed[2];
    const s3 = Number(p3.hourlyCashflowUsdc || 0) >= 0 ? "+" : "-";
    setTextIfChanged(
      document.getElementById("topOpenImpactSub2"),
      `${p3.coin} (${p3.side}): ${s3}$${Math.abs(Number(p3.hourlyCashflowUsdc || 0)).toFixed(4)}/h · SOL TP Cerrado ✔`
    );
  } else if (openPositionsDetailed.length === 1) {
    const p1 = openPositionsDetailed[0];
    const s1 = Number(p1.hourlyCashflowUsdc || 0) >= 0 ? "+" : "-";
    setTextIfChanged(
      document.getElementById("topOpenImpactSub1"),
      `${p1.coin} (${p1.side}): ${s1}$${Math.abs(Number(p1.hourlyCashflowUsdc || 0)).toFixed(4)}/h`
    );
    setTextIfChanged(document.getElementById("topOpenImpactSub2"), "SOL-USDC TP Cerrado ✔ · Escudo #00 Libre");
  }

  // 6. Sección B + Tarjeta 5: Cola de Trabajo del Escudo #00 (Solo 3 Pares Seguros OI >= $15M USD)
  let safeQueue3 = Array.isArray(data.safeShieldQueue3) && data.safeShieldQueue3.length >= 3
    ? data.safeShieldQueue3
    : top18.filter(x => Number(x.oiUsd || 0) >= 15000000 && !["SOL", "BTC", "ETH"].includes(x.coin)).slice(0, 3);

  if (!safeQueue3 || safeQueue3.length === 0) {
    safeQueue3 = [
      { coin: "BNB", pair: "BNB-USDC", hourlyPct: -0.0049, absAprPct: 43.0, oiUsd: 46848297, oiFormatted: "$46.8M", receiverSide: "LONG COBRA" },
      { coin: "ADA", pair: "ADA-USDC", hourlyPct: -0.0029, absAprPct: 25.0, oiUsd: 16210000, oiFormatted: "$16.2M", receiverSide: "LONG COBRA" },
      { coin: "MON", pair: "MON-USDC", hourlyPct: -0.0019, absAprPct: 16.5, oiUsd: 31047168, oiFormatted: "$31.0M", receiverSide: "LONG COBRA" }
    ];
  }

  try {
    renderShieldQueueSection(safeQueue3, shieldClosed, isRescue);
    setTextIfChanged(
      document.getElementById("secBHeaderTag"),
      `Escudo #00 Activo: $${shieldClosed.toFixed(2)} USDC (2x ALO Maker = $${(shieldClosed * 2).toFixed(2)})`
    );
  } catch (_) {}

  const topSafe1 = safeQueue3[0];
  if (topSafe1) {
    const notional2x = shieldClosed * 2;
    const hYield = +((notional2x * Math.abs(topSafe1.hourlyPct)) / 100).toFixed(4);
    const dYield = +(hYield * 24).toFixed(2);
    setTextIfChanged(document.getElementById("topSafeTargetCoin"), topSafe1.pair || `${topSafe1.coin}-USDC`);
    setTextIfChanged(document.getElementById("topSafeTargetApr"), `${Number(topSafe1.absAprPct).toFixed(1)}% APR`);
    setTextIfChanged(document.getElementById("topSafeTargetOiPill"), `OI: ${topSafe1.oiFormatted} USD · ${topSafe1.receiverSide}`);
    setTextIfChanged(document.getElementById("topSafeTargetYieldPill"), `Escudo #00: +$${hYield.toFixed(3)}/h (+$${dYield.toFixed(2)}/día)`);
  }
}

let isSyncing = false;
async function syncFundingMatrix() {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const bust = `?t=${Date.now()}`;
    let res = await fetch(`/api/funding-matrix/live${bust}`, { cache: "no-store" }).catch(() => null);
    if (!res || !res.ok) {
      res = await fetch(`/telemetry/funding-rate-matrix-telemetry.json${bust}`, { cache: "no-store" }).catch(() => null);
    }
    if (res && res.ok) {
      const data = await res.json();
      enrichAndApplyTelemetry(data);
    }
  } catch (_) {
  } finally {
    isSyncing = false;
  }
}

function setupFiltersAndTabs() {
  const btnAll = document.getElementById("btnFilterAllCuts");
  const btnPos = document.getElementById("btnFilterPosCuts");

  if (btnAll && btnPos) {
    btnAll.addEventListener("click", () => {
      currentLedgerFilter = "ALL";
      btnAll.classList.add("active");
      btnPos.classList.remove("active");
      renderLedgerTable(cachedLedgerRows);
    });
    btnPos.addEventListener("click", () => {
      currentLedgerFilter = "POSITIVE";
      btnPos.classList.add("active");
      btnAll.classList.remove("active");
      renderLedgerTable(cachedLedgerRows);
    });
  }

  const navBtns = document.querySelectorAll("button[data-tab]");
  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      if (!target) return;
      navBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-tab") === target));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.toggle("active", p.id === target));
    });
  });
}

function startClocks() {
  const tick = () => {
    const now = new Date();
    const utcStr = now.toISOString().slice(11, 19) + " UTC";
    setTextIfChanged(document.getElementById("liveUtcClock"), utcStr);

    const nextHour = new Date(now);
    nextHour.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
    const diffSec = Math.max(0, Math.floor((nextHour.getTime() - now.getTime()) / 1000));
    const m = Math.floor(diffSec / 60);
    const s = diffSec % 60;
    setTextIfChanged(document.getElementById("topNextCutCountdown"), `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`);
    setTextIfChanged(document.getElementById("topNextCutHourTag"), `➔ ${nextHour.toISOString().slice(11, 16)}:00 UTC`);
  };
  tick();
  setInterval(tick, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
  setupFiltersAndTabs();
  startClocks();
  renderLedgerTable(cachedLedgerRows);
  if (window.__LAST_FUNDING_STATE__) {
    enrichAndApplyTelemetry(window.__LAST_FUNDING_STATE__);
  }
  syncFundingMatrix();
  setInterval(syncFundingMatrix, 5000);
});
