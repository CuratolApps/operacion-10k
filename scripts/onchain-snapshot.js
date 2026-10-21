/**
 * scripts/onchain-snapshot.js - Operación 10k
 * Lectura REAL (solo lectura, sin claves) de saldos on-chain de la flota:
 * Bóveda Matriz #501, 5 cabeceras y 500 satélites, en testnets y mainnets.
 * Alimenta la telemetría para que el Dashboard muestre datos verídicos.
 */

const { ethers } = require("ethers");
const { networks, fetchEthBalancesBatch } = require("../networks");

const MIN_USABLE_NATIVE = 0.0005; // mismo umbral que MIN_EXEC_BALANCE_ETH del task-runner
const HEADER_INDEXES = [1, 101, 201, 301, 401];
const VAULT_INDEX = 501;

// RPCs extra de reserva (algunos RPC públicos fallan por TLS/timeouts según el entorno)
const EXTRA_RPCS = {
  ethereumSepolia: ["https://sepolia.drpc.org"],
  baseSepolia: ["https://base-sepolia.drpc.org"],
  arbitrumSepolia: ["https://arbitrum-sepolia.drpc.org"],
  optimismSepolia: ["https://optimism-sepolia.drpc.org"],
  polygonMainnet: ["https://polygon.drpc.org", "https://polygon.meowrpc.com", "https://rpc.ankr.com/polygon", "https://polygon-mainnet.public.blastapi.io"],
  bscMainnet: ["https://bsc.drpc.org"]
};

const TARGETS = {
  testnet: ["ethereumSepolia", "baseSepolia", "arbitrumSepolia", "optimismSepolia"],
  mainnet: ["bscMainnet", "polygonMainnet"]
};

function makeProvider(url, chainId) {
  const req = new ethers.FetchRequest(url);
  req.timeout = 15000;
  return new ethers.JsonRpcProvider(req, chainId, { staticNetwork: ethers.Network.from(chainId) });
}

async function connect(key) {
  const net = networks[key];
  const urls = [...new Set([net.rpc, net.fallbackRpc, ...(net.backupRpcs || []), ...(EXTRA_RPCS[key] || [])].filter(Boolean))];
  for (const url of urls) {
    try {
      const provider = makeProvider(url, net.chainId);
      const t0 = Date.now();
      const blockNumber = await provider.getBlockNumber();
      return { provider, url, latencyMs: Date.now() - t0, blockNumber };
    } catch (_) { /* siguiente RPC */ }
  }
  return null;
}

const toNum = (wei) => parseFloat(ethers.formatEther(wei));
const boxOf = (index) => Math.min(5, Math.max(1, Math.ceil(index / 100)));

async function snapshotNetwork(key, wallets) {
  const net = networks[key];
  const base = { key, name: net.name, chainId: net.chainId, symbol: net.symbol, online: false };
  const conn = await connect(key);
  if (!conn) return base;

  const satellites = wallets.filter((w) => w.index >= 1 && w.index <= 500);
  const special = wallets.filter((w) => w.index === VAULT_INDEX || HEADER_INDEXES.includes(w.index));
  const addrs = [...new Set([...satellites, ...special].map((w) => w.address))];
  const bals = await fetchEthBalancesBatch(conn.provider, addrs);
  const balOf = (w) => toNum(bals[w.address.toLowerCase()] ?? 0n);

  const byBox = {};
  for (let b = 1; b <= 5; b++) byBox[b] = { total: 0, withGas: 0, usable: 0 };
  let total = 0, withGas = 0, usable = 0;
  for (const s of satellites) {
    const v = balOf(s);
    const box = byBox[boxOf(s.index)];
    total += v; box.total += v;
    if (v > 0) { withGas++; box.withGas++; }
    if (v >= MIN_USABLE_NATIVE) { usable++; box.usable++; }
  }

  const vaultWallet = wallets.find((w) => w.index === VAULT_INDEX);
  const headers = HEADER_INDEXES.map((i) => wallets.find((w) => w.index === i)).filter(Boolean)
    .map((w) => ({ index: w.index, address: w.address, balance: balOf(w) }));

  const balancesByAddress = {};
  for (const w of [...satellites, ...special]) {
    balancesByAddress[w.address.toLowerCase()] = balOf(w);
  }

  return {
    ...base,
    online: true,
    rpc: new URL(conn.url).host,
    latencyMs: conn.latencyMs,
    blockNumber: conn.blockNumber,
    total,
    satellitesWithGas: withGas,
    satellitesUsable: usable,
    satellitesZero: satellites.length - withGas,
    totalSatellites: satellites.length,
    byBox,
    vault: vaultWallet ? { address: vaultWallet.address, balance: balOf(vaultWallet) } : null,
    headers,
    balancesByAddress
  };
}

async function takeSnapshot(wallets) {
  const out = { timestamp: new Date().toISOString(), minUsableNative: MIN_USABLE_NATIVE, testnets: {}, mainnets: {} };
  const jobs = [];
  for (const k of TARGETS.testnet) jobs.push(snapshotNetwork(k, wallets).then((r) => { out.testnets[k] = r; }).catch(() => { out.testnets[k] = { key: k, name: networks[k].name, online: false }; }));
  for (const k of TARGETS.mainnet) jobs.push(snapshotNetwork(k, wallets).then((r) => { out.mainnets[k] = r; }).catch(() => { out.mainnets[k] = { key: k, name: networks[k].name, online: false }; }));
  await Promise.all(jobs);
  return out;
}

module.exports = { takeSnapshot, MIN_USABLE_NATIVE, HEADER_INDEXES, VAULT_INDEX };

if (require.main === module) {
  const wallets = require("../wallets-public-list.json");
  takeSnapshot(wallets).then((s) => {
    for (const grp of [s.testnets, s.mainnets]) {
      for (const n of Object.values(grp)) {
        if (!n.online) { console.log(`${n.name}: OFFLINE`); continue; }
        console.log(`${n.name}: >0=${n.satellitesWithGas} usable(>=${s.minUsableNative})=${n.satellitesUsable} cero=${n.satellitesZero} total=${n.total.toFixed(6)} ${n.symbol} | rpc=${n.rpc} ${n.latencyMs}ms`);
      }
    }
  });
}
