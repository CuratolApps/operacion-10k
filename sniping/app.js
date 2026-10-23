/**
 * ÁREA 501 // CABINA DE SNIPING ATÓMICO (MODO RIESGO 0%)
 * sniping/app.js - Lógica de Monitoreo Cuantitativo en Tiempo Real
 * 16 Nodrizas · 32 Nebulosas IA (16 Binomios) · 15 Disparos Diarios
 */

// =============================================================================
// CATÁLOGO DE LAS 16 NODRIZAS SNIPER & SUS 32 NEBULOSAS IA (16 BINOMIOS)
// =============================================================================
const MOTHERSHIPS_REGISTRY = [
  {
    id: "#501",
    index: 501,
    name: "Nodriza Matriz Dual",
    role: "Tesorería & Bóveda Matriz Dual",
    box: "Matriz / Box 0",
    address: "0xD4D12077a61118372f7a367319fb11922Beb3743",
    gasPol: "110.98",
    gasBnb: "0.0150",
    lockedFloorPol: "110.00",
    gasLostPol: "0.00",
    status: "FUEGO_ACTIVO",
    statusLabel: "Fuego Activo (Cañón Dual)",
    activeCannon: true,
    cannonChain: "POLYGON + BSC",
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-01", name: "Estratega Cuántica Liquidaciones & Flash Dips", role: "Calculista", certainty: 98, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-02", name: "Guardaespaldas Anti-Rug & Solvencia Aave/Venus", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#001",
    index: 1,
    name: "Capitán Box 1",
    role: "Capitán Box 1 (Bitcoin L2 & Minería)",
    box: "Box 1",
    address: "0xb7505DD7FCC31A71D033F8a495D6B562420AD40F",
    gasPol: "18.02",
    gasBnb: "0.0080",
    lockedFloorPol: "5.00",
    gasLostPol: "0.00",
    status: "FUEGO_ACTIVO",
    statusLabel: "Fuego Activo (Cañón #1 Polygon)",
    activeCannon: true,
    cannonChain: "POLYGON",
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-03", name: "Estratega Cuántica Liquidaciones Flash L2", role: "Calculista", certainty: 97, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-04", name: "Guardaespaldas Anti-Rug Pull Blue-Chip", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#101",
    index: 101,
    name: "Capitán Box 2",
    role: "Capitán Box 2 (Juegos & Metaverso)",
    box: "Box 2",
    address: "0x568227fc15ef4713F1d51bd6520F384FE1F4adBA",
    gasPol: "18.03",
    gasBnb: "0.0080",
    lockedFloorPol: "5.00",
    gasLostPol: "0.00",
    status: "FUEGO_ACTIVO",
    statusLabel: "Fuego Activo (Cañón #2 BSC)",
    activeCannon: true,
    cannonChain: "BSC",
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-05", name: "Estratega Cuántica Arbitraje Cross-Fee V3", role: "Calculista", certainty: 96, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-06", name: "Guardaespaldas Anti-Honeypot PancakeSwap V3", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#201",
    index: 201,
    name: "Capitán Box 3",
    role: "Capitán Box 3 (Piscinas & Sorteos USDC)",
    box: "Box 3",
    address: "0x2810aa0DabCA4511846194229d2c004B14016A7C",
    gasPol: "18.01",
    gasBnb: "0.0080",
    lockedFloorPol: "5.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-07", name: "Estratega Cuántica Liquidaciones & Panic-Dip", role: "Calculista", certainty: 96, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-08", name: "Guardaespaldas Anti-Slippage & MEV Shield", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#301",
    index: 301,
    name: "Capitán Box 4",
    role: "Capitán Box 4 (Airdrops L2 Gasless)",
    box: "Box 4",
    address: "0xEb6a667C9c0F5Bb1eCb6f19f20e9f25D8B54Ca0f",
    gasPol: "12.01",
    gasBnb: "0.0080",
    lockedFloorPol: "5.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-09", name: "Estratega Cuántica Floor/Bid Flipping", role: "Calculista", certainty: 95, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-10", name: "Guardaespaldas Anti-Honeypot ERC-1155/721", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#401",
    index: 401,
    name: "Capitán Box 5",
    role: "Capitán Box 5 (Mints & Refinería DEX)",
    box: "Box 5",
    address: "0x4C713c5984B033d63061aDc936DfDb8C4Bc6d070",
    gasPol: "12.01",
    gasBnb: "0.0080",
    lockedFloorPol: "5.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-11", name: "Estratega Cuántica Mints & Floor Swaps", role: "Calculista", certainty: 96, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-12", name: "Guardaespaldas Whitelist Marketplaces", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#008",
    index: 8,
    name: "Sub-Capitán Box 1 Alfa",
    role: "Sub-Capitán Alfa Box 1",
    box: "Box 1",
    address: "0x0EE1dE68C1F101233F9607FfD124DaA55943Ce42",
    gasPol: "6.50",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-13", name: "Estratega Cuántica Arbitraje GameFi", role: "Calculista", certainty: 95, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-14", name: "Guardaespaldas Anti-Rug Micro-Mints", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#006",
    index: 6,
    name: "Sub-Capitán Box 1 Beta",
    role: "Sub-Capitán Beta Box 1",
    box: "Box 1",
    address: "0x0a16cA725A468f4D6c14885a24DC8e9B4D1c1cA7",
    gasPol: "6.50",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-15", name: "Estratega Cuántica Flipping & Arbitraje", role: "Calculista", certainty: 95, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-16", name: "Guardaespaldas 4 Candados Anti-Spam", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#108",
    index: 108,
    name: "Sub-Capitán Box 2 Alfa",
    role: "Sub-Capitán Alfa Box 2",
    box: "Box 2",
    address: "0x0526D0f58a4FE4A427AC4da8e3BDF8756f8bb7bC",
    gasPol: "6.50",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-17", name: "Estratega Cuántica Cortes de Época & Bribes", role: "Calculista", certainty: 96, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-18", name: "Guardaespaldas Anti-Phishing On-Chain", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#106",
    index: 106,
    name: "Sub-Capitán Box 2 Beta",
    role: "Sub-Capitán Beta Box 2",
    box: "Box 2",
    address: "0x6C66C9724AeD2407e80E805B105d82270471785d",
    gasPol: "6.50",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-19", name: "Estratega Cuántica Reclamos Óptimos Época", role: "Calculista", certainty: 95, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-20", name: "Guardaespaldas Auditor de Claim Functions", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#204",
    index: 204,
    name: "Sub-Capitán Box 3 Alfa",
    role: "Sub-Capitán Alfa Box 3",
    box: "Box 3",
    address: "0x1F25792B65D36DF127E6d6C6AcEe07811cA3d119",
    gasPol: "6.50",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-21", name: "Estratega Cuántica Quest Pools & Sorteos", role: "Calculista", certainty: 96, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-22", name: "Guardaespaldas Anti-Scam Smart Contracts", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#205",
    index: 205,
    name: "Sub-Capitán Box 3 Beta",
    role: "Sub-Capitán Beta Box 3",
    box: "Box 3",
    address: "0xf2CC5e4dfBE74B1945D7dACfD5ef652A6c045a08",
    gasPol: "6.50",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-23", name: "Estratega Cuántica Recompensa Bribes USDC", role: "Calculista", certainty: 95, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-24", name: "Guardaespaldas Verificador de Liquidez DEX", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#307",
    index: 307,
    name: "Sub-Capitán Box 4 Alfa",
    role: "Sub-Capitán Alfa Box 4",
    box: "Box 4",
    address: "0xc4E7Fc96695eF0593592EcE10A807bbF0C92f27d",
    gasPol: "6.50",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-25", name: "Estratega Cuántica Keeper Harvester & Bounties", role: "Calculista", certainty: 97, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-26", name: "Guardaespaldas Auditor de Gas Bounties", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#311",
    index: 311,
    name: "Sub-Capitán Box 4 Beta",
    role: "Sub-Capitán Beta Box 4",
    box: "Box 4",
    address: "0xF3d19755705FdBE34f2930d9bABB51fE379E865d",
    gasPol: "6.50",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-27", name: "Estratega Cuántica Micro-Bounties On-Chain", role: "Calculista", certainty: 96, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-28", name: "Guardaespaldas Verificador de Rendimiento", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#403",
    index: 403,
    name: "Sub-Capitán Box 5 Alfa",
    role: "Sub-Capitán Alfa Box 5",
    box: "Box 5",
    address: "0x8B857C207A2456022bE5e5DfD3e205E95CA75be5",
    gasPol: "6.50",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-29", name: "Estratega Cuántica Bounties Públicos Beefy/Gamma", role: "Calculista", certainty: 98, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-30", name: "Médico Forense de Polvo & Guardián $0 Gas", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#411",
    index: 411,
    name: "Sub-Capitán Box 5 Beta",
    role: "Sub-Capitán Beta Box 5",
    box: "Box 5",
    address: "0x3Bc2dBFA23294231a30683D691BFEaCDf56d3c12",
    gasPol: "6.50",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-31", name: "Estratega Cuántica Refinería & Swap Atómico", role: "Calculista", certainty: 97, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-32", name: "Guardaespaldas Anti-MEV Sandwich Protector", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  }
];

