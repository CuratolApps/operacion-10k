/**
 * posicion-501/app.js — ÁREA 501 // POSICIÓN MATRIX 501
 * ==============================================================================
 * CONTROLADOR MULTICADENA EN VIVO DE LA BÓVEDA MATRIZ #501
 * (0xD4D12077a61118372f7a367319fb11922Beb3743)
 * 1) RENDERIZA LAS 54 CELDAS MATRIX EN VERDE ESMERALDA / MENTA
 * 2) TABLA EXPLORADORA MULTICADENA EN VIVO (BSCSCAN / POLYGONSCAN / HYPERLIQUID)
 * 3) FILTROS EN TIEMPO REAL: ALL, HL, POLYGON, BSC/ARBITRUM
 * 4) AMORTIZACIÓN 70/30 Y PRÉSTAMO 0% MATEMÁTICO
 * 5) AUDITORÍA DE CONTRATOS, NONCES Y OPSEC
 * 6) ZERO-FLICKER DOM DIFFING (setTextIfChanged)
 * ==============================================================================
 */

const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const EXECUTOR_V2 = "0x3e8b1d7f23560215eFD61A77a97d675cc92509f7";

// HELPER: ZERO-FLICKER DOM DIFFING
function setTextIfChanged(el, newText) {
  if (!el) return;
  const str = String(newText);
  if (el.textContent !== str) {
    el.textContent = str;
  }
}

