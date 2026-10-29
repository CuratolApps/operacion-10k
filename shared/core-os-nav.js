/**
 * shared/core-os-nav.js — ÁREA 501 // CORE MATRIX OS UNIFIED NAVIGATION SHELL
 * =============================================================================
 * Conecta las 6 Estaciones de Trabajo y sus 30 Sub-Espacios (6 × 5) en un solo
 * Sistema Operativo unificado y armonioso, con 0% alteración de fórmulas o demonios.
 */
(function () {
  const STATIONS_MAP = [
    {
      id: "posicion-501",
      num: "01",
      shortTitle: "BÓVEDA #501",
      fullTitle: "ESTACIÓN 01 · BÓVEDA CENTRAL #501",
      href: "/posicion-501/",
      icon: "🏛️",
      spaces: [
        { num: 1, label: "1. Patrimonio & Tarjetas KPI", target: ".kpi-strip, .top-cards, header" },
        { num: 2, label: "2. Posiciones L1 en Vivo", target: "#livePositionsBody, .positions-panel, main" },
        { num: 3, label: "3. Radar 18 Escuadrones", target: "#squadsGrid, .squads-section, main" },
        { num: 4, label: "4. Préstamo 0% ($684.04)", target: "#loanCard, .loan-panel, main" },
        { num: 5, label: "5. Libro de Transacciones", target: "#txExplorerBody, .tx-section, footer" }
      ]
    },
    {
      id: "squad-matrix",
      num: "02",
      shortTitle: "SQUAD MATRIX",
      fullTitle: "ESTACIÓN 02 · 18 ESCUADRONES & CLONES 1⇄2",
      href: "/squad-matrix/",
      icon: "⚔️",
      spaces: [
        { num: 1, label: "1. Bloque 1 (#01-#03 En Fuego)", target: "#squadsGrid, .matrix-grid, main", filter: "block1" },
        { num: 2, label: "2. Bloque 2 ($300 #04-#06 Activos)", target: "#squadsGrid, .matrix-grid, main", filter: "block2" },
        { num: 3, label: "3. Bloques 3-6 (#07-#18 Pre-Armados)", target: "#squadsGrid, .matrix-grid, main", filter: "standby" },
        { num: 4, label: "4. Telemetría Clones 1 ⇄ 2", target: ".clones-panel, #clonesRelaySection, main" },
        { num: 5, label: "5. Libro de Victorias (140G-0P)", target: "#victoryLedgerBody, .ledger-panel, main" }
      ]
    },
    {
      id: "funding-matrix",
      num: "03",
      shortTitle: "FUNDING MATRIX",
      fullTitle: "ESTACIÓN 03 · ESCUDO #00 & CORTES HORARIOS",
      href: "/funding-matrix/",
      icon: "🛡️",
      spaces: [
        { num: 1, label: "1. Escudo #00 (40% · $360.82)", target: ".kpi-grid, header" },
        { num: 2, label: "2. Estado Rescate & Captura :00", target: "#rescueBannerText, .rescue-banner, main" },
        { num: 3, label: "3. Radar Top 10 Tasas L1", target: "#radarTableBody, .radar-panel, main" },
        { num: 4, label: "4. Posiciones Abiertas (Neto/h)", target: "#openPosFundingBody, .left-col, main" },
        { num: 5, label: "5. Libro Mayor Oficial (userFunding)", target: "#ledgerTableBody, .right-col, main" }
      ]
    },
    {
      id: "sniping",
      num: "04",
      shortTitle: "ATOMIC FLASH",
      fullTitle: "ESTACIÓN 04 · ARBITRAJE ATÓMICO POLYGON",
      href: "/sniping/",
      icon: "⚡",
      spaces: [
        { num: 1, label: "1. Motor #01 Keeper Harvest (18)", target: "#matrix54Grid, .matrix-container, main" },
        { num: 2, label: "2. Motor #02 Flash Cross-DEX (A⇄B)", target: "#matrix54Grid, .matrix-container, main" },
        { num: 3, label: "3. Motor #03 Liquidaciones Aave V3", target: "#matrix54Grid, .matrix-container, main" },
        { num: 4, label: "4. Tanque Gas (9.90 POL Blindado)", target: ".kpi-strip, header" },
        { num: 5, label: "5. Bitácora Multicall3 en Vivo", target: "#liveEvalFeedBody, .feed-panel, main" }
      ]
    },
    {
      id: "flota-x500",
      num: "05",
      shortTitle: "FLOTA X500",
      fullTitle: "ESTACIÓN 05 · SWARM 500 MATRIX ($4.70 REAL)",
      href: "/flota-x500/",
      icon: "🐝",
      spaces: [
        { num: 1, label: "1. Matriz 50 Pelotones (500/500)", target: "#swarm54Grid, main", tab: "paneGrid" },
        { num: 2, label: "2. Bolsillos Flota ($4.70 USDC Real)", target: "#topHarvestedUsdc, header" },
        { num: 3, label: "3. Firmas Gasless EIP-712 ($0 Gas)", target: "#paneAirdrops, main", tab: "paneAirdrops" },
        { num: 4, label: "4. Inspector 500 Carteras (EVM+SOL)", target: "#paneInspector, main", tab: "paneInspector" },
        { num: 5, label: "5. Embudo Odos ➔ Bóveda #501", target: "#swept501Val, header" }
      ]
    },
    {
      id: "wick-matrix",
      num: "06",
      shortTitle: "WICK & PAIRS L1",
      fullTitle: "ESTACIÓN 06 · WICK SNIPER & PAIRS ARBITRAGE L1",
      href: "/wick-matrix/",
      icon: "🎯",
      spaces: [
        { num: 1, label: "1. Redes Caza-Mechas (12 Pares ALO)", target: "#spaceWickTraps" },
        { num: 2, label: "2. Arbitraje Pares Gemelos (Neutral)", target: "#spaceTwinPairs" },
        { num: 3, label: "3. Radar de Liquidaciones L1", target: "#spaceLiqRadar" },
        { num: 4, label: "4. Maker Rebates & Margen Libre", target: "#spaceRebates" },
        { num: 5, label: "5. Bitácora de Capturas Rápidas", target: "#spaceWickLedger" }
      ]
    }
  ];

  function detectActiveStation() {
    const p = window.location.pathname.toLowerCase();
    for (const st of STATIONS_MAP) {
      if (p.includes(st.id)) return st;
    }
    return STATIONS_MAP[0];
  }

  function handleSpaceClick(station, space, btnEl) {
    document.querySelectorAll(".core-os-space-btn").forEach(b => b.classList.remove("active"));
    if (btnEl) btnEl.classList.add("active");

    if (space.tab && typeof window.switchTab === "function") {
      try { window.switchTab(space.tab); } catch (_) {}
    }

    if (space.target) {
      const selectors = space.target.split(",").map(s => s.trim());
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
          el.style.transition = "box-shadow 0.35s ease";
          el.style.boxShadow = "0 0 18px rgba(0, 255, 136, 0.45)";
          setTimeout(() => { el.style.boxShadow = ""; }, 1200);
          break;
        }
      }
    }
  }

  function mountCoreMatrixOsBar() {
    if (document.getElementById("coreMatrixOsWrapper")) return;

    const activeStation = detectActiveStation();
    const wrapper = document.createElement("div");
    wrapper.id = "coreMatrixOsWrapper";

    const tabsHtml = STATIONS_MAP.map(st => {
      const isAct = st.id === activeStation.id ? "active" : "";
      return `<a href="${st.href}" class="core-os-station-tab ${isAct}" title="${st.fullTitle}">
        <span class="st-num">${st.num}</span>
        <span>${st.icon} ${st.shortTitle}</span>
      </a>`;
    }).join("");

    const spacesHtml = activeStation.spaces.map((sp, idx) => {
      return `<button type="button" class="core-os-space-btn ${idx === 0 ? "active" : ""}" data-space-idx="${idx}">
        ${sp.label}
      </button>`;
    }).join("");

    const drawerCardsHtml = STATIONS_MAP.map(st => {
      const items = st.spaces.map(sp => `<li><a href="${st.href}#space-${sp.num}">${sp.label}</a></li>`).join("");
      return `<div class="core-os-drawer-card">
        <a href="${st.href}" class="core-os-drawer-card-title">${st.icon} [${st.num}] ${st.shortTitle}</a>
        <ul class="core-os-drawer-spaces">${items}</ul>
      </div>`;
    }).join("");

    wrapper.innerHTML = `
      <div class="core-os-top-bar">
        <div class="core-os-brand-group">
          <button type="button" class="core-os-launcher-btn" id="coreOsDrawerToggle" title="Abrir Mapa Maestro de las 6 Estaciones y 30 Sub-Espacios">
            <span>☰</span>
            <span>CORE MATRIX 501 (6×5)</span>
          </button>
        </div>
        <nav class="core-os-stations-tabs" aria-label="Estaciones Principales Área 501">
          ${tabsHtml}
        </nav>
        <div class="core-os-right-status">
          <span class="core-os-cloud-pill" title="5 Demonios Locales + Respaldo Cloud 24/7 Activo cuando la PC está apagada">
            <span class="core-os-pulse-dot"></span>
            <span>LOCAL + CLOUD 24/7</span>
          </span>
          <a href="https://hypurrscan.io/address/0xD4D12077a61118372f7a367319fb11922Beb3743" target="_blank" rel="noopener" class="core-os-ext-link" title="Ver Cuenta #501 en Hypurrscan sin conectar Wallet">
            🔍 Hypurrscan L1 ↗
          </a>
        </div>
      </div>
      <div class="core-os-subspaces-bar">
        <div class="core-os-subspaces-list">
          <span class="core-os-subspace-label">${activeStation.icon} ESPACIOS DE ${activeStation.shortTitle}:</span>
          ${spacesHtml}
        </div>
        <div class="core-os-quick-links">
          <a href="/posicion-501/" class="core-os-ext-link">🏠 Volver a Bóveda #501</a>
        </div>
      </div>
      <div id="coreOsMasterDrawer">
        <div class="core-os-drawer-header">
          <div style="font-size: 0.78rem; font-weight: 900; color: #00ff88;">
            🏛️ ÁREA 501 // ARQUITECTURA CENTRAL UNIFICADA — 6 ESTACIONES × 5 SUB-ESPACIOS (30 MÓDULOS ACTIVOS)
          </div>
          <button type="button" id="coreOsDrawerClose" class="core-os-launcher-btn" style="padding: 2px 8px;">✕ CERRAR MAPA</button>
        </div>
        <div class="core-os-drawer-grid">
          ${drawerCardsHtml}
        </div>
      </div>
    `;

    document.body.insertBefore(wrapper, document.body.firstChild);

    // Eventos de Sub-Espacios
    wrapper.querySelectorAll(".core-os-space-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-space-idx") || 0);
        const sp = activeStation.spaces[idx];
        if (sp) handleSpaceClick(activeStation, sp, btn);
      });
    });

    // Eventos del Drawer 6x5
    const drawer = document.getElementById("coreOsMasterDrawer");
    const toggleBtn = document.getElementById("coreOsDrawerToggle");
    const closeBtn = document.getElementById("coreOsDrawerClose");
    if (toggleBtn && drawer) {
      toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        drawer.classList.toggle("open");
      });
    }
    if (closeBtn && drawer) {
      closeBtn.addEventListener("click", () => drawer.classList.remove("open"));
    }
    document.addEventListener("click", (e) => {
      if (drawer && drawer.classList.contains("open") && !drawer.contains(e.target) && e.target !== toggleBtn) {
        drawer.classList.remove("open");
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountCoreMatrixOsBar);
  } else {
    mountCoreMatrixOsBar();
  }
})();