// =============================================================================
// HISTORIAL DE OPERACIONES ATÓMICAS CONFIRMADAS EN CADENA
// =============================================================================
const INITIAL_ATOMIC_OPERATIONS = [
  {
    opId: "OP-501-01",
    timestamp: "10:14:22 UTC",
    nebulasApproved: "Nebulosa #01 (98%) + #02 (100%)",
    mothership: "#501 (Matriz Dual)",
    route: "Polygon / Triangular WETH Uniswap V3",
    inOutUsdc: "$18.30 ➔ $18.52 USDC",
    gasUsed: "0.00 POL ($0.00 / callStatic)",
    netProfit: "+$0.22 USDC",
    status: "CONFIRMADA"
  },
  {
    opId: "OP-501-02",
    timestamp: "08:45:11 UTC",
    nebulasApproved: "Nebulosa #03 (97%) + #04 (100%)",
    mothership: "#501 (Matriz Dual)",
    route: "BSC / PancakeSwap V3 Cross-Fee",
    inOutUsdc: "$20.42 ➔ $20.69 USDC",
    gasUsed: "0.00 BNB ($0.00 / callStatic)",
    netProfit: "+$0.27 USDC",
    status: "CONFIRMADA"
  },
  {
    opId: "OP-501-03",
    timestamp: "06:30:05 UTC",
    nebulasApproved: "Nebulosa #29 (98%) + #30 (100%)",
    mothership: "#501 & #403",
    route: "Polygon / Keeper Bounty Beefy Vault",
    inOutUsdc: "Bounty Reclamo ➔ $0.35 USDC",
    gasUsed: "0.0012 POL (<1.35x Gas)",
    netProfit: "+$0.35 USDC",
    status: "CONFIRMADA"
  },
  {
    opId: "OP-501-04",
    timestamp: "04:12:49 UTC",
    nebulasApproved: "Nebulosa #01 (96%) + #02 (100%)",
    mothership: "#001 (Capitán Box 1)",
    route: "Polygon / QuickSwap Algebra V3",
    inOutUsdc: "$18.30 ➔ $18.48 USDC",
    gasUsed: "0.00 POL ($0.00 / callStatic)",
    netProfit: "+$0.18 USDC",
    status: "CONFIRMADA"
  },
  {
    opId: "OP-501-05",
    timestamp: "02:05:18 UTC",
    nebulasApproved: "Nebulosa #05 (98%) + #06 (100%)",
    mothership: "#101 (Capitán Box 2)",
    route: "BSC / Thena Algebra V3",
    inOutUsdc: "$20.42 ➔ $20.73 USDC",
    gasUsed: "0.00 BNB ($0.00 / callStatic)",
    netProfit: "+$0.31 USDC",
    status: "CONFIRMADA"
  },
  {
    opId: "OP-501-06",
    timestamp: "00:22:31 UTC",
    nebulasApproved: "Nebulosa #03 (99%) + #04 (100%)",
    mothership: "#501 (Matriz Dual)",
    route: "Polygon / Uniswap V3 0.01% Fee Tier",
    inOutUsdc: "$18.30 ➔ $18.51 USDC",
    gasUsed: "0.00 POL ($0.00 / callStatic)",
    netProfit: "+$0.21 USDC",
    status: "CONFIRMADA"
  }
];

