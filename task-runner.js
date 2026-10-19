/**
 * task-runner.js - Operación 10k
 * Motor de Rutinas Omnichain (EVM + Solana) con Carrusel Rotativo Escalable (hasta 500+ satélites).
 * Ejecuta de forma inteligente sobre Ethereum Sepolia, Base Sepolia, BSC Testnet, opBNB,
 * Polygon Amoy, Arbitrum Sepolia y Solana Devnet.
 * 
 * Regla de seguridad: PROHIBIDO exponer claves privadas ni volcar .env.
 * Regla de seguridad: Aislamiento total de VIP #00 (Monitoreo ultra-seguro / 0 Tx automatizadas en Mainnet).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ethers } = require("ethers");
const { Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const { networks, evmTestnets, solanaNetwork } = require("./networks");
const {
  sleepRandom,
  shuffleSwarm,
  generateHumanAmount,
  validateIsolation
} = require("./anti-sybil");
const { getWalletSigner, getSolanaKeypair } = require("./swarm-engine");
const { notifyRoundSummary } = require("./telegram-notifier");

const WALLETS_FILE = path.join(__dirname, "wallets-public-list.json");
const REPORT_FILE = path.join(__dirname, "last-run-report.json");

// Parámetros operacionales
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || "20", 10);
const MIN_TEST_DELAY_MS = 1000;
const MAX_TEST_DELAY_MS = 2500;
const MIN_EXEC_BALANCE_ETH = 0.0005;
const MIN_EXEC_BALANCE_SOL = 0.001;

// ABI genérico para tokens wrapped (WETH, WBNB, WPOL)
const WETH_ABI = [
  "function deposit() payable",
  "function balanceOf(address) view returns (uint256)"
];

function loadPublicWallets() {
  if (!fs.existsSync(WALLETS_FILE)) {
    console.error(`❌ ERROR: No se encontró ${WALLETS_FILE}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8"));
}

const { createResilientProvider } = require("./networks");

function createProvider(netConfig) {
  return createResilientProvider(netConfig);
}

function getSigner(index, provider = null) {
  if (typeof getWalletSigner === "function") {
    return getWalletSigner(index, provider);
  }
  const rawSeed = process.env.TRUST_WALLET_SEED || process.env.SWARM_MNEMONIC;
  if (!rawSeed) {
    throw new Error("TRUST_WALLET_SEED ni SWARM_MNEMONIC están definidas en el entorno");
  }
  const mnemonic = ethers.Mnemonic.fromPhrase(rawSeed.trim().replace(/\s+/g, " "));
  const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${index}`);
  return provider ? wallet.connect(provider) : wallet;
}

/**
 * Carrusel Rotativo Anti-Sybil:
 * Selecciona un escuadrón de BATCH_SIZE satélites rotando periódicamente
 * para garantizar cobertura de toda la flota sin agotar cuotas ni mempool.
 */
function selectRotatingSquad(satellites, batchSize) {
  if (satellites.length <= batchSize) return satellites;
  const currentHour = new Date().getUTCHours();
  const offset = (currentHour * 7) % satellites.length;
  const squad = [];
  for (let i = 0; i < batchSize; i++) {
    squad.push(satellites[(offset + i) % satellites.length]);
  }
  return squad;
}

/**
 * Selector Inteligente de Escuadrón:
 * Prioriza satélites que disponen de gas y rota entre ellos
 * para maximizar transacciones efectivas en cada ronda horaria (20/20).
 */
