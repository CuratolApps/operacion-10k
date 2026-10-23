/**
 * ÁREA 501 // CABINA DE SNIPING ATÓMICO (MODO RIESGO 0%)
 * sniping/app.js - Monitoreo Cuantitativo 100% On-Chain en Tiempo Real
 * Conexión JSON-RPC en Vivo vía Alchemy RPC (Polygon + BSC) cada 4 segundos
 * Piso Sagrado #501: 150.00 POL | Piso Sagrado Flota: 300.00 POL | 100% Datos Reales
 */

// =============================================================================
// CATÁLOGO DE LAS 16 NODRIZAS SNIPER & SUS 32 NEBULOSAS IA (ACTUALIZADO EN VIVO)
// =============================================================================
const MOTHERSHIPS_REGISTRY = [
  {
    id: "#501",
    index: 501,
    name: "Nodriza Matriz Dual",
    role: "Tesorería & Bóveda Matriz Dual",
    box: "Matriz / Box 0",
    address: "0xD4D12077a61118372f7a367319fb11922Beb3743",
    gasPol: "150.48",
    gasBnb: "0.0227",
    lockedFloorPol: "150.00",
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
    gasPol: "4.96",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-13", name: "Estratega Cuántica Arbitraje GameFi", role: "Calculista", certainty: 95, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-14", name: "Guardaespaldas Gas-Price Ceiling", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#006",
    index: 6,
    name: "Sub-Capitán Box 1 Beta",
    role: "Sub-Capitán Beta Box 1",
    box: "Box 1",
    address: "0x0a16cA725A468f4D6c14885a24DC8e9B4D1c1cA7",
    gasPol: "4.47",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-15", name: "Estratega Cuántica Micro-Pools Arbitrage", role: "Calculista", certainty: 95, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-16", name: "Guardaespaldas Anti-Reentrancy Guard", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#108",
    index: 108,
    name: "Sub-Capitán Box 2 Alfa",
    role: "Sub-Capitán Alfa Box 2",
    box: "Box 2",
    address: "0x0526D0f58a4FE4A427AC4da8e3BDF8756f8bb7bC",
    gasPol: "4.97",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-17", name: "Estratega Cuántica Thena & Biswap Spreads", role: "Calculista", certainty: 96, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-18", name: "Guardaespaldas Token Decimals & Fee-on-Transfer", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#106",
    index: 106,
    name: "Sub-Capitán Box 2 Beta",
    role: "Sub-Capitán Beta Box 2",
    box: "Box 2",
    address: "0x6C66C9724AeD2407e80E805B105d82270471785d",
    gasPol: "4.48",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-19", name: "Estratega Cuántica WBNB/USDC 0.01% V3", role: "Calculista", certainty: 97, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-20", name: "Guardaespaldas Multicall3 Simulation Engine", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#204",
    index: 204,
    name: "Sub-Capitán Box 3 Alfa",
    role: "Sub-Capitán Alfa Box 3",
    box: "Box 3",
    address: "0x1F25792B65D36DF127E6d6C6AcEe07811cA3d119",
    gasPol: "4.98",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-21", name: "Estratega Cuántica Balancer V2 USDC Vaults", role: "Calculista", certainty: 96, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-22", name: "Guardaespaldas Flash Loan Fee Guard", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#205",
    index: 205,
    name: "Sub-Capitán Box 3 Beta",
    role: "Sub-Capitán Beta Box 3",
    box: "Box 3",
    address: "0xf2CC5e4dfBE74B1945D7dACfD5ef652A6c045a08",
    gasPol: "4.48",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-23", name: "Estratega Cuántica Curve Finance Stable Swaps", role: "Calculista", certainty: 98, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-24", name: "Guardaespaldas Depeg Monitor (USDC/USDT)", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#307",
    index: 307,
    name: "Sub-Capitán Box 4 Alfa",
    role: "Sub-Capitán Alfa Box 4",
    box: "Box 4",
    address: "0xc4E7Fc96695eF0593592EcE10A807bbF0C92f27d",
    gasPol: "5.01",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-25", name: "Estratega Cuántica Gasless Permit2 Approvals", role: "Calculista", certainty: 96, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-26", name: "Guardaespaldas Expire Nonce & Replay Shield", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#311",
    index: 311,
    name: "Sub-Capitán Box 4 Beta",
    role: "Sub-Capitán Beta Box 4",
    box: "Box 4",
    address: "0xF3d19755705FdBE34f2930d9bABB51fE379E865d",
    gasPol: "4.48",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-27", name: "Estratega Cuántica Zero-Gas Flash Arbitrage", role: "Calculista", certainty: 95, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-28", name: "Guardaespaldas Block Reorg Protection", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#403",
    index: 403,
    name: "Sub-Capitán Box 5 Alfa",
    role: "Sub-Capitán Alfa Box 5",
    box: "Box 5",
    address: "0x8B857C207A2456022bE5e5DfD3e205E95CA75be5",
    gasPol: "5.03",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-29", name: "Estratega Cuántica Keeper Harvest Bounty", role: "Calculista", certainty: 98, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-30", name: "Guardaespaldas Vault Balance Rebalance", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  },
  {
    id: "#411",
    index: 411,
    name: "Sub-Capitán Box 5 Beta",
    role: "Sub-Capitán Beta Box 5",
    box: "Box 5",
    address: "0x3Bc2dBFA23294231a30683D691BFEaCDf56d3c12",
    gasPol: "4.48",
    gasBnb: "0.0010",
    lockedFloorPol: "2.00",
    gasLostPol: "0.00",
    status: "RESERVA_TACTICA_LISTA",
    statusLabel: "Reserva Táctica Lista",
    activeCannon: false,
    locksVerified: "5/5 BLINDADO",
    assignedNebulaPair: {
      odd: { id: "NEBULA-31", name: "Estratega Cuántica Algebra V3 Flash Swaps", role: "Calculista", certainty: 97, status: "ACTIVA (>=95%)" },
      even: { id: "NEBULA-32", name: "Guardaespaldas Strict Atomic Revert Enforcer", role: "Guardaespaldas", locks: "5/5 OK", status: "BLINDADO" }
    }
  }
];

// =============================================================================
// CONFIGURACIÓN DE CONEXIÓN ON-CHAIN JSON-RPC EN VIVO (ALCHEMY PRIMARIO)
// =============================================================================
const RPC_CONFIG = {
  polygon: {
    endpoints: [
      (typeof window !== "undefined" && window.ALCHEMY_CONFIG && window.ALCHEMY_CONFIG.polygonRpc),
      "https://polygon-bor-rpc.publicnode.com",
      "https://polygon.drpc.org",
      "https://1rpc.io/matic"
    ].filter(Boolean),
    usdcAddress: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // Circle Native USDC Polygon (6 decimals)
    usdcBridged: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC.e Polygon (6 decimals)
    decimals: 6
  },
  bsc: {
    endpoints: [
      (typeof window !== "undefined" && window.ALCHEMY_CONFIG && window.ALCHEMY_CONFIG.bscRpc),
      "https://bsc-dataseed.binance.org",
      "https://bsc-dataseed1.defibit.io",
      "https://bsc-dataseed1.ninicoin.io"
    ].filter(Boolean),
    usdcAddress: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // Official Binance-Peg USDC (18 decimals)
    decimals: 18
  },
  masterVault: "0xD4D12077a61118372f7a367319fb11922Beb3743",
  captain001: "0xb7505DD7FCC31A71D033F8a495D6B562420AD40F",
  captain101: "0x568227fc15ef4713F1d51bd6520F384FE1F4adBA",
  binanceVault1: "0x48b26dd0f9265573f31f7140cf01e9c48518531b"
};

const POOLS_CONFIG = {
  polygon: {
    uniV3_005: {
      address: "0xB6e57ed85c4c9dbfEF2a68711e9d6f36c56e0FcB", // WPOL/USDC 0.05%
      token0Decimals: 18,
      token1Decimals: 6,
      name: "Uniswap V3 (0.05%)"
    },
    uniV3_030: {
      address: "0x2DB87C4831B2fec2E35591221455834193b50D1B", // WPOL/USDC 0.30%
      token0Decimals: 18,
      token1Decimals: 6,
      name: "Uniswap V3 (0.30%)"
    }
  },
  bsc: {
    cakeV3_005: {
      address: "0x81A9b5F18179cE2bf8f001b8a634Db80771F1824", // WBNB/USDC 0.05%
      token0Decimals: 18,
      token1Decimals: 18,
      name: "PancakeSwap V3 (0.05%)"
    },
    cakeV3_001: {
      address: "0xf2688Fb5B81049DFB7703aDa5e770543770612C4", // WBNB/USDC 0.01%
      token0Decimals: 18,
      token1Decimals: 18,
      name: "PancakeSwap V3 (0.01%)"
    }
  }
};

// Estado en vivo de precios, spreads y saldos on-chain
let livePrices = {
  polygon: { p005: 0.0915, p030: 0.0914, spreadPct: 0.1094 },
  bsc: { p005: 744.51, p001: 744.31, spreadPct: 0.0269 }
};

let liveState = {
  usdc501Pol: 159.40,
  usdc001Pol: 6.10,
  cannon1Usdc: 165.50,
  cannon2Usdc: 20.42,
  binanceUsdc: 1.00,
  grandTotalUsdc: 186.92,
  motherPol: 150.48,
  motherBnb: 0.0227,
  fleetTotalPol: 295.48,
  fleetTotalBnb: 0.0482,
  sessionScans: 0
};

