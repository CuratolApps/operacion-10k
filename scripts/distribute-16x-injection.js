/**
 * scripts/distribute-16x-injection.js — Operación 12K
 * Distribución Táctica de la Inyección de 55 € (+348.10 POL & +0.0355 BNB en #501)
 * para armar el Escuadrón de 16 Nodrizas Sniper.
 *
 * Fase 1: Bóveda Matriz #501 -> 5 Capitanes de Box (+26.00 POL y +0.0025 BNB c/u con Jitter)
 * Fase 2: 5 Capitanes de Box -> 10 Sub-Capitanes Intra-Box (+8.00 POL c/u con Jitter)
 *
 * Reglas de Hierro:
 * - Aislamiento Anti-Sybil estricto (dispersión intra-box).
 * - Pausas aleatorias entre envíos.
 * - Sin exposición de claves privadas.
 */

require("dotenv").config();
const { ethers } = require("ethers");
const { getMasterVaultWallet, getWalletSigner } = require("../swarm-engine");
const { networks } = require("../networks");

const CAPTAINS = [
  { box: 1, index: 1, id: "#001", address: "0xb7505DD7FCC31A71D033F8a495D6B562420AD40F" },
  { box: 2, index: 101, id: "#101", address: "0x568227fc15ef4713F1d51bd6520F384FE1F4adBA" },
  { box: 3, index: 201, id: "#201", address: "0x2810aa0DabCA4511846194229d2c004B14016A7C" },
  { box: 4, index: 301, id: "#301", address: "0xEb6a667C9c0F5Bb1eCb6f19f20e9f25D8B54Ca0f" },
  { box: 5, index: 401, id: "#401", address: "0x4C713c5984B033d63061aDc936DfDb8C4Bc6d070" }
];

