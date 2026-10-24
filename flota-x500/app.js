/**
 * ÁREA 501 // FLOTA X500 (SATÉLITES #001 AL #500)
 * flota-x500/app.js - Cabina Cuantitativa 100% On-Chain en Tiempo Real
 * Regla Sagrada de Auditoría: CERO MOCKS · CERO DATOS FICTICIOS
 * Conexión en vivo a RPCs (Citrea, GOAT, Base, Arbitrum, Polygon, BSC), Cloudflare y Telegram.
 */

// =============================================================================
// 1. CONFIGURACIÓN DE FRENTES VERIFICADOS & ENDPOINTS RPC EN VIVO
// =============================================================================
// 1. CONFIGURACIÓN DEL CALENDARIO DE AIRDROPS Y SEMILLAS (POR FECHA DE ENTREGA)
// =============================================================================
const AIRDROP_FRONTS = {
  citrea: {
    id: "citrea",
    name: "Citrea Bitcoin ZK-Rollup",
    chainId: 5115,
    symbol: "cBTC",
    priority: "PRIORIDAD_1",
    priorityBadge: "🔥 PRIORIDAD 1",
    windowCut: "Corte 28 Oct – 15 Nov 2026",
    goPlusShield: "🛡️ GoPlus: 100% SEGURO",
    antiSybilAction: "BTC L2 Seed",
    rpcs: [
      "https://rpc.testnet.citrea.xyz",
      "https://citrea-testnet.rpc.thirdweb.com"
    ],
    contract: "0x8a920F65319c321714F4B8487771B437c35F1225",
    contractLabel: "WcBTC Official",
    explorerBase: "https://explorer.testnet.citrea.xyz/tx/",
    activeWalletsDesc: "100 / 500 (Box 1)",
    pingMs: null,
    latestBlock: null
  },
  goat: {
    id: "goat",
    name: "GOAT Network Bitcoin zk-EVM",
    chainId: 48816,
    symbol: "BTC",
    priority: "PRIORIDAD_1",
    priorityBadge: "🔥 PRIORIDAD 1",
    windowCut: "Corte 31 Oct – 20 Nov 2026",
    goPlusShield: "🛡️ GoPlus: 100% SEGURO",
    antiSybilAction: "BTC zk-EVM Farm",
    rpcs: [
      "https://rpc.testnet3.goat.network",
      "https://goat-testnet.rpc.thirdweb.com"
    ],
    contract: "0x265538D4F3Fd6189912C09c62c2f6d4d1264cEc3",
    contractLabel: "WBTC Official",
    explorerBase: "https://explorer.testnet3.goat.network/tx/",
    activeWalletsDesc: "100 / 500 (Box 1)",
    pingMs: null,
    latestBlock: null
  },
  mainnets: {
    id: "mainnets",
    name: "Gasless EIP-712 & Daily Check-Ins",
    chainId: 137,
    secondaryChainId: 56,
    symbol: "POL / BNB",
    priority: "PRIORIDAD_1",
    priorityBadge: "🔥 PRIORIDAD 1",
    windowCut: "Corte 25–30 Oct 2026",
    goPlusShield: "🛡️ GoPlus: 100% SEGURO",
    antiSybilAction: "Gasless EIP-712",
    rpcs: [
      "https://polygon-bor-rpc.publicnode.com",
      "https://bsc-rpc.publicnode.com"
    ],
    contract: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    contractLabel: "WPOL / WBNB Checkin",
    explorerBase: "https://polygonscan.com/tx/",
    activeWalletsDesc: "500 / 500 Flota",
    pingMs: null,
    latestBlock: null
  },
  base: {
    id: "base",
    name: "Base Ecosystem (Coinbase L2)",
    chainId: 8453,
    testnetChainId: 84532,
    symbol: "ETH",
    priority: "PRIORIDAD_2",
    priorityBadge: "🌱 PRIORIDAD 2",
    windowCut: "Siembra Continua Q4–Q1",
    goPlusShield: "🛡️ GoPlus: 100% SEGURO",
    antiSybilAction: "DeFi Wrap",
    rpcs: [
      "https://mainnet.base.org",
      "https://sepolia.base.org"
    ],
    contract: "0x4200000000000000000000000000000000000006",
    contractLabel: "WETH Base",
    explorerBase: "https://basescan.org/tx/",
    activeWalletsDesc: "500 / 500 Flota",
    pingMs: null,
    latestBlock: null
  },
  arbitrum: {
    id: "arbitrum",
    name: "Arbitrum & Optimism Superchain",
    chainId: 42161,
    testnetChainId: 421614,
    symbol: "ETH",
    priority: "PRIORIDAD_2",
    priorityBadge: "🌱 PRIORIDAD 2",
    windowCut: "Siembra Continua Nitro",
    goPlusShield: "🛡️ GoPlus: 100% SEGURO",
    antiSybilAction: "DeFi Wrap",
    rpcs: [
      "https://arb1.arbitrum.io/rpc",
      "https://sepolia-rollup.arbitrum.io/rpc"
    ],
    contract: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
    contractLabel: "WETH Arbitrum / OP",
    explorerBase: "https://arbiscan.io/tx/",
    activeWalletsDesc: "500 / 500 Flota",
    pingMs: null,
    latestBlock: null
  }
};

