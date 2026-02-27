/**
 * useTokenBalance Hook
 * Fetch SPL token balances for a wallet
 */

import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { getSolanaConnection } from '../solana/connection';
import { createClientLogger } from '../utils/logger';
import { useNetwork } from './useNetwork';

const logger = createClientLogger();

interface TokenBalance {
  balance: number;
  formattedBalance: string;
  isLoading: boolean;
  error: string | null;
}

export function useTokenBalance(
  walletAddress: string | null | undefined,
  tokenMint: PublicKey,
  decimals: number = 6
): TokenBalance {
  const { network } = useNetwork();
  const [balance, setBalance] = useState<number>(0);
  const [formattedBalance, setFormattedBalance] = useState<string>('0.00');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) {
      setBalance(0);
      setFormattedBalance('0.00');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const connection = await getSolanaConnection(network);
      const walletPubkey = new PublicKey(walletAddress);

      // Get associated token address
      const associatedTokenAddress = await getAssociatedTokenAddress(
        tokenMint,
        walletPubkey
      );

      logger.info('Fetching token balance', {
        wallet: walletAddress,
        tokenMint: tokenMint.toBase58(),
        associatedTokenAddress: associatedTokenAddress.toBase58(),
      });

      // Get token account
      const tokenAccount = await getAccount(connection, associatedTokenAddress);

      // Convert balance to decimal format
      const rawBalance = Number(tokenAccount.amount);
      const balanceInDecimals = rawBalance / Math.pow(10, decimals);

      setBalance(balanceInDecimals);
      setFormattedBalance(balanceInDecimals.toFixed(2));

      logger.info('Token balance fetched successfully', {
        rawBalance,
        balance: balanceInDecimals,
      });

    } catch (err: any) {
      // If the account doesn't exist, balance is 0
      if (err.message?.includes('could not find account') || err.name === 'TokenAccountNotFoundError') {
        logger.info('Token account not found, balance is 0', { wallet: walletAddress });
        setBalance(0);
        setFormattedBalance('0.00');
        setError(null);
      } else {
        logger.error('Failed to fetch token balance', { error: err });
        setError(err.message || 'Failed to fetch balance');
        setBalance(0);
        setFormattedBalance('0.00');
      }
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, tokenMint, decimals, network]);

  useEffect(() => {
    fetchBalance();

    // Refresh balance every 30 seconds
    const interval = setInterval(fetchBalance, 30000);

    return () => clearInterval(interval);
  }, [fetchBalance]);

  return {
    balance,
    formattedBalance,
    isLoading,
    error,
  };
}
