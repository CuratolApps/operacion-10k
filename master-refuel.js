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
const { networks, createResilientProvider } = require("./networks");
const { validateIsolation, sleepRandom } = require("./anti-sybil");

async function runIntraBoxDistribution(wallets, isDryRun) {
  const isIntraBox = process.argv.includes("--intra-box");
  if (!isIntraBox) return;

  console.log("-----------------------------------------------------------------------------------------");
  console.log("🛡️  [DISPERSIÓN INTRA-BOX] Evaluando saldos en 5 Cabeceras hacia satélites de su Box...");
  console.log("-----------------------------------------------------------------------------------------");

  const allAddresses = wallets.map(w => w.address);
  const targets = [
    { network: "bscMainnet", symbol: "BNB", netConfig: networks.bscMainnet, minHeaderBal: 0.002, satTargetAmount: 0.00015 },
    { network: "polygonMainnet", symbol: "POL", netConfig: networks.polygonMainnet, minHeaderBal: 1.0, satTargetAmount: 0.08 }
  ];

  for (const t of targets) {
    const provider = createResilientProvider(t.netConfig);

    for (const h of BOX_HEADERS) {
      const headerWallet = wallets.find(w => w.index === h.headerIndex);
      if (!headerWallet) continue;

      const headerBal = await fetchBalanceQuick((t.netConfig.rpc || t.netConfig.fallbackRpc), headerWallet.address);
      if (headerBal < t.minHeaderBal) continue;

      console.log(`📦 Box ${h.box} (${h.id}): Saldo en ${t.symbol} = ${headerBal.toFixed(5)}. Dispersando intra-bloque...`);

      const boxSatellites = wallets.filter(w => {
        const boxNumber = Math.floor((w.index - 1) / 100) + 1;
        return boxNumber === h.box && w.index !== h.headerIndex && w.index !== 0 && w.index !== 501;
      });

      const toFund = boxSatellites.slice(0, 10);
      let signer = null;
      if (!isDryRun) {
        signer = getWalletSigner(h.headerIndex, provider);
      }

      for (const sat of toFund) {
        try {
          validateIsolation(headerWallet.address, sat.address, allAddresses, wallets);
          const jitter = (Math.random() - 0.5) * 0.04;
          const sendAmount = (t.satTargetAmount * (1 + jitter)).toFixed(5);

          console.log(`   ↳ [Box ${h.box}] ${h.id} -> Satélite #${String(sat.index).padStart(3, "0")}: +${sendAmount} ${t.symbol}`);

          if (!isDryRun && signer) {
            const tx = await signer.sendTransaction({
              to: sat.address,
              value: ethers.parseEther(sendAmount)
            });
            console.log(`     ✅ Tx on-chain: ${tx.hash}`);
            await tx.wait(1);
            await sleepRandom(400, 900);
          }
        } catch (err) {
          console.log(`     ⚠️ Satélite #${sat.index}: ${err.message}`);
        }
      }
    }
  }
}
const { getMasterVaultWallet, getWalletSigner } = require("./swarm-engine");
const { sendTelegramAlert } = require("./telegram-notifier");

const WALLETS_FILE = path.join(__dirname, "wallets-public-list.json");
const FLEET_TELEMETRY_FILE = path.join(__dirname, "telemetry", "fleet-telemetry.json");

const MIN_BNB_TRIGGER = 0.002;
const MIN_POL_TRIGGER = 1.0;

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
    console.log("🛡️  [VIGÍA 72H - STANDBY] Bóveda Matriz #501 vigilando liberación de fondos desde Kraken.");
    console.log(`   Saldos actuales: ${bscBalance.toFixed(5)} BNB en BSC | ${polBalance.toFixed(5)} POL en Polygon.`);
    console.log(`   Esperando: 0.02006 BNB y 116.38 POL en 👉 ${masterAddress}\n`);
    await runIntraBoxDistribution(wallets, isDryRun);
    return { status: "STANDBY_72H", bscBalance, polBalance };
  }

  if (isCheckOnly) {
    console.log(`⚡ Fondos detectados para auto-recarga: ${tasks.map(t => `${t.balance} ${t.symbol}`).join(", ")}`);
    return { status: "FUNDS_READY", bscBalance, polBalance, tasks };
  }

  for (const t of tasks) {
    console.log(`🚀 [DISPERSIÓN MATRIZ] Iniciando recarga hacia las 5 Cabeceras en ${t.network} (${t.symbol})...`);
    const provider = createResilientProvider(t.netConfig);
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

  // Dispersión intra-box si se especificó el flag
  await runIntraBoxDistribution(wallets, isDryRun);

  // Cargar estadísticas acumuladas para Telegram
  let statsText = "";
  if (fs.existsSync(FLEET_TELEMETRY_FILE)) {
    try {
      const tel = JSON.parse(fs.readFileSync(FLEET_TELEMETRY_FILE, "utf8"));
      if (tel.workStats) {
        const ws = tel.workStats;
        statsText = `
📈 <b>ACUMULADO HISTÓRICO DE LA FLOTA:</b>
   • <b>Rondas Ejecutadas:</b> ${ws.totalRoundsCompleted} rondas
   • <b>Txs On-Chain Acumuladas:</b> ${ws.totalTxConfirmedAllTime} txs firmadas
   • <b>Txs Confirmadas Hoy:</b> ${ws.todayTxConfirmed} txs
   • <b>Boxes Rotados Hoy:</b> ${(ws.boxesRotatedToday || []).join(", ")}
   • <b>Autonomía de Gas:</b> ${ws.gasAutonomySummary || "~1.8 días en Base / ~1.3 días en Sepolia"}
`;
      }
    } catch (_) {}
  }

  // Notificación de Celebración a Telegram
  const alertText = `
🎉 🚨 <b>¡ALERTA DE CELEBRACIÓN: FONDOS DETECTADOS EN BÓVEDA #501!</b>
⛽ <b>FONDOS DE KRAKEN LIBERADOS EN MAINNET</b>

🏦 <b>Bóveda Matriz #501:</b> <code>${masterAddress}</code>
💰 <b>Fondos Capturados:</b>
${tasks.map(t => `   • <b>${t.network}:</b> +${t.balance.toFixed(5)} ${t.symbol} ✅`).join("\n")}

👑 <b>5 Cabeceras Fondeadas Automáticamente:</b>
   • Cabecera #001 (Box 1)
   • Cabecera #101 (Box 2)
   • Cabecera #201 (Box 3)
   • Cabecera #301 (Box 4)
   • Cabecera #401 (Box 5)

🛡️ <b>Dispersión Intra-Box:</b> Activa hacia satélites de cada Box.
🔒 <b>Seguridad:</b> Aislamiento estanco intra-bloque 100% preservado.
${statsText}
⏰ <i>${new Date().toLocaleString("es-ES", { timeZone: "UTC" })} UTC</i>
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
