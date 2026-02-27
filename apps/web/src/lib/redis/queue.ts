/**
 * Event Queue System using Redis
 * Buffers blockchain events for processing
 */

import { getRedisClient, prefixKey } from './client';
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

// Redis keys (prefixed with environment to prevent dev/prod collisions)
const QUEUE_KEY = prefixKey('blockchain:events');
const PROCESSING_KEY = prefixKey('blockchain:processing');
const DLQ_KEY = prefixKey('blockchain:dlq'); // Dead letter queue for failed events
const DEDUP_KEY = prefixKey('blockchain:dedup'); // Deduplication set
const MAX_RETRIES = 3;
const DEDUP_TTL_SECONDS = 10; // Dedupe events within 10 second window

/**
 * Push event to queue with deduplication
 * Uses address + slot as dedup key to prevent duplicate events from multiple subscriptions
 */
export async function pushEvent(event: Omit<BlockchainEvent, 'id' | 'processed' | 'retryCount'>): Promise<string | null> {
  const redis = getRedisClient();

  // Create dedup key from address + slot (same account update at same slot = duplicate)
  const dedupKey = `${DEDUP_KEY}:${event.address}:${event.slot}`;

  // Try to set dedup key with NX (only if not exists) and TTL
  const wasSet = await redis.set(dedupKey, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');

  if (!wasSet) {
    // Event already processed recently, skip
    logger.debug(`⏭️  Skipping duplicate event: ${event.type} for ${event.address.slice(0, 8)}... slot ${event.slot}`);
    return null;
  }

  const eventId = `${event.address}:${event.slot}:${Date.now()}`;
  const fullEvent: BlockchainEvent = {
    ...event,
    id: eventId,
    processed: false,
    retryCount: 0,
  };

  await redis.lpush(QUEUE_KEY, JSON.stringify(fullEvent));

  logger.info(`📥 Event queued: ${event.type} for ${event.address.slice(0, 8)}...`);

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
 * Count keys matching pattern using SCAN (non-blocking, O(1) per iteration)
 * Replaces `keys` command which is O(n) and blocks Redis
 */
async function countKeysWithScan(pattern: string): Promise<number> {
  const redis = getRedisClient();
  let cursor = '0';
  let count = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    count += keys.length;
  } while (cursor !== '0');

  return count;
}

/**
 * Get queue stats
 */
export async function getQueueStats(): Promise<{
  queueLength: number;
  processingCount: number;
  dlqLength: number;
  dedupKeysActive: number;
}> {
  const redis = getRedisClient();

  const [queueLength, processingCount, dlqLength, dedupKeysActive] = await Promise.all([
    redis.llen(QUEUE_KEY),
    countKeysWithScan(`${PROCESSING_KEY}:*`),
    redis.llen(DLQ_KEY),
    countKeysWithScan(`${DEDUP_KEY}:*`),
  ]);

  return {
    queueLength,
    processingCount,
    dlqLength,
    dedupKeysActive,
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
 * Get keys matching pattern using SCAN (non-blocking)
 */
async function getKeysWithScan(pattern: string): Promise<string[]> {
  const redis = getRedisClient();
  let cursor = '0';
  const keys: string[] = [];

  do {
    const [nextCursor, foundKeys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...foundKeys);
  } while (cursor !== '0');

  return keys;
}

/**
 * Recover stuck events from processing
 * (events that were being processed but worker crashed)
 */
export async function recoverStuckEvents(): Promise<number> {
  const redis = getRedisClient();

  const processingKeys = await getKeysWithScan(`${PROCESSING_KEY}:*`);
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
