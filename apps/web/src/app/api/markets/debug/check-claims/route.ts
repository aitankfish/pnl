/**
 * Debug API to check claim status for specific wallets
 */

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getSolanaConnection } from '@/lib/solana';
import { getProgram, getPositionPDA } from '@/lib/anchor-program';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketAddress, wallets } = body;

    if (!marketAddress || !wallets || !Array.isArray(wallets)) {
      return NextResponse.json(
        { success: false, error: 'Missing marketAddress or wallets array' },
        { status: 400 }
      );
    }

    const connection = await getSolanaConnection();
    const program = getProgram(connection as any);
    const marketPubkey = new PublicKey(marketAddress);

    // Check each wallet's position
    const positions = [];
    for (const wallet of wallets) {
      try {
        const userPubkey = new PublicKey(wallet);
        const [positionPda] = getPositionPDA(marketPubkey, userPubkey);

        // Try to fetch position
        // @ts-ignore - IDL types incomplete
        const position = await program.account.position.fetch(positionPda);

        positions.push({
          wallet,
          positionPda: positionPda.toBase58(),
          exists: true,
          yesShares: position.yesShares.toString(),
          noShares: position.noShares.toString(),
          totalInvested: position.totalInvested.toString(),
          claimed: position.claimed,
          claimableType: position.noShares > 0 ? 'NO_REWARDS' : (position.yesShares > 0 ? 'YES_REWARDS' : 'NONE'),
        });
      } catch (error) {
        // Position doesn't exist or already closed (claimed and closed)
        positions.push({
          wallet,
          positionPda: 'N/A',
          exists: false,
          claimed: true, // If position is closed, it means it was claimed
          note: 'Position account closed (likely claimed and closed)',
        });
      }
    }

    // Also fetch market state to see pool balance
    // @ts-ignore
    const marketAccount = await program.account.predictionMarket.fetch(marketPubkey);

    return NextResponse.json({
      success: true,
      data: {
        positions,
        marketPoolBalance: marketAccount.poolBalance.toString(),
        marketPoolBalanceSOL: (Number(marketAccount.poolBalance) / 1e9).toFixed(9),
        resolution: marketAccount.resolution,
        totalYesShares: marketAccount.totalYesShares.toString(),
        totalNoShares: marketAccount.totalNoShares.toString(),
      },
    });

  } catch (error) {
    logger.error('Failed to check claims:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