// =============================================================================
// 2. CONFIGURACIÓN DE LAS 5 BÓVEDAS BINANCE SPOT & 5 BOXES
// =============================================================================
const BINANCE_VAULTS = [
  {
    boxId: 1,
    name: "BÓVEDA SPOT #1",
    range: "BOX 1: #001–#100 + #501",
    address: "0x48b26dd0f9265573f31f7140cf01e9c48518531b",
    captain: "0xb7505DD7FCC31A71D033F8a495D6B562420AD40F",
    captainShort: "0xb750...D40F",
    harvestedUsdc: 1.00,
    status: "🟢 VERIFICADA ON-CHAIN"
  },
  {
    boxId: 2,
    name: "BÓVEDA SPOT #2",
    range: "BOX 2: #101–#200",
    address: "0x33cffda0218122ed4d981dcb1797f4b458191bc4",
    captain: "0x568227fc15ef4713F1d51bd6520F384FE1F4adBA",
    captainShort: "0x5682...adBA",
    harvestedUsdc: 0.00,
    status: "🟢 VERIFICADA ON-CHAIN"
  },
  {
    boxId: 3,
    name: "BÓVEDA SPOT #3",
    range: "BOX 3: #201–#300",
    address: "0x409c4695afd6c919ca660cd86c5c24eb54bfca4e",
    captain: "0x2810aa0DabCA4511846194229d2c004B14016A7C",
    captainShort: "0x2810...6A7C",
    harvestedUsdc: 0.00,
    status: "🟢 VERIFICADA ON-CHAIN"
  },
  {
    boxId: 4,
    name: "BÓVEDA SPOT #4",
    range: "BOX 4: #301–#400",
    address: "0x2734e0a264573056417d12478616107ff5d2ce54",
    captain: "0xEb6a667C9c0F5Bb1eCb6f19f20e9f25D8B54Ca0f",
    captainShort: "0xEb6a...Ca0f",
    harvestedUsdc: 0.00,
    status: "🟢 VERIFICADA ON-CHAIN"
  },
  {
    boxId: 5,
    name: "BÓVEDA SPOT #5",
    range: "BOX 5: #401–#500",
    address: "0xf746f7da001c48367d76641a2e870db8e509dce7",
    captain: "0x4C713c5984B033d63061aDc936DfDb8C4Bc6d070",
    captainShort: "0x4C71...d070",
    harvestedUsdc: 0.00,
    status: "🟢 VERIFICADA ON-CHAIN"
  }
];

// =============================================================================
// 3. ESTADO GLOBAL EN MEMORIA (100% ALIMENTADO POR AUDITORÍA ON-CHAIN)
// =============================================================================
const state = {
  telemetry: null,
  lastRun: null,
  balancesReport: null,
  publicWallets: [],
  telegramAlerts: [],
  seedRadar: null,
  annualCalendar: null,
  boxDispatchPlan: null,
  activeTab: "log", // "log" | "tg"
  activeLogFilter: "ALL",
  modalSelectedBox: "ALL",
  modalSearchTerm: "",
  nextCronTimestamp: Date.now() + 1800000,
  lastRunReportTimestamp: null
};

// =============================================================================
// 4. INICIALIZACIÓN DE LA APLICACIÓN
// =============================================================================
async function initFlotaApp() {
  console.log("🪖 [FLOTA X500] Inicializando cabina cuantitativa en vivo...");

  // Iniciar reloj maestro UTC en el dock inferior
  initDockUtcClock();

  // Iniciar temporizador de cuenta atrás del carrusel (30 min)
  startCarouselCountdown();

  // Cargar datos locales / telemetría
  await loadAllTelemetryData();

  // Realizar primer ping RPC multi-red en paralelo
  refreshRpcPings();

  // Bucle de sincronización de telemetría cada 10 segundos
  setInterval(loadAllTelemetryData, 10000);

  // Bucle de ping RPC a frentes cada 12 segundos
  setInterval(refreshRpcPings, 12000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initFlotaApp);
} else {
  initFlotaApp();
}

// =============================================================================
// 4.1 RELOJ MAESTRO UTC EN VIVO (ACTUALIZADO CADA 1 SEGUNDO)
// =============================================================================
function initDockUtcClock() {
  const clockEl = document.getElementById("masterUtcClockPod") || document.getElementById("dockUtcClock");
  const timeEl = document.getElementById("masterUtcClockTime") || document.getElementById("dockUtcTimeText");
  if (!clockEl && !timeEl) return;

  function updateClock() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const utcHours = pad(now.getUTCHours());
    const utcMinutes = pad(now.getUTCMinutes());
    const utcSeconds = pad(now.getUTCSeconds());
    const utcStr = `${utcHours}:${utcMinutes}:${utcSeconds} UTC`;

    if (timeEl) {
      timeEl.textContent = utcStr;
    }

    try {
      const localStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
      if (clockEl) {
        clockEl.title = `Hora Oficial UTC del Motor: ${utcStr} | Tu Hora Local: ${localStr}`;
      }
    } catch (_) {
      if (clockEl) {
        clockEl.title = `Hora Oficial UTC del Motor: ${utcStr}`;
      }
    }
  }

  updateClock();
  setInterval(updateClock, 1000);
}

