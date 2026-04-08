'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Filter, Users, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useVoting } from '@/lib/hooks/useVoting';
import { useAllMarketsSocket } from '@/lib/hooks/useSocket';
import { FEES } from '@/config/solana';
import CountdownTimer from '@/components/CountdownTimer';
import ErrorDialog from '@/components/ErrorDialog';
import { parseError } from '@/lib/utils/errorParser';
import { Skeleton } from '@/components/ui/skeleton';
import { getVoteButtonStates, getMarketDisplayStatus } from '@/lib/api-utils';
import { useWallet } from '@/hooks/useWallet';

// SWR fetcher
const fetcher = (url: string) => fetch(url).then(res => res.json());

interface Market {
  id: string;
  marketAddress: string;
  name: string;
  description: string;
  category: string;
  stage: string;
  tokenSymbol: string;
  targetPool: string;
  yesVotes: number | null; // null for unresolved markets (hidden)
  noVotes: number | null; // null for unresolved markets (hidden)
  totalYesStake: number | null;
  totalNoStake: number | null;
  totalParticipants?: number; // Total participants (visible even when vote data hidden)
  timeLeft: string;
  expiryTime: string;
  status: string;
  metadataUri?: string;
  projectImageUrl?: string;
  yesPercentage?: number | null; // null for unresolved markets (hidden)
  noPercentage?: number | null; // null for unresolved markets (hidden)
  // On-chain fields from MongoDB (synced via WebSocket)
  resolution?: string;
  phase?: string;
  poolProgressPercentage?: number;
  poolBalance?: number;
  tokenMint?: string | null;
  pumpFunTokenAddress?: string | null;
  // Display status (calculated in API, single source of truth)
  displayStatus?: string;
  badgeClass?: string;
  // Vote button states (calculated in API, single source of truth)
  isYesVoteEnabled?: boolean;
  isNoVoteEnabled?: boolean;
  yesVoteDisabledReason?: string;
  noVoteDisabledReason?: string;
  // Sync status (for staleness detection)
  lastSyncedAt?: string | null;
  isStale?: boolean;
  syncStatus?: string;
}

interface SyncHealth {
  healthy: boolean;
  staleCount: number;
  totalCount: number;
  message: string;
}

