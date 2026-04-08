/**
 * Solana Configuration - Re-export from shared with computed constants
 * Components expect SOLANA_NETWORK, PROGRAM_ID, RPC_ENDPOINT as constants
 */

export {
  getSolanaNetwork,
  getProgramId,
  getRpcEndpoint,
  isMainnet,
  isDevnet,
  PDA_SEEDS,
  FEES,
  MIN_POOL_LAMPORTS,
  TARGET_POOL_OPTIONS,
  getConfig,
} from '@pnl/shared/config';

import { getSolanaNetwork, getProgramId, getRpcEndpoint } from '@pnl/shared/config';

// Computed constants for backward compatibility
// Many components import these as static values
export const SOLANA_NETWORK = getSolanaNetwork();
export const PROGRAM_ID = getProgramId();
export const RPC_ENDPOINT = getRpcEndpoint();

export default {
  SOLANA_NETWORK,
  PROGRAM_ID,
  RPC_ENDPOINT,
  getProgramId,
  getRpcEndpoint,
  isMainnet: () => SOLANA_NETWORK === 'mainnet-beta',
  isDevnet: () => SOLANA_NETWORK === 'devnet',
  PDA_SEEDS: { TREASURY: 'treasury', MARKET: 'market', POSITION: 'position' } as const,
  FEES: { CREATION: 15_000_000, TRADE_BPS: 150, COMPLETION_BPS: 500, MINIMUM_INVESTMENT: 10_000_000 } as const,
  TARGET_POOL_OPTIONS: [5_000_000_000, 10_000_000_000, 15_000_000_000] as const,
  getConfig: () => ({
    network: SOLANA_NETWORK,
    programId: PROGRAM_ID.toString(),
    rpcEndpoint: RPC_ENDPOINT,
    isMainnet: SOLANA_NETWORK === 'mainnet-beta',
    isDevnet: SOLANA_NETWORK === 'devnet',
  }),
};
