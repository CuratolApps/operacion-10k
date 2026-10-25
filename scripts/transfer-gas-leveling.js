require("dotenv").config();
const { ethers } = require("ethers");
const { getWalletSigner } = require("../swarm-engine");
const { networks, createResilientProvider } = require("../networks");

async function main() {
  const provider = createResilientProvider(networks.polygonMainnet);
  const signer = getWalletSigner(501, provider);
  const vaultAddress = await signer.getAddress();
  const targetAddress = "0xb7505DD7FCC31A71D033F8a495D6B562420AD40F"; // Cabecera #001 de la Flota

  const balanceBefore = await provider.getBalance(vaultAddress);
  const balancePol = parseFloat(ethers.formatEther(balanceBefore));

  console.log(`Bóveda #501 Address: ${vaultAddress}`);
  console.log(`Saldo inicial: ${balancePol.toFixed(4)} POL`);

  if (balancePol < 150.05) {
    throw new Error(`Piso sagrado en riesgo: Saldo ${balancePol} POL es menor a 150.05 POL`);
  }

  const amountToSend = ethers.parseEther("0.05");
  console.log(`Enviando 0.05 POL a la Flota (${targetAddress})...`);

  const feeData = await provider.getFeeData();
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas * 130n / 100n : ethers.parseUnits("35", "gwei");
  const maxFeePerGas = feeData.maxFeePerGas ? feeData.maxFeePerGas * 130n / 100n : ethers.parseUnits("100", "gwei");

  const tx = await signer.sendTransaction({
    to: targetAddress,
    value: amountToSend,
    maxPriorityFeePerGas,
    maxFeePerGas
  });

  console.log(`Tx enviada: ${tx.hash}`);
  console.log("Esperando confirmación on-chain...");

  const receipt = await tx.wait(1);
  console.log(`✅ Tx confirmada en bloque #${receipt.blockNumber}! Gas usado: ${receipt.gasUsed.toString()}`);

  const balanceAfter = await provider.getBalance(vaultAddress);
  console.log(`Saldo final #501: ${ethers.formatEther(balanceAfter)} POL`);
  console.log(`PolygonScan: https://polygonscan.com/tx/${tx.hash}`);

  const result = {
    success: true,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    amountPol: 0.05,
    to: targetAddress,
    finalBalance501Pol: parseFloat(ethers.formatEther(balanceAfter)),
    timestamp: new Date().toISOString()
  };

  require("fs").writeFileSync("telemetry/last-gas-leveling.json", JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error("Error en transferencia:", err);
  process.exit(1);
});