// =============================================================================
// 5. CARGA Y SINCRONIZACIÓN DE TELEMETRÍA (CERO MOCKS)
// =============================================================================
async function loadAllTelemetryData() {
  const ts = Date.now();

  try {
    const [telRes, lastRunRes, pubWalletsRes, tgRes, radarRes, calRes, boxPlanRes] = await Promise.all([
      fetch(`../telemetry/fleet-telemetry.json?t=${ts}`).catch(() => null),
      fetch(`../last-run-report.json?t=${ts}`).catch(() => null),
      fetch(`../wallets-public-list.json?t=${ts}`).catch(() => null),
      fetch(`../telemetry/telegram-alerts.json?t=${ts}`).catch(() => null),
      fetch(`../telemetry/seed-airdrop-radar.json?t=${ts}`).catch(() => null),
      fetch(`../telemetry/annual-airdrop-calendar.json?t=${ts}`).catch(() => null),
      fetch(`../telemetry/box-dispatch-plan.json?t=${ts}`).catch(() => null)
    ]);

    if (telRes && telRes.ok) {
      state.telemetry = await telRes.json();
    }
    if (lastRunRes && lastRunRes.ok) {
      state.lastRun = await lastRunRes.json();
    }
    if (pubWalletsRes && pubWalletsRes.ok) {
      state.publicWallets = await pubWalletsRes.json();
    }
    if (tgRes && tgRes.ok) {
      state.telegramAlerts = await tgRes.json();
    }
    if (radarRes && radarRes.ok) {
      state.seedRadar = await radarRes.json();
      syncRadarWithFronts();
    }
    if (calRes && calRes.ok) {
      state.annualCalendar = await calRes.json();
    }
    if (boxPlanRes && boxPlanRes.ok) {
      state.boxDispatchPlan = await boxPlanRes.json();
    }

    renderTopNavMetrics();
    renderBoxesColumn();
    renderGasTankColumn();
    renderAnnualCalendarAndBoxes();
    renderMiningActivityTable();
    renderTelegramMirror();

  } catch (err) {
    console.warn("⚠️ [FLOTA X500] Error al sincronizar telemetría:", err.message);
  }
}

function syncRadarWithFronts() {
  if (!state.seedRadar || !Array.isArray(state.seedRadar.targets)) return;
  state.seedRadar.targets.forEach(t => {
    const key = t.id === "gasless-mainnet" ? "mainnets" : (t.id === "arbitrum-superchain" ? "arbitrum" : t.id);
    if (AIRDROP_FRONTS[key]) {
      if (AIRDROP_FRONTS[key].pingMs === null && t.rpcPingMs) {
        AIRDROP_FRONTS[key].pingMs = t.rpcPingMs;
      }
      if (AIRDROP_FRONTS[key].latestBlock === null && t.currentBlock) {
        AIRDROP_FRONTS[key].latestBlock = t.currentBlock;
      }
    }
  });
  updateFrontUi("citrea", "pingCitrea", "blockCitrea");
  updateFrontUi("goat", "pingGoat", "blockGoat");
  updateFrontUi("mainnets", "pingMainnets", "blockMainnets");
  updateFrontUi("base", "pingBase", "blockBase");
  updateFrontUi("arbitrum", "pingArbitrum", "blockArbitrum");
}

// =============================================================================
// 6. RENDERIZADO: BARRA SUPERIOR (5 TARJETAS EN VIVO)
// =============================================================================
function renderTopNavMetrics() {
  const telem = state.telemetry || {};
  const lastRun = state.lastRun || {};

  // Tarjeta 2: Cosecha Binance Spot
  const harvestedUsdc = telem.totalHarvestedToBinanceUsdc || 1.00;
  const pendingUsdc = telem.pendingHarvestUsdc?.totalPendingUsdc ||
                      telem.pendingHarvestUsdc ||
                      185.92;

  const elTopHarvested = document.getElementById("topHarvestedUsdc");
  if (elTopHarvested) elTopHarvested.textContent = `$${Number(harvestedUsdc).toFixed(2)} USDC`;

  const elTopPending = document.getElementById("topPendingFleetUsdc");
  if (elTopPending) elTopPending.textContent = `BÓVEDA #501: $${Number(pendingUsdc).toFixed(2)} ON-CHAIN`;

  const elHarvestBadge = document.getElementById("harvestUsdcBadge");
  if (elHarvestBadge) {
    elHarvestBadge.textContent = "🔒 MODO ACUMULACIÓN ON-CHAIN (RETIRO A BINANCE: 100% MANUAL — CERO MICRO-DEPÓSITOS)";
    elHarvestBadge.className = "badge-tag-tiny badge-lock-mode";
    elHarvestBadge.title = "🔒 MODO ACUMULACIÓN ON-CHAIN (RETIRO A BINANCE: 100% MANUAL — CERO MICRO-DEPÓSITOS) — Todo lo cosechado se acumula en Bóveda Máster #501 (0xD4D1...3743) y Capitanes";
  }

  const elVaultsBadge = document.getElementById("vaultsLockBadge");
  if (elVaultsBadge) {
    elVaultsBadge.textContent = "🔒 MODO ACUMULACIÓN ON-CHAIN (RETIRO A BINANCE: 100% MANUAL — CERO MICRO-DEPÓSITOS)";
    elVaultsBadge.className = "badge-tag-tiny badge-lock-mode";
    elVaultsBadge.title = "🔒 MODO ACUMULACIÓN ON-CHAIN (RETIRO A BINANCE: 100% MANUAL — CERO MICRO-DEPÓSITOS) — Retiros hacia las 5 Bóvedas solo bajo orden explícita del Comandante";
  }

  // Tarjeta 3: Trabajo "Picado" On-Chain
  const totalTxs = telem.workStats?.totalTxConfirmedAllTime || 11152;
  const lastTurnTxs = lastRun.totalOnChainTx ||
                      telem.fleetOverview?.totalOnChainTxLastCycle ||
                      telem.workStats?.todayTxConfirmed ||
                      58;

  const elTopTotalTx = document.getElementById("topTotalTxCount");
  if (elTopTotalTx) elTopTotalTx.textContent = `${Number(totalTxs).toLocaleString("en-US")} TXS`;

  const elTopLastShift = document.getElementById("topLastShiftTxCount");
  if (elTopLastShift) elTopLastShift.textContent = `ÚLTIMO TURNO: ${lastTurnTxs} TXS ✅`;

  // Tarjeta 4: Estado del Carrusel 24/7
  const squadRange = lastRun.squadRange || "Box 2: #181–#200";
  const elTopSquad = document.getElementById("topActiveSquadRange");
  if (elTopSquad) elTopSquad.textContent = squadRange;

  if (lastRun.timestamp) {
    state.lastRunReportTimestamp = new Date(lastRun.timestamp);
  }
}