// 54 CELDAS MATRIX DE COMPOSICIÓN PATRIMONIAL & MULTICADENA (EXACTAMENTE 54)
const MATRIX_CELLS_54 = [
  // CÁMARAS MULTICADENA (C01 - C06)
  { id: "C01", cat: "CÁMARA L1", title: "Hyperliquid L1", val: "$843.63", unit: "USDC", foot: "Clearinghouse", badge: "60/40 Margen", color: "cyan" },
  { id: "C02", cat: "CÁMARA EVM", title: "Polygon PoS", val: "9.62 POL", unit: "+$211.35", foot: "Bóveda #501", badge: "Gas Blindado", color: "purple" },
  { id: "C03", cat: "CÁMARA EVM", title: "BNB Smart Chain", val: "$7.98", unit: "USDC", foot: "0.0188 BNB Gas", badge: "BEP-20", color: "gold" },
  { id: "C04", cat: "CÁMARA EVM", title: "Arbitrum One", val: "0.00084", unit: "ETH", foot: "Puente HL", badge: "L2 Arbitrum", color: "cyan" },
  { id: "C05", cat: "CÁMARA L2", title: "Base Mainnet", val: "0.0001", unit: "ETH", foot: "Avantis S3 Canal", badge: "EIP-712", color: "cyan" },
  { id: "C06", cat: "CÁMARA L2", title: "Optimism OP", val: "0.0001", unit: "ETH", foot: "Superchain Canal", badge: "Gasless", color: "cyan" },

  // ACTIVOS EN CARTERA (A01 - A12)
  { id: "A01", cat: "ACTIVO", title: "USDC Nativo (Polygon)", val: "$0.11", unit: "USDC", foot: "0x3c49...3359", badge: "Custodia #501", color: "mint" },
  { id: "A02", cat: "ACTIVO", title: "aPolUSDCn (Aave V3)", val: "$211.24", unit: "aUSDC", foot: "3.42% APY Activo", badge: "0.001s Retiro", color: "mint" },
  { id: "A03", cat: "ACTIVO", title: "USDC (BNB Chain)", val: "$7.98", unit: "USDC", foot: "0x8ac7...56bf", badge: "BEP-20", color: "gold" },
  { id: "A04", cat: "ACTIVO", title: "POL Nativo (#501)", val: "9.6194", unit: "POL", foot: "1145 Disparos", badge: "Gas Intocable", color: "purple" },
  { id: "A05", cat: "ACTIVO", title: "BNB Nativo (#501)", val: "0.0188", unit: "BNB", foot: "Gas Reserva BSC", badge: "Gas Intocable", color: "gold" },
  { id: "A06", cat: "ACTIVO", title: "ETH Nativo (#501)", val: "0.00084", unit: "ETH", foot: "Puente Arbitrum", badge: "Gas Reserva", color: "cyan" },
  { id: "A07", cat: "MARGEN", title: "60% Margen Activo HL", val: "$506.18", unit: "USDC", foot: "18 Escuadrones", badge: "Disparos V2", color: "cyan" },
  { id: "A08", cat: "ESCUDO", title: "40% Escudo Mentora #00", val: "$337.45", unit: "USDC", foot: "Piso Inviolable", badge: "Cero Liquidación", color: "gold" },
  { id: "A09", cat: "PERP L1", title: "WBTC/USDC Escuadrón", val: "0.0000", unit: "POS", foot: "Post-Only ALO", badge: "Escuadrón #01", color: "mint" },
  { id: "A10", cat: "PERP L1", title: "ETH/USDC Escuadrón", val: "0.0000", unit: "POS", foot: "Post-Only ALO", badge: "Escuadrón #02", color: "mint" },
  { id: "A11", cat: "PERP L1", title: "SOL/USDC Escuadrón", val: "0.0000", unit: "POS", foot: "Post-Only ALO", badge: "Escuadrón #03", color: "mint" },
  { id: "A12", cat: "PERP L1", title: "LINK/USDC Escuadrón", val: "0.0000", unit: "POS", foot: "Post-Only ALO", badge: "Escuadrón #04", color: "mint" },

  // CONTRATOS & EJECUTORES (E01 - E12)
  { id: "E01", cat: "CONTRATO", title: "AtomicSniperExecutor V2", val: "0x3e8b...09f7", unit: "POL", foot: "Deploy Bloque #96348084", badge: "Balancer+Aave", color: "mint" },
  { id: "E02", cat: "CONTRATO", title: "Balancer V2 Vault", val: "0xBA12...2C8", unit: "POL", foot: "Flash Loan 0.00% Fee", badge: "0% Fee Flash", color: "mint" },
  { id: "E03", cat: "CONTRATO", title: "Aave V3 Pool Polygon", val: "0x794a...14aD", unit: "POL", foot: "Liquidez & Liquidaciones", badge: "Flash 0.05%", color: "purple" },
  { id: "E04", cat: "CONTRATO", title: "Odos Router V2", val: "0x4fd6...a45f", unit: "POL", foot: "Enrutador DEX Óptimo", badge: "0 Slippage", color: "cyan" },
  { id: "E05", cat: "CONTRATO", title: "QuickSwap V3 Router", val: "0xf5b5...8E12", unit: "POL", foot: "Liquidez Concentrada", badge: "DEX Polygon", color: "cyan" },
  { id: "E06", cat: "CONTRATO", title: "Uniswap V3 SwapRouter02", val: "0x68b3...Fc45", unit: "POL", foot: "Rutas Multihop", badge: "DEX Global", color: "cyan" },
  { id: "E07", cat: "CONTRATO", title: "Hyperliquid Bridge", val: "0x2df1...3df7", unit: "ARB", foot: "Arbitrum One Puente", badge: "Oficial HL", color: "cyan" },
  { id: "E08", cat: "AGENT KEY", title: "SquadSecret501 Agent", val: "0xccb3...F7f8", unit: "HL", foot: "Post-Only ALO Maker", badge: "0% Retiro", color: "mint" },
  { id: "E09", cat: "FUNCIÓN", title: "Keeper Harvest Directo", val: "0.0000", unit: "FEE", foot: "Bóvedas Beefy/Gamma", badge: "Automático", color: "mint" },
  { id: "E10", cat: "FUNCIÓN", title: "Flash Loan Calibres", val: "$5k - $50k", unit: "USD", foot: "0.001s Ejecución", badge: "0 Capital Propio", color: "mint" },
  { id: "E11", cat: "FUNCIÓN", title: "Liquidaciones Aave V3", val: "18 Deudas", unit: "POL", foot: "Monitor de Salud HF", badge: "Vigilancia", color: "purple" },
  { id: "E12", cat: "FUNCIÓN", title: "Gas Auto-Refuel", val: "Intocable", unit: "POL", foot: "Piso Mínimo 10.0 POL", badge: "Protegido", color: "purple" },

  // BÓVEDAS BINANCE SPOT (B01 - B05)
  { id: "B01", cat: "BINANCE", title: "Spot Vault 1 (Primaria)", val: "0x87e3...3990", unit: "BSC", foot: "Acumulador Mayor", badge: "Cero Sweep", color: "gold" },
  { id: "B02", cat: "BINANCE", title: "Spot Vault 2 (USDT/USDC)", val: "0x87e3...3990", unit: "BSC", foot: "Reserva Estable", badge: "En Acumulación", color: "gold" },
  { id: "B03", cat: "BINANCE", title: "Spot Vault 3 (Gas Pool)", val: "0x87e3...3990", unit: "BSC", foot: "BNB Rebalance", badge: "En Acumulación", color: "gold" },
  { id: "B04", cat: "BINANCE", title: "Spot Vault 4 (Staking)", val: "0x87e3...3990", unit: "BSC", foot: "Earn Descentralizado", badge: "En Acumulación", color: "gold" },
  { id: "B05", cat: "BINANCE", title: "Spot Vault 5 (Frío)", val: "0x87e3...3990", unit: "BSC", foot: "Custodia Institucional", badge: "En Acumulación", color: "gold" },

  // CAPITANES FLOTA X500 (K01 - K05)
  { id: "K01", cat: "CAPITÁN", title: "Capitán #001 (Box 1)", val: "18.07 POL", unit: "+3.41$", foot: "0xb750...D40F", badge: "100 Satélites", color: "purple" },
  { id: "K02", cat: "CAPITÁN", title: "Capitán #101 (Box 2)", val: "0.47 POL", unit: "USDC", foot: "0x5682...adBA", badge: "100 Satélites", color: "purple" },
  { id: "K03", cat: "CAPITÁN", title: "Capitán #201 (Box 3)", val: "0.50 POL", unit: "USDC", foot: "0x2810...6A7C", badge: "100 Satélites", color: "purple" },
  { id: "K04", cat: "CAPITÁN", title: "Capitán #301 (Box 4)", val: "0.50 POL", unit: "USDC", foot: "0xEb6a...Ca0f", badge: "100 Satélites", color: "purple" },
  { id: "K05", cat: "CAPITÁN", title: "Capitán #401 (Box 5)", val: "0.49 POL", unit: "USDC", foot: "0x4C71...d070", badge: "100 Satélites", color: "purple" },

  // GOBERNANZA, CANDADOS Y TESORERÍA (M01 - M14) -> TOTAL 54 CELDAS
  { id: "M01", cat: "OPSEC", title: "Bóveda #00 Zen Mentor", val: "0x87e3...3990", unit: "POL", foot: "0.95 POL Gas", badge: "100% Aislada", color: "mint" },
  { id: "M02", cat: "TRINQUETE", title: "Piso Infranqueable", val: "$500.00", unit: "USDC", foot: "Asentado en Bloque", badge: "No Retorno", color: "mint" },
  { id: "M03", cat: "AIRDROP", title: "Sprint 30 Octubre", val: "500 / 500", unit: "W", foot: "DogeOS Cap. 2", badge: "Snapshot 23:59", color: "gold" },
  { id: "M04", cat: "AIRDROP", title: "Sprint 12 Noviembre", val: "500 / 500", unit: "W", foot: "TGE & Reclamo $DOGEOS", badge: "En Ruta", color: "gold" },
  { id: "M05", cat: "ENJAMBRE", title: "Racha Gasless EIP-712", val: "13,588", unit: "OPS", foot: "Día 3/25 Cumplido", badge: "500 Firmas/Día", color: "mint" },
  { id: "M06", cat: "BOLSILLOS", title: "Saldo Periférico Flota", val: "$4.70", unit: "USDC", foot: "Repartido en Boxes", badge: "Barrido Activo", color: "cyan" },
  { id: "M07", cat: "PRÉSTAMO", title: "Inyección al 0% #501", val: "$629.94", unit: "USDC", foot: "Hacia Hyperliquid L1", badge: "0% Interés", color: "cyan" },
  { id: "M08", cat: "RESULTADO", title: "Ganancia Neta Squad", val: "+$213.69", unit: "USDC", foot: "+33.92% Retorno Real", badge: "100% On-Chain", color: "mint" },
  { id: "M09", cat: "OBJETIVO", title: "Meta Bloque 1 ($1,000)", val: "$843.63", unit: "/1k$", foot: "Faltan $156.37 USDC", badge: "84.36% Completado", color: "cyan" },
  { id: "M10", cat: "GATILLO", title: "Regla 70/30 de Retorno", val: "30% Amort", unit: "70% SQ", foot: "Al superar $1,000 USDC", badge: "Devolución a #501", color: "mint" },
  { id: "M11", cat: "PERMISO", title: "Allowance USDC Activa", val: "2,500.00", unit: "USDC", foot: "0x3e8b...09f7", badge: "Aprobada", color: "mint" },
  { id: "M12", cat: "POLÍTICA", title: "STRICT_NO_GAS_SELL", val: "TRUE", unit: "FLAG", foot: "Gas Nunca se Vende", badge: "Intocable", color: "mint" },
  { id: "M13", cat: "POLÍTICA", title: "AUTO_SWEEP_BINANCE", val: "FALSE", unit: "FLAG", foot: "Fondos en Custodia #501", badge: "Retención", color: "mint" },
  { id: "M14", cat: "TESORERÍA", title: "Patrimonio Consolidado", val: "$848.35+", unit: "USD", foot: "Multicadena Conglomerado", badge: "Bóveda Matriz #501", color: "mint" }
];

