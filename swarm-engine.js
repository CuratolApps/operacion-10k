/**
 * swarm-engine.js - Operación 10k
 * Generador y Derivador Determinista Omnichain (EVM BIP-44 + Solana Ed25519)
 * Escalable dinámicamente de 51 hasta 501+ billeteras.
 * 
 * Regla de seguridad: PROHIBIDO registrar o mostrar claves privadas ni volcar .env.
 * Regla de seguridad: Cuentas públicas exportadas NO contienen secretos criptográficos.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();
const { ethers } = require("ethers");
const { Keypair } = require("@solana/web3.js");

const WALLETS_FILE = path.join(__dirname, "wallets-public-list.json");

function getMnemonic() {
  const rawSeed = process.env.TRUST_WALLET_SEED || process.env.SWARM_MNEMONIC;
  if (!rawSeed) {
    throw new Error("❌ Ni TRUST_WALLET_SEED ni SWARM_MNEMONIC están definidas en el entorno");
  }
  const seedPhrase = rawSeed.trim().replace(/\s+/g, " ");
  if (!ethers.Mnemonic.isValidMnemonic(seedPhrase)) {
    throw new Error("❌ La frase mnemónica en el entorno NO es válida según el estándar BIP-39.");
  }
  return ethers.Mnemonic.fromPhrase(seedPhrase);
}

/**
 * Obtiene el Signer EVM en memoria para un índice dado.
 */
function getWalletSigner(index, provider = null) {
  const mnemonic = getMnemonic();
  const derivationPath = `m/44'/60'/0'/0/${index}`;
  const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, derivationPath);
  return provider ? wallet.connect(provider) : wallet;
}

/**
 * Deriva de forma determinista el Keypair de Solana en memoria a partir
 * de la clave privada EVM del satélite (SHA-256 seed de 32 bytes).
 */
function getSolanaKeypair(index) {
  const mnemonic = getMnemonic();
  const derivationPath = `m/44'/60'/0'/0/${index}`;
  const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, derivationPath);
  const seed32 = crypto.createHash("sha256").update(wallet.privateKey).digest();
  return Keypair.fromSeed(seed32);
}

/**
 * Genera y exporta la lista de direcciones públicas (EVM + Solana) para la flota.
 */
function runSwarmEngine() {
  console.log("=========================================================================================");
  console.log("       🚀 INICIANDO ENJAMBRE OMNICHAIN - OPERACION 10K (EVM + SOLANA)                   ");
  console.log("=========================================================================================\n");

  const rawSize = process.env.SWARM_SIZE;
  // Por defecto 501 (1 VIP #00 + 500 Satélites)
  const swarmSize = parseInt(rawSize || "501", 10);
  if (isNaN(swarmSize) || swarmSize <= 0) {
    console.error("❌ ERROR: SWARM_SIZE debe ser un número entero mayor a 0.");
    process.exit(1);
  }

  let mnemonic;
  try {
    mnemonic = getMnemonic();
    console.log("✅ Frase semilla validada con éxito (BIP-39).");
    console.log(`🎯 Tamaño de enjambre configurado: ${swarmSize} billeteras (1 VIP + ${swarmSize - 1} Satélites)\n`);
  } catch (err) {
    if (fs.existsSync(WALLETS_FILE)) {
      console.log(`⚠️  [SWARM ENGINE] Advertencia de semilla: ${err.message}`);
      console.log(`✅ [RECUPERACIÓN RESILIENTE] Utilizando lista pública existente verificada: ${WALLETS_FILE}\n`);
      return JSON.parse(fs.readFileSync(WALLETS_FILE, "utf8"));
    }
    throw err;
  }

  const publicWallets = [];

  console.log("--------------------------------------------------------------------------------------------------------------------------------");
  console.log(
    "IDX".padEnd(6) +
    "ROL".padEnd(42) +
    "DIRECCION EVM".padEnd(44) +
    "DIRECCION SOLANA DEVNET"
  );
  console.log("--------------------------------------------------------------------------------------------------------------------------------");

  for (let i = 0; i < swarmSize; i++) {
    const derivationPath = `m/44'/60'/0'/0/${i}`;
    const evmWallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, derivationPath);

    // Derivación determinista de Solana usando SHA-256 de la private key EVM
    const seed32 = crypto.createHash("sha256").update(evmWallet.privateKey).digest();
    const solanaKp = Keypair.fromSeed(seed32);
    const solanaAddress = solanaKp.publicKey.toBase58();

    const isLeader = (i === 0);
    const role = isLeader
      ? "👑 LIDER VIP (NFT Binance / Blindada)"
      : `🤖 SATELITE #${String(i).padStart(2, "0")}`;

    // Mostrar en consola los primeros 10 y los últimos si son muchos para no saturar
    if (i < 15 || i >= swarmSize - 5) {
      console.log(
        `#${i}`.padEnd(6) +
        role.padEnd(42) +
        evmWallet.address.padEnd(44) +
        solanaAddress
      );
    } else if (i === 15) {
      console.log(`... [Omitiendo visualización de ${swarmSize - 20} satélites intermedios en consola] ...`);
    }

    publicWallets.push({
      index: i,
      role: role,
      derivationPath: derivationPath,
      address: evmWallet.address,
      solanaAddress: solanaAddress
    });
  }

  console.log("--------------------------------------------------------------------------------------------------------------------------------\n");

  fs.writeFileSync(WALLETS_FILE, JSON.stringify(publicWallets, null, 2), "utf8");

  console.log(`📁 Lista pública Omnichain exportada (${publicWallets.length} cuentas) en:`);
  console.log(`   ${WALLETS_FILE}`);
  console.log("🔒 Blindaje de seguridad verificado: NINGUNA clave privada ha sido exportada.\n");

  return publicWallets;
}

module.exports = {
  runSwarmEngine,
  getWalletSigner,
  getSolanaKeypair,
  getMnemonic
};

if (require.main === module) {
  runSwarmEngine();

  // Si no se pasa el flag --only-generate, ejecuta la ronda Multi-Red automáticamente
  if (!process.argv.includes("--only-generate")) {
    console.log("⚡ [SWARM ENGINE] Iniciando ejecución de la ronda multi-red...\n");
    const { runTaskRunner } = require("./task-runner");
    runTaskRunner().catch((err) => {
      console.error("❌ Fallo crítico en ejecución del enjambre:", err);
      process.exit(1);
    });
  }
}
