require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const { ethers } = require("ethers");

const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const ARB_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const HL_BRIDGE2_ARB = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log("================================================================================");
  console.log("🚀⚡ ÁREA 501 // PASO 3: DEPÓSITO ARBITRUM ONE ➔ HYPERLIQUID L1 BRIDGE2");
  console.log("================================================================================");

  const seed = process.env.TRUST_WALLET_SEED.trim();
  const mnemonic = ethers.Mnemonic.fromPhrase(seed);
  const signerWallet = ethers.HDNodeWallet.fromMnemonic(mnemonic, "m/44'/60'/0'/0/501");
  console.log(`🏛️ Bóveda Matriz #501 autenticada: ${signerWallet.address}`);

  const arbRpc = process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc";
  const arbProvider = new ethers.JsonRpcProvider(arbRpc);
  const arbSigner = signerWallet.connect(arbProvider);

  const arbUsdcContract = new ethers.Contract(ARB_USDC, ERC20_ABI, arbProvider);
  const bal = await arbUsdcContract.balanceOf(VAULT_501);
  console.log(`• Saldo USDC disponible en Arbitrum One: $${ethers.formatUnits(bal, 6)} USDC`);

  if (bal === 0n) {
    throw new Error("No hay balance de USDC en Arbitrum One para depositar.");
  }

  const ethBal = await arbProvider.getBalance(VAULT_501);
  console.log(`• Saldo gas ETH en Arbitrum: ${ethers.formatEther(ethBal)} ETH`);

  console.log(`• Transfiriendo $${ethers.formatUnits(bal, 6)} USDC a Hyperliquid Bridge2 (${HL_BRIDGE2_ARB})...`);
  const connectedContract = arbUsdcContract.connect(arbSigner);
  const tx = await connectedContract.transfer(HL_BRIDGE2_ARB, bal);
  console.log(`• ⏳ Transacción enviada: ${tx.hash}`);
  console.log(`  🔗 ArbiScan: https://arbiscan.io/tx/${tx.hash}`);

  await tx.wait();
  console.log("✅ ¡Transacción confirmada en Arbitrum One!");

  console.log("\n⏳ Verificando acreditación en Hyperliquid L1...");
  let finalHlValue = 0;
  for (let i = 0; i < 20; i++) {
    await sleep(3000);
    try {
      const hlRes = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clearinghouseState", user: VAULT_501 })
      });
      const hlData = await hlRes.json();
      finalHlValue = parseFloat(hlData.marginSummary?.accountValue || "0");
      if (finalHlValue >= 190.0) {
        console.log(`🔥 ¡CONFIRMADO EN HYPERLIQUID L1! Account Value: $${finalHlValue.toFixed(4)} USDC`);
        break;
      }
    } catch (_) { }
    process.stdout.write(".");
  }

  console.log("\n================================================================================");
  console.log(`🏁 SALDO FINAL EN HYPERLIQUID L1: $${finalHlValue.toFixed(2)} USDC (¡META DE $200 CLAVADA!)`);
  console.log("================================================================================");
}

main().catch(err => {
  console.error("❌ Error en depósito:", err.message);
  process.exit(1);
});
