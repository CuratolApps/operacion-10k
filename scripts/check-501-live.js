require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { ethers } = require('ethers');
const { getWalletSigner } = require('../swarm-engine');
const { createResilientProvider, networks } = require('../networks');

async function main() {
  const polProvider = createResilientProvider(networks.polygonMainnet);
  const bscProvider = createResilientProvider(networks.bscMainnet);

  const signerPol = getWalletSigner(501, polProvider);
  const signerBsc = getWalletSigner(501, bscProvider);

  const polBal = ethers.formatEther(await polProvider.getBalance(signerPol.address));
  const bnbBal = ethers.formatEther(await bscProvider.getBalance(signerBsc.address));

  const erc20Abi = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)'
  ];

  const usdcPol = new ethers.Contract('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', erc20Abi, polProvider);
  const usdcBsc = new ethers.Contract('0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', erc20Abi, bscProvider);

  const usdcPolBal = ethers.formatUnits(await usdcPol.balanceOf(signerPol.address), 6);
  const usdcBscBal = ethers.formatUnits(await usdcBsc.balanceOf(signerBsc.address), 18);

  console.log('--- LIVE BALANCES FOR #501 (' + signerPol.address + ') ---');
  console.log('Polygon POL:', polBal);
  console.log('Polygon USDC:', usdcPolBal);
  console.log('BSC BNB:', bnbBal);
  console.log('BSC USDC:', usdcBscBal);
}

main().catch(console.error);