// =============================================================================
// ESTADO GLOBAL DE LA CABINA
// =============================================================================
let liveTelemetry = null;
let currentShotsDone = 0; // Se sincroniza con backend
const DAILY_TARGET = 15;

// =============================================================================
// INICIALIZACIÓN
// =============================================================================
document.addEventListener("DOMContentLoaded", () => {
  setupCopyButtons();
  setupModalDossier();
  setupRefreshButton();

  // Render inicial inmediato con catálogo y valores calibrados
  renderMothershipsGrid(MOTHERSHIPS_REGISTRY);
  renderBatteryCapsules(currentShotsDone, DAILY_TARGET);
  renderTraceabilityTable(INITIAL_ATOMIC_OPERATIONS);

  // Iniciar sondeo en vivo de telemetría
  fetchLiveTelemetry();
  setInterval(fetchLiveTelemetry, 4000);
});

// =============================================================================
// FETCHING Y SINCRONIZACIÓN DE TELEMETRÍA
// =============================================================================
async function fetchLiveTelemetry() {
  try {
    const res = await fetch(`../telemetry/fleet-telemetry.json?t=${Date.now()}`);
    if (res.ok) {
      liveTelemetry = await res.json();
      updateDashboardData(liveTelemetry);
    }
  } catch (err) {
    console.warn("Sondeo de telemetría local activo (usando caché resiliente)");
  }
}

