/**
 * Redis Client for Upstash
 * Handles connection and provides singleton instance
 */

import Redis from 'ioredis';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    logger.info('Connecting to Redis (Upstash)...');

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        // Stop retrying after 10 attempts (was infinite, causing 80+ retry spam)
        if (times > 10) {
          logger.error(`❌ Redis connection failed after ${times} retries, giving up`);
          return null; // Stop retrying
        }

        // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms, 2000ms (capped)
        const delay = Math.min(times * 100, 2000);
        logger.warn(`Redis connection retry ${times}, waiting ${delay}ms`);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          logger.error('Redis READONLY error, reconnecting...');
          return true; // Reconnect
        }
        return false;
      },
      tls: {
        // Upstash requires TLS
        rejectUnauthorized: false,
      },
    });

    redisClient.on('connect', () => {
      logger.info('✅ Redis connected successfully');
    });

    redisClient.on('error', (err) => {
      logger.error('❌ Redis error:', { message: err.message, stack: err.stack });
    });

    redisClient.on('close', () => {
      logger.warn('⚠️  Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      logger.info('🔄 Redis reconnecting...');
    });
  }

  return redisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    logger.info('Disconnecting Redis...');
    await redisClient.quit();
    redisClient = null;
  }
}

// ========================================
// Redis Pub/Sub for Cross-Process Communication
// ========================================

// Separate Redis client for pub/sub (ioredis recommends separate clients)
let pubClient: Redis | null = null;
let subClient: Redis | null = null;

export function getRedisPubClient(): Redis {
  if (!pubClient) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    pubClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      tls: { rejectUnauthorized: false },
    });
    pubClient.on('error', (err) => {
      logger.error('Redis pub client error:', { message: err.message });
    });
  }
  return pubClient;
}

export function getRedisSubClient(): Redis {
  if (!subClient) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    subClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      tls: { rejectUnauthorized: false },
    });
    subClient.on('error', (err) => {
      logger.error('Redis sub client error:', { message: err.message });
    });
  }
  return subClient;
}

// Chat message channels
export const REDIS_CHANNELS = {
  CHAT_MESSAGE: 'chat:message',
  CHAT_TYPING: 'chat:typing',
  CHAT_DELETED: 'chat:deleted',
  CHAT_PINNED: 'chat:pinned',
};

// Publish chat message via Redis
export async function publishChatMessage(marketAddress: string, message: any): Promise<void> {
  try {
    const pub = getRedisPubClient();
    await pub.publish(REDIS_CHANNELS.CHAT_MESSAGE, JSON.stringify({
      marketAddress,
      message,
      timestamp: Date.now(),
    }));
  } catch (error) {
    logger.error('Failed to publish chat message:', { error });
  }
}

// Graceful shutdown
if (typeof process !== 'undefined') {
  const cleanup = async () => {
    await disconnectRedis();
    if (pubClient) {
      await pubClient.quit();
      pubClient = null;
    }
    if (subClient) {
      await subClient.quit();
      subClient = null;
    }
  };

  process.on('SIGINT', async () => {
    await cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await cleanup();
    process.exit(0);
  });
}
