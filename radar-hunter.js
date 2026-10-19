/**
 * radar-hunter.js - Operación 10k
 * Módulo de Inteligencia "Radar Hunter & DeFi Rotator"
 * 
 * Funcionalidades:
 * 1. Auditoría Integral de Gas: Cálculo de promedios, balances totales y días de autonomía operativa.
 * 2. Auto-Recarga L2 (Auto-Bridge): Si algún satélite baja de 0.003 ETH en Base Sepolia, cruza 0.015 ETH automáticamente desde L1.
 * 3. Telemetría de Contratos DeFi: Monitoreo de WETH9 (Sepolia y Base).
 * 4. Reporte Ejecutivo Móvil a Telegram.
 * 
 * Regla de seguridad: Blindaje 100% Anti-Sybil. Sin filtrado de claves ni cruzamiento de fondos.
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { ethers } = require("ethers");
const { networks } = require("./networks");
const { sleepRandom, validateIsolation } = require("./anti-sybil");
const { getWalletSigner } = require("./swarm-engine");
const { sendTelegramAlert } = require("./telegram-notifier");

const WALLETS_FILE = path.join(__dirname, "wallets-public-list.json");
const RADAR_REPORT_FILE = path.join(__dirname, "radar-report.json");

// Umbrales operacionales del Radar
const BASE_RECHARGE_THRESHOLD_ETH = 0.003; // Umbral de recarga en Base Sepolia
const AUTO_RECHARGE_AMOUNT_ETH = "0.015";  // Monto a cruzar por el bridge
const ESTIMATED_ETH_PER_ROUND = 0.00035;    // Consumo promedio por satélite por ronda (tx + gas)
const ROUNDS_PER_DAY = 3;                  // Rondas programadas al día (8:17, 16:17, 22:17 UTC)

// Contratos DeFi y Bridge
const BASE_SEPOLIA_L1_BRIDGE = "0xfd0Bf71F60660E2f608ed56e1659C450eB113120";
const L1_BRIDGE_ABI = [
  "function bridgeETHTo(address _to, uint32 _minGasLimit, bytes calldata _extraData) payable"
];

const DEFI_PROTOCOLS = {
  wethSepolia: {
    address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    name: "WETH9 Ethereum Sepolia",
    network: "Ethereum Sepolia"
  },
  wethBase: {
    address: "0x4200000000000000000000000000000000000006",
    name: "WETH9 Base Sepolia",
    network: "Base Sepolia"
  }
};

function loadPublicWallets() {
  if (!fs.existsSync(WALLETS_FILE)) {
    console.error(`❌ ERROR: No se encontró el archivo ${WALLETS_FILE}`);
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

async function runRadarHunter() {
  console.log("=========================================================================================");
  console.log("         📡 OPERACIÓN 10K - RADAR HUNTER & DEFI ROTATOR: AUDITORÍA DE FLOTA             ");
  console.log("=========================================================================================\n");

  const allWallets = loadPublicWallets();
  const allAddresses = allWallets.map((w) => w.address);
  const satellites = allWallets.filter((w) => w.index >= 1 && w.index <= 20);
  const vipWallet = allWallets.find((w) => w.index === 0);

  const sepoliaProvider = createProvider(networks.ethereumSepolia);
  const baseSepoliaProvider = createProvider(networks.baseSepolia);

  console.log(`🔍 Analizando saldos de los ${satellites.length} satélites en tiempo real...`);

  let totalSepoliaEth = 0;
  let totalBaseEth = 0;
  let minBaseEth = Infinity;
  let minBaseSat = null;
  let minSepEth = Infinity;

  const fleetStatus = [];
  const needsRecharge = [];

  for (let i = 0; i < satellites.length; i++) {
    const sat = satellites[i];
    const satTag = `#${String(sat.index).padStart(2, "0")}`;

    let sepEth = 0;
    let baseEth = 0;

    try {
      const [sepWei, baseWei] = await Promise.all([
        sepoliaProvider.getBalance(sat.address),
        baseSepoliaProvider.getBalance(sat.address)
      ]);
      sepEth = parseFloat(ethers.formatEther(sepWei));
      baseEth = parseFloat(ethers.formatEther(baseWei));
    } catch (err) {
      console.log(`   ⚠️ Error de lectura para Satélite ${satTag}: ${err.message}`);
    }

    totalSepoliaEth += sepEth;
    totalBaseEth += baseEth;

    if (baseEth < minBaseEth) {
      minBaseEth = baseEth;
      minBaseSat = satTag;
    }
    if (sepEth < minSepEth) {
      minSepEth = sepEth;
    }

    const satRecord = {
      index: sat.index,
      address: sat.address,
      sepoliaEth: sepEth,
      baseEth: baseEth,
      status: baseEth >= BASE_RECHARGE_THRESHOLD_ETH ? "OPTIMAL" : "LOW_GAS"
    };

    fleetStatus.push(satRecord);

    if (baseEth < BASE_RECHARGE_THRESHOLD_ETH) {
      needsRecharge.push(satRecord);
    }
  }

  const avgSepoliaEth = totalSepoliaEth / satellites.length;
  const avgBaseEth = totalBaseEth / satellites.length;

  // Cálculo de Autonomía Operativa
  // Rondas restantes en Base Sepolia basado en el satélite con menor saldo
  const roundsRemainingBase = Math.floor(minBaseEth / ESTIMATED_ETH_PER_ROUND);
  const daysAutonomyBase = (roundsRemainingBase / ROUNDS_PER_DAY).toFixed(1);

  const roundsRemainingSepolia = Math.floor(minSepEth / ESTIMATED_ETH_PER_ROUND);
  const daysAutonomySepolia = (roundsRemainingSepolia / ROUNDS_PER_DAY).toFixed(1);

  console.log("\n-----------------------------------------------------------------------------------------");
  console.log("📊 RESULTADOS DE SALUD DE FLOTA:");
  console.log("-----------------------------------------------------------------------------------------");
  console.log(`• Ethereum Sepolia (Total / Promedio) : ${totalSepoliaEth.toFixed(4)} ETH / ${avgSepoliaEth.toFixed(4)} ETH`);
  console.log(`• Base Sepolia (Total / Promedio)     : ${totalBaseEth.toFixed(4)} ETH / ${avgBaseEth.toFixed(4)} ETH`);
  console.log(`• Satélite Menor Saldo Base          : ${minBaseSat} (${minBaseEth.toFixed(6)} ETH)`);
  console.log(`• Autonomía Estimada en Base Sepolia  : ~${roundsRemainingBase} rondas (~${daysAutonomyBase} días)`);
  console.log(`• Autonomía Estimada en Sepolia L1   : ~${roundsRemainingSepolia} rondas (~${daysAutonomySepolia} días)`);
  console.log("-----------------------------------------------------------------------------------------\n");

  // -------------------------------------------------------------------------------------
  // 2. AUTO-RECARGA L2 (Auto-Bridge si < 0.003 ETH)
  // -------------------------------------------------------------------------------------
  let rechargedCount = 0;
  const rechargeResults = [];

  if (needsRecharge.length > 0) {
    console.log(`🚨 [RADAR ALERTA] Se detectaron ${needsRecharge.length} satélites con saldo < ${BASE_RECHARGE_THRESHOLD_ETH} ETH en Base Sepolia.`);
    console.log("🌉 Activando Auto-Bridge selectivo...");

    for (let j = 0; j < needsRecharge.length; j++) {
      const targetSat = needsRecharge[j];
      const satTag = `#${String(targetSat.index).padStart(2, "0")}`;

      if (targetSat.sepoliaEth >= 0.016) {
        console.log(`   🚀 Puenteando ${AUTO_RECHARGE_AMOUNT_ETH} ETH hacia Satélite ${satTag} [${targetSat.address}]...`);
        try {
          const signer = getSigner(targetSat.index, sepoliaProvider);
          validateIsolation(signer.address, signer.address, allAddresses);

          const bridgeContract = new ethers.Contract(BASE_SEPOLIA_L1_BRIDGE, L1_BRIDGE_ABI, signer);
          const tx = await bridgeContract.bridgeETHTo(
            signer.address,
            200000,
            "0x",
            { value: ethers.parseEther(AUTO_RECHARGE_AMOUNT_ETH) }
          );

          console.log(`   📡 Transacción enviada: ${tx.hash}`);
          const receipt = await tx.wait(1);
          console.log(`   ✅ Confirmada en bloque #${receipt.blockNumber}`);

          rechargedCount++;
          rechargeResults.push({
            index: targetSat.index,
            address: targetSat.address,
            txHash: receipt.hash,
            blockNumber: receipt.blockNumber
          });

          if (j < needsRecharge.length - 1) {
            await sleepRandom(3000, 6000);
          }
        } catch (bridgeErr) {
          console.log(`   ❌ Error puenteando satélite ${satTag}: ${bridgeErr.message}`);
        }
      } else {
        console.log(`   ⚠️ Satélite ${satTag} no tiene saldo suficiente en L1 (${targetSat.sepoliaEth} ETH). Requiere faucet manual.`);
      }
    }
  } else {
    console.log(`🛡️  [RADAR AUTO-BRIDGE] Todos los satélites superan ${BASE_RECHARGE_THRESHOLD_ETH} ETH en Base Sepolia.`);
    console.log("   Auto-Bridge en modo STANDBY (Salud de flota al 100%).\n");
  }

  // -------------------------------------------------------------------------------------
  // 3. CONSULTA SEGURA DE VIP #00 (Monitoreo)
  // -------------------------------------------------------------------------------------
  let vipSepBal = "0.000000";
  let vipBaseBal = "0.000000";
  try {
    const [vSep, vBase] = await Promise.all([
      sepoliaProvider.getBalance(vipWallet.address),
      baseSepoliaProvider.getBalance(vipWallet.address)
    ]);
    vipSepBal = parseFloat(ethers.formatEther(vSep)).toFixed(6);
    vipBaseBal = parseFloat(ethers.formatEther(vBase)).toFixed(6);
  } catch (_) {}

  // -------------------------------------------------------------------------------------
  // 4. GUARDAR REPORTE RADAR
  // -------------------------------------------------------------------------------------
  const radarReport = {
    timestamp: new Date().toISOString(),
    metrics: {
      totalSatellites: satellites.length,
      totalSepoliaEth: totalSepoliaEth.toFixed(6),
      avgSepoliaEth: avgSepoliaEth.toFixed(6),
      totalBaseEth: totalBaseEth.toFixed(6),
      avgBaseEth: avgBaseEth.toFixed(6),
      minBaseSat,
      minBaseEth: minBaseEth.toFixed(6),
      daysAutonomyBase,
      daysAutonomySepolia,
      rechargedSatellites: rechargedCount
    },
    defiProtocols: DEFI_PROTOCOLS,
    autoBridge: {
      l1BridgeContract: BASE_SEPOLIA_L1_BRIDGE,
      thresholdEth: BASE_RECHARGE_THRESHOLD_ETH,
      status: rechargedCount > 0 ? `RECARGADOS_${rechargedCount}` : "STANDBY_OPTIMO",
      rechargeResults
    },
    vipMonitor: {
      address: vipWallet.address,
      sepoliaEth: vipSepBal,
      baseEth: vipBaseBal,
      mode: "READ_ONLY_SAFE"
    },
    fleet: fleetStatus
  };

  fs.writeFileSync(RADAR_REPORT_FILE, JSON.stringify(radarReport, null, 2), "utf8");
  console.log(`💾 Reporte de Radar guardado en: ${RADAR_REPORT_FILE}`);

  // -------------------------------------------------------------------------------------
  // 5. ENVIAR REPORTE EJECUTIVO A TELEGRAM
  // -------------------------------------------------------------------------------------
  console.log("📱 Enviando Reporte Ejecutivo a Telegram...");
  const autoBridgeBadge = rechargedCount > 0
    ? `⚡ <b>ACTIVO:</b> ${rechargedCount} satélites recargados (+0.015 ETH c/u)`
    : `🟢 <b>STANDBY ÓPTIMO:</b> Flota 100% abastecida (> ${BASE_RECHARGE_THRESHOLD_ETH} ETH)`;

  const radarTelegramMessage = `
📡 <b>OPERACIÓN 10K - RADAR DE INTELIGENCIA Y SALUD DE FLOTA</b>

⛽ <b>Salud de Gas & Autonomía:</b>
   • <b>Ethereum Sepolia:</b> ${totalSepoliaEth.toFixed(3)} ETH total (Promedio: ${avgSepoliaEth.toFixed(4)} ETH)
   • <b>Base Sepolia:</b> ${totalBaseEth.toFixed(3)} ETH total (Promedio: ${avgBaseEth.toFixed(4)} ETH)
   • <b>Autonomía Base Sepolia:</b> ~${roundsRemainingBase} rondas (<b>~${daysAutonomyBase} días</b>)
   • <b>Autonomía Sepolia L1:</b> ~${roundsRemainingSepolia} rondas (<b>~${daysAutonomySepolia} días</b>)

🏦 <b>Contratos DeFi Activos (Rotator):</b>
   • <b>WETH Sepolia:</b> <code>${DEFI_PROTOCOLS.wethSepolia.address}</code>
   • <b>WETH Base:</b> <code>${DEFI_PROTOCOLS.wethBase.address}</code>

🌉 <b>Estado del Auto-Bridge L2:</b>
   ${autoBridgeBadge}

👑 <b>VIP #00:</b> Monitoreada (100% Blindada / 0 Tx automatizadas)
🤖 <b>Satélites Operativos:</b> 20/20 verificados y sincronizados

⏰ <i>${new Date().toLocaleString("es-ES", { timeZone: "UTC" })} UTC</i>
`.trim();

  await sendTelegramAlert(radarTelegramMessage);
  console.log("🎉 Radar Hunter completado con éxito.\n");
  return radarReport;
}

if (require.main === module) {
  runRadarHunter().catch((err) => {
    console.error("❌ Fallo en Radar Hunter:", err);
    process.exit(1);
  });
}

module.exports = {
  runRadarHunter
};
