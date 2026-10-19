/**
 * harvest-rewards.js - Operación 10k
 * Módulo de Cosecha y Liquidación de Recompensas hacia Bóvedas de Binance (100% Exclusivo USDC Nativo).
 * 
 * Reglas de Seguridad Estricta:
 * 1. 100% EXCLUSIVO USDC NATIVO: Prohibido por código liquidar a USDT o enviar otros tokens.
 * 2. MAPEO FIJO ANTI-SYBIL: Cada bloque de 100 satélites liquida exclusivamente a una dirección única de Binance.
 * 3. BÓVEDA VIP #00: Aislamiento estricto de solo lectura (0 liquidaciones o transacciones automáticas).
 * 4. JITTER ALEATORIO HUMANO: Pausas entre envíos para evitar patrones detectables en exchanges.
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { ethers } = require("ethers");
const { networks } = require("./networks");
const { sleepRandom } = require("./anti-sybil");
const { getWalletSigner } = require("./swarm-engine");
const { sendTelegramAlert } = require("./telegram-notifier");

// -------------------------------------------------------------------------------------
// CONTRATOS OFICIALES DE USDC NATIVO (6 DECIMALES)
// -------------------------------------------------------------------------------------
const NATIVE_USDC_CONTRACTS = {
  arbitrumOne: {
    symbol: "USDC",
    name: "USDC (Native Arbitrum)",
    address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // e5831 verificado
    decimals: 6,
    chainId: 42161,
    rpc: "https://arb1.arbitrum.io/rpc"
  },
  base: {
    symbol: "USDC",
    name: "USDC (Native Base)",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    chainId: 8453,
    rpc: "https://mainnet.base.org"
  },
  optimism: {
    symbol: "USDC",
    name: "USDC (Native Optimism)",
    address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    decimals: 6,
    chainId: 10,
    rpc: "https://mainnet.optimism.io"
  },
  mainnet: {
    symbol: "USDC",
    name: "USDC (Native Ethereum)",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    chainId: 1,
    rpc: "https://eth.llamarpc.com"
  }
};

// ERC-20 ABI mínimo para USDC
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

// -------------------------------------------------------------------------------------
// 5 DIRECCIONES OFICIALES DE DEPÓSITO EN BINANCE (MAPEO FIJO POR BLOQUE)
// -------------------------------------------------------------------------------------
const DEFAULT_BINANCE_DEPOSITS = [
  "0x48b26dd0f9265573f31f7140cf01e9c48518531b", // Grupo 1: #001-#100
  "0x33cffda0218122ed4d981dcb1797f4b458191bc4", // Grupo 2: #101-#200
  "0x409c4695afd6c919ca660cd86c5c24eb54bfca4e", // Grupo 3: #201-#300
  "0x2734e0a264573056417d12478616107ff5d2ce54", // Grupo 4: #301-#400
  "0xf746f7da001c48367d76641a2e870db8e509dce7"  // Grupo 5: #401-#500
];

function getBinanceDepositAddresses() {
  const envRaw = process.env.BINANCE_USDC_DEPOSIT_ADDRESSES || "";
  const fromEnv = envRaw.split(",").map(a => a.trim()).filter(a => ethers.isAddress(a));
  return fromEnv.length === 5 ? fromEnv : DEFAULT_BINANCE_DEPOSITS;
}

/**
 * Obtiene la dirección fija de Binance asignada al satélite según su rango.
 * Mantiene aislamiento 100% Anti-Sybil entre bloques de 100 satélites.
 */
function getBinanceDepositForSatellite(satelliteIndex) {
  if (satelliteIndex === 0) {
    throw new Error("🚨 BÓVEDA VIP #00: Solo lectura. Jamás liquida fondos automáticamente.");
  }
  if (satelliteIndex < 1 || satelliteIndex > 500) {
    throw new Error(`Índice de satélite fuera de rango (1-500): #${satelliteIndex}`);
  }

  const addresses = getBinanceDepositAddresses();
  const groupIndex = Math.floor((satelliteIndex - 1) / 100);
  return {
    groupNumber: groupIndex + 1,
    satelliteRange: `#${String(groupIndex * 100 + 1).padStart(3, "0")}-#${String((groupIndex + 1) * 100).padStart(3, "0")}`,
    depositAddress: addresses[groupIndex]
  };
}

/**
 * Guardia de Seguridad: Valida que el token a transferir sea estrictamente USDC nativo.
 */
function assertStrictUsdcNative(tokenAddress, networkKey = "arbitrumOne") {
  const expected = NATIVE_USDC_CONTRACTS[networkKey];
  if (!expected) {
    throw new Error(`Red ${networkKey} no configurada para liquidación USDC.`);
  }

  if (tokenAddress.toLowerCase() !== expected.address.toLowerCase()) {
    throw new Error(
      `🚨 VIOLACIÓN DE POLÍTICA DE SEGURIDAD:\n` +
      `Se intentó transferir ${tokenAddress}. Solo se permite USDC nativo oficial (${expected.address}). Prohibido USDT y otros tokens.`
    );
  }
  return true;
}

