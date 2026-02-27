'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Users,
  Loader2,
  Search,
  X,
  Wallet,
  BarChart3,
  Clock,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

// Types
interface LaunchedToken {
  id: string;
  marketAddress: string;
  name: string;
  symbol: string;
  description: string;
  category: string;
  stage?: string;
  projectType?: string;
  launchDate: string;
  tokenAddress: string;
  projectImageUrl?: string;
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  yesPercentage: number;
  launchPool: string;
}

// Stage display config
const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  'idea': { label: 'Idea', color: 'text-purple-400' },
  'prototype': { label: 'Prototype', color: 'text-blue-400' },
  'mvp': { label: 'MVP', color: 'text-cyan-400' },
  'beta': { label: 'Beta', color: 'text-yellow-400' },
  'launched': { label: 'Live', color: 'text-green-400' },
};

// Type display config
const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  'protocol': { label: 'Protocol', color: 'text-indigo-400' },
  'application': { label: 'App', color: 'text-pink-400' },
  'platform': { label: 'Platform', color: 'text-orange-400' },
  'service': { label: 'Service', color: 'text-teal-400' },
  'tool': { label: 'Tool', color: 'text-amber-400' },
};

interface TokenStats {
  address: string;
  price: number | null;
  priceChange24h: number | null;
  marketCap: number | null;
  volume24h: number | null;
  holders: number | null;
  liquidity: number | null;
}

interface LaunchedTableProps {
  tokens: LaunchedToken[];
  isLoading?: boolean;
  refreshKey?: number; // Increment to trigger stats refresh
}

type SortKey = 'name' | 'price' | 'priceChange24h' | 'marketCap' | 'volume24h' | 'holders' | 'launchPool' | 'yesPercentage' | 'stage' | 'projectType' | 'age';
type SortDirection = 'asc' | 'desc';

// Sort options for dropdown
const SORT_OPTIONS: { key: SortKey; label: string; direction: SortDirection }[] = [
  { key: 'marketCap', label: 'Highest Market Cap', direction: 'desc' },
  { key: 'marketCap', label: 'Lowest Market Cap', direction: 'asc' },
  { key: 'priceChange24h', label: 'Top Gainers (24h)', direction: 'desc' },
  { key: 'priceChange24h', label: 'Top Losers (24h)', direction: 'asc' },
  { key: 'price', label: 'Highest Price', direction: 'desc' },
  { key: 'price', label: 'Lowest Price', direction: 'asc' },
  { key: 'holders', label: 'Most Holders', direction: 'desc' },
  { key: 'volume24h', label: 'Highest Volume', direction: 'desc' },
  { key: 'launchPool', label: 'Most Raised', direction: 'desc' },
  { key: 'age', label: 'Newest First', direction: 'desc' },
  { key: 'age', label: 'Oldest First', direction: 'asc' },
  { key: 'name', label: 'Name (A-Z)', direction: 'asc' },
];

// Format helpers
const formatPrice = (price: number | null): string => {
  if (price === null) return '-';
  if (price < 0.000001) return `$${price.toExponential(2)}`;
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
};

const formatLargeNumber = (num: number | null): string => {
  if (num === null) return '-';
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
};

const formatNumber = (num: number | null): string => {
  if (num === null) return '-';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
};

const formatAge = (launchDate: string): string => {
  const now = new Date();
  const launch = new Date(launchDate);
  const diffMs = now.getTime() - launch.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1d';
  if (diffDays < 30) return `${diffDays}d`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
  return `${Math.floor(diffDays / 365)}y`;
};

const truncateAddress = (address: string): string => {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

// Format time ago
const formatTimeAgo = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
};

