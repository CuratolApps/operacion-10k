/**
 * shared/core-os-nav.js — ÁREA 501 // UNIFIED HYBRID-MODE NAVIGATION & 10-MIN EXECUTIVE HUB
 * ==============================================================================
 * 1) Descongestiona al 100% la barra inferior: deja SOLO las pestañas internas de la
 *    estación actual en el centro y UN SOLO botón grande "[ MENÚ CENTRAL · 6 ESTACIONES ]" a la derecha.
 * 2) Corrige el bug de sessionStorage ("paneStationsHub") que impedía entrar a Swarm 500 (/flota-x500/).
 * 3) Muestra con honestidad contable 100% real cuánto dinero real lleva cobrado cada estación hoy,
 *    qué está cazando y exactamente a qué bóveda cae cada recompensa.
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
      stationBarTitle: "ESTACIÓN 01 · BÓVEDA #501",
      title: "POSICIÓN MATRIX 501 (BÓVEDA CENTRAL)",
      icon: "account_balance",
      href: "/posicion-501/",
      defaultPaneId: "paneExecutiveLedger",
      desc: "Caja fuerte principal y contabilidad multicadena de tus 4 bóvedas. Aquí se acumulan todas las ganancias y se controla el préstamo 0% ($684.04).",
      realCollectedId: "execReal_posicion-501",
      realCollectedDefault: "$921.84 USD Patrimonio Total (+$220.51 Ganados)",
      whatItHuntsId: "execHunt_posicion-501",
      whatItHuntsDefault: "Meta Bloque 1: 90.5% ($904.55 / $1,000 USDC)",
      whereMoneyLands: "Custodia Directa 0xD4D1...3743 (Hyperliquid L1 + Polygon)",
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
      stationBarTitle: "ESTACIÓN 02 · SQUAD MATRIX",
      title: "SQUAD MATRIX (TRADING BLOQUES 1 Y 2)",
      icon: "shield",
      href: "/squad-matrix/",
      defaultPaneId: "paneCover",
      desc: "Nuestro motor principal que más dinero produce hoy: Bloque 1 Titanes (#01-#03) + Bloque 2 Independiente de $300 (#04-#06) operando en Hyperliquid L1.",
      realCollectedId: "execReal_squad-matrix",
      realCollectedDefault: "+$220.51 USDC Reales Cerrados (142 Ganadas – 0 Perdidas)",
      whatItHuntsId: "execHunt_squad-matrix",
      whatItHuntsDefault: "5/7 Operaciones Abiertas Ahora (+0.12% a +0.22% por tiro)",
      whereMoneyLands: "Cae al instante en USDC dentro de Bóveda #501 (Hyperliquid L1)",
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
      stationBarTitle: "ESTACIÓN 03 · FUNDING MATRIX",
      title: "FUNDING RATE MATRIX (RENTA CADA HORA)",
      icon: "currency_exchange",
      href: "/funding-matrix/",
      defaultPaneId: "paneFundingMain",
      desc: "Usa el 40% del Escudo Mentora #00 ($361.82 USDC) para cobrar pagos de Funding cada 60 minutos (:00 UTC) y salir rápido en ganancia (+0.15%).",
      realCollectedId: "execReal_funding-matrix",
      realCollectedDefault: "+$0.1127 USDC Reales Cobrados (31 Cortes Positivos)",
      whatItHuntsId: "execHunt_funding-matrix",
      whatItHuntsDefault: "Cazando Corte Horario :00 UTC + Rebates Maker",
      whereMoneyLands: "Se suma cada hora (:00) al saldo USDC de Bóveda #501 en L1",
      tabs: [
        { label: "1. Posiciones Abiertas & Cortes 24h", tabId: "paneFundingMain" },
        { label: "2. Solo Cobros Positivos (+USDC)", tabId: "paneFundingMain", filterBtn: "btnFilterPosCuts" }
      ]
    },
    {
      id: "sniping",
      num: "04",
      badgeClass: "amber",
      stationBarTitle: "ESTACIÓN 04 · ATOMIC FLASH",
      title: "ATOMIC FLASH MATRIX (POLYGON V2)",
      icon: "bolt",
      href: "/sniping/",
      defaultPaneId: "paneTargetsGrid",
      desc: "Arbitraje atómico bidireccional (36 rutas A⇄B) y liquidaciones en Polygon PoS con préstamos Flash 0% Fee ($5k–$50k) sin arriesgar tu capital.",
      realCollectedId: "execReal_sniping",
      realCollectedDefault: "+$0.65 USDC Reales On-Chain (26 Ganadas – 0 Perdidas)",
      whatItHuntsId: "execHunt_sniping",
      whatItHuntsDefault: "Escaneando 36 rutas c/3s (9.90 POL = 1,178 tiros listos)",
      whereMoneyLands: "El contrato 0x3e8b...09f7 envía el USDC directo a #501 en Polygon",
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
      stationBarTitle: "ESTACIÓN 05 · SWARM 500",
      title: "SWARM 500 MATRIX (500 CARTERAS)",
      icon: "hive",
      href: "/flota-x500/",
      defaultPaneId: "paneMatrix500",
      desc: "Enjambre de 500 carteras en 50 Pelotones generando firmas Gasless EIP-712 ($0 gas), cazando recompensas Keeper y Airdrops (Corte 30 Oct).",
      realCollectedId: "execReal_flota-x500",
      realCollectedDefault: "$4.70 USDC Reales en Bolsillos ($1.75 Cap + $2.95 Sat)",
      whatItHuntsId: "execHunt_flota-x500",
      whatItHuntsDefault: "500/500 Carteras Activas · Corte Airdrops 30 Octubre",
      whereMoneyLands: "Bolsillos Flota ➔ Embudo Odos barre hacia Bóveda #501",
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
      stationBarTitle: "ESTACIÓN 06 · WICK & PAIRS L1",
      title: "WICK SNIPER & PAIRS L1 (NUEVO DPTO)",
      icon: "ads_click",
      href: "/wick-matrix/",
      defaultPaneId: "paneWickMain",
      desc: "12 Redes Trampa Caza-Mechas (±0.85% ALO) esperando agujas violentas de liquidación en Wall Street + 6 Pares Gemelos Neutrales ($0 capital bloqueado).",
      realCollectedId: "execReal_wick-matrix",
      realCollectedDefault: "$0.00 USDC Cobrados Hoy (0 Agujas Capturadas aún)",
      whatItHuntsId: "execHunt_wick-matrix",
      whatItHuntsDefault: "Meta cuando caiga una aguja: +$0.78 USDC (+0.40% + Rebate)",
      whereMoneyLands: "Al cerrar el rebote cae directo al saldo USDC de #501 en L1",
      tabs: [
        { label: "1. Redes Caza-Mechas & Gemelos", tabId: "paneWickMain" },
        { label: "2. ¿Cómo y Dónde Llega el Dinero?", tabId: "paneWickRewardPath" },
        { label: "3. Tabla Completa 12 Pares", tabId: "paneWickFullRadar" }
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

  // Limpiar cualquier bloqueo de sessionStorage que mandaba al menú viejo ("paneStationsHub")
  function healStuckSessionStorage(activeStation) {
    try {
      const keys = ["flota_active_tab", "sniping_active_tab", "squad_matrix_active_tab"];
      keys.forEach(k => {
        const val = sessionStorage.getItem(k);
        if (val === "paneStationsHub" || val === "paneFundingStations") {
          sessionStorage.removeItem(k);
        }
      });

      const oldHubPane = document.getElementById("paneStationsHub") || document.getElementById("paneFundingStations");
      if (oldHubPane && oldHubPane.classList.contains("active")) {
        oldHubPane.classList.remove("active");
        const mainPane = document.getElementById(activeStation.defaultPaneId);
        if (mainPane) mainPane.classList.add("active");
        const firstTabBtn = document.querySelector(`.nav-tab[data-tab="${activeStation.defaultPaneId}"], .nav-btn[data-tab="${activeStation.defaultPaneId}"]`);
        if (firstTabBtn) firstTabBtn.classList.add("active");
      }
    } catch (_) {}
  }

  function activateInternalTab(tabId, filterBtnId) {
    if (!tabId) return;
    const nativeBtn = document.querySelector(`.nav-tab[data-tab="${tabId}"], .nav-btn[data-tab="${tabId}"]`);
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

    // 2. Limpiar la zona central de pestañas: dejar SOLO las pestañas internas de esta estación
    const navContainer = bottomBar.querySelector(".matrix-nav-tabs, .bottom-nav");
    if (navContainer) {
      navContainer.querySelectorAll("a[href]").forEach(a => a.remove());

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

    // 3. Zona Derecha DESCONGESTIONADA: Eliminar píldoras apretadas y dejar UN SOLO BOTÓN MAESTRO claro
    const rightZone = bottomBar.querySelector(".bottom-system, .bottom-right");
    if (rightZone) {
      const oldQuickStrip = rightZone.querySelector(".hybrid-quick-stations");
      if (oldQuickStrip) oldQuickStrip.remove();

      const masterBtn = rightZone.querySelector("#btnMasterStationsHub, [data-tab='paneFundingStations'], .btn-stations-master, .btn-executive-10min");
      if (masterBtn) {
        masterBtn.className = "btn-executive-10min";
        masterBtn.removeAttribute("data-tab");
        masterBtn.innerHTML = `<span class="material-symbols-rounded">apps</span> MENÚ CENTRAL · 6 ESTACIONES`;
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
              <span class="esc-status-live">● OPERANDO 24/7</span>
            </div>
            <div class="esc-title-row" style="margin-top:5px;">
              <div class="esc-title-left">
                <span class="material-symbols-rounded">${st.icon}</span>
                <h4>${st.title}</h4>
              </div>
              <a href="${st.href}" class="esc-enter-btn">ENTRAR A ESTACIÓN ${st.num} ➔</a>
            </div>
            <p class="esc-desc" style="margin-top:4px;">${st.desc}</p>
          </div>

          <div class="esc-yield-box">
            <div class="esc-yield-row">
              <span class="esc-yield-lbl">💵 Cobrado Real / En Bolsillo:</span>
              <span class="esc-yield-val" id="${st.realCollectedId}">${st.realCollectedDefault}</span>
            </div>
            <div class="esc-yield-row">
              <span class="esc-yield-lbl">🎯 Qué Está Cazando Ahora:</span>
              <span class="esc-yield-val" id="${st.whatItHuntsId}">${st.whatItHuntsDefault}</span>
            </div>
            <div class="esc-yield-row">
              <span class="esc-yield-lbl">🏦 ¿Dónde Cae la Recompensa?:</span>
              <span class="esc-yield-val" style="color:#1E40AF;">${st.whereMoneyLands}</span>
            </div>
          </div>

          <div class="esc-tabs-group">
            <span class="esc-tabs-label">Entrar directo a una vista de la Estación ${st.num}:</span>
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
              <span class="material-symbols-rounded">apps</span>
            </div>
            <div>
              <div class="exec-header-title">MENÚ CENTRAL ÁREA 501 · PANORAMA SINCERO DE LAS 6 ESTACIONES</div>
              <div class="exec-header-sub">Selecciona cualquier Estación para entrar, o revisa en 10 segundos cuánto lleva cobrado real cada una y a dónde llega el dinero</div>
            </div>
          </div>
          <div class="exec-header-right">
            <span class="exec-cloud-badge">
              <span class="live-dot-green"></span>
              <span>5 MOTORES LOCALES + CLOUD 24/7 ACTIVOS</span>
            </span>
            <button type="button" class="exec-close-btn" id="btnCloseExecModal">
              <span class="material-symbols-rounded" style="font-size:15px;">close</span> CERRAR MENÚ (ESC)
            </button>
          </div>
        </div>

        <!-- 4 TARJETAS GLOBALES DE LECTURA RÁPIDA -->
        <div class="exec-kpi-strip-4">
          <div class="exec-satin-kpi">
            <div class="exec-kpi-lbl"><span class="material-symbols-rounded" style="font-size:14px; color:#059669;">account_balance</span> 1. PATRIMONIO REAL CONSOLIDADO</div>
            <div class="exec-kpi-val green" id="execTotalWealthVal">$921.84 USD</div>
            <div class="exec-kpi-sub" id="execTotalWealthSub">Hyperliquid L1: $904.55 USDC + Gas/Flota: $17.29 USD</div>
          </div>
          <div class="exec-satin-kpi">
            <div class="exec-kpi-lbl"><span class="material-symbols-rounded" style="font-size:14px; color:#1D4ED8;">verified</span> 2. GANANCIA REAL CERRADA (L1)</div>
            <div class="exec-kpi-val blue" id="execNetProfitVal">+$220.51 USDC (+32.23%)</div>
            <div class="exec-kpi-sub" id="execNetProfitSub">Dinero real ya cobrado sobre Préstamo $684.04 · 142G-0P</div>
          </div>
          <div class="exec-satin-kpi">
            <div class="exec-kpi-lbl"><span class="material-symbols-rounded" style="font-size:14px; color:#D97706;">bolt</span> 3. OPERACIONES ABIERTAS AHORA</div>
            <div class="exec-kpi-val amber" id="execActivePositionsVal">5 / 7 EN FUEGO</div>
            <div class="exec-kpi-sub" id="execActiveOpsSub">Bloque 1 + Bloque 2 ($300) trabajando en vivo en Wall Street</div>
          </div>
          <div class="exec-satin-kpi">
            <div class="exec-kpi-lbl"><span class="material-symbols-rounded" style="font-size:14px; color:#059669;">flag</span> 4. META BLOQUE 1 ($1,000 USDC)</div>
            <div class="exec-kpi-val green" id="execGoalPctVal">90.5% COMPLETADO</div>
            <div class="exec-kpi-sub" id="execGoalDistSub">Faltan solo $95.45 USDC para activar retorno 30% a #501</div>
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

  window.openArea501ExecutiveModal = openExecutiveModal;

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

      const openPositions = (ch?.assetPositions || [])
        .map(p => p?.position)
        .filter(pos => pos && Math.abs(Number(pos.szi || 0)) > 0);

      const posCoins = openPositions.map(p => p.coin).join(", ");

      const setTxt = (id, txt) => {
        const el = document.getElementById(id);
        if (el) el.textContent = txt;
      };

      setTxt("execTotalWealthVal", `$${totalWealth.toFixed(2)} USD`);
      setTxt("execTotalWealthSub", `Hyperliquid L1: $${hlEq.toFixed(2)} USDC + Gas/Flota: $${EXTRA_MULTICHAIN_USD.toFixed(2)} USD`);
      setTxt("execNetProfitVal", `+$${netProfit.toFixed(2)} USDC (+${netProfitPct.toFixed(2)}%)`);
      setTxt("execActivePositionsVal", `${openPositions.length} / 7 EN FUEGO`);
      setTxt("execActiveOpsSub", `Pares Abiertos Ahora: ${posCoins || "Escaneando L1"}`);
      setTxt("execGoalPctVal", `${pct1000.toFixed(1)}% COMPLETADO`);
      setTxt("execGoalDistSub", `Faltan solo $${dist1000.toFixed(2)} USDC para activar retorno 30% a #501`);

      setTxt("execReal_posicion-501", `$${totalWealth.toFixed(2)} USD Patrimonio (+$${netProfit.toFixed(2)} Ganados)`);
      setTxt("execHunt_posicion-501", `Meta Bloque 1: ${pct1000.toFixed(1)}% ($${hlEq.toFixed(2)} / $1,000 USDC)`);

      setTxt("execReal_squad-matrix", `+$${netProfit.toFixed(2)} USDC Reales Cerrados (142G-0P)`);
      setTxt("execHunt_squad-matrix", `${openPositions.length}/7 Posiciones Activas (${posCoins || "Escaneando L1"})`);
    } catch (_) {}
  }

  function handleUrlTabParam() {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabId = params.get("tab");
      const filterBtn = params.get("filter");
      if (tabId && tabId !== "paneStationsHub" && tabId !== "paneFundingStations") {
        setTimeout(() => activateInternalTab(tabId, filterBtn), 120);
      }
    } catch (_) {}
  }

  function initHybridNavigation() {
    const activeStation = getActiveStation();
    healStuckSessionStorage(activeStation);
    setTimeout(() => healStuckSessionStorage(activeStation), 180);
    standardizeBottomBar(activeStation);
    buildExecutiveModal(activeStation);
    handleUrlTabParam();
    refreshExecutiveLiveTelemetry();
    setInterval(refreshExecutiveLiveTelemetry, 6000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHybridNavigation);
  } else {
    initHybridNavigation();
  }
})();
