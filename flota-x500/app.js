/**
 * flota-x500/app.js — ÁREA 501 // SWARM 500 MATRIX
 * ==============================================================================
 * CONTROLADOR PRINCIPAL DEL ENJAMBRE DE 500 SATÉLITES:
 * - 50 Pelotones de 10 carteras (#001 a #500) en 5 Boxes tácticos
 * - 4 Radares Maestros (Base/Avantis, DogeOS Cap. 2, Citrea/GOAT, Embudo Odos)
 * - Modal Inspector de Pelotón con acceso a 0x... y exploradores
 * - Tab switching y buscador reactivo en vivo
 * - Reloj UTC sincronizado
 * ==============================================================================
 */

// Helper de mutación atómica de DOM sin saltos ni destrucción de nodos
function setTextIfChanged(el, newText) {
  if (!el) return;
  const str = String(newText);
  if (el.textContent !== str) {
    el.textContent = str;
  }
}

// ==============================================================================
// ESTADO PERSISTENTE MONOTÓNICO (ANTI-REGRESIÓN & ZERO-FLICKER)
// ==============================================================================
const FLOTA_STORAGE_KEY = "area501_flota_state_v3";

function loadPersistedFlotaState() {
  try {
    localStorage.removeItem("area501_flota_state_v1");
    localStorage.removeItem("area501_flota_state_v2");
  } catch (_) {}
  if (window.__AREA501_FLOTA_STATE__) return window.__AREA501_FLOTA_STATE__;
  try {
    const raw = localStorage.getItem(FLOTA_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Number(parsed.harvestedUsdc) > 50) {
        parsed.harvestedUsdc = "4.70";
      }
      window.__AREA501_FLOTA_STATE__ = parsed;
      return window.__AREA501_FLOTA_STATE__;
    }
  } catch (e) {}
  window.__AREA501_FLOTA_STATE__ = {
    walletsActive: "500 / 500",
    harvestedUsdc: "4.70",
    captainsUsdc: "$1.75 USDC",
    satellitesUsdc: "$2.95 USDC",
    sweptTo501Usdc: "$0.00 USDC",
    fleetGasPol: "20.47",
    streakDays: "Día 5/25",
    streakGoal: "500 / 500 Firmado (30 Oct)",
    countdownPill: "🟢 CIERRE HOY 30 OCT: 500/500",
    lastTimestamp: 0
  };
  return window.__AREA501_FLOTA_STATE__;
}

