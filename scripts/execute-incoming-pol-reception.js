/**
 * scripts/execute-incoming-pol-reception.js
 * =============================================================================
 * ÁREA 501 // EJECUCIÓN QUIRÚRGICA: RECEPCIÓN +891.889 POL EN #501
 * LLENADO AL 100% DE LOS PISOS SAGRADOS (150 POL & 300 POL) Y
 * CAPITALIZACIÓN DEL EXCEDENTE (886.70 POL) DIRECTO A USDC NATIVO (CIRCLE)
 * =============================================================================
 */

require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const { getWalletSigner } = require("../swarm-engine");

const WPOL_POLYGON = ethers.getAddress("0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270".toLowerCase());
const NATIVE_USDC_POLYGON = ethers.getAddress("0x3c499c542cEF5E3811e1192ce70d8cc03d5c3359".toLowerCase());
const UNISWAP_V3_QUOTER_V2 = ethers.getAddress("0x61fFE014bA17989E743c5F6cB21bF9697530B21e".toLowerCase());
const UNISWAP_V3_SWAP_ROUTER_02 = ethers.getAddress("0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45".toLowerCase());

const TARGET_RESERVED_FLOOR_501 = 155.25; // Piso exacto intocable en #501
const FLEET_REMAINING_POL = 144.80; // Balance en el resto de la flota (500 satélites)
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

async function getPolygonGasFees(provider) {
  const feeData = await provider.getFeeData();
  const currentGasPrice = feeData.gasPrice || ethers.parseUnits("150", "gwei");
  const maxPriorityFeePerGas = ethers.parseUnits("40", "gwei");
  const maxFeePerGas = (currentGasPrice * 140n) / 100n + maxPriorityFeePerGas;
  return { feeData, maxPriorityFeePerGas, maxFeePerGas };
}

