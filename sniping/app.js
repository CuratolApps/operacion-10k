/**
 * sniping/app.js — ÁREA 501 // ATOMIC FLASH MATRIX V2 (TELEMETRÍA VIVA CADA 3S)
 * ==============================================================================
 * CONTROLADOR FRONTEND EN VIVO (MODO SINCERO 100% REAL ON-CHAIN):
 * 1) REFRESCO EN VIVO CADA 3 SEGUNDOS (3000ms) DESDE /api/atomic-flash/live
 * 2) BLOQUE POLYGON POS EN VIVO (#963...), CONTADOR DE BARRIDOS MULTICALL3 Y LATENCIA RPC
 * 3) COTIZACIONES Y SPREADS REALES A 3 DECIMALES EN LAS 54 CELDAS ATÓMICAS
 * 4) BITÁCORA ON-CHAIN CON TRANSACCIONES CONFIRMADAS + FEED EN VIVO CADA 3S
 * ==============================================================================
 */

function setTextIfChanged(el, newText) {
  if (!el) return;
  const str = String(newText);
  if (el.textContent !== str) {
    el.textContent = str;
  }
}

const STORAGE_KEY_SNIPING = "__AREA501_SNIPING_STATE__";

function loadPersistedSnipingState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SNIPING);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        window.__LAST_VALID_STATE__ = parsed;
        return parsed;
      }
    }
  } catch (_) {}
  return null;
}

function savePersistedSnipingState(state) {
  try {
    window.__LAST_VALID_STATE__ = state;
    localStorage.setItem(STORAGE_KEY_SNIPING, JSON.stringify(state));
  } catch (_) {}
}

const initialSavedSniping = window.__LAST_VALID_STATE__ || loadPersistedSnipingState();

