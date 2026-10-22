require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { ethers } = require('ethers');
const { createResilientProvider, networks } = require('../networks');

async function testQuotes() {
  const polProvider = createResilientProvider(networks.polygonMainnet);
  const bscProvider = createResilientProvider(networks.bscMainnet);

  const ROUTER_ABI = [
    'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)'
  ];

  const QUOTER_V2_ABI = [
    'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)'
  ];

  console.log('=== VERIFICANDO COTIZACIONES DEX REALES EN TIEMPO REAL ===');

  // 1. Polygon: 10 POL a USDC
  const polIn = ethers.parseEther('10.0');
  const wpol = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270';
  const usdcPol = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'; // Native Circle USDC (6 dec)

  // QuickSwap V2
  try {
    const qk = new ethers.Contract('0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', ROUTER_ABI, polProvider);
    const qkRes = await qk.getAmountsOut(polIn, [wpol, usdcPol]);
    console.log('🟢 QuickSwap V2 (Polygon): 10 POL ->', ethers.formatUnits(qkRes[1], 6), 'USDC Nativo');
  } catch (err) {
    console.log('⚠️ QuickSwap V2 error:', err.message);
  }

  // Uniswap V3 QuoterV2 (fee: 500 = 0.05%)
  try {
    const quoter = new ethers.Contract('0x61fFE014bA17989E743c5F6cB21bF9697530B21e', QUOTER_V2_ABI, polProvider);
    const quoteRes = await quoter.quoteExactInputSingle.staticCall({
      tokenIn: wpol,
      tokenOut: usdcPol,
      amountIn: polIn,
      fee: 500,
      sqrtPriceLimitX96: 0
    });
    console.log('🟢 Uniswap V3 (0.05% Fee): 10 POL ->', ethers.formatUnits(quoteRes[0], 6), 'USDC Nativo');
  } catch (err) {
    console.log('⚠️ Uniswap V3 0.05% error:', err.message);
  }

  // 2. BSC: 0.0015 BNB a USDC
  const bnbIn = ethers.parseEther('0.0015');
  const wbnb = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
  const usdcBsc = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'; // 18 dec

  try {
    const pc = new ethers.Contract('0x10ED43C718714eb63d5aA57B78B54704E256024E', ROUTER_ABI, bscProvider);
    const pcRes = await pc.getAmountsOut(bnbIn, [wbnb, usdcBsc]);
    console.log('🟢 PancakeSwap V2 (BSC): 0.0015 BNB ->', ethers.formatUnits(pcRes[1], 18), 'USDC Oficial BSC');
  } catch (err) {
    console.log('⚠️ PancakeSwap V2 error:', err.message);
  }
}

testQuotes().catch(console.error);
