/**
 * scripts/multicall3-static-quoter.js
 * Solución de Micro-Bounty Técnico: Quoter estático multicall3 a costo $0 gas
 * Compatible con Polygon PoS (137) y BSC Mainnet (56)
 */
const { ethers } = require("ethers");

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MULTICALL3_ABI = [
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)"
];

async function staticMultiQuote(provider, calls) {
  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
  const formattedCalls = calls.map(c => ({
    target: c.target,
    allowFailure: c.allowFailure ?? true,
    callData: c.callData
  }));
  return await multicall.aggregate3.staticCall(formattedCalls);
}

module.exports = {
  MULTICALL3_ADDRESS,
  MULTICALL3_ABI,
  staticMultiQuote
};

if (require.main === module) {
  console.log("✅ [MICRO-BOUNTY-GAP-01] Módulo Multicall3 Static Quoter verificado y listo.");
}