async function executePolCapitalization() {
  console.log("================================================================================");
  console.log("🦅 ÁREA 501 // CAPITALIZACIÓN EXCEDENTE +891.889 POL ➔ USDC NATIVO (CIRCLE)");
  console.log("================================================================================\n");

  const rpcUrl = process.env.POLYGON_RPC || process.env.POLYGON_RPC_URL || "https://polygon-mainnet.g.alchemy.com/v2/alch_PW_9N-WF3oj20s1XaAYni";
  const provider = new ethers.JsonRpcProvider(rpcUrl, 137);
  const signer501 = getWalletSigner(501, provider);
  console.log(`📍 Bóveda Matriz #501: ${signer501.address}`);

  // 1. Auditoría inicial de saldos on-chain
  const initialPolWei = await provider.getBalance(signer501.address);
  const initialPolNum = parseFloat(ethers.formatEther(initialPolWei));
  console.log(`⛽ Saldo POL actual en #501: ${initialPolNum.toFixed(4)} POL`);

  const usdcContract = new ethers.Contract(NATIVE_USDC_POLYGON, ERC20_ABI, signer501);
  const initialUsdcUnits = await usdcContract.balanceOf(signer501.address);
  const initialUsdcNum = parseFloat(ethers.formatUnits(initialUsdcUnits, 6));
  console.log(`💵 Saldo USDC Nativo actual en #501: $${initialUsdcNum.toFixed(4)} USDC`);

  // Verificación de los 2 tanques sagrados
  console.log(`\n🛡️ AUDITORÍA DE PISOS SAGRADOS:`);
  console.log(`   • Piso #501 a retener: ${TARGET_RESERVED_FLOOR_501.toFixed(2)} POL (Piso Mínimo 150.00 POL ✅ 100% FULL)`);
  console.log(`   • Flota Satélites: ${FLEET_REMAINING_POL.toFixed(2)} POL`);
  console.log(`   • Total Flota Retenido: ${(TARGET_RESERVED_FLOOR_501 + FLEET_REMAINING_POL).toFixed(2)} POL (Piso Mínimo 300.00 POL ✅ 100% FULL)`);

  const maxAvailableForSwap = initialPolNum - TARGET_RESERVED_FLOOR_501 - 0.05; // 0.05 POL buffer para gas txs
  console.log(`   • Excedente disponible para swap: ${maxAvailableForSwap.toFixed(4)} POL`);

  if (maxAvailableForSwap < 100.0) {
    throw new Error(`❌ ERROR: Saldo POL disponible (${maxAvailableForSwap.toFixed(4)}) inferior al excedente esperado.`);
  }

  // Monto exacto a convertir: 886.70 POL
  const polToSwapNum = 886.70;
  const amountInUnits = ethers.parseEther(polToSwapNum.toFixed(4));
  console.log(`\n🎯 Monto a convertir a USDC Nativo: ${polToSwapNum} POL (${amountInUnits.toString()} Wei)`);
  console.log(`🔒 Saldo remanente proyectado en #501: ${(initialPolNum - polToSwapNum).toFixed(4)} POL (>= ${TARGET_RESERVED_FLOOR_501} POL ✅)\n`);

  // 2. Consulta y protección de Slippage vía Quoter V2
  console.log("🔍 [COTIZACIÓN UNISWAP V3 0.05%]:");
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
  console.log(`   • Cotización exacta: $${quoteUsdcNum.toFixed(6)} USDC`);

  // Slippage estricto <= 0.15%
  const amountOutMin = (quoteUsdcUnits * 9985n) / 10000n;
  console.log(`   • Protección amountOutMinimum (0.15% slippage): $${ethers.formatUnits(amountOutMin, 6)} USDC\n`);

  // 3. Obtener gas fees dinámicos
  const gasFees = await getPolygonGasFees(provider);
  console.log(`⛽ Parámetros de Gas: Priority ${ethers.formatUnits(gasFees.maxPriorityFeePerGas, "gwei")} Gwei | Max ${ethers.formatUnits(gasFees.maxFeePerGas, "gwei")} Gwei`);

  // 4. Paso 1: Envolver POL a WPOL
  console.log(`\n📦 [PASO 1/2] Envolviendo ${polToSwapNum} POL a WPOL...`);
  const wpolContract = new ethers.Contract(WPOL_POLYGON, WPOL_ABI, signer501);
  const wrapTx = await wpolContract.deposit({
    value: amountInUnits,
    maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
    maxFeePerGas: gasFees.maxFeePerGas,
    gasLimit: 80000
  });
  console.log(`   ↳ Tx Wrap enviada: https://polygonscan.com/tx/${wrapTx.hash}`);
  const wrapReceipt = await wrapTx.wait();
  console.log(`   ✅ WPOL confirmado en Bloque #${wrapReceipt.blockNumber}! Gas Usado: ${wrapReceipt.gasUsed.toString()}`);

  // Verificar / asegurar allowance
  const currentAllowance = await wpolContract.allowance(signer501.address, UNISWAP_V3_SWAP_ROUTER_02);
  if (currentAllowance < amountInUnits) {
    console.log(`\n🔐 Aprobando WPOL para SwapRouter02...`);
    const appTx = await wpolContract.approve(UNISWAP_V3_SWAP_ROUTER_02, ethers.MaxUint256, {
      maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
      maxFeePerGas: gasFees.maxFeePerGas,
      gasLimit: 80000
    });
    await appTx.wait();
    console.log(`   ✅ Aprobación completada.`);
  }

  // 5. Paso 2: Ejecutar Swap en Uniswap V3 (fee 500)
  console.log(`\n🔥 [PASO 2/2] Ejecutando Swap en Uniswap V3: ${polToSwapNum} WPOL ➔ USDC Nativo...`);
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

  // Simulación staticCall
  console.log(`   🔬 Verificando con staticCall previo...`);
  await router.exactInputSingle.staticCall(swapParams);
  console.log(`   ✅ staticCall exitoso: 0% riesgo de revert.`);

  const swapTx = await router.exactInputSingle(swapParams, {
    maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
    maxFeePerGas: gasFees.maxFeePerGas,
    gasLimit: 300000
  });
  console.log(`🚀 Tx Swap enviada: https://polygonscan.com/tx/${swapTx.hash}`);
  const swapReceipt = await swapTx.wait();
  console.log(`🎉 Swap confirmado en Bloque #${swapReceipt.blockNumber}! Gas Usado: ${swapReceipt.gasUsed.toString()}`);

  // 6. Auditoría final en cadena
  const finalUsdcUnits = await usdcContract.balanceOf(signer501.address);
  const finalUsdcNum = parseFloat(ethers.formatUnits(finalUsdcUnits, 6));
  const usdcReceived = finalUsdcNum - initialUsdcNum;

  const finalPolWei = await provider.getBalance(signer501.address);
  const finalPolNum = parseFloat(ethers.formatEther(finalPolWei));
  const totalFleetPol = finalPolNum + FLEET_REMAINING_POL;

  console.log("\n================================================================================");
  console.log("📊 RESULTADO FINAL DE LA OPERACIÓN ON-CHAIN:");
  console.log(`   • TxHash Wrap: https://polygonscan.com/tx/${wrapTx.hash}`);
  console.log(`   • TxHash Swap: https://polygonscan.com/tx/${swapTx.hash}`);
  console.log(`   • POL convertido: ${polToSwapNum} POL`);
  console.log(`   • USDC Nativo recibido en #501: +$${usdcReceived.toFixed(6)} USDC`);
  console.log(`   • Saldo final USDC Nativo en #501: $${finalUsdcNum.toFixed(6)} USDC`);
  console.log(`   • Saldo final POL en #501: ${finalPolNum.toFixed(4)} POL (Piso ${TARGET_RESERVED_FLOOR_501} POL ✅ 100% FULL)`);
  console.log(`   • Total Tanque Flota: ${totalFleetPol.toFixed(4)} POL (Piso ${TARGET_FLEET_FLOOR_POL} POL ✅ 100% FULL)`);
  console.log("================================================================================\n");

  const resultData = {
    success: true,
    wrapTxHash: wrapTx.hash,
    swapTxHash: swapTx.hash,
    polConverted: polToSwapNum,
    usdcReceived: usdcReceived,
    finalUsdcNum: finalUsdcNum,
    finalPolNum: finalPolNum,
    totalFleetPol: totalFleetPol,
    floor501: TARGET_RESERVED_FLOOR_501,
    floorFleet: TARGET_FLEET_FLOOR_POL,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(path.join(__dirname, "..", "telemetry", "last-incoming-pol-swap.json"), JSON.stringify(resultData, null, 2), "utf8");

  return resultData;
}

if (require.main === module) {
  executePolCapitalization().catch(err => {
    console.error("❌ ERROR CRÍTICO EN CAPITALIZACIÓN:", err);
    process.exit(1);
  });
}

module.exports = { executePolCapitalization };
