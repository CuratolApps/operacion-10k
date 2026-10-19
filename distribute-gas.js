/**
 * distribute-gas.js - Operación 10k
 * Distribuidor Inteligente de Gas Interno para Escalado de Satélites.
 * Permite redistribuir el excedente de Sepolia ETH (o de cualquier otra red)
 * desde satélites donantes con superávit hacia los nuevos satélites (#21 a #50+).
 * 
 * Uso:
 *   node distribute-gas.js --from 3 --to-start 21 --to-end 50 --amount 0.015
 *   node distribute-gas.js --dry-run
 * 
 * Regla de seguridad: PROHIBIDO registrar o mostrar claves privadas ni volcar .env.
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { ethers } = require("ethers");
const { networks } = require("./networks");
const { sleepRandom } = require("./anti-sybil");
const { getWalletSigner } = require("./swarm-engine");
const { sendTelegramAlert } = require("./telegram-notifier");

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

async function runDistributeGas() {
  const isDryRun = process.argv.includes("--dry-run");
  const networkKey = parseArg("--network", "ethereumSepolia");
  const defaultAmount = parseArg("--amount", "0.008");
  const toStart = parseInt(parseArg("--to-start", "21"), 10);
  const toEnd = parseInt(parseArg("--to-end", "60"), 10);

  const netConfig = networks[networkKey] || networks.ethereumSepolia;
  const provider = createProvider(netConfig);

  console.log("=========================================================================================");
  console.log("          ⛽ OPERACIÓN 10K - DISTRIBUIDOR DE GAS INTERNO ENTRE SATÉLITES                 ");
  console.log("=========================================================================================");
  console.log(`🌐 Red: ${netConfig.name} (Chain ID: ${netConfig.chainId})`);
  console.log(`🛡️  Modo: ${isDryRun ? "DRY-RUN (Simulación sin transacciones)" : "PRODUCCIÓN (En Vivo)"}`);
  console.log(`🎯 Satélites Destino: #${toStart} al #${toEnd}`);
  console.log(`💰 Monto por Satélite: ${defaultAmount} ${netConfig.symbol}`);
  console.log(`👥 Donantes Escalonados: Satélites #01 al #20\n`);

  const allWallets = loadPublicWallets();
  const targetSatellites = allWallets.filter((w) => w.index >= toStart && w.index <= toEnd);

  if (targetSatellites.length === 0) {
    console.log(`⚠️ No se encontraron satélites en el rango #${toStart}-#${toEnd}. Verifica SWARM_SIZE.`);
    return;
  }

  // Verificar saldos de los donantes #01 al #20
  console.log(`🔍 Verificando saldos de satélites donantes #01 al #20 en ${netConfig.name}...`);
  const donors = [];
  for (let dIdx = 1; dIdx <= 20; dIdx++) {
    const w = allWallets.find((x) => x.index === dIdx);
    if (!w) continue;
    try {
      const balWei = await provider.getBalance(w.address);
      const balEth = parseFloat(ethers.formatEther(balWei));
      donors.push({ index: dIdx, address: w.address, balance: balEth });
      console.log(`   • Satélite #${String(dIdx).padStart(2, "0")}: ${balEth.toFixed(4)} ${netConfig.symbol}`);
    } catch (e) {
      console.log(`   ⚠️ Error consultando Satélite #${dIdx}: ${e.message}`);
    }
  }
  console.log(`✅ ${donors.length} donantes listos para el reparto escalonado.\n`);

  let successCount = 0;
  let totalDistributed = 0;
  const transferWei = ethers.parseEther(defaultAmount);
  const minRequiredTargetBal = parseFloat(defaultAmount) * 0.85;

  for (let i = 0; i < targetSatellites.length; i++) {
    const target = targetSatellites[i];
    const targetTag = `#${String(target.index).padStart(2, "0")}`;

    // Asignación escalonada round-robin entre satélites #01 al #15
    const donorObj = donors[i % donors.length];
    const donorTag = `#${String(donorObj.index).padStart(2, "0")}`;

    // Verificar si el satélite destino ya tiene saldo suficiente
    let currentTargetBal = 0;
    try {
      const bWei = await provider.getBalance(target.address);
      currentTargetBal = parseFloat(ethers.formatEther(bWei));
    } catch (_) {}

    if (currentTargetBal >= minRequiredTargetBal) {
      console.log(`⏭️  Satélite ${targetTag} ya dispone de ${currentTargetBal.toFixed(4)} ${netConfig.symbol}. Omitiendo.`);
      continue;
    }

    console.log(`➤ [${i + 1}/${targetSatellites.length}] Fondeando Satélite ${targetTag} [${target.address}] desde Satélite ${donorTag}...`);

    if (isDryRun) {
      console.log(`   🧪 [DRY-RUN] Simulado: Envío de ${defaultAmount} ${netConfig.symbol} desde ${donorTag}`);
      successCount++;
      totalDistributed += parseFloat(defaultAmount);
    } else {
      try {
        const signer = getWalletSigner(donorObj.index, provider);
        const tx = await signer.sendTransaction({
          to: target.address,
          value: transferWei
        });
        console.log(`   📡 Tx enviada: ${tx.hash}`);
        const receipt = await tx.wait(1);
        console.log(`   ✅ Confirmada en bloque #${receipt.blockNumber} (Gas usado: ${receipt.gasUsed.toString()})`);
        successCount++;
        totalDistributed += parseFloat(defaultAmount);
      } catch (txErr) {
        console.log(`   ❌ Error transfiriendo a ${targetTag} desde ${donorTag}: ${txErr.message}`);
      }
    }

    if (i < targetSatellites.length - 1 && !isDryRun) {
      await sleepRandom(2000, 3500);
    }
  }

  console.log("\n=========================================================================================");
  console.log("                        📊 RESUMEN DE DISTRIBUCIÓN DE GAS                                ");
  console.log("=========================================================================================");
  console.log(`✅ Satélites fondeados exitosamente : ${successCount}`);
  console.log(`💰 Total gas distribuido            : ${totalDistributed.toFixed(4)} ${netConfig.symbol}`);
  console.log("=========================================================================================\n");

  if (!isDryRun && successCount > 0) {
    await sendTelegramAlert(
      `⛽ <b>OPERACIÓN 10K - DISTRIBUCIÓN DE GAS COMPLETADA</b>\n\n` +
      `🌐 <b>Red:</b> ${netConfig.name}\n` +
      `🤖 <b>Satélites Fondeados:</b> ${successCount} (Rango #${toStart}-#${toEnd})\n` +
      `💰 <b>Total Repartido:</b> ${totalDistributed.toFixed(4)} ${netConfig.symbol}\n` +
      `⏰ <i>${new Date().toLocaleString("es-ES", { timeZone: "UTC" })} UTC</i>`
    );
  }
}

if (require.main === module) {
  runDistributeGas().catch((err) => {
    console.error("❌ Fallo en distribute-gas:", err);
    process.exit(1);
  });
}

module.exports = {
  runDistributeGas
};