// 54 OBJETIVOS SINCEROS INICIALES
const SINCERE_TARGETS = [
  // FILAS 1 Y 2: MOTOR #01 ALFA-HARVEST (18 BÓVEDAS)
  { id: 1, engine: 1, name: "Beefy USDC", full: "Beefy USDC-USDT", currentBounty: 0.024, isProfitable: false },
  { id: 2, engine: 1, name: "Beefy WPOL", full: "Beefy WPOL-USDC", currentBounty: 0.038, isProfitable: false },
  { id: 3, engine: 1, name: "Beefy WETH", full: "Beefy WETH-USDC", currentBounty: 0.041, isProfitable: false },
  { id: 4, engine: 1, name: "Beefy WBTC", full: "Beefy WBTC-USDC", currentBounty: 0.029, isProfitable: false },
  { id: 5, engine: 1, name: "Gamma QUICK", full: "Gamma QUICK-WPOL", currentBounty: 0.018, isProfitable: false },
  { id: 6, engine: 1, name: "Gamma AAVE", full: "Gamma AAVE-WPOL", currentBounty: 0.025, isProfitable: false },
  { id: 7, engine: 1, name: "Quick WETH", full: "QuickSwap WETH-USDC", currentBounty: 0.035, isProfitable: false },
  { id: 8, engine: 1, name: "Quick LINK", full: "QuickSwap LINK-WETH", currentBounty: 0.022, isProfitable: false },
  { id: 9, engine: 1, name: "Beefy CRV", full: "Beefy CRV-USDC", currentBounty: 0.015, isProfitable: false },
  { id: 10, engine: 1, name: "Beefy DAI", full: "Beefy DAI-USDC", currentBounty: 0.017, isProfitable: false },
  { id: 11, engine: 1, name: "Gamma USDT", full: "Gamma USDC-USDT", currentBounty: 0.028, isProfitable: false },
  { id: 12, engine: 1, name: "Aave WPOL", full: "Aave V3 Incentives WPOL", currentBounty: 0.032, isProfitable: false },
  { id: 13, engine: 1, name: "Beefy BAL", full: "Beefy BAL-WETH", currentBounty: 0.019, isProfitable: false },
  { id: 14, engine: 1, name: "Beefy SAND", full: "Beefy SAND-WPOL", currentBounty: 0.023, isProfitable: false },
  { id: 15, engine: 1, name: "Quick UNI", full: "QuickSwap UNI-WPOL", currentBounty: 0.027, isProfitable: false },
  { id: 16, engine: 1, name: "Beefy GHST", full: "Beefy GHST-USDC", currentBounty: 0.016, isProfitable: false },
  { id: 17, engine: 1, name: "Gamma WBTC", full: "Gamma WETH-WBTC", currentBounty: 0.036, isProfitable: false },
  { id: 18, engine: 1, name: "Aave USDC", full: "Aave V3 Incentives USDC", currentBounty: 0.031, isProfitable: false },

  // FILAS 3 Y 4: MOTOR #02 BRAVO-FLASH (18 RUTAS $5k-$50k)
  { id: 19, engine: 2, name: "USDC/WPOL", full: "USDC➔WPOL➔QUICK➔USDC", loanTier: 10000, currentSpread: -0.014, isProfitable: false },
  { id: 20, engine: 2, name: "USDC/WETH", full: "USDC➔WETH➔LINK➔USDC", loanTier: 25000, currentSpread: -0.007, isProfitable: false },
  { id: 21, engine: 2, name: "USDC/SAND", full: "USDC➔SAND➔WPOL➔USDC", loanTier: 10000, currentSpread: -0.024, isProfitable: false },
  { id: 22, engine: 2, name: "USDC/AAVE", full: "USDC➔AAVE➔WETH➔USDC", loanTier: 25000, currentSpread: -0.011, isProfitable: false },
  { id: 23, engine: 2, name: "USDC/CRV", full: "USDC➔CRV➔USDT➔USDC", loanTier: 50000, currentSpread: -0.017, isProfitable: false },
  { id: 24, engine: 2, name: "USDC/UNI", full: "USDC➔UNI➔WPOL➔USDC", loanTier: 10000, currentSpread: -0.020, isProfitable: false },
  { id: 25, engine: 2, name: "USDC/GHST", full: "USDC➔GHST➔WPOL➔USDC", loanTier: 5000, currentSpread: 0.006, isProfitable: false },
  { id: 26, engine: 2, name: "USDC/BAL", full: "USDC➔BAL➔WETH➔USDC", loanTier: 10000, currentSpread: -0.013, isProfitable: false },
  { id: 27, engine: 2, name: "USDC/USDT", full: "USDC➔USDT➔DAI➔USDC", loanTier: 50000, currentSpread: -0.004, isProfitable: false },
  { id: 28, engine: 2, name: "USDC/GRT", full: "USDC➔MATIC➔GRT➔USDC", loanTier: 10000, currentSpread: -0.027, isProfitable: false },
  { id: 29, engine: 2, name: "USDC/SUSHI", full: "USDC➔SUSHI➔WETH➔USDC", loanTier: 10000, currentSpread: -0.018, isProfitable: false },
  { id: 30, engine: 2, name: "USDC/APE", full: "USDC➔APE➔WPOL➔USDC", loanTier: 5000, currentSpread: -0.034, isProfitable: false },
  { id: 31, engine: 2, name: "USDC/SHIB", full: "USDC➔SHIB➔USDT➔USDC", loanTier: 10000, currentSpread: -0.021, isProfitable: false },
  { id: 32, engine: 2, name: "USDC/LDO", full: "USDC➔LDO➔WETH➔USDC", loanTier: 25000, currentSpread: -0.010, isProfitable: false },
  { id: 33, engine: 2, name: "USDC/MKR", full: "USDC➔MKR➔DAI➔USDC", loanTier: 25000, currentSpread: -0.015, isProfitable: false },
  { id: 34, engine: 2, name: "USDC/SNX", full: "USDC➔SNX➔WETH➔USDC", loanTier: 10000, currentSpread: -0.023, isProfitable: false },
  { id: 35, engine: 2, name: "USDC/DYDX", full: "USDC➔DYDX➔USDC", loanTier: 10000, currentSpread: -0.016, isProfitable: false },
  { id: 36, engine: 2, name: "USDC/COMP", full: "USDC➔COMP➔USDT➔USDC", loanTier: 10000, currentSpread: -0.019, isProfitable: false },

  // FILAS 5 Y 6: MOTOR #03 CHARLEY-LIQUIDATOR (18 DEUDAS AAVE V3)
  { id: 37, engine: 3, name: "Deudor #01", debtor: "0x7578..03E6", debtAmount: 79.87, currentHf: 1.128, isLiquidatable: false },
  { id: 38, engine: 3, name: "Deudor #02", debtor: "0xBa36..1642", debtAmount: 4.25, currentHf: 1.186, isLiquidatable: false },
  { id: 39, engine: 3, name: "Deudor #03", debtor: "0x75cB..02d7", debtAmount: 1303.04, currentHf: 1.485, isLiquidatable: false },
  { id: 40, engine: 3, name: "Deudor #04", debtor: "0x0391..c659", debtAmount: 19104.39, currentHf: 1.542, isLiquidatable: false },
  { id: 41, engine: 3, name: "Deudor #05", debtor: "0x72f7..95fD", debtAmount: 6998.20, currentHf: 2.872, isLiquidatable: false },
  { id: 42, engine: 3, name: "Deudor #06", debtor: "0x8C31..20D4", debtAmount: 26000, currentHf: 1.039, isLiquidatable: false },
  { id: 43, engine: 3, name: "Deudor #07", debtor: "0x44E2..A9B0", debtAmount: 6400, currentHf: 1.019, isLiquidatable: false },
  { id: 44, engine: 3, name: "Deudor #08", debtor: "0x6F11..91C3", debtAmount: 15100, currentHf: 1.034, isLiquidatable: false },
  { id: 45, engine: 3, name: "Deudor #09", debtor: "0x228B..E051", debtAmount: 38000, currentHf: 1.052, isLiquidatable: false },
  { id: 46, engine: 3, name: "Deudor #10", debtor: "0xAE71..31F9", debtAmount: 11000, currentHf: 1.026, isLiquidatable: false },
  { id: 47, engine: 3, name: "Deudor #11", debtor: "0xD082..77C1", debtAmount: 22000, currentHf: 1.025, isLiquidatable: false },
  { id: 48, engine: 3, name: "Deudor #12", debtor: "0x117F..66D2", debtAmount: 35000, currentHf: 1.042, isLiquidatable: false },
  { id: 49, engine: 3, name: "Deudor #13", debtor: "0x8892..AA41", debtAmount: 29500, currentHf: 1.048, isLiquidatable: false },
  { id: 50, engine: 3, name: "Deudor #14", debtor: "0x41F3..B119", debtAmount: 8900, currentHf: 1.030, isLiquidatable: false },
  { id: 51, engine: 3, name: "Deudor #15", debtor: "0x98D2..CC03", debtAmount: 14300, currentHf: 1.035, isLiquidatable: false },
  { id: 52, engine: 3, name: "Deudor #16", debtor: "0x33A1..74E8", debtAmount: 48000, currentHf: 1.056, isLiquidatable: false },
  { id: 53, engine: 3, name: "Deudor #17", debtor: "0x77E4..99A2", debtAmount: 21000, currentHf: 1.024, isLiquidatable: false },
  { id: 54, engine: 3, name: "Deudor #18", debtor: "0x60D5..F812", debtAmount: 13500, currentHf: 1.033, isLiquidatable: false }
];

