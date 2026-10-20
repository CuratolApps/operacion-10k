/**
 * networks.js - Operación 10k
 * Configuración Omnichain Multi-Red: Endpoints RPC estables, Chain IDs,
 * símbolos nativos, direcciones oficiales de contratos DeFi y Multicall3.
 * 
 * Implementa FallbackProvider resiliente y optimización de batching con Multicall3.
 */

const { ethers } = require("ethers");

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";

const MULTICALL3_ABI = [
  "function getEthBalance(address addr) view returns (uint256 balance)",
  "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)"
];

const networks = {
  // -------------------------------------------------------------------------------------
  // TESTNETS EVM ACTIVAS
  // -------------------------------------------------------------------------------------
  ethereumSepolia: {
    id: "ethereumSepolia",
    name: "Ethereum Sepolia",
    rpc: "https://ethereum-sepolia-rpc.publicnode.com",
    fallbackRpc: "https://1rpc.io/sepolia",
    chainId: 11155111,
    symbol: "ETH",
    category: "Testnet EVM",
    defiToken: {
      symbol: "WETH9",
      address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
    }
  },
  baseSepolia: {
    id: "baseSepolia",
    name: "Base Sepolia",
    rpc: "https://sepolia.base.org",
    fallbackRpc: "https://base-sepolia-rpc.publicnode.com",
    chainId: 84532,
    symbol: "ETH",
    category: "Testnet EVM",
    defiToken: {
      symbol: "WETH",
      address: "0x4200000000000000000000000000000000000006"
    }
  },
  bscTestnet: {
    id: "bscTestnet",
    name: "BNB Smart Chain Testnet",
    rpc: "https://data-seed-prebsc-1-s1.binance.org:8545",
    fallbackRpc: "https://bsc-testnet-rpc.publicnode.com",
    chainId: 97,
    symbol: "tBNB",
    category: "Testnet EVM",
    defiToken: {
      symbol: "WBNB",
      address: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd"
    }
  },
  opBnbTestnet: {
    id: "opBnbTestnet",
    name: "opBNB Testnet",
    rpc: "https://opbnb-testnet-rpc.bnbchain.org",
    chainId: 5611,
    symbol: "tBNB",
    category: "Testnet EVM",
    defiToken: {
      symbol: "WBNB",
      address: "0x4200000000000000000000000000000000000006"
    }
  },
  polygonAmoy: {
    id: "polygonAmoy",
    name: "Polygon Amoy Testnet",
    rpc: "https://rpc-amoy.polygon.technology",
    fallbackRpc: "https://80002.rpc.thirdweb.com",
    chainId: 80002,
    symbol: "POL",
    category: "Testnet EVM",
    defiToken: {
      symbol: "WPOL",
      address: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9"
    }
  },
  arbitrumSepolia: {
    id: "arbitrumSepolia",
    name: "Arbitrum Sepolia",
    rpc: "https://sepolia-rollup.arbitrum.io/rpc",
    fallbackRpc: "https://arbitrum-sepolia-rpc.publicnode.com",
    chainId: 421614,
    symbol: "ETH",
    category: "Testnet EVM",
    defiToken: {
      symbol: "WETH",
      address: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73"
    }
  },
  optimismSepolia: {
    id: "optimismSepolia",
    name: "Optimism Sepolia",
    rpc: "https://sepolia.optimism.io",
    fallbackRpc: "https://optimism-sepolia-rpc.publicnode.com",
    chainId: 11155420,
    symbol: "ETH",
    category: "Testnet EVM",
    defiToken: {
      symbol: "WETH",
      address: "0x4200000000000000000000000000000000000006"
    }
  },

  // -------------------------------------------------------------------------------------
  // BITCOIN L2 TESTNETS (EVM) GRATUITAS
  // -------------------------------------------------------------------------------------
  citreaTestnet: {
    id: "citreaTestnet",
    name: "Citrea Bitcoin ZK-Rollup Testnet",
    rpc: "https://rpc.testnet.citrea.xyz",
    fallbackRpc: "https://citrea-testnet.rpc.thirdweb.com",
    chainId: 5115,
    symbol: "cBTC",
    category: "Bitcoin L2 EVM",
    defiToken: {
      symbol: "WcBTC",
      address: "0x8a920F65319c321714F4B8487771B437c35F1225"
    }
  },
  goatTestnet: {
    id: "goatTestnet",
    name: "Goat Network Bitcoin L2 Testnet",
    rpc: "https://rpc.testnet3.goat.network",
    fallbackRpc: "https://goat-testnet.rpc.thirdweb.com",
    chainId: 48816,
    symbol: "BTC",
    category: "Bitcoin L2 EVM",
    defiToken: {
      symbol: "WBTC",
      address: "0x265538D4F3Fd6189912C09c62c2f6d4d1264cEc3"
    }
  },

  // -------------------------------------------------------------------------------------
  // NON-EVM TESTNETS
  // -------------------------------------------------------------------------------------
  solanaDevnet: {
    id: "solanaDevnet",
    name: "Solana Devnet",
    rpc: "https://api.devnet.solana.com",
    symbol: "SOL",
    category: "Testnet Non-EVM",
    isSolana: true
  },

  // -------------------------------------------------------------------------------------
  // MAINNETS ECONÓMICAS PREPARADAS (BSC, POLYGON, BASE)
  // -------------------------------------------------------------------------------------
  bscMainnet: {
    id: "bscMainnet",
    name: "BNB Smart Chain",
    rpc: "https://bsc-dataseed.binance.org",
    fallbackRpc: "https://binance.llamarpc.com",
    chainId: 56,
    symbol: "BNB",
    category: "Mainnet",
    defiToken: {
      symbol: "WBNB",
      address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
    },
    usdcToken: {
      symbol: "USDC",
      address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      decimals: 18
    }
  },
  polygonMainnet: {
    id: "polygonMainnet",
    name: "Polygon PoS",
    rpc: "https://polygon-bor-rpc.publicnode.com",
    fallbackRpc: "https://1rpc.io/matic",
    chainId: 137,
    symbol: "POL",
    category: "Mainnet",
    defiToken: {
      symbol: "WPOL",
      address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"
    },
    usdcToken: {
      symbol: "USDC",
      address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      decimals: 6
    }
  },
  baseMainnet: {
    id: "baseMainnet",
    name: "Base Mainnet",
    rpc: "https://mainnet.base.org",
    chainId: 8453,
    symbol: "ETH",
    category: "Mainnet (Escuadrón C)",
    usdcToken: {
      symbol: "USDC",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6
    }
  }
};

