'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Filter } from 'lucide-react';
import Link from 'next/link';
import { useVoting } from '@/lib/hooks/useVoting';
import { useAllMarketsSocket } from '@/lib/hooks/useSocket';
import { FEES } from '@/config/solana';
import CountdownTimer from '@/components/CountdownTimer';
import ErrorDialog from '@/components/ErrorDialog';
import { parseError } from '@/lib/utils/errorParser';
import { Skeleton } from '@/components/ui/skeleton';

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

// Get market status from API (single source of truth calculated in backend)
function getMarketStatus(market: Market): { status: string; badgeClass: string } {
  return {
    status: market.displayStatus || '✅ Active',
    badgeClass: market.badgeClass || 'bg-green-500/20 text-green-300 border-green-400/30'
  };
}

// Read vote button states from API (single source of truth)
function isYesVoteDisabled(market: Market): boolean {
  return market.isYesVoteEnabled === false;
}

function isNoVoteDisabled(market: Market): boolean {
  return market.isNoVoteEnabled === false;
}

function getVoteDisabledReason(market: Market, voteType: 'yes' | 'no'): string {
  return voteType === 'yes'
    ? (market.yesVoteDisabledReason || 'Disabled')
    : (market.noVoteDisabledReason || 'Disabled');
}

export default function BrowsePage() {
  const [votingState, setVotingState] = useState<{ marketId: string; voteType: 'yes' | 'no' } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('active'); // 'active', 'resolved', 'all'
  const { vote } = useVoting();

  // Socket.IO for real-time updates
  const { marketUpdates, isConnected } = useAllMarketsSocket();

  // Reduce polling when Socket.IO is connected
  const pollInterval = isConnected ? 60000 : 15000; // 60s when connected, 15s when not

  // Use SWR for data fetching with caching and auto-refresh
  const { data: marketsResponse, error: fetchError, mutate: refetchMarkets } = useSWR(
    `/api/markets/list?status=${selectedStatus}`,
    fetcher,
    {
      refreshInterval: pollInterval,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  // Extract markets and sync health from SWR response
  const loading = !marketsResponse && !fetchError;
  const error = fetchError ? 'Failed to load markets' : (marketsResponse?.success === false ? marketsResponse.error : null);
  const syncHealth = marketsResponse?.data?.syncHealth || null;

  // Merge socket updates with SWR data using useMemo
  const markets = useMemo(() => {
    const baseMarkets: Market[] = marketsResponse?.data?.markets || [];
    if (marketUpdates.size === 0) return baseMarkets;

    return baseMarkets.map((market) => {
      const update = marketUpdates.get(market.marketAddress);
      if (update) {
        return { ...market, ...update };
      }
      return market;
    });
  }, [marketsResponse?.data?.markets, marketUpdates]);

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

  // Filter out hot projects (only for active view) and apply category filter - memoized
  const regularMarkets = useMemo(() => {
    let filtered = markets;

    // Only filter out hot projects when viewing active markets (they're shown separately)
    if (selectedStatus === 'active') {
      const hotProjectIds = hotProjects.map(p => p.id);
      filtered = filtered.filter(m => !hotProjectIds.includes(m.id));
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

    return filtered;
  }, [markets, hotProjects, selectedCategory, selectedStatus]);

  return (
    <div className="pt-2 sm:pt-3 px-3 sm:px-6 pb-6 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-lg sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 tracking-tight">
            Vote on projects. Earn rewards. Shape Web3.
          </h1>
        </div>

        {/* Hot Projects Section - only show for active markets */}
        {!loading && hotProjects.length > 0 && selectedStatus === 'active' && (
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-center space-x-2 sm:space-x-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent"></div>
              <h2 className="text-base sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 flex items-center space-x-1.5 sm:space-x-2 animate-pulse">
                <span className="text-lg sm:text-2xl">🔥</span>
                <span>Hottest Markets</span>
                <span className="text-lg sm:text-2xl">🔥</span>
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent"></div>
            </div>

            <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
              {hotProjects.map((hotProject, index) => {
                // First card: Orange/Red theme, Second card: Purple/Blue theme
                const isFirstCard = index === 0;
                const cardColors = isFirstCard ? {
                  gradient: 'from-orange-500/10 via-red-500/10 to-pink-500/10',
                  border: 'border-orange-500/50',
                  borderHover: 'hover:border-orange-400',
                  shadow: 'shadow-orange-500/20',
                  cornerBorder: 'border-orange-400',
                  imageBg: 'bg-orange-500',
                  imageRing: 'ring-orange-400',
                  imageRingHover: 'group-hover:ring-orange-300',
                  titleHover: 'group-hover:text-orange-300',
                  fallbackGradient: 'from-orange-500/20 to-pink-500/20'
                } : {
                  gradient: 'from-purple-500/10 via-blue-500/10 to-cyan-500/10',
                  border: 'border-purple-500/50',
                  borderHover: 'hover:border-purple-400',
                  shadow: 'shadow-purple-500/20',
                  cornerBorder: 'border-purple-400',
                  imageBg: 'bg-purple-500',
                  imageRing: 'ring-purple-400',
                  imageRingHover: 'group-hover:ring-purple-300',
                  titleHover: 'group-hover:text-purple-300',
                  fallbackGradient: 'from-purple-500/20 to-cyan-500/20'
                };

                return (
                <Link href={`/market/${hotProject.id}`} key={hotProject.id} prefetch={true} className="block">
              <Card className={`relative bg-gradient-to-br ${cardColors.gradient} backdrop-blur-xl border-2 ${cardColors.border} text-white ${cardColors.borderHover} transition-all duration-500 hover:scale-[1.02] group cursor-pointer overflow-hidden shadow-2xl ${cardColors.shadow}`}>
                {/* Animated gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000"></div>

                {/* Pulsing corners */}
                <div className={`absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 ${cardColors.cornerBorder} animate-pulse`}></div>
                <div className={`absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 ${cardColors.cornerBorder} animate-pulse`}></div>
                <div className={`absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 ${cardColors.cornerBorder} animate-pulse`}></div>
                <div className={`absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 ${cardColors.cornerBorder} animate-pulse`}></div>

                <CardHeader className="pb-3 sm:pb-6">
                  <div className="flex items-start justify-between mb-2 sm:mb-3">
                    <div className="flex items-start space-x-2 sm:space-x-3 flex-1">
                      {/* Project Image */}
                      {hotProject.projectImageUrl ? (
                        <div className="flex-shrink-0 relative">
                          <div className={`absolute inset-0 ${cardColors.imageBg} rounded-lg blur-md opacity-50 animate-pulse`}></div>
                          <img
                            src={hotProject.projectImageUrl}
                            alt={hotProject.name}
                            className={`relative w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover ring-2 ${cardColors.imageRing} ${cardColors.imageRingHover} transition-all transform group-hover:scale-110`}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                          <div className={`hidden w-12 h-12 sm:w-16 sm:h-16 rounded-lg bg-gradient-to-br ${cardColors.fallbackGradient} items-center justify-center ring-2 ${cardColors.imageRing} ${cardColors.imageRingHover} transition-all flex-shrink-0`}>
                            <span className="text-xl sm:text-2xl font-bold text-white/70">{hotProject.name.charAt(0)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-lg bg-gradient-to-br ${cardColors.fallbackGradient} flex items-center justify-center ring-2 ${cardColors.imageRing} ${cardColors.imageRingHover} transition-all flex-shrink-0`}>
                          <span className="text-xl sm:text-2xl font-bold text-white/70">{hotProject.name.charAt(0)}</span>
                        </div>
                      )}

                      {/* Project Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 mb-1.5 sm:mb-2 gap-1 sm:gap-0">
                          <CardTitle className={`text-base sm:text-2xl text-white ${cardColors.titleHover} transition-colors line-clamp-2`}>{hotProject.name}</CardTitle>
                          <Badge className={`${getMarketStatus(hotProject).badgeClass} flex-shrink-0 text-xs sm:text-sm w-fit`}>{getMarketStatus(hotProject).status}</Badge>
                        </div>
                        <CardDescription className="text-gray-300 group-hover:text-white transition-colors line-clamp-3 text-xs sm:text-sm">{hotProject.description}</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4">
                  <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2 sm:gap-4">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-gray-400">Category:</span>
                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30 text-xs">{formatLabel(hotProject.category)}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-gray-400">Stage:</span>
                      <span className="text-white text-xs sm:text-sm">{formatLabel(hotProject.stage)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-gray-400">Token:</span>
                      <span className="font-mono font-bold text-white text-xs sm:text-sm">${hotProject.tokenSymbol}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-gray-400">Pool:</span>
                      <span className="font-bold text-white text-xs sm:text-sm">{hotProject.targetPool}</span>
                    </div>
                  </div>

                  {/* Pool Funding Progress */}
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-xs sm:text-sm">
                      <span className="text-gray-400">Pool Progress</span>
                      <span className="text-cyan-400 font-medium">
                        {((hotProject.poolBalance || 0) / 1e9).toFixed(2)} / {hotProject.targetPool}
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5 sm:h-2">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-purple-500 h-1.5 sm:h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(hotProject.poolProgressPercentage || 0, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        {hotProject.totalParticipants ?? 0} participants
                      </span>
                      <span className="text-sm font-bold text-purple-400">
                        {hotProject.poolProgressPercentage || 0}% funded
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs sm:text-sm pt-1.5 sm:pt-2 border-t border-white/10">
                    <span className="text-gray-400">Time Left:</span>
                    <CountdownTimer expiryTime={hotProject.expiryTime} />
                  </div>

                  <div className="flex gap-1.5 sm:gap-2 pt-1.5 sm:pt-2">
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleQuickVote(hotProject, 'yes');
                      }}
                      disabled={votingState !== null || isYesVoteDisabled(hotProject)}
                      className="flex-1 bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      size="sm"
                    >
                      {isYesVoteDisabled(hotProject) ? (
                        getVoteDisabledReason(hotProject, 'yes')
                      ) : votingState?.marketId === hotProject.id && votingState?.voteType === 'yes' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Vote YES'
                      )}
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleQuickVote(hotProject, 'no');
                      }}
                      disabled={votingState !== null || isNoVoteDisabled(hotProject)}
                      variant="outline"
                      className="flex-1 border-white/20 text-white hover:bg-white/10 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      size="sm"
                    >
                      {isNoVoteDisabled(hotProject) ? (
                        getVoteDisabledReason(hotProject, 'no')
                      ) : votingState?.marketId === hotProject.id && votingState?.voteType === 'no' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Vote NO'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
                </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Projects List */}
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl sm:text-3xl font-bold text-white">
                {selectedStatus === 'active' ? 'Live Markets' : selectedStatus === 'resolved' ? 'Resolved Markets' : 'All Markets'}
              </h2>
              {/* Sync Health Indicator */}
              {syncHealth && !syncHealth.healthy && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-full">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                  <span className="text-xs text-yellow-400 font-medium">
                    {syncHealth.staleCount} stale
                  </span>
                </div>
              )}
              {syncHealth?.healthy && isConnected && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  <span className="text-xs text-green-400 font-medium">Live</span>
                </div>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <span className="text-xs sm:text-sm text-gray-400 font-medium hidden sm:inline">Filter:</span>
              </div>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-9 w-[100px] sm:w-[120px] bg-slate-800 border border-white/20 text-white text-sm rounded-lg px-2 sm:px-3 py-1.5 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all appearance-none cursor-pointer"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.5rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em',
                  paddingRight: '2rem'
                }}
              >
                <option value="active" className="bg-slate-800">Active</option>
                <option value="resolved" className="bg-slate-800">Resolved</option>
                <option value="all" className="bg-slate-800">All</option>
              </select>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
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

          {/* Loading State with Skeletons */}
          {loading && (
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="bg-white/5 backdrop-blur-xl border-white/10">
                  <CardHeader>
                    <div className="flex items-start space-x-3 mb-3">
                      <Skeleton className="w-12 h-12 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <div className="space-y-2">
                      <Skeleton className="h-2 w-full rounded-full" />
                      <Skeleton className="h-6 w-24 mx-auto" />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Skeleton className="h-9 flex-1" />
                      <Skeleton className="h-9 flex-1" />
                    </div>
                  </CardContent>
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
          {!loading && !error && markets.length === 0 && (
            <div className="text-center py-12">
              <p className="text-white/70 text-lg mb-4">No active markets yet.</p>
              <p className="text-white/50 mb-6">Be the first to launch a prediction market!</p>
              <Button asChild className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                <Link href="/create" prefetch={true}>Launch Your Project</Link>
              </Button>
            </div>
          )}

          {/* Show empty state for regular markets if only hot project exists */}
          {!loading && !error && markets.length > 0 && regularMarkets.length === 0 && (
            <div className="text-center py-12">
              <p className="text-white/70 text-lg mb-4">All markets are featured above!</p>
              <p className="text-white/50 mb-6">Check back soon for more exciting projects.</p>
              <Button asChild className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                <Link href="/create" prefetch={true}>Launch Your Project</Link>
              </Button>
            </div>
          )}

          {/* Markets Grid */}
          {!loading && !error && regularMarkets.length > 0 && (
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {regularMarkets.map((project) => {
                const marketStatus = getMarketStatus(project);

                return (
              <Link href={`/market/${project.id}`} key={project.id} prefetch={true} className="block">
              <Card className="bg-white/5 backdrop-blur-xl border-white/10 text-white hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] group cursor-pointer h-full flex flex-col">
                <CardHeader className="pb-3 sm:pb-6">
                  <div className="flex items-start justify-between mb-2 sm:mb-3">
                    <div className="flex items-start space-x-2 sm:space-x-3 flex-1">
                      {/* Project Image */}
                      {project.projectImageUrl ? (
                        <div className="flex-shrink-0">
                          <img
                            src={project.projectImageUrl}
                            alt={project.name}
                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover ring-2 ring-white/10 group-hover:ring-cyan-300/50 transition-all"
                            onError={(e) => {
                              // Fallback if image fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const fallback = target.nextElementSibling as HTMLElement;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                          <div className="hidden w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 items-center justify-center ring-2 ring-white/10 group-hover:ring-cyan-300/50 transition-all flex-shrink-0">
                            <span className="text-base sm:text-lg font-bold text-white/70">{project.name.charAt(0)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center ring-2 ring-white/10 group-hover:ring-cyan-300/50 transition-all flex-shrink-0">
                          <span className="text-base sm:text-lg font-bold text-white/70">{project.name.charAt(0)}</span>
                        </div>
                      )}

                      {/* Project Info */}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base sm:text-xl text-white group-hover:text-cyan-300 transition-colors line-clamp-2">{project.name}</CardTitle>
                        <CardDescription className="mt-0.5 sm:mt-1 text-gray-300 group-hover:text-white transition-colors line-clamp-3 text-xs sm:text-sm">{project.description}</CardDescription>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <Badge className={`${marketStatus.badgeClass} ml-1.5 sm:ml-2 flex-shrink-0 text-xs`}>{marketStatus.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4">
                  <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2 sm:gap-3">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-gray-400">Category:</span>
                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30 text-xs">{formatLabel(project.category)}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-gray-400">Stage:</span>
                      <span className="text-white text-xs sm:text-sm">{formatLabel(project.stage)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-gray-400">Token:</span>
                      <span className="font-mono font-bold text-white text-xs sm:text-sm">${project.tokenSymbol}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="text-gray-400">Pool:</span>
                      <span className="font-bold text-white text-xs sm:text-sm">{project.targetPool}</span>
                    </div>
                  </div>

                  {/* Pool Funding Progress */}
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex justify-between items-center text-xs sm:text-sm">
                      <span className="text-gray-400">Pool Progress</span>
                      <span className="text-cyan-400 font-medium">
                        {((project.poolBalance || 0) / 1e9).toFixed(2)} / {project.targetPool}
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5 sm:h-2">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-purple-500 h-1.5 sm:h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(project.poolProgressPercentage || 0, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        {project.totalParticipants ?? 0} participants
                      </span>
                      <span className="text-sm font-bold text-purple-400">
                        {project.poolProgressPercentage || 0}% funded
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-gray-400">Time Left:</span>
                    <CountdownTimer expiryTime={project.expiryTime} />
                  </div>

                  <div className="flex gap-1.5 sm:gap-2 pt-1.5 sm:pt-2">
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleQuickVote(project, 'yes');
                      }}
                      disabled={votingState !== null || isYesVoteDisabled(project)}
                      className="flex-1 bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm px-2 sm:px-4"
                      size="sm"
                    >
                      {isYesVoteDisabled(project) ? (
                        <span className="truncate">{getVoteDisabledReason(project, 'yes')}</span>
                      ) : votingState?.marketId === project.id && votingState?.voteType === 'yes' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <><span className="hidden sm:inline">Vote </span><span>YES</span></>
                      )}
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleQuickVote(project, 'no');
                      }}
                      disabled={votingState !== null || isNoVoteDisabled(project)}
                      variant="outline"
                      className="flex-1 border-white/20 text-white hover:bg-white/10 hover:border-white/30 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm px-2 sm:px-4"
                      size="sm"
                    >
                      {isNoVoteDisabled(project) ? (
                        <span className="truncate">{getVoteDisabledReason(project, 'no')}</span>
                      ) : votingState?.marketId === project.id && votingState?.voteType === 'no' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <><span className="hidden sm:inline">Vote </span><span>NO</span></>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              </Link>
                );
              })}
          </div>
          )}
        </div>

        {/* Call to Action */}
        <div className="text-center space-y-3 sm:space-y-4 py-8 sm:py-12">
          <h2 className="text-xl sm:text-3xl font-bold text-white">Don&apos;t See Your Project?</h2>
          <p className="text-white/70 text-sm sm:text-base px-4">
            Launch your own prediction market and let the community decide if your project should get a token.
          </p>
          <div className="flex justify-center">
            <Link
              href="/create"
              prefetch={true}
              className="inline-flex items-center justify-center px-6 sm:px-8 py-2.5 sm:py-3 text-base sm:text-lg font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500 rounded-md hover:from-purple-600 hover:to-pink-600 transition-all duration-200 hover:scale-105 cursor-pointer"
            >
              Launch Your Project
            </Link>
          </div>
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
