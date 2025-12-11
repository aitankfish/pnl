/**
 * Event Queue System using Redis
 * Buffers blockchain events for processing
 */

import { getRedisClient } from './client';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export type BlockchainEventType =
  | 'account_update'
  | 'market_created'
  | 'vote_placed'
  | 'market_resolved'
  | 'market_extended'
  | 'reward_claimed'
  | 'market_closed';

export interface BlockchainEvent {
  id: string; // Unique event ID
  type: BlockchainEventType;
  accountType: 'market' | 'position' | 'unknown';
  address: string; // Account address
  marketId?: string; // MongoDB market ID (if known)
  data: string; // Base64 encoded account data
  slot: number;
  timestamp: number;
  signature?: string; // Transaction signature (if available)
  processed: boolean;
  retryCount: number;
  error?: string;
}

const QUEUE_KEY = 'blockchain:events';
const PROCESSING_KEY = 'blockchain:processing';
const DLQ_KEY = 'blockchain:dlq'; // Dead letter queue for failed events
const MAX_RETRIES = 3;

/**
 * Push event to queue
 */
export async function pushEvent(event: Omit<BlockchainEvent, 'id' | 'processed' | 'retryCount'>): Promise<string> {
  const redis = getRedisClient();

  const eventId = `${event.address}:${event.slot}:${Date.now()}`;
  const fullEvent: BlockchainEvent = {
    ...event,
    id: eventId,
    processed: false,
    retryCount: 0,
  };

  await redis.lpush(QUEUE_KEY, JSON.stringify(fullEvent));

  logger.info(`📥 Event queued: ${event.type} for ${event.address}`);

  return eventId;
}

/**
 * Pop event from queue for processing
 * Uses BRPOP to block until event available
 * Default 30s timeout reduces Redis requests by 6x (was 5s)
 */
export async function popEvent(timeoutSeconds: number = 30): Promise<BlockchainEvent | null> {
  const redis = getRedisClient();

  const result = await redis.brpop(QUEUE_KEY, timeoutSeconds);

  if (!result) {
    return null; // Timeout, no events
  }

  const [, eventJson] = result;
  const event: BlockchainEvent = JSON.parse(eventJson);

  // Mark as processing
  await redis.setex(`${PROCESSING_KEY}:${event.id}`, 300, JSON.stringify(event)); // 5 min TTL

  return event;
}

/**
 * Mark event as processed
 */
export async function markProcessed(eventId: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(`${PROCESSING_KEY}:${eventId}`);
  logger.info(`✅ Event processed: ${eventId}`);
}

/**
 * Retry failed event
 */
export async function retryEvent(event: BlockchainEvent, error: string): Promise<void> {
  const redis = getRedisClient();

  event.retryCount += 1;
  event.error = error;

  if (event.retryCount >= MAX_RETRIES) {
    // Move to dead letter queue
    await redis.lpush(DLQ_KEY, JSON.stringify(event));
    await redis.del(`${PROCESSING_KEY}:${event.id}`);
    logger.error(`💀 Event failed after ${MAX_RETRIES} retries, moved to DLQ: ${event.id}`);
    return;
  }

  // Push back to queue for retry
  await redis.lpush(QUEUE_KEY, JSON.stringify(event));
  await redis.del(`${PROCESSING_KEY}:${event.id}`);
  logger.warn(`🔄 Event retry ${event.retryCount}/${MAX_RETRIES}: ${event.id}`);
}

/**
 * Get queue stats
 */
export async function getQueueStats(): Promise<{
  queueLength: number;
  processingCount: number;
  dlqLength: number;
}> {
  const redis = getRedisClient();

  const [queueLength, processingKeys, dlqLength] = await Promise.all([
    redis.llen(QUEUE_KEY),
    redis.keys(`${PROCESSING_KEY}:*`),
    redis.llen(DLQ_KEY),
  ]);

  return {
    queueLength,
    processingCount: processingKeys.length,
    dlqLength,
  };
}

/**
 * Get dead letter queue events (for debugging)
 */
export async function getDLQ(limit: number = 10): Promise<BlockchainEvent[]> {
  const redis = getRedisClient();
  const events = await redis.lrange(DLQ_KEY, 0, limit - 1);
  return events.map((e) => JSON.parse(e));
}

/**
 * Clear dead letter queue
 */
export async function clearDLQ(): Promise<number> {
  const redis = getRedisClient();
  const length = await redis.llen(DLQ_KEY);
  await redis.del(DLQ_KEY);
  logger.info(`🗑️  Cleared ${length} events from DLQ`);
  return length;
}

/**
 * Recover stuck events from processing
 * (events that were being processed but worker crashed)
 */
export async function recoverStuckEvents(): Promise<number> {
  const redis = getRedisClient();

  const processingKeys = await redis.keys(`${PROCESSING_KEY}:*`);
  let recovered = 0;

  for (const key of processingKeys) {
    const ttl = await redis.ttl(key);

    // If TTL is low (< 60s), the event might be stuck
    if (ttl < 60 && ttl > 0) {
      const eventJson = await redis.get(key);
      if (eventJson) {
        const event: BlockchainEvent = JSON.parse(eventJson);
        await redis.lpush(QUEUE_KEY, eventJson);
        await redis.del(key);
        recovered++;
        logger.warn(`🔧 Recovered stuck event: ${event.id}`);
      }
    }
  }

  if (recovered > 0) {
    logger.info(`🔧 Recovered ${recovered} stuck events`);
  }

  return recovered;
}