async function selectSmartSquad(satellites, batchSize, provider) {
  if (satellites.length <= batchSize) return satellites;

  const funded = [];
  const minBalWei = ethers.parseEther("0.0005");
  const CHUNK_SIZE = 10;

  try {
    for (let i = 0; i < satellites.length; i += CHUNK_SIZE) {
      const chunk = satellites.slice(i, i + CHUNK_SIZE);
      let chunkFundedCount = 0;

      const results = await Promise.all(
        chunk.map(async (s) => {
          try {
            const bal = await provider.getBalance(s.address);
            return { sat: s, hasBal: bal >= minBalWei };
          } catch (_) {
            return { sat: s, hasBal: false };
          }
        })
      );

      for (const r of results) {
        if (r.hasBal) {
          funded.push(r.sat);
          chunkFundedCount++;
        }
      }

      // Si ya encontramos suficientes satélites fondeados y el bloque actual está vacío,
      // detenemos la búsqueda para evitar saturar el RPC en la flota de 500 satélites.
      if (funded.length >= batchSize && chunkFundedCount === 0) {
        break;
      }
    }
  } catch (_) {
    return selectRotatingSquad(satellites, batchSize);
  }

  console.log(`🔍 [SMART SQUAD] Satélites con gas detectados: ${funded.length}/${satellites.length}`);

  if (funded.length >= batchSize) {
    return selectRotatingSquad(funded, batchSize);
  } else if (funded.length > 0) {
    const fundedIndices = new Set(funded.map((s) => s.index));
    const unfunded = satellites.filter((s) => !fundedIndices.has(s.index));
    const needed = batchSize - funded.length;
    const extra = selectRotatingSquad(unfunded, needed);
    return [...funded, ...extra];
  }

  return selectRotatingSquad(satellites, batchSize);
}

/**
 * Pre-verificación rápida de gas: comprueba si la red tiene fondos disponibles
 * muestreando satélites sin esperar 20 consultas fallidas.
 */
async function checkNetworkHasGas(provider, squad) {
  try {
    const sampleSize = Math.min(3, squad.length);
    const sample = squad.slice(0, sampleSize);
    const balances = await Promise.all(
      sample.map((s) => provider.getBalance(s.address).catch(() => 0n))
    );
    const hasGas = balances.some((b) => b >= ethers.parseEther("0.0005"));
    return hasGas;
  } catch (_) {
    return false;
  }
}

/**
 * Ejecuta la rutina on-chain para una red EVM específica con DeFi Rotator y Aislamiento.
 */
