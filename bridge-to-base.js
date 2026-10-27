/**
 * bridge-to-base.js - Operación 10k
 * Fase de Expansión Multi-Red (Paso 1: Auto-Bridge a Base Sepolia)
 * 
 * Regla de seguridad: Aislamiento 100% individual. CERO cruce de fondos entre satélites.
 * Regla de seguridad: PROHIBIDO registrar o mostrar claves privadas ni volcar .env.
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { ethers } = require("ethers");
const { networks } = require("./networks");
const {
  sleepRandom,
  validateIsolation
} = require("./anti-sybil");
const { getWalletSigner } = require("./swarm-engine");
const { sendTelegramAlert } = require("./telegram-notifier");

// Configuración y constantes del Puente
const BASE_SEPOLIA_L1_BRIDGE = "0xfd0Bf71F60660E2f608ed56e1659C450eB113120";
const BRIDGE_THRESHOLD_ETH = 0.005; // Si tiene >= 0.005 ETH en Base Sepolia, se salta
const BRIDGE_DEPOSIT_ETH = "0.015";  // Monto a depositar en L1 Bridge para cruzar a L2
const MIN_GAS_LIMIT_L2 = 200000;     // Gas estándar de OP Stack L1StandardBridge

const L1_BRIDGE_ABI = [
  "function bridgeETHTo(address _to, uint32 _minGasLimit, bytes calldata _extraData) payable",
  "function bridgeETH(uint32 _minGasLimit, bytes calldata _extraData) payable"
];

const WALLETS_FILE = path.join(__dirname, "wallets-public-list.json");

function loadPublicWallets() {
  if (!fs.existsSync(WALLETS_FILE)) {
    console.error(`❌ ERROR: No se encontró el archivo ${WALLETS_FILE}`);
    console.error("   Ejecuta primero: node swarm-engine.js");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8"));
}

function createProvider(netConfig) {
  const fetchRequest = new ethers.FetchRequest(netConfig.rpc);
  fetchRequest.timeout = 15000;
  return new ethers.JsonRpcProvider(fetchRequest, netConfig.chainId, {
    staticNetwork: ethers.Network.from(netConfig.chainId)
  });
}

function parseArg(flag, defaultValue) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return defaultValue;
}

async function runAutoBridge() {
  const isDryRun = process.argv.includes("--dry-run");
  const toStart = parseInt(parseArg("--to-start", "1"), 10);
  const toEnd = parseInt(parseArg("--to-end", "500"), 10);
  const depositAmountStr = parseArg("--amount", BRIDGE_DEPOSIT_ETH);
  const depositAmountEth = parseFloat(depositAmountStr);
  const thresholdEth = parseFloat(parseArg("--threshold", String(Math.min(BRIDGE_THRESHOLD_ETH, depositAmountEth * 0.8))));

  console.log("=========================================================================================");
  console.log("     🌉 OPERACIÓN 10K - EXPANSIÓN MULTI-RED: AUTO-BRIDGE A BASE SEPOLIA (L1 -> L2)     ");
  console.log("=========================================================================================");
  console.log(`🛡️  Modo de ejecución: ${isDryRun ? "DRY-RUN (Simulación sin transacciones reales)" : "PRODUCCIÓN (Transacciones On-Chain en vivo)"}`);
  console.log(`🎯 Contrato Oficial L1StandardBridge: ${BASE_SEPOLIA_L1_BRIDGE}`);
  console.log(`🎯 Rango de Satélites: #${toStart} al #${toEnd}`);
  console.log(`💰 Monto por Satélite: ${depositAmountStr} ETH`);
  console.log(`⚡ Umbral de Exclusión: >= ${thresholdEth.toFixed(4)} ETH en Base Sepolia`);
  console.log("🔒 Política Anti-Sybil: Aislamiento 100% individual. Cada satélite fondea su propia dirección L2.\n");

  const allWallets = loadPublicWallets();
  const allAddresses = allWallets.map((w) => w.address);

  // Filtrar satélites dentro del rango solicitado
  const satellites = allWallets.filter((w) => w.index >= toStart && w.index <= toEnd);

  if (satellites.length === 0) {
    console.error(`❌ ERROR: No se encontraron satélites en el rango #${toStart}-#${toEnd}`);
    process.exit(1);
  }

  // Inicializar proveedores
  const sepoliaProvider = createProvider(networks.ethereumSepolia);
  const baseSepoliaProvider = createProvider(networks.baseSepolia);

  console.log("📡 Conectando con las redes:");
  try {
    const [sepBlock, baseBlock] = await Promise.all([
      sepoliaProvider.getBlockNumber(),
      baseSepoliaProvider.getBlockNumber()
    ]);
    console.log(`   • Ethereum Sepolia (L1) : Bloque #${sepBlock} 🟢 ONLINE`);
    console.log(`   • Base Sepolia (L2)     : Bloque #${baseBlock} 🟢 ONLINE\n`);
  } catch (err) {
    console.error(`❌ ERROR de conexión RPC: ${err.message}`);
    process.exit(1);
  }

  const results = {
    totalEvaluated: satellites.length,
    alreadyFunded: 0,
    successfullyBridged: 0,
    insufficientFunds: 0,
    errors: 0,
    details: []
  };

  const depositWei = ethers.parseEther(depositAmountStr);

  for (let i = 0; i < satellites.length; i++) {
    const sat = satellites[i];
    const satIndexFormatted = `#${String(sat.index).padStart(2, "0")}`;

    console.log("-----------------------------------------------------------------------------------------");
    console.log(`🤖 Satélite ${satIndexFormatted} [${sat.address}] (${i + 1}/${satellites.length})`);

    try {
      // 1. Verificar saldo en Base Sepolia
      const baseBalWei = await baseSepoliaProvider.getBalance(sat.address);
      const baseBalEth = parseFloat(ethers.formatEther(baseBalWei));
      console.log(`   ↳ Saldo actual en Base Sepolia: ${baseBalEth.toFixed(6)} ETH`);

      if (baseBalEth >= thresholdEth) {
        console.log(`   ⏭️  [OMITIDO] Ya dispone de >= ${thresholdEth.toFixed(4)} ETH en Base Sepolia.`);
        results.alreadyFunded++;
        results.details.push({
          index: sat.index,
          address: sat.address,
          status: "ALREADY_FUNDED",
          baseBalance: baseBalEth
        });
      } else {
        // 2. Verificar saldo en Ethereum Sepolia
        const sepBalWei = await sepoliaProvider.getBalance(sat.address);
        const sepBalEth = parseFloat(ethers.formatEther(sepBalWei));
        console.log(`   ↳ Saldo disponible en Ethereum Sepolia: ${sepBalEth.toFixed(6)} ETH`);

        // Estimar si le alcanza para depositar depositAmountStr ETH + gas
        if (sepBalWei < depositWei) {
          console.log(`   ⚠️ [FONDOS INSUFICIENTES] Necesita al menos ${depositAmountStr} SepETH.`);
          results.insufficientFunds++;
          results.details.push({
            index: sat.index,
            address: sat.address,
            status: "INSUFFICIENT_FUNDS",
            sepoliaBalance: sepBalEth
          });
        } else {
          // 3. Obtener signer aislado y validar aislamiento Anti-Sybil
          const signer = getWalletSigner(sat.index, sepoliaProvider);

          // Escudo de aislamiento estricto: el destino debe ser únicamente su propia dirección
          validateIsolation(signer.address, signer.address, allAddresses);

          if (isDryRun) {
            console.log(`   🧪 [DRY-RUN] Simulación: Se enviaría ${depositAmountStr} ETH al L1StandardBridge.`);
            console.log(`      Destino en Base Sepolia: ${signer.address} (100% Aislado)`);
            results.successfullyBridged++;
            results.details.push({
              index: sat.index,
              address: sat.address,
              status: "DRY_RUN_SUCCESS"
            });
          } else {
            console.log(`   🚀 Ejecutando depósito de ${depositAmountStr} ETH al L1StandardBridge...`);
            const bridgeContract = new ethers.Contract(BASE_SEPOLIA_L1_BRIDGE, L1_BRIDGE_ABI, signer);

            // bridgeETHTo envía los fondos a la misma dirección del satélite en Base Sepolia
            const tx = await bridgeContract.bridgeETHTo(
              signer.address,
              MIN_GAS_LIMIT_L2,
              "0x",
              {
                value: depositWei
              }
            );

            console.log(`   📡 Transacción enviada: ${tx.hash}`);
            console.log("   ⏳ Esperando confirmación en Ethereum Sepolia...");

            const receipt = await tx.wait(1);
            console.log(`   ✅ Transacción confirmada en bloque #${receipt.blockNumber} (Gas usado: ${receipt.gasUsed.toString()})`);
            console.log(`   🔗 Explorer: https://sepolia.etherscan.io/tx/${receipt.hash}`);

            results.successfullyBridged++;
            results.details.push({
              index: sat.index,
              address: sat.address,
              status: "BRIDGED",
              txHash: receipt.hash,
              blockNumber: receipt.blockNumber
            });
          }
        }
      }
    } catch (err) {
      console.error(`   ❌ ERROR en satélite ${satIndexFormatted}: ${err.message}`);
      results.errors++;
      results.details.push({
        index: sat.index,
        address: sat.address,
        status: "ERROR",
        error: err.message
      });
    }

    // 4. Jitter aleatorio Anti-Sybil de 1.5 a 3.5 segundos entre cada satélite (excepto el último)
    if (i < satellites.length - 1 && !isDryRun) {
      await sleepRandom(1500, 3500);
    }
  }

  // -------------------------------------------------------------------------------------
  // RESUMEN Y REPORTE
  // -------------------------------------------------------------------------------------
  console.log("\n=========================================================================================");
  console.log("                          📊 RESUMEN DE OPERACIÓN BRIDGE                                 ");
  console.log("=========================================================================================");
  console.log(`🤖 Satélites evaluados         : ${results.totalEvaluated}`);
  console.log(`✅ Fondos cruzados exitosamente : ${results.successfullyBridged}`);
  console.log(`⏭️  Omitidos (ya tenían saldo)   : ${results.alreadyFunded}`);
  console.log(`⚠️ Fondos insuficientes en L1   : ${results.insufficientFunds}`);
  console.log(`❌ Errores                     : ${results.errors}`);
  console.log("=========================================================================================\n");

  // Guardar reporte local
  const reportPath = path.join(__dirname, "bridge-base-report.json");
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    isDryRun,
    results
  }, null, 2), "utf8");
  console.log(`💾 Reporte de bridge guardado en: ${reportPath}`);

  // 5. Notificación a Telegram
  console.log("📱 Enviando reporte a Telegram...");
  const modeBadge = isDryRun ? "🧪 <b>[DRY-RUN SIMULACIÓN]</b>" : "⚡ <b>[PRODUCCIÓN EN VIVO]</b>";
  const telegramMessage = `
🌉 <b>ÁREA 501 - BRIDGE A BASE SEPOLIA</b>
${modeBadge}

🎯 <b>Contrato:</b> <code>${BASE_SEPOLIA_L1_BRIDGE}</code>
🤖 <b>Satélites Evaluados:</b> ${results.totalEvaluated}
✅ <b>Satélites Fonadeados (L1 -> L2):</b> ${results.successfullyBridged}
⏭️ <b>Omitidos (Con saldo previo):</b> ${results.alreadyFunded}
⚠️ <b>Insuficientes en Sepolia:</b> ${results.insufficientFunds}
❌ <b>Fallos:</b> ${results.errors}
🛡️ <b>Escudo Anti-Sybil:</b> Aislamiento 100% individual verificado

⏰ <i>${new Date().toLocaleString("es-ES", { timeZone: "UTC" })} UTC</i>
`.trim();

  await sendTelegramAlert(telegramMessage);
  console.log("🎉 Proceso de Auto-Bridge finalizado.\n");
}

if (require.main === module) {
  runAutoBridge().catch((err) => {
    console.error("❌ Fallo crítico en Auto-Bridge:", err);
    process.exit(1);
  });
}

module.exports = {
  runAutoBridge,
  BASE_SEPOLIA_L1_BRIDGE
};
