'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown, BarChart3, Users, DollarSign } from 'lucide-react';

interface TokenStats {
  priceUsd: number | null;
  marketCap: number | null;
  volume24h: number | null;
  holders: number | null;
  priceChange24h: number | null;
}

interface TokenStatsBarProps {
  tokenMint: string;
}

export function TokenStatsBar({ tokenMint }: TokenStatsBarProps) {
  const [tokenStats, setTokenStats] = useState<TokenStats>({
    priceUsd: null,
    marketCap: null,
    volume24h: null,
    holders: null,
    priceChange24h: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTokenStats = async () => {
      setIsLoading(true);
      try {
        // Proxy through our own /api/tokens/stats — keeps the Birdeye API
        // key server-side (instead of baking NEXT_PUBLIC_BIRDEYE_API_KEY into
        // the client bundle where anyone can grep it from DevTools).
        const response = await fetch(`/api/tokens/stats?address=${encodeURIComponent(tokenMint)}`);

        if (response.ok) {
          const json = await response.json();
          if (json.success && json.data) {
            setTokenStats({
              priceUsd: json.data.price ?? null,
              marketCap: json.data.marketCap ?? null,
              volume24h: json.data.volume24h ?? null,
              holders: json.data.holders ?? null,
              priceChange24h: json.data.priceChange24h ?? null,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching token stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (tokenMint) {
      fetchTokenStats();
      // Refresh every 30 seconds
      const interval = setInterval(fetchTokenStats, 30000);
      return () => clearInterval(interval);
    }
  }, [tokenMint]);

  const formatNumber = (num: number | null, decimals = 2) => {
    if (num === null) return '-';
    if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(decimals)}B`;
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(decimals)}M`;
    if (num >= 1_000) return `$${(num / 1_000).toFixed(decimals)}K`;
    return `$${num.toFixed(decimals)}`;
  };

  const formatHolders = (num: number | null) => {
    if (num === null) return '-';
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const priceChange = tokenStats.priceChange24h;
  const isPositive = priceChange !== null && priceChange >= 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Price */}
      <div className="bg-white/5 rounded-lg p-3 text-center border border-white/10">
        <div className="text-gray-400 text-xs mb-1 flex items-center justify-center gap-1">
          <DollarSign className="w-3 h-3" /> Price
        </div>
        <div className="text-white font-semibold text-sm">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : tokenStats.priceUsd ? (
            `$${tokenStats.priceUsd < 0.01 ? tokenStats.priceUsd.toExponential(2) : tokenStats.priceUsd.toFixed(4)}`
          ) : '-'}
        </div>
        {priceChange !== null && (
          <div className={`flex items-center justify-center gap-1 text-xs ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
          </div>
        )}
      </div>

      {/* Market Cap */}
      <div className="bg-white/5 rounded-lg p-3 text-center border border-white/10">
        <div className="text-gray-400 text-xs mb-1 flex items-center justify-center gap-1">
          <TrendingUp className="w-3 h-3" /> MC
        </div>
        <div className="text-white font-semibold text-sm">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : formatNumber(tokenStats.marketCap)}
        </div>
      </div>

      {/* 24h Volume */}
      <div className="bg-white/5 rounded-lg p-3 text-center border border-white/10">
        <div className="text-gray-400 text-xs mb-1 flex items-center justify-center gap-1">
          <BarChart3 className="w-3 h-3" /> 24h Vol
        </div>
        <div className="text-white font-semibold text-sm">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : formatNumber(tokenStats.volume24h)}
        </div>
      </div>

      {/* Holders */}
      <div className="bg-white/5 rounded-lg p-3 text-center border border-white/10">
        <div className="text-gray-400 text-xs mb-1 flex items-center justify-center gap-1">
          <Users className="w-3 h-3" /> Holders
        </div>
        <div className="text-white font-semibold text-sm">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : formatHolders(tokenStats.holders)}
        </div>
      </div>
    </div>
  );
}
