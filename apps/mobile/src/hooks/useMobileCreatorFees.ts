/**
 * Mobile-specific creator fees hook
 * Fetches creator fee data via API. For claiming, requests a serialized
 * transaction from the server and signs with the mobile Privy wallet.
 */

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { PublicKey, VersionedTransaction } from '@solana/web3.js';
import { getSolanaConnection } from '@pnl/shared/solana';
import { apiUrl } from '@pnl/shared/utils';
import { useAuth } from '../providers/AuthProvider';

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

export function useMobileCreatorFees(walletAddress: string | null) {
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const { solanaWallet } = useAuth();

  const { data: response, error: fetchError, mutate } = useSWR(
    walletAddress ? apiUrl(`/api/user/${walletAddress}/creator-fees`) : null,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      dedupingInterval: 10000,
    },
  );

  const data: CreatorFeesData | null = response?.success ? response.data : null;
  const totalClaimable = data?.totalClaimable || 0;
  const hasClaimableFees = totalClaimable > 0.000001;
  const launchedTokenCount = data?.tokenCount || 0;
  const launchedTokens: LaunchedToken[] = data?.tokens?.map((t: any) => t.token) || [];

  const claimFees = useCallback(async (): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
  }> => {
    if (!walletAddress || !hasClaimableFees) {
      return { success: false, error: 'No fees to claim' };
    }

    if (solanaWallet.status !== 'connected' || !solanaWallet.wallets?.[0]) {
      return { success: false, error: 'Wallet not connected' };
    }

    setIsClaiming(true);
    setClaimError(null);

    try {
      // Request the server to build the claim transaction
      const res = await fetch(apiUrl(`/api/user/${walletAddress}/creator-fees/claim`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress }),
      });

      if (!res.ok) {
        // If the server-side claim endpoint doesn't exist yet, try pump SDK directly
        return await claimViaSdk();
      }

      const json = await res.json();
      if (!json.success || !json.transaction) {
        // Fallback to SDK
        return await claimViaSdk();
      }

      // Deserialize and sign the transaction
      const txBytes = Buffer.from(json.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(txBytes);

      const provider = await solanaWallet.wallets[0].getProvider();
      const { signature } = await provider.signAndSendTransaction(transaction);

      const connection = await getSolanaConnection();
      await connection.confirmTransaction(signature, 'confirmed');
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
  }, [walletAddress, hasClaimableFees, solanaWallet, mutate]);

  // Direct SDK claim (fallback if server endpoint isn't available)
  const claimViaSdk = useCallback(async (): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
  }> => {
    try {
      // Dynamic import to avoid bundling issues if SDK isn't available
      const { OnlinePumpSdk } = await import('@pump-fun/pump-sdk');
      const { Connection, TransactionMessage } = await import('@solana/web3.js');

      const connection = await getSolanaConnection();
      const walletPubkey = new PublicKey(walletAddress!);

      const pumpSdk = new OnlinePumpSdk(connection as Connection);
      const claimInstructions = await pumpSdk.collectCoinCreatorFeeInstructions(walletPubkey);

      if (!claimInstructions || claimInstructions.length === 0) {
        return { success: false, error: 'No fees available to claim' };
      }

      const { blockhash } = await connection.getLatestBlockhash('confirmed');

      const message = new TransactionMessage({
        payerKey: walletPubkey,
        recentBlockhash: blockhash,
        instructions: claimInstructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(message);

      const provider = await solanaWallet.wallets![0].getProvider();
      const { signature } = await provider.signAndSendTransaction(transaction);

      await connection.confirmTransaction(signature, 'confirmed');
      await mutate();

      return { success: true, signature };
    } catch (error: any) {
      console.error('SDK claim fallback failed:', error);
      return {
        success: false,
        error: 'Claiming is currently available on the web app. Visit pnl.market/wallet to claim.',
      };
    }
  }, [walletAddress, solanaWallet, mutate]);

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
