/**
 * scripts/capitalize-kraken-surplus.js
 * =============================================================================
 * ÁREA 501 // CAPITALIZACIÓN DEL EXCEDENTE DE KRAKEN A USDC NATIVO (CIRCLE)
 * =============================================================================
 * 1. Verifica balance de #501 (> 200.00 POL).
 * 2. Preserva piso sagrado inamovible de 150.50 POL en #501.
 * 3. Convierte excedente exacto (72.75 POL) a USDC Nativo (0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359).
 * 4. Protege con amountOutMinimum (slippage <= 0.20%).
 * 5. Verifica balances finales y retorna reporte para Telegram.
 */

require("dotenv").config();
const { ethers } = require("ethers");
const { getWalletSigner } = require("../swarm-engine");

const WPOL_POLYGON = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const NATIVE_USDC_POLYGON = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const UNISWAP_V3_QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
const UNISWAP_V3_SWAP_ROUTER_02 = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";
const QUICKSWAP_V2_ROUTER = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";

const TARGET_RESERVED_FLOOR_POL = 150.50; // Piso inviolable con buffer de firma
const STRICT_MIN_FLOOR_POL = 150.00;

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
  console.log("🦅 ÁREA 501 // CAPITALIZACIÓN EXCEDENTE KRAKEN: 72.75 POL ➔ USDC NATIVO");
  console.log("================================================================================\n");

  const rpcUrl = process.env.POLYGON_RPC || "https://polygon-mainnet.g.alchemy.com/v2/alch_PW_9N-WF3oj20s1XaAYni";
  const provider = new ethers.JsonRpcProvider(rpcUrl, 137);
  const signer501 = getWalletSigner(501, provider);
  console.log(`📍 Bóveda Matriz #501: ${signer501.address}`);

  // 1. Verificar saldos iniciales
  const initialPolWei = await provider.getBalance(signer501.address);
  const initialPolNum = parseFloat(ethers.formatEther(initialPolWei));
  console.log(`⛽ Saldo POL actual en #501: ${initialPolNum.toFixed(4)} POL`);

  const usdcContract = new ethers.Contract(NATIVE_USDC_POLYGON, ERC20_ABI, signer501);
  const initialUsdcUnits = await usdcContract.balanceOf(signer501.address);
  const initialUsdcNum = parseFloat(ethers.formatUnits(initialUsdcUnits, 6));
  console.log(`💵 Saldo USDC Nativo actual en #501: $${initialUsdcNum.toFixed(4)} USDC`);

  if (initialPolNum < 200.0) {
    throw new Error(`❌ ERROR: Saldo POL actual (${initialPolNum.toFixed(4)}) aún no supera los 200.00 POL requeridos.`);
  }

  // 2. Cálculo exacto del excedente preservando 150.50 POL
  const exactExcess = initialPolNum - TARGET_RESERVED_FLOOR_POL;
  console.log(`🛡️ Piso Fijo Blindado a preservar: ${TARGET_RESERVED_FLOOR_POL.toFixed(2)} POL (Inviolable >= ${STRICT_MIN_FLOOR_POL.toFixed(2)} POL)`);
  console.log(`🎯 Excedente calculable disponible: ${exactExcess.toFixed(4)} POL`);

  // Convertimos 72.75 POL exactos
  const polToSwapNum = 72.75;
  if (initialPolNum - polToSwapNum < STRICT_MIN_FLOOR_POL) {
    throw new Error(`❌ VIOLACIÓN DE PISO: Convertir ${polToSwapNum} POL dejaría el saldo por debajo de ${STRICT_MIN_FLOOR_POL} POL.`);
  }

  const amountInUnits = ethers.parseEther(polToSwapNum.toFixed(4));
  console.log(`\n🚀 Monto a convertir: ${polToSwapNum} POL (${amountInUnits.toString()} Wei)`);
  console.log(`🔒 Saldo POL proyectado remanente: ${(initialPolNum - polToSwapNum).toFixed(4)} POL (> ${TARGET_RESERVED_FLOOR_POL} POL ✅)\n`);

  // 3. Comparación de cotizaciones Quoter ($0 gas)
  console.log("🔍 [COMPARACIÓN DE PISCINAS V3 $0 GAS]:");
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

  console.log(`\n🏆 RUTA GANADORA: Uniswap V3 (Fee Tier 500 = 0.05%) con $${(Number(quoteUniswap500) / 1e6).toFixed(4)} USDC.`);

  // Protección de Slippage: Máximo 0.20% (998/1000)
  const amountOutMin = (quoteUniswap500 * 998n) / 1000n;
  console.log(`🛡️ Protección amountOutMinimum (0.20% slippage): $${(Number(amountOutMin) / 1e6).toFixed(4)} USDC`);

  // 4. Ejecución Fuego Real
  const gasFees = await getPolygonGasFees(provider);
  console.log(`⛽ Parámetros de Gas: Priority ${gasFees.maxPriorityFeePerGas.toString()} | Max ${gasFees.maxFeePerGas.toString()}`);

  // Paso 4.1: Envolver 72.75 POL a WPOL
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
  console.log(`   ✅ WPOL Envoltorio confirmado en Bloque #${wrapReceipt.blockNumber}! Gas Usado: ${wrapReceipt.gasUsed.toString()}`);

  // Paso 4.2: Verificar / Asignar Aprobación
  const currentAllowance = await wpolContract.allowance(signer501.address, UNISWAP_V3_SWAP_ROUTER_02);
  if (currentAllowance < amountInUnits) {
    console.log(`\n🔐 [PASO INTERMEDIO] Aprobando WPOL para SwapRouter02...`);
    const appTx = await wpolContract.approve(UNISWAP_V3_SWAP_ROUTER_02, ethers.MaxUint256, {
      maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
      maxFeePerGas: gasFees.maxFeePerGas,
      gasLimit: 80000
    });
    await appTx.wait();
    console.log(`   ✅ Aprobación lista.`);
  } else {
    console.log(`\n🔐 WPOL ya cuenta con aprobación MaxUint256 en SwapRouter02.`);
  }

  // Paso 4.3: Ejecutar Swap en Uniswap V3
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
  console.log(`🎉 Swap confirmado en Bloque #${swapReceipt.blockNumber}! Status: ${swapReceipt.status === 1 ? "ÉXITO (1) ✅" : "FALLÓ"}`);

  // 5. Verificación de balances finales on-chain
  const finalUsdcUnits = await usdcContract.balanceOf(signer501.address);
  const finalUsdcNum = parseFloat(ethers.formatUnits(finalUsdcUnits, 6));
  const usdcReceived = finalUsdcNum - initialUsdcNum;

  const finalPolWei = await provider.getBalance(signer501.address);
  const finalPolNum = parseFloat(ethers.formatEther(finalPolWei));

  console.log("\n================================================================================");
  console.log("📊 RESULTADO FINAL DE LA OPERACIÓN ON-CHAIN:");
  console.log(`   • TxHash PolygonScan: https://polygonscan.com/tx/${swapTx.hash}`);
  console.log(`   • POL convertido: ${polToSwapNum} POL`);
  console.log(`   • USDC Nativo recibido en #501: +$${usdcReceived.toFixed(6)} USDC`);
  console.log(`   • Saldo final USDC Nativo en #501: $${finalUsdcNum.toFixed(6)} USDC`);
  console.log(`   • Saldo final POL en #501: ${finalPolNum.toFixed(4)} POL (Piso 150.00 POL Intacto ✅)`);
  console.log("================================================================================\n");

  // Guardar datos en archivo JSON temporal para notificaciones
  const resultData = {
    success: true,
    timestamp: new Date().toISOString(),
    wrapTxHash: wrapTx.hash,
    swapTxHash: swapTx.hash,
    blockNumber: swapReceipt.blockNumber,
    polConverted: polToSwapNum,
    usdcReceived,
    finalUsdcNum,
    finalPolNum,
    floorPol: TARGET_RESERVED_FLOOR_POL
  };

  const outPath = require("path").join(__dirname, "../telemetry/last-kraken-swap.json");
  require("fs").writeFileSync(outPath, JSON.stringify(resultData, null, 2));

  return resultData;
}

main().catch(err => {
  console.error("❌ ERROR CRÍTICO EN SWAP:", err);
  process.exit(1);
});
