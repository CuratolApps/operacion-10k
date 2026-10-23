/**
 * arm-atomic-executors.js — Deja armados los 2 AtomicSniperExecutor (Polygon y BSC) desde #501.
 *
 * - Verifica código y OWNER() == #501 en cada contrato.
 * - Ejecuta `approve` ACOTADO (no ilimitado) de USDC hacia el ejecutor de su red. Los USDC se quedan en #501:
 *   el contrato solo los jala con transferFrom dentro de execute() y los devuelve en la misma tx.
 * - Idempotente: si el allowance ya cubre el tope, no firma nada. Respeta el piso de 150.00 POL.
 * Uso: node scripts/arm-atomic-executors.js [--dry]
 */
const { NETS, ERC20_ABI, ethers, MOTHERSHIP, provider, readTel, signer501, sendRawAndWait } = require("./atomic-common");
const fs = require("fs");
const path = require("path");

(async () => {
  const dry = process.argv.includes("--dry");
  const art = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "contracts", "AtomicSniperExecutor.artifact.json"), "utf8"));
  const tel = readTel();
  for (const key of ["polygon", "bsc"]) {
    const net = NETS[key];
    const exec = tel[net.executorKey];
    console.log(`\n[${net.name}]`);
    if (!exec) { console.log("   ⛔ sin ejecutor registrado en telemetría"); continue; }
    const prov = provider(key);
    const code = await prov.getCode(exec.toLowerCase());
    const owner = code.length > 2 ? await new ethers.Contract(exec, art.abi, prov).OWNER() : null;
    console.log(`   ejecutor ${exec} | código: ${code.length > 2 ? "OK" : "NO"} | OWNER()==#501: ${!!owner && owner.toLowerCase() === MOTHERSHIP.toLowerCase()}`);
    if (!owner || owner.toLowerCase() !== MOTHERSHIP.toLowerCase()) { console.log("   ⛔ no se aprueba"); continue; }

    const usdc = new ethers.Contract(net.usdc, ERC20_ABI, prov);
    const cap = ethers.parseUnits(String(net.allowanceCapUsdc), net.usdcDec);
    const allowance = await usdc.allowance(MOTHERSHIP, exec);
    const bal = await usdc.balanceOf(MOTHERSHIP);
    console.log(`   USDC en #501: ${ethers.formatUnits(bal, net.usdcDec)} | allowance actual: ${ethers.formatUnits(allowance, net.usdcDec)} | tope a aprobar: ${net.allowanceCapUsdc}`);
    if (allowance >= cap) { console.log("   ✅ ya armado (allowance ≥ tope)"); continue; }

    const data = usdc.interface.encodeFunctionData("approve", [exec, cap]);
    const gasLimit = 80000n;
    const fee = await prov.getFeeData();
    const native = await prov.getBalance(MOTHERSHIP);
    const req = key === "polygon"
      ? { to: net.usdc, data, gasLimit, maxFeePerGas: fee.maxFeePerGas, maxPriorityFeePerGas: fee.maxPriorityFeePerGas, value: 0n }
      : { to: net.usdc, data, gasLimit, gasPrice: fee.gasPrice > ethers.parseUnits("0.1", "gwei") ? fee.gasPrice : ethers.parseUnits("0.1", "gwei"), value: 0n };
    const worst = gasLimit * (req.maxFeePerGas || req.gasPrice);
    console.log(`   saldo ${net.nativeSym}: ${ethers.formatEther(native)} | peor caso del approve: ${ethers.formatEther(worst)} ${net.nativeSym}`);
    if (native - worst < ethers.parseEther(String(net.floorNative))) { console.log(`   ⛔ dejaría #501 bajo el piso (${net.floorNative} ${net.nativeSym}). No se firma.`); continue; }
    if (dry) { console.log("   --dry: no se firmó nada."); continue; }

    const signer = signer501(prov);
    if ((await signer.getAddress()).toLowerCase() !== MOTHERSHIP.toLowerCase()) throw new Error("Signer #501 no coincide");
    const r = await sendRawAndWait(prov, signer, req, "approve");
    const after = await usdc.allowance(MOTHERSHIP, exec);
    const nativeAfter = await prov.getBalance(MOTHERSHIP);
    console.log(`   status ${r.status} | gas ${r.gasUsed} | allowance ahora: ${ethers.formatUnits(after, net.usdcDec)} | ${net.nativeSym} #501: ${ethers.formatEther(nativeAfter)}`);
    if (r.status !== 1) throw new Error("approve revertido");
  }
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
