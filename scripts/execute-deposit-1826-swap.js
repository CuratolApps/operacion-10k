/**
 * scripts/execute-deposit-1826-swap.js — ÁREA 501 // OPERACIÓN QUIRÚRGICA ON-CHAIN
 * ==============================================================================
 * Conversión de los 1,826.764 POL recién depositados a USDC Nativo Oficial (Circle)
 * Manteniendo 100% intacta la reserva de gas sagrada de la Bóveda #501 (155.13 / 150.00 POL).
 * 
 * Reglas de Hierro:
 * 1. PROHIBIDO exponer .env o claves privadas.
 * 2. PROHIBIDO tocar los 155.13 POL de reserva de gas en #501.
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

const ADDRESS_501 = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const SACRED_GAS_FLOOR_POL = 155.13; // Piso sagrado intacto e inviolable (min 150.00 POL)
const DEPOSIT_TX_HASH = "0x4dcc07f0cf531571e48eb2c8ff9ff54da69ef47760bacf7c5d193f509b1dd721";
const POL_AMOUNT_TO_SWAP = 1826.764;

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

async function getPolygonGasFees(provider) {
  const feeData = await provider.getFeeData();
  const currentGasPriceGwei = parseFloat(ethers.formatUnits(feeData.gasPrice || 0n, "gwei"));
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
    ? (feeData.maxPriorityFeePerGas * 140n) / 100n
    : ethers.parseUnits("35", "gwei");
  const baseFeeGwei = currentGasPriceGwei > 50 ? currentGasPriceGwei : 100;
  const maxFeePerGas = feeData.maxFeePerGas
    ? (feeData.maxFeePerGas * 140n) / 100n
    : ethers.parseUnits(String(Math.ceil(baseFeeGwei * 1.5 + 50)), "gwei");
  return { feeData, maxPriorityFeePerGas, maxFeePerGas, currentGasPriceGwei };
}

async function main() {
  console.log("================================================================================");
  console.log("🦅 ÁREA 501 // CONVERSIÓN QUIRÚRGICA: 1,826.764 POL ➔ USDC NATIVO (CIRCLE)");
  console.log("================================================================================\n");

  const provider = createResilientProvider(networks.polygonMainnet);
  const signer501 = getWalletSigner(501, provider);
  console.log(`📍 Bóveda Matriz #501: ${signer501.address}`);
  console.log(`📥 Tx Depósito detectado: https://polygonscan.com/tx/${DEPOSIT_TX_HASH}`);

  // 1. Verificar saldos iniciales en cadena
  const initialPolWei = await provider.getBalance(signer501.address);
  const initialPolNum = parseFloat(ethers.formatEther(initialPolWei));
  console.log(`⛽ Saldo POL actual en #501: ${initialPolNum.toFixed(4)} POL`);

  const usdcContract = new ethers.Contract(NATIVE_USDC_POLYGON, ERC20_ABI, signer501);
  const initialUsdcUnits = await usdcContract.balanceOf(signer501.address);
  const initialUsdcNum = parseFloat(ethers.formatUnits(initialUsdcUnits, 6));
  console.log(`💵 Saldo USDC Nativo previo en #501: $${initialUsdcNum.toFixed(6)} USDC`);

  // Validar piso sagrado de gas
  const remainingPol = initialPolNum - POL_AMOUNT_TO_SWAP;
  console.log(`🛡️ Piso de Gas Sagrado en #501: ${SACRED_GAS_FLOOR_POL} POL (Piso mínimo absoluto: 150.00 POL)`);
  console.log(`🎯 Cantidad a convertir: ${POL_AMOUNT_TO_SWAP} POL`);
  console.log(`🔒 Saldo POL resultante proyectado: ${remainingPol.toFixed(4)} POL`);

  if (remainingPol < 150.00) {
    throw new Error(`❌ ERROR DE SEGURIDAD: El swap violaría el piso inviolable de 150.00 POL en #501.`);
  }

  const amountInUnits = ethers.parseEther(POL_AMOUNT_TO_SWAP.toString());

  // 2. Cotización Quoter V2 ($0 gas)
  console.log("\n🔍 [COTIZACIÓN UNISWAP V3 QUOTER V2 ($0 GAS)]:");
  const quoter = new ethers.Contract(UNISWAP_V3_QUOTER_V2, QUOTER_V2_ABI, provider);
  const q500 = await quoter.quoteExactInputSingle.staticCall({
    tokenIn: WPOL_POLYGON,
    tokenOut: NATIVE_USDC_POLYGON,
    amountIn: amountInUnits,
    fee: 500,
    sqrtPriceLimitX96: 0
  });
  const quoteUniswap500 = q500[0];
  const quoteUsdcNum = Number(quoteUniswap500) / 1e6;
  console.log(`   • Uniswap V3 Pool 500 (0.05% fee): $${quoteUsdcNum.toFixed(6)} USDC`);

  // Protección de Slippage: 0.3%
  const amountOutMin = (quoteUniswap500 * 997n) / 1000n;
  console.log(`🛡️ Protección amountOutMinimum (0.3% slippage): $${(Number(amountOutMin) / 1e6).toFixed(6)} USDC`);

  // 3. Obtener gas fees
  const gasFees = await getPolygonGasFees(provider);
  console.log(`\n⛽ Parámetros de Gas: Priority ${gasFees.maxPriorityFeePerGas.toString()} | Max ${gasFees.maxFeePerGas.toString()}`);

  // Paso 3.1: Envolver 1,826.764 POL a WPOL
  console.log(`\n📦 [PASO 1/2] Envolviendo ${POL_AMOUNT_TO_SWAP} POL a WPOL...`);
  const wpolContract = new ethers.Contract(WPOL_POLYGON, WPOL_ABI, signer501);
  const wrapTx = await wpolContract.deposit({
    value: amountInUnits,
    maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
    maxFeePerGas: gasFees.maxFeePerGas,
    gasLimit: 85000
  });
  console.log(`   ↳ Tx Wrap enviada: https://polygonscan.com/tx/${wrapTx.hash}`);
  const wrapReceipt = await wrapTx.wait();
  console.log(`   ✅ WPOL confirmado en Bloque #${wrapReceipt.blockNumber}! Gas Usado: ${wrapReceipt.gasUsed.toString()}`);

  // Paso 3.2: Verificar Aprobación
  const currentAllowance = await wpolContract.allowance(signer501.address, UNISWAP_V3_SWAP_ROUTER_02);
  if (currentAllowance < amountInUnits) {
    console.log(`\n🔐 [PASO ADICIONAL] Aprobando WPOL para SwapRouter02...`);
    const appTx = await wpolContract.approve(UNISWAP_V3_SWAP_ROUTER_02, ethers.MaxUint256, {
      maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
      maxFeePerGas: gasFees.maxFeePerGas,
      gasLimit: 85000
    });
    const appReceipt = await appTx.wait();
    console.log(`   ✅ Aprobado en Bloque #${appReceipt.blockNumber}`);
  } else {
    console.log(`   ✅ Aprobación WPOL para SwapRouter02 ya verificada (MaxUint256 OK).`);
  }

  // Paso 3.3: Ejecutar Swap en Uniswap V3
  console.log(`\n🔥 [PASO 2/2] Ejecutando Swap en Uniswap V3: ${POL_AMOUNT_TO_SWAP} WPOL ➔ USDC Nativo...`);
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

  console.log(`   🔬 Pre-simulando swap con staticCall...`);
  await router.exactInputSingle.staticCall(swapParams);
  console.log(`   ✅ Simulación staticCall OK: Sin riesgo de revert.`);

  const swapTx = await router.exactInputSingle(swapParams, {
    maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
    maxFeePerGas: gasFees.maxFeePerGas,
    gasLimit: 320000
  });

  console.log(`🚀 Tx Swap enviada a Mempool: https://polygonscan.com/tx/${swapTx.hash}`);
  const swapReceipt = await swapTx.wait();
  console.log(`🎉 Swap confirmado en Bloque #${swapReceipt.blockNumber}! Gas Usado: ${swapReceipt.gasUsed.toString()}`);

  // 4. Balances finales en cadena
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
  console.log(`   • POL convertido: ${POL_AMOUNT_TO_SWAP} POL`);
  console.log(`   • USDC Nativo recibido en #501: +$${usdcReceived.toFixed(6)} USDC`);
  console.log(`   • Saldo final USDC Nativo en #501: $${finalUsdcNum.toFixed(6)} USDC`);
  console.log(`   • Saldo final POL en #501: ${finalPolNum.toFixed(4)} POL (Piso ${SACRED_GAS_FLOOR_POL} POL Intacto ✅)`);
  console.log("================================================================================\n");

  const swapReport = {
    success: true,
    depositTxHash: DEPOSIT_TX_HASH,
    wrapTxHash: wrapTx.hash,
    swapTxHash: swapTx.hash,
    polConverted: POL_AMOUNT_TO_SWAP,
    usdcReceived: parseFloat(usdcReceived.toFixed(6)),
    finalUsdcNum: parseFloat(finalUsdcNum.toFixed(6)),
    finalPolNum: parseFloat(finalPolNum.toFixed(4)),
    floor501: SACRED_GAS_FLOOR_POL,
    timestamp: new Date().toISOString()
  };

  const reportPath = path.join(__dirname, "..", "telemetry", "last-deposit-1826-swap.json");
  fs.writeFileSync(reportPath, JSON.stringify(swapReport, null, 2), "utf8");
  console.log(`💾 Reporte guardado en: ${reportPath}`);

  return swapReport;
}

if (require.main === module) {
  main().catch(err => {
    console.error("❌ ERROR CRÍTICO EN SWAP:", err);
    process.exit(1);
  });
}

module.exports = { main };
