/**
 * Transaction Parser Utilities
 * Extracts actual transfer amounts from confirmed Solana transactions
 */

import { Connection, VersionedTransactionResponse } from '@solana/web3.js';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

/**
 * Parse the actual claim amount from a confirmed claim transaction
 *
 * For SOL transfers (NoWins, Refund): Looks at SOL balance changes
 * For Token transfers (YesWins): Looks at token balance changes
 *
 * @param connection Solana connection
 * @param signature Transaction signature
 * @returns Claimed amount in lamports (SOL) or smallest token unit
 */
export async function parseClaimAmount(
  connection: Connection,
  signature: string
): Promise<{ amount: number; type: 'sol' | 'token' }> {
  try {
    logger.info('Fetching transaction details', { signature });

    // Fetch transaction with maxSupportedTransactionVersion for VersionedTransactions
    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });

    if (!tx) {
      throw new Error(`Transaction not found: ${signature}`);
    }

    return parseClaimAmountFromTransaction(tx);
  } catch (error) {
    logger.error('Failed to parse claim amount:', {
      signature,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Parse claim amount from a fetched transaction response
 *
 * @param tx VersionedTransactionResponse
 * @returns Claimed amount and type
 */
export function parseClaimAmountFromTransaction(
  tx: VersionedTransactionResponse
): { amount: number; type: 'sol' | 'token' } {
  // Get account keys from the transaction
  const accountKeys = tx.transaction.message.staticAccountKeys;

  // User wallet is typically the first account (fee payer/signer)
  const userAccountIndex = 0;

  // Check SOL balance changes first (for NoWins and Refund)
  if (tx.meta?.preBalances && tx.meta?.postBalances) {
    const preBalance = tx.meta.preBalances[userAccountIndex];
    const postBalance = tx.meta.postBalances[userAccountIndex];

    // Calculate net change (positive = received SOL)
    const solChange = postBalance - preBalance;

    logger.info('SOL balance change detected', {
      preBalance,
      postBalance,
      solChange,
      solChangeSOL: (solChange / 1e9).toFixed(9),
    });

    // If user received SOL (after accounting for fees), this is the claim amount
    if (solChange > 0) {
      return {
        amount: solChange,
        type: 'sol',
      };
    }

    // If solChange is negative, it might be just transaction fees
    // Check token balances for YesWins case
  }

  // Check token balance changes (for YesWins)
  if (tx.meta?.postTokenBalances) {
    // Find token balance changes for the user's token accounts
    const preTokens = tx.meta.preTokenBalances || [];
    const postTokens = tx.meta.postTokenBalances;

    for (const postToken of postTokens) {
      // Handle both existing accounts and newly created accounts
      if (postToken.uiTokenAmount) {
        const preToken = preTokens.find(
          (pre) => pre.accountIndex === postToken.accountIndex
        );

        // For new accounts, preAmount is 0
        const preAmount = preToken?.uiTokenAmount
          ? BigInt(preToken.uiTokenAmount.amount)
          : BigInt(0);
        const postAmount = BigInt(postToken.uiTokenAmount.amount);
        const tokenChange = Number(postAmount - preAmount);

        if (tokenChange > 0) {
          logger.info('Token balance change detected', {
            mint: postToken.mint,
            preAmount: preAmount.toString(),
            postAmount: postAmount.toString(),
            tokenChange,
            isNewAccount: !preToken,
          });

          return {
            amount: tokenChange,
            type: 'token',
          };
        }
      }
    }
  }

  // If we couldn't parse any positive balance change, throw error
  logger.error('Could not parse claim amount from transaction', {
    hasPreBalances: !!tx.meta?.preBalances,
    hasPostBalances: !!tx.meta?.postBalances,
    hasPreTokenBalances: !!tx.meta?.preTokenBalances,
    hasPostTokenBalances: !!tx.meta?.postTokenBalances,
  });

  throw new Error('Could not parse claim amount from transaction - no positive balance change detected');
}
