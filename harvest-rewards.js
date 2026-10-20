/**
 * harvest-rewards.js - Operación 10k
 * Módulo de Cosecha y Liquidación de Recompensas hacia Bóvedas de Binance (100% Exclusivo USDC Nativo).
 * 
 * Reglas de Seguridad Estricta:
 * 1. 100% EXCLUSIVO USDC NATIVO: Prohibido por código liquidar a USDT o enviar otros tokens.
 * 2. CERO APIS DE BINANCE: Funciona 100% on-chain sin necesidad de API keys o credenciales externas.
 * 3. DESACOPLAMIENTO ANTI-CLUSTERING: Soporte para sub-direcciones por bloque, jitter de monto
 *    (retención orgánica de polvo del 1.5% al 4.0%) y ventanas escalonadas.
 * 4. BÓVEDA VIP #00: Aislamiento estricto de solo lectura (0 liquidaciones o transacciones automáticas).
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { ethers } = require("ethers");
const { sleepRandom, getBlockId } = require("./anti-sybil");
const { getWalletSigner } = require("./swarm-engine");
const { sendTelegramAlert } = require("./telegram-notifier");
const { MULTICALL3_ADDRESS, MULTICALL3_ABI } = require("./networks");

// -------------------------------------------------------------------------------------
// CONTRATOS OFICIALES DE USDC NATIVO (6 DECIMALES)
// -------------------------------------------------------------------------------------
const NATIVE_USDC_CONTRACTS = {
  arbitrumOne: {
    symbol: "USDC",
    name: "USDC (Native Arbitrum)",
    address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
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
  bsc: {
    symbol: "USDC",
    name: "USDC (BNB Smart Chain)",
    address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    decimals: 18,
    chainId: 56,
    rpc: "https://bsc-dataseed.binance.org"
  },
  polygon: {
    symbol: "USDC",
    name: "USDC (Native Polygon PoS)",
    address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    decimals: 6,
    chainId: 137,
    rpc: "https://polygon-rpc.com"
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

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

// Matriz de direcciones de depósito primarias y sub-direcciones por bloque
const DEFAULT_BINANCE_DEPOSITS_MAP = {
  1: ["0x48b26dd0f9265573f31f7140cf01e9c48518531b"],
  2: ["0x33cffda0218122ed4d981dcb1797f4b458191bc4"],
  3: ["0x409c4695afd6c919ca660cd86c5c24eb54bfca4e"],
  4: ["0x2734e0a264573056417d12478616107ff5d2ce54"],
  5: ["0xf746f7da001c48367d76641a2e870db8e509dce7"]
};

function getBinanceDepositAddresses() {
  const envRaw = process.env.BINANCE_USDC_DEPOSIT_ADDRESSES || "";
  const fromEnv = envRaw.split(",").map((a) => a.trim()).filter((a) => ethers.isAddress(a));
  if (fromEnv.length === 5) {
    return fromEnv;
  }
  return [
    DEFAULT_BINANCE_DEPOSITS_MAP[1][0],
    DEFAULT_BINANCE_DEPOSITS_MAP[2][0],
    DEFAULT_BINANCE_DEPOSITS_MAP[3][0],
    DEFAULT_BINANCE_DEPOSITS_MAP[4][0],
    DEFAULT_BINANCE_DEPOSITS_MAP[5][0]
  ];
}

/**
 * Obtiene la dirección de depósito asignada rotando sub-direcciones dentro del bloque
 * para evitar el agrupamiento heurístico de 100 satélites en un único punto.
 */
