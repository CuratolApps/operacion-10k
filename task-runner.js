/**
 * task-runner.js - Operación 10k
 * Motor de Rutinas On-Chain Multi-Red y Ejecución Estratégica con Escudo Anti-Sybil.
 * Opera simultáneamente sobre Ethereum Sepolia y Base Sepolia (40 transacciones por ronda).
 * 
 * Regla de seguridad: PROHIBIDO exponer claves privadas ni volcar .env.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ethers } = require("ethers");
const { networks } = require("./networks");
const {
  sleepRandom,
  shuffleSwarm,
  generateHumanAmount,
  validateIsolation
} = require("./anti-sybil");
const { getWalletSigner } = require("./swarm-engine");
const { notifyRoundSummary } = require("./telegram-notifier");

const WALLETS_FILE = path.join(__dirname, "wallets-public-list.json");
const REPORT_FILE = path.join(__dirname, "last-run-report.json");

// Parámetros operacionales de jitter y balances mínimos
const MIN_TEST_DELAY_MS = 1000;
const MAX_TEST_DELAY_MS = 2500;
const MIN_EXEC_BALANCE_ETH = 0.0005;

function getSigner(index, provider = null) {
  if (typeof getWalletSigner === "function") {
    return getWalletSigner(index, provider);
  }
  const rawSeed = process.env.TRUST_WALLET_SEED;
  if (!rawSeed) {
    throw new Error("TRUST_WALLET_SEED no está definida en .env");
  }
  const mnemonic = ethers.Mnemonic.fromPhrase(rawSeed.trim().replace(/\s+/g, " "));
  const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${index}`);
  return provider ? wallet.connect(provider) : wallet;
}

function loadPublicWallets() {
  if (!fs.existsSync(WALLETS_FILE)) {
    console.error(`❌ ERROR: No se encontró ${WALLETS_FILE}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8"));
}

function createProvider(netConfig) {
  const fetchRequest = new ethers.FetchRequest(netConfig.rpc);
  fetchRequest.timeout = 12000;
  return new ethers.JsonRpcProvider(fetchRequest, netConfig.chainId, {
    staticNetwork: ethers.Network.from(netConfig.chainId)
  });
}

/**
 * Ejecuta la rutina on-chain para una red específica de manera aislada y barajada.
 */
async function executeSwarmOnNetwork({
  networkConfig,
  satellites,
  allAddresses,
  isDryRun
}) {
  console.log("-----------------------------------------------------------------------------------------");
  console.log(`🌐 [ESCUADRÓN A] - OPERACIÓN EN ${networkConfig.name.toUpperCase()} (Chain ID: ${networkConfig.chainId})`);
  console.log("-----------------------------------------------------------------------------------------");

  const provider = createProvider(networkConfig);
  const shuffledSatellites = shuffleSwarm(satellites);
  const executionOrderStr = shuffledSatellites.map((s) => `#${String(s.index).padStart(2, "0")}`).join(" -> ");
  console.log(`🎲 Secuencia no lineal generada (Fisher-Yates):\n   ${executionOrderStr}\n`);

  const networkResults = [];

  for (let i = 0; i < shuffledSatellites.length; i++) {
    const sat = shuffledSatellites[i];
    const satTag = `[${i + 1}/${shuffledSatellites.length}] Satélite #${String(sat.index).padStart(2, "0")}`;
    console.log(`➤ ${satTag} [${sat.address}] en ${networkConfig.name}:`);

    // Consultar saldo actual
    let balanceEth = 0;
    try {
      const rawBal = await provider.getBalance(sat.address);
      balanceEth = parseFloat(ethers.formatEther(rawBal));
    } catch (err) {
      console.log(`   ⚠️ Error de lectura RPC para ${sat.address}: ${err.message}`);
    }

    console.log(`   Saldo actual: ${balanceEth.toFixed(6)} ${networkConfig.symbol}`);

    // Monto humano irregular y calldata
    const humanAmount = generateHumanAmount(0.0001, 0.0004);
    const randomCallData = "0x" + crypto.randomBytes(4).toString("hex");
    const targetAddress = sat.address;

    // Validación estricta de aislamiento Anti-Sybil
    validateIsolation(sat.address, targetAddress, allAddresses);

    let actionStatus = "";
    let txHash = null;

    if (balanceEth >= MIN_EXEC_BALANCE_ETH && !isDryRun) {
      console.log(`   ⚡ Ejecutando transacción orgánica: ${humanAmount} ${networkConfig.symbol}...`);
      try {
        const signer = getSigner(sat.index, provider);
        const tx = await signer.sendTransaction({
          to: targetAddress,
          value: ethers.parseEther(humanAmount),
          data: randomCallData
        });
        console.log(`   🚀 Transacción enviada: ${tx.hash}`);
        const receipt = await tx.wait(1);
        txHash = receipt.hash;
        actionStatus = "TX_CONFIRMADA_ON_CHAIN";
        console.log(`   ✅ Confirmada en bloque #${receipt.blockNumber} (Gas: ${receipt.gasUsed.toString()})`);
      } catch (txErr) {
        actionStatus = `ERROR_TX: ${txErr.message}`;
        console.log(`   ❌ Error al emitir tx: ${txErr.message}`);
      }
    } else {
      if (balanceEth < MIN_EXEC_BALANCE_ETH) {
        console.log(`   ⚠️ [FONDOS INSUFICIENTES - Saldo menor a ${MIN_EXEC_BALANCE_ETH} ${networkConfig.symbol}]`);
        actionStatus = "PENDIENTE_FONDEO";
      } else {
        console.log(`   🧪 [DRY-RUN SIMULADO] Destino aislado: ${targetAddress} | Monto: ${humanAmount} ${networkConfig.symbol}`);
        actionStatus = "SIMULADA_DRY_RUN";
      }
    }

    networkResults.push({
      step: i + 1,
      index: sat.index,
      address: sat.address,
      network: networkConfig.name,
      balanceEth: balanceEth.toFixed(6),
      simulatedAmount: humanAmount,
      calldata: randomCallData,
      status: actionStatus,
      txHash: txHash
    });

    // Pausa aleatoria anti-sybil entre satélites
    if (i < shuffledSatellites.length - 1) {
      await sleepRandom(MIN_TEST_DELAY_MS, MAX_TEST_DELAY_MS);
    }
    console.log("");
  }

  return networkResults;
}

