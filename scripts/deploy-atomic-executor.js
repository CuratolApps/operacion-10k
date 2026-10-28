/**
 * deploy-atomic-executor.js — Despliega contracts/AtomicSniperExecutor.sol desde #501.
 *
 * Reglas: NO envía USDC ni nativo al contrato, NO ejecuta disparos. Aborta si el coste del deploy supera
 * el tope de la red o si #501 quedaría por debajo de su piso. Verifica OWNER() == #501. Nunca imprime claves.
 * Uso: node scripts/deploy-atomic-executor.js [--chain polygon|bsc] [--dry]   (--dry solo estima y no firma)
 */
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { ethers } = require("ethers");
const { getWalletSigner } = require("../swarm-engine");

const EXPECTED_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const TG_CHAT = "-1004342131598";

const NETS = {
  polygon: {
    rpc: () => (process.env.POLYGON_RPC_URL && !process.env.POLYGON_RPC_URL.includes("alchemy.com")) ? process.env.POLYGON_RPC_URL : "https://polygon-bor-rpc.publicnode.com",
    maxDeployNative: 1.0, floorNative: 5.0, sym: "POL",
    explorer: "https://polygonscan.com", addrKey: "atomicExecutorAddressPolygon", txKey: "atomicExecutorDeployTxPolygon", infoKey: "atomicExecutorDeployInfo"
  },
  bsc: {
    rpc: () => (process.env.BNB_RPC_URL && !process.env.BNB_RPC_URL.includes("alchemy.com")) ? process.env.BNB_RPC_URL : "https://bsc-dataseed.binance.org",
    maxDeployNative: 0.0005, floorNative: 0, sym: "BNB", legacyGas: true,
    explorer: "https://bscscan.com", addrKey: "atomicExecutorAddressBsc", txKey: "atomicExecutorDeployTxBsc", infoKey: "atomicExecutorDeployInfoBsc"
  }
};

async function telegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text, disable_web_page_preview: true })
    });
    return r.ok;
  } catch (_) { return false; }
}

// Envío y espera por RPC crudo: algunos nodos (Alchemy BSC) devuelven `to: ""` en creaciones y ethers v6 falla al parsear,
// aunque la tx sí se mina. Así nunca queda una tx enviada sin registrar.
async function sendRawAndWait(provider, signer, txReq) {
  const populated = await signer.populateTransaction(txReq);
  const signed = await signer.signTransaction(populated);
  const hash = await provider.send("eth_sendRawTransaction", [signed]);
  console.log("txHash:", hash);
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const r = await provider.send("eth_getTransactionReceipt", [hash]);
    if (r) return { hash, status: parseInt(r.status, 16), contractAddress: r.contractAddress ? ethers.getAddress(r.contractAddress) : null, gasUsed: BigInt(r.gasUsed) };
  }
  throw new Error(`Receipt no recibido para ${hash}`);
}