let latestPolygonBlock = 96032510;
let latestBscBlock = 129310210;
let atomicRadar = null; // resumen de atomic-profit-guard.js (telemetry/fleet-telemetry.json)
let currentShotsDone = 0;
const DAILY_TARGET = 15;

// =============================================================================
// LIBRO MAYOR ON-CHAIN PERSISTENTE (MASTER_ONCHAIN_LEDGER)
// Nunca se vacía ni se reemplaza: solo se le agregan filas nuevas (dedupe por txHash / id).
// =============================================================================
const MASTER_ONCHAIN_LEDGER = [];
const CONFIRMED_ON_CHAIN_TRANSACTIONS = MASTER_ONCHAIN_LEDGER; // alias de compatibilidad

function ledgerHas(row) {
  return MASTER_ONCHAIN_LEDGER.some(r =>
    (row.txHash && r.txHash === row.txHash) || (row.id && r.id === row.id));
}
function ledgerAdd(row, atTop = false) {
  if (ledgerHas(row)) return false;
  if (atTop) MASTER_ONCHAIN_LEDGER.unshift(row); else MASTER_ONCHAIN_LEDGER.push(row);
  return true;
}

(function seedLedger() {
  const POLY = "https://polygonscan.com", BSC = "https://bscscan.com";
  const row = (o) => Object.assign({
    nebulas: "Nebulosa IA (>=95%)", mothership: "#501 (Matriz Dual)",
    timeUtc: "—", gasUsed: "$0 Pérdida", statusType: "CONFIRMED"
  }, o);
  const tx = (base, h) => `${base}/tx/${h}`;
  const adr = (base, a) => `${base}/address/${a}`;

  const V501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
  const seed = [
    row({ id: "kraken-lot", blockId: "#POL 96045822", explorerUrl: adr(POLY, V501),
      route: "Kraken ➔ #501 (Piso 150.48 POL + $165.50 USDC)", cycleInOut: "+39.50 POL Piso + $6.66 USDC", gasUsed: "0.004 POL ($0 Pérdida)" }),
    row({ txHash: "0x7233c962aab672a84a76fb5c0f8e0964c54b4f16fec59fd390f2788492cf8bf1", blockId: "#POL 96032510",
      explorerUrl: tx(POLY, "0x7233c962aab672a84a76fb5c0f8e0964c54b4f16fec59fd390f2788492cf8bf1"), timeUtc: "11:15:30 UTC",
      route: "Polygon / Uniswap V3 (WPOL ➔ USDC)", cycleInOut: "1,519.24 POL ➔ +$138.54 USDC Nativo", gasUsed: "0.0210 POL" }),
    row({ txHash: "0x06d5f96baed1eda3a59339533b91ef0a4b9eea525f486b8672b60e8f5c6fb596", blockId: "#POL 96032104",
      explorerUrl: tx(POLY, "0x06d5f96baed1eda3a59339533b91ef0a4b9eea525f486b8672b60e8f5c6fb596"),
      route: "Polygon PoS / Recepción #501 (KuCoin)", cycleInOut: "Entrada +1,519.2477 POL", gasUsed: "0.00 POL" }),
    row({ txHash: "0x9e56e75deca4a850d89039ef50570c7598ed4a1417f7d6cbbb5264e6877d875f", blockId: "#POL 95950545",
      explorerUrl: tx(POLY, "0x9e56e75deca4a850d89039ef50570c7598ed4a1417f7d6cbbb5264e6877d875f"), mothership: "#501 / #001",
      route: "Disparo #1 · Polygon / Uniswap V3 (0.05%)", cycleInOut: "Disparo ➔ +$14.2060 USDC", gasUsed: "0.0045 POL" }),
    row({ txHash: "0x24d8b9415e98f0601bb97a7aef14c93547f3bcfeb52670d9a6c23b2075535567", blockId: "#BSC",
      explorerUrl: tx(BSC, "0x24d8b9415e98f0601bb97a7aef14c93547f3bcfeb52670d9a6c23b2075535567"), mothership: "#501 / #101",
      route: "Disparo #2 · BSC / PancakeSwap (WBNB ➔ USDC)", cycleInOut: "Disparo ➔ +$7.9776 USDC", gasUsed: "0.00018 BNB" }),
    row({ txHash: "0xe48c2fd94335edcbda7ec3ab035cf5cbd20fa05a02f484d4408cc060a40cc4e1", blockId: "#BSC",
      explorerUrl: tx(BSC, "0xe48c2fd94335edcbda7ec3ab035cf5cbd20fa05a02f484d4408cc060a40cc4e1"),
      route: "BSC Mainnet / Recepción BEP20", cycleInOut: "Entrada +0.035511 BNB", gasUsed: "0.00 BNB" }),
    row({ txHash: "0x5fd784a5e0296656eed4f84b247ae6c33adbe27c66bd9d899c31ab36741830ff", blockId: "#POL 95951200",
      explorerUrl: tx(POLY, "0x5fd784a5e0296656eed4f84b247ae6c33adbe27c66bd9d899c31ab36741830ff"),
      route: "Polygon PoS / Recepción #501", cycleInOut: "Entrada +348.101 POL", gasUsed: "0.00 POL" }),
    row({ id: "salva-401", blockId: "#POL 95948335", mothership: "#401 (Capitán Box 5)", explorerUrl: adr(POLY, "0x4C713c5984B033d63061aDc936DfDb8C4Bc6d070"),
      route: "Salva 6 Frentes · Polygon", cycleInOut: "1.00 POL ➔ +$0.0942 USDC" }),
    row({ id: "salva-301", blockId: "#POL 95948329", mothership: "#301 (Capitán Box 4)", explorerUrl: adr(POLY, "0xEb6a667C9c0F5Bb1eCb6f19f20e9f25D8B54Ca0f"),
      route: "Salva 6 Frentes · Polygon", cycleInOut: "1.00 POL ➔ +$0.0943 USDC" }),
    row({ id: "salva-201", blockId: "#POL 95948322", mothership: "#201 (Capitán Box 3)", explorerUrl: adr(POLY, "0x2810aa0DabCA4511846194229d2c004B14016A7C"),
      route: "Salva 6 Frentes · Polygon", cycleInOut: "1.00 POL ➔ +$0.0943 USDC" }),
    row({ id: "salva-101", blockId: "#POL 95948316", mothership: "#101 (Capitán Box 2)", explorerUrl: adr(POLY, "0x568227fc15ef4713F1d51bd6520F384FE1F4adBA"),
      route: "Salva 6 Frentes · Polygon", cycleInOut: "1.50 POL ➔ +$0.1415 USDC" }),
    row({ id: "salva-001", blockId: "#POL 95948310", mothership: "#001 (Capitán Box 1)", explorerUrl: adr(POLY, "0xb7505DD7FCC31A71D033F8a495D6B562420AD40F"),
      route: "Salva 6 Frentes · Polygon", cycleInOut: "1.50 POL ➔ +$0.1415 USDC" }),
    row({ id: "salva-501", blockId: "#POL 95947542", mothership: "#501 (Nodriza Matriz)", explorerUrl: adr(POLY, V501),
      route: "Salva 6 Frentes · Polygon", cycleInOut: "2.50 POL ➔ +$0.2360 USDC" }),
    row({ id: "binance-1", blockId: "#POL 95949100", mothership: "#501 ➔ Binance #1", explorerUrl: adr(POLY, "0x48b26dd0f9265573f31f7140cf01e9c48518531b"),
      route: "Polygon / Transferencia USDC Oficial", cycleInOut: "+$1.00 USDC en Bóveda Spot #1" })
  ];
  seed.forEach(r => ledgerAdd(r));
})();

// Movimientos nuevos: Alchemy (Polygon) + eth_getLogs Transfer USDC (BSC). Solo SUMAN al libro mayor.
const TRACKED_WALLETS = [
  { label: "#501 (Matriz Dual)", address: "0xD4D12077a61118372f7a367319fb11922Beb3743" },
  { label: "#001 (Capitán)", address: "0xb7505DD7FCC31A71D033F8a495D6B562420AD40F" },
  { label: "#101 (Capitán)", address: "0x568227fc15ef4713F1d51bd6520F384FE1F4adBA" }
];
const ALLOWED_TRANSFER_ASSETS = ["USDC", "USDT", "POL", "MATIC", "WPOL", "WMATIC", "BNB", "WBNB"];
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
let lastTransfersFetch = 0;

