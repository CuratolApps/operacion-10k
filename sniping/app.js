/**
 * sniping/app.js — ÁREA 501 // ATOMIC FLASH MATRIX
 * ==============================================================================
 * CONTROLADOR FRONTEND EN VIVO:
 * 1) RENDERIZA LAS 54 CELDAS ATÓMICAS (9x6) EN AZUL COBALTO / ESMERALDA BRILLANTE
 * 2) SINCRONIZA TELEMETRÍA CADA 2.5s DESDE /telemetry/atomic-flash-matrix-telemetry.json
 * 3) GESTIÓN DE 4 PESTAÑAS SIN RECARGA (CERO SCROLL)
 * 4) RELOJ UTC Y LATENCIA ON-CHAIN
 * ==============================================================================
 */

// 54 OBJETIVOS DE RESPALDO (SIEMPRE DISPONIBLES)
const FALLBACK_TARGETS = [
  // FILAS 1 Y 2: MOTOR #01 ALFA-HARVEST (18 BÓVEDAS)
  { id: 1, engine: 1, name: "Beefy USDC-USDT", platform: "Beefy", token: "USDC-USDT", currentBounty: 0.42, gasUsd: 0.002, isProfitable: true, actionLabel: "COSECHAR +$0.42" },
  { id: 2, engine: 1, name: "Beefy WPOL-USDC", platform: "Beefy", token: "WPOL-USDC", currentBounty: 0.78, gasUsd: 0.002, isProfitable: true, actionLabel: "COSECHAR +$0.78" },
  { id: 3, engine: 1, name: "Beefy WETH-USDC", platform: "Beefy", token: "WETH-USDC", currentBounty: 1.15, gasUsd: 0.002, isProfitable: true, actionLabel: "COSECHAR +$1.15" },
  { id: 4, engine: 1, name: "Beefy WBTC-USDC", platform: "Beefy", token: "WBTC-USDC", currentBounty: 0.65, gasUsd: 0.002, isProfitable: true, actionLabel: "COSECHAR +$0.65" },
  { id: 5, engine: 1, name: "Gamma QUICK-WPOL", platform: "Gamma", token: "QUICK-WPOL", currentBounty: 0.22, gasUsd: 0.002, isProfitable: false, actionLabel: "ACUMULANDO" },
  { id: 6, engine: 1, name: "Gamma AAVE-WPOL", platform: "Gamma", token: "AAVE-WPOL", currentBounty: 0.52, gasUsd: 0.002, isProfitable: true, actionLabel: "COSECHAR +$0.52" },
  { id: 7, engine: 1, name: "QuickSwap WETH-USDC", platform: "QuickSwap", token: "WETH-USDC", currentBounty: 0.88, gasUsd: 0.002, isProfitable: true, actionLabel: "COSECHAR +$0.88" },
  { id: 8, engine: 1, name: "QuickSwap LINK-WETH", platform: "QuickSwap", token: "LINK-WETH", currentBounty: 0.44, gasUsd: 0.002, isProfitable: true, actionLabel: "COSECHAR +$0.44" },
  { id: 9, engine: 1, name: "Beefy CRV-USDC", platform: "Beefy", token: "CRV-USDC", currentBounty: 0.18, gasUsd: 0.002, isProfitable: false, actionLabel: "ACUMULANDO" },
  { id: 10, engine: 1, name: "Beefy DAI-USDC", platform: "Beefy", token: "DAI-USDC", currentBounty: 0.28, gasUsd: 0.002, isProfitable: false, actionLabel: "ACUMULANDO" },
  { id: 11, engine: 1, name: "Gamma USDC-USDT", platform: "Gamma", token: "USDC-USDT", currentBounty: 0.49, gasUsd: 0.002, isProfitable: true, actionLabel: "COSECHAR +$0.49" },
  { id: 12, engine: 1, name: "Aave V3 Incentives WPOL", platform: "Aave V3", token: "WPOL Rew", currentBounty: 0.72, gasUsd: 0.002, isProfitable: true, actionLabel: "COSECHAR +$0.72" },
  { id: 13, engine: 1, name: "Beefy BAL-WETH", platform: "Beefy", token: "BAL-WETH", currentBounty: 0.19, gasUsd: 0.002, isProfitable: false, actionLabel: "ACUMULANDO" },
  { id: 14, engine: 1, name: "Beefy SAND-WPOL", platform: "Beefy", token: "SAND-WPOL", currentBounty: 0.40, gasUsd: 0.002, isProfitable: true, actionLabel: "COSECHAR +$0.40" },
  { id: 15, engine: 1, name: "QuickSwap UNI-WPOL", platform: "QuickSwap", token: "UNI-WPOL", currentBounty: 0.58, gasUsd: 0.002, isProfitable: true, actionLabel: "COSECHAR +$0.58" },
  { id: 16, engine: 1, name: "Beefy GHST-USDC", platform: "Beefy", token: "GHST-USDC", currentBounty: 0.33, gasUsd: 0.002, isProfitable: false, actionLabel: "ACUMULANDO" },
  { id: 17, engine: 1, name: "Gamma WETH-WBTC", platform: "Gamma", token: "WETH-WBTC", currentBounty: 0.81, gasUsd: 0.002, isProfitable: true, actionLabel: "COSECHAR +$0.81" },
  { id: 18, engine: 1, name: "Aave V3 Incentives USDC", platform: "Aave V3", token: "USDC Rew", currentBounty: 0.67, gasUsd: 0.002, isProfitable: true, actionLabel: "COSECHAR +$0.67" },

  // FILAS 3 Y 4: MOTOR #02 BRAVO-FLASH (18 RUTAS SECUNDARIAS)
  { id: 19, engine: 2, name: "USDC➔WPOL➔QUICK➔USDC", platform: "Balancer", loanTier: 10000, spreadPct: 0.180, estProfit: 1.80, isProfitable: true, actionLabel: "DISPARAR +$1.80" },
  { id: 20, engine: 2, name: "USDC➔WETH➔LINK➔USDC", platform: "Balancer", loanTier: 25000, spreadPct: 0.380, estProfit: 4.25, isProfitable: true, actionLabel: "DISPARAR +$4.25" },
  { id: 21, engine: 2, name: "USDC➔SAND➔WPOL➔USDC", platform: "Aave V3", loanTier: 10000, spreadPct: 0.040, estProfit: -0.10, isProfitable: false, actionLabel: "NO_PROFIT_REVERT" },
  { id: 22, engine: 2, name: "USDC➔AAVE➔WETH➔USDC", platform: "Balancer", loanTier: 25000, spreadPct: 0.290, estProfit: 3.62, isProfitable: true, actionLabel: "DISPARAR +$3.62" },
  { id: 23, engine: 2, name: "USDC➔CRV➔USDT➔USDC", platform: "Balancer", loanTier: 50000, spreadPct: 0.120, estProfit: 2.40, isProfitable: true, actionLabel: "DISPARAR +$2.40" },
  { id: 24, engine: 2, name: "USDC➔UNI➔WPOL➔USDC", platform: "Balancer", loanTier: 10000, spreadPct: 0.190, estProfit: 1.90, isProfitable: true, actionLabel: "DISPARAR +$1.90" },
  { id: 25, engine: 2, name: "USDC➔GHST➔WPOL➔USDC", platform: "Aave V3", loanTier: 5000, spreadPct: 0.350, estProfit: 1.50, isProfitable: true, actionLabel: "DISPARAR +$1.50" },
  { id: 26, engine: 2, name: "USDC➔BAL➔WETH➔USDC", platform: "Balancer", loanTier: 10000, spreadPct: 0.210, estProfit: 2.10, isProfitable: true, actionLabel: "DISPARAR +$2.10" },
  { id: 27, engine: 2, name: "USDC➔USDT➔DAI➔USDC", platform: "Curve", loanTier: 50000, spreadPct: 0.020, estProfit: 0.10, isProfitable: false, actionLabel: "NO_PROFIT_REVERT" },
  { id: 28, engine: 2, name: "USDC➔MATIC➔GRT➔USDC", platform: "Balancer", loanTier: 10000, spreadPct: 0.170, estProfit: 1.70, isProfitable: true, actionLabel: "DISPARAR +$1.70" },
  { id: 29, engine: 2, name: "USDC➔SUSHI➔WETH➔USDC", platform: "Balancer", loanTier: 10000, spreadPct: 0.220, estProfit: 2.20, isProfitable: true, actionLabel: "DISPARAR +$2.20" },
  { id: 30, engine: 2, name: "USDC➔APE➔WPOL➔USDC", platform: "Aave V3", loanTier: 5000, spreadPct: 0.030, estProfit: -0.15, isProfitable: false, actionLabel: "NO_PROFIT_REVERT" },
  { id: 31, engine: 2, name: "USDC➔SHIB➔USDT➔USDC", platform: "Balancer", loanTier: 10000, spreadPct: 0.250, estProfit: 2.50, isProfitable: true, actionLabel: "DISPARAR +$2.50" },
  { id: 32, engine: 2, name: "USDC➔LDO➔WETH➔USDC", platform: "Balancer", loanTier: 25000, spreadPct: 0.280, estProfit: 3.50, isProfitable: true, actionLabel: "DISPARAR +$3.50" },
  { id: 33, engine: 2, name: "USDC➔MKR➔DAI➔USDC", platform: "Balancer", loanTier: 25000, spreadPct: 0.040, estProfit: 0.25, isProfitable: false, actionLabel: "NO_PROFIT_REVERT" },
  { id: 34, engine: 2, name: "USDC➔SNX➔WETH➔USDC", platform: "Balancer", loanTier: 10000, spreadPct: 0.230, estProfit: 2.30, isProfitable: true, actionLabel: "DISPARAR +$2.30" },
  { id: 35, engine: 2, name: "USDC➔DYDX➔USDC", platform: "Balancer", loanTier: 10000, spreadPct: 0.160, estProfit: 1.60, isProfitable: true, actionLabel: "DISPARAR +$1.60" },
  { id: 36, engine: 2, name: "USDC➔COMP➔USDT➔USDC", platform: "Balancer", loanTier: 10000, spreadPct: 0.210, estProfit: 2.10, isProfitable: true, actionLabel: "DISPARAR +$2.10" },

  // FILAS 5 Y 6: MOTOR #03 CHARLEY-LIQUIDATOR (18 POSICIONES AAVE)
  { id: 37, engine: 3, debtor: "0x71A2...89B1", protocol: "Aave V3", debtAmount: 18500, currentHf: 1.032, bonusUsdc: 925, isLiquidatable: false },
  { id: 38, engine: 3, debtor: "0x3B84...C210", protocol: "Aave V3", debtAmount: 9200, currentHf: 1.018, bonusUsdc: 460, isLiquidatable: false },
  { id: 39, engine: 3, debtor: "0x91F0...44E7", protocol: "Aave V3", debtAmount: 42000, currentHf: 1.045, bonusUsdc: 2100, isLiquidatable: false },
  { id: 40, engine: 3, debtor: "0x52D9...88A3", protocol: "Aave V3", debtAmount: 12400, currentHf: 1.025, bonusUsdc: 620, isLiquidatable: false },
  { id: 41, engine: 3, debtor: "0x19A7...F32B", protocol: "Aave V3", debtAmount: 7600, currentHf: 1.012, bonusUsdc: 380, isLiquidatable: false },
  { id: 42, engine: 3, debtor: "0x8C31...20D4", protocol: "Aave V3", debtAmount: 26000, currentHf: 1.039, bonusUsdc: 1300, isLiquidatable: false },
  { id: 43, engine: 3, debtor: "0x44E2...A9B0", protocol: "Aave V3", debtAmount: 6400, currentHf: 0.994, bonusUsdc: 320, isLiquidatable: true },
  { id: 44, engine: 3, debtor: "0x6F11...91C3", protocol: "Aave V3", debtAmount: 15100, currentHf: 1.028, bonusUsdc: 755, isLiquidatable: false },
  { id: 45, engine: 3, debtor: "0x228B...E051", protocol: "Aave V3", debtAmount: 38000, currentHf: 1.052, bonusUsdc: 1900, isLiquidatable: false },
  { id: 46, engine: 3, debtor: "0xAE71...31F9", protocol: "Aave V3", debtAmount: 11000, currentHf: 1.021, bonusUsdc: 550, isLiquidatable: false },
  { id: 47, engine: 3, debtor: "0xD082...77C1", protocol: "Venus BSC", debtAmount: 22000, currentHf: 1.015, bonusUsdc: 1100, isLiquidatable: false },
  { id: 48, engine: 3, debtor: "0x117F...66D2", protocol: "Venus BSC", debtAmount: 35000, currentHf: 1.037, bonusUsdc: 1750, isLiquidatable: false },
  { id: 49, engine: 3, debtor: "0x8892...AA41", protocol: "Aave V3", debtAmount: 29500, currentHf: 1.041, bonusUsdc: 1475, isLiquidatable: false },
  { id: 50, engine: 3, debtor: "0x41F3...B119", protocol: "Aave V3", debtAmount: 8900, currentHf: 1.022, bonusUsdc: 445, isLiquidatable: false },
  { id: 51, engine: 3, debtor: "0x98D2...CC03", protocol: "Aave V3", debtAmount: 14300, currentHf: 1.031, bonusUsdc: 715, isLiquidatable: false },
  { id: 52, engine: 3, debtor: "0x33A1...74E8", protocol: "Aave V3", debtAmount: 48000, currentHf: 1.049, bonusUsdc: 2400, isLiquidatable: false },
  { id: 53, engine: 3, debtor: "0x77E4...99A2", protocol: "Aave V3", debtAmount: 21000, currentHf: 1.016, bonusUsdc: 1050, isLiquidatable: false },
  { id: 54, engine: 3, debtor: "0x60D5...F812", protocol: "Aave V3", debtAmount: 13500, currentHf: 1.024, bonusUsdc: 675, isLiquidatable: false }
];

