/**
 * API endpoint for fetching markets with platform tokens
 *
 * This endpoint returns all markets that have:
 * - A token mint (token has been launched)
 * - Platform tokens allocated (both claimed and unclaimed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionMarket } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

const logger = createClientLogger();

export async function GET(request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectToDatabase();

    // Find all markets with tokens launched (both claimed and unclaimed)
    const markets = await PredictionMarket.find({
      tokenMint: { $exists: true, $ne: null },
    })
      .select('marketName marketAddress tokenMint pumpFunTokenAddress platformTokensAllocated platformTokensClaimed')
      .sort({ platformTokensClaimed: 1, createdAt: -1 }) // Unclaimed first, then by newest
      .lean();

    logger.info(`Found ${markets.length} markets with platform tokens (${markets.filter(m => !m.platformTokensClaimed).length} unclaimed)`);

    return NextResponse.json({
      success: true,
      data: markets,
    });

  } catch (error) {
    logger.error('Failed to fetch markets with unclaimed platform tokens:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch markets with unclaimed platform tokens',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