// Format category and stage for proper display
function formatLabel(value: string): string {
  const uppercaseValues: { [key: string]: string } = {
    'dao': 'DAO',
    'nft': 'NFT',
    'ai': 'AI/ML',
    'defi': 'DeFi',
    'mvp': 'MVP',
    'realestate': 'Real Estate',
    'real estate': 'Real Estate'
  };

  if (uppercaseValues[value.toLowerCase()]) {
    return uppercaseValues[value.toLowerCase()];
  }

  // Capitalize first letter of each word
  return value
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Calculate market status using real-time data (recalculates when socket updates arrive)
function getMarketStatus(market: Market): { status: string; badgeClass: string } {
  // Convert phase to number if it's a string
  const phase = typeof market.phase === 'string'
    ? (market.phase === 'Funding' ? 1 : 0)
    : (market.phase ?? 0);

  const computed = getMarketDisplayStatus({
    resolution: market.resolution,
    phase,
    poolProgressPercentage: market.poolProgressPercentage,
    expiryTime: market.expiryTime,
    tokenMint: market.tokenMint,
    pumpFunTokenAddress: market.pumpFunTokenAddress,
  });

  return {
    status: computed.displayStatus,
    badgeClass: computed.badgeClass
  };
}

// Calculate vote button states using real-time data (recalculates when socket updates arrive)
function getComputedVoteButtonStates(market: Market) {
  // Convert phase to number if it's a string
  const phase = typeof market.phase === 'string'
    ? (market.phase === 'Funding' ? 1 : 0)
    : (market.phase ?? 0);

  return getVoteButtonStates({
    resolution: market.resolution,
    phase,
    poolProgressPercentage: market.poolProgressPercentage,
    expiryTime: market.expiryTime,
    tokenMint: market.tokenMint,
    pumpFunTokenAddress: market.pumpFunTokenAddress,
  });
}

function isYesVoteDisabled(market: Market): boolean {
  const states = getComputedVoteButtonStates(market);
  return !states.isYesVoteEnabled;
}

function isNoVoteDisabled(market: Market): boolean {
  const states = getComputedVoteButtonStates(market);
  return !states.isNoVoteEnabled;
}

function getVoteDisabledReason(market: Market, voteType: 'yes' | 'no'): string {
  const states = getComputedVoteButtonStates(market);
  return voteType === 'yes'
    ? (states.yesVoteDisabledReason || 'Disabled')
    : (states.noVoteDisabledReason || 'Disabled');
}

const ITEMS_PER_PAGE_OPTIONS = [25, 50, 100];

export default function BrowsePage() {
  const [votingState, setVotingState] = useState<{ marketId: string; voteType: 'yes' | 'no' } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const { vote } = useVoting();
  const { primaryWallet } = useWallet();
  const walletAddress = primaryWallet?.address || null;

  // Fetch user positions for "You voted" badges
  const { data: positionsData } = useSWR(
    walletAddress ? `/api/user/${walletAddress}/positions` : null,
    fetcher,
    { refreshInterval: 60000, dedupingInterval: 15000 }
  );
  const userPositions = useMemo(() => {
    const map = new Map<string, { side: string; amount: number }>();
    if (positionsData?.data?.positions) {
      for (const p of positionsData.data.positions) {
        const side = Number(p.yesShares || 0) > Number(p.noShares || 0) ? 'YES' : 'NO';
        const amount = (Number(p.totalInvested || 0)) / 1e9;
        if (p.marketAddress) map.set(p.marketAddress, { side, amount });
      }
    }
    return map;
  }, [positionsData]);

  // Socket.IO for real-time updates
  const { marketUpdates, newMarkets, clearNewMarkets, isConnected } = useAllMarketsSocket();

  // Track which markets are newly added (for animation)
  const [animatingMarketIds, setAnimatingMarketIds] = useState<Set<string>>(new Set());

  // Reduce polling when Socket.IO is connected
  const pollInterval = isConnected ? 60000 : 15000; // 60s when connected, 15s when not

  // Use SWR for data fetching with caching and auto-refresh
  const { data: marketsResponse, error: fetchError, mutate: refetchMarkets } = useSWR(
    `/api/markets/list?status=${selectedStatus}&page=${page}&limit=${itemsPerPage}`,
    fetcher,
    {
      refreshInterval: pollInterval,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  // Extract markets, sync health, and pagination from SWR response
  const loading = !marketsResponse && !fetchError;
  const error = fetchError ? 'Failed to load markets' : (marketsResponse?.success === false ? marketsResponse.error : null);
  const syncHealth = marketsResponse?.data?.syncHealth || null;
  const totalCount = marketsResponse?.data?.totalCount || 0;
  const pagination = marketsResponse?.data?.pagination || { page: 1, limit: 25, totalPages: 1, hasMore: false };

  // Handle category/status change - reset to page 1
  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setPage(1);
  };

  // Handle items per page change - reset to page 1
  const handleItemsPerPageChange = (newLimit: number) => {
    setItemsPerPage(newLimit);
    setPage(1);
  };

  // Pagination display helpers
  const startItem = totalCount > 0 ? (page - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(page * itemsPerPage, totalCount);

  // Merge socket updates with SWR data using useMemo
  const markets = useMemo(() => {
    const baseMarkets: Market[] = marketsResponse?.data?.markets || [];

    // First merge any socket updates
    let mergedMarkets = baseMarkets.map((market) => {
      const update = marketUpdates.get(market.marketAddress);
      if (update) {
        // For RESOLVED markets: preserve final pool values (don't overwrite with 0)
        // The API returns finalPoolBalance/finalPoolProgressPercentage for resolved markets
        const isResolved = market.resolution && market.resolution !== 'Unresolved';
        if (isResolved) {
          // Don't let socket updates overwrite pool data for resolved markets
          const { poolBalance, poolProgressPercentage, ...safeUpdate } = update as any;
          return { ...market, ...safeUpdate };
        }
        return { ...market, ...update };
      }
      return market;
    });

    // Then add new markets from socket (that aren't already in the list)
    if (newMarkets.length > 0 && selectedStatus === 'active') {
      const existingIds = new Set(mergedMarkets.map(m => m.id));
      const existingAddresses = new Set(mergedMarkets.map(m => m.marketAddress));

      const newMarketsToAdd = newMarkets.filter(m =>
        !existingIds.has(m.id) && !existingAddresses.has(m.marketAddress)
      );

      if (newMarketsToAdd.length > 0) {
        // Add new markets at the beginning
        mergedMarkets = [...newMarketsToAdd, ...mergedMarkets];
      }
    }

    return mergedMarkets;
  }, [marketsResponse?.data?.markets, marketUpdates, newMarkets, selectedStatus]);

  // Handle animation for new markets
  useEffect(() => {
    if (newMarkets.length > 0) {
      // Add new market IDs to animating set
      const newIds = new Set(newMarkets.map(m => m.id));
      setAnimatingMarketIds(prev => new Set([...prev, ...newIds]));

      // Remove animation class after animation completes (2s)
      const timeout = setTimeout(() => {
        setAnimatingMarketIds(prev => {
          const next = new Set(prev);
          newIds.forEach(id => next.delete(id));
          return next;
        });
        // Clear the new markets after animation
        clearNewMarkets();
      }, 2000);

      return () => clearTimeout(timeout);
    }
  }, [newMarkets, clearNewMarkets]);

  // Error dialog state
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    details?: string;
  }>({
    open: false,
    title: '',
    message: '',
    details: undefined,
  });

  // Categories for filtering
  const categories = [
    'All',
    // Web3 & Crypto
    'DeFi', 'Gaming', 'NFT', 'AI/ML', 'Social', 'Infrastructure', 'DAO', 'Meme', 'Creator',
    // Traditional Markets
    'Healthcare', 'Science', 'Education', 'Finance', 'Commerce', 'Real Estate', 'Energy', 'Media', 'Manufacturing', 'Mobility',
    'Other'
  ];

  // Minimum vote amount from config
  const QUICK_VOTE_AMOUNT = FEES.MINIMUM_INVESTMENT / 1_000_000_000; // 0.01 SOL

  const handleQuickVote = async (market: Market, voteType: 'yes' | 'no') => {
    setVotingState({ marketId: market.id, voteType });

    const result = await vote({
      marketId: market.id,
      marketAddress: market.marketAddress,
      voteType,
      amount: QUICK_VOTE_AMOUNT,
    });

    setVotingState(null);

    if (result.success) {
      // Success - Socket.IO will handle the real-time update
      // Don't call fetchMarkets() to avoid race condition with blockchain sync
    } else {
      // Error - show error dialog
      const parsedError = parseError(result.error);
      setErrorDialog({
        open: true,
        title: parsedError.title,
        message: parsedError.message,
        details: parsedError.details,
      });
    }
  };
  // Get hot projects - memoized to avoid recalculation on every render
  const hotProjects = useMemo(() => {
    if (markets.length === 0) return [];

    // First try to get active/live markets
    const activeMarkets = markets.filter(m => {
      const status = getMarketStatus(m);
      return status.status === '✅ Active' || status.status === '🎯 Pool Complete';
    });

    // Sort by total participants (works even when individual vote counts are hidden)
    const sortByVotes = (a: Market, b: Market) => {
      const aVotes = a.totalParticipants ?? ((a.yesVotes ?? 0) + (a.noVotes ?? 0));
      const bVotes = b.totalParticipants ?? ((b.yesVotes ?? 0) + (b.noVotes ?? 0));
      return bVotes - aVotes;
    };

    // If we have active markets, use them. Otherwise use all markets
    const marketsToUse = activeMarkets.length > 0 ? activeMarkets : markets;

    // Return top 2
    return [...marketsToUse].sort(sortByVotes).slice(0, 2);
  }, [markets]);

  // Get hot project IDs for highlighting in the grid
  const hotProjectIds = useMemo(() => {
    return new Set(hotProjects.map(p => p.id));
  }, [hotProjects]);

  // All markets with category filter applied (hot projects now included in grid)
  const filteredMarkets = useMemo(() => {
    let filtered = markets;

    // Apply text search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.name?.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q) ||
        m.tokenSymbol?.toLowerCase().includes(q) ||
        m.category?.toLowerCase().includes(q)
      );
    }

    // Apply category filter
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(m => {
        const categoryLower = m.category.toLowerCase();
        const selectedLower = selectedCategory.toLowerCase();
        return categoryLower === selectedLower ||
               (selectedCategory === 'AI/ML' && (categoryLower === 'ai/ml' || categoryLower === 'ai'));
      });
    }

    // Sort hot projects to the top when viewing active markets
    if (selectedStatus === 'active') {
      filtered = [...filtered].sort((a, b) => {
        const aIsHot = hotProjectIds.has(a.id) ? 1 : 0;
        const bIsHot = hotProjectIds.has(b.id) ? 1 : 0;
        return bIsHot - aIsHot; // Hot projects first
      });
    }

    return filtered;
  }, [markets, hotProjectIds, selectedCategory, selectedStatus, searchQuery]);

  return (
    <div className="pt-2 sm:pt-3 px-3 sm:px-6 pb-6 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-lg sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 tracking-tight">
            Vote on projects. Earn rewards. Shape Web3.
          </h1>
          {totalCount > 0 && (
            <p className="text-sm text-gray-400 mt-1">
              {totalCount} market{totalCount !== 1 ? 's' : ''} available
            </p>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search markets by name, description, or token..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 bg-slate-800/80 border border-white/10 text-white text-sm rounded-xl pl-10 pr-10 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all placeholder:text-gray-500"
          />
          <svg className="absolute left-3 top-3 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-3 text-gray-500 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* Filter Bar - Controls all markets */}
        <div className="space-y-3 sm:space-y-4">
          {/* Status Tab Buttons */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {[
                { value: 'active', label: 'Live Markets' },
                { value: 'yesWins', label: 'Wins' },
                { value: 'noWins', label: 'No Wins' },
                { value: 'expired', label: 'Expired' },
                { value: 'refund', label: 'Refunded' },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => handleStatusChange(tab.value)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                    selectedStatus === tab.value
                      ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-500/25'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Category Filter Dropdown */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
                className="h-9 w-[100px] sm:w-[140px] bg-slate-800 border border-white/20 text-white text-sm rounded-lg px-2 sm:px-3 py-1.5 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.5rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em',
                  paddingRight: '2rem'
                }}
              >
                {categories.map((category) => (
                  <option key={category} value={category} className="bg-slate-800">
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Projects List */}
        <div className="space-y-4 sm:space-y-6">
          {/* Loading State with Skeletons */}
          {loading && (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <Card key={i} className="bg-white/5 backdrop-blur-xl border-white/10">
                  <div className="p-3">
                    <div className="flex items-start gap-2.5 mb-2">
                      <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                    <div className="flex gap-1.5 mb-3">
                      <Skeleton className="h-4 w-12 rounded" />
                      <Skeleton className="h-4 w-10 rounded" />
                      <Skeleton className="h-4 w-14 rounded ml-auto" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full mb-1.5" />
                    <div className="flex justify-between mb-3">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-8" />
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <div className="flex gap-1.5">
                      <Skeleton className="h-7 flex-1" />
                      <Skeleton className="h-7 flex-1" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="text-center py-12">
              <p className="text-red-400 mb-4">{error}</p>
              <Button onClick={() => refetchMarkets()} variant="outline" className="border-white/20 text-white hover:bg-white/10">
                Retry
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredMarkets.length === 0 && (
            <div className="text-center py-12">
              <p className="text-white/70 text-lg mb-4">
                {markets.length === 0 ? 'No active markets yet.' : 'No markets match your filter.'}
              </p>
              <p className="text-white/50 mb-6">
                {markets.length === 0 ? 'Be the first to launch a prediction market!' : 'Try a different category or check back later.'}
              </p>
              <Button asChild className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                <Link href="/create" prefetch={true}>Launch Your Project</Link>
              </Button>
            </div>
          )}

          {/* Markets Grid */}
          {!loading && !error && filteredMarkets.length > 0 && (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredMarkets.map((project) => {
                const marketStatus = getMarketStatus(project);
                const isActionable = !isYesVoteDisabled(project) || !isNoVoteDisabled(project);
                const poolPercent = project.poolProgressPercentage || 0;
                const isHot = selectedStatus === 'active' && hotProjectIds.has(project.id);
                const isNewMarket = animatingMarketIds.has(project.id);

                return (
              <Link href={`/market/${project.id}`} key={project.id} prefetch={true} className="block">
              <Card className={`backdrop-blur-xl text-white transition-all duration-200 group cursor-pointer h-full flex flex-col ${
                isNewMarket
                  ? 'animate-new-market ring-2 ring-green-400/60 bg-gradient-to-br from-green-500/15 via-transparent to-cyan-500/15 border-green-500/40'
                  : isHot
                    ? 'bg-gradient-to-br from-orange-500/10 via-transparent to-pink-500/10 border-orange-500/30 hover:border-orange-400/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
              }`}>
                {/* Compact Header */}
                <div className="p-3 pb-2">
                  <div className="flex items-start gap-2.5">
                    {/* Project Image - Smaller */}
                    {project.projectImageUrl ? (
                      <img
                        src={project.projectImageUrl}
                        alt={project.name}
                        className="w-9 h-9 rounded-lg object-cover ring-1 ring-white/10 group-hover:ring-cyan-400/40 transition-all flex-shrink-0"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className={`${project.projectImageUrl ? 'hidden' : 'flex'} w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500/30 to-pink-500/30 items-center justify-center ring-1 ring-white/10 flex-shrink-0`}>
                      <span className="text-sm font-bold text-white/70">{project.name.charAt(0)}</span>
                    </div>

                    {/* Title & Token */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <h3 className="font-semibold text-sm text-white group-hover:text-cyan-300 transition-colors truncate capitalize">{project.name}</h3>
                        <span className="text-xs font-mono text-cyan-400 flex-shrink-0">${project.tokenSymbol}</span>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-1">{project.description}</p>
                    </div>
                  </div>

                  {/* Tags Row - Category, Stage, Status */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {isNewMarket && (
                      <Badge className="bg-green-500/20 text-green-400 border-green-400/30 text-[10px] px-1.5 py-0 flex items-center gap-0.5 animate-pulse">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                        NEW
                      </Badge>
                    )}
                    {isHot && !isNewMarket && (
                      <Badge className="bg-orange-500/20 text-orange-400 border-orange-400/30 text-[10px] px-1.5 py-0 flex items-center gap-0.5">
                        <TrendingUp className="w-2.5 h-2.5" />
                        Hot
                      </Badge>
                    )}
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30 text-[10px] px-1.5 py-0">{formatLabel(project.category)}</Badge>
                    <Badge className="bg-white/10 text-gray-300 border-white/10 text-[10px] px-1.5 py-0">{formatLabel(project.stage)}</Badge>
                    <Badge className={`${marketStatus.badgeClass} text-[10px] px-1.5 py-0 ml-auto`}>{marketStatus.status}</Badge>
                  </div>
                </div>

                {/* Progress Section */}
                <div className="px-3 pb-2">
                  {/* Progress Bar - More prominent */}
                  <div className="w-full bg-gray-800/80 rounded-full h-2 overflow-hidden relative mb-1.5">
                    <div
                      className="absolute inset-0 rounded-full blur-sm opacity-40"
                      style={{
                        width: `${Math.min(poolPercent, 100)}%`,
                        background: 'linear-gradient(90deg, #06b6d4, #a855f7)'
                      }}
                    />
                    <div
                      className="relative h-full rounded-full transition-all duration-500 overflow-hidden"
                      style={{
                        width: `${Math.min(poolPercent, 100)}%`,
                        background: 'linear-gradient(90deg, #06b6d4, #8b5cf6, #a855f7)'
                      }}
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                          animation: 'shimmer 2s infinite'
                        }}
                      />
                    </div>
                  </div>

                  {/* Stats Row - Compact */}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">
                      <span className="text-cyan-400 font-medium">{((project.poolBalance || 0) / 1e9).toFixed(2)}</span>
                      <span className="text-gray-500"> / {project.targetPool}</span>
                    </span>
                    <span className="font-semibold text-purple-400">{poolPercent}%</span>
                  </div>
                </div>

                {/* Footer - Time & Participants */}
                <div className="px-3 pb-2 mt-auto">
                  <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{project.totalParticipants ?? 0}</span>
                    </div>
                    <CountdownTimer expiryTime={project.expiryTime} className="text-[11px]" />
                  </div>

                  {/* Position badge — "You voted YES/NO" */}
                  {(() => {
                    const pos = userPositions.get(project.marketAddress);
                    if (!pos) return null;
                    return (
                      <div className={`flex items-center gap-1 text-[10px] font-medium mb-1.5 px-2 py-0.5 rounded-md ${
                        pos.side === 'YES' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        <span>{pos.side === 'YES' ? '↑' : '↓'}</span>
                        <span>You voted {pos.side} — {pos.amount.toFixed(3)} SOL</span>
                      </div>
                    );
                  })()}

                  {/* Adaptive Action Buttons — vote / trade / resolved badge */}
                  {(() => {
                    const isResolved = project.resolution && project.resolution !== 'Unresolved';
                    const tokenMint = (project as any).tokenMint || (project as any).pumpFunTokenAddress;
                    const isTokenLaunched = isResolved && project.resolution === 'YesWins' && !!tokenMint;

                    if (isTokenLaunched) {
                      return (
                        <div className="flex gap-1.5">
                          <Button className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-[11px] h-7 px-2" size="sm">
                            + {project.tokenSymbol || 'BUY'}
                          </Button>
                          <Button variant="outline" className="flex-1 border-white/20 text-white hover:bg-white/10 text-[11px] h-7 px-2" size="sm">
                            − {project.tokenSymbol || 'SELL'}
                          </Button>
                        </div>
                      );
                    }
                    if (isResolved) {
                      return (
                        <div className="flex items-center justify-center gap-1.5 py-1 px-3 rounded-lg bg-white/5 text-[11px]">
                          <span className={project.resolution === 'YesWins' ? 'text-green-400' : project.resolution === 'NoWins' ? 'text-red-400' : 'text-yellow-400'}>
                            {project.resolution === 'YesWins' ? '✓ Launched' : project.resolution === 'NoWins' ? '✗ Failed' : '↩ Refunded'}
                          </span>
                        </div>
                      );
                    }
                    if (isActionable) {
                      return (
                        <div className="flex gap-1.5">
                          <Button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleQuickVote(project, 'yes'); }}
                            disabled={votingState !== null || isYesVoteDisabled(project)}
                            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-40 text-[11px] h-7 px-2"
                            size="sm"
                          >
                            {votingState?.marketId === project.id && votingState?.voteType === 'yes' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'YES'}
                          </Button>
                          <Button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleQuickVote(project, 'no'); }}
                            disabled={votingState !== null || isNoVoteDisabled(project)}
                            variant="outline"
                            className="flex-1 border-white/20 text-white hover:bg-white/10 disabled:opacity-40 text-[11px] h-7 px-2"
                            size="sm"
                          >
                            {votingState?.marketId === project.id && votingState?.voteType === 'no' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'NO'}
                          </Button>
                        </div>
                      );
                    }
                    return (
                      <Button variant="outline" className="w-full border-white/10 text-gray-300 hover:bg-white/5 hover:text-white text-[11px] h-7" size="sm">
                        View Details
                      </Button>
                    );
                  })()}
                </div>
              </Card>
              </Link>
                );
              })}
          </div>
          )}

          {/* Pagination Controls - only show when there are more items than smallest page size */}
          {totalCount > ITEMS_PER_PAGE_OPTIONS[0] && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/10">
              {/* Items per page */}
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>Show</span>
                <div className="flex items-center gap-1">
                  {ITEMS_PER_PAGE_OPTIONS.map(option => (
                    <button
                      key={option}
                      onClick={() => handleItemsPerPageChange(option)}
                      className={`px-2.5 py-1 rounded text-sm font-medium transition-colors ${
                        itemsPerPage === option
                          ? 'bg-cyan-500 text-white'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <span>per page</span>
              </div>

              {/* Page info */}
              <div className="text-sm text-gray-400">
                Showing {startItem}-{endItem} of {totalCount}
              </div>

              {/* Page navigation */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="border-white/10 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                >
                  First
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-white/10 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= pagination.totalPages - 2) {
                      pageNum = pagination.totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                          page === pageNum
                            ? 'bg-cyan-500 text-white'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={!pagination.hasMore}
                  className="border-white/10 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(pagination.totalPages)}
                  disabled={page === pagination.totalPages}
                  className="border-white/10 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                >
                  Last
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Error Dialog */}
        <ErrorDialog
          open={errorDialog.open}
          onClose={() => setErrorDialog({ ...errorDialog, open: false })}
          title={errorDialog.title}
          message={errorDialog.message}
          details={errorDialog.details}
        />
      </div>
  );
}
