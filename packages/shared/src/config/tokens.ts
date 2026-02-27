/**
 * SPL Token Configuration (shared)
 */

import { PublicKey } from '@solana/web3.js';

export const USDC_MINT = {
  'mainnet-beta': new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),
  'devnet': new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
} as const;

export const TOKEN_DECIMALS = {
  USDC: 6,
  SOL: 9,
} as const;

export const getUsdcMint = (network: 'devnet' | 'mainnet-beta'): PublicKey => {
  return USDC_MINT[network];
};

export const formatTokenAmount = (
  amount: bigint | number,
  decimals: number,
  displayDecimals: number = 2
): string => {
  const value = Number(amount) / Math.pow(10, decimals);
  return value.toFixed(displayDecimals);
};
