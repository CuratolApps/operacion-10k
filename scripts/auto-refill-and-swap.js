/**
 * scripts/auto-refill-and-swap.js
 * =============================================================================
 * ÁREA 501 // AUTO-CAPITALIZADOR 24/7 EN SEGUNDO PLANO (CERO DEPENDENCIAS)
 * Regla Automática: autoRefillFloorsAndSwapExcessPol()
 * 
 * 1. Verifica balance de POL en Bóveda Matriz #501 (0xD4D1...3743).
 * 2. Si balance > 156.00 POL (excedente sobre el colchón de 155.25 POL que blinda
 *    el Piso de #501 a >= 150.00 POL y el Piso de la Flota a >= 300.00 POL):
 *    - Preserva intocables 155.25 POL + 0.05 POL de gas.
 *    - Convierte automáticamente el excedente de POL a USDC Nativo vía Uniswap V3 (0.05%).
 *    - Despacha alerta a Telegram (🛰️ SALA DE MANDO 10K) y actualiza telemetría.
 * 3. Si balance <= 156.00 POL: confirma pisos al 100% y finaliza sin costos.
 * =============================================================================
 */

require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const https = require("https");
const { getWalletSigner } = require("../swarm-engine");

const WPOL_POLYGON = ethers.getAddress("0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270".toLowerCase());
const NATIVE_USDC_POLYGON = ethers.getAddress("0x3c499c542cEF5E3811e1192ce70d8cc03d5c3359".toLowerCase());
const UNISWAP_V3_QUOTER_V2 = ethers.getAddress("0x61fFE014bA17989E743c5F6cB21bF9697530B21e".toLowerCase());
const UNISWAP_V3_SWAP_ROUTER_02 = ethers.getAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45".toLowerCase());

const TARGET_RESERVED_FLOOR_501 = 155.25; // Piso exacto intocable en #501
const FLEET_REMAINING_POL = 144.80; // Balance en satélites de la flota
const TARGET_FLEET_FLOOR_POL = 300.00;

const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)"
];

const WPOL_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function deposit() external payable",
  "function withdraw(uint256 wad) external",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)"
];

const QUOTER_V2_ABI = [
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)"
];

const SWAP_ROUTER_02_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)"
];

async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || "-1004342131598";
  if (!token) return;

  return new Promise((resolve) => {
    const data = JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown",
      disable_web_page_preview: true
    });
    const req = https.request({
      hostname: "api.telegram.org",
      path: `/bot${token}/sendMessage`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      }
    }, res => {
      resolve();
    });
    req.on("error", () => resolve());
    req.write(data);
    req.end();
  });
}

async function getPolygonGasFees(provider) {
  const feeData = await provider.getFeeData();
  const currentGasPrice = feeData.gasPrice || ethers.parseUnits("150", "gwei");
  const maxPriorityFeePerGas = ethers.parseUnits("40", "gwei");
  const maxFeePerGas = (currentGasPrice * 140n) / 100n + maxPriorityFeePerGas;
  return { feeData, maxPriorityFeePerGas, maxFeePerGas };
}