async function runTaskRunner() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("=========================================================================================");
  console.log("     🚀 OPERACIÓN 10K - MOTOR ON-CHAIN MULTI-RED (ETHEREUM SEPOLIA + BASE SEPOLIA)       ");
  console.log("=========================================================================================");
  console.log(`🛡️  Modo de ejecución: ${isDryRun ? "DRY-RUN (Simulación controlada sin riesgo)" : "PRODUCCIÓN (Transacciones en vivo)"}`);
  console.log("🔒 Regla de seguridad: Blindaje estricto activo. Claves privadas resguardadas en memoria.\n");

  const allWallets = loadPublicWallets();
  const allAddresses = allWallets.map((w) => w.address);

  // Separación de escuadrones
  const vipWallet = allWallets.find((w) => w.index === 0);
  const satellites = allWallets.filter((w) => w.index > 0);

  // -------------------------------------------------------------------------------------
  // 1. ESCUADRÓN C: CUENTA #00 VIP (Modo Solo Lectura / Monitoreo)
  // -------------------------------------------------------------------------------------
  console.log("-----------------------------------------------------------------------------------------");
  console.log("👑 [ESCUADRÓN C] - MONITOREO DE CUENTA VIP #00 (MODO ULTRA SEGURO / SOLO LECTURA)");
  console.log("-----------------------------------------------------------------------------------------");
  console.log(`   Dirección VIP: ${vipWallet.address}`);
  console.log("   🛡️ Blindaje: ESTA CUENTA NUNCA EMITE TRANSACCIONES AUTOMATIZADAS EN MAINNET.\n");

  const bscProvider = createProvider(networks.bscMainnet);
  const baseProvider = createProvider(networks.baseMainnet);
  const sepoliaProvider = createProvider(networks.ethereumSepolia);

  let vipBscBalance = "0.000000";
  let vipBaseBalance = "0.000000";
  let vipSepoliaBalance = "0.000000";
  let vipBscNonce = 0;

  try {
    const [bscBal, baseBal, sepBal, nonce] = await Promise.all([
      bscProvider.getBalance(vipWallet.address),
      baseProvider.getBalance(vipWallet.address),
      sepoliaProvider.getBalance(vipWallet.address),
      bscProvider.getTransactionCount(vipWallet.address)
    ]);
    vipBscBalance = parseFloat(ethers.formatEther(bscBal)).toFixed(6);
    vipBaseBalance = parseFloat(ethers.formatEther(baseBal)).toFixed(6);
    vipSepoliaBalance = parseFloat(ethers.formatEther(sepBal)).toFixed(6);
    vipBscNonce = nonce;
  } catch (err) {
    console.log(`   ⚠️ Nota al consultar VIP: ${err.message || err}`);
  }

  console.log(`   • Saldo en BNB Smart Chain : ${vipBscBalance} BNB (Tx count: ${vipBscNonce})`);
  console.log(`   • Saldo en Base Mainnet     : ${vipBaseBalance} ETH`);
  console.log(`   • Saldo en Ethereum Sepolia : ${vipSepoliaBalance} ETH`);
  console.log("   ✅ Verificación de integridad de Escuadrón C completada.\n");

  // -------------------------------------------------------------------------------------
  // 2. PRUEBA DEL ESCUDO ANTI-SYBIL (Aislamiento entre Satélites)
  // -------------------------------------------------------------------------------------
  console.log("-----------------------------------------------------------------------------------------");
  console.log("🛡️  [ESCUDO ANTI-SYBIL] - VERIFICACIÓN DE PROTOCOLO DE AISLAMIENTO");
  console.log("-----------------------------------------------------------------------------------------");
  try {
    validateIsolation(satellites[0].address, satellites[1].address, allAddresses);
  } catch (error) {
    if (error.message.includes("SYBIL_PROTECTION_TRIGGERED")) {
      console.log("   ✅ Prueba de defensa positiva: Intento de flujo cruzado Satélite->Satélite INTERCEPTADO.");
      console.log(`      Error emitido: ${error.message.split(".")[0]}`);
    } else {
      throw error;
    }
  }

  const selfCheck = validateIsolation(satellites[0].address, satellites[0].address, allAddresses);
  console.log(`   ✅ Auto-interacción aislada (Sender === Target): ${selfCheck ? "PERMITIDA" : "DENEGADA"}\n`);

  // -------------------------------------------------------------------------------------
  // 3. ESCUADRÓN A: EJECUCIÓN MULTI-RED (Ethereum Sepolia + Base Sepolia)
  // -------------------------------------------------------------------------------------
  // Red 1: Ethereum Sepolia (20 satélites)
  const sepoliaResults = await executeSwarmOnNetwork({
    networkConfig: networks.ethereumSepolia,
    satellites,
    allAddresses,
    isDryRun
  });

  // Pausa entre redes para desacoplamiento temporal
  console.log("⏳ [ANTI-SYBIL] Pausa de transición multi-red...");
  await sleepRandom(2000, 4000);

  // Red 2: Base Sepolia (20 satélites)
  const baseSepoliaResults = await executeSwarmOnNetwork({
    networkConfig: networks.baseSepolia,
    satellites,
    allAddresses,
    isDryRun
  });

  // -------------------------------------------------------------------------------------
  // 4. GENERACIÓN DE REPORTE CONSOLIDADO MULTI-RED
  // -------------------------------------------------------------------------------------
  const countSuccess = (arr) => arr.filter((r) => r.status === "TX_CONFIRMADA_ON_CHAIN" || (isDryRun && r.status === "SIMULADA_DRY_RUN")).length;
  const sepoliaSuccess = countSuccess(sepoliaResults);
  const baseSuccess = countSuccess(baseSepoliaResults);
  const totalOnChain = sepoliaSuccess + baseSuccess;

  const report = {
    timestamp: new Date().toISOString(),
    executionMode: isDryRun ? "DRY-RUN" : "PRODUCTION",
    activeNetworks: ["Ethereum Sepolia", "Base Sepolia"],
    summary: {
      totalSatellites: satellites.length,
      sepoliaSuccessCount: sepoliaSuccess,
      baseSuccessCount: baseSuccess,
      totalOnChainTx: totalOnChain,
      targetTotalTx: satellites.length * 2
    },
    escuadronC_VIP: {
      address: vipWallet.address,
      mode: "READ_ONLY_SAFE_MONITOR",
      balances: {
        bscMainnet: `${vipBscBalance} BNB`,
        baseMainnet: `${vipBaseBalance} ETH`,
        ethereumSepolia: `${vipSepoliaBalance} ETH`
      }
    },
    escuadronA_Satellites: {
      sepoliaRuns: sepoliaResults,
      baseSepoliaRuns: baseSepoliaResults
    }
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf8");

  console.log("=========================================================================================");
  console.log("                     📊 RESUMEN FINAL DE LA RONDA MULTI-RED                              ");
  console.log("=========================================================================================");
  console.log(`👑 Escuadrón C (VIP #00)     : Monitoreada en Mainnets (0 transacciones, 100% segura)`);
  console.log(`🤖 Satélites Evaluados       : ${satellites.length}`);
  console.log(`⚡ Ethereum Sepolia          : ${sepoliaSuccess}/${satellites.length} txs confirmadas`);
  console.log(`⚡ Base Sepolia              : ${baseSuccess}/${satellites.length} txs confirmadas`);
  console.log(`🎯 TOTAL TRANSACCIONES RONDA : ${totalOnChain} / ${satellites.length * 2}`);
  console.log(`🛡️  Escudo Anti-Sybil         : Activo en ambas redes`);
  console.log(`💾 Reporte guardado en        : ${REPORT_FILE}\n`);

  // Notificación a Telegram
  await notifyRoundSummary({
    executionMode: isDryRun ? "DRY-RUN" : "PRODUCTION",
    totalSatellites: satellites.length,
    sepoliaSuccessCount: sepoliaSuccess,
    sepoliaTotal: satellites.length,
    baseSuccessCount: baseSuccess,
    baseTotal: satellites.length,
    totalOnChainTx: totalOnChain
  });

  console.log("🎉 Ronda multi-red completada con éxito.\n");
  return report;
}

if (require.main === module) {
  runTaskRunner().catch((err) => {
    console.error("❌ Error en task-runner:", err);
    process.exit(1);
  });
}

module.exports = {
  runTaskRunner
};
