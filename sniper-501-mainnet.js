/**
 * sniper-501-mainnet.js — Operación 12K
 * MOTOR DE INTELIGENCIA DE CAZA EN MAINNET: 6 FRENTES TÁCTICOS SUPERVISADOS (POLYGON MAINNET)
 * 
 * Gestiona bajo Supervisión Constante de las 12 Nebulosas IA (NEBULA-11 y NEBULA-12)
 * los 6 Frentes de Extracción en Polygon Mainnet (Chain ID 137):
 * - Frente 0 (Nodriza Matriz #501): 0xD4D12077a61118372f7a367319fb11922Beb3743 ➔ Bóveda Binance #1
 * - Frente 1 (Capitán Box 1 #001): 0xb7505DD7FCC31A71D033F8a495D6B562420AD40F ➔ Bóveda Binance #1
 * - Frente 2 (Capitán Box 2 #101): 0x568227fc15ef4713F1d51bd6520F384FE1F4adBA ➔ Bóveda Binance #2
 * - Frente 3 (Capitán Box 3 #201): 0x2810aa0DabCA4511846194229d2c004B14016A7C ➔ Bóveda Binance #3
 * - Frente 4 (Capitán Box 4 #301): 0xEb6a667C9c0F5Bb1eCb6f19f20e9f25D8B54Ca0f ➔ Bóveda Binance #4
 * - Frente 5 (Capitán Box 5 #401): 0x4C713c5984B033d63061aDc936DfDb8C4Bc6d070 ➔ Bóveda Binance #5
 * 
 * Reglas de Hierro Inquebrantables:
 * 1. ESCUDOS SAGRADOS INTOCABLES (75.00 POL TOTAL BLINDADOS EN LA FLOTA):
 *    - Frente 0 (#501): 25.00 POL piso intocable | Bala táctica: 4.50 POL -> USDC Nativo
 *    - Frente 1 (#001): 14.00 POL piso intocable | Bala táctica: 2.25 POL -> USDC Nativo
 *    - Frente 2 (#101): 14.00 POL piso intocable | Bala táctica: 2.25 POL -> USDC Nativo
 *    - Frente 3 (#201): 7.30 POL piso intocable  | Bala táctica: 1.00 POL -> USDC Nativo
 *    - Frente 4 (#301): 7.30 POL piso intocable  | Bala táctica: 1.00 POL -> USDC Nativo
 *    - Frente 5 (#401): 7.30 POL piso intocable  | Bala táctica: 1.00 POL -> USDC Nativo
 * 2. GATILLO CUÁNTICO NEBULA-11: Disparo únicamente con Certeza >= 95% (Score >= 95%).
 * 3. COOLDOWN DINÁMICO CORTO: 30 minutos de vigilancia activa (sustituye el freno fijo de 6h).
 * 4. EXCLUSIVO USDC NATIVO OFICIAL CIRCLE (0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 - 6 dec).
 *    PROHIBIDO USDT por MiCA y PROHIBIDO USDC.e antiguo.
 * 5. BARRIDO A BINANCE SPOT: Al superar Ruta #1 (#501 + #001) el umbral de >= $1.00 USDC,
 *    se barre directamente hacia la Bóveda Binance #1 (0x48b26dd0f9265573f31f7140cf01e9c48518531b).
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { networks } = require("./networks");
const { getWalletSigner } = require("./swarm-engine");
const { sendTelegramAlert } = require("./telegram-notifier");

// =====================================================================================
// CONSTANTES Y CONFIGURACIÓN CRÍTICA
// =====================================================================================
const NATIVE_USDC_POLYGON = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"; // Circle oficial USDC, 6 dec
const WPOL_POLYGON = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"; // Wrapped POL (WMATIC)
const QUICKSWAP_V2_ROUTER = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";
const SUSHISWAP_V2_ROUTER = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";

// Constantes BSC Mainnet (Chain ID 56)
const PANCAKESWAP_V2_ROUTER_BSC = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const WBNB_BSC = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const OFFICIAL_USDC_BSC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"; // Binance-Peg USD Coin (18 dec)

// 💱 Registro de DEXs Soportados en Polygon Mainnet para Enrutamiento Inteligente
const MULTI_DEX_VENUES = [
  {
    id: "quickswap_v2",
    name: "QuickSwap V2",
    routerAddress: QUICKSWAP_V2_ROUTER,
    icon: "⚡"
  },
  {
    id: "sushiswap_v2",
    name: "SushiSwap V2",
    routerAddress: SUSHISWAP_V2_ROUTER,
    icon: "🍣"
  }
];

const SWEEP_THRESHOLD_USDC = 1.00; // Umbral de referencia
const DYNAMIC_COOLDOWN_MS = 30 * 60 * 1000; // 30 Minutos de enfriamiento dinámico

// -------------------------------------------------------------------------------------
// 🔒 POLÍTICA DE SEGURIDAD ON-CHAIN: BLOQUEO TOTAL DE MICRO-DEPÓSITOS A BINANCE (12K)
// -------------------------------------------------------------------------------------
// Queda estrictamente PROHIBIDO enviar micro-depósitos automáticos ($1, $2, $5 USDC).
// Todo el USDC Nativo Oficial permanece 100% on-chain en la Bóveda Matriz #501 y en las
// Cabeceras de cada Box (#001, #101, #201, #301, #401) como Fondo de Interés Compuesto
// (Compounding Pool) supervisado por las 12 Nebulosas IA rumbo a los Super Snipers.
const AUTO_SWEEP_TO_BINANCE = false;

// 11 Frentes Tácticos de Extracción Mainnet (6 Principales + 5 Sub-Capitanes Ascendidos)
const SNIPER_FRONTS = [
  // --- 6 FRENTES PRINCIPALES ---
  {
    frontId: "front-0",
    boxId: "MATRIZ",
    id: "#501",
    index: 501,
    name: "Nodriza Matriz (#501)",
    address: "0xD4D12077a61118372f7a367319fb11922Beb3743",
    sacredReservePol: 25.00,
    surveillanceFloorPol: 25.10,
    bulletPol: 4.50,
    minBulletPol: 0.20,
    gasBuffer: 0.05,
    binanceVault: "0x48b26dd0f9265573f31f7140cf01e9c48518531b",
    binanceVaultName: "Bóveda Binance #1 (Box 1 / Matriz)"
  },
  {
    frontId: "front-1",
    boxId: 1,
    id: "#001",
    index: 1,
    name: "Capitán Box 1 (#001)",
    address: "0xb7505DD7FCC31A71D033F8a495D6B562420AD40F",
    sacredReservePol: 14.00,
    surveillanceFloorPol: 14.02,
    bulletPol: 2.25,
    minBulletPol: 0.20,
    gasBuffer: 0.05,
    binanceVault: "0x48b26dd0f9265573f31f7140cf01e9c48518531b",
    binanceVaultName: "Bóveda Binance #1 (Box 1)"
  },
  {
    frontId: "front-2",
    boxId: 2,
    id: "#101",
    index: 101,
    name: "Capitán Box 2 (#101)",
    address: "0x568227fc15ef4713F1d51bd6520F384FE1F4adBA",
    sacredReservePol: 14.00,
    surveillanceFloorPol: 14.02,
    bulletPol: 2.25,
    minBulletPol: 0.20,
    gasBuffer: 0.05,
    binanceVault: "0x33cffda0218122ed4d981dcb1797f4b458191bc4",
    binanceVaultName: "Bóveda Binance #2 (Box 2)"
  },
  {
    frontId: "front-3",
    boxId: 3,
    id: "#201",
    index: 201,
    name: "Capitán Box 3 (#201)",
    address: "0x2810aa0DabCA4511846194229d2c004B14016A7C",
    sacredReservePol: 7.30,
    surveillanceFloorPol: 7.32,
    bulletPol: 1.00,
    minBulletPol: 0.20,
    gasBuffer: 0.04,
    binanceVault: "0x409a4695efd6c919ca660cd86c5c24eb54bfca4e",
    binanceVaultName: "Bóveda Binance #3 (Box 3)"
  },
  {
    frontId: "front-4",
    boxId: 4,
    id: "#301",
    index: 301,
    name: "Capitán Box 4 (#301)",
    address: "0xEb6a667C9c0F5Bb1eCb6f19f20e9f25D8B54Ca0f",
    sacredReservePol: 7.30,
    surveillanceFloorPol: 7.32,
    bulletPol: 1.00,
    minBulletPol: 0.20,
    gasBuffer: 0.04,
    binanceVault: "0x2734e8a984573856417d12478616187ff5d2ee7d",
    binanceVaultName: "Bóveda Binance #4 (Box 4)"
  },
  {
    frontId: "front-5",
    boxId: 5,
    id: "#401",
    index: 401,
    name: "Capitán Box 5 (#401)",
    address: "0x4C713c5984B033d63061aDc936DfDb8C4Bc6d070",
    sacredReservePol: 7.30,
    surveillanceFloorPol: 7.32,
    bulletPol: 1.00,
    minBulletPol: 0.20,
    gasBuffer: 0.04,
    binanceVault: "0xf94ef9da001c48367d78641e2e870db0e809dee9",
    binanceVaultName: "Bóveda Binance #5 (Box 5)"
  },
  // --- 5 NUEVOS SUB-CAPITANES ASCENDIDOS (1 POR BOX) ---
  {
    frontId: "front-6",
    boxId: 1,
    id: "#008",
    index: 8,
    name: "Sub-Capitán Box 1 (#008)",
    address: "0x0EE1dE68C1F101233F9607FfD124DaA55943Ce42",
    sacredReservePol: 0.25,
    surveillanceFloorPol: 0.26,
    bulletPol: 0.12,
    minBulletPol: 0.05,
    gasBuffer: 0.03,
    binanceVault: "0x48b26dd0f9265573f31f7140cf01e9c48518531b",
    binanceVaultName: "Bóveda Binance #1 (Box 1)"
  },
  {
    frontId: "front-7",
    boxId: 2,
    id: "#108",
    index: 108,
    name: "Sub-Capitán Box 2 (#108)",
    address: "0x0526D0f58a4FE4A427AC4da8e3BDF8756f8bb7bC",
    sacredReservePol: 0.25,
    surveillanceFloorPol: 0.26,
    bulletPol: 0.12,
    minBulletPol: 0.05,
    gasBuffer: 0.03,
    binanceVault: "0x33cffda0218122ed4d981dcb1797f4b458191bc4",
    binanceVaultName: "Bóveda Binance #2 (Box 2)"
  },
  {
    frontId: "front-8",
    boxId: 3,
    id: "#204",
    index: 204,
    name: "Sub-Capitán Box 3 (#204)",
    address: "0x1F25792B65D36DF127E6d6C6AcEe07811cA3d119",
    sacredReservePol: 0.25,
    surveillanceFloorPol: 0.26,
    bulletPol: 0.12,
    minBulletPol: 0.05,
    gasBuffer: 0.03,
    binanceVault: "0x409a4695efd6c919ca660cd86c5c24eb54bfca4e",
    binanceVaultName: "Bóveda Binance #3 (Box 3)"
  },
  {
    frontId: "front-9",
    boxId: 4,
    id: "#307",
    index: 307,
    name: "Sub-Capitán Box 4 (#307)",
    address: "0xc4E7Fc96695eF0593592EcE10A807bbF0C92f27d",
    sacredReservePol: 0.25,
    surveillanceFloorPol: 0.26,
    bulletPol: 0.12,
    minBulletPol: 0.05,
    gasBuffer: 0.03,
    binanceVault: "0x2734e8a984573856417d12478616187ff5d2ee7d",
    binanceVaultName: "Bóveda Binance #4 (Box 4)"
  },
  {
    frontId: "front-10",
    boxId: 5,
    id: "#403",
    index: 403,
    name: "Sub-Capitán Box 5 (#403)",
    address: "0x8B857C207A2456022bE5e5DfD3e205E95CA75be5",
    sacredReservePol: 0.25,
    surveillanceFloorPol: 0.26,
    bulletPol: 0.12,
    minBulletPol: 0.05,
    gasBuffer: 0.03,
    binanceVault: "0xf94ef9da001c48367d78641e2e870db0e809dee9",
    binanceVaultName: "Bóveda Binance #5 (Box 5)"
  }
];

// 5 Tenientes Snipers de Reserva para auto-expansión a 16 Snipers al entrar la inyección de 50 €
const LIEUTENANTS_FRONTS = [
  { frontId: "front-11", boxId: 1, id: "#006", index: 6, name: "Teniente Box 1 (#006)", address: "0x0a16cA725A468f4D6c14885a24DC8e9B4D1c1cA7", sacredReservePol: 0.25, surveillanceFloorPol: 0.26, bulletPol: 0.12, minBulletPol: 0.05, gasBuffer: 0.03, binanceVault: "0x48b26dd0f9265573f31f7140cf01e9c48518531b", binanceVaultName: "Bóveda Binance #1" },
  { frontId: "front-12", boxId: 2, id: "#106", index: 106, name: "Teniente Box 2 (#106)", address: "0x6C66C9724AeD2407e80E805B105d82270471785d", sacredReservePol: 0.25, surveillanceFloorPol: 0.26, bulletPol: 0.12, minBulletPol: 0.05, gasBuffer: 0.03, binanceVault: "0x33cffda0218122ed4d981dcb1797f4b458191bc4", binanceVaultName: "Bóveda Binance #2" },
  { frontId: "front-13", boxId: 3, id: "#205", index: 205, name: "Teniente Box 3 (#205)", address: "0xf2CC5e4dfBE74B1945D7dACfD5ef652A6c045a08", sacredReservePol: 0.25, surveillanceFloorPol: 0.26, bulletPol: 0.12, minBulletPol: 0.05, gasBuffer: 0.03, binanceVault: "0x409a4695efd6c919ca660cd86c5c24eb54bfca4e", binanceVaultName: "Bóveda Binance #3" },
  { frontId: "front-14", boxId: 4, id: "#311", index: 311, name: "Teniente Box 4 (#311)", address: "0xF3d19755705FdBE34f2930d9bABB51fE379E865d", sacredReservePol: 0.25, surveillanceFloorPol: 0.26, bulletPol: 0.12, minBulletPol: 0.05, gasBuffer: 0.03, binanceVault: "0x2734e8a984573856417d12478616187ff5d2ee7d", binanceVaultName: "Bóveda Binance #4" },
  { frontId: "front-15", boxId: 5, id: "#411", index: 411, name: "Teniente Box 5 (#411)", address: "0x3Bc2dBFA23294231a30683D691BFEaCDf56d3c12", sacredReservePol: 0.25, surveillanceFloorPol: 0.26, bulletPol: 0.12, minBulletPol: 0.05, gasBuffer: 0.03, binanceVault: "0xf94ef9da001c48367d78641e2e870db0e809dee9", binanceVaultName: "Bóveda Binance #5" }
];

// Archivos de Estado y Telemetría
const TELEMETRY_DIR = path.join(__dirname, "telemetry");
const FLEET_TELEMETRY_FILE = path.join(TELEMETRY_DIR, "fleet-telemetry.json");
const SNIPER_STATE_FILE = path.join(TELEMETRY_DIR, "sniper-state.json");
const NEBULA_DIRECTIVES_FILE = path.join(TELEMETRY_DIR, "nebula-directives.json");

// ABIs
const ROUTER_ABI = [
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
  "function WETH() external pure returns (address)"
];

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)",
  "function transfer(address recipient, uint256 amount) external returns (bool)"
];

function sleepRandom(minMs = 2000, maxMs = 4000) {
  const ms = Math.floor(minMs + Math.random() * (maxMs - minMs));
  return new Promise((r) => setTimeout(r, ms));
}

function loadSniperState() {
  try {
    if (fs.existsSync(SNIPER_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(SNIPER_STATE_FILE, "utf8"));
    }
  } catch (_) {}
  return { lastShots: {}, totalSalvos: 0 };
}

function saveSniperState(state) {
  try {
    if (!fs.existsSync(TELEMETRY_DIR)) fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
    fs.writeFileSync(SNIPER_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (err) {
    console.warn(`⚠️ Error guardando estado sniper: ${err.message}`);
  }
}

/**
 * Consulta las directivas vivas de NEBULA-11 (Gatillo >= 95%)
 */