const WALLETS_FILE = path.join(__dirname, "wallets-public-list.json");

function loadPublicWallets() {
  if (!fs.existsSync(WALLETS_FILE)) {
    console.error(`❌ ERROR: No se encontró ${WALLETS_FILE}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8"));
}

function parseArg(flag, defaultValue) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return defaultValue;
}

/**
 * Escanea el estado de recompensas en USDC de la flota en una red Mainnet específica.
 */
async function scanFleetUsdcRewards(networkKey = "arbitrumOne", sampleLimit = 100) {
  const netConfig = NATIVE_USDC_CONTRACTS[networkKey];
  if (!netConfig) {
    console.error(`❌ Red ${networkKey} no disponible para escáner.`);
    return { totalUsdc: 0, satellitesWithBalance: 0 };
  }

  const provider = new ethers.JsonRpcProvider(netConfig.rpc, netConfig.chainId, {
    staticNetwork: true,
    batchMaxCount: 1
  });

  const usdcContract = new ethers.Contract(netConfig.address, ERC20_ABI, provider);
  const wallets = loadPublicWallets().filter(w => w.index >= 1 && w.index <= 500);

  const scannedList = wallets.slice(0, sampleLimit);
  let totalUsdcWei = 0n;
  let withBalance = [];

  for (const sat of scannedList) {
    try {
      const bal = await usdcContract.balanceOf(sat.address);
      if (bal > 0n) {
        totalUsdcWei += bal;
        withBalance.push({
          index: sat.index,
          address: sat.address,
          usdcAmount: ethers.formatUnits(bal, netConfig.decimals)
        });
      }
    } catch (_) {}
  }

  const totalUsdcFormatted = ethers.formatUnits(totalUsdcWei, netConfig.decimals);
  return {
    network: netConfig.name,
    tokenAddress: netConfig.address,
    totalUsdc: parseFloat(totalUsdcFormatted),
    scannedCount: scannedList.length,
    satellitesWithBalance: withBalance
  };
}

/**
 * Ejecuta la cosecha y transferencia de USDC hacia Binance para un rango de satélites.
 */
async function runHarvestToBinance() {
  const isDryRun = process.argv.includes("--dry-run");
  const isScanOnly = process.argv.includes("--scan");
  const networkKey = parseArg("--network", "arbitrumOne");
  const toStart = parseInt(parseArg("--to-start", "1"), 10);
  const toEnd = parseInt(parseArg("--to-end", "500"), 10);
  const minHarvestUsdc = parseFloat(parseArg("--min-usdc", "1.0")); // Mínimo 1 USDC para transferir

  const netConfig = NATIVE_USDC_CONTRACTS[networkKey];
  if (!netConfig) {
    console.error(`❌ Red no soportada: ${networkKey}. Opciones: arbitrumOne, base, optimism, mainnet`);
    process.exit(1);
  }

  console.log("=========================================================================================");
  console.log("     🏦 OPERACIÓN 10K — COSECHA & LIQUIDACIÓN A BINANCE (100% EXCLUSIVO USDC)            ");
  console.log("=========================================================================================");
  console.log(`🌐 Red Mainnet          : ${netConfig.name} (Chain ID: ${netConfig.chainId})`);
  console.log(`💵 Contrato USDC Nativo : ${netConfig.address}`);
  console.log(`🎯 Rango de Satélites   : #${toStart} al #${toEnd}`);
  console.log(`🛡️  Modo de Ejecución    : ${isDryRun ? "DRY-RUN (Simulación)" : isScanOnly ? "ESCÁNER (Solo Lectura)" : "PRODUCCIÓN (On-Chain)"}`);
  console.log(`🚫 Política de Token    : 100% USDC Nativo (PROHIBIDO USDT y otros tokens)`);
  console.log("🔒 Política Anti-Sybil  : Mapeo Fijo de 100 satélites por dirección receptora de Binance.\n");

  const depositAddresses = getBinanceDepositAddresses();
  console.log("📋 BÓVEDAS RECEPTORAS DE BINANCE ASIGNADAS:");
  depositAddresses.forEach((addr, idx) => {
    const rangeStr = `#${String(idx * 100 + 1).padStart(3, "0")}-#${String((idx + 1) * 100).padStart(3, "0")}`;
    console.log(`   • Grupo ${idx + 1} (${rangeStr}) -> ${addr}`);
  });
  console.log("");

  if (isScanOnly) {
    console.log(`🔍 Iniciando escáner de saldos USDC en ${netConfig.name}...`);
    const scanResult = await scanFleetUsdcRewards(networkKey, toEnd - toStart + 1);
    console.log(`📊 Total USDC detectado: ${scanResult.totalUsdc.toFixed(2)} USDC`);
    console.log(`🤖 Satélites con saldo : ${scanResult.satellitesWithBalance.length}/${scanResult.scannedCount}`);
    return scanResult;
  }

  const provider = new ethers.JsonRpcProvider(netConfig.rpc, netConfig.chainId, {
    staticNetwork: true,
    batchMaxCount: 1
  });

  const wallets = loadPublicWallets().filter(w => w.index >= toStart && w.index <= toEnd);
  let totalHarvestedUsdc = 0;
  let totalSuccessCount = 0;

  for (let i = 0; i < wallets.length; i++) {
    const sat = wallets[i];
    const mapping = getBinanceDepositForSatellite(sat.index);
    const satTag = `[${i + 1}/${wallets.length}] Satélite #${String(sat.index).padStart(3, "0")}`;

    console.log(`➤ ${satTag} [${sat.address}] -> Binance Grupo ${mapping.groupNumber} [${mapping.depositAddress}]:`);

    let usdcBalWei = 0n;
    try {
      const usdcContract = new ethers.Contract(netConfig.address, ERC20_ABI, provider);
      usdcBalWei = await usdcContract.balanceOf(sat.address);
    } catch (readErr) {
      console.log(`   ⚠️ Error de lectura: ${readErr.message}`);
      continue;
    }

    const usdcBalEth = parseFloat(ethers.formatUnits(usdcBalWei, netConfig.decimals));
    console.log(`   ↳ Saldo USDC: ${usdcBalEth.toFixed(2)} USDC`);

    if (usdcBalEth < minHarvestUsdc) {
      console.log(`   ⏭️  Saldo inferior al umbral de cosecha (< ${minHarvestUsdc} USDC). Omitiendo.`);
      console.log("");
      continue;
    }

    // Regla estricta: asegurar que es USDC nativo
    assertStrictUsdcNative(netConfig.address, networkKey);

    if (isDryRun) {
      console.log(`   🧪 [DRY-RUN] Simulado: Transferencia de ${usdcBalEth.toFixed(2)} USDC hacia ${mapping.depositAddress}`);
      totalHarvestedUsdc += usdcBalEth;
      totalSuccessCount++;
    } else {
      try {
        const signer = getWalletSigner(sat.index, provider);
        const usdcWithSigner = new ethers.Contract(netConfig.address, ERC20_ABI, signer);
        console.log(`   🚀 Transfiriendo ${usdcBalEth.toFixed(2)} USDC a Binance...`);

        const tx = await usdcWithSigner.transfer(mapping.depositAddress, usdcBalWei);
        console.log(`   📡 Tx enviada: ${tx.hash}`);
        const receipt = await tx.wait(1);
        console.log(`   ✅ Confirmada en bloque #${receipt.blockNumber} (Gas: ${receipt.gasUsed.toString()})`);

        totalHarvestedUsdc += usdcBalEth;
        totalSuccessCount++;
      } catch (txErr) {
        console.log(`   ❌ Error transfiriendo a Binance: ${txErr.message}`);
      }
    }

    if (i < wallets.length - 1 && !isDryRun) {
      await sleepRandom(2500, 5000);
    }
    console.log("");
  }

  console.log("=========================================================================================");
  console.log("                 📊 RESUMEN DE COSECHA HACIA BINANCE                                     ");
  console.log("=========================================================================================");
  console.log(`🎯 Satélites Evaluados   : ${wallets.length}`);
  console.log(`✅ Liquidaciones Exitosas : ${totalSuccessCount}`);
  console.log(`💵 Total USDC Transferido : ${totalHarvestedUsdc.toFixed(2)} USDC`);
  console.log("=========================================================================================\n");

  if (!isDryRun && totalSuccessCount > 0) {
    await sendTelegramAlert(
      `🏦 <b>OPERACIÓN 10K — LIQUIDACIÓN A BINANCE (USDC)</b>\n\n` +
      `🌐 <b>Red:</b> ${netConfig.name}\n` +
      `💵 <b>Total USDC Cosechado:</b> ${totalHarvestedUsdc.toFixed(2)} USDC\n` +
      `🤖 <b>Satélites Liquidados:</b> ${totalSuccessCount}/${wallets.length}\n` +
      `🛡️ <b>Mapeo Anti-Sybil:</b> Bóvedas aisladas por bloques de 100\n` +
      `⏰ <i>${new Date().toLocaleString("es-ES", { timeZone: "UTC" })} UTC</i>`
    );
  }

  return { totalSuccessCount, totalHarvestedUsdc };
}

if (require.main === module) {
  runHarvestToBinance().catch((err) => {
    console.error("❌ Fallo en harvest-rewards:", err);
    process.exit(1);
  });
}

module.exports = {
  runHarvestToBinance,
  scanFleetUsdcRewards,
  getBinanceDepositForSatellite,
  getBinanceDepositAddresses,
  NATIVE_USDC_CONTRACTS
};
