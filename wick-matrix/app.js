/**
 * wick-matrix/app.js — ÁREA 501 // ESTACIÓN #06 · WICK SNIPER & PAIRS ARBITRAGE L1
 */
(function () {
  function updateUtcClock() {
    const el = document.getElementById("wickClockUtc");
    if (el) {
      el.textContent = new Date().toISOString().slice(11, 19) + " UTC";
    }
  }
  setInterval(updateUtcClock, 1000);
  updateUtcClock();

  async function syncWickTelemetry() {
    try {
      const bust = `?t=${Date.now()}`;
      let res = await fetch(`/api/wick-matrix/live${bust}`, { cache: "no-store" }).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch(`/telemetry/wick-sniper-telemetry.json${bust}`, { cache: "no-store" }).catch(() => null);
      }
      if (!res || !res.ok) return;
      const data = await res.json();
      if (!data) return;

      if (data.shieldFreeMarginUsdc) {
        const sEl = document.getElementById("kpiShieldFree");
        if (sEl) sEl.textContent = `$${Number(data.shieldFreeMarginUsdc).toFixed(2)} USDC`;
      }
      if (data.accountValue) {
        const eqEl = document.getElementById("kpiEquityTotal");
        if (eqEl) eqEl.textContent = `Patrimonio L1: $${Number(data.accountValue).toFixed(2)}`;
      }

      if (Array.isArray(data.wickTraps) && data.wickTraps.length > 0) {
        const tbody = document.getElementById("wickTrapsTableBody");
        if (tbody) {
          tbody.innerHTML = data.wickTraps.map(t => `
            <tr>
              <td><b>${t.coin}</b></td>
              <td>$${t.midPx}</td>
              <td style="color:#38bdf8;">$${t.buyTrapAlo}</td>
              <td style="color:#00ff88;">$${t.reboundTpLong}</td>
              <td style="color:#f59e0b;">$${t.sellTrapAlo}</td>
              <td style="color:#00ff88;font-weight:700;">+$${Number(t.estNetGainUsdc || 0.78).toFixed(2)} USDC</td>
              <td><span class="badge-green">TRAMPA ALO ACTIVA</span></td>
            </tr>
          `).join("");
        }
      }

      if (Array.isArray(data.twinPairsLive) && data.twinPairsLive.length > 0) {
        const tbody2 = document.getElementById("twinPairsTableBody");
        if (tbody2) {
          tbody2.innerHTML = data.twinPairsLive.map(p => `
            <tr>
              <td><b>${p.pairA} / ${p.pairB}</b></td>
              <td>${p.corr}</td>
              <td>$${p.pxA} / $${p.pxB}</td>
              <td>${p.liveRatio}</td>
              <td style="color:#38bdf8;">${p.deltaExposure}</td>
              <td><span class="badge-green">VIGILANDO Z-SCORE</span></td>
            </tr>
          `).join("");
        }
      }
    } catch (_) {}
  }

  syncWickTelemetry();
  setInterval(syncWickTelemetry, 5000);
})();