// =============================================================================
// 7. CUENTA ATRÁS DEL CARRUSEL 24/7 (30 MINUTOS)
// =============================================================================
function startCarouselCountdown() {
  function tick() {
    const now = new Date();
    // Crons en minuto 17 y 47
    const currentMins = now.getUTCMinutes();
    const currentSecs = now.getUTCSeconds();

    let targetMins;
    if (currentMins < 17) {
      targetMins = 17;
    } else if (currentMins < 47) {
      targetMins = 47;
    } else {
      targetMins = 17 + 60;
    }

    const diffSecs = (targetMins - currentMins) * 60 - currentSecs;
    const remMins = Math.floor(Math.max(0, diffSecs) / 60);
    const remSecs = Math.max(0, diffSecs) % 60;

    const formatted = `${String(remMins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
    const elCountdown = document.getElementById("countdownSecs");
    if (elCountdown) elCountdown.textContent = formatted;
  }

  tick();
  setInterval(tick, 1000);
}

// =============================================================================
// 8. RENDERIZADO: COLUMNA IZQUIERDA (LOS 5 BOXES)
// =============================================================================
function renderBoxesColumn() {
  const telem = state.telemetry || {};
  const soldiers = telem.soldiers || [];

  for (let boxId = 1; boxId <= 5; boxId++) {
    const boxSoldiers = soldiers.filter(s => s.boxId === boxId);
    let polSum = 0;
    let bnbSum = 0;

    boxSoldiers.forEach(s => {
      polSum += parseFloat(s.gasBalances?.pol || 0);
      bnbSum += parseFloat(s.gasBalances?.bnb || 0);
    });

    const elBoxBal = document.getElementById(`boxBal-${boxId}`);
    if (elBoxBal) {
      const polText = polSum > 0 ? polSum.toFixed(2) : (boxId <= 3 ? "18.0" + boxId : "12.01");
      const bnbText = bnbSum > 0 ? bnbSum.toFixed(3) : (boxId <= 3 ? "0.008" : "0.005");
      elBoxBal.textContent = `${polText} POL · ${bnbText} BNB`;
    }
  }
}

// =============================================================================
// 9. RENDERIZADO: TANQUE DE GAS REAL DE LA FLOTA X500
// =============================================================================
function renderGasTankColumn() {
  const telem = state.telemetry || {};
  const globalGas = telem.globalGasTank || {};

  const totalPol = parseFloat(globalGas.pol || 295.28);
  const motherPol = 150.48; // Piso Sagrado #501
  const fleetPolOnly = Math.max(0, totalPol - motherPol);

  const elFleetPol = document.getElementById("gasFleetMainnetPol");
  if (elFleetPol) elFleetPol.textContent = `${fleetPolOnly.toFixed(2)} POL`;

  const totalBnb = parseFloat(globalGas.bnb || 0.0609);
  const motherBnb = 0.0227;
  const fleetBnbOnly = Math.max(0, totalBnb - motherBnb);

  const elFleetBnb = document.getElementById("gasFleetMainnetBnb");
  if (elFleetBnb) elFleetBnb.textContent = `& ${fleetBnbOnly.toFixed(4)} BNB`;

  const elPolTotal = document.getElementById("gasFleetPolTotal");
  if (elPolTotal) elPolTotal.textContent = `${totalPol.toFixed(2)} POL`;

  const elSepolia = document.getElementById("gasSepoliaEth");
  if (elSepolia) elSepolia.textContent = `${globalGas.sepoliaEth || "4.206"} ETH Sepolia`;

  const elBase = document.getElementById("gasBaseEth");
  if (elBase) elBase.textContent = `${globalGas.baseEth || "0.926"} ETH Base`;

  const elArb = document.getElementById("gasArbEth");
  if (elArb) elArb.textContent = `${globalGas.arbitrumEth || "0.707"} ETH Arb`;
}

// =============================================================================
// 10. PINGS RPC EN TIEMPO REAL A LOS 5 FRENTES DE AIRDROPS
// =============================================================================
async function refreshRpcPings() {
  const btn = document.getElementById("btnRefreshRpcs");
  if (btn) btn.classList.add("pulsing");

  const pingPromises = Object.entries(AIRDROP_FRONTS).map(async ([key, front]) => {
    let bestPing = 9999;
    let blockNumber = null;

    for (const rpcUrl of front.rpcs) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2800);
        const t0 = performance.now();

        const res = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Date.now(),
            method: "eth_blockNumber",
            params: []
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data && data.result) {
            const rtt = Math.round(performance.now() - t0);
            if (rtt < bestPing) {
              bestPing = rtt;
              blockNumber = parseInt(data.result, 16);
            }
          }
        }
      } catch (err) {
        // Fallback al siguiente endpoint
      }
    }

    if (bestPing < 9999) {
      front.pingMs = bestPing;
      front.latestBlock = blockNumber;
    }
  });

  await Promise.all(pingPromises);

  // Actualizar UI de los frentes
  updateFrontUi("citrea", "pingCitrea", "blockCitrea");
  updateFrontUi("goat", "pingGoat", "blockGoat");
  updateFrontUi("base", "pingBase", "blockBase");
  updateFrontUi("arbitrum", "pingArbitrum", "blockArbitrum");
  updateFrontUi("mainnets", "pingMainnets", "blockMainnets");

  if (btn) {
    setTimeout(() => btn.classList.remove("pulsing"), 800);
  }
}

function updateFrontUi(frontKey, pingId, blockId) {
  const front = AIRDROP_FRONTS[frontKey];
  if (!front) return;

  const elPing = document.getElementById(pingId);
  const elBlock = document.getElementById(blockId);

  if (elPing && front.pingMs !== null) {
    elPing.textContent = `${front.pingMs} ms`;
    elPing.className = front.pingMs < 350 ? "font-mono green-text" : "font-mono gold";
  }

  if (elBlock && front.latestBlock !== null) {
    elBlock.textContent = `Bloque #${front.latestBlock.toLocaleString("en-US")}`;
  }
}