export function LaunchedTable({ tokens, isLoading = false, refreshKey = 0 }: LaunchedTableProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>('marketCap');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [tokenStats, setTokenStats] = useState<Map<string, TokenStats>>(new Map());
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [timeAgo, setTimeAgo] = useState<string>('just now');
  const [priceFlash, setPriceFlash] = useState<Map<string, 'up' | 'down' | null>>(new Map());
  const previousPrices = useRef<Map<string, number>>(new Map());

  // Update time ago display every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAgo(formatTimeAgo(lastUpdated));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Fetch stats for all tokens
  useEffect(() => {
    if (tokens.length === 0) return;

    const fetchStats = async () => {
      setIsLoadingStats(true);
      try {
        const addresses = tokens.map((t) => t.tokenAddress).filter(Boolean);
        const response = await fetch('/api/tokens/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addresses }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const statsMap = new Map<string, TokenStats>();
            const newFlashes = new Map<string, 'up' | 'down' | null>();

            data.data.forEach((stat: TokenStats) => {
              statsMap.set(stat.address, stat);

              // Check for price change flash
              const prevPrice = previousPrices.current.get(stat.address);
              if (prevPrice !== undefined && stat.price !== null) {
                if (stat.price > prevPrice) {
                  newFlashes.set(stat.address, 'up');
                } else if (stat.price < prevPrice) {
                  newFlashes.set(stat.address, 'down');
                }
              }

              // Store current price for next comparison
              if (stat.price !== null) {
                previousPrices.current.set(stat.address, stat.price);
              }
            });

            setTokenStats(statsMap);
            setLastUpdated(Date.now());
            setTimeAgo('just now');

            // Set flash animations
            if (newFlashes.size > 0) {
              setPriceFlash(newFlashes);
              // Clear flashes after animation
              setTimeout(() => setPriceFlash(new Map()), 1000);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching token stats:', error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchStats();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [tokens, refreshKey]);

  // Copy address to clipboard
  const copyAddress = (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // Handle sort
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  // Filtered and sorted tokens
  const sortedTokens = useMemo(() => {
    let filtered = [...tokens];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.symbol.toLowerCase().includes(query) ||
          t.tokenAddress.toLowerCase().includes(query)
      );
    }

    // Apply sort
    filtered.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      const aStats = tokenStats.get(a.tokenAddress);
      const bStats = tokenStats.get(b.tokenAddress);

      switch (sortKey) {
        case 'name':
          return sortDirection === 'asc'
            ? a.name.localeCompare(b.name)
            : b.name.localeCompare(a.name);
        case 'price':
          aValue = aStats?.price ?? 0;
          bValue = bStats?.price ?? 0;
          break;
        case 'priceChange24h':
          aValue = aStats?.priceChange24h ?? 0;
          bValue = bStats?.priceChange24h ?? 0;
          break;
        case 'marketCap':
          aValue = aStats?.marketCap ?? 0;
          bValue = bStats?.marketCap ?? 0;
          break;
        case 'volume24h':
          aValue = aStats?.volume24h ?? 0;
          bValue = bStats?.volume24h ?? 0;
          break;
        case 'holders':
          aValue = aStats?.holders ?? 0;
          bValue = bStats?.holders ?? 0;
          break;
        case 'launchPool':
          aValue = parseFloat(a.launchPool) || 0;
          bValue = parseFloat(b.launchPool) || 0;
          break;
        case 'yesPercentage':
          aValue = a.yesPercentage || 0;
          bValue = b.yesPercentage || 0;
          break;
        case 'stage':
          const stageOrder = ['idea', 'prototype', 'mvp', 'beta', 'launched'];
          aValue = stageOrder.indexOf(a.stage?.toLowerCase() || 'idea');
          bValue = stageOrder.indexOf(b.stage?.toLowerCase() || 'idea');
          break;
        case 'projectType':
          const typeOrder = ['protocol', 'platform', 'application', 'service', 'tool'];
          aValue = typeOrder.indexOf(a.projectType?.toLowerCase() || 'application');
          bValue = typeOrder.indexOf(b.projectType?.toLowerCase() || 'application');
          break;
        case 'age':
          aValue = new Date(a.launchDate).getTime();
          bValue = new Date(b.launchDate).getTime();
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return filtered;
  }, [tokens, tokenStats, sortKey, sortDirection, searchQuery]);

  // Get current sort option label
  const getCurrentSortLabel = () => {
    const option = SORT_OPTIONS.find(
      (o) => o.key === sortKey && o.direction === sortDirection
    );
    return option?.label || 'Sort by...';
  };

  // Handle sort option selection
  const handleSortOption = (key: SortKey, direction: SortDirection) => {
    setSortKey(key);
    setSortDirection(direction);
  };

  // Sort header component
  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <button
      onClick={() => handleSort(sortKeyName)}
      className="flex items-center gap-1 hover:text-white transition-colors group"
    >
      <span>{label}</span>
      {sortKey === sortKeyName ? (
        sortDirection === 'asc' ? (
          <ArrowUp className="w-3 h-3 text-cyan-400" />
        ) : (
          <ArrowDown className="w-3 h-3 text-cyan-400" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
      )}
    </button>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search by name, symbol, or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-cyan-500/50"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Sort Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Quick Sort Buttons - Desktop */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500">Quick:</span>
          {[
            { key: 'priceChange24h' as SortKey, dir: 'desc' as SortDirection, label: '🚀 Gainers', color: 'text-green-400 border-green-500/30 bg-green-500/10' },
            { key: 'priceChange24h' as SortKey, dir: 'asc' as SortDirection, label: '📉 Losers', color: 'text-red-400 border-red-500/30 bg-red-500/10' },
            { key: 'marketCap' as SortKey, dir: 'desc' as SortDirection, label: '💎 MCap', color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
            { key: 'age' as SortKey, dir: 'desc' as SortDirection, label: '✨ New', color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' },
          ].map((btn) => (
            <button
              key={`${btn.key}-${btn.dir}`}
              onClick={() => handleSortOption(btn.key, btn.dir)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                sortKey === btn.key && sortDirection === btn.dir
                  ? btn.color
                  : 'text-gray-400 border-white/10 bg-white/5 hover:bg-white/10'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Sort Dropdown - Works on both mobile and desktop */}
        <div className="relative flex-1 sm:flex-none sm:w-48">
          <select
            value={`${sortKey}-${sortDirection}`}
            onChange={(e) => {
              const [key, dir] = e.target.value.split('-') as [SortKey, SortDirection];
              handleSortOption(key, dir);
            }}
            className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none focus:border-cyan-500/50 cursor-pointer"
          >
            {SORT_OPTIONS.map((option, idx) => (
              <option
                key={`${option.key}-${option.direction}-${idx}`}
                value={`${option.key}-${option.direction}`}
                className="bg-gray-900"
              >
                {option.label}
              </option>
            ))}
          </select>
          <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>

        {/* Stats refresh indicator */}
        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            {isLoadingStats ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                <span>Refreshing...</span>
              </>
            ) : (
              <>
                <Clock className="w-3 h-3" />
                <span>{timeAgo}</span>
              </>
            )}
          </div>
          <span className="text-gray-500 hidden sm:inline">Auto: 30s</span>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 text-xs text-gray-400 uppercase">
              <th className="text-left py-3 px-2 w-8">#</th>
              <th className="text-left py-3 px-2">
                <SortHeader label="Token" sortKeyName="name" />
              </th>
              <th className="text-right py-3 px-2">
                <SortHeader label="Price" sortKeyName="price" />
              </th>
              <th className="text-right py-3 px-2">
                <SortHeader label="24h %" sortKeyName="priceChange24h" />
              </th>
              <th className="text-right py-3 px-2">
                <SortHeader label="Market Cap" sortKeyName="marketCap" />
              </th>
              <th className="text-right py-3 px-2">
                <SortHeader label="Holders" sortKeyName="holders" />
              </th>
              <th className="text-center py-3 px-2">
                <SortHeader label="Stage" sortKeyName="stage" />
              </th>
              <th className="text-center py-3 px-2">
                <SortHeader label="Type" sortKeyName="projectType" />
              </th>
              <th className="text-right py-3 px-2">
                <SortHeader label="Raised" sortKeyName="launchPool" />
              </th>
              <th className="text-right py-3 px-2">
                <SortHeader label="Yes %" sortKeyName="yesPercentage" />
              </th>
              <th className="text-right py-3 px-2">
                <SortHeader label="Age" sortKeyName="age" />
              </th>
              <th className="text-center py-3 px-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedTokens.map((token, index) => {
              const stats = tokenStats.get(token.tokenAddress);
              const priceChange = stats?.priceChange24h ?? null;
              const isPositive = priceChange !== null && priceChange >= 0;

              return (
                <tr
                  key={token.id}
                  onClick={() => router.push(`/market/${token.id}`)}
                  className="border-b border-white/10 hover:bg-white/5 cursor-pointer transition-colors group"
                >
                  <td className="py-3 px-2 text-gray-500 text-sm">{index + 1}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-3">
                      {token.projectImageUrl ? (
                        <img
                          src={token.projectImageUrl}
                          alt={token.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
                          {token.symbol.slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <div className="text-white font-medium group-hover:text-cyan-400 transition-colors">
                          {token.name}
                        </div>
                        <div className="text-gray-400 text-xs">${token.symbol}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span className={`font-mono text-sm transition-colors duration-300 ${
                      priceFlash.get(token.tokenAddress) === 'up'
                        ? 'text-green-400 bg-green-400/20 px-1 rounded'
                        : priceFlash.get(token.tokenAddress) === 'down'
                        ? 'text-red-400 bg-red-400/20 px-1 rounded'
                        : 'text-white'
                    }`}>
                      {formatPrice(stats?.price ?? null)}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    {priceChange !== null && priceChange !== undefined ? (
                      <div
                        className={`flex items-center justify-end gap-1 text-sm font-medium ${
                          isPositive ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {isPositive ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {isPositive ? '+' : ''}
                        {priceChange.toFixed(2)}%
                      </div>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right text-white text-sm">
                    {formatLargeNumber(stats?.marketCap ?? null)}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="flex items-center justify-end gap-1 text-gray-300 text-sm">
                      <Users className="w-3 h-3 text-gray-500" />
                      {formatNumber(stats?.holders ?? null)}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    {(() => {
                      const stageKey = token.stage?.toLowerCase() || 'idea';
                      const stageConfig = STAGE_CONFIG[stageKey] || STAGE_CONFIG['idea'];
                      return (
                        <span className={`text-xs font-medium ${stageConfig.color}`}>
                          {stageConfig.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-3 px-2 text-center">
                    {(() => {
                      const typeKey = token.projectType?.toLowerCase() || 'application';
                      const typeConfig = TYPE_CONFIG[typeKey] || TYPE_CONFIG['application'];
                      return (
                        <span className={`text-xs font-medium ${typeConfig.color}`}>
                          {typeConfig.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-3 px-2 text-right text-cyan-400 text-sm font-medium">
                    {parseFloat(token.launchPool).toFixed(2)} SOL
                  </td>
                  <td className="py-3 px-2 text-right text-green-400 text-sm font-medium">
                    {token.yesPercentage}%
                  </td>
                  <td className="py-3 px-2 text-right text-gray-400 text-sm">
                    {formatAge(token.launchDate)}
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center justify-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      {/* Copy Token Address */}
                      <button
                        onClick={(e) => copyAddress(token.tokenAddress, e)}
                        className="p-1.5 hover:bg-white/10 rounded transition-colors"
                        title="Copy token address"
                      >
                        {copiedAddress === token.tokenAddress ? (
                          <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </button>
                      {/* Helius Explorer - Token */}
                      <a
                        href={`https://orb.helius.dev/address/${token.tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-white/10 rounded transition-colors"
                        title="Token on Helius Explorer"
                      >
                        <Wallet className="w-3.5 h-3.5 text-purple-400" />
                      </a>
                      {/* Helius Explorer - Market */}
                      <a
                        href={`https://orb.helius.dev/address/${token.marketAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-white/10 rounded transition-colors"
                        title="Market on Helius Explorer"
                      >
                        <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                      </a>
                      {/* Birdeye */}
                      <a
                        href={`https://birdeye.so/token/${token.tokenAddress}?chain=solana`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-white/10 rounded transition-colors"
                        title="View on Birdeye"
                      >
                        <img src="https://birdeye.so/favicon.ico" alt="Birdeye" className="w-3.5 h-3.5" />
                      </a>
                      {/* DexScreener */}
                      <a
                        href={`https://dexscreener.com/solana/${token.tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-white/10 rounded transition-colors"
                        title="View on DexScreener"
                      >
                        <img src="https://dexscreener.com/favicon.ico" alt="DexScreener" className="w-3.5 h-3.5" />
                      </a>
                      {/* Pump.fun */}
                      <a
                        href={`https://pump.fun/coin/${token.tokenAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 hover:bg-white/10 rounded transition-colors"
                        title="View on Pump.fun"
                      >
                        <img src="https://pump.fun/favicon.ico" alt="Pump.fun" className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {sortedTokens.map((token, index) => {
          const stats = tokenStats.get(token.tokenAddress);
          const priceChange = stats?.priceChange24h ?? null;
          const isPositive = priceChange !== null && priceChange >= 0;

          return (
            <div
              key={token.id}
              onClick={() => router.push(`/market/${token.id}`)}
              className="bg-white/5 rounded-xl p-4 border border-white/10 hover:bg-white/10 cursor-pointer transition-all"
            >
              {/* Header Row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-xs w-5">{index + 1}</span>
                  {token.projectImageUrl ? (
                    <img
                      src={token.projectImageUrl}
                      alt={token.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                      {token.symbol.slice(0, 2)}
                    </div>
                  )}
                  <div>
                    <div className="text-white font-semibold">{token.name}</div>
                    <div className="text-gray-400 text-xs">${token.symbol}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-mono font-semibold transition-colors duration-300 ${
                    priceFlash.get(token.tokenAddress) === 'up'
                      ? 'text-green-400'
                      : priceFlash.get(token.tokenAddress) === 'down'
                      ? 'text-red-400'
                      : 'text-white'
                  }`}>
                    {formatPrice(stats?.price ?? null)}
                  </div>
                  {priceChange !== null && priceChange !== undefined && (
                    <div
                      className={`flex items-center justify-end gap-1 text-xs font-medium ${
                        isPositive ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {isPositive ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {isPositive ? '+' : ''}
                      {priceChange.toFixed(2)}%
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 text-center mb-2">
                <div className="bg-black/20 rounded-lg p-2">
                  <div className="text-gray-500 text-[10px] uppercase">MCap</div>
                  <div className="text-white text-xs font-medium">
                    {formatLargeNumber(stats?.marketCap ?? null)}
                  </div>
                </div>
                <div className="bg-black/20 rounded-lg p-2">
                  <div className="text-gray-500 text-[10px] uppercase">Holders</div>
                  <div className="text-white text-xs font-medium">
                    {formatNumber(stats?.holders ?? null)}
                  </div>
                </div>
                <div className="bg-black/20 rounded-lg p-2">
                  <div className="text-gray-500 text-[10px] uppercase">Raised</div>
                  <div className="text-cyan-400 text-xs font-medium">{parseFloat(token.launchPool).toFixed(2)} SOL</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-black/20 rounded-lg p-2">
                  <div className="text-gray-500 text-[10px] uppercase">Stage</div>
                  {(() => {
                    const stageKey = token.stage?.toLowerCase() || 'idea';
                    const stageConfig = STAGE_CONFIG[stageKey] || STAGE_CONFIG['idea'];
                    return (
                      <div className={`text-xs font-medium ${stageConfig.color}`}>
                        {stageConfig.label}
                      </div>
                    );
                  })()}
                </div>
                <div className="bg-black/20 rounded-lg p-2">
                  <div className="text-gray-500 text-[10px] uppercase">Type</div>
                  {(() => {
                    const typeKey = token.projectType?.toLowerCase() || 'application';
                    const typeConfig = TYPE_CONFIG[typeKey] || TYPE_CONFIG['application'];
                    return (
                      <div className={`text-xs font-medium ${typeConfig.color}`}>
                        {typeConfig.label}
                      </div>
                    );
                  })()}
                </div>
                <div className="bg-black/20 rounded-lg p-2">
                  <div className="text-gray-500 text-[10px] uppercase">Yes %</div>
                  <div className="text-green-400 text-xs font-medium">{token.yesPercentage}%</div>
                </div>
              </div>

              {/* Footer - Token Address */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs">CA:</span>
                  <code className="text-gray-400 text-xs font-mono">
                    {truncateAddress(token.tokenAddress)}
                  </code>
                  <button
                    onClick={(e) => copyAddress(token.tokenAddress, e)}
                    className="p-1 hover:bg-white/10 rounded"
                  >
                    {copiedAddress === token.tokenAddress ? (
                      <Check className="w-3 h-3 text-green-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-gray-400" />
                    )}
                  </button>
                </div>
                <div className="text-gray-500 text-xs">{formatAge(token.launchDate)}</div>
              </div>

              {/* External Links */}
              <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                <a
                  href={`https://orb.helius.dev/address/${token.tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded text-purple-300 text-xs transition-colors"
                >
                  <Wallet className="w-3 h-3" />
                  Token
                </a>
                <a
                  href={`https://orb.helius.dev/address/${token.marketAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded text-cyan-300 text-xs transition-colors"
                >
                  <BarChart3 className="w-3 h-3" />
                  Market
                </a>
                <a
                  href={`https://birdeye.so/token/${token.tokenAddress}?chain=solana`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-gray-300 text-xs transition-colors"
                >
                  <img src="https://birdeye.so/favicon.ico" alt="" className="w-3 h-3" />
                  Birdeye
                </a>
                <a
                  href={`https://dexscreener.com/solana/${token.tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-gray-300 text-xs transition-colors"
                >
                  <img src="https://dexscreener.com/favicon.ico" alt="" className="w-3 h-3" />
                  DEX
                </a>
                <a
                  href={`https://pump.fun/coin/${token.tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-gray-300 text-xs transition-colors"
                >
                  <img src="https://pump.fun/favicon.ico" alt="" className="w-3 h-3" />
                  Pump
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {sortedTokens.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-400">
            {searchQuery ? 'No tokens found matching your search.' : 'No launched tokens yet.'}
          </p>
        </div>
      )}
    </div>
  );
}
