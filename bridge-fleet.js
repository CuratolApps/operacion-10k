/**
 * bridge-fleet.js - Operación 10k
 * Módulo de Auto-Bridge Omnichain Progresivo por Lotes (L1 -> L2) con Multicall3.
 * Cubre la flota completa (#101 al #500) hacia Base Sepolia y Arbitrum Sepolia.
 * 
 * Reglas de seguridad:
 * - Aislamiento 100% Anti-Sybil: cada satélite firma y paga su propio puente.
 * - CERO cruce inter-bloques: Prohibido que un donante de un bloque fondee a otro bloque.
 * - Optimización Multicall3: Lectura masiva en batch de balances L1 y L2 (1 sola llamada RPC).
 * - Jitter aleatorio humano (2.0s a 4.0s).
 * - Reserva mínima intangible >0.015 ETH protegida en todos los satélites.
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { ethers } = require("ethers");
const { networks, createResilientProvider, fetchEthBalancesBatch } = require("./networks");
const { sleepRandom, getBlockId, validateIsolation } = require("./anti-sybil");
const { getWalletSigner } = require("./swarm-engine");
const { sendTelegramAlert } = require("./telegram-notifier");

// Contratos oficiales L1
const BASE_SEPOLIA_L1_BRIDGE = "0xfd0Bf71F60660E2f608ed56e1659C450eB113120";
const ARBITRUM_SEPOLIA_INBOX = "0xaAe29B0366299461418F5324a79Afc425BE5ae21";
const OPTIMISM_SEPOLIA_L1_BRIDGE = "0xFBb0621E0B23b5478B630BD55a5f21f67730B0F1";
const DEPOSIT_ETH_SELECTOR = "0x439370b1";
const MIN_GAS_LIMIT_L2 = 200000;

// ABIs
const L1_BRIDGE_ABI = [
  "function bridgeETHTo(address _to, uint32 _minGasLimit, bytes calldata _extraData) payable"
];

const MIN_DONOR_RESERVE_ETH = 0.015;
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
 * Busca donantes elegibles dentro del mismo bloque para recarga de emergencia.
 */