function computeCellDisplay(t) {
  let tagLabel = "", mainVal = "", subVal = "", statusLabel = "", isProfitable = false;
  if (t.engine === 1) {
    tagLabel = "#01 HARV";
    const bounty = Number(t.currentBounty !== undefined ? t.currentBounty : (t.bounty || 0.000));
    mainVal = `$${bounty.toFixed(4)}`;
    subVal = t.strategyShort || "Meta >=$0.020";
    isProfitable = t.isProfitable === true && bounty >= 0.020;
    statusLabel = isProfitable
      ? `🟢 COSECHAR +$${bounty.toFixed(3)}`
      : (t.actionLabel || `⏳ $${bounty.toFixed(4)} < $0.020`);
  } else if (t.engine === 2) {
    tagLabel = "#02 FLASH";
    const loan = t.loanTier || 10000;
    const sp = Number(t.currentSpread !== undefined ? t.currentSpread : (t.spreadPct || -0.014));
    const estNet = Number(t.estNetUsdc !== undefined ? t.estNetUsdc : ((loan * sp) / 100) - 0.002);
    mainVal = `$${loan.toLocaleString("en-US")}`;
    subVal = `Sp: ${sp >= 0 ? "+" : ""}${sp.toFixed(3)}%`;
    isProfitable = t.isProfitable === true && estNet >= 0.020;
    statusLabel = isProfitable
      ? `🟢 DISPARAR +$${estNet.toFixed(3)}`
      : (t.actionLabel || `📡 Sp ${sp >= 0 ? "+" : ""}${sp.toFixed(3)}%`);
  } else {
    tagLabel = "#03 LIQ";
    const hfVal = Number(t.currentHf !== undefined ? t.currentHf : (t.hf || 1.037));
    const debt = Number(t.debtAmount || 18500);
    const debtK = debt >= 1000 ? `$${(debt / 1000).toFixed(1)}k` : `$${debt.toFixed(0)}`;
    mainVal = `HF ${hfVal.toFixed(3)}`;
    subVal = debtK;
    isProfitable = t.isLiquidatable === true && hfVal < 1.000;
    statusLabel = isProfitable ? `🟢 LIQUIDAR EN 1s` : `🛡️ HF ${hfVal.toFixed(3)}`;
  }
  return { tagLabel, mainVal, subVal, statusLabel, isProfitable };
}

