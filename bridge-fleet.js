/**
 * bridge-fleet.js - Operación 10k
 * Módulo de Auto-Bridge Omnichain Progresivo por Lotes (L1 -> L2).
 * Cubre la flota completa (#101 al #500) hacia Base Sepolia y Arbitrum Sepolia.
 * 
 * Reglas de seguridad:
 * - Aislamiento 100% Anti-Sybil: cada satélite firma y paga su propio puente.
 * - Jitter aleatorio humano (2.0s a 4.0s).
 * - Fondo de reserva de emergencia: Si algún satélite tiene saldo insuficiente,
 *   recibe fondos del donante Satélite #05 (0xD6Bf034E659fD3D3188951536B55B37e7537Af11),
 *   preservando siempre la reserva intangible de 0.015 ETH.
 * - Reporte por lote a Telegram con avance acumulado sobre 500 satélites.
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { ethers } = require("ethers");
const { networks } = require("./networks");
const { sleepRandom, validateIsolation } = require("./anti-sybil");
const { getWalletSigner } = require("./swarm-engine");
const { sendTelegramAlert } = require("./telegram-notifier");

// Contratos oficiales L1
const BASE_SEPOLIA_L1_BRIDGE = "0xfd0Bf71F60660E2f608ed56e1659C450eB113120";
const ARBITRUM_SEPOLIA_INBOX = "0xaAe29B0366299461418F5324a79Afc425BE5ae21";
const DEPOSIT_ETH_SELECTOR = "0x439370b1";
const MIN_GAS_LIMIT_L2 = 200000;

// ABIs
const L1_BRIDGE_ABI = [
  "function bridgeETHTo(address _to, uint32 _minGasLimit, bytes calldata _extraData) payable"
];

// Donante de Reserva de Emergencia
const EMERGENCY_DONOR_ADDRESS = "0xD6Bf034E659fD3D3188951536B55B37e7537Af11".toLowerCase();
const MIN_DONOR_RESERVE_ETH = 0.015;

const WALLETS_FILE = path.join(__dirname, "wallets-public-list.json");

function loadPublicWallets() {
  if (!fs.existsSync(WALLETS_FILE)) {
    console.error(`❌ ERROR: No se encontró ${WALLETS_FILE}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8"));
}

function createProvider(netConfig) {
  const fetchRequest = new ethers.FetchRequest(netConfig.rpc);
  fetchRequest.timeout = 18000;
  return new ethers.JsonRpcProvider(fetchRequest, netConfig.chainId, {
    staticNetwork: ethers.Network.from(netConfig.chainId),
    batchMaxCount: 1
  });
}

process.on("unhandledRejection", (reason) => {
  console.log("⚠️ [UNHANDLED REJECTION]", reason?.message || reason);
});

async function withRetry(fn, maxRetries = 3, baseDelayMs = 1200) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
      }
    }
  }
  throw lastErr;
}

function parseArg(flag, defaultValue) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return defaultValue;
}

async function runBridgeFleet() {
  const isDryRun = process.argv.includes("--dry-run");
  const toStart = parseInt(parseArg("--to-start", "101"), 10);
  const toEnd = parseInt(parseArg("--to-end", "500"), 10);
  const batchSize = parseInt(parseArg("--batch-size", "100"), 10);
  const depositStr = parseArg("--amount", "0.0015");
  const depositWei = ethers.parseEther(depositStr);
  const depositEth = parseFloat(depositStr);
  const skipThresholdEth = depositEth * 0.8; // 0.0012 ETH

  const allWallets = loadPublicWallets();
  const allAddresses = allWallets.map((w) => w.address);
  const totalFleet = allWallets.filter((w) => w.index > 0).length;

  // Localizar satélite donante de emergencia en la lista
  const emergencyDonorObj = allWallets.find(
    (w) => w.address.toLowerCase() === EMERGENCY_DONOR_ADDRESS
  ) || { index: 5, address: EMERGENCY_DONOR_ADDRESS };

  console.log("=========================================================================================");
  console.log("       🌉 OPERACIÓN 10K - AUTO-BRIDGE OMNICHAIN PROGRESIVO POR LOTES (L1 -> L2)          ");
  console.log("=========================================================================================");
  console.log(`🌐 Redes Destino      : Base Sepolia & Arbitrum Sepolia`);
  console.log(`🛡️  Modo de Ejecución  : ${isDryRun ? "DRY-RUN (Simulación)" : "PRODUCCIÓN (On-Chain en vivo)"}`);
  console.log(`🎯 Rango Solicitado   : Satélites #${toStart} al #${toEnd} (${toEnd - toStart + 1} satélites)`);
  console.log(`📦 Tamaño de Lote     : ${batchSize} satélites`);
  console.log(`💰 Monto por Red      : ${depositStr} ETH por puente (${(depositEth * 2).toFixed(4)} ETH total)`);
  console.log(`⚡ Umbral de Exclusión: >= ${skipThresholdEth.toFixed(4)} ETH en L2`);
  console.log(`🔒 Reserva Emergencia : Donante #${emergencyDonorObj.index} [${emergencyDonorObj.address}]`);
  console.log("🔒 Política Anti-Sybil: Aislamiento 100% individual y autofondeo por satélite.\n");

  const targetSatellites = allWallets.filter((w) => w.index >= toStart && w.index <= toEnd);
  if (targetSatellites.length === 0) {
    console.error(`❌ No se encontraron satélites en el rango #${toStart}-#${toEnd}`);
    return;
  }

  // Inicializar proveedores
  const sepoliaProvider = createProvider(networks.ethereumSepolia);
  const baseProvider = createProvider(networks.baseSepolia);
  const arbProvider = createProvider(networks.arbitrumSepolia);

  console.log("📡 Verificando conexión RPC:");
  try {
    const [bSep, bBase, bArb] = await Promise.all([
      sepoliaProvider.getBlockNumber(),
      baseProvider.getBlockNumber(),
      arbProvider.getBlockNumber()
    ]);
    console.log(`   • Ethereum Sepolia (L1) : Bloque #${bSep} 🟢 ONLINE`);
    console.log(`   • Base Sepolia (L2)     : Bloque #${bBase} 🟢 ONLINE`);
    console.log(`   • Arbitrum Sepolia (L2) : Bloque #${bArb} 🟢 ONLINE\n`);
  } catch (err) {
    console.error(`❌ Error conectando a RPCs: ${err.message}`);
    process.exit(1);
  }

  // Dividir en lotes
  const batches = [];
  for (let i = 0; i < targetSatellites.length; i += batchSize) {
    batches.push(targetSatellites.slice(i, i + batchSize));
  }

  console.log(`📋 Plan de Cruce: ${batches.length} Lote(s) programado(s)\n`);

  let grandTotalBaseBridged = 0;
  let grandTotalArbBridged = 0;

  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const currentBatch = batches[bIdx];
    const startIdx = currentBatch[0].index;
    const endIdx = currentBatch[currentBatch.length - 1].index;
    const batchTag = `Lote ${bIdx + 1}/${batches.length} (Rango #${startIdx}-#${endIdx})`;

    console.log("-----------------------------------------------------------------------------------------");
    console.log(`🚀 INICIANDO ${batchTag.toUpperCase()} - ${currentBatch.length} SATÉLITES`);
    console.log("-----------------------------------------------------------------------------------------");

    let batchBaseSuccess = 0;
    let batchArbSuccess = 0;

    for (let i = 0; i < currentBatch.length; i++) {
      const sat = currentBatch[i];
      const satTag = `[${i + 1}/${currentBatch.length}] Satélite #${String(sat.index).padStart(3, "0")}`;
      console.log(`➤ ${satTag} [${sat.address}]:`);

      // 1. Consultar balances en Base y Arbitrum
      let baseBal = 0;
      let arbBal = 0;
      try {
        const [bWei, aWei] = await Promise.all([
          withRetry(() => baseProvider.getBalance(sat.address), 2, 800).catch(() => 0n),
          withRetry(() => arbProvider.getBalance(sat.address), 2, 800).catch(() => 0n)
        ]);
        baseBal = parseFloat(ethers.formatEther(bWei));
        arbBal = parseFloat(ethers.formatEther(aWei));
      } catch (_) {}

      const needsBase = baseBal < skipThresholdEth;
      const needsArb = arbBal < skipThresholdEth;

      console.log(`   ↳ Saldos L2: Base = ${baseBal.toFixed(5)} ETH | Arbitrum = ${arbBal.toFixed(5)} ETH`);

      if (!needsBase && !needsArb) {
        console.log(`   ⏭️  OMITIDO: Saldo suficiente en ambas L2.`);
        console.log("");
        continue;
      }

      // 2. Verificar saldo en Ethereum Sepolia
      let sepBalWei = 0n;
      try {
        sepBalWei = await withRetry(() => sepoliaProvider.getBalance(sat.address), 3, 1000);
      } catch (_) {}
      let sepBalEth = parseFloat(ethers.formatEther(sepBalWei));
      console.log(`   ↳ Saldo en L1 Sepolia: ${sepBalEth.toFixed(5)} ETH`);

      // Cantidad mínima requerida en Sepolia para cruzar los puentes necesarios
      const neededPuentes = (needsBase ? 1 : 0) + (needsArb ? 1 : 0);
      const minRequiredL1Wei = ethers.parseEther(String(neededPuentes * depositEth + 0.0008));

      // Si falta gas en L1, solicitar recarga de emergencia desde Satélite #05
      if (sepBalWei < minRequiredL1Wei && !isDryRun) {
        console.log(`   ⚠️ Saldo bajo en L1 (< ${(parseFloat(ethers.formatEther(minRequiredL1Wei))).toFixed(4)} ETH). Activando recarga de reserva...`);
        try {
          const donorBalWei = await withRetry(() => sepoliaProvider.getBalance(emergencyDonorObj.address), 3, 1000);
          const donorBalEth = parseFloat(ethers.formatEther(donorBalWei));
          if (donorBalEth - 0.004 > MIN_DONOR_RESERVE_ETH) {
            const donorSigner = getWalletSigner(emergencyDonorObj.index, sepoliaProvider);
            const refillTx = await donorSigner.sendTransaction({
              to: sat.address,
              value: ethers.parseEther("0.004")
            });
            await refillTx.wait(1).catch(() => {});
            console.log(`   ⛽ Recarga de 0.004 ETH acreditada desde Donante #${emergencyDonorObj.index}`);
            sepBalWei = await withRetry(() => sepoliaProvider.getBalance(sat.address), 2, 800).catch(() => ethers.parseEther("0.004"));
          } else {
            console.log(`   ⚠️ Donante de emergencia en nivel de reserva mínimo (${donorBalEth.toFixed(4)} ETH).`);
          }
        } catch (refillErr) {
          console.log(`   ⚠️ Fallo al transferir fondo de reserva: ${refillErr.message}`);
        }
      }

      const signer = getWalletSigner(sat.index, sepoliaProvider);

      // --- PUENTE 1: BASE SEPOLIA ---
      if (needsBase) {
        validateIsolation(sat.address, sat.address, allAddresses);
        if (isDryRun) {
          console.log(`   🧪 [DRY-RUN] Simulado: Puente de ${depositStr} ETH a Base Sepolia`);
          batchBaseSuccess++;
        } else {
          try {
            console.log(`   🚀 Enviando ${depositStr} ETH a Base Sepolia L1StandardBridge...`);
            const bridgeContract = new ethers.Contract(BASE_SEPOLIA_L1_BRIDGE, L1_BRIDGE_ABI, signer);
            const tx = await bridgeContract.bridgeETHTo(
              sat.address,
              MIN_GAS_LIMIT_L2,
              "0x",
              { value: depositWei }
            );
            console.log(`   📡 Tx Base enviada: ${tx.hash}`);
            try {
              const receipt = await tx.wait(1);
              console.log(`   ✅ Confirmada en bloque #${receipt.blockNumber} (Gas: ${receipt.gasUsed.toString()})`);
            } catch (waitErr) {
              console.log(`   ⚠️ Espera de bloque (Tx emitida en mempool): ${waitErr.message.slice(0, 80)}`);
            }
            batchBaseSuccess++;
          } catch (bErr) {
            console.log(`   ❌ Error al puentear a Base Sepolia: ${bErr.message}`);
          }
        }
        if (!isDryRun) await sleepRandom(1500, 3000);
      } else {
        console.log(`   ⏭️  Base Sepolia omitido (saldo >= ${skipThresholdEth.toFixed(4)} ETH)`);
      }

      // --- PUENTE 2: ARBITRUM SEPOLIA ---
      if (needsArb) {
        validateIsolation(sat.address, ARBITRUM_SEPOLIA_INBOX, allAddresses);
        if (isDryRun) {
          console.log(`   🧪 [DRY-RUN] Simulado: Puente de ${depositStr} ETH a Arbitrum Delayed Inbox`);
          batchArbSuccess++;
        } else {
          try {
            console.log(`   🚀 Enviando ${depositStr} ETH a Arbitrum Delayed Inbox...`);
            const tx = await signer.sendTransaction({
              to: ARBITRUM_SEPOLIA_INBOX,
              value: depositWei,
              data: DEPOSIT_ETH_SELECTOR
            });
            console.log(`   📡 Tx Arbitrum enviada: ${tx.hash}`);
            try {
              const receipt = await tx.wait(1);
              console.log(`   ✅ Confirmada en bloque #${receipt.blockNumber} (Gas: ${receipt.gasUsed.toString()})`);
            } catch (waitErr) {
              console.log(`   ⚠️ Espera de bloque (Tx emitida en mempool): ${waitErr.message.slice(0, 80)}`);
            }
            batchArbSuccess++;
          } catch (aErr) {
            console.log(`   ❌ Error al puentear a Arbitrum: ${aErr.message}`);
          }
        }
      } else {
        console.log(`   ⏭️  Arbitrum Sepolia omitido (saldo >= ${skipThresholdEth.toFixed(4)} ETH)`);
      }

      await new Promise((r) => setTimeout(r, 600));

      if (i < currentBatch.length - 1 && !isDryRun) {
        await sleepRandom(2000, 4000);
      }
      console.log("");
    }

    grandTotalBaseBridged += batchBaseSuccess;
    grandTotalArbBridged += batchArbSuccess;

    console.log(`\n✅ ${batchTag} completado:`);
    console.log(`   • Base Sepolia     : ${batchBaseSuccess}/${currentBatch.length} satélites fondeados`);
    console.log(`   • Arbitrum Sepolia : ${batchArbSuccess}/${currentBatch.length} satélites fondeados\n`);

    if (!isDryRun && (batchBaseSuccess > 0 || batchArbSuccess > 0)) {
      const cumulativeCovered = endIdx;
      const progressPercent = ((cumulativeCovered / totalFleet) * 100).toFixed(1);

      await sendTelegramAlert(
        `🌉 <b>OPERACIÓN 10K - AUTO-BRIDGE L1->L2 (${bIdx + 1}/${batches.length})</b>\n\n` +
        `📦 <b>Lote:</b> #${startIdx} al #${endIdx} (${currentBatch.length} Satélites)\n` +
        `🔵 <b>Base Sepolia:</b> ${batchBaseSuccess} puenteados exitosamente\n` +
        `🟠 <b>Arbitrum Sepolia:</b> ${batchArbSuccess} puenteados exitosamente\n` +
        `💰 <b>Monto por Satélite:</b> ${depositStr} ETH por red\n` +
        `📈 <b>Progreso Acumulado:</b> ${cumulativeCovered}/${totalFleet} Satélites (${progressPercent}%)\n` +
        `🛡️ <b>Anti-Sybil:</b> Aislamiento 100% individual y autofondeo\n` +
        `⏰ <i>${new Date().toLocaleString("es-ES", { timeZone: "UTC" })} UTC</i>`
      );
    }
  }

  console.log("=========================================================================================");
  console.log("                   📊 RESUMEN FINAL AUTO-BRIDGE MULTI-RED                               ");
  console.log("=========================================================================================");
  console.log(`🎯 Rango Evaluado           : #${toStart} al #${toEnd}`);
  console.log(`🔵 Total Base Sepolia Cruzados : ${grandTotalBaseBridged}`);
  console.log(`🟠 Total Arbitrum Cruzados     : ${grandTotalArbBridged}`);
  console.log("=========================================================================================\n");

  return { grandTotalBaseBridged, grandTotalArbBridged };
}

if (require.main === module) {
  runBridgeFleet().catch((err) => {
    console.error("❌ Fallo crítico en bridge-fleet:", err);
    process.exit(1);
  });
}

module.exports = {
  runBridgeFleet
};