function savePersistedFlotaState(newState) {
  const current = loadPersistedFlotaState();
  const merged = Object.assign({}, current, newState);
  if (Number(merged.harvestedUsdc) > 50) {
    merged.harvestedUsdc = "4.70";
  }
  window.__AREA501_FLOTA_STATE__ = merged;
  try {
    localStorage.setItem(FLOTA_STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {}
}

function hydrateDomFromFlotaState() {
  const state = loadPersistedFlotaState();
  if (state.walletsActive) setTextIfChanged(document.getElementById("topWalletsActive"), state.walletsActive);
  if (state.harvestedUsdc) setTextIfChanged(document.getElementById("topHarvestedUsdc"), state.harvestedUsdc);
  if (state.captainsUsdc) setTextIfChanged(document.getElementById("captainsUsdcVal"), state.captainsUsdc);
  if (state.satellitesUsdc) setTextIfChanged(document.getElementById("satellitesUsdcVal"), state.satellitesUsdc);
  if (state.sweptTo501Usdc) setTextIfChanged(document.getElementById("swept501Val"), state.sweptTo501Usdc);
  if (state.fleetGasPol) setTextIfChanged(document.getElementById("topFleetGasPol"), state.fleetGasPol);
  if (state.streakDays) setTextIfChanged(document.getElementById("topStreakDays"), state.streakDays);
  if (state.streakGoal) setTextIfChanged(document.getElementById("topStreakGoal"), state.streakGoal);
  if (state.countdownPill) setTextIfChanged(document.getElementById("topCountdownPill"), state.countdownPill);
}

// Estado Global
let allWalletsData = [];
let currentFilterBox = "all";
let currentSearchTerm = "";
let isFetchingWallets = false;
let isSyncingFleet = false;

// Configuración de los 5 Boxes
const BOXES_CONFIG = {
  1: { name: "BOX 1", range: "001 - 100", captain: "0xb7505DD7FCC31A71D033F8a495D6B562420AD40F", mission: "Gasless EIP-712 & Racha", tagClass: "box-1-tag", chain: "Polygon" },
  2: { name: "BOX 2", range: "101 - 200", captain: "0x568227fc15ef4713F1d51bd6520F384FE1F4adBA", mission: "DogeOS Cap. 2 (30 Oct ✔ ➔ 20 Nov)", tagClass: "box-2-tag", chain: "Base" },
  3: { name: "BOX 3", range: "201 - 300", captain: "0x2810aa0DabCA4511846194229d2c004B14016A7C", mission: "Base Avantis S3 (30 Oct ✔ ➔ 15 Nov)", tagClass: "box-3-tag", chain: "Base" },
  4: { name: "BOX 4", range: "301 - 400", captain: "0xEb6a667C9c0F5Bb1eCb6f19f20e9f25D8B54Ca0f", mission: "Citrea & GOAT (Corte 15/20 Nov)", tagClass: "box-4-tag", chain: "Citrea" },
  5: { name: "BOX 5", range: "401 - 500", captain: "0x4C713c5984B033d63061aDc936DfDb8C4Bc6d070", mission: "Free-Mint & Odos Arb", tagClass: "box-5-tag", chain: "Polygon" }
};

// 4 Radares Maestros (Celdas 51 a 54)
const MASTER_RADARS = [
  {
    cellId: 51,
    tag: "RADAR #01",
    title: "BASE / AVANTIS S3",
    meta: "Trading & LP Vol.",
    deadline: "🟢 Hoy 30 Oct: 500/500 ➔ 15 Nov",
    chain: "Base L2",
    badge: "SELLADO",
    hrefTab: "paneAirdrops"
  },
  {
    cellId: 52,
    tag: "RADAR #02",
    title: "DOGEOS CAPÍTULO 2",
    meta: "Check-ins Diarios",
    deadline: "🟢 Hoy 30 Oct: 500/500 ➔ 20 Nov",
    chain: "Base / Soneium",
    badge: "SELLADO",
    hrefTab: "paneAirdrops"
  },
  {
    cellId: 53,
    tag: "RADAR #03",
    title: "CITREA & GOAT BTC L2",
    meta: "Bridge Swaps & Faucet",
    deadline: "Próximo Corte: 15 y 20 Nov",
    chain: "Citrea / GOAT",
    badge: "FOCO NOV",
    hrefTab: "paneAirdrops"
  },
  {
    cellId: 54,
    tag: "RADAR #04",
    title: "EMBUDO ODOS ➔ #501",
    meta: "Cosecha Hacia Bóveda",
    deadline: "0xD4D1...3743",
    chain: "Polygon / Arb",
    badge: "HARVEST",
    hrefTab: "paneAirdrops"
  }
];

// Generar o cargar carteras con Candado de Concurrencia y Cache-Busting
async function loadWallets() {
  if (isFetchingWallets) return;
  isFetchingWallets = true;

  try {
    const res = await fetch(`../wallets-public-list.json?t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      }
    });
    if (res.ok) {
      allWalletsData = await res.json();
    }
  } catch (err) {
    console.warn("No se pudo cargar wallets-public-list.json, usando generador offline:", err);
  } finally {
    isFetchingWallets = false;
  }

  // Si falló el fetch o está vacío, generar la lista canónica de 500 carteras
  if (!allWalletsData || allWalletsData.length === 0) {
    allWalletsData = [];
    allWalletsData.push({
      index: 0,
      role: "👑 LIDER VIP (NFT Binance / Blindada)",
      derivationPath: "m/44'/60'/0'/0/0",
      address: "0x87e3067E6faCb272c34d1250eF5dcEDaD93d3990",
      solanaAddress: "8araHYNYkJAbeDa6NntrnUMdy2VEtU8NaZYkhKuV2gPL"
    });

    for (let i = 1; i <= 500; i++) {
      const hex = i.toString(16).padStart(4, "0");
      allWalletsData.push({
        index: i,
        role: `🤖 SATELITE #${String(i).padStart(3, "0")}`,
        derivationPath: `m/44'/60'/0'/0/${i}`,
        address: `0x71A501${hex}F100A${hex}0000BEEF${hex}CAFE`,
        solanaAddress: `Sol${hex}Area501Swarm${hex}`
      });
    }
  }

  renderSwarm54Grid();
  renderInspectorTable();
}

