'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { useRouter } from 'next/navigation';
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
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
import { Dropdown, DropdownOption } from '@/components/Dropdown';
import { BloomIcon } from '@/components/PlantIcons';

// ── Cosmic-plant palette ──
const BG = '#0a0814';
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const PEACH = '#ecb48a';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

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

// Stage / type label maps — colors now come from a unified cosmic palette
// instead of per-category rainbows. The label is what carries meaning.
const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  idea: { label: 'Idea', color: PEACH },
  prototype: { label: 'Prototype', color: PEACH },
  mvp: { label: 'MVP', color: AMBER },
  beta: { label: 'Beta', color: AMBER },
  launched: { label: 'Live', color: FOREST },
};

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  protocol: { label: 'Protocol', color: CREAM_DIM },
  application: { label: 'App', color: CREAM_DIM },
  platform: { label: 'Platform', color: CREAM_DIM },
  service: { label: 'Service', color: CREAM_DIM },
  tool: { label: 'Tool', color: CREAM_DIM },
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
  refreshKey?: number;
}

type SortKey =
  | 'name'
  | 'price'
  | 'priceChange24h'
  | 'marketCap'
  | 'volume24h'
  | 'holders'
  | 'launchPool'
  | 'yesPercentage'
  | 'stage'
  | 'projectType'
  | 'age';
type SortDirection = 'asc' | 'desc';

const SORT_OPTIONS: { key: SortKey; label: string; direction: SortDirection }[] = [
  { key: 'marketCap', label: 'Highest market cap', direction: 'desc' },
  { key: 'marketCap', label: 'Lowest market cap', direction: 'asc' },
  { key: 'priceChange24h', label: 'Top gainers (24h)', direction: 'desc' },
  { key: 'priceChange24h', label: 'Top losers (24h)', direction: 'asc' },
  { key: 'price', label: 'Highest price', direction: 'desc' },
  { key: 'price', label: 'Lowest price', direction: 'asc' },
  { key: 'holders', label: 'Most holders', direction: 'desc' },
  { key: 'volume24h', label: 'Highest volume', direction: 'desc' },
  { key: 'launchPool', label: 'Most raised', direction: 'desc' },
  { key: 'age', label: 'Newest first', direction: 'desc' },
  { key: 'age', label: 'Oldest first', direction: 'asc' },
  { key: 'name', label: 'Name (A-Z)', direction: 'asc' },
];

const SORT_DROPDOWN_OPTIONS: DropdownOption[] = SORT_OPTIONS.map((o) => ({
  value: `${o.key}-${o.direction}`,
  label: o.label,
}));

// ── Format helpers (preserved verbatim from prior version) ──
const formatPrice = (price: number | null): string => {
  if (price === null) return '—';
  if (price < 0.000001) return `$${price.toExponential(2)}`;
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
};

const formatLargeNumber = (num: number | null): string => {
  if (num === null) return '—';
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
};