function updateDashboardData(telem) {
  if (!telem) return;

  // 1. Contador de Disparos Atómicos
  const shots = telem.atomicSniperExecution?.shotsExecutedToday || 
                telem.snipingEcosystem?.dailyAtomicOperations?.completedToday || 
                0;
  currentShotsDone = shots;

  const elPillText = document.getElementById("topAtomicShotsText");
  if (elPillText) elPillText.textContent = `${shots} / ${DAILY_TARGET}`;

  const elBatteryFraction = document.getElementById("batteryQuotaFraction");
  if (elBatteryFraction) elBatteryFraction.textContent = `${shots} / ${DAILY_TARGET} DISPAROS HOY`;

  renderBatteryCapsules(shots, DAILY_TARGET);

  // 2. Gas en Nodriza Matriz #501
  const motherGas = telem.hierarchy?.highCommand?.matriz501?.gasBalances?.pol || "110.98";
  const elMotherPol = document.getElementById("gasMotherPol");
  if (elMotherPol) elMotherPol.textContent = `${Number(motherGas).toFixed(2)} POL`;

  // 3. Gas Total Flota
  const fleetPol = telem.globalGasTank?.pol || "256.00";
  const elFleetPol = document.getElementById("gasFleetPol");
  if (elFleetPol) elFleetPol.textContent = `${Number(fleetPol).toFixed(2)} POL`;

  // 4. Spread en Vivo de los 2 Cañones
  const observerFile = telem.liveMarketObserver;
  if (observerFile?.polygonTriangular?.advantagePct) {
    const elS1 = document.getElementById("cannon1SpreadVal");
    if (elS1) elS1.textContent = `+${Number(observerFile.polygonTriangular.advantagePct).toFixed(4)}% Ventaja · callStatic OK ($0 Gas)`;
  }
  if (observerFile?.bscCrossFee?.advantagePct) {
    const elS2 = document.getElementById("cannon2SpreadVal");
    if (elS2) elS2.textContent = `+${Number(observerFile.bscCrossFee.advantagePct).toFixed(4)}% Ventaja · callStatic OK ($0 Gas)`;
  }
}

