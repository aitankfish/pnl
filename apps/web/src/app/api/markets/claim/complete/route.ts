/**
 * API endpoint for updating database after successful claim
 *
 * This endpoint is called after the claim transaction is confirmed on-chain.
 * It updates the PredictionParticipant record to mark the claim as completed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientLogger } from '@/lib/logger';
import { connectToDatabase, PredictionParticipant } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketId, userWallet, signature, claimAmount } = body;

    // Validate inputs
    if (!marketId || !userWallet || !signature) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: marketId, userWallet, signature',
        },
        { status: 400 }
      );
    }

    logger.info('Updating database after successful claim', {
      marketId,
      userWallet,
      signature,
      claimAmount,
    });

    // Connect to database
    await connectToDatabase();

    // Update PredictionParticipant to mark as claimed and position closed
    const updateResult = await PredictionParticipant.updateOne(
      {
        marketId: new ObjectId(marketId),
        participantWallet: userWallet,
      },
      {
        $set: {
          claimed: true,
          positionClosed: true,
          solRewarded: claimAmount || 0,
          lastSyncedAt: new Date(),
        },
      }
    );

    if (updateResult.matchedCount === 0) {
      logger.warn('No participant record found to update', {
        marketId,
        userWallet,
      });
      // Don't fail the request - the claim was successful on-chain
    } else {
      logger.info('Participant record updated successfully', {
        marketId,
        userWallet,
        modifiedCount: updateResult.modifiedCount,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        signature,
        message: 'Claim recorded successfully!',
      },
    });

  } catch (error) {
    logger.error('Failed to update database after claim:', { error: error instanceof Error ? error.message : String(error) });

    // Don't fail the request even if database update fails
    // The on-chain transaction already succeeded
    return NextResponse.json({
      success: true,
      data: {
        message: 'Claim completed on-chain (database update pending)',
      },
    });
  }
}
