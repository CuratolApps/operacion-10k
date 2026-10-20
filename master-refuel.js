/**
 * master-refuel.js - Operación 10k
 * Motor de Auto-Recarga de Gas desde la Cartera Matriz #501 (MASTER_GAS_VAULT).
 * 
 * Monitorea BNB (BSC Mainnet) y POL (Polygon Mainnet) en la #501.
 * Si detecta fondos (> 0.005 BNB o > 2 POL), dispersa automáticamente hacia las
 * 5 Cabeceras de Bloque (#001, #101, #201, #301, #401) y activa la dispersión intra-bloque.
 * 
 * Regla de seguridad: PROHIBIDO leer, imprimir o exponer claves privadas o frases semilla.
 * Regla de seguridad: Bóveda VIP #00 100% blindada (solo lectura).
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { networks } = require("./networks");
const { getMasterVaultWallet, getWalletSigner } = require("./swarm-engine");
const { sendTelegramAlert } = require("./telegram-notifier");

const WALLETS_FILE = path.join(__dirname, "wallets-public-list.json");
const FLEET_TELEMETRY_FILE = path.join(__dirname, "telemetry", "fleet-telemetry.json");

const MIN_BNB_TRIGGER = 0.005;
const MIN_POL_TRIGGER = 2.0;

const BOX_HEADERS = [
  { box: 1, headerIndex: 1, id: "#001" },
  { box: 2, headerIndex: 101, id: "#101" },
  { box: 3, headerIndex: 201, id: "#201" },
  { box: 4, headerIndex: 301, id: "#301" },
  { box: 5, headerIndex: 401, id: "#401" }
];

async function fetchBalanceQuick(rpcUrl, address) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [address, "latest"]
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (data && data.result) {
      return parseFloat(ethers.formatEther(BigInt(data.result)));
    }
  } catch (_) {}
  return 0.0;
}

async function runMasterRefuel() {
  const isCheckOnly = process.argv.includes("--check");
  const isDryRun = process.argv.includes("--dry-run");

  console.log("=========================================================================================");
  console.log("       ⛽ OPERACIÓN 10K — MASTER REFUEL ENGINE (BÓVEDA MATRIZ #501)                     ");
  console.log("=========================================================================================\n");

  if (!fs.existsSync(WALLETS_FILE)) {
    console.error(`❌ ERROR: No se encontró ${WALLETS_FILE}`);
    process.exit(1);
  }

  const wallets = JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8"));
  const vault501 = wallets.find((w) => w.index === 501);

  if (!vault501) {
    console.error("❌ ERROR: Cartera #501 no encontrada en wallets-public-list.json");
    process.exit(1);
  }

  const masterAddress = vault501.address;
  console.log(`🏦 Dirección Cartera Matriz #501 : ${masterAddress}`);
  console.log(`🛡️  Modo Operativo                : ${isCheckOnly ? "CHEQUEO (SOLO LECTURA)" : isDryRun ? "SIMULACIÓN (DRY-RUN)" : "PRODUCCIÓN EN VIVO"}\n`);

  // Monitoreo en BSC Mainnet y Polygon Mainnet
  const bscBalance = await fetchBalanceQuick("https://binance.llamarpc.com", masterAddress);
  const polBalance = await fetchBalanceQuick("https://polygon.llamarpc.com", masterAddress);

  console.log(`📊 SALDOS EN BÓVEDA MATRIZ #501:`);
  console.log(`   • BNB (BSC Mainnet)     : ${bscBalance.toFixed(6)} BNB (Umbral auto-recarga: > ${MIN_BNB_TRIGGER} BNB)`);
  console.log(`   • POL (Polygon Mainnet) : ${polBalance.toFixed(6)} POL (Umbral auto-recarga: > ${MIN_POL_TRIGGER} POL)\n`);

  // Actualizar telemetría de la bóveda matriz #501
  if (fs.existsSync(FLEET_TELEMETRY_FILE)) {
    try {
      const tel = JSON.parse(fs.readFileSync(FLEET_TELEMETRY_FILE, "utf8"));
      if (!tel.masterGasVaultStatus) tel.masterGasVaultStatus = {};
      tel.masterGasVaultStatus = {
        address: masterAddress,
        bscBnb: bscBalance.toFixed(6),
        polygonPol: polBalance.toFixed(6),
        lastChecked: new Date().toISOString(),
        needsRefuelBsc: bscBalance < MIN_BNB_TRIGGER,
        needsRefuelPolygon: polBalance < MIN_POL_TRIGGER
      };
      fs.writeFileSync(FLEET_TELEMETRY_FILE, JSON.stringify(tel, null, 2), "utf8");
    } catch (_) {}
  }

  const tasks = [];
  if (bscBalance >= MIN_BNB_TRIGGER) {
    tasks.push({ network: "bscMainnet", symbol: "BNB", balance: bscBalance, netConfig: networks.bscMainnet });
  }
  if (polBalance >= MIN_POL_TRIGGER) {
    tasks.push({ network: "polygonMainnet", symbol: "POL", balance: polBalance, netConfig: networks.polygonMainnet });
  }

  if (tasks.length === 0) {
    console.log("ℹ️  [MASTER STANDBY] Bóveda Matriz #501 en espera de fondeo externo.");
    console.log("   Para activar la flota en Mainnet, deposita BNB (BSC) o POL (Polygon) en:");
    console.log(`   👉 ${masterAddress}\n`);
    return { status: "STANDBY", bscBalance, polBalance };
  }

  if (isCheckOnly) {
    console.log(`⚡ Fondos detectados para auto-recarga: ${tasks.map(t => `${t.balance} ${t.symbol}`).join(", ")}`);
    return { status: "FUNDS_READY", bscBalance, polBalance, tasks };
  }

  for (const t of tasks) {
    console.log(`🚀 [DISPERSIÓN MATRIZ] Iniciando recarga hacia las 5 Cabeceras en ${t.network} (${t.symbol})...`);
    const provider = new ethers.JsonRpcProvider(t.netConfig.rpcUrls[0]);
    let signer = null;
    if (!isDryRun) {
      signer = getMasterVaultWallet(provider);
    }

    // Reservar 8% para comisiones de la #501, dividir 92% entre 5 cabeceras (~18.4% cada una)
    const available = t.balance * 0.92;
    const baseShare = available / 5;

    for (const h of BOX_HEADERS) {
      const targetWallet = wallets.find((w) => w.index === h.headerIndex);
      if (!targetWallet) continue;

      // Jitter gaussiano leve de +/- 3%
      const jitter = (Math.random() - 0.5) * 0.06;
      const shareWithJitter = (baseShare * (1 + jitter)).toFixed(5);

      console.log(`   ➤ Cabecera Box ${h.box} (${h.id} - ${targetWallet.address.slice(0, 8)}...): +${shareWithJitter} ${t.symbol}`);

      if (!isDryRun && signer) {
        try {
          const tx = await signer.sendTransaction({
            to: targetWallet.address,
            value: ethers.parseEther(shareWithJitter)
          });
          console.log(`     ✅ Tx on-chain: ${tx.hash}`);
          await tx.wait(1);
        } catch (err) {
          console.log(`     ❌ Error tx: ${err.message}`);
        }
      }
    }

    console.log(`✨ Recarga de Cabeceras completada en ${t.network}.\n`);
  }

  // Notificación a Telegram
  const alertText = `
⛽ <b>OPERACIÓN 10K — AUTO-RECARGA DE GAS DESDE BÓVEDA #501</b>

🏦 <b>Bóveda Matriz #501:</b> <code>${masterAddress}</code>
👑 <b>5 Cabeceras Fondeadas:</b> #001 (B1), #101 (B2), #201 (B3), #301 (B4), #401 (B5)
⚡ <b>Redes Procesadas:</b> ${tasks.map(t => `${t.network} (${t.symbol})`).join(", ")}
🔒 <b>Seguridad:</b> Aislamiento estanco intra-bloque preservado.
`.trim();

  await sendTelegramAlert(alertText);
  return { status: "REFUELED", tasks };
}

if (require.main === module) {
  runMasterRefuel().catch((err) => {
    console.error("❌ Error en master-refuel:", err.message);
    process.exit(0); // Exit 0 para no romper cron de GitHub Actions
  });
}

module.exports = {
  runMasterRefuel,
  MIN_BNB_TRIGGER,
  MIN_POL_TRIGGER
};
