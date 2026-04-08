/**
 * useVote — Shared hook for voting on prediction markets.
 * Used by both the Feed page and Market Detail page.
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import * as Haptics from 'expo-haptics';
import { apiUrl, parseError, authenticatedPost } from '@pnl/shared/utils';
import { useNetwork } from '@pnl/shared/hooks';
import { getSolanaConnection } from '@pnl/shared/solana';
import { useAuth } from '../providers/AuthProvider';

type VoteDirection = 'yes' | 'no';
type VoteStage = 'signing' | 'confirming' | 'success' | 'error';

interface UseVoteOptions {
  onSuccess?: () => void;
  onStageChange?: (stage: VoteStage, direction: VoteDirection, amount: number, marketName: string, message?: string) => void;
}

export function useVote(options?: UseVoteOptions) {
  const { walletAddress, solanaWallet } = useAuth();
  const { network } = useNetwork();
  const [isVoting, setIsVoting] = useState(false);

  const submitVote = useCallback(
    async (marketAddress: string, marketId: string, direction: VoteDirection, amount: number, marketName?: string) => {
      if (!walletAddress || !solanaWallet) return false;
      setIsVoting(true);
      try {
        // Step 0: Check if user has an opposite-side position
        const posRes = await fetch(apiUrl(`/api/markets/${marketId}/position?wallet=${walletAddress}&network=${network}`));
        const posData = await posRes.json();
        if (posData?.success && posData.data?.hasPosition && posData.data.side !== direction) {
          Alert.alert('Cannot Vote', `You already voted ${posData.data.side.toUpperCase()} — can't switch sides.`);
          return false;
        }

        // Step 1: Prepare transaction on server (authenticated)
        const prepareData = await authenticatedPost('/api/markets/vote/prepare', {
          marketAddress, voteType: direction, amount, userWallet: walletAddress, network,
        });
        if (!prepareData.success) throw new Error(prepareData.error || 'Failed to prepare vote transaction');

        // Step 2: Sign & send with Privy embedded wallet
        options?.onStageChange?.('signing', direction, amount, marketName || '');
        const txBytes = Buffer.from(prepareData.data.serializedTransaction, 'base64');
        let transaction: Transaction | VersionedTransaction;
        try {
          transaction = VersionedTransaction.deserialize(txBytes);
        } catch {
          transaction = Transaction.from(txBytes);
        }
        const provider = await solanaWallet.wallets![0].getProvider();
        const connection = await getSolanaConnection(network);
        const { signature } = await (provider as any).request({
          method: 'signAndSendTransaction',
          params: { transaction, connection },
        });

        // Step 3: Wait for confirmation (with 30s timeout to prevent stuck toast)
        options?.onStageChange?.('confirming', direction, amount, marketName || '');
        const confirmPromise = connection.confirmTransaction(signature, 'confirmed');
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Transaction sent but confirmation timed out. Check your wallet.')), 30000),
        );
        await Promise.race([confirmPromise, timeoutPromise]);

        // Step 4: Record in database (authenticated)
        await authenticatedPost('/api/markets/vote/complete', {
          marketId, voteType: direction, amount, signature, traderWallet: walletAddress,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        options?.onStageChange?.('success', direction, amount, marketName || '');
        options?.onSuccess?.();
        return true;
      } catch (err: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const parsed = parseError(err);
        options?.onStageChange?.('error', direction, amount, marketName || '', parsed.message);
        return false;
      } finally {
        setIsVoting(false);
      }
    },
    [walletAddress, solanaWallet, network, options],
  );

  return { submitVote, isVoting };
}
