/**
 * Market Chart Data Hook
 * Fetches and manages time-series chart data with real-time updates
 */

import { useEffect, useState } from 'react';
import { useMarketSocket } from './useSocket';
import { apiUrl } from '../utils/api';

export type Timeframe = '1h' | '24h' | '7d' | '30d' | 'all';

interface ChartDataPoint {
  timestamp: number;
  yesPrice: number;
  noPrice: number;
  totalVolume: string;
  yesVolume: string;
  noVolume: string;
}

interface ChartStats {
  priceChange: number;
  priceChangePercent: number;
  highestYes: number;
  lowestYes: number;
  totalVolume: string;
}

interface ChartData {
  marketAddress: string;
  timeframe: string;
  interval: string;
  dataPoints: number;
  data: ChartDataPoint[];
  stats: ChartStats;
}

/**
 * Hook to fetch and manage market chart data
 */
export function useMarketChart(
  marketAddress: string | null,
  timeframe: Timeframe = '24h',
  enableRealtime: boolean = true
) {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time updates via Socket.IO
  const { marketData: realtimeUpdate, isConnected } = useMarketSocket(
    enableRealtime ? marketAddress : null
  );

  // Fetch initial chart data
  useEffect(() => {
    if (!marketAddress) {
      setLoading(false);
      return;
    }

    const fetchChartData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(
          apiUrl(`/api/markets/${marketAddress}/chart?timeframe=${timeframe}`)
        );

        if (!response.ok) {
          throw new Error('Failed to fetch chart data');
        }

        const data = await response.json();
        setChartData(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        console.error('Error fetching chart data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [marketAddress, timeframe]);

  // Update chart with real-time data
  useEffect(() => {
    if (!realtimeUpdate || !chartData) return;

    // Append new data point to chart
    const newDataPoint: ChartDataPoint = {
      timestamp: Date.now(),
      yesPrice: realtimeUpdate.yesPercentage || 50,
      noPrice: 100 - (realtimeUpdate.yesPercentage || 50),
      totalVolume: (
        BigInt(realtimeUpdate.totalYesStake || '0') +
        BigInt(realtimeUpdate.totalNoStake || '0')
      ).toString(),
      yesVolume: realtimeUpdate.totalYesStake || '0',
      noVolume: realtimeUpdate.totalNoStake || '0',
    };

    setChartData((prev) => {
      if (!prev) return null;

      // Add new point
      const updatedData = [...prev.data, newDataPoint];

      // Keep only relevant timeframe (prevent unlimited growth)
      const now = Date.now();
      const cutoffTime = getCutoffTime(timeframe, now);
      const filteredData = updatedData.filter(
        (point) => point.timestamp >= cutoffTime
      );

      // Recalculate stats
      const stats = calculateStats(filteredData);

      return {
        ...prev,
        data: filteredData,
        dataPoints: filteredData.length,
        stats,
      };
    });
  }, [realtimeUpdate, chartData, timeframe]);

  return {
    chartData,
    loading,
    error,
    isRealtime: enableRealtime && isConnected,
  };
}

/**
 * Get cutoff timestamp for timeframe
 */
function getCutoffTime(timeframe: Timeframe, now: number): number {
  switch (timeframe) {
    case '1h':
      return now - 60 * 60 * 1000;
    case '24h':
      return now - 24 * 60 * 60 * 1000;
    case '7d':
      return now - 7 * 24 * 60 * 60 * 1000;
    case '30d':
      return now - 30 * 24 * 60 * 60 * 1000;
    case 'all':
      return 0;
    default:
      return now - 24 * 60 * 60 * 1000;
  }
}

/**
 * Recalculate chart statistics
 */
function calculateStats(data: ChartDataPoint[]): ChartStats {
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
  const priceChangePercent =
    first.yesPrice !== 0 ? (priceChange / first.yesPrice) * 100 : 0;

  const highestYes = Math.max(...data.map((d) => d.yesPrice));
  const lowestYes = Math.min(...data.map((d) => d.yesPrice));

  return {
    priceChange: parseFloat(priceChange.toFixed(2)),
    priceChangePercent: parseFloat(priceChangePercent.toFixed(2)),
    highestYes,
    lowestYes,
    totalVolume: last.totalVolume,
  };
}