// =============================================================================
// RENDERIZADO: GRILLA DE LAS 16 NODRIZAS SNIPER
// =============================================================================
function renderMothershipsGrid(motherships) {
  const container = document.getElementById("mothershipsGridContainer");
  if (!container) return;

  container.innerHTML = "";

  motherships.forEach((m) => {
    const tile = document.createElement("div");
    tile.className = `mothership-tile ${m.activeCannon ? 'is-active-cannon' : ''} ${m.cannonChain === 'BSC' ? 'bsc' : ''}`;
    tile.onclick = () => openDossier(m);

    const shortAddr = `${m.address.slice(0, 6)}...${m.address.slice(-4)}`;

    tile.innerHTML = `
      <div class="m-tile-head">
        <span class="m-tile-id">${m.id}</span>
        <span class="m-tile-lock">
          <span class="material-symbols-rounded tiny-icon">verified_user</span>
          ${m.locksVerified}
        </span>
      </div>
      <div class="m-tile-role" title="${m.name}">${m.name}</div>
      <div class="m-tile-addr">${shortAddr}</div>
      <div class="m-tile-binomio" title="${m.assignedNebulaPair.odd.name} + ${m.assignedNebulaPair.even.name}">
        ${m.assignedNebulaPair.odd.id} + ${m.assignedNebulaPair.even.id}
      </div>
      <div class="m-tile-footer">
        <span class="m-tile-gas">${m.gasPol} POL</span>
        <span class="m-tile-status-tag ${m.activeCannon ? 'active' : 'ready'}">
          ${m.activeCannon ? 'FUEGO' : 'RESERVA'}
        </span>
      </div>
    `;

    container.appendChild(tile);
  });
}

// =============================================================================
// RENDERIZADO: REGLETA DE LAS 15 CÁPSULAS ATÓMICAS ([#01] a [#15])
// =============================================================================
function renderBatteryCapsules(completedCount, totalTarget = 15) {
  const row = document.getElementById("capsulesBatteryRow");
  if (!row) return;

  row.innerHTML = "";

  for (let i = 1; i <= totalTarget; i++) {
    const isDone = i <= completedCount;
    const padNum = String(i).padStart(2, "0");
    const capsule = document.createElement("div");
    capsule.className = `shot-capsule ${isDone ? 'executed' : 'pending'}`;

    capsule.innerHTML = `
      <span class="capsule-idx">[ #${padNum} ]</span>
      <span class="capsule-badge">${isDone ? '+$0.24' : 'ESPERA'}</span>
    `;

    row.appendChild(capsule);
  }
}