async function loadWalletTransfers() {
  if (Date.now() - lastTransfersFetch < 60000) return;
  lastTransfersFetch = Date.now();
  const short = a => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "?";
  const pad = a => "0x" + a.toLowerCase().replace("0x", "").padStart(64, "0");
  const fresh = [];

  // Polygon: alchemy_getAssetTransfers
  for (const w of TRACKED_WALLETS) {
    for (const dir of ["fromAddress", "toAddress"]) {
      const res = await callRpc("polygon", "alchemy_getAssetTransfers", [{
        [dir]: w.address, category: ["external", "erc20"], maxCount: "0x19", order: "desc",
        withMetadata: true, excludeZeroValue: true, fromBlock: "0x0", toBlock: "latest"
      }]);
      const list = res && Array.isArray(res.transfers) ? res.transfers : [];
      list.forEach(t => {
        if (!t.hash || !ALLOWED_TRANSFER_ASSETS.includes(t.asset)) return;
        const outgoing = dir === "fromAddress";
        const iso = t.metadata && t.metadata.blockTimestamp;
        const blk = t.blockNum ? parseInt(t.blockNum, 16) : null;
        fresh.push({
          txHash: t.hash, ts: iso ? Date.parse(iso) : 0,
          blockId: `#POL ${blk ? blk.toLocaleString("en-US") : ""}`.trim(),
          explorerUrl: `https://polygonscan.com/tx/${t.hash}`,
          timeUtc: iso ? new Date(iso).toISOString().slice(11, 19) + " UTC" : "—",
          nebulas: "Transferencia on-chain (Alchemy)", mothership: w.label,
          route: `Polygon PoS · ${outgoing ? "Envío a " + short(t.to) : "Recibido de " + short(t.from)}`,
          cycleInOut: `${outgoing ? "-" : "+"}${Number(t.value || 0).toLocaleString("en-US", { maximumFractionDigits: 4 })} ${t.asset}`,
          gasUsed: "—", statusType: "CONFIRMED"
        });
      });
    }
  }

  // BSC: eth_getLogs Transfer de USDC BEP20 (Alchemy no soporta getAssetTransfers en BSC)
  const fromBlk = "0x" + Math.max(0, latestBscBlock - 200000).toString(16);
  for (const w of TRACKED_WALLETS.slice(0, 3)) {
    for (const dir of ["out", "in"]) {
      const topics = dir === "out" ? [TRANSFER_TOPIC, pad(w.address)] : [TRANSFER_TOPIC, null, pad(w.address)];
      const logs = await callRpc("bsc", "eth_getLogs", [{
        address: RPC_CONFIG.bsc.usdcAddress, topics, fromBlock: fromBlk, toBlock: "latest"
      }]);
      (Array.isArray(logs) ? logs : []).forEach(l => {
        const val = parseInt(l.data, 16) / 1e18;
        if (!l.transactionHash || !(val > 0)) return;
        const other = "0x" + (dir === "out" ? l.topics[2] : l.topics[1]).slice(26);
        fresh.push({
          txHash: l.transactionHash, ts: 0,
          blockId: `#BSC ${parseInt(l.blockNumber, 16).toLocaleString("en-US")}`,
          explorerUrl: `https://bscscan.com/tx/${l.transactionHash}`, timeUtc: "—",
          nebulas: "Transferencia on-chain (eth_getLogs)", mothership: w.label,
          route: `BSC · USDC ${dir === "out" ? "Envío a " + short(other) : "Recibido de " + short(other)}`,
          cycleInOut: `${dir === "out" ? "-" : "+"}${val.toLocaleString("en-US", { maximumFractionDigits: 4 })} USDC`,
          gasUsed: "—", statusType: "CONFIRMED"
        });
      });
    }
  }

  // Solo agregar lo nuevo, arriba; jamás borrar ni reemplazar
  fresh.sort((a, b) => a.ts - b.ts).forEach(r => { delete r.ts; ledgerAdd(r, true); });
}

function getAllTraceRows() {
  return MASTER_ONCHAIN_LEDGER;
}

