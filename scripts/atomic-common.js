/**
 * atomic-common.js — utilidades compartidas por arm-atomic-executors.js y atomic-auto-shooter.js.
 * Nunca imprime claves. El signer sale de swarm-engine.getWalletSigner(501).
 */
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { ethers } = require("ethers");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const MOTHERSHIP = "0xD4D12077a61118372f7a367319fb11922Beb3743"; // #501
const TG_CHAT = "-1004342131598";
const TEL_FILE = path.join(__dirname, "..", "telemetry", "fleet-telemetry.json");

const NETS = {
  polygon: {
    key: "polygon", name: "Polygon", chainId: 137, nativeSym: "POL", explorer: "https://polygonscan.com",
    rpc: () => process.env.POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com",
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", usdcDec: 6,
    aToken: "0xA4D94019934D8333Ef880ABFFbF2FDd611C762BD",
    aavePool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    executorKey: "atomicExecutorAddressPolygon",
    defaultExecutor: "0x03Ac6307eF8c2Ec6ba724072D823bbf0b5DC6b67",
    floorNative: 150.0,           // piso inviolable de #501 (POL)
    allowanceCapUsdc: 4000        // 15 disparos x ~$243.99 (se consume en cada transferFrom)
  },
  bsc: {
    key: "bsc", name: "BSC", chainId: 56, nativeSym: "BNB", explorer: "https://bscscan.com",
    rpc: () => (process.env.BNB_RPC_URL && !process.env.BNB_RPC_URL.includes("alchemy.com")) ? process.env.BNB_RPC_URL : "https://bsc-dataseed.binance.org",
    usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", usdcDec: 18,
    executorKey: "atomicExecutorAddressBsc",
    defaultExecutor: "0xD935F7B80237aA14B6D8F9D45070800e9E23Db20",
    floorNative: 0.002,           // colchón mínimo de BNB para gas
    allowanceCapUsdc: 350         // 15 disparos x ~$21.52 (se consume en cada transferFrom)
  }
};

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)"
];

const AAVE_POOL_ABI = [
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external",
  "function withdraw(address asset, uint256 amount, address to) external returns (uint256)"
];

function provider(chain) { return new ethers.JsonRpcProvider(NETS[chain].rpc(), NETS[chain].chainId, { staticNetwork: true }); }
function readTel() { return JSON.parse(fs.readFileSync(TEL_FILE, "utf8")); }
function writeTel(t) { fs.writeFileSync(TEL_FILE, JSON.stringify(t, null, 2)); }

function signer501(prov) {
  const { getWalletSigner } = require("../swarm-engine");
  const s = getWalletSigner(501, prov);
  return s;
}

// Envío y espera por RPC crudo (Alchemy BSC devuelve `to: ""` y rompe el parser de ethers en creaciones;
// se usa siempre para no dejar nunca una tx enviada sin registrar).
async function sendRawAndWait(prov, signer, txReq, label = "tx") {
  const populated = await signer.populateTransaction(txReq);
  const signed = await signer.signTransaction(populated);
  const hash = await prov.send("eth_sendRawTransaction", [signed]);
  console.log(`   ${label} enviada: ${hash}`);
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const r = await prov.send("eth_getTransactionReceipt", [hash]);
    if (r) return { hash, status: parseInt(r.status, 16), gasUsed: BigInt(r.gasUsed), blockNumber: parseInt(r.blockNumber, 16), logs: r.logs || [], effectiveGasPrice: BigInt(r.effectiveGasPrice || "0x0") };
  }
  throw new Error(`Receipt no recibido para ${hash}`);
}

async function telegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID_OVERRIDE || TG_CHAT, text, disable_web_page_preview: true })
    });
    return r.ok;
  } catch (_) { return false; }
}

module.exports = { MOTHERSHIP, TG_CHAT, TEL_FILE, NETS, ERC20_ABI, AAVE_POOL_ABI, ethers, provider, readTel, writeTel, signer501, sendRawAndWait, telegram };
