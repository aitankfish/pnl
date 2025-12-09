/**
 * API endpoint for fetching markets with unclaimed platform tokens
 *
 * This endpoint returns all markets that have:
 * - A token mint (token has been launched)
 * - Platform tokens allocated but not yet claimed
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionMarket } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export async function GET(request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectToDatabase();

    // Find markets with tokens launched but platform tokens not claimed
    const markets = await PredictionMarket.find({
      tokenMint: { $exists: true, $ne: null },
      platformTokensClaimed: false,
    })
      .select('marketName marketAddress tokenMint pumpFunTokenAddress platformTokensAllocated platformTokensClaimed')
      .lean();

    logger.info(`Found ${markets.length} markets with unclaimed platform tokens`);

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
