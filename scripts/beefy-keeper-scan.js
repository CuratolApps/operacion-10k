/**
 * beefy-keeper-scan.js — SOLO LECTURA ($0 gas). Candidatos de keeper bounty de Beefy Finance.
 * Fuente: api.beefy.finance (vaults activas + TVL). On-chain: Multicall3 aggregate3 -> callReward() y paused().
 * No firma nada. No usa claves.
 */
require("dotenv").config();
const { ethers } = require("ethers");

const MC3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MC_ABI = ["function aggregate3(tuple(address target,bool allowFailure,bytes callData)[] calls) view returns (tuple(bool success,bytes returnData)[])"];
const SEL_CALL_REWARD = ethers.id("callReward()").slice(0, 10); // 0x97fd323d
const SEL_PAUSED = ethers.id("paused()").slice(0, 10);          // 0x5c975abb
const CHAINS = { polygon: { id: 137, env: "POLYGON_RPC_URL", native: "POL" }, bsc: { id: 56, env: "BNB_RPC_URL", native: "BNB" } };

async function scan(chainKey, topN = 15) {
  const c = CHAINS[chainKey];
  const [vaults, tvl] = await Promise.all([
    fetch("https://api.beefy.finance/vaults").then(r => r.json()),
    fetch("https://api.beefy.finance/tvl").then(r => r.json())
  ]);
  const chainTvl = tvl[c.id] || {};
  const list = vaults.filter(v => v.chain === chainKey && v.status === "active" && v.strategy && ethers.isAddress(v.strategy))
    .sort((a, b) => (chainTvl[b.id] || 0) - (chainTvl[a.id] || 0)).slice(0, topN);

  const provider = new ethers.JsonRpcProvider(process.env[c.env]);
  const mc = new ethers.Contract(MC3, MC_ABI, provider);
  const calls = [];
  list.forEach(v => {
    calls.push({ target: v.strategy, allowFailure: true, callData: SEL_CALL_REWARD });
    calls.push({ target: v.strategy, allowFailure: true, callData: SEL_PAUSED });
  });
  const res = await mc.aggregate3(calls);
  const block = await provider.getBlockNumber();
  const rows = list.map((v, i) => {
    const r = res[i * 2], p = res[i * 2 + 1];
    return {
      vault: v.id, strategy: v.strategy, tvlUsd: Math.round(chainTvl[v.id] || 0),
      callRewardNative: r.success && r.returnData.length >= 66 ? Number(ethers.formatEther(BigInt(r.returnData))) : null,
      paused: p.success && p.returnData.length >= 66 ? BigInt(p.returnData) === 1n : null
    };
  });
  return { chain: chainKey, block, native: c.native, rows };
}

// Simulación de harvest(address callFeeRecipient) SIN firmar ni enviar nada: eth_call + eth_estimateGas
async function simulateHarvest(vaultId, recipient) {
  const provider = new ethers.JsonRpcProvider(process.env.BNB_RPC_URL);
  const vaults = await fetch("https://api.beefy.finance/vaults").then(r => r.json());
  const v = vaults.find(x => x.id === vaultId && x.chain === "bsc");
  if (!v) return console.log("\nSimulación: bóveda " + vaultId + " no encontrada");
  const iface = new ethers.Interface(["function harvest(address callFeeRecipient)", "function callReward() view returns (uint256)"]);
  const tx = { from: recipient, to: v.strategy, data: iface.encodeFunctionData("harvest", [recipient]) };
  const reward = Number(ethers.formatEther(await provider.call({ to: v.strategy, data: iface.encodeFunctionData("callReward") })));
  const fee = await provider.getFeeData();
  const gasPrice = fee.gasPrice || fee.maxFeePerGas;
  const router = new ethers.Contract("0x10ED43C718714eb63d5aA57B78B54704E256024E", ["function getAmountsOut(uint256,address[]) view returns (uint256[])"], provider);
  const bnbUsd = Number(ethers.formatUnits((await router.getAmountsOut(ethers.parseEther("1"), ["0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"]))[1], 18));
  console.log("\n=== SIMULACIÓN harvest() · " + vaultId + " · estrategia " + v.strategy + " ===");
  console.log("callReward: " + reward.toFixed(6) + " BNB ≈ $" + (reward * bnbUsd).toFixed(4) + " | BNB ≈ $" + bnbUsd.toFixed(2) + " | gasPrice " + (Number(gasPrice) / 1e9).toFixed(4) + " Gwei");
  try {
    await provider.call(tx);
    console.log("eth_call: PASA sin revertir");
  } catch (e) {
    return console.log("eth_call: REVIERTE → " + (e.shortMessage || e.message));
  }
  try {
    const gas = await provider.estimateGas(tx);
    const costBnb = Number(ethers.formatEther(gas * gasPrice));
    const costUsd = costBnb * bnbUsd;
    console.log("eth_estimateGas: " + gas + " gas → " + costBnb.toFixed(8) + " BNB ≈ $" + costUsd.toFixed(4));
    console.log("Neto estimado: $" + (reward * bnbUsd - costUsd).toFixed(4) + " (recompensa − gas, sin margen de seguridad)");
  } catch (e) {
    console.log("eth_estimateGas falló: " + (e.shortMessage || e.message));
  }
}
(async () => {
  console.log(`selectores: callReward()=${SEL_CALL_REWARD} paused()=${SEL_PAUSED}`);
  for (const k of Object.keys(CHAINS)) {
    try {
      const r = await scan(k);
      console.log(`\n=== ${k.toUpperCase()} · bloque ${r.block} · top ${r.rows.length} bóvedas activas por TVL ===`);
      r.rows.forEach(x => console.log(`${x.vault.padEnd(34)} ${x.strategy} TVL $${String(x.tvlUsd).padStart(10)} | callReward ${x.callRewardNative === null ? "n/d (sin función pública)" : x.callRewardNative.toFixed(6) + " " + r.native} | paused ${x.paused}`));
    } catch (e) { console.log(`${k}: error ${e.message}`); }
  }
  try { await simulateHarvest("pancake-cow-bsc-usdt-wbnb-vault", "0xD4D12077a61118372f7a367319fb11922Beb3743"); } catch (e) { console.log("Simulación harvest: error " + e.message); }
})();