/**
 * Crea un proveedor resiliente para una red dada.
 * Utiliza FallbackProvider si existe fallbackRpc definido.
 * Sin limitación artificial de batching (remueve batchMaxCount: 1).
 */
function createResilientProvider(netConfig) {
  if (!netConfig || !netConfig.rpc) {
    throw new Error("Configuración de red inválida");
  }

  const primaryFetch = new ethers.FetchRequest(netConfig.rpc);
  primaryFetch.timeout = 18000;
  const primaryProvider = new ethers.JsonRpcProvider(primaryFetch, netConfig.chainId, {
    staticNetwork: ethers.Network.from(netConfig.chainId)
  });

  if (netConfig.fallbackRpc) {
    try {
      const fbFetch = new ethers.FetchRequest(netConfig.fallbackRpc);
      fbFetch.timeout = 18000;
      const fallbackProvider = new ethers.JsonRpcProvider(fbFetch, netConfig.chainId, {
        staticNetwork: ethers.Network.from(netConfig.chainId)
      });

      return new ethers.FallbackProvider(
        [
          { provider: primaryProvider, priority: 1, weight: 1, stallTimeout: 2000 },
          { provider: fallbackProvider, priority: 2, weight: 1, stallTimeout: 2000 }
        ],
        netConfig.chainId
      );
    } catch (_) {
      return primaryProvider;
    }
  }

  return primaryProvider;
}

/**
 * Consulta en lote masivo los saldos de una lista de direcciones usando Multicall3.
 * Reduce 400 consultas individuales a 1 sola llamada RPC por fragmento.
 * @param {ethers.Provider} provider Proveedor Ethers
 * @param {Array<string>} addresses Lista de direcciones públicas
 * @returns {Promise<Object>} Mapeo { [address]: bigint }
 */
async function fetchEthBalancesBatch(provider, addresses) {
  if (!Array.isArray(addresses) || addresses.length === 0) return {};

  const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);
  const iface = new ethers.Interface(MULTICALL3_ABI);
  const CHUNK_SIZE = 150;
  const balances = {};

  for (let i = 0; i < addresses.length; i += CHUNK_SIZE) {
    const chunk = addresses.slice(i, i + CHUNK_SIZE);
    try {
      const calls = chunk.map((addr) => ({
        target: MULTICALL3_ADDRESS,
        allowFailure: true,
        callData: iface.encodeFunctionData("getEthBalance", [addr])
      }));

      const results = await multicall.aggregate3.staticCall(calls);
      results.forEach((res, idx) => {
        const addr = chunk[idx];
        if (res.success && res.returnData && res.returnData !== "0x") {
          const [balWei] = iface.decodeFunctionResult("getEthBalance", res.returnData);
          balances[addr.toLowerCase()] = balWei;
        } else {
          balances[addr.toLowerCase()] = 0n;
        }
      });
    } catch (err) {
      // Fallback transparente: lecturas individuales concurrentes
      const fallbackResults = await Promise.all(
        chunk.map((addr) => provider.getBalance(addr).catch(() => 0n))
      );
      chunk.forEach((addr, idx) => {
        balances[addr.toLowerCase()] = fallbackResults[idx];
      });
    }
  }

  return balances;
}

const evmTestnets = Object.values(networks).filter(
  (n) => n.category === "Testnet EVM"
);

module.exports = {
  networks,
  networkList: Object.values(networks),
  evmTestnets,
  solanaNetwork: networks.solanaDevnet,
  MULTICALL3_ADDRESS,
  MULTICALL3_ABI,
  createResilientProvider,
  fetchEthBalancesBatch
};
