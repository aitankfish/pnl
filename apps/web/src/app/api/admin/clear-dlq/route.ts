/**
 * Admin API endpoint to clear the dead letter queue
 *
 * DELETE /api/admin/clear-dlq
 */

import { NextResponse } from 'next/server';
import { clearDLQ, getDLQ } from '@/lib/redis/queue';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export async function DELETE() {
  try {
    // Get DLQ events before clearing (for logging)
    const events = await getDLQ(10);

    // Clear the DLQ
    const clearedCount = await clearDLQ();

    logger.info('Dead letter queue cleared', {
      clearedCount,
      sample: events.slice(0, 3)
    });

    return NextResponse.json({
      success: true,
      message: `Cleared ${clearedCount} events from dead letter queue`,
      clearedCount,
    });
  } catch (error) {
    logger.error('Failed to clear DLQ:', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear dead letter queue',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const events = await getDLQ(10);

    return NextResponse.json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    logger.error('Failed to fetch DLQ:', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch dead letter queue',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
