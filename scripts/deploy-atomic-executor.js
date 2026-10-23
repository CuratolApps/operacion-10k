/**
 * deploy-atomic-executor.js — Despliega contracts/AtomicSniperExecutor.sol en Polygon desde #501.
 *
 * Reglas: NO envía USDC ni POL al contrato, NO ejecuta disparos. Aborta si el coste del deploy supera
 * MAX_DEPLOY_POL o si #501 quedaría por debajo del piso de 150.00 POL. Nunca imprime claves.
 * Uso: node scripts/deploy-atomic-executor.js [--dry]   (--dry solo estima y no firma nada)
 */
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { ethers } = require("ethers");
const { getWalletSigner } = require("../swarm-engine");

const MAX_DEPLOY_POL = 0.35;           // tope autorizado por el usuario (antes 0.05)
const MOTHERSHIP_FLOOR_POL = 150.0;    // piso inviolable de #501
const EXPECTED_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const TG_CHAT = "-1004342131598";

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

(async () => {
  const dry = process.argv.includes("--dry");
  const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
  const art = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "contracts", "AtomicSniperExecutor.artifact.json"), "utf8"));
  const signer = getWalletSigner(501, provider);
  const from = await signer.getAddress();
  if (from.toLowerCase() !== EXPECTED_501.toLowerCase()) throw new Error("La cuenta #501 derivada no coincide con la dirección oficial. Abortado.");

  const factory = new ethers.ContractFactory(art.abi, art.bytecode, signer);
  const tx = await factory.getDeployTransaction();
  const est = await provider.estimateGas({ from, data: tx.data });
  const gasLimit = est * 105n / 100n;
  const fee = await provider.getFeeData();
  const capWei = ethers.parseEther(String(MAX_DEPLOY_POL));
  const maxFee = capWei / gasLimit;                       // tope por gas para que el peor caso <= MAX_DEPLOY_POL
  const gasPrice = fee.gasPrice;
  const balBefore = await provider.getBalance(from);
  const expectedCost = est * gasPrice;
  console.log(`gas est: ${est} | gasPrice: ${ethers.formatUnits(gasPrice, "gwei")} gwei | coste esperado: ${ethers.formatEther(expectedCost)} POL | tope: ${MAX_DEPLOY_POL} POL`);
  console.log(`#501 saldo antes: ${ethers.formatEther(balBefore)} POL`);
  if (maxFee < gasPrice * 105n / 100n) throw new Error("Gas actual demasiado alto para el tope autorizado. Abortado sin firmar.");
  if (balBefore - capWei < ethers.parseEther(String(MOTHERSHIP_FLOOR_POL))) throw new Error("El peor caso dejaría #501 bajo 150.00 POL. Abortado.");
  if (dry) { console.log("--dry: no se firmó nada."); return; }

  const prio = fee.maxPriorityFeePerGas && fee.maxPriorityFeePerGas < maxFee ? fee.maxPriorityFeePerGas : maxFee / 2n;
  const sent = await signer.sendTransaction({ data: tx.data, gasLimit, maxFeePerGas: maxFee, maxPriorityFeePerGas: prio, value: 0n });
  console.log("txHash:", sent.hash);
  const rcpt = await sent.wait();
  const address = rcpt.contractAddress;
  const code = await provider.getCode(address);
  const balAfter = await provider.getBalance(from);
  const spent = balBefore - balAfter;
  console.log(`contrato: ${address} | código: ${code.length > 2 ? "OK" : "VACÍO"} | gas usado: ${rcpt.gasUsed} | coste: ${ethers.formatEther(spent)} POL | #501 después: ${ethers.formatEther(balAfter)} POL`);
  if (code.length <= 2) throw new Error("Despliegue sin bytecode");

  const file = path.join(__dirname, "..", "telemetry", "fleet-telemetry.json");
  const tel = JSON.parse(fs.readFileSync(file, "utf8"));
  tel.atomicExecutorAddressPolygon = address;
  tel.atomicExecutorDeployTxPolygon = sent.hash;
  tel.atomicExecutorDeployInfo = { deployedAt: new Date().toISOString(), deployer: from, gasUsed: rcpt.gasUsed.toString(), costPol: Number(ethers.formatEther(spent)), usdcInContract: 0, shotsExecuted: 0 };
  fs.writeFileSync(file, JSON.stringify(tel, null, 2));

  const ok = await telegram(
    `🛠️ AtomicSniperExecutor desplegado en Polygon\nContrato: ${address}\nTx: ${sent.hash}\nhttps://polygonscan.com/tx/${sent.hash}\nCoste: ${Number(ethers.formatEther(spent)).toFixed(4)} POL · #501: ${Number(ethers.formatEther(balAfter)).toFixed(4)} POL\nUSDC en contrato: $0.00 · sin disparos`);
  console.log("Telegram:", ok ? "enviado" : "no enviado");
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
