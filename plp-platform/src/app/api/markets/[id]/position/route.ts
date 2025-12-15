/**
 * API endpoint to check user's position on a market
 *
 * Returns whether the user has an existing position and which side they voted on
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase as connectNative, getDatabase } from '@/lib/database/index';
import { connectToDatabase, PredictionParticipant } from '@/lib/mongodb';
import { COLLECTIONS } from '@/lib/database/models';
import { ObjectId } from 'mongodb';
import { createClientLogger } from '@/lib/logger';

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic';

const logger = createClientLogger();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: marketId } = await params;
    const { searchParams } = new URL(request.url);
    const userWallet = searchParams.get('wallet');

    if (!userWallet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Wallet address required',
        },
        { status: 400 }
      );
    }

    logger.info('Checking user position', { marketId, userWallet });

    // Connect to database
    await connectNative();
    const db = await getDatabase();

    // Check if user has any trade history on this market
    const userTrades = await db
      .collection(COLLECTIONS.TRADE_HISTORY)
      .find({
        marketId: new ObjectId(marketId),
        traderWallet: userWallet,
      })
      .toArray();

    if (userTrades.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          hasPosition: false,
          side: null,
          totalAmount: 0,
          tradeCount: 0,
        },
      });
    }

    // Determine which side they voted on (first vote determines the side)
    const firstTrade = userTrades[0];
    const side = firstTrade.voteType;

    // Calculate total amount invested
    const totalAmount = userTrades.reduce((sum, trade) => sum + trade.amount, 0);

    // Check if user has claimed rewards (from database)
    await connectToDatabase();
    const participant = await PredictionParticipant.findOne({
      marketId: new ObjectId(marketId),
      participantWallet: userWallet,
    });

    let claimed = participant?.claimed || false;

    // VERIFY claimed status from on-chain Position PDA (source of truth)
    // If DB says not claimed, double-check blockchain before showing claim button
    if (!claimed) {
      try {
        const { getPositionPDA } = await import('@/lib/anchor-program');
        const { PublicKey } = await import('@solana/web3.js');
        const { getSolanaConnection } = await import('@/lib/solana');

        // Get market address from database
        const market = await db.collection(COLLECTIONS.PREDICTION_MARKETS).findOne({
          _id: new ObjectId(marketId),
        });

        if (market?.marketAddress) {
          const marketPubkey = new PublicKey(market.marketAddress);
          const userPubkey = new PublicKey(userWallet);
          const [positionPda] = getPositionPDA(marketPubkey, userPubkey);

          const connection = await getSolanaConnection();
          const positionAccountInfo = await connection.getAccountInfo(positionPda);

          if (positionAccountInfo) {
            // Position PDA exists - read claimed flag (byte at offset 32+32+8+8+8 = 88)
            const positionData = positionAccountInfo.data.slice(8); // Skip discriminator
            const claimedByte = positionData[88]; // claimed field is at offset 88
            const onchainClaimed = claimedByte !== 0;

            // If on-chain says claimed but DB doesn't, update our response to match blockchain
            if (onchainClaimed && !claimed) {
              logger.warn('Database claimed status out of sync with blockchain', {
                marketId,
                userWallet,
                dbClaimed: claimed,
                onchainClaimed,
              });
              claimed = true; // Use on-chain status as source of truth
            }
          } else {
            // Position PDA doesn't exist - user must have claimed and closed the account
            logger.info('Position PDA not found - likely already claimed and closed', {
              marketId,
              userWallet,
            });
            claimed = true; // Account closed = already claimed
          }
        }
      } catch (error) {
        // Log error but don't fail - fall back to DB value
        logger.warn('Failed to verify claimed status on-chain, using DB value', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('User position found', {
      marketId,
      userWallet,
      side,
      tradeCount: userTrades.length,
      totalAmount,
      claimed,
    });

    return NextResponse.json({
      success: true,
      data: {
        hasPosition: true,
        side,
        totalAmount: totalAmount / 1_000_000_000, // Convert to SOL
        tradeCount: userTrades.length,
        claimed,
      },
    });
  } catch (error) {
    logger.error('Failed to check user position:', { error: error instanceof Error ? error.message : String(error) });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check user position',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
