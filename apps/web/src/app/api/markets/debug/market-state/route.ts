/**
 * Debug API to fetch current market state
 */

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getSolanaConnection } from '@/lib/solana';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketAddress } = body;

    if (!marketAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing marketAddress' },
        { status: 400 }
      );
    }

    const connection = await getSolanaConnection();
    const marketPubkey = new PublicKey(marketAddress);

    logger.info('Fetching market account...');

    // Get account lamports
    const accountInfo = await connection.getAccountInfo(marketPubkey);

    // Get recent signatures
    const signatures = await connection.getSignaturesForAddress(marketPubkey, { limit: 30 });

    // Categorize transactions
    const transactions: any[] = [];
    for (const sigInfo of signatures) {
      const tx = await connection.getTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (tx && tx.meta) {
        const logs = tx.meta.logMessages || [];
        let txType = 'Unknown';

        if (logs.some(log => log.includes('vote_yes') || log.includes('vote_no'))) {
          txType = 'VOTE';
        } else if (logs.some(log => log.includes('resolve_market'))) {
          txType = 'RESOLVE';
        } else if (logs.some(log => log.includes('claim_rewards'))) {
          txType = 'CLAIM';
        }

        transactions.push({
          signature: sigInfo.signature,
          type: txType,
          blockTime: sigInfo.blockTime,
          success: !tx.meta.err,
          logs: txType === 'CLAIM' ? logs.filter(log =>
            log.includes('NO WINS') ||
            log.includes('YES WINS') ||
            log.includes('REFUND') ||
            log.includes('SOL payout') ||
            log.includes('Token payout') ||
            log.includes('Remaining pool') ||
            log.includes('shares')
          ) : [],
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        accountLamports: accountInfo?.lamports || 0,
        accountSOL: accountInfo ? (accountInfo.lamports / 1e9).toFixed(9) : '0',
        transactions,
      },
    });

  } catch (error) {
    logger.error('Failed to fetch market state:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