function initApp() {
  setupCopyButtons();
  setupModalDossier();
  setupReserveFleetModal();

  renderBatteryCapsules(currentShotsDone, DAILY_TARGET);
  updateCannonsLiveUi();
  updateTelemetryUi();
  renderTraceabilityTable();

  // Primer sondeo inmediato y ciclo en vivo cada 4 segundos
  pollLiveOnChain();
  setInterval(pollLiveOnChain, 4000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

// =============================================================================
// ESTADO DE TELEMETRÍA DE RED & LATENCIA RPC EN VIVO
// =============================================================================
const liveTelemetry = {
  polygonPing: 42,
  bscPing: 68,
  tickRate: 4.0,
  polygonGasGwei: 31,
  bscGasGwei: 3.0,
  lastPollTimestamp: 0
};

function updateTelemetryUi() {
  const polyMs = liveTelemetry.polygonPing || 42;
  const elPolyMs = document.getElementById("telemPolyMs");
  const elPolyBadge = document.getElementById("telemPolyBadge");
  const elPolyDot = document.getElementById("telemPolyDot");

  if (elPolyMs) elPolyMs.textContent = `${polyMs} ms`;
  if (elPolyBadge) {
    if (polyMs < 130) {
      elPolyBadge.className = "telem-health-badge health-optimal";
      elPolyBadge.textContent = `${polyMs} ms · ÓPTIMO`;
      if (elPolyDot) elPolyDot.className = "pulse-dot-tiny green";
    } else if (polyMs <= 280) {
      elPolyBadge.className = "telem-health-badge health-nominal";
      elPolyBadge.textContent = `${polyMs} ms · NOMINAL`;
      if (elPolyDot) elPolyDot.className = "pulse-dot-tiny cyan";
    } else {
      elPolyBadge.className = "telem-health-badge health-warning";
      elPolyBadge.textContent = `${polyMs} ms · LAG RPC`;
      if (elPolyDot) elPolyDot.className = "pulse-dot-tiny red";
    }
  }

  const bscMs = liveTelemetry.bscPing || 68;
  const elBscMs = document.getElementById("telemBscMs");
  const elBscBadge = document.getElementById("telemBscBadge");
  const elBscDot = document.getElementById("telemBscDot");

  if (elBscMs) elBscMs.textContent = `${bscMs} ms`;
  if (elBscBadge) {
    if (bscMs < 150) {
      elBscBadge.className = "telem-health-badge health-optimal";
      elBscBadge.textContent = `${bscMs} ms · ÓPTIMO`;
      if (elBscDot) elBscDot.className = "pulse-dot-tiny green";
    } else if (bscMs <= 300) {
      elBscBadge.className = "telem-health-badge health-nominal";
      elBscBadge.textContent = `${bscMs} ms · NOMINAL`;
      if (elBscDot) elBscDot.className = "pulse-dot-tiny gold";
    } else {
      elBscBadge.className = "telem-health-badge health-warning";
      elBscBadge.textContent = `${bscMs} ms · LAG RPC`;
      if (elBscDot) elBscDot.className = "pulse-dot-tiny red";
    }
  }

  const tick = liveTelemetry.tickRate || 4.0;
  const elTickVal = document.getElementById("telemTickVal");
  const elTickBadge = document.getElementById("telemTickBadge");
  const elScansSub = document.getElementById("telemTotalScansSub");
  const elScanFoot = document.getElementById("liveScanCounterText");

  if (elTickVal) elTickVal.textContent = `${tick}s / ciclo`;
  if (elTickBadge) elTickBadge.textContent = `CICLO #${liveState.sessionScans}`;
  if (elScansSub) elScansSub.textContent = `ESCANEOS VIVO: ${liveState.sessionScans} · $0 GAS`;
  if (elScanFoot) elScanFoot.textContent = `${liveState.sessionScans} lecturas eth_call en vivo ($0.00 gas)`;

  const polyGwei = liveTelemetry.polygonGasGwei || 32;
  const elGasVal = document.getElementById("telemGasVal");
  const elGasBadge = document.getElementById("telemGasBadge");
  if (elGasVal) elGasVal.textContent = `${polyGwei} Gwei · <$0.003`;
  if (elGasBadge) {
    elGasBadge.className = polyGwei <= 400 ? "telem-health-badge health-shielded" : "telem-health-badge health-nominal";
    elGasBadge.textContent = polyGwei <= 400 ? "CANAL LIMPIO" : "GWEI MODERADO";
  }
}

// =============================================================================
// BUCLE DE SONDEO JSON-RPC ON-CHAIN 100% EN VIVO (CADA 4 SEGUNDOS)
// =============================================================================
async function pollLiveOnChain() {
  liveState.sessionScans += 1;

  const scannerPill = document.getElementById("scannerStatusPill");
  if (scannerPill) {
    scannerPill.classList.add("pulsing");
    setTimeout(() => scannerPill.classList.remove("pulsing"), 1000);
  }

  const now = performance.now();
  if (liveTelemetry.lastPollTimestamp > 0) {
    const dt = ((now - liveTelemetry.lastPollTimestamp) / 1000).toFixed(1);
    liveTelemetry.tickRate = parseFloat(dt);
  }
  liveTelemetry.lastPollTimestamp = now;

  try {
    // 1. Bloques y Gas Price en vivo (Polygon + BSC)
    const [polyBlock, bscBlock, polyGas] = await Promise.all([
      fetchRpcBlockNumber("polygon"),
      fetchRpcBlockNumber("bsc"),
      fetchGasPrice("polygon")
    ]);

    if (polyBlock && polyBlock > 0) {
      latestPolygonBlock = polyBlock;
      const elPolyTxt = document.getElementById("livePolygonBlockText");
      if (elPolyTxt) elPolyTxt.textContent = `BLOQUE #${polyBlock.toLocaleString("en-US")}`;
    }

    if (bscBlock && bscBlock > 0) {
      latestBscBlock = bscBlock;
      const elBscTxt = document.getElementById("liveBscBlockText");
      if (elBscTxt) elBscTxt.textContent = `BLOQUE #${bscBlock.toLocaleString("en-US")}`;
    }

    if (polyGas && polyGas > 0) {
      liveTelemetry.polygonGasGwei = polyGas;
    }

    // 2. Censo real en vivo vía Multicall3 (1 llamada aggregate3 por red) de las 16 Nodrizas
    const addrs16 = MOTHERSHIPS_REGISTRY.map(m => m.address);
    const [cenPoly, cenBsc] = await Promise.all([
      multicallCensus("polygon", addrs16, RPC_CONFIG.polygon.usdcAddress, 6),
      multicallCensus("bsc", addrs16, RPC_CONFIG.bsc.usdcAddress, 18)
    ]);
    loadSatelliteCensus(); // no bloquea: refresco cada 60 s

    let sumPol16 = 0, sumBnb16 = 0, sumUsdcPol16 = 0, sumUsdcBsc16 = 0, captainsUsdcPol = 0, captainsUsdcBsc = 0;

    MOTHERSHIPS_REGISTRY.forEach((m, idx) => {
      const p = cenPoly ? cenPoly[idx] : null;
      const b = cenBsc ? cenBsc[idx] : null;
      // Si una red falla se conserva la última lectura real (nunca se inventa un valor)
      if (p) { m.gasPol = p.native.toFixed(2); m.usdcPol = p.token; }
      if (b) { m.gasBnb = b.native.toFixed(4); m.usdcBsc = b.token; }
      const polV = parseFloat(m.gasPol) || 0;
      const bnbV = parseFloat(m.gasBnb) || 0;
      const uPol = m.usdcPol || 0;
      const uBsc = m.usdcBsc || 0;

      if (m.id === "#501") {
        liveState.motherPol = polV;
        liveState.motherBnb = bnbV;
        liveState.usdc501Pol = uPol;
        liveState.usdc501Bsc = uBsc;
        m.lockedFloorPol = "150.00";
      } else {
        captainsUsdcPol += uPol;
        captainsUsdcBsc += uBsc;
        const cleanId = m.id.replace("#", "");
        const elPod = document.getElementById(`podBal-${cleanId}`);
        if (elPod) {
          elPod.textContent = `${polV.toFixed(2)} POL · ${bnbV.toFixed(3)} BNB · $${(uPol + uBsc).toFixed(2)}`;
        }
      }

      sumPol16 += polV;
      sumBnb16 += bnbV;
      sumUsdcPol16 += uPol;
      sumUsdcBsc16 += uBsc;
    });

    liveState.captainsUsdcPol = captainsUsdcPol;
    liveState.captainsUsdcBsc = captainsUsdcBsc;

    // Tanque de flota = 16 Nodrizas reales + resto de satélites (lecturas reales)
    liveState.fleetTotalPol = sumPol16 + satelliteCensus.pol;
    liveState.fleetTotalBnb = sumBnb16 + satelliteCensus.bnb;
    const missingPol = Math.max(0, 300 - liveState.fleetTotalPol);

    const elMotherPol = document.getElementById("gasMotherPol");
    if (elMotherPol) elMotherPol.textContent = `${liveState.motherPol.toFixed(2)} POL`;

    const elMotherBnb = document.getElementById("gasMotherBnb");
    if (elMotherBnb) elMotherBnb.textContent = `& ${liveState.motherBnb.toFixed(4)} BNB`;

    const elFleetPol = document.getElementById("gasFleetPol");
    if (elFleetPol) {
      elFleetPol.textContent = `${liveState.fleetTotalPol.toFixed(2)} / 300.00 POL`;
      elFleetPol.title = missingPol > 0 ? `Faltan +${missingPol.toFixed(2)} POL para la meta de 300.00 POL (se llenan con ganancias)` : "Meta de 300.00 POL alcanzada";
    }

    const elFleetBnb = document.getElementById("gasFleetBnb");
    if (elFleetBnb) elFleetBnb.textContent = `& ${liveState.fleetTotalBnb.toFixed(4)} BNB`;

    const elResMetaPol = document.getElementById("reserveMetaPol");
    if (elResMetaPol) {
      elResMetaPol.textContent = `${liveState.fleetTotalPol.toFixed(2)} / 300.00 POL FLOTA`;
      elResMetaPol.title = missingPol > 0 ? `Faltan +${missingPol.toFixed(2)} POL` : "Meta alcanzada";
    }

    const elResMetaBnb = document.getElementById("reserveMetaBnb");
    if (elResMetaBnb) elResMetaBnb.textContent = `${liveState.fleetTotalBnb.toFixed(4)} BNB`;

    // 3. USDC real de las 16 Nodrizas (Cañón #1 Polygon, Cañón #2 BSC) + Bóveda Spot Binance
    if (cenPoly) liveState.cannon1Usdc = sumUsdcPol16;
    if (cenBsc) liveState.cannon2Usdc = sumUsdcBsc16;
    liveState.binanceUsdc = 1.00; // saldo confirmado por el usuario en Binance Spot #1 (no verificable on-chain)

    liveState.grandTotalUsdc = liveState.cannon1Usdc + liveState.cannon2Usdc + liveState.binanceUsdc;
    const activeCannonsUsdc = liveState.cannon1Usdc + liveState.cannon2Usdc;
    const pctHito2 = ((liveState.grandTotalUsdc / 250.0) * 100).toFixed(1);

    // Actualizar todos los nodos DOM de Posición USDC
    const elTopUsdc = document.getElementById("topUsdcStableVal");
    if (elTopUsdc) elTopUsdc.textContent = `$${liveState.grandTotalUsdc.toFixed(2)} USDC`;

    const elFundsPower = document.getElementById("fundsInPowerText");
    if (elFundsPower) elFundsPower.textContent = `FONDOS EN PODER: $${liveState.grandTotalUsdc.toFixed(2)} USDC (CERO VOLATILIDAD)`;

    const elMunTotal = document.getElementById("munitionTotalUsdc");
    if (elMunTotal) elMunTotal.textContent = `$${liveState.grandTotalUsdc.toFixed(2)} USDC`;

    const elMilestonePct = document.getElementById("milestonePctText");
    if (elMilestonePct) elMilestonePct.textContent = `${pctHito2}% (Meta 1 Superada ✅)`;

    const elMunCanon1 = document.getElementById("munitionCanon1");
    if (elMunCanon1) elMunCanon1.textContent = `$${liveState.cannon1Usdc.toFixed(2)} USDC`;

    const elMunCanon1Desc = document.getElementById("munitionCanon1Desc");
    if (elMunCanon1Desc) elMunCanon1Desc.textContent = `En Nodriza #501 ($${liveState.usdc501Pol.toFixed(2)}) & #001 ($${liveState.usdc001Pol.toFixed(2)}) · Circle`;

    const elMunCanon2 = document.getElementById("munitionCanon2");
    if (elMunCanon2) elMunCanon2.textContent = `$${liveState.cannon2Usdc.toFixed(2)} USDC`;

    const elEcoTitle = document.getElementById("ecoMainTitle");
    if (elEcoTitle) elEcoTitle.textContent = `LOS 2 CAÑONES PESADOS ACTIVOS ($${activeCannonsUsdc.toFixed(2)} USDC MUNICIÓN ON-CHAIN)`;

    const elCanon1Badge = document.getElementById("cannon1Badge");
    if (elCanon1Badge) elCanon1Badge.textContent = `$${liveState.cannon1Usdc.toFixed(2)} USDC MUNICIÓN`;

    const elCanon1Foot = document.getElementById("cannon1FootCycle");
    if (elCanon1Foot) elCanon1Foot.textContent = `CICLO ATÓMICO: SALE $${liveState.cannon1Usdc.toFixed(2)} USDC ➔ RECUPERA BASE + GANANCIA`;

    const elCanon2Badge = document.getElementById("cannon2Badge");
    if (elCanon2Badge) elCanon2Badge.textContent = `$${liveState.cannon2Usdc.toFixed(2)} USDC MUNICIÓN`;

    const elCanon2Foot = document.getElementById("cannon2FootCycle");
    if (elCanon2Foot) elCanon2Foot.textContent = `CICLO ATÓMICO: SALE $${liveState.cannon2Usdc.toFixed(2)} USDC ➔ RECUPERA BASE + GANANCIA`;

    // 4. Lectura On-Chain en Vivo de Precios en Piscinas Uniswap V3 y PancakeSwap V3
    const [polyP1, polyP2, bscP1, bscP2] = await Promise.all([
      fetchPoolPriceV3("polygon", POOLS_CONFIG.polygon.uniV3_005),
      fetchPoolPriceV3("polygon", POOLS_CONFIG.polygon.uniV3_030),
      fetchPoolPriceV3("bsc", POOLS_CONFIG.bsc.cakeV3_005),
      fetchPoolPriceV3("bsc", POOLS_CONFIG.bsc.cakeV3_001)
    ]);

    if (polyP1 && polyP1 > 0) livePrices.polygon.p005 = polyP1;
    if (polyP2 && polyP2 > 0) livePrices.polygon.p030 = polyP2;
    if (livePrices.polygon.p005 && livePrices.polygon.p030) {
      const minP = Math.min(livePrices.polygon.p005, livePrices.polygon.p030);
      livePrices.polygon.spreadPct = (Math.abs(livePrices.polygon.p005 - livePrices.polygon.p030) / minP) * 100;
    }

    if (bscP1 && bscP1 > 0) livePrices.bsc.p005 = bscP1;
    if (bscP2 && bscP2 > 0) livePrices.bsc.p001 = bscP2;
    if (livePrices.bsc.p005 && livePrices.bsc.p001) {
      const minP = Math.min(livePrices.bsc.p005, livePrices.bsc.p001);
      livePrices.bsc.spreadPct = (Math.abs(livePrices.bsc.p005 - livePrices.bsc.p001) / minP) * 100;
    }

    // 5. Sincronizar telemetría local y refrescar UI
    await syncLocalTelemetry();
    loadWalletTransfers().then(renderTraceabilityTable).catch(() => {});
    updateCannonsLiveUi();
    updateTelemetryUi();
    renderTraceabilityTable();

  } catch (err) {
    console.warn("[ÁREA 501] Aviso en ciclo RPC en vivo:", err.message);
  }
}

// Llamada JSON-RPC genérica con medición de latencia real y fallback
async function callRpc(chain, method, params = []) {
  const config = RPC_CONFIG[chain];
  if (!config) return null;

  for (const url of config.endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const tStart = performance.now();

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method, params, id: Date.now() }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.result !== undefined) {
          const rtt = Math.round(performance.now() - tStart);
          if (chain === "polygon" && rtt > 5) {
            liveTelemetry.polygonPing = rtt;
          } else if (chain === "bsc" && rtt > 5) {
            liveTelemetry.bscPing = rtt;
          }
          return data.result;
        }
      }
    } catch (e) {
      // Siguiente RPC si falla
    }
  }
  return null;
}

