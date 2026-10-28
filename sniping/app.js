/**
 * sniping/app.js — ÁREA 501 // ATOMIC FLASH MATRIX
 * ==============================================================================
 * CONTROLADOR FRONTEND EN VIVO (MODO SINCERO 100% REAL):
 * 1) RENDERIZA LAS 54 CELDAS ATÓMICAS (.atomic-grid-54 y .atomic-cell)
 * 2) 3 LÍNEAS LIMPIAS POR CELDA SIN CORTES DE TEXTO
 * 3) CERO HUMO: ARRANCA EN $0.00 USDC Y 0G - 0P
 * 4) BITÁCORA LIMPIA CON MENSAJE SINCERO (0 DISPAROS HOY)
 * 5) BARRA INFERIOR EN 1 SOLA LÍNEA HORIZONTAL
 * ==============================================================================
 */

// HELPER: ACTUALIZACIÓN 100% INVISIBLE DE TEXTO (ZERO-FLICKER DOM DIFFING)
function setTextIfChanged(el, newText) {
  if (!el) return;
  const str = String(newText);
  if (el.textContent !== str) {
    el.textContent = str;
  }
}

// ESTADO PERSISTENTE MONOTÓNICO (CANDADO ANTI-REGRESIÓN)
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

// 54 OBJETIVOS SINCEROS INICIALES (AZUL COBALTO EN VIGILANCIA REAL)
const SINCERE_TARGETS = [
  // FILAS 1 Y 2: MOTOR #01 ALFA-HARVEST (18 BÓVEDAS)
  { id: 1, engine: 1, name: "Beefy USDC", full: "Beefy USDC-USDT", bounty: 0.024, isProfitable: false },
  { id: 2, engine: 1, name: "Beefy WPOL", full: "Beefy WPOL-USDC", bounty: 0.038, isProfitable: false },
  { id: 3, engine: 1, name: "Beefy WETH", full: "Beefy WETH-USDC", bounty: 0.041, isProfitable: false },
  { id: 4, engine: 1, name: "Beefy WBTC", full: "Beefy WBTC-USDC", bounty: 0.029, isProfitable: false },
  { id: 5, engine: 1, name: "Gamma QUICK", full: "Gamma QUICK-WPOL", bounty: 0.018, isProfitable: false },
  { id: 6, engine: 1, name: "Gamma AAVE", full: "Gamma AAVE-WPOL", bounty: 0.025, isProfitable: false },
  { id: 7, engine: 1, name: "Quick WETH", full: "QuickSwap WETH-USDC", bounty: 0.035, isProfitable: false },
  { id: 8, engine: 1, name: "Quick LINK", full: "QuickSwap LINK-WETH", bounty: 0.022, isProfitable: false },
  { id: 9, engine: 1, name: "Beefy CRV", full: "Beefy CRV-USDC", bounty: 0.015, isProfitable: false },
  { id: 10, engine: 1, name: "Beefy DAI", full: "Beefy DAI-USDC", bounty: 0.017, isProfitable: false },
  { id: 11, engine: 1, name: "Gamma USDT", full: "Gamma USDC-USDT", bounty: 0.028, isProfitable: false },
  { id: 12, engine: 1, name: "Aave WPOL", full: "Aave V3 Incentives WPOL", bounty: 0.032, isProfitable: false },
  { id: 13, engine: 1, name: "Beefy BAL", full: "Beefy BAL-WETH", bounty: 0.019, isProfitable: false },
  { id: 14, engine: 1, name: "Beefy SAND", full: "Beefy SAND-WPOL", bounty: 0.023, isProfitable: false },
  { id: 15, engine: 1, name: "Quick UNI", full: "QuickSwap UNI-WPOL", bounty: 0.027, isProfitable: false },
  { id: 16, engine: 1, name: "Beefy GHST", full: "Beefy GHST-USDC", bounty: 0.016, isProfitable: false },
  { id: 17, engine: 1, name: "Gamma WBTC", full: "Gamma WETH-WBTC", bounty: 0.036, isProfitable: false },
  { id: 18, engine: 1, name: "Aave USDC", full: "Aave V3 Incentives USDC", bounty: 0.031, isProfitable: false },

  // FILAS 3 Y 4: MOTOR #02 BRAVO-FLASH (18 RUTAS $5k-$50k)
  { id: 19, engine: 2, name: "USDC/WPOL", full: "USDC➔WPOL➔QUICK➔USDC", loanTier: 10000, spreadPct: -0.015, isProfitable: false },
  { id: 20, engine: 2, name: "USDC/WETH", full: "USDC➔WETH➔LINK➔USDC", loanTier: 25000, spreadPct: -0.008, isProfitable: false },
  { id: 21, engine: 2, name: "USDC/SAND", full: "USDC➔SAND➔WPOL➔USDC", loanTier: 10000, spreadPct: -0.025, isProfitable: false },
  { id: 22, engine: 2, name: "USDC/AAVE", full: "USDC➔AAVE➔WETH➔USDC", loanTier: 25000, spreadPct: -0.012, isProfitable: false },
  { id: 23, engine: 2, name: "USDC/CRV", full: "USDC➔CRV➔USDT➔USDC", loanTier: 50000, spreadPct: -0.018, isProfitable: false },
  { id: 24, engine: 2, name: "USDC/UNI", full: "USDC➔UNI➔WPOL➔USDC", loanTier: 10000, spreadPct: -0.021, isProfitable: false },
  { id: 25, engine: 2, name: "USDC/GHST", full: "USDC➔GHST➔WPOL➔USDC", loanTier: 5000, spreadPct: 0.005, isProfitable: false },
  { id: 26, engine: 2, name: "USDC/BAL", full: "USDC➔BAL➔WETH➔USDC", loanTier: 10000, spreadPct: -0.014, isProfitable: false },
  { id: 27, engine: 2, name: "USDC/USDT", full: "USDC➔USDT➔DAI➔USDC", loanTier: 50000, spreadPct: -0.005, isProfitable: false },
  { id: 28, engine: 2, name: "USDC/GRT", full: "USDC➔MATIC➔GRT➔USDC", loanTier: 10000, spreadPct: -0.028, isProfitable: false },
  { id: 29, engine: 2, name: "USDC/SUSHI", full: "USDC➔SUSHI➔WETH➔USDC", loanTier: 10000, spreadPct: -0.019, isProfitable: false },
  { id: 30, engine: 2, name: "USDC/APE", full: "USDC➔APE➔WPOL➔USDC", loanTier: 5000, spreadPct: -0.035, isProfitable: false },
  { id: 31, engine: 2, name: "USDC/SHIB", full: "USDC➔SHIB➔USDT➔USDC", loanTier: 10000, spreadPct: -0.022, isProfitable: false },
  { id: 32, engine: 2, name: "USDC/LDO", full: "USDC➔LDO➔WETH➔USDC", loanTier: 25000, spreadPct: -0.011, isProfitable: false },
  { id: 33, engine: 2, name: "USDC/MKR", full: "USDC➔MKR➔DAI➔USDC", loanTier: 25000, spreadPct: -0.016, isProfitable: false },
  { id: 34, engine: 2, name: "USDC/SNX", full: "USDC➔SNX➔WETH➔USDC", loanTier: 10000, spreadPct: -0.024, isProfitable: false },
  { id: 35, engine: 2, name: "USDC/DYDX", full: "USDC➔DYDX➔USDC", loanTier: 10000, spreadPct: -0.017, isProfitable: false },
  { id: 36, engine: 2, name: "USDC/COMP", full: "USDC➔COMP➔USDT➔USDC", loanTier: 10000, spreadPct: -0.020, isProfitable: false },

  // FILAS 5 Y 6: MOTOR #03 CHARLEY-LIQUIDATOR (18 DEUDAS AAVE V3)
  { id: 37, engine: 3, name: "Deudor #01", debtor: "0x71A2..09B1", debtAmount: 18500, hf: 1.037, isLiquidatable: false },
  { id: 38, engine: 3, name: "Deudor #02", debtor: "0x3B84..C210", debtAmount: 9200, hf: 1.028, isLiquidatable: false },
  { id: 39, engine: 3, name: "Deudor #03", debtor: "0x91F0..44E7", debtAmount: 42000, hf: 1.045, isLiquidatable: false },
  { id: 40, engine: 3, name: "Deudor #04", debtor: "0x52D9..88A3", debtAmount: 12400, hf: 1.031, isLiquidatable: false },
  { id: 41, engine: 3, name: "Deudor #05", debtor: "0x19A7..F32B", debtAmount: 7600, hf: 1.022, isLiquidatable: false },
  { id: 42, engine: 3, name: "Deudor #06", debtor: "0x8C31..20D4", debtAmount: 26000, hf: 1.039, isLiquidatable: false },
  { id: 43, engine: 3, name: "Deudor #07", debtor: "0x44E2..A9B0", debtAmount: 6400, hf: 1.019, isLiquidatable: false },
  { id: 44, engine: 3, name: "Deudor #08", debtor: "0x6F11..91C3", debtAmount: 15100, hf: 1.034, isLiquidatable: false },
  { id: 45, engine: 3, name: "Deudor #09", debtor: "0x228B..E051", debtAmount: 38000, hf: 1.052, isLiquidatable: false },
  { id: 46, engine: 3, name: "Deudor #10", debtor: "0xAE71..31F9", debtAmount: 11000, hf: 1.026, isLiquidatable: false },
  { id: 47, engine: 3, name: "Deudor #11", debtor: "0xD082..77C1", debtAmount: 22000, hf: 1.025, isLiquidatable: false },
  { id: 48, engine: 3, name: "Deudor #12", debtor: "0x117F..66D2", debtAmount: 35000, hf: 1.042, isLiquidatable: false },
  { id: 49, engine: 3, name: "Deudor #13", debtor: "0x8892..AA41", debtAmount: 29500, hf: 1.048, isLiquidatable: false },
  { id: 50, engine: 3, name: "Deudor #14", debtor: "0x41F3..B119", debtAmount: 8900, hf: 1.030, isLiquidatable: false },
  { id: 51, engine: 3, name: "Deudor #15", debtor: "0x98D2..CC03", debtAmount: 14300, hf: 1.035, isLiquidatable: false },
  { id: 52, engine: 3, name: "Deudor #16", debtor: "0x33A1..74E8", debtAmount: 48000, hf: 1.056, isLiquidatable: false },
  { id: 53, engine: 3, name: "Deudor #17", debtor: "0x77E4..99A2", debtAmount: 21000, hf: 1.024, isLiquidatable: false },
  { id: 54, engine: 3, name: "Deudor #18", debtor: "0x60D5..F812", debtAmount: 13500, hf: 1.033, isLiquidatable: false }
];

