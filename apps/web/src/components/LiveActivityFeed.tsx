'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface Trade {
  id: string;
  traderWallet: string;
  voteType: 'yes' | 'no';
  amount: number;
  yesPrice: number;
  noPrice: number;
  signature: string;
  timestamp: number;
  timeAgo: string;
}

interface LiveActivityFeedProps {
  trades: Trade[];
  className?: string;
}

export default function LiveActivityFeed({ trades, className }: LiveActivityFeedProps) {
  // Deduplicate trades by signature to avoid React key warnings
  const uniqueTrades = React.useMemo(() => {
    const seen = new Set<string>();
    return trades.filter(trade => {
      if (seen.has(trade.id)) {
        return false;
      }
      seen.add(trade.id);
      return true;
    });
  }, [trades]);

  // Shorten wallet address for display
  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // If no trades, show placeholder
  if (!trades || trades.length === 0) {
    return (
      <Card className={`bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm border-gray-700/50 ${className}`}>
        <CardHeader className="pb-3 sm:pb-4">
          <CardTitle className="text-base sm:text-lg md:text-xl text-white">Voting History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] sm:h-[300px] md:h-[350px] flex items-center justify-center">
            <div className="text-center space-y-1.5 sm:space-y-2">
              <div className="text-3xl sm:text-4xl">💬</div>
              <p className="text-sm sm:text-base text-gray-400">No votes yet</p>
              <p className="text-xs sm:text-sm text-gray-500">Votes will appear here</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm border-gray-700/50 ${className}`}>
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="text-base sm:text-lg md:text-xl text-white">Voting History</CardTitle>
        <p className="text-xs sm:text-sm text-gray-400">Record of all votes placed</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 sm:space-y-3 max-h-[250px] sm:max-h-[300px] md:max-h-[350px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
          {uniqueTrades.map((trade) => (
            <div
              key={trade.id}
              className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-gray-800/30 border border-gray-700/30 hover:border-gray-600/50 transition-all"
            >
              {/* Vote indicator */}
              <div className={`mt-0.5 sm:mt-1 flex-shrink-0 ${trade.voteType === 'yes' ? 'text-green-500' : 'text-red-500'}`}>
                {trade.voteType === 'yes' ? (
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </div>

              {/* Trade details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 sm:gap-2 mb-0.5 sm:mb-1">
                  <span className="text-xs sm:text-sm text-gray-300 font-medium truncate">
                    {shortenAddress(trade.traderWallet)}
                  </span>
                  <span className="text-[10px] sm:text-xs text-gray-500 flex-shrink-0">{trade.timeAgo}</span>
                </div>

                <p className="text-xs sm:text-sm text-gray-400">
                  Voted <span className={`font-semibold ${trade.voteType === 'yes' ? 'text-green-400' : 'text-red-400'}`}>
                    {trade.voteType.toUpperCase()}
                  </span> with{' '}
                  <span className="text-cyan-400 font-medium">{(trade.amount || 0).toFixed(3)} SOL</span>
                </p>

                <div className="flex items-center gap-2 sm:gap-3 mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-gray-500">
                  <span>YES: {trade.yesPrice}%</span>
                  <span>•</span>
                  <span>NO: {trade.noPrice}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(55, 65, 81, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(107, 114, 128, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(107, 114, 128, 0.7);
        }
      `}</style>
    </Card>
  );
}
