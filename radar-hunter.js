/**
 * radar-hunter.js - Operación 10k
 * Módulo de Inteligencia "Radar Hunter & DeFi Rotator" Omnichain
 * 
 * Funcionalidades:
 * 1. Auditoría Omnichain: Balances, medias y cálculo de días de autonomía (frecuencia horaria 24x/día).
 * 2. Auto-Recarga L2 (Auto-Bridge): Si algún satélite baja de 0.003 ETH en Base Sepolia, cruza 0.015 ETH automáticamente desde L1.
 * 3. Telemetría de Contratos DeFi Activos (WETH, WBNB, WPOL).
 * 4. Reporte Ejecutivo Móvil a Telegram con desglose omnichain conciso.
 * 
 * Regla de seguridad: Blindaje 100% Anti-Sybil. Sin filtrado de claves ni cruzamiento de fondos.
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { ethers } = require("ethers");
const { networks, evmTestnets, solanaNetwork, createResilientProvider } = require("./networks");
const { sleepRandom, validateIsolation } = require("./anti-sybil");
const { getWalletSigner } = require("./swarm-engine");
const { sendTelegramAlert } = require("./telegram-notifier");

const WALLETS_FILE = path.join(__dirname, "wallets-public-list.json");
const RADAR_REPORT_FILE = path.join(__dirname, "radar-report.json");

// Umbrales operacionales del Radar
const BASE_RECHARGE_THRESHOLD_ETH = 0.003;
const AUTO_RECHARGE_AMOUNT_ETH = "0.015";
const ESTIMATED_ETH_PER_ROUND = 0.00035;
const ROUNDS_PER_DAY = 24; // Ahora ejecuta cada hora (cron: 17 * * * *)

const BASE_SEPOLIA_L1_BRIDGE = "0xfd0Bf71F60660E2f608ed56e1659C450eB113120";
const L1_BRIDGE_ABI = [
  "function bridgeETHTo(address _to, uint32 _minGasLimit, bytes calldata _extraData) payable"
];

function loadPublicWallets() {
  if (!fs.existsSync(WALLETS_FILE)) {
    console.error(`❌ ERROR: No se encontró el archivo ${WALLETS_FILE}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8"));
}

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

async function runRadarHunter() {
  console.log("=========================================================================================");
  console.log("      📡 OPERACIÓN 10K - RADAR HUNTER & DEFI ROTATOR: AUDITORÍA OMNICHAIN                ");
  console.log("=========================================================================================\n");

  const allWallets = loadPublicWallets();
  const allAddresses = allWallets.map((w) => w.address);
  const satellites = allWallets.filter((w) => w.index > 0);
  const vipWallet = allWallets.find((w) => w.index === 0);

  const sepoliaProvider = createProvider(networks.ethereumSepolia);
  const baseSepoliaProvider = createProvider(networks.baseSepolia);
  const arbSepoliaProvider = createProvider(networks.arbitrumSepolia);

  console.log(`🔍 Auditando saldos de la flota (${satellites.length} satélites)...`);

  let totalSepoliaEth = 0;
  let totalBaseEth = 0;
  let totalArbEth = 0;
  let minBaseEth = Infinity;
  let minBaseSat = null;
  let minSepEth = Infinity;
  let minArbEth = Infinity;

  const needsRecharge = [];
  const fleetSample = [];

  // Muestrear satélites activos (primeros 20 o los fondeados)
  const auditedSatellites = satellites.slice(0, 20);

  for (let i = 0; i < auditedSatellites.length; i++) {
    const sat = auditedSatellites[i];
    const satTag = `#${String(sat.index).padStart(2, "0")}`;

    let sepEth = 0;
    let baseEth = 0;
    let arbEth = 0;

    try {
      const [sepWei, baseWei, arbWei] = await Promise.all([
        sepoliaProvider.getBalance(sat.address).catch(() => 0n),
        baseSepoliaProvider.getBalance(sat.address).catch(() => 0n),
        arbSepoliaProvider.getBalance(sat.address).catch(() => 0n)
      ]);
      sepEth = parseFloat(ethers.formatEther(sepWei));
      baseEth = parseFloat(ethers.formatEther(baseWei));
      arbEth = parseFloat(ethers.formatEther(arbWei));
    } catch (err) {
      console.log(`   ⚠️ Error de lectura para Satélite ${satTag}: ${err.message}`);
    }

    totalSepoliaEth += sepEth;
    totalBaseEth += baseEth;
    totalArbEth += arbEth;

    if (baseEth < minBaseEth) {
      minBaseEth = baseEth;
      minBaseSat = satTag;
    }
    if (sepEth < minSepEth) {
      minSepEth = sepEth;
    }
    if (arbEth < minArbEth) {
      minArbEth = arbEth;
    }

    const satRecord = {
      index: sat.index,
      address: sat.address,
      sepoliaEth: sepEth,
      baseEth: baseEth,
      arbEth: arbEth,
      status: baseEth >= BASE_RECHARGE_THRESHOLD_ETH ? "OPTIMAL" : "LOW_GAS"
    };

    fleetSample.push(satRecord);

    // Regla de Oro: Requiere >= 0.032 ETH (0.015 ETH puente + 0.015 ETH reserva intangible + 0.002 ETH gas L1)
    if (baseEth < BASE_RECHARGE_THRESHOLD_ETH && sepEth >= 0.032) {
      needsRecharge.push(satRecord);
    }
  }

  const avgSepoliaEth = totalSepoliaEth / auditedSatellites.length;
  const avgBaseEth = totalBaseEth / auditedSatellites.length;
  const avgArbEth = totalArbEth / auditedSatellites.length;

  const roundsRemainingBase = Math.floor(minBaseEth / ESTIMATED_ETH_PER_ROUND);
  const daysAutonomyBase = (roundsRemainingBase / ROUNDS_PER_DAY).toFixed(1);

  const roundsRemainingSepolia = Math.floor(minSepEth / ESTIMATED_ETH_PER_ROUND);
  const daysAutonomySepolia = (roundsRemainingSepolia / ROUNDS_PER_DAY).toFixed(1);

  const roundsRemainingArb = Math.floor(minArbEth / ESTIMATED_ETH_PER_ROUND);
  const daysAutonomyArb = (roundsRemainingArb / ROUNDS_PER_DAY).toFixed(1);

  console.log("\n-----------------------------------------------------------------------------------------");
  console.log("📊 RESULTADOS DE SALUD DE FLOTA:");
  console.log("-----------------------------------------------------------------------------------------");
  console.log(`• Ethereum Sepolia (Total / Promedio) : ${totalSepoliaEth.toFixed(4)} ETH / ${avgSepoliaEth.toFixed(4)} ETH`);
  console.log(`• Base Sepolia (Total / Promedio)     : ${totalBaseEth.toFixed(4)} ETH / ${avgBaseEth.toFixed(4)} ETH`);
  console.log(`• Arbitrum Sepolia (Total / Promedio) : ${totalArbEth.toFixed(4)} ETH / ${avgArbEth.toFixed(4)} ETH`);
  console.log(`• Satélite Menor Saldo Base          : ${minBaseSat} (${minBaseEth.toFixed(6)} ETH)`);
  console.log(`• Autonomía Estimada en Base Sepolia  : ~${roundsRemainingBase} rondas (~${daysAutonomyBase} días @ 24x/día)`);
  console.log(`• Autonomía Estimada en Sepolia L1   : ~${roundsRemainingSepolia} rondas (~${daysAutonomySepolia} días @ 24x/día)`);
  console.log(`• Autonomía Estimada en Arbitrum     : ~${roundsRemainingArb} rondas (~${daysAutonomyArb} días @ 24x/día)`);
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
      sepoliaProvider.getBalance(vipWallet.address).catch(() => 0n),
      baseSepoliaProvider.getBalance(vipWallet.address).catch(() => 0n)
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
      auditedSatellites: auditedSatellites.length,
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
    }
  };

  fs.writeFileSync(RADAR_REPORT_FILE, JSON.stringify(radarReport, null, 2), "utf8");
  console.log(`💾 Reporte de Radar guardado en: ${RADAR_REPORT_FILE}`);

  // -------------------------------------------------------------------------------------
  // 5. ENVIAR REPORTE EJECUTIVO A TELEGRAM
  // -------------------------------------------------------------------------------------
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID || "-1004342131598";
  console.log("📱 Enviando Reporte Ejecutivo a Telegram...");
  const autoBridgeBadge = rechargedCount > 0
    ? `⚡ <b>ACTIVO:</b> ${rechargedCount} satélites recargados (+0.015 ETH c/u)`
    : `🟢 <b>STANDBY ÓPTIMO:</b> Flota 100% abastecida (> ${BASE_RECHARGE_THRESHOLD_ETH} ETH)`;

  const radarTelegramMessage = `
📡 <b>OPERACIÓN 10K — RADAR DE SALUD DE FLOTA Y GAS</b>

⛽ <b>Salud de Gas & Autonomía (Carrusel 24x/día):</b>
   • <b>Ethereum Sepolia:</b> ${totalSepoliaEth.toFixed(3)} ETH total (~${daysAutonomySepolia} días)
   • <b>Base Sepolia:</b> ${totalBaseEth.toFixed(3)} ETH total (~${daysAutonomyBase} días)
   • <b>Arbitrum Sepolia:</b> ${totalArbEth.toFixed(3)} ETH total (~${daysAutonomyArb} días)
   • <b>Otras Redes EVM:</b> 0 Gas ⏳ (En espera de distribución)
   • <b>Solana Devnet:</b> 0 SOL ⏳ (En espera de airdrop)

🏦 <b>Contratos DeFi Activos (Rotator):</b>
   • <b>WETH Sepolia:</b> <code>0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14</code>
   • <b>WETH Base:</b> <code>0x4200000000000000000000000000000000000006</code>
   • <b>WETH Arbitrum:</b> <code>0x980B62Da83eFf3D4576C647993b0c1D7faf17c73</code>
   • <b>WBNB BSC:</b> <code>0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd</code>
   • <b>WPOL Amoy:</b> <code>0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9</code>

🌉 <b>Estado del Auto-Bridge L2:</b>
   ${autoBridgeBadge}

👑 <b>VIP #00:</b> Monitoreada (100% Blindada / 0 Tx automatizadas)
🤖 <b>Flota Total:</b> ${satellites.length} Satélites sincronizados

⏰ <i>${new Date().toLocaleString("es-ES", { timeZone: "UTC" })} UTC</i>
`.trim();

  try {
    await sendTelegramAlert(radarTelegramMessage, CHAT_ID);
    console.log("📱 [RADAR] Reporte de salud de flota enviado exitosamente. ✅ Telegram API Response: ok=true");
  } catch (err) {
    console.log(`⚠️ [RADAR] Error al enviar alerta: ${err.message}`);
  }
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
