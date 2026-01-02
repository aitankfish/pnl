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
        const response = await fetch(`https://public-api.birdeye.so/defi/token_overview?address=${tokenMint}`, {
          headers: {
            'X-API-KEY': process.env.NEXT_PUBLIC_BIRDEYE_API_KEY || '',
            'x-chain': 'solana',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setTokenStats({
              priceUsd: data.data.price || null,
              marketCap: data.data.mc || null,
              volume24h: data.data.v24hUSD || null,
              holders: data.data.holder || null,
              priceChange24h: data.data.priceChange24hPercent || null,
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
