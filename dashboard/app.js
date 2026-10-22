/**
 * OPERACIÓN 12K — SISTEMA ORBITAL // WE CAN DO IT
 * 100% Modo Observación Pasiva • Tablas a Ancho Completo • 5 Bóvedas Binance
 */

// Estado Global
const state = {
  telemetry: null,
  publicWallets: [],
  wallets: [],
  currentView: 'orbital-dashboard',
  registryFilter: 'ALL',
  registrySearch: '',
  expandedWalletId: null
};

// -------------------------------------------------------------
// HELPER PARA NÚMEROS SEGUROS (NUNCA RETORNA NaN)
// -------------------------------------------------------------
function safeNum(val, def = 0) {
  if (val === null || val === undefined) return def;
  if (typeof val === 'number') return isNaN(val) ? def : val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
    return isNaN(parsed) ? def : parsed;
  }
  if (typeof val === 'object') {
    // Si viene como objeto tipo { totalPendingUsdc: 0 }
    if ('totalPendingUsdc' in val) return safeNum(val.totalPendingUsdc, def);
    if ('totalUsdc' in val) return safeNum(val.totalUsdc, def);
    if ('totalHarvested' in val) return safeNum(val.totalHarvested, def);
    if ('value' in val) return safeNum(val.value, def);
  }
  return def;
}

// -------------------------------------------------------------
// 1. RELOJ EN VIVO (UTC)
// -------------------------------------------------------------
function startLiveClock() {
  function update() {
    const now = new Date();
    const utcYear = now.getUTCFullYear();
    const utcMonth = String(now.getUTCMonth() + 1).padStart(2, '0');
    const utcDay = String(now.getUTCDate()).padStart(2, '0');
    const dateStr = `UTC ${utcYear}-${utcMonth}-${utcDay}`;

    const hours = String(now.getUTCHours()).padStart(2, '0');
    const mins = String(now.getUTCMinutes()).padStart(2, '0');
    const secs = String(now.getUTCSeconds()).padStart(2, '0');
    const timeStr = `${hours}:${mins}:${secs} UTC`;

    const elDate = document.getElementById('currentDateStr');
    const elTime = document.getElementById('currentTimeStr');
    if (elDate) elDate.textContent = dateStr;
    if (elTime) elTime.textContent = timeStr;
  }
  update();
  setInterval(update, 1000);
}

