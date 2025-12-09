/**
 * Event Processor
 * Processes blockchain events from Redis queue and updates MongoDB
 */

import { popEvent, markProcessed, retryEvent, BlockchainEvent } from '@/lib/redis/queue';
import { parseMarketAccount, parsePositionAccount, calculateDerivedFields } from './account-parser';
import { createClientLogger } from '@/lib/logger';
import { MongoClient, Db, ObjectId } from 'mongodb';
import { broadcastMarketUpdate, broadcastPositionUpdate } from '../socket/socket-server';
import { getDatabaseConfig } from '@/lib/environment';

const logger = createClientLogger();

export class EventProcessor {
  private isRunning = false;
  private stopRequested = false;
  private mongoClient: MongoClient | null = null;
  private db: Db | null = null;

  /**
   * Start processing events
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Event processor already running');
      return;
    }

    this.isRunning = true;
    this.stopRequested = false;
    logger.info('🚀 Event processor started');

    // Ensure MongoDB connection using environment config
    const dbConfig = getDatabaseConfig();
    if (!dbConfig.uri) {
      throw new Error('MONGODB_URI not configured');
    }

    this.mongoClient = new MongoClient(dbConfig.uri);
    await this.mongoClient.connect();
    this.db = this.mongoClient.db(dbConfig.name);
    logger.info('✅ Event processor connected to MongoDB', { database: dbConfig.name });

    // Main processing loop
    while (!this.stopRequested) {
      try {
        // Pop event from queue (blocks for 5 seconds if empty)
        const event = await popEvent(5);

        if (!event) {
          // No events, continue loop
          continue;
        }

        logger.info(`📋 Processing event: ${event.type} - ${event.address}`);

        // Process based on account type
        try {
          if (event.accountType === 'market') {
            await this.processMarketUpdate(event);
          } else if (event.accountType === 'position') {
            await this.processPositionUpdate(event);
          } else {
            logger.warn(`Unknown account type: ${event.accountType}`);
          }

          // Mark as processed
          await markProcessed(event.id);

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`Failed to process event ${event.id}:`, errorMessage);

          // Retry event
          await retryEvent(event, errorMessage);
        }

      } catch (error) {
        logger.error('Error in processing loop:', error);
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    this.isRunning = false;
    logger.info('⏹️  Event processor stopped');
  }

  /**
   * Stop processing events
   */
  stop(): void {
    logger.info('Stopping event processor...');
    this.stopRequested = true;
  }

