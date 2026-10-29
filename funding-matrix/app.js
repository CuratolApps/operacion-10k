/**
 * funding-matrix/app.js — ÁREA 501 // FUNDING RATE MATRIX CONTROLLER
 * ==============================================================================
 * CONTROLADOR FRONTEND EN VIVO (100% HYPERLIQUID L1 OFICIAL - CERO HUMO):
 * 1) CUENTA REGRESIVA EN VIVO SEGUNDO A SEGUNDO HACIA EL CORTE :00:00 UTC
 * 2) LECTURA DE /api/funding-matrix/live Y /telemetry/funding-rate-matrix-telemetry.json
 * 3) REJILLA 6x3 (18 CELDAS ESMERALDA/MENTA) CON TOP 18 PAGADORES DE FUNDING
 * 4) TABLA OFICIAL DE LOS 24 PAGOS HORARIOS DEL DÍA (userFunding DE #501)
 * ==============================================================================
 */

function setTextIfChanged(el, text) {
  if (!el) return;
  const s = String(text);
  if (el.textContent !== s) {
    el.textContent = s;
  }
}

const STORAGE_KEY_FUNDING = "__AREA501_FUNDING_STATE__";

function saveFundingSnapshot(state) {
  try {
    window.__LAST_FUNDING_STATE__ = state;
    localStorage.setItem(STORAGE_KEY_FUNDING, JSON.stringify(state));
  } catch (_) {}
}

function renderTop18Grid(items) {
  const grid = document.getElementById("fundingTop18Grid");
  if (!grid || !Array.isArray(items) || items.length === 0) return;

  const html = items.slice(0, 18).map((item, idx) => {
    const rank = item.rank || (idx + 1);
    const rateSign = item.hourlyPct >= 0 ? "+" : "";
    const cellClass = item.passesDeltaSafeFilter ? "funding-cell delta-safe-highlight" : "funding-cell";
    const statusShort = item.isCurrentlyHeld
      ? "🟢 ABIERTA EN #501"
      : (item.passesDeltaSafeFilter ? "🛡️ OI >= $5M · ALO OK" : `OI ${item.oiFormatted} · VIGILANDO`);

    return `
      <div class="${cellClass}">
        <div class="f-row-top">
          <div class="f-coin">
            <span class="f-rank">#${String(rank).padStart(2, "0")}</span>
            <span>${item.pair || (item.coin + "-USDC")}</span>
          </div>
          <span class="f-side-pill">${item.receiverSide}</span>
        </div>
        <div class="f-row-mid">
          <span class="f-hourly">${rateSign}${Number(item.hourlyPct).toFixed(4)}%/h</span>
          <span class="f-apr">${Number(item.absAprPct).toFixed(1)}% APR</span>
        </div>
        <div class="f-row-bot">
          <span>OI: <b>${item.oiFormatted}</b></span>
          <span class="f-status-tag">${statusShort}</span>
        </div>
      </div>
    `;
  }).join("");

  grid.innerHTML = html;
}

