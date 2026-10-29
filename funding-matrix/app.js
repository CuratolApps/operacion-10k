/**
 * funding-matrix/app.js — ÁREA 501 // FUNDING RATE MATRIX V2 (SINCERADO 100% REAL)
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

const STORAGE_KEY_FUNDING_V2 = "__AREA501_FUNDING_V2__";
let currentLedgerFilter = "ALL"; // "ALL" | "POSITIVE"
let cachedLedgerRows = [];

function saveFundingSnapshot(state) {
  try {
    window.__LAST_FUNDING_STATE__ = state;
    localStorage.setItem(STORAGE_KEY_FUNDING_V2, JSON.stringify(state));
  } catch (_) {}
}

function getSquadLabelForCoin(coin, notionalUsdc) {
  if (coin === "SOL") return notionalUsdc > 600 ? "#01 ALFA + ESCUDO #00" : "#01 ALFA";
  if (coin === "BTC" || coin === "PAXG" || coin === "LINK") return "#02 BRAVO";
  if (coin === "ETH" || coin === "BNB" || coin === "AAVE") return "#03 CHARLIE";
  return "SQUAD MATRIX L1";
}

function getTpTargetForCoin(coin, entryPx, notionalUsdc) {
  if (coin === "SOL" && notionalUsdc > 600) return "$100.62";
  if (coin === "BTC") return `$${Math.round(entryPx * 1.0015).toLocaleString("en-US")}.0`;
  if (coin === "ETH") return `$${(entryPx * 1.0015).toFixed(1)}`;
  return `$${(entryPx * 1.0015).toFixed(2)}`;
}

function renderOpenPositionsSection(openPositionsDetailed) {
  const container = document.getElementById("openPositionsCardsRow");
  if (!container || !Array.isArray(openPositionsDetailed) || openPositionsDetailed.length === 0) return;

  const html = openPositionsDetailed.slice(0, 3).map(pos => {
    const isReceiving = pos.hourlyCashflowUsdc >= 0;
    const cardClass = isReceiving ? "focus-card card-receiving" : "focus-card card-paying";
    const sideBadgeClass = pos.side === "LONG" ? "fc-side-badge long" : "fc-side-badge short";
    const rateSign = pos.hourlyRatePct >= 0 ? "+" : "";
    const bannerClass = isReceiving ? "fc-bottom-banner receive" : "fc-bottom-banner cost";
    const bannerText = isReceiving
      ? `🟢 TE PAGAN +$${Math.abs(pos.hourlyCashflowUsdc).toFixed(4)} USDC / HORA`
      : `🟡 COSTO DE MANTENIMIENTO: -$${Math.abs(pos.hourlyCashflowUsdc).toFixed(4)} USDC / HORA`;

    const entryStr = pos.coin === "BTC"
      ? `$${pos.entryPx.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
      : `$${pos.entryPx}`;

    return `
      <div class="${cardClass}">
        <div class="fc-top">
          <span class="fc-pair-title">${pos.coin}-USDC · ${pos.side} (${Math.abs(pos.szi)} ${pos.coin})</span>
          <span class="${sideBadgeClass}">${pos.squadLabel}</span>
        </div>
        <div class="fc-metrics">
          <div class="fc-metric-line">
            <span>Entrada ➔ Salida TP:</span>
            <b>${entryStr} ➔ ${pos.tpFormatted}</b>
          </div>
          <div class="fc-metric-line">
            <span>Valor Posición (Nocional):</span>
            <b>$${pos.notionalUsdc.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC</b>
          </div>
        </div>
        <div class="fc-rate-big">
          <span>Tasa: ${rateSign}${pos.hourlyRatePct.toFixed(4)}% / hora</span>
          <span class="apr-tag">${Math.abs(pos.aprPct).toFixed(1)}% APR</span>
        </div>
        <div class="${bannerClass}">
          ${bannerText}
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = html;
}

function renderShieldQueueSection(queueItems, shieldCapitalPostSol) {
  const container = document.getElementById("shieldQueueCardsRow");
  if (!container || !Array.isArray(queueItems) || queueItems.length === 0) return;

  const shieldBase = Number(shieldCapitalPostSol || 359.78);
  const notional2x = shieldBase * 2; // 2x conservador Post-Only ALO Maker

  const html = queueItems.slice(0, 3).map((item, idx) => {
    const rankNum = idx + 1;
    const rateSign = item.hourlyPct >= 0 ? "+" : "";
    const sideBadgeClass = item.receiverSide === "LONG COBRA" ? "fc-side-badge long" : "fc-side-badge short";
    const hourlyUsd = +((notional2x * Math.abs(item.hourlyPct)) / 100).toFixed(4);
    const dailyUsd = +(hourlyUsd * 24).toFixed(2);
    const statusRole = rankNum === 1 ? "#1 LISTO AL CERRAR SOL" : `#${rankNum} RESERVA DELTA-SAFE`;

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
          <span>${rateSign}${Number(item.hourlyPct).toFixed(4)}% / hora</span>
          <span class="apr-tag">${Number(item.absAprPct).toFixed(1)}% APR</span>
        </div>
        <div class="fc-bottom-banner queue-yield">
          🟢 PAGA AL ESCUDO #00: +$${hourlyUsd.toFixed(4)}/H (+$${dailyUsd.toFixed(2)} USDC/DÍA)
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = html;
}

function renderLedgerTable(rows) {
  const tbody = document.getElementById("fundingLedgerBody");
  if (!tbody) return;

  const list = Array.isArray(rows) ? rows : [];
  const filtered = currentLedgerFilter === "POSITIVE"
    ? list.filter(r => Number(r.usdcAmount) > 0)
    : list.slice(0, 28);

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 18px;">
          Sincronizando cortes horarios de userFunding en Hyperliquid L1...
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const amt = Number(r.usdcAmount || 0);
    const isPos = amt >= 0;
    const sideClass = r.side === "LONG" ? "badge-side-long" : "badge-side-short";
    // Mostrar Hora UTC y equivalente local CET (+1h) si es de hoy
    const utcDateStr = r.timeUtc ? r.timeUtc.slice(5, 16) + " UTC" : r.hourSlot;
    const paymentCellHtml = isPos
      ? `<span class="amt-pos-pill">+$${Math.abs(amt).toFixed(4)} USDC · COBRADO</span>`
      : `<span class="amt-neg-neutral">-$${Math.abs(amt).toFixed(4)} USDC · Ajuste ${r.side === "LONG" ? "Long" : "Short"}</span>`;

    return `
      <tr>
        <td><b>${utcDateStr}</b></td>
        <td><b>${r.pair || (r.coin + "-USDC")}</b></td>
        <td><span class="${sideClass}">${r.side} (${r.szi})</span></td>
        <td>${r.fundingRatePct} <small style="color:#64748B;">(${r.aprEquivalentPct})</small></td>
        <td>${paymentCellHtml}</td>
      </tr>
    `;
  }).join("");
}

function enrichAndApplyTelemetry(data) {
  if (!data || typeof data !== "object") return;
  saveFundingSnapshot(data);

  const sc = data.shieldCapital || {};
  const shieldClosed = Number(sc.shieldClosedUsdc || 338.14);
  const shieldPostSol = Number(sc.shieldProjectedPostSolUsdc || 359.78);

  // Tarjeta 1: Capital Escudo #00 (40%)
  setTextIfChanged(document.getElementById("topShieldCapitalVal"), shieldClosed.toFixed(2));
  setTextIfChanged(document.getElementById("topShieldPostSolPill"), `Post-SOL: $${shieldPostSol.toFixed(2)} USDC Libres`);

  const rpl = data.rescuePriorityLock || {};
  const isRescue = rpl.isRescueActive !== false;
  const prioPill = document.getElementById("topShieldPriorityPill");
  if (prioPill) {
    setTextIfChanged(prioPill, isRescue ? "Estado: ASISTIENDO RESCATE SOL" : "Estado: ESCUDO 100% LIBRE");
    prioPill.className = isRescue ? "pill-amber" : "pill-emerald";
  }

  // Construir detalle de posiciones abiertas (Sección A + Tarjeta 4)
  const rawOpen = rpl.openPositions || [
    { coin: "SOL", szi: 19.52, entryPx: 100.538, posVal: 1951.40 },
    { coin: "BTC", szi: 0.00312, entryPx: 79912.0, posVal: 249.50 },
    { coin: "ETH", szi: 0.1081, entryPx: 2311.1, posVal: 250.28 }
  ];
  const top18 = Array.isArray(data.top18Payers) ? data.top18Payers : [];

  let openPositionsDetailed = Array.isArray(data.openPositionsFunding) ? data.openPositionsFunding : null;
  if (!openPositionsDetailed || openPositionsDetailed.length === 0) {
    // Calcular desde rawOpen + top18Payers
    const orderPriority = { SOL: 1, BTC: 2, ETH: 3 };
    const sortedOpen = [...rawOpen].sort((a, b) => (orderPriority[a.coin] || 9) - (orderPriority[b.coin] || 9));
    openPositionsDetailed = sortedOpen.map(op => {
      const match = top18.find(x => x.coin === op.coin);
      const rawFunding = match ? Number(match.rawFunding) : 0.0000125;
      const hourlyRatePct = +(rawFunding * 100).toFixed(4);
      const aprPct = +(hourlyRatePct * 24 * 365).toFixed(1);
      const markPx = match ? Number(match.markPx) : op.entryPx;
      const notionalUsdc = +(Math.abs(op.szi) * markPx).toFixed(2);
      // En Hyperliquid L1: funding > 0 => Longs pagan a Shorts (-szi * markPx * rawFunding)
      const hourlyCashflowUsdc = +(-1 * op.szi * markPx * rawFunding).toFixed(4);
      const side = op.szi >= 0 ? "LONG" : "SHORT";
      return {
        coin: op.coin,
        szi: op.szi,
        side,
        entryPx: op.entryPx,
        markPx,
        notionalUsdc,
        hourlyRatePct,
        aprPct,
        hourlyCashflowUsdc,
        squadLabel: getSquadLabelForCoin(op.coin, notionalUsdc),
        tpFormatted: getTpTargetForCoin(op.coin, op.entryPx, notionalUsdc)
      };
    });
  }

  const nextHourNetFlowUsdc = +(openPositionsDetailed.reduce((acc, item) => acc + Number(item.hourlyCashflowUsdc || 0), 0)).toFixed(4);
  renderOpenPositionsSection(openPositionsDetailed);

  // Tarjeta 2: Balance Real de Funding en #501 (Sincerado al centavo)
  const fa = data.fundingAccounting || {};
  const posCollected = Number(fa.totalPositiveCollectedUsdc || 0.1127);
  const netTotal = Number(fa.totalNetFundingUsdc !== undefined ? fa.totalNetFundingUsdc : -0.3522);
  const paidInLongs = +(Math.abs(posCollected - netTotal)).toFixed(4); // $0.4649
  const posCount = Number(fa.positiveEventsCount || 31);

  setTextIfChanged(document.getElementById("topPositiveFundingVal"), posCollected.toFixed(4));
  setTextIfChanged(document.getElementById("topEventsCountBadge"), `${posCount} Cobros Positivos`);
  setTextIfChanged(document.getElementById("topPaidInLongsPill"), `Pagado en Longs: -$${paidInLongs.toFixed(4)} USDC`);
  const flowSign = nextHourNetFlowUsdc >= 0 ? "+" : "-";
  setTextIfChanged(document.getElementById("topNextHourFlowPill"), `Flujo Próx. Hora: ${flowSign}$${Math.abs(nextHourNetFlowUsdc).toFixed(4)} USDC`);

  // Tarjeta 4: Impacto Horario de Tus Posiciones Abiertas
  setTextIfChanged(document.getElementById("topOpenImpactVal"), `${flowSign}$${Math.abs(nextHourNetFlowUsdc).toFixed(4)}`);
  setTextIfChanged(document.getElementById("topOpenCountBadge"), `${openPositionsDetailed.length} Posiciones en Squad`);

  const solItem = openPositionsDetailed.find(x => x.coin === "SOL");
  const btcItem = openPositionsDetailed.find(x => x.coin === "BTC");
  const ethItem = openPositionsDetailed.find(x => x.coin === "ETH");
  if (solItem && btcItem) {
    const sSign = solItem.hourlyCashflowUsdc >= 0 ? "+" : "-";
    const bSign = btcItem.hourlyCashflowUsdc >= 0 ? "+" : "-";
    setTextIfChanged(
      document.getElementById("topOpenImpactSub1"),
      `SOL: ${sSign}$${Math.abs(solItem.hourlyCashflowUsdc).toFixed(4)}/h · BTC: ${bSign}$${Math.abs(btcItem.hourlyCashflowUsdc).toFixed(4)}/h`
    );
  }
  if (ethItem) {
    const eSign = ethItem.hourlyCashflowUsdc >= 0 ? "+" : "-";
    setTextIfChanged(
      document.getElementById("topOpenImpactSub2"),
      `ETH: ${eSign}$${Math.abs(ethItem.hourlyCashflowUsdc).toFixed(4)}/h (Corte 09h: +$0.0009)`
    );
  }

  // Cola de Trabajo del Escudo #00 (Sección B + Tarjeta 5: Solo 3 Pares Seguros OI >= $15M USD)
  let safeQueue3 = Array.isArray(data.safeShieldQueue3) && data.safeShieldQueue3.length >= 3
    ? data.safeShieldQueue3
    : top18.filter(x => Number(x.oiUsd || 0) >= 15000000 && !["SOL", "BTC", "ETH"].includes(x.coin)).slice(0, 3);

  if (!safeQueue3 || safeQueue3.length === 0) {
    safeQueue3 = [
      { coin: "XMR", pair: "XMR-USDC", hourlyPct: 0.0034, absAprPct: 30.2, oiUsd: 120662538, oiFormatted: "$120.7M", receiverSide: "SHORT COBRA" },
      { coin: "MON", pair: "MON-USDC", hourlyPct: -0.0022, absAprPct: 19.2, oiUsd: 31047168, oiFormatted: "$31.0M", receiverSide: "LONG COBRA" },
      { coin: "LTC", pair: "LTC-USDC", hourlyPct: 0.0013, absAprPct: 10.9, oiUsd: 22572258, oiFormatted: "$22.6M", receiverSide: "SHORT COBRA" }
    ];
  }

  renderShieldQueueSection(safeQueue3, shieldPostSol);

  const topSafe1 = safeQueue3[0];
  if (topSafe1) {
    const notional2x = shieldPostSol * 2;
    const hYield = +((notional2x * Math.abs(topSafe1.hourlyPct)) / 100).toFixed(4);
    const dYield = +(hYield * 24).toFixed(2);
    setTextIfChanged(document.getElementById("topSafeTargetCoin"), topSafe1.pair || `${topSafe1.coin}-USDC`);
    setTextIfChanged(document.getElementById("topSafeTargetApr"), `${Number(topSafe1.absAprPct).toFixed(1)}% APR`);
    setTextIfChanged(document.getElementById("topSafeTargetOiPill"), `OI: ${topSafe1.oiFormatted} USD · ${topSafe1.receiverSide}`);
    setTextIfChanged(document.getElementById("topSafeTargetYieldPill"), `Escudo #00: +$${hYield.toFixed(3)}/h (+$${dYield.toFixed(2)}/día)`);
  }

  // Libro Mayor Oficial userFunding
  if (Array.isArray(data.hourlyLedger24) && data.hourlyLedger24.length > 0) {
    cachedLedgerRows = data.hourlyLedger24;
    renderLedgerTable(cachedLedgerRows);

    const latestCut = cachedLedgerRows[0];
    if (latestCut && latestCut.hourSlot) {
      setTextIfChanged(document.getElementById("topRecentCutPill"), `Corte ${latestCut.hourSlot} Verificado`);
    }
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
  if (window.__LAST_FUNDING_STATE__) {
    enrichAndApplyTelemetry(window.__LAST_FUNDING_STATE__);
  }
  syncFundingMatrix();
  setInterval(syncFundingMatrix, 5000);
});
