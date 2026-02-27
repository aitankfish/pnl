/**
 * Environment Configuration
 * Centralized configuration for switching between development and production environments
 * Automatically handles devnet/mainnet switching and other environment-specific settings
 */

// Load .env file if not in browser environment
if (typeof window === 'undefined') {
  require('dotenv').config();
}

export interface EnvironmentConfig {
  // Network Configuration
  network: 'devnet' | 'mainnet-beta';
  rpcUrl: string;

  // Database Configuration
  database: {
    uri: string;
    name: string; // devnet → plp-platform, mainnet → plp_platform_prod
  };

  // Solana Configuration
  solana: {
    network: 'devnet' | 'mainnet-beta';
    rpcUrl: string;
    wsUrl?: string;
  };

  // IPFS Configuration
  ipfs: {
    enabled: boolean;
    gatewayUrl: string;
  };

  // Feature Flags
  features: {
    enableDevnetFaucet: boolean;
    enableMockMode: boolean;
    enableTestnetFeatures: boolean;
  };

  // UI Configuration
  ui: {
    showDebugInfo: boolean;
    showNetworkStatus: boolean;
  };
}

class EnvironmentManager {
  private static instance: EnvironmentManager;
  private config: EnvironmentConfig;

  constructor() {
    this.config = this.buildConfig();
  }

  public static getInstance(): EnvironmentManager {
    if (!EnvironmentManager.instance) {
      EnvironmentManager.instance = new EnvironmentManager();
    }
    return EnvironmentManager.instance;
  }

  private buildConfig(): EnvironmentConfig {
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Determine network based on NEXT_PUBLIC_SOLANA_NETWORK (can override NODE_ENV)
    const networkEnv = process.env.NEXT_PUBLIC_SOLANA_NETWORK || (isDevelopment ? 'devnet' : 'mainnet-beta');
    const network = networkEnv as 'devnet' | 'mainnet-beta';

    // Get RPC URLs directly from environment variables
    const devnetRpc = process.env.NEXT_PUBLIC_HELIUS_DEVNET_RPC || 'https://api.devnet.solana.com';
    const mainnetRpc = process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
    const rpcUrl = network === 'devnet' ? devnetRpc : mainnetRpc;

    // Database configuration (switches based on network)
    const databaseName = network === 'devnet' ? 'plp-platform' : 'plp_platform_prod';
    const databaseUri = process.env.MONGODB_URI || '';

    // IPFS configuration
    const ipfsEnabled = !!(process.env.NEXT_PUBLIC_PINATA_JWT || (process.env.NEXT_PUBLIC_PINATA_API_KEY && process.env.NEXT_PUBLIC_PINATA_SECRET_KEY));

    return {
      network,
      rpcUrl,

      database: {
        uri: databaseUri,
        name: databaseName,
      },

      solana: {
        network,
        rpcUrl,
        wsUrl: isDevelopment ? undefined : rpcUrl.replace('https://', 'wss://'),
      },

      ipfs: {
        enabled: ipfsEnabled,
        gatewayUrl: process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud',
      },
      
      features: {
        enableDevnetFaucet: isDevelopment,
        enableMockMode: isDevelopment,
        enableTestnetFeatures: isDevelopment,
      },
      
      ui: {
        showDebugInfo: isDevelopment,
        showNetworkStatus: isDevelopment,
      },
    };
  }

  /**
   * Get the current environment configuration
   */
  public getConfig(): EnvironmentConfig {
    return this.config;
  }

  /**
   * Get network-specific configuration
   */
  public getNetworkConfig() {
    return this.config.solana;
  }


  /**
   * Get IPFS configuration
   */
  public getIPFSConfig() {
    return this.config.ipfs;
  }

  /**
   * Check if a feature is enabled
   */
  public isFeatureEnabled(feature: keyof EnvironmentConfig['features']): boolean {
    return this.config.features[feature];
  }

  /**
   * Check if UI debug info should be shown
   */
  public shouldShowDebugInfo(): boolean {
    return this.config.ui.showDebugInfo;
  }

  /**
   * Get the current network name for display
   */
  public getNetworkName(): string {
    return this.config.network === 'devnet' ? 'Devnet' : 'Mainnet';
  }

  /**
   * Get the network color for UI
   */
  public getNetworkColor(): string {
    return this.config.network === 'devnet' ? 'yellow' : 'green';
  }

  /**
   * Check if we're on devnet
   */
  public isDevnet(): boolean {
    return this.config.network === 'devnet';
  }

  /**
   * Check if we're on mainnet
   */
  public isMainnet(): boolean {
    return this.config.network === 'mainnet-beta';
  }

  /**
   * Get environment-specific logging prefix
   */
  public getLogPrefix(): string {
    const network = this.getNetworkName();
    const env = process.env.NODE_ENV === 'development' ? 'DEV' : 'PROD';
    return `[${network}:${env}]`;
  }

  /**
   * Validate configuration
   */
  public validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check IPFS configuration
    if (!this.config.ipfs.enabled) {
      errors.push('IPFS is not configured (Pinata API keys missing)');
    }

    // Check database configuration
    if (!this.config.database.uri) {
      errors.push('MongoDB URI is not configured');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get configuration summary for debugging
   */
  public getConfigSummary(): object {
    return {
      network: this.config.network,
      rpcUrl: this.config.rpcUrl,
      database: {
        name: this.config.database.name,
        hasUri: !!this.config.database.uri,
      },
      ipfs: {
        enabled: this.config.ipfs.enabled,
      },
      features: this.config.features,
    };
  }
}

// Export singleton instance
export const environment = EnvironmentManager.getInstance();

// Export convenience functions
export const getEnvironmentConfig = () => environment.getConfig();
export const getNetworkConfig = () => environment.getNetworkConfig();
export const getDatabaseConfig = () => environment.getConfig().database;
export const getIPFSConfig = () => environment.getIPFSConfig();
export const isFeatureEnabled = (feature: keyof EnvironmentConfig['features']) => environment.isFeatureEnabled(feature);
export const isDevnet = () => environment.isDevnet();
export const isMainnet = () => environment.isMainnet();
export const getNetworkName = () => environment.getNetworkName();
export const getNetworkColor = () => environment.getNetworkColor();
export const shouldShowDebugInfo = () => environment.shouldShowDebugInfo();

// Export for backward compatibility
export default environment;
