'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartDataPoint {
  timestamp: number;
  time: string;
  yesPrice: number;
  noPrice: number;
  amount: number;
  voteType: string;
}

interface ProbabilityChartProps {
  data: ChartDataPoint[];
  className?: string;
}

export default function ProbabilityChart({ data, className }: ProbabilityChartProps) {
  // Format timestamp for tooltip
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-black/90 border border-gray-700 rounded-lg p-3 shadow-lg">
          <p className="text-xs text-gray-400 mb-2">{formatTime(data.timestamp)}</p>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-white font-medium">YES: {data.yesPrice}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm text-white font-medium">NO: {data.noPrice}%</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {(data.amount || 0).toFixed(3)} SOL • {data.voteType?.toUpperCase()}
          </p>
        </div>
      );
    }
    return null;
  };

  // If no data, show placeholder
  if (!data || data.length === 0) {
    return (
      <Card className={`bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm border-gray-700/50 ${className}`}>
        <CardHeader>
          <CardTitle className="text-white">Probability Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="text-4xl">📊</div>
              <p className="text-gray-400">No trades yet</p>
              <p className="text-sm text-gray-500">Be the first to vote!</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm border-gray-700/50 ${className}`}>
      <CardHeader>
        <CardTitle className="text-white">Probability Trends</CardTitle>
        <p className="text-sm text-gray-400">YES vs NO probability over time</p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatTime}
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              tickCount={5}
            />
            <YAxis
              domain={[0, 100]}
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              label={{ value: 'Probability (%)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
              formatter={(value) => <span className="text-gray-300">{value}</span>}
            />
            <Line
              type="monotone"
              dataKey="yesPrice"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 4, fill: '#10b981' }}
              activeDot={{ r: 6 }}
              name="YES %"
            />
            <Line
              type="monotone"
              dataKey="noPrice"
              stroke="#ef4444"
              strokeWidth={2}
              dot={{ r: 4, fill: '#ef4444' }}
              activeDot={{ r: 6 }}
              name="NO %"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