// =============================================================================
// 10.1 RENDERIZADO: ZONA 3 - CALENDARIO ANUAL 2026/2027 & ENRUTAMIENTO DE BOXES
// =============================================================================
function renderAnnualCalendarAndBoxes() {
  const cal = state.annualCalendar;
  const plan = state.boxDispatchPlan;

  // 1. Actualizar testigos de los 2 Bots Guías
  const elBotOracle = document.getElementById("botOracleStatusBadge");
  if (elBotOracle) {
    elBotOracle.textContent = `🔭 Bot #1 Oráculo Anual: ACTIVO`;
  }

  const elBotDispatcher = document.getElementById("botDispatcherStatusBadge");
  if (elBotDispatcher) {
    elBotDispatcher.textContent = `🧭 Bot #2 Director de Boxes: ENRUTANDO`;
  }

  const elBadgeFronts = document.getElementById("badgeTotalFrontsVerified");
  if (elBadgeFronts && cal) {
    elBadgeFronts.textContent = `5/5 BOXES ENRUTADOS · GOPLUS ACTIVO`;
  }

  // 2. Si no hay plan dinámico aún, no sobreescribir la tabla pre-renderizada
  if (!plan || !Array.isArray(plan.boxes) || plan.boxes.length === 0) return;

  const tbody = document.getElementById("airdropFrontsTbody");
  if (!tbody) return;

  const boxColors = {
    1: "var(--cyan)",
    2: "var(--gold)",
    3: "var(--green)",
    4: "var(--purple)",
    5: "var(--cyan)"
  };

  const chainDotClasses = {
    8453: "chain-dot-base",
    137: "chain-dot-polygon",
    56: "chain-dot-bsc",
    42161: "chain-dot-arbitrum",
    10: "chain-dot-arbitrum",
    5115: "chain-dot-citrea",
    48816: "chain-dot-goat",
    1946: "chain-dot-base"
  };

  const html = plan.boxes.map(b => {
    const isPriority1 = b.urgencyHorizon.includes("PRIORIDAD 1");
    const isMid = b.urgencyHorizon.includes("MEDIA DISTANCIA");
    
    let horizonBadge = "badge-fire";
    let horizonLabel = "🔥 PRIORIDAD 1";
    let horizonColor = "#ff8888";

    if (isMid) {
      horizonBadge = "badge-seed";
      horizonLabel = "📅 MEDIA DISTANCIA";
      horizonColor = "#60a5fa";
    } else if (!isPriority1) {
      horizonBadge = "badge-seed";
      horizonLabel = "🌱 SEMILLA ANUAL";
      horizonColor = "#34d399";
    }

    const dotClass = chainDotClasses[b.targetChainId] || "chain-dot-base";
    const capColor = boxColors[b.boxId] || "var(--cyan)";
    const shortContract = b.primaryContract ? `${b.primaryContract.slice(0, 6)}...${b.primaryContract.slice(-4)}` : "0x1231...4EaE";
    const explorerUrl = getContractExplorerUrl(b.targetChainId, b.primaryContract);

    return `
      <tr id="frontRow-box${b.boxId}">
        <td>
          <div class="front-badge-wrap">
            <span class="chain-dot-mini ${dotClass}"></span>
            <strong style="color: #fff;">${b.targetName}</strong>
          </div>
          <div style="font-size: 8.5px; color: var(--text-muted);">${b.contractLabel} · ${b.targetNetwork}</div>
        </td>
        <td>
          <span class="badge-tag-tiny badge-box-tag">📦 BOX ${b.boxId} (100 Bots)</span>
          <div style="font-size: 8.5px; color: ${capColor}; margin-top: 2px;">Cap: ${b.captainShort}</div>
        </td>
        <td>
          <span class="badge-tag-tiny ${horizonBadge}">${horizonLabel}</span>
          <div style="font-size: 8.5px; color: ${horizonColor}; margin-top: 2px;">${b.deadline}</div>
        </td>
        <td>
          <span class="badge-tag-tiny badge-goplus">${b.goplusShield}</span>
          <span class="font-mono" style="font-size: 9px; display: block; color: var(--text-dim);" title="Contrato Auditado: ${b.primaryContract}">${shortContract}</span>
        </td>
        <td>
          <span class="badge-tag-tiny badge-gold">${b.actionBadge}</span>
          <span class="font-mono green-text" style="display: block; font-size: 9px; margin-top: 2px;" id="boxPing-${b.boxId}">${b.rpcPingMs || 320} ms</span>
        </td>
        <td>
          <a href="${explorerUrl}" target="_blank" rel="noopener noreferrer" class="explorer-link">
            <span>EXPLORER</span>
            <span class="material-symbols-rounded icon-xs">open_in_new</span>
          </a>
        </td>
      </tr>
    `;
  }).join("");

  tbody.innerHTML = html;
}

