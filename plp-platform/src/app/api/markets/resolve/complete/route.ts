/**
 * API endpoint for updating database after market resolution
 *
 * This endpoint updates the database with the resolution outcome
 * Transaction is already sent by the client (useResolution hook)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientLogger } from '@/lib/logger';
import { getSolanaConnection } from '@/lib/solana';
import { PublicKey } from '@solana/web3.js';
import { getProgram } from '@/lib/anchor-program';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import { COLLECTIONS } from '@/lib/database/models';
import { ObjectId } from 'mongodb';
import { connectToDatabase as connectMongoose, Notification, PredictionParticipant } from '@/lib/mongodb';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketId, marketAddress, signature, tokenMint, network } = body;

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

    // Determine network (default to mainnet for production)
    const targetNetwork = (network as 'devnet' | 'mainnet-beta') ||
      (process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'devnet' | 'mainnet-beta') ||
      'mainnet-beta';

    logger.info('Updating database after market resolution', {
      marketId,
      marketAddress,
      signature,
      tokenMint,
      network: targetNetwork,
    });

    // Fetch the updated market state from blockchain (with retry for RPC lag)
    const connection = await getSolanaConnection(targetNetwork);
    const program = getProgram(undefined, targetNetwork); // Pass network for correct RPC/program ID
    const marketPubkey = new PublicKey(marketAddress);

    logger.info('Fetching updated market state from blockchain...');

    // Retry fetching market account to handle RPC lag after transaction
    let marketAccount: any = null;
    const maxFetchRetries = 5;

    for (let attempt = 1; attempt <= maxFetchRetries; attempt++) {
      try {
        logger.info(`Fetching market account (attempt ${attempt}/${maxFetchRetries})...`);
        marketAccount = await program.account.market.fetch(marketPubkey);
        logger.info('✅ Market account fetched successfully', {
          resolution: marketAccount.resolution,
          phase: marketAccount.phase,
          attempt,
        });
        break; // Success, exit retry loop
      } catch (fetchError) {
        const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
        logger.warn(`Market account fetch attempt ${attempt} failed: ${errorMsg}`);

        if (attempt < maxFetchRetries) {
          // Exponential backoff: 500ms, 1s, 2s, 4s
          const backoffMs = Math.pow(2, attempt - 1) * 500;
          logger.info(`Retrying in ${backoffMs / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          // All retries exhausted
          throw new Error(`Failed to fetch market account after ${maxFetchRetries} attempts: ${errorMsg}`);
        }
      }
    }

    if (!marketAccount) {
      throw new Error('Market account fetch failed - no data returned');
    }

    // Determine resolution outcome
    // Anchor 0.30+ returns enums as objects like { yesWins: {} }
    let resolutionOutcome = 'Unknown';
    const resolutionKey = Object.keys(marketAccount.resolution)[0];
    if (resolutionKey === 'unresolved') {
      resolutionOutcome = 'Unresolved';
    } else if (resolutionKey === 'yesWins') {
      resolutionOutcome = 'YesWins';
    } else if (resolutionKey === 'noWins') {
      resolutionOutcome = 'NoWins';
    } else if (resolutionKey === 'refund') {
      resolutionOutcome = 'Refund';
    }

    logger.info('Market resolved', {
      marketAddress,
      resolution: resolutionOutcome,
      resolutionKey,
    });

    // Connect to database first (outside retry loop so db is in scope for notifications)
    await connectToDatabase();
    const db = await getDatabase();

    // Update database with resolution (with retry logic)
    let dbUpdateSuccess = false;
    let lastDbError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Database update attempt ${attempt}/${maxRetries}`);

        // Prepare update data
        // Note: Market struct doesn't have marketState or winningOption fields
        // Resolution outcome is derived from the resolution enum
        const updateData: any = {
          resolution: resolutionOutcome,
          phase: Object.keys(marketAccount.phase)[0], // 'prediction' or 'funding'
          resolvedAt: new Date(),
          updatedAt: new Date(),
        };

        // If tokenMint is provided (YES wins, token launched), save it immediately
        if (tokenMint) {
          updateData.pumpFunTokenAddress = tokenMint;
          logger.info('Saving token mint address to database (immediate write)', {
            tokenMint,
            marketId,
          });
        }

        await db.collection(COLLECTIONS.PREDICTION_MARKETS).updateOne(
          { _id: new ObjectId(marketId) },
          { $set: updateData }
        );

        logger.info('Database updated with resolution', {
          marketId,
          resolution: resolutionOutcome,
          pumpFunTokenAddress: tokenMint || 'none',
        });

        dbUpdateSuccess = true;
        break; // Success, exit retry loop

      } catch (dbError) {
        lastDbError = dbError as Error;
        logger.warn(`Database update attempt ${attempt} failed: ${lastDbError.message}`);

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s
          const backoffMs = Math.pow(2, attempt - 1) * 1000;
          logger.info(`Retrying database update in ${backoffMs / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    if (!dbUpdateSuccess) {
      logger.error('Database update failed after all retries', {
        error: lastDbError?.message,
        marketId,
      });
      // Don't throw error - transaction already succeeded on-chain
      // Blockchain sync will eventually update the database
    }

    // Create notifications for all participants
    try {
      await connectMongoose();

      // Fetch all participants for this market (convert marketId string to ObjectId)
      const marketObjectId = new ObjectId(marketId);
      const participants = await PredictionParticipant.find({ marketId: marketObjectId }).lean();
      logger.info(`Found ${participants.length} participants for market ${marketId}`);

      if (participants.length > 0) {
        logger.info(`Creating notifications for ${participants.length} participants`);

        // Get market details for notification message (only if db is available)
        if (!db) {
          logger.warn('Database connection not available, skipping notifications');
          return NextResponse.json({
            success: true,
            data: {
              signature,
              resolution: resolutionOutcome,
              tokenMint: marketAccount.tokenMint?.toBase58() || tokenMint || null,
              message: 'Market resolved successfully! (notifications skipped)',
            },
          });
        }

        const market = await db.collection(COLLECTIONS.PREDICTION_MARKETS).findOne(
          { _id: new ObjectId(marketId) }
        );

        if (market) {
          const marketName = market.marketName || 'Market';

          // Create notifications based on resolution outcome
          const notifications = participants.map(participant => {
            let title = '';
            let message = '';
            let priority: 'high' | 'medium' | 'low' = 'high';
            let notificationType = 'market_resolved';

            // Determine if this participant won
            const isWinner =
              (resolutionOutcome === 'YesWins' && participant.voteOption === true) ||
              (resolutionOutcome === 'NoWins' && participant.voteOption === false) ||
              resolutionOutcome === 'Refund';

            if (resolutionOutcome === 'YesWins') {
              if (participant.voteOption === true) {
                // YES voter won - can claim tokens
                title = `🎉 You Won! ${marketName}`;
                message = `Congratulations! Your YES vote was correct. Claim your token airdrop now!`;
                priority = 'high';
                notificationType = 'claim_ready';
              } else {
                // NO voter lost
                title = `Market Resolved - ${marketName}`;
                message = `The market resolved YES. Your NO prediction was incorrect.`;
                priority = 'medium';
              }
            } else if (resolutionOutcome === 'NoWins') {
              if (participant.voteOption === false) {
                // NO voter won - can claim SOL
                title = `🎉 You Won! ${marketName}`;
                message = `Congratulations! Your NO vote was correct. Claim your SOL rewards now!`;
                priority = 'high';
                notificationType = 'claim_ready';
              } else {
                // YES voter lost
                title = `Market Resolved - ${marketName}`;
                message = `The market resolved NO. Your YES prediction was incorrect.`;
                priority = 'medium';
              }
            } else if (resolutionOutcome === 'Refund') {
              title = `↩️ Market Refunded - ${marketName}`;
              message = `The market was refunded. Claim your original stake back.`;
              priority = 'medium';
              notificationType = 'claim_ready';
            } else {
              // Unresolved or Unknown
              title = `Market Status Update - ${marketName}`;
              message = `The market status has been updated. Check the market page for details.`;
              priority = 'low';
            }

            return {
              userId: participant.participantWallet,
              type: notificationType,
              title,
              message,
              priority,
              marketId: marketObjectId,
              actionUrl: `/market/${marketId}`,
              metadata: {
                resolution: resolutionOutcome,
                voteOption: participant.voteOption ? 'yes' : 'no',
                won: isWinner,
                action: isWinner ? 'claim_reward' : 'view_result',
              },
            };
          });

          // Bulk insert notifications
          await Notification.insertMany(notifications);
          logger.info(`Created ${notifications.length} resolution notifications`);
        }
      }
    } catch (error) {
      logger.error('Failed to create resolution notifications (non-fatal)', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't fail the request if notification creation fails
    }

    return NextResponse.json({
      success: true,
      data: {
        signature,
        resolution: resolutionOutcome,
        tokenMint: marketAccount.tokenMint?.toBase58() || tokenMint || null,
        message: 'Market resolved successfully!',
      },
    });

  } catch (error) {
    logger.error('Failed to update database after resolution:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update database after resolution',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
