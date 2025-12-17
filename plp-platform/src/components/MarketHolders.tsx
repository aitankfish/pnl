'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';

interface PositionHolder {
  wallet: string;
  totalAmount: number;
  tradeCount: number;
  percentage: number;
}

interface MarketHoldersProps {
  yesHolders: PositionHolder[];
  noHolders: PositionHolder[];
  totalYesStake: number;
  totalNoStake: number;
  uniqueHolders: number;
  yesPercentage?: number; // Pre-calculated from backend
  noPercentage?: number; // Pre-calculated from backend
  currentUserWallet?: string;
  className?: string;
}

// Safe number formatting helper - using String() as final fallback
const safeFormat = (value: unknown, decimals: number = 0): string => {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (Number.isNaN(num) || !Number.isFinite(num)) return '0';
  return String(Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals));
};

export default function MarketHolders(props: MarketHoldersProps) {
  // Handle null/undefined props entirely
  if (!props) {
    return null;
  }

  // Destructure with defaults and ensure arrays/numbers are safe
  const yesHolders = Array.isArray(props.yesHolders) ? props.yesHolders : [];
  const noHolders = Array.isArray(props.noHolders) ? props.noHolders : [];
  const totalYesStake = Number(props.totalYesStake) || 0;
  const totalNoStake = Number(props.totalNoStake) || 0;
  const uniqueHolders = Number(props.uniqueHolders) || 0;
  const yesPercentage = props.yesPercentage;
  const noPercentage = props.noPercentage;
  const currentUserWallet = props.currentUserWallet;
  const className = props.className;

  // Truncate wallet address
  const truncateWallet = (wallet: string) => {
    if (!wallet || wallet.length < 12) return wallet || '';
    return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
  };

  // Check if wallet is current user
  const isCurrentUser = (wallet: string) => {
    return currentUserWallet && wallet === currentUserWallet;
  };

  // Use backend-calculated percentages if available, otherwise calculate
  const safeYesStake = totalYesStake;
  const safeNoStake = totalNoStake;
  const totalStake = safeYesStake + safeNoStake;
  const yesPoolPercentage = typeof yesPercentage === 'number' && !isNaN(yesPercentage)
    ? yesPercentage
    : (totalStake > 0 ? (safeYesStake / totalStake) * 100 : 50);
  const noPoolPercentage = typeof noPercentage === 'number' && !isNaN(noPercentage)
    ? noPercentage
    : (100 - yesPoolPercentage);

  // Early return if no holders data
  if (yesHolders.length === 0 && noHolders.length === 0) {
    return null;
  }

  return (
    <Card className={`bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm border-gray-700/50 ${className}`}>
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex items-start sm:items-center justify-between gap-2 sm:gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base sm:text-lg md:text-xl text-white flex items-center gap-1.5 sm:gap-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span className="truncate">Market Holders</span>
            </CardTitle>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
              {uniqueHolders} unique {uniqueHolders === 1 ? 'holder' : 'holders'}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[10px] sm:text-xs text-gray-400">Total Staked</div>
            <div className="text-sm sm:text-base md:text-lg font-bold text-white">
              {safeFormat(totalStake, 2)} SOL
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        {/* YES Holders Section */}
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400 flex-shrink-0" />
              <h3 className="text-xs sm:text-sm font-semibold text-green-400">
                YES HOLDERS ({safeFormat(yesPoolPercentage, 0)}%)
              </h3>
            </div>
            <div className="text-[10px] sm:text-xs text-gray-400 flex-shrink-0">
              {safeFormat(safeYesStake, 2)} SOL
            </div>
          </div>

          <div className="space-y-1.5 sm:space-y-2 max-h-[180px] sm:max-h-[200px] md:max-h-[220px] overflow-y-auto custom-scrollbar">
            {yesHolders.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                No YES positions yet
              </div>
            ) : (
              yesHolders.filter(h => h && h.wallet).map((holder, index) => (
                <Link
                  key={holder.wallet || index}
                  href={`/profile/${holder.wallet}`}
                  className={`flex items-center justify-between p-2 sm:p-3 rounded-lg transition-all cursor-pointer no-underline outline-none focus:outline-none ${
                    isCurrentUser(holder.wallet)
                      ? 'bg-green-500/20 border border-green-500/30 hover:bg-green-500/30'
                      : 'bg-white/5 hover:bg-white/10 hover:scale-[1.02]'
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="text-[10px] sm:text-xs font-mono text-gray-400 w-4 sm:w-6 flex-shrink-0">
                      #{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <span className="text-xs sm:text-sm font-mono text-white hover:text-green-400 transition-colors truncate">
                          {truncateWallet(holder.wallet)}
                        </span>
                        {isCurrentUser(holder.wallet) && (
                          <span className="text-[10px] sm:text-xs bg-green-500/30 text-green-400 px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
                        {holder.tradeCount || 0} {(holder.tradeCount || 0) === 1 ? 'trade' : 'trades'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs sm:text-sm font-bold text-green-400">
                      {safeFormat(holder.totalAmount, 3)} SOL
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-400">
                      {safeFormat(holder.percentage, 1)}%
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* NO Holders Section */}
        <div>
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <TrendingDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400 flex-shrink-0" />
              <h3 className="text-xs sm:text-sm font-semibold text-red-400">
                NO HOLDERS ({safeFormat(noPoolPercentage, 0)}%)
              </h3>
            </div>
            <div className="text-[10px] sm:text-xs text-gray-400 flex-shrink-0">
              {safeFormat(safeNoStake, 2)} SOL
            </div>
          </div>

          <div className="space-y-1.5 sm:space-y-2 max-h-[180px] sm:max-h-[200px] md:max-h-[220px] overflow-y-auto custom-scrollbar">
            {noHolders.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-xs sm:text-sm">
                No NO positions yet
              </div>
            ) : (
              noHolders.filter(h => h && h.wallet).map((holder, index) => (
                <Link
                  key={holder.wallet}
                  href={`/profile/${holder.wallet}`}
                  className={`flex items-center justify-between p-2 sm:p-3 rounded-lg transition-all cursor-pointer no-underline outline-none focus:outline-none ${
                    isCurrentUser(holder.wallet)
                      ? 'bg-red-500/20 border border-red-500/30 hover:bg-red-500/30'
                      : 'bg-white/5 hover:bg-white/10 hover:scale-[1.02]'
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div className="text-[10px] sm:text-xs font-mono text-gray-400 w-4 sm:w-6 flex-shrink-0">
                      #{index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <span className="text-xs sm:text-sm font-mono text-white hover:text-red-400 transition-colors truncate">
                          {truncateWallet(holder.wallet)}
                        </span>
                        {isCurrentUser(holder.wallet) && (
                          <span className="text-[10px] sm:text-xs bg-red-500/30 text-red-400 px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
                        {holder.tradeCount || 0} {(holder.tradeCount || 0) === 1 ? 'trade' : 'trades'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs sm:text-sm font-bold text-red-400">
                      {safeFormat(holder.totalAmount, 3)} SOL
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-400">
                      {safeFormat(holder.percentage, 1)}%
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