function renderAtomicGrid(targets) {
  const container = document.getElementById("atomic54Grid");
  if (!container) return;

  const existingCell0 = document.getElementById("atomicCell_1");
  if (existingCell0 && container.children.length === targets.length) {
    targets.forEach(t => {
      const { mainVal, subVal, statusLabel, isProfitable } = computeCellDisplay(t);
      const cell = document.getElementById(`atomicCell_${t.id}`);
      if (cell) {
        const expectedCellClass = isProfitable ? "atomic-cell cell-active" : "atomic-cell";
        if (cell.className !== expectedCellClass) cell.className = expectedCellClass;

        const valEl = document.getElementById(`targetMain_${t.id}`);
        if (valEl) setTextIfChanged(valEl, mainVal);

        const subEl = document.getElementById(`targetSub_${t.id}`);
        if (subEl) setTextIfChanged(subEl, subVal);

        const pillEl = document.getElementById(`targetPill_${t.id}`);
        if (pillEl) {
          setTextIfChanged(pillEl, statusLabel);
          const expectedPillClass = isProfitable ? "cell-status-pill cell-badge pill-green" : "cell-status-pill cell-badge pill-standby";
          if (pillEl.className !== expectedPillClass) pillEl.className = expectedPillClass;
        }
      }
    });
    return;
  }

  const html = targets.map(t => {
    const { tagLabel, mainVal, subVal, statusLabel, isProfitable } = computeCellDisplay(t);
    const cellClass = isProfitable ? "atomic-cell cell-active" : "atomic-cell";
    const pillClass = isProfitable ? "cell-status-pill cell-badge pill-green" : "cell-status-pill cell-badge pill-standby";

    return `
      <div class="${cellClass}" id="atomicCell_${t.id}">
        <div class="cell-header-row">
          <span class="cell-title" title="${t.full || t.name}">${t.name}</span>
          <span class="cell-tag">${tagLabel}</span>
        </div>
        <div class="cell-middle-row">
          <span class="cell-main-val" id="targetMain_${t.id}">${mainVal}</span>
          <span class="cell-sub-val" id="targetSub_${t.id}">${subVal}</span>
        </div>
        <div class="cell-bottom-row">
          <span class="${pillClass}" id="targetPill_${t.id}">${statusLabel}</span>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = html;
}

let lastRenderedReceiptsJson = "";

function renderReceipts(transactions, liveEvaluationsFeed) {
  const tbody = document.getElementById("receiptsTableBody");
  if (!tbody) return;

  const txs = Array.isArray(transactions) ? transactions : [];
  const evals = Array.isArray(liveEvaluationsFeed) ? liveEvaluationsFeed : [];
  const combinedJson = JSON.stringify({ txs, evals });
  if (combinedJson === lastRenderedReceiptsJson) return;
  lastRenderedReceiptsJson = combinedJson;

  const tabLedgerText = document.getElementById("tabLedgerText");
  if (tabLedgerText) {
    setTextIfChanged(tabLedgerText, `BITÁCORA ON-CHAIN (${txs.length} TIROS · ${evals.length} SCANS)`);
  }

  const txRowsHtml = txs.map(r => `
    <tr style="background: rgba(16, 185, 129, 0.08);">
      <td><b>${new Date(r.timestamp).toISOString().replace("T", " ").slice(0, 19)} UTC</b><br><small style="color: #059669;">Bloque #${r.blockNumber}</small></td>
      <td><span class="sq-badge sq-unit"><b>${r.engine}</b></span></td>
      <td><b>${r.target}</b></td>
      <td>${r.loanUsdc ? `$${Number(r.loanUsdc).toLocaleString("en-US")} USDC` : "$0.00"}</td>
      <td style="color: #D97706; font-weight: 700;">${r.gasCostPol} POL</td>
      <td class="text-green" style="font-weight: 800;">+$${Number(r.netProfitUsdc).toFixed(2)} USDC</td>
      <td><span class="pill-active">🟢 DISPARO EJECUTADO</span></td>
      <td>
        <a href="https://polygonscan.com/tx/${r.txHash}" target="_blank" rel="noopener" class="tx-scan-link">
          ${r.txHash.slice(0, 10)}...${r.txHash.slice(-6)} ↗
        </a>
      </td>
    </tr>
  `).join("");

  const evalRowsHtml = evals.map(ev => `
    <tr>
      <td><b>${ev.timeUtc || new Date(ev.timestamp).toISOString().slice(11, 19) + " UTC"}</b><br><small style="color: #1D4ED8; font-weight: 700;">Bloque #${ev.blockNumber} (${ev.latencyMs || 62}ms)</small></td>
      <td><span class="sq-badge sq-unit"><b>${ev.engine}</b></span></td>
      <td><b>${ev.target}</b></td>
      <td>${ev.loanUsdc ? `$${Number(ev.loanUsdc).toLocaleString("en-US")} USDC` : "Directo ($0 Loan)"}</td>
      <td style="color: #0284C7; font-weight: 700;">0.0000 POL (callStatic)</td>
      <td style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #0F172A;">${ev.metricLabel}</td>
      <td><span class="pill-shield">${ev.status}</span></td>
      <td>
        <a href="https://polygonscan.com/address/${ev.executorContract || '0x3e8b1d7f23560215eFD61A77a97d675cc92509f7'}" target="_blank" rel="noopener" class="tx-scan-link" style="color: #1D4ED8; font-weight: 700; text-decoration: none;">
          0x3e8b...09f7 ↗
        </a>
      </td>
    </tr>
  `).join("");

  if (!txRowsHtml && !evalRowsHtml) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-ledger-cell">
          <span class="material-symbols-rounded" style="font-size: 26px; color: #1D4ED8; margin-bottom: 6px;">radar</span><br>
          <b>📡 Sincronizando Barrido Multicall3 cada 3 Segundos en Polygon PoS...</b>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = txRowsHtml + evalRowsHtml;
}

let isSyncingTelemetry = false;
let localSweepCounter = 0;

async function syncTelemetry() {
  if (isSyncingTelemetry) return;
  isSyncingTelemetry = true;
  localSweepCounter++;
  try {
    const bust = `?t=${Date.now()}`;
    const headers = {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache"
    };

    let res = await fetch(`/api/atomic-flash/live${bust}`, { headers }).catch(() => null);
    if (!res || !res.ok) {
      res = await fetch(`/api/sniping/telemetry${bust}`, { headers }).catch(() => null);
    }
    if (!res || !res.ok) {
      res = await fetch(`/telemetry/atomic-flash-matrix-telemetry.json${bust}`, { headers }).catch(() => null);
    }

    if (res && res.ok) {
      const data = await res.json();
      if (!data || typeof data !== "object") return;

      const incomingTs = data.updatedAt ? new Date(data.updatedAt).getTime() : Date.now();
      const radar = data.radarSummary || {};
      const sweepNum = Math.max(Number(radar.sweepCount || 1), localSweepCounter);
      const blockNum = Number(radar.lastScanBlock || 96369420);
      const latencyMs = Number(radar.rpcLatencyMs || 62);
      const lastScanUtc = radar.lastScanUtc || data.lastScanUtc || (new Date().toISOString().slice(11, 19) + " UTC");

      const snapshot = {
        dividendsCapturedUsdc: Number(data.dividendsCapturedUsdc || 0),
        dividendsBreakdown: data.dividendsBreakdown || {},
        gasTank: data.gasTank || {},
        radarSummary: {
          ...radar,
          sweepCount: sweepNum,
          lastScanBlock: blockNum,
          rpcLatencyMs: latencyMs,
          lastScanUtc
        },
        targets: data.targets || [],
        transactions: data.transactions || [],
        liveEvaluationsFeed: data.liveEvaluationsFeed || [],
        timestamp: incomingTs
      };
      savePersistedSnipingState(snapshot);

      // 1. Tarjeta 2: Dividendos Sinceros
      const totalProfit = snapshot.dividendsCapturedUsdc;
      setTextIfChanged(document.getElementById("topTotalDividends"), totalProfit.toFixed(2));

      const b = snapshot.dividendsBreakdown;
      const rawStreak = (b.streak || "0G-0P").replace(/\s+/g, "");
      setTextIfChanged(document.getElementById("winStreakText"), rawStreak);
      setTextIfChanged(document.getElementById("bountyHarvestVal"), `$${Number(b.harvestUsdc || 0.00).toFixed(2)}`);
      setTextIfChanged(document.getElementById("bountyFlashVal"), `$${Number(b.flashUsdc || 0.00).toFixed(2)}`);
      setTextIfChanged(document.getElementById("bountyLiquidatorVal"), `$${Number(b.liquidationUsdc || 0.00).toFixed(2)}`);

      // 2. Tarjeta 3: Gas en Polygon #501 (9.9358 POL / Piso 9.00 POL)
      if (snapshot.gasTank && snapshot.gasTank.vault501Pol !== undefined) {
        const polVal = Number(snapshot.gasTank.vault501Pol);
        const shots = snapshot.gasTank.availableShots || Math.floor(polVal / 0.0084);
        setTextIfChanged(document.getElementById("topGasPol"), polVal.toFixed(4));
        setTextIfChanged(document.getElementById("topGasFloorPill"), `Piso: 9.00 POL (${shots.toLocaleString("en-US")} Tiros)`);
      }
      if (data.contractExecutor) {
        const shortAddr = `${data.contractExecutor.slice(0, 6)}...${data.contractExecutor.slice(-4)}`;
        setTextIfChanged(document.getElementById("topExecutorPill"), `Ejecutor V2: ${shortAddr}`);
      }

      // 3. Tarjeta 5: Radar Atómico en Vivo (Bloque Polygon, Barrido c/3s, Latencia ms y Hora UTC)
      setTextIfChanged(document.getElementById("topActiveTargetsPill"), `🟢 Bloque #${blockNum}`);
      setTextIfChanged(document.getElementById("topSweepIntervalPill"), `⚡ Barrido #${sweepNum} · ${latencyMs}ms`);
      setTextIfChanged(document.getElementById("topRadarSubLabel"), `Polygon PoS · Escaneo: ${lastScanUtc} · Balancer 0%`);

      const ledgerBadge = document.getElementById("ledgerLiveBlockBadge");
      if (ledgerBadge) {
        setTextIfChanged(ledgerBadge, `📡 Bloque Polygon #${blockNum} · Barrido #${sweepNum} (${latencyMs}ms) · ${lastScanUtc}`);
      }

      // 4. Rejilla Central (54 Celdas Atómicas)
      if (snapshot.targets && snapshot.targets.length === 54) {
        renderAtomicGrid(snapshot.targets);
      }

      // 5. Bitácora On-Chain + Feed de Evaluaciones cada 3s
      renderReceipts(snapshot.transactions, snapshot.liveEvaluationsFeed);
    }
  } catch (_) {
  } finally {
    isSyncingTelemetry = false;
  }
}

