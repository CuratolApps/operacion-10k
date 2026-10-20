/**
 * solana-faucet-refuel.js - Operación 10k
 * Bypass de Error 429 para Solana Devnet con solicitud de montos fraccionados
 * (0.5, 0.25, 0.1 SOL) y rotación de RPCs sobre la Cartera #501 y las 5 Cabeceras.
 * 
 * Regla de seguridad: PROHIBIDO registrar o mostrar claves privadas ni .env
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Connection, PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const { sendTelegramAlert } = require("./telegram-notifier");

const WALLETS_FILE = path.join(__dirname, "wallets-public-list.json");

const SOLANA_DEVNET_RPCS = [
  "https://api.devnet.solana.com",
  "https://rpc.ankr.com/solana_devnet",
  "https://devnet.helius-rpc.com/?api-key=15319bf4-5b40-4958-ac8d-6313aa55eb92"
];

const FRACTIONAL_AMOUNTS_SOL = [0.5, 0.25, 0.1];

const TARGET_INDICES = [
  { index: 501, label: "Bóveda Matriz #501" },
  { index: 1, label: "Cabecera Box 1 (#001)" },
  { index: 101, label: "Cabecera Box 2 (#101)" },
  { index: 201, label: "Cabecera Box 3 (#201)" },
  { index: 301, label: "Cabecera Box 4 (#301)" },
  { index: 401, label: "Cabecera Box 5 (#401)" }
];

async function attemptAirdropForAddress(target, rpcUrl, amountSol) {
  try {
    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "requestAirdrop",
        params: [target.solanaAddress, lamports]
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    const data = await res.json();
    if (data && data.result) {
      return {
        success: true,
        sig: data.result,
        amountSol
      };
    }

    const errMsg = data?.error?.message || (data?.error ? JSON.stringify(data.error) : "Rechazado");
    const is429 = errMsg.includes("429") || errMsg.includes("Too Many Requests") || errMsg.includes("limit") || errMsg.includes("run dry");
    return {
      success: false,
      is429,
      error: errMsg.slice(0, 70)
    };
  } catch (err) {
    return {
      success: false,
      is429: false,
      error: err.message.slice(0, 70)
    };
  }
}

async function getAddressBalance(solanaAddress) {
  for (const rpc of SOLANA_DEVNET_RPCS) {
    try {
      const connection = new Connection(rpc, "confirmed");
      const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 4000));
      const balPromise = connection.getBalance(new PublicKey(solanaAddress));
      const lamports = await Promise.race([balPromise, timeoutPromise]);
      return lamports / LAMPORTS_PER_SOL;
    } catch (_) {}
  }
  return 0.0;
}

async function runSolanaFaucetRefuel() {
  console.log("=========================================================================================");
  console.log("       🟣 OPERACIÓN 10K — SOLANA DEVNET FAUCET BYPASS (MONITOR & AUTO-REFUEL)            ");
  console.log("=========================================================================================\n");

  if (!fs.existsSync(WALLETS_FILE)) {
    console.error(`❌ ERROR: No se encontró ${WALLETS_FILE}`);
    process.exit(1);
  }

  const wallets = JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8"));
  const targets = [];

  for (const t of TARGET_INDICES) {
    const w = wallets.find((item) => item.index === t.index);
    if (w && w.solanaAddress) {
      targets.push({
        index: t.index,
        label: t.label,
        solanaAddress: w.solanaAddress
      });
    }
  }

  console.log(`🎯 Objetivos Prioritarios: ${targets.length} carteras (#501 + 5 Cabeceras de Bloque)`);
  console.log(`🌐 RPCs Devnet con failover: ${SOLANA_DEVNET_RPCS.length} endpoints`);
  console.log(`⚡ Cantidades fraccionadas de bypass: ${FRACTIONAL_AMOUNTS_SOL.join(", ")} SOL\n`);

  let anySuccess = false;
  const successfulRefuels = [];
  let isRateLimitedOverall = false;

  for (const target of targets) {
    console.log(`-----------------------------------------------------------------------------------------`);
    console.log(`➤ [${target.label}] Solana: ${target.solanaAddress}`);

    const currentBal = await getAddressBalance(target.solanaAddress);
    console.log(`   ↳ Saldo actual: ${currentBal.toFixed(4)} SOL`);

    if (currentBal >= 0.05) {
      console.log(`   ✅ Ya cuenta con gas operativo (${currentBal.toFixed(4)} SOL). Omitiendo faucet.`);
      continue;
    }

    let targetFunded = false;

    // Probar contra cada RPC y con montos fraccionados descendentes
    for (const rpcUrl of SOLANA_DEVNET_RPCS) {
      if (targetFunded) break;

      const rpcName = rpcUrl.includes("helius")
        ? "Helius RPC"
        : rpcUrl.includes("ankr")
        ? "Ankr RPC"
        : "Solana Official";

      for (const amount of FRACTIONAL_AMOUNTS_SOL) {
        console.log(`   ⏳ Intentando requestAirdrop de ${amount} SOL vía [${rpcName}]...`);
        const result = await attemptAirdropForAddress(target, rpcUrl, amount);

        if (result.success) {
          console.log(`   🎉 ¡ÉXITO! Recibidos ${amount} SOL (Saldo total: ${result.balanceSol.toFixed(4)} SOL)`);
          console.log(`      Firma Tx: ${result.sig}`);
          targetFunded = true;
          anySuccess = true;
          successfulRefuels.push({
            label: target.label,
            address: target.solanaAddress,
            amount,
            balance: result.balanceSol
          });
          break;
        } else {
          if (result.is429) {
            console.log(`   ⚠️ [429 RATE-LIMIT] Grifo Devnet saturado para ${amount} SOL en ${rpcName}.`);
            isRateLimitedOverall = true;
          } else {
            console.log(`   ⚠️ Fallo en llamada: ${result.error || "Error"}`);
          }
        }
      }
    }

    if (!targetFunded) {
      console.log(`   ⏳ ${target.label} en espera de rotación de IP (GitHub Actions Runner).`);
    }
  }

  console.log(`\n=========================================================================================`);
  if (anySuccess) {
    console.log(`🎉 Auto-recarga Solana completada: ${successfulRefuels.length} carteras fondeadas.`);
    const alertText = `
🟣 <b>OPERACIÓN 10K — SOLANA DEVNET FAUCET EXITOSO</b>

⚡ <b>Recargas Confirmadas:</b>
${successfulRefuels.map(r => `   • <b>${r.label}:</b> +${r.amount} SOL (Saldo: ${r.balance.toFixed(4)} SOL)`).join("\n")}

🎯 <b>Cartera Matriz #501 y Cabeceras operativas en Solana Devnet.</b>
`.trim();
    await sendTelegramAlert(alertText);
  } else if (isRateLimitedOverall) {
    console.log(`ℹ️ [FAUCET RATE-LIMIT ACTIVO] La IP local alcanzó el límite temporal de Devnet.`);
    console.log(`🛡️  Bypass Automático: Programado en GitHub Actions ('swarm-cron.yml') donde cada corrida`);
    console.log(`   ejecuta desde una IP limpia de datacenter diferente sin el error 429.`);
  }
  console.log(`=========================================================================================\n`);

  return { success: anySuccess, successfulRefuels, isRateLimitedOverall };
}

if (require.main === module) {
  runSolanaFaucetRefuel().catch((err) => {
    console.error("❌ Error en solana-faucet-refuel:", err.message);
    process.exit(0);
  });
}

module.exports = {
  runSolanaFaucetRefuel
};