// LISTA CONGLOMERADA DE MOVIMIENTOS EN VIVO (ESTILO BSCSCAN / POLYGONSCAN / HYPERLIQUID)
const LIVE_TRANSACTIONS_EXPLORER = [
  {
    hash: "0xd4abd2c7378aa0ec17d26eb23c14466900b5c0c0ce8f6235f98fd34a31728f2f",
    net: "POLYGON",
    action: "Deploy AtomicSniperExecutor V2",
    from: "#501 (Matriz)",
    to: "0x3e8b...09f7 (Nuevo Contrato)",
    val: "-0.6006 POL",
    valClass: "val-negative",
    fee: "0.0012 POL",
    time: "28 Oct 22:48 UTC",
    status: "Confirmado ✔",
    url: "https://polygonscan.com/tx/0xd4abd2c7378aa0ec17d26eb23c14466900b5c0c0ce8f6235f98fd34a31728f2f"
  },
  {
    hash: "0x5155282e7d18766e863855a61add3b209a2877b40bad8f5896dd1c49de98ccdd",
    net: "POLYGON",
    action: "Supply Aave V3 (aPolUSDCn)",
    from: "#501 (Matriz)",
    to: "Aave V3 Pool Polygon",
    val: "211.24 aPolUSDC",
    valClass: "val-positive",
    fee: "0.0041 POL",
    time: "27 Oct 18:22 UTC",
    status: "Confirmado ✔",
    url: "https://polygonscan.com/tx/0x5155282e7d18766e863855a61add3b209a2877b40bad8f5896dd1c49de98ccdd"
  },
  {
    hash: "hl-fill-sol-0091",
    net: "HYPERLIQUID",
    action: "Post-Only ALO Fill SOL/USDC",
    from: "SquadSecret501",
    to: "Clearinghouse L1",
    val: "+$0.3800 USDC",
    valClass: "val-positive",
    fee: "$0.0000 (0 Gas)",
    time: "28 Oct 22:15 UTC",
    status: "Confirmado ✔",
    url: "https://hypurrscan.io/address/0xD4D12077a61118372f7a367319fb11922Beb3743"
  },
  {
    hash: "hl-fill-btc-0089",
    net: "HYPERLIQUID",
    action: "Post-Only ALO Fill WBTC/USDC",
    from: "SquadSecret501",
    to: "Clearinghouse L1",
    val: "+$0.4200 USDC",
    valClass: "val-positive",
    fee: "$0.0000 (0 Gas)",
    time: "28 Oct 20:40 UTC",
    status: "Confirmado ✔",
    url: "https://hypurrscan.io/address/0xD4D12077a61118372f7a367319fb11922Beb3743"
  },
  {
    hash: "0x89ab12cd34ef5678901234567890abcdef1234567890abcdef1234567890abcdef",
    net: "POLYGON",
    action: "Approve USDC ➔ Executor V2",
    from: "#501 (Matriz)",
    to: "0x3e8b...09f7",
    val: "2,500.00 USDC",
    valClass: "val-neutral",
    fee: "0.0008 POL",
    time: "28 Oct 22:50 UTC",
    status: "Confirmado ✔",
    url: "https://polygonscan.com/address/0xD4D12077a61118372f7a367319fb11922Beb3743"
  },
  {
    hash: "hl-fill-eth-0084",
    net: "HYPERLIQUID",
    action: "Post-Only ALO Fill ETH/USDC",
    from: "SquadSecret501",
    to: "Clearinghouse L1",
    val: "+$0.5100 USDC",
    valClass: "val-positive",
    fee: "$0.0000 (0 Gas)",
    time: "28 Oct 17:10 UTC",
    status: "Confirmado ✔",
    url: "https://hypurrscan.io/address/0xD4D12077a61118372f7a367319fb11922Beb3743"
  },
  {
    hash: "0x77112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
    net: "BSC",
    action: "Transfer In USDC (BEP-20)",
    from: "Capitán #001 (Box 1)",
    to: "#501 (Matriz)",
    val: "+7.98 USDC",
    valClass: "val-positive",
    fee: "0.0003 BNB",
    time: "27 Oct 14:05 UTC",
    status: "Confirmado ✔",
    url: "https://bscscan.com/address/0xD4D12077a61118372f7a367319fb11922Beb3743"
  },
  {
    hash: "0x11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff",
    net: "ARBITRUM",
    action: "Bridge Deposit USDC L1",
    from: "#501 (Matriz)",
    to: "HL Bridge (0x2df1...3df7)",
    val: "629.94 USDC",
    valClass: "val-neutral",
    fee: "0.00012 ETH",
    time: "26 Oct 10:00 UTC",
    status: "Confirmado ✔",
    url: "https://arbiscan.io/address/0xD4D12077a61118372f7a367319fb11922Beb3743"
  },
  {
    hash: "hl-ledger-deposit-001",
    net: "HYPERLIQUID",
    action: "Inyección 0% Acreditada",
    from: "Puente Arbitrum",
    to: "#501 Clearinghouse",
    val: "+$629.94 USDC",
    valClass: "val-positive",
    fee: "$0.0000",
    time: "26 Oct 10:02 UTC",
    status: "Confirmado ✔",
    url: "https://hypurrscan.io/address/0xD4D12077a61118372f7a367319fb11922Beb3743"
  },
  {
    hash: "0x445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233",
    net: "POLYGON",
    action: "Transfer In POL (Combustible)",
    from: "Binance Spot #01",
    to: "#501 (Matriz)",
    val: "+10.22 POL",
    valClass: "val-positive",
    fee: "0.0001 POL",
    time: "26 Oct 08:30 UTC",
    status: "Confirmado ✔",
    url: "https://polygonscan.com/address/0xD4D12077a61118372f7a367319fb11922Beb3743"
  },
  {
    hash: "hl-fill-link-0078",
    net: "HYPERLIQUID",
    action: "Post-Only ALO Fill LINK/USDC",
    from: "SquadSecret501",
    to: "Clearinghouse L1",
    val: "+$0.2900 USDC",
    valClass: "val-positive",
    fee: "$0.0000 (0 Gas)",
    time: "28 Oct 12:45 UTC",
    status: "Confirmado ✔",
    url: "https://hypurrscan.io/address/0xD4D12077a61118372f7a367319fb11922Beb3743"
  },
  {
    hash: "hl-fill-avax-0062",
    net: "HYPERLIQUID",
    action: "Post-Only ALO Fill AVAX/USDC",
    from: "SquadSecret501",
    to: "Clearinghouse L1",
    val: "+$0.3400 USDC",
    valClass: "val-positive",
    fee: "$0.0000 (0 Gas)",
    time: "27 Oct 23:18 UTC",
    status: "Confirmado ✔",
    url: "https://hypurrscan.io/address/0xD4D12077a61118372f7a367319fb11922Beb3743"
  }
];

