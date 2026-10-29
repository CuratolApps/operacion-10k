/**
 * shared/core-os-nav.js — ÁREA 501 // UNIFIED HYBRID-MODE NAVIGATION & 10-MIN EXECUTIVE HUB
 * ==============================================================================
 * - Estandariza las 6 Estaciones en Modo Híbrido (Satin White + Gris Esmerilado + Esmeralda/Cobalto).
 * - Limpia las pestañas centrales de la barra inferior para que SOLO muestren las vistas
 *   internas numeradas (1, 2, 3...) de la estación actual (cero confusión de menús).
 * - Añade el Selector Rápido 01–06 en la barra inferior y el botón "RESUMEN 10 MIN · 6 ESTACIONES".
 * - Hidrata en tiempo real desde Hyperliquid L1 (0xD4D1...3743) qué genera cada estación.
 */
(function () {
  const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
  const INITIAL_LOAN_501 = 684.04;
  const EXTRA_MULTICHAIN_USD = 17.29; // Gas Polygon (9.94 POL) + BSC/Arb ($11.50) + Flota ($4.70 USDC)

  const STATIONS = [
    {
      id: "posicion-501",
      num: "01",
      badgeClass: "emerald",
      shortLabel: "01·BÓVEDA",
      stationBarTitle: "ESTACIÓN 01 · BÓVEDA #501",
      title: "POSICIÓN MATRIX 501 (BÓVEDA CENTRAL)",
      icon: "account_balance",
      href: "/posicion-501/",
      desc: "Contabilidad maestra multicadena, custodia de las 4 bóvedas y control de amortización 70/30 del préstamo 0% ($684.04 USDC).",
      capitalAssigned: "$919.45 USD Consolidados",
      whatItGeneratesId: "execYieldSt01",
      whatItGeneratesDefault: "+$218.12 USDC Netos (+31.89%)",
      dailyTarget: "Meta Bloque 1: 90.2% ($902.16 / $1,000)",
      tabs: [
        { label: "1. Estado Ejecutivo (#501)", tabId: "paneExecutiveLedger" },
        { label: "2. Regla 70/30 & Préstamo 0%", tabId: "paneAmortization" },
        { label: "3. Auditoría & OPSEC", tabId: "paneAudit" }
      ]
    },
    {
      id: "squad-matrix",
      num: "02",
      badgeClass: "cobalt",
      shortLabel: "02·SQUAD",
      stationBarTitle: "ESTACIÓN 02 · SQUAD MATRIX",
      title: "SQUAD MATRIX (18 ESCUADRONES L1)",
      icon: "shield",
      href: "/squad-matrix/",
      desc: "Motor principal de trading direccional Post-Only ALO en Hyperliquid L1: Bloque 1 Titanes (#01-#03) + Bloque 2 Independiente $300 (#04-#06).",
      capitalAssigned: "60% Margen Activo ($541.30) + $300 Bloque 2",
      whatItGeneratesId: "execYieldSt02",
      whatItGeneratesDefault: "+$10.00 a +$18.00 USDC / Día (142G-0P)",
      dailyTarget: "7/7 Slots Operando en Vivo (+0.12% a +0.22% TP)",
      tabs: [
        { label: "1. Portada & Relojes", tabId: "paneCover" },
        { label: "2. 54 Pares en Vivo", tabId: "panePairs" },
        { label: "3. 18 Escuadrones", tabId: "paneSquads" },
        { label: "4. Capitalización 70/30", tabId: "paneCapitalization" },
        { label: "5. Proyecciones", tabId: "paneProjections" }
      ]
    },
    {
      id: "funding-matrix",
      num: "03",
      badgeClass: "emerald",
      shortLabel: "03·FUNDING",
      stationBarTitle: "ESTACIÓN 03 · FUNDING MATRIX",
      title: "FUNDING RATE MATRIX (RENTA 24/7)",
      icon: "currency_exchange",
      href: "/funding-matrix/",
      desc: "Cobro horario cada 60 minutos (24 pagos/día) en Hyperliquid L1 con el 40% del Escudo Mentora #00 y salida rápida +0.15% TP.",
      capitalAssigned: "40% Escudo #00 ($360.86 USDC)",
      whatItGeneratesId: "execYieldSt03",
      whatItGeneratesDefault: "+$0.85 a +$2.50 USDC / Día (31 Cortes)",
      dailyTarget: "Cazando Corte :00 UTC + Rebates Maker",
      tabs: [
        { label: "1. Posiciones Abiertas & Libro 24h", tabId: "paneFundingMain" },
        { label: "2. Solo Cobros Positivos (+USDC)", tabId: "paneFundingMain", filterBtn: "btnFilterPosCuts" }
      ]
    },
    {
      id: "sniping",
      num: "04",
      badgeClass: "amber",
      shortLabel: "04·FLASH",
      stationBarTitle: "ESTACIÓN 04 · ATOMIC FLASH",
      title: "ATOMIC FLASH MATRIX (POLYGON V2)",
      icon: "bolt",
      href: "/sniping/",
      desc: "Arbitraje atómico bidireccional (36 rutas A⇄B), Keeper Harvest y Liquidaciones Aave V3 con préstamos Balancer 0% Fee ($5k–$50k).",
      capitalAssigned: "$0.00 Capital Propio · 9.90 POL Gas",
      whatItGeneratesId: "execYieldSt04",
      whatItGeneratesDefault: "+$0.65 USDC On-Chain (26G-0P)",
      dailyTarget: "+$0.50 a +$15.00 / Tiro en Picos Volátiles",
      tabs: [
        { label: "1. 54 Objetivos en Vivo", tabId: "paneTargetsGrid" },
        { label: "2. Calibres Flash ($5k-$50k)", tabId: "paneLadder" },
        { label: "3. Bitácora Multicall3 c/3s", tabId: "paneLedger" }
      ]
    },
    {
      id: "flota-x500",
      num: "05",
      badgeClass: "purple",
      shortLabel: "05·SWARM",
      stationBarTitle: "ESTACIÓN 05 · SWARM 500",
      title: "SWARM 500 MATRIX (500 CARTERAS)",
      icon: "hive",
      href: "/flota-x500/",
      desc: "Enjambre de 500 satélites en 50 Pelotones firmando attestations Gasless EIP-712 ($0 gas), cazando recompensas Keeper y Airdrops 30 Oct.",
      capitalAssigned: "$4.70 USDC Bolsillos + 20.47 POL Gas",
      whatItGeneratesId: "execYieldSt05",
      whatItGeneratesDefault: "$4.70 USDC Reales ($1.75 Cap + $2.95 Sat)",
      dailyTarget: "500/500 Carteras Elegibles Corte 30 Oct",
      tabs: [
        { label: "1. Matriz 500 (50 Pelotones)", tabId: "paneMatrix500" },
        { label: "2. Cortes Airdrops (30 Oct)", tabId: "paneAirdrops" },
        { label: "3. Free-Mint & NFT ($0 Gas)", tabId: "paneFreeMint" },
        { label: "4. Inspector 500 Carteras", tabId: "paneInspector" }
      ]
    },
    {
      id: "wick-matrix",
      num: "06",
      badgeClass: "emerald",
      shortLabel: "06·WICK L1",
      stationBarTitle: "ESTACIÓN 06 · WICK & PAIRS L1",
      title: "WICK SNIPER & PAIRS ARBITRAGE L1",
      icon: "ads_click",
      href: "/wick-matrix/",
      desc: "12 Redes Trampa Caza-Mechas (±0.85% ALO) para capturar agujas de liquidación ajena en 5–20s + 6 Binomios de Pares Gemelos Neutrales.",
      capitalAssigned: "$0.00 Capital Inmovilizado en Espera",
      whatItGeneratesId: "execYieldSt06",
      whatItGeneratesDefault: "+$3.50 a +$12.00 USDC / Día (+0.40%/tiro)",
      dailyTarget: "+$0.78 USDC + Maker Rebate por cada aguja",
      tabs: [
        { label: "1. Redes Caza-Mechas & Gemelos", tabId: "paneWickMain" },
        { label: "2. Radar Completo 12 Pares L1", tabId: "paneWickFullRadar" },
        { label: "3. Reglas & Qué Genera (#06)", tabId: "paneWickRules" }
      ]
    }
  ];

  function getActiveStation() {
    const p = window.location.pathname.toLowerCase();
    for (const s of STATIONS) {
      if (p.includes(s.id)) return s;
    }
    return STATIONS[0];
  }

  function activateInternalTab(tabId, filterBtnId) {
    if (!tabId) return;
    // Buscar botón nativo con data-tab
    const nativeBtn = document.querySelector(`[data-tab="${tabId}"]`);
    if (nativeBtn) {
      nativeBtn.click();
    } else {
      document.querySelectorAll(".tab-pane").forEach(p => {
        p.classList.toggle("active", p.id === tabId);
      });
    }
    if (filterBtnId) {
      setTimeout(() => {
        const fBtn = document.getElementById(filterBtnId);
        if (fBtn) fBtn.click();
      }, 80);
    }
  }

  function standardizeBottomBar(activeStation) {
    const bottomBar = document.querySelector(".matrix-bottombar, .funding-bottombar");
    if (!bottomBar) return;

    // 1. Estandarizar título izquierdo con el número de estación (ESTACIÓN 01..06)
    const brandTitleEl = bottomBar.querySelector(".brand-title") || bottomBar.querySelector(".bottom-identity span:nth-child(2)");
    if (brandTitleEl) {
      brandTitleEl.textContent = activeStation.stationBarTitle;
    }

    // 2. Limpiar la zona central de pestañas: eliminar enlaces externos mezclados y numerar pestañas internas
    const navContainer = bottomBar.querySelector(".matrix-nav-tabs, .bottom-nav");
    if (navContainer) {
      // Eliminar links <a href="..."> que apuntaban a otras estaciones en medio de las pestañas internas
      navContainer.querySelectorAll("a[href]").forEach(a => a.remove());

      // Si estamos en funding-matrix, añadir pestañas internas claras para filtrar Todos vs Cobros Positivos
      if (activeStation.id === "funding-matrix") {
        navContainer.innerHTML = `
          <button class="nav-btn active" type="button" id="fTabAll">
            <span class="material-symbols-rounded">analytics</span> 1. POSICIONES ABIERTAS &amp; CORTES 24H
          </button>
          <button class="nav-btn" type="button" id="fTabPosOnly">
            <span class="material-symbols-rounded">payments</span> 2. SOLO COBROS POSITIVOS (+USDC)
          </button>
        `;
        const bAll = document.getElementById("fTabAll");
        const bPos = document.getElementById("fTabPosOnly");
        if (bAll && bPos) {
          bAll.addEventListener("click", () => {
            bAll.classList.add("active");
            bPos.classList.remove("active");
            activateInternalTab("paneFundingMain", "btnFilterAllCuts");
          });
          bPos.addEventListener("click", () => {
            bPos.classList.add("active");
            bAll.classList.remove("active");
            activateInternalTab("paneFundingMain", "btnFilterPosCuts");
          });
        }
      } else {
        // Numerar claramente las pestañas internas (1., 2., 3...) si aún no tienen número
        const btns = Array.from(navContainer.querySelectorAll("button.nav-tab, button.nav-btn"));
        btns.forEach((btn, idx) => {
          const iconEl = btn.querySelector(".material-symbols-rounded");
          const rawText = btn.textContent.replace(iconEl ? iconEl.textContent : "", "").trim();
          if (!/^\d+\./.test(rawText)) {
            const cleanLabel = `${idx + 1}. ${rawText}`;
            if (iconEl) {
              btn.innerHTML = "";
              btn.appendChild(iconEl);
              btn.appendChild(document.createTextNode(" " + cleanLabel));
            } else {
              btn.textContent = cleanLabel;
            }
          }
        });
      }
    }

    // 3. Estandarizar la Zona Derecha: Selector Rápido 01–06 + Botón Maestro "RESUMEN 10 MIN · 6 ESTACIONES"
    const rightZone = bottomBar.querySelector(".bottom-system, .bottom-right");
    if (rightZone) {
      // Crear tira rápida 01–06 si no existe
      if (!rightZone.querySelector(".hybrid-quick-stations")) {
        const quickStrip = document.createElement("div");
        quickStrip.className = "hybrid-quick-stations";
        quickStrip.title = "Cambio directo entre las 6 Estaciones de Área 501";
        quickStrip.innerHTML = STATIONS.map(st => {
          const isAct = st.id === activeStation.id ? "active" : "";
          return `<a href="${st.href}" class="hq-station-pill ${isAct}" title="Ir a ${st.stationBarTitle}: ${st.title}">${st.shortLabel}</a>`;
        }).join("");
        rightZone.insertBefore(quickStrip, rightZone.firstChild);
      }

      // Estandarizar el botón maestro existente (usando fase de captura para anular modales antiguos)
      const masterBtn = rightZone.querySelector("#btnMasterStationsHub, [data-tab='paneFundingStations'], .btn-stations-master");
      if (masterBtn) {
        masterBtn.className = "btn-executive-10min";
        masterBtn.removeAttribute("data-tab");
        masterBtn.innerHTML = `<span class="material-symbols-rounded">hub</span> RESUMEN 10 MIN · 6 ESTACIONES`;
        masterBtn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          const oldOverlay = document.getElementById("stationsModalOverlay");
          if (oldOverlay) oldOverlay.classList.remove("active");
          openExecutiveModal();
        }, true);
      }
    }
  }

  function buildExecutiveModal(activeStation) {
    if (document.getElementById("area501HybridExecutiveModal")) return;

    const modal = document.createElement("div");
    modal.id = "area501HybridExecutiveModal";

    const cardsHtml = STATIONS.map(st => {
      const isCurrent = st.id === activeStation.id ? "active-current" : "";
      const tabsHtml = st.tabs.map(t => {
        const href = `${st.href}?tab=${encodeURIComponent(t.tabId)}${t.filterBtn ? `&filter=${encodeURIComponent(t.filterBtn)}` : ""}`;
        return `<a href="${href}" class="esc-tab-link" data-st="${st.id}" data-tab="${t.tabId}" data-filter="${t.filterBtn || ""}">${t.label}</a>`;
      }).join("");

      return `
        <div class="exec-station-card ${isCurrent}">
          <div>
            <div class="esc-top-row">
              <span class="esc-num-badge ${st.badgeClass}">ESTACIÓN ${st.num} ${st.id === activeStation.id ? "· ESTÁS AQUÍ" : ""}</span>
              <span class="esc-status-live">● ACTIVA 24/7</span>
            </div>
            <div class="esc-title-row" style="margin-top:5px;">
              <div class="esc-title-left">
                <span class="material-symbols-rounded">${st.icon}</span>
                <h4>${st.title}</h4>
              </div>
              <a href="${st.href}" class="esc-enter-btn">ENTRAR ➔</a>
            </div>
            <p class="esc-desc" style="margin-top:4px;">${st.desc}</p>
          </div>

          <div class="esc-yield-box">
            <div class="esc-yield-row">
              <span class="esc-yield-lbl">Capital Asignado:</span>
              <span class="esc-yield-val" id="execCap_${st.id}">${st.capitalAssigned}</span>
            </div>
            <div class="esc-yield-row">
              <span class="esc-yield-lbl">¿Qué Genera / Resultado?:</span>
              <span class="esc-yield-val" id="${st.whatItGeneratesId}">${st.whatItGeneratesDefault}</span>
            </div>
            <div class="esc-yield-row">
              <span class="esc-yield-lbl">Estado Operativo Hoy:</span>
              <span class="esc-yield-val" id="execTarget_${st.id}">${st.dailyTarget}</span>
            </div>
          </div>

          <div class="esc-tabs-group">
            <span class="esc-tabs-label">Pestañas Internas de la Estación ${st.num} (Acceso en 1 Clic):</span>
            <div class="esc-tabs-pills">
              ${tabsHtml}
            </div>
          </div>
        </div>
      `;
    }).join("");

    modal.innerHTML = `
      <div class="exec-modal-chassis" onclick="event.stopPropagation()">
        <div class="exec-modal-header">
          <div class="exec-header-left">
            <div class="exec-brand-icon">
              <span class="material-symbols-rounded">hub</span>
            </div>
            <div>
              <div class="exec-header-title">PANORAMA EJECUTIVO DE 10 MINUTOS · LAS 6 ESTACIONES DE ÁREA 501</div>
              <div class="exec-header-sub">Vista Unificada Híbrida · Qué pertenece a cada estación, capital asignado y qué está generando en tiempo real</div>
            </div>
          </div>
          <div class="exec-header-right">
            <span class="exec-cloud-badge">
              <span class="live-dot-green"></span>
              <span>5 DEMONIOS LOCALES + CLOUD 24/7 ACTIVOS</span>
            </span>
            <button type="button" class="exec-close-btn" id="btnCloseExecModal">
              <span class="material-symbols-rounded" style="font-size:15px;">close</span> CERRAR (ESC)
            </button>
          </div>
        </div>

        <!-- 4 TARJETAS GLOBALES DE LECTURA EN 10 SEGUNDOS -->
        <div class="exec-kpi-strip-4">
          <div class="exec-satin-kpi">
            <div class="exec-kpi-lbl"><span class="material-symbols-rounded" style="font-size:14px; color:#059669;">account_balance</span> 1. PATRIMONIO TOTAL CONSOLIDADO</div>
            <div class="exec-kpi-val green" id="execTotalWealthVal">$919.45 USD</div>
            <div class="exec-kpi-sub" id="execTotalWealthSub">Hyperliquid L1: $902.16 USDC + Multicadena/Flota: $17.29</div>
          </div>
          <div class="exec-satin-kpi">
            <div class="exec-kpi-lbl"><span class="material-symbols-rounded" style="font-size:14px; color:#1D4ED8;">trending_up</span> 2. GANANCIA NETA ACUMULADA</div>
            <div class="exec-kpi-val blue" id="execNetProfitVal">+$218.12 USDC (+31.89%)</div>
            <div class="exec-kpi-sub" id="execNetProfitSub">Sobre Préstamo 0% ($684.04) · Récord: 142 Ganadas – 0 Perdidas</div>
          </div>
          <div class="exec-satin-kpi">
            <div class="exec-kpi-lbl"><span class="material-symbols-rounded" style="font-size:14px; color:#D97706;">payments</span> 3. PRODUCCIÓN DIARIA (6 ESTACIONES)</div>
            <div class="exec-kpi-val amber">+$14.00 – $25.00 / DÍA</div>
            <div class="exec-kpi-sub" id="execActiveOpsSub">Squad Bloque 1+2 (7/7) + Wick L1 + Funding 24/7 + Flash + Swarm</div>
          </div>
          <div class="exec-satin-kpi">
            <div class="exec-kpi-lbl"><span class="material-symbols-rounded" style="font-size:14px; color:#059669;">flag</span> 4. META BLOQUE 1 ($1,000 ➔ 70/30)</div>
            <div class="exec-kpi-val green" id="execGoalPctVal">90.2% COMPLETADO</div>
            <div class="exec-kpi-sub" id="execGoalDistSub">Faltan $97.84 USDC para iniciar devolución 30% a Bóveda #501</div>
          </div>
        </div>

        <!-- LAS 6 ESTACIONES EN TARJETAS BLANCAS SATINADAS -->
        <div class="exec-stations-grid-6">
          ${cardsHtml}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener("click", closeExecutiveModal);
    const closeBtn = document.getElementById("btnCloseExecModal");
    if (closeBtn) closeBtn.addEventListener("click", closeExecutiveModal);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeExecutiveModal();
    });

    // Interceptar clics en pestañas internas si ya estamos en la misma estación
    modal.querySelectorAll(".esc-tab-link").forEach(link => {
      link.addEventListener("click", (e) => {
        const stId = link.getAttribute("data-st");
        const tabId = link.getAttribute("data-tab");
        const filterBtn = link.getAttribute("data-filter");
        if (stId === activeStation.id && tabId) {
          e.preventDefault();
          closeExecutiveModal();
          activateInternalTab(tabId, filterBtn);
        }
      });
    });
  }

  function openExecutiveModal() {
    const modal = document.getElementById("area501HybridExecutiveModal");
    if (modal) {
      modal.classList.add("open");
      refreshExecutiveLiveTelemetry();
    }
  }

  function closeExecutiveModal() {
    const modal = document.getElementById("area501HybridExecutiveModal");
    if (modal) modal.classList.remove("open");
  }

  async function refreshExecutiveLiveTelemetry() {
    try {
      const res = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clearinghouseState", user: VAULT_501 })
      });
      if (!res.ok) return;
      const ch = await res.json();
      const hlEq = Number(ch?.marginSummary?.accountValue || 0);
      if (hlEq <= 0) return;

      const totalWealth = hlEq + EXTRA_MULTICHAIN_USD;
      const netProfit = hlEq - INITIAL_LOAN_501;
      const netProfitPct = (netProfit / INITIAL_LOAN_501) * 100;
      const pct1000 = Math.min(100, (hlEq / 1000) * 100);
      const dist1000 = Math.max(0, 1000 - hlEq);
      const activeMargin60 = hlEq * 0.60;
      const shield40 = hlEq * 0.40;

      const openPositions = (ch?.assetPositions || [])
        .map(p => p?.position)
        .filter(pos => pos && Math.abs(Number(pos.szi || 0)) > 0);

      const posCoins = openPositions.map(p => p.coin).join(", ");

      const setTxt = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
      };

      setTxt("execTotalWealthVal", `$${totalWealth.toFixed(2)} USD`);
      setTxt("execTotalWealthSub", `Hyperliquid L1: $${hlEq.toFixed(2)} USDC + Multicadena/Flota: $${EXTRA_MULTICHAIN_USD.toFixed(2)}`);
      setTxt("execNetProfitVal", `+$${netProfit.toFixed(2)} USDC (+${netProfitPct.toFixed(2)}%)`);
      setTxt("execGoalPctVal", `${pct1000.toFixed(1)}% COMPLETADO`);
      setTxt("execGoalDistSub", `Faltan $${dist1000.toFixed(2)} USDC para iniciar devolución 30% a Bóveda #501`);

      // Actualizar tarjetas de las 6 estaciones con los datos reales en vivo
      setTxt("execCap_posicion-501", `$${totalWealth.toFixed(2)} USD Consolidados`);
      setTxt("execYieldSt01", `+$${netProfit.toFixed(2)} USDC Netos (+${netProfitPct.toFixed(2)}%)`);
      setTxt("execTarget_posicion-501", `Meta Bloque 1: ${pct1000.toFixed(1)}% ($${hlEq.toFixed(2)} / $1,000)`);

      setTxt("execCap_squad-matrix", `60% Margen ($${activeMargin60.toFixed(2)}) + $300 Bloque 2`);
      setTxt("execTarget_squad-matrix", `${openPositions.length}/7 Posiciones Activas (${posCoins || "Escaneando L1"})`);

      setTxt("execCap_funding-matrix", `40% Escudo #00 ($${shield40.toFixed(2)} USDC)`);
    } catch (_) {}
  }

  function handleUrlTabParam() {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabId = params.get("tab");
      const filterBtn = params.get("filter");
      if (tabId) {
        setTimeout(() => activateInternalTab(tabId, filterBtn), 120);
      }
    } catch (_) {}
  }

  function initHybridNavigation() {
    // Eliminar cualquier rastro de barra oscura antigua si existiera
    const oldBar = document.getElementById("coreMatrixOsWrapper");
    if (oldBar) oldBar.remove();

    const activeStation = getActiveStation();
    standardizeBottomBar(activeStation);
    buildExecutiveModal(activeStation);
    handleUrlTabParam();
    refreshExecutiveLiveTelemetry();
    setInterval(refreshExecutiveLiveTelemetry, 8000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHybridNavigation);
  } else {
    initHybridNavigation();
  }
})();
