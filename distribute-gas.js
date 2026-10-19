/**
 * distribute-gas.js - Operación 10k
 * Distribuidor Inteligente y Masivo de Gas Interno por Tandas.
 * Permite escalar de forma segura y automatizada el fondeo de los 500 satélites.
 * 
 * Reglas de seguridad:
 * - Anti-Sybil estricto: Rotación de donantes con superávit, sin cruzar historiales.
 * - Reserva mínima de donante: 0.015 ETH protegidos en cada donante.
 * - Cuenta VIP #00 blindada: 100% solo lectura, jamás dona ni transacciona.
 * - Reportes por tanda en Telegram con desglose y porcentaje acumulado de la flota.
 * 
 * Uso:
 *   node distribute-gas.js --to-start 61 --to-end 100 --batch-size 40 --amount 0.008
 *   node distribute-gas.js --to-start 61 --to-end 150 --batch-size 45
 *   node distribute-gas.js --dry-run
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
const MIN_DONOR_RESERVE_ETH = 0.015; // Fondo intangible de cada donante para sus propias operaciones

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

/**
 * Obtiene y ordena los donantes elegibles (#01 al #20) por balance descendente.
 */
async function getEligibleDonors(allWallets, provider, netConfig, transferAmount) {
  const donorCandidates = allWallets.filter((w) => w.index >= 1 && w.index <= 20);
  const eligible = [];

  for (const d of donorCandidates) {
    try {
      const balWei = await provider.getBalance(d.address);
      const balEth = parseFloat(ethers.formatEther(balWei));
      if (balEth >= MIN_DONOR_RESERVE_ETH + transferAmount) {
        eligible.push({
          index: d.index,
          address: d.address,
          balance: balEth,
          availableForDonation: balEth - MIN_DONOR_RESERVE_ETH
        });
      }
    } catch (_) {}
  }

  // Ordenar por mayor balance disponible para preservar a los satélites con menor saldo
  eligible.sort((a, b) => b.balance - a.balance);
  return eligible;
}

