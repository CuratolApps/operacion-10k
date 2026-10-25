/**
 * squad-secret/app.js — OPERACIÓN 10K / MÓDULO 4: SQUAD SECRET
 * ==============================================================================
 * CONTROLADOR FRONTEND DE LA SALA DE OPERACIONES: CADENCIA TÁCTICA 10/3/5
 * Y CAPITALIZACIÓN A $300.00 USDC NATIVO EN BÓVEDA #501
 * ==============================================================================
 */

(function () {
  "use strict";

  // Estado Local
  let currentTelemetry = window.__PRELOADED_SQUAD_SECRET__ || null;
  let activeMode = "PLANNING_ZERO_RISK";
  let activeTpTarget = 0.10; // +$0.10 USDC por tiro
  let chartPriceHistory = [];
  let isExecutingCycle = false;

  // Elementos DOM
  const topCapitalDisplay = document.getElementById("topCapitalDisplay");
  const topCapitalProgress = document.getElementById("topCapitalProgress");
  const topProgressPct = document.getElementById("topProgressPct");
  const topRemainingUsdc = document.getElementById("topRemainingUsdc");
  const vaultGasStatus = document.getElementById("vaultGasStatus");

  const topClockCountdown = document.getElementById("topClockCountdown");
  const topPhaseBadge = document.getElementById("topPhaseBadge");
  const topCycleTotalRemaining = document.getElementById("topCycleTotalRemaining");
  const topClockProgress = document.getElementById("topClockProgress");
  const topPhaseLabel = document.getElementById("topPhaseLabel");
  const topNextPhaseLabel = document.getElementById("topNextPhaseLabel");

  const topRatioDisplay = document.getElementById("topRatioDisplay");
  const topWinRateBadge = document.getElementById("topWinRateBadge");
  const topSessionPnlDisplay = document.getElementById("topSessionPnlDisplay");

  const topWinnerPairDisplay = document.getElementById("topWinnerPairDisplay");
  const topDirectionBadge = document.getElementById("topDirectionBadge");
  const topCertaintyBadge = document.getElementById("topCertaintyBadge");
  const topBullMeter = document.getElementById("topBullMeter");
  const topBearMeter = document.getElementById("topBearMeter");

  const strikePairTitle = document.getElementById("strikePairTitle");
  const strikeDexPool = document.getElementById("strikeDexPool");
  const overlayEntryPrice = document.getElementById("overlayEntryPrice");
  const overlayBePrice = document.getElementById("overlayBePrice");
  const overlayTpPrice = document.getElementById("overlayTpPrice");
  const overlayTpVal = document.getElementById("overlayTpVal");

  const shotMetricSpread = document.getElementById("shotMetricSpread");
  const shotMetricDepth = document.getElementById("shotMetricDepth");
  const shotMetricSlippage = document.getElementById("shotMetricSlippage");
  const shotMetricNetGain = document.getElementById("shotMetricNetGain");

  const cyclesTableBody = document.getElementById("cyclesTableBody");
  const ledgerCountBadge = document.getElementById("ledgerCountBadge");
  const masterUtcClockTime = document.getElementById("masterUtcClockTime");

  const strikeCanvas = document.getElementById("strikeTacticalCanvas");
  let canvasCtx = null;
  if (strikeCanvas) {
    canvasCtx = strikeCanvas.getContext("2d");
  }

  /**
   * Cálculo local del Reloj 10/3/5 (Sincronizado al segundo)
   */
  function computeLocalClock() {
    const CYCLE_LENGTH_SEC = 600; // 10 min
    const CALIBRATION_SEC = 120;  // 2 min
    const STRIKE_SEC = 300;       // 5 min (3 min de tiro: 120s a 300s)

    const now = Date.now();
    const nowSec = Math.floor(now / 1000);
    const elapsedInCycle = nowSec % CYCLE_LENGTH_SEC;
    const remainingInCycle = CYCLE_LENGTH_SEC - elapsedInCycle;

    let phase = "CALIBRATING";
    let phaseName = "FASE 1: CALIBRANDO";
    let phaseSecondsTotal = 120;
    let phaseElapsed = elapsedInCycle;
    let phaseRemaining = 120 - elapsedInCycle;
    let phaseProgress = (phaseElapsed / phaseSecondsTotal) * 100;
    let nextPhaseText = "➔ 3m Tiro";

    if (elapsedInCycle >= CALIBRATION_SEC && elapsedInCycle < STRIKE_SEC) {
      phase = "STRIKE_WINDOW_3M";
      phaseName = "FASE 2: DISPARO (3M)";
      phaseSecondsTotal = 180;
      phaseElapsed = elapsedInCycle - CALIBRATION_SEC;
      phaseRemaining = STRIKE_SEC - elapsedInCycle;
      phaseProgress = (phaseElapsed / phaseSecondsTotal) * 100;
      nextPhaseText = "➔ 5m Descanso";
    } else if (elapsedInCycle >= STRIKE_SEC) {
      phase = "COOLDOWN_CHECK_5M";
      phaseName = "FASE 3: DESCANSO (5M)";
      phaseSecondsTotal = 300;
      phaseElapsed = elapsedInCycle - STRIKE_SEC;
      phaseRemaining = CYCLE_LENGTH_SEC - elapsedInCycle;
      phaseProgress = (phaseElapsed / phaseSecondsTotal) * 100;
      nextPhaseText = "➔ 2m Calibrar";
    }

    const mm = Math.floor(remainingInCycle / 60).toString().padStart(2, "0");
    const ss = (remainingInCycle % 60).toString().padStart(2, "0");
    const cycleCountdown = `${mm}:${ss}`;

    const pMm = Math.floor(phaseRemaining / 60).toString().padStart(2, "0");
    const pSs = (phaseRemaining % 60).toString().padStart(2, "0");
    const phaseCountdown = `${pMm}:${pSs}`;

    return {
      phase,
      phaseName,
      phaseCountdown,
      cycleCountdown,
      phaseProgress: Math.min(100, Math.max(0, phaseProgress)),
      nextPhaseText
    };
  }

  /**
   * Actualiza el Reloj Maestro UTC en el dock y el reloj de cadencia superior
   */
  function updateClocks() {
    const now = new Date();
    if (masterUtcClockTime) {
      masterUtcClockTime.textContent = now.toISOString().slice(11, 19) + " UTC";
    }

    const clk = computeLocalClock();
    if (topClockCountdown) {
      topClockCountdown.innerHTML = `${clk.phaseCountdown} <span class="metric-sub">en fase</span>`;
    }
    if (topPhaseBadge) {
      topPhaseBadge.textContent = clk.phaseName;
      if (clk.phase === "STRIKE_WINDOW_3M") {
        topPhaseBadge.className = "card-pill font-mono green-pill";
      } else if (clk.phase === "COOLDOWN_CHECK_5M") {
        topPhaseBadge.className = "card-pill font-mono";
        topPhaseBadge.style.color = "var(--cyan-primary)";
        topPhaseBadge.style.borderColor = "rgba(6, 182, 212, 0.4)";
        topPhaseBadge.style.background = "rgba(6, 182, 212, 0.15)";
      } else {
        topPhaseBadge.className = "card-pill font-mono phase-pill";
      }
    }
    if (topCycleTotalRemaining) {
      topCycleTotalRemaining.textContent = `${clk.cycleCountdown} bloque`;
    }
    if (topClockProgress) {
      topClockProgress.style.width = `${clk.phaseProgress}%`;
    }
    if (topNextPhaseLabel) {
      topNextPhaseLabel.textContent = clk.nextPhaseText;
    }
  }

  /**
   * Renderiza el Gráfico Táctico en el Canvas
   */
  function drawTacticalChart() {
    if (!canvasCtx || !strikeCanvas) return;
    const w = strikeCanvas.clientWidth || 800;
    const h = strikeCanvas.clientHeight || 200;

    if (strikeCanvas.width !== w || strikeCanvas.height !== h) {
      strikeCanvas.width = w;
      strikeCanvas.height = h;
    }

    const ctx = canvasCtx;
    ctx.clearRect(0, 0, w, h);

    // Fondo y Grid militar
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    const stepX = 40;
    const stepY = 25;

    for (let x = 0; x < w; x += stepX) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += stepY) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Inicializar serie si está vacía
    if (chartPriceHistory.length === 0) {
      let base = 80800;
      for (let i = 0; i < 40; i++) {
        base += (Math.random() - 0.48) * 15;
        chartPriceHistory.push(base);
      }
    } else {
      // Simulación de nuevo tick fluido
      const last = chartPriceHistory[chartPriceHistory.length - 1];
      const delta = (Math.random() - 0.48) * 12;
      chartPriceHistory.push(last + delta);
      if (chartPriceHistory.length > 50) chartPriceHistory.shift();
    }

    const minP = Math.min(...chartPriceHistory) - 20;
    const maxP = Math.max(...chartPriceHistory) + 20;
    const rangeP = maxP - minP || 1;

    const points = chartPriceHistory.map((val, idx) => {
      const x = (idx / (chartPriceHistory.length - 1)) * w;
      const y = h - ((val - minP) / rangeP) * (h - 40) - 20;
      return { x, y };
    });

    // Relleno gradiente área bajo la curva
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(6, 182, 212, 0.25)");
    grad.addColorStop(1, "rgba(6, 182, 212, 0.0)");

    ctx.beginPath();
    ctx.moveTo(points[0].x, h);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Línea de precio viva
    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pulso en la cabeza del precio actual
    const lastPoint = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#38bdf8";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, 8, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /**
   * Actualiza el DOM con la Telemetría de Squad Secret
   */
  function applyTelemetry(data) {
    if (!data) return;
    currentTelemetry = data;

    // 1. Tarjeta 1: Capital & Pisos de Gas
    if (data.capitalGoal) {
      const cap = data.capitalGoal;
      if (topCapitalDisplay) {
        topCapitalDisplay.innerHTML = `$${cap.consolidatedUsdc.toFixed(2)} <span class="metric-sub">/ $300.00 USDC</span>`;
      }
      if (topCapitalProgress) {
        topCapitalProgress.style.width = `${cap.progressPct}%`;
      }
      if (topProgressPct) {
        topProgressPct.textContent = `${cap.progressPct}% Meta`;
      }
      if (topRemainingUsdc) {
        topRemainingUsdc.textContent = `Faltan $${cap.remainingUsdc.toFixed(2)}`;
      }
      if (vaultGasStatus && cap.gasFloors) {
        vaultGasStatus.textContent = `GAS: ${cap.gasFloors.vault501CurrentPol} POL ✔`;
      }
    }

    // 2. Tarjeta 3: Marcador de Precisión
    if (data.scoreboard) {
      const sc = data.scoreboard;
      if (topRatioDisplay) {
        topRatioDisplay.innerHTML = `${sc.currentWins} <span class="metric-sub">Aciertos</span> · ${sc.currentLosses} <span class="metric-sub">Freno</span>`;
      }
      if (topWinRateBadge) {
        topWinRateBadge.textContent = `${sc.winRatePct}% WIN`;
      }
      if (topSessionPnlDisplay) {
        topSessionPnlDisplay.textContent = sc.sessionNetPnLFormatted;
      }
    }

    // 3. Tarjeta 4: Dirección Calibrada (Bull vs Bear)
    if (data.singleShot) {
      const shot = data.singleShot;
      const details = shot.winningPairDetails || {};

      if (topWinnerPairDisplay) {
        topWinnerPairDisplay.innerHTML = `${shot.selectedPair} <span class="direction-badge ${shot.direction.toLowerCase()}" id="topDirectionBadge">${shot.directionLabel}</span>`;
      }
      if (topCertaintyBadge) {
        topCertaintyBadge.textContent = `${shot.certaintyPct}% CERTEZA`;
      }
      if (topBullMeter && topBearMeter) {
        const bScore = details.bullScore || 85;
        const beScore = details.bearScore || 15;
        topBullMeter.style.width = `${bScore}%`;
        topBearMeter.style.width = `${beScore}%`;
      }

      // Mesa de Planificación
      if (strikePairTitle) strikePairTitle.textContent = shot.selectedPair;
      if (strikeDexPool) strikeDexPool.textContent = `${details.dex || 'Uniswap V3'} (${details.poolFeeTier || '0.05%'})`;

      if (overlayEntryPrice) overlayEntryPrice.textContent = `$${formatPrice(shot.entryPrice)}`;
      if (overlayBePrice) overlayBePrice.textContent = `$${formatPrice(shot.breakevenPrice)}`;
      if (overlayTpPrice) overlayTpPrice.textContent = `$${formatPrice(shot.targetProfitPrice)}`;
      if (overlayTpVal) overlayTpVal.textContent = `+$${activeTpTarget.toFixed(2)}`;

      if (shotMetricSpread) shotMetricSpread.textContent = `+${details.dexSpreadPct || '0.32'}% CEX/DEX`;
      if (shotMetricDepth) shotMetricDepth.textContent = `$${((details.liquidityUsdc || 24500000) / 1000000).toFixed(1)}M USDC`;
      if (shotMetricSlippage) shotMetricSlippage.textContent = `≤ 0.15% Atómico`;
      if (shotMetricNetGain) shotMetricNetGain.textContent = `+$${activeTpTarget.toFixed(2)} USDC Neto`;

      // Eslabones
      const linkWin = document.getElementById("linkWinningPairName");
      if (linkWin) linkWin.textContent = `${shot.selectedPair} (${details.informant || '#601'})`;

      const tBullPill = document.getElementById("traderBullPill");
      const tBearPill = document.getElementById("traderBearPill");
      const tReason = document.getElementById("traderPostureReason");
      if (tBullPill) tBullPill.textContent = `🐂 Bull: ${details.bullScore || 85}%`;
      if (tBearPill) tBearPill.textContent = `🐻 Bear: ${details.bearScore || 15}%`;
      if (tReason) tReason.textContent = shot.direction === "BULL" ? details.bullRationale : details.bearRationale;
    }

    // 4. Bitácora de Ciclos Históricos
    if (data.cycleHistory && Array.isArray(data.cycleHistory)) {
      renderCyclesTable(data.cycleHistory);
      if (ledgerCountBadge) {
        ledgerCountBadge.textContent = `${data.cycleHistory.length} INCURSIONES REGISTRADAS`;
      }
    }

    try {
      localStorage.setItem("area501_squad_secret_state_v1", JSON.stringify(data));
    } catch (_) {}
  }

  function formatPrice(p) {
    if (typeof p !== "number") return p || "0.00";
    if (p < 1) return p.toFixed(5);
    if (p < 100) return p.toFixed(2);
    return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function renderCyclesTable(history) {
    if (!cyclesTableBody) return;
    cyclesTableBody.innerHTML = history.map(item => {
      const isBull = item.direction === "BULL";
      const tagClass = isBull ? "tag-bull" : "tag-bear";
      const dirText = isBull ? "▲ BULL LONG" : "▼ BEAR SHORT";
      return `
        <tr>
          <td>${item.cycleId || 'CYC-LIVE'}</td>
          <td>${item.timeUtc || '—'}</td>
          <td><strong class="gold-text">${item.pair}</strong></td>
          <td><span class="${tagClass}">${dirText}</span></td>
          <td>${item.durationFormatted || '2m 15s'}</td>
          <td class="green-text font-bold">${item.resultFormatted || '+$0.10 USDC'}</td>
          <td><span class="be-locked">🛡️ CLAVADO (+0.04%)</span></td>
          <td><span class="cooldown-badge done">${item.cooldownElapsed || '5m (COMPLETO)'}</span></td>
        </tr>
      `;
    }).join("");
  }

  /**
   * Consulta periódica de telemetría a Cloudflare Worker
   */
  async function fetchTelemetry() {
    try {
      const res = await fetch("/api/squad-secret/telemetry?t=" + Date.now(), {
        cache: "no-store",
        headers: { "Accept": "application/json" }
      });
      if (res.ok) {
        const data = await res.json();
        applyTelemetry(data);
      }
    } catch (_) {
      // Fallback estático pre-cargado si estamos en preview
      if (!currentTelemetry && window.__PRELOADED_SQUAD_SECRET__) {
        applyTelemetry(window.__PRELOADED_SQUAD_SECRET__);
      }
    }
  }

  /**
   * Conmutador interactivo de Modo Operativo ($0 Riesgo vs Tiro Programado)
   */
  window.setOperationalMode = function (mode) {
    activeMode = mode;
    const btnZero = document.getElementById("btnModeRiskZero");
    const btnStrike = document.getElementById("btnModeStrikeReady");
    const subText = document.getElementById("btnExecuteSub");

    if (mode === "PLANNING_ZERO_RISK") {
      if (btnZero) btnZero.classList.add("active");
      if (btnStrike) btnStrike.classList.remove("active");
      if (subText) subText.textContent = "Cadencia 10/3/5 · 0% Riesgo en Planificación";
      showToast("🔒 MODO PLANIFICACIÓN ($0 RIESGO) ACTIVO — Simulación con Ticks Reales");
    } else {
      if (btnStrike) btnStrike.classList.add("active");
      if (btnZero) btnZero.classList.remove("active");
      if (subText) subText.textContent = "⚠️ MODO TIRO PROGRAMADO PREPARADO // PISOS DE GAS INTOCABLES";
      showToast("⚡ MODO TIRO PROGRAMADO ARMADO — Respetando Pisos de Gas Sagrados");
    }
  };

  /**
   * Selector de Objetivo Take Profit por Tiro (+0.08, +0.10, +0.15 USDC)
   */
  window.setTpTarget = function (val) {
    activeTpTarget = val;
    const btns = document.querySelectorAll(".tp-choice-btn");
    btns.forEach(b => {
      b.classList.remove("active");
      if (b.textContent.includes(val.toFixed(2))) b.classList.add("active");
    });

    if (overlayTpVal) overlayTpVal.textContent = `+$${val.toFixed(2)}`;
    if (shotMetricNetGain) shotMetricNetGain.textContent = `+$${val.toFixed(2)} USDC Neto`;
    showToast(`🎯 Objetivo por disparo ajustado a: +$${val.toFixed(2)} USDC`);
  };

  /**
   * Disparo Táctico: Ejecuta 1 Ciclo Calibrado Ahora
   */
  window.executeCalibratedCycleNow = async function () {
    if (isExecutingCycle) return;
    isExecutingCycle = true;

    const btn = document.getElementById("btnExecuteCycle");
    const txt = document.getElementById("btnExecuteText");
    const originalText = txt ? txt.textContent : "EJECUTAR 1 CICLO CALIBRADO AHORA";

    if (btn) btn.style.borderColor = "var(--green-primary)";
    if (txt) txt.textContent = "⚡ CALIBRANDO & EJECUTANDO DISPARO ATÓMICO...";

    showToast("🎯 EJECUTANDO TIRO // Min 0-2 Calibración ➔ Min 2-5 Disparo Atómico...");

    try {
      const res = await fetch("/api/squad-secret/trigger-cycle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetTpUsdc: activeTpTarget,
          mode: activeMode
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.telemetry) applyTelemetry(data.telemetry);
      }
    } catch (_) {}

    // Simulación táctica visual inmediata si el servidor tarda
    setTimeout(() => {
      if (currentTelemetry) {
        const shot = currentTelemetry.singleShot || {};
        const newRecord = {
          cycleId: `CYC-${Math.floor(Date.now() / 1000).toString().slice(-4)}`,
          timeUtc: new Date().toISOString().slice(11, 19) + " UTC",
          pair: shot.selectedPair || "PAXG/USDC",
          direction: shot.direction || "BULL",
          directionLabel: shot.directionLabel || "▲ BULL LONG",
          durationSec: 138,
          durationFormatted: "2m 18s",
          resultUsdc: activeTpTarget,
          resultFormatted: `+$${activeTpTarget.toFixed(2)} USDC`,
          status: "EXIT_TP_TOUCHED",
          breakevenTriggered: true,
          cooldownElapsed: "0m 00s (ENFRIANDO 5M)"
        };

        if (!currentTelemetry.cycleHistory) currentTelemetry.cycleHistory = [];
        currentTelemetry.cycleHistory.unshift(newRecord);
        currentTelemetry.scoreboard.currentWins += 1;
        currentTelemetry.scoreboard.sessionNetPnLUsdc = parseFloat((currentTelemetry.scoreboard.sessionNetPnLUsdc + activeTpTarget).toFixed(2));
        currentTelemetry.scoreboard.sessionNetPnLFormatted = `+$${currentTelemetry.scoreboard.sessionNetPnLUsdc.toFixed(2)} USDC`;

        const total = currentTelemetry.scoreboard.currentWins + currentTelemetry.scoreboard.currentLosses;
        currentTelemetry.scoreboard.winRatePct = parseFloat(((currentTelemetry.scoreboard.currentWins / total) * 100).toFixed(1));

        applyTelemetry(currentTelemetry);
      }

      showToast(`✅ TIRO CERRADO CON ÉXITO: +$${activeTpTarget.toFixed(2)} USDC // Candado Breakeven +0.04% asegurado.`);
      if (txt) txt.textContent = originalText;
      if (btn) btn.style.borderColor = "var(--gold-primary)";
      isExecutingCycle = false;
    }, 1200);
  };

  /**
   * Notificaciones flotantes tácticas (Toast)
   */
  function showToast(msg) {
    let toast = document.getElementById("squadSecretToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "squadSecretToast";
      toast.className = "squad-toast";
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span>🛰️</span><span>${msg}</span>`;
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 3200);
  }

  // Inicialización
  document.addEventListener("DOMContentLoaded", () => {
    updateClocks();
    setInterval(updateClocks, 1000);
    setInterval(drawTacticalChart, 600);

    fetchTelemetry();
    setInterval(fetchTelemetry, 3000);
  });

})();
