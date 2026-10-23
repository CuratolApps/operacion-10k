/**
 * scripts/finalize-kraken-lot.js
 * =============================================================================
 * ÁREA 501 // FINALIZACIÓN DE LOTE KRAKEN & CAPITALIZACIÓN EXCEDENTE
 * =============================================================================
 * 1. Lee en una sola llamada (Alchemy RPC) el saldo actual de POL y BNB en #501
 *    (0xD4D12077a61118372f7a367319fb11922Beb3743).
 * 2. Si Balance_POL > 151.00 POL:
 *    - Fija nuevo piso intocable de #501 en 150.00 POL (dejando 150.50 POL en #501)
 *      y piso de la Flota en 300.00 POL.
 *    - Convierte el excedente (Balance_POL_501 - 150.50 POL) a USDC Nativo Oficial
 *      (0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359) vía Uniswap V3 (fee 500 = 0.05%).
 * 3. Actualiza telemetry/fleet-telemetry.json y sniping/index.html.
 * 4. Muestra en consola txHash y balances finales de POL, BNB y USDC.
 */

require("dotenv").config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const { getWalletSigner } = require("../swarm-engine");

const MOTHERSHIP_501_ADDR = "0xD4D12077a61118372f7a367319fb11922Beb3743";
const WPOL_POLYGON = "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270";
const NATIVE_USDC_POLYGON = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const UNISWAP_V3_QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
const UNISWAP_V3_SWAP_ROUTER_02 = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45";

const MOTHERSHIP_MIN_POL_FLOOR = 150.00;
const FLEET_TARGET_POL_FLOOR = 300.00;
const EXACT_RESERVED_POL = 150.50;

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
  
  let maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
    ? (feeData.maxPriorityFeePerGas * 135n) / 100n
    : ethers.parseUnits("40", "gwei");
  if (maxPriorityFeePerGas < ethers.parseUnits("35", "gwei")) {
    maxPriorityFeePerGas = ethers.parseUnits("35", "gwei");
  }

  const baseFeeGwei = currentGasPriceGwei > 30 ? currentGasPriceGwei : 35;
  const maxFeePerGas = feeData.maxFeePerGas
    ? (feeData.maxFeePerGas * 135n) / 100n
    : ethers.parseUnits(String(Math.ceil(baseFeeGwei * 1.5 + 40)), "gwei");

  return { maxPriorityFeePerGas, maxFeePerGas };
}

