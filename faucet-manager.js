/**
 * faucet-manager.js - Operación 10k
 * Escuadrón B: Gestor de Gas y Automatización de Faucets para Satélites.
 * 
 * Regla de seguridad: PROHIBIDO leer o exponer claves privadas ni .env
 */

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { networks } = require("./networks");

const WALLETS_FILE = path.join(__dirname, "wallets-public-list.json");
const MIN_GAS_THRESHOLD = 0.001; // Menos de 0.001 ETH requiere recarga

function loadPublicWallets() {
  if (!fs.existsSync(WALLETS_FILE)) {
    console.error(`❌ ERROR: No se encontró ${WALLETS_FILE}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8"));
}

function createProvider(netConfig) {
  const fetchRequest = new ethers.FetchRequest(netConfig.rpc);
  fetchRequest.timeout = 10000;
  return new ethers.JsonRpcProvider(fetchRequest, netConfig.chainId, {
    staticNetwork: ethers.Network.from(netConfig.chainId)
  });
}

/**
 * Función de reclamo automático vía HTTP para faucets públicos sin captcha.
 * Maneja timeouts y respuestas fallidas con resiliencia sin detener el enjambre.
 */
async function attemptPublicFaucetClaim(walletAddress, networkName) {
  // Endpoints públicos de prueba con rotación y timeout seguro
  const endpoints = [
    {
      url: "https://faucet.quicknode.com/api/claim",
      method: "POST",
      body: { address: walletAddress, network: networkName }
    }
  ];

  for (const ep of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(ep.url, {
        method: ep.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ep.body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return { success: true, message: "Claim emitido exitosamente" };
      }
    } catch (err) {
      // Los faucets públicos suelen requerir PoW o captcha; se continúa sin interrumpir
    }
  }

  return { success: false, message: "Requiere verificación PoW/Captcha o faucet manual" };
}

async function runFaucetManager() {
  console.log("=========================================================================================");
  console.log("           🚰 OPERACIÓN 10K - ESCUADRÓN B: AUTO-FAUCETS Y GESTIÓN DE GAS                ");
  console.log("=========================================================================================\n");

  const wallets = loadPublicWallets();
  const satellites = wallets.filter((w) => w.index > 0);

  console.log(`📋 Analizando ${satellites.length} satélites (#01 a #${satellites[satellites.length - 1].index})...`);
  console.log(`🎯 Umbral mínimo de gas: ${MIN_GAS_THRESHOLD} ETH por red (Sepolia y Base Sepolia)\n`);

  const sepoliaProvider = createProvider(networks.ethereumSepolia);
  const baseSepoliaProvider = createProvider(networks.baseSepolia);

  const needsGas = [];
  const wellFunded = [];

  console.log("📡 Consultando saldos de gas en tiempo real...");
  for (const sat of satellites) {
    let sepBal = 0;
    let baseSepBal = 0;

    try {
      const [b1, b2] = await Promise.all([
        sepoliaProvider.getBalance(sat.address),
        baseSepoliaProvider.getBalance(sat.address)
      ]);
      sepBal = parseFloat(ethers.formatEther(b1));
      baseSepBal = parseFloat(ethers.formatEther(b2));
    } catch (e) {
      // En caso de fallo transitorio del RPC se asume 0
    }

    const needsSep = sepBal < MIN_GAS_THRESHOLD;
    const needsBase = baseSepBal < MIN_GAS_THRESHOLD;

    if (needsSep || needsBase) {
      needsGas.push({
        index: sat.index,
        address: sat.address,
        sepBal: sepBal.toFixed(6),
        baseSepBal: baseSepBal.toFixed(6),
        needsSep,
        needsBase
      });
    } else {
      wellFunded.push({
        index: sat.index,
        address: sat.address,
        sepBal: sepBal.toFixed(6),
        baseSepBal: baseSepBal.toFixed(6)
      });
    }
  }

  console.log("\n-----------------------------------------------------------------------------------------");
  console.log("ESTADO DE COMBUSTIBLE DEL ENJAMBRE (ESCUADRÓN B)");
  console.log("-----------------------------------------------------------------------------------------");
  console.log(`✅ Satélites con gas suficiente (>= ${MIN_GAS_THRESHOLD} ETH): ${wellFunded.length}`);
  console.log(`⚠️  Satélites que requieren recarga de gas: ${needsGas.length}\n`);

  if (needsGas.length > 0) {
    console.log("DETALLE DE SATÉLITES PENDIENTES DE GAS:");
    console.log(
      "IDX".padEnd(6) +
      "DIRECCIÓN PÚBLICA".padEnd(46) +
      "SEPOLIA".padEnd(16) +
      "BASE SEPOLIA".padEnd(16) +
      "ESTADO"
    );
    console.log("-----------------------------------------------------------------------------------------");

    for (const item of needsGas) {
      console.log(
        `#${String(item.index).padStart(2, "0")}`.padEnd(6) +
        item.address.padEnd(46) +
        `${item.sepBal} ETH`.padEnd(16) +
        `${item.baseSepBal} ETH`.padEnd(16) +
        "⚠️ RECARGA NECESARIA"
      );
    }
    console.log("-----------------------------------------------------------------------------------------\n");

    // Intento de auto-claim no intrusivo
    console.log("🤖 Ejecutando intento de auto-claim HTTP a endpoints públicos...");
    for (const item of needsGas.slice(0, 3)) {
      process.stdout.write(`   ↳ Solicitando gas para Satélite #${item.index}... `);
      const claimResult = await attemptPublicFaucetClaim(item.address, "sepolia");
      if (claimResult.success) {
        console.log("🎉 Reclamado!");
      } else {
        console.log("ℹ️  Protegido por PoW/Cloudflare (usar links manuales)");
      }
    }

    console.log("\n=========================================================================================");
    console.log("           🔗 GUÍA DE FAUCETS GRATUITOS RECOMENDADOS (SIN COSTO)                         ");
    console.log("=========================================================================================");
    console.log("1. Google Cloud Web3 Sepolia Faucet (0.05 Sepolia ETH diario sin saldo en mainnet):");
    console.log("   👉 https://cloud.google.com/application/web3/faucet/ethereum/sepolia\n");
    console.log("2. Coinbase / Base Sepolia Faucet (Hasta 0.1 Base Sepolia ETH diario):");
    console.log("   👉 https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet\n");
    console.log("3. Chainlink Faucet (Sepolia + Base Sepolia + LINK de prueba):");
    console.log("   👉 https://faucets.chain.link/\n");
    console.log("4. Sepolia PoW Faucet (Minería directa en navegador):");
    console.log("   👉 https://sepolia-faucet.pk910.de/\n");
    console.log("💡 RECOMENDACIÓN OPERATIVA:");
    console.log("   Puedes recargar el Satélite #01 con 0.1 Sepolia ETH desde Google Cloud Faucet,");
    console.log("   o usar la Cuenta VIP #00 como faucet interno controlado hacia satélites específicos.");
    console.log("=========================================================================================\n");
  } else {
    console.log("🎉 ¡Todos los satélites disponen de combustible para operar en Testnet!\n");
  }

  return { needsGasCount: needsGas.length, wellFundedCount: wellFunded.length };
}

if (require.main === module) {
  runFaucetManager().catch((err) => {
    console.error("❌ Error en faucet-manager:", err);
    process.exit(1);
  });
}

module.exports = {
  runFaucetManager,
  attemptPublicFaucetClaim
};