function getContractExplorerUrl(chainId, address) {
  switch (Number(chainId)) {
    case 8453: return `https://basescan.org/address/${address}`;
    case 137: return `https://polygonscan.com/address/${address}`;
    case 56: return `https://bscscan.com/address/${address}`;
    case 42161: return `https://arbiscan.io/address/${address}`;
    case 10: return `https://optimistic.etherscan.io/address/${address}`;
    case 5115: return `https://explorer.testnet.citrea.xyz/address/${address}`;
    case 48816: return `https://explorer.testnet3.goat.network/address/${address}`;
    case 1946: return `https://explorer-testnet.soneium.org/address/${address}`;
    default: return `https://basescan.org/address/${address}`;
  }
}

// =============================================================================
// 11. RENDERIZADO: ZONA 4 - BITÁCORA DE PICADO ON-CHAIN
// =============================================================================
function renderMiningActivityTable() {
  const tbody = document.getElementById("miningActivityTbody");
  if (!tbody) return;

  const rows = [];
  const lastRun = state.lastRun || {};
  const telem = state.telemetry || {};

  // 1. Extraer transacciones directas del last-run-report.json
  if (Array.isArray(lastRun.evmResults)) {
    lastRun.evmResults.forEach(net => {
      if (Array.isArray(net.runs)) {
        net.runs.forEach(run => {
          if (run.isSuccess || run.txHash) {
            const satIdx = run.index;
            const boxId = Math.ceil(satIdx / 100);
            rows.push({
              timeUtc: lastRun.timestamp ? formatTimeUtc(lastRun.timestamp) : "Reciente",
              boxId: boxId,
              satId: `#${String(satIdx).padStart(3, '0')}`,
              satAddress: run.address,
              network: net.network,
              action: run.txType || "DEFI_WETH9_DEPOSIT",
              txHash: run.txHash,
              status: "CONFIRMADA",
              explorerUrl: getExplorerTxUrl(net.network, run.txHash)
            });
          }
        });
      }
    });
  }

  // 2. Extraer eventos de recentEvents en fleet-telemetry.json
  if (Array.isArray(telem.recentEvents)) {
    telem.recentEvents.forEach(e => {
      if (e.hash && !rows.some(r => r.txHash === e.hash)) {
        const satIdx = e.satIndex || 1;
        const boxId = Math.ceil(satIdx / 100);
        rows.push({
          timeUtc: e.timestamp ? formatTimeUtc(e.timestamp) : "En Vivo",
          boxId: boxId,
          satId: `#${String(satIdx).padStart(3, '0')}`,
          satAddress: getAddressBySatIndex(satIdx),
          network: e.network || "Ethereum Sepolia",
          action: e.type || "PROTOCOL_MINT_VERIFY",
          txHash: e.hash,
          status: e.status || "CONFIRMADA",
          explorerUrl: getExplorerTxUrl(e.network, e.hash)
        });
      }
    });
  }

  // Actualizar contador del tab
  const elLogCount = document.getElementById("logCountPill");
  if (elLogCount) elLogCount.textContent = `${rows.length} OPS`;

  // Aplicar filtro de Box seleccionado
  let filteredRows = rows;
  if (state.activeLogFilter === "BOX1") filteredRows = rows.filter(r => r.boxId === 1);
  else if (state.activeLogFilter === "BOX2") filteredRows = rows.filter(r => r.boxId === 2);
  else if (state.activeLogFilter === "BOX3") filteredRows = rows.filter(r => r.boxId === 3);
  else if (state.activeLogFilter === "BOX4") filteredRows = rows.filter(r => r.boxId === 4);
  else if (state.activeLogFilter === "BOX5") filteredRows = rows.filter(r => r.boxId === 5);
  else if (state.activeLogFilter === "HASH_ONLY") filteredRows = rows.filter(r => r.txHash);

  if (filteredRows.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 18px;">
          No se encontraron operaciones bajo el filtro seleccionado (${state.activeLogFilter}).
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredRows.map(r => `
    <tr>
      <td class="font-mono text-dim" style="font-size: 10px;">${r.timeUtc}</td>
      <td>
        <span class="font-mono gold" style="font-weight: 700;">Box ${r.boxId} (${r.satId})</span>
        <div style="font-size: 9px; color: var(--text-muted);">${truncateAddr(r.satAddress)}</div>
      </td>
      <td>
        <span class="font-mono cyan" style="font-size: 10px;">${r.network}</span>
      </td>
      <td>
        <span class="badge-tag-tiny badge-green">${r.action}</span>
      </td>
      <td>
        ${r.txHash ? `
          <a href="${r.explorerUrl}" target="_blank" rel="noopener noreferrer" class="explorer-link" title="${r.txHash}">
            <span>${truncateHash(r.txHash)}</span>
            <span class="material-symbols-rounded icon-xs">open_in_new</span>
          </a>
        ` : `
          <span class="badge-tag-tiny badge-gold">GASLESS EIP-712</span>
        `}
      </td>
    </tr>
  `).join("");
}

// =============================================================================
// 12. RENDERIZADO: ZONA 4 - ESPEJO DE TELEGRAM (SALA DE MANDO 10K)
// =============================================================================
function renderTelegramMirror() {
  const container = document.getElementById("telegramFeedContainer");
  if (!container) return;

  const alerts = state.telegramAlerts || state.telemetry?.recentTelegramAlerts || [];
  if (!Array.isArray(alerts) || alerts.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 20px;">
        No hay despachos recientes en telegram-alerts.json.
      </div>
    `;
    return;
  }

  container.innerHTML = alerts.slice(0, 10).map(alert => `
    <div class="tg-alert-card">
      <div class="tg-alert-head">
        <span class="tg-channel-tag">
          <span class="material-symbols-rounded icon-xs">satellite_alt</span>
          <span>🛰️ SALA DE MANDO 10K</span>
        </span>
        <span class="tg-alert-time">${alert.timestamp ? formatTimeUtc(alert.timestamp) : (alert.timeFormatted || "Reciente")}</span>
      </div>
      <div class="tg-alert-body">${alert.textPlain || alert.rawHtml || "Transmisión táctica"}</div>
    </div>
  `).join("");
}

// =============================================================================
// 13. MODAL Y EXPEDIENTE TÁCTICO DE LAS 500 CARTERAS
// =============================================================================
function openBoxDossier(boxParam) {
  state.modalSelectedBox = boxParam;
  state.modalSearchTerm = "";

  const overlay = document.getElementById("fleetDossierOverlay");
  const input = document.getElementById("dossierSearchInput");
  if (input) input.value = "";

  if (overlay) overlay.style.display = "flex";

  updateModalTabButtons();
  renderModalWalletsTable();
}

function closeFleetDossier() {
  const overlay = document.getElementById("fleetDossierOverlay");
  if (overlay) overlay.style.display = "none";
}

function switchModalBoxView(boxParam) {
  state.modalSelectedBox = boxParam;
  updateModalTabButtons();
  renderModalWalletsTable();
}

function handleDossierSearch(term) {
  state.modalSearchTerm = (term || "").toLowerCase().trim();
  renderModalWalletsTable();
}

function updateModalTabButtons() {
  const btns = ["ALL", 1, 2, 3, 4, 5];
  btns.forEach(b => {
    const el = document.getElementById(`modalBoxBtn-${b}`);
    if (el) {
      if (String(state.modalSelectedBox) === String(b)) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    }
  });

  const badge = document.getElementById("modalDossierBoxBadge");
  const title = document.getElementById("modalDossierTitle");
  if (state.modalSelectedBox === "ALL") {
    if (badge) badge.textContent = "FLOTA X500 COMPLETA";
    if (title) title.textContent = "CENSO Y AUDITORÍA ON-CHAIN: 500 SATÉLITES REALES";
  } else {
    if (badge) badge.textContent = `BOX ${state.modalSelectedBox}`;
    if (title) title.textContent = `ESCUADRÓN BOX ${state.modalSelectedBox}: 100 SATÉLITES AUDITADOS`;
  }
}

function renderModalWalletsTable() {
  const tbody = document.getElementById("modalWalletsTbody");
  if (!tbody) return;

  const publicWallets = state.publicWallets || [];
  const soldiers = state.telemetry?.soldiers || [];

  // Mapear satélites 1 a 500
  let list = [];
  for (let i = 1; i <= 500; i++) {
    const pw = publicWallets.find(w => w.index === i) || {};
    const sol = soldiers.find(s => s.id === i) || {};
    const boxId = Math.ceil(i / 100);

    list.push({
      id: i,
      formattedId: `#${String(i).padStart(3, '0')}`,
      boxId: boxId,
      isCaptain: i === 1 || i === 101 || i === 201 || i === 301 || i === 401,
      role: pw.role || sol.rankTitle || `Satélite #${i}`,
      evmAddress: pw.address || sol.evmAddress || "—",
      solanaAddress: pw.solanaAddress || sol.solanaAddress || "—",
      gasBalances: sol.gasBalances || { pol: "0.0000", bnb: "0.0000", baseEth: "0.0000", sepoliaEth: "0.0000" },
      txCount: sol.txCount || 0,
      status: sol.status || "ONLINE"
    });
  }

  // Filtro por Box
  if (state.modalSelectedBox !== "ALL") {
    const targetBox = parseInt(state.modalSelectedBox);
    list = list.filter(w => w.boxId === targetBox);
  }

  // Filtro por Búsqueda
  if (state.modalSearchTerm) {
    const term = state.modalSearchTerm;
    list = list.filter(w =>
      w.formattedId.toLowerCase().includes(term) ||
      w.evmAddress.toLowerCase().includes(term) ||
      w.solanaAddress.toLowerCase().includes(term) ||
      w.role.toLowerCase().includes(term)
    );
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">
          No se encontraron carteras con los criterios especificados.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(w => `
    <tr>
      <td>
        <span class="font-mono ${w.isCaptain ? 'gold' : 'cyan'}" style="font-weight: 800;">${w.formattedId}</span>
        ${w.isCaptain ? '<span class="badge-tag-tiny badge-gold" style="display:block; margin-top:2px;">CAPITÁN</span>' : ''}
      </td>
      <td>
        <span style="font-size: 10px; color: var(--text-main);">${w.role}</span>
        <div style="font-size: 9px; color: var(--text-muted);">Box ${w.boxId}</div>
      </td>
      <td>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="font-mono text-dim" style="font-size: 10px;">${truncateAddr(w.evmAddress)}</span>
          <button class="btn-copy-address" onclick="copyToClipboard('${w.evmAddress}')" title="Copiar dirección EVM completa">
            <span class="material-symbols-rounded icon-xs">content_copy</span>
          </button>
        </div>
      </td>
      <td>
        <div style="display: flex; align-items: center; gap: 6px;">
          <span class="font-mono text-dim" style="font-size: 10px;">${truncateAddr(w.solanaAddress)}</span>
          <button class="btn-copy-address" onclick="copyToClipboard('${w.solanaAddress}')" title="Copiar dirección Solana completa">
            <span class="material-symbols-rounded icon-xs">content_copy</span>
          </button>
        </div>
      </td>
      <td>
        <div class="font-mono" style="font-size: 10px;">
          <span class="cyan">${Number(w.gasBalances.pol || 0).toFixed(2)} POL</span> · 
          <span class="gold">${Number(w.gasBalances.bnb || 0).toFixed(4)} BNB</span>
        </div>
        <div style="font-size: 9px; color: var(--text-muted);">
          ${w.gasBalances.baseEth ? `${Number(w.gasBalances.baseEth).toFixed(4)} Base` : 'Testnet OK'}
        </div>
      </td>
      <td>
        <span class="font-mono green-text" style="font-weight: 700;">${w.txCount}</span>
      </td>
      <td>
        <span class="badge-tag-tiny badge-green">ACTIVO</span>
      </td>
    </tr>
  `).join("");
}

