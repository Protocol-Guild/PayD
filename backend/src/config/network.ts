/**
 * Network Configuration
 *
 * Provides network settings for different Stellar/Soroban networks.
 */

export interface NetworkConfig {
  name: string;
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl: string;
  friendbotUrl?: string;
}

const networks: Record<string, NetworkConfig> = {
  standalone: {
    name: 'standalone',
    rpcUrl: 'http://localhost:8000/rpc',
    networkPassphrase: 'Standalone Network ; February 2017',
    horizonUrl: 'http://localhost:8000',
    friendbotUrl: 'http://localhost:8000/friendbot',
  },
  testnet: {
    name: 'testnet',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    friendbotUrl: 'https://friendbot.stellar.org',
  },
  futurenet: {
    name: 'futurenet',
    rpcUrl: 'https://rpc-futurenet.stellar.org',
    networkPassphrase: 'Test SDF Future Network ; January 2023',
    horizonUrl: 'https://horizon-futurenet.stellar.org',
    friendbotUrl: 'https://friendbot-futurenet.stellar.org',
  },
  public: {
    name: 'public',
    rpcUrl: 'https://soroban-rpc.mainnet.stellar.org',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
    horizonUrl: 'https://horizon.stellar.org',
  },
};

/**
 * Get configuration for a specific network
 */
export function getNetworkConfig(network: string): NetworkConfig {
  const config = networks[network.toLowerCase()];
  if (!config) {
    throw new Error(`Unknown network: ${network}. Supported networks: ${Object.keys(networks).join(', ')}`);
  }
  return config;
}

/**
 * Get all available network configurations
 */
export function getAllNetworkConfigs(): NetworkConfig[] {
  return Object.values(networks);
}

/**
 * Check if a network name is valid
 */
export function isValidNetwork(network: string): boolean {
  return network.toLowerCase() in networks;
}
