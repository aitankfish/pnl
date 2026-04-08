/**
 * useTokenBalance Hook
 * Fetch SPL token balances using SWR for deduplication and smart caching.
 * Replaces raw setInterval pattern that caused RPC spam (429 errors).
 */

import useSWR from 'swr';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { getSolanaConnection } from '../solana/connection';
import { useNetwork } from './useNetwork';

async function fetchTokenBalance(
  walletAddress: string,
  tokenMintStr: string,
  decimals: number,
  network: string,
): Promise<number> {
  const connection = await getSolanaConnection(network as any);
  const walletPubkey = new PublicKey(walletAddress);
  const tokenMint = new PublicKey(tokenMintStr);

  const ata = await getAssociatedTokenAddress(tokenMint, walletPubkey);

  try {
    const tokenAccount = await getAccount(connection, ata);
    return Number(tokenAccount.amount) / Math.pow(10, decimals);
  } catch (err: any) {
    // Account not found = balance is 0 (not an error)
    if (err.message?.includes('could not find account') || err.name === 'TokenAccountNotFoundError') {
      return 0;
    }
    throw err;
  }
}

export function useTokenBalance(
  walletAddress: string | null | undefined,
  tokenMint: PublicKey,
  decimals: number = 6
) {
  const { network } = useNetwork();
  const mintStr = tokenMint.toBase58();

  const { data: balance = 0, error, isLoading, mutate } = useSWR(
    walletAddress ? `token-balance:${walletAddress}:${mintStr}:${network}` : null,
    () => fetchTokenBalance(walletAddress!, mintStr, decimals, network),
    {
      refreshInterval: 120_000,    // 2 min (was 30s setInterval — 4x reduction)
      dedupingInterval: 30_000,    // Dedup within 30s across components
      revalidateOnFocus: false,
      errorRetryCount: 2,
    },
  );

  return {
    balance,
    formattedBalance: balance.toFixed(2),
    isLoading,
    error: error?.message || null,
    refresh: mutate,
  };
}
