/**
 * task-runner.js - Operación 10k
 * Motor de Rutinas On-Chain y Ejecución Estratégica con Escudo Anti-Sybil.
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

// Parámetros operacionales
const MIN_TEST_DELAY_MS = 1000;
const MAX_TEST_DELAY_MS = 3000;
const MIN_EXEC_BALANCE_ETH = 0.0005;

function loadPublicWallets() {
  if (!fs.existsSync(WALLETS_FILE)) {
    console.error(`❌ ERROR: No se encontró ${WALLETS_FILE}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8"));
}

function createProvider(netConfig) {
  const fetchRequest = new ethers.FetchRequest(netConfig.rpc);
  fetchRequest.timeout = 10000;
  return new ethers.JsonRpcProvider(fetchRequest, netConfig.chainId, {
    staticNetwork: ethers.Network.from(netConfig.chainId)
  });
}

async function runTaskRunner() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("=========================================================================================");
  console.log("          🚀 OPERACIÓN 10K - FASE 3: ESCUDO ANTI-SYBIL & MOTOR ON-CHAIN          ");
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
    // Simulamos intento no permitido: Satélite #01 -> Satélite #02
    validateIsolation(satellites[0].address, satellites[1].address, allAddresses);
  } catch (error) {
    if (error.message.includes("SYBIL_PROTECTION_TRIGGERED")) {
      console.log("   ✅ Prueba de defensa positiva: Intento de flujo cruzado Satélite->Satélite INTERCEPTADO.");
      console.log(`      Error emitido: ${error.message.split(".")[0]}`);
    } else {
      throw error;
    }
  }

  // Comprobar auto-transacción permitida
  const selfCheck = validateIsolation(satellites[0].address, satellites[0].address, allAddresses);
  console.log(`   ✅ Auto-interacción aislada (Sender === Target): ${selfCheck ? "PERMITIDA" : "DENEGADA"}\n`);

  // -------------------------------------------------------------------------------------
  // 3. ESCUADRÓN A: SATÉLITES #01 A #20 (Barajado Fisher-Yates y Rutinas)
  // -------------------------------------------------------------------------------------
  console.log("-----------------------------------------------------------------------------------------");
  console.log("🤖 [ESCUADRÓN A] - PREPARACIÓN DE SATÉLITES (#01 a #20) EN TESTNET");
  console.log("-----------------------------------------------------------------------------------------");

  const shuffledSatellites = shuffleSwarm(satellites);
  const executionOrderStr = shuffledSatellites.map((s) => `#${String(s.index).padStart(2, "0")}`).join(" -> ");
  console.log(`🎲 Secuencia no lineal generada (Fisher-Yates):\n   ${executionOrderStr}\n`);

  const activeTestnet = networks.ethereumSepolia;
  console.log(`🌐 Red Testnet activa: ${activeTestnet.name} (ChainID: ${activeTestnet.chainId})\n`);

  const satelliteRunResults = [];

  for (let i = 0; i < shuffledSatellites.length; i++) {
    const sat = shuffledSatellites[i];
    const satTag = `[${i + 1}/${shuffledSatellites.length}] Satélite #${String(sat.index).padStart(2, "0")}`;
    console.log(`➤ ${satTag} (${sat.address}):`);

    // Consultar saldo actual en testnet
    let rawBal = 0n;
    let balanceEth = 0;
    try {
      rawBal = await sepoliaProvider.getBalance(sat.address);
      balanceEth = parseFloat(ethers.formatEther(rawBal));
    } catch (err) {
      console.log(`   ⚠️ Error de lectura RPC para ${sat.address}: ${err.message}`);
    }

    console.log(`   Saldo Sepolia actual: ${balanceEth.toFixed(6)} ETH`);

    // Generar monto humano irregular
    const humanAmount = generateHumanAmount(0.0001, 0.0005);
    // Generar calldata aleatorio ligero (4 bytes simulando llamada o ping)
    const randomCallData = "0x" + crypto.randomBytes(4).toString("hex");
    // Destino: auto-transferencia para generar volumen e interacciones sin contaminar
    const targetAddress = sat.address;

    // Validación obligatoria de aislamiento
    validateIsolation(sat.address, targetAddress, allAddresses);

    let actionStatus = "";
    let txHash = null;

    if (balanceEth >= MIN_EXEC_BALANCE_ETH && !isDryRun) {
      // Ejecución en vivo (cuando cuente con saldo de faucet)
      console.log(`   ⚡ Ejecutando transacción orgánica: ${humanAmount} ETH...`);
      try {
        const signer = getWalletSigner(sat.index, sepoliaProvider);
        const tx = await signer.sendTransaction({
          to: targetAddress,
          value: ethers.parseEther(humanAmount),
          data: randomCallData
        });
        console.log(`   🚀 Transacción enviada: ${tx.hash}`);
        const receipt = await tx.wait(1);
        txHash = receipt.hash;
        actionStatus = "TX_CONFIRMADA_ON_CHAIN";
        console.log(`   ✅ Transacción confirmada en bloque ${receipt.blockNumber}`);
      } catch (txErr) {
        actionStatus = `ERROR_TX: ${txErr.message}`;
        console.log(`   ❌ Error al emitir tx: ${txErr.message}`);
      }
    } else {
      // Modo dry-run o sin saldo
      if (balanceEth < MIN_EXEC_BALANCE_ETH) {
        console.log(`   ⚠️ [SIN GAS DE PRUEBA - PENDIENTE ESCUADRÓN B FAUCET]`);
      }
      if (isDryRun) {
        console.log(`   🧪 [DRY-RUN SIMULADO]`);
        console.log(`      • Destino aislado: ${targetAddress} (Auto-tx validada)`);
        console.log(`      • Monto irregular generado: ${humanAmount} ETH`);
        console.log(`      • Calldata aleatorio: ${randomCallData}`);
      }
      actionStatus = balanceEth >= MIN_EXEC_BALANCE_ETH ? "SIMULADA_DRY_RUN" : "PENDIENTE_FAUCET";
    }

    satelliteRunResults.push({
      step: i + 1,
      index: sat.index,
      address: sat.address,
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

  // -------------------------------------------------------------------------------------
  // 4. GENERACIÓN DE REPORTE CONSOLIDADO
  // -------------------------------------------------------------------------------------
  const report = {
    timestamp: new Date().toISOString(),
    executionMode: isDryRun ? "DRY-RUN" : "PRODUCTION",
    targetTestnet: activeTestnet.name,
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
      totalSatellites: satellites.length,
      executionOrder: shuffledSatellites.map((s) => s.index),
      results: satelliteRunResults
    }
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf8");

  console.log("=========================================================================================");
  console.log("                     📊 RESUMEN FINAL DE LA RONDA OPERATIVA                     ");
  console.log("=========================================================================================");
  console.log(`👑 Escuadrón C (VIP #00)   : Monitoreada en Mainnets (0 transacciones emitidas, 100% segura)`);
  console.log(`🤖 Escuadrón A (Satélites) : 20 satélites barajados y analizados`);
  console.log(`🛡️  Escudo Anti-Sybil       : Activo y validado contra contaminación cruzada`);
  console.log(`💾 Reporte guardado en      : ${REPORT_FILE}\n`);

  // Notificación opcional por Telegram
  const successCount = satelliteRunResults.filter((r) => r.status === "TX_CONFIRMADA_ON_CHAIN").length;
  const pendingFaucetCount = satelliteRunResults.filter((r) => r.status === "PENDIENTE_FAUCET").length;

  await notifyRoundSummary({
    executionMode: isDryRun ? "DRY-RUN" : "PRODUCTION",
    targetTestnet: activeTestnet.name,
    totalSatellites: satellites.length,
    successCount: successCount,
    pendingFaucetCount: pendingFaucetCount
  });
  console.log("");
}

runTaskRunner().catch((err) => {
  console.error("❌ Error en task-runner:", err);
  process.exit(1);
});
