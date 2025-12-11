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

// Graceful shutdown
if (typeof process !== 'undefined') {
  process.on('SIGINT', async () => {
    await disconnectRedis();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await disconnectRedis();
    process.exit(0);
  });
}