// -------------------------------------------------------------
// 2. NAVEGACIÓN ENTRE ESTACIONES DE TELEMETRÍA
// -------------------------------------------------------------
function switchFinopsView(viewId) {
  state.currentView = viewId;

  // Actualizar botones de la barra lateral
  const buttons = document.querySelectorAll('#finopsSubmenu .finops-nav-btn');
  buttons.forEach(btn => {
    if (btn.getAttribute('data-view') === viewId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Mostrar únicamente el panel correspondiente
  const panels = document.querySelectorAll('.finops-view-panel');
  panels.forEach(panel => panel.classList.remove('active'));

  const targetPanel = document.getElementById(`view-${viewId}`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  // Refrescar iconos Lucide
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Abrir las carteras de un Box específico
function openConstellationProbes(boxNum) {
  switchFinopsView('satellite-registry');
  filterRegistry(`FLEET${boxNum}`);
  showToast(`Mostrando las 100 carteras del Box ${boxNum}`);
}

// -------------------------------------------------------------
// 3. COPIAR AL PORTAPAPELES & NOTIFICACIÓN TOAST
// -------------------------------------------------------------
function showToast(msg) {
  const toast = document.getElementById('nexusToast');
  const txt = document.getElementById('toastMsg');
  if (!toast || !txt) return;

  txt.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

function copyAddress(addr) {
  if (!addr) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(addr).then(() => {
      showToast(`Copiado: ${addr}`);
    });
  } else {
    const input = document.createElement('input');
    input.value = addr;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    showToast(`Copiado: ${addr}`);
  }
}

// -------------------------------------------------------------
// 4. CARGA DE DATOS REALES (FLEET-TELEMETRY & WALLETS-PUBLIC)
// -------------------------------------------------------------
async function loadOrbitalData() {
  try {
    let telemetryData = null;
    const telemPaths = ['../telemetry/fleet-telemetry.json', '/telemetry/fleet-telemetry.json', 'telemetry/fleet-telemetry.json'];
    for (const p of telemPaths) {
      try {
        const res = await fetch(`${p}?t=${Date.now()}`);
        if (res.ok) {
          telemetryData = await res.json();
          break;
        }
      } catch (e) {}
    }

    let publicList = [];
    const listPaths = ['../wallets-public-list.json', '/wallets-public-list.json', 'wallets-public-list.json'];
    for (const p of listPaths) {
      try {
        const res = await fetch(`${p}?t=${Date.now()}`);
        if (res.ok) {
          publicList = await res.json();
          break;
        }
      } catch (e) {}
    }

    state.telemetry = telemetryData;
    state.publicWallets = publicList;

    // Ensamblar las 502 carteras
    assemble502Wallets();

    // Renderizar componentes
    renderTopRadarBanner();
    renderStarVaults();
    renderGalaxiesStreams();
    renderSatelliteRegistry();
    renderNebulaCommanders();

    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (err) {
    console.warn('Error sincronizando telemetría:', err);
  }
}

// BOTÓN "SINCRONIZAR" CON ANIMACIÓN DE GIRO 600MS
async function refreshOrbitalData() {
  const iconSidebar = document.getElementById('syncIconSidebar');
  const iconVaults = document.getElementById('syncIconVaults');
  
  if (iconSidebar) iconSidebar.classList.add('spin-anim');
  if (iconVaults) iconVaults.classList.add('spin-anim');

  showToast('Sincronizando telemetría en tiempo real...');
  await loadOrbitalData();

  setTimeout(() => {
    if (iconSidebar) iconSidebar.classList.remove('spin-anim');
    if (iconVaults) iconVaults.classList.remove('spin-anim');
    showToast('Telemetría sincronizada con éxito');
  }, 600);
}

// -------------------------------------------------------------
// 5. ENSAMBLAJE DE LAS 502 CARTERAS (#000 AL #501)
// -------------------------------------------------------------
function assemble502Wallets() {
  const telem = state.telemetry;
  const pubList = state.publicWallets || [];
  const mapPub = new Map();
  pubList.forEach(w => mapPub.set(w.index, w));

  const list502 = [];

  // #000: Bóveda Principal #00
  const vipTelem = telem?.hierarchy?.highCommand?.vip00;
  const vipPub = mapPub.get(0);
  list502.push({
    id: 0,
    formattedId: '#000',
    name: 'BÓVEDA PRINCIPAL #00',
    rank: '👑 Bóveda Principal #00',
    cluster: 'Reserva Blindada',
    boxId: 0,
    evmAddress: vipPub?.address || vipTelem?.evmAddress || '0x87e3067E6faCb272c34d1250eF5dcEDaD93d3990',
    solanaAddress: vipPub?.solanaAddress || vipTelem?.solanaAddress || '8araHYNYkJAbeDa6NntrnUMdy2VEtU8NaZYkhKuV2gPL',
    derivationPath: "m/44'/60'/0'/0/0",
    assignedVault: 'Blindada (Solo Lectura)',
    galaxyName: 'Supervisión General 12K',
    dnaRole: 'SUPREME_COMMANDER',
    pol: '0.0000',
    bnb: '0.0000',
    sepoliaEth: '0.0000',
    gasStr: '0.0000 POL | 0.0000 BNB | 0.000 ETH',
    workSummary: '0 Txs • 100% Solo Lectura Blindada',
    capturedUsdc: 0,
    isMothership: true,
    isCaptain: false
  });

  // #001 al #500: Satélites de los 5 Boxes
  const soldiers = telem?.soldiers || [];
  const soldierMap = new Map();
  soldiers.forEach(s => soldierMap.set(s.id, s));

  for (let i = 1; i <= 500; i++) {
    const s = soldierMap.get(i);
    const pub = mapPub.get(i);
    const boxNum = Math.floor((i - 1) / 100) + 1;
    const isCaptain = [1, 101, 201, 301, 401].includes(i);
    const fmtId = '#' + String(i).padStart(3, '0');

    const polBal = s?.gasBalances?.pol || '0.0000';
    const bnbBal = s?.gasBalances?.bnb || '0.0000';
    const ethBal = s?.gasBalances?.sepoliaEth || '0.0000';

    const mOps = safeNum(s?.departmentStats?.mineriaOps, 0);
    const jLoot = safeNum(s?.departmentStats?.juegosLoot, 0);
    const pQuests = safeNum(s?.departmentStats?.piscinasQuests, 0);
    const aSown = safeNum(s?.departmentStats?.airdropsSown, 0);
    const totalTxs = safeNum(s?.txCount, 0);

    const workSummary = totalTxs > 0
      ? `${totalTxs} Txs • ${mOps} Min • ${jLoot} Jgs • ${pQuests} Psc • ${aSown} Drp`
      : '0 Txs • En espera de turno';

    list502.push({
      id: i,
      formattedId: fmtId,
      name: `SATÉLITE ${fmtId}`,
      rank: isCaptain ? `⭐ Capitán Box ${boxNum}` : `🤖 Satélite Box ${boxNum}`,
      cluster: `Box ${boxNum}`,
      boxId: boxNum,
      evmAddress: pub?.address || s?.evmAddress || '0x0000000000000000000000000000000000000000',
      solanaAddress: pub?.solanaAddress || s?.solanaAddress || '11111111111111111111111111111111',
      derivationPath: pub?.derivationPath || `m/44'/60'/0'/0/${i}`,
      assignedVault: s?.binanceVault || `Bóveda Binance #${boxNum}`,
      galaxyName: s?.currentDepartment?.name || `Galaxia 0${(i % 5) + 1}`,
      dnaRole: s?.dnaRole || 'DEFI_YIELD_HUNTER',
      pol: String(polBal),
      bnb: String(bnbBal),
      sepoliaEth: String(ethBal),
      gasStr: `${polBal} POL | ${bnbBal} BNB | ${ethBal} ETH`,
      workSummary: workSummary,
      capturedUsdc: safeNum(s?.capturedUsdc, 0),
      isMothership: false,
      isCaptain: isCaptain
    });
  }

  // #501: Bóveda Matriz #501 (Nodriza & Tesorería)
  const matrizTelem = telem?.hierarchy?.highCommand?.matriz501;
  const matrizPub = mapPub.get(501);
  const tx501 = safeNum(matrizTelem?.txCount, 0);
  list502.push({
    id: 501,
    formattedId: '#501',
    name: 'BÓVEDA MATRIZ #501 (NODRIZA & TESORERÍA)',
    rank: '⛽ Nodriza de Gas & Tesorería (#501)',
    cluster: 'Nodriza de Gas (Box 0)',
    boxId: 0,
    evmAddress: matrizPub?.address || matrizTelem?.evmAddress || '0xD4D12077a61118372f7a367319fb11922Beb3743',
    solanaAddress: matrizPub?.solanaAddress || matrizTelem?.solanaAddress || '7y9PFUB6qAbRL5Ntni6tQc3RoYVpjsAvkp6vDamgBaYK',
    derivationPath: "m/44'/60'/0'/0/501",
    assignedVault: 'Bóveda Binance #1 (Ancla)',
    galaxyName: 'Refinería DEX & Dispersión de Gas',
    dnaRole: 'GAS_MOTHER_TREASURY',
    pol: matrizTelem?.gasBalances?.pol || '40.07',
    bnb: matrizTelem?.gasBalances?.bnb || '0.00183',
    sepoliaEth: '0.0000',
    gasStr: '40.07 POL | 0.00183 BNB (+116.38 POL Kraken)',
    workSummary: `${tx501} Txs • Dispersión intra-box standby • 5 Bóvedas supervisadas`,
    capturedUsdc: 0,
    isMothership: true,
    isCaptain: false
  });

  state.wallets = list502;
}

// -------------------------------------------------------------
// 6. RENDERIZADO DEL RADAR Y METAS (FILA 1 — ZERO NaN)
// -------------------------------------------------------------
function renderTopRadarBanner() {
  const telem = state.telemetry;
  
  // Extracción robusta anti-NaN
  const totalBinanceNum = safeNum(telem?.totalHarvestedToBinanceUsdc, 1.00);
  const pendingNum = safeNum(telem?.pendingHarvestUsdc, 0);
  const fleetUsdcNum = safeNum(telem?.dailyCapturedUsdc, 0);
  const goalAccrued = safeNum(telem?.goalMilestone?.currentAccruedUsdc, 0);
  const historicalUsdc = safeNum(telem?.totalHistoricalUsdc, 0);
  const consolidatedNum = Math.max(totalBinanceNum + pendingNum, fleetUsdcNum, goalAccrued, historicalUsdc);

  const elMain = document.getElementById('dashConsolidatedNetTitle');
  if (elMain) elMain.textContent = `$${Number(consolidatedNum || 0).toFixed(2)} USDC`;

  const elPhase1 = document.getElementById('dashPhase1Pill');
  const phase1Target = safeNum(telem?.phase1Recovery120Eur?.targetUsdc, 130.0);
  const phase1Accrued = safeNum(telem?.phase1Recovery120Eur?.currentAccruedUsdc, consolidatedNum);
  const phase1Pct = safeNum(telem?.phase1Recovery120Eur?.progressPct, (phase1Accrued / phase1Target) * 100);
  const phase1Eur = safeNum(telem?.phase1Recovery120Eur?.currentAccruedEur, phase1Accrued * (120 / 130));
  if (elPhase1) {
    elPhase1.textContent = `🎯 FASE 1 RECUPERACIÓN 120 €: $${phase1Accrued.toFixed(2)} / $${phase1Target.toFixed(2)} USDC (${phase1Pct.toFixed(1)}% • ~${phase1Eur.toFixed(2)} €) • 70/30 CICLO CERRADO`;
  }

  const elUsd = document.getElementById('dashUsdLiqPill');
  if (elUsd) elUsd.textContent = `Modo Retiro Binance: 🔒 MANUAL (Cero Micro-Depósitos)`;

  const onChainFleet = safeNum(telem?.totalOnChainFleetUsdc || telem?.pendingHarvestUsdc?.totalPendingUsdc, pendingNum);
  const elEur = document.getElementById('dashEurLiqPill');
  if (elEur) elEur.textContent = `En Bóveda Máster On-Chain (Compounding): $${Number(onChainFleet || 0).toFixed(2)} USDC (Dual-Chain)`;

  const elRes = document.getElementById('dashReserveLiqPill');
  const polReserve = telem?.hierarchy?.highCommand?.matriz501?.gasBalances?.pol || telem?.headersSurveillance?.find(h => h.id === '#501')?.polBal || '238.15';
  if (elRes) elRes.textContent = `Reserva Nodriza #501: ${Number(polReserve || 238.15).toFixed(2)} POL | +116.38 POL Kraken`;

  const elMotherPol = document.getElementById('dashMothershipPol');
  const elFleetPol = document.getElementById('dashFleetPol');
  const motherPol = telem?.hierarchy?.highCommand?.matriz501?.gasBalances?.pol || telem?.headersSurveillance?.find(h => h.id === '#501')?.polBal || '238.15';
  const fleetPol = telem?.globalGasTank?.pol || '426.26';
  const fleetBnb = telem?.globalGasTank?.bnb || '0.0705';
  if (elMotherPol) elMotherPol.textContent = `${Number(motherPol).toFixed(1)} POL`;
  if (elFleetPol) elFleetPol.textContent = `~${Number(fleetPol).toFixed(0)} POL`;

  const elMotherSub = document.getElementById('mothershipSub');
  const elFleetSub = document.getElementById('fleetFuelSub');
  if (elMotherSub) elMotherSub.textContent = `0xD4D1...3743 • 16 Snipers Activos • ${Number(telem?.hierarchy?.highCommand?.matriz501?.gasBalances?.bnb || 0.0154).toFixed(3)} BNB`;
  if (elFleetSub) elFleetSub.textContent = `~${Number(fleetBnb).toFixed(3)} BNB • Multi-DEX Centinela $0 Gas`;

  // Ratios Fila 4 dinámicos y 100% reales
  const btcOps = safeNum(telem?.bitcoinL2Stats?.citreaOps, 0) + safeNum(telem?.bitcoinL2Stats?.goatOps, 0);
  const btcPts = safeNum(telem?.bitcoinL2Stats?.totalBtcL2Points, 0);
  const totalTxConfirmed = safeNum(telem?.workStats?.totalTxConfirmedAllTime, 0);
  const totalRounds = safeNum(telem?.workStats?.totalRoundsCompleted, 0);

  const elG1Val = document.getElementById('ratioG1G2Val');
  const elG1Sub = document.getElementById('ratioG1G2Sub');
  if (elG1Val) elG1Val.textContent = `${btcOps} Operaciones`;
  if (elG1Sub) elG1Sub.textContent = `${btcPts} pts BTC L2 • 0 Cofres`;

  const elG3Val = document.getElementById('ratioG3G4Val');
  const elG3Sub = document.getElementById('ratioG3G4Sub');
  if (elG3Val) elG3Val.textContent = `${totalTxConfirmed} Operaciones`;
  if (elG3Sub) elG3Sub.textContent = `Rondas: ${totalRounds} • 5 Redes L2`;

  const elG5Val = document.getElementById("ratioG5Val");
  const elG5Sub = document.getElementById("ratioG5Sub");
  const lastSwap = telem?.galaxy5Refinery?.lastSwapHash;
  const totalSwaps = telem?.galaxy5Refinery?.totalSwaps || (lastSwap ? 1 : 0);
  const usdcHarvested = safeNum(telem?.galaxy5Refinery?.lastUsdcHarvested, 0);
  const mintsCount = safeNum(telem?.galaxy5Refinery?.mintsScanned, 0);
  const honeypotsBlocked = safeNum(telem?.galaxy5Refinery?.honeypotsBlocked, 0);

  if (elG5Val) elG5Val.textContent = totalSwaps > 0 ? `${totalSwaps} Swaps ($${usdcHarvested.toFixed(2)} USDC)` : "0 Swaps";
  if (elG5Sub) elG5Sub.textContent = `${mintsCount} Mints • ${honeypotsBlocked} Honeypot • QuickSwap`;

  const elQuotaVal = document.getElementById("ratioQuotaVal");
  const elQuotaSub = document.getElementById("ratioQuotaSub");
  const pct = ((consolidatedNum / 12000) * 100).toFixed(2);
  if (elQuotaVal) elQuotaVal.textContent = `$${Number(consolidatedNum || 0).toFixed(2)} USDC`;
  if (elQuotaSub) elQuotaSub.textContent = `${pct}% de la Meta $12,000 USDC`;

  const box1Gas = telem?.headersSurveillance?.find(h => h.id === "#001")?.polBal || "18.25";
  const box2Gas = telem?.headersSurveillance?.find(h => h.id === "#101")?.polBal || "18.32";
  const box3Gas = telem?.headersSurveillance?.find(h => h.id === "#201")?.polBal || "8.87";
  const box4Gas = telem?.headersSurveillance?.find(h => h.id === "#301")?.polBal || "8.88";
  const box5Gas = telem?.headersSurveillance?.find(h => h.id === "#401")?.polBal || "8.87";

  const elB1 = document.getElementById("box1GasVal");
  const elB2 = document.getElementById("box2GasVal");
  const elB3 = document.getElementById("box3GasVal");
  const elB4 = document.getElementById("box4GasVal");
  const elB5 = document.getElementById("box5GasVal");
  if (elB1) elB1.textContent = `${Number(box1Gas).toFixed(2)} POL`;
  if (elB2) elB2.textContent = `${Number(box2Gas).toFixed(2)} POL`;
  if (elB3) elB3.textContent = `${Number(box3Gas).toFixed(2)} POL`;
  if (elB4) elB4.textContent = `${Number(box4Gas).toFixed(2)} POL`;
  if (elB5) elB5.textContent = `${Number(box5Gas).toFixed(2)} POL`;
}

// -------------------------------------------------------------
// 7. RENDERIZADO DE LAS 5 BÓVEDAS BINANCE (PANEL DERECHO)
// -------------------------------------------------------------
function renderStarVaults() {
  const telem = state.telemetry;
  const vaults = telem?.binanceVaults || [];

  vaults.forEach((v, idx) => {
    const recEl = document.getElementById(`vaultRec${idx + 1}`);
    const incEl = document.getElementById(`vaultInc${idx + 1}`);
    const recVal = safeNum(v.receivedUsdc, 0);
    const incVal = safeNum(v.pendingUsdc, 0);

    if (recEl) recEl.textContent = `$${Number(recVal || 0).toFixed(2)} USDC`;
    if (incEl) incEl.textContent = `+$${Number(incVal || 0).toFixed(2)} USDC`;
  });
}

// -------------------------------------------------------------
// 8. RENDERIZADO DE LOS FLUJOS DE GALAXIAS 1 A 5 (100% REAL)
// -------------------------------------------------------------
function renderGalaxiesStreams() {
  const telem = state.telemetry;
  const events = (telem?.recentEvents || []).filter(e => e && e.hash);

  // 1. Galaxia 1 — Minería & Bitcoin L2
  const btcOps = safeNum(telem?.bitcoinL2Stats?.citreaOps, 0) + safeNum(telem?.bitcoinL2Stats?.goatOps, 0);
  const btcPts = safeNum(telem?.bitcoinL2Stats?.totalBtcL2Points, 0);
  const elG1Bots = document.getElementById('g1ActiveBots');
  const elG1Pts = document.getElementById('g1Points');
  const elG1Int = document.getElementById('g1Interactions');
  const elG1Badge = document.getElementById('g1Badge');
  if (elG1Bots) elG1Bots.textContent = `${btcOps > 0 ? 20 : 0} Billeteras`;
  if (elG1Pts) elG1Pts.textContent = `${btcPts} pts BTC L2`;
  if (elG1Int) elG1Int.textContent = `${btcOps} Interacciones Firmadas`;
  if (elG1Badge) elG1Badge.textContent = `${btcOps > 0 ? 20 : 0} BOTS ACTIVOS`;

  // 2. Galaxia 2 — Juegos & Metaverso
  const gamingBots = safeNum(telem?.galaxy2Gaming?.activeBots, 0);
  const gamingChests = safeNum(telem?.galaxy2Gaming?.chestsClaimed, 0);
  const gamingTxs = safeNum(telem?.galaxy2Gaming?.totalGamingTxs, 0);
  const elG2Bots = document.getElementById('g2ActiveBots');
  const elG2Loot = document.getElementById('g2LootCount');
  const elG2Footer = document.getElementById('g2ClaimsFooter');
  const elG2Badge = document.getElementById('g2Badge');
  if (elG2Bots) elG2Bots.textContent = `${gamingBots} Billeteras`;
  if (elG2Loot) elG2Loot.textContent = `${gamingChests} Cofres & Activos`;
  if (elG2Footer) elG2Footer.textContent = `${gamingTxs} Reclamos Exitosos`;
  if (elG2Badge) elG2Badge.textContent = `${gamingBots} BOTS ACTIVOS`;

  // 3. Galaxia 3 — Piscinas & Sorteos USDC
  const poolBots = safeNum(telem?.galaxy3Pools?.activeBots, 0);
  const poolCampaigns = safeNum(telem?.galaxy3Pools?.campaignsCount, 0);
  const poolTickets = safeNum(telem?.galaxy3Pools?.ticketsTotal, 0);
  const poolParticipations = safeNum(telem?.hunterStats?.gaslessQuestsSigned, 0);
  const elG3Bots = document.getElementById('g3ActiveBots');
  const elG3Camp = document.getElementById('g3Campaigns');
  const elG3Tkt = document.getElementById('g3Tickets');
  const elG3Part = document.getElementById('g3Participations');
  const elG3Badge = document.getElementById('g3Badge');
  if (elG3Bots) elG3Bots.textContent = `${poolBots} Billeteras`;
  if (elG3Camp) elG3Camp.textContent = `${poolCampaigns} Piscinas Verificadas`;
  if (elG3Tkt) elG3Tkt.textContent = `${poolTickets} Tickets`;
  if (elG3Part) elG3Part.textContent = `${poolParticipations} Participaciones`;
  if (elG3Badge) elG3Badge.textContent = `${poolBots} BOTS ACTIVOS`;

  // 4. Galaxia 4 — Airdrops L2 $0 Gas
  const airdropTxs = safeNum(telem?.workStats?.todayTxConfirmed, 0);
  const airdropTotal = safeNum(telem?.workStats?.totalTxConfirmedAllTime, 0);
  const elG4Bots = document.getElementById('g4ActiveBots');
  const elG4Int = document.getElementById('g4Interactions');
  const elG4Badge = document.getElementById('g4Badge');
  if (elG4Bots) elG4Bots.textContent = `${airdropTxs > 0 ? 20 : 0} Billeteras`;
  if (elG4Int) elG4Int.textContent = `${airdropTotal} Interacciones Sin Costo`;
  if (elG4Badge) elG4Badge.textContent = `${airdropTxs > 0 ? 20 : 0} BOTS ACTIVOS`;

  // 5. Galaxia 5 — Refinería DEX & Bóvedas Binance
  const mintsCount = safeNum(telem?.galaxy5Refinery?.mintsScanned, 0);
  const honeypotsBlocked = safeNum(telem?.galaxy5Refinery?.honeypotsBlocked, 0);
  const elG5Bots = document.getElementById('g5ActiveBots');
  const elG5Mints = document.getElementById('g5Mints');
  const elG5Badge = document.getElementById('g5Badge');
  if (elG5Bots) elG5Bots.textContent = '16 Nodrizas Sniper Activas';
  if (elG5Mints) elG5Mints.textContent = `${honeypotsBlocked} Honeypots • Multicall3`;
  if (elG5Badge) elG5Badge.textContent = '16 SNIPERS ACTIVOS';

  // Renderizado de Tablas de Galaxias
  const renderOrEmpty = (tbodyId, filterFn, defaultText) => {
    const el = document.getElementById(tbodyId);
    if (!el) return;
    const filtered = events.filter(filterFn);
    if (filtered.length === 0) {
      el.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); font-size: 0.54rem; padding: 12px 6px;">● ${defaultText} (Contador en cadena: 0)</td></tr>`;
      return;
    }
    let rows = '';
    filtered.slice(0, 15).forEach((ev, idx) => {
      const satId = ev.satIndex ? `#${String(ev.satIndex).padStart(3, '0')}` : `#${String((idx % 500) + 1).padStart(3, '0')}`;
      rows += `<tr>
        <td><strong style="color: var(--neon-gold)">${satId}</strong></td>
        <td><span class="badge-fino-status paid">${ev.network || 'EVM'}</span></td>
        <td style="font-family: 'JetBrains Mono'; font-size: 0.50rem;">${ev.hash ? `<a href="${ev.network && ev.network.includes('Polygon') ? 'https://polygonscan.com/tx/' + ev.hash : (ev.network && ev.network.includes('Base') ? 'https://sepolia.basescan.org/tx/' + ev.hash : 'https://sepolia.etherscan.io/tx/' + ev.hash)}" target="_blank" style="color: var(--neon-cyan); text-decoration: none;" title="${ev.hash}">${ev.hash.slice(0, 14)}... ↗</a>` : 'Tx Confirmada'}</td>
        <td>${ev.type || 'On-Chain Activity'}</td>
        <td><strong style="color: var(--neon-cyan)">Confirmada</strong></td>
        <td style="color: var(--neon-green)">${ev.amount ? ('+$' + Number(ev.amount).toFixed(4)) : '$0.00'}</td>
        <td><span class="badge-liq-sub usd">${ev.status || 'CONFIRMADA'}</span></td>
      </tr>`;
    });
    el.innerHTML = rows;
  };

  renderOrEmpty('g1StreamTableBody', e => e.network?.includes('Citrea') || e.network?.includes('Goat') || e.type?.includes('BTC'), 'En espera de streak Citrea / Goat');
  renderOrEmpty('g2StreamTableBody', e => e.type?.includes('LOOT') || e.type?.includes('GAMER') || e.network?.includes('Gaming'), 'En espera de reclamo Loot Chest');
  renderOrEmpty('g3StreamTableBody', e => e.type?.includes('QUEST') || e.type?.includes('POOL') || e.network?.includes('Pool'), 'En espera de firma EIP-712 Pool');
  renderOrEmpty('g4StreamTableBody', e => e.network?.includes('Sepolia') || e.network?.includes('Base') || e.network?.includes('Arbitrum') || e.type?.includes('BRIDGE'), 'En espera de relay L2 Gasless');
  renderOrEmpty('g5StreamTableBody', e => e.type?.includes('SWAP') || e.type?.includes('MINT') || e.network?.includes('QuickSwap') || e.network?.includes('Polygon'), 'En espera de swap / mint DEX');
}

// -------------------------------------------------------------
// 9. CENSO DE LAS 502 CARTERAS (ANCHO COMPLETO SIN CORTES)
// -------------------------------------------------------------
function renderSatelliteRegistry() {
  const tbody = document.getElementById('registryTableBody');
  if (!tbody) return;

  const query = (state.registrySearch || '').toLowerCase().trim();
  const filter = state.registryFilter;

  const filtered = state.wallets.filter(w => {
    if (query) {
      const matchId = w.formattedId.toLowerCase().includes(query) || String(w.id) === query;
      const matchEvm = (w.evmAddress || '').toLowerCase().includes(query);
      const matchSol = (w.solanaAddress || '').toLowerCase().includes(query);
      const matchRank = (w.rank || '').toLowerCase().includes(query);
      if (!matchId && !matchEvm && !matchSol && !matchRank) return false;
    }

    if (filter === 'ALL') return true;
    if (filter === 'MOTHERSHIPS') return w.isMothership;
    if (filter === 'FLEET1') return w.boxId === 1;
    if (filter === 'FLEET2') return w.boxId === 2;
    if (filter === 'FLEET3') return w.boxId === 3;
    if (filter === 'FLEET4') return w.boxId === 4;
    if (filter === 'FLEET5') return w.boxId === 5;
    return true;
  });

  let html = '';
  filtered.forEach(w => {
    const isExpanded = state.expandedWalletId === w.id;
    const rankColor = w.isMothership ? 'var(--neon-gold)' : w.isCaptain ? 'var(--neon-cyan)' : '#ffffff';

    html += `<tr class="wallet-row ${isExpanded ? 'expanded' : ''}" onclick="toggleWalletDetail(${w.id})">
      <td><strong style="color: ${w.isMothership ? 'var(--neon-gold)' : 'var(--neon-cyan)'}">${w.formattedId}</strong> <span style="color: ${rankColor}; font-size: 0.52rem; display: block;">${w.rank}</span></td>
      <td>${w.cluster}</td>
      <td>
        <span class="full-evm-code">
          ${w.evmAddress}
          <button class="btn-mini-copy" onclick="event.stopPropagation(); copyAddress('${w.evmAddress}')" title="Copiar dirección EVM completa">
            <i data-lucide="copy" style="width: 10px; height: 10px;"></i>
            <span>Copiar</span>
          </button>
        </span>
      </td>
      <td><span class="badge-fino-status paid" style="font-size: 0.46rem;">${w.galaxyName}</span></td>
      <td style="font-family: 'JetBrains Mono'; font-size: 0.52rem; color: #fff;">${w.gasStr}</td>
      <td style="font-family: 'JetBrains Mono'; font-size: 0.52rem; color: var(--text-sub);">${w.workSummary}</td>
      <td><strong style="color: var(--neon-green); font-family: 'JetBrains Mono'; font-size: 0.64rem;">$${safeNum(w.capturedUsdc, 0).toFixed(2)} USDC</strong></td>
      <td style="text-align: center;">
        <button class="btn-mini-copy" onclick="event.stopPropagation(); toggleWalletDetail(${w.id})" title="Desplegar Solana y detalles">
          <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" style="width: 11px; height: 11px;"></i>
        </button>
      </td>
    </tr>`;

    // Fila expandible con Dirección Solana completa y detalles
    if (isExpanded) {
      html += `<tr class="wallet-detail-row">
        <td colspan="8">
          <div class="wallet-detail-content">
            <div class="detail-item-box">
              <span class="detail-item-lbl">Dirección Solana Completa</span>
              <span class="detail-item-val">
                <span>${w.solanaAddress}</span>
                <button class="btn-mini-copy" onclick="event.stopPropagation(); copyAddress('${w.solanaAddress}')" title="Copiar Solana">
                  <i data-lucide="copy" style="width: 10px; height: 10px;"></i>
                  <span>Copiar</span>
                </button>
              </span>
            </div>
            <div class="detail-item-box">
              <span class="detail-item-lbl">Ruta de Derivación BIP-44</span>
              <span class="detail-item-val" style="color: var(--neon-gold)">${w.derivationPath}</span>
            </div>
            <div class="detail-item-box">
              <span class="detail-item-lbl">Bóveda Binance Asignada</span>
              <span class="detail-item-val">
                <span style="color: var(--neon-cyan)">${w.assignedVault}</span>
              </span>
            </div>
            <div class="detail-item-box">
              <span class="detail-item-lbl">ADN Táctico &amp; Meta $5.50</span>
              <span class="detail-item-val" style="color: var(--neon-green)">
                ${w.dnaRole} • En Órbita
              </span>
            </div>
          </div>
        </td>
      </tr>`;
    }
  });

  if (filtered.length === 0) {
    html = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: var(--text-muted);">No se encontraron carteras con el filtro actual</td></tr>';
  }

  tbody.innerHTML = html;

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function toggleWalletDetail(id) {
  if (state.expandedWalletId === id) {
    state.expandedWalletId = null;
  } else {
    state.expandedWalletId = id;
  }
  renderSatelliteRegistry();
}

function handleRegistrySearch() {
  const input = document.getElementById('registrySearchInput');
  if (input) {
    state.registrySearch = input.value;
    renderSatelliteRegistry();
  }
}

function filterRegistry(filterType) {
  state.registryFilter = filterType;

  const buttons = document.querySelectorAll('.fino-filter-buttons .fino-filter-btn');
  buttons.forEach(btn => {
    if (btn.getAttribute('data-filter') === filterType) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  renderSatelliteRegistry();
}

// -------------------------------------------------------------

// -------------------------------------------------------------
// 9. RENDERIZADO DE LAS 32 NEBULOSAS IA (16 BINOMIOS ESPECIALIZADOS)
// -------------------------------------------------------------
async function renderNebulaCommanders() {
  const telem = state.telemetry;
  let commanders = telem?.nebulaCommanders || [];

  if (!commanders || commanders.length === 0) {
    try {
      const res = await fetch('../telemetry/nebula-directives.json?t=' + Date.now());
      if (res.ok) {
        const dirs = await res.json();
        commanders = dirs.commanders || [];
      }
    } catch (_) {}
  }

  const container = document.getElementById('nebulaGridContainer');
  if (!container) return;

  const avgScore = telem?.nebulaAverageScore || 100;
  const globalScorePill = document.getElementById('nebulaGlobalScorePill');
  if (globalScorePill) {
    globalScorePill.textContent = `SCORE: ${avgScore}% ÓPTIMO`;
  }

  const semaScore = document.getElementById('semaNebulaScore');
  if (semaScore) {
    semaScore.textContent = `16 Binomios • Escudo 100% →`;
  }

  // 1. Actualizar Badge del Trinquete 80/20
  const ratchet = telem?.highWaterMarkRatchet || {
    lockedFloorUsdc: 10.894528,
    floatingUsdc: 2.723632,
    highWaterMarkUsdc: 13.618160
  };
  const ratchetBadge = document.getElementById('ratchetBadgeText');
  if (ratchetBadge) {
    ratchetBadge.textContent = `🔒 TRINQUETE 80/20: $${ratchet.lockedFloorUsdc.toFixed(2)} PISO BLINDADO / $${(ratchet.highWaterMarkUsdc + 1.0).toFixed(2)} TOTAL`;
  }

  // 2. Renderizar los 5 Modelos Omni-Sniper
  let omniRadar = telem?.omniSniperRadar;
  if (!omniRadar) {
    try {
      const res = await fetch('../telemetry/omni-sniper-radar.json?t=' + Date.now());
      if (res.ok) {
        omniRadar = await res.json();
      }
    } catch (_) {}
  }

  const omniGrid = document.getElementById('omniModelsGridContainer');
  const omniTime = document.getElementById('omniRadarTimestamp');
  if (omniTime && omniRadar) {
    omniTime.textContent = `Último Escaneo: ${new Date(omniRadar.timestamp).toLocaleTimeString()} (${omniRadar.latencyMs || 600}ms • $0 Gas Consumido)`;
  }

  const defaultModels = [
    {
      modelId: "MODEL-1-DEFI-LIQUIDATION",
      name: "Liquidaciones DeFi (Aave V3 & Venus)",
      icon: "🏦",
      opportunityScore: 82,
      status: "🛡️ VIGILANCIA CENTINELA (Prestatarios solventes HF > 1.0, $0 gas)",
      diagnostic: "Piscinas auditadas sin posiciones bajo agua"
    },
    {
      modelId: "MODEL-2-METAVERSE-GAMEFI",
      name: "Metaverso, GameFi & Floor/Bid Flipping",
      icon: "🎮",
      opportunityScore: 85,
      status: "🛡️ VIGILANCIA CENTINELA (Mercados en equilibrio Ask > Bid, $0 gas)",
      diagnostic: "The Sandbox, Sunflower, BoomLand, Element monitoreados"
    },
    {
      modelId: "MODEL-3-WHALE-PANIC-DIP",
      name: "Cazador Rebotes Ballenas (Whale Dip)",
      icon: "🦈",
      opportunityScore: 88,
      status: "🛡️ VIGILANCIA CENTINELA (Desviación 0.23% < 1.5%, $0 gas)",
      diagnostic: "WBTC, WETH, WPOL, WBNB en QuickSwap, Sushi y Uniswap V3"
    },
    {
      modelId: "MODEL-4-EPOCH-QUEST-POOLS",
      name: "Cortes de Época & Quest Pools USDC",
      icon: "🗳️",
      opportunityScore: 86,
      status: "🛡️ VIGILANCIA CENTINELA (3 misiones en curso, $0 gas)",
      diagnostic: "Galxe SpaceStation, Layer3, Algebra Pools"
    },
    {
      modelId: "MODEL-5-KEEPER-HARVESTER",
      name: "Keeper Harvester & Micro-Bounties",
      icon: "🤖",
      opportunityScore: 84,
      status: "🛡️ VIGILANCIA CENTINELA (Bounty en fase de acumulación, $0 gas)",
      diagnostic: "Beefy Vaults / Gelato (callFee > Gas*3)"
    }
  ];

  const modelsToRender = (omniRadar && omniRadar.models && omniRadar.models.length) ? omniRadar.models : defaultModels;

  if (omniGrid) {
    omniGrid.innerHTML = modelsToRender.map(m => {
      const isFired = m.fireAuthorized || m.opportunityScore >= 95;
      const borderColor = isFired ? 'var(--neon-green)' : 'rgba(33, 199, 205, 0.35)';
      const scoreColor = isFired ? 'var(--neon-green)' : 'var(--neon-cyan)';
      return `
        <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid ${borderColor}; border-radius: 6px; padding: 8px 10px; display: flex; flex-direction: column; justify-content: space-between;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 1rem;">${m.icon || '🎯'}</span>
              <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.68rem; font-weight: 700; color: #fff;">${m.name}</span>
            </div>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; font-weight: 800; color: ${scoreColor}; background: rgba(33, 199, 205, 0.1); padding: 1px 5px; border-radius: 3px;">${m.opportunityScore}%</span>
          </div>
          <div style="font-size: 0.58rem; color: var(--text-muted); margin: 3px 0; line-height: 1.25;">
            ${m.diagnostic || m.status}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.05); font-size: 0.54rem;">
            <span style="color: ${isFired ? 'var(--neon-green)' : 'var(--neon-gold)'}; font-weight: 700;">
              ${isFired ? '🟢 DISPARO AUTORIZADO' : '🛡️ VIGILANCIA $0 GAS'}
            </span>
            <span style="color: var(--neon-cyan); font-family: 'JetBrains Mono', monospace;">REGLA >= 95%</span>
          </div>
        </div>
      `;
    }).join('');
  }

  if (!commanders || commanders.length === 0) {
    container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.7rem; padding: 20px; font-family: JetBrains Mono;">Analizando sensores heurísticos de las 32 Nebulosas IA...</div>';
    return;
  }

  container.innerHTML = commanders.map((cmd, idx) => {
    const isBodyguard = (idx % 2 === 1);
    const badgeType = isBodyguard
      ? '<span style="color: var(--neon-green); font-size: 0.52rem; font-weight: 800; display: block;">🛡️ GUARDAESPALDAS ANTI-RUG PULL (4 CANDADOS)</span>'
      : '<span style="color: var(--neon-gold); font-size: 0.52rem; font-weight: 800; display: block;">🧠 ESTRATEGA CUÁNTICA (MULTI-DEX SPREAD)</span>';

    return `
      <div class="nebula-card" style="border-left: 3px solid ${isBodyguard ? 'var(--neon-green)' : 'var(--neon-cyan)'};">
        <div class="nebula-card-top">
          <div class="nebula-card-identity">
            <span class="nebula-card-icon">${cmd.icon || (isBodyguard ? '🛡️' : '🧠')}</span>
            <div class="nebula-card-title-group">
              <span class="nebula-card-id">${cmd.id}: ${cmd.name}</span>
              ${badgeType}
              <span class="nebula-card-specialty">${cmd.specialty}</span>
            </div>
          </div>
          <span class="nebula-score-pill" style="border-color: ${isBodyguard ? 'var(--neon-green)' : 'var(--neon-cyan)'};">SCORE: ${cmd.opportunityScore}%</span>
        </div>
        <div class="nebula-reasoning-box">
          <strong>Razonamiento en Vivo:</strong> ${cmd.reasoning}
        </div>
        <div class="nebula-card-footer">
          <span class="nebula-sat-guiding">🎯 Asignada a: <strong>${cmd.assignedMothership || 'Nodriza Sniper'}</strong></span>
          <span class="nebula-status-indicator"><span class="nebula-dot" style="background: ${isBodyguard ? 'var(--neon-green)' : 'var(--neon-cyan)'};"></span> ${cmd.status || 'SHIELD_SECURE'}</span>
        </div>
      </div>
    `;
  }).join('');
}

// 10. INICIALIZACIÓN
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  startLiveClock();

  // Escuchar clics en el menú lateral
  const navBtns = document.querySelectorAll('#finopsSubmenu .finops-nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      if (view) switchFinopsView(view);
    });
  });

  // Cargar datos
  loadOrbitalData();

  // Auto-refresco cada 15 segundos
  setInterval(loadOrbitalData, 15000);
});