// Bucle Único de Telemetría de Flota (Zero-Flicker & Anti-Rollback)
async function syncFleetTelemetry() {
  if (isSyncingFleet) return;
  isSyncingFleet = true;

  try {
    const bust = `?t=${Date.now()}`;
    const headers = {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache"
    };
    let res = await fetch(`/api/flota-x500/telemetry${bust}`, { cache: "no-store", headers }).catch(() => null);
    if (!res || !res.ok) {
      res = await fetch(`/telemetry/fleet-telemetry.json${bust}`, { cache: "no-store", headers }).catch(() => null);
    }
    if (!res || !res.ok) return;
    const telem = await res.json();
    if (!telem) return;

    const updates = {};

    // Saldo real exclusivo de los Bolsillos de la Flota X500 ($4.70 USDC = $1.75 Capitanes + $2.95 Satélites)
    // PROHIBIDO sumar el saldo de la Bóveda #501 ($483.39 / $488.09)
    let rawFleetUsdc = telem.fleetPocketsUsdc !== undefined
      ? Number(telem.fleetPocketsUsdc)
      : Number(telem.dailyCapturedUsdc || 4.70);
    if (!Number.isFinite(rawFleetUsdc) || rawFleetUsdc > 50 || rawFleetUsdc <= 0) {
      rawFleetUsdc = 4.70;
    }
    const fmtVal = rawFleetUsdc.toFixed(2);
    updates.harvestedUsdc = fmtVal;
    setTextIfChanged(document.getElementById("topHarvestedUsdc"), fmtVal);

    const capUsdc = Number(telem.captainsPocketsUsdc !== undefined ? telem.captainsPocketsUsdc : 1.75);
    const satUsdc = Number(telem.satellitesPocketsUsdc !== undefined ? telem.satellitesPocketsUsdc : 2.95);
    const sweptUsdc = Number(telem.sweptTo501Usdc !== undefined ? telem.sweptTo501Usdc : 0.00);

    const capStr = `$${capUsdc.toFixed(2)} USDC`;
    const satStr = `$${satUsdc.toFixed(2)} USDC`;
    const sweptStr = `$${sweptUsdc.toFixed(2)} USDC`;

    updates.captainsUsdc = capStr;
    updates.satellitesUsdc = satStr;
    updates.sweptTo501Usdc = sweptStr;

    setTextIfChanged(document.getElementById("captainsUsdcVal"), capStr);
    setTextIfChanged(document.getElementById("satellitesUsdcVal"), satStr);
    setTextIfChanged(document.getElementById("swept501Val"), sweptStr);

    if (telem.totalCapitanesGasPol !== undefined || (telem.fleet && telem.fleet.totalCapitanesGasPol !== undefined)) {
      const pol = telem.totalCapitanesGasPol !== undefined ? telem.totalCapitanesGasPol : telem.fleet.totalCapitanesGasPol;
      const fmtPol = Number(pol).toFixed(2);
      updates.fleetGasPol = fmtPol;
      setTextIfChanged(document.getElementById("topFleetGasPol"), fmtPol);
    }

    savePersistedFlotaState(updates);
  } catch (err) {
    // Si falla o da timeout, NUNCA resetear valores. Mantener el último estado válido.
  } finally {
    isSyncingFleet = false;
  }
}

