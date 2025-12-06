/**
 * Jito Bundle Utilities
 *
 * Provides functions for submitting atomic transaction bundles to Jito validators
 * for MEV-protected execution on Solana mainnet.
 */

import { Connection, PublicKey, SystemProgram, TransactionInstruction, VersionedTransaction } from '@solana/web3.js';
import { createClientLogger } from './logger';

const logger = createClientLogger();

// Jito Block Engine endpoints by region
// Choose the endpoint closest to your infrastructure for lowest latency
const JITO_BLOCK_ENGINES = {
  amsterdam: 'https://amsterdam.mainnet.block-engine.jito.wtf',
  frankfurt: 'https://frankfurt.mainnet.block-engine.jito.wtf',
  ny: 'https://ny.mainnet.block-engine.jito.wtf',
  tokyo: 'https://tokyo.mainnet.block-engine.jito.wtf',
  slc: 'https://slc.mainnet.block-engine.jito.wtf',
} as const;

// Try different endpoints with fallback support
const JITO_ENDPOINTS_ORDERED = [
  JITO_BLOCK_ENGINES.frankfurt,
  JITO_BLOCK_ENGINES.amsterdam,
  JITO_BLOCK_ENGINES.tokyo,
  JITO_BLOCK_ENGINES.slc,
  JITO_BLOCK_ENGINES.ny,
];

// Primary endpoint (will rotate on rate limits)
let JITO_BLOCK_ENGINE = JITO_ENDPOINTS_ORDERED[0];

// Minimum tip required by Jito validators (in lamports)
export const MINIMUM_JITO_TIP = 1_000; // ~$0.0002 at current SOL prices

// Polling configuration for bundle status
const BUNDLE_POLL_INTERVAL_MS = 3_000; // Poll every 3 seconds
const BUNDLE_POLL_TIMEOUT_MS = 30_000; // Timeout after 30 seconds

/**
 * Jito bundle status returned by getInflightBundleStatuses
 */
export type JitoBundleStatus = 'Pending' | 'Landed' | 'Failed' | 'Invalid';

/**
 * Result of bundle submission and confirmation
 */
export interface JitoBundleResult {
  bundleId: string;
  status: JitoBundleStatus | 'Timeout';
  signature?: string;
  landedSlot?: number;
  error?: string;
}

// Hardcoded Jito tip accounts (publicly known, static addresses)
// Source: https://jito-labs.gitbook.io/mev/searcher-resources/bundles
const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
].map(addr => new PublicKey(addr));

/**
 * Fetch Jito tip accounts (with hardcoded fallback)
 *
 * These are the accounts that receive tips for bundle prioritization.
 * Randomly select one when creating tip instructions.
 *
 * @returns Array of Jito tip account public keys
 */
export async function getJitoTipAccounts(): Promise<PublicKey[]> {
  try {
    logger.info('Fetching Jito tip accounts...');

    const response = await fetch(`${JITO_BLOCK_ENGINE}/api/v1/bundles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTipAccounts',
        params: [],
      }),
    });

    if (!response.ok) {
      logger.warn(`Jito API returned ${response.status}, using hardcoded tip accounts`);
      return JITO_TIP_ACCOUNTS;
    }

    const data = await response.json();

    if (data.error) {
      logger.warn(`Jito RPC error: ${data.error.message}, using hardcoded tip accounts`);
      return JITO_TIP_ACCOUNTS;
    }

    const tipAccounts = data.result.map((addr: string) => new PublicKey(addr));

    logger.info(`Fetched ${tipAccounts.length} Jito tip accounts`, {
      accounts: tipAccounts.map(a => a.toBase58()),
    });

    return tipAccounts;
  } catch (error) {
    logger.warn('Failed to fetch Jito tip accounts, using hardcoded fallback', { error });
    return JITO_TIP_ACCOUNTS;
  }
}

/**
 * Create a tip instruction for Jito bundle
 *
 * IMPORTANT: This instruction MUST be the last instruction in the last transaction
 * of your bundle, otherwise the tip could be stolen if a fork occurs.
 *
 * @param fromPubkey - Payer account (will pay the tip)
 * @param tipLamports - Amount to tip in lamports (min: 1000)
 * @returns Transfer instruction to random Jito tip account
 */
export async function createJitoTipInstruction(
  fromPubkey: PublicKey,
  tipLamports: number = MINIMUM_JITO_TIP
): Promise<TransactionInstruction> {
  if (tipLamports < MINIMUM_JITO_TIP) {
    logger.warn(`Tip amount ${tipLamports} is below minimum ${MINIMUM_JITO_TIP}, adjusting...`);
    tipLamports = MINIMUM_JITO_TIP;
  }

  const tipAccounts = await getJitoTipAccounts();
  const randomTipAccount = tipAccounts[Math.floor(Math.random() * tipAccounts.length)];

  logger.info('Creating Jito tip instruction', {
    from: fromPubkey.toBase58(),
    to: randomTipAccount.toBase58(),
    amount: tipLamports,
  });

  return SystemProgram.transfer({
    fromPubkey,
    toPubkey: randomTipAccount,
    lamports: tipLamports,
  });
}

/**
 * Submit a bundle of transactions to Jito block engine
 *
 * Transactions will be executed atomically in the order provided.
 * All transactions must succeed or the entire bundle fails.
 *
 * @param transactions - Array of signed VersionedTransactions (max 5)
 * @returns Bundle ID for tracking
 */
export async function submitJitoBundle(
  transactions: VersionedTransaction[]
): Promise<string> {
  try {
    if (transactions.length === 0) {
      throw new Error('Cannot submit empty bundle');
    }

    if (transactions.length > 5) {
      throw new Error(`Bundle too large: ${transactions.length} transactions (max: 5)`);
    }

    logger.info(`Submitting Jito bundle with ${transactions.length} transactions...`);

    // Serialize all transactions to base64
    const serializedTxs = transactions.map(tx => {
      const serialized = Buffer.from(tx.serialize()).toString('base64');
      logger.debug('Serialized transaction', {
        size: tx.serialize().length,
        base64Length: serialized.length,
      });
      return serialized;
    });

    const response = await fetch(`${JITO_BLOCK_ENGINE}/api/v1/bundles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendBundle',
        params: [serializedTxs],
      }),
    });

    if (!response.ok) {
      throw new Error(`Jito API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Jito bundle submission failed: ${data.error.message}`);
    }

    const bundleId = data.result;

    logger.info('Bundle submitted successfully', {
      bundleId,
      explorerUrl: `https://explorer.jito.wtf/bundle/${bundleId}`,
    });

    return bundleId;
  } catch (error) {
    logger.error('Failed to submit Jito bundle', { error });
    throw new Error(`Failed to submit Jito bundle: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get bundle status from Jito block engine
 *
 * @param bundleId - Bundle ID returned from submitJitoBundle
 * @returns Bundle status or null if not found
 */
export async function getBundleStatus(bundleId: string): Promise<JitoBundleStatus | null> {
  try {
    const response = await fetch(`${JITO_BLOCK_ENGINE}/api/v1/bundles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getInflightBundleStatuses',
        params: [[bundleId]],
      }),
    });

    if (!response.ok) {
      throw new Error(`Jito API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Jito RPC error: ${data.error.message}`);
    }

    const bundleStatus = data.result?.value?.[0];

    if (!bundleStatus) {
      logger.warn('Bundle not found in inflight statuses', { bundleId });
      return null;
    }

    return bundleStatus.status as JitoBundleStatus;
  } catch (error) {
    logger.error('Failed to get bundle status', { error, bundleId });
    return null;
  }
}

