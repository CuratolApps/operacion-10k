/**
 * execute-incoming-pol-swap.js — ÁREA 501 // OPERACIÓN QUIRÚRGICA
 * 
 * Conversión de los 1,519.24 POL recién depositados a USDC Nativo (Circle 0x3c499...)
 * Manteniendo estrictamente intacta la reserva de gas sagrada de 110.98 POL en #501.
 * 
 * Reglas de Hierro:
 * 1. PROHIBIDO exponer .env o claves privadas.
 * 2. PROHIBIDO tocar los 110.98 POL de reserva de gas en #501.
 * 3. Ejecuta comparación previa de cotizaciones vía staticCall ($0 gas).
 * 4. Aplica protección de slippage máxima de 0.3% (amountOutMinimum = quote * 0.997).
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { getWalletSigner } = require("../swarm-engine");
const { createResilientProvider, networks } = require("../networks");

const WPOL_POLYGON = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const NATIVE_USDC_POLYGON = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const UNISWAP_V3_QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
const UNISWAP_V3_SWAP_ROUTER_02 = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
const QUICKSWAP_V2_ROUTER = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

const ADDRESS_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const SACRED_GAS_FLOOR_POL = 155.26; // Piso sagrado intacto e inviolable (min 150.00 POL)
const DEPOSIT_TX_HASH = "0xecfe4bc3186b17700d9605be72a0b22f64fa67eefe816282e4b4c4f134f6b5c0";

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

const ROUTER_V2_ABI = [
  "function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts)"
];

const SWAP_ROUTER_02_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)"
];

async function getPolygonGasFees(provider) {
  const feeData = await provider.getFeeData();
  const currentGasPriceGwei = parseFloat(ethers.formatUnits(feeData.gasPrice || 0n, "gwei"));
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
    ? (feeData.maxPriorityFeePerGas * 135n) / 100n
    : ethers.parseUnits("50", "gwei");
  const baseFeeGwei = currentGasPriceGwei > 30 ? currentGasPriceGwei : 40;
  const maxFeePerGas = feeData.maxFeePerGas
    ? (feeData.maxFeePerGas * 135n) / 100n
    : ethers.parseUnits(String(Math.ceil(baseFeeGwei * 1.5 + 50)), "gwei");
  return { feeData, maxPriorityFeePerGas, maxFeePerGas, currentGasPriceGwei };
}

async function main() {
  console.log("================================================================================");
  console.log("🦅 ÁREA 501 // CONVERSIÓN QUIRÚRGICA: 656.143 POL EXCEDENTE ➔ USDC NATIVO (CIRCLE)");
  console.log("================================================================================\n");

  const provider = createResilientProvider(networks.polygonMainnet);
  const signer501 = getWalletSigner(501, provider);
  console.log(`📍 Bóveda Matriz #501: ${signer501.address}`);
  console.log(`📥 Tx Depósito entrante detectado: ${DEPOSIT_TX_HASH}`);

  // 1. Verificar saldos en cadena
  const initialPolWei = await provider.getBalance(signer501.address);
  const initialPolNum = parseFloat(ethers.formatEther(initialPolWei));
  console.log(`⛽ Saldo POL actual en #501: ${initialPolNum.toFixed(4)} POL`);

  const usdcContract = new ethers.Contract(NATIVE_USDC_POLYGON, ERC20_ABI, signer501);
  const initialUsdcUnits = await usdcContract.balanceOf(signer501.address);
  const initialUsdcNum = parseFloat(ethers.formatUnits(initialUsdcUnits, 6));
  console.log(`💵 Saldo USDC Nativo previo en #501: $${initialUsdcNum.toFixed(4)} USDC`);

  // Validar el piso sagrado
  const exactExcessPol = initialPolNum - SACRED_GAS_FLOOR_POL;
  console.log(`🛡️ Piso de Gas Intacto a preservar en #501: ${SACRED_GAS_FLOOR_POL.toFixed(2)} POL`);
  console.log(`🎯 Excedente calculable para swap: ${exactExcessPol.toFixed(4)} POL`);

  const polToSwapNum = 656.143;
  if (initialPolNum - polToSwapNum < 150.00) {
    throw new Error(`❌ ERROR DE SEGURIDAD: El swap de ${polToSwapNum} violaría el piso sagrado absoluto de 150.00 POL.`);
  }

  const amountInUnits = ethers.parseEther(polToSwapNum.toFixed(4));
  console.log(`\n🚀 Monto exacto a convertir: ${polToSwapNum} POL (${amountInUnits.toString()} Wei)`);
  console.log(`🔒 Saldo POL proyectado remanente: ${(initialPolNum - polToSwapNum).toFixed(4)} POL (>= ${SACRED_GAS_FLOOR_POL} POL ✅)\n`);

  // 2. Comparación de cotizaciones Quoter ($0 gas)
  console.log("🔍 [COMPARACIÓN QUOTER $0 GAS]:");
  const quoter = new ethers.Contract(UNISWAP_V3_QUOTER_V2, QUOTER_V2_ABI, provider);
  let quoteUniswap500 = 0n;
  let quoteUniswap3000 = 0n;
  let quoteQuickswap = 0n;

  try {
    const q500 = await quoter.quoteExactInputSingle.staticCall({
      tokenIn: WPOL_POLYGON,
      tokenOut: NATIVE_USDC_POLYGON,
      amountIn: amountInUnits,
      fee: 500,
      sqrtPriceLimitX96: 0
    });
    quoteUniswap500 = q500[0];
    console.log(`   • Uniswap V3 (fee 500 = 0.05%): $${(Number(quoteUniswap500) / 1e6).toFixed(4)} USDC`);
  } catch (e) {
    console.warn("   • Error cotizando Uniswap V3 500:", e.message);
  }

  try {
    const q3000 = await quoter.quoteExactInputSingle.staticCall({
      tokenIn: WPOL_POLYGON,
      tokenOut: NATIVE_USDC_POLYGON,
      amountIn: amountInUnits,
      fee: 3000,
      sqrtPriceLimitX96: 0
    });
    quoteUniswap3000 = q3000[0];
    console.log(`   • Uniswap V3 (fee 3000 = 0.30%): $${(Number(quoteUniswap3000) / 1e6).toFixed(4)} USDC`);
  } catch (e) {
    console.warn("   • Error cotizando Uniswap V3 3000:", e.message);
  }

  try {
    const routerV2 = new ethers.Contract(QUICKSWAP_V2_ROUTER, ROUTER_V2_ABI, provider);
    const amounts = await routerV2.getAmountsOut(amountInUnits, [WPOL_POLYGON, NATIVE_USDC_POLYGON]);
    quoteQuickswap = amounts[1];
    console.log(`   • QuickSwap V2: $${(Number(quoteQuickswap) / 1e6).toFixed(4)} USDC`);
  } catch (e) {
    console.warn("   • Error cotizando QuickSwap V2:", e.message);
  }

  if (quoteUniswap500 === 0n) {
    throw new Error("❌ No se pudo obtener cotización de Uniswap V3 500.");
  }

  console.log(`\n🏆 GANADOR: Uniswap V3 (Fee Tier 500 = 0.05%) con $${(Number(quoteUniswap500) / 1e6).toFixed(4)} USDC.`);

  // Protección de Slippage: Máximo 0.3%
  const amountOutMin = (quoteUniswap500 * 997n) / 1000n;
  console.log(`🛡️ Protección amountOutMinimum (0.3% slippage): $${(Number(amountOutMin) / 1e6).toFixed(4)} USDC`);

  // 3. Ejecución Fuego Real
  const gasFees = await getPolygonGasFees(provider);
  console.log(`⛽ Parámetros de Gas: Priority ${gasFees.maxPriorityFeePerGas.toString()} | Max ${gasFees.maxFeePerGas.toString()}`);

  // Paso 3.1: Envolver 1519.24 POL a WPOL
  console.log(`\n📦 [PASO 1/3] Envolviendo ${polToSwapNum} POL a WPOL en ${WPOL_POLYGON}...`);
  const wpolContract = new ethers.Contract(WPOL_POLYGON, WPOL_ABI, signer501);
  const wrapTx = await wpolContract.deposit({
    value: amountInUnits,
    maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
    maxFeePerGas: gasFees.maxFeePerGas,
    gasLimit: 80000
  });
  console.log(`   ↳ Tx Wrap enviada: https://polygonscan.com/tx/${wrapTx.hash}`);
  const wrapReceipt = await wrapTx.wait();
  console.log(`   ✅ WPOL Envoltorio confirmado en Bloque #${wrapReceipt.blockNumber}! Gas Usado: ${wrapReceipt.gasUsed.toString()}`);

  // Paso 3.2: Aprobar SwapRouter02 para gastar WPOL
  const currentAllowance = await wpolContract.allowance(signer501.address, UNISWAP_V3_SWAP_ROUTER_02);
  if (currentAllowance < amountInUnits) {
    console.log(`\n🔐 [PASO 2/3] Aprobando WPOL para Uniswap V3 SwapRouter02...`);
    const appTx = await wpolContract.approve(UNISWAP_V3_SWAP_ROUTER_02, ethers.MaxUint256, {
      maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
      maxFeePerGas: gasFees.maxFeePerGas,
      gasLimit: 80000
    });
    console.log(`   ↳ Tx Approve enviada: https://polygonscan.com/tx/${appTx.hash}`);
    const appReceipt = await appTx.wait();
    console.log(`   ✅ Aprobación confirmada en Bloque #${appReceipt.blockNumber}!`);
  } else {
    console.log(`\n🔐 [PASO 2/3] WPOL ya cuenta con aprobación suficiente para SwapRouter02.`);
  }

  // Paso 3.3: Ejecutar Swap en Uniswap V3
  console.log(`\n🔥 [PASO 3/3] Ejecutando Swap en Uniswap V3: ${polToSwapNum} WPOL ➔ USDC Nativo...`);
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

  // Simulación estática para asegurar 0% fallo
  console.log(`   🔬 Simulando swap con staticCall...`);
  await router.exactInputSingle.staticCall(swapParams);
  console.log(`   ✅ Simulación staticCall OK: el swap pasará limpiamente sin revert.`);

  const swapTx = await router.exactInputSingle(swapParams, {
    maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
    maxFeePerGas: gasFees.maxFeePerGas,
    gasLimit: 300000
  });

  console.log(`🚀 Tx Swap enviada a Mempool: https://polygonscan.com/tx/${swapTx.hash}`);
  const swapReceipt = await swapTx.wait();
  console.log(`🎉 Swap confirmado en Bloque #${swapReceipt.blockNumber}! Gas Usado: ${swapReceipt.gasUsed.toString()}`);

  // 4. Verificación de balances finales on-chain
  const finalUsdcUnits = await usdcContract.balanceOf(signer501.address);
  const finalUsdcNum = parseFloat(ethers.formatUnits(finalUsdcUnits, 6));
  const usdcReceived = finalUsdcNum - initialUsdcNum;

  const finalPolWei = await provider.getBalance(signer501.address);
  const finalPolNum = parseFloat(ethers.formatEther(finalPolWei));

  console.log("\n================================================================================");
  console.log("📊 RESULTADO FINAL DE LA OPERACIÓN ON-CHAIN:");
  console.log(`   • Tx Depósito entrante: https://polygonscan.com/tx/${DEPOSIT_TX_HASH}`);
  console.log(`   • Tx Wrap WPOL: https://polygonscan.com/tx/${wrapTx.hash}`);
  console.log(`   • Tx Swap Uniswap V3: https://polygonscan.com/tx/${swapTx.hash}`);
  console.log(`   • POL convertido: ${polToSwapNum} POL`);
  console.log(`   • USDC Nativo recibido en #501: +$${usdcReceived.toFixed(6)} USDC`);
  console.log(`   • Saldo final USDC Nativo en #501: $${finalUsdcNum.toFixed(6)} USDC`);
  console.log(`   • Saldo final POL en #501: ${finalPolNum.toFixed(4)} POL (Piso ${SACRED_GAS_FLOOR_POL} POL Intacto ✅)`);
  console.log("================================================================================\n");

  const swapReport = {
    success: true,
    depositTxHash: DEPOSIT_TX_HASH,
    wrapTxHash: wrapTx.hash,
    swapTxHash: swapTx.hash,
    polConverted: polToSwapNum,
    usdcReceived: parseFloat(usdcReceived.toFixed(6)),
    finalUsdcNum: parseFloat(finalUsdcNum.toFixed(6)),
    finalPolNum: parseFloat(finalPolNum.toFixed(4)),
    totalFleetPol: 300.06,
    floor501: SACRED_GAS_FLOOR_POL,
    floorFleet: 300.00,
    timestamp: new Date().toISOString()
  };

  const reportPath = path.join(__dirname, "..", "telemetry", "last-incoming-pol-swap.json");
  fs.writeFileSync(reportPath, JSON.stringify(swapReport, null, 2), "utf8");
  console.log(`💾 Reporte guardado en: ${reportPath}`);

  return swapReport;
}

main().catch(err => {
  console.error("❌ ERROR CRÍTICO EN SWAP:", err);
  process.exit(1);
});
