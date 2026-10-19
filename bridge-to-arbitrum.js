/**
 * bridge-to-arbitrum.js - Operación 10k
 * Auto-Bridge a Arbitrum Sepolia vía Arbitrum Delayed Inbox oficial en Ethereum Sepolia.
 * 
 * Contrato Oficial Inbox en Ethereum Sepolia:
 *   0xaAe29B0366299461418F5324a79Afc425BE5ae21
 * Función: depositEth() -> Calldata: 0x439370b1
 * Monto: 0.004 ETH por satélite (#01 al #20)
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

const ARBITRUM_SEPOLIA_INBOX = "0xaAe29B0366299461418F5324a79Afc425BE5ae21";
const BRIDGE_THRESHOLD_ETH = 0.002;
const BRIDGE_DEPOSIT_ETH = "0.004";
const DEPOSIT_ETH_SELECTOR = "0x439370b1";

const WALLETS_FILE = path.join(__dirname, "wallets-public-list.json");

function loadPublicWallets() {
  if (!fs.existsSync(WALLETS_FILE)) {
    console.error(`❌ ERROR: No se encontró el archivo ${WALLETS_FILE}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8"));
}

function createProvider(netConfig) {
  const fetchRequest = new ethers.FetchRequest(netConfig.rpc);
  fetchRequest.timeout = 20000;
  return new ethers.JsonRpcProvider(fetchRequest, netConfig.chainId, {
    staticNetwork: ethers.Network.from(netConfig.chainId),
    batchMaxCount: 1
  });
}

function parseArg(flag, defaultValue) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return defaultValue;
}

async function runAutoBridgeArbitrum() {
  const isDryRun = process.argv.includes("--dry-run");
  const toStart = parseInt(parseArg("--to-start", "1"), 10);
  const toEnd = parseInt(parseArg("--to-end", "500"), 10);
  const depositAmountStr = parseArg("--amount", BRIDGE_DEPOSIT_ETH);

  console.log("=========================================================================================");
  console.log("   🌉 OPERACIÓN 10K - EXPANSIÓN MULTI-RED: AUTO-BRIDGE A ARBITRUM SEPOLIA (L1 -> L2)    ");
  console.log("=========================================================================================");
  console.log(`🛡️  Modo de ejecución: ${isDryRun ? "DRY-RUN (Simulación sin transacciones reales)" : "PRODUCCIÓN (Transacciones On-Chain en vivo)"}`);
  console.log(`🎯 Contrato Oficial Delayed Inbox L1: ${ARBITRUM_SEPOLIA_INBOX}`);
  console.log(`🎯 Rango de Satélites: #${toStart} al #${toEnd}`);
  console.log(`💰 Monto por Satélite: ${depositAmountStr} ETH`);
  console.log(`⚡ Umbral de Exclusión: >= ${BRIDGE_THRESHOLD_ETH} ETH en Arbitrum Sepolia`);
  console.log("🔒 Política Anti-Sybil: Aislamiento 100% individual. Cada satélite fondea su propia dirección L2.\n");

  const allWallets = loadPublicWallets();
  const allAddresses = allWallets.map((w) => w.address);

  // Filtrar satélites dentro del rango solicitado
  const satellites = allWallets.filter((w) => w.index >= toStart && w.index <= toEnd);

  if (satellites.length === 0) {
    console.error(`❌ ERROR: No se encontraron satélites en el rango #${toStart}-#${toEnd}`);
    process.exit(1);
  }

  const sepoliaProvider = createProvider(networks.ethereumSepolia);
  const arbSepoliaProvider = createProvider(networks.arbitrumSepolia);

  console.log("📡 Conectando con las redes:");
  try {
    const [sepBlock, arbBlock] = await Promise.all([
      sepoliaProvider.getBlockNumber(),
      arbSepoliaProvider.getBlockNumber()
    ]);
    console.log(`   • Ethereum Sepolia (L1) : Bloque #${sepBlock} 🟢 ONLINE`);
    console.log(`   • Arbitrum Sepolia (L2) : Bloque #${arbBlock} 🟢 ONLINE\n`);
  } catch (err) {
    console.error(`❌ ERROR de conexión RPC: ${err.message}`);
    process.exit(1);
  }

  const depositWei = ethers.parseEther(depositAmountStr);
  const minRequiredL1 = depositWei + ethers.parseEther("0.0005");

  let successCount = 0;
  let skippedCount = 0;
  let totalBridged = 0;

  for (let i = 0; i < satellites.length; i++) {
    const sat = satellites[i];
    const satTag = `[${i + 1}/${satellites.length}] Satélite #${String(sat.index).padStart(2, "0")}`;
    console.log(`➤ ${satTag} [${sat.address}]:`);

    // 1. Verificar balance en Arbitrum Sepolia
    let arbBalanceEth = 0;
    try {
      const arbBalWei = await arbSepoliaProvider.getBalance(sat.address);
      arbBalanceEth = parseFloat(ethers.formatEther(arbBalWei));
    } catch (_) {}

    console.log(`   Saldo en Arbitrum Sepolia : ${arbBalanceEth.toFixed(6)} ETH`);

    if (arbBalanceEth >= BRIDGE_THRESHOLD_ETH) {
      console.log(`   ⏭️  OMITIDO: Saldo suficiente en Arbitrum (>= ${BRIDGE_THRESHOLD_ETH} ETH).`);
      skippedCount++;
      console.log("");
      continue;
    }

    // 2. Verificar balance en Ethereum Sepolia
    let sepBalanceWei = 0n;
    let sepBalanceEth = 0;
    try {
      sepBalanceWei = await sepoliaProvider.getBalance(sat.address);
      sepBalanceEth = parseFloat(ethers.formatEther(sepBalanceWei));
    } catch (e) {
      console.log(`   ⚠️ Error de lectura Sepolia: ${e.message}`);
    }

    console.log(`   Saldo en Ethereum Sepolia : ${sepBalanceEth.toFixed(6)} ETH`);

    if (sepBalanceWei < minRequiredL1) {
      console.log(`   ⚠️ Saldo insuficiente en Ethereum Sepolia para cubrir puente + gas.`);
      console.log("");
      continue;
    }

    // 3. Verificación Anti-Sybil
    validateIsolation(sat.address, ARBITRUM_SEPOLIA_INBOX, allAddresses);

    if (isDryRun) {
      console.log(`   🧪 [DRY-RUN] Simulado: Depósito de ${depositAmountStr} ETH en Delayed Inbox`);
      successCount++;
      totalBridged += parseFloat(depositAmountStr);
    } else {
      try {
        const signer = getWalletSigner(sat.index, sepoliaProvider);
        console.log(`   🚀 Enviando tx a Arbitrum Delayed Inbox (depositEth)...`);

        const tx = await signer.sendTransaction({
          to: ARBITRUM_SEPOLIA_INBOX,
          value: depositWei,
          data: DEPOSIT_ETH_SELECTOR
        });

        console.log(`   📡 Tx enviada: ${tx.hash}`);
        const receipt = await tx.wait(1);
        console.log(`   ✅ Confirmada en bloque #${receipt.blockNumber} (Gas usado: ${receipt.gasUsed.toString()})`);
        successCount++;
        totalBridged += parseFloat(depositAmountStr);
      } catch (txErr) {
        console.log(`   ❌ Error al ejecutar puente: ${txErr.message}`);
      }
    }

    if (i < satellites.length - 1 && !isDryRun) {
      await sleepRandom(2000, 3500);
    }
    console.log("");
  }

  console.log("=========================================================================================");
  console.log("                 📊 RESUMEN FINAL AUTO-BRIDGE ARBITRUM SEPOLIA                           ");
  console.log("=========================================================================================");
  console.log(`🎯 Satélites Evaluados       : ${satellites.length}`);
  console.log(`⏭️  Ya con fondos en Arbitrum : ${skippedCount}`);
  console.log(`✅ Fondos cruzados con éxito : ${successCount}`);
  console.log(`💰 Total ETH transferido     : ${totalBridged.toFixed(4)} ETH`);
  console.log("=========================================================================================\n");

  if (!isDryRun && successCount > 0) {
    await sendTelegramAlert(
      `🌉 <b>OPERACIÓN 10K - AUTO-BRIDGE ARBITRUM SEPOLIA COMPLETADO</b>\n\n` +
      `⚡ <b>Contrato:</b> Arbitrum Delayed Inbox\n` +
      `🤖 <b>Satélites Fondeados:</b> ${successCount}/${satellites.length}\n` +
      `💰 <b>Total Cruzado:</b> ${totalBridged.toFixed(4)} ETH\n` +
      `🛡️ <b>Anti-Sybil:</b> Aislamiento 100% individual verificado\n` +
      `⏰ <i>${new Date().toLocaleString("es-ES", { timeZone: "UTC" })} UTC</i>`
    );
  }

  return { successCount, skippedCount, totalBridged };
}

if (require.main === module) {
  runAutoBridgeArbitrum().catch((err) => {
    console.error("❌ Fallo en bridge-to-arbitrum:", err);
    process.exit(1);
  });
}

module.exports = {
  runAutoBridgeArbitrum
};
