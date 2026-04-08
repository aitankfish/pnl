/**
 * Helius API Client
 *
 * Provides utilities for querying Solana blockchain data via Helius Enhanced APIs
 * - Transaction history for markets
 * - Account transactions
 * - Webhooks for real-time updates
 */

import { createHelius, type HeliusClient } from 'helius-sdk';
import { SOLANA_NETWORK } from '@/config/solana';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

// Cache clients by network to avoid recreating
const heliusClients: Record<string, HeliusClient> = {};

export function getHeliusClient(network?: 'mainnet-beta' | 'devnet'): HeliusClient {
  const apiKey = process.env.HELIUS_API_KEY;

  if (!apiKey) {
    throw new Error('HELIUS_API_KEY is not configured in environment variables');
  }

  // Use provided network or fallback to environment variable
  const targetNetwork = network || SOLANA_NETWORK;
  const heliusNetwork = targetNetwork === 'mainnet-beta' ? 'mainnet' : 'devnet';

  // Return cached client if exists
  if (heliusClients[heliusNetwork]) {
    return heliusClients[heliusNetwork];
  }

  // Create new client and cache it
  const client = createHelius({ apiKey, network: heliusNetwork });
  heliusClients[heliusNetwork] = client;
  logger.info('Helius client initialized', { network: heliusNetwork });

  return client;
}

/**
 * Fetch transaction history for a market address
 * Uses Helius Enhanced Transactions API (v2) - single call, parsed data
 */
export interface TransactionHistoryOptions {
  address: string;
  limit?: number;
  before?: string; // Transaction signature for pagination
  until?: string;
  source?: string;
  type?: string;
}

export async function getMarketTransactions(
  options: TransactionHistoryOptions,
  network?: 'mainnet-beta' | 'devnet'
) {
  const helius = getHeliusClient(network);

  try {
    logger.info('Fetching enhanced transactions from Helius', {
      address: options.address,
      limit: options.limit,
      network
    });

    // Use Enhanced Transactions API for single-call parsed data
    // Build params object, only include defined values
    const params: any = {
      address: options.address,
      limit: options.limit || 100,
    };

    // Only add pagination params if they have values
    if (options.before) params.before = options.before;
    if (options.until) params.until = options.until;

    // Note: commitment parameter not supported by Enhanced Transactions API
    const transactions = await helius.enhanced.getTransactionsByAddress(params);

    logger.info('Fetched enhanced transactions from Helius', {
      count: transactions.length,
      address: options.address,
      network
    });

    return transactions;
  } catch (error) {
    logger.error('Failed to fetch transactions from Helius', {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      address: options.address,
      network
    });
    // Return empty array instead of throwing - let caller handle
    return [];
  }
}

/**
 * Parse enhanced transaction to extract vote information
 * Works with Helius v2 EnhancedTransaction format
 */
export interface ParsedVote {
  signature: string;
  traderWallet: string;
  voteType: 'yes' | 'no';
  amount: number; // in lamports
  timestamp: number;
  blockTime: number;
}

export function parseVoteTransaction(transaction: any): ParsedVote | null {
  try {
    if (!transaction || !transaction.signature) {
      return null;
    }

    // Extract trader wallet from native transfers (feePayer is the signer)
    const traderWallet = transaction.feePayer;

    if (!traderWallet) {
      return null;
    }

    // Get amount from native transfers
    // In our voting system, the user transfers SOL to the market
    let amount = 0;
    if (transaction.nativeTransfers && transaction.nativeTransfers.length > 0) {
      // Find the transfer FROM the user (they're spending SOL to vote)
      const userTransfer = transaction.nativeTransfers.find(
        (transfer: any) => transfer.fromUserAccount === traderWallet
      );
      amount = userTransfer?.amount || 0;
    }

    // Infer vote type from transaction description or instructions
    // Check description first (Helius provides human-readable descriptions)
    let voteType: 'yes' | 'no' = 'yes';
    const description = transaction.description?.toLowerCase() || '';
    const type = transaction.type?.toLowerCase() || '';

    // Check if description/type mentions "no" vote
    if (description.includes('vote_no') || description.includes('no vote') ||
        type.includes('vote_no') || type.includes('no_vote')) {
      voteType = 'no';
    }

    // Fallback: check instructions for vote type hints
    if (transaction.instructions && transaction.instructions.length > 0) {
      const instructionStr = JSON.stringify(transaction.instructions).toLowerCase();
      if (instructionStr.includes('vote_no') || instructionStr.includes('no')) {
        voteType = 'no';
      }
    }

    return {
      signature: transaction.signature,
      traderWallet,
      voteType,
      amount,
      timestamp: (transaction.timestamp || 0) * 1000, // Convert to ms
      blockTime: transaction.timestamp || 0,
    };
  } catch (error) {
    logger.error('Failed to parse vote transaction', { error });
    return null;
  }
}

/**
 * Get enhanced transaction history with parsed data
 */
export async function getMarketVoteHistory(
  marketAddress: string,
  limit: number = 100,
  network?: 'mainnet-beta' | 'devnet'
) {
  const transactions = await getMarketTransactions(
    {
      address: marketAddress,
      limit,
    },
    network
  );

  const votes = transactions
    .map(tx => parseVoteTransaction(tx))
    .filter((vote): vote is ParsedVote => vote !== null)
    .sort((a, b) => b.timestamp - a.timestamp); // Newest first

  return votes;
}