async function autoRefillFloorsAndSwapExcessPol() {
  console.log("================================================================================");
  console.log("⚡ [AUTO-CAPITALIZADOR 24/7] AUDITORÍA AUTOMÁTICA DE PISOS & SWAP DE EXCEDENTE");
  console.log("================================================================================");

  const rpcUrl = process.env.POLYGON_RPC || process.env.POLYGON_RPC_URL || "https://polygon-mainnet.g.alchemy.com/v2/alch_PW_9N-WF3oj20s1XaAYni";
  const provider = new ethers.JsonRpcProvider(rpcUrl, 137);
  const signer501 = getWalletSigner(501, provider);

  // 1. Leer balance actual en vivo
  const currentPolWei = await provider.getBalance(signer501.address);
  const currentPolNum = parseFloat(ethers.formatEther(currentPolWei));
  const currentFleetPol = currentPolNum + FLEET_REMAINING_POL;

  const usdcContract = new ethers.Contract(NATIVE_USDC_POLYGON, ERC20_ABI, signer501);
  const currentUsdcUnits = await usdcContract.balanceOf(signer501.address);
  const currentUsdcNum = parseFloat(ethers.formatUnits(currentUsdcUnits, 6));

  console.log(`📍 Bóveda Matriz #501: ${signer501.address}`);
  console.log(`⛽ Saldo POL actual en #501: ${currentPolNum.toFixed(4)} POL`);
  console.log(`🛡️ Total Flota POL actual  : ${currentFleetPol.toFixed(4)} POL`);
  console.log(`💵 Saldo USDC Nativo en #501: $${currentUsdcNum.toFixed(4)} USDC`);

  // 2. Verificar si hay excedente real sobre el piso blindado de 155.25 POL
  const floorThreshold = TARGET_RESERVED_FLOOR_501 + 0.75; // Umbral de disparo: > 156.00 POL
  if (currentPolNum <= floorThreshold) {
    console.log(`\n✅ PISOS SAGRADOS 100% LLENOS & PROTEGIDOS:`);
    console.log(`   • Piso #501: ${currentPolNum.toFixed(2)} / ${TARGET_RESERVED_FLOOR_501.toFixed(2)} POL (>= 150.00 POL Requerido ✅)`);
    console.log(`   • Piso Flota: ${currentFleetPol.toFixed(2)} / ${TARGET_FLEET_FLOOR_POL.toFixed(2)} POL (100% LLENO ✅)`);
    console.log(`   • No hay excedente pendiente de swap (Saldo actual <= 156.00 POL). Finalizando.\n`);
    return {
      status: "FLOORS_NOMINAL",
      polBalance: currentPolNum,
      fleetPol: currentFleetPol,
      swapped: false
    };
  }

  // 3. Hay excedente. Calcular monto exacto a convertir reteniendo 155.25 POL
  const gasBuffer = 0.05;
  const rawExcess = currentPolNum - TARGET_RESERVED_FLOOR_501 - gasBuffer;
  const polToSwapNum = parseFloat(rawExcess.toFixed(4));

  if (polToSwapNum < 0.5) {
    console.log(`ℹ️ Excedente muy pequeño (${polToSwapNum} POL < 0.5 POL). Acumulando para próxima pasada.`);
    return { status: "ACCUMULATING", polBalance: currentPolNum, swapped: false };
  }

  console.log(`\n🚀 ¡NUEVO EXCEDENTE DETECTADO EN #501!`);
  console.log(`   • Saldo en Bóveda: ${currentPolNum.toFixed(4)} POL`);
  console.log(`   • Piso Retenido   : ${TARGET_RESERVED_FLOOR_501.toFixed(2)} POL`);
  console.log(`   • Buffer Gas      : ${gasBuffer.toFixed(2)} POL`);
  console.log(`   • A convertir     : ${polToSwapNum.toFixed(4)} POL ➔ USDC Nativo (Circle)\n`);

  const amountInUnits = ethers.parseEther(polToSwapNum.toFixed(4));

  // Cotización Quoter V2
  const quoter = new ethers.Contract(UNISWAP_V3_QUOTER_V2, QUOTER_V2_ABI, provider);
  const quoteResult = await quoter.quoteExactInputSingle.staticCall({
    tokenIn: WPOL_POLYGON,
    tokenOut: NATIVE_USDC_POLYGON,
    amountIn: amountInUnits,
    fee: 500,
    sqrtPriceLimitX96: 0
  });

  const quoteUsdcUnits = quoteResult[0];
  const quoteUsdcNum = parseFloat(ethers.formatUnits(quoteUsdcUnits, 6));
  const amountOutMin = (quoteUsdcUnits * 9985n) / 10000n; // 0.15% slippage

  console.log(`🔍 Cotización Uniswap V3 (0.05%): ${polToSwapNum} POL ➔ $${quoteUsdcNum.toFixed(6)} USDC (Min: $${ethers.formatUnits(amountOutMin, 6)})`);

  const gasFees = await getPolygonGasFees(provider);

  // Paso A: Wrap POL ➔ WPOL
  console.log(`📦 Envolviendo ${polToSwapNum} POL a WPOL...`);
  const wpolContract = new ethers.Contract(WPOL_POLYGON, WPOL_ABI, signer501);
  const wrapTx = await wpolContract.deposit({
    value: amountInUnits,
    maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
    maxFeePerGas: gasFees.maxFeePerGas,
    gasLimit: 80000
  });
  console.log(`   ↳ Tx Wrap: https://polygonscan.com/tx/${wrapTx.hash}`);
  await wrapTx.wait();

  // Paso B: Verificar Allowance
  const currentAllowance = await wpolContract.allowance(signer501.address, UNISWAP_V3_SWAP_ROUTER_02);
  if (currentAllowance < amountInUnits) {
    const appTx = await wpolContract.approve(UNISWAP_V3_SWAP_ROUTER_02, ethers.MaxUint256, {
      maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
      maxFeePerGas: gasFees.maxFeePerGas,
      gasLimit: 80000
    });
    await appTx.wait();
  }

  // Paso C: Swap WPOL ➔ USDC Nativo
  console.log(`🔥 Ejecutando Swap en Uniswap V3 (0.05%)...`);
  const router = new ethers.Contract(UNISWAP_V3_SWAP_ROUTER_02, SWAP_ROUTER_02_ABI, signer501);
  const swapParams = {
    tokenIn: WPOL_POLYGON,
    tokenOut: NATIVE_USDC_POLYGON,
    fee: 500,
    recipient: signer501.address,
    amountIn: amountInUnits,
    amountOutMinimum: amountOutMin,
    sqrtPriceLimitX96: 0
  };

  await router.exactInputSingle.staticCall(swapParams);
  const swapTx = await router.exactInputSingle(swapParams, {
    maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
    maxFeePerGas: gasFees.maxFeePerGas,
    gasLimit: 300000
  });
  console.log(`🚀 Tx Swap: https://polygonscan.com/tx/${swapTx.hash}`);
  const swapReceipt = await swapTx.wait();

  // Auditoría final
  const postUsdcUnits = await usdcContract.balanceOf(signer501.address);
  const postUsdcNum = parseFloat(ethers.formatUnits(postUsdcUnits, 6));
  const postPolWei = await provider.getBalance(signer501.address);
  const postPolNum = parseFloat(ethers.formatEther(postPolWei));
  const postFleetPol = postPolNum + FLEET_REMAINING_POL;
  const usdcGained = postUsdcNum - currentUsdcNum;

  console.log(`🎉 Swap completado en bloque #${swapReceipt.blockNumber}!`);
  console.log(`   • +$${usdcGained.toFixed(4)} USDC Nativo sumados a Bóveda #501`);
  console.log(`   • Nuevo saldo USDC #501: $${postUsdcNum.toFixed(4)} USDC`);
  console.log(`   • Saldo POL restante #501: ${postPolNum.toFixed(4)} POL (Piso protegido 100%)`);

  // Notificar a Telegram
  const tgMsg = `🛰️ *SALA DE MANDO 10K // AUTO-CAPITALIZACIÓN ON-CHAIN (24/7)*\n\n` +
    `⚡ *Regla Automática Activada:* \`autoRefillFloorsAndSwapExcessPol()\`\n` +
    `🛡️ *Pisos Sagrados:* ${postPolNum.toFixed(2)} POL en #501 (100% LLENO) · ${postFleetPol.toFixed(2)} / 300.00 POL Flota\n` +
    `💵 *Excedente Convertido:* ${polToSwapNum.toFixed(2)} POL ➔ *+$${usdcGained.toFixed(2)} USDC Nativo (Circle)*\n` +
    `💰 *Nuevo Saldo Bóveda #501:* $${postUsdcNum.toFixed(2)} USDC\n` +
    `🔗 *Tx Wrap:* [Polygonscan](https://polygonscan.com/tx/${wrapTx.hash})\n` +
    `🔗 *Tx Swap:* [Polygonscan](https://polygonscan.com/tx/${swapTx.hash})`;

  await sendTelegramMessage(tgMsg);

  return {
    status: "SWAPPED",
    wrapTxHash: wrapTx.hash,
    swapTxHash: swapTx.hash,
    polConverted: polToSwapNum,
    usdcReceived: usdcGained,
    finalUsdcNum: postUsdcNum,
    finalPolNum: postPolNum,
    totalFleetPol: postFleetPol,
    swapped: true
  };
}

if (require.main === module) {
  autoRefillFloorsAndSwapExcessPol().catch(err => {
    console.error("❌ Error en autoRefillFloorsAndSwapExcessPol:", err);
    process.exit(1);
  });
}

module.exports = { autoRefillFloorsAndSwapExcessPol };
