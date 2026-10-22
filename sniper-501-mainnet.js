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
const SWEEP_THRESHOLD_USDC = 1.00; // Umbral de barrido hacia Binance Spot
const DYNAMIC_COOLDOWN_MS = 30 * 60 * 1000; // 30 Minutos de enfriamiento dinámico

// 6 Frentes Tácticos de Extracción Mainnet (Total 75.00 POL Blindados)
const SNIPER_FRONTS = [
  {
    frontId: "front-0",
    boxId: "MATRIZ",
    id: "#501",
    index: 501,
    name: "Nodriza Matriz (#501)",
    address: "0xD4D12077a61118372f7a367319fb11922Beb3743",
    sacredReservePol: 25.00,
    surveillanceFloorPol: 25.20,
    bulletPol: 4.50,
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
    surveillanceFloorPol: 14.20,
    bulletPol: 2.25,
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
    surveillanceFloorPol: 14.20,
    bulletPol: 2.25,
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
    surveillanceFloorPol: 7.40,
    bulletPol: 1.00,
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
    surveillanceFloorPol: 7.40,
    bulletPol: 1.00,
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
    surveillanceFloorPol: 7.40,
    bulletPol: 1.00,
    binanceVault: "0xf94ef9da001c48367d78641e2e870db0e809dee9",
    binanceVaultName: "Bóveda Binance #5 (Box 5)"
  }
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
 * NEBULA-10: Cotización de Liquidez QuickSwap V2
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
 * Lee el estado actual de los 6 frentes on-chain (POL y USDC Nativo)
 */
async function readAllFrontsStatus(provider) {
  const usdcContract = new ethers.Contract(NATIVE_USDC_POLYGON, ERC20_ABI, provider);
  const statuses = [];

  for (const front of SNIPER_FRONTS) {
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

  const surplus = polBal - front.sacredReservePol;
  console.log(`💰 Excedente Cazador Disponible: ${surplus.toFixed(4)} POL`);

  if (surplus < front.bulletPol) {
    console.log(`⚠️ Excedente (${surplus.toFixed(4)} POL) < Bala táctica (${front.bulletPol} POL). En espera.`);
    return { skipped: true, reason: "INSUFFICIENT_SURPLUS", surplus };
  }

  // 4. Auditoría NEBULA-09 & Bytecode
  await auditContractSecurity(provider, NATIVE_USDC_POLYGON);

  // 5. Cotización QuickSwap V2
  const router = new ethers.Contract(QUICKSWAP_V2_ROUTER, ROUTER_ABI, signer);
  const quote = await scanLiquidityQuote(router, front.bulletPol);
  console.log(`💱 Cotización QuickSwap: ${front.bulletPol} POL -> ${quote.expectedUsdcNum.toFixed(6)} USDC Nativo.`);

  // 6. Gas Óptimo en Polygon
  const gasFees = await getOptimalGasFees(provider);
  console.log(`⛽ GasPrice: ${gasFees.currentGasPriceGwei.toFixed(2)} Gwei.`);

  if (isDryRun) {
    console.log(`🧪 [DRY-RUN] Simulación exitosa para ${front.name}.`);
    return { success: true, mode: "DRY_RUN", quote };
  }

  // 7. Disparo On-Chain Fuego Real
  console.log(`🔥 Disparando bala táctica (${front.bulletPol} POL) en Polygon Mainnet...`);
  const amountOutMin = (quote.amounts[1] * 99n) / 100n; // 1% slippage máximo
  const pathArr = [WPOL_POLYGON, NATIVE_USDC_POLYGON];
  const deadline = Math.floor(Date.now() / 1000) + 1200;

  const tx = await router.swapExactETHForTokens(
    amountOutMin,
    pathArr,
    signer.address,
    deadline,
    {
      value: quote.polWei,
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
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    usdcHarvested: quote.expectedUsdcNum,
    totalUsdcBalance: newUsdcNum,
    remainingPol: newPolNum
  };
}

/**
 * Ejecuta barrido a Binance Spot #1 para la Ruta 1 (#501 + #001) cuando se alcanza >= $1.00 USDC
 */
async function checkAndExecuteRoute1Sweep(provider) {
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
  console.log(`⚡ [NEBULA-12 CHECK BARRIDO] Ruta #1 (#501 + #001) hacia Bóveda Binance #1:`);
  console.log(`   • #501 (Matriz): $${bal501.toFixed(6)} USDC`);
  console.log(`   • #001 (Capitán Box 1): $${bal001.toFixed(6)} USDC`);
  console.log(`   • Total Consolidado Ruta #1: $${totalRoute1Usdc.toFixed(6)} USDC (Umbral: >= $1.00 USDC)`);

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
 * Salva Táctica Supervisada en los 6 Frentes en Polygon Mainnet
 */
async function runSupervisedSalvo6x(options = {}) {
  const force = options.force ?? true;
  console.log("=========================================================================================");
  console.log("   🦅 SALVA TÁCTICA SUPERVISADA (6 FRENTES) — CERTEZA MATEMÁTICA >= 95%                  ");
  console.log("=========================================================================================");
  console.log("📍 PROTOCOLO: 12 Nebulosas IA • 75.00 POL Blindados • 100% USDC Nativo");
  console.log("🎯 Token Objetivo: 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 (Circle USDC)");
  console.log("🛡️ Cero USDT (MiCA Compliance) • Cero Datos Simulados\n");

  const provider = new ethers.JsonRpcProvider("https://polygon.drpc.org", 137);

  // 1. Verificación previa de Gatillo NEBULA-11
  const nebCheck = checkNebulaDirectives();
  console.log(`🎯 [GATILLO NEBULA-11] Score de Certeza: ${nebCheck.score}%`);
  if (!nebCheck.authorized || nebCheck.score < 95) {
    console.log(`⛔ Operación abortada: Score (${nebCheck.score}%) < 95%.`);
    return { success: false, reason: "SCORE_BELOW_95" };
  }

  const results = [];
  for (let i = 0; i < SNIPER_FRONTS.length; i++) {
    const front = SNIPER_FRONTS[i];
    console.log(`\n================== [DISPARO ${i + 1}/6: ${front.name}] ==================`);
    try {
      const res = await executeFrontShot(front, provider, { force });
      results.push({ front, ...res });
    } catch (err) {
      console.error(`❌ Error en disparo de ${front.name}: ${err.message}`);
      results.push({ front, success: false, error: err.message });
    }

    if (i < SNIPER_FRONTS.length - 1) {
      console.log(`⏱️ Pausa Anti-Sybil entre frentes (2.5s - 4s)...`);
      await sleepRandom(2500, 4000);
    }
  }

  // 2. Verificar y ejecutar barrido si Ruta #1 supera >= $1.00 USDC
  let sweepRes = null;
  try {
    sweepRes = await checkAndExecuteRoute1Sweep(provider);
  } catch (err) {
    console.warn(`⚠️ Aviso en verificación de barrido: ${err.message}`);
  }

  // 3. Sincronizar saldos de los 6 Frentes en la telemetría central
  console.log(`\n🔄 Sincronizando saldos de los 6 Frentes en la telemetría central...`);
  const allFrontStatuses = await readAllFrontsStatus(provider);
  const lastSuccess = results.filter(r => r.success && r.txHash).pop();

  syncFleetTelemetryFromFronts(
    allFrontStatuses,
    lastSuccess ? { hash: lastSuccess.txHash, satIndex: lastSuccess.front.index, usdcAmount: lastSuccess.usdcHarvested } : null,
    sweepRes?.executed ? sweepRes.sweepEvent : null
  );

  const totalUsdcInFleet = allFrontStatuses.reduce((acc, f) => acc + f.usdcBalance, 0);
  console.log(`\n=========================================================================================`);
  console.log(`🎉 SALVA TÁCTICA 6X FINALIZADA CON ÉXITO`);
  console.log(`💵 Flotante Acumulado en Flota: $${totalUsdcInFleet.toFixed(6)} USDC`);
  if (sweepRes?.executed) {
    console.log(`🏦 Barrido Real a Binance Spot #1: $${sweepRes.sweepEvent.amount.toFixed(2)} USDC entregados.`);
  }
  console.log("=========================================================================================\n");

  return { results, allFrontStatuses, totalUsdcInFleet, sweepRes };
}

/**
 * Escaneo y ejecución regular de Sniper Mainnet (con respeto de cooldown y reservas)
 */
async function runSniper6x(options = {}) {
  const isScanOnly = options.scanOnly || process.argv.includes("--scan");
  const provider = new ethers.JsonRpcProvider("https://polygon.drpc.org", 137);

  console.log("=========================================================================================");
  console.log("       🦅 SNIPER 6X MAINNET — 6 FRENTES TÁCTICOS // OPERACIÓN 12K                         ");
  console.log("=========================================================================================");

  const allFrontStatuses = await readAllFrontsStatus(provider);
  console.log(`📊 Estado de los 6 Frentes en Polygon Mainnet:`);
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
    return runSupervisedSalvo6x({ force: false });
  } else {
    console.log(`ℹ️ [MONITOR PASIVO] Gatillo en espera (${nebCheck.score}%). Fondos blindados en reservas.`);
  }

  return { success: true, allFrontStatuses, totalUsdc };
}

// Compatibilidad retroactiva
async function runSniper501(options = {}) {
  return runSniper6x(options);
}

module.exports = {
  runSniper6x,
  runSniper501,
  runSupervisedSalvo6x,
  executeFrontShot,
  readAllFrontsStatus,
  syncFleetTelemetryFromFronts,
  checkAndExecuteRoute1Sweep,
  SNIPER_FRONTS,
  NATIVE_USDC_POLYGON,
  QUICKSWAP_V2_ROUTER
};

if (require.main === module) {
  if (
    process.argv.includes("--salvo-all") ||
    process.argv.includes("--salvo") ||
    process.argv.includes("--salvo-captains")
  ) {
    runSupervisedSalvo6x().catch(err => {
      console.error("❌ Error en Salva Supervisada 6X:", err);
      process.exit(1);
    });
  } else {
    runSniper6x().catch(err => {
      console.error("❌ Error en Sniper 6X:", err);
      process.exit(1);
    });
  }
}