(async () => {
  const dry = process.argv.includes("--dry");
  const ci = process.argv.indexOf("--chain");
  const chain = ci > -1 ? process.argv[ci + 1] : "polygon";
  const net = NETS[chain];
  if (!net) throw new Error("--chain debe ser polygon o bsc");
  const telFile = path.join(__dirname, "..", "telemetry", "fleet-telemetry.json");
  const telPrev = JSON.parse(fs.readFileSync(telFile, "utf8"));
  if (telPrev[net.addrKey] && !process.argv.includes("--force")) throw new Error(`Ya hay un ejecutor registrado en ${chain}: ${telPrev[net.addrKey]}. Usa --force solo si de verdad quieres otro.`);

  const provider = new ethers.JsonRpcProvider(net.rpc());
  const art = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "contracts", "AtomicSniperExecutor.artifact.json"), "utf8"));
  const signer = getWalletSigner(501, provider);
  const from = await signer.getAddress();
  if (from.toLowerCase() !== EXPECTED_501.toLowerCase()) throw new Error("La cuenta #501 derivada no coincide con la dirección oficial. Abortado.");

  const factory = new ethers.ContractFactory(art.abi, art.bytecode, signer);
  const tx = await factory.getDeployTransaction();
  const est = await provider.estimateGas({ from, data: tx.data });
  const gasLimit = est * 105n / 100n;
  const fee = await provider.getFeeData();
  const capWei = ethers.parseEther(String(net.maxDeployNative));
  const gasPrice = net.legacyGas ? (fee.gasPrice > ethers.parseUnits("0.1", "gwei") ? fee.gasPrice : ethers.parseUnits("0.1", "gwei")) : fee.gasPrice;
  const balBefore = await provider.getBalance(from);
  const worstCase = gasLimit * gasPrice;
  console.log(`[${chain}] gas est: ${est} | gasPrice: ${ethers.formatUnits(gasPrice, "gwei")} gwei | coste esperado: ${ethers.formatEther(est * gasPrice)} ${net.sym} | peor caso: ${ethers.formatEther(worstCase)} | tope: ${net.maxDeployNative} ${net.sym}`);
  console.log(`#501 saldo antes: ${ethers.formatEther(balBefore)} ${net.sym}`);
  if (worstCase > capWei) throw new Error("Coste del deploy supera el tope autorizado. Abortado sin firmar.");
  if (balBefore - worstCase < ethers.parseEther(String(net.floorNative))) throw new Error(`El peor caso dejaría #501 bajo ${net.floorNative} ${net.sym}. Abortado.`);
  if (dry) { console.log("--dry: no se firmó nada."); return; }

  const base = { data: tx.data, gasLimit, value: 0n };
  let req;
  if (net.legacyGas) {
    req = { ...base, gasPrice };
  } else {
    const maxFee = capWei / gasLimit;
    if (maxFee < gasPrice * 105n / 100n) throw new Error("Gas actual demasiado alto para el tope autorizado. Abortado sin firmar.");
    const prio = fee.maxPriorityFeePerGas && fee.maxPriorityFeePerGas < maxFee ? fee.maxPriorityFeePerGas : maxFee / 2n;
    req = { ...base, maxFeePerGas: maxFee, maxPriorityFeePerGas: prio };
  }
  const sent = await sendRawAndWait(provider, signer, req);
  const rcpt = { gasUsed: sent.gasUsed, contractAddress: sent.contractAddress };
  if (sent.status !== 1 || !rcpt.contractAddress) throw new Error(`Deploy revertido o sin contrato (tx ${sent.hash})`);
  const address = rcpt.contractAddress;
  const code = await provider.getCode(address);
  if (code.length <= 2) throw new Error("Despliegue sin bytecode");
  const owner = await new ethers.Contract(address, art.abi, provider).OWNER();
  const ownerOk = owner.toLowerCase() === EXPECTED_501.toLowerCase();
  const balAfter = await provider.getBalance(from);
  const spent = balBefore - balAfter;
  console.log(`contrato: ${address} | OWNER()==#501: ${ownerOk} | gas usado: ${rcpt.gasUsed} | coste: ${ethers.formatEther(spent)} ${net.sym} | #501 después: ${ethers.formatEther(balAfter)} ${net.sym}`);
  if (!ownerOk) throw new Error("OWNER() no coincide con #501");

  const file = path.join(__dirname, "..", "telemetry", "fleet-telemetry.json");
  const tel = JSON.parse(fs.readFileSync(file, "utf8"));
  tel[net.addrKey] = address;
  tel[net.txKey] = sent.hash;
  tel[net.infoKey] = { deployedAt: new Date().toISOString(), deployer: from, gasUsed: rcpt.gasUsed.toString(), cost: Number(ethers.formatEther(spent)), costSymbol: net.sym, ownerVerified: ownerOk, usdcInContract: 0, shotsExecuted: 0 };
  fs.writeFileSync(file, JSON.stringify(tel, null, 2));

  const ok = await telegram(
    `🛠️ AtomicSniperExecutor desplegado en ${chain === "bsc" ? "BSC" : "Polygon"}\nContrato: ${address}\nOWNER() = #501 ✔\nTx: ${net.explorer}/tx/${sent.hash}\nCoste: ${Number(ethers.formatEther(spent)).toFixed(6)} ${net.sym}\nUSDC en contrato: $0.00 · sin disparos`);
  console.log("Telegram:", ok ? "enviado" : "no enviado");
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