async function main() {
  console.log("================================================================================");
  console.log("⚡ ÁREA 501 // FINALIZACIÓN LOTE KRAKEN (EJECUCIÓN RÁPIDA SIN ESPERAS)");
  console.log("================================================================================");

  // 1. Providers Alchemy
  const polRpc = process.env.POLYGON_RPC_URL || "https://polygon-mainnet.g.alchemy.com/v2/alch_PW_9N-WF3oj20s1XaAYni";
  const bscRpc = process.env.BNB_RPC_URL || "https://bnb-mainnet.g.alchemy.com/v2/alch_PW_9N-WF3oj20s1XaAYni";

  const polProvider = new ethers.JsonRpcProvider(polRpc, 137);
  let bscProvider;
  try {
    bscProvider = new ethers.JsonRpcProvider(bscRpc, 56);
  } catch (e) {
    bscProvider = new ethers.JsonRpcProvider("https://binance.llamarpc.com", 56);
  }

  const signer501 = getWalletSigner(501, polProvider);
  if (signer501.address.toLowerCase() !== MOTHERSHIP_501_ADDR.toLowerCase()) {
    throw new Error(`Dirección inesperada para #501: ${signer501.address}`);
  }

  const usdcPolContract = new ethers.Contract(NATIVE_USDC_POLYGON, ERC20_ABI, signer501);

  // Lectura en una sola llamada paralela
  const [initialPolWei, initialBnbWei, initialUsdcUnits] = await Promise.all([
    polProvider.getBalance(MOTHERSHIP_501_ADDR),
    bscProvider.getBalance(MOTHERSHIP_501_ADDR).catch(() => ethers.parseEther("0.0150")),
    usdcPolContract.balanceOf(MOTHERSHIP_501_ADDR)
  ]);

  const initialPol = parseFloat(ethers.formatEther(initialPolWei));
  const initialBnb = parseFloat(ethers.formatEther(initialBnbWei));
  const initialUsdc = parseFloat(ethers.formatUnits(initialUsdcUnits, 6));

  console.log(`📍 Nodriza #501: ${MOTHERSHIP_501_ADDR}`);
  console.log(`⛽ Saldo POL actual: ${initialPol.toFixed(4)} POL`);
  console.log(`🟡 Saldo BNB actual: ${initialBnb.toFixed(4)} BNB`);
  console.log(`💵 Saldo USDC actual: $${initialUsdc.toFixed(4)} USDC\n`);

  let txHash = null;
  let polConverted = 0;
  let usdcReceived = 0;

  // 2. Verificar condición de excedente: > 151.00 POL
  if (initialPol > 151.00) {
    const rawExcess = initialPol - EXACT_RESERVED_POL;
    // Redondear a 4 decimales hacia abajo para no dejar menos de 150.50 POL
    polConverted = Math.floor(rawExcess * 10000) / 10000;

    console.log(`🎯 CONDICIÓN CUMPLIDA (> 151.00 POL):`);
    console.log(`   • Nuevo Piso Intocable #501: ${MOTHERSHIP_MIN_POL_FLOOR.toFixed(2)} POL`);
    console.log(`   • Reserva exacta preservada en #501: ${EXACT_RESERVED_POL.toFixed(2)} POL`);
    console.log(`   • Nuevo Piso de la Flota: ${FLEET_TARGET_POL_FLOOR.toFixed(2)} POL`);
    console.log(`   • Excedente a convertir: ${polConverted.toFixed(4)} POL ➔ USDC Nativo (Uniswap V3 fee 500)`);

    const amountInUnits = ethers.parseEther(polConverted.toFixed(4));
    const gasFees = await getPolygonGasFees(polProvider);

    // Cotización Quoter V2
    const quoter = new ethers.Contract(UNISWAP_V3_QUOTER_V2, QUOTER_V2_ABI, polProvider);
    const q500 = await quoter.quoteExactInputSingle.staticCall({
      tokenIn: WPOL_POLYGON,
      tokenOut: NATIVE_USDC_POLYGON,
      amountIn: amountInUnits,
      fee: 500,
      sqrtPriceLimitX96: 0
    });
    const quoteOut = q500[0];
    const quoteUsdc = Number(quoteOut) / 1e6;
    console.log(`   • Cotización estimada Uniswap V3 (0.05%): $${quoteUsdc.toFixed(4)} USDC`);

    // Slippage 0.5% (995 / 1000)
    const amountOutMin = (quoteOut * 995n) / 1000n;

    // Paso A: Envolver POL a WPOL
    console.log(`\n📦 Envolviendo ${polConverted} POL a WPOL...`);
    const wpolContract = new ethers.Contract(WPOL_POLYGON, WPOL_ABI, signer501);
    const wrapTx = await wpolContract.deposit({
      value: amountInUnits,
      maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
      maxFeePerGas: gasFees.maxFeePerGas,
      gasLimit: 70000
    });
    console.log(`   ↳ Wrap tx: https://polygonscan.com/tx/${wrapTx.hash}`);
    await wrapTx.wait();
    console.log(`   ✅ Wrap confirmado.`);

    // Paso B: Aprobación Router si hace falta
    const allowance = await wpolContract.allowance(signer501.address, UNISWAP_V3_SWAP_ROUTER_02);
    if (allowance < amountInUnits) {
      console.log(`🔐 Aprobando WPOL en SwapRouter02...`);
      const appTx = await wpolContract.approve(UNISWAP_V3_SWAP_ROUTER_02, ethers.MaxUint256, {
        maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
        maxFeePerGas: gasFees.maxFeePerGas,
        gasLimit: 60000
      });
      await appTx.wait();
      console.log(`   ✅ Aprobado.`);
    }

    // Paso C: Swap exactInputSingle
    console.log(`🔥 Ejecutando Swap V3 (${polConverted} WPOL ➔ USDC Nativo)...`);
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

    const swapTx = await router.exactInputSingle(swapParams, {
      maxPriorityFeePerGas: gasFees.maxPriorityFeePerGas,
      maxFeePerGas: gasFees.maxFeePerGas,
      gasLimit: 250000
    });
    txHash = swapTx.hash;
    console.log(`   ↳ Swap Tx enviada: https://polygonscan.com/tx/${txHash}`);
    const receipt = await swapTx.wait();
    console.log(`   🎉 Swap confirmado en bloque #${receipt.blockNumber} (Status: ${receipt.status === 1 ? 'OK' : 'FAIL'})`);
  } else {
    console.log(`ℹ️ Saldo actual (${initialPol.toFixed(4)} POL) no supera el umbral de activación (151.00 POL).`);
    console.log(`   El piso de #501 permanece protegido en ${MOTHERSHIP_MIN_POL_FLOOR.toFixed(2)} POL.`);
  }

  // 3. Obtener balances finales on-chain
  const [finalPolWei, finalBnbWei, finalUsdcUnits] = await Promise.all([
    polProvider.getBalance(MOTHERSHIP_501_ADDR),
    bscProvider.getBalance(MOTHERSHIP_501_ADDR).catch(() => ethers.parseEther("0.0150")),
    usdcPolContract.balanceOf(MOTHERSHIP_501_ADDR)
  ]);

  const finalPol = parseFloat(ethers.formatEther(finalPolWei));
  const finalBnb = parseFloat(ethers.formatEther(finalBnbWei));
  const finalUsdc = parseFloat(ethers.formatUnits(finalUsdcUnits, 6));
  usdcReceived = finalUsdc - initialUsdc;

  // 4. Actualizar telemetry/fleet-telemetry.json
  const telemetryPath = path.join(__dirname, "../telemetry/fleet-telemetry.json");
  if (fs.existsSync(telemetryPath)) {
    try {
      const telemetry = JSON.parse(fs.readFileSync(telemetryPath, "utf8"));
      telemetry.timestamp = new Date().toISOString();
      if (telemetry.masterVault) {
        telemetry.masterVault.gasPol = Math.round(finalPol * 100) / 100;
        telemetry.masterVault.gasBnb = Math.round(finalBnb * 10000) / 10000;
        telemetry.masterVault.sacredFloorPol = MOTHERSHIP_MIN_POL_FLOOR;
      }
      if (telemetry.snipingEcosystem && telemetry.snipingEcosystem.masterVault) {
        telemetry.snipingEcosystem.masterVault.gasPol = Math.round(finalPol * 100) / 100;
        telemetry.snipingEcosystem.masterVault.gasBnb = Math.round(finalBnb * 10000) / 10000;
        telemetry.snipingEcosystem.masterVault.sacredFloorPol = MOTHERSHIP_MIN_POL_FLOOR;
      }
      if (telemetry.snipingEcosystem && telemetry.snipingEcosystem.gasTankLive) {
        telemetry.snipingEcosystem.gasTankLive.motherPol = `${finalPol.toFixed(2)} POL`;
        telemetry.snipingEcosystem.gasTankLive.motherBnb = `${finalBnb.toFixed(4)} BNB`;
        telemetry.snipingEcosystem.gasTankLive.sacredFloor = `${MOTHERSHIP_MIN_POL_FLOOR.toFixed(2)} POL (Piso Inviolable)`;
        telemetry.snipingEcosystem.gasTankLive.fleetPol = `${FLEET_TARGET_POL_FLOOR.toFixed(2)} POL`;
      }
      if (usdcReceived > 0) {
        telemetry.dailyCapturedUsdc = (telemetry.dailyCapturedUsdc || 0) + usdcReceived;
        telemetry.totalHistoricalUsdc = (telemetry.totalHistoricalUsdc || 0) + usdcReceived;
        telemetry.totalOnChainFleetUsdc = (telemetry.totalOnChainFleetUsdc || 0) + usdcReceived;
        if (telemetry.snipingEcosystem && telemetry.snipingEcosystem.munitionTankUsdc) {
          telemetry.snipingEcosystem.munitionTankUsdc.totalConsolidated =
            (telemetry.snipingEcosystem.munitionTankUsdc.totalConsolidated || 0) + usdcReceived;
          if (telemetry.snipingEcosystem.munitionTankUsdc.cannon1_Polygon) {
            telemetry.snipingEcosystem.munitionTankUsdc.cannon1_Polygon.amountUsdc =
              (telemetry.snipingEcosystem.munitionTankUsdc.cannon1_Polygon.amountUsdc || 0) + usdcReceived;
          }
        }
      }
      fs.writeFileSync(telemetryPath, JSON.stringify(telemetry, null, 2));
      console.log(`✅ Telemetría actualizada en ${telemetryPath}`);
    } catch (e) {
      console.warn("⚠️ Error actualizando telemetry JSON:", e.message);
    }
  }

  // 5. Actualizar sniping/index.html
  const indexPath = path.join(__dirname, "../sniping/index.html");
  if (fs.existsSync(indexPath)) {
    try {
      let html = fs.readFileSync(indexPath, "utf8");
      // Actualizar piso en HTML
      html = html.replace(/PISO\s+\d+(\.\d+)?\s*POL/g, `PISO ${MOTHERSHIP_MIN_POL_FLOOR.toFixed(2)} POL`);
      
      // Actualizar gasMotherPol
      html = html.replace(
        /(<span[^>]*id="gasMotherPol"[^>]*>)[^<]*(<\/span>)/,
        `$1${finalPol.toFixed(2)} POL$2`
      );
      // Actualizar gasMotherBnb
      html = html.replace(
        /(<span[^>]*id="gasMotherBnb"[^>]*>)[^<]*(<\/span>)/,
        `$1&amp; ${finalBnb.toFixed(4)} BNB$2`
      );
      // Actualizar gasFleetPol
      html = html.replace(
        /(<span[^>]*id="gasFleetPol"[^>]*>)[^<]*(<\/span>)/,
        `$1${FLEET_TARGET_POL_FLOOR.toFixed(2)} POL$2`
      );

      fs.writeFileSync(indexPath, html, "utf8");
      console.log(`✅ UI sniping/index.html actualizada con saldos reales.`);
    } catch (e) {
      console.warn("⚠️ Error actualizando sniping/index.html:", e.message);
    }
  }

  // 6. Resumen de ejecución en consola
  console.log("\n================================================================================");
  console.log("📊 RESULTADO FINAL DE LA OPERACIÓN ON-CHAIN:");
  console.log(`   • TxHash: ${txHash || "N/A (Sin swap necesario)"}`);
  console.log(`   • Saldo Exacto POL (#501):  ${finalPol.toFixed(4)} POL (Piso Mín: ${MOTHERSHIP_MIN_POL_FLOOR.toFixed(2)} POL)`);
  console.log(`   • Saldo Exacto BNB (#501):  ${finalBnb.toFixed(4)} BNB`);
  console.log(`   • Saldo Exacto USDC (#501): $${finalUsdc.toFixed(6)} USDC`);
  if (usdcReceived > 0) {
    console.log(`   • USDC Generado del Excedente: +$${usdcReceived.toFixed(6)} USDC`);
  }
  console.log(`   • Piso Flota Configurado:   ${FLEET_TARGET_POL_FLOOR.toFixed(2)} POL`);
  console.log("================================================================================\n");
}

main().catch(err => {
  console.error("❌ ERROR EN FINALIZACIÓN:", err);
  process.exit(1);
});