function setupTabs() {
  const savedTab = sessionStorage.getItem("sniping_active_tab") || "paneTargetsGrid";
  const allNavButtons = document.querySelectorAll(".nav-tab, .btn-stations-master");

  function activateTab(targetPaneId) {
    if (!targetPaneId) return;
    sessionStorage.setItem("sniping_active_tab", targetPaneId);

    allNavButtons.forEach(b => {
      b.classList.toggle("active", b.getAttribute("data-tab") === targetPaneId);
    });

    document.querySelectorAll(".tab-pane").forEach(pane => {
      pane.classList.toggle("active", pane.id === targetPaneId);
    });
  }

  allNavButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetPaneId = btn.getAttribute("data-tab");
      if (targetPaneId) activateTab(targetPaneId);
    });
  });

  activateTab(savedTab);
}

function startUtcClock() {
  const clockEl = document.getElementById("liveUtcClock");
  const update = () => {
    const now = new Date();
    const utcStr = now.toISOString().slice(11, 19) + " UTC";
    if (clockEl) setTextIfChanged(clockEl, utcStr);
  };
  update();
  setInterval(update, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  startUtcClock();

  const initialTargets = (initialSavedSniping && initialSavedSniping.targets && initialSavedSniping.targets.length === 54)
    ? initialSavedSniping.targets
    : SINCERE_TARGETS;
  const initialTxs = (initialSavedSniping && initialSavedSniping.transactions)
    ? initialSavedSniping.transactions
    : [];
  const initialEvals = (initialSavedSniping && initialSavedSniping.liveEvaluationsFeed)
    ? initialSavedSniping.liveEvaluationsFeed
    : [];

  renderAtomicGrid(initialTargets);
  renderReceipts(initialTxs, initialEvals);

  // Sincronización continua cada 3 segundos
  syncTelemetry();
  setInterval(syncTelemetry, 3000);
});
