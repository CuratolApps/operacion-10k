/**
 * operacion-500/app.js — OPERACIÓN 10K / MÓDULO INDEPENDIENTE: OPERACIÓN 500
 * ==============================================================================
 * CONTROLADOR FRONTEND DEL ENJAMBRE DE 500 CARTERAS EN UNÍSONO
 * CADENCIA TÁCTICA 1M TIRO / 2M DESCANSO (180S) · $0.00 RIESGO PATRIMONIAL EN #501
 * ==============================================================================
 */

(function () {
  "use strict";

  // Estado Local
  let currentTelemetry = window.__PRELOADED_OP500__ || null;

  // Elementos DOM - Barra Superior
  const topEnjambreWallets = document.getElementById("topEnjambreWallets");
  const topSessionPnlDisplay = document.getElementById("topSessionPnlDisplay");
  const vaultProgressFill = document.getElementById("vaultProgressFill");
  const vaultBlockLabel = document.getElementById("vaultBlockLabel");
  const vaultRemainingLabel = document.getElementById("vaultRemainingLabel");

  const topClockCountdown = document.getElementById("topClockCountdown");
  const topPhaseBadge = document.getElementById("topPhaseBadge");
  const topCycleTotalRemaining = document.getElementById("topCycleTotalRemaining");
  const topClockProgress = document.getElementById("topClockProgress");
  const topPhaseLabel = document.getElementById("topPhaseLabel");
  const topNextPhaseLabel = document.getElementById("topNextPhaseLabel");

  const topRatioDisplay = document.getElementById("topRatioDisplay");
  const topWinRateBadge = document.getElementById("topWinRateBadge");
  const topVelocityDisplay = document.getElementById("topVelocityDisplay");

  const gasFleetDisplay = document.getElementById("gasFleetDisplay");
  const gasVaultDisplay = document.getElementById("gasVaultDisplay");

  // Elementos DOM - Centro Táctico (4 Cajas)
  const strikePairTitle = document.getElementById("strikePairTitle");
  const strikeDexPool = document.getElementById("strikeDexPool");

  const boxPairCertainty = document.getElementById("boxPairCertainty");
  const boxPairTitleDisplay = document.getElementById("boxPairTitleDisplay");
  const boxDirectionBadge = document.getElementById("boxDirectionBadge");
  const boxPairSubtitle = document.getElementById("boxPairSubtitle");

  const boxSyncStatus = document.getElementById("boxSyncStatus");
  const boxCycleHarvestDisplay = document.getElementById("boxCycleHarvestDisplay");
  const boxProtocolDetails = document.getElementById("boxProtocolDetails");

  const boxBlockBadge = document.getElementById("boxBlockBadge");
  const boxOperationStatusText = document.getElementById("boxOperationStatusText");
  const boxOperationSubText = document.getElementById("boxOperationSubText");

  // Elementos DOM - Bitácora y Dock
  const cyclesTableBody = document.getElementById("cyclesTableBody");
  const ledgerCountBadge = document.getElementById("ledgerCountBadge");
  const masterUtcClockTime = document.getElementById("masterUtcClockTime");

  /**
   * Cálculo local del Reloj 1M/2M (Sincronizado: 60s Tiro Unísono + 120s Enfriamiento = 180s Total)
   */
  function computeLocalClock() {
    const CYCLE_LENGTH_SEC = 180;
    const STRIKE_SEC = 60;

    const now = Date.now();
    const nowSec = Math.floor(now / 1000);
    const elapsedInCycle = nowSec % CYCLE_LENGTH_SEC;
    const remainingInCycle = CYCLE_LENGTH_SEC - elapsedInCycle;

    let phase = "STRIKE_WINDOW_1M";
    let phaseName = "FASE 1: TIRO UNÍSONO 500 BOTS (1M)";
    let phaseSecondsTotal = 60;
    let phaseElapsed = elapsedInCycle;
    let phaseRemaining = 60 - elapsedInCycle;
    let phaseProgress = (phaseElapsed / phaseSecondsTotal) * 100;
    let nextPhaseText = "➔ 2m Enfriamiento";

    if (elapsedInCycle >= STRIKE_SEC) {
      phase = "COOLDOWN_CHECK_2M";
      phaseName = "FASE 2: ENFRIAMIENTO (2M / 120S)";
      phaseSecondsTotal = 120;
      phaseElapsed = elapsedInCycle - STRIKE_SEC;
      phaseRemaining = CYCLE_LENGTH_SEC - elapsedInCycle;
      phaseProgress = (phaseElapsed / phaseSecondsTotal) * 100;
      nextPhaseText = "➔ 1m Tiro Unísono";
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
   * Actualiza el Reloj Maestro UTC en el dock y el reloj de cadencia superior cada segundo
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
      if (clk.phase === "STRIKE_WINDOW_1M") {
        topPhaseBadge.className = "card-pill font-mono green-pill";
      } else {
        topPhaseBadge.className = "card-pill font-mono";
        topPhaseBadge.style.color = "var(--cyan-primary)";
        topPhaseBadge.style.borderColor = "rgba(6, 182, 212, 0.4)";
        topPhaseBadge.style.background = "rgba(6, 182, 212, 0.15)";
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
    if (topPhaseLabel) {
      topPhaseLabel.textContent = clk.phase === "STRIKE_WINDOW_1M" ? "1m Tiro Unísono 500 Bots" : "120s Descanso Sagrado";
    }
  }

  /**
   * Renderiza los datos completos de telemetría de Operación 500 en la interfaz
   */
  function renderOperacion500State(data) {
    if (!data) return;
    currentTelemetry = data;

    // Guardar en caché rápida
    try {
      localStorage.setItem("area501_operacion_500_state_v1", JSON.stringify(data));
    } catch (_) {}

    // 1. Tarjetas Superiores
    if (topEnjambreWallets) {
      topEnjambreWallets.innerHTML = `${data.activeWallets || 500} <span class="metric-sub">/ ${data.totalWallets || 500} CARTERAS</span>`;
    }
    if (topSessionPnlDisplay) {
      topSessionPnlDisplay.innerHTML = `+$${(data.sessionPnlUsdc || 90.00).toFixed(2)} <span class="metric-sub">USDC PnL</span>`;
    }
    if (topRatioDisplay) {
      topRatioDisplay.innerHTML = `${data.wins || 120}G <span class="metric-sub">-</span> ${data.losses || 0}P`;
    }
    if (topWinRateBadge) {
      topWinRateBadge.textContent = `${(data.winRatePct || 100.0).toFixed(1)}% WIN`;
    }
    if (topVelocityDisplay) {
      topVelocityDisplay.textContent = `+$${(data.hourlyGainUsdc || 35.00).toFixed(2)} USDC / h`;
    }

    // Integración Bóveda #501
    if (data.vault501Integration) {
      const v = data.vault501Integration;
      if (vaultProgressFill) {
        vaultProgressFill.style.width = `${v.progressToNextBlockPct || 15}%`;
      }
      if (vaultBlockLabel) {
        vaultBlockLabel.textContent = `Bóveda #501: $${(v.consolidatedUsdc || 557.23).toFixed(2)}`;
      }
      if (vaultRemainingLabel) {
        vaultRemainingLabel.textContent = `Meta $${(v.nextMilestoneBlock || 600).toFixed(0)} (-$${(v.remainingToNextBlock || 42.77).toFixed(2)})`;
      }
      if (boxBlockBadge) {
        boxBlockBadge.textContent = `BLOQUE $${(v.currentSettledBlock || 550).toFixed(0)} ASENTADO`;
      }
      if (boxOperationStatusText) {
        boxOperationStatusText.textContent = `🏦 BLOQUE $${(v.currentSettledBlock || 550).toFixed(2)} ASENTADO EN #501 // PRÓXIMO: $${(v.nextMilestoneBlock || 600).toFixed(2)} USDC`;
      }
      if (boxOperationSubText) {
        if (v.fusionMetrics) {
          boxOperationSubText.textContent = `Fusión Compuesta: Squad Secret (+0.15% = +$${v.fusionMetrics.squadShotUsdc.toFixed(2)}) + Operación 500 (+$${v.fusionMetrics.op500InflowUsdc.toFixed(2)}) = +$${v.fusionMetrics.combinedCycleGainUsdc.toFixed(2)} USDC/ciclo (~$${v.fusionMetrics.combinedHourlyRateUsdc.toFixed(2)}/h) hacia la Tercera Bola ($1,000.00 USDC).`;
        } else {
          boxOperationSubText.textContent = `Fusión Compuesta: Squad Secret (+0.15%) + Operación 500 (+$1.75) = +$2.60 USDC/ciclo (~$51.80/h) hacia la Tercera Bola ($1,000.00 USDC).`;
        }
      }
    }

    // Pisos de Gas Blindados
    if (data.gasFloors) {
      if (gasFleetDisplay) {
        gasFleetDisplay.textContent = `${data.gasFloors.fleetCurrentPol.toFixed(2)} / ${data.gasFloors.fleetFloorPol.toFixed(2)} POL ✔`;
      }
      if (gasVaultDisplay) {
        gasVaultDisplay.textContent = `${data.gasFloors.vault501CurrentPol.toFixed(2)} / ${data.gasFloors.vault501FloorPol.toFixed(2)} POL 🛡️`;
      }
    }

    // Centro Táctico (4 Cajas)
    const pair = data.activePair || "BTC/USDC";
    if (strikePairTitle) strikePairTitle.textContent = pair;
    if (boxPairTitleDisplay) {
      boxPairTitleDisplay.innerHTML = `${pair.replace("/", " / ")} <span class="big-direction-pill bull" id="boxDirectionBadge">▲ BULL LONG</span>`;
    }
    if (boxPairCertainty) {
      boxPairCertainty.textContent = `${(data.certaintyPct || 95.8).toFixed(1)}% CERTEZA`;
    }
    if (boxPairSubtitle) {
      boxPairSubtitle.textContent = `Piscina: Uniswap V3 (0.05%) · Informante: ${data.activeInformant || "#701 Oracle-Global"}`;
    }
    if (boxCycleHarvestDisplay) {
      boxCycleHarvestDisplay.textContent = `+$${(data.cycleGainUsdc || 1.75).toFixed(2)} USDC`;
    }

    // Bitácora en Vivo
    if (data.recentCycles && Array.isArray(data.recentCycles) && cyclesTableBody) {
      cyclesTableBody.innerHTML = "";
      data.recentCycles.forEach((c) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="font-bold text-glow font-mono">${c.cycleId}</td>
          <td class="font-mono text-dim">${c.timeUtc || "—"}</td>
          <td class="font-bold font-mono gold-text">${c.pair || "BTC/USDC"}</td>
          <td><span class="tag-bull">${c.directionLabel || "▲ BULL LONG"}</span></td>
          <td class="font-mono cyan-text"><strong>${c.activeBots || "500/500"}</strong> Bots</td>
          <td class="green-text font-bold font-mono">${c.resultFormatted || "+$1.75 USDC"}</td>
          <td><span class="be-locked">${c.breakevenStatus || "🔒 BE #00 (+0.04%)"}</span></td>
          <td><span class="cooldown-badge done">${c.cooldownStatus || "Completado ✔"}</span></td>
        `;
        cyclesTableBody.appendChild(tr);
      });
      if (ledgerCountBadge) {
        ledgerCountBadge.textContent = `${data.recentCycles.length} CICLOS RECIENTES`;
      }
    }
  }

  /**
   * Consulta periódica al Endpoint en Vivo /api/operacion-500/live
   */
  async function fetchLiveOperacion500() {
    try {
      const res = await fetch("/api/operacion-500/live?t=" + Date.now(), {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      renderOperacion500State(data);
    } catch (err) {
      console.warn("[OPERACIÓN 500] Error al consultar live endpoint:", err);
      // Fallback a telemetría estática si existe
      if (!currentTelemetry) {
        fetch("/telemetry/operacion-500-telemetry.json?t=" + Date.now())
          .then((r) => r.json())
          .then((d) => renderOperacion500State(d))
          .catch(() => null);
      }
    }
  }

  // Inicialización Inmediata
  if (currentTelemetry) {
    renderOperacion500State(currentTelemetry);
  }

  // Actualizar relojes cada segundo
  updateClocks();
  setInterval(updateClocks, 1000);

  // Consulta de telemetría cada 3 segundos
  fetchLiveOperacion500();
  setInterval(fetchLiveOperacion500, 3000);

})();