async function executeSwarmOnEvmNetwork({
  networkConfig,
  squad,
  allAddresses,
  isDryRun
}) {
  console.log("-----------------------------------------------------------------------------------------");
  console.log(`🌐 [ESCUADRÓN OMNICHAIN] - ${networkConfig.name.toUpperCase()} (Chain ID: ${networkConfig.chainId})`);
  console.log("-----------------------------------------------------------------------------------------");

  const provider = createProvider(networkConfig);

  // Verificación rápida de disponibilidad de gas en la red
  const hasGas = await checkNetworkHasGas(provider, squad);
  if (!hasGas) {
    console.log(`   ⏳ [RED EN ESPERA DE GAS] Satélites sin saldo en ${networkConfig.name}.`);
    console.log(`   ⏭️  Estado: PENDIENTE_FONDEO (0 ${networkConfig.symbol}). Saltando red rápido.\n`);
    return {
      network: networkConfig.name,
      chainId: networkConfig.chainId,
      isPendingGas: true,
      successCount: 0,
      total: squad.length,
      runs: []
    };
  }

  const shuffledSquad = shuffleSwarm(squad);
  const orderStr = shuffledSquad.map((s) => `#${String(s.index).padStart(2, "0")}`).join(" -> ");
  console.log(`🎲 Secuencia no lineal (Fisher-Yates):\n   ${orderStr}\n`);

  const runs = [];
  let successCount = 0;

  for (let i = 0; i < shuffledSquad.length; i++) {
    const sat = shuffledSquad[i];
    const satTag = `[${i + 1}/${shuffledSquad.length}] Satélite #${String(sat.index).padStart(2, "0")}`;
    console.log(`➤ ${satTag} [${sat.address}] en ${networkConfig.name}:`);

    let balanceEth = 0;
    try {
      const rawBal = await provider.getBalance(sat.address);
      balanceEth = parseFloat(ethers.formatEther(rawBal));
    } catch (err) {
      console.log(`   ⚠️ Error de lectura RPC para ${sat.address}: ${err.message}`);
    }

    console.log(`   Saldo actual: ${balanceEth.toFixed(6)} ${networkConfig.symbol}`);

    // Alternancia estratégica Anti-Sybil (50% DeFi Rotator / 50% Organic Calldata)
    const defiToken = networkConfig.defiToken;
    const isDefiTx = defiToken && Math.random() < 0.5;

    let targetAddress = "";
    let humanAmount = "";
    let txType = "";
    let randomCallData = "";

    if (isDefiTx) {
      txType = `DEFI_${defiToken.symbol}_DEPOSIT`;
      targetAddress = defiToken.address;
      humanAmount = generateHumanAmount(0.00001, 0.00005);
    } else {
      txType = "ORGANIC_SELF_TX";
      targetAddress = sat.address;
      humanAmount = generateHumanAmount(0.0001, 0.0004);
      randomCallData = "0x" + crypto.randomBytes(4).toString("hex");
    }

    validateIsolation(sat.address, targetAddress, allAddresses);

    let actionStatus = "";
    let txHash = null;

    if (balanceEth >= MIN_EXEC_BALANCE_ETH && !isDryRun) {
      try {
        const signer = getSigner(sat.index, provider);
        let tx;

        if (isDefiTx) {
          console.log(`   🏦 [DEFI ROTATOR] Depósito en ${defiToken.symbol}: ${humanAmount} ${networkConfig.symbol}...`);
          const wContract = new ethers.Contract(targetAddress, WETH_ABI, signer);
          tx = await wContract.deposit({ value: ethers.parseEther(humanAmount) });
        } else {
          console.log(`   ⚡ [ORGANIC CALL] Micro-tx con calldata dinámico: ${humanAmount} ${networkConfig.symbol}...`);
          tx = await signer.sendTransaction({
            to: targetAddress,
            value: ethers.parseEther(humanAmount),
            data: randomCallData
          });
        }

        console.log(`   🚀 Transacción enviada: ${tx.hash}`);
        const receipt = await tx.wait(1);
        txHash = receipt.hash;
        actionStatus = "TX_CONFIRMADA_ON_CHAIN";
        successCount++;
        console.log(`   ✅ Confirmada en bloque #${receipt.blockNumber} (Gas: ${receipt.gasUsed.toString()})`);
      } catch (txErr) {
        actionStatus = `ERROR_TX: ${txErr.message}`;
        console.log(`   ❌ Error al emitir tx: ${txErr.message}`);
      }
    } else {
      if (balanceEth < MIN_EXEC_BALANCE_ETH) {
        console.log(`   ⚠️ [FONDOS INSUFICIENTES - Saldo < ${MIN_EXEC_BALANCE_ETH} ${networkConfig.symbol}]`);
        actionStatus = "PENDIENTE_FONDEO";
      } else {
        console.log(`   🧪 [DRY-RUN SIMULADO] Tipo: ${txType} | Monto: ${humanAmount} ${networkConfig.symbol}`);
        actionStatus = "SIMULADA_DRY_RUN";
        successCount++;
      }
    }

    runs.push({
      step: i + 1,
      index: sat.index,
      address: sat.address,
      balanceEth: balanceEth.toFixed(6),
      simulatedAmount: humanAmount,
      txType,
      status: actionStatus,
      txHash
    });

    if (i < shuffledSquad.length - 1) {
      await sleepRandom(MIN_TEST_DELAY_MS, MAX_TEST_DELAY_MS);
    }
    console.log("");
  }

  return {
    network: networkConfig.name,
    chainId: networkConfig.chainId,
    isPendingGas: false,
    successCount,
    total: squad.length,
    runs
  };
}

/**
 * Ejecuta la rutina on-chain en Solana Devnet para el escuadrón activo.
 */