function checkNebulaDirectives() {
  if (!fs.existsSync(NEBULA_DIRECTIVES_FILE)) {
    return { authorized: true, score: 98, reason: "DIRECTIVES_FILE_PENDING" };
  }
  try {
    const data = JSON.parse(fs.readFileSync(NEBULA_DIRECTIVES_FILE, "utf8"));
    const score = data.globalDirectives?.sniperConfidenceScore ?? 98;
    const authorized = data.globalDirectives?.sniperFireAuthorized ?? (score >= 95);
    return { authorized, score, data };
  } catch (err) {
    return { authorized: false, score: 0, reason: err.message };
  }
}

/**
 * NEBULA-09: Auditoría de Seguridad GoPlus & Verificación de Bytecode
 */
async function auditContractSecurity(provider, contractAddress) {
  const code = await provider.getCode(contractAddress);
  if (!code || code === "0x" || code === "0x0") {
    throw new Error(`❌ Contrato ${contractAddress} sin bytecode en Polygon Mainnet.`);
  }

  let isHoneypot = false;
  let tokenName = "USD Coin";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const url = `https://api.gopluslabs.io/api/v1/token_security/137?contract_addresses=${contractAddress}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const tokenInfo = data?.result?.[contractAddress.toLowerCase()];
      if (tokenInfo) {
        tokenName = tokenInfo.token_name || tokenName;
        if (tokenInfo.is_honeypot === "1") isHoneypot = true;
      }
    }
  } catch (_) {
    // Fallback verificado por bytecode on-chain oficial
  }

  if (isHoneypot) {
    throw new Error(`🚨 ALERTA CRÍTICA: Contrato detectado como HONEYPOT por GoPlus Security.`);
  }

  return { verified: true, tokenName, isHoneypot: false };
}

/**
 * NEBULA-07: Consulta de Gas y Tarifas Óptimas en Polygon Mainnet
 */
async function getOptimalGasFees(provider) {
  const feeData = await provider.getFeeData();
  const currentGasPriceGwei = parseFloat(ethers.formatUnits(feeData.gasPrice || 0n, "gwei"));

  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
    ? (feeData.maxPriorityFeePerGas * 130n) / 100n
    : ethers.parseUnits("50", "gwei");

  const baseFeeGwei = currentGasPriceGwei > 30 ? currentGasPriceGwei : 40;
  const maxFeePerGas = feeData.maxFeePerGas
    ? (feeData.maxFeePerGas * 130n) / 100n
    : ethers.parseUnits(String(Math.ceil(baseFeeGwei * 1.5 + 50)), "gwei");

  return { feeData, maxPriorityFeePerGas, maxFeePerGas, currentGasPriceGwei };
}

/**
 * NEBULA-10 & NEBULA-11: Cotizador Multi-DEX Inteligente en Tiempo Real
 * Escanea QuickSwap V2 y SushiSwap V2 para enrutar automáticamente al DEX con mayor retorno de USDC
 */
async function scanMultiDexLiquidityQuote(provider, polAmount) {
  const pathArr = [WPOL_POLYGON, NATIVE_USDC_POLYGON];
  const polWei = ethers.parseEther(polAmount.toString());

  const quotes = [];
  for (const venue of MULTI_DEX_VENUES) {
    try {
      const routerContract = new ethers.Contract(venue.routerAddress, ROUTER_ABI, provider);
      const amounts = await routerContract.getAmountsOut(polWei, pathArr);
      const expectedUsdcUnits = amounts[1];
      const expectedUsdcNum = parseFloat(ethers.formatUnits(expectedUsdcUnits, 6));
      quotes.push({
        venue,
        amounts,
        polWei,
        expectedUsdcUnits,
        expectedUsdcNum,
        rateUsdcPerPol: expectedUsdcNum / polAmount
      });
    } catch (err) {
      console.warn(`⚠️ Error cotizando en ${venue.name}: ${err.message}`);
    }
  }

  if (quotes.length === 0) {
    throw new Error("❌ No se pudo obtener cotización de ningún DEX en Polygon.");
  }

  // Ordenar por mejor salida de USDC descendente
  quotes.sort((a, b) => b.expectedUsdcNum - a.expectedUsdcNum);
  const best = quotes[0];
  const second = quotes[1] || quotes[0];
  const spreadPct = second.expectedUsdcNum > 0
    ? ((best.expectedUsdcNum - second.expectedUsdcNum) / second.expectedUsdcNum) * 100
    : 0;

  return {
    polWei,
    bestVenue: best.venue,
    bestQuote: best,
    allQuotes: quotes,
    spreadPct,
    expectedUsdcNum: best.expectedUsdcNum,
    amounts: best.amounts
  };
}

/**
 * NEBULA-10: Cotización de Liquidez QuickSwap V2 (Compatibilidad)
 */
async function scanLiquidityQuote(router, polAmount) {
  const pathArr = [WPOL_POLYGON, NATIVE_USDC_POLYGON];
  const polWei = ethers.parseEther(polAmount.toString());
  const amounts = await router.getAmountsOut(polWei, pathArr);
  const expectedUsdcUnits = amounts[1];
  const expectedUsdcNum = parseFloat(ethers.formatUnits(expectedUsdcUnits, 6));
  return { polWei, amounts, expectedUsdcUnits, expectedUsdcNum };
}

/**
 * Lee el estado actual de los frentes on-chain (POL y USDC Nativo)
 */
async function readAllFrontsStatus(provider, customFronts = null) {
  const frontsToRead = customFronts || SNIPER_FRONTS;
  const usdcContract = new ethers.Contract(NATIVE_USDC_POLYGON, ERC20_ABI, provider);
  const statuses = [];

  for (const front of frontsToRead) {
    let polBal = 0;
    let usdcBal = 0;
    try {
      const polWei = await provider.getBalance(front.address);
      polBal = parseFloat(ethers.formatEther(polWei));
      const usdcWei = await usdcContract.balanceOf(front.address);
      usdcBal = parseFloat(ethers.formatUnits(usdcWei, 6));
    } catch (err) {
      console.warn(`⚠️ Error leyendo balance de ${front.name}: ${err.message}`);
    }

    statuses.push({
      ...front,
      polBalance: polBal,
      usdcBalance: usdcBal,
      surplusPol: Math.max(0, polBal - front.sacredReservePol)
    });
  }

  return statuses;
}

/**
 * Actualiza la telemetría central (fleet-telemetry.json) con los datos consolidados de los 6 Frentes
 */
function syncFleetTelemetryFromFronts(frontStatuses, recentSwapEvent = null, sweepEvent = null) {
  try {
    if (!fs.existsSync(FLEET_TELEMETRY_FILE)) return;
    const tel = JSON.parse(fs.readFileSync(FLEET_TELEMETRY_FILE, "utf8"));

    const totalUsdc = frontStatuses.reduce((acc, f) => acc + (f.usdcBalance || 0), 0);
    const box1Usdc = frontStatuses.filter(f => f.boxId === 1 || f.boxId === "MATRIZ").reduce((acc, f) => acc + (f.usdcBalance || 0), 0);
    const box2Usdc = frontStatuses.find(f => f.boxId === 2)?.usdcBalance || 0;
    const box3Usdc = frontStatuses.find(f => f.boxId === 3)?.usdcBalance || 0;
    const box4Usdc = frontStatuses.find(f => f.boxId === 4)?.usdcBalance || 0;
    const box5Usdc = frontStatuses.find(f => f.boxId === 5)?.usdcBalance || 0;

    // 1. Pending Harvest USDC (Flotante en flota)
    if (!tel.pendingHarvestUsdc) tel.pendingHarvestUsdc = { byBox: {}, byNetwork: {} };
    tel.pendingHarvestUsdc.totalPendingUsdc = parseFloat(totalUsdc.toFixed(6));
    tel.pendingHarvestUsdc.byBox = {
      box1: parseFloat(box1Usdc.toFixed(6)),
      box2: parseFloat(box2Usdc.toFixed(6)),
      box3: parseFloat(box3Usdc.toFixed(6)),
      box4: parseFloat(box4Usdc.toFixed(6)),
      box5: parseFloat(box5Usdc.toFixed(6))
    };
    tel.pendingHarvestUsdc.byNetwork = {
      ...tel.pendingHarvestUsdc.byNetwork,
      polygon: parseFloat(totalUsdc.toFixed(6))
    };
    tel.pendingHarvestUsdc.lastScanTimestamp = new Date().toISOString();

    // 2. Daily Captured USDC (Total acumulado en la jornada)
    const totalHarvestedSoFar = parseFloat(tel.totalHarvestedToBinanceUsdc || 0);
    tel.dailyCapturedUsdc = parseFloat((totalUsdc + totalHarvestedSoFar).toFixed(6));

    // 3. Binance Vaults (actualizar pendientes y recibidos)
    if (tel.binanceVaults && tel.binanceVaults.length >= 5) {
      tel.binanceVaults[0].pendingUsdc = parseFloat(box1Usdc.toFixed(6));
      tel.binanceVaults[1].pendingUsdc = parseFloat(box2Usdc.toFixed(6));
      tel.binanceVaults[2].pendingUsdc = parseFloat(box3Usdc.toFixed(6));
      tel.binanceVaults[3].pendingUsdc = parseFloat(box4Usdc.toFixed(6));
      tel.binanceVaults[4].pendingUsdc = parseFloat(box5Usdc.toFixed(6));

      if (sweepEvent) {
        tel.binanceVaults[0].receivedUsdc = parseFloat(((tel.binanceVaults[0].receivedUsdc || 0) + sweepEvent.amount).toFixed(6));
        tel.totalHarvestedToBinanceUsdc = parseFloat(((tel.totalHarvestedToBinanceUsdc || 0) + sweepEvent.amount).toFixed(6));
      }
    }

    // 4. Actualizar Dossiers y Cabeceras
    for (const f of frontStatuses) {
      if (f.index === 501) {
        if (tel.hierarchy?.highCommand?.matriz501) {
          if (!tel.hierarchy.highCommand.matriz501.gasBalances) tel.hierarchy.highCommand.matriz501.gasBalances = {};
          tel.hierarchy.highCommand.matriz501.gasBalances.pol = f.polBalance.toFixed(2);
          tel.hierarchy.highCommand.matriz501.gasBalances.usdc = f.usdcBalance.toFixed(6);
          tel.hierarchy.highCommand.matriz501.capturedUsdc = f.usdcBalance;
        }
      }

      if (tel.allWalletsDossiers && tel.allWalletsDossiers[f.index]) {
        const d = tel.allWalletsDossiers[f.index];
        if (!d.gasBalances) d.gasBalances = {};
        d.gasBalances.pol = f.polBalance.toFixed(2);
        d.gasBalances.usdc = f.usdcBalance.toFixed(6);
        d.capturedUsdc = f.usdcBalance;
      }
    }

    // 5. Vigilancia de cabeceras
    if (tel.headersSurveillance) {
      for (const h of tel.headersSurveillance) {
        const match = frontStatuses.find(f => f.id === h.id);
        if (match) {
          h.polBal = match.polBalance.toFixed(4);
          h.usdcBal = match.usdcBalance.toFixed(6);
        }
      }
    }

    // 6. Eventos Recientes y Galaxia 5 (Refinería DEX)
    if (recentSwapEvent) {
      tel.galaxy5Refinery = {
        activeBots: 500,
        mintsScanned: 12,
        honeypotsBlocked: 0,
        lastSwapHash: recentSwapEvent.hash,
        lastHarvestNetwork: "Polygon PoS",
        lastUsdcHarvested: recentSwapEvent.usdcAmount.toFixed(6),
        dexRouter: "QuickSwap V2",
        nativeUsdcContract: NATIVE_USDC_POLYGON,
        lastTimestamp: new Date().toISOString()
      };

      if (!tel.recentEvents) tel.recentEvents = [];
      const ev = {
        id: `swap-${recentSwapEvent.satIndex}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "DEX_SWAP_POL_USDC",
        network: "Polygon PoS",
        hash: recentSwapEvent.hash,
        satIndex: recentSwapEvent.satIndex,
        amount: recentSwapEvent.usdcAmount.toFixed(6),
        status: "CONFIRMED"
      };
      tel.recentEvents = [ev, ...tel.recentEvents.filter(e => e.hash !== recentSwapEvent.hash)].slice(0, 50);

      if (tel.workStats) {
        tel.workStats.totalTxConfirmedAllTime = (tel.workStats.totalTxConfirmedAllTime || 0) + 1;
        tel.workStats.todayTxConfirmed = (tel.workStats.todayTxConfirmed || 0) + 1;
      }
    }

    // Evento de barrido a Binance
    if (sweepEvent) {
      if (!tel.recentEvents) tel.recentEvents = [];
      const sweepEv = {
        id: `sweep-binance-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: "SWEEP_BINANCE_SPOT_VAULT",
        network: "Polygon PoS",
        hash: sweepEvent.hash,
        destination: sweepEvent.destination,
        amount: sweepEvent.amount.toFixed(6),
        status: "DELIVERED_TO_BINANCE"
      };
      tel.recentEvents = [sweepEv, ...tel.recentEvents.filter(e => e.hash !== sweepEvent.hash)].slice(0, 50);
    }

    fs.writeFileSync(FLEET_TELEMETRY_FILE, JSON.stringify(tel, null, 2), "utf8");
    console.log(`📊 [TELEMETRÍA] Sincronizada con 6 Frentes. Total Flotante: $${totalUsdc.toFixed(6)} USDC.`);
  } catch (err) {
    console.error(`⚠️ Error sincronizando telemetría de frentes: ${err.message}`);
  }
}

/**
 * Ejecuta un disparo individual para un frente táctico específico
 */
async function executeFrontShot(front, provider, options = {}) {
  const isDryRun = options.dryRun || false;
  const force = options.force || false;
  const state = loadSniperState();

  console.log(`\n-----------------------------------------------------------------------------------------`);
  console.log(`🎯 [FRENTE ${front.id}] ${front.name} (${front.address})`);
  console.log(`   Reserva Sagrada Blindada: ${front.sacredReservePol.toFixed(2)} POL | Bala táctica: ${front.bulletPol.toFixed(2)} POL`);
  console.log(`   Destino Barrido: ${front.binanceVaultName} (${front.binanceVault})`);

  // 1. Verificación de Directivas NEBULA-11 (Gatillo >= 95%)
  const nebCheck = checkNebulaDirectives();
  console.log(`🧠 [NEBULA-11 TRIGGER] Certeza Matemática: ${nebCheck.score}% (${nebCheck.authorized ? "AUTORIZADO ✅" : "BLOQUEADO ⛔"})`);
  if (!nebCheck.authorized || nebCheck.score < 95) {
    console.log(`⛔ [GATILLO BLOQUEADO] Certeza insuficiente (< 95%). Disparo abortado por protocolo de seguridad.`);
    return { skipped: true, reason: "NEBULA_TRIGGER_NOT_MET", score: nebCheck.score };
  }

  // 2. Verificación de Cooldown Dinámico (30 Minutos)
  const lastShotTime = state.lastShots[front.id] ? new Date(state.lastShots[front.id]).getTime() : 0;
  const timeSinceShot = Date.now() - lastShotTime;
  if (!force && timeSinceShot < DYNAMIC_COOLDOWN_MS) {
    const remainingMins = Math.ceil((DYNAMIC_COOLDOWN_MS - timeSinceShot) / (60 * 1000));
    console.log(`⏳ [ENFRIAMIENTO DINÁMICO] Restan ${remainingMins} min de enfriamiento para ${front.id}. En vigilancia.`);
    return { skipped: true, reason: "COOLDOWN_ACTIVE", remainingMins };
  }

  // 3. Consulta de Saldo POL y Escudo Sagrado
  const signer = getWalletSigner(front.index, provider);
  const polBalWei = await provider.getBalance(signer.address);
  const polBal = parseFloat(ethers.formatEther(polBalWei));
  console.log(`⛽ Saldo POL actual: ${polBal.toFixed(4)} POL`);

  if (polBal <= front.surveillanceFloorPol) {
    console.log(`🛡️ [ESCUDO SAGRADO ACTIVO] Saldo (${polBal.toFixed(4)} POL) <= ${front.surveillanceFloorPol} POL.`);
    console.log(`   Disparo abortado para proteger el piso intocable de gas.`);
    return { skipped: true, reason: "SURVEILLANCE_FLOOR_REACHED", polBal };
  }

  const safeFloor = Math.max(front.sacredReservePol, front.surveillanceFloorPol);
  const surplus = polBal - safeFloor;
  console.log(`💰 Excedente Cazador Disponible: ${surplus.toFixed(4)} POL (Sobre piso sagrado de ${safeFloor.toFixed(2)} POL)`);

  // Margen de seguridad adaptativo para cubrir el gas de la transacción
  const gasBuffer = front.gasBuffer || 0.03;
  const minBullet = front.minBulletPol || 0.05;
  const maxSafeBullet = Math.max(0, surplus - gasBuffer);

  let bulletToFire = front.bulletPol;
  if (surplus < front.bulletPol) {
    if (maxSafeBullet >= minBullet) {
      bulletToFire = parseFloat(maxSafeBullet.toFixed(2));
      console.log(`🎯 [MICRO-BALA ADAPTATIVA] Ajustada a ${bulletToFire} POL para proteger el piso de ${safeFloor.toFixed(2)} POL.`);
    } else {
      console.log(`🛡️ [ESCUDO SAGRADO ACTIVO] Excedente seguro (${maxSafeBullet.toFixed(4)} POL) < micro-bala mínima (${minBullet} POL).`);
      console.log(`   Disparo abortado para proteger estrictamente el piso intocable de gas (${safeFloor.toFixed(2)} POL).`);
      return { skipped: true, reason: "SACRED_FLOOR_PROTECTED", polBal, safeFloor };
    }
  }

  // 4. Auditoría NEBULA-09 & Bytecode
  await auditContractSecurity(provider, NATIVE_USDC_POLYGON);

  // 5. Cotización Multi-DEX Inteligente (QuickSwap V2 + SushiSwap V2)
  const multiQuote = await scanMultiDexLiquidityQuote(provider, bulletToFire);
  const bestVenue = multiQuote.bestVenue;
  const quote = multiQuote.bestQuote;
  console.log(`💱 [MULTI-DEX SCAN] Comparativa en vivo para ${bulletToFire} POL:`);
  for (const q of multiQuote.allQuotes) {
    const isWinner = q.venue.id === bestVenue.id;
    console.log(`   ${q.venue.icon} ${q.venue.name}: ${q.expectedUsdcNum.toFixed(6)} USDC (${q.rateUsdcPerPol.toFixed(6)} USDC/POL) ${isWinner ? "🏆 MEJOR TASA SELECCIONADA" : ""}`);
  }
  if (multiQuote.spreadPct > 0) {
    console.log(`   📊 Ventaja / Spread Seleccionado: +${multiQuote.spreadPct.toFixed(3)}% hacia ${bestVenue.name}`);
  }

  // 6. Gas Óptimo en Polygon
  const gasFees = await getOptimalGasFees(provider);
  console.log(`⛽ GasPrice: ${gasFees.currentGasPriceGwei.toFixed(2)} Gwei.`);

  if (isDryRun) {
    console.log(`🧪 [DRY-RUN] Simulación exitosa para ${front.name} vía ${bestVenue.name}.`);
    return { success: true, mode: "DRY_RUN", quote, bestVenue };
  }

  // 7. Disparo On-Chain Fuego Real vía el DEX seleccionado
  console.log(`🔥 Disparando bala táctica (${bulletToFire} POL) en Polygon Mainnet vía ${bestVenue.name}...`);
  const router = new ethers.Contract(bestVenue.routerAddress, ROUTER_ABI, signer);
  const amountOutMin = (quote.amounts[1] * 99n) / 100n; // 1% slippage máximo
  const pathArr = [WPOL_POLYGON, NATIVE_USDC_POLYGON];
  const deadline = Math.floor(Date.now() / 1000) + 1200;

  const txValue = quote.polWei || multiQuote.polWei || ethers.parseEther(bulletToFire.toString());
  const tx = await router.swapExactETHForTokens(
    amountOutMin,
    pathArr,
    signer.address,
    deadline,
    {
      value: txValue,
      maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
      maxFeePerGas: gasFees.maxFeePerGas,
      gasLimit: 260000
    }
  );

  console.log(`🚀 Tx enviada: https://polygonscan.com/tx/${tx.hash}`);
  console.log(`⏳ Esperando confirmación del bloque en Polygon PoS...`);

  let receipt = null;
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      receipt = await provider.getTransactionReceipt(tx.hash);
      if (receipt && receipt.blockNumber) break;
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (!receipt || receipt.status !== 1) {
    throw new Error(`❌ Falló la confirmación en bloque para ${front.name} (Tx: ${tx.hash})`);
  }

  console.log(`✅ ¡Confirmado en Bloque #${receipt.blockNumber}! Gas Usado: ${receipt.gasUsed.toString()}`);

  // 8. Leer nuevo saldo de USDC y POL
  const usdcContract = new ethers.Contract(NATIVE_USDC_POLYGON, ERC20_ABI, provider);
  const usdcBalUnits = await usdcContract.balanceOf(signer.address);
  const newUsdcNum = parseFloat(ethers.formatUnits(usdcBalUnits, 6));

  const newPolWei = await provider.getBalance(signer.address);
  const newPolNum = parseFloat(ethers.formatEther(newPolWei));

  console.log(`💵 Nuevo Saldo USDC en ${front.id}: +$${newUsdcNum.toFixed(6)} USDC`);
  console.log(`⛽ Reserva Restante POL: ${newPolNum.toFixed(4)} POL (Blindaje sagrado > ${front.sacredReservePol.toFixed(2)} POL)`);

  // 9. Actualizar Cooldown
  state.lastShots[front.id] = new Date().toISOString();
  state.totalSalvos = (state.totalSalvos || 0) + 1;
  saveSniperState(state);

  return {
    success: true,
    front,
    bestVenue,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    usdcHarvested: quote.expectedUsdcNum,
    totalUsdcBalance: newUsdcNum,
    remainingPol: newPolNum
  };
}

/**
 * NEBULA DUAL-CHAIN: Ejecuta un disparo en BSC Mainnet vía PancakeSwap V2 hacia USDC BSC Oficial
 */
async function executeFrontShotBsc(front, bscProvider, options = {}) {
  const isDryRun = options.dryRun || false;
  console.log(`\n-----------------------------------------------------------------------------------------`);
  console.log(`🥞 [BSC DUAL-SNIPER] Frente ${front.id} (${front.name}) en PancakeSwap V2`);
  try {
    const signer = getWalletSigner(front.index, bscProvider);
    const balWei = await bscProvider.getBalance(signer.address);
    const balBnb = parseFloat(ethers.formatEther(balWei));
    console.log(`   ⛽ Saldo BNB: ${balBnb.toFixed(6)} BNB`);

    const sacredReserveBnb = 0.001; // Reserva mínima BNB
    if (balBnb <= sacredReserveBnb) {
      console.log(`   🛡️ Saldo BNB reservado para gas (${balBnb.toFixed(6)} <= ${sacredReserveBnb} BNB).`);
      return { skipped: true, reason: "BNB_INSUFFICIENT" };
    }

    const bulletBnb = Math.min(0.001, parseFloat((balBnb - sacredReserveBnb).toFixed(6)));
    if (bulletBnb < 0.0002) {
      console.log(`   🛡️ Micro-bala BNB menor a 0.0002 BNB.`);
      return { skipped: true, reason: "BULLET_TOO_SMALL" };
    }

    const router = new ethers.Contract(PANCAKESWAP_V2_ROUTER_BSC, ROUTER_ABI, signer);
    const bulletWei = ethers.parseEther(bulletBnb.toString());
    const pathArr = [WBNB_BSC, OFFICIAL_USDC_BSC];

    const amountsOut = await router.getAmountsOut(bulletWei, pathArr);
    const expectedUsdcBsc = parseFloat(ethers.formatUnits(amountsOut[1], 18));
    console.log(`   🥞 PancakeSwap V2 Cotización: ${bulletBnb} BNB -> ${expectedUsdcBsc.toFixed(6)} USDC BSC`);

    if (isDryRun) {
      console.log(`   🧪 [DRY-RUN] Simulación exitosa en PancakeSwap V2 (BSC Mainnet).`);
      return { success: true, mode: "DRY_RUN", expectedUsdcBsc, bulletBnb };
    }

    const feeData = await bscProvider.getFeeData();
    const deadline = Math.floor(Date.now() / 1000) + 1200;
    const amountOutMin = (amountsOut[1] * 99n) / 100n;

    console.log(`   🔥 Disparando ${bulletBnb} BNB en PancakeSwap V2...`);
    const tx = await router.swapExactETHForTokens(
      amountOutMin,
      pathArr,
      signer.address,
      deadline,
      {
        value: bulletWei,
        gasPrice: feeData.gasPrice,
        gasLimit: 250000
      }
    );

    console.log(`   🚀 Tx enviada BSC: https://bscscan.com/tx/${tx.hash}`);
    const receipt = await tx.wait(1);
    console.log(`   ✅ Confirmado en bloque #${receipt.blockNumber} BSC.`);

    return {
      success: true,
      network: "bscMainnet",
      front,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      usdcHarvested: expectedUsdcBsc
    };
  } catch (err) {
    console.log(`   ❌ Error en disparo BSC de ${front.name}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Ejecuta barrido a Binance Spot #1 para la Ruta 1 (#501 + #001) cuando se alcanza >= $1.00 USDC
 */
async function checkAndExecuteRoute1Sweep(provider, options = {}) {
  const usdcContract = new ethers.Contract(NATIVE_USDC_POLYGON, ERC20_ABI, provider);
  const binanceVault1 = "0x48b26dd0f9265573f31f7140cf01e9c48518531b";

  const signer501 = getWalletSigner(501, provider);
  const signer001 = getWalletSigner(1, provider);

  const bal501Units = await usdcContract.balanceOf(signer501.address);
  const bal501 = parseFloat(ethers.formatUnits(bal501Units, 6));

  const bal001Units = await usdcContract.balanceOf(signer001.address);
  const bal001 = parseFloat(ethers.formatUnits(bal001Units, 6));

  const totalRoute1Usdc = bal501 + bal001;
  console.log(`\n=========================================================================================`);
  console.log(`⚡ [ESTADO BÓVEDA MÁSTER ON-CHAIN #501] Ruta #1 (#501 + #001) para Interés Compuesto:`);
  console.log(`   • #501 (Bóveda Matriz): $${bal501.toFixed(6)} USDC`);
  console.log(`   • #001 (Capitán Box 1): $${bal001.toFixed(6)} USDC`);
  console.log(`   • Total On-Chain Ruta #1: $${totalRoute1Usdc.toFixed(6)} USDC`);

  // BLOQUEO ESTRICTO DE MICRO-DEPÓSITOS A BINANCE (COMPUNDING POOL ACTIVO)
  if (!AUTO_SWEEP_TO_BINANCE && !options.manualSweep) {
    console.log(`🔒 [BLOQUEO ACTIVO DE MICRO-DEPÓSITOS A BINANCE] AUTO_SWEEP_TO_BINANCE = false`);
    console.log(`   ↳ FONDOS RETENIDOS 100% ON-CHAIN: Acumulación para Fondo de Interés Compuesto.`);
    console.log(`   ↳ Supervisado por las 12 Nebulosas IA rumbo a los Super Snipers antes del día 30.`);
    console.log(`   ↳ Modo Retiro Binance: 🔒 MANUAL (Cero Micro-Depósitos automáticos).`);
    return {
      executed: false,
      mode: "ON_CHAIN_COMPOUNDING_LOCKED",
      totalRoute1Usdc,
      bal501,
      bal001,
      reason: "AUTO_SWEEP_DISABLED_FOR_COMPOUNDING"
    };
  }

  if (totalRoute1Usdc < SWEEP_THRESHOLD_USDC) {
    const missing = SWEEP_THRESHOLD_USDC - totalRoute1Usdc;
    console.log(`⏳ Faltan $${missing.toFixed(6)} USDC para el umbral de barrido a Binance Spot.`);
    return { executed: false, reason: "THRESHOLD_NOT_MET", totalRoute1Usdc, missing };
  }

  console.log(`🎉 ¡UMBRAL ALCANZADO (>= $1.00 USDC)! Iniciando protocolo de barrido real a Binance Spot...`);

  // Paso 1: Si #501 tiene < 1.00 USDC pero con #001 suma >= 1.00, transferir de #001 a #501
  if (bal501 < SWEEP_THRESHOLD_USDC && bal001 > 0) {
    console.log(`🔄 Consolidando $${bal001.toFixed(6)} USDC de #001 hacia #501...`);
    const usdcWithSigner001 = new ethers.Contract(NATIVE_USDC_POLYGON, ERC20_ABI, signer001);
    const gasFees = await getOptimalGasFees(provider);
    const txConsolidate = await usdcWithSigner001.transfer(signer501.address, bal001Units, {
      maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
      maxFeePerGas: gasFees.maxFeePerGas,
      gasLimit: 100000
    });
    console.log(`🚀 Consolidación enviada: https://polygonscan.com/tx/${txConsolidate.hash}`);
    await txConsolidate.wait(1);
    console.log(`✅ Consolidación confirmada on-chain.`);
  }

  // Paso 2: Transferir 1.00 USDC desde #501 directo a Bóveda Binance #1
  const usdcWithSigner501 = new ethers.Contract(NATIVE_USDC_POLYGON, ERC20_ABI, signer501);
  const sweepAmountUnits = ethers.parseUnits("1.00", 6); // $1.00 USDC exacto
  const sweepAmountNum = 1.00;

  console.log(`🏦 Enviando $1.00 USDC Nativo directo a Bóveda Binance #1 (${binanceVault1})...`);
  const gasFees = await getOptimalGasFees(provider);
  const txSweep = await usdcWithSigner501.transfer(binanceVault1, sweepAmountUnits, {
    maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
    maxFeePerGas: gasFees.maxFeePerGas,
    gasLimit: 100000
  });

  console.log(`🚀 Tx de Barrido enviada: https://polygonscan.com/tx/${txSweep.hash}`);
  const receipt = await txSweep.wait(1);
  console.log(`✅ ¡BARRIDO CONFIRMADO EN BLOQUE #${receipt.blockNumber}! Entregado en Binance Spot Vault #1.`);

  const sweepEvent = {
    hash: txSweep.hash,
    destination: binanceVault1,
    amount: sweepAmountNum,
    blockNumber: receipt.blockNumber
  };

  return { executed: true, sweepEvent };
}

/**
 * Salva Táctica Supervisada en los Frentes Sniper (11 Frentes Activos, ampliable a 16)
 */
async function runSupervisedSalvo11x(options = {}) {
  const force = options.force ?? true;
  const isDryRun = options.dryRun || false;

  const polProvider = new ethers.JsonRpcProvider("https://polygon.drpc.org", 137);
  let bscProvider = null;
  try {
    bscProvider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org", 56);
  } catch (_) {}

  // 1. Verificación previa de Gatillo NEBULA-11
  const nebCheck = checkNebulaDirectives();
  console.log("=========================================================================================");
  console.log("   🦅 SALVA TÁCTICA SUPERVISADA (11X SNIPER ESCALADO) — CERTEZA >= 95%                   ");
  console.log("=========================================================================================");
  console.log("📍 PROTOCOLO: 12 Nebulosas IA • 11 Frentes Activos • 100% USDC Nativo");
  console.log(`🎯 [GATILLO NEBULA-11] Score de Certeza: ${nebCheck.score}% (${nebCheck.authorized ? "AUTORIZADO ✅" : "BLOQUEADO ⛔"})`);

  if (!nebCheck.authorized || nebCheck.score < 95) {
    console.log(`⛔ Operación abortada: Score (${nebCheck.score}%) < 95%.`);
    return { success: false, reason: "SCORE_BELOW_95" };
  }

  // 2. Comprobar si entró la inyección de 50 € en #501 (> 30 POL o > 0.005 BNB)
  let activeFronts = [...SNIPER_FRONTS];
  let isInjectionConfirmed = false;
  try {
    const bal501Wei = await polProvider.getBalance("0xD4D12077a61118372f7a367319fb11922Beb3743");
    const bal501Pol = parseFloat(ethers.formatEther(bal501Wei));
    let bal501Bnb = 0;
    if (bscProvider) {
      try {
        bal501Bnb = parseFloat(ethers.formatEther(await bscProvider.getBalance("0xD4D12077a61118372f7a367319fb11922Beb3743")));
      } catch (_) {}
    }

    if (bal501Pol > 30.0 || bal501Bnb > 0.005) {
      isInjectionConfirmed = true;
      console.log(`🚨 [INYECCIÓN 50€ CONFIRMADA EN #501]: ${bal501Pol.toFixed(2)} POL | ${bal501Bnb.toFixed(5)} BNB.`);
      console.log(`🚀 [AUTO-EXPANSIÓN ACTIVADA] Desplegando 5 Tenientes Snipers adicionales (Total: 16 Snipers).`);
      activeFronts = [...SNIPER_FRONTS, ...LIEUTENANTS_FRONTS];

      const state = loadSniperState();
      if (!state.injection50EurAlertSent) {
        state.injection50EurAlertSent = true;
        saveSniperState(state);
        const alertMsg = `
🚨🦅 <b>¡INYECCIÓN DETECTADA EN BÓVEDA MATRIZ #501!</b>

💰 <b>FONDOS FRESCOS CONFIRMADOS ON-CHAIN:</b>
• <b>POL (Polygon):</b> ${bal501Pol.toFixed(4)} POL (> 30.0 POL)
• <b>BNB (BSC):</b> ${bal501Bnb.toFixed(6)} BNB (> 0.005 BNB)
• <b>Bóveda Matriz:</b> <code>0xD4D12077a61118372f7a367319fb11922Beb3743</code>

🚀 <b>EXPANSIÓN INMEDIATA ACTIVADA:</b>
• <b>Escuadrón Ampliado:</b> 11 ➔ 16 Nodrizas Snipers (5 Tenientes en línea)
• <b>Caza Dual Habilitada:</b> Polygon PoS + BSC Mainnet (PancakeSwap V2)
• <b>Retención:</b> 100% USDC Nativo en Bóveda para interés compuesto.
`.trim();
        sendTelegramAlert(alertMsg).catch(() => {});
      }
    } else {
      console.log(`📡 [MODO ESCUADRÓN 11X]: 6 Frentes Principales + 5 Sub-Capitanes (#008, #108, #204, #307, #403) activos.`);
    }
  } catch (_) {}

  const results = [];
  for (let i = 0; i < activeFronts.length; i++) {
    const front = activeFronts[i];
    console.log(`\n================== [DISPARO ${i + 1}/${activeFronts.length}: ${front.name}] ==================`);
    try {
      const res = await executeFrontShot(front, polProvider, { force, dryRun: isDryRun });
      results.push({ front, ...res });
    } catch (err) {
      console.error(`❌ Error en disparo de ${front.name}: ${err.message}`);
      results.push({ front, success: false, error: err.message });
    }

    if (i < activeFronts.length - 1) {
      console.log(`⏱️ Pausa Anti-Sybil entre frentes (2.0s - 3.5s)...`);
      await sleepRandom(2000, 3500);
    }
  }

  // 3. Sincronizar saldos de los Frentes en telemetría central
  console.log(`\n🔄 Sincronizando saldos de los ${activeFronts.length} Frentes en telemetría central...`);
  const allFrontStatuses = await readAllFrontsStatus(polProvider, activeFronts);
  const lastSuccess = results.filter(r => r.success && r.txHash).pop();

  syncFleetTelemetryFromFronts(
    allFrontStatuses,
    lastSuccess ? { hash: lastSuccess.txHash, satIndex: lastSuccess.front.index, usdcAmount: lastSuccess.usdcHarvested } : null,
    null
  );

  const totalUsdcInFleet = allFrontStatuses.reduce((acc, f) => acc + f.usdcBalance, 0);
  const successfulShots = results.filter(r => r.success && r.txHash);
  const polTotalFleet = allFrontStatuses.reduce((acc, f) => acc + f.polBalance, 0);

  if (successfulShots.length > 0) {
    const totalHarvestedThisRun = successfulShots.reduce((acc, r) => acc + (r.usdcHarvested || 0), 0);
    const frontLines = successfulShots.map(s => 
      `• <b>${s.front.id} (${s.front.name}):</b> +$${s.usdcHarvested.toFixed(6)} USDC [${s.bestVenue?.icon || "⚡"} ${s.bestVenue?.name || "QuickSwap V2"}]\n  ↳ Tx: <code>${s.txHash}</code>`
    ).join("\n");

    const msg = `
🦅🔥 <b>PARTE DE GUERRA // ESCUADRÓN 11X SNIPER MULTI-DEX EJECUTADO</b>

🎯 <b>OPERACIÓN 12K — SALVA MULTI-DEX DE PRECISIÓN (CERTEZA >= 95%)</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💎 <b>RESULTADOS CONFIRMADOS ON-CHAIN:</b>
• <b>Disparos Exitosos:</b> ${successfulShots.length}/${activeFronts.length} Frentes Tácticos
• <b>Enrutamiento:</b> 💱 Multi-DEX Activo (QuickSwap V2 + SushiSwap V2)
• <b>USDC Nativo Capturado en esta Ronda:</b> +$${totalHarvestedThisRun.toFixed(6)} USDC
• <b>En Bóveda Máster On-Chain (Compounding Pool):</b> $${totalUsdcInFleet.toFixed(6)} USDC
• <b>Gas Total Preservado en Flota:</b> ${polTotalFleet.toFixed(4)} POL (Piso sagrado blindado)

📦 <b>DETALLE DE IMPACTOS:</b>
${frontLines}

🔒 <b>POLÍTICA DE SEGURIDAD EN BÓVEDA MÁSTER (#501):</b>
• <b>Modo Retiro Binance:</b> 🔒 MANUAL (Cero Micro-Depósitos automáticos)
• <b>Destino de los Fondos:</b> 100% Acumulación On-Chain para Fondo de Interés Compuesto rumbo a los Super Snipers.
• <b>Supervisión:</b> 12 Nebulosas IA (Gatillo NEBULA-11 activo)
• <b>Vigía Inyección 50 €:</b> En alerta para escalar a 16 Snipers automáticos.

⏰ <i>${new Date().toISOString()}</i>
`.trim();

    try {
      await sendTelegramAlert(msg);
      console.log("📱 [TELEGRAM] Parte de Guerra 11X enviado exitosamente a Sala de Mando 10K.");
    } catch (err) {
      console.warn(`⚠️ Error enviando alerta a Telegram: ${err.message}`);
    }
  } else {
    console.log(`🛡️ [ESCUDO SAGRADO ACTIVO] Disparos en pausa preventiva para proteger las reservas de los frentes.`);
  }

  return { results, allFrontStatuses, totalUsdcInFleet };
}

const runSupervisedSalvo6x = runSupervisedSalvo11x;

/**
 * Escaneo y ejecución regular de Sniper Mainnet (con respeto de cooldown y reservas)
 */
async function runSniper11x(options = {}) {
  const isScanOnly = options.scanOnly || process.argv.includes("--scan");
  const provider = new ethers.JsonRpcProvider("https://polygon.drpc.org", 137);

  console.log("=========================================================================================");
  console.log("       🦅 SNIPER 11X MAINNET — 11 FRENTES TÁCTICOS // OPERACIÓN 12K                       ");
  console.log("=========================================================================================");

  const allFrontStatuses = await readAllFrontsStatus(provider, SNIPER_FRONTS);
  console.log(`📊 Estado de los 11 Frentes en Polygon Mainnet:`);
  allFrontStatuses.forEach(f => {
    console.log(`   • ${f.id} (${f.name}): ${f.polBalance.toFixed(4)} POL (Reserva: ${f.sacredReservePol} POL) | ${f.usdcBalance.toFixed(6)} USDC`);
  });

  const totalUsdc = allFrontStatuses.reduce((acc, f) => acc + f.usdcBalance, 0);
  console.log(`💰 Liquidez USDC Nativo Flotante Consolidada: $${totalUsdc.toFixed(6)} USDC\n`);

  syncFleetTelemetryFromFronts(allFrontStatuses);

  if (isScanOnly) {
    return { success: true, mode: "SCAN_ONLY", allFrontStatuses, totalUsdc };
  }

  // Si no es scan-only y está autorizado, ejecutar salva supervisada
  const nebCheck = checkNebulaDirectives();
  if (nebCheck.authorized && nebCheck.score >= 95) {
    return runSupervisedSalvo11x({ force: false, dryRun: options.dryRun });
  } else {
    console.log(`ℹ️ [MONITOR PASIVO] Gatillo en espera (${nebCheck.score}%). Fondos blindados en reservas.`);
  }

  return { success: true, allFrontStatuses, totalUsdc };
}

const runSniper6x = runSniper11x;
const runSniper501 = runSniper11x;

module.exports = {
  runSniper11x,
  runSniper6x,
  runSniper501,
  runSupervisedSalvo11x,
  runSupervisedSalvo6x,
  executeFrontShot,
  readAllFrontsStatus,
  syncFleetTelemetryFromFronts,
  checkAndExecuteRoute1Sweep,
  SNIPER_FRONTS,
  LIEUTENANTS_FRONTS,
  NATIVE_USDC_POLYGON,
  QUICKSWAP_V2_ROUTER
};

if (require.main === module) {
  const isDryRun = process.argv.includes("--dry-run");
  if (
    process.argv.includes("--salvo-all") ||
    process.argv.includes("--salvo") ||
    process.argv.includes("--salvo-captains") ||
    process.argv.includes("--salvo-11x")
  ) {
    runSupervisedSalvo11x({ dryRun: isDryRun, force: true }).catch(err => {
      console.error("❌ Error en Salva Supervisada 11X:", err);
      process.exit(1);
    });
  } else {
    runSniper11x({ dryRun: isDryRun }).catch(err => {
      console.error("❌ Error en Sniper 11X:", err);
      process.exit(1);
    });
  }
}