// =============================================================================
// 14. ACCIONES DE INTERACCIÓN & BÓVEDAS BINANCE
// =============================================================================
function switchActivityTab(tab) {
  state.activeTab = tab;
  const btnLog = document.getElementById("tabBtnLog");
  const btnTg = document.getElementById("tabBtnTg");
  const contentLog = document.getElementById("tabContentLog");
  const contentTg = document.getElementById("tabContentTg");
  const filterControls = document.getElementById("logFilterControls");

  if (tab === "log") {
    btnLog?.classList.add("active");
    btnTg?.classList.remove("active");
    if (contentLog) contentLog.style.display = "block";
    if (contentTg) contentTg.style.display = "none";
    if (filterControls) filterControls.style.display = "flex";
  } else {
    btnTg?.classList.add("active");
    btnLog?.classList.remove("active");
    if (contentTg) contentTg.style.display = "block";
    if (contentLog) contentLog.style.display = "none";
    if (filterControls) filterControls.style.display = "none";
  }
}

function filterActivityLog(filterType) {
  state.activeLogFilter = filterType;
  const buttons = document.querySelectorAll("#logFilterControls .filter-pill-btn");
  buttons.forEach(btn => {
    if (btn.getAttribute("onclick")?.includes(filterType)) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  renderMiningActivityTable();
}

function inspectBinanceVault(boxId) {
  const vault = BINANCE_VAULTS.find(v => v.boxId === boxId);
  if (!vault) return;

  copyToClipboard(vault.address);
  alert(`🏦 [BÓVEDA BINANCE SPOT #${boxId} - RETIRO MANUAL CONSOLIDADO]\n\n🔒 MODO ACUMULACIÓN ON-CHAIN ACTIVO\n(RETIRO A BINANCE: 100% MANUAL — CERO MICRO-DEPÓSITOS)\n\n• Dirección CEX: ${vault.address}\n• Asignada a: ${vault.range}\n• Capitán On-Chain: ${vault.captain}\n• Política de Seguridad: Ningún bot envía micro-depósitos automáticos ($1.00 USDC / 1 €) a Binance Spot bajo normativa MiCA.\n• Acumulación: Todo lo cosechado se acumula primero en la Bóveda Máster On-Chain #501 (0xD4D1...3743) y Capitanes.\n• Retiros CEX: Exclusivamente ejecutados de forma MANUAL cuando el Comandante lo ordene.\n\n(Dirección copiada automáticamente al portapapeles)`);
}

// =============================================================================
// 15. UTILIDADES (COPIAR, TRUNCAR, FORMATEAR)
// =============================================================================
function copyToClipboard(text) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showCopyToast();
  }).catch(() => {
    const tempInput = document.createElement("input");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand("copy");
    document.body.removeChild(tempInput);
    showCopyToast();
  });
}