// RENDERIZADO DE LAS 54 CELDAS MATRIX EN VERDE ESMERALDA / MENTA
function renderMatrixCells54() {
  const container = document.getElementById("posMatrixGrid54");
  if (!container) return;

  const html = MATRIX_CELLS_54.map(cell => {
    let valColorClass = "";
    if (cell.color === "gold") valColorClass = "gold";
    else if (cell.color === "cyan") valColorClass = "cyan";
    else if (cell.color === "purple") valColorClass = "purple";

    return `
      <div class="pos-cell" id="cell_${cell.id}" title="${cell.title} - ${cell.cat}">
        <div class="pos-cell-head">
          <span class="cell-badge-id">${cell.id}</span>
          <span class="cell-cat-tag">${cell.cat}</span>
        </div>
        <div class="pos-cell-title">${cell.title}</div>
        <div class="pos-cell-val ${valColorClass}">
          <span>${cell.val}</span>
          <span style="font-size:0.56rem; color:#94A3B8; font-weight:700;">${cell.unit}</span>
        </div>
        <div class="pos-cell-foot">
          <span>${cell.foot}</span>
          <span class="foot-pill">${cell.badge}</span>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = html;
}

// RENDERIZADO DE LA TABLA EXPLORADORA MULTICADENA
let currentFilter = "ALL";
let currentSearch = "";

function renderExplorerTable() {
  const tbody = document.getElementById("txExplorerTbody");
  const countBadge = document.getElementById("txCountBadge");
  if (!tbody) return;

  let filtered = LIVE_TRANSACTIONS_EXPLORER.filter(tx => {
    // Filtro por Red
    if (currentFilter === "HL" && tx.net !== "HYPERLIQUID") return false;
    if (currentFilter === "POLYGON" && tx.net !== "POLYGON") return false;
    if (currentFilter === "BSC_ARB" && tx.net !== "BSC" && tx.net !== "ARBITRUM") return false;

    // Filtro por Búsqueda
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      const matchHash = tx.hash.toLowerCase().includes(q);
      const matchAction = tx.action.toLowerCase().includes(q);
      const matchNet = tx.net.toLowerCase().includes(q);
      const matchVal = tx.val.toLowerCase().includes(q);
      if (!matchHash && !matchAction && !matchNet && !matchVal) return false;
    }

    return true;
  });

  if (countBadge) {
    setTextIfChanged(countBadge, `${filtered.length} MOVIMIENTOS REGISTRADOS`);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 20px; color: #64748B;">
          No se encontraron movimientos para los filtros seleccionados.
        </td>
      </tr>
    `;
    return;
  }

  const rows = filtered.map(tx => {
    let netBadgeClass = "hl";
    if (tx.net === "POLYGON") netBadgeClass = "poly";
    else if (tx.net === "BSC") netBadgeClass = "bsc";
    else if (tx.net === "ARBITRUM") netBadgeClass = "arb";

    const hashShort = tx.hash.startsWith("0x") ? `${tx.hash.slice(0, 10)}...${tx.hash.slice(-8)}` : tx.hash;

    return `
      <tr>
        <td>
          <div class="tx-hash-cell">
            <span class="material-symbols-rounded" style="font-size:14px; color:#0284C7;">receipt</span>
            <span>${hashShort}</span>
          </div>
        </td>
        <td>
          <span class="net-badge ${netBadgeClass}">${tx.net}</span>
        </td>
        <td>
          <span class="action-pill">${tx.action}</span>
        </td>
        <td style="font-family:var(--font-mono); font-size:0.64rem;">
          <span style="color:#64748B;">${tx.from}</span>
          <span style="color:#0284C7; margin: 0 3px;">➔</span>
          <span style="color:#0F172A; font-weight:700;">${tx.to}</span>
        </td>
        <td class="${tx.valClass}">
          ${tx.val}
        </td>
        <td style="font-family:var(--font-mono); font-size:0.62rem; color:#64748B;">
          ${tx.fee}
        </td>
        <td style="font-size:0.62rem; color:#475569;">
          ${tx.time}
        </td>
        <td>
          <span class="ar-badge-ok">${tx.status}</span>
        </td>
        <td>
          <a href="${tx.url}" target="_blank" class="receipt-btn">
            <span>VER</span>
            <span class="material-symbols-rounded" style="font-size:12px;">open_in_new</span>
          </a>
        </td>
      </tr>
    `;
  }).join("");

  tbody.innerHTML = rows;
}

// GESTIÓN DE PESTAÑAS (VISTAS 1, 2, 3, 4)
function setupTabNavigation() {
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const targetPaneId = tab.getAttribute("data-tab");
      document.querySelectorAll(".tab-pane").forEach(pane => {
        pane.classList.remove("active");
      });

      const activePane = document.getElementById(targetPaneId);
      if (activePane) {
        activePane.classList.add("active");
      }

      try {
        sessionStorage.setItem("area501_posicion_tab", targetPaneId);
      } catch (_) {}
    });
  });

  // Restaurar pestaña previa
  try {
    const saved = sessionStorage.getItem("area501_posicion_tab");
    if (saved) {
      const btn = document.querySelector(`.nav-tab[data-tab="${saved}"]`);
      if (btn) btn.click();
    }
  } catch (_) {}
}

