/**
 * scripts/onchain-snapshot.js - Operación 10k
 * Lectura REAL (solo lectura, sin claves) de saldos on-chain de la flota:
 * Bóveda Matriz #501, 5 cabeceras y 500 satélites, en testnets y mainnets.
 * Lee con Multicall3 el USDC Nativo en Polygon y el USDC Oficial en BSC para las 16 Nodrizas Sniper.
 */

const { ethers } = require("ethers");
const { networks, fetchEthBalancesBatch } = require("../networks");

const MIN_USABLE_NATIVE = 0.0005; // mismo umbral que MIN_EXEC_BALANCE_ETH del task-runner
const HEADER_INDEXES = [1, 101, 201, 301, 401];
const VAULT_INDEX = 501;
const SNIPER_INDEXES = [501, 1, 101, 201, 301, 401, 8, 6, 108, 106, 204, 205, 307, 311, 403, 411];
const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
const NATIVE_USDC_POLYGON = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"; // 6 dec (Circle)
const OFFICIAL_USDC_BSC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"; // 18 dec (Binance-Peg)

// RPCs extra de reserva
const EXTRA_RPCS = {
  ethereumSepolia: ["https://sepolia.drpc.org"],
  baseSepolia: ["https://base-sepolia.drpc.org"],
  arbitrumSepolia: ["https://arbitrum-sepolia.drpc.org"],
  optimismSepolia: ["https://optimism-sepolia.drpc.org"],
  polygonMainnet: ["https://polygon.drpc.org", "https://polygon-bor-rpc.publicnode.com", "https://polygon.meowrpc.com", "https://rpc.ankr.com/polygon", "https://polygon-mainnet.public.blastapi.io"],
  bscMainnet: ["https://bsc-dataseed.binance.org", "https://bsc.drpc.org", "https://bsc-rpc.publicnode.com", "https://rpc.ankr.com/bsc"]
};

const TARGETS = {
  testnet: ["ethereumSepolia", "baseSepolia", "arbitrumSepolia", "optimismSepolia"],
  mainnet: ["bscMainnet", "polygonMainnet"]
};

function makeProvider(url, chainId) {
  const req = new ethers.FetchRequest(url);
  req.timeout = 15000;
  const opts = { staticNetwork: ethers.Network.from(chainId) };
  if (/drpc\.org/i.test(url)) opts.batchMaxCount = 1;
  return new ethers.JsonRpcProvider(req, chainId, opts);
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
  let vaultUsdc = 0;
  const headersUsdc = {};
  const snipersUsdc = {};

  if (key === "polygonMainnet" || key === "bscMainnet") {
    try {
      const usdcTokenAddr = key === "polygonMainnet" ? NATIVE_USDC_POLYGON : OFFICIAL_USDC_BSC;
      const decimals = key === "polygonMainnet" ? 6 : 18;
      const erc20Iface = new ethers.Interface(["function balanceOf(address) view returns (uint256)"]);
      const m3 = new ethers.Contract(
        MULTICALL3_ADDRESS,
        ["function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[] returnData)"],
        conn.provider
      );

      const sniperWallets = SNIPER_INDEXES.map((idx) => wallets.find((w) => w.index === idx)).filter(Boolean);
      const calls = sniperWallets.map((w) => ({
        target: usdcTokenAddr,
        allowFailure: true,
        callData: erc20Iface.encodeFunctionData("balanceOf", [w.address])
      }));

      const results = await m3.aggregate3.staticCall(calls);
      sniperWallets.forEach((w, i) => {
        let bal = 0;
        if (results[i] && results[i].success && results[i].returnData !== "0x") {
          const [uBal] = erc20Iface.decodeFunctionResult("balanceOf", results[i].returnData);
          bal = parseFloat(ethers.formatUnits(uBal, decimals));
        }
        snipersUsdc[w.index] = bal;
        if (w.index === VAULT_INDEX) vaultUsdc = bal;
        if (HEADER_INDEXES.includes(w.index)) headersUsdc[w.index] = bal;
      });
    } catch (err) {
      console.warn(`⚠️ Error leyendo USDC en ${key}:`, err.message);
    }
  }

  const headers = HEADER_INDEXES.map((i) => wallets.find((w) => w.index === i)).filter(Boolean)
    .map((w) => ({ index: w.index, address: w.address, balance: balOf(w), usdcBalance: headersUsdc[w.index] || 0 }));

  const snipers16 = SNIPER_INDEXES.map((i) => wallets.find((w) => w.index === i)).filter(Boolean)
    .map((w) => ({ index: w.index, address: w.address, balance: balOf(w), usdcBalance: snipersUsdc[w.index] || 0 }));

  const totalSniperUsdc = Object.values(snipersUsdc).reduce((acc, v) => acc + v, 0);

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
    vault: vaultWallet ? { address: vaultWallet.address, balance: balOf(vaultWallet), usdcBalance: vaultUsdc } : null,
    headers,
    snipers16,
    snipersUsdc,
    totalSniperUsdc,
    balancesByAddress
  };
}

async function takeSnapshot(wallets) {
  const out = { timestamp: new Date().toISOString(), minUsableNative: MIN_USABLE_NATIVE, testnets: {}, mainnets: {} };
  const jobs = [];
  for (const k of TARGETS.testnet) jobs.push(snapshotNetwork(k, wallets).then((r) => { out.testnets[k] = r; }).catch(() => { out.testnets[k] = { key: k, name: networks[k].name, online: false }; }));
  for (const k of TARGETS.mainnet) jobs.push(snapshotNetwork(k, wallets).then((r) => { out.mainnets[k] = r; }).catch(() => { out.mainnets[k] = { key: k, name: networks[k].name, online: false }; }));
  await Promise.all(jobs);

  const polyUsdc = out.mainnets?.polygonMainnet?.totalSniperUsdc || 0;
  const bscUsdc = out.mainnets?.bscMainnet?.totalSniperUsdc || 0;
  const totalOnChainSniperUsdc = parseFloat((polyUsdc + bscUsdc).toFixed(6));
  const binanceSpotUsdc = 1.00; // $1.00 USDC transferido a Bóveda Binance #1
  out.totalOnChainFleetUsdc = totalOnChainSniperUsdc;
  out.totalHistoricalUsdc = parseFloat((totalOnChainSniperUsdc + binanceSpotUsdc).toFixed(6));
  out.polyUsdc = polyUsdc;
  out.bscUsdc = bscUsdc;

  return out;
}

module.exports = { takeSnapshot, MIN_USABLE_NATIVE, HEADER_INDEXES, VAULT_INDEX, SNIPER_INDEXES };

if (require.main === module) {
  const wallets = require("../wallets-public-list.json");
  takeSnapshot(wallets).then((s) => {
    for (const grp of [s.testnets, s.mainnets]) {
      for (const n of Object.values(grp)) {
        if (!n.online) { console.log(`${n.name}: OFFLINE`); continue; }
        console.log(`${n.name}: >0=${n.satellitesWithGas} usable(>=${s.minUsableNative})=${n.satellitesUsable} total=${n.total.toFixed(6)} ${n.symbol} | USDC Snipers=${n.totalSniperUsdc || 0}`);
      }
    }
    console.log(`\n💎 TOTAL ON-CHAIN SNIPERS: $${s.totalOnChainFleetUsdc} USDC (POL: $${s.polyUsdc.toFixed(6)} + BSC: $${s.bscUsdc.toFixed(6)})`);
    console.log(`🏦 TOTAL HISTÓRICO GLOBAL (ON-CHAIN + BINANCE SPOT #1): $${s.totalHistoricalUsdc} USDC\n`);
  });
}
