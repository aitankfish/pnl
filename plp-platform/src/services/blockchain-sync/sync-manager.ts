/**
 * Sync Manager
 * Orchestrates Helius WebSocket client and Event Processor
 */

import { HeliusClient } from './helius-client';
import { getEventProcessor } from './event-processor';
import { createClientLogger } from '@/lib/logger';
import { getQueueStats } from '@/lib/redis/queue';
import { getRedisClient, prefixKey } from '@/lib/redis/client';
import { connectToDatabase, getDatabase } from '@/lib/database';
import { PublicKey, Connection } from '@solana/web3.js';
import { parseMarketAccount, calculateDerivedFields } from './account-parser';

// Redis key for storing sync status (prefixed with environment)
const SYNC_STATUS_KEY = prefixKey('sync:status');

const logger = createClientLogger();

export class SyncManager {
  private heliusClient: HeliusClient | null = null;
  private eventProcessor = getEventProcessor();
  private isRunning = false;
  private network: 'devnet' | 'mainnet';
  private programId: string;
  private statsInterval: NodeJS.Timeout | null = null;

  constructor(network: 'devnet' | 'mainnet', programId: string) {
    this.network = network;
    this.programId = programId;
  }

  /**
   * Start the sync system
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Sync manager already running');
      return;
    }

    logger.info('🚀 Starting blockchain sync manager...');
    this.isRunning = true;

    try {
      // 1. Initialize Helius WebSocket client
      logger.info('📡 Initializing Helius WebSocket...');
      this.heliusClient = new HeliusClient(this.network, this.programId);
      await this.heliusClient.connect();

      // 2. Subscribe to program (all markets and positions)
      logger.info('📡 Subscribing to program accounts...');
      await this.heliusClient.subscribeToProgram();

      // 2b. Subscribe to individual markets as fallback (programSubscribe may not work reliably)
      await this.subscribeToExistingMarkets();

      // 2c. Subscribe to existing Position accounts (programSubscribe may not catch Position updates reliably)
      await this.subscribeToExistingPositions();

      // 2d. Perform initial state sync (fetch current on-chain state for all markets)
      logger.info('🔄 Performing initial state sync...');
      await this.performInitialSync();

      // 3. Start event processor
      logger.info('⚙️  Starting event processor...');
      // Run in background
      this.eventProcessor.start().catch(error => {
        logger.error('Event processor failed:', error);
      });

      // 4. Start stats monitoring
      this.startStatsMonitoring();

      logger.info('✅ Blockchain sync manager started successfully!');
      logger.info(`   Network: ${this.network}`);
      logger.info(`   Program: ${this.programId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to start sync manager:', { error: errorMessage });
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop the sync system
   */
  async stop(): Promise<void> {
    logger.info('⏹️  Stopping blockchain sync manager...');

    // Stop stats monitoring
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    // Stop event processor
    this.eventProcessor.stop();

    // Disconnect Helius
    if (this.heliusClient) {
      this.heliusClient.disconnect();
      this.heliusClient = null;
    }

    this.isRunning = false;
    logger.info('✅ Blockchain sync manager stopped');
  }

