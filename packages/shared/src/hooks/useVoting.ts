/**
 * useVoting Hook
 *
 * Handles voting transactions using the same pattern as the create page:
 * 1. Prepare transaction (server-side)
 * 2. Sign with Privy wallet (client-side)
 * 3. Send to Solana (client-side)
 * 4. Confirm transaction
 * 5. Update MongoDB (server-side)
 */

import { useState, useCallback } from 'react';
import { useWallet } from './useWallet';
import { getSolanaConnection } from '../solana/connection';
import { createClientLogger } from '../utils/logger';
import { apiUrl } from '../utils/api';
import { useWallets, useSignAndSendTransaction, useStandardWallets } from '@privy-io/react-auth/solana';
import { useNetwork } from './useNetwork';
import bs58 from 'bs58';

const logger = createClientLogger();

export interface VoteParams {
  marketId: string;          // MongoDB _id
  marketAddress: string;     // On-chain market PDA address
  voteType: 'yes' | 'no';    // Vote direction
  amount: number;            // SOL amount (e.g., 0.01)
}

export interface VoteResult {
  success: boolean;
  signature?: string;        // Transaction signature
  yesVoteCount?: number;     // Updated vote counts
  noVoteCount?: number;
  error?: string;
}

export function useVoting() {
  const { primaryWallet } = useWallet();
  const { wallets } = useWallets(); // External wallets
  const { wallets: standardWallets } = useStandardWallets(); // Standard wallet interface (includes embedded)
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { network } = useNetwork();
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const vote = useCallback(async (params: VoteParams): Promise<VoteResult> => {
    // Validate wallet connection
    if (!primaryWallet) {
      const errorMsg = 'Please connect your wallet first';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    setIsVoting(true);
    setError(null);

    try {
      logger.info('Starting vote transaction', {
        marketId: params.marketId,
        voteType: params.voteType,
        amount: params.amount,
        userWallet: primaryWallet.address,
      });

      // Step 1: Prepare transaction (server-side)
      logger.info('Preparing transaction...');
      const prepareResponse = await fetch(apiUrl('/api/markets/vote/prepare'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketAddress: params.marketAddress,
          voteType: params.voteType,
          amount: params.amount,
          userWallet: primaryWallet.address,
          network: network, // Pass current network for dynamic program ID selection
        }),
      });

      const prepareResult = await prepareResponse.json();

      if (!prepareResult.success) {
        // Surface server-side details (e.g., "401 Unauthorized") so parseError
        // and the toast aren't stuck on a generic "An unexpected error".
        const base = prepareResult.error || 'Failed to prepare vote transaction';
        const detail = prepareResult.details ? ` — ${prepareResult.details}` : '';
        throw new Error(`${base}${detail}`);
      }

      logger.info('Transaction prepared successfully', {
        positionPda: prepareResult.data.positionPda,
      });

      // Step 2: Sign and send transaction with Privy (single call)
      let signature: string;
      let actualAmountSpent = params.amount; // Default to requested amount

      try {
        const rawTx = prepareResult.data.serializedTransaction;
        if (!rawTx) {
          throw new Error('No serialized transaction provided by server');
        }

        logger.info('Signing and sending transaction with Privy...');

        // Get Solana wallet - prioritize external wallets, fallback to standard wallets (embedded)
        let solanaWallet;

        if (wallets && wallets.length > 0) {
          // Path 1: External wallet (Phantom, Solflare, etc.)
          logger.info('Using external Solana wallet');
          solanaWallet = wallets[0];
        } else if (standardWallets && standardWallets.length > 0) {
          // Path 2: Embedded wallet from standard wallets
          logger.info('Using embedded Solana wallet');
          const privyWallet = standardWallets.find((w: any) => w.isPrivyWallet || w.name === 'Privy');
          if (!privyWallet) {
            throw new Error('No Privy wallet found');
          }
          solanaWallet = privyWallet;
        } else {
          throw new Error('No Solana wallet found');
        }

        // Convert base64 transaction to Uint8Array
        const txBuffer = Buffer.from(rawTx, 'base64');

        // Use signAndSendTransaction - works for both external and embedded wallets
        const result = await signAndSendTransaction({
          transaction: txBuffer,
          wallet: solanaWallet as any,
          chain: network === 'devnet' ? 'solana:devnet' : 'solana:mainnet',
        });

        // Extract signature from result and convert to base58 (Solana standard format)
        signature = bs58.encode(result.signature);
        logger.info('Transaction signed and sent', { signature });

        // Wait for confirmation and get transaction details
        console.log('[VOTE HOOK] Waiting for confirmation...', { signature });
        const connection = await getSolanaConnection();
        await connection.confirmTransaction(signature, 'confirmed');
        console.log('[VOTE HOOK] Transaction confirmed!', { signature });

        // Fetch transaction details to get actual amount spent (in case it was capped)
        try {
          const txDetails = await connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0,
          });

          if (txDetails?.meta?.logMessages) {
            // Look for the log message that shows actual SOL spent
            const logs = txDetails.meta.logMessages;
            const solSpentLog = logs.find(log => log.includes('SOL spent:'));

            if (solSpentLog) {
              const match = solSpentLog.match(/SOL spent: (\d+) lamports/);
              if (match) {
                const lamports = parseInt(match[1]);
                actualAmountSpent = lamports / 1_000_000_000; // Convert to SOL
                logger.info('Actual amount spent (from logs):', { actualAmountSpent });
              }
            }
          }
        } catch (logError) {
          logger.warn('Failed to parse transaction logs for actual amount', { error: logError });
          // Continue with requested amount if parsing fails
        }

      } catch (signerError: any) {
        logger.error('Privy signing/sending failed', { error: signerError.message });
        throw new Error(`Failed to sign/send transaction: ${signerError.message}`);
      }

      // Step 5: Complete vote in MongoDB
      console.log('[VOTE HOOK] Updating database...', {
        marketId: params.marketId,
        voteType: params.voteType,
        amount: actualAmountSpent,
        signature,
      });
      const completeResponse = await fetch(apiUrl('/api/markets/vote/complete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: params.marketId,
          voteType: params.voteType,
          amount: actualAmountSpent, // Use actual capped amount, not requested amount
          signature,
          traderWallet: primaryWallet.address,
          shares: 0, // TODO: Get actual shares from on-chain transaction
        }),
      });

      const completeResult = await completeResponse.json();
      console.log('[VOTE HOOK] Database response:', completeResult);

      if (!completeResult.success) {
        console.warn('[VOTE HOOK] Database update failed, but on-chain vote succeeded', {
          signature,
          error: completeResult.error,
        });
        // Don't throw - the vote succeeded on-chain
      }

      console.log('[VOTE HOOK] Vote completed successfully!', {
        signature,
        yesVoteCount: completeResult.data?.yesVoteCount,
        noVoteCount: completeResult.data?.noVoteCount,
      });

      setIsVoting(false);
      return {
        success: true,
        signature,
        yesVoteCount: completeResult.data?.yesVoteCount,
        noVoteCount: completeResult.data?.noVoteCount,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Vote transaction failed', { error: err });
      setError(errorMessage);
      setIsVoting(false);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }, [primaryWallet, wallets, standardWallets, signAndSendTransaction]);

  return {
    vote,
    isVoting,
    error,
  };
}