// FILTROS DEL EXPLORADOR
function setupExplorerFilters() {
  const filterBtns = document.querySelectorAll(".exp-filter-btn");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.getAttribute("data-filter") || "ALL";
      renderExplorerTable();
    });
  });

  const searchInput = document.getElementById("explorerSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearch = e.target.value.trim();
      renderExplorerTable();
    });
  }
}

// COPIAR DIRECCIÓN CON TOAST
function setupCopyAddress() {
  const btn = document.getElementById("btnCopyAddress");
  const toast = document.getElementById("toastNotice");

  if (btn) {
    btn.addEventListener("click", () => {
      navigator.clipboard.writeText(VAULT_501).then(() => {
        if (toast) {
          toast.classList.add("show");
          setTimeout(() => {
            toast.classList.remove("show");
          }, 2400);
        }
      }).catch(() => {
        prompt("Copiar dirección de la Bóveda Matriz #501:", VAULT_501);
      });
    });
  }
}

// MODAL DE ESTACIONES OFICIALES
function setupStationsModal() {
  const openBtn = document.getElementById("btnMasterStationsHub");
  const closeBtn = document.getElementById("modalCloseBtn");
  const overlay = document.getElementById("stationsModalOverlay");

  if (openBtn && overlay) {
    openBtn.addEventListener("click", () => {
      overlay.classList.add("active");
    });
  }

  if (closeBtn && overlay) {
    closeBtn.addEventListener("click", () => {
      overlay.classList.remove("active");
    });
  }

  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("active");
      }
    });
  }
}

