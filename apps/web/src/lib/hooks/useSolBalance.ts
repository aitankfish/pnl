'use client';

import useSWR from 'swr';

const RPC_MAINNET = process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
const RPC_DEVNET = process.env.NEXT_PUBLIC_HELIUS_DEVNET_RPC || 'https://api.devnet.solana.com';
const NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'devnet' | 'mainnet-beta') || 'devnet';
const RPC_ENDPOINT = NETWORK === 'mainnet-beta' ? RPC_MAINNET : RPC_DEVNET;

async function fetchSolBalance(address: string): Promise<number> {
  // Dynamic import keeps @solana/web3.js out of the synchronous module graph —
  // important for dev compile speed (the /api/wallet/balance route used to take
  // 50+ seconds to compile because it pulled web3.js synchronously).
  const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const publicKey = new PublicKey(address);
  const lamports = await connection.getBalance(publicKey);
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Single source of truth for a wallet's SOL balance across the web app.
 * SWR dedupes calls across consumers in the same tab, so navbar + sidebar +
 * wallet page all share one RPC call per refresh window.
 *
 * Goes direct to Helius from the browser (same path as mobile useWalletBalance),
 * bypassing the cached server endpoint to avoid the Next.js dev lazy-compile
 * stall on first hit.
 */
export function useSolBalance(walletAddress: string | null | undefined) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    walletAddress ? `sol-balance:${walletAddress}:${NETWORK}` : null,
    () => fetchSolBalance(walletAddress!),
    {
      refreshInterval: 30_000,
      dedupingInterval: 5_000,
      revalidateOnFocus: true,
      errorRetryCount: 2,
      errorRetryInterval: 2_000,
    },
  );

  return {
    solBalance: data ?? 0,
    isLoading,
    isValidating,
    error: error?.message ?? null,
    refresh: mutate,
  };
}
