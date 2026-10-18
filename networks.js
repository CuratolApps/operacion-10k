/**
 * Configuración de Redes Multi-Red - Operación 10k
 * Endpoints RPC públicos, chain IDs y símbolos de gas nativo
 */

const networks = {
  // Testnets (Escuadrón A/B)
  ethereumSepolia: {
    id: "ethereumSepolia",
    name: "Ethereum Sepolia",
    rpc: "https://ethereum-sepolia-rpc.publicnode.com",
    chainId: 11155111,
    symbol: "ETH",
    category: "Testnet (Escuadrón A/B)"
  },
  baseSepolia: {
    id: "baseSepolia",
    name: "Base Sepolia",
    rpc: "https://sepolia.base.org",
    chainId: 84532,
    symbol: "ETH",
    category: "Testnet (Escuadrón A/B)"
  },
  arbitrumSepolia: {
    id: "arbitrumSepolia",
    name: "Arbitrum Sepolia",
    rpc: "https://sepolia-rollup.arbitrum.io/rpc",
    chainId: 421614,
    symbol: "ETH",
    category: "Testnet (Escuadrón A/B)"
  },
  optimismSepolia: {
    id: "optimismSepolia",
    name: "Optimism Sepolia",
    rpc: "https://sepolia.optimism.io",
    chainId: 11155420,
    symbol: "ETH",
    category: "Testnet (Escuadrón A/B)"
  },

  // Mainnet (Escuadrón C - Monitoreo Cuenta #00 VIP)
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

module.exports = {
  networks,
  networkList: Object.values(networks)
};