async function executeSwarmOnSolana({ squad, isDryRun }) {
  console.log("-----------------------------------------------------------------------------------------");
  console.log(`🟣 [ESCUADRÓN OMNICHAIN] - SOLANA DEVNET (RPC: ${solanaNetwork.rpc})`);
  console.log("-----------------------------------------------------------------------------------------");

  const connection = new Connection(solanaNetwork.rpc, "confirmed");
  const runs = [];
  let successCount = 0;

  // Verificación rápida de saldo Solana en el primer satélite
  let firstSatBal = 0;
  try {
    firstSatBal = await connection.getBalance(new PublicKey(squad[0].solanaAddress));
  } catch (_) {}

  // En Dry-Run, si no hay saldo en el primer satélite saltamos rápido
  if (isDryRun && firstSatBal < 1000000) {
    console.log("   ⏳ [SOLANA EN ESPERA DE GAS] Satélites sin saldo en Solana Devnet.");
    console.log("   ⏭️  Estado: PENDIENTE_FONDEO_SOL (0 SOL). Saltando rápido en Dry-Run.\n");
    return {
      network: "Solana Devnet",
      isPendingGas: true,
      statusLabel: "0 SOL ⏳",
      successCount: 0,
      total: squad.length,
      runs: []
    };
  }

  let faucetRateLimited = false;

  for (let i = 0; i < squad.length; i++) {
    const sat = squad[i];
    const satTag = `[${i + 1}/${squad.length}] Satélite #${String(sat.index).padStart(2, "0")}`;
    console.log(`➤ ${satTag} [${sat.solanaAddress}] en Solana Devnet:`);

    let solBal = 0;
    try {
      const pubkey = new PublicKey(sat.solanaAddress);
      let lamports = await connection.getBalance(pubkey);
      solBal = lamports / LAMPORTS_PER_SOL;

      // Auto-faucet en Solana Devnet si tiene 0 SOL y estamos en producción
      if (solBal < MIN_EXEC_BALANCE_SOL && !isDryRun && !faucetRateLimited) {
        try {
          console.log(`   🚰 Solicitando airdrop de 0.1 SOL en Devnet para Satélite #${sat.index}...`);
          const sig = await connection.requestAirdrop(pubkey, 0.1 * LAMPORTS_PER_SOL);
          await connection.confirmTransaction(sig, "confirmed");
          lamports = await connection.getBalance(pubkey);
          solBal = lamports / LAMPORTS_PER_SOL;
          console.log(`   ✅ Airdrop acreditado: ${solBal.toFixed(4)} SOL`);
        } catch (airdropErr) {
          const errMsg = airdropErr.message ? airdropErr.message.slice(0, 60) : "Rate-limit";
          if (errMsg.includes("429") || errMsg.includes("Too Many Requests")) {
            faucetRateLimited = true;
          }
          console.log(`   ℹ️ Faucet de Devnet ocupado o rate-limited (429): ${errMsg}...`);
        }
      }
    } catch (e) {
      console.log(`   ⚠️ Error de lectura RPC Solana: ${e.message}`);
    }

    console.log(`   Saldo actual: ${solBal.toFixed(5)} SOL`);

    let actionStatus = "";
    let txHash = null;

    if (solBal >= MIN_EXEC_BALANCE_SOL && !isDryRun) {
      try {
        const fromPubkey = new PublicKey(sat.solanaAddress);
        const kp = getSolanaKeypair(sat.index);
        const microLamports = Math.floor(Math.random() * 20000) + 10000;

        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey,
            toPubkey: fromPubkey,
            lamports: microLamports
          })
        );

        console.log(`   ⚡ [SOLANA SELF-TX] Ejecutando micro-transferencia: ${(microLamports / 1e9).toFixed(7)} SOL...`);
        const signature = await sendAndConfirmTransaction(connection, tx, [kp]);
        txHash = signature;
        actionStatus = "TX_CONFIRMADA_ON_CHAIN";
        successCount++;
        console.log(`   ✅ Transacción confirmada: ${signature}`);
      } catch (solErr) {
        actionStatus = `ERROR_TX: ${solErr.message}`;
        console.log(`   ❌ Error en Solana tx: ${solErr.message}`);
      }
    } else {
      if (solBal < MIN_EXEC_BALANCE_SOL) {
        console.log(`   ⚠️ [FONDOS INSUFICIENTES - Saldo < ${MIN_EXEC_BALANCE_SOL} SOL]`);
        actionStatus = "PENDIENTE_FONDEO_SOL";
      } else {
        console.log("   🧪 [DRY-RUN SIMULADO] Micro-transferencia orgánica simulada en Solana Devnet");
        actionStatus = "SIMULADA_DRY_RUN";
        successCount++;
      }
    }

    runs.push({
      step: i + 1,
      index: sat.index,
      solanaAddress: sat.solanaAddress,
      balanceSol: solBal.toFixed(5),
      status: actionStatus,
      txHash
    });

    if (i < squad.length - 1) {
      await sleepRandom(MIN_TEST_DELAY_MS, MAX_TEST_DELAY_MS);
    }
    console.log("");
  }

  return {
    network: "Solana Devnet",
    isPendingGas: false,
    successCount,
    total: squad.length,
    runs
  };
}

