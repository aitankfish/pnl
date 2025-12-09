/**
 * Debug API endpoint to list ALL markets regardless of marketState
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionMarket } from '@/lib/mongodb';

export async function GET(_request: NextRequest) {
  try {
    await connectToDatabase();

    // Fetch ALL markets (no marketState filter)
    const markets = await PredictionMarket.find({})
      .populate('projectId')
      .sort({ createdAt: -1 })
      .lean();

    const formattedMarkets = markets.map((market: any) => {
      const project = market.projectId;

      return {
        name: project?.name || 'Unknown',
        marketAddress: market.marketAddress,
        marketState: market.marketState,
        marketStateLabel:
          market.marketState === 0 ? 'Active (0)' :
          market.marketState === 1 ? 'Resolved (1)' :
          market.marketState === 2 ? 'Canceled (2)' :
          `Unknown (${market.marketState})`,
        resolution: market.resolution || 'Unresolved',
        phase: market.phase,
        phaseLabel: market.phase === 0 ? 'Prediction' : market.phase === 1 ? 'Funding' : 'Unknown',
        poolProgressPercentage: market.poolProgressPercentage,
        expiryTime: market.expiryTime,
        pumpFunTokenAddress: market.pumpFunTokenAddress,
        createdAt: market.createdAt,
      };
    });

    return NextResponse.json(
      {
        success: true,
        total: formattedMarkets.length,
        markets: formattedMarkets,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Failed to fetch all markets:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch markets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