function getBinanceDepositForSatellite(satelliteIndex) {
  if (satelliteIndex === 0) {
    throw new Error("🚨 BÓVEDA VIP #00: Solo lectura. Jamás liquida fondos automáticamente.");
  }
  if (satelliteIndex < 1 || satelliteIndex > 500) {
    throw new Error(`Índice de satélite fuera de rango (1-500): #${satelliteIndex}`);
  }

  const blockId = getBlockId(satelliteIndex);
  const pool = DEFAULT_BINANCE_DEPOSITS_MAP[blockId] || [getBinanceDepositAddresses()[blockId - 1]];

  // Rotación determinista pseudo-orgánica dentro del sub-grupo
  const subIndex = satelliteIndex % pool.length;
  const depositAddress = pool[subIndex];

  return {
    groupNumber: blockId,
    satelliteRange: `#${String((blockId - 1) * 100 + 1).padStart(3, "0")}-#${String(blockId * 100).padStart(3, "0")}`,
    depositAddress
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

/**
 * Calcula un monto humano con jitter reteniendo polvo aleatorio (1.5% al 4.0%).
 * Evita el patrón de vaciado total (100.0000%) típico de bots automatizados.
 */
function calculateJitterHarvestAmount(totalBalanceWei, decimals = 6) {
  const totalUnits = parseFloat(ethers.formatUnits(totalBalanceWei, decimals));
  // Retener entre 1.5% y 4.0% de polvo orgánico
  const dustPct = (Math.random() * (4.0 - 1.5) + 1.5) / 100;
  const retainedDust = totalUnits * dustPct;
  const harvestUnits = (totalUnits - retainedDust).toFixed(4);
  const harvestWei = ethers.parseUnits(harvestUnits, decimals);

  return {
    harvestUnits: parseFloat(harvestUnits),
    harvestWei,
    retainedDust: parseFloat(retainedDust.toFixed(4)),
    dustPct: (dustPct * 100).toFixed(2)
  };
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

async function scanFleetUsdcRewards(networkKey = "arbitrumOne", sampleLimit = 500) {
  const netConfig = NATIVE_USDC_CONTRACTS[networkKey];
  if (!netConfig) {
    console.error(`❌ Red ${networkKey} no disponible para escáner.`);
    return { totalUsdc: 0, scannedCount: 0, satellitesWithBalance: [] };
  }

  const fetchReq = new ethers.FetchRequest(netConfig.rpc);
  fetchReq.timeout = 8000;
  const provider = new ethers.JsonRpcProvider(fetchReq, netConfig.chainId, {
    staticNetwork: ethers.Network.from(netConfig.chainId)
  });

  const erc20Iface = new ethers.Interface(ERC20_ABI);
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
  const wallets = loadPublicWallets().filter((w) => w.index >= 1 && w.index <= 500);

  const scannedList = wallets.slice(0, sampleLimit);
  let totalUsdcWei = 0n;
  const withBalance = [];
  const CHUNK_SIZE = 250;

  for (let i = 0; i < scannedList.length; i += CHUNK_SIZE) {
    const chunk = scannedList.slice(i, i + CHUNK_SIZE);
    try {
      const calls = chunk.map((sat) => ({
        target: netConfig.address,
        allowFailure: true,
        callData: erc20Iface.encodeFunctionData("balanceOf", [sat.address])
      }));

      const results = await multicall.aggregate3.staticCall(calls);
      results.forEach((res, idx) => {
        if (res.success && res.returnData && res.returnData !== "0x") {
          const [bal] = erc20Iface.decodeFunctionResult("balanceOf", res.returnData);
          if (bal > 0n) {
            totalUsdcWei += bal;
            withBalance.push({
              index: chunk[idx].index,
              address: chunk[idx].address,
              usdcAmount: ethers.formatUnits(bal, netConfig.decimals)
            });
          }
        }
      });
    } catch (_) {
      // Fallback
    }
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
 * Escanea y retira saldo de USDC nativo desde la Cartera Matriz #501
 * hacia la Bóveda #1 de Binance Spot (0x48b26dd0f9265573f31f7140cf01e9c48518531b).
 */
async function checkAndHarvestVault501(options = { isDryRun: false, forceWithdraw: false }) {
  const BINANCE_SPOT_VAULT = "0x48b26dd0f9265573f31f7140cf01e9c48518531b";
  const wallets = loadPublicWallets();
  const masterWallet = wallets.find((w) => w.index === 501);
  if (!masterWallet) return { totalUsdc: 0, actions: [] };

  const minThreshold = options.forceWithdraw ? 0.05 : 1.0;
  let totalHarvested = 0;
  const actions = [];

  console.log(`\n🏦 [BÓVEDA MATRIZ #501] Escaneando USDC nativo (Destino Binance: ${BINANCE_SPOT_VAULT})...`);

  for (const [netKey, netConfig] of Object.entries(NATIVE_USDC_CONTRACTS)) {
    try {
      const fetchReq = new ethers.FetchRequest(netConfig.rpc);
      fetchReq.timeout = 4000;
      const provider = new ethers.JsonRpcProvider(fetchReq, netConfig.chainId, { staticNetwork: true });
      const usdcContract = new ethers.Contract(netConfig.address, ERC20_ABI, provider);
      const balWei = await Promise.race([
        usdcContract.balanceOf(masterWallet.address),
        new Promise((_, r) => setTimeout(() => r(0n), 3500))
      ]);
      const bal = parseFloat(ethers.formatUnits(balWei, netConfig.decimals));

      if (bal >= minThreshold) {
        console.log(`   ➤ ${netConfig.name}: ${bal.toFixed(2)} USDC detectados en #501.`);
        const amountFormatted = bal.toFixed(2);

        if (options.isDryRun) {
          console.log(`     🧪 [DRY-RUN] Simulado: Envío de ${amountFormatted} USDC hacia Binance Spot.`);
          totalHarvested += bal;
          actions.push({ network: netConfig.name, amount: bal, hash: "SIMULATED_HASH" });
        } else {
          const signer = getWalletSigner(501, provider);
          const usdcWithSigner = new ethers.Contract(netConfig.address, ERC20_ABI, signer);
          const tx = await usdcWithSigner.transfer(BINANCE_SPOT_VAULT, balWei);
          console.log(`     🚀 Tx on-chain enviada: ${tx.hash}`);
          await tx.wait(1);
          totalHarvested += bal;
          actions.push({ network: netConfig.name, amount: bal, hash: tx.hash });

          // Notificar retiro a Telegram
          await sendTelegramAlert(
            `🏦 <b>RETIRO BÓVEDA #501 A BINANCE SPOT</b>\n\n` +
            `💵 <b>Monto:</b> +${amountFormatted} USDC (Nativo)\n` +
            `🌐 <b>Red:</b> ${netConfig.name}\n` +
            `🎯 <b>Destino:</b> <code>${BINANCE_SPOT_VAULT}</code>\n` +
            `🔗 <b>Tx Hash:</b> <code>${tx.hash}</code>`
          );
        }
      }
    } catch (_) {}
  }

  if (actions.length === 0) {
    console.log(`   ℹ️ Saldo en #501 inferior a ${minThreshold} USDC en las redes analizadas.`);
  }

  return { totalUsdc: totalHarvested, actions };
}

async function runHarvestToBinance() {
  const isDryRun = process.argv.includes("--dry-run");
  const isScanOnly = process.argv.includes("--scan");
  const isWithdraw501 = process.argv.includes("--withdraw-501");
  const networkKey = parseArg("--network", "arbitrumOne");
  const toStart = parseInt(parseArg("--to-start", "1"), 10);
  const toEnd = parseInt(parseArg("--to-end", "500"), 10);
  const minHarvestUsdc = parseFloat(parseArg("--min-usdc", "1.0"));

  if (isWithdraw501) {
    console.log("=========================================================================================");
    console.log("     🏦 OPERACIÓN 10K — RETIRO DIRECTO DE BÓVEDA #501 A BINANCE SPOT (100% USDC)        ");
    console.log("=========================================================================================\n");
    return await checkAndHarvestVault501({ isDryRun, forceWithdraw: true });
  }

  const netConfig = NATIVE_USDC_CONTRACTS[networkKey];
  if (!netConfig) {
    console.error(`❌ Red no soportada: ${networkKey}. Opciones: arbitrumOne, base, optimism, mainnet, bsc, polygon`);
    process.exit(1);
  }

  console.log("=========================================================================================");
  console.log("     🏦 OPERACIÓN 10K — LIQUIDACIÓN DESACOPLADA A BINANCE (100% USDC NATIVO)             ");
  console.log("=========================================================================================");
  console.log(`🌐 Red Mainnet          : ${netConfig.name} (Chain ID: ${netConfig.chainId})`);
  console.log(`💵 Contrato USDC Nativo : ${netConfig.address}`);
  console.log(`🎯 Rango de Satélites   : #${toStart} al #${toEnd}`);
  console.log(`🛡️  Modo de Ejecución    : ${isDryRun ? "DRY-RUN (Simulación)" : isScanOnly ? "ESCÁNER (Solo Lectura)" : "PRODUCCIÓN (On-Chain)"}`);
  console.log(`🚫 Política de Token    : 100% USDC Nativo (PROHIBIDO USDT y otros tokens)`);
  console.log("🔒 Anti-Clustering      : Jitter de monto (retención 1.5%-4.0% polvo) + pausas orgánicas.\n");

  const depositAddresses = getBinanceDepositAddresses();
  console.log("📋 BÓVEDAS RECEPTORAS ASIGNADAS POR BLOQUE:");
  depositAddresses.forEach((addr, idx) => {
    const rangeStr = `#${String(idx * 100 + 1).padStart(3, "0")}-#${String((idx + 1) * 100).padStart(3, "0")}`;
    console.log(`   • Bloque B${idx + 1} (${rangeStr}) -> ${addr}`);
  });
  console.log("");

  if (isScanOnly) {
    console.log(`🔍 Iniciando escáner de saldos USDC en ${netConfig.name}...`);
    const scanResult = await scanFleetUsdcRewards(networkKey, toEnd - toStart + 1);
    console.log(`📊 Total USDC detectado: ${scanResult.totalUsdc.toFixed(2)} USDC`);
    console.log(`🤖 Satélites con saldo : ${scanResult.satellitesWithBalance.length}/${scanResult.scannedCount}`);

    // Auto-cosecha de la Cartera Matriz #501 si supera 1 USDC
    await checkAndHarvestVault501({ isDryRun, forceWithdraw: false });

    const telemetryPath = path.join(__dirname, "telemetry", "fleet-telemetry.json");
    if (fs.existsSync(telemetryPath)) {
      try {
        const tel = JSON.parse(fs.readFileSync(telemetryPath, "utf8"));
        tel.dailyCapturedUsdc = scanResult.totalUsdc;
        if (tel.goalMilestone) {
          tel.goalMilestone.currentAccruedUsdc = scanResult.totalUsdc;
          tel.goalMilestone.remainingUsdc = Math.max(0, (tel.goalMilestone.targetGoalUsdc || 12000) - scanResult.totalUsdc);
          tel.goalMilestone.progressPct = parseFloat(((scanResult.totalUsdc / (tel.goalMilestone.targetGoalUsdc || 12000)) * 100).toFixed(2));
        }
        fs.writeFileSync(telemetryPath, JSON.stringify(tel, null, 2), "utf8");
        console.log(`💾 Telemetría sincronizada con $${scanResult.totalUsdc.toFixed(2)} USDC reales para el Dashboard.`);
      } catch (telErr) {
        console.log(`⚠️ No se pudo sincronizar telemetría: ${telErr.message}`);
      }
    }
    return scanResult;
  }

  const provider = new ethers.JsonRpcProvider(netConfig.rpc, netConfig.chainId, {
    staticNetwork: true
  });

  const wallets = loadPublicWallets().filter((w) => w.index >= toStart && w.index <= toEnd);
  let totalHarvestedUsdc = 0;
  let totalSuccessCount = 0;

  for (let i = 0; i < wallets.length; i++) {
    const sat = wallets[i];
    const mapping = getBinanceDepositForSatellite(sat.index);
    const satTag = `[${i + 1}/${wallets.length}] Satélite #${String(sat.index).padStart(3, "0")} (Bloque B${mapping.groupNumber})`;

    console.log(`➤ ${satTag} [${sat.address}] -> Binance B${mapping.groupNumber} [${mapping.depositAddress}]:`);

    let usdcBalWei = 0n;
    try {
      const usdcContract = new ethers.Contract(netConfig.address, ERC20_ABI, provider);
      usdcBalWei = await usdcContract.balanceOf(sat.address);
    } catch (readErr) {
      console.log(`   ⚠️ Error de lectura: ${readErr.message}`);
      continue;
    }

    const usdcBalTotal = parseFloat(ethers.formatUnits(usdcBalWei, netConfig.decimals));
    console.log(`   ↳ Saldo total en satélite: ${usdcBalTotal.toFixed(2)} USDC`);

    if (usdcBalTotal < minHarvestUsdc) {
      console.log(`   ⏭️  Saldo inferior al umbral mínimo (< ${minHarvestUsdc} USDC). Omitiendo.\n`);
      continue;
    }

    assertStrictUsdcNative(netConfig.address, networkKey);

    // Aplicar jitter de retención orgánica de polvo (1.5% a 4.0%)
    const { harvestUnits, harvestWei, retainedDust, dustPct } = calculateJitterHarvestAmount(usdcBalWei, netConfig.decimals);
    console.log(`   🎭 [JITTER HUMANO] Retención de polvo: ${retainedDust.toFixed(4)} USDC (${dustPct}%). Envío neto: ${harvestUnits} USDC`);

    if (isDryRun) {
      console.log(`   🧪 [DRY-RUN] Simulado: Transferencia de ${harvestUnits} USDC hacia ${mapping.depositAddress}`);
      totalHarvestedUsdc += harvestUnits;
      totalSuccessCount++;
    } else {
      try {
        const signer = getWalletSigner(sat.index, provider);
        const usdcWithSigner = new ethers.Contract(netConfig.address, ERC20_ABI, signer);
        console.log(`   🚀 Transfiriendo ${harvestUnits} USDC a Binance...`);

        const tx = await usdcWithSigner.transfer(mapping.depositAddress, harvestWei);
        console.log(`   📡 Tx enviada: ${tx.hash}`);
        const receipt = await tx.wait(1);
        console.log(`   ✅ Confirmada en bloque #${receipt.blockNumber} (Gas: ${receipt.gasUsed.toString()})`);

        totalHarvestedUsdc += harvestUnits;
        totalSuccessCount++;
      } catch (txErr) {
        console.log(`   ❌ Error transfiriendo a Binance: ${txErr.message}`);
      }
    }

    if (i < wallets.length - 1 && !isDryRun) {
      await sleepRandom(3500, 7500); // Ventanas escalonadas
    }
    console.log("");
  }

  console.log("=========================================================================================");
  console.log("                 📊 RESUMEN DE COSECHA DESACOPLADA A BINANCE                             ");
  console.log("=========================================================================================");
  console.log(`🎯 Satélites Evaluados   : ${wallets.length}`);
  console.log(`✅ Liquidaciones Exitosas : ${totalSuccessCount}`);
  console.log(`💵 Total USDC Transferido : ${totalHarvestedUsdc.toFixed(2)} USDC`);
  console.log("=========================================================================================\n");

  if (!isDryRun && totalSuccessCount > 0) {
    await sendTelegramAlert(
      `🏦 <b>OPERACIÓN 10K — LIQUIDACIÓN DESACOPLADA (USDC)</b>\n\n` +
      `🌐 <b>Red:</b> ${netConfig.name}\n` +
      `💵 <b>Total USDC Cosechado:</b> ${totalHarvestedUsdc.toFixed(2)} USDC\n` +
      `🤖 <b>Satélites Liquidados:</b> ${totalSuccessCount}/${wallets.length}\n` +
      `🛡️ <b>Anti-Sybil:</b> Bóvedas aisladas por bloque B1-B5 + retención orgánica de polvo\n` +
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
  checkAndHarvestVault501,
  getBinanceDepositForSatellite,
  getBinanceDepositAddresses,
  calculateJitterHarvestAmount,
  NATIVE_USDC_CONTRACTS
};