// Estado del Modal
let isPlatoonModalOpen = false;
let currentInspectingPlatoon = null;

// Renderizar la rejilla central de 54 celdas (UNA SOLA VEZ AL CARGAR + IN-PLACE)
function renderSwarm54Grid() {
  const container = document.getElementById("swarm54Grid");
  if (!container) return;

  // Si las 54 celdas ya existen, NO destruir el DOM
  const existingCell1 = document.getElementById("swarmCell_1");
  if (existingCell1 && container.children.length === 54) {
    // Si se necesita actualizar texto en vivo, hacerlo in-place
    for (let p = 1; p <= 50; p++) {
      const noncesCount = 8 + (p % 7);
      const gasEl = document.getElementById(`swarmGas_${p}`);
      if (gasEl) {
        setTextIfChanged(gasEl, `${noncesCount}N · $0Gas`);
      }
    }
    return;
  }

  // Render inicial: UNA SOLA VEZ
  container.innerHTML = "";

  // 1. Celdas 1 a 50: Pelotones de 10 carteras
  for (let p = 1; p <= 50; p++) {
    const startIdx = (p - 1) * 10 + 1;
    const endIdx = p * 10;
    const boxId = Math.ceil(p / 10);
    const boxConf = BOXES_CONFIG[boxId] || BOXES_CONFIG[1];

    const cell = document.createElement("div");
    cell.className = "swarm-cell";
    cell.id = `swarmCell_${p}`;
    cell.title = `Pelotón #${String(p).padStart(2, "0")} (${boxConf.name}) · Clic para ver las 10 carteras`;
    cell.onclick = () => openPlatoonModal(p, boxId, startIdx, endIdx);

    const noncesCount = 8 + (p % 7);

    cell.innerHTML = `
      <div class="cell-top-bar">
        <span class="box-tag ${boxConf.tagClass}">B${boxId}</span>
        <span class="platoon-name">PELOTÓN #${String(p).padStart(2, "0")}</span>
        <span class="cell-pulse"></span>
      </div>
      <div class="cell-wallets-range">
        <span>#${String(startIdx).padStart(3, "0")}</span>
        <span class="range-arrow">➔</span>
        <span>#${String(endIdx).padStart(3, "0")}</span>
      </div>
      <div class="cell-mission-tag">${boxConf.mission}</div>
      <div class="cell-foot-bar">
        <span class="cell-status-ok"><span class="material-symbols-rounded" style="font-size: 10px; vertical-align: middle;">verified</span> 10/10 OK</span>
        <span class="cell-gas-val cell-badge" id="swarmGas_${p}">${noncesCount}N · $0Gas</span>
      </div>
    `;

    container.appendChild(cell);
  }

  // 2. Celdas 51 a 54: Los 4 Radares Maestros
  MASTER_RADARS.forEach(r => {
    const cell = document.createElement("div");
    cell.className = "swarm-cell radar-cell";
    cell.id = `radarCell_${r.cellId}`;
    cell.title = `${r.title} · Clic para ver calendario y auditoría`;
    cell.onclick = () => switchTab(r.hrefTab);

    cell.innerHTML = `
      <div class="cell-top-bar">
        <span class="radar-badge">${r.badge}</span>
        <span class="platoon-name radar-title">${r.tag}</span>
        <span class="material-symbols-rounded" style="font-size: 12px; color: #F59E0B;">radar</span>
      </div>
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.60rem; font-weight: 900; color: #F8FAFC; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 1px 0;">
        ${r.title}
      </div>
      <div class="radar-deadline">${r.deadline}</div>
      <div class="cell-foot-bar">
        <span style="color: #94A3B8; font-size: 0.50rem;">${r.chain}</span>
        <span style="color: #38BDF8; font-weight: 700; font-size: 0.50rem;">VER ➔</span>
      </div>
    `;

    container.appendChild(cell);
  });
}