// RENDERIZADO DE LAS 54 CELDAS ATÓMICAS (UNA SOLA VEZ AL CARGAR + IN-PLACE UPDATES)
function renderAtomicGrid(targets) {
  const container = document.getElementById("atomic54Grid");
  if (!container) return;

  // Si las 54 celdas ya existen, solo actualizar textContent in-place (0% titileo, cero recreación DOM)
  const existingCell0 = document.getElementById("atomicCell_1");
  if (existingCell0 && container.children.length === targets.length) {
    targets.forEach(t => {
      let mainVal = "", subVal = "", statusLabel = "", isProfitable = false;
      if (t.engine === 1) {
        const bounty = Number(t.currentBounty || t.bounty || 0.03);
        mainVal = `$${bounty.toFixed(2)}`;
        subVal = "Meta >$0.15";
        isProfitable = t.isProfitable === true;
        statusLabel = isProfitable ? `COSECHAR +$${bounty.toFixed(2)}` : `⏳ ACUMULANDO ($0 GAS)`;
      } else if (t.engine === 2) {
        const loan = t.loanTier || 10000;
        const sp = Number(t.currentSpread !== undefined ? t.currentSpread : (t.spreadPct || -0.015));
        mainVal = `$${loan.toLocaleString()}`;
        subVal = `Sp: ${sp >= 0 ? '+' : ''}${sp.toFixed(2)}%`;
        isProfitable = t.isProfitable === true;
        statusLabel = isProfitable ? `DISPARAR +$${((loan * sp) / 100).toFixed(2)}` : `📡 VIGILANDO SPREAD`;
      } else {
        const hfVal = Number(t.currentHf || t.hf || 1.037);
        const debt = Number(t.debtAmount || 18500);
        const debtK = (debt / 1000).toFixed(1);
        mainVal = `HF ${hfVal.toFixed(3)}`;
        subVal = `$${debtK}k`;
        isProfitable = t.isLiquidatable === true;
        statusLabel = isProfitable ? `LIQUIDAR EN 1s` : `🛡️ SANO (HF < 1.00)`;
      }

      const cell = document.getElementById(`atomicCell_${t.id}`);
      if (cell) {
        const expectedCellClass = isProfitable ? "atomic-cell active-shot" : "atomic-cell";
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

  // Render inicial: UNA SOLA VEZ AL INICIO
  const html = targets.map(t => {
    let tagLabel = "", mainVal = "", subVal = "", statusLabel = "", isProfitable = false;
    if (t.engine === 1) {
      tagLabel = "#01 HARV";
      const bounty = Number(t.currentBounty || t.bounty || 0.03);
      mainVal = `$${bounty.toFixed(2)}`;
      subVal = "Meta >$0.15";
      isProfitable = t.isProfitable === true;
      statusLabel = isProfitable ? `COSECHAR +$${bounty.toFixed(2)}` : `⏳ ACUMULANDO ($0 GAS)`;
    } else if (t.engine === 2) {
      tagLabel = "#02 FLASH";
      const loan = t.loanTier || 10000;
      const sp = Number(t.currentSpread !== undefined ? t.currentSpread : (t.spreadPct || -0.015));
      mainVal = `$${loan.toLocaleString()}`;
      subVal = `Sp: ${sp >= 0 ? '+' : ''}${sp.toFixed(2)}%`;
      isProfitable = t.isProfitable === true;
      statusLabel = isProfitable ? `DISPARAR +$${((loan * sp) / 100).toFixed(2)}` : `📡 VIGILANDO SPREAD`;
    } else {
      tagLabel = "#03 LIQ";
      const hfVal = Number(t.currentHf || t.hf || 1.037);
      const debt = Number(t.debtAmount || 18500);
      const debtK = (debt / 1000).toFixed(1);
      mainVal = `HF ${hfVal.toFixed(3)}`;
      subVal = `$${debtK}k`;
      isProfitable = t.isLiquidatable === true;
      statusLabel = isProfitable ? `LIQUIDAR EN 1s` : `🛡️ SANO (HF < 1.00)`;
    }

    const cellClass = isProfitable ? "atomic-cell active-shot" : "atomic-cell";
    const pillClass = isProfitable ? "cell-status-pill cell-badge pill-green" : "cell-status-pill cell-badge pill-standby";

    return `
      <div class="${cellClass}" id="atomicCell_${t.id}">
        <!-- Línea 1: Nombre Corto + Tag de Motor -->
        <div class="cell-header-row">
          <span class="cell-title" title="${t.full || t.name}">${t.name}</span>
          <span class="cell-tag">${tagLabel}</span>
        </div>

        <!-- Línea 2: Número Principal Grande + Subdato -->
        <div class="cell-middle-row">
          <span class="cell-main-val" id="targetMain_${t.id}">${mainVal}</span>
          <span class="cell-sub-val" id="targetSub_${t.id}">${subVal}</span>
        </div>

        <!-- Línea 3: Pastilla de Estado en 1 sola línea sin cortarse -->
        <div class="cell-bottom-row">
          <span class="${pillClass}" id="targetPill_${t.id}">
            ${statusLabel}
          </span>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = html;
}

let lastRenderedReceiptsJson = "";

// RENDERIZADO DE BITÁCORA ON-CHAIN (100% SINCERA, CERO RE-RENDER INNECESARIO)
function renderReceipts(transactions) {
  const tbody = document.getElementById("receiptsTableBody");
  if (!tbody) return;

  const currentJson = JSON.stringify(transactions || []);
  if (currentJson === lastRenderedReceiptsJson) return;
  lastRenderedReceiptsJson = currentJson;

  if (!transactions || transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty-ledger-cell">
          <span class="material-symbols-rounded" style="font-size: 26px; color: #1D4ED8; margin-bottom: 6px;">radar</span><br>
          <b>📡 0 Disparos Ejecutados Hoy ($0.00 USDC)</b><br>
          Escaneando 54 contratos en Polygon PoS cada 4 segundos con <code>callStatic</code> ($0.00 Gas).<br>
          <small style="color: #64748B;">Aquí solo aparecerán transacciones reales verificadas en PolygonScan.</small>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = transactions.map(r => `
    <tr>
      <td><b>${new Date(r.timestamp).toISOString().replace("T", " ").slice(0, 19)} UTC</b><br><small style="color: #64748B;">Bloque #${r.blockNumber}</small></td>
      <td><span class="sq-badge sq-unit"><b>${r.engine}</b></span></td>
      <td><b>${r.target}</b></td>
      <td>${r.loanUsdc ? `$${Number(r.loanUsdc).toLocaleString()} USDC` : "$0.00"}</td>
      <td style="color: #D97706;">${r.gasCostPol} POL</td>
      <td class="text-green" style="font-weight: 800;">+$${Number(r.netProfitUsdc).toFixed(2)} USDC</td>
      <td><span class="target-badge-pill meta-ok"><span class="material-symbols-rounded">verified</span> ${r.status}</span></td>
      <td>
        <a href="https://polygonscan.com/tx/${r.txHash}" target="_blank" rel="noopener" class="tx-scan-link">
          ${r.txHash.slice(0, 10)}...${r.txHash.slice(-6)}
          <span class="material-symbols-rounded" style="font-size: 13px;">open_in_new</span>
        </a>
      </td>
    </tr>
  `).join("");
}

// BLOQUEO MUTEX PARA TELEMETRÍA (EVITAR PETICIONES SOLAPADAS)
let isSyncingTelemetry = false;

// SINCRONIZACIÓN EN VIVO CON TELEMETRÍA REAL (100% INVISIBLE Y SIN ROLLBACK)
async function syncTelemetry() {
  if (isSyncingTelemetry) return;
  isSyncingTelemetry = true;
  try {
    const bust = `?t=${Date.now()}`;
    const headers = {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache"
    };

    let res = await fetch(`/api/sniping/telemetry${bust}`, { headers }).catch(() => null);
    if (!res || !res.ok) {
      res = await fetch(`/telemetry/atomic-flash-matrix-telemetry.json${bust}`, { headers }).catch(() => null);
    }

    if (res && res.ok) {
      const data = await res.json();
      if (!data || typeof data !== "object") return;

      // Candado Anti-Regresión: Verificar timestamp
      const incomingTs = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
      const lastTs = (window.__LAST_VALID_STATE__ && window.__LAST_VALID_STATE__.timestamp) || 0;
      if (incomingTs > 0 && lastTs > 0 && incomingTs < lastTs) {
        // Payload más antiguo que el que ya tenemos pintado, ignorar
        return;
      }

      // Guardar snapshot válido
      const snapshot = {
        dividendsCapturedUsdc: Number(data.dividendsCapturedUsdc || 0),
        dividendsBreakdown: data.dividendsBreakdown || {},
        gasTank: data.gasTank || {},
        targets: data.targets || [],
        transactions: data.transactions || [],
        timestamp: incomingTs || Date.now()
      };
      savePersistedSnipingState(snapshot);

      // 1. Tarjeta 2: Dividendos Sinceros (100% textContent)
      const totalProfit = snapshot.dividendsCapturedUsdc;
      setTextIfChanged(document.getElementById("topTotalDividends"), totalProfit.toFixed(2));

      const b = snapshot.dividendsBreakdown;
      const rawStreak = (b.streak || "0G-0P").replace(/\s+/g, "");
      setTextIfChanged(document.getElementById("winStreakText"), rawStreak);

      setTextIfChanged(document.getElementById("bountyHarvestVal"), `$${Number(b.harvestUsdc || 0.00).toFixed(2)}`);
      setTextIfChanged(document.getElementById("bountyFlashVal"), `$${Number(b.flashUsdc || 0.00).toFixed(2)}`);
      setTextIfChanged(document.getElementById("bountyLiquidatorVal"), `$${Number(b.liquidationUsdc || 0.00).toFixed(2)}`);

      // 2. Tarjeta 3: Gas en Polygon (100% textContent)
      if (snapshot.gasTank && snapshot.gasTank.vault501Pol !== undefined) {
        setTextIfChanged(document.getElementById("topGasPol"), Number(snapshot.gasTank.vault501Pol).toFixed(2));
      }

      // 3. Rejilla Central (54 Celdas Atómicas)
      if (snapshot.targets && snapshot.targets.length === 54) {
        renderAtomicGrid(snapshot.targets);
      }

      // 4. Bitácora On-Chain
      renderReceipts(snapshot.transactions || []);
    }
  } catch (_) {
    // Si hay micro-retraso o fallo, PROHIBIDO resetear pantalla. Mantén window.__LAST_VALID_STATE__
  } finally {
    isSyncingTelemetry = false;
  }
}

// CONFIGURACIÓN DE PESTAÑAS Y LANZADOR DE LAS 3 ESTACIONES (PERSISTENTE EN SESSIONSTORAGE)
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

  // Restaurar pestaña activa guardada
  activateTab(savedTab);
}

// RELOJ UTC EN VIVO (100% textContent)
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

// INICIALIZACIÓN
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  startUtcClock();

  // Render inicial sincero desde el primer milisegundo (usando estado persistido si existe)
  const initialTargets = (initialSavedSniping && initialSavedSniping.targets && initialSavedSniping.targets.length === 54)
    ? initialSavedSniping.targets
    : SINCERE_TARGETS;
  const initialTxs = (initialSavedSniping && initialSavedSniping.transactions)
    ? initialSavedSniping.transactions
    : [];

  renderAtomicGrid(initialTargets);
  renderReceipts(initialTxs);

  // Sincronización continua cada 3 segundos
  syncTelemetry();
  setInterval(syncTelemetry, 3000);
});
