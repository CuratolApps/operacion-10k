/**
 * networks.js - Operación 10k
 * Configuración Omnichain Multi-Red: Endpoints RPC estables, Chain IDs,
 * símbolos nativos y direcciones oficiales de contratos DeFi (WETH/WBNB/WPOL).
 * 
 * Redes soportadas:
 * - EVM Testnets: Ethereum Sepolia, Base Sepolia, BSC Testnet, opBNB Testnet, Polygon Amoy, Arbitrum Sepolia
 * - Non-EVM Testnets: Solana Devnet
 * - Mainnets (Monitoreo Escuadrón C VIP #00): BNB Smart Chain, Base Mainnet
 */

const networks = {
  // -------------------------------------------------------------------------------------
  // TESTNETS EVM ACTIVAS
  // -------------------------------------------------------------------------------------
  ethereumSepolia: {
    id: "ethereumSepolia",
    name: "Ethereum Sepolia",
    rpc: "https://sepolia.drpc.org",
    fallbackRpc: "https://ethereum-sepolia-rpc.publicnode.com",
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
    rpc: "https://polygon-amoy.drpc.org",
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
    chainId: 421614,
    symbol: "ETH",
    category: "Testnet EVM",
    defiToken: {
      symbol: "WETH",
      address: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73"
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
  // MAINNETS (ESCUADRÓN C: CUENTA #00 VIP - MODO SOLO LECTURA / MONITOREO)
  // -------------------------------------------------------------------------------------
  bscMainnet: {
    id: "bscMainnet",
    name: "BNB Smart Chain",
    rpc: "https://bsc-dataseed.binance.org",
    chainId: 56,
    symbol: "BNB",
    category: "Mainnet (Escuadrón C)"
  },
  baseMainnet: {
    id: "baseMainnet",
    name: "Base Mainnet",
    rpc: "https://mainnet.base.org",
    chainId: 8453,
    symbol: "ETH",
    category: "Mainnet (Escuadrón C)"
  }
};

const evmTestnets = Object.values(networks).filter(
  (n) => n.category === "Testnet EVM"
);

module.exports = {
  networks,
  networkList: Object.values(networks),
  evmTestnets,
  solanaNetwork: networks.solanaDevnet
};