async function runDistributeGas() {
  const isDryRun = process.argv.includes("--dry-run");
  const networkKey = parseArg("--network", "ethereumSepolia");
  const defaultAmount = parseArg("--amount", "0.008");
  const transferAmountEth = parseFloat(defaultAmount);
  const toStart = parseInt(parseArg("--to-start", "61"), 10);
  const toEnd = parseInt(parseArg("--to-end", "100"), 10);
  const batchSize = parseInt(parseArg("--batch-size", "40"), 10);

  const netConfig = networks[networkKey] || networks.ethereumSepolia;
  const provider = createProvider(netConfig);

  console.log("=========================================================================================");
  console.log("          ⛽ OPERACIÓN 10K - DISTRIBUIDOR DE GAS MASIVO POR TANDAS                       ");
  console.log("=========================================================================================");
  console.log(`🌐 Red               : ${netConfig.name} (Chain ID: ${netConfig.chainId})`);
  console.log(`🛡️  Modo de Ejecución : ${isDryRun ? "DRY-RUN (Simulación sin transacciones)" : "PRODUCCIÓN (En Vivo On-Chain)"}`);
  console.log(`🎯 Rango Total      : Satélites #${toStart} al #${toEnd} (${toEnd - toStart + 1} satélites)`);
  console.log(`📦 Tamaño de Tanda  : ${batchSize} satélites por bloque`);
  console.log(`💰 Monto Individual : ${defaultAmount} ${netConfig.symbol}`);
  console.log(`🔒 Reserva Blindada : ${MIN_DONOR_RESERVE_ETH} ${netConfig.symbol} por donante\n`);

  const allWallets = loadPublicWallets();
  const totalFleetSatellites = allWallets.filter((w) => w.index > 0).length;
  const targetSatellites = allWallets.filter((w) => w.index >= toStart && w.index <= toEnd);

  if (targetSatellites.length === 0) {
    console.log(`⚠️ No se encontraron satélites en el rango #${toStart}-#${toEnd}. Verifica SWARM_SIZE.`);
    return;
  }

  // Dividir en tandas/bloques de tamaño batchSize
  const batches = [];
  for (let i = 0; i < targetSatellites.length; i += batchSize) {
    batches.push(targetSatellites.slice(i, i + batchSize));
  }

  console.log(`📋 Plan de Distribución: ${batches.length} Tanda(s) programada(s)\n`);

  let grandTotalSuccess = 0;
  let grandTotalDistributed = 0;

  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const currentBatch = batches[bIdx];
    const batchStartIdx = currentBatch[0].index;
    const batchEndIdx = currentBatch[currentBatch.length - 1].index;
    const batchTag = `Tanda ${bIdx + 1}/${batches.length} (Rango #${batchStartIdx}-#${batchEndIdx})`;

    console.log("-----------------------------------------------------------------------------------------");
    console.log(`🚀 INICIANDO ${batchTag.toUpperCase()} - ${currentBatch.length} SATÉLITES`);
    console.log("-----------------------------------------------------------------------------------------");

    // Actualizar donantes elegibles en cada tanda
    const donors = await getEligibleDonors(allWallets, provider, netConfig, transferAmountEth);
    if (donors.length === 0 && !isDryRun) {
      console.error("❌ ERROR: No hay donantes disponibles con saldo superior a la reserva de seguridad.");
      break;
    }

    console.log(`👥 Donantes elegibles con superávit: ${donors.length}`);
    donors.slice(0, 5).forEach((d) => {
      console.log(`   • Satélite #${String(d.index).padStart(2, "0")}: ${d.balance.toFixed(4)} ${netConfig.symbol}`);
    });
    if (donors.length > 5) {
      console.log(`   ... y ${donors.length - 5} donantes más.`);
    }
    console.log("");

    let batchSuccessCount = 0;
    let batchDistributed = 0;
    const transferWei = ethers.parseEther(defaultAmount);
    const minRequiredTargetBal = transferAmountEth * 0.85;

    for (let i = 0; i < currentBatch.length; i++) {
      const target = currentBatch[i];
      const targetTag = `#${String(target.index).padStart(3, "0")}`;

      // Rotación inteligente de donantes priorizando mayor saldo
      const donorObj = donors[i % donors.length];
      const donorTag = `#${String(donorObj.index).padStart(2, "0")}`;

      // Comprobar si ya tiene gas
      let currentTargetBal = 0;
      try {
        const bWei = await provider.getBalance(target.address);
        currentTargetBal = parseFloat(ethers.formatEther(bWei));
      } catch (_) {}

      if (currentTargetBal >= minRequiredTargetBal) {
        console.log(`⏭️  Satélite ${targetTag} ya dispone de ${currentTargetBal.toFixed(4)} ${netConfig.symbol}. Omitiendo.`);
        continue;
      }

      console.log(`➤ [${i + 1}/${currentBatch.length}] Fondeando Satélite ${targetTag} [${target.address}] desde Donante ${donorTag}...`);

      if (isDryRun) {
        console.log(`   🧪 [DRY-RUN] Simulado: Envío de ${defaultAmount} ${netConfig.symbol} desde ${donorTag}`);
        batchSuccessCount++;
        batchDistributed += transferAmountEth;
      } else {
        try {
          const signer = getWalletSigner(donorObj.index, provider);
          const tx = await signer.sendTransaction({
            to: target.address,
            value: transferWei
          });
          console.log(`   📡 Tx enviada: ${tx.hash}`);
          const receipt = await tx.wait(1);
          console.log(`   ✅ Confirmada en bloque #${receipt.blockNumber} (Gas: ${receipt.gasUsed.toString()})`);
          batchSuccessCount++;
          batchDistributed += transferAmountEth;
          donorObj.balance -= (transferAmountEth + 0.0001);
        } catch (txErr) {
          console.log(`   ❌ Error transfiriendo a ${targetTag} desde ${donorTag}: ${txErr.message}`);
        }
      }

      if (i < currentBatch.length - 1 && !isDryRun) {
        await sleepRandom(2000, 3500);
      }
    }

    grandTotalSuccess += batchSuccessCount;
    grandTotalDistributed += batchDistributed;

    // Reporte parcial de tanda a Telegram
    console.log(`\n✅ ${batchTag} completada: ${batchSuccessCount}/${currentBatch.length} satélites fondeados.`);
    console.log(`💰 Gas repartido en tanda: ${batchDistributed.toFixed(4)} ${netConfig.symbol}\n`);

    if (!isDryRun && batchSuccessCount > 0) {
      const cumulativeFunded = batchEndIdx;
      const progressPercent = ((cumulativeFunded / totalFleetSatellites) * 100).toFixed(1);

      await sendTelegramAlert(
        `⛽ <b>OPERACIÓN 10K - DISTRIBUCIÓN DE GAS (${bIdx + 1}/${batches.length})</b>\n\n` +
        `🌐 <b>Red:</b> ${netConfig.name}\n` +
        `🤖 <b>Satélites Fondeados:</b> ${batchSuccessCount} (Rango #${batchStartIdx}-#${batchEndIdx})\n` +
        `💰 <b>Gas en esta Tanda:</b> ${batchDistributed.toFixed(4)} ${netConfig.symbol} (${defaultAmount} ETH/satélite)\n` +
        `📈 <b>Flota Fondeada Acumulada:</b> ${cumulativeFunded}/${totalFleetSatellites} Satélites (${progressPercent}%)\n` +
        `🛡️ <b>Anti-Sybil:</b> Aislamiento rotativo y reserva mínima protegida\n` +
        `⏰ <i>${new Date().toLocaleString("es-ES", { timeZone: "UTC" })} UTC</i>`
      );
    }
  }

  console.log("=========================================================================================");
  console.log("                   📊 RESUMEN GLOBAL DE DISTRIBUCIÓN DE GAS                             ");
  console.log("=========================================================================================");
  console.log(`🎯 Rango Solicitado          : #${toStart} al #${toEnd}`);
  console.log(`✅ Satélites Nuevos Fondeados: ${grandTotalSuccess}`);
  console.log(`💰 Total Gas Distribuido     : ${grandTotalDistributed.toFixed(4)} ${netConfig.symbol}`);
  console.log("=========================================================================================\n");

  return { grandTotalSuccess, grandTotalDistributed };
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