const SUB_CAPTAINS_BY_BOX = {
  1: [
    { index: 8, id: "#008", address: "0x0EE1dE68C1F101233F9607FfD124DaA55943Ce42" },
    { index: 6, id: "#006", address: "0x0a16cA725A468f4D6c14885a24DC8e9B4D1c1cA7" }
  ],
  2: [
    { index: 108, id: "#108", address: "0x0526D0f58a4FE4A427AC4da8e3BDF8756f8bb7bC" },
    { index: 106, id: "#106", address: "0x6C66C9724AeD2407e80E805B105d82270471785d" }
  ],
  3: [
    { index: 204, id: "#204", address: "0x1F25792B65D36DF127E6d6C6AcEe07811cA3d119" },
    { index: 205, id: "#205", address: "0xf2CC5e4dfBE74B1945D7dACfD5ef652A6c045a08" }
  ],
  4: [
    { index: 307, id: "#307", address: "0xc4E7Fc96695eF0593592EcE10A807bbF0C92f27d" },
    { index: 311, id: "#311", address: "0xF3d19755705FdBE34f2930d9bABB51fE379E865d" }
  ],
  5: [
    { index: 403, id: "#403", address: "0x8B857C207A2456022bE5e5DfD3e205E95CA75be5" },
    { index: 411, id: "#411", address: "0x3Bc2dBFA23294231a30683D691BFEaCDf56d3c12" }
  ]
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runDisbursement() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("=========================================================================================");
  console.log("   🦅 DISPERSIÓN TÁCTICA DE INYECCIÓN 55€ — ESCALADO A 16 NODRIZAS SNIPER              ");
  console.log("=========================================================================================");
  console.log(`Modo: ${isDryRun ? "🧪 SIMULACIÓN (DRY-RUN)" : "🔥 PRODUCCIÓN EN VIVO (ON-CHAIN)"}\n`);

  const polProvider = new ethers.JsonRpcProvider("https://polygon.drpc.org", 137);
  const bscProvider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org", 56);

  const signer501Pol = getMasterVaultWallet(polProvider);
  const signer501Bsc = getMasterVaultWallet(bscProvider);

  const bal501Pol = parseFloat(ethers.formatEther(await polProvider.getBalance(signer501Pol.address)));
  const bal501Bsc = parseFloat(ethers.formatEther(await bscProvider.getBalance(signer501Bsc.address)));

  console.log(`🏦 Bóveda Matriz #501 (${signer501Pol.address}):`);
  console.log(`   • POL: ${bal501Pol.toFixed(4)} POL (Reserva Sagrada Blindada: 80.00 POL)`);
  console.log(`   • BNB: ${bal501Bsc.toFixed(6)} BNB (Reserva Sagrada Blindada: 0.010 BNB)\n`);

  if (bal501Pol < 200.0) {
    console.error(`❌ Saldo POL insuficiente en #501 para dispersión (${bal501Pol} < 200 POL). Abortando.`);
    process.exit(1);
  }

  // =====================================================================================
  // FASE 1: BÓVEDA MATRIZ #501 -> 5 CAPITANES DE BOX
  // =====================================================================================
  console.log("-----------------------------------------------------------------------------------------");
  console.log("🚀 FASE 1: Bóveda Matriz #501 -> 5 Capitanes de Box (+26.00 POL y +0.0025 BNB c/u)");
  console.log("-----------------------------------------------------------------------------------------");

  let polNonce501 = await polProvider.getTransactionCount(signer501Pol.address, "latest");
  let bscNonce501 = await bscProvider.getTransactionCount(signer501Bsc.address, "latest");

  for (const cap of CAPTAINS) {
    const currentPol = parseFloat(ethers.formatEther(await polProvider.getBalance(cap.address)));
    const currentBnb = parseFloat(ethers.formatEther(await bscProvider.getBalance(cap.address)));

    // Jitter Gaussiano +/- 0.20 POL
    const jitterPol = (Math.random() - 0.5) * 0.40;
    const amountPol = parseFloat((26.00 + jitterPol).toFixed(4));

    // Jitter BNB +/- 0.0001 BNB
    const jitterBnb = (Math.random() - 0.5) * 0.0002;
    const amountBnb = parseFloat((0.0025 + jitterBnb).toFixed(6));

    console.log(`\n📦 Capitán Box ${cap.box} (${cap.id} - ${cap.address}):`);
    console.log(`   Saldos actuales: ${currentPol.toFixed(4)} POL | ${currentBnb.toFixed(6)} BNB`);

    // 1.1 Enviar POL si no ha recibido la inyección (> 25 POL indica ya fondeado)
    if (currentPol >= 25.0) {
      console.log(`   ✅ POL ya fondeado (${currentPol.toFixed(4)} POL >= 25.0 POL). Omitiendo.`);
    } else {
      console.log(`   ➤ Enviando +${amountPol} POL desde #501...`);
      if (!isDryRun) {
        const feeData = await polProvider.getFeeData();
        const tx = await signer501Pol.sendTransaction({
          to: cap.address,
          value: ethers.parseEther(amountPol.toString()),
          nonce: polNonce501++,
          maxPriorityFeePerGas: ethers.parseUnits("35", "gwei"),
          maxFeePerGas: (feeData.maxFeePerGas * 125n) / 100n,
          gasLimit: 35000
        });
        console.log(`     🚀 Tx POL enviada: https://polygonscan.com/tx/${tx.hash}`);
        await tx.wait(1);
        console.log(`     ✅ Confirmado en Polygon PoS.`);
        await sleep(2000 + Math.random() * 1500);
      }
    }

    // 1.2 Enviar BNB si tiene < 0.009 BNB
    if (currentBnb >= 0.009) {
      console.log(`   ✅ BNB ya fondeado (${currentBnb.toFixed(6)} BNB >= 0.009 BNB). Omitiendo.`);
    } else {
      console.log(`   ➤ Enviando +${amountBnb} BNB desde #501...`);
      if (!isDryRun) {
        const feeData = await bscProvider.getFeeData();
        const tx = await signer501Bsc.sendTransaction({
          to: cap.address,
          value: ethers.parseEther(amountBnb.toString()),
          nonce: bscNonce501++,
          gasPrice: feeData.gasPrice,
          gasLimit: 25000
        });
        console.log(`     🚀 Tx BNB enviada: https://bscscan.com/tx/${tx.hash}`);
        await tx.wait(1);
        console.log(`     ✅ Confirmado en BSC Mainnet.`);
        await sleep(2000 + Math.random() * 1500);
      }
    }
  }

  // =====================================================================================
  // FASE 2: 5 CAPITANES DE BOX -> 10 SUB-CAPITANES (INTRA-BOX STRICT)
  // =====================================================================================
  console.log("\n-----------------------------------------------------------------------------------------");
  console.log("🛡️ FASE 2: Capitanes -> Sub-Capitanes Intra-Box (+8.00 POL c/u para alcanzar ~8.50 POL)");
  console.log("-----------------------------------------------------------------------------------------");

  for (const cap of CAPTAINS) {
    const subCaps = SUB_CAPTAINS_BY_BOX[cap.box] || [];
    console.log(`\n👑 [CAPITÁN BOX ${cap.box}] ${cap.id} (${cap.address}) dispersando intra-box:`);

    const capSigner = getWalletSigner(cap.index, polProvider);
    const capBal = parseFloat(ethers.formatEther(await polProvider.getBalance(cap.address)));
    console.log(`   Saldo POL disponible en ${cap.id}: ${capBal.toFixed(4)} POL`);

    let capNonce = await polProvider.getTransactionCount(cap.address, "latest");

    for (const sat of subCaps) {
      const satBal = parseFloat(ethers.formatEther(await polProvider.getBalance(sat.address)));
      const jitterSat = (Math.random() - 0.5) * 0.10;
      const amountSat = parseFloat((8.00 + jitterSat).toFixed(4));

      console.log(`   ↳ Sub-Capitán ${sat.id} (${sat.address}): Saldo actual: ${satBal.toFixed(4)} POL`);
      if (satBal >= 5.0) {
        console.log(`     ✅ Ya fondeado con Reserva Sagrada (${satBal.toFixed(4)} POL >= 5.0 POL). Omitiendo.`);
        continue;
      }

      console.log(`     ➤ Enviando +${amountSat} POL desde ${cap.id}...`);
      if (!isDryRun) {
        const feeData = await polProvider.getFeeData();
        const tx = await capSigner.sendTransaction({
          to: sat.address,
          value: ethers.parseEther(amountSat.toString()),
          nonce: capNonce++,
          maxPriorityFeePerGas: ethers.parseUnits("35", "gwei"),
          maxFeePerGas: (feeData.maxFeePerGas * 125n) / 100n,
          gasLimit: 35000
        });
        console.log(`       🚀 Tx enviada: https://polygonscan.com/tx/${tx.hash}`);
        await tx.wait(1);
        console.log(`       ✅ Confirmado en bloque.`);
        await sleep(2000 + Math.random() * 1500);
      }
    }
  }

  console.log("\n=========================================================================================");
  console.log("🎉 DISPERSIÓN TÁCTICA COMPLETADA EXITOSAMENTE: 16 NODRIZAS SNIPER ARMADAS");
  console.log("=========================================================================================\n");
}

runDisbursement().catch((err) => {
  console.error("❌ Error fatal en dispersión:", err);
  process.exit(1);
});