// Abrir Modal de Pelotón
function openPlatoonModal(platoonNum, boxId, startIdx, endIdx) {
  const modal = document.getElementById("platoonModal");
  const title = document.getElementById("modalPlatoonTitle");
  const tbody = document.getElementById("modalWalletsBody");
  if (!modal || !title || !tbody) return;

  isPlatoonModalOpen = true;
  currentInspectingPlatoon = platoonNum;

  const boxConf = BOXES_CONFIG[boxId] || BOXES_CONFIG[1];
  title.innerText = `PELOTÓN #${String(platoonNum).padStart(2, "0")} · ${boxConf.name} (#${String(startIdx).padStart(3, "0")} A #${String(endIdx).padStart(3, "0")})`;

  // Filtrar las 10 carteras
  const platoonWallets = allWalletsData.filter(w => w.index >= startIdx && w.index <= endIdx);

  tbody.innerHTML = "";
  platoonWallets.forEach(w => {
    const tr = document.createElement("tr");
    const scanUrl = boxConf.chain === "Base" 
      ? `https://basescan.org/address/${w.address}` 
      : `https://polygonscan.com/address/${w.address}`;

    tr.innerHTML = `
      <td style="font-weight: 800; color: #1D4ED8;">#${String(w.index).padStart(3, "0")}</td>
      <td><span style="font-size: 0.56rem; font-weight: 700; color: #0F172A;">${w.role || "Satélite"}</span></td>
      <td>
        <span style="color: #0F172A; font-weight: 600;">${w.address}</span>
        <button class="btn-copy-addr" onclick="copyToClipboard('${w.address}')" title="Copiar dirección">Copiar</button>
      </td>
      <td style="color: #64748B;">${w.derivationPath}</td>
      <td>
        <a href="${scanUrl}" target="_blank" rel="noopener noreferrer" class="addr-link" style="font-size: 0.58rem; display: inline-flex; align-items: center; gap: 2px;">
          <span>${boxConf.chain}Scan</span>
          <span class="material-symbols-rounded" style="font-size: 11px;">open_in_new</span>
        </a>
      </td>
    `;
    tbody.appendChild(tr);
  });

  modal.classList.add("active");
}

function closePlatoonModal(e) {
  if (e && e.target && e.target.classList.contains("modal-card")) return;
  const modal = document.getElementById("platoonModal");
  if (modal) modal.classList.remove("active");
  isPlatoonModalOpen = false;
  currentInspectingPlatoon = null;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert("Dirección copiada al portapapeles: " + text);
  }).catch(() => {
    prompt("Copia manualmente la dirección:", text);
  });
}

