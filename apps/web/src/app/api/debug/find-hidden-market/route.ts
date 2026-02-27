/**
 * Debug endpoint to find the hidden market
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionMarket } from '@/lib/mongodb';

export async function GET(_request: NextRequest) {
  try {
    await connectToDatabase();

    // Fetch ALL markets
    const allMarkets = await PredictionMarket.find({})
      .populate('projectId')
      .select('marketAddress marketState resolution phase poolProgressPercentage expiryTime pumpFunTokenAddress projectId')
      .lean();

    // Fetch only ACTIVE markets (what browse page shows)
    const activeMarkets = await PredictionMarket.find({ marketState: 0 })
      .populate('projectId')
      .select('marketAddress marketState resolution phase poolProgressPercentage expiryTime pumpFunTokenAddress projectId')
      .lean();

    const allMarketIds = allMarkets.map((m: any) => m._id.toString());
    const activeMarketIds = activeMarkets.map((m: any) => m._id.toString());
    const hiddenMarketIds = allMarketIds.filter(id => !activeMarketIds.includes(id));

    const hiddenMarkets = allMarkets.filter((m: any) =>
      hiddenMarketIds.includes(m._id.toString())
    );

    const formatMarket = (m: any) => ({
      _id: m._id.toString(),
      name: m.projectId?.name || 'Unknown',
      marketAddress: m.marketAddress,
      marketState: m.marketState,
      marketStateLabel: m.marketState === 0 ? 'Active (0)' : m.marketState === 1 ? 'Resolved (1)' : 'Canceled (2)',
      resolution: m.resolution || 'Unresolved',
      phase: m.phase,
      phaseLabel: m.phase === 0 ? 'Prediction' : m.phase === 1 ? 'Funding' : 'Unknown',
      poolProgressPercentage: m.poolProgressPercentage,
      expiryTime: m.expiryTime,
      isExpired: new Date(m.expiryTime) < new Date(),
      pumpFunTokenAddress: m.pumpFunTokenAddress,
    });

    return NextResponse.json({
      success: true,
      summary: {
        totalMarkets: allMarkets.length,
        activeMarkets: activeMarkets.length,
        hiddenMarkets: hiddenMarkets.length,
      },
      allMarkets: allMarkets.map(formatMarket),
      activeMarkets: activeMarkets.map(formatMarket),
      hiddenMarkets: hiddenMarkets.map(formatMarket),
      explanation: 'Browse page only shows markets with marketState=0 (Active). Hidden markets have marketState=1 (Resolved) or marketState=2 (Canceled).'
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
