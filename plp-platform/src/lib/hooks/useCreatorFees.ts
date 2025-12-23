/**
 * Hook for fetching and claiming creator fees from pump.fun
 *
 * When users launch tokens through P&L, they become the "creator" on pump.fun
 * and receive a portion of trading fees. This hook lets them:
 * 1. See their accumulated creator fees in real-time
 * 2. Claim (withdraw) those fees to their wallet
 */

'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { Connection, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { useWallets, useSignAndSendTransaction, useStandardWallets } from '@privy-io/react-auth/solana';
import { OnlinePumpSdk } from '@pump-fun/pump-sdk';
import { RPC_ENDPOINT } from '@/config/solana';
import { useNetwork } from './useNetwork';
import bs58 from 'bs58';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface LaunchedToken {
  marketId: string;
  name: string;
  symbol: string;
  tokenAddress: string;
  imageUrl?: string;
}

interface CreatorFeesData {
  tokens: Array<{
    token: LaunchedToken;
    claimableAmount: number;
    claimableLamports: string;
    creatorVaultAddress: string;
  }>;
  totalClaimable: number;
  totalClaimableLamports: string;
  creatorVaultAddress: string;
  tokenCount: number;
}

interface UseCreatorFeesReturn {
  // Data
  data: CreatorFeesData | null;
  isLoading: boolean;
  error: string | null;

  // Derived values
  totalClaimable: number;
  hasClaimableFees: boolean;
  launchedTokenCount: number;
  launchedTokens: LaunchedToken[];

  // Actions
  claimFees: () => Promise<{ success: boolean; signature?: string; error?: string }>;
  isClaiming: boolean;
  refresh: () => void;
}

export function useCreatorFees(walletAddress: string | null): UseCreatorFeesReturn {
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Privy wallet hooks
  const { wallets } = useWallets(); // External wallets
  const { wallets: standardWallets } = useStandardWallets(); // Embedded wallets
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { network } = useNetwork();

  // Fetch creator fees data with SWR (auto-refresh every 30 seconds)
  const { data: response, error: fetchError, mutate } = useSWR(
    walletAddress ? `/api/user/${walletAddress}/creator-fees` : null,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds for real-time updates
      revalidateOnFocus: true,
      dedupingInterval: 10000,
    }
  );

  const data = response?.success ? response.data : null;
  const totalClaimable = data?.totalClaimable || 0;
  const hasClaimableFees = totalClaimable > 0.000001; // > 1 lamport essentially
  const launchedTokenCount = data?.tokenCount || 0;
  const launchedTokens: LaunchedToken[] = data?.tokens?.map((t: any) => t.token) || [];

  // Claim all accumulated creator fees
  const claimFees = useCallback(async (): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
  }> => {
    if (!walletAddress || !hasClaimableFees) {
      return { success: false, error: 'No fees to claim' };
    }

    setIsClaiming(true);
    setClaimError(null);

    try {
      const connection = new Connection(RPC_ENDPOINT, 'confirmed');
      const walletPubkey = new PublicKey(walletAddress);

      console.log('🔧 Preparing creator fee claim transaction...');

      // Initialize the online pump SDK
      const pumpSdk = new OnlinePumpSdk(connection);

      // Get the claim instructions from pump.fun SDK
      const claimInstructions = await pumpSdk.collectCoinCreatorFeeInstructions(walletPubkey);

      if (!claimInstructions || claimInstructions.length === 0) {
        return { success: false, error: 'No fees available to claim' };
      }

      console.log(`✅ Got ${claimInstructions.length} claim instruction(s)`);

      // Build the transaction
      const { blockhash } = await connection.getLatestBlockhash('confirmed');

      const message = new TransactionMessage({
        payerKey: walletPubkey,
        recentBlockhash: blockhash,
        instructions: claimInstructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(message);

      // Serialize transaction to buffer
      const txBuffer = Buffer.from(transaction.serialize());

      // Get Solana wallet - prioritize external wallets, fallback to embedded wallets
      let solanaWallet;

      if (wallets && wallets.length > 0) {
        // Path 1: External wallet (Phantom, Solflare, etc.)
        console.log('   Using external Solana wallet');
        solanaWallet = wallets[0];
      } else if (standardWallets && standardWallets.length > 0) {
        // Path 2: Embedded wallet from standard wallets
        console.log('   Using embedded Solana wallet');
        const privyWallet = standardWallets.find((w: any) => w.isPrivyWallet || w.name === 'Privy');
        if (!privyWallet) {
          throw new Error('No Privy wallet found');
        }
        solanaWallet = privyWallet;
      } else {
        throw new Error('No Solana wallet found');
      }

      console.log('✍️ Signing and sending transaction with Privy...');

      // Sign and send using Privy
      const result = await signAndSendTransaction({
        transaction: txBuffer,
        wallet: solanaWallet as any,
        chain: network === 'devnet' ? 'solana:devnet' : 'solana:mainnet',
      });

      // Convert signature to base58
      const signature = bs58.encode(result.signature);
      console.log('✅ Transaction signed and sent:', signature);

      // Wait for confirmation
      console.log('⏳ Waiting for transaction confirmation...');
      await connection.confirmTransaction(signature, 'confirmed');
      console.log('✅ Transaction confirmed!');

      // Refresh the balance after successful claim
      await mutate();

      return { success: true, signature };
    } catch (error: any) {
      console.error('Failed to claim creator fees:', error);
      const errorMessage = error.message || 'Failed to claim fees';
      setClaimError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsClaiming(false);
    }
  }, [walletAddress, hasClaimableFees, wallets, standardWallets, signAndSendTransaction, network, mutate]);

  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    data,
    isLoading: !response && !fetchError && !!walletAddress,
    error: fetchError?.message || claimError,

    totalClaimable,
    hasClaimableFees,
    launchedTokenCount,
    launchedTokens,

    claimFees,
    isClaiming,
    refresh,
  };
}