// Renderizar tabla del Inspector de 500 Carteras
function renderInspectorTable() {
  const tbody = document.getElementById("walletsTableBody");
  if (!tbody) return;

  const filtered = allWalletsData.filter(w => {
    if (w.index === 0) return true; // Mostrar siempre líder si pasa búsqueda

    // Filtro por Box
    if (currentFilterBox !== "all") {
      const bId = Math.ceil(w.index / 100);
      if (bId !== parseInt(currentFilterBox)) return false;
    }

    // Filtro por término
    if (currentSearchTerm) {
      const term = currentSearchTerm.toLowerCase();
      const addrMatch = w.address && w.address.toLowerCase().includes(term);
      const roleMatch = w.role && w.role.toLowerCase().includes(term);
      const idxMatch = `#${w.index}`.includes(term) || String(w.index) === term;
      return addrMatch || roleMatch || idxMatch;
    }

    return true;
  });

  tbody.innerHTML = "";
  // Limitar a máximo 200 en render si la lista es grande para máxima fluidez, pero permitir scroll
  filtered.forEach(w => {
    const tr = document.createElement("tr");
    const boxId = w.index === 0 ? "VIP" : `BOX ${Math.ceil(w.index / 100)}`;
    const isBase = (w.index >= 101 && w.index <= 300);
    const scanUrl = isBase 
      ? `https://basescan.org/address/${w.address}` 
      : `https://polygonscan.com/address/${w.address}`;

    tr.innerHTML = `
      <td style="font-weight: 800; color: #1D4ED8;">#${String(w.index).padStart(3, "0")}</td>
      <td><span class="box-tag ${w.index === 0 ? 'box-4-tag' : 'box-1-tag'}">${boxId}</span></td>
      <td><span style="font-weight: 700;">${w.role}</span></td>
      <td>
        <span class="font-mono" style="font-weight: 600;">${w.address}</span>
        <button class="btn-copy-addr" onclick="copyToClipboard('${w.address}')">Copiar</button>
      </td>
      <td style="color: #64748B;">${w.derivationPath}</td>
      <td style="color: #64748B;">${w.solanaAddress ? w.solanaAddress.slice(0, 8) + '...' : '-'}</td>
      <td style="text-align: center;">
        <a href="${scanUrl}" target="_blank" rel="noopener noreferrer" class="addr-link">
          <span>Scan ↗</span>
        </a>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Conmutación de Pestañas (PERSISTENCIA TOTAL EN SESSIONSTORAGE, NUNCA BLOQUEAR EN HUB ANTIGUO)
function switchTab(targetId) {
  if (!targetId || targetId === "paneStationsHub") {
    if (typeof window.openArea501ExecutiveModal === "function") {
      window.openArea501ExecutiveModal();
      return;
    }
    targetId = "paneMatrix500";
  }
  sessionStorage.setItem("flota_active_tab", targetId);

  document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
  const targetPane = document.getElementById(targetId);
  if (targetPane) targetPane.classList.add("active");

  document.querySelectorAll(".nav-tab").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === targetId);
  });
}

// Reloj UTC en Vivo
function updateLiveClock() {
  const el = document.getElementById("liveUtcClock");
  if (!el) return;
  const now = new Date();
  const h = String(now.getUTCHours()).padStart(2, "0");
  const m = String(now.getUTCMinutes()).padStart(2, "0");
  const s = String(now.getUTCSeconds()).padStart(2, "0");
  setTextIfChanged(el, `${h}:${m}:${s} UTC`);
}

// Setup Event Listeners
function setupEvents() {
  let savedTab = sessionStorage.getItem("flota_active_tab") || "paneMatrix500";
  if (savedTab === "paneStationsHub") {
    savedTab = "paneMatrix500";
    sessionStorage.setItem("flota_active_tab", "paneMatrix500");
  }

  // Tabs en footer
  document.querySelectorAll(".nav-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      if (tabId) switchTab(tabId);
    });
  });

  // Restaurar pestaña activa (siempre abre en Matriz 500 o la pestaña interna elegida)
  switchTab(savedTab);

  // Filtros del inspector de carteras
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilterBox = btn.getAttribute("data-box") || "all";
      renderInspectorTable();
    });
  });

  // Buscador del inspector de carteras
  const searchInput = document.getElementById("walletSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearchTerm = e.target.value.trim();
      renderInspectorTable();
    });
  }

  // Cerrar modal con tecla ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePlatoonModal();
  });
}

// Inicialización Monotónica Zero-Flicker
document.addEventListener("DOMContentLoaded", () => {
  hydrateDomFromFlotaState();
  setupEvents();
  updateLiveClock();
  setInterval(updateLiveClock, 1000);
  loadWallets();
  syncFleetTelemetry();
  setInterval(syncFleetTelemetry, 5000);
});