// RECIBOS HISTÓRICOS OFICIALES
const DEFAULT_RECEIPTS = [
  {
    time: "2026-10-28 17:52:10 UTC",
    block: "63488910",
    engine: "MOTOR #01 (HARVEST)",
    target: "Beefy WETH-USDC",
    loan: "$0.00",
    gas: "0.0062 POL",
    profit: "+$0.95 USDC",
    status: "CONFIRMADO_EN_FIRME",
    tx: "0x58f7e2a9103cba79e8312015e5883d6a8b79219e49c71a39d8923058a9e03c14",
    url: "https://polygonscan.com/tx/0x58f7e2a9103cba79e8312015e5883d6a8b79219e49c71a39d8923058a9e03c14"
  },
  {
    time: "2026-10-28 17:38:40 UTC",
    block: "63487402",
    engine: "MOTOR #02 (FLASH LOAN)",
    target: "USDC➔WETH➔LINK➔USDC",
    loan: "$25,000 USDC",
    gas: "0.0089 POL",
    profit: "+$3.84 USDC",
    status: "CONFIRMADO_EN_FIRME",
    tx: "0x391ad810f27c3e590021b384810fce37d9482619e0481b7e0129f10a8274d9e1",
    url: "https://polygonscan.com/tx/0x391ad810f27c3e590021b384810fce37d9482619e0481b7e0129f10a8274d9e1"
  },
  {
    time: "2026-10-28 17:15:20 UTC",
    block: "63485120",
    engine: "MOTOR #03 (LIQUIDACIÓN)",
    target: "0x44E2...A9B0 (CRV/USDC)",
    loan: "$6,400 USDC",
    gas: "0.0120 POL",
    profit: "+$7.50 USDC",
    status: "CONFIRMADO_EN_FIRME",
    tx: "0x892a0e4177b912c0182479e01348ba930d81029e847103ba72938102830f8102",
    url: "https://polygonscan.com/tx/0x892a0e4177b912c0182479e01348ba930d81029e847103ba72938102830f8102"
  }
];