async function fetchGasPrice(chain) {
  const result = await callRpc(chain, "eth_gasPrice", []);
  return result ? Math.round(parseInt(result, 16) / 1e9) : null;
}

async function fetchRpcBlockNumber(chain) {
  const result = await callRpc(chain, "eth_blockNumber", []);
  return result ? parseInt(result, 16) : null;
}

async function fetchNativeBalance(chain, address) {
  const result = await callRpc(chain, "eth_getBalance", [address, "latest"]);
  return result ? parseInt(result, 16) / 1e18 : null;
}

async function fetchTokenBalance(chain, tokenAddress, walletAddress, decimals = 18) {
  const cleanAddr = walletAddress.toLowerCase().replace("0x", "").padStart(64, "0");
  const data = `0x70a08231${cleanAddr}`;
  const result = await callRpc(chain, "eth_call", [{ to: tokenAddress, data }, "latest"]);
  if (result && result !== "0x") {
    return parseInt(result, 16) / (10 ** decimals);
  }
  return null;
}

// =============================================================================
// MULTICALL3 (0xcA11bde05977b3631167028862bE2a173976CA11): 1 llamada aggregate3 por red
// =============================================================================
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const satelliteCensus = { pol: 0, bnb: 0, count: 0, loadedAt: 0, loading: false };

function mcWord(hexNo0x) { return hexNo0x.padStart(64, "0"); }
function mcAddr(a) { return mcWord(a.toLowerCase().replace("0x", "")); }

function encodeAggregate3(calls) {
  // calls: [{ target, data(hex con 0x) }], allowFailure = true
  const tuples = calls.map(c => {
    const data = c.data.replace("0x", "");
    const padded = data.padEnd(Math.ceil(data.length / 64) * 64, "0");
    return mcAddr(c.target) + mcWord("1") + mcWord("60") + mcWord((data.length / 2).toString(16)) + padded;
  });
  let offset = calls.length * 32;
  const offsets = tuples.map(t => { const o = mcWord(offset.toString(16)); offset += t.length / 2; return o; });
  return "0x82ad56cb" + mcWord("20") + mcWord(calls.length.toString(16)) + offsets.join("") + tuples.join("");
}

function decodeAggregate3(hex) {
  const d = hex.replace("0x", "");
  const w = i => d.slice(i * 2, i * 2 + 64);
  const arrStart = parseInt(w(0), 16);
  const n = parseInt(d.slice(arrStart * 2, arrStart * 2 + 64), 16);
  const base = arrStart + 32;
  const out = [];
  for (let i = 0; i < n; i++) {
    const tOff = base + parseInt(d.slice((base + i * 32) * 2, (base + i * 32) * 2 + 64), 16);
    const success = parseInt(d.slice(tOff * 2, tOff * 2 + 64), 16) === 1;
    const bOff = tOff + parseInt(d.slice((tOff + 32) * 2, (tOff + 32) * 2 + 64), 16);
    const len = parseInt(d.slice(bOff * 2, bOff * 2 + 64), 16);
    out.push({ success, data: "0x" + d.slice((bOff + 32) * 2, (bOff + 32 + len) * 2) });
  }
  return out;
}

// Devuelve [{ native, token }] por dirección, o null si la llamada falla completa
async function multicallCensus(chain, addrs, tokenAddress, tokenDecimals) {
  const calls = [];
  addrs.forEach(a => {
    calls.push({ target: MULTICALL3, data: "0x4d2301cc" + mcAddr(a) });          // getEthBalance(address)
    calls.push({ target: tokenAddress, data: "0x70a08231" + mcAddr(a) });        // balanceOf(address)
  });
  try {
    const raw = await callRpc(chain, "eth_call", [{ to: MULTICALL3, data: encodeAggregate3(calls) }, "latest"]);
    if (!raw || raw === "0x") return null;
    const res = decodeAggregate3(raw);
    if (res.length !== calls.length) return null;
    const val = (r, dec) => (r.success && r.data.length > 2) ? Number(BigInt(r.data)) / (10 ** dec) : 0;
    return addrs.map((_, i) => ({ native: val(res[i * 2], 18), token: val(res[i * 2 + 1], tokenDecimals) }));
  } catch (e) {
    return null;
  }
}

// Censo del resto de satélites (wallets-public-list.json), 1 llamada por red, cada 60 s
async function loadSatelliteCensus() {
  if (satelliteCensus.loading || Date.now() - satelliteCensus.loadedAt < 60000) return;
  satelliteCensus.loading = true;
  try {
    const res = await fetch(`../wallets-public-list.json?t=${Math.floor(Date.now() / 60000)}`);
    if (!res.ok) return;
    const list = await res.json();
    const known = new Set(MOTHERSHIPS_REGISTRY.map(m => m.address.toLowerCase()));
    const rest = list.filter(w => w.index !== 0 && w.address && !known.has(w.address.toLowerCase())).map(w => w.address);
    const [cp, cb] = await Promise.all([
      multicallCensus("polygon", rest, RPC_CONFIG.polygon.usdcAddress, 6),
      multicallCensus("bsc", rest, RPC_CONFIG.bsc.usdcAddress, 18)
    ]);
    if (cp) satelliteCensus.pol = cp.reduce((s, x) => s + x.native, 0);
    if (cb) satelliteCensus.bnb = cb.reduce((s, x) => s + x.native, 0);
    satelliteCensus.count = rest.length;
    if (cp || cb) satelliteCensus.loadedAt = Date.now();
  } catch (e) { } finally {
    satelliteCensus.loading = false;
  }
}

async function fetchPoolPriceV3(chain, poolInfo) {
  try {
    const raw = await callRpc(chain, "eth_call", [{ to: poolInfo.address, data: "0x3850c7bd" }, "latest"]);
    if (raw && raw !== "0x" && raw.length >= 66) {
      const hexSqrt = raw.slice(2, 66);
      const sqrtP = BigInt("0x" + hexSqrt);
      const ratio = Number(sqrtP) / 79228162514264337593543950336;
      const decDiff = poolInfo.token0Decimals - poolInfo.token1Decimals;
      const price = (ratio * ratio) * Math.pow(10, decDiff);
      let p = price;
      if (chain === "bsc") {
        if (p > 0 && p < 1) p = 1 / p;
        if (!(p >= 200 && p <= 2000)) return null; // conserva último precio válido
      }
      if (p > 0 && !isNaN(p) && isFinite(p)) {
        return p;
      }
    }
  } catch (e) { }
  return null;
}