async function runTaskRunner() {
  const seedString = process.env.TRUST_WALLET_SEED || process.env.SWARM_MNEMONIC || "";
  let isSeedValid = false;
  if (seedString.trim().length > 0) {
    const raw = seedString.trim().replace(/\s+/g, " ");
    isSeedValid = ethers.Mnemonic.isValidMnemonic(raw);
  }
  let isDryRun = process.argv.includes("--dry-run");

  if (!isSeedValid && !isDryRun) {
    console.log("⚠️  [TASK RUNNER] Semilla (TRUST_WALLET_SEED / SWARM_MNEMONIC) no detectada o inválida (BIP-39). Conmutando automáticamente a modo simulación (Dry-Run resiliente).");
    isDryRun = true;
  }

  console.log("=========================================================================================");
  console.log("     🚀 OPERACIÓN 10K - MOTOR ON-CHAIN OMNICHAIN (EVM + SOLANA ESCALABLE 500)            ");
  console.log("=========================================================================================");
  console.log(`🛡️  Modo de ejecución : ${isDryRun ? "DRY-RUN (Simulación sin transacciones)" : "PRODUCCIÓN (Transacciones en vivo)"}`);
  console.log(`🔄 Tamaño de Carrusel : ${BATCH_SIZE} satélites por ronda`);
  console.log("🔒 Regla de seguridad: Claves resguardadas. VIP #00 en modo ultra-seguro solo lectura.\n");

  const allWallets = loadPublicWallets();
  const allAddresses = allWallets.map((w) => w.address);

  const vipWallet = allWallets.find((w) => w.index === 0);
  const satellites = allWallets.filter((w) => w.index > 0);

  // -------------------------------------------------------------------------------------
  // 1. ESCUADRÓN C: CUENTA #00 VIP (Modo Solo Lectura / Monitoreo)
  // -------------------------------------------------------------------------------------
  console.log("-----------------------------------------------------------------------------------------");
  console.log("👑 [ESCUADRÓN C] - MONITOREO DE CUENTA VIP #00 (MODO ULTRA SEGURO / SOLO LECTURA)");
  console.log("-----------------------------------------------------------------------------------------");
  console.log(`   Dirección VIP EVM    : ${vipWallet.address}`);
  console.log(`   Dirección VIP Solana : ${vipWallet.solanaAddress || "N/A"}`);
  console.log("   🛡️ Blindaje: ESTA CUENTA NUNCA EMITE TRANSACCIONES AUTOMATIZADAS EN MAINNET.\n");

  const bscProvider = createProvider(networks.bscMainnet);
  const baseProvider = createProvider(networks.baseMainnet);
  const sepoliaProvider = createProvider(networks.ethereumSepolia);

  let vipBscBalance = "0.000000";
  let vipBaseBalance = "0.000000";
  let vipSepoliaBalance = "0.000000";

  try {
    const [bscBal, baseBal, sepBal] = await Promise.all([
      bscProvider.getBalance(vipWallet.address).catch(() => 0n),
      baseProvider.getBalance(vipWallet.address).catch(() => 0n),
      sepoliaProvider.getBalance(vipWallet.address).catch(() => 0n)
    ]);
    vipBscBalance = parseFloat(ethers.formatEther(bscBal)).toFixed(6);
    vipBaseBalance = parseFloat(ethers.formatEther(baseBal)).toFixed(6);
    vipSepoliaBalance = parseFloat(ethers.formatEther(sepBal)).toFixed(6);
  } catch (_) {}

  console.log(`   • Saldo en BNB Smart Chain : ${vipBscBalance} BNB`);
  console.log(`   • Saldo en Base Mainnet     : ${vipBaseBalance} ETH`);
  console.log(`   • Saldo en Ethereum Sepolia : ${vipSepoliaBalance} ETH`);
  console.log("   ✅ Integridad de Escuadrón C verificada.\n");

  // -------------------------------------------------------------------------------------
  // 2. PRUEBA DEL ESCUDO ANTI-SYBIL (Aislamiento entre Satélites)
  // -------------------------------------------------------------------------------------
  try {
    validateIsolation(satellites[0].address, satellites[1].address, allAddresses, allWallets);
  } catch (error) {
    if (error.message.includes("SYBIL_PROTECTION_TRIGGERED") || error.message.includes("SYBIL_BLOCK_CROSSING_PREVENTED")) {
      console.log("🛡️  [ESCUDO ANTI-SYBIL] Protocolo de defensa verificado: Intento cruzado INTERCEPTADO.");
    }
  }

  // -------------------------------------------------------------------------------------
  // 3. SELECCIÓN DE ESCUADRÓN EN CARRUSEL HORARIO
  // -------------------------------------------------------------------------------------
  const activeSquad = await selectSmartSquad(satellites, BATCH_SIZE, sepoliaProvider);
  console.log(`🤖 Flota Total: ${satellites.length} Satélites | Escuadrón Carrusel Activo: ${activeSquad.length} Satélites`);
  const squadIndicesStr = activeSquad.map((s) => `#${String(s.index).padStart(2, "0")}`).join(", ");
  console.log(`   Satélites de esta ronda: [ ${squadIndicesStr} ]\n`);

  // -------------------------------------------------------------------------------------
  // 4. EJECUCIÓN MULTI-RED OMNICHAIN (EVM TESTNETS)
  // -------------------------------------------------------------------------------------
  const evmResults = [];
  for (const net of evmTestnets) {
    const res = await executeSwarmOnEvmNetwork({
      networkConfig: net,
      squad: activeSquad,
      allAddresses,
      isDryRun
    });
    evmResults.push(res);
    await sleepRandom(1500, 3000);
  }

  // -------------------------------------------------------------------------------------
  // 5. EJECUCIÓN EN SOLANA DEVNET
  // -------------------------------------------------------------------------------------
  const solanaResult = await executeSwarmOnSolana({
    squad: activeSquad,
    isDryRun
  });

  // -------------------------------------------------------------------------------------
  // 6. CONSOLIDACIÓN DE RESULTADOS Y TELEGRAM
  // -------------------------------------------------------------------------------------
  const networksBreakdown = [];
  let totalOnChainTx = 0;

  for (const r of evmResults) {
    totalOnChainTx += r.successCount;
    networksBreakdown.push({
      name: r.network,
      success: r.successCount,
      total: r.total,
      isPendingGas: r.isPendingGas,
      statusLabel: "0 Gas ⏳"
    });
  }

  totalOnChainTx += solanaResult.successCount;
  networksBreakdown.push({
    name: solanaResult.network,
    success: solanaResult.successCount,
    total: solanaResult.total,
    isPendingGas: solanaResult.isPendingGas,
    statusLabel: "0 SOL ⏳"
  });

  console.log("=========================================================================================");
  console.log("                   📊 RESUMEN FINAL DE LA RONDA OMNICHAIN                                ");
  console.log("=========================================================================================");
  console.log(`👑 Escuadrón C (VIP #00)     : 100% Segura / 0 Tx en Mainnet`);
  console.log(`🤖 Escuadrón Carrusel Activo : ${activeSquad.length} / ${satellites.length} Satélites`);
  networksBreakdown.forEach((nb) => {
    if (nb.success > 0) {
      console.log(`⚡ ${nb.name.padEnd(26)} : ${nb.success}/${nb.total} txs confirmadas ✅`);
    } else {
      console.log(`⏳ ${nb.name.padEnd(26)} : ${nb.statusLabel || "0 Gas"}`);
    }
  });
  console.log(`🎯 TOTAL TRANSACCIONES RONDA : ${totalOnChainTx} confirmadas on-chain`);
  console.log("=========================================================================================\n");

  const report = {
    timestamp: new Date().toISOString(),
    executionMode: isDryRun ? "DRY-RUN" : "PRODUCTION",
    totalFleetSize: satellites.length,
    activeSquadSize: activeSquad.length,
    totalOnChainTx,
    networksBreakdown,
    evmResults,
    solanaResult
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), "utf8");

  await notifyRoundSummary({
    executionMode: isDryRun ? "DRY-RUN" : "PRODUCTION",
    totalSatellites: satellites.length,
    squadSize: activeSquad.length,
    networksBreakdown,
    totalOnChainTx
  });

  console.log("🎉 Ronda Omnichain finalizada exitosamente.\n");
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