const formatNumber = (num: number | null): string => {
  if (num === null) return '—';
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

const truncateAddress = (address: string): string =>
  `${address.slice(0, 4)}…${address.slice(-4)}`;

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

  // Tick the "X ago" label every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAgo(formatTimeAgo(lastUpdated));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  // Fetch stats for all tokens; auto-refresh every 30s
  useEffect(() => {
    if (tokens.length === 0) return;

    const fetchStats = async () => {
      setIsLoadingStats(true);
      try {
        const addresses = tokens.map((t) => t.tokenAddress).filter(Boolean);
        const response = await authFetch('/api/tokens/stats', {
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
              const prevPrice = previousPrices.current.get(stat.address);
              if (prevPrice !== undefined && stat.price !== null) {
                if (stat.price > prevPrice) newFlashes.set(stat.address, 'up');
                else if (stat.price < prevPrice) newFlashes.set(stat.address, 'down');
              }
              if (stat.price !== null) previousPrices.current.set(stat.address, stat.price);
            });

            setTokenStats(statsMap);
            setLastUpdated(Date.now());
            setTimeAgo('just now');

            if (newFlashes.size > 0) {
              setPriceFlash(newFlashes);
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
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [tokens, refreshKey]);

  const copyAddress = (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const sortedTokens = useMemo(() => {
    let filtered = [...tokens];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.symbol.toLowerCase().includes(query) ||
          t.tokenAddress.toLowerCase().includes(query),
      );
    }

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
        case 'stage': {
          const order = ['idea', 'prototype', 'mvp', 'beta', 'launched'];
          aValue = order.indexOf(a.stage?.toLowerCase() || 'idea');
          bValue = order.indexOf(b.stage?.toLowerCase() || 'idea');
          break;
        }
        case 'projectType': {
          const order = ['protocol', 'platform', 'application', 'service', 'tool'];
          aValue = order.indexOf(a.projectType?.toLowerCase() || 'application');
          bValue = order.indexOf(b.projectType?.toLowerCase() || 'application');
          break;
        }
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

  const handleSortOption = (key: SortKey, direction: SortDirection) => {
    setSortKey(key);
    setSortDirection(direction);
  };

  // Sort header — column-header click handler with cosmic chevron
  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <button
      onClick={() => handleSort(sortKeyName)}
      className="mono uppercase tracking-[0.22em] text-[0.55rem] inline-flex items-center gap-1 transition-colors group"
      style={{ color: sortKey === sortKeyName ? AMBER : CREAM_FAINT }}
      onMouseEnter={(e) => {
        if (sortKey !== sortKeyName) e.currentTarget.style.color = CREAM_DIM;
      }}
      onMouseLeave={(e) => {
        if (sortKey !== sortKeyName) e.currentTarget.style.color = CREAM_FAINT;
      }}
    >
      <span>{label}</span>
      {sortKey === sortKeyName ? (
        sortDirection === 'asc' ? (
          <ArrowUp className="w-3 h-3" style={{ color: AMBER }} />
        ) : (
          <ArrowDown className="w-3 h-3" style={{ color: AMBER }} />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-50" />
      )}
    </button>
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20" style={{ color: CREAM_FAINT }}>
        <div
          className="w-7 h-7 mb-4 animate-spin"
          style={{ border: `1.5px solid ${HAIR_STRONG}`, borderTopColor: AMBER, borderRadius: '50%' }}
        />
        <p className="mono text-[0.62rem] uppercase tracking-[0.24em]">Reading the leaves…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          style={{ color: CREAM_FAINT }}
        />
        <input
          type="text"
          placeholder="Search by name, symbol, or address…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 transition-colors focus:outline-none"
          style={{
            background: 'transparent',
            color: CREAM,
            border: `1px solid ${HAIR_STRONG}`,
            fontFamily: 'var(--font-fraunces, serif)',
            fontSize: '0.9rem',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = AMBER)}
          onBlur={(e) => (e.currentTarget.style.borderColor = HAIR_STRONG)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
            style={{ color: CREAM_FAINT }}
            onMouseEnter={(e) => (e.currentTarget.style.color = AMBER)}
            onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Sort + status */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Quick sort chips */}
        <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
          <span
            className="mono uppercase tracking-[0.22em] text-[0.55rem]"
            style={{ color: CREAM_FAINT }}
          >
            Quick:
          </span>
          {[
            { key: 'priceChange24h' as SortKey, dir: 'desc' as SortDirection, label: 'Gainers', color: FOREST },
            { key: 'priceChange24h' as SortKey, dir: 'asc' as SortDirection, label: 'Losers', color: EARTH },
            { key: 'marketCap' as SortKey, dir: 'desc' as SortDirection, label: 'Mcap', color: AMBER },
            { key: 'age' as SortKey, dir: 'desc' as SortDirection, label: 'Newest', color: PEACH },
          ].map((btn) => {
            const active = sortKey === btn.key && sortDirection === btn.dir;
            return (
              <button
                key={`${btn.key}-${btn.dir}`}
                onClick={() => handleSortOption(btn.key, btn.dir)}
                className="mono uppercase tracking-[0.22em] text-[0.55rem] px-2.5 py-1 transition-colors"
                style={{
                  color: active ? btn.color : CREAM_DIM,
                  background: active ? `${btn.color}15` : 'transparent',
                  border: `1px solid ${active ? `${btn.color}66` : HAIR_STRONG}`,
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = CREAM;
                    e.currentTarget.style.borderColor = AMBER + '88';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = CREAM_DIM;
                    e.currentTarget.style.borderColor = HAIR_STRONG;
                  }
                }}
              >
                {btn.label}
              </button>
            );
          })}
        </div>

        {/* Sort dropdown — shared cosmic component */}
        <div className="flex-1 sm:flex-none sm:w-56">
          <Dropdown
            value={`${sortKey}-${sortDirection}`}
            onChange={(v) => {
              const [key, dir] = v.split('-') as [SortKey, SortDirection];
              handleSortOption(key, dir);
            }}
            options={SORT_DROPDOWN_OPTIONS}
            placeholder="Sort by…"
            compact
          />
        </div>

        {/* Refresh indicator */}
        <div
          className="flex items-center justify-between sm:justify-end gap-3 mono uppercase tracking-[0.22em] text-[0.55rem]"
          style={{ color: CREAM_FAINT }}
        >
          <div className="flex items-center gap-1.5">
            {isLoadingStats ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" style={{ color: AMBER }} />
                <span>Refreshing…</span>
              </>
            ) : (
              <>
                <Clock className="w-3 h-3" />
                <span>{timeAgo}</span>
              </>
            )}
          </div>
          <span className="hidden sm:inline">auto · 30s</span>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: `1px solid ${HAIR_STRONG}` }}>
              <th className="text-left py-3 px-2 w-8">
                <span
                  className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                  style={{ color: CREAM_FAINT }}
                >
                  #
                </span>
              </th>
              <th className="text-left py-3 px-2"><SortHeader label="Token" sortKeyName="name" /></th>
              <th className="text-right py-3 px-2"><SortHeader label="Price" sortKeyName="price" /></th>
              <th className="text-right py-3 px-2"><SortHeader label="24h %" sortKeyName="priceChange24h" /></th>
              <th className="text-right py-3 px-2"><SortHeader label="Mcap" sortKeyName="marketCap" /></th>
              <th className="text-right py-3 px-2"><SortHeader label="Holders" sortKeyName="holders" /></th>
              <th className="text-center py-3 px-2"><SortHeader label="Stage" sortKeyName="stage" /></th>
              <th className="text-center py-3 px-2"><SortHeader label="Type" sortKeyName="projectType" /></th>
              <th className="text-right py-3 px-2"><SortHeader label="Raised" sortKeyName="launchPool" /></th>
              <th className="text-right py-3 px-2"><SortHeader label="Yes %" sortKeyName="yesPercentage" /></th>
              <th className="text-right py-3 px-2"><SortHeader label="Age" sortKeyName="age" /></th>
              <th className="text-center py-3 px-2">
                <span
                  className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                  style={{ color: CREAM_FAINT }}
                >
                  Links
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTokens.map((token, index) => {
              const stats = tokenStats.get(token.tokenAddress);
              const priceChange = stats?.priceChange24h ?? null;
              const isPositive = priceChange !== null && priceChange >= 0;
              const flash = priceFlash.get(token.tokenAddress);
              const stageKey = token.stage?.toLowerCase() || 'idea';
              const stageConfig = STAGE_CONFIG[stageKey] || STAGE_CONFIG['idea'];
              const typeKey = token.projectType?.toLowerCase() || 'application';
              const typeConfig = TYPE_CONFIG[typeKey] || TYPE_CONFIG['application'];

              return (
                <tr
                  key={token.id}
                  onClick={() => router.push(`/market/${token.id}`)}
                  className="cursor-pointer transition-colors group"
                  style={{ borderBottom: `1px solid ${HAIR}` }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'rgba(232,150,96,0.04)')
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="py-3 px-2">
                    <span
                      className="mono text-[0.62rem]"
                      style={{ color: CREAM_FAINT, fontFeatureSettings: '"tnum" on' }}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 flex items-center justify-center overflow-hidden flex-shrink-0"
                        style={{
                          background: 'rgba(232,150,96,0.08)',
                          border: `1px solid ${HAIR_STRONG}`,
                        }}
                      >
                        {token.projectImageUrl ? (
                          <img
                            src={token.projectImageUrl}
                            alt={token.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span
                            className="mono text-[0.6rem]"
                            style={{ color: AMBER, letterSpacing: '0.05em' }}
                          >
                            {token.symbol.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div
                          className="truncate"
                          style={{
                            color: CREAM,
                            fontFamily: 'var(--font-fraunces, serif)',
                            fontSize: '0.92rem',
                            fontWeight: 400,
                          }}
                        >
                          {token.name}
                        </div>
                        <div
                          className="mono text-[0.55rem] uppercase tracking-[0.18em]"
                          style={{ color: AMBER }}
                        >
                          ${token.symbol}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <span
                      className="mono text-[0.78rem] tabular-nums transition-colors"
                      style={{
                        color:
                          flash === 'up'
                            ? FOREST
                            : flash === 'down'
                            ? EARTH
                            : CREAM,
                        background:
                          flash === 'up'
                            ? `${FOREST}1f`
                            : flash === 'down'
                            ? `${EARTH}1f`
                            : 'transparent',
                        padding: flash ? '2px 4px' : '0',
                        fontFeatureSettings: '"tnum" on',
                      }}
                    >
                      {formatPrice(stats?.price ?? null)}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-right">
                    {priceChange !== null && priceChange !== undefined ? (
                      <div
                        className="inline-flex items-center justify-end gap-1 mono text-[0.7rem] tabular-nums"
                        style={{
                          color: isPositive ? FOREST : EARTH,
                          fontFeatureSettings: '"tnum" on',
                        }}
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
                      <span style={{ color: CREAM_FAINT }}>—</span>
                    )}
                  </td>
                  <td
                    className="py-3 px-2 text-right mono text-[0.78rem] tabular-nums"
                    style={{ color: CREAM, fontFeatureSettings: '"tnum" on' }}
                  >
                    {formatLargeNumber(stats?.marketCap ?? null)}
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div
                      className="inline-flex items-center justify-end gap-1 mono text-[0.7rem]"
                      style={{ color: CREAM_DIM }}
                    >
                      <Users className="w-3 h-3" style={{ color: CREAM_FAINT }} />
                      {formatNumber(stats?.holders ?? null)}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span
                      className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                      style={{ color: stageConfig.color }}
                    >
                      {stageConfig.label}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span
                      className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                      style={{ color: typeConfig.color }}
                    >
                      {typeConfig.label}
                    </span>
                  </td>
                  <td
                    className="py-3 px-2 text-right mono text-[0.7rem] tabular-nums"
                    style={{ color: AMBER, fontFeatureSettings: '"tnum" on' }}
                  >
                    {parseFloat(token.launchPool).toFixed(2)} SOL
                  </td>
                  <td
                    className="py-3 px-2 text-right mono text-[0.7rem] tabular-nums"
                    style={{ color: FOREST, fontFeatureSettings: '"tnum" on' }}
                  >
                    {token.yesPercentage}%
                  </td>
                  <td
                    className="py-3 px-2 text-right mono text-[0.62rem] uppercase tracking-[0.18em]"
                    style={{ color: CREAM_FAINT }}
                  >
                    {formatAge(token.launchDate)}
                  </td>
                  <td className="py-3 px-2">
                    <div
                      className="flex items-center justify-center gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ActionBtn
                        onClick={(e) => copyAddress(token.tokenAddress, e)}
                        title="Copy token address"
                      >
                        {copiedAddress === token.tokenAddress ? (
                          <Check className="w-3 h-3" style={{ color: FOREST }} />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </ActionBtn>
                      <ExtLink
                        href={`https://orb.helius.dev/address/${token.tokenAddress}`}
                        title="Token on Helius"
                      >
                        <Wallet className="w-3 h-3" />
                      </ExtLink>
                      <ExtLink
                        href={`https://orb.helius.dev/address/${token.marketAddress}`}
                        title="Market on Helius"
                      >
                        <BarChart3 className="w-3 h-3" />
                      </ExtLink>
                      <ExtLink
                        href={`https://birdeye.so/token/${token.tokenAddress}?chain=solana`}
                        title="Birdeye"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </ExtLink>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {sortedTokens.map((token, index) => {
          const stats = tokenStats.get(token.tokenAddress);
          const priceChange = stats?.priceChange24h ?? null;
          const isPositive = priceChange !== null && priceChange >= 0;
          const flash = priceFlash.get(token.tokenAddress);
          const stageKey = token.stage?.toLowerCase() || 'idea';
          const stageConfig = STAGE_CONFIG[stageKey] || STAGE_CONFIG['idea'];
          const typeKey = token.projectType?.toLowerCase() || 'application';
          const typeConfig = TYPE_CONFIG[typeKey] || TYPE_CONFIG['application'];

          return (
            <div
              key={token.id}
              onClick={() => router.push(`/market/${token.id}`)}
              className="p-4 cursor-pointer transition-colors"
              style={{
                background: 'rgba(244,238,228,0.025)',
                border: `1px solid ${HAIR_STRONG}`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = AMBER + '66')
              }
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = HAIR_STRONG)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span
                    className="mono text-[0.55rem] w-5"
                    style={{ color: CREAM_FAINT }}
                  >
                    {index + 1}
                  </span>
                  <div
                    className="w-10 h-10 flex items-center justify-center overflow-hidden flex-shrink-0"
                    style={{
                      background: 'rgba(232,150,96,0.08)',
                      border: `1px solid ${HAIR_STRONG}`,
                    }}
                  >
                    {token.projectImageUrl ? (
                      <img
                        src={token.projectImageUrl}
                        alt={token.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span
                        className="mono text-[0.7rem]"
                        style={{ color: AMBER, letterSpacing: '0.05em' }}
                      >
                        {token.symbol.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <div
                      style={{
                        color: CREAM,
                        fontFamily: 'var(--font-fraunces, serif)',
                        fontSize: '1rem',
                        fontWeight: 400,
                      }}
                    >
                      {token.name}
                    </div>
                    <div
                      className="mono text-[0.55rem] uppercase tracking-[0.18em]"
                      style={{ color: AMBER }}
                    >
                      ${token.symbol}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="mono text-[0.85rem] tabular-nums transition-colors"
                    style={{
                      color: flash === 'up' ? FOREST : flash === 'down' ? EARTH : CREAM,
                      fontFeatureSettings: '"tnum" on',
                    }}
                  >
                    {formatPrice(stats?.price ?? null)}
                  </div>
                  {priceChange !== null && priceChange !== undefined && (
                    <div
                      className="flex items-center justify-end gap-1 mono text-[0.6rem] tabular-nums"
                      style={{
                        color: isPositive ? FOREST : EARTH,
                        fontFeatureSettings: '"tnum" on',
                      }}
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

              <div className="grid grid-cols-3 gap-1.5 mb-1.5">
                <Stat label="Mcap" value={formatLargeNumber(stats?.marketCap ?? null)} color={CREAM} />
                <Stat label="Holders" value={formatNumber(stats?.holders ?? null)} color={CREAM} />
                <Stat
                  label="Raised"
                  value={`${parseFloat(token.launchPool).toFixed(2)} SOL`}
                  color={AMBER}
                />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Stat label="Stage" value={stageConfig.label} color={stageConfig.color} />
                <Stat label="Type" value={typeConfig.label} color={typeConfig.color} />
                <Stat label="Yes %" value={`${token.yesPercentage}%`} color={FOREST} />
              </div>

              <div
                className="flex items-center justify-between mt-3 pt-3"
                style={{ borderTop: `1px solid ${HAIR}` }}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="mono uppercase tracking-[0.22em] text-[0.5rem]"
                    style={{ color: CREAM_FAINT }}
                  >
                    CA
                  </span>
                  <code
                    className="mono text-[0.6rem]"
                    style={{ color: CREAM_DIM, letterSpacing: '0.02em' }}
                  >
                    {truncateAddress(token.tokenAddress)}
                  </code>
                  <button
                    onClick={(e) => copyAddress(token.tokenAddress, e)}
                    className="p-1"
                    style={{ color: CREAM_FAINT }}
                  >
                    {copiedAddress === token.tokenAddress ? (
                      <Check className="w-3 h-3" style={{ color: FOREST }} />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
                <span
                  className="mono uppercase tracking-[0.22em] text-[0.5rem]"
                  style={{ color: CREAM_FAINT }}
                >
                  {formatAge(token.launchDate)}
                </span>
              </div>

              <div
                className="flex items-center flex-wrap gap-1 mt-3 pt-3"
                style={{ borderTop: `1px solid ${HAIR}` }}
                onClick={(e) => e.stopPropagation()}
              >
                <ExtPill
                  href={`https://orb.helius.dev/address/${token.tokenAddress}`}
                  icon={<Wallet className="w-3 h-3" />}
                  label="Token"
                />
                <ExtPill
                  href={`https://orb.helius.dev/address/${token.marketAddress}`}
                  icon={<BarChart3 className="w-3 h-3" />}
                  label="Market"
                />
                <ExtPill
                  href={`https://birdeye.so/token/${token.tokenAddress}?chain=solana`}
                  icon={<ExternalLink className="w-3 h-3" />}
                  label="Birdeye"
                />
                <ExtPill
                  href={`https://dexscreener.com/solana/${token.tokenAddress}`}
                  icon={<ExternalLink className="w-3 h-3" />}
                  label="DEX"
                />
                <ExtPill
                  href={`https://pump.fun/coin/${token.tokenAddress}`}
                  icon={<ExternalLink className="w-3 h-3" />}
                  label="Pump"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state (search produced no matches) */}
      {sortedTokens.length === 0 && !isLoading && (
        <div
          className="text-center py-12 px-6"
          style={{ background: 'rgba(244,238,228,0.02)', border: `1px solid ${HAIR}` }}
        >
          <BloomIcon className="w-9 h-9 mx-auto mb-3" />
          <p
            className="mono uppercase tracking-[0.22em] text-[0.6rem]"
            style={{ color: CREAM_FAINT }}
          >
            {searchQuery ? 'No tokens match your search' : 'Nothing has bloomed yet'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Tiny helpers ───
function ActionBtn({
  onClick,
  title,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 transition-colors"
      style={{ color: CREAM_FAINT }}
      onMouseEnter={(e) => (e.currentTarget.style.color = AMBER)}
      onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
    >
      {children}
    </button>
  );
}

function ExtLink({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      className="p-1.5 transition-colors"
      style={{ color: CREAM_FAINT }}
      onMouseEnter={(e) => (e.currentTarget.style.color = AMBER)}
      onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
    >
      {children}
    </a>
  );
}

function ExtPill({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mono uppercase tracking-[0.22em] text-[0.55rem] inline-flex items-center gap-1 px-2 py-1 transition-colors"
      style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = AMBER;
        e.currentTarget.style.borderColor = AMBER + '88';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = CREAM_DIM;
        e.currentTarget.style.borderColor = HAIR_STRONG;
      }}
    >
      {icon}
      {label}
    </a>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="px-2 py-1.5 text-center"
      style={{
        background: 'rgba(244,238,228,0.02)',
        border: `1px solid ${HAIR}`,
      }}
    >
      <p
        className="mono uppercase tracking-[0.22em] text-[0.5rem] mb-0.5"
        style={{ color: CREAM_FAINT }}
      >
        {label}
      </p>
      <p
        className="mono text-[0.7rem]"
        style={{ color, fontFeatureSettings: '"tnum" on' }}
      >
        {value}
      </p>
    </div>
  );
}