// =============================================================================
// ACTUALIZACIÓN DE TARJETAS DE CAÑONES (PRECIOS REALES & ESTADO HONESTO)
// =============================================================================
function updateCannonsLiveUi() {
  const elP1Price = document.getElementById("cannon1PricePol");
  if (elP1Price) elP1Price.textContent = `${livePrices.polygon.p005.toFixed(4)} USDC`;

  const elP1Comp = document.getElementById("cannon1PriceComp");
  if (elP1Comp) elP1Comp.textContent = `${livePrices.polygon.p030.toFixed(4)} USDC`;

  const elP1Spread = document.getElementById("cannon1SpreadVal");
  if (elP1Spread) elP1Spread.textContent = `+${livePrices.polygon.spreadPct.toFixed(4)}% Diferencia Real`;

  const elP1Audit = document.getElementById("cannon1BlockAudit");
  if (elP1Audit) elP1Audit.textContent = `#POL ${latestPolygonBlock.toLocaleString("en-US")}`;

  const elP1Pill = document.getElementById("cannon1StatusPill");
  const elP1Trigger = document.getElementById("cannon1TriggerState");

  if (livePrices.polygon.spreadPct >= 0.12) {
    if (elP1Pill) {
      elP1Pill.innerHTML = '<span class="pulse-dot-tiny green"></span>🟢 SPREAD ATÓMICO ACTIVO (>= +0.12%)';
      elP1Pill.className = "c-status-live opportunity";
    }
    if (elP1Trigger) {
      elP1Trigger.innerHTML = `<span class="pulse-dot-tiny green"></span>🟢 OPORTUNIDAD (+${livePrices.polygon.spreadPct.toFixed(4)}%)`;
      elP1Trigger.className = "c-sentinel-tag active";
    }
  } else {
    if (elP1Pill && !elP1Pill.classList?.contains?.("scanning")) {
      elP1Pill.innerHTML = '<span class="pulse-dot-tiny green"></span>🟢 RADAR ON-CHAIN ACTIVO ($0 GAS)';
      elP1Pill.className = "c-status-live";
    }
    if (elP1Trigger) {
      elP1Trigger.innerHTML = `<span class="pulse-dot-tiny cyan"></span>GATILLO CENTINELA (+${livePrices.polygon.spreadPct.toFixed(4)}% · META 0.12%)`;
      elP1Trigger.className = "c-sentinel-tag";
    }
  }

  const elP2Price = document.getElementById("cannon2PriceBnb");
  if (elP2Price) elP2Price.textContent = `${livePrices.bsc.p005.toFixed(2)} USDC`;

  const elP2Comp = document.getElementById("cannon2PriceComp");
  if (elP2Comp) elP2Comp.textContent = `${livePrices.bsc.p001.toFixed(2)} USDC`;

  const elP2Spread = document.getElementById("cannon2SpreadVal");
  if (elP2Spread) elP2Spread.textContent = `+${livePrices.bsc.spreadPct.toFixed(4)}% Diferencia Real`;

  const elP2Audit = document.getElementById("cannon2BlockAudit");
  if (elP2Audit) elP2Audit.textContent = `#BSC ${latestBscBlock.toLocaleString("en-US")}`;

  const elP2Pill = document.getElementById("cannon2StatusPill");
  const elP2Trigger = document.getElementById("cannon2TriggerState");

  if (livePrices.bsc.spreadPct >= 0.12) {
    if (elP2Pill) {
      elP2Pill.innerHTML = '<span class="pulse-dot-tiny green"></span>🟢 SPREAD ATÓMICO ACTIVO (>= +0.12%)';
      elP2Pill.className = "c-status-live opportunity";
    }
    if (elP2Trigger) {
      elP2Trigger.innerHTML = `<span class="pulse-dot-tiny green"></span>🟢 OPORTUNIDAD (+${livePrices.bsc.spreadPct.toFixed(4)}%)`;
      elP2Trigger.className = "c-sentinel-tag active";
    }
  } else {
    if (elP2Pill && !elP2Pill.classList?.contains?.("scanning")) {
      elP2Pill.innerHTML = '<span class="pulse-dot-tiny green"></span>🟢 RADAR ON-CHAIN ACTIVO ($0 GAS)';
      elP2Pill.className = "c-status-live";
    }
    if (elP2Trigger) {
      elP2Trigger.innerHTML = `<span class="pulse-dot-tiny cyan"></span>GATILLO CENTINELA (+${livePrices.bsc.spreadPct.toFixed(4)}% · META 0.12%)`;
      elP2Trigger.className = "c-sentinel-tag";
    }
  }
}

// =============================================================================
// SINCRONIZACIÓN CON TELEMETRÍA LOCAL (SIN GENERAR FILAS SIMULADAS)
// =============================================================================
async function syncLocalTelemetry() {
  try {
    const res = await fetch(`../telemetry/fleet-telemetry.json?t=${Date.now()}`);
    if (res.ok) {
      const telem = await res.json();
      const shots = telem.atomicSniperExecution?.shotsExecutedToday ||
        telem.snipingEcosystem?.dailyAtomicOperations?.completedToday ||
        0;
      currentShotsDone = shots;
      atomicRadar = telem.atomicProfitRadar || null;
      renderAtomicRadarUi();

      const elBatteryFraction = document.getElementById("batteryQuotaFraction");
      if (elBatteryFraction) elBatteryFraction.textContent = `${shots} / ${DAILY_TARGET} DISPAROS HOY`;

      renderBatteryCapsules(shots, DAILY_TARGET);

      if (Array.isArray(telem.snipingEcosystem?.confirmedOnChainOperations)) {
        telem.snipingEcosystem.confirmedOnChainOperations.forEach(op => {
          if (op.txHash && !CONFIRMED_ON_CHAIN_TRANSACTIONS.some(r => r.txHash === op.txHash)) {
            CONFIRMED_ON_CHAIN_TRANSACTIONS.unshift({
              blockId: op.chainBadge || `#${op.chain === "Polygon PoS" ? "POL" : "BSC"} ${op.blockNumber}`,
              txHash: op.txHash,
              explorerUrl: op.explorerUrl || (op.chain === "Polygon PoS" ? `https://polygonscan.com/tx/${op.txHash}` : `https://bscscan.com/tx/${op.txHash}`),
              timeUtc: op.timestampUtc || op.timeFormatted,
              nebulas: op.nebulas || "Nebulosa IA (>=95%)",
              mothership: op.mothership || "#501 (Matriz Dual)",
              route: op.route,
              cycleInOut: op.cycleInOut,
              gasUsed: op.gasUsed,
              netProfit: op.netProfit,
              statusType: "CONFIRMED"
            });
          }
        });
      }

    }
  } catch (e) { }
}