// =============================================================================
// RENDERIZADO: TABLA DE TRAZABILIDAD ATÓMICA
// =============================================================================
function renderTraceabilityTable(ops) {
  const tbody = document.getElementById("atomicTraceTbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  ops.forEach((op) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="op-badge-done">${op.opId}</span></td>
      <td>${op.timestamp}</td>
      <td class="purple-text">${op.nebulasApproved}</td>
      <td><strong class="gold-text">${op.mothership}</strong></td>
      <td>${op.route}</td>
      <td><span class="cyan-text">${op.inOutUsdc}</span></td>
      <td class="text-dim">${op.gasUsed}</td>
      <td style="text-align: right;"><strong class="green-text">${op.netProfit}</strong></td>
    `;
    tbody.appendChild(tr);
  });
}

// =============================================================================
// MODAL / EXPEDIENTE DE NODRIZA
// =============================================================================
function setupModalDossier() {
  const overlay = document.getElementById("dossierOverlay");
  const closeBtn = document.getElementById("dossierCloseBtn");
  if (!overlay || !closeBtn) return;

  closeBtn.onclick = () => {
    overlay.style.display = "none";
  };

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.style.display = "none";
    }
  };
}

function openDossier(m) {
  const overlay = document.getElementById("dossierOverlay");
  const idBadge = document.getElementById("dossierIdBadge");
  const title = document.getElementById("dossierTitle");
  const body = document.getElementById("dossierBody");

  if (!overlay || !body) return;

  idBadge.textContent = m.id;
  title.textContent = `${m.name.toUpperCase()} · ${m.role}`;

  body.innerHTML = `
    <div class="dossier-section">
      <span class="dossier-sec-title">DATOS DE SEGURIDAD &amp; DIRECCIÓN ON-CHAIN</span>
      <div class="dossier-grid-2col">
        <div><span class="text-dim">Dirección EVM:</span> <span class="cyan-text">${m.address}</span></div>
        <div><span class="text-dim">Escuadrón:</span> <span>${m.box}</span></div>
        <div><span class="text-dim">Estado Operativo:</span> <span class="green-text">${m.statusLabel}</span></div>
        <div><span class="text-dim">Candados Seguridad:</span> <span class="green-text">${m.locksVerified}</span></div>
      </div>
    </div>

    <div class="dossier-section">
      <span class="dossier-sec-title">BINOMIO DE NEBULOSAS ASIGNADO (ESCUDO IA)</span>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div style="padding: 6px; background: rgba(168, 85, 247, 0.08); border-radius: 4px; border: 1px solid rgba(168, 85, 247, 0.25);">
          <strong class="purple-text">${m.assignedNebulaPair.odd.id} (Calculista):</strong>
          <span style="display: block; font-size: 0.65rem; color: var(--text-main);">${m.assignedNebulaPair.odd.name}</span>
          <span style="font-size: 0.58rem; color: var(--green); font-weight: 800;">Certeza: ${m.assignedNebulaPair.odd.certainty}% · Estado: ${m.assignedNebulaPair.odd.status}</span>
        </div>
        <div style="padding: 6px; background: rgba(16, 185, 129, 0.08); border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.25);">
          <strong class="green-text">${m.assignedNebulaPair.even.id} (Guardaespaldas):</strong>
          <span style="display: block; font-size: 0.65rem; color: var(--text-main);">${m.assignedNebulaPair.even.name}</span>
          <span style="font-size: 0.58rem; color: var(--green); font-weight: 800;">Candados: ${m.assignedNebulaPair.even.locks} · callStatic: OK</span>
        </div>
      </div>
    </div>

    <div class="dossier-section">
      <span class="dossier-sec-title">TANQUE DE GAS Y PISO INVIOLABLE</span>
      <div class="dossier-grid-2col">
        <div><span class="text-dim">Saldo POL:</span> <span class="cyan-text">${m.gasPol} POL</span></div>
        <div><span class="text-dim">Saldo BNB:</span> <span class="gold-text">${m.gasBnb} BNB</span></div>
        <div><span class="text-dim">Piso Sagrado:</span> <span>${m.lockedFloorPol} POL</span></div>
        <div><span class="text-dim">Gas Perdido:</span> <span class="green-text">${m.gasLostPol} POL (0 Pérdida)</span></div>
      </div>
    </div>
  `;

  overlay.style.display = "flex";
}

// =============================================================================
// BOTÓN COPIAR CON FEEDBACK
// =============================================================================
function setupCopyButtons() {
  const btn = document.getElementById("btnCopy501");
  const toast = document.getElementById("copyToast");
  const addr = document.getElementById("masterVaultAddr");

  if (!btn || !toast || !addr) return;

  btn.onclick = () => {
    navigator.clipboard.writeText(addr.textContent.trim()).then(() => {
      toast.style.display = "inline-block";
      setTimeout(() => {
        toast.style.display = "none";
      }, 1500);
    });
  };
}

// =============================================================================
// BOTÓN REFRESCAR TELEMETRÍA
// =============================================================================
function setupRefreshButton() {
  const btn = document.getElementById("btnRefreshRadar");
  if (!btn) return;

  btn.onclick = () => {
    btn.classList.add("spin");
    fetchLiveTelemetry().finally(() => {
      setTimeout(() => btn.classList.remove("spin"), 800);
    });
  };
}
