/**
 * balance-checker.js - Operación 10k
 * Conector multi-red y lector concurrente ultrarrápido de saldos vía Multicall3.
 * 
 * Regla de seguridad: NO lee ni expone credenciales privadas ni frases semilla.
 */

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { networkList, createResilientProvider, fetchEthBalancesBatch } = require("./networks");

const WALLETS_FILE = path.join(__dirname, "wallets-public-list.json");
const REPORT_FILE = path.join(__dirname, "balances-report.json");

function loadPublicWallets() {
  if (!fs.existsSync(WALLETS_FILE)) {
    console.error(`❌ ERROR: No se encontró el archivo ${WALLETS_FILE}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(WALLETS_FILE, "utf8");
  const wallets = JSON.parse(rawData);

  if (!Array.isArray(wallets) || wallets.length === 0) {
    console.error("❌ ERROR: La lista de billeteras está vacía o es inválida.");
    process.exit(1);
  }

  return wallets;
}

async function checkNetworkStatus(netConfig) {
  const startTime = Date.now();
  try {
    const provider = createResilientProvider(netConfig);
    const blockNumber = await provider.getBlockNumber();
    const latency = Date.now() - startTime;
    return {
      id: netConfig.id,
      name: netConfig.name,
      category: netConfig.category,
      chainId: netConfig.chainId,
      symbol: netConfig.symbol,
      online: true,
      blockNumber: blockNumber,
      latencyMs: latency,
      provider: provider
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      id: netConfig.id,
      name: netConfig.name,
      category: netConfig.category,
      chainId: netConfig.chainId,
      symbol: netConfig.symbol,
      online: false,
      blockNumber: null,
      latencyMs: latency,
      error: error.message || "Timeout o error de conexión",
      provider: null
    };
  }
}

/**
 * Consulta en masa los saldos de todas las billeteras mediante Multicall3 en 1 sola llamada RPC.
 */
async function fetchBalancesForNetwork(networkStatus, wallets) {
  const balances = {};
  if (!networkStatus.online || !networkStatus.provider) {
    wallets.forEach((w) => {
      balances[w.address] = "OFFLINE";
    });
    return balances;
  }

  const addresses = wallets.map((w) => w.address);
  const rawBatch = await fetchEthBalancesBatch(networkStatus.provider, addresses);

  for (const w of wallets) {
    const rawBalWei = rawBatch[w.address.toLowerCase()] || 0n;
    const formatted = ethers.formatEther(rawBalWei);
    const num = parseFloat(formatted);
    balances[w.address] = num === 0 ? "0.000000" : num.toFixed(6);
  }

  return balances;
}

function truncateAddress(addr) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

async function main() {
  console.log("=========================================================================================");
  console.log("      🛰️ OPERACION 10K - LECTOR DE SALDOS MULTICALL3 & RESILIENT RPC (500 SATÉLITES)     ");
  console.log("=========================================================================================\n");

  const wallets = loadPublicWallets();
  console.log(`📋 Total de billeteras cargadas: ${wallets.length} (Índice #00 a #${wallets.length - 1})`);
  console.log("🔒 Regla de seguridad: Claves privadas NO accedidas. Modo de solo lectura pública.\n");

  console.log("📡 Conectando a endpoints RPC y verificando bloques en vivo...");
  const networkStatuses = await Promise.all(networkList.map(checkNetworkStatus));

  console.log("\n-----------------------------------------------------------------------------------------");
  console.log("ESTADO DE REDES RPC");
  console.log("-----------------------------------------------------------------------------------------");
  console.log(
    "RED".padEnd(24) +
    "CATEGORIA".padEnd(28) +
    "CHAIN ID".padEnd(12) +
    "ESTADO".padEnd(12) +
    "BLOQUE".padEnd(12) +
    "LATENCIA"
  );
  console.log("-----------------------------------------------------------------------------------------");

  networkStatuses.forEach((net) => {
    const statusText = net.online ? "🟢 ONLINE" : "🔴 OFFLINE";
    const blockText = net.blockNumber ? `#${net.blockNumber}` : "N/A";
    const latencyText = `${net.latencyMs} ms`;
    console.log(
      net.name.padEnd(24) +
      net.category.padEnd(28) +
      String(net.chainId || "N/A").padEnd(12) +
      statusText.padEnd(12) +
      blockText.padEnd(12) +
      latencyText
    );
  });
  console.log("-----------------------------------------------------------------------------------------\n");

  console.log("⚡ Obteniendo saldos por red en paralelo usando Multicall3...");
  const balanceResults = {};
  for (const net of networkStatuses) {
    if (net.category.includes("EVM")) {
      console.log(`   ⏳ Escaneando ${net.name} vía Multicall3...`);
      balanceResults[net.id] = await fetchBalancesForNetwork(net, wallets);
    }
  }

  const reportData = wallets.map((w) => ({
    index: w.index,
    role: w.role,
    address: w.address,
    balances: Object.keys(balanceResults).reduce((acc, netId) => {
      acc[netId] = balanceResults[netId][w.address] || "0.000000";
      return acc;
    }, {})
  }));

  const reportPayload = {
    timestamp: new Date().toISOString(),
    networkStatus: networkStatuses.map((n) => ({
      name: n.name,
      chainId: n.chainId,
      online: n.online,
      blockNumber: n.blockNumber,
      latencyMs: n.latencyMs
    })),
    wallets: reportData
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(reportPayload, null, 2), "utf8");
  console.log(`\n💾 Reporte consolidado guardado en: ${REPORT_FILE}`);
  console.log("✨ Consulta Multicall3 completada exitosamente.\n");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("❌ Error inesperado durante la ejecución:", err);
    process.exit(1);
  });
}

module.exports = {
  main,
  fetchBalancesForNetwork,
  checkNetworkStatus
};