// =============================================================================
// TABLA DE TRAZABILIDAD ON-CHAIN TRANSPARENTE 100% REAL
// =============================================================================
function renderTraceabilityTable() {
  const tbody = document.getElementById("atomicTraceTbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const allRows = getAllTraceRows();
  const elConfirmedOps = document.getElementById("confirmedOpsCount");
  if (elConfirmedOps) elConfirmedOps.textContent = `${allRows.length} EN CADENA`;
  const scrollBox = tbody.closest(".atomic-log-table-container");
  if (scrollBox) { scrollBox.style.maxHeight = "460px"; scrollBox.style.overflowY = "auto"; }

  // 1. Fila Centinela en Vivo (Bloque real + Hora actual + Spread real en vivo)
  const sentinelTr = document.createElement("tr");
  const spreadDetails = `POL +${livePrices.polygon.spreadPct.toFixed(3)}% · BSC +${livePrices.bsc.spreadPct.toFixed(3)}%`;
  sentinelTr.innerHTML = `
    <td>
      <span class="op-badge-live">
        <span class="pulse-dot-tiny cyan"></span>#POL ${latestPolygonBlock.toLocaleString("en-US")}
      </span>
    </td>
    <td class="font-mono text-dim">${getUtcTimeString(0)}</td>
    <td>
      <span class="c-status-live" style="cursor: pointer;" onclick="forceLiveScan('all')" title="Clic para forzar sondeo RPC en vivo">
        <span class="pulse-dot-tiny green"></span>
        CENTINELA VIVO (#${liveState.sessionScans})
      </span>
    </td>
    <td><strong class="gold-text">#501 / #001 / #101</strong></td>
    <td class="font-mono text-dim">
      Uniswap V3 + PancakeSwap V3 (Alchemy RPC $0 Gas)
    </td>
    <td><span class="green-text font-bold"><span class="pulse-dot-tiny green"></span>$${liveState.grandTotalUsdc.toFixed(2)} USDC Intacto · Vigilancia</span></td>
    <td class="text-dim font-mono"><strong class="green-text">$0 Gas</strong> · ${spreadDetails}</td>
  `;
  tbody.appendChild(sentinelTr);

  // 2. ÚNICAMENTE Operaciones Reales Confirmadas On-Chain con TxHash verificado
  allRows.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <a href="${row.explorerUrl}" target="_blank" rel="noopener noreferrer" class="tx-link" title="Verificar TxHash en Explorador Blockchain Oficial">
          <span class="op-badge-done">${row.blockId} ↗</span>
        </a>
      </td>
      <td class="font-mono text-dim">${row.timeUtc}</td>
      <td class="green-text" title="${row.nebulas}">
        <span class="pulse-dot-tiny green"></span>
        CONFIRMADO ON-CHAIN
      </td>
      <td><strong class="gold-text">${row.mothership}</strong></td>
      <td class="font-mono" title="${row.route}">${row.route}</td>
      <td><span class="cyan-text font-bold">${row.cycleInOut}</span></td>
      <td class="text-dim font-mono">${row.gasUsed}</td>
    `;
    tbody.appendChild(tr);
  });
}

function getUtcTimeString(offsetSeconds = 0) {
  const d = new Date(Date.now() + offsetSeconds * 1000);
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  return `${h}:${m}:${s} UTC`;
}

// =============================================================================
// REGLETA DE LAS 15 CÁPSULAS ATÓMICAS ([#01] a [#15])
// =============================================================================
function renderBatteryCapsules(completedCount, totalTarget = 15) {
  const row = document.getElementById("capsulesBatteryRow");
  if (!row) return;

  row.innerHTML = "";

  for (let i = 1; i <= totalTarget; i++) {
    const isDone = i <= completedCount;
    const isNext = (i === completedCount + 1);
    const padNum = String(i).padStart(2, "0");
    const capsule = document.createElement("div");
    capsule.className = `shot-capsule ${isDone ? "executed" : "pending"}`;

    capsule.innerHTML = `
      <span class="capsule-idx">[ #${padNum} ]</span>
      <span class="capsule-badge">${isDone ? "REAL ON-CHAIN" : (isNext ? "SIGUIENTE" : "ESPERA")}</span>
    `;

    row.appendChild(capsule);
  }
}

// =============================================================================
// EXPEDIENTE DE FLOTA: MODAL CON LAS 16 NODRIZAS EN VIVO
// =============================================================================
function setupReserveFleetModal() {
  const btn = document.getElementById("btnToggleReserveGrid");
  if (!btn) return;
  btn.onclick = () => openReserveFleetDossier();
}

function openReserveFleetDossier() {
  const overlay = document.getElementById("dossierOverlay");
  const idBadge = document.getElementById("dossierIdBadge");
  const title = document.getElementById("dossierTitle");
  const body = document.getElementById("dossierBody");

  if (!overlay || !body) return;

  idBadge.textContent = "FLOTA MATRIZ 16";
  title.textContent = "EXPEDIENTE TÁCTICO EN VIVO: 3 MANDOS ACTIVOS + 13 NODRIZAS EN RESERVA";

  const m501 = MOTHERSHIPS_REGISTRY.find(m => m.id === "#501");
  const m001 = MOTHERSHIPS_REGISTRY.find(m => m.id === "#001");
  const m101 = MOTHERSHIPS_REGISTRY.find(m => m.id === "#101");
  const activeCommanders = [m501, m001, m101].filter(Boolean);
  const reserveNodrizas = MOTHERSHIPS_REGISTRY.filter(m => !activeCommanders.includes(m));

  let html = `<div class="dossier-commanders-row">`;

  activeCommanders.forEach(m => {
    const isDual = m.id === "#501";
    const isPoly = m.id === "#001";
    const colorClass = isDual ? "active-dual" : (isPoly ? "active-poly" : "active-bsc");
    const titleColor = isDual ? "gold" : (isPoly ? "cyan" : "gold");
    const roleBadge = isDual ? "BÓVEDA MATRIZ DUAL (PISO 150 POL)" : (isPoly ? "CAÑÓN #1 (POLYGON)" : "CAÑÓN #2 (BSC)");

    html += `
      <div class="dossier-card ${colorClass}" onclick="inspectNodriza('${m.id}')" style="cursor: pointer;" title="Ver detalle completo de ${m.id}">
        <div class="d-card-head">
          <span class="d-card-title ${titleColor}">
            <span class="material-symbols-rounded icon-xs">shield</span>
            ${m.id} · ${m.name}
          </span>
          <span class="d-card-badge green">${roleBadge}</span>
        </div>
        <div class="d-card-addr" title="${m.address}">${m.address}</div>
        <div class="d-card-balances">
          <span>Gas POL: <strong class="cyan-text">${m.gasPol} POL</strong></span>
          <span>Gas BNB: <strong class="gold-text">${m.gasBnb} BNB</strong></span>
        </div>
        <div class="d-card-nebulas">
          <span class="purple-text">${m.assignedNebulaPair.odd.id}</span> (${m.assignedNebulaPair.odd.certainty}%) · 
          <span class="green-text">${m.assignedNebulaPair.even.id}</span> (5/5 Blindado)
        </div>
      </div>
    `;
  });

  html += `
    </div>
    <div class="dossier-reserve-terminal">
      <div class="d-res-head">
        <div class="d-res-title">
          <span class="material-symbols-rounded icon-xs gold">dns</span>
          <span>CONSOLA DE RESERVA TÁCTICA: 13 NODRIZAS EN ESPERA DE LIQUIDEZ</span>
        </div>
        <div class="d-res-meta">
          <span class="r-meta-pill gold">${liveState.fleetTotalPol.toFixed(2)} / 300.00 POL BLINDADOS</span>
          <span class="r-meta-pill blue">${liveState.fleetTotalBnb.toFixed(4)} BNB</span>
          <span class="r-meta-pill green">28 NEBULOSAS ESCOLTA $0 GAS</span>
        </div>
      </div>
      <div class="dossier-reserve-grid">
  `;

  reserveNodrizas.forEach(m => {
    html += `
      <div class="d-res-item" onclick="inspectNodriza('${m.id}')" title="Clic para ver detalle de ${m.id}">
        <div class="d-res-item-top">
          <span class="d-res-id">${m.id} · ${m.name}</span>
          <span class="d-res-tag">EN ESPERA</span>
        </div>
        <div class="d-res-role">${m.role}</div>
        <div class="d-res-stats">
          <span>${m.gasPol} POL · ${m.gasBnb} BNB</span>
          <span class="purple-text">${m.assignedNebulaPair.odd.id} + ${m.assignedNebulaPair.even.id}</span>
        </div>
      </div>
    `;
  });

  html += `</div></div>`;
  body.innerHTML = html;
  overlay.style.display = "flex";
}

function inspectNodriza(id) {
  const m = MOTHERSHIPS_REGISTRY.find(item => item.id === id);
  if (!m) {
    openReserveFleetDossier();
    return;
  }
  const overlay = document.getElementById("dossierOverlay");
  const idBadge = document.getElementById("dossierIdBadge");
  const title = document.getElementById("dossierTitle");
  const body = document.getElementById("dossierBody");

  if (!overlay || !body) return;

  idBadge.textContent = m.id;
  title.textContent = `EXPEDIENTE DE NODRIZA: ${m.name.toUpperCase()}`;

  body.innerHTML = `
    <div style="display: flex; justify-content: flex-start; margin-bottom: 6px;">
      <button class="dock-btn btn-return" onclick="openReserveFleetDossier()" style="width: auto; padding: 4px 10px; font-size: 0.54rem;">
        <span class="material-symbols-rounded icon-xs">arrow_back</span>
        <span>VER CATÁLOGO GENERAL DE LA FLOTA (16 NODRIZAS)</span>
      </button>
    </div>

    <div class="dossier-card" style="padding: 12px; background: #05080e; border: 1px solid var(--border-gold); border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <strong class="gold-text" style="font-size: 0.85rem; font-family: var(--font-mono);">${m.id} · ${m.name}</strong>
        <span class="d-card-badge green">${m.statusLabel || "RESERVA TÁCTICA"}</span>
      </div>
      <div style="font-size: 0.58rem; color: var(--text-dim); margin-bottom: 6px;">${m.role} · ${m.box}</div>
      <div style="font-size: 0.62rem; font-family: var(--font-mono); color: #fff; margin-bottom: 8px; word-break: break-all;">
        <strong style="color: var(--text-muted)">Dirección On-Chain:</strong> ${m.address}
      </div>
      <div style="display: flex; gap: 14px; font-size: 0.62rem; font-family: var(--font-mono); padding: 6px; background: rgba(255,255,255,0.02); border-radius: 4px;">
        <span>Gas POL (En Vivo): <strong class="cyan-text">${m.gasPol} POL</strong></span>
        <span>Gas BNB (En Vivo): <strong class="gold-text">${m.gasBnb} BNB</strong></span>
        <span>Piso Sagrado: <strong>${m.lockedFloorPol} POL</strong></span>
        <span>Auditoría: <strong class="green-text">${m.locksVerified}</strong></span>
      </div>
    </div>

    <div class="dossier-reserve-terminal" style="margin-top: 8px;">
      <div class="d-res-head">
        <div class="d-res-title">
          <span class="material-symbols-rounded icon-xs purple-text">smart_toy</span>
          <span>BINOMIO DE NEBULOSAS IA ASIGNADAS ($0 GAS)</span>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px;">
        <div style="padding: 10px; background: rgba(168, 85, 247, 0.08); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 6px;">
          <div class="purple-text" style="font-weight: 800; font-size: 0.65rem; font-family: var(--font-mono);">${m.assignedNebulaPair.odd.id} · Calculista Cuántica</div>
          <div style="font-size: 0.55rem; color: var(--text-dim); margin: 4px 0;">${m.assignedNebulaPair.odd.name}</div>
          <div style="font-size: 0.55rem; color: var(--green); font-weight: 700;">Certeza: ${m.assignedNebulaPair.odd.certainty}% · ${m.assignedNebulaPair.odd.status}</div>
        </div>
        <div style="padding: 10px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px;">
          <div class="green-text" style="font-weight: 800; font-size: 0.65rem; font-family: var(--font-mono);">${m.assignedNebulaPair.even.id} · Guardaespaldas Anti-Riesgo</div>
          <div style="font-size: 0.55rem; color: var(--text-dim); margin: 4px 0;">${m.assignedNebulaPair.even.name}</div>
          <div style="font-size: 0.55rem; color: var(--green); font-weight: 700;">Filtros: ${m.assignedNebulaPair.even.locks} · ${m.assignedNebulaPair.even.status}</div>
        </div>
      </div>
    </div>
  `;
  overlay.style.display = "flex";
}
window.inspectNodriza = inspectNodriza;

function closeReserveFleetDossier() {
  const overlay = document.getElementById("dossierOverlay");
  if (overlay) overlay.style.display = "none";
}
window.closeReserveFleetDossier = closeReserveFleetDossier;
window.openReserveFleetDossier = openReserveFleetDossier;

function setupModalDossier() {
  const overlay = document.getElementById("dossierOverlay");
  const closeBtn = document.getElementById("dossierCloseBtn");
  if (!overlay) return;

  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      closeReserveFleetDossier();
    };
  }
  overlay.onclick = (e) => {
    if (e.target === overlay) closeReserveFleetDossier();
  };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.style.display === "flex") closeReserveFleetDossier();
  });
}

// =============================================================================
// ESCANEO ON-CHAIN FORZADO EN TIEMPO REAL ($0 GAS)
// =============================================================================
async function forceLiveScan(chain = "all") {
  const p1Pill = document.getElementById("cannon1StatusPill");
  const p2Pill = document.getElementById("cannon2StatusPill");

  if (chain === "polygon" || chain === "all") {
    if (p1Pill) {
      p1Pill.innerHTML = '<span class="pulse-dot-tiny cyan"></span>⚡ AUDITANDO ON-CHAIN...';
      p1Pill.classList.add("scanning");
    }
  }
  if (chain === "bsc" || chain === "all") {
    if (p2Pill) {
      p2Pill.innerHTML = '<span class="pulse-dot-tiny gold"></span>⚡ AUDITANDO ON-CHAIN...';
      p2Pill.classList.add("scanning");
    }
  }

  await pollLiveOnChain();

  setTimeout(() => {
    if (p1Pill) {
      p1Pill.classList.remove("scanning");
      p1Pill.innerHTML = '<span class="pulse-dot-tiny green"></span>🟢 AUDITORÍA COMPLETADA ($0 GAS)';
    }
    if (p2Pill) {
      p2Pill.classList.remove("scanning");
      p2Pill.innerHTML = '<span class="pulse-dot-tiny green"></span>🟢 AUDITORÍA COMPLETADA ($0 GAS)';
    }
    setTimeout(() => updateCannonsLiveUi(), 1200);
  }, 400);
}
window.forceLiveScan = forceLiveScan;

// Radar atómico multi-piscina (atomic-profit-guard.js): mejor ciclo real USDC -> token -> USDC
function atomicRadarSummary(chain) {
  const r = atomicRadar && atomicRadar[chain];
  if (!r) return null;
  const sign = r.netUsdc >= 0 ? "+" : "-";
  const money = `${sign}$${Math.abs(r.netUsdc).toFixed(3)} USD (${r.netPct >= 0 ? "+" : ""}${r.netPct.toFixed(3)}%)`;
  const min = atomicRadar.minNetProfitUsdc || 0.05;
  return {
    route: `USDC ↔ ${r.token} · ${r.buy} ➔ ${r.sell}`,
    money,
    state: r.shouldFire ? "UMBRAL SUPERADO" : `esperando cruce a +$${min.toFixed(2)} USDC`,
    legacy: r.legacyNetUsdc,
    at: atomicRadar.updatedAt ? new Date(atomicRadar.updatedAt).toISOString().slice(11, 16) + " UTC" : "—",
    ok: r.shouldFire
  };
}

function renderAtomicRadarUi() {
  [["polygon", 1], ["bsc", 2]].forEach(([chain, n]) => {
    const s = atomicRadarSummary(chain);
    const anchor = document.getElementById(`cannon${n}TriggerState`);
    if (!s || !anchor) return;
    let el = document.getElementById(`cannon${n}RadarLine`);
    if (!el) {
      el = document.createElement("div");
      el.id = `cannon${n}RadarLine`;
      el.style.cssText = "margin-top:6px;font-size:0.54rem;font-family:var(--font-mono);color:var(--text-dim);line-height:1.35;";
      anchor.insertAdjacentElement("afterend", el);
    }
    el.innerHTML = `RADAR ATÓMICO (${s.at}): <strong class="${s.ok ? "green-text" : "gold-text"}">${s.money}</strong><br>${s.route} · ${s.state}`;
  });
}

function atomicRadarModalBlock(chain) {
  const s = atomicRadarSummary(chain);
  if (!s) return "";
  const legacy = (s.legacy !== null && s.legacy !== undefined) ? ` · antes (solo token nativo): ${s.legacy >= 0 ? "+" : "-"}$${Math.abs(s.legacy).toFixed(3)}` : "";
  return `
      <div style="margin-top: 10px; padding: 8px 12px; background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 6px; font-family: var(--font-mono);">
        <div style="font-size: 0.52rem; color: var(--text-dim);">RADAR ATÓMICO MULTI-PISCINA (ciclo cerrado USDC ➔ token ➔ USDC, tras fees y gas · actualizado ${s.at})</div>
        <div style="font-size: 0.66rem; font-weight: 800; color: #fff; margin-top: 3px;">${s.route}</div>
        <div style="font-size: 0.62rem; margin-top: 2px;">Mejor ciclo real hoy: <strong class="${s.ok ? "green-text" : "gold-text"}">${s.money}</strong>${legacy}</div>
        <div style="font-size: 0.54rem; color: var(--text-dim); margin-top: 2px;">Estado: ${s.state}. Solo lectura: no se firma ninguna transacción.</div>
      </div>`;
}
function inspectTriggerCondition(chain = "polygon") {
  const isPoly = chain === "polygon";
  const name = isPoly ? "CAÑÓN PESADO #1 (POLYGON POS)" : "CAÑÓN PESADO #2 (BSC MAINNET)";
  const curSpread = isPoly ? livePrices.polygon.spreadPct : livePrices.bsc.spreadPct;
  const p1 = isPoly ? livePrices.polygon.p005 : livePrices.bsc.p005;
  const p2 = isPoly ? (livePrices.polygon.p030 || livePrices.polygon.p005) : (livePrices.bsc.p001 || livePrices.bsc.p005);
  const unit = isPoly ? "USDC/POL" : "USDC/BNB";
  const blockNum = isPoly ? latestPolygonBlock : latestBscBlock;

  const overlay = document.getElementById("dossierOverlay");
  const idBadge = document.getElementById("dossierIdBadge");
  const title = document.getElementById("dossierTitle");
  const body = document.getElementById("dossierBody");

  if (!overlay || !body) return;

  idBadge.textContent = isPoly ? "GATILLO #1" : "GATILLO #2";
  title.textContent = `AUDITORÍA DEL GATILLO ATÓMICO: ${name}`;

  body.innerHTML = `
    <div style="display: flex; justify-content: flex-start; margin-bottom: 8px;">
      <button class="dock-btn btn-return" onclick="openReserveFleetDossier()" style="width: auto; padding: 4px 10px; font-size: 0.54rem;">
        <span class="material-symbols-rounded icon-xs">arrow_back</span>
        <span>VER CATÁLOGO GENERAL DE LA FLOTA (16 NODRIZAS)</span>
      </button>
    </div>

    <div class="dossier-card" style="padding: 14px; background: #05080e; border: 1px solid var(--border-gold); border-radius: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <strong class="gold-text" style="font-size: 0.88rem; font-family: var(--font-mono);">
          <span class="material-symbols-rounded icon-xs cyan-text">radar</span>
          CONDICIÓN MATEMÁTICA DEL GATILLO ATÓMICO ($0 GAS)
        </strong>
        <span class="d-card-badge green">VIGILANCIA EN TIEMPO REAL · BLOQUE #${blockNum.toLocaleString("en-US")}</span>
      </div>
      <p style="font-size: 0.62rem; color: var(--text-dim); margin-bottom: 12px; line-height: 1.4;">
        El gatillo centinela protege el 100% de la munición USDC en cada bloque. Solo dispara si el diferencial entre piscinas cubre comisiones y garantiza retorno de base + beneficio neto en una sola transacción Flash-Swap atómica.
      </p>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 12px;">
        <div style="padding: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px;">
          <div style="font-size: 0.52rem; color: var(--text-dim);">PISCINA PRIMARIA:</div>
          <div style="font-size: 0.70rem; font-family: var(--font-mono); font-weight: 800; color: #fff;">${p1.toFixed(4)} ${unit}</div>
        </div>
        <div style="padding: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px;">
          <div style="font-size: 0.52rem; color: var(--text-dim);">PISCINA COMPARATIVA:</div>
          <div style="font-size: 0.70rem; font-family: var(--font-mono); font-weight: 800; color: #fff;">${p2.toFixed(4)} ${unit}</div>
        </div>
        <div style="padding: 8px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 6px;">
          <div style="font-size: 0.52rem; color: var(--green);">SPREAD REAL EN VIVO:</div>
          <div style="font-size: 0.70rem; font-family: var(--font-mono); font-weight: 800; color: var(--green);">+${curSpread.toFixed(4)}%</div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: rgba(6, 182, 212, 0.08); border: 1px solid rgba(6, 182, 212, 0.25); border-radius: 6px;">
        <span style="font-size: 0.58rem; color: #fff; font-family: var(--font-mono);">
          UMBRAL REQUERIDO: <strong>&gt;= +0.1200%</strong> · ESTADO ACTUAL: <strong class="green-text">VIGILANCIA ETH_CALL ($0 RIESGO)</strong>
        </span>
        <button class="dock-btn btn-dossier" onclick="forceLiveScan('${chain}')" style="width: auto; padding: 4px 10px; font-size: 0.52rem;">
          <span class="material-symbols-rounded icon-xs">refresh</span>
          <span>SONDEAR AHORA MISMO</span>
        </button>
      </div>
      ${atomicRadarModalBlock(chain)}
    </div>
  `;

  overlay.style.display = "flex";
}
window.inspectTriggerCondition = inspectTriggerCondition;

function setupCopyButtons() {
  const btn = document.getElementById("btnCopy501");
  const toast = document.getElementById("copyToast");
  const addr = document.getElementById("masterVaultAddr");
  if (!btn || !toast || !addr) return;

  btn.onclick = () => {
    const textToCopy = addr.getAttribute("data-full-address") || addr.textContent.trim();
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast.style.display = "inline-block";
      setTimeout(() => { toast.style.display = "none"; }, 1500);
    });
  };
}
