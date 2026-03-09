/**
 * useVote — Shared hook for voting on prediction markets.
 * Used by both the Feed page and Market Detail page.
 */

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import * as Haptics from 'expo-haptics';
import { apiUrl, parseError } from '@pnl/shared/utils';
import { useNetwork } from '@pnl/shared/hooks';
import { getSolanaConnection } from '@pnl/shared/solana';
import { useAuth } from '../providers/AuthProvider';

type VoteDirection = 'yes' | 'no';

interface UseVoteOptions {
  onSuccess?: () => void;
}

export function useVote(options?: UseVoteOptions) {
  const { walletAddress, solanaWallet } = useAuth();
  const { network } = useNetwork();
  const [isVoting, setIsVoting] = useState(false);

  const submitVote = useCallback(
    async (marketAddress: string, marketId: string, direction: VoteDirection, amount: number) => {
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

        // Step 1: Prepare transaction on server
        const prepareRes = await fetch(apiUrl('/api/markets/vote/prepare'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ marketAddress, voteType: direction, amount, userWallet: walletAddress, network }),
        });
        const prepareData = await prepareRes.json();
        if (!prepareData.success) throw new Error(prepareData.error || 'Failed to prepare vote transaction');

        // Step 2: Sign & send with Privy embedded wallet
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

        // Step 3: Wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');

        // Step 4: Record in database
        await fetch(apiUrl('/api/markets/vote/complete'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marketId,
            voteType: direction,
            amount,
            signature,
            traderWallet: walletAddress,
          }),
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Vote Confirmed', `Your ${direction.toUpperCase()} vote of ${amount} SOL was confirmed on-chain.`);
        options?.onSuccess?.();
        return true;
      } catch (err: any) {
        console.error('Vote error:', err);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const parsed = parseError(err);
        Alert.alert(parsed.title, parsed.message);
        return false;
      } finally {
        setIsVoting(false);
      }
    },
    [walletAddress, solanaWallet, network, options],
  );

  return { submitVote, isVoting };
}