/**
 * Poll bundle status until it lands, fails, or times out
 *
 * Note: Jito only tracks bundles for 5 minutes. After that, check on-chain
 * using the transaction signatures.
 *
 * @param bundleId - Bundle ID to poll
 * @param timeoutMs - Maximum time to wait (default: 30s)
 * @returns Bundle result with status and details
 */
export async function pollBundleStatus(
  bundleId: string,
  timeoutMs: number = BUNDLE_POLL_TIMEOUT_MS
): Promise<JitoBundleResult> {
  const startTime = Date.now();

  logger.info('Polling bundle status...', {
    bundleId,
    timeoutMs,
    explorerUrl: `https://explorer.jito.wtf/bundle/${bundleId}`,
  });

  // Wait 5 seconds before first poll (Jito recommendation)
  await new Promise(resolve => setTimeout(resolve, 5000));

  while (Date.now() - startTime < timeoutMs) {
    const status = await getBundleStatus(bundleId);

    if (status === 'Landed') {
      logger.info('✅ Bundle landed successfully!', { bundleId });
      return {
        bundleId,
        status: 'Landed',
      };
    }

    if (status === 'Failed') {
      logger.error('❌ Bundle failed', { bundleId });
      return {
        bundleId,
        status: 'Failed',
        error: 'Bundle execution failed on-chain',
      };
    }

    if (status === 'Invalid') {
      logger.error('❌ Bundle invalid', { bundleId });
      return {
        bundleId,
        status: 'Invalid',
        error: 'Bundle is invalid (check transaction signatures)',
      };
    }

    logger.debug('Bundle still pending...', { bundleId, status });

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, BUNDLE_POLL_INTERVAL_MS));
  }

  logger.warn('⏱️ Bundle polling timed out', { bundleId });
  return {
    bundleId,
    status: 'Timeout',
    error: `Bundle did not land within ${timeoutMs}ms. Check Jito Explorer for status.`,
  };
}

/**
 * Submit bundle and wait for confirmation
 *
 * Convenience function that combines submitJitoBundle + pollBundleStatus
 *
 * @param transactions - Array of signed transactions
 * @param timeoutMs - Maximum time to wait for confirmation
 * @returns Bundle result with status
 */
export async function submitAndConfirmBundle(
  transactions: VersionedTransaction[],
  timeoutMs: number = BUNDLE_POLL_TIMEOUT_MS
): Promise<JitoBundleResult> {
  const bundleId = await submitJitoBundle(transactions);
  const result = await pollBundleStatus(bundleId, timeoutMs);
  return result;
}

/**
 * Get Jito explorer URL for a bundle
 *
 * @param bundleId - Bundle ID
 * @returns Explorer URL
 */
export function getJitoExplorerUrl(bundleId: string): string {
  return `https://explorer.jito.wtf/bundle/${bundleId}`;
}