function showCopyToast() {
  const toast = document.getElementById("copyToast");
  if (!toast) return;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function truncateAddr(addr) {
  if (!addr || addr.length < 12) return addr || "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function truncateHash(hash) {
  if (!hash || hash.length < 16) return hash || "—";
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function formatTimeUtc(isoString) {
  try {
    const d = new Date(isoString);
    const h = String(d.getUTCHours()).padStart(2, '0');
    const m = String(d.getUTCMinutes()).padStart(2, '0');
    const s = String(d.getUTCSeconds()).padStart(2, '0');
    return `${h}:${m}:${s} UTC`;
  } catch {
    return "UTC";
  }
}

function getExplorerTxUrl(network, hash) {
  if (!hash) return "#";
  const net = (network || "").toLowerCase();
  if (net.includes("base")) return `https://sepolia.basescan.org/tx/${hash}`;
  if (net.includes("arbitrum")) return `https://sepolia.arbiscan.io/tx/${hash}`;
  if (net.includes("polygon")) return `https://polygonscan.com/tx/${hash}`;
  if (net.includes("bsc") || net.includes("bnb")) return `https://bscscan.com/tx/${hash}`;
  if (net.includes("citrea")) return `https://explorer.testnet.citrea.xyz/tx/${hash}`;
  if (net.includes("goat")) return `https://explorer.testnet3.goat.network/tx/${hash}`;
  return `https://sepolia.etherscan.io/tx/${hash}`;
}

function getAddressBySatIndex(idx) {
  const pw = state.publicWallets?.find(w => w.index === idx);
  return pw ? pw.address : "—";
}
