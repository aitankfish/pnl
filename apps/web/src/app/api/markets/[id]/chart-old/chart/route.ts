/**
 * Market Chart Data API
 * Returns time-series data for market price charts
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getDatabase } from '@/lib/database';
import { COLLECTIONS } from '@/lib/database/models';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

interface ChartParams {
  params: {
    marketAddress: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: ChartParams
) {
  try {
    const { marketAddress } = params;
    const { searchParams } = new URL(request.url);

    // Get query parameters
    const timeframe = searchParams.get('timeframe') || '24h'; // 1h, 24h, 7d, 30d, all
    const interval = searchParams.get('interval') || 'auto'; // 1m, 5m, 15m, 1h, auto

    await connectToDatabase();
    const db = await getDatabase();

    // Find market
    const market = await db.collection(COLLECTIONS.PREDICTION_MARKETS).findOne({
      marketAddress,
    });

    if (!market) {
      return NextResponse.json(
        { error: 'Market not found' },
        { status: 404 }
      );
    }

    // Calculate time range
    const now = new Date();
    let startTime: Date;

    switch (timeframe) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startTime = market.createdAt;
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Determine sample interval based on timeframe
    let sampleInterval: number;
    if (interval === 'auto') {
      if (timeframe === '1h') {
        sampleInterval = 60 * 1000; // 1 minute
      } else if (timeframe === '24h') {
        sampleInterval = 5 * 60 * 1000; // 5 minutes
      } else if (timeframe === '7d') {
        sampleInterval = 30 * 60 * 1000; // 30 minutes
      } else {
        sampleInterval = 60 * 60 * 1000; // 1 hour
      }
    } else {
      // Parse custom interval
      const match = interval.match(/^(\d+)([mh])$/);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];
        sampleInterval = unit === 'm' ? value * 60 * 1000 : value * 60 * 60 * 1000;
      } else {
        sampleInterval = 5 * 60 * 1000; // Default 5 minutes
      }
    }

    // Query time-series data
    const timeSeriesData = await db
      .collection('market_time_series')
      .find({
        marketId: market._id,
        timestamp: { $gte: startTime },
      })
      .sort({ timestamp: 1 })
      .toArray();

    // Sample data if needed (reduce number of points for performance)
    const sampledData = sampleTimeSeriesData(timeSeriesData, sampleInterval);

    // Format for chart library (e.g., Recharts, Chart.js)
    const chartData = sampledData.map((point: any) => ({
      timestamp: point.timestamp.getTime(),
      yesPrice: point.yesPrice,
      noPrice: point.noPrice,
      totalVolume: point.totalVolume,
      yesVolume: point.yesVolume,
      noVolume: point.noVolume,
    }));

    // Calculate summary stats
    const stats = calculateChartStats(chartData);

    return NextResponse.json({
      marketAddress,
      timeframe,
      interval: interval === 'auto' ? `${sampleInterval / 1000}s` : interval,
      dataPoints: chartData.length,
      data: chartData,
      stats,
    });

  } catch (error) {
    console.error('Error fetching chart data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}

/**
 * Sample time-series data to reduce number of points
 */
function sampleTimeSeriesData(data: any[], intervalMs: number): any[] {
  if (data.length === 0) return [];

  const sampled: any[] = [];
  let lastTimestamp = 0;

  for (const point of data) {
    const timestamp = point.timestamp.getTime();

    if (timestamp - lastTimestamp >= intervalMs || sampled.length === 0) {
      sampled.push(point);
      lastTimestamp = timestamp;
    }
  }

  return sampled;
}

/**
 * Calculate summary statistics
 */
function calculateChartStats(data: any[]) {
  if (data.length === 0) {
    return {
      priceChange: 0,
      priceChangePercent: 0,
      highestYes: 50,
      lowestYes: 50,
      totalVolume: '0',
    };
  }

  const first = data[0];
  const last = data[data.length - 1];

  const priceChange = last.yesPrice - first.yesPrice;
  const priceChangePercent = first.yesPrice !== 0
    ? (priceChange / first.yesPrice) * 100
    : 0;

  const highestYes = Math.max(...data.map(d => d.yesPrice));
  const lowestYes = Math.min(...data.map(d => d.yesPrice));

  return {
    priceChange: parseFloat(priceChange.toFixed(2)),
    priceChangePercent: parseFloat(priceChangePercent.toFixed(2)),
    highestYes,
    lowestYes,
    totalVolume: last.totalVolume,
  };
}
