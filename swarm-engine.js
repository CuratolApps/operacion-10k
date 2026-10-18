const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { ethers } = require("ethers");

function runSwarmEngine() {
  console.log("=================================================");
  console.log("       \u{1F680} INICIANDO ENJAMBRE - OPERACION 10K     ");
  console.log("=================================================\n");

  const rawSeed = process.env.TRUST_WALLET_SEED;
  const rawSize = process.env.SWARM_SIZE;

  if (!rawSeed) {
    console.error("\u274C ERROR: TRUST_WALLET_SEED no esta definida en el archivo .env");
    process.exit(1);
  }

  const seedPhrase = rawSeed.trim().replace(/\s+/g, " ");

  if (!ethers.Mnemonic.isValidMnemonic(seedPhrase)) {
    console.error("\u274C ERROR: La frase mnemonica proporcionada NO es valida segun el estandar BIP-39.");
    process.exit(1);
  }

  const swarmSize = parseInt(rawSize || "21", 10);
  if (isNaN(swarmSize) || swarmSize <= 0) {
    console.error("\u274C ERROR: SWARM_SIZE debe ser un numero entero mayor a 0.");
    process.exit(1);
  }

  console.log("\u2705 Frase semilla validada con exito (BIP-39).");
  console.log(`\u{1F3AF} Tamano de enjambre configurado: ${swarmSize} billeteras\n`);

  const mnemonic = ethers.Mnemonic.fromPhrase(seedPhrase);
  const publicWallets = [];

  console.log("---------------------------------------------------------------------------------------------");
  console.log(
    "INDICE".padEnd(8) +
    "ROL".padEnd(46) +
    "RUTA DE DERIVACION".padEnd(24) +
    "DIRECCION PUBLICA"
  );
  console.log("---------------------------------------------------------------------------------------------");

  for (let i = 0; i < swarmSize; i++) {
    const derivationPath = `m/44'/60'/0'/0/${i}`;
    const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, derivationPath);

    const isLeader = (i === 0);
    const role = isLeader
      ? "\u{1F451} LIDER VIP (NFT Binance / Historial)"
      : "\u{1F916} SATELITE";

    console.log(
      `#${i}`.padEnd(8) +
      role.padEnd(46) +
      derivationPath.padEnd(24) +
      wallet.address
    );

    publicWallets.push({
      index: i,
      role: role,
      derivationPath: derivationPath,
      address: wallet.address
    });
  }

  console.log("---------------------------------------------------------------------------------------------\n");

  const outputPath = path.join(__dirname, "wallets-public-list.json");
  fs.writeFileSync(outputPath, JSON.stringify(publicWallets, null, 2), "utf8");

  console.log("\u{1F4C1} Lista de direcciones publicas exportada con exito en:");
  console.log(`   ${outputPath}`);
  console.log("\u{1F512} Blindaje de seguridad verificado: NINGUNA clave privada ha sido exportada.\n");
}

function getMnemonic() {
  const rawSeed = process.env.TRUST_WALLET_SEED;
  if (!rawSeed) {
    throw new Error("TRUST_WALLET_SEED no está definida en .env");
  }
  const seedPhrase = rawSeed.trim().replace(/\s+/g, " ");
  return ethers.Mnemonic.fromPhrase(seedPhrase);
}

function getWalletSigner(index, provider = null) {
  const mnemonic = getMnemonic();
  const derivationPath = `m/44'/60'/0'/0/${index}`;
  const wallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, derivationPath);
  return provider ? wallet.connect(provider) : wallet;
}

if (require.main === module) {
  runSwarmEngine();
}

module.exports = {
  runSwarmEngine,
  getWalletSigner
};
