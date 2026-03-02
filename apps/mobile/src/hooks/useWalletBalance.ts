/**
 * Hook to fetch SOL balance for a wallet with USD conversion
 * Auto-refreshes every 30 seconds
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getSolanaConnection } from '@pnl/shared/solana';
import { useSolPrice } from '@pnl/shared/hooks';

export function useWalletBalance(walletAddress: string | null) {
  const [solBalance, setSolBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { solPrice } = useSolPrice();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) {
      setSolBalance(0);
      return;
    }

    try {
      setIsLoading(true);
      const connection = await getSolanaConnection();
      const pubkey = new PublicKey(walletAddress);
      const lamports = await connection.getBalance(pubkey);
      setSolBalance(lamports / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error('Failed to fetch SOL balance:', err);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchBalance();
    intervalRef.current = setInterval(fetchBalance, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchBalance]);

  return {
    solBalance,
    solBalanceUsd: solPrice ? solBalance * solPrice : null,
    isLoading,
    refresh: fetchBalance,
  };
}
