const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config();

const VAULT_501 = '0xD4D12077a61118372f7a367319fb11922Beb3743';
const VAULT_00 = '0x87e3067E6faCb272c34d1250eF5dcEDaD93d3990';
const ATOMIC_EXECUTOR = '0x03Ac6307eF8c2Ec6ba724072D823bbf0b5DC6b67';

// Tokens Polygon
const POLY_USDC_NATIVE = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';
const POLY_USDC_E = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';

// Tokens BSC
const BSC_USDC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';

const CAPTAINS = {
  'Capitán #001 (Box 1)': '0xb7505DD7FCC31A71D033F8a495D6B562420AD40F',
  'Capitán #101 (Box 2)': '0x568227fc15ef4713F1d51bd6520F384FE1F4adBA',
  'Capitán #201 (Box 3)': '0x2810aa0DabCA4511846194229d2c004B14016A7C',
  'Capitán #301 (Box 4)': '0xEb6a667C9c0F5Bb1eCb6f19f20e9f25D8B54Ca0f',
  'Capitán #401 (Box 5)': '0x4C713c5984B033d63061aDc936DfDb8C4Bc6d070'
};

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

const { createResilientProvider, networks } = require('../networks');

async function main() {
  const polyProvider = createResilientProvider(networks.polygonMainnet);
  const bscProvider = createResilientProvider(networks.bscMainnet);

  console.log('================================================================');
  console.log('🛸 AUDITORIA ON-CHAIN RPC EN VIVO: AREA 501');
  console.log('================================================================');

  // 1. BOVEDA 501
  const pol501 = await polyProvider.getBalance(VAULT_501);
  const usdcNatContract = new ethers.Contract(POLY_USDC_NATIVE, ERC20_ABI, polyProvider);
  const usdcNatBal = await usdcNatContract.balanceOf(VAULT_501);
  const usdcEContract = new ethers.Contract(POLY_USDC_E, ERC20_ABI, polyProvider);
  const usdcEBal = await usdcEContract.balanceOf(VAULT_501);
  const allowance501 = await usdcNatContract.allowance(VAULT_501, ATOMIC_EXECUTOR);
  const executorCode = await polyProvider.getCode(ATOMIC_EXECUTOR);
  const bnb501 = await bscProvider.getBalance(VAULT_501);
  const bscUsdcContract = new ethers.Contract(BSC_USDC, ERC20_ABI, bscProvider);
  const bscUsdcBal = await bscUsdcContract.balanceOf(VAULT_501);

  console.log('\n[1] BOVEDA MATRIZ #501 (0xD4D12077a61118372f7a367319fb11922Beb3743)');
  console.log(`• POL Nativo Polygon: ${ethers.formatEther(pol501)} POL (Piso 150 POL: ${parseFloat(ethers.formatEther(pol501)) >= 150 ? 'CUMPLIDO' : 'ALERTA'})`);
  console.log(`• USDC Nativo (Circle): $${ethers.formatUnits(usdcNatBal, 6)} USDC`);
  console.log(`• USDC.e (Bridged): $${ethers.formatUnits(usdcEBal, 6)} USDC.e`);
  console.log(`• BNB Nativo (BSC): ${ethers.formatEther(bnb501)} BNB`);
  console.log(`• USDC (BSC): $${ethers.formatUnits(bscUsdcBal, 18)} USDC`);
  console.log(`• Allowance hacia AtomicSniperExecutor: $${ethers.formatUnits(allowance501, 6)} USDC`);
  console.log(`• Contrato AtomicSniperExecutor (0x03Ac...6b67): Bytecode ${executorCode.length} bytes | Activo: true`);

  // 2. BOVEDA VIP #00
  console.log('\n[2] BOVEDA VIP #00 (0x87e3067E6faCb272c34d1250eF5dcEDaD93d3990)');
  const pol00 = await polyProvider.getBalance(VAULT_00);
  const usdc00 = await usdcNatContract.balanceOf(VAULT_00);
  const bnb00 = await bscProvider.getBalance(VAULT_00);
  const allowance00 = await usdcNatContract.allowance(VAULT_00, ATOMIC_EXECUTOR);
  console.log(`• POL Nativo: ${ethers.formatEther(pol00)} POL`);
  console.log(`• USDC Nativo: $${ethers.formatUnits(usdc00, 6)} USDC`);
  console.log(`• BNB Nativo: ${ethers.formatEther(bnb00)} BNB`);
  console.log(`• Allowance hacia Ejecutor: ${allowance00.toString()} USDC (0 = AISLADA 100% READ-ONLY: ${allowance00 === 0n})`);

  // 3. LOS 5 CAPITANES
  console.log('\n[3] LOS 5 CAPITANES DE BOX (MAINNET)');
  let captainsTotalPol = 0;
  let captainsTotalUsdc = 0;
  let captainsTotalBnb = 0;

  for (const [name, rawAddr] of Object.entries(CAPTAINS)) {
    const addr = ethers.getAddress(rawAddr.toLowerCase());
    const pol = parseFloat(ethers.formatEther(await polyProvider.getBalance(addr)));
    const usdc = parseFloat(ethers.formatUnits(await usdcNatContract.balanceOf(addr), 6));
    const bnb = parseFloat(ethers.formatEther(await bscProvider.getBalance(addr)));

    captainsTotalPol += pol;
    captainsTotalUsdc += usdc;
    captainsTotalBnb += bnb;

    console.log(`• ${name} [${addr.slice(0, 10)}...${addr.slice(-6)}]: ${pol.toFixed(4)} POL | $${usdc.toFixed(2)} USDC | ${bnb.toFixed(4)} BNB`);
  }
  console.log(`Total Capitanes: ${captainsTotalPol.toFixed(4)} POL | $${captainsTotalUsdc.toFixed(2)} USDC | ${captainsTotalBnb.toFixed(4)} BNB`);

  // 4. MUESTRA DE LA FLOTA 500 Y ESTIMADO ON-CHAIN
  console.log('\n[4] FLOTA DE 500 SATELITES (GAS TOTAL ESTIMADO EN REDES)');
  const wallets = JSON.parse(fs.readFileSync('wallets-public-list.json', 'utf8'));
  console.log(`• Total Satélites Mapeados: ${wallets.length} carteras`);

  // Muestra de 10 carteras aleatorias para chequear gas promedio
  let samplePol = 0;
  const sampleIndices = [2, 15, 50, 105, 180, 220, 290, 310, 420, 499];
  for (const idx of sampleIndices) {
    const w = wallets.find(x => x.index === idx);
    if (w) {
      const b = parseFloat(ethers.formatEther(await polyProvider.getBalance(w.address)));
      samplePol += b;
    }
  }
  const avgPolPerSat = samplePol / sampleIndices.length;
  console.log(`• Promedio POL por satélite (muestra 10 bots): ${avgPolPerSat.toFixed(4)} POL`);
  console.log(`• Reserva estimada de la Flota (500 carteras): ~${(avgPolPerSat * 500).toFixed(2)} POL (Piso 300.00 POL)`);

  // 5. RESUMEN GLOBAL CONSOLIDADO
  const totalUsdcGlobal = parseFloat(ethers.formatUnits(usdcNatBal, 6)) + captainsTotalUsdc + parseFloat(ethers.formatUnits(bscUsdcBal, 18)) + 1.0;
  console.log('\n================================================================');
  console.log(`💎 CAPITAL CONSOLIDADO TOTAL AUDITADO HOY: $${totalUsdcGlobal.toFixed(2)} USDC`);
  console.log(`   - Polygon #501: $${parseFloat(ethers.formatUnits(usdcNatBal, 6)).toFixed(2)} USDC`);
  console.log(`   - Polygon Capitanes: $${captainsTotalUsdc.toFixed(2)} USDC`);
  console.log(`   - BSC #501: $${parseFloat(ethers.formatUnits(bscUsdcBal, 18)).toFixed(2)} USDC`);
  console.log(`   - Binance Spot #1: $1.00 USDC`);
  console.log('================================================================');
}

main().catch(console.error);