  /**
   * Subscribe to all existing markets in database
   */
  private async subscribeToExistingMarkets(): Promise<void> {
    try {
      await connectToDatabase();
      const db = getDatabase();

      const markets = await db.collection('predictionmarkets')
        .find({}, { projection: { marketAddress: 1 } })
        .toArray();

      logger.info(`📡 Subscribing to ${markets.length} individual market accounts...`);

      for (const market of markets) {
        if (market.marketAddress) {
          await this.subscribeToMarket(market.marketAddress);
        }
      }

      logger.info(`✅ Subscribed to ${markets.length} market accounts`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to subscribe to existing markets:', { error: errorMessage });
      // Don't throw - this is a fallback, not critical
    }
  }

  /**
   * Subscribe to all existing Position accounts in database
   */
  private async subscribeToExistingPositions(): Promise<void> {
    try {
      await connectToDatabase();
      const db = getDatabase();

      // Get all participants with their Position PDAs
      const participants = await db.collection('predictionparticipants')
        .find(
          { positionPdaAddress: { $exists: true, $ne: null } },
          { projection: { positionPdaAddress: 1 } }
        )
        .toArray();

      logger.info(`📡 Subscribing to ${participants.length} individual Position accounts...`);

      for (const participant of participants) {
        if (participant.positionPdaAddress && this.heliusClient) {
          try {
            await this.heliusClient.subscribeToAccount(participant.positionPdaAddress);
          } catch (error) {
            // Continue even if one subscription fails
            logger.warn(`Failed to subscribe to position ${participant.positionPdaAddress.slice(0, 8)}...`);
          }
        }
      }

      logger.info(`✅ Subscribed to ${participants.length} Position accounts`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to subscribe to existing positions:', { error: errorMessage });
      // Don't throw - this is a fallback, not critical
    }
  }

  /**
   * Perform initial sync of all existing markets' current on-chain state
   * This ensures MongoDB has up-to-date data even for markets that were resolved while sync was offline
   */
  private async performInitialSync(): Promise<void> {
    try {
      logger.info('🔄 Starting initial state sync for all markets...');

      await connectToDatabase();
      const db = getDatabase();

      const markets = await db.collection('predictionmarkets')
        .find({}, { projection: { marketAddress: 1 } })
        .toArray();

      logger.info(`📥 Fetching current state for ${markets.length} markets...`);

      // Get RPC endpoint - use HELIUS_API_KEY for backend (not domain-restricted)
      const heliusApiKey = process.env.HELIUS_API_KEY;
      if (!heliusApiKey) {
        logger.error('HELIUS_API_KEY not configured');
        return;
      }

      const rpcEndpoint = this.network === 'devnet'
        ? `https://devnet.helius-rpc.com/?api-key=${heliusApiKey}`
        : `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;

      // Configure connection with better timeout and retry settings
      const connection = new Connection(rpcEndpoint, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000, // 60 second timeout
      });

      let syncedCount = 0;
      let errorCount = 0;

      // Process markets in smaller batches to avoid rate limiting
      const BATCH_SIZE = 5; // Reduced from 10 to avoid rate limits
      const validMarkets = markets.filter(m => m.marketAddress);

      for (let i = 0; i < validMarkets.length; i += BATCH_SIZE) {
        const batch = validMarkets.slice(i, i + BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(async (market) => {
            // Fetch account info from blockchain
            const marketPubkey = new PublicKey(market.marketAddress);
            const accountInfo = await connection.getAccountInfo(marketPubkey);

            if (!accountInfo || !accountInfo.data) {
              logger.warn(`Market account not found on-chain: ${market.marketAddress}`);
              return { success: false, notFound: true };
            }

            // Parse market data
            const base64Data = accountInfo.data.toString('base64');
            const marketData = parseMarketAccount(base64Data);
            const derived = calculateDerivedFields(marketData);

            // Prepare update
            const updateData: any = {
              poolBalance: marketData.poolBalance,
              distributionPool: marketData.distributionPool,
              yesPool: marketData.yesPool,
              noPool: marketData.noPool,
              totalYesShares: marketData.totalYesShares,
              totalNoShares: marketData.totalNoShares,
              phase: marketData.phase,
              resolution: this.getResolutionString(marketData.resolution),
              poolProgressPercentage: derived.poolProgressPercentage,
              yesPercentage: derived.yesPercentage,
              sharesYesPercentage: derived.sharesYesPercentage,
              totalYesStake: derived.totalYesStake,
              totalNoStake: derived.totalNoStake,
              availableActions: derived.availableActions,
              tokenMint: marketData.tokenMint,
              pumpFunTokenAddress: marketData.tokenMint,
              platformTokensAllocated: marketData.platformTokensAllocated,
              platformTokensClaimed: marketData.platformTokensClaimed,
              yesVoterTokensAllocated: marketData.yesVoterTokensAllocated,
              lastSyncedAt: new Date(),
              syncStatus: 'synced',
            };

            // Check if resolved
            const currentMarket = await db.collection('predictionmarkets').findOne({ _id: market._id });
            if (marketData.resolution !== 0 && currentMarket && !currentMarket.resolvedAt) {
              updateData.resolvedAt = new Date();
              updateData.marketState = 1;
              logger.info(`🎯 Market resolved during initial sync: ${market.marketAddress.slice(0, 8)}... -> ${this.getResolutionString(marketData.resolution)}`);
            } else if (marketData.resolution !== 0) {
              updateData.marketState = 1;
            }

            // Update MongoDB
            await db.collection('predictionmarkets').updateOne(
              { _id: market._id },
              { $set: updateData }
            );

            return { success: true };
          })
        );

        // Count results
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.success) {
            syncedCount++;
          } else if (result.status === 'rejected') {
            errorCount++;
            logger.error('Failed to sync market in batch:', { error: result.reason?.message || String(result.reason) });
          }
        }

        // Log progress after each batch
        logger.info(`📊 Initial sync progress: ${syncedCount}/${validMarkets.length} markets synced`);

        // Add delay between batches to avoid rate limiting (500ms)
        if (i + BATCH_SIZE < validMarkets.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      logger.info(`✅ Initial sync complete: ${syncedCount} markets synced, ${errorCount} errors`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to perform initial sync:', { error: errorMessage });
      // Don't throw - initial sync failure shouldn't prevent the service from starting
    }
  }

  /**
   * Convert resolution number to string (helper for initial sync)
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

  /**
   * Subscribe to a specific market
   */
  async subscribeToMarket(marketAddress: string): Promise<void> {
    if (!this.heliusClient) {
      logger.warn('Cannot subscribe to market - Helius client not initialized (sync manager not started)', {
        marketAddress: marketAddress.slice(0, 8) + '...'
      });
      return; // Gracefully return instead of throwing
    }

    if (!this.isRunning) {
      logger.warn('Cannot subscribe to market - Sync manager not running', {
        marketAddress: marketAddress.slice(0, 8) + '...'
      });
      return;
    }

    await this.heliusClient.subscribeToAccount(marketAddress);
    logger.info('Market subscribed to sync manager', {
      marketAddress: marketAddress.slice(0, 8) + '...'
    });
  }

  /**
   * Unsubscribe from a specific market
   */
  async unsubscribeFromMarket(marketAddress: string): Promise<void> {
    if (!this.heliusClient) {
      throw new Error('Helius client not initialized');
    }

    await this.heliusClient.unsubscribeFromAccount(marketAddress);
  }

  /**
   * Save sync status to Redis (shared across processes)
   */
  private async saveSyncStatus(): Promise<void> {
    try {
      const redis = getRedisClient();
      const status = {
        isRunning: this.isRunning,
        heliusConnected: this.heliusClient?.isConnected() || false,
        processorRunning: this.eventProcessor.isProcessorRunning(),
        subscriptionCount: this.heliusClient?.getSubscriptionCount() || 0,
        lastUpdated: Date.now(),
      };
      await redis.set(SYNC_STATUS_KEY, JSON.stringify(status), 'EX', 120); // Expire in 2 minutes
      logger.debug('Saved sync status to Redis');
    } catch (error) {
      logger.error('Failed to save sync status to Redis:', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get sync status (from Redis for cross-process access, or local if available)
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    heliusConnected: boolean;
    processorRunning: boolean;
    subscriptionCount: number;
    queueStats: any;
  }> {
    const queueStats = await getQueueStats();

    // If this instance is running, return local status
    if (this.isRunning) {
      return {
        isRunning: this.isRunning,
        heliusConnected: this.heliusClient?.isConnected() || false,
        processorRunning: this.eventProcessor.isProcessorRunning(),
        subscriptionCount: this.heliusClient?.getSubscriptionCount() || 0,
        queueStats,
      };
    }

    // Otherwise, try to get status from Redis (another process may be running sync)
    try {
      const redis = getRedisClient();
      const statusJson = await redis.get(SYNC_STATUS_KEY);
      if (statusJson) {
        const status = JSON.parse(statusJson);
        // Check if status is recent (within last 2 minutes)
        if (Date.now() - status.lastUpdated < 120000) {
          return {
            isRunning: status.isRunning,
            heliusConnected: status.heliusConnected,
            processorRunning: status.processorRunning,
            subscriptionCount: status.subscriptionCount,
            queueStats,
          };
        }
      }
    } catch (error) {
      logger.warn('Failed to get sync status from Redis:', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Fallback to local status (not running)
    return {
      isRunning: false,
      heliusConnected: false,
      processorRunning: false,
      subscriptionCount: 0,
      queueStats,
    };
  }

  /**
   * Start monitoring stats (logs every 30 seconds)
   */
  private startStatsMonitoring(): void {
    // Save initial status to Redis
    this.saveSyncStatus();

    this.statsInterval = setInterval(async () => {
      try {
        // Save status to Redis for cross-process access
        await this.saveSyncStatus();

        const status = await this.getStatus();

        logger.info('📊 Sync Stats:', {
          heliusConnected: status.heliusConnected,
          processorRunning: status.processorRunning,
          subscriptions: status.subscriptionCount,
          queueLength: status.queueStats.queueLength,
          processing: status.queueStats.processingCount,
          dlq: status.queueStats.dlqLength,
        });

        // Alert if queue is building up
        if (status.queueStats.queueLength > 100) {
          logger.warn(`⚠️  Queue backlog: ${status.queueStats.queueLength} events`);
        }

        // Alert if DLQ has failed events
        if (status.queueStats.dlqLength > 0) {
          logger.error(`❌ Dead letter queue has ${status.queueStats.dlqLength} failed events`);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error fetching stats:', { error: errorMessage });
      }
    }, 30000); // Every 30 seconds
  }
}

// Singleton instance
let syncManagerInstance: SyncManager | null = null;

/**
 * Get sync manager instance
 */
export function getSyncManager(network?: 'devnet' | 'mainnet', programId?: string): SyncManager {
  if (!syncManagerInstance) {
    // Get network and normalize 'mainnet-beta' to 'mainnet'
    const networkEnv = network || process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
    const net = (networkEnv === 'mainnet-beta' ? 'mainnet' : networkEnv) as 'devnet' | 'mainnet';

    // Select correct program ID based on network
    const pid = programId || (
      net === 'mainnet'
        ? process.env.NEXT_PUBLIC_PLP_PROGRAM_ID_MAINNET
        : process.env.NEXT_PUBLIC_PLP_PROGRAM_ID_DEVNET
    ) || '';

    if (!pid) {
      throw new Error('Program ID not found in environment');
    }

    syncManagerInstance = new SyncManager(net, pid);
  }
  return syncManagerInstance;
}

/**
 * Start blockchain sync
 */
export async function startBlockchainSync(): Promise<void> {
  const manager = getSyncManager();
  await manager.start();
}

/**
 * Stop blockchain sync
 */
export async function stopBlockchainSync(): Promise<void> {
  if (syncManagerInstance) {
    await syncManagerInstance.stop();
  }
}