  /**
   * Check if processor is running
   */
  isProcessorRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Process market account update
   */
  private async processMarketUpdate(event: BlockchainEvent): Promise<void> {
    // 1. Parse account data
    const marketData = parseMarketAccount(event.data);
    const derived = calculateDerivedFields(marketData);

    logger.info(`Market update: ${event.address.slice(0, 8)}... Resolution: ${marketData.resolution}`);

    // 2. Find market in database
    if (!this.db) {
      logger.error('Database not connected');
      return;
    }
    const market = await this.db.collection('predictionmarkets').findOne({
      marketAddress: event.address,
    });

    if (!market) {
      logger.warn(`Market not found in database: ${event.address}`);
      // Could create market here, but for now just skip
      return;
    }

    // 3. Prepare update data
    const updateData: any = {
      // Blockchain fields
      poolBalance: marketData.poolBalance,
      distributionPool: marketData.distributionPool,
      yesPool: marketData.yesPool,
      noPool: marketData.noPool,
      totalYesShares: marketData.totalYesShares,
      totalNoShares: marketData.totalNoShares,
      phase: marketData.phase,
      resolution: this.getResolutionString(marketData.resolution),

      // Derived fields
      poolProgressPercentage: derived.poolProgressPercentage,
      yesPercentage: derived.yesPercentage, // SOL-based
      sharesYesPercentage: derived.sharesYesPercentage, // Shares-based
      totalYesStake: derived.totalYesStake,
      totalNoStake: derived.totalNoStake,
      availableActions: derived.availableActions,

      // Token fields (save to pumpFunTokenAddress for consistency with schema)
      pumpFunTokenAddress: marketData.tokenMint,
      tokenMint: marketData.tokenMint, // Keep both for backwards compatibility
      platformTokensAllocated: marketData.platformTokensAllocated,
      platformTokensClaimed: marketData.platformTokensClaimed,
      yesVoterTokensAllocated: marketData.yesVoterTokensAllocated,

      // Sync metadata
      lastSyncedAt: new Date(),
      lastSlot: event.slot,
      syncStatus: 'synced',
    };

    // Check if resolved (update resolvedAt timestamp)
    if (marketData.resolution !== 0 && !market.resolvedAt) {
      updateData.resolvedAt = new Date();
      logger.info(`✅ Market resolved: ${this.getResolutionString(marketData.resolution)}`);
    }

    // Calculate stake-based percentages from participants (consistent with vote/complete API)
    try {
      const participants = await this.db.collection('predictionparticipants').find({
        marketId: market._id
      }).toArray();

      let totalYesStake = 0;
      let totalNoStake = 0;

      for (const participant of participants) {
        const yesShares = BigInt(participant.yesShares || '0');
        const noShares = BigInt(participant.noShares || '0');
        totalYesStake += Number(yesShares);
        totalNoStake += Number(noShares);
      }

      const totalStake = totalYesStake + totalNoStake;
      const stakeYesPercentage = totalStake > 0 ? Math.round((totalYesStake / totalStake) * 100) : 50;
      const stakeNoPercentage = totalStake > 0 ? Math.round((totalNoStake / totalStake) * 100) : 50;

      // Override pool-based percentage with stake-based percentage for consistency
      updateData.yesPercentage = stakeYesPercentage;
      updateData.noPercentage = stakeNoPercentage;
      updateData.totalYesStake = totalYesStake;
      updateData.totalNoStake = totalNoStake;

      logger.info('📊 Calculated stake-based percentages', {
        marketAddress: event.address.slice(0, 8) + '...',
        yesPercentage: stakeYesPercentage,
        noPercentage: stakeNoPercentage,
        totalYesStake,
        totalNoStake,
      });
    } catch (error) {
      logger.warn('Failed to calculate stake-based percentages, using pool-based', {
        error: error instanceof Error ? error.message : String(error)
      });
      // Keep pool-based percentages if calculation fails
    }

    // 4. Update MongoDB
    await this.db.collection('predictionmarkets').updateOne(
      { _id: market._id },
      {
        $set: updateData,
        $inc: { syncCount: 1 } // Track number of syncs
      }
    );

    // 5. Record time-series data
    await this.recordTimeSeries(market._id, marketData, derived);

    // 6. Calculate vote counts from MongoDB for broadcast
    let yesVoteCount = market.yesVotes || 0;
    let noVoteCount = market.noVotes || 0;

    try {
      // Import here to avoid circular dependency
      const { updateMarketVoteCounts } = await import('@/lib/vote-counts');
      const voteCounts = await updateMarketVoteCounts(market._id.toString());
      yesVoteCount = voteCounts.yesVoteCount;
      noVoteCount = voteCounts.noVoteCount;
    } catch (error) {
      logger.warn('Failed to calculate vote counts for broadcast (using cached values)', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // 7. Broadcast update to connected clients with AMM-based percentages (single source of truth)
    broadcastMarketUpdate(event.address, {
      marketAddress: event.address,
      poolProgressPercentage: derived.poolProgressPercentage,
      // Use sharesYesPercentage as primary field (from blockchain AMM) for consistency with APIs
      yesPercentage: derived.sharesYesPercentage, // AMM-based (blockchain source of truth)
      noPercentage: 100 - derived.sharesYesPercentage, // Calculated from AMM percentage
      sharesYesPercentage: derived.sharesYesPercentage, // Keep for backwards compatibility
      totalYesStake: updateData.totalYesStake, // Use recalculated stake totals
      totalNoStake: updateData.totalNoStake,
      yesVotes: yesVoteCount,
      noVotes: noVoteCount,
      availableActions: derived.availableActions,
      resolution: this.getResolutionString(marketData.resolution),
      phase: marketData.phase,
      pumpFunTokenAddress: marketData.tokenMint,
      tokenMint: marketData.tokenMint, // Keep for backwards compatibility
      lastSyncedAt: new Date(),
    });

    logger.info(`✅ Market updated: ${event.address.slice(0, 8)}...`, {
      yesVotes: yesVoteCount,
      noVotes: noVoteCount,
      totalYesStake: updateData.totalYesStake,
      totalNoStake: updateData.totalNoStake,
      yesPercentage: derived.sharesYesPercentage, // AMM-based (single source of truth)
      noPercentage: 100 - derived.sharesYesPercentage,
    });
  }

  /**
   * Process position account update
   */
  private async processPositionUpdate(event: BlockchainEvent): Promise<void> {
    // 1. Parse account data
    const positionData = parsePositionAccount(event.data);

    logger.info(`Position update: ${positionData.user.slice(0, 8)}... Market: ${positionData.market.slice(0, 8)}...`);

    // 2. Find market in database
    if (!this.db) {
      logger.error('Database not connected');
      return;
    }
    const market = await this.db.collection('predictionmarkets').findOne({
      marketAddress: positionData.market,
    });

    if (!market) {
      logger.warn(`Market not found for position: ${positionData.market}`);
      return;
    }

    // 3. Update or create participant record (blockchain is source of truth)
    // Check for discrepancies between optimistic MongoDB values and blockchain
    const existingParticipant = await this.db.collection('predictionparticipants').findOne({
      marketId: market._id,
      participantWallet: positionData.user,
    });

    if (existingParticipant) {
      const mongoYesShares = existingParticipant.yesShares || '0';
      const mongoNoShares = existingParticipant.noShares || '0';
      const blockchainYesShares = positionData.yesShares;
      const blockchainNoShares = positionData.noShares;

      // Log discrepancies (optimistic update vs blockchain reality)
      if (mongoYesShares !== blockchainYesShares || mongoNoShares !== blockchainNoShares) {
        logger.warn('⚠️  Reconciling participant data: MongoDB vs Blockchain mismatch', {
          user: positionData.user.slice(0, 8) + '...',
          market: positionData.market.slice(0, 8) + '...',
          mongoYesShares,
          blockchainYesShares,
          mongoNoShares,
          blockchainNoShares,
          difference: {
            yes: BigInt(blockchainYesShares) - BigInt(mongoYesShares),
            no: BigInt(blockchainNoShares) - BigInt(mongoNoShares),
          }
        });
      }
    }

    const updateResult = await this.db.collection('predictionparticipants').updateOne(
      {
        marketId: market._id,
        participantWallet: positionData.user,
      },
      {
        $set: {
          yesShares: positionData.yesShares, // Blockchain is source of truth
          noShares: positionData.noShares,   // Blockchain is source of truth
          totalInvested: positionData.totalInvested,
          claimed: positionData.claimed,
          positionPdaAddress: event.address,
          lastSyncedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        }
      },
      { upsert: true }
    );

    // 4. Update vote counts if this is a new voter
    let updatedMarket = market;
    if (updateResult.upsertedCount > 0) {
      // Determine vote type based on which shares are greater than 0
      const voteType = BigInt(positionData.yesShares) > BigInt(0) ? 'yes' : 'no';
      const incrementField = voteType === 'yes' ? 'yesVoteCount' : 'noVoteCount';

      await this.db.collection('predictionmarkets').updateOne(
        { _id: market._id },
        { $inc: { [incrementField]: 1 } }
      );

      logger.info(`📊 Incremented ${voteType} vote count for market ${market.marketAddress.slice(0, 8)}...`);

      // Fetch updated market with new vote counts for broadcast
      updatedMarket = await this.db.collection('predictionmarkets').findOne({
        _id: market._id,
      }) || market;

      // Broadcast market update with new vote counts
      broadcastMarketUpdate(positionData.market, {
        marketAddress: positionData.market,
        yesVoteCount: updatedMarket.yesVoteCount,
        noVoteCount: updatedMarket.noVoteCount,
        lastSyncedAt: new Date(),
      });
    }

    // 5. Broadcast position update to user
    broadcastPositionUpdate(positionData.user, positionData.market, {
      yesShares: positionData.yesShares,
      noShares: positionData.noShares,
      totalInvested: positionData.totalInvested,
      claimed: positionData.claimed,
      lastSyncedAt: new Date(),
    });

    logger.info(`✅ Position updated: ${event.address.slice(0, 8)}...`);
  }

  /**
   * Record time-series data for charts
   */
  private async recordTimeSeries(
    marketId: ObjectId,
    marketData: any,
    derived: any
  ): Promise<void> {
    try {
      if (!this.db) {
        logger.error('Database not connected');
        return;
      }

      const timeSeriesData = {
        marketId,
        timestamp: new Date(),
        slot: 0, // We'll set this if available

        // Price data (percentages)
        yesPrice: derived.yesPercentage,
        noPrice: 100 - derived.yesPercentage,

        // Volume data (SOL staked - already in SOL, not lamports)
        totalVolume: (derived.totalYesStake + derived.totalNoStake),
        yesVolume: derived.totalYesStake,
        noVolume: derived.totalNoStake,

        // Pool state
        yesPool: marketData.yesPool,
        noPool: marketData.noPool,
        poolBalance: marketData.poolBalance,

        // Share data
        totalYesShares: marketData.totalYesShares,
        totalNoShares: marketData.totalNoShares,
      };

      await this.db.collection('market_time_series').insertOne(timeSeriesData);

    } catch (error) {
      // Don't fail the whole update if time-series fails
      logger.error('Failed to record time-series data', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Convert resolution number to string
   */
  private getResolutionString(resolution: number): string {
    switch (resolution) {
      case 0: return 'Unresolved';
      case 1: return 'YesWins';
      case 2: return 'NoWins';
      case 3: return 'Refund';
      default: return 'Unknown';
    }
  }
}

// Singleton instance
let processorInstance: EventProcessor | null = null;

/**
 * Get event processor instance
 */
export function getEventProcessor(): EventProcessor {
  if (!processorInstance) {
    processorInstance = new EventProcessor();
  }
  return processorInstance;
}

/**
 * Start event processor
 */
export async function startEventProcessor(): Promise<void> {
  const processor = getEventProcessor();
  await processor.start();
}

/**
 * Stop event processor
 */
export function stopEventProcessor(): void {
  const processor = getEventProcessor();
  processor.stop();
}
