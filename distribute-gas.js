/**
 * distribute-gas.js - Operación 10k
 * Distribuidor Inteligente y Masivo de Gas Interno por Tandas Intra-Bloque.
 * Cumplimiento estricto Anti-Sybil: 100% aislamiento entre Bloques (B1-B5).
 * 
 * Reglas de seguridad:
 * - Anti-Sybil estricto: Rotación de donantes EXCLUSIVAMENTE dentro del mismo bloque.
 * - Regla de Oro: Reserva mínima intangible de 0.015 ETH + 0.008 ETH buffer (mínimo 0.023 ETH para donar).
 * - Descuento de gas real on-chain calculado desde el receipt (no estático).
 * - Cuenta VIP #00 blindada: 100% solo lectura, jamás dona ni transacciona.
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { ethers } = require("ethers");
const { networks } = require("./networks");
const { sleepRandom, getBlockId, validateIsolation } = require("./anti-sybil");
const { getWalletSigner } = require("./swarm-engine");
const { sendTelegramAlert } = require("./telegram-notifier");

const WALLETS_FILE = path.join(__dirname, "wallets-public-list.json");
const MIN_DONOR_RESERVE_ETH = 0.015; // Reserva intangible de seguridad
const OPERATIONAL_BUFFER_ETH = 0.008; // Buffer operativo
const MIN_DONOR_THRESHOLD_ETH = MIN_DONOR_RESERVE_ETH + OPERATIONAL_BUFFER_ETH; // 0.023 ETH

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

/**
 * Obtiene y ordena los donantes elegibles EXCLUSIVAMENTE dentro del mismo bloque.
 * Requisito estricto: Balance >= 0.023 ETH (0.015 reserva intangible + 0.008 buffer).
 */
