/**
 * Hook to fetch SOL balance for a wallet with USD conversion
 * Uses SWR for smart caching and deduplication
 */

import { useCallback } from 'react';
import useSWR from 'swr';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getSolanaConnection } from '@pnl/shared/solana';
import { useSolPrice } from '@pnl/shared/hooks';

async function fetchSolBalance(walletAddress: string): Promise<number> {
  try {
    const connection = await getSolanaConnection();
    const pubkey = new PublicKey(walletAddress);
    const lamports = await connection.getBalance(pubkey);
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    // Silently return cached/default value on RPC failures (429s, network errors)
    // SWR will retry on the next interval
    return undefined as any;
  }
}

export function useWalletBalance(walletAddress: string | null) {
  const { solPrice } = useSolPrice();

  const { data: solBalance = 0, error, isLoading, mutate } = useSWR(
    walletAddress ? `sol-balance:${walletAddress}` : null,
    () => fetchSolBalance(walletAddress!),
    {
      refreshInterval: 120_000,
      dedupingInterval: 15_000,
      revalidateOnFocus: false,
      errorRetryCount: 2,
    },
  );

  return {
    solBalance,
    solBalanceUsd: solPrice ? solBalance * solPrice : null,
    isLoading,
    refresh: useCallback(() => { mutate(); }, [mutate]),
  };
}