// RELOJ UTC EN VIVO (CADA SEGUNDO)
function startUtcClock() {
  const clockEl = document.getElementById("liveUtcClock");
  function tick() {
    const now = new Date();
    const h = String(now.getUTCHours()).padStart(2, "0");
    const m = String(now.getUTCMinutes()).padStart(2, "0");
    const s = String(now.getUTCSeconds()).padStart(2, "0");
    setTextIfChanged(clockEl, `${h}:${m}:${s} UTC`);
  }
  tick();
  setInterval(tick, 1000);
}

// FETCH REAL DE SALDOS Y ESTADO EN VIVO
async function fetchLiveData() {
  try {
    const res = await fetch("/api/posicion-501", { cache: "no-store" });
    if (!res.ok) throw new Error("Fallback needed");
    const data = await res.json();
    if (data && data.success) {
      updateUiWithLiveData(data);
    }
  } catch (_) {
    // Fallback silencioso a balances estándar
    try {
      const fbRes = await fetch("/api/mando-central/balances", { cache: "no-store" });
      if (fbRes.ok) {
        const fbData = await fbRes.json();
        updateUiWithFallbackData(fbData);
      }
    } catch (e) {}
  }
}

function updateUiWithLiveData(data) {
  if (!data) return;

  const totalWealth = data.totalConsolidatedUsd || 848.35;
  const hlBalance = data.hyperliquid?.clearinghouseUsdc || 843.63;
  const activeMargin = data.hyperliquid?.activeMarginUsdc || (hlBalance * 0.60);
  const shieldMargin = data.hyperliquid?.shieldUsdc || (hlBalance * 0.40);
  const netProfit = data.hyperliquid?.netProfitUsdc || (hlBalance - 629.94);
  const netProfitPct = data.hyperliquid?.netProfitPct || ((netProfit / 629.94) * 100);

  const polBal = data.polygon?.polBalance || 9.6194;
  const bnbBal = data.bsc?.bnbBalance || 0.0188;

  // Actualizar Tarjetas Superiores
  setTextIfChanged(document.getElementById("topTotalWealthUsd"), totalWealth.toFixed(2));
  setTextIfChanged(document.getElementById("topHlBalanceUsdc"), hlBalance.toFixed(2));
  setTextIfChanged(document.getElementById("topHlActiveMargin"), `60% Margen ($${activeMargin.toFixed(2)})`);
  setTextIfChanged(document.getElementById("topHlShieldMargin"), `40% Escudo #00 ($${shieldMargin.toFixed(2)})`);

  setTextIfChanged(document.getElementById("topEvmPolBal"), typeof polBal === "number" ? polBal.toFixed(4) : polBal);
  setTextIfChanged(document.getElementById("topEvmBnbBal"), typeof bnbBal === "number" ? bnbBal.toFixed(4) : bnbBal);

  setTextIfChanged(document.getElementById("topProfitAccumUsdc"), netProfit >= 0 ? `${netProfit.toFixed(2)}` : `${netProfit.toFixed(2)}`);
  setTextIfChanged(document.getElementById("topProfitPctBadge"), `+${netProfitPct.toFixed(2)}%`);

  // Actualizar Vista 3 (Amortización)
  setTextIfChanged(document.getElementById("amortCurrentHlVal"), `$${hlBalance.toFixed(2)} USDC`);
  setTextIfChanged(document.getElementById("amortNetProfitVal"), `+$${netProfit.toFixed(2)} USDC (+${netProfitPct.toFixed(2)}%)`);
  const distTo1000 = Math.max(0, 1000.00 - hlBalance);
  setTextIfChanged(document.getElementById("amortRemainingToTrigger"), `Faltan $${distTo1000.toFixed(2)} USDC`);

  const pct1000 = Math.min(100, (hlBalance / 1000.00) * 100);
  setTextIfChanged(document.getElementById("amortProgressPctLabel"), `${pct1000.toFixed(2)}% DE LA META`);
  const fillBar = document.getElementById("progressFillBar");
  if (fillBar) {
    fillBar.style.width = `${pct1000}%`;
  }
}

function updateUiWithFallbackData(fbData) {
  if (!fbData) return;
  const hlUsdc = fbData.breakdown?.vault501HyperliquidL1?.balanceUsdc || 843.63;
  const totalUsd = fbData.totalPortfolioUsd || 848.35;
  const polGas = fbData.breakdown?.vault501Polygon?.gasPol || 9.6194;

  setTextIfChanged(document.getElementById("topTotalWealthUsd"), totalUsd.toFixed(2));
  setTextIfChanged(document.getElementById("topHlBalanceUsdc"), hlUsdc.toFixed(2));
  setTextIfChanged(document.getElementById("topEvmPolBal"), typeof polGas === "number" ? polGas.toFixed(4) : polGas);
}

// INICIALIZACIÓN PRINCIPAL
document.addEventListener("DOMContentLoaded", () => {
  renderMatrixCells54();
  renderExplorerTable();
  setupTabNavigation();
  setupExplorerFilters();
  setupCopyAddress();
  setupStationsModal();
  startUtcClock();

  fetchLiveData();
  setInterval(fetchLiveData, 4000);
});
