/**
 * Solana Configuration
 * Auto-switches between devnet and mainnet based on environment variables
 */

import { PublicKey } from '@solana/web3.js';

// Network configuration
export const SOLANA_NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'devnet' | 'mainnet-beta' || 'devnet';

// Program IDs
const PROGRAM_ID_DEVNET = process.env.NEXT_PUBLIC_PLP_PROGRAM_ID_DEVNET || '2CjwEvY3gkErkEmM5wnLpRv9fq3msHjnPDVPQmaWhF3G';
const PROGRAM_ID_MAINNET = process.env.NEXT_PUBLIC_PLP_PROGRAM_ID_MAINNET || '';

// Auto-switch program ID based on network
export const getProgramId = (): PublicKey => {
  const programIdString = SOLANA_NETWORK === 'mainnet-beta'
    ? PROGRAM_ID_MAINNET
    : PROGRAM_ID_DEVNET;

  if (!programIdString) {
    throw new Error(`Program ID not configured for ${SOLANA_NETWORK}`);
  }

  return new PublicKey(programIdString);
};

// Export for convenience
export const PROGRAM_ID = getProgramId();

// RPC endpoints
const RPC_MAINNET = process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
const RPC_DEVNET = process.env.NEXT_PUBLIC_HELIUS_DEVNET_RPC || 'https://api.devnet.solana.com';

// Auto-switch RPC endpoint based on network
export const getRpcEndpoint = (): string => {
  return SOLANA_NETWORK === 'mainnet-beta' ? RPC_MAINNET : RPC_DEVNET;
};

// Export for convenience
export const RPC_ENDPOINT = getRpcEndpoint();

// Helper function to check if we're on mainnet
export const isMainnet = (): boolean => {
  return SOLANA_NETWORK === 'mainnet-beta';
};

// Helper function to check if we're on devnet
export const isDevnet = (): boolean => {
  return SOLANA_NETWORK === 'devnet';
};

// PDA Seeds (constants used across the program)
export const PDA_SEEDS = {
  TREASURY: 'treasury',
  MARKET: 'market',
  POSITION: 'position',
} as const;

// Fee constants (in lamports)
export const FEES = {
  CREATION: 15_000_000, // 0.015 SOL
  TRADE_BPS: 150, // 1.5%
  COMPLETION_BPS: 500, // 5%
  MINIMUM_INVESTMENT: 10_000_000, // 0.01 SOL
} as const;

// Target pool options (in lamports)
// Program accepts any amount >= MIN_POOL_LAMPORTS
export const MIN_POOL_LAMPORTS = 80_000_000; // 0.08 SOL minimum (matches on-chain program validation)

// Frontend UI options (for dropdown)
export const TARGET_POOL_OPTIONS = [
  5_000_000_000, // 5 SOL
  10_000_000_000, // 10 SOL
  15_000_000_000, // 15 SOL
] as const;

// Configuration summary for debugging
export const getConfig = () => ({
  network: SOLANA_NETWORK,
  programId: PROGRAM_ID.toString(),
  rpcEndpoint: RPC_ENDPOINT,
  isMainnet: isMainnet(),
  isDevnet: isDevnet(),
});

// Log configuration on load (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 Solana Configuration:', getConfig());
}

export default {
  SOLANA_NETWORK,
  PROGRAM_ID,
  RPC_ENDPOINT,
  getProgramId,
  getRpcEndpoint,
  isMainnet,
  isDevnet,
  PDA_SEEDS,
  FEES,
  TARGET_POOL_OPTIONS,
  getConfig,
};