async function getEligibleDonors(allWallets, provider, netConfig, transferAmount, targetBlockId) {
  const donorCandidates = allWallets.filter(
    (w) => w.index > 0 && getBlockId(w.index) === targetBlockId
  );
  const eligible = [];

  for (const d of donorCandidates) {
    try {
      const balWei = await provider.getBalance(d.address);
      const balEth = parseFloat(ethers.formatEther(balWei));
      // Debe cumplir la regla de oro: mantener mínimo 0.015 ETH tras donación y costos de gas
      if (balEth >= MIN_DONOR_THRESHOLD_ETH && (balEth - transferAmount - 0.001) >= MIN_DONOR_RESERVE_ETH) {
        eligible.push({
          index: d.index,
          address: d.address,
          blockId: targetBlockId,
          balance: balEth,
          availableForDonation: balEth - MIN_DONOR_RESERVE_ETH
        });
      }
    } catch (_) {}
  }

  // Ordenar por mayor balance descendente
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
  console.log("     ⛽ OPERACIÓN 10K - DISTRIBUIDOR DE GAS MASIVO INTRA-BLOQUE (ANTI-SYBIL)              ");
  console.log("=========================================================================================");
  console.log(`🌐 Red               : ${netConfig.name} (Chain ID: ${netConfig.chainId})`);
  console.log(`🛡️  Modo de Ejecución : ${isDryRun ? "DRY-RUN (Simulación sin transacciones)" : "PRODUCCIÓN (En Vivo On-Chain)"}`);
  console.log(`🎯 Rango Total      : Satélites #${toStart} al #${toEnd} (${toEnd - toStart + 1} satélites)`);
  console.log(`📦 Tamaño de Tanda  : ${batchSize} satélites por bloque`);
  console.log(`💰 Monto Individual : ${defaultAmount} ${netConfig.symbol}`);
  console.log(`🔒 Reserva Intangible : ${MIN_DONOR_RESERVE_ETH} ${netConfig.symbol} (Umbral mínimo donante: ${MIN_DONOR_THRESHOLD_ETH} ${netConfig.symbol})`);
  console.log("🛡️  Aislamiento Bloques: 100% estanco. Ningún donante fondeará fuera de su propio bloque.\n");

  const allWallets = loadPublicWallets();
  const allAddresses = allWallets.map((w) => w.address);
  const totalFleetSatellites = allWallets.filter((w) => w.index > 0).length;
  const targetSatellites = allWallets.filter((w) => w.index >= toStart && w.index <= toEnd);

  if (targetSatellites.length === 0) {
    console.log(`⚠️ No se encontraron satélites en el rango #${toStart}-#${toEnd}.`);
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
    const currentBlockId = getBlockId(batchStartIdx);

    console.log("-----------------------------------------------------------------------------------------");
    console.log(`🚀 INICIANDO ${batchTag.toUpperCase()} - BLOQUE B${currentBlockId} (${currentBatch.length} SATÉLITES)`);
    console.log("-----------------------------------------------------------------------------------------");

    // Donantes elegibles estrictamente dentro del mismo bloque
    const donors = await getEligibleDonors(allWallets, provider, netConfig, transferAmountEth, currentBlockId);
    if (donors.length === 0 && !isDryRun) {
      console.error(`❌ ALERTA ANTI-SYBIL: No hay donantes elegibles en el Bloque B${currentBlockId} con >= ${MIN_DONOR_THRESHOLD_ETH} ${netConfig.symbol}.`);
      console.error(`   Protección activa: NO se utilizarán satélites de otros bloques para evitar clusterización.`);
      continue;
    }

    console.log(`👥 Donantes intra-bloque elegibles en B${currentBlockId}: ${donors.length}`);
    donors.slice(0, 5).forEach((d) => {
      console.log(`   • Satélite #${String(d.index).padStart(3, "0")}: ${d.balance.toFixed(4)} ${netConfig.symbol} (Disp: ${d.availableForDonation.toFixed(4)})`);
    });
    console.log("");

    let batchSuccessCount = 0;
    let batchDistributed = 0;
    const transferWei = ethers.parseEther(defaultAmount);
    const minRequiredTargetBal = transferAmountEth * 0.85;

    for (let i = 0; i < currentBatch.length; i++) {
      const target = currentBatch[i];
      const targetTag = `#${String(target.index).padStart(3, "0")}`;

      // Re-ordenar y tomar el donante con mayor balance dentro del mismo bloque
      donors.sort((a, b) => b.balance - a.balance);
      const donorObj = donors.find((d) => d.index !== target.index && (d.balance - transferAmountEth - 0.001) >= MIN_DONOR_RESERVE_ETH);

      if (!donorObj) {
        console.log(`\n⚠️ [REGLA DE ORO] Ningún donante del Bloque B${currentBlockId} puede donar sin comprometer su reserva de ${MIN_DONOR_RESERVE_ETH} ${netConfig.symbol}.`);
        console.log("   Deteniendo tanda para proteger la supervivencia operativa del bloque.");
        break;
      }

      const donorTag = `#${String(donorObj.index).padStart(3, "0")}`;

      // Comprobar si el satélite destino ya tiene gas
      let currentTargetBal = 0;
      try {
        const bWei = await provider.getBalance(target.address);
        currentTargetBal = parseFloat(ethers.formatEther(bWei));
      } catch (_) {}

      if (currentTargetBal >= minRequiredTargetBal) {
        console.log(`⏭️  Satélite ${targetTag} ya dispone de ${currentTargetBal.toFixed(4)} ${netConfig.symbol}. Omitiendo.`);
        continue;
      }

      // Validar aislamiento estricto antes de emitir
      try {
        validateIsolation(donorObj.index, target.index, allAddresses, allWallets, true);
      } catch (isoErr) {
        console.error(`🚨 ESCUDO ANTI-SYBIL ACTIVADO: ${isoErr.message}`);
        continue;
      }

      console.log(`➤ [${i + 1}/${currentBatch.length}] Fondeando Satélite ${targetTag} [${target.address}] desde Donante ${donorTag} B${currentBlockId} (Saldo: ${donorObj.balance.toFixed(4)} ETH)...`);

      if (isDryRun) {
        console.log(`   🧪 [DRY-RUN] Simulado: Envío de ${defaultAmount} ${netConfig.symbol} desde ${donorTag} hacia ${targetTag} (Mismo bloque B${currentBlockId})`);
        batchSuccessCount++;
        batchDistributed += transferAmountEth;
        donorObj.balance -= transferAmountEth;
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
          
          // Cálculo preciso de gas real on-chain
          const feeData = await provider.getFeeData().catch(() => null);
          const gasPriceUsed = receipt.gasPrice || (feeData ? feeData.gasPrice : 0n) || ethers.parseUnits("1.5", "gwei");
          const realGasCostWei = receipt.gasUsed * BigInt(gasPriceUsed);
          const realGasCostEth = parseFloat(ethers.formatEther(realGasCostWei));

          batchSuccessCount++;
          batchDistributed += transferAmountEth;
          // Deducir monto enviado + costo real de gas on-chain
          donorObj.balance -= (transferAmountEth + realGasCostEth);
          console.log(`   ⛽ Saldo restante Donante ${donorTag}: ${donorObj.balance.toFixed(4)} ETH (Gas real: ${realGasCostEth.toFixed(6)} ETH)`);
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

    console.log(`\n✅ ${batchTag} completada: ${batchSuccessCount}/${currentBatch.length} satélites fondeados.`);
    console.log(`💰 Gas repartido en tanda: ${batchDistributed.toFixed(4)} ${netConfig.symbol}\n`);

    if (!isDryRun && batchSuccessCount > 0) {
      const cumulativeFunded = batchEndIdx;
      const progressPercent = ((cumulativeFunded / totalFleetSatellites) * 100).toFixed(1);

      await sendTelegramAlert(
        `⛽ <b>OPERACIÓN 10K - DISTRIBUCIÓN DE GAS INTRA-BLOQUE (${bIdx + 1}/${batches.length})</b>\n\n` +
        `🌐 <b>Red:</b> ${netConfig.name}\n` +
        `📦 <b>Bloque Aislado:</b> B${currentBlockId} (Rango #${batchStartIdx}-#${batchEndIdx})\n` +
        `🤖 <b>Satélites Fondeados:</b> ${batchSuccessCount}\n` +
        `💰 <b>Gas en esta Tanda:</b> ${batchDistributed.toFixed(4)} ${netConfig.symbol}\n` +
        `📈 <b>Flota Fondeada Acumulada:</b> ${cumulativeFunded}/${totalFleetSatellites} Satélites (${progressPercent}%)\n` +
        `🛡️ <b>Anti-Sybil:</b> Aislamiento intra-bloque estricto (0% cruce inter-bloques)\n` +
        `🔒 <b>Regla de Oro:</b> Reserva mínima intangible >0.015 ETH preservada\n` +
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
  runDistributeGas,
  getEligibleDonors
};
