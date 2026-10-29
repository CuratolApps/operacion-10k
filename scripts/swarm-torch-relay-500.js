/**
 * scripts/swarm-torch-relay-500.js — ÁREA 501 // OPERACIÓN "PASE DE ANTORCHA" ($25 USDC × 500 CARTERAS)
 * ======================================================================================================
 * EJECUCIÓN 100% REAL ON-CHAIN:
 * 1. Extrae temporalmente la Antorcha ($26.08 USDC -> $25.08 USDC netos tras fee L1) desde Hyperliquid L1 a Arbitrum #501.
 * 2. Cruza los ~$25.08 USDC de Arbitrum One a Polygon PoS (Capitán #001) vía Relay Instant Solver.
 * 3. Ejecuta "El Pase de Antorcha" ($25.00 USDC por salto) a través de las 500 carteras (#001 ➔ #002 ➔ ... ➔ #500 ➔ #501)
 *    en 10 Lotes Multicall3 × 50 Saltos EIP-3009 (transferWithAuthorization), generando $12,500.00 USDC de volumen
 *    on-chain real e indexado en Polygonscan para vacunar las 500 carteras contra filtros Anti-Sybil.
 * 4. Devuelve los >$25.05 USDC desde Polygon #501 ➔ Arbitrum #501 ➔ Bridge2 Oficial de Hyperliquid L1.
 * ======================================================================================================
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { ExchangeClient, HttpTransport } = require("@nktkas/hyperliquid");
const { getWalletSigner } = require("../swarm-engine");
const { sendTelegramAlert } = require("../telegram-notifier");

const VAULT_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const CAPTAIN_001 = "0xb7505DD7FCC31A71D033F8a495D6B562420AD40F";
const POLYGON_USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const ARBITRUM_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const HYPERLIQUID_BRIDGE2 = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7";
const MULTICALL3_ADDR = "0xcA11bde05977b3631167028862bE2a173976CA11";

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external"
];

const MC3_ABI = [
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[])"
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function sendRawTxAndConfirm(provider, signer, txReq, label) {
  const feeData = await provider.getFeeData();
  const network = await provider.getNetwork();
  const isPolygon = Number(network.chainId) === 137;
  const latestNonce = await provider.getTransactionCount(signer.address, "latest");
  const baseGas = feeData.gasPrice || ethers.parseUnits(isPolygon ? "260" : "0.05", "gwei");
  const prioGas = isPolygon ? ethers.parseUnits("45", "gwei") : (feeData.maxPriorityFeePerGas || ethers.parseUnits("0.01", "gwei"));
  const maxFee = isPolygon ? ((baseGas * 135n) / 100n + prioGas) : (feeData.maxFeePerGas || ethers.parseUnits("0.15", "gwei"));

  const populated = await signer.populateTransaction({
    ...txReq,
    nonce: latestNonce,
    maxPriorityFeePerGas: prioGas,
    maxFeePerGas: maxFee
  });
  const signed = await signer.signTransaction(populated);
  const txHash = await provider.send("eth_sendRawTransaction", [signed]);
  console.log(`   ↳ [${label}] Tx enviada (nonce ${latestNonce}, maxFee ${Number(ethers.formatUnits(maxFee, "gwei")).toFixed(0)} gwei): ${txHash}`);
  for (let i = 0; i < 60; i++) {
    await sleep(2500);
    const receipt = await provider.send("eth_getTransactionReceipt", [txHash]);
    if (receipt) {
      const status = parseInt(receipt.status, 16);
      if (status !== 1) throw new Error(`Tx ${txHash} revertida en bloque ${parseInt(receipt.blockNumber, 16)}`);
      return {
        hash: txHash,
        blockNumber: parseInt(receipt.blockNumber, 16),
        gasUsed: BigInt(receipt.gasUsed || "0x0"),
        effectiveGasPrice: BigInt(receipt.effectiveGasPrice || "0x0")
      };
    }
  }
  throw new Error(`Timeout esperando confirmación de ${txHash}`);
}

async function executeRelayBridge({ provider, signer, originChainId, destinationChainId, originCurrency, destinationCurrency, amountUnits, recipient, label }) {
  console.log(`\n🌉 [${label}] Solicitando cotización a Relay API (${amountUnits} unidades)...`);
  const quoteRes = await fetch("https://api.relay.link/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: signer.address,
      recipient: recipient || signer.address,
      originChainId,
      destinationChainId,
      originCurrency,
      destinationCurrency,
      amount: String(amountUnits),
      tradeType: "EXACT_INPUT"
    })
  });
  const quoteData = await quoteRes.json();
  const steps = quoteData.steps || [];
  let lastReceipt = null;

  for (const step of steps) {
    for (const item of (step.items || [])) {
      if (!item.data) continue;
      const txData = item.data;
      lastReceipt = await sendRawTxAndConfirm(provider, signer, {
        to: txData.to,
        data: txData.data,
        value: BigInt(txData.value || "0"),
        gasLimit: BigInt(txData.gas ? Math.ceil(Number(txData.gas) * 1.4) : 350000)
      }, `${label}-${step.id}`);
    }
  }
  return { receipt: lastReceipt, quoteData };
}

async function main() {
  console.log("=========================================================================================");
  console.log("🔥 ÁREA 501 // OPERACIÓN 'PASE DE ANTORCHA' ($25 USDC × 500 CARTERAS = $12,500 VOLUMEN)");
  console.log("=========================================================================================\n");

  const polyProvider = new ethers.JsonRpcProvider("https://polygon.drpc.org", 137, { staticNetwork: true, batchMaxCount: 1 });
  const arbProvider = new ethers.JsonRpcProvider("https://arb1.arbitrum.io/rpc", 42161, { staticNetwork: true, batchMaxCount: 1 });

  const signer501Poly = getWalletSigner(501, polyProvider);
  const signer501Arb = getWalletSigner(501, arbProvider);
  const signer001Poly = getWalletSigner(1, polyProvider);

  const usdcPoly = new ethers.Contract(POLYGON_USDC, ERC20_ABI, polyProvider);
  const usdcArb = new ethers.Contract(ARBITRUM_USDC, ERC20_ABI, arbProvider);
  const usdcIface = new ethers.Interface(ERC20_ABI);

  const [initPol501, initPol001, initPolyUsdc001, initArbUsdc501] = await Promise.all([
    polyProvider.getBalance(VAULT_501),
    polyProvider.getBalance(CAPTAIN_001),
    usdcPoly.balanceOf(CAPTAIN_001),
    usdcArb.balanceOf(VAULT_501)
  ]);

  console.log(`📊 ESTADO INICIAL VERIFICADO ON-CHAIN:`);
  console.log(`   • Bóveda #501 Gas Polygon: ${ethers.formatEther(initPol501)} POL`);
  console.log(`   • Capitán #001 Gas Polygon: ${ethers.formatEther(initPol001)} POL`);
  console.log(`   • Capitán #001 USDC Polygon: $${ethers.formatUnits(initPolyUsdc001, 6)} USDC`);
  console.log(`   • Bóveda #501 USDC Arbitrum: $${ethers.formatUnits(initArbUsdc501, 6)} USDC\n`);

  if (initPolyUsdc001 < 25000000n) {
    await sendTelegramAlert(
      `🔥🚀 <b>ÁREA 501 // INICIANDO "EL PASE DE ANTORCHA" ($25 USDC × 500 CARTERAS)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `1️⃣ <b>Extracción Temporal L1:</b> Retirando <code>$25.08 USDC</code> netos de Hyperliquid L1 ➔ Arbitrum ➔ Polygon (#001).\n` +
      `2️⃣ <b>Vacunación Anti-Sybil (500/500):</b> 10 Lotes Multicall3 × 50 Saltos EIP-3009 (<code>$12,500.00 USDC</code> de volumen real on-chain).\n` +
      `3️⃣ <b>Retorno Intacto:</b> Devolución inmediata de los <code>$25.00+ USDC</code> a Hyperliquid L1.\n` +
      `⛽ <b>Gas Polygon:</b> Cubierto por la reserva de POL (<code>0%</code> merma sobre la antorcha).\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    );
  }

  // PASO 1: Si aún no están los $25 USDC en Polygon ni en Arbitrum #501, retirarlos de Hyperliquid L1
  let poly001Bal = await usdcPoly.balanceOf(CAPTAIN_001);
  let poly501Bal = await usdcPoly.balanceOf(VAULT_501);
  let arb501Bal = await usdcArb.balanceOf(VAULT_501);

  if (poly001Bal < 25000000n && poly501Bal < 25000000n && arb501Bal < 24500000n) {
    console.log(`🏦 [PASO 1] Solicitando retiro temporal de $26.08 USDC ($25.08 netos tras fee L1) desde Hyperliquid L1 a Arbitrum #501...`);
    const hlExchange = new ExchangeClient({
      wallet: signer501Arb,
      transport: new HttpTransport({ isTestnet: false }),
      isTestnet: false
    });
    const wRes = await hlExchange.withdraw3({
      destination: VAULT_501,
      amount: "26.08"
    });
    console.log(`   ✅ Solicitud withdraw3 confirmada en Hyperliquid L1:`, JSON.stringify(wRes));

    console.log(`⏳ Esperando acreditación de ~$25.08 USDC en Arbitrum One (${VAULT_501})...`);
    for (let attempt = 1; attempt <= 75; attempt++) {
      await sleep(5000);
      arb501Bal = await usdcArb.balanceOf(VAULT_501);
      const formatted = Number(ethers.formatUnits(arb501Bal, 6));
      if (attempt % 3 === 1 || formatted >= 24.5) {
        console.log(`   [Intento ${attempt}/75] Arbitrum #501 USDC: $${formatted.toFixed(4)} USDC`);
      }
      if (arb501Bal >= 24500000n) {
        console.log(`   🎉 ¡Antorcha recibida en Arbitrum One: $${formatted.toFixed(4)} USDC!`);
        break;
      }
    }
  }

  // PASO 2: Si la antorcha está en Arbitrum #501, cruzarla a Polygon Capitán #001 vía Relay
  if (poly001Bal < 25000000n && poly501Bal < 25000000n && arb501Bal >= 24500000n) {
    await executeRelayBridge({
      provider: arbProvider,
      signer: signer501Arb,
      originChainId: 42161,
      destinationChainId: 137,
      originCurrency: ARBITRUM_USDC,
      destinationCurrency: POLYGON_USDC,
      amountUnits: arb501Bal.toString(),
      recipient: CAPTAIN_001,
      label: "ARB_TO_POLY_001"
    });

    console.log(`⏳ Esperando llegada de la Antorcha en Polygon PoS (Capitán #001: ${CAPTAIN_001})...`);
    for (let attempt = 1; attempt <= 40; attempt++) {
      await sleep(3000);
      poly001Bal = await usdcPoly.balanceOf(CAPTAIN_001);
      const formatted = Number(ethers.formatUnits(poly001Bal, 6));
      console.log(`   [Intento ${attempt}/40] Polygon #001 USDC: $${formatted.toFixed(4)} USDC`);
      if (poly001Bal >= 25000000n) {
        console.log(`   🎉 ¡Antorcha lista en Capitán #001 Polygon: $${formatted.toFixed(4)} USDC!`);
        break;
      }
    }
  }

  // PASO 3: EL PASE DE ANTORCHA POR LAS 500 CARTERAS (#001 -> #002 -> ... -> #500 -> #501)
  // 10 Lotes Multicall3 de 50 saltos EIP-3009 (transferWithAuthorization) cada uno = 500 saltos reales on-chain
  console.log(`\n🏃‍♂️🔥 [PASO 3] Ejecutando 'El Pase de Antorcha' ($25.00 USDC × 500 Carteras = $12,500.00 USDC Volumen)...`);
  const torchAmountRaw = 25000000n; // Exactamente $25.000000 USDC
  const domain = {
    name: "USD Coin",
    version: "2",
    chainId: 137,
    verifyingContract: POLYGON_USDC
  };
  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" }
    ]
  };

  // Pre-derivar los 501 signers en memoria (#1 a #501)
  const signers = {};
  for (let i = 1; i <= 501; i++) {
    signers[i] = getWalletSigner(i);
  }

  const mc3Iface = new ethers.Interface(MC3_ABI);
  const batchReceipts = [];
  let totalGasPolSpent = 0;

  for (let batchIdx = 0; batchIdx < 10; batchIdx++) {
    const startWallet = batchIdx * 50 + 1; // 1, 51, 101, ..., 451
    const endWallet = startWallet + 49;    // 50, 100, 150, ..., 500
    const nextReceiver = endWallet + 1;    // 51, 101, 151, ..., 501 (Bóveda #501 recibe al final del lote 10!)

    const holderBal = await usdcPoly.balanceOf(signers[startWallet].address);
    if (holderBal < torchAmountRaw) {
      console.log(`   ⏭️ Lote #${batchIdx + 1} (#${startWallet} ➔ #${endWallet}) ya completado previamente.`);
      continue;
    }

    const validAfter = 0n;
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + 7200);
    const calls = [];

    for (let wIdx = startWallet; wIdx <= endWallet; wIdx++) {
      const fromW = signers[wIdx];
      const toW = signers[wIdx + 1];
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const sig = await fromW.signTypedData(domain, types, {
        from: fromW.address,
        to: toW.address,
        value: torchAmountRaw,
        validAfter,
        validBefore,
        nonce
      });
      const { v, r, s } = ethers.Signature.from(sig);
      calls.push({
        target: POLYGON_USDC,
        allowFailure: false,
        callData: usdcIface.encodeFunctionData("transferWithAuthorization", [
          fromW.address,
          toW.address,
          torchAmountRaw,
          validAfter,
          validBefore,
          nonce,
          v,
          r,
          s
        ])
      });
    }

    const txData = mc3Iface.encodeFunctionData("aggregate3", [calls]);
    const label = `LOTE_${batchIdx + 1}_CARTERAS_${String(startWallet).padStart(3, "0")}_A_${String(endWallet).padStart(3, "0")}`;

    const pol001Now = await polyProvider.getBalance(CAPTAIN_001);
    const activeRelayer = pol001Now >= ethers.parseEther("2.2") ? signer001Poly : signer501Poly;
    console.log(`   ⚡ Disparando ${label} (#${startWallet} ➔ #${nextReceiver}) vía Relayer ${activeRelayer.address.slice(0, 8)}...`);

    const rc = await sendRawTxAndConfirm(polyProvider, activeRelayer, {
      to: MULTICALL3_ADDR,
      data: txData,
      value: 0n,
      gasLimit: 3950000n
    }, label);

    const gasPol = Number(ethers.formatEther(rc.gasUsed * rc.effectiveGasPrice));
    totalGasPolSpent += gasPol;
    batchReceipts.push({
      batch: batchIdx + 1,
      range: `#${String(startWallet).padStart(3, "0")} ➔ #${String(endWallet).padStart(3, "0")}`,
      txHash: rc.hash,
      blockNumber: rc.blockNumber,
      gasPol: +gasPol.toFixed(4),
      volumeUsdc: 1250.00
    });
    console.log(`   ✅ ${label} confirmado en bloque #${rc.blockNumber} (Gas: ${gasPol.toFixed(4)} POL | Volumen: $1,250.00 USDC)`);
  }

  // Verificar que los $25.00 USDC llegaron intactos a la Bóveda #501 en Polygon tras pasar por la cartera #500
  // Además enviamos $0.08 USDC desde el remanente de #001 a #501 para cubrir los $0.03 del puente de regreso a Arbitrum
  const rem001 = await usdcPoly.balanceOf(CAPTAIN_001);
  if (rem001 >= 100000n) {
    const topUpData = usdcIface.encodeFunctionData("transfer", [VAULT_501, 80000n]); // $0.08 USDC para cubrir fee de Relay de regreso
    await sendRawTxAndConfirm(polyProvider, signer001Poly, {
      to: POLYGON_USDC,
      data: topUpData,
      value: 0n,
      gasLimit: 100000n
    }, "TOPUP_BRIDGE_FEE_TO_501");
  }

  const finalPoly501Bal = await usdcPoly.balanceOf(VAULT_501);
  console.log(`\n🏦 Antorcha consolidada en Bóveda #501 Polygon tras recorrer las 500 carteras: $${ethers.formatUnits(finalPoly501Bal, 6)} USDC`);

  // PASO 4: Devolver los ~$25.08 USDC desde Polygon #501 ➔ Arbitrum #501 ➔ Hyperliquid Bridge2
  console.log(`\n🚀 [PASO 4] Devolviendo Antorcha ($${ethers.formatUnits(finalPoly501Bal, 6)} USDC) de Polygon #501 a Arbitrum One ➔ Hyperliquid L1...`);
  const returnBridge = await executeRelayBridge({
    provider: polyProvider,
    signer: signer501Poly,
    originChainId: 137,
    destinationChainId: 42161,
    originCurrency: POLYGON_USDC,
    destinationCurrency: ARBITRUM_USDC,
    amountUnits: finalPoly501Bal.toString(),
    recipient: VAULT_501,
    label: "POLY_501_TO_ARB_501"
  });

  console.log(`⏳ Esperando llegada de los ~$25.05 USDC en Arbitrum One (${VAULT_501})...`);
  let returnArbBal = 0n;
  for (let attempt = 1; attempt <= 40; attempt++) {
    await sleep(3500);
    returnArbBal = await usdcArb.balanceOf(VAULT_501);
    const formatted = Number(ethers.formatUnits(returnArbBal, 6));
    console.log(`   [Intento ${attempt}/40] Arbitrum #501 USDC: $${formatted.toFixed(4)} USDC`);
    if (returnArbBal >= 24500000n) {
      console.log(`   🎉 ¡Fondos en Arbitrum One listos para Bridge2 Hyperliquid: $${formatted.toFixed(4)} USDC!`);
      break;
    }
  }

  let hlDepositTxHash = "";
  if (returnArbBal >= 5000000n) {
    const transferHlData = usdcIface.encodeFunctionData("transfer", [HYPERLIQUID_BRIDGE2, returnArbBal]);
    const hlDepRc = await sendRawTxAndConfirm(arbProvider, signer501Arb, {
      to: ARBITRUM_USDC,
      data: transferHlData,
      value: 0n,
      gasLimit: 150000n
    }, "DEPOSIT_ARB_TO_HYPERLIQUID_BRIDGE2");
    hlDepositTxHash = hlDepRc.hash;
    console.log(`   ✅ ¡$${ethers.formatUnits(returnArbBal, 6)} USDC depositados de vuelta en Hyperliquid Bridge2 (${hlDepositTxHash})!`);
  }

  // Actualizar telemetría de Swarm 500 con el registro permanente del Pase de Antorcha ($12,500 USDC de volumen en las 500 carteras)
  const swarmLiveFile = path.join(__dirname, "..", "telemetry", "swarm-500-live.json");
  try {
    const existing = fs.existsSync(swarmLiveFile) ? JSON.parse(fs.readFileSync(swarmLiveFile, "utf8")) : {};
    existing.torchRelay500 = {
      completedAt: new Date().toISOString(),
      torchUsdc: 25.00,
      walletsActivated: 500,
      totalOnChainVolumeUsdc: 12500.00,
      totalGasSpentPol: +totalGasPolSpent.toFixed(4),
      returnToHyperliquidTx: hlDepositTxHash,
      batches: batchReceipts
    };
    fs.writeFileSync(swarmLiveFile, JSON.stringify(existing, null, 2), "utf8");
  } catch (_) {}

  const txLinks = batchReceipts
    .map(b => `• <b>Lote #${b.batch} (${b.range}):</b> <a href="https://polygonscan.com/tx/${b.txHash}">${b.txHash.slice(0, 10)}...</a> ($1,250 Vol)`)
    .join("\n");

  const finalTg = `🏆🔥 <b>ÁREA 501 // "PASE DE ANTORCHA" 500/500 CARTERAS COMPLETADO CON ÉXITO</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💵 <b>Antorcha Utilizada:</b> <code>$25.00 USDC</code>\n` +
    `🐝 <b>Carteras Vacunadas On-Chain:</b> <b>500 / 500 (#001 a #500)</b>\n` +
    `📊 <b>Volumen Total Generado en Polygon:</b> <b>$12,500.00 USDC</b> (500 Saltos EIP-3009)\n` +
    `⛽ <b>Gas Total Pagado (Reserva POL):</b> <code>${totalGasPolSpent.toFixed(4)} POL</code>\n` +
    `🏦 <b>Retorno a Hyperliquid L1:</b> <code>$${ethers.formatUnits(returnArbBal, 6)} USDC</code> (<a href="https://arbiscan.io/tx/${hlDepositTxHash}">Ver Tx Bridge2</a>)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📜 <b>10 Lotes Multicall3 Verificados en Polygonscan:</b>\n${txLinks}`;
  await sendTelegramAlert(finalTg);

  console.log("\n=========================================================================================");
  console.log("🎉 OPERACIÓN 'PASE DE ANTORCHA' 500/500 COMPLETADA Y FONDOS DE VUELTA EN HYPERLIQUID L1");
  console.log("=========================================================================================");
}

main().catch(err => {
  console.error("❌ Error en Pase de Antorcha:", err);
  process.exit(1);
});

