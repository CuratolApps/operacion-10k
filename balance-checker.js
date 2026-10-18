/**
 * balance-checker.js - Operación 10k
 * Conector multi-red y lector concurrente de saldos para enjambre de 21 billeteras.
 * 
 * Regla de seguridad: NO lee ni expone credenciales privadas ni frases semilla.
 */

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { networks, networkList } = require("./networks");

const WALLETS_FILE = path.join(__dirname, "wallets-public-list.json");
const REPORT_FILE = path.join(__dirname, "balances-report.json");
const RPC_TIMEOUT_MS = 10000;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 120;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Cargar billeteras públicas generadas en Fase 1
function loadPublicWallets() {
  if (!fs.existsSync(WALLETS_FILE)) {
    console.error(`❌ ERROR: No se encontró el archivo ${WALLETS_FILE}`);
    console.error("   Ejecuta primero: node swarm-engine.js");
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

// Inicializar un proveedor Ethers con timeout seguro y red estática
function createProvider(netConfig) {
  const fetchRequest = new ethers.FetchRequest(netConfig.rpc);
  fetchRequest.timeout = RPC_TIMEOUT_MS;

  const staticNet = ethers.Network.from(netConfig.chainId);
  return new ethers.JsonRpcProvider(fetchRequest, netConfig.chainId, {
    staticNetwork: staticNet
  });
}

// Consultar el estado del RPC y número de bloque
async function checkNetworkStatus(netConfig) {
  const provider = createProvider(netConfig);
  const startTime = Date.now();

  try {
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

// Consultar saldos de billeteras en lotes para una red específica
async function fetchBalancesForNetwork(networkStatus, wallets) {
  const balances = {};
  if (!networkStatus.online || !networkStatus.provider) {
    wallets.forEach((w) => {
      balances[w.address] = "OFFLINE";
    });
    return balances;
  }

  const provider = networkStatus.provider;

  for (let i = 0; i < wallets.length; i += BATCH_SIZE) {
    const batch = wallets.slice(i, i + BATCH_SIZE);

    const promises = batch.map(async (wallet) => {
      try {
        const rawBal = await provider.getBalance(wallet.address);
        const formatted = ethers.formatEther(rawBal);
        // Formatear a 6 decimales para lectura limpia
        const num = parseFloat(formatted);
        return {
          address: wallet.address,
          balance: num === 0 ? "0.000000" : num.toFixed(6),
          rawWei: rawBal.toString()
        };
      } catch (err) {
        return {
          address: wallet.address,
          balance: "ERR",
          rawWei: "0"
        };
      }
    });

    const results = await Promise.all(promises);
    results.forEach((r) => {
      balances[r.address] = r.balance;
    });

    if (i + BATCH_SIZE < wallets.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return balances;
}

function truncateAddress(addr) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

async function main() {
  console.log("=========================================================================================");
  console.log("             🛰️  OPERACION 10K - FASE 2: CONEXIÓN MULTI-RED & LECTOR DE SALDOS          ");
  console.log("=========================================================================================\n");

  const wallets = loadPublicWallets();
  console.log(`📋 Total de billeteras cargadas: ${wallets.length} (Índice #00 a #${wallets.length - 1})`);
  console.log("🔒 Regla de seguridad: Claves privadas NO accedidas. Modo de solo lectura pública.\n");

  console.log("📡 Conectando a endpoints RPC y verificando bloques en vivo...");
  const networkStatuses = await Promise.all(networkList.map(checkNetworkStatus));

  // Imprimir tabla de estado de redes
  console.log("\n-----------------------------------------------------------------------------------------");
  console.log("ESTADO DE REDES RPC");
  console.log("-----------------------------------------------------------------------------------------");
  console.log(
    "RED".padEnd(24) +
    "CATEGORIA".padEnd(28) +
    "CHAIN ID".padEnd(12) +
    "BLOQUE".padEnd(12) +
    "LATENCIA".padEnd(10) +
    "ESTADO"
  );
  console.log("-----------------------------------------------------------------------------------------");

  for (const net of networkStatuses) {
    const statusIcon = net.online ? "🟢 ONLINE" : "🔴 ERROR";
    const blockStr = net.online ? String(net.blockNumber) : "N/A";
    const latStr = `${net.latencyMs}ms`;

    console.log(
      net.name.padEnd(24) +
      net.category.padEnd(28) +
      String(net.chainId).padEnd(12) +
      blockStr.padEnd(12) +
      latStr.padEnd(10) +
      statusIcon
    );
  }
  console.log("-----------------------------------------------------------------------------------------\n");

  console.log("⏳ Consultando saldos del enjambre por lotes concurrentes...");
  const balancesByNetwork = {};
  for (const net of networkStatuses) {
    process.stdout.write(`   ↳ Verificando saldos en ${net.name}... `);
    balancesByNetwork[net.id] = await fetchBalancesForNetwork(net, wallets);
    console.log("✅");
  }

  // Imprimir matriz de saldos
  console.log("\n=========================================================================================");
  console.log("MATRIZ DE SALDOS DEL ENJAMBRE (21 BILLETERAS)");
  console.log("=========================================================================================");
  console.log(
    "IDX".padEnd(6) +
    "ROL".padEnd(14) +
    "DIRECCIÓN".padEnd(44) +
    "SEP ETH".padEnd(11) +
    "BASE SEP".padEnd(11) +
    "ARB SEP".padEnd(11) +
    "OP SEP".padEnd(11) +
    "BSC BNB".padEnd(11) +
    "BASE ETH"
  );
  console.log("--------------------------------------------------------------------------------------------------------------------------------");

  const reportData = [];

  for (const w of wallets) {
    const isLeader = (w.index === 0);
    const shortRole = isLeader ? "👑 VIP #00" : `🤖 SAT #${String(w.index).padStart(2, "0")}`;
    const ethSep = balancesByNetwork["ethereumSepolia"][w.address] || "0.000000";
    const baseSep = balancesByNetwork["baseSepolia"][w.address] || "0.000000";
    const arbSep = balancesByNetwork["arbitrumSepolia"][w.address] || "0.000000";
    const opSep = balancesByNetwork["optimismSepolia"][w.address] || "0.000000";
    const bsc = balancesByNetwork["bscMainnet"][w.address] || "0.000000";
    const baseMain = balancesByNetwork["baseMainnet"][w.address] || "0.000000";

    console.log(
      `#${String(w.index).padStart(2, "0")}`.padEnd(6) +
      shortRole.padEnd(14) +
      w.address.padEnd(44) +
      ethSep.padEnd(11) +
      baseSep.padEnd(11) +
      arbSep.padEnd(11) +
      opSep.padEnd(11) +
      bsc.padEnd(11) +
      baseMain
    );

    reportData.push({
      index: w.index,
      role: w.role,
      address: w.address,
      balances: {
        ethereumSepolia: ethSep,
        baseSepolia: baseSep,
        arbitrumSepolia: arbSep,
        optimismSepolia: opSep,
        bscMainnet: bsc,
        baseMainnet: baseMain
      }
    });
  }

  console.log("--------------------------------------------------------------------------------------------------------------------------------\n");

  // Guardar reporte
  const reportPayload = {
    timestamp: new Date().toISOString(),
    networkStatus: networkStatuses.map(n => ({
      name: n.name,
      chainId: n.chainId,
      online: n.online,
      blockNumber: n.blockNumber,
      latencyMs: n.latencyMs
    })),
    wallets: reportData
  };

  fs.writeFileSync(REPORT_FILE, JSON.stringify(reportPayload, null, 2), "utf8");
  console.log(`💾 Reporte consolidado guardado en: ${REPORT_FILE}`);
  console.log("✨ Fase 2 completada exitosamente.\n");
}

main().catch((err) => {
  console.error("❌ Error inesperado durante la ejecución:", err);
  process.exit(1);
});
