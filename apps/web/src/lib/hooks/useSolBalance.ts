'use client';

import { useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useUserSocket } from '@/lib/hooks/useSocket';

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
 *
 * Two layers:
 *   1. Socket realtime: server subscribes the wallet to Helius accountSubscribe
 *      on user connect; new lamports arrive within a slot (~400ms) and we
 *      write them straight into SWR's cache.
 *   2. SWR polling: 30s direct-RPC fetch as fallback for cold start, socket
 *      disconnects, and reconciliation. dedupingInterval coalesces concurrent
 *      consumers (navbar + sidebar + wallet page) into one in-flight call.
 *
 * Consumers don't see the layering — they always read `solBalance`.
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

  // Bridge the socket-pushed value into SWR's cache. mutate(value, false)
  // updates `data` without triggering a revalidation — Helius is authoritative
  // for this push, so we trust it. The cache write also dedupes across
  // simultaneous tabs sharing this hook (SWR de-dupes by key).
  //
  // NOTE: useSocket() creates a fresh io() per call (no singleton), so a page
  // that already calls useUserSocket directly (e.g., /wallet) will hold two
  // Socket.IO connections per session. Server-side refcounting handles
  // correctness; turning useSocket into a singleton is a worthwhile follow-up.
  const { walletBalance: socketBalance } = useUserSocket(walletAddress ?? null);
  const lastAppliedSlot = useRef<number>(-1);
  useEffect(() => {
    if (!socketBalance || !walletAddress) return;
    // Guard against double-applying the same event (React strict mode, re-renders).
    if (socketBalance.slot <= lastAppliedSlot.current) return;
    lastAppliedSlot.current = socketBalance.slot;
    mutate(socketBalance.sol, false);
  }, [socketBalance, walletAddress, mutate]);

  return {
    solBalance: data ?? 0,
    isLoading,
    isValidating,
    error: error?.message ?? null,
    refresh: mutate,
  };
}