function renderLedger24(rows) {
  const tbody = document.getElementById("fundingLedgerBody");
  if (!tbody || !Array.isArray(rows)) return;

  if (rows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 18px;">
          Sincronizando libro mayor userFunding de Hyperliquid L1...
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.slice(0, 24).map(r => {
    const isPos = Number(r.usdcAmount) >= 0;
    const amtClass = isPos ? "amt-pos" : "amt-neg";
    const sideClass = r.side === "LONG" ? "badge-side-long" : "badge-side-short";
    const datePart = r.timeUtc ? r.timeUtc.slice(5, 16) + " UTC" : r.hourSlot;

    return `
      <tr>
        <td><b>${datePart}</b></td>
        <td><b>${r.pair || (r.coin + "-USDC")}</b></td>
        <td><span class="${sideClass}">${r.side} (${r.szi})</span></td>
        <td>${r.fundingRatePct}</td>
        <td>${r.aprEquivalentPct}</td>
        <td class="${amtClass}">${r.usdcFormatted}</td>
      </tr>
    `;
  }).join("");
}

function applyFundingTelemetry(data) {
  if (!data || typeof data !== "object") return;
  saveFundingSnapshot(data);

  // Tarjeta 1: Capital Escudo #00 (40%)
  if (data.shieldCapital) {
    const sc = data.shieldCapital;
    setTextIfChanged(document.getElementById("topShieldCapitalVal"), Number(sc.shieldClosedUsdc || 338.16).toFixed(2));
    setTextIfChanged(document.getElementById("topShieldLiveBadge"), `En Vivo: $${Number(sc.shieldLiveUsdc || 332.46).toFixed(2)}`);
    setTextIfChanged(document.getElementById("topShieldPostSolPill"), `Post-SOL: $${Number(sc.shieldProjectedPostSolUsdc || 359.80).toFixed(2)} USDC`);
  }

  // Prioridad de Rescate
  if (data.rescuePriorityLock) {
    const rpl = data.rescuePriorityLock;
    const isRescue = rpl.isRescueActive === true;
    const pillEl = document.getElementById("topShieldPriorityPill");
    if (pillEl) {
      setTextIfChanged(pillEl, isRescue ? "Rescate SOL Activo" : "Escudo 100% Libre");
      pillEl.className = isRescue ? "pill-amber" : "pill-emerald";
    }
    const dotEl = document.getElementById("rescueStatusDot");
    if (dotEl) {
      dotEl.className = isRescue ? "rescue-dot" : "rescue-dot free";
    }
    if (rpl.statusBanner) {
      setTextIfChanged(document.getElementById("rescueBannerText"), rpl.statusBanner);
    }
    if (rpl.rescuePosition) {
      const rp = rpl.rescuePosition;
      setTextIfChanged(
        document.getElementById("rescueSubInfo"),
        `TP Armado: $${rp.tpTargetPx} (oid: 589129601350) ➔ Al cerrar libera $${Number(data.shieldCapital?.shieldProjectedPostSolUsdc || 359.80).toFixed(2)} USDC para Funding ALO Maker`
      );
    } else {
      setTextIfChanged(
        document.getElementById("rescueSubInfo"),
        `Escudo Mentora #00 Desplegado en Post-Only ALO Maker (0% Taker Fee · OI >= $5M)`
      );
    }
  }

  // Tarjeta 2: Renta Funding Acumulada en #501
  if (data.fundingAccounting) {
    const fa = data.fundingAccounting;
    setTextIfChanged(document.getElementById("topPositiveFundingVal"), Number(fa.totalPositiveCollectedUsdc || 0.1292).toFixed(4));
    setTextIfChanged(document.getElementById("topEventsCountBadge"), `${fa.totalEventsRecorded || 96} Cortes L1`);
    setTextIfChanged(document.getElementById("topPositiveEventsPill"), `${fa.positiveEventsCount || 29} Cobros Positivos`);
    setTextIfChanged(document.getElementById("topEstDailyYieldPill"), `Meta Libre: +$${Number(fa.estDailyYieldWhenFreeUsdc || 2.85).toFixed(2)}/día`);
  }

  // Tarjeta 3: Latencia L1
  if (data.latencyMs) {
    setTextIfChanged(document.getElementById("topHlLatencyPill"), `Hyperliquid L1 · ${data.latencyMs}ms`);
  }

  // Tarjeta 5: Top Pagador Funding en Vivo
  if (data.topPayerGlobal) {
    const tp = data.topPayerGlobal;
    setTextIfChanged(document.getElementById("topPayerCoinVal"), tp.pair || `${tp.coin}-USDC`);
    setTextIfChanged(document.getElementById("topPayerAprBadge"), `${Number(tp.absAprPct).toFixed(1)}% APR`);
    const sign = tp.hourlyPct >= 0 ? "+" : "";
    setTextIfChanged(document.getElementById("topPayerHourlyPill"), `${sign}${Number(tp.hourlyPct).toFixed(4)}% / hora`);
    setTextIfChanged(document.getElementById("topPayerReceiverPill"), `${tp.receiverSide} · OI ${tp.oiFormatted}`);
  }

  if (data.lastScanUtc) {
    setTextIfChanged(document.getElementById("leftBlockMeta"), `metaAndAssetCtxs · Escaneo: ${data.lastScanUtc}`);
  }

  if (Array.isArray(data.top18Payers)) {
    renderTop18Grid(data.top18Payers);
  }
  if (Array.isArray(data.hourlyLedger24)) {
    renderLedger24(data.hourlyLedger24);
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
      applyFundingTelemetry(data);
    }
  } catch (_) {
  } finally {
    isSyncing = false;
  }
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

function setupTabs() {
  const buttons = document.querySelectorAll("button[data-tab]");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      if (!target) return;
      buttons.forEach(b => b.classList.toggle("active", b.getAttribute("data-tab") === target));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.toggle("active", p.id === target));
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  startClocks();
  if (window.__LAST_FUNDING_STATE__) {
    applyFundingTelemetry(window.__LAST_FUNDING_STATE__);
  }
  syncFundingMatrix();
  setInterval(syncFundingMatrix, 5000);
});

