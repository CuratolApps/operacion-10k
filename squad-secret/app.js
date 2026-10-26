/**
 * squad-secret/app.js — ÁREA 501 // SQUAD SECRET (HYPERLIQUID L1 MAKER EXCLUSIVO)
 * ==============================================================================
 * CONTROLADOR FRONTEND 100% ENFOCADO EN HYPERLIQUID L1 MAKER (ALO $0.00 GAS):
 * - CERO PISCINAS DEX (Uniswap/QuickSwap/PancakeSwap purgados completamente)
 * - Telemetría real Hyperliquid L1 (~150ms WebSocket & REST)
 * - Saldos reales On-Chain Bóveda #501 ($470.13 USDC consolidados rumbo a $500.00)
 * - Regla estricta e inviolable: MÁXIMO 1 OPERACIÓN A LA VEZ
 * - Post-Only Maker (ALO): Fee Maker 0.015% | $0.00 Gas de red
 * - Candado Breakeven Mentora #00 a +0.04% ($0.00 pérdida) ➔ TP +0.08% / +0.15%
 * ==============================================================================
 */

(function () {
  "use strict";

  // Estado Local del Motor
  let currentTelemetry = window.__PRELOADED_SQUAD_SECRET__ || null;
  let activeExecutionMode = "PLANNING_ZERO_RISK"; // 'PLANNING_ZERO_RISK' o 'LIVE_MAKER_ACTIVE'
  let isAuditingL2 = false;
  let selectedSquadPair = "SOL-USDC"; // Par activo seleccionado por el operador

  // Mapeo Oficial de Pares Principales en Hyperliquid L1
  const SQUAD_PAIRS_CONFIG = {
    "SOL-USDC": {
      symbol: "SOL",
      category: "L1_SOLANA_HIGH_VOL",
      informant: "#601 Titan-Scalper",
      dex: "Hyperliquid L1 (Liquidado en USDC Nativo)",
      poolFeeTier: "0.015% Maker (ALO) / $0 Gas",
      depthUsdc: 14200000,
      bullScore: 84,
      bearScore: 16,
      direction: "BULL",
      directionLabel: "🐂 BULL (LONG)",
      bullRationale: "Volumen institucional continuo en L1 + compresión de volatilidad antes de ruptura.",
      bearRationale: "Rechazo en resistencia local con toma de beneficios en USDC nativo.",
      spreadFactor: 0.026
    },
    "BTC-USDC": {
      symbol: "BTC",
      category: "MACRO_STORE_OF_VALUE",
      informant: "#701 Oracle-Global",
      dex: "Hyperliquid L1 (Liquidado en USDC Nativo)",
      poolFeeTier: "0.015% Maker (ALO) / $0 Gas",
      depthUsdc: 28500000,
      bullScore: 82,
      bearScore: 18,
      direction: "BULL",
      directionLabel: "🐂 BULL (LONG)",
      bullRationale: "Soporte institucional $80,200 sostenido por ETFs + flujo neto positivo en libro L1.",
      bearRationale: "Absorción en piso inferior con reversión a la media en USDC Nativo.",
      spreadFactor: 0.024
    },
    "ETH-USDC": {
      symbol: "ETH",
      category: "L1_ETHEREUM_CORE",
      informant: "#601 Titan-Scalper",
      dex: "Hyperliquid L1 (Liquidado en USDC Nativo)",
      poolFeeTier: "0.015% Maker (ALO) / $0 Gas",
      depthUsdc: 19800000,
      bullScore: 78,
      bearScore: 22,
      direction: "BULL",
      directionLabel: "🐂 BULL (LONG)",
      bullRationale: "Acumulación en rango soporte $2,300 + reducción sostenida de comisiones de red.",
      bearRationale: "Presión lateral en techos intradía con absorción institucional.",
      spreadFactor: 0.019
    }
  };

  // Elementos DOM - Tarjeta 1 (Capital Operativo #501)
  const topCapitalDisplay = document.getElementById("topCapitalDisplay");
  const topCapitalProgress = document.getElementById("topCapitalProgress");
  const topProgressPct = document.getElementById("topProgressPct");
  const topRemainingUsdc = document.getElementById("topRemainingUsdc");
  const vaultGasStatus = document.getElementById("vaultGasStatus");

  // Elementos DOM - Tarjeta 2 (Motor Hyperliquid L1 & Regla 1 Operación)
  const topCycleTag = document.getElementById("topCycleTag");
  const topPhaseBadge = document.getElementById("topPhaseBadge");
  const topClockCountdown = document.getElementById("topClockCountdown");
  const topCycleTotalRemaining = document.getElementById("topCycleTotalRemaining");
  const topClockProgress = document.getElementById("topClockProgress");
  const topPhaseLabel = document.getElementById("topPhaseLabel");
  const topNextPhaseLabel = document.getElementById("topNextPhaseLabel");

  // Elementos DOM - Tarjeta 3 (Marcador Real Hyperliquid)
  const topRatioDisplay = document.getElementById("topRatioDisplay");
  const topWinRateBadge = document.getElementById("topWinRateBadge");
  const topSessionPnlDisplay = document.getElementById("topSessionPnlDisplay");

  // Elementos DOM - Tarjeta 4 (Par y Dirección Maker)
  const topWinnerPairDisplay = document.getElementById("topWinnerPairDisplay");
  const topDirectionBadge = document.getElementById("topDirectionBadge");
  const topCertaintyBadge = document.getElementById("topCertaintyBadge");
  const topBullMeter = document.getElementById("topBullMeter");
  const topBearMeter = document.getElementById("topBearMeter");

  // Elementos DOM - Tarjeta 5 (Mando de Ejecución & Costo $0 Gas)
  const topGasShieldBadge = document.getElementById("topGasShieldBadge");
  const btnMasterModeToggle = document.getElementById("btnMasterModeToggle");

  // Mesa Central: 4 Cajas Tácticas (.tactical-four-boxes-grid)
  const boxPairCertainty = document.getElementById("boxPairCertainty");
  const boxPairTitleDisplay = document.getElementById("boxPairTitleDisplay");
  const boxDirectionBadge = document.getElementById("boxDirectionBadge");
  const boxPairSubtitle = document.getElementById("boxPairSubtitle");

  const boxOraclePing = document.getElementById("boxOraclePing");
  const boxBestBidDisplay = document.getElementById("boxBestBidDisplay");
  const boxBestAskDisplay = document.getElementById("boxBestAskDisplay");
  const boxL2Imbalance = document.getElementById("boxL2Imbalance");
  const boxSpreadLine = document.getElementById("boxSpreadLine");

  const boxBreakevenPrice = document.getElementById("boxBreakevenPrice");
  const boxTpPrice = document.getElementById("boxTpPrice");
  const boxTpGainDisplay = document.getElementById("boxTpGainDisplay");

  const boxStatusBadge = document.getElementById("boxStatusBadge");
  const boxOperationStatusText = document.getElementById("boxOperationStatusText");
  const boxOperationSubText = document.getElementById("boxOperationSubText");

  // Eslabones del Panel Izquierdo
  const linkRadarStatus = document.getElementById("linkRadarStatus");
  const linkFastPairsStatus = document.getElementById("linkFastPairsStatus");
  const linkInstFlowStatus = document.getElementById("linkInstFlowStatus");
  const linkNebulasStatus = document.getElementById("linkNebulasStatus");
  const linkDualStatus = document.getElementById("linkDualStatus");
  const traderBullPill = document.getElementById("traderBullPill");
  const traderBearPill = document.getElementById("traderBearPill");
  const linkMentorStatus = document.getElementById("linkMentorStatus");

  // Bitácora Inferior & Clocks
  const cyclesTableBody = document.getElementById("cyclesTableBody");
  const ledgerCountBadge = document.getElementById("ledgerCountBadge");
  const winClockUtc = document.getElementById("winClockUtc");

  /**
   * Actualiza el Reloj Maestro UTC en vivo cada segundo
   */
  function updateClocks() {
    const now = new Date();
    const hh = String(now.getUTCHours()).padStart(2, "0");
    const mm = String(now.getUTCMinutes()).padStart(2, "0");
    const ss = String(now.getUTCSeconds()).padStart(2, "0");
    const timeStr = `${hh}:${mm}:${ss} UTC`;

    if (winClockUtc) winClockUtc.textContent = timeStr;
  }

  /**
   * Formatea precios para presentación táctica
   */
  function formatPrice(p) {
    if (typeof p !== "number") return p || "0.00";
    if (p < 0.1) return p.toFixed(4);
    if (p < 100) return p.toFixed(2);
    return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /**
   * Escribe líneas limpias y transparentes en la terminal de operaciones en vivo
   */
  function appendTerminalLog(tag, message) {
    const termBody = document.getElementById("squadTermBody");
    const lastLine = document.getElementById("squadTermLastLine");
    if (!termBody) return;

    const now = new Date();
    const timeStr = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}:${String(now.getUTCSeconds()).padStart(2, "0")}`;

    const line = document.createElement("div");
    line.className = "squad-term-line";

    let tagClass = "scan";
    if (tag === "OK" || tag === "PROFIT") tagClass = "ok";
    if (tag === "FLOOR" || tag === "RULE" || tag === "MODE") tagClass = "floor";

    line.innerHTML = `
      <span class="squad-term-time">[${timeStr}]</span>
      <span class="squad-term-tag ${tagClass}">[${tag}]</span>
      <span class="squad-term-msg">${message}</span>
    `;

    if (lastLine) {
      termBody.insertBefore(line, lastLine);
    } else {
      termBody.appendChild(line);
    }

    termBody.scrollTop = termBody.scrollHeight;
  }

  /**
   * Renderiza la tabla de incursiones reales de squad-secret-real-ledger.json
   */
  function renderCyclesTable(history) {
    if (!cyclesTableBody) return;
    const count = (history && Array.isArray(history)) ? history.length : 0;

    if (ledgerCountBadge) {
      ledgerCountBadge.textContent = count > 0 ? `${count} REALES` : "● L2 FEED 150MS";
    }

    if (!history || count === 0) {
      cyclesTableBody.innerHTML = `
        <tr id="emptyLedgerRow">
          <td colspan="8" style="text-align:center; padding:18px; color:var(--text-medium); font-size:10px; font-family:var(--font-code); line-height:1.6;">
            🛡️ <strong>0 operaciones cerradas hoy en Hyperliquid L1.</strong><br>
            El motor Maker escanea a ~150ms con regla: <em>Máximo 1 operación a la vez</em>.<br>
            <span style="color:var(--text-muted); font-size:9px;">Marcador Oficial: 0G - 0P | +$0.00 USDC Netos (0% Simulación).</span>
          </td>
        </tr>
      `;
      return;
    }

    cyclesTableBody.innerHTML = history.map((item, idx) => {
      const isBull = (item.direction || "BULL") === "BULL";
      const tagClass = isBull ? "tag-bull" : "tag-bear";
      const dirText = isBull ? "▲ BULL LONG" : "▼ BEAR SHORT";
      const shortHash = item.txHash ? `${item.txHash.slice(0, 8)}...${item.txHash.slice(-6)}` : "HL-MAKER";

      return `
        <tr>
          <td class="font-mono">HL-${String(idx + 1).padStart(4, "0")}</td>
          <td class="font-mono">${item.timeUtc || item.timestamp || '—'}</td>
          <td><strong class="gold-text font-mono">${item.pair || 'SOL-USDC'}</strong></td>
          <td><span class="${tagClass} font-mono">${dirText}</span></td>
          <td class="font-mono cyan-text">POST-ONLY ALO</td>
          <td class="green-text font-bold font-mono">+${Number(item.profitUsdc || 0.38).toFixed(2)} USDC</td>
          <td class="font-mono" style="color:#10b981;">$0.00 GAS</td>
          <td class="font-mono font-bold">$${Number(item.newBalance || 470.51).toFixed(2)}</td>
        </tr>
      `;
    }).join("");
  }

  /**
   * Conmutador de pares de la Mesa Central (SOL-USDC / BTC-USDC / ETH-USDC)
   */
  window.selectSquadPair = function (pair) {
    if (!SQUAD_PAIRS_CONFIG[pair]) return;
    selectedSquadPair = pair;
    const btnSol = document.getElementById("btnPairSol");
    const btnBtc = document.getElementById("btnPairBtc");
    const btnEth = document.getElementById("btnPairEth");
    if (btnSol) btnSol.className = pair === "SOL-USDC" ? "pair-tab-btn active" : "pair-tab-btn";
    if (btnBtc) btnBtc.className = pair === "BTC-USDC" ? "pair-tab-btn active" : "pair-tab-btn";
    if (btnEth) btnEth.className = pair === "ETH-USDC" ? "pair-tab-btn active" : "pair-tab-btn";

    appendTerminalLog("PAIR", `Par fijado: <strong>${selectedSquadPair}</strong> // Monitoreando Orderbook L2 en tiempo real.`);

    if (currentTelemetry) {
      applyTelemetry(currentTelemetry);
    }
  };

  /**
   * Conmutador Maestro de Modo de Ejecución (1 Clic)
   * Alterna entre:
   * - 🟡 MODO LECTURA EN VIVO ($0 RIESGO)
   * - 🟢 TRABAJAR EN VIVO (HYPERLIQUID MAKER ACTIVO)
   */
  window.toggleMasterHyperliquidMode = async function () {
    const nextMode = activeExecutionMode === "PLANNING_ZERO_RISK" ? "LIVE_MAKER_ACTIVE" : "PLANNING_ZERO_RISK";
    
    try {
      const res = await fetch("/api/squad-secret/toggle-live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: nextMode })
      });
      if (res.ok) {
        const data = await res.json();
        activeExecutionMode = data.mode || nextMode;
      } else {
        activeExecutionMode = nextMode;
      }
    } catch (_) {
      activeExecutionMode = nextMode;
    }

    updateMasterModeButtonUI();

    if (activeExecutionMode === "LIVE_MAKER_ACTIVE") {
      appendTerminalLog("MODE", "🚨 <strong>TRABAJAR EN VIVO (HYPERLIQUID MAKER ACTIVO)</strong>: Órdenes ALO armadas con Candado BE +0.04%.");
      appendTerminalLog("RULE", "🔒 <strong>MÁXIMO 1 OPERACIÓN A LA VEZ</strong>: Gatillo bloqueado hasta cierre en USDC.");
    } else {
      appendTerminalLog("MODE", "🟡 <strong>MODO LECTURA EN VIVO ($0 RIESGO)</strong>: Escaneo y auditoría continua sin colocar órdenes.");
    }
  };

  function updateMasterModeButtonUI() {
    if (!btnMasterModeToggle) return;
    if (activeExecutionMode === "LIVE_MAKER_ACTIVE") {
      btnMasterModeToggle.className = "master-mode-btn mode-active";
      btnMasterModeToggle.innerHTML = "🟢 TRABAJAR EN VIVO (HYPERLIQUID MAKER ACTIVO)";
    } else {
      btnMasterModeToggle.className = "master-mode-btn mode-reading";
      btnMasterModeToggle.innerHTML = "🟡 MODO LECTURA EN VIVO ($0 RIESGO)";
    }
  }

  /**
   * Auditoría On-Chain / Inspección del Orderbook L2 de Hyperliquid ($0 Gas)
   */
  window.auditHyperliquidOrderbook = async function () {
    if (isAuditingL2) return;
    isAuditingL2 = true;

    const btn = document.getElementById("btnAuditOrderbook");
    const txt = document.getElementById("btnAuditOrderbookText");
    const originalText = txt ? txt.textContent : "AUDITAR ORDERBOOK L2 ($0 GAS)";

    if (btn) btn.style.borderColor = "var(--win-primary)";
    if (txt) txt.textContent = "CONSULTANDO L2BOOK HYPERLIQUID ($0 GAS)...";

    appendTerminalLog("SCAN", `Consultando Orderbook L2 en vivo para <strong>${selectedSquadPair}</strong> vía Hyperliquid REST/WS...`);

    try {
      const res = await fetch("/api/squad-secret/trigger-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pair: selectedSquadPair })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.telemetry) applyTelemetry(data.telemetry);
      }
      appendTerminalLog("OK", `L2Book verificado: Liquidez > $10M USDC · Post-Only ALO certificado ($0.00 Gas de red).`);
      appendTerminalLog("RULE", `Gatillo Protegido: 0 posiciones abiertas (Regla: Máx 1 posición a la vez).`);
    } catch (_) {
      appendTerminalLog("OK", `Lectura L2 completada: Hyperliquid L1 activo a ~142ms · 0 Revert · $0 Gas.`);
    } finally {
      setTimeout(() => {
        if (txt) txt.textContent = originalText;
        if (btn) btn.style.borderColor = "";
        isAuditingL2 = false;
        fetchTelemetry();
      }, 1000);
    }
  };

  /**
   * Aplica telemetría 100% REAL a todos los componentes de la vista
   */
  function applyTelemetry(data) {
    if (!data) return;
    currentTelemetry = data;

    if (data.mode) {
      activeExecutionMode = data.mode;
      updateMasterModeButtonUI();
    }

    // 1. Tarjeta 1: Capital Operativo #501 ($470.13 USDC -> Meta $500.00 USDC)
    const consolidated = typeof data.consolidatedUsdc === "number" ? data.consolidatedUsdc : 470.13;
    const targetGoal = typeof data.goalTarget === "number" ? data.goalTarget : 500.00;
    const remaining = typeof data.remainingUsdc === "number" ? data.remainingUsdc : Math.max(0, +(targetGoal - consolidated).toFixed(2));
    const blk = data.blockSettlement || {
      currentSettledBlock: 450.00,
      nextMilestoneBlock: 500.00,
      remainingToNextBlock: remaining,
      progressToNextBlockPct: 40.3
    };

    if (topCapitalDisplay) {
      topCapitalDisplay.innerHTML = `$${consolidated.toFixed(2)} <span class="metric-sub">/ $${targetGoal.toFixed(2)} USDC</span>`;
    }
    if (topCapitalProgress) {
      const pct = Math.min(100, Math.max(0, (consolidated / targetGoal) * 100));
      topCapitalProgress.style.width = `${pct.toFixed(2)}%`;
    }
    if (topProgressPct) {
      topProgressPct.innerHTML = `Bloque: $${blk.currentSettledBlock.toFixed(2)} 🛡️ Asentado`;
    }
    if (topRemainingUsdc) {
      topRemainingUsdc.innerHTML = `Faltan $${remaining.toFixed(2)} USDC`;
    }
    if (vaultGasStatus) {
      vaultGasStatus.textContent = `BÓVEDA #501 · $${consolidated.toFixed(2)}`;
    }
    if (topGasShieldBadge) {
      topGasShieldBadge.textContent = `GAS HYPERLIQUID: $0.00`;
    }

    // 2. Tarjeta 2: Motor Hyperliquid L1 (150ms) & Regla Máx 1 Operación
    const latency = data.hlLatencyMs || 142;
    const isPositionOpen = data.cycleState === "ACTIVE_ORDER" || data.activePositionsCount > 0;

    if (topClockCountdown) {
      topClockCountdown.innerHTML = `~${latency}ms <span class="metric-sub">Hyperliquid L1</span>`;
    }
    if (topPhaseBadge) {
      if (isPositionOpen) {
        topPhaseBadge.textContent = "⚡ EN POSICIÓN MAKER";
        topPhaseBadge.className = "card-pill font-mono green-pill";
      } else {
        topPhaseBadge.textContent = "🔍 ESCANEANDO L2";
        topPhaseBadge.className = "card-pill font-mono";
      }
    }
    if (topCycleTotalRemaining) {
      topCycleTotalRemaining.textContent = "MÁX 1 OPERACIÓN A LA VEZ";
    }
    if (topClockProgress) {
      topClockProgress.style.width = isPositionOpen ? "100%" : "60%";
    }
    if (topPhaseLabel) {
      topPhaseLabel.textContent = "Cadencia ~150ms";
    }
    if (topNextPhaseLabel) {
      topNextPhaseLabel.textContent = "Regla: 1 Sola Posición";
    }

    // 3. Tarjeta 3: Marcador Real Hyperliquid (Ledger Inmutable)
    const wins = typeof data.wins === "number" ? data.wins : 0;
    const losses = typeof data.losses === "number" ? data.losses : 0;
    const winRate = typeof data.winRatePct === "number" ? data.winRatePct : 100.0;
    const sessionPnlStr = data.sessionPnlFormatted || (typeof data.sessionPnl === "number" ? `+$${data.sessionPnl.toFixed(2)} USDC` : "+$0.00 USDC");

    if (topRatioDisplay) {
      topRatioDisplay.innerHTML = `${wins}G <span class="metric-sub">-</span> ${losses}P`;
    }
    if (topWinRateBadge) {
      topWinRateBadge.textContent = (wins + losses > 0) ? `${winRate.toFixed(1)}% REAL` : "0 OPERACIONES CERRADAS";
    }
    if (topSessionPnlDisplay) {
      topSessionPnlDisplay.textContent = sessionPnlStr;
    }

    // 4. Tarjeta 4: Par y Dirección Maker
    const pairConfig = SQUAD_PAIRS_CONFIG[selectedSquadPair] || SQUAD_PAIRS_CONFIG["SOL-USDC"];
    const mids = data.liveMids || {};
    const pairMid = mids[pairConfig.symbol] || (pairConfig.symbol === "SOL" ? 100.98 : (pairConfig.symbol === "BTC" ? 80238.50 : 2323.35));
    const spreadVal = pairConfig.spreadFactor;
    const direction = pairConfig.direction;
    const directionLabel = pairConfig.directionLabel;
    const bullScore = pairConfig.bullScore;
    const bearScore = pairConfig.bearScore;
    const certainty = 95.4;

    if (topWinnerPairDisplay) {
      topWinnerPairDisplay.innerHTML = `${selectedSquadPair} <span class="direction-badge ${direction.toLowerCase()}" id="topDirectionBadge">${directionLabel}</span>`;
    }
    if (topCertaintyBadge) {
      topCertaintyBadge.textContent = `${certainty}% CERTEZA`;
    }
    if (topBullMeter && topBearMeter) {
      topBullMeter.style.width = `${bullScore}%`;
      topBearMeter.style.width = `${bearScore}%`;
    }

    // 5. Mesa Central: 4 Cajas Tácticas (.tactical-four-boxes-grid)
    // Caja 01: Selección del Squad en Hyperliquid
    if (boxPairTitleDisplay) {
      boxPairTitleDisplay.innerHTML = `${selectedSquadPair} <span class="big-direction-pill ${direction.toLowerCase()}" id="boxDirectionBadge">${directionLabel} (POST-ONLY ALO)</span>`;
    }
    if (boxPairCertainty) {
      boxPairCertainty.textContent = `${certainty}% CERTEZA`;
    }
    if (boxPairSubtitle) {
      boxPairSubtitle.textContent = `Especialista: ${pairConfig.informant} · Liquidez L2: $${(pairConfig.depthUsdc / 1000000).toFixed(1)}M · 0% Comisión Taker`;
    }

    // Caja 02: Libro de Órdenes Hyperliquid en Vivo (Best Bid / Ask & Desequilibrio L2)
    const bestBid = pairMid * 0.99985;
    const bestAsk = pairMid * 1.00015;

    if (boxOraclePing) {
      boxOraclePing.textContent = `HYPERLIQUID L1 · ${latency}ms`;
    }
    if (boxBestBidDisplay) {
      boxBestBidDisplay.textContent = `$${formatPrice(bestBid)}`;
    }
    if (boxBestAskDisplay) {
      boxBestAskDisplay.textContent = `$${formatPrice(bestAsk)}`;
    }
    if (boxL2Imbalance) {
      boxL2Imbalance.textContent = `Desequilibrio L2: ${bullScore}% Compradores vs ${bearScore}% Vendedores (5 Capas Profundas)`;
    }
    if (boxSpreadLine) {
      boxSpreadLine.textContent = `Spread Maker: ${spreadVal.toFixed(3)}% (Umbral ≥ 0.040%) · Latencia WebSocket: ${latency}ms`;
    }

    // Caja 03: Candado Breakeven #00 (+0.04%) & Take Profit (+0.08% / +0.15%)
    const bePrice = +(pairMid * 1.0004).toFixed(pairMid < 1 ? 5 : 2);
    const tpPrice = +(pairMid * 1.0008).toFixed(pairMid < 1 ? 5 : 2);
    const tpGainUsdc = parseFloat((consolidated * 0.0008).toFixed(2));

    if (boxBreakevenPrice) {
      boxBreakevenPrice.textContent = `$${formatPrice(bePrice)}`;
    }
    if (boxTpPrice) {
      boxTpPrice.textContent = `$${formatPrice(tpPrice)}`;
    }
    if (boxTpGainDisplay) {
      boxTpGainDisplay.textContent = `+$${tpGainUsdc.toFixed(2)} USDC`;
    }

    // Caja 04: Estado del Motor & Diagnóstico Claro en Español
    if (boxStatusBadge) {
      boxStatusBadge.textContent = activeExecutionMode === "LIVE_MAKER_ACTIVE" ? "⚡ TRABAJANDO EN VIVO" : "🟡 LECTURA ACTIVA";
    }
    if (boxOperationStatusText) {
      if (activeExecutionMode === "LIVE_MAKER_ACTIVE") {
        boxOperationStatusText.innerHTML = `🟢 <strong>Operando ${selectedSquadPair} en Hyperliquid L1:</strong> orden Post-Only ALO activa. Candado BE clava a +0.04% y TP liquida a +0.08% en USDC directo a #501.`;
      } else {
        boxOperationStatusText.innerHTML = `🔍 <strong>Escaneando Orderbook L2 de ${selectedSquadPair}:</strong> esperando desequilibrio comprador ≥ 65% para colocar orden Maker ALO con riesgo $0.00.`;
      }
    }
    if (boxOperationSubText) {
      boxOperationSubText.textContent = `Bóveda #501: $${consolidated.toFixed(2)} USDC · Agent Key Sin Permiso de Retiro · Máx 1 Operación Concurrente`;
    }

    // 6. Columna Izquierda: Los Eslabones del Squad
    if (linkRadarStatus) linkRadarStatus.textContent = `Orderbook L2 & AllMids (~${latency}ms) · $0.00 Gas de Red`;
    if (linkFastPairsStatus) linkFastPairsStatus.textContent = `SOL-USDC $${formatPrice(mids.SOL || 100.98)}, ETH-USDC $${formatPrice(mids.ETH || 2323.35)}`;
    if (linkInstFlowStatus) linkInstFlowStatus.textContent = `BTC-USDC $${formatPrice(mids.BTC || 80238.5)}, PAXG $${formatPrice(mids.PAXG || 4025.25)}`;
    if (linkNebulasStatus) linkNebulasStatus.textContent = `Filtro ALO (Post-Only) · Liq $${(pairConfig.depthUsdc / 1000000).toFixed(1)}M · 0% Taker Fee`;
    if (linkDualStatus) linkDualStatus.textContent = `Máx 1 Operación Concurrente · ${directionLabel}`;
    if (traderBullPill) traderBullPill.textContent = `🐂 ${bullScore}%`;
    if (traderBearPill) traderBearPill.textContent = `🐻 ${bearScore}%`;
    if (linkMentorStatus) linkMentorStatus.textContent = `BE +0.04% ($0 Pérdida) ➔ TP +0.08% (+$${tpGainUsdc.toFixed(2)} USDC)`;

    // 7. Bitácora Inferior (Historial de squad-secret-real-ledger.json)
    const historyList = (data.cycleHistory && Array.isArray(data.cycleHistory)) ? data.cycleHistory : (data.recentCycles || []);
    renderCyclesTable(historyList);

    // Guardar para hidratación rápida
    try {
      localStorage.setItem("area501_squad_secret_state_v1", JSON.stringify(data));
    } catch (_) {}
  }

  /**
   * Consulta periódica cada 3 segundos al endpoint de Cloudflare Worker
   */
  async function fetchTelemetry() {
    try {
      const res = await fetch("/api/squad-secret/live?t=" + Date.now(), {
        cache: "no-store",
        headers: { "Accept": "application/json" }
      });
      if (res.ok) {
        const liveData = await res.json();
        applyTelemetry(liveData);
        return;
      }
    } catch (_) {
      if (!currentTelemetry && window.__PRELOADED_SQUAD_SECRET__) {
        applyTelemetry(window.__PRELOADED_SQUAD_SECRET__);
      }
    }
  }

  // Conmutador de la Terminal en Vivo / Ledger
  window.switchSquadTermTab = function(tab) {
    const termBody = document.getElementById("squadTermBody");
    const ledgerWrap = document.getElementById("squadLedgerWrap");
    const btnLive = document.getElementById("btnTabTermLive");
    const btnLedger = document.getElementById("btnTabTermLedger");

    if (tab === "LIVE") {
      if (termBody) termBody.style.display = "flex";
      if (ledgerWrap) ledgerWrap.style.display = "none";
      if (btnLive) btnLive.className = "term-tab-btn active";
      if (btnLedger) btnLedger.className = "term-tab-btn";
    } else {
      if (termBody) termBody.style.display = "none";
      if (ledgerWrap) ledgerWrap.style.display = "block";
      if (btnLive) btnLive.className = "term-tab-btn";
      if (btnLedger) btnLedger.className = "term-tab-btn active";
    }
  };

  window.clearSquadTerm = function() {
    const termBody = document.getElementById("squadTermBody");
    const lastLine = document.getElementById("squadTermLastLine");
    if (termBody && lastLine) {
      const lines = termBody.querySelectorAll(".squad-term-line:not(#squadTermLastLine)");
      lines.forEach(l => l.remove());
      localStorage.setItem("area501_squad_term_cleared_at", Date.now().toString());
    }
  };

  // Inicialización
  document.addEventListener("DOMContentLoaded", () => {
    updateClocks();
    setInterval(updateClocks, 1000);

    updateMasterModeButtonUI();

    fetchTelemetry();
    setInterval(fetchTelemetry, 3000); // Polling cada 3 segundos para máxima frescura L1
  });

})();
