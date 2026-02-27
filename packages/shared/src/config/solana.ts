/**
 * Solana Configuration (shared)
 * Uses environment abstraction instead of direct process.env access
 */

import { PublicKey } from '@solana/web3.js';
import { getEnvConfig } from './environment';

export const getSolanaNetwork = () => getEnvConfig().SOLANA_NETWORK;

export const getProgramId = (): PublicKey => {
  const config = getEnvConfig();
  const programIdString =
    config.SOLANA_NETWORK === 'mainnet-beta'
      ? config.PLP_PROGRAM_ID_MAINNET
      : config.PLP_PROGRAM_ID_DEVNET;

  if (!programIdString) {
    throw new Error(`Program ID not configured for ${config.SOLANA_NETWORK}`);
  }
  return new PublicKey(programIdString);
};

export const getRpcEndpoint = (): string => {
  const config = getEnvConfig();
  return config.SOLANA_NETWORK === 'mainnet-beta'
    ? config.HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com'
    : config.HELIUS_DEVNET_RPC || 'https://api.devnet.solana.com';
};

export const isMainnet = (): boolean => getSolanaNetwork() === 'mainnet-beta';
export const isDevnet = (): boolean => getSolanaNetwork() === 'devnet';

export const PDA_SEEDS = {
  TREASURY: 'treasury',
  MARKET: 'market',
  POSITION: 'position',
} as const;

export const FEES = {
  CREATION: 15_000_000,
  TRADE_BPS: 150,
  COMPLETION_BPS: 500,
  MINIMUM_INVESTMENT: 10_000_000,
} as const;

export const MIN_POOL_LAMPORTS = 80_000_000;

export const TARGET_POOL_OPTIONS = [
  5_000_000_000,
  10_000_000_000,
  15_000_000_000,
] as const;

export const getConfig = () => ({
  network: getSolanaNetwork(),
  programId: getProgramId().toString(),
  rpcEndpoint: getRpcEndpoint(),
  isMainnet: isMainnet(),
  isDevnet: isDevnet(),
});
