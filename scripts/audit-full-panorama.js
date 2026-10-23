/**
 * audit-full-panorama.js — Auditoría forense SOLO LECTURA (Multicall3, Polygon + BSC).
 * No lee ni imprime claves privadas. Solo usa POLYGON_RPC_URL / BNB_RPC_URL de .env.
 */
require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const MC3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MC_ABI = [
  "function aggregate3(tuple(address target,bool allowFailure,bytes callData)[] calls) view returns (tuple(bool success,bytes returnData)[])",
  "function getEthBalance(address) view returns (uint256)"
];
const ERC20 = new ethers.Interface(["function balanceOf(address) view returns (uint256)"]);
const MC_IFACE = new ethers.Interface(MC_ABI);

const NODRIZAS = {
  "#501": "0xD4D12077a61118372f7a367319fb11922Beb3743", "#001": "0xb7505DD7FCC31A71D033F8a495D6B562420AD40F",
  "#101": "0x568227fc15ef4713F1d51bd6520F384FE1F4adBA", "#201": "0x2810aa0DabCA4511846194229d2c004B14016A7C",
  "#301": "0xEb6a667C9c0F5Bb1eCb6f19f20e9f25D8B54Ca0f", "#401": "0x4C713c5984B033d63061aDc936DfDb8C4Bc6d070",
  "#008": "0x0EE1dE68C1F101233F9607FfD124DaA55943Ce42", "#006": "0x0a16cA725A468f4D6c14885a24DC8e9B4D1c1cA7",
  "#108": "0x0526D0f58a4FE4A427AC4da8e3BDF8756f8bb7bC", "#106": "0x6C66C9724AeD2407e80E805B105d82270471785d",
  "#204": "0x1F25792B65D36DF127E6d6C6AcEe07811cA3d119", "#205": "0xf2CC5e4dfBE74B1945D7dACfD5ef652A6c045a08",
  "#307": "0xc4E7Fc96695eF0593592EcE10A807bbF0C92f27d", "#311": "0xF3d19755705FdBE34f2930d9bABB51fE379E865d",
  "#403": "0x8B857C207A2456022bE5e5DfD3e205E95CA75be5", "#411": "0x3Bc2dBFA23294231a30683D691BFEaCDf56d3c12"
};
const TOK = {
  polygon: { usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", usdce: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", d: [6, 6] },
  bsc: { usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", usdt: "0x55d398326f99059fF775485246999027B3197955", d: [18, 18] }
};

async function census(provider, chain, addrs) {
  const t = TOK[chain];
  const tokens = chain === "polygon" ? [t.usdc, t.usdce] : [t.usdc, t.usdt];
  const calls = [];
  addrs.forEach(a => {
    calls.push({ target: MC3, allowFailure: true, callData: MC_IFACE.encodeFunctionData("getEthBalance", [a]) });
    tokens.forEach(tk => calls.push({ target: tk, allowFailure: true, callData: ERC20.encodeFunctionData("balanceOf", [a]) }));
  });
  const mc = new ethers.Contract(MC3, MC_ABI, provider);
  const out = [];
  const CH = 300;
  for (let i = 0; i < calls.length; i += CH) {
    const r = await mc.aggregate3(calls.slice(i, i + CH));
    out.push(...r);
  }
  const stride = 1 + tokens.length;
  return addrs.map((a, i) => {
    const g = k => { const x = out[i * stride + k]; return x && x.success && x.returnData !== "0x" ? BigInt(x.returnData) : 0n; };
    return { native: Number(ethers.formatUnits(g(0), 18)), t1: Number(ethers.formatUnits(g(1), t.d[0])), t2: Number(ethers.formatUnits(g(2), t.d[1])) };
  });
}

(async () => {
  const polyUrl = process.env.POLYGON_RPC_URL, bscUrl = process.env.BNB_RPC_URL;
  if (!polyUrl || !bscUrl) throw new Error("Faltan POLYGON_RPC_URL / BNB_RPC_URL en .env");
  const pp = new ethers.JsonRpcProvider(polyUrl), pb = new ethers.JsonRpcProvider(bscUrl);

  const ids = Object.keys(NODRIZAS), addrs = ids.map(i => NODRIZAS[i].toLowerCase());
  const [P, B] = await Promise.all([census(pp, "polygon", addrs), census(pb, "bsc", addrs)]);

  const f = (n, d = 4) => n.toFixed(d);
  console.log("\n=== 1. CENSO REAL 16 NODRIZAS (Multicall3) ===");
  console.log("ID   | Dirección                                  | POL       | USDC nat  | USDC.e   | BNB        | USDC BSC  | USDT BSC");
  const tot = { pol: 0, un: 0, ue: 0, bnb: 0, bu: 0, bt: 0 };
  ids.forEach((id, i) => {
    console.log(`${id} | ${addrs[i]} | ${f(P[i].native, 2).padStart(9)} | ${f(P[i].t1, 2).padStart(9)} | ${f(P[i].t2, 2).padStart(8)} | ${f(B[i].native, 4).padStart(10)} | ${f(B[i].t1, 2).padStart(9)} | ${f(B[i].t2, 2).padStart(8)}`);
    tot.pol += P[i].native; tot.un += P[i].t1; tot.ue += P[i].t2; tot.bnb += B[i].native; tot.bu += B[i].t1; tot.bt += B[i].t2;
  });
  console.log(`TOTAL 16 | POL ${f(tot.pol, 2)} | USDC nat ${f(tot.un, 2)} | USDC.e ${f(tot.ue, 2)} | BNB ${f(tot.bnb, 4)} | USDC BSC ${f(tot.bu, 2)} | USDT BSC ${f(tot.bt, 2)}`);
  const fleet = tot.pol - P[0].native;
  console.log(`Tanque flota (15 sin #501): ${f(fleet, 2)} POL | #501: ${f(P[0].native, 2)} POL | #501+flota: ${f(tot.pol, 2)} POL`);

  // Satélites restantes (direcciones públicas)
  const list = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "wallets-public-list.json"), "utf8"));
  const known = new Set(addrs.map(a => a.toLowerCase()));
  const rest = list.filter(w => w.index !== 0 && w.address && !known.has(w.address.toLowerCase())).map(w => w.address);
  console.log(`\n=== Resto de satélites en wallets-public-list.json: ${rest.length} direcciones ===`);
  const [RP, RB] = await Promise.all([census(pp, "polygon", rest), census(pb, "bsc", rest)]);
  const sum = (arr, k) => arr.reduce((s, x) => s + x[k], 0);
  console.log(`Resto: POL ${f(sum(RP, "native"), 2)} | USDC nat ${f(sum(RP, "t1"), 2)} | USDC.e ${f(sum(RP, "t2"), 2)} | BNB ${f(sum(RB, "native"), 4)} | USDC BSC ${f(sum(RB, "t1"), 2)} | USDT BSC ${f(sum(RB, "t2"), 2)}`);
  console.log(`Con POL > 0.5 en resto: ${RP.filter(x => x.native > 0.5).length} | con BNB > 0.0005: ${RB.filter(x => x.native > 0.0005).length}`);
  console.log(`GRAN TOTAL (16 + resto): POL ${f(tot.pol + sum(RP, "native"), 2)} | BNB ${f(tot.bnb + sum(RB, "native"), 4)}`);
})().catch(e => { console.error("ERROR auditoría:", e.message); process.exit(1); });
