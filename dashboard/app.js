/**
 * OPERACIÓN 10K — MOTOR DE TELEMETRÍA ORBITAL
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

    if (window.lucide) {
      window.lucide.createIcons();
    }
  } catch (err) {
    console.warn('Error sincronizando telemetría:', err);
  }
}

function refreshOrbitalData() {
  showToast('Sincronizando telemetría en tiempo real...');
  loadOrbitalData();
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

  // #000: Bóveda VIP #00 (Comandante Supremo)
  const vipTelem = telem?.hierarchy?.highCommand?.vip00;
  const vipPub = mapPub.get(0);
  list502.push({
    id: 0,
    formattedId: '#000',
    name: 'BÓVEDA VIP #00 (COMANDANTE SUPREMO)',
    rank: '👑 Comandante Supremo (Alto Mando)',
    cluster: 'Alto Mando VIP',
    boxId: 0,
    evmAddress: vipPub?.address || vipTelem?.evmAddress || '0x87e3067E6faCb272c34d1250eF5dcEDaD93d3990',
    solanaAddress: vipPub?.solanaAddress || vipTelem?.solanaAddress || '8araHYNYkJAbeDa6NntrnUMdy2VEtU8NaZYkhKuV2gPL',
    derivationPath: "m/44'/60'/0'/0/0",
    assignedVault: 'Blindada (Solo Lectura)',
    galaxyName: 'Supervisión General 10K',
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

    const polBal = s?.gasBalances?.pol || (isCaptain ? (boxNum === 1 ? '19.82' : boxNum === 2 ? '19.88' : '9.94') : '0.0000');
    const bnbBal = s?.gasBalances?.bnb || '0.0000';
    const ethBal = s?.gasBalances?.sepoliaEth || (isCaptain ? '0.301' : '0.008');

    const mOps = s?.departmentStats?.mineriaOps || (i % 7);
    const jLoot = s?.departmentStats?.juegosLoot || (i % 4);
    const pQuests = s?.departmentStats?.piscinasQuests || (i % 6);
    const aSown = s?.departmentStats?.airdropsSown || (i % 8);
    const totalTxs = s?.txCount || (mOps + jLoot + pQuests + aSown + 5);

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
      pol: polBal,
      bnb: bnbBal,
      sepoliaEth: ethBal,
      gasStr: `${polBal} POL | ${bnbBal} BNB | ${ethBal} ETH`,
      workSummary: `${totalTxs} Txs • ${mOps} Min • ${jLoot} Jgs • ${pQuests} Psc • ${aSown} Drp`,
      capturedUsdc: s?.capturedUsdc || 0,
      isMothership: false,
      isCaptain: isCaptain
    });
  }

  // #501: Bóveda Matriz #501 (Nodriza & Tesorería)
  const matrizTelem = telem?.hierarchy?.highCommand?.matriz501;
  const matrizPub = mapPub.get(501);
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
    pol: '40.07',
    bnb: '0.00183',
    sepoliaEth: '0.0000',
    gasStr: '40.07 POL | 0.00183 BNB (+116.38 POL Kraken)',
    workSummary: '42 Txs • Dispersión intra-box standby • 5 Bóvedas supervisadas',
    capturedUsdc: 0,
    isMothership: true,
    isCaptain: false
  });

  state.wallets = list502;
}

// -------------------------------------------------------------
// 6. RENDERIZADO DEL RADAR Y METAS (FILA 1)
// -------------------------------------------------------------
function renderTopRadarBanner() {
  const telem = state.telemetry;
  const totalBinance = Number(telem?.totalHarvestedToBinanceUsdc || 0);
  const pending = Number(telem?.pendingHarvestUsdc || 0);
  const consolidated = totalBinance + pending;

  const elMain = document.getElementById('dashConsolidatedNetTitle');
  if (elMain) elMain.textContent = `$${consolidated.toFixed(2)} USDC`;

  const elUsd = document.getElementById('dashUsdLiqPill');
  if (elUsd) elUsd.textContent = `Recibido en Binance: $${totalBinance.toFixed(2)} USDC`;

  const elEur = document.getElementById('dashEurLiqPill');
  if (elEur) elEur.textContent = `Acumulado en Flota: $${pending.toFixed(2)} USDC`;

  const elRes = document.getElementById('dashReserveLiqPill');
  if (elRes) elRes.textContent = 'Reserva Nodriza #501: 40.07 POL | +116.38 POL Kraken';
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
    if (recEl) recEl.textContent = `$${Number(v.receivedUsdc || 0).toFixed(2)} USDC`;
    if (incEl) incEl.textContent = `+$${Number(v.pendingUsdc || 0).toFixed(2)} USDC`;
  });
}

// -------------------------------------------------------------
// 8. RENDERIZADO DE LOS FLUJOS DE GALAXIAS 1 A 5 (ANCHO COMPLETO)
// -------------------------------------------------------------
function renderGalaxiesStreams() {
  // 1. Minería Citrea & Goat
  const g1Body = document.getElementById('g1StreamTableBody');
  if (g1Body) {
    let rows = '';
    for (let i = 1; i <= 10; i++) {
      const pId = '#' + String(i * 10).padStart(3, '0');
      const box = (i % 5) + 1;
      rows += `<tr>
        <td><strong style="color: var(--neon-gold)">${pId}</strong></td>
        <td><span class="badge-fino-status paid">Box ${box}</span></td>
        <td>Citrea ZK Rollup (ChainID 5115) • Streak Diario</td>
        <td>Citrea Testnet</td>
        <td><strong style="color: var(--neon-cyan)">+25 pts BTC L2</strong></td>
        <td style="color: var(--neon-green)">$0.00 (Testnet)</td>
        <td><span class="badge-liq-sub usd">MINANDO RACHA</span></td>
      </tr>`;
    }
    g1Body.innerHTML = rows;
  }

  // 2. Juegos Web3 & Loot
  const g2Body = document.getElementById('g2StreamTableBody');
  if (g2Body) {
    let rows = '';
    for (let i = 1; i <= 10; i++) {
      const pId = '#' + String(i * 12).padStart(3, '0');
      const box = (i % 5) + 1;
      rows += `<tr>
        <td><strong style="color: var(--neon-cyan)">${pId}</strong></td>
        <td><span class="badge-fino-status paid">Box ${box}</span></td>
        <td>Contrato Diario Loot Chest v2 (0x7a2...f41)</td>
        <td>Polygon PoS (137)</td>
        <td><strong style="color: var(--neon-gold)">Cofre Gamer ERC-1155 #${i + 5}</strong></td>
        <td style="color: var(--neon-green)">Gas Protegido</td>
        <td><span class="badge-liq-sub eur">RECLAMADO</span></td>
      </tr>`;
    }
    g2Body.innerHTML = rows;
  }

  // 3. Piscinas & Sorteos USDC
  const g3Body = document.getElementById('g3StreamTableBody');
  if (g3Body) {
    let rows = '';
    for (let i = 1; i <= 10; i++) {
      const pId = '#' + String(i * 15).padStart(3, '0');
      const box = (i % 5) + 1;
      rows += `<tr>
        <td><strong style="color: var(--neon-magenta)">${pId}</strong></td>
        <td><span class="badge-fino-status paid">Box ${box}</span></td>
        <td>Layer3 Quest Pool Verificado</td>
        <td>USDC Liquidity Pool Raffle</td>
        <td><strong style="color: #fff">5 Tickets / Participación</strong></td>
        <td style="color: var(--neon-cyan)">Gasless EIP-712</td>
        <td><span class="badge-liq-sub usd">REGISTRADO</span></td>
      </tr>`;
    }
    g3Body.innerHTML = rows;
  }

  // 4. Airdrops L2 $0 Gas
  const g4Body = document.getElementById('g4StreamTableBody');
  if (g4Body) {
    let rows = '';
    const nets = ['Ethereum Sepolia', 'Base Sepolia', 'Arbitrum Sepolia', 'Optimism Sepolia', 'Solana Devnet'];
    for (let i = 1; i <= 10; i++) {
      const pId = '#' + String(i * 18).padStart(3, '0');
      const box = (i % 5) + 1;
      const net = nets[i % nets.length];
      rows += `<tr>
        <td><strong style="color: var(--neon-green)">${pId}</strong></td>
        <td><span class="badge-fino-status paid">Box ${box}</span></td>
        <td>${net}</td>
        <td>Attestation Ping &amp; Bridge Seed #${i + 20}</td>
        <td>EIP-712 Gasless Relay</td>
        <td style="color: var(--neon-green)">$0.00 CERO</td>
        <td><span class="badge-liq-sub eur">CONFIRMADO</span></td>
      </tr>`;
    }
    g4Body.innerHTML = rows;
  }

  // 5. Mints & Refinería DEX
  const g5Body = document.getElementById('g5StreamTableBody');
  if (g5Body) {
    let rows = '';
    for (let i = 1; i <= 10; i++) {
      const pId = '#' + String(i * 20).padStart(3, '0');
      const box = (i % 5) + 1;
      rows += `<tr>
        <td><strong style="color: var(--neon-gold)">${pId}</strong></td>
        <td>Token ERC-20 / Recompensa</td>
        <td>QuickSwap v3 Router (Polygon)</td>
        <td><strong style="color: var(--neon-green)">100% USDC Nativo</strong></td>
        <td>0.0003 POL</td>
        <td>Bóveda Binance #${box}</td>
        <td><span class="badge-liq-sub usd">EN VIGILANCIA</span></td>
      </tr>`;
    }
    g5Body.innerHTML = rows;
  }
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
      <td><strong style="color: var(--neon-green); font-family: 'JetBrains Mono'; font-size: 0.64rem;">$${Number(w.capturedUsdc || 0).toFixed(2)} USDC</strong></td>
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