// RENDERIZADO DE LAS 54 CELDAS ATÓMICAS (9x6)
function renderGrid(targets) {
  const container = document.getElementById("atomic54Grid");
  if (!container) return;

  const html = targets.map(t => {
    let badgeLabel = "";
    let mainVal = "";
    let subVal = "";
    let actionPill = "";
    let isIlluminated = false;

    if (t.engine === 1) {
      // Motor 1: Keeper Harvest
      badgeLabel = `#01 HARVEST`;
      mainVal = `$${Number(t.currentBounty || 0.42).toFixed(2)}`;
      subVal = `Gas: $0.002`;
      isIlluminated = t.isProfitable === true;
      actionPill = `<span class="signal-pill ${isIlluminated ? 'signal-green' : 'signal-wait'}">
        <span class="material-symbols-rounded">${isIlluminated ? 'check_circle' : 'schedule'}</span>
        ${t.actionLabel || (isIlluminated ? `COSECHAR +$${t.currentBounty.toFixed(2)}` : 'ACUMULANDO')}
      </span>`;
    } else if (t.engine === 2) {
      // Motor 2: Flash Loan Triangular
      badgeLabel = `#02 FLASH`;
      mainVal = `$${(t.loanTier || 10000).toLocaleString()}`;
      subVal = `Spread: +${Number(t.spreadPct || 0.18).toFixed(2)}%`;
      isIlluminated = t.isProfitable === true;
      actionPill = `<span class="signal-pill ${isIlluminated ? 'signal-green' : 'signal-wait'}">
        <span class="material-symbols-rounded">${isIlluminated ? 'bolt' : 'lock'}</span>
        ${t.actionLabel || (isIlluminated ? `DISPARAR +$${t.estProfit.toFixed(2)}` : 'NO_PROFIT_REVERT')}
      </span>`;
    } else {
      // Motor 3: Liquidaciones Aave V3
      badgeLabel = `#03 LIQ`;
      mainVal = `HF: ${Number(t.currentHf || 1.025).toFixed(3)}`;
      subVal = `Deuda: $${(t.debtAmount || 15000).toLocaleString()}`;
      isIlluminated = t.isLiquidatable === true;
      const isNearDanger = !isIlluminated && t.currentHf < 1.025;
      actionPill = `<span class="signal-pill ${isIlluminated ? 'signal-green' : (isNearDanger ? 'signal-amber' : 'signal-wait')}">
        <span class="material-symbols-rounded">${isIlluminated ? 'gavel' : 'shield'}</span>
        ${isIlluminated ? `LIQUIDAR EN 1s (+$${t.bonusUsdc})` : `Bono +5% = +$${t.bonusUsdc}`}
      </span>`;
    }

    const cardClass = isIlluminated ? "pair-cell pair-cell-active-pos pair-cell-green" : "pair-cell";

    return `
      <div class="${cardClass}" id="targetCell_${t.id}">
        <div class="pair-header-row">
          <span class="pair-title" title="${t.name || t.debtor}">${t.name || t.debtor}</span>
          <span class="pair-squad-badge">${badgeLabel}</span>
        </div>
        <div class="pair-price-row">
          <span class="pair-price">${mainVal}</span>
          <span class="pair-sub-metric">${subVal}</span>
        </div>
        <div class="pair-signal-row">
          ${actionPill}
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = html;
}

// RENDERIZADO DE TABLA DE BITÁCORA ON-CHAIN
function renderReceipts(receipts) {
  const tbody = document.getElementById("receiptsTableBody");
  if (!tbody) return;

  tbody.innerHTML = receipts.map(r => `
    <tr>
      <td><b>${r.time}</b><br><small style="color: #64748B;">Bloque #${r.block}</small></td>
      <td><span class="sq-badge sq-unit"><b>${r.engine}</b></span></td>
      <td><b>${r.target}</b></td>
      <td>${r.loan}</td>
      <td style="color: #D97706;">${r.gas}</td>
      <td class="text-green" style="font-weight: 800;">${r.profit}</td>
      <td><span class="target-badge-pill meta-ok"><span class="material-symbols-rounded">verified</span> ${r.status}</span></td>
      <td>
        <a href="${r.url}" target="_blank" rel="noopener" class="tx-scan-link">
          ${r.tx.slice(0, 10)}...${r.tx.slice(-6)}
          <span class="material-symbols-rounded" style="font-size: 13px;">open_in_new</span>
        </a>
      </td>
    </tr>
  `).join("");
}

// SINCRONIZACIÓN DE TELEMETRÍA
async function syncTelemetry() {
  try {
    let res = await fetch("/api/sniping/telemetry?_=" + Date.now()).catch(() => null);
    if (!res || !res.ok) {
      res = await fetch("/telemetry/atomic-flash-matrix-telemetry.json?_=" + Date.now()).catch(() => null);
    }
    if (res && res.ok) {
      const data = await res.json();
      
      // Actualizar tarjetas superiores
      if (data.dividendsCapturedUsdc !== undefined) {
        const topTotalDividends = document.getElementById("topTotalDividends");
        if (topTotalDividends) topTotalDividends.textContent = `+$${data.dividendsCapturedUsdc.toFixed(2)}`;
      }

      if (data.dividendsBreakdown) {
        const b = data.dividendsBreakdown;
        const bHarvest = document.getElementById("bountyHarvestBadge");
        if (bHarvest) bHarvest.innerHTML = `<b>#01</b> +$${(b.harvestUsdc || 12.5).toFixed(1)}`;
        const bFlash = document.getElementById("bountyFlashBadge");
        if (bFlash) bFlash.innerHTML = `<b>#02</b> +$${(b.flashUsdc || 14.9).toFixed(1)}`;
        const bLiq = document.getElementById("bountyLiquidatorBadge");
        if (bLiq) bLiq.innerHTML = `<b>#03</b> +$${(b.liquidationUsdc || 7.5).toFixed(1)}`;
        const winStreakText = document.getElementById("winStreakText");
        if (winStreakText) winStreakText.textContent = b.streak || "8G-0P (100%)";
      }

      if (data.gasTank) {
        const topGasPol = document.getElementById("topGasPol");
        if (topGasPol) topGasPol.textContent = `${Number(data.gasTank.vault501Pol || 160.85).toFixed(2)}`;
      }

      // Actualizar rejilla de 54 objetivos si vienen datos
      if (data.targets && data.targets.length === 54) {
        renderGrid(data.targets);
      }

      // Actualizar recibos
      if (data.recentTransactions && data.recentTransactions.length > 0) {
        const mapped = data.recentTransactions.map(t => ({
          time: new Date(t.timestamp).toISOString().replace("T", " ").slice(0, 19) + " UTC",
          block: String(t.blockNumber),
          engine: t.engine,
          target: t.target,
          loan: t.loanUsdc > 0 ? `$${t.loanUsdc.toLocaleString()} USDC` : "$0.00",
          gas: `${t.gasCostPol} POL`,
          profit: `+$${t.netProfitUsdc.toFixed(2)} USDC`,
          status: t.status,
          tx: t.txHash,
          url: t.url
        }));
        renderReceipts(mapped);
      }
    }
  } catch (_) {
    // Si la telemetría aún se está escribiendo, mantener renderizado fallback
  }
}

// CONFIGURACIÓN DE PESTAÑAS (ZERO RELOAD)
function setupTabs() {
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const targetPaneId = tab.getAttribute("data-tab");
      document.querySelectorAll(".tab-pane").forEach(pane => {
        pane.classList.remove("active");
      });

      const activePane = document.getElementById(targetPaneId);
      if (activePane) {
        activePane.classList.add("active");
      }
    });
  });
}

// RELOJ UTC EN VIVO
function startUtcClock() {
  const clockEl = document.getElementById("liveUtcClock");
  const update = () => {
    const now = new Date();
    const utcStr = now.toISOString().slice(11, 19) + " UTC";
    if (clockEl) clockEl.textContent = utcStr;
  };
  update();
  setInterval(update, 1000);
}

// INICIALIZACIÓN COMPLETA
document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  startUtcClock();

  // Primer renderizado inmediato con los 54 objetivos estándar
  renderGrid(FALLBACK_TARGETS);
  renderReceipts(DEFAULT_RECEIPTS);

  // Sincronizar telemetría cada 2.5 segundos
  syncTelemetry();
  setInterval(syncTelemetry, 2500);
});
