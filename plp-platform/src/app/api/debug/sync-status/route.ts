/**
 * Debug endpoint to monitor blockchain sync status in real-time
 * Shows: sync status, queue stats, DLQ contents, recent events
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQueueStats, getDLQ } from '@/lib/redis/queue';
import { getRedisClient } from '@/lib/redis/client';
import { createClientLogger } from '@/lib/logger';

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic';

const logger = createClientLogger();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const showDLQ = searchParams.get('dlq') === 'true';
    const marketFilter = searchParams.get('market'); // Filter by market address

    // Get queue stats
    const queueStats = await getQueueStats();

    // Get DLQ contents if requested
    let dlqEvents: any[] = [];
    if (showDLQ && queueStats.dlqLength > 0) {
      dlqEvents = await getDLQ(20); // Get up to 20 failed events
    }

    // Get recent processed events from Redis (if we track them)
    const redis = getRedisClient();

    // Get currently processing events
    const processingKeys = await redis.keys('blockchain:processing:*');
    const processingEvents = [];
    for (const key of processingKeys.slice(0, 10)) {
      const eventJson = await redis.get(key);
      if (eventJson) {
        const event = JSON.parse(eventJson);
        // Filter by market if specified
        if (!marketFilter || event.address?.includes(marketFilter)) {
          processingEvents.push({
            id: event.id,
            type: event.type,
            accountType: event.accountType,
            address: event.address,
            slot: event.slot,
            timestamp: new Date(event.timestamp).toISOString(),
            retryCount: event.retryCount,
          });
        }
      }
    }

    // Filter DLQ by market if specified
    if (marketFilter && dlqEvents.length > 0) {
      dlqEvents = dlqEvents.filter(e => e.address?.includes(marketFilter));
    }

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      queue: {
        pending: queueStats.queueLength,
        processing: queueStats.processingCount,
        failed: queueStats.dlqLength,
        healthy: queueStats.queueLength < 50 && queueStats.dlqLength === 0,
      },
      processingEvents: processingEvents.length > 0 ? processingEvents : undefined,
      dlq: showDLQ && dlqEvents.length > 0 ? dlqEvents.map(e => ({
        id: e.id,
        type: e.type,
        accountType: e.accountType,
        address: e.address,
        error: e.error,
        retryCount: e.retryCount,
        timestamp: new Date(e.timestamp).toISOString(),
      })) : undefined,
      hints: {
        watchCommand: 'watch -n 2 "curl -s https://pnl.market/api/debug/sync-status | jq"',
        showDLQ: '/api/debug/sync-status?dlq=true',
        filterByMarket: '/api/debug/sync-status?market=<first-8-chars>',
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Failed to get sync status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
