/**
 * API endpoint for updating database after market extension
 *
 * This endpoint updates the database with the new phase and creates
 * notifications for all participants about the funding phase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientLogger } from '@/lib/logger';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import { COLLECTIONS } from '@/lib/database/models';
import { ObjectId } from 'mongodb';
import { connectToDatabase as connectMongoose, Notification, PredictionParticipant } from '@/lib/mongodb';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketId, marketAddress, signature } = body;

    // Validate inputs
    if (!marketId || !marketAddress || !signature) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: marketId, marketAddress, signature',
        },
        { status: 400 }
      );
    }

    logger.info('Updating database after market extension', {
      marketId,
      marketAddress,
      signature,
    });

    // Connect to database
    await connectToDatabase();
    const db = await getDatabase();

    // Update database with new phase
    let dbUpdateSuccess = false;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Database update attempt ${attempt}/${maxRetries}`);

        const updateData = {
          phase: 'funding',
          extendedAt: new Date(),
          updatedAt: new Date(),
        };

        await db.collection(COLLECTIONS.PREDICTION_MARKETS).updateOne(
          { _id: new ObjectId(marketId) },
          { $set: updateData }
        );

        logger.info('Database updated with extension', {
          marketId,
          phase: 'funding',
        });

        dbUpdateSuccess = true;
        break;

      } catch (dbError) {
        const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
        logger.warn(`Database update attempt ${attempt} failed: ${errorMsg}`);

        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    if (!dbUpdateSuccess) {
      logger.error('Database update failed after all retries', { marketId });
    }

    // Create notifications for all participants
    try {
      await connectMongoose();

      const marketObjectId = new ObjectId(marketId);
      const participants = await PredictionParticipant.find({ marketId: marketObjectId }).lean();
      logger.info(`Found ${participants.length} participants for market ${marketId}`);

      if (participants.length > 0) {
        // Get market details for notification message
        const market = await db.collection(COLLECTIONS.PREDICTION_MARKETS).findOne(
          { _id: marketObjectId }
        );

        if (market) {
          const marketName = market.marketName || 'Market';

          // Create notifications for all participants
          const notifications = participants.map(participant => {
            const isYesVoter = participant.voteOption === true;

            return {
              userId: participant.participantWallet,
              type: 'pool_complete',
              title: `Funding Phase Started - ${marketName}`,
              message: isYesVoter
                ? `Great news! The market reached its target. If the project launches successfully, you'll receive token airdrops!`
                : `The market has entered Funding Phase. The founder now has 30 days to launch the token.`,
              priority: 'medium' as const,
              marketId: marketObjectId,
              actionUrl: `/market/${marketId}`,
              metadata: {
                phase: 'funding',
                voteOption: isYesVoter ? 'yes' : 'no',
                action: 'view_market',
              },
            };
          });

          // Bulk insert notifications
          await Notification.insertMany(notifications);
          logger.info(`Created ${notifications.length} extension notifications`);
        }
      }
    } catch (notifError) {
      logger.error('Failed to create extension notifications (non-fatal)', {
        error: notifError instanceof Error ? notifError.message : String(notifError)
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        signature,
        phase: 'funding',
        message: 'Market extended to Funding Phase!',
      },
    });

  } catch (error) {
    logger.error('Failed to update database after extension:', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update database after extension',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
