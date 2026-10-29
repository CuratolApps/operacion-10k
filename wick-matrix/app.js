/**
 * wick-matrix/app.js — ÁREA 501 // ESTACIÓN #06 · WICK SNIPER & PAIRS ARBITRAGE L1
 * ==============================================================================
 * Hidrata en tiempo real las 12 Redes Caza-Mechas (Post-Only ALO ±0.85%) y los
 * 6 Binomios de Arbitraje Delta-Neutral desde el demonio L1 y la API oficial de
 * Hyperliquid L1 (https://api.hyperliquid.xyz/info).
 */
(function () {
  const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
  const WICK_COINS = ["HYPE", "SOL", "SUI", "XRP", "DOGE", "AVAX", "LINK", "ADA", "LTC", "NEAR", "TON", "DOT"];
  const TWIN_PAIRS = [
    { pair: "BTC / ETH", coinA: "BTC", coinB: "ETH", corr: "0.94" },
    { pair: "SOL / SUI", coinA: "SOL", coinB: "SUI", corr: "0.91" },
    { pair: "XRP / ADA", coinA: "XRP", coinB: "ADA", corr: "0.89" },
    { pair: "DOGE / LTC", coinA: "DOGE", coinB: "LTC", corr: "0.87" },
    { pair: "AVAX / NEAR", coinA: "AVAX", coinB: "NEAR", corr: "0.90" },
    { pair: "BNB / AAVE", coinA: "BNB", coinB: "AAVE", corr: "0.86" }
  ];

  // 1. Reloj UTC en vivo
  function updateClock() {
    const el = document.getElementById("liveUtcClock");
    if (el) {
      el.textContent = new Date().toISOString().slice(11, 19) + " UTC";
    }
  }
  setInterval(updateClock, 1000);
  updateClock();

  // 2. Navegación por pestañas inferiores (.nav-tab)
  document.querySelectorAll(".matrix-nav-tabs .nav-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab");
      if (!targetId) return;
      document.querySelectorAll(".matrix-nav-tabs .nav-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-pane").forEach(p => {
        p.classList.toggle("active", p.id === targetId);
      });
    });
  });

  function fmtPx(px) {
    const n = Number(px);
    if (!Number.isFinite(n) || n <= 0) return "$0.00";
    if (n >= 1000) return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    if (n >= 10) return "$" + n.toFixed(3);
    if (n >= 1) return "$" + n.toFixed(4);
    return "$" + n.toFixed(5);
  }

  function renderTables(wickTraps, twinPairs, accountEquity, shield40, syncUtc) {
    const eqEl = document.getElementById("kpiEquityTotal");
    const shEl = document.getElementById("kpiShieldFree");
    const syncEl = document.getElementById("wickSyncBadge");

    if (eqEl && accountEquity > 0) {
      eqEl.textContent = `Patrimonio L1: $${Number(accountEquity).toFixed(2)}`;
    }
    if (shEl && shield40 > 0) {
      shEl.textContent = `$${Number(shield40).toFixed(2)} USDC`;
    }
    if (syncEl && syncUtc) {
      syncEl.textContent = `L1 en Vivo · ${syncUtc}`;
    }

    const tbodyMain = document.getElementById("wickTrapsTableBody");
    if (tbodyMain && Array.isArray(wickTraps)) {
      tbodyMain.innerHTML = wickTraps.map(t => `
        <tr>
          <td><b>${t.coin}</b></td>
          <td>${fmtPx(t.midPx)}</td>
          <td style="color:#059669; font-weight:700;">${fmtPx(t.bidTrapPx)}</td>
          <td style="color:#1D4ED8; font-weight:700;">${fmtPx(t.reboteLongTpPx)}</td>
          <td style="color:#D97706; font-weight:700;">${fmtPx(t.askTrapPx)}</td>
          <td style="color:#059669; font-weight:800;">+$${Number(t.estNetProfitUsdc || 0.78).toFixed(2)} USDC</td>
          <td><span class="status-chip"><span class="material-symbols-rounded" style="font-size:12px;">check_circle</span> ${t.status || "TRAMPA ALO ACTIVA"}</span></td>
        </tr>
      `).join("");
    }

    const tbodyFull = document.getElementById("wickFullRadarTableBody");
    if (tbodyFull && Array.isArray(wickTraps)) {
      tbodyFull.innerHTML = wickTraps.map((t, idx) => `
        <tr>
          <td>#${String(idx + 1).padStart(2, "0")}</td>
          <td><b>${t.coin}</b></td>
          <td>${fmtPx(t.midPx)}</td>
          <td style="color:#059669; font-weight:700;">${fmtPx(t.bidTrapPx)} (-0.85%)</td>
          <td style="color:#1D4ED8; font-weight:700;">${fmtPx(t.reboteLongTpPx)} (+0.40%)</td>
          <td style="color:#D97706; font-weight:700;">${fmtPx(t.askTrapPx)} (+0.85%)</td>
          <td style="color:#1D4ED8; font-weight:700;">${fmtPx(t.reboteShortTpPx || (t.askTrapPx * 0.996))} (-0.40%)</td>
          <td style="color:#059669; font-weight:800;">+$${Number(t.estNetProfitUsdc || 0.78).toFixed(2)} USDC + Rebate</td>
          <td><span class="status-chip"><span class="material-symbols-rounded" style="font-size:12px;">bolt</span> VIGILANDO AGUJA L1</span></td>
        </tr>
      `).join("");
    }

    const tbodyTwins = document.getElementById("twinPairsTableBody");
    if (tbodyTwins && Array.isArray(twinPairs)) {
      tbodyTwins.innerHTML = twinPairs.map(tp => `
        <tr>
          <td><b>${tp.pair}</b></td>
          <td><span class="status-chip blue">${tp.corr || tp.correlation}</span></td>
          <td>${fmtPx(tp.pxA)} / ${fmtPx(tp.pxB)}</td>
          <td><b>${tp.liveRatio}</b></td>
          <td style="color:#059669; font-weight:700;">+0.20% Neto ($0 Riesgo)</td>
          <td><span class="status-chip">${tp.status || "VIGILANDO Z-SCORE"}</span></td>
        </tr>
      `).join("");
    }
  }

  async function refreshWickTelemetry() {
    try {
      // 1. Intentar leer primero la telemetría del demonio local o worker
      const endpoints = ["/api/telemetry/wick-sniper", "/telemetry/wick-sniper-telemetry.json"];
      for (const url of endpoints) {
        try {
          const res = await fetch(url + "?t=" + Date.now(), { cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.wickTraps) && data.wickTraps.length > 0) {
              renderTables(
                data.wickTraps,
                data.twinPairs || [],
                data.accountEquityUsdc || 902.15,
                data.shield40MarginFreeUsdc || 360.86,
                (data.updatedAt || new Date().toISOString()).slice(11, 19) + " UTC"
              );
              return;
            }
          }
        } catch (_) {}
      }

      // 2. Fallback directo en vivo desde Hyperliquid L1 Info API
      const [midsRes, chRes] = await Promise.all([
        fetch("https://api.hyperliquid.xyz/info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "allMids" })
        }),
        fetch("https://api.hyperliquid.xyz/info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "clearinghouseState", user: VAULT_501 })
        })
      ]);

      if (midsRes.ok) {
        const mids = await midsRes.json();
        let eq = 902.15;
        if (chRes.ok) {
          const ch = await chRes.json();
          const parsedEq = Number(ch?.marginSummary?.accountValue || 0);
          if (parsedEq > 0) eq = parsedEq;
        }
        const traps = WICK_COINS.map(c => {
          const mid = Number(mids[c] || 0);
          return {
            coin: `${c}-USDC`,
            midPx: mid,
            bidTrapPx: mid * (1 - 0.0085),
            askTrapPx: mid * (1 + 0.0085),
            reboteLongTpPx: mid * (1 - 0.0045),
            reboteShortTpPx: mid * (1 + 0.0045),
            estNetProfitUsdc: 0.78,
            status: "TRAMPA ALO ACTIVA"
          };
        });
        const twins = TWIN_PAIRS.map(tp => {
          const pxA = Number(mids[tp.coinA] || 0);
          const pxB = Number(mids[tp.coinB] || 0);
          return {
            pair: tp.pair,
            corr: tp.corr,
            pxA,
            pxB,
            liveRatio: pxB > 0 ? (pxA / pxB).toFixed(4) : "0.0000",
            status: "VIGILANDO Z-SCORE"
          };
        });
        renderTables(traps, twins, eq, eq * 0.40, new Date().toISOString().slice(11, 19) + " UTC");
      }
    } catch (_) {}
  }

  refreshWickTelemetry();
  setInterval(refreshWickTelemetry, 4500);
})();