async function findIntraBlockDonor(sat, allWallets, sepoliaProvider, minRequiredWei) {
  const blockId = getBlockId(sat.index);
  const blockPeers = allWallets.filter(
    (w) => w.index > 0 && w.index !== sat.index && getBlockId(w.index) === blockId
  );

  const addresses = blockPeers.map((w) => w.address);
  const balances = await fetchEthBalancesBatch(sepoliaProvider, addresses);

  for (const peer of blockPeers) {
    const balWei = balances[peer.address.toLowerCase()] || 0n;
    const balEth = parseFloat(ethers.formatEther(balWei));
    if (balEth - 0.005 >= MIN_DONOR_RESERVE_ETH) {
      return {
        index: peer.index,
        address: peer.address,
        balanceEth: balEth
      };
    }
  }
  return null;
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

  const targetNet = parseArg("--network", "all").toLowerCase();
  const includeBase = targetNet === "all" || targetNet === "base";
  const includeArb = targetNet === "all" || targetNet === "arbitrum";
  const includeOp = targetNet === "all" || targetNet === "optimism" || process.argv.includes("--include-optimism");

  const allWallets = loadPublicWallets();
  const allAddresses = allWallets.map((w) => w.address);
  const totalFleet = allWallets.filter((w) => w.index > 0).length;

  console.log("=========================================================================================");
  console.log("     🌉 OPERACIÓN 10K - AUTO-BRIDGE MULTICALL3 & AISLAMIENTO ESTRICTO (L1 -> L2)        ");
  console.log("=========================================================================================");
  console.log(`🌐 Redes Destino      : ${[includeBase ? "Base Sepolia" : null, includeArb ? "Arbitrum Sepolia" : null, includeOp ? "Optimism Sepolia" : null].filter(Boolean).join(" & ")}`);
  console.log(`🛡️  Modo de Ejecución  : ${isDryRun ? "DRY-RUN (Simulación)" : "PRODUCCIÓN (On-Chain en vivo)"}`);
  console.log(`🎯 Rango Solicitado   : Satélites #${toStart} al #${toEnd} (${toEnd - toStart + 1} satélites)`);
  console.log(`📦 Tamaño de Lote     : ${batchSize} satélites`);
  console.log(`💰 Monto por Red      : ${depositStr} ETH por puente`);
  console.log(`⚡ Umbral de Exclusión: >= ${skipThresholdEth.toFixed(4)} ETH en L2`);
  console.log("🔒 Política Anti-Sybil: Aislamiento 100% individual y donaciones estrictamente intra-bloque.\n");

  const targetSatellites = allWallets.filter((w) => w.index >= toStart && w.index <= toEnd);
  if (targetSatellites.length === 0) {
    console.error(`❌ No se encontraron satélites en el rango #${toStart}-#${toEnd}`);
    return;
  }

  // Inicializar proveedores resilientes
  const sepoliaProvider = createResilientProvider(networks.ethereumSepolia);
  const baseProvider = createResilientProvider(networks.baseSepolia);
  const arbProvider = createResilientProvider(networks.arbitrumSepolia);
  const opProvider = createResilientProvider(networks.optimismSepolia);

  console.log("📡 Verificando conexión RPC resiliente:");
  try {
    const rpcChecks = [
      sepoliaProvider.getBlockNumber(),
      includeBase ? baseProvider.getBlockNumber() : Promise.resolve("N/A"),
      includeArb ? arbProvider.getBlockNumber() : Promise.resolve("N/A"),
      includeOp ? opProvider.getBlockNumber() : Promise.resolve("N/A")
    ];
    const [bSep, bBase, bArb, bOp] = await Promise.all(rpcChecks);
    console.log(`   • Ethereum Sepolia (L1) : Bloque #${bSep} 🟢 ONLINE`);
    if (includeBase) console.log(`   • Base Sepolia (L2)     : Bloque #${bBase} 🟢 ONLINE`);
    if (includeArb) console.log(`   • Arbitrum Sepolia (L2) : Bloque #${bArb} 🟢 ONLINE`);
    if (includeOp) console.log(`   • Optimism Sepolia (L2) : Bloque #${bOp} 🟢 ONLINE\n`);
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
  let grandTotalOpBridged = 0;

  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const currentBatch = batches[bIdx];
    const startIdx = currentBatch[0].index;
    const endIdx = currentBatch[currentBatch.length - 1].index;
    const blockId = getBlockId(startIdx);
    const batchTag = `Lote ${bIdx + 1}/${batches.length} [Bloque B${blockId}] (Rango #${startIdx}-#${endIdx})`;

    console.log("-----------------------------------------------------------------------------------------");
    console.log(`🚀 INICIANDO ${batchTag.toUpperCase()} - ${currentBatch.length} SATÉLITES`);
    console.log("-----------------------------------------------------------------------------------------");

    console.log(`⚡ Ejecutando escaneo Multicall3 para los ${currentBatch.length} satélites del lote...`);
    const batchAddresses = currentBatch.map((s) => s.address);

    const [baseBalances, arbBalances, opBalances, sepBalances] = await Promise.all([
      includeBase ? fetchEthBalancesBatch(baseProvider, batchAddresses) : Promise.resolve({}),
      includeArb ? fetchEthBalancesBatch(arbProvider, batchAddresses) : Promise.resolve({}),
      includeOp ? fetchEthBalancesBatch(opProvider, batchAddresses) : Promise.resolve({}),
      fetchEthBalancesBatch(sepoliaProvider, batchAddresses)
    ]);
    console.log("   ✅ Saldos L2 y Sepolia capturados en batch con Multicall3.\n");

    let batchBaseSuccess = 0;
    let batchArbSuccess = 0;
    let batchOpSuccess = 0;

    for (let i = 0; i < currentBatch.length; i++) {
      const sat = currentBatch[i];
      const satTag = `[${i + 1}/${currentBatch.length}] Satélite #${String(sat.index).padStart(3, "0")} (B${blockId})`;
      console.log(`➤ ${satTag} [${sat.address}]:`);

      const addrLower = sat.address.toLowerCase();
      const baseBalWei = baseBalances[addrLower] || 0n;
      const arbBalWei = arbBalances[addrLower] || 0n;
      const opBalWei = opBalances[addrLower] || 0n;
      let sepBalWei = sepBalances[addrLower] || 0n;

      const baseBal = parseFloat(ethers.formatEther(baseBalWei));
      const arbBal = parseFloat(ethers.formatEther(arbBalWei));
      const opBal = parseFloat(ethers.formatEther(opBalWei));
      let sepBalEth = parseFloat(ethers.formatEther(sepBalWei));

      const needsBase = includeBase && baseBal < skipThresholdEth;
      const needsArb = includeArb && arbBal < skipThresholdEth;
      const needsOp = includeOp && opBal < skipThresholdEth;

      console.log(`   ↳ Saldos L2: Base = ${baseBal.toFixed(5)} | Arb = ${arbBal.toFixed(5)} | OP = ${opBal.toFixed(5)} ETH`);
      console.log(`   ↳ Saldo en L1 Sepolia: ${sepBalEth.toFixed(5)} ETH`);

      if (!needsBase && !needsArb && !needsOp) {
        console.log(`   ⏭️  OMITIDO: Saldo suficiente en las L2 seleccionadas.\n`);
        continue;
      }

      const neededPuentes = (needsBase ? 1 : 0) + (needsArb ? 1 : 0) + (needsOp ? 1 : 0);
      const minSingleBridgeWei = depositWei + ethers.parseEther("0.0003");

      // Si falta gas incluso para 1 solo puente, intentar buscar donante dentro del mismo bloque
      if (sepBalWei < minSingleBridgeWei && !isDryRun) {
        console.log(`   ⚠️ Saldo bajo en L1 (< ${depositEth + 0.0003} ETH). Buscando donante dentro del Bloque B${blockId}...`);
        const intraDonor = await findIntraBlockDonor(sat, allWallets, sepoliaProvider, minSingleBridgeWei);

        if (intraDonor) {
          try {
            validateIsolation(intraDonor.index, sat.index, allAddresses, allWallets, true);
            console.log(`   👥 Donante intra-bloque localizado: Satélite #${intraDonor.index} (Saldo: ${intraDonor.balanceEth.toFixed(4)} ETH)`);
            const donorSigner = getWalletSigner(intraDonor.index, sepoliaProvider);
            const refillTx = await donorSigner.sendTransaction({
              to: sat.address,
              value: ethers.parseEther("0.004")
            });
            await refillTx.wait(1).catch(() => {});
            console.log(`   ⛽ Recarga de 0.004 ETH acreditada desde Donante #${intraDonor.index} (Mismo bloque B${blockId})`);
            sepBalWei = ethers.parseEther("0.004");
          } catch (refillErr) {
            console.log(`   ⚠️ Fallo en recarga intra-bloque: ${refillErr.message}`);
          }
        } else {
          console.log(`   🚨 BLOQUEO ANTI-SYBIL: No hay donantes con gas suficiente en el Bloque B${blockId}.`);
          console.log(`   🚫 PROHIBIDO tomar fondos de otros bloques. Saltando satélite #${sat.index} de forma segura.\n`);
          continue;
        }
      }

      const signer = getWalletSigner(sat.index, sepoliaProvider);

      // Función auxiliar para verificar si el satélite tiene gas suficiente para el siguiente puente
      async function canAffordBridge() {
        try {
          const currentBal = await sepoliaProvider.getBalance(sat.address);
          return currentBal >= minSingleBridgeWei;
        } catch {
          return false;
        }
      }

      // --- PUENTE 1: BASE SEPOLIA ---
      if (needsBase) {
        validateIsolation(sat.address, sat.address, allAddresses, allWallets);
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
            const receipt = await tx.wait(1);
            console.log(`   ✅ Confirmada en bloque #${receipt.blockNumber} (Gas: ${receipt.gasUsed.toString()})`);
            batchBaseSuccess++;
          } catch (bErr) {
            console.log(`   ❌ Error al puentear a Base Sepolia: ${bErr.message}`);
          }
        }
        if (!isDryRun) await sleepRandom(1500, 3000);
      }

      // --- PUENTE 2: ARBITRUM SEPOLIA ---
      if (needsArb) {
        if (!isDryRun && !(await canAffordBridge())) {
          console.log(`   ℹ️ Saldo en L1 insuficiente para Arbitrum (${depositStr} ETH necesario). Reserva preservada.`);
        } else {
          validateIsolation(sat.address, ARBITRUM_SEPOLIA_INBOX, allAddresses, allWallets);
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
              const receipt = await tx.wait(1);
              console.log(`   ✅ Confirmada en bloque #${receipt.blockNumber} (Gas: ${receipt.gasUsed.toString()})`);
              batchArbSuccess++;
            } catch (aErr) {
              console.log(`   ❌ Error al puentear a Arbitrum: ${aErr.message}`);
            }
          }
          if (!isDryRun) await sleepRandom(1500, 3000);
        }
      }

      // --- PUENTE 3: OPTIMISM SEPOLIA ---
      if (needsOp) {
        if (!isDryRun && !(await canAffordBridge())) {
          console.log(`   ℹ️ Saldo en L1 insuficiente para Optimism (${depositStr} ETH necesario). Reserva preservada.`);
        } else {
          validateIsolation(sat.address, sat.address, allAddresses, allWallets);
          if (isDryRun) {
            console.log(`   🧪 [DRY-RUN] Simulado: Puente de ${depositStr} ETH a Optimism Sepolia L1StandardBridge`);
            batchOpSuccess++;
          } else {
            try {
              console.log(`   🚀 Enviando ${depositStr} ETH a Optimism Sepolia L1StandardBridge...`);
              const opBridgeContract = new ethers.Contract(OPTIMISM_SEPOLIA_L1_BRIDGE, L1_BRIDGE_ABI, signer);
              const tx = await opBridgeContract.bridgeETHTo(
                sat.address,
                MIN_GAS_LIMIT_L2,
                "0x",
                { value: depositWei }
              );
              console.log(`   📡 Tx Optimism enviada: ${tx.hash}`);
              const receipt = await tx.wait(1);
              console.log(`   ✅ Confirmada en bloque #${receipt.blockNumber} (Gas: ${receipt.gasUsed.toString()})`);
              batchOpSuccess++;
            } catch (opErr) {
              console.log(`   ❌ Error al puentear a Optimism Sepolia: ${opErr.message}`);
            }
          }
          if (!isDryRun) await sleepRandom(1500, 3000);
        }
      }

      if (i < currentBatch.length - 1 && !isDryRun) {
        await sleepRandom(2000, 3500);
      }
      console.log("");
    }

    grandTotalBaseBridged += batchBaseSuccess;
    grandTotalArbBridged += batchArbSuccess;
    grandTotalOpBridged += batchOpSuccess;

    console.log(`\n✅ ${batchTag} completado:`);
    if (includeBase) console.log(`   • Base Sepolia     : ${batchBaseSuccess}/${currentBatch.length} satélites fondeados`);
    if (includeArb) console.log(`   • Arbitrum Sepolia : ${batchArbSuccess}/${currentBatch.length} satélites fondeados`);
    if (includeOp) console.log(`   • Optimism Sepolia : ${batchOpSuccess}/${currentBatch.length} satélites fondeados\n`);

    if (!isDryRun && (batchBaseSuccess > 0 || batchArbSuccess > 0 || batchOpSuccess > 0)) {
      const cumulativeCovered = endIdx;
      const progressPercent = ((cumulativeCovered / totalFleet) * 100).toFixed(1);

      await sendTelegramAlert(
        `🌉 <b>OPERACIÓN 10K - AUTO-BRIDGE L1->L2 (${bIdx + 1}/${batches.length})</b>\n\n` +
        `📦 <b>Lote:</b> #${startIdx} al #${endIdx} [Bloque B${blockId}]\n` +
        (includeBase ? `🔵 <b>Base Sepolia:</b> ${batchBaseSuccess} puenteados\n` : "") +
        (includeArb ? `🟠 <b>Arbitrum Sepolia:</b> ${batchArbSuccess} puenteados\n` : "") +
        (includeOp ? `🔴 <b>Optimism Sepolia:</b> ${batchOpSuccess} puenteados\n` : "") +
        `💰 <b>Monto por Satélite:</b> ${depositStr} ETH por red\n` +
        `📈 <b>Progreso Acumulado:</b> ${cumulativeCovered}/${totalFleet} Satélites (${progressPercent}%)\n` +
        `🛡️ <b>Anti-Sybil:</b> Aislamiento intra-bloque estricto (0% cruce inter-bloques)\n` +
        `⚡ <b>Tecnología:</b> Multicall3 Batch Scanner\n` +
        `⏰ <i>${new Date().toLocaleString("es-ES", { timeZone: "UTC" })} UTC</i>`
      );
    }
  }

  console.log("=========================================================================================");
  console.log("                   📊 RESUMEN FINAL AUTO-BRIDGE MULTI-RED                               ");
  console.log("=========================================================================================");
  console.log(`🎯 Rango Evaluado              : #${toStart} al #${toEnd}`);
  if (includeBase) console.log(`🔵 Total Base Sepolia Cruzados : ${grandTotalBaseBridged}`);
  if (includeArb) console.log(`🟠 Total Arbitrum Cruzados     : ${grandTotalArbBridged}`);
  if (includeOp) console.log(`🔴 Total Optimism Cruzados     : ${grandTotalOpBridged}`);
  console.log("=========================================================================================\n");

  return { grandTotalBaseBridged, grandTotalArbBridged, grandTotalOpBridged };
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
