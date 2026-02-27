/**
 * Environment Abstraction Layer
 * Web sets from process.env.NEXT_PUBLIC_*, mobile sets from Expo Constants
 */

export interface EnvConfig {
  SOLANA_NETWORK: 'devnet' | 'mainnet-beta';
  PLP_PROGRAM_ID_DEVNET: string;
  PLP_PROGRAM_ID_MAINNET: string;
  HELIUS_MAINNET_RPC: string;
  HELIUS_DEVNET_RPC: string;
  HELIUS_WS_MAINNET: string;
  API_BASE_URL: string; // empty for web (relative URLs), full URL for mobile
  APP_URL: string;
  PINATA_JWT: string;
  PINATA_GATEWAY_URL: string;
  PRIVY_APP_ID: string;
}

let _config: EnvConfig | null = null;

export function setEnvConfig(config: EnvConfig): void {
  _config = config;
}

/**
 * Try to auto-initialize from process.env.NEXT_PUBLIC_* variables.
 * In Next.js, these are inlined by webpack on both server and client.
 */
function tryAutoInit(): EnvConfig | null {
  try {
    if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SOLANA_NETWORK) {
      const config: EnvConfig = {
        SOLANA_NETWORK: (process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'devnet' | 'mainnet-beta') || 'devnet',
        PLP_PROGRAM_ID_DEVNET: process.env.NEXT_PUBLIC_PLP_PROGRAM_ID_DEVNET || '',
        PLP_PROGRAM_ID_MAINNET: process.env.NEXT_PUBLIC_PLP_PROGRAM_ID_MAINNET || '',
        HELIUS_MAINNET_RPC: process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com',
        HELIUS_DEVNET_RPC: process.env.NEXT_PUBLIC_HELIUS_DEVNET_RPC || 'https://api.devnet.solana.com',
        HELIUS_WS_MAINNET: process.env.NEXT_PUBLIC_HELIUS_WS_MAINNET || '',
        API_BASE_URL: '',
        APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://pnl.market',
        PINATA_JWT: process.env.NEXT_PUBLIC_PINATA_JWT || '',
        PINATA_GATEWAY_URL: process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud',
        PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID || '',
      };
      _config = config;
      return config;
    }
  } catch {
    // Not in a Next.js environment — require explicit setEnvConfig()
  }
  return null;
}

export function getEnvConfig(): EnvConfig {
  if (!_config) {
    tryAutoInit();
  }
  if (!_config) {
    throw new Error(
      'EnvConfig not initialized. Call setEnvConfig() in your app entry point.'
    );
  }
  return _config;
}

export function isEnvConfigInitialized(): boolean {
  if (!_config) tryAutoInit();
  return _config !== null;
}
