/**
 * Admin API endpoint to fix marketState for resolved markets
 *
 * Call this endpoint to update marketState=1 for all markets that
 * have resolution !== 'Unresolved' but marketState is still 0
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionMarket } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    logger.info('🔧 Starting marketState fix...');

    // Connect to MongoDB
    await connectToDatabase();

    // Find all markets that are resolved but still have marketState = 0
    // OR have a token launched but still marketState = 0
    const brokenMarkets = await PredictionMarket.find({
      marketState: 0, // Active state
      $or: [
        { resolution: { $ne: 'Unresolved' } }, // Resolved but still active
        {
          pumpFunTokenAddress: {
            $exists: true,
            $nin: [null, '']
          }
        }, // Has token but still active
        {
          tokenMint: {
            $exists: true,
            $nin: [null, '']
          }
        } // Has token but still active
      ]
    });

    logger.info(`Found ${brokenMarkets.length} markets with incorrect marketState`);

    if (brokenMarkets.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No markets to fix',
        fixed: 0
      });
    }

    const results = [];

    // Update each market
    for (const market of brokenMarkets) {
      logger.info(`Fixing market: ${market.marketName}`, {
        address: market.marketAddress,
        resolution: market.resolution,
        currentState: market.marketState
      });

      await PredictionMarket.updateOne(
        { _id: market._id },
        {
          $set: {
            marketState: 1, // Set to Resolved
          }
        }
      );

      results.push({
        name: market.marketName,
        address: market.marketAddress,
        resolution: market.resolution,
        fixed: true
      });
    }

    logger.info(`✅ Fixed ${brokenMarkets.length} markets!`);

    return NextResponse.json({
      success: true,
      message: `Fixed ${brokenMarkets.length} markets`,
      fixed: brokenMarkets.length,
      markets: results
    });

  } catch (error) {
    logger.error('Failed to fix market states:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fix market states',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Admin endpoint to fix market states',
    usage: 'POST to this endpoint to fix all resolved markets with incorrect marketState',
  });
}
