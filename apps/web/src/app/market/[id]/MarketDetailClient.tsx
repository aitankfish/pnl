'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { safeExternalUrl } from '@/lib/safe-url';
import dynamic from 'next/dynamic';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2, ArrowLeft, ExternalLink, Users, Target, MapPin, Globe, Github, MessageCircle, Share2, Heart, FileText, Copy, Check, Sparkles, X, BarChart3, Pencil } from 'lucide-react';
import { MarketMediaEditModal } from '@/components/market/MarketMediaEditModal';
import Link from 'next/link';
import { FEES, SOLANA_NETWORK } from '@/config/solana';
import { useVoting } from '@/lib/hooks/useVoting';
import { useClaiming } from '@/lib/hooks/useClaiming';
import { useResolution } from '@/lib/hooks/useResolution';
import { useExtend } from '@/lib/hooks/useExtend';
import { useTeamVesting } from '@/lib/hooks/useTeamVesting';
import { useFounderSolVesting } from '@/lib/hooks/useFounderSolVesting';
import { useClose } from '@/lib/hooks/useClose';
import { useNetwork } from '@/lib/hooks/useNetwork';
import { getPositionPDA, getMarketVaultPDA } from '@/lib/anchor-program';
import { PublicKey } from '@solana/web3.js';
import CountdownTimer from '@/components/CountdownTimer';
import MarketImage from '@/components/MarketImage';
import ProvenanceBlock from '@/components/ProvenanceBlock';
import { parseError } from '@/lib/utils/errorParser';
import { useWallet } from '@/hooks/useWallet';
import { useSolBalance } from '@/lib/hooks/useSolBalance';
import { formatCategoryLabel } from '@/lib/categories';
import { useAuthModal } from '@/contexts/AuthModalContext';
import useSWR from 'swr';
import ErrorDialog from '@/components/ErrorDialog';
import SuccessDialog from '@/components/SuccessDialog';
import { useMarketSocket, useUserSocket } from '@/lib/hooks/useSocket';
import { MarketCitations } from '@/components/research/MarketCitations';
import { ProjectUpdates } from '@/components/market/ProjectUpdates';
import { MilestoneRoadmap } from '@/components/market/MilestoneRoadmap';
import { GitDigest } from '@/components/market/GitDigest';
import { TokenLaunchAnimation } from '@/components/TokenLaunchAnimation';
import { getVoteButtonStates, getMarketDisplayStatus } from '@/lib/api-utils';
import {
  SeedIcon,
  TreeIcon,
  BloomIcon,
  LeafIcon,
  RootIcon,
  SunIcon,
} from '@/components/PlantIcons';

// ── Cosmic-plant palette (shared across the app) ──
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

// Cosmic-themed skeleton for dynamic imports — hairline border, soft cream
// shimmer instead of generic pulse. Centralized so every lazy component
// shares one loading aesthetic.
const skel = (height: string) => (
  <div
    className="animate-pulse"
    style={{
      height,
      background: 'rgba(244,238,228,0.025)',
      border: '1px solid rgba(244,238,228,0.08)',
    }}
  />
);

// Lazy load heavy components to reduce initial bundle size
const LiveActivityFeed = dynamic(() => import('@/components/LiveActivityFeed'), {
  loading: () => skel('24rem'),
  ssr: false,
});

const MarketHolders = dynamic(() => import('@/components/MarketHolders'), {
  loading: () => skel('24rem'),
  ssr: false,
});

const GrokRoast = dynamic(() => import('@/components/GrokRoast'), {
  loading: () => skel('16rem'),
  ssr: false,
});

// CommunityHub (chat + voice) now lives in the conviction rail's "Community"
// tab, so the desktop FloatingVoicePanel overlay is suppressed on market pages.
const CommunityHub = dynamic(() => import('@/components/chat/CommunityHub'), {
  loading: () => skel('24rem'),
  ssr: false,
});

const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), {
  loading: () => skel('16rem'),
  ssr: false,
});

const TokenTrading = dynamic(() => import('@/components/TokenTrading').then(mod => ({ default: mod.TokenTrading })), {
  loading: () => skel('24rem'),
  ssr: false,
});

const TokenStatsBar = dynamic(() => import('@/components/TokenStatsBar').then(mod => ({ default: mod.TokenStatsBar })), {
  loading: () => skel('4rem'),
  ssr: false,
});


interface MarketDetails {
  id: string;
  marketAddress: string;
  name: string;
  description: string;
  category: string;
  stage: string;
  tokenSymbol: string;
  targetPool: string;
  yesVotes: number;
  noVotes: number;
  totalParticipants: number; // Always available (doesn't reveal vote direction)
  totalYesStake: number;
  totalNoStake: number;
  yesPercentage?: number; // Legacy field (may be stale)
  noPercentage?: number; // Calculated from yesPercentage
  sharesYesPercentage?: number; // Blockchain-synced (single source of truth)
  poolProgressPercentage?: number; // Calculated and stored in MongoDB
  expiryTime: string;
  status: string;
  metadataUri?: string;
  projectImageUrl?: string;
  documentUrls?: string[];
  metadata?: {
    name: string;
    description: string;
    image?: string;
    category?: string;
    projectType?: string;
    projectStage?: string;
    location?: string;
    teamSize?: number;
    socialLinks?: {
      website?: string;
      twitter?: string;
      discord?: string;
      github?: string;
      telegram?: string;
      linkedin?: string;
    };
    videoUrl?: string;
    additionalNotes?: string;
    documents?: string[];
  };
  // Vote button states (calculated in API, single source of truth)
  isYesVoteEnabled?: boolean;
  isNoVoteEnabled?: boolean;
  yesVoteDisabledReason?: string;
  noVoteDisabledReason?: string;
  // Project owner and age
  founderWallet?: string;
  founderUsername?: string | null;
  founderDisplayName?: string;
  projectAge?: string;
  // Sync status (for staleness detection)
  lastSyncedAt?: string | null;
  isStale?: boolean;
  syncStatus?: string;
  // Social/engagement metrics
  favoriteCount?: number;
}

// Map the API's emoji-prefixed display status to a clean plant-themed label
// + cosmic palette color, used for the status chip in the header card.
function statusPalette(status: string): { label: string; color: string } {
  if (!status) return { label: 'Quiet', color: CREAM_FAINT };
  const lower = status.toLowerCase();
  if (lower.includes('yes wins') || lower.includes('🎉')) return { label: 'Bloomed', color: FOREST };
  if (lower.includes('no wins') || lower.includes('❌')) return { label: 'Withered', color: EARTH };
  if (lower.includes('refund') || lower.includes('↩')) return { label: 'Returned', color: PEACH };
  if (lower.includes('awaiting') || lower.includes('⏳')) return { label: 'Awaiting resolve', color: AMBER };
  if (lower.includes('pool complete') || lower.includes('🎯')) return { label: 'Ready', color: AMBER };
  if (lower.includes('active') || lower.includes('✅')) return { label: 'Living', color: FOREST };
  if (lower.includes('expired')) return { label: 'Closed', color: EARTH };
  return { label: status.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim() || 'Quiet', color: CREAM_FAINT };
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

// Determine detailed market status based on on-chain data
function getDetailedMarketStatus(
  market: MarketDetails,
  onchainData?: { success: boolean; data?: any }
): { status: string; badgeClass: string } {
  // Calculate expiry status from MongoDB's expiryTime (same as CountdownTimer)
  const now = new Date().getTime();
  const expiryTime = new Date(market.expiryTime).getTime();
  const isExpired = now >= expiryTime;

  // If we have on-chain data, use it for resolution and pool progress
  if (onchainData?.success && onchainData.data) {
    const { resolution, poolProgressPercentage } = onchainData.data;

    // Check resolution status first
    if (resolution === 'YesWins') {
      return {
        status: '🎉 YES Wins',
        badgeClass: 'bg-green-500/20 text-green-300 border-green-400/30'
      };
    }

    if (resolution === 'NoWins') {
      return {
        status: '❌ NO Wins',
        badgeClass: 'bg-red-500/20 text-red-300 border-red-400/30'
      };
    }

    if (resolution === 'Refund') {
      return {
        status: '↩️ Refund',
        badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30'
      };
    }

    // Unresolved market - check if expired (using MongoDB time, not on-chain)
    if (resolution === 'Unresolved') {
      if (isExpired) {
        return {
          status: '⏳ Awaiting Resolution',
          badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-400/30'
        };
      }

      // Pool is full but not expired
      if (poolProgressPercentage >= 100) {
        return {
          status: '🎯 Pool Complete',
          badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30'
        };
      }

      // Active market
      return {
        status: '✅ Active',
        badgeClass: 'bg-green-500/20 text-green-300 border-green-400/30'
      };
    }
  }

  // Fallback to basic expiry check if no on-chain data
  // Check if pool is full using MongoDB-calculated poolProgressPercentage
  const poolProgressPercentage = market.poolProgressPercentage || 0;
  const isPoolFull = poolProgressPercentage >= 100;

  if (isExpired || isPoolFull) {
    return {
      status: 'Expired',
      badgeClass: 'bg-red-500/20 text-red-300 border-red-400/30'
    };
  }

  return {
    status: 'Active',
    badgeClass: 'bg-green-500/20 text-green-300 border-green-400/30'
  };
}

export default function MarketDetailClient({
  initialMarket,
}: {
  // Server-rendered market data, passed in from the parent page server
  // component. When present we skip the initial client-side fetch and seed
  // state directly — eliminates the flash-of-loading on fresh visits.
  // Null is tolerated for the rare case where the server fetch failed but
  // the route still rendered (we fall back to client-side fetch + error UI).
  initialMarket: MarketDetails | null;
}) {
  // useParams() is typed as `T | null` to cover non-dynamic routes / pre-
  // hydration, but this component only renders under /market/[id] where the
  // route segment is guaranteed present.
  const params = useParams<{ id: string }>()!;
  const router = useRouter();
  const { primaryWallet, authenticated } = useWallet();
  const { solBalance, isLoading: balanceLoading } = useSolBalance(primaryWallet?.address);
  const { showAuthModal } = useAuthModal();
  const { network } = useNetwork(); // Get current network from wallet
  const [market, setMarket] = useState<MarketDetails | null>(initialMarket);
  // Skip the loading shell when the server already provided market data.
  const [loading, setLoading] = useState(!initialMarket);
  const [error, setError] = useState<string | null>(null);
  const [selectedSide, setSelectedSide] = useState<'yes' | 'no'>('yes');
  // Right-rail tab: conviction (vote + on-chain) vs community (chat/voice).
  const [railTab, setRailTab] = useState<'conviction' | 'community'>('conviction');
  // Main-column tab: the build-in-public Updates feed (default) vs everything
  // else (analysis, video, holders) under Details.
  const [mainTab, setMainTab] = useState<'updates' | 'ai' | 'details'>('updates');
  // Bumped when an AI git-digest is posted, to remount the Updates feed so the
  // new post shows without a full page reload.
  const [updatesReloadToken, setUpdatesReloadToken] = useState(0);
  const [isProcessingVote, setIsProcessingVote] = useState(false);
  const { vote } = useVoting();
  const { claim, isClaiming } = useClaiming();
  const { resolve, isResolving } = useResolution();
  const { extend, isExtending } = useExtend();
  const { initVesting, isInitializing, claimTeamTokens, isClaiming: isClaimingTeamTokens } = useTeamVesting();
  const { initFounderSolVesting, isInitializing: isInitializingFounderSol, claimFounderSol, isClaiming: isClaimingFounderSol } = useFounderSolVesting();
  const { closePosition, isClosingPosition, closeMarket, isClosingMarket } = useClose();
  // Note: claimed status is now tracked in the database via positionData.data.claimed
  // No need for local state

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

  // Success dialog state
  const [successDialog, setSuccessDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    signature?: string;
    details?: string;
  }>({
    open: false,
    title: '',
    message: '',
    signature: undefined,
    details: undefined,
  });

  // Use minimum investment from config (convert lamports to SOL)
  const QUICK_VOTE_AMOUNT = FEES.MINIMUM_INVESTMENT / 1_000_000_000; // 0.01 SOL
  const [amount, setAmount] = useState<string>(QUICK_VOTE_AMOUNT.toString());

  // ─── Vote deep-link pre-fill ───────────────────────────────────
  // When an MCP user lands here via `pnl_vote`, the URL carries
  // ?vote=yes&amount=0.05 (or no/<amount>). On first mount, read
  // those params and pre-set the vote side + amount fields so the
  // user only has to confirm + sign in their wallet. Run-once via
  // a ref guard so editing the form doesn't get clobbered later.
  const voteDeepLinkSearchParams = useSearchParams();
  const voteDeepLinkApplied = useRef(false);
  useEffect(() => {
    if (voteDeepLinkApplied.current) return;
    const sideParam = voteDeepLinkSearchParams?.get('vote');
    const amountParam = voteDeepLinkSearchParams?.get('amount');
    if (sideParam === 'yes' || sideParam === 'no') {
      setSelectedSide(sideParam);
    }
    if (amountParam) {
      const parsed = parseFloat(amountParam);
      if (Number.isFinite(parsed) && parsed > 0) {
        setAmount(String(parsed));
      }
    }
    if (sideParam || amountParam) voteDeepLinkApplied.current = true;
  }, [voteDeepLinkSearchParams]);

  // Favorite/Watchlist state
  const [isFavorite, setIsFavorite] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  // Contract address copy state
  const [copiedContract, setCopiedContract] = useState(false);
  const [showMarketInfo, setShowMarketInfo] = useState(false);

  // Toast notification state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Swipe gesture state for mobile navigation (drag-to-go-back)
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const [swipeDragOffset, setSwipeDragOffset] = useState(0);
  const [isSwipeDragging, setIsSwipeDragging] = useState(false);
  const [isNavigatingBack, setIsNavigatingBack] = useState(false);

  // Threshold for triggering back navigation (in px)
  const SWIPE_BACK_THRESHOLD = 120;

  const onTouchStart = (e: React.TouchEvent) => {
    // Only start swipe from left edge (first 30px)
    const touchX = e.targetTouches[0].clientX;
    if (touchX <= 30) {
      setSwipeStartX(touchX);
      setIsSwipeDragging(true);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isSwipeDragging || swipeStartX === null) return;

    const currentX = e.targetTouches[0].clientX;
    const deltaX = currentX - swipeStartX;

    // Only allow right swipe (positive deltaX)
    if (deltaX > 0) {
      // Apply resistance as user drags further (diminishing returns)
      const resistedOffset = Math.min(deltaX * 0.6, 250);
      setSwipeDragOffset(resistedOffset);
    }
  };

  const onTouchEnd = () => {
    if (!isSwipeDragging) return;

    setIsSwipeDragging(false);

    if (swipeDragOffset > SWIPE_BACK_THRESHOLD) {
      // Trigger navigation with animation - use back() to return to previous page
      // This preserves filter state (wins, expired, live, etc.)
      setIsNavigatingBack(true);
      setTimeout(() => {
        router.back();
      }, 200);
    } else {
      // Snap back
      setSwipeDragOffset(0);
    }

    setSwipeStartX(null);
  };

  // Define fetcher before using it
  const fetcher = (url: string) => fetch(url).then((res) => res.json());

  // Fetch user profile for favorite status
  const { data: profileData, mutate: refetchProfile } = useSWR(
    primaryWallet?.address ? `/api/profile/${primaryWallet.address}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  // Update favorite status when profile loads
  useEffect(() => {
    if (profileData?.success && profileData.data && params.id) {
      const favoriteMarkets = profileData.data.favoriteMarkets || [];
      setIsFavorite(favoriteMarkets.includes(params.id as string));
    }
  }, [profileData, params.id]);

  // Toggle favorite/watchlist
  const toggleFavorite = async () => {
    if (!primaryWallet?.address || !params.id) return;

    setIsTogglingFavorite(true);
    try {
      const response = await authFetch(`/api/profile/${primaryWallet.address}/favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId: params.id }),
      });

      const result = await response.json();
      if (result.success) {
        const wasAdded = result.data.isFavorite;
        setIsFavorite(wasAdded);
        // Update local favorite count immediately for instant feedback
        setMarket(prev => prev ? {
          ...prev,
          favoriteCount: Math.max(0, (prev.favoriteCount || 0) + (wasAdded ? 1 : -1))
        } : prev);
        refetchProfile();
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  // Share market
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToastMessage('Link copied to clipboard!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      console.error('Failed to copy link:', err);
      setToastMessage('Failed to copy link');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  // Copy contract address
  const handleCopyContract = async (contractAddress: string) => {
    try {
      await navigator.clipboard.writeText(contractAddress);
      setCopiedContract(true);
      setToastMessage('Contract address copied!');
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        setCopiedContract(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy contract:', err);
      setToastMessage('Failed to copy contract');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  };

  // Real-time Socket.IO updates for vote counts and percentages
  // Placed before SWR hooks so socketConnected can control polling
  const { marketData: socketMarketData, isConnected: socketConnected } = useMarketSocket(
    market?.marketAddress || null
  );

  // Subscribe to user-specific socket events so position state stays live
  // (claim status, vote arrival) without depending on polling. The hook
  // exposes a Map<marketAddress, data>; we just watch it for changes on
  // *this* market and refetch the SWR position when one lands.
  const { positions: userPositionUpdates } = useUserSocket(
    primaryWallet?.address || null,
  );

  // Reduce polling when Socket.IO is connected (real-time updates handle it)
  // When socket is connected, we only do initial fetch (no polling) - socket handles updates
  const activityPollInterval = socketConnected ? 0 : 20000; // No poll when connected, 20s when not

  // Fetch combined activity data (history + holders) in a single request
  const { data: activityData, mutate: refetchActivity } = useSWR(
    params.id ? `/api/markets/${params.id}/activity?network=${network}` : null,
    fetcher,
    {
      refreshInterval: activityPollInterval,
      revalidateOnFocus: true,
      dedupingInterval: 10000,
      keepPreviousData: true,
    }
  );

  // Extract history and holders data from combined response
  const historyData = activityData?.success ? {
    success: true,
    data: {
      chartData: activityData.data.chartData,
      recentTrades: activityData.data.recentTrades,
      totalTrades: activityData.data.totalTrades,
    }
  } : null;

  const holdersData = activityData?.success ? {
    success: true,
    data: {
      yesHolders: activityData.data.yesHolders,
      noHolders: activityData.data.noHolders,
      totalYesStake: activityData.data.totalYesStake,
      totalNoStake: activityData.data.totalNoStake,
      totalHolders: activityData.data.totalHolders,
      uniqueHolders: activityData.data.uniqueHolders,
    }
  } : null;

  // Alias for backward compatibility with existing code
  const refetchHistory = refetchActivity;
  const refetchHolders = refetchActivity;

  // Fetch user's position on this market
  const { data: positionData, mutate: refetchPosition } = useSWR(
    params.id && primaryWallet?.address
      ? `/api/markets/${params.id}/position?wallet=${primaryWallet.address}&network=${network}`
      : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000, // Dedupe requests within 5s
    }
  );

  // Determine if we need vesting data (only for founders when token is launched)
  const needsVestingData = useMemo(() => {
    if (!market || !primaryWallet?.address) return false;
    const isFounder = market.founderWallet === primaryWallet.address;
    const hasToken = !!(market as any).tokenMint || !!(market as any).pumpFunTokenAddress;
    const isResolved = (market as any).resolution === 'YesWins';
    return isFounder && hasToken && isResolved;
  }, [market, primaryWallet?.address]);

  // Founder can (re-)upload media until the market resolves. Server enforces
  // the real ownership + resolution gate; this just controls the button.
  const [showMediaEdit, setShowMediaEdit] = useState(false);
  const canEditMedia = useMemo(() => {
    if (!market || !primaryWallet?.address) return false;
    const isFounder = market.founderWallet === primaryWallet.address;
    const resolution = (market as any).resolution;
    const notResolved = !resolution || resolution === 'Unresolved';
    return isFounder && notResolved && market.status === 'active';
  }, [market, primaryWallet?.address]);

  // Fetch vesting data only when needed (founders only, after token launch)
  // This is the ONLY blockchain RPC call - everything else comes from MongoDB + socket
  const { data: vestingData } = useSWR(
    needsVestingData && market?.marketAddress
      ? `/api/markets/${market.marketAddress}/vesting?network=${network}`
      : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 30000, // Vesting data changes rarely
    }
  );

  // Construct merged data from MongoDB (market state) + socket data
  // NO direct blockchain RPC calls needed - data synced via WebSocket to MongoDB
  const mergedOnchainData = useMemo(() => {
    // Safe defaults for the not-loaded branch — keeps `data` non-nullable so
    // downstream sites don't need to guard. Consumers that care about the
    // distinction still check the `success` flag.
    const emptyData = {
      founder: '',
      poolBalance: '0',
      poolProgressPercentage: 0,
      resolution: 'Unresolved' as string,
      phase: 'Prediction' as string | number,
      totalYesShares: '0',
      totalNoShares: '0',
      tokenMint: null as string | null,
      pumpFunTokenAddress: null as string | null,
      targetPool: 0,
      hasExcessSol: false,
      excessSolInSol: 0,
      teamVestingInitialized: false,
      teamVestingData: null as any,
      founderVestingInitialized: false,
      founderVestingData: null as any,
    };
    if (!market) return { success: false, data: emptyData };

    // Check if market is resolved - for resolved markets, we preserve final pool values
    // (API returns finalPoolBalance/finalPoolProgressPercentage as poolBalance/poolProgressPercentage)
    const isResolved = (market as any).resolution && (market as any).resolution !== 'Unresolved';

    // Get base data from MongoDB (already synced from blockchain)
    // For resolved markets, API returns final values captured at resolution time
    const baseData = {
      // Core market fields from MongoDB
      founder: market.founderWallet,
      poolBalance: (market as any).poolBalance || '0',
      poolProgressPercentage: (market as any).poolProgressPercentage || 0,
      resolution: (market as any).resolution || 'Unresolved',
      phase: (market as any).phase || 'Prediction',
      totalYesShares: (market as any).totalYesShares || '0',
      totalNoShares: (market as any).totalNoShares || '0',
      tokenMint: (market as any).tokenMint || (market as any).pumpFunTokenAddress || null,
      pumpFunTokenAddress: (market as any).pumpFunTokenAddress || null,
      targetPool: market.targetPool,
      // Excess SOL fields (for founder vesting display)
      hasExcessSol: Number((market as any).founderExcessSolAllocated || 0) > 0,
      excessSolInSol: Number((market as any).founderExcessSolAllocated || 0) / 1_000_000_000,
      // Vesting data (only fetched for founders)
      teamVestingInitialized: vestingData?.data?.teamVestingInitialized || false,
      teamVestingData: vestingData?.data?.teamVestingData || null,
      founderVestingInitialized: vestingData?.data?.founderVestingInitialized || false,
      founderVestingData: vestingData?.data?.founderVestingData || null,
    };

    // Merge with real-time socket data (socket takes priority when connected)
    if (socketConnected && socketMarketData) {
      return {
        success: true,
        data: {
          ...baseData,
          // Socket provides real-time updates from blockchain sync
          // For RESOLVED markets: Keep final pool values (don't overwrite with 0)
          // For ACTIVE markets: Use socket updates for live pool data
          poolBalance: isResolved ? baseData.poolBalance : (socketMarketData.poolBalance ?? baseData.poolBalance),
          poolProgressPercentage: isResolved ? baseData.poolProgressPercentage : (socketMarketData.poolProgressPercentage ?? baseData.poolProgressPercentage),
          resolution: socketMarketData.resolution ?? baseData.resolution,
          phase: socketMarketData.phase ?? baseData.phase,
          pumpFunTokenAddress: socketMarketData.pumpFunTokenAddress ?? baseData.pumpFunTokenAddress,
          tokenMint: socketMarketData.tokenMint ?? baseData.tokenMint,
        },
      };
    }

    return { success: true, data: baseData };
  }, [market, socketMarketData, socketConnected, vestingData]);

  // Compute vote button states based on real-time data (recalculates when socket updates arrive)
  const voteButtonStates = useMemo(() => {
    if (!market || !mergedOnchainData?.success || !mergedOnchainData.data) {
      return { isYesVoteEnabled: false, isNoVoteEnabled: false, yesVoteDisabledReason: '', noVoteDisabledReason: '' };
    }

    // Use real-time data from mergedOnchainData (includes socket updates)
    return getVoteButtonStates({
      resolution: mergedOnchainData.data.resolution,
      phase: typeof mergedOnchainData.data.phase === 'string'
        ? (mergedOnchainData.data.phase === 'Funding' ? 1 : 0)
        : (mergedOnchainData.data.phase ?? 0),
      poolProgressPercentage: mergedOnchainData.data.poolProgressPercentage,
      expiryTime: market.expiryTime,
      tokenMint: mergedOnchainData.data.tokenMint,
      pumpFunTokenAddress: mergedOnchainData.data.pumpFunTokenAddress,
    });
  }, [market, mergedOnchainData]);

  // Compute display status based on real-time data
  const displayStatus = useMemo(() => {
    if (!market || !mergedOnchainData?.success || !mergedOnchainData.data) {
      return { displayStatus: '✅ Active', badgeClass: 'bg-green-500/20 text-green-300 border-green-400/30', isExpired: false, hasTokenLaunched: false };
    }

    return getMarketDisplayStatus({
      resolution: mergedOnchainData.data.resolution,
      phase: typeof mergedOnchainData.data.phase === 'string'
        ? (mergedOnchainData.data.phase === 'Funding' ? 1 : 0)
        : (mergedOnchainData.data.phase ?? 0),
      poolProgressPercentage: mergedOnchainData.data.poolProgressPercentage,
      expiryTime: market.expiryTime,
      tokenMint: mergedOnchainData.data.tokenMint,
      pumpFunTokenAddress: mergedOnchainData.data.pumpFunTokenAddress,
    });
  }, [market, mergedOnchainData]);

  // Check if token is launched - use BOTH market data (immediate) and merged data (socket)
  // This prevents UI flicker when navigating to launched token pages
  const isTokenLaunched = useMemo(() => {
    const marketResolution = (market as any)?.resolution;
    const marketTokenMint = (market as any)?.tokenMint || (market as any)?.pumpFunTokenAddress;
    const mergedResolution = mergedOnchainData?.data?.resolution;
    const mergedTokenMint = mergedOnchainData?.data?.tokenMint;

    // Check either source - if market data shows launched, use it immediately
    return (marketResolution === 'YesWins' && marketTokenMint) ||
           (mergedResolution === 'YesWins' && mergedTokenMint);
  }, [market, mergedOnchainData]);

  // Get the token mint address (prefer merged data for real-time, fallback to market)
  const tokenMintAddress = mergedOnchainData?.data?.tokenMint ||
                           (market as any)?.tokenMint ||
                           (market as any)?.pumpFunTokenAddress;

  // Helper to refresh market data (replaces old refetchOnchainData)
  // Since we now use MongoDB + socket, just re-fetch the market details
  const refetchOnchainData = () => {
    if (params?.id) {
      fetchMarketDetails(params.id as string);
    }
  };

  useEffect(() => {
    // SSR fast-path — server already gave us the market for this id, skip
    // the initial client fetch. The socket subscription + activity SWR
    // still keep state live; this only avoids the redundant first fetch.
    if (initialMarket && initialMarket.id === params?.id) return;
    if (params?.id) {
      fetchMarketDetails(params.id as string);
    }
  }, [params?.id, initialMarket]);

  // Update market state when Socket.IO sends real-time data
  useEffect(() => {
    if (!socketMarketData || !market) return;

    console.log('📡 [SOCKET] Received market update', {
      resolution: socketMarketData.resolution,
      phase: socketMarketData.phase,
      poolProgressPercentage: socketMarketData.poolProgressPercentage,
      yesVotes: socketMarketData.yesVotes,
      noVotes: socketMarketData.noVotes,
      totalYesStake: socketMarketData.totalYesStake,
      totalNoStake: socketMarketData.totalNoStake,
      yesPercentage: socketMarketData.yesPercentage,
      noPercentage: socketMarketData.noPercentage,
    });

    // Update market with real-time data from Socket.IO
    setMarket((prevMarket) => {
      if (!prevMarket) return prevMarket;

      // Convert stakes to numbers if they come as strings
      const parseStake = (value: any, fallback: number): number => {
        if (value == null) return fallback;
        return typeof value === 'string' ? parseInt(value) : value;
      };

      const updated = {
        ...prevMarket,
        yesVotes: socketMarketData.yesVotes ?? prevMarket.yesVotes,
        noVotes: socketMarketData.noVotes ?? prevMarket.noVotes,
        totalYesStake: parseStake(socketMarketData.totalYesStake, prevMarket.totalYesStake),
        totalNoStake: parseStake(socketMarketData.totalNoStake, prevMarket.totalNoStake),
        // Update percentages from socket (calculated in backend)
        yesPercentage: socketMarketData.yesPercentage ?? prevMarket.yesPercentage,
        noPercentage: socketMarketData.noPercentage ?? prevMarket.noPercentage,
      };

      console.log('✅ [SOCKET] Market state updated', {
        previousYesVotes: prevMarket.yesVotes,
        newYesVotes: updated.yesVotes,
        previousNoVotes: prevMarket.noVotes,
        newNoVotes: updated.noVotes,
        previousYesStake: prevMarket.totalYesStake,
        newYesStake: updated.totalYesStake,
        previousNoStake: prevMarket.totalNoStake,
        newNoStake: updated.totalNoStake,
        previousYesPercentage: prevMarket.yesPercentage,
        newYesPercentage: updated.yesPercentage,
        previousNoPercentage: prevMarket.noPercentage,
        newNoPercentage: updated.noPercentage,
      });

      return updated;
    });

    // Debounced refetch: only refetch history/holders after 1 second of no updates
    // This prevents excessive refetches during rapid socket updates
    const timeoutId = setTimeout(() => {
      try {
        refetchHistory();
        refetchHolders();
      } catch (error) {
        console.warn('Failed to refetch history/holders:', error);
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [socketMarketData, refetchHistory, refetchHolders]);

  // When a position:update event lands for *this* market's address, force a
  // fresh fetch of the SWR position (bypassing the 5s Redis cache). This keeps
  // claim/vote state live without polling.
  useEffect(() => {
    if (!market?.marketAddress) return;
    if (!userPositionUpdates.has(market.marketAddress)) return;
    refetchPosition();
  }, [market?.marketAddress, userPositionUpdates, refetchPosition]);

  const fetchMarketDetails = async (id: string) => {
    try {
      setLoading(true);
      const response = await authFetch(`/api/markets/${id}`);
      const result = await response.json();

      if (result.success) {
        setMarket(result.data);
      } else {
        setError(result.error || 'Failed to load market details');
      }
    } catch (err) {
      console.error('Error fetching market details:', err);
      setError('Failed to load market details');
    } finally {
      setLoading(false);
    }
  };

  // Check if market is expired
  const isMarketExpired = () => {
    if (!market) return false;
    const now = new Date().getTime();
    const expiry = new Date(market.expiryTime).getTime();
    return now >= expiry;
  };

  // Vote button states now come from computed values (recalculated on socket updates)
  const isYesVoteDisabled = (): boolean => {
    return !voteButtonStates.isYesVoteEnabled;
  };

  const isNoVoteDisabled = (): boolean => {
    return !voteButtonStates.isNoVoteEnabled;
  };

  const getVoteDisabledReason = (voteType: 'yes' | 'no'): string => {
    return voteType === 'yes'
      ? (voteButtonStates.yesVoteDisabledReason || 'Disabled')
      : (voteButtonStates.noVoteDisabledReason || 'Disabled');
  };

  // Helper to check if the currently selected side is disabled
  const isSelectedSideDisabled = (): boolean => {
    return selectedSide === 'yes' ? isYesVoteDisabled() : isNoVoteDisabled();
  };

  const handleVote = async (voteType: 'yes' | 'no') => {
    if (!market) return;

    // Not signed in — open the sign-in modal instead of failing the tx.
    if (!authenticated || !primaryWallet) {
      showAuthModal();
      return;
    }

    // Check if market is expired
    if (isMarketExpired()) {
      setToastMessage('❌ Market expired - voting closed');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    // Check if user has opposite position
    if (positionData?.success && positionData.data.hasPosition) {
      if (positionData.data.side !== voteType) {
        setToastMessage(`❌ You already voted ${positionData.data.side.toUpperCase()} - can't switch sides`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 4000);
        return;
      }
    }

    const voteAmount = parseFloat(amount);
    if (isNaN(voteAmount) || voteAmount < QUICK_VOTE_AMOUNT) {
      setToastMessage(`❌ Minimum vote: ${QUICK_VOTE_AMOUNT} SOL`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    // Balance pre-check — catch the "I have ~0.01 SOL but the stake also needs
    // a 1.5% fee + rent for a fresh position account" case here, with a clear
    // message, instead of letting it die in preflight as a raw "-32002" dump.
    // Only enforce once the balance has actually loaded; while it's still
    // fetching we let the tx through (errorParser is the backstop) so we never
    // falsely block on the hook's `?? 0` cold-start value.
    const FEE_RATE = 0.015;        // 1.5% platform fee (matches the order summary)
    const RENT_BUFFER = 0.0021;    // rent-exemption for the new position account
    const NETWORK_FEE = 0.00001;   // base tx fee, generously rounded
    const requiredSol = voteAmount * (1 + FEE_RATE) + RENT_BUFFER + NETWORK_FEE;
    if (!balanceLoading && solBalance < requiredSol) {
      setToastMessage(
        `❌ Insufficient balance — you have ${solBalance.toFixed(4)} SOL but need ~${requiredSol.toFixed(4)} SOL (stake + 1.5% fee + account rent). Add more SOL to your wallet.`,
      );
      setShowToast(true);
      setTimeout(() => setShowToast(false), 6000);
      return;
    }

    // Set processing state and fire transaction
    setIsProcessingVote(true);
    console.log('🗳️  [VOTE] Starting vote transaction', { voteType, amount: voteAmount, marketAddress: market.marketAddress });

    vote({
      marketId: params.id as string,
      marketAddress: market.marketAddress,
      voteType,
      amount: voteAmount,
    }).then((result) => {
      setIsProcessingVote(false);

      if (result.success) {
        console.log('✅ [VOTE] Transaction confirmed on-chain', {
          signature: result.signature,
          voteType,
          amount: voteAmount
        });

        // Show success toast notification
        setToastMessage(`✅ ${voteType.toUpperCase()} vote recorded! ${voteAmount} SOL`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);

        // Socket.IO will handle real-time updates - no manual refetch needed
        // This prevents race condition where stale data overwrites socket updates
        // Position will be refetched after socket update via debounced effect (line 452-459)
      } else {
        // Parse error and show toast
        const parsedError = parseError(result.error);
        setToastMessage(`❌ ${parsedError.title}: ${parsedError.message}`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
      }
    }).catch((error) => {
      setIsProcessingVote(false);
      setToastMessage(`❌ Transaction failed: ${error?.message || 'Unknown error'}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    });
  };

  const handleClaim = async () => {
    if (!market) return;

    const result = await claim({
      marketId: params.id as string,
      marketAddress: market.marketAddress,
    });

    if (result.success) {
      // Format the claim amount for display
      const claimAmountFormatted = result.claimAmount ? (result.claimAmount / 1e9).toFixed(4) : '0';
      const assetType = result.claimType === 'token' ? 'tokens' : 'SOL';

      // Show success toast with claim amount
      setToastMessage(`✅ Claimed ${claimAmountFormatted} ${assetType} successfully!`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

      // Refresh data in background after a short delay
      // This prevents race conditions with backend processing
      setTimeout(() => {
        try {
          refetchPosition(); // Refresh position data to show updated claimed status
          fetchMarketDetails(params.id as string);
          refetchOnchainData(); // Update pool balance
        } catch (error) {
          // Silently ignore refetch errors - Socket.IO will update anyway
          console.warn('Failed to refetch data after claim:', error);
        }
      }, 500); // Wait 500ms for backend to finish processing
    } else {
      // Parse error and show toast
      const parsedError = parseError(result.error);
      setToastMessage(`❌ ${parsedError.title}: ${parsedError.message}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    }
  };

  const handleResolve = async () => {
    if (!market || !mergedOnchainData?.success) return;

    const result = await resolve({
      marketId: params.id as string,
      marketAddress: market.marketAddress,
    });

    if (result.success) {
      // Show success toast
      setToastMessage('✅ Market resolved! Participants can now claim rewards');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

      // Refresh all data with error handling
      try {
        fetchMarketDetails(params.id as string);
        refetchOnchainData(); // Immediate refresh
        refetchHistory(); // Refresh trade history
        refetchHolders(); // Refresh holders

        // Retry on-chain data fetch to combat RPC caching (Solana RPCs can be slow to update)
        const retryOnchainDataFetch = async (retries = 3, delayMs = 2000) => {
          for (let i = 0; i < retries; i++) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            try {
              await refetchOnchainData();
              console.log(`🔄 Retry ${i + 1}/${retries}: Refreshing on-chain data after resolution...`);
            } catch (error) {
              console.warn(`Failed retry ${i + 1}/${retries}:`, error);
            }
          }
        };

        retryOnchainDataFetch(); // Background retries to ensure RPC catches up
      } catch (error) {
        console.warn('Failed to refetch data after resolution:', error);
      }
    } else {
      // If error, check if market is already resolved on-chain
      console.log('⚠️ Resolution failed, checking on-chain status...');

      try {
        const statusCheckResponse = await authFetch('/api/markets/check-onchain-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ marketAddress: market.marketAddress }),
        });

        const statusResult = await statusCheckResponse.json();

        if (statusResult.success && statusResult.data.isResolved) {
          // Market is resolved on-chain! Just update UI
          console.log('✅ Market already resolved on-chain:', statusResult.data.resolution);

          setToastMessage(`✅ Market already resolved as ${statusResult.data.resolution}`);
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);

          // Refresh data to show claim button with delay and error handling
          setTimeout(() => {
            try {
              refetchOnchainData();
              fetchMarketDetails(params.id as string);
            } catch (error) {
              console.warn('Failed to refetch data after resolution check:', error);
            }
          }, 500);
          return;
        }
      } catch (statusError) {
        console.error('Failed to check on-chain status:', statusError);
      }

      // Show original error if not resolved on-chain
      const parsedError = parseError(result.error);
      setToastMessage(`❌ ${parsedError.title}: ${parsedError.message}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    }
  };

  const handleExtend = async () => {
    if (!market) return;

    // Safety check: If already in Funding Phase, just refresh UI
    if (mergedOnchainData?.success && mergedOnchainData.data.phase === 'Funding') {
      console.log('⚠️ Market already in Funding Phase, refreshing UI...');

      // Refresh data to update UI
      await refetchOnchainData();
      await fetchMarketDetails(params.id as string);

      setToastMessage('✅ Already in Funding Phase - UI refreshed');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

      return;
    }

    const result = await extend({
      marketId: params.id as string,
      marketAddress: market.marketAddress,
    });

    if (result.success) {
      // Success! Refresh all data
      fetchMarketDetails(params.id as string);

      // Retry on-chain data fetch to combat RPC caching
      const retryOnchainDataFetch = async (retries = 3, delayMs = 2000) => {
        for (let i = 0; i < retries; i++) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
          await refetchOnchainData();
          console.log(`🔄 Retry ${i + 1}/${retries}: Refreshing on-chain data after extend...`);
        }
      };

      refetchOnchainData(); // Immediate refresh
      retryOnchainDataFetch(); // Background retries

      // Show success toast
      setToastMessage('✅ Market extended to Funding Phase!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } else {
      // Check if error indicates already extended
      const errorStr = result.error?.toString() || '';
      if (errorStr.toLowerCase().includes('phase') || errorStr.toLowerCase().includes('already')) {
        console.log('⚠️ Market likely already extended, refreshing UI...');

        // Force refresh
        await refetchOnchainData();
        await fetchMarketDetails(params.id as string);

        setToastMessage('✅ Market already extended - UI refreshed');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        // Parse error and show toast
        const parsedError = parseError(result.error);
        setToastMessage(`❌ ${parsedError.title}: ${parsedError.message}`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
      }
    }
  };

  const handleInitTeamVesting = async () => {
    if (!market || !mergedOnchainData?.success || !primaryWallet) return;

    // For now, use a placeholder for total token supply
    // In production, this should be calculated from the actual token created
    const totalTokenSupply = 1_000_000_000; // 1 billion tokens as placeholder

    const result = await initVesting({
      marketAddress: market.marketAddress,
      teamWallet: mergedOnchainData.data.founder || market.founderWallet || '',
      totalTokenSupply,
    });

    if (result.success) {
      setToastMessage('✅ Team vesting initialized! Founder can claim tokens');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

      // Wait for RPC to catch up, then refetch with retries
      setTimeout(async () => {
        await refetchOnchainData();
        // Retry to ensure RPC has caught up
        for (let i = 0; i < 3; i++) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          await refetchOnchainData();
        }
      }, 1000);
    } else {
      const parsedError = parseError(result.error);
      setToastMessage(`❌ ${parsedError.title}: ${parsedError.message}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    }
  };

  const handleClaimTeamTokens = async () => {
    if (!market || !mergedOnchainData?.success) return;

    // Store claimable amount before claiming for success message
    const claimableAmount = mergedOnchainData.data.teamVestingData?.claimableNow
      ? (Number(mergedOnchainData.data.teamVestingData.claimableNow) / 1_000_000).toLocaleString()
      : '0';

    const result = await claimTeamTokens({
      marketAddress: market.marketAddress,
      tokenMint: mergedOnchainData.data.tokenMint || '',
    });

    if (result.success) {
      refetchOnchainData();

      setToastMessage(`✅ Claimed ${claimableAmount} ${market.tokenSymbol} tokens!`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } else {
      const parsedError = parseError(result.error);

      // Check if error is about insufficient balance (no tokens to claim)
      const errorStr = String(result.error).toLowerCase();
      if (errorStr.includes('insufficient') || errorStr.includes('balance') || errorStr.includes('0x1')) {
        // Show next unlock time if available
        const nextUnlockTime = mergedOnchainData.data.teamVestingData?.nextUnlockTime;
        if (nextUnlockTime) {
          const daysUntilUnlock = Math.max(0, Math.ceil((nextUnlockTime - Date.now() / 1000) / 86400));
          setToastMessage(`⏳ No tokens to claim yet. Next unlock in ~${daysUntilUnlock} days.`);
        } else {
          setToastMessage('⏳ No tokens available to claim right now.');
        }
      } else {
        setToastMessage(`❌ ${parsedError.title}: ${parsedError.message}`);
      }
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    }
  };

  const handleInitFounderSolVesting = async () => {
    if (!market || !mergedOnchainData?.success || !primaryWallet) return;

    const result = await initFounderSolVesting({
      marketAddress: market.marketAddress,
    });

    if (result.success) {
      refetchOnchainData();

      setToastMessage('✅ Founder SOL vesting initialized! You can now claim your excess SOL');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } else {
      const parsedError = parseError(result.error);
      setToastMessage(`❌ ${parsedError.title}: ${parsedError.message}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    }
  };

  const handleClaimFounderSol = async () => {
    if (!market || !mergedOnchainData?.success) return;

    // Store claimable amount before claiming for success message
    const claimableAmount = mergedOnchainData.data.founderVestingData?.claimableNow
      ? (Number(mergedOnchainData.data.founderVestingData.claimableNow) / 1_000_000_000).toFixed(4)
      : '0';

    const result = await claimFounderSol({
      marketAddress: market.marketAddress,
    });

    if (result.success) {
      refetchOnchainData();

      setToastMessage(`✅ Claimed ${claimableAmount} SOL!`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } else {
      const parsedError = parseError(result.error);

      // Check if error is about insufficient balance (no SOL to claim)
      const errorStr = String(result.error).toLowerCase();
      if (errorStr.includes('insufficient') || errorStr.includes('nothing') || errorStr.includes('0x1') || errorStr.includes('nothingtoclaim')) {
        // Show next unlock time if available
        const nextUnlockTime = mergedOnchainData.data.founderVestingData?.nextUnlockTime;
        if (nextUnlockTime) {
          const daysUntilUnlock = Math.max(0, Math.ceil((nextUnlockTime - Date.now() / 1000) / 86400));
          setToastMessage(`⏳ No SOL to claim yet. Next unlock in ~${daysUntilUnlock} days.`);
        } else {
          setToastMessage('⏳ No SOL available to claim right now.');
        }
      } else {
        setToastMessage(`❌ ${parsedError.title}: ${parsedError.message}`);
      }
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    }
  };

  const handleClosePosition = async () => {
    if (!market) return;

    const result = await closePosition({
      marketAddress: market.marketAddress,
    });

    if (result.success) {
      refetchPosition(); // Position will be deleted
      refetchOnchainData();

      setToastMessage('✅ Position closed - rent recovered!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } else {
      const parsedError = parseError(result.error);
      setToastMessage(`❌ ${parsedError.title}: ${parsedError.message}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    }
  };

  const handleCloseMarket = async () => {
    if (!market) return;

    const result = await closeMarket({
      marketAddress: market.marketAddress,
    });

    if (result.success) {
      setToastMessage('✅ Market closed - redirecting to browse...');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

      // Redirect to markets page after 3 seconds
      setTimeout(() => {
        router.push('/browse');
      }, 3000);
    } else {
      const parsedError = parseError(result.error);
      setToastMessage(`❌ ${parsedError.title}: ${parsedError.message}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 5000);
    }
  };

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[60vh]"
        style={{ color: CREAM_DIM }}
      >
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: AMBER }} />
        <span className="mt-3 mono text-[0.6rem] uppercase tracking-[0.26em]">
          Reading the leaf…
        </span>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="p-6 max-w-2xl mx-auto" style={{ color: CREAM }}>
        <div
          className="text-center py-16 px-8"
          style={{
            background: 'rgba(214,115,71,0.06)',
            border: `1px solid ${EARTH}55`,
          }}
        >
          <SeedIcon className="w-10 h-10 mx-auto mb-4" />
          <h2
            className="mb-2"
            style={{
              color: CREAM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontSize: '1.4rem',
              fontWeight: 350,
            }}
          >
            {error ? 'The grove can\'t find this seed.' : 'Market not found.'}
          </h2>
          <p
            className="mono uppercase tracking-[0.22em] text-[0.6rem] mb-6"
            style={{ color: CREAM_FAINT }}
          >
            {error || 'It may have been removed or the link is broken.'}
          </p>
          <button
            onClick={() => router.back()}
            className="mono uppercase tracking-[0.26em] text-[0.62rem] px-5 py-2.5 inline-flex items-center gap-2 transition-colors"
            style={{ color: CREAM, border: `1px solid ${HAIR_STRONG}` }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = AMBER + '88';
              e.currentTarget.style.color = AMBER;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = HAIR_STRONG;
              e.currentTarget.style.color = CREAM;
            }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Go back
          </button>
        </div>
      </div>
    );
  }

  // Calculate expiry status from MongoDB (same source as CountdownTimer)
  const isMarketExpiredFromDB = (() => {
    const now = new Date().getTime();
    const expiry = new Date(market.expiryTime).getTime();
    return now >= expiry;
  })();

  // Use sharesYesPercentage from blockchain sync (single source of truth)
  // This is calculated from on-chain totalYesShares / totalShares
  // Fallback to yesPercentage or local calculation if not available (backward compatibility)
  const yesPercentage = market.sharesYesPercentage !== undefined
    ? market.sharesYesPercentage
    : (market.yesPercentage !== undefined
        ? market.yesPercentage
        : (market.totalYesStake + market.totalNoStake > 0
            ? Math.round((market.totalYesStake / (market.totalYesStake + market.totalNoStake)) * 100)
            : 50));

  // Use computed display status (recalculated on socket updates via shared utility)
  const marketStatus = { status: displayStatus.displayStatus, badgeClass: displayStatus.badgeClass };

  return (
    <>
      {/* Swipe-back indicator */}
      {(isSwipeDragging || swipeDragOffset > 0) && (
        <div
          className="lg:hidden fixed left-0 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
          style={{
            opacity: Math.min(swipeDragOffset / SWIPE_BACK_THRESHOLD, 1),
            transform: `translateX(${Math.min(swipeDragOffset * 0.3, 40)}px)`,
          }}
        >
          <div
            className="flex items-center justify-center w-12 h-12 rounded-full shadow-lg transition-colors"
            style={{
              backgroundColor: swipeDragOffset > SWIPE_BACK_THRESHOLD ? '#22c55e' : 'rgba(6, 182, 212, 0.9)',
            }}
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </div>
        </div>
      )}

      <div
        className="pt-0.5 px-3 pb-24 sm:px-4 sm:pt-4 lg:pb-4 max-w-[1600px] mx-auto"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${isNavigatingBack ? '100%' : `${swipeDragOffset}px`})`,
          transition: isSwipeDragging ? 'none' : 'transform 0.2s ease-out',
        }}
      >
      {/* Main Layout: Content + Sidebar */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        {/* Left Content Area (70% on desktop) */}
        <div className="flex-1 lg:w-[70%] space-y-3 sm:space-y-4">
          {/* Trading Terminal - Show FIRST when token IS launched */}
          {isTokenLaunched && tokenMintAddress && (
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Chart + Stats Section - 65% on desktop */}
              <div className="w-full lg:w-[65%] space-y-3">
                {/* Token Stats Bar */}
                <TokenStatsBar tokenMint={mergedOnchainData.data.tokenMint} />

                {/* Birdeye Chart - Blended to background */}
                <div className="w-full h-[300px] sm:h-[400px] lg:h-[450px] rounded-xl overflow-hidden">
                  <iframe
                    src={`https://birdeye.so/tv-widget/${mergedOnchainData.data.tokenMint}?chain=solana&viewMode=pair&chartInterval=15&chartType=CANDLE&chartTimezone=America%2FLos_Angeles&chartLeftToolbar=show&theme=dark&backgroundColor=transparent`}
                    className="w-full h-full border-0"
                    title="Token Chart"
                    allow="clipboard-write"
                  />
                </div>

                {/* Onchain Info — cosmic plant ledger */}
                <div
                  className="p-4"
                  style={{
                    background: 'rgba(244,238,228,0.025)',
                    border: `1px solid ${HAIR_STRONG}`,
                  }}
                >
                  <p
                    className="mono uppercase tracking-[0.32em] text-[0.55rem] mb-3 inline-flex items-center gap-2"
                    style={{ color: AMBER }}
                  >
                    <FileText className="w-3 h-3" />
                    Onchain
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <DetailTile
                      label="Token"
                      address={mergedOnchainData.data.tokenMint}
                      addressColor={FOREST}
                    />
                    <DetailTile
                      label="Market"
                      address={market.marketAddress}
                      addressColor={AMBER}
                    />
                    {(() => {
                      try {
                        const [vaultPda] = getMarketVaultPDA(new PublicKey(market.marketAddress));
                        return (
                          <DetailTile
                            label="Vault"
                            address={vaultPda.toBase58()}
                            addressColor={PEACH}
                          />
                        );
                      } catch {
                        return null;
                      }
                    })()}
                    {mergedOnchainData.data.founder && (
                      <DetailTile
                        label="Founder"
                        address={mergedOnchainData.data.founder}
                        addressColor={EARTH}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Swap Section - 35% on desktop */}
              <div className="w-full lg:w-[35%] space-y-3">
                <div className="flex items-center gap-2.5">
                  <BloomIcon className="w-4 h-4" />
                  <h3
                    className="leading-none"
                    style={{
                      color: CREAM,
                      fontFamily: 'var(--font-fraunces, serif)',
                      fontWeight: 350,
                      fontSize: '1.2rem',
                    }}
                  >
                    Trade <span style={{ color: AMBER }}>${market.tokenSymbol}</span>
                  </h3>
                </div>

                {/* Community-backed proof strip */}
                <div
                  className="p-3"
                  style={{
                    background: `${FOREST}0d`,
                    border: `1px solid ${FOREST}33`,
                  }}
                >
                  <p
                    className="mono uppercase tracking-[0.26em] text-[0.55rem] mb-2 inline-flex items-center gap-1.5"
                    style={{ color: FOREST }}
                  >
                    <CheckCircle className="w-3 h-3" />
                    Community-backed
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    <ProofStat
                      value={(Number(mergedOnchainData.data.poolBalance || 0) / 1e9).toFixed(1)}
                      label="SOL"
                    />
                    <ProofStat
                      value={String(market.totalParticipants || 0)}
                      label="Voters"
                    />
                    <ProofStat
                      value={`${(yesPercentage || 0).toFixed(0)}%`}
                      label="YES"
                      color={FOREST}
                    />
                    <ProofStat
                      value={`${(100 - (yesPercentage || 0)).toFixed(0)}%`}
                      label="NO"
                      color={EARTH}
                    />
                  </div>
                </div>

                <TokenTrading
                  tokenMint={mergedOnchainData.data.tokenMint}
                  tokenSymbol={market.tokenSymbol}
                  tokenImageUrl={market.projectImageUrl || market.metadata?.image}
                />
              </div>
            </div>
          )}

          {/* Header — editorial cosmic */}
          <article
            className="overflow-hidden p-4 sm:p-6"
            style={{
              background: 'rgba(244,238,228,0.025)',
              border: `1px solid ${HAIR_STRONG}`,
            }}
          >
            <div className="flex flex-col gap-4">
              {/* Top: image + title + actions */}
              <div className="flex items-start gap-3 sm:gap-4">
                {/* Project image — falls back to a deterministic warm
                    gradient with the ticker initial when no image URL
                    is set or the URL 404s. */}
                <MarketImage
                  src={market.projectImageUrl}
                  ticker={market.tokenSymbol}
                  name={market.name}
                  size={80}
                  rounded="full"
                  className="sm:!w-20 sm:!h-20"
                  style={{
                    width: 56,
                    height: 56,
                    border: `1px solid ${HAIR_STRONG}`,
                  }}
                />

                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start gap-2 mb-2">
                    <h1
                      className="line-clamp-2 capitalize flex-1 min-w-0"
                      style={{
                        color: CREAM,
                        fontFamily: 'var(--font-fraunces, serif)',
                        fontWeight: 350,
                        fontSize: 'clamp(1.4rem, 3vw, 2.2rem)',
                        lineHeight: 1.1,
                        letterSpacing: '-0.01em',
                        fontVariationSettings: '"SOFT" 30, "opsz" 60',
                      }}
                    >
                      {market.name}
                    </h1>

                    {/* Action cluster */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {market.founderWallet && (
                        <Link
                          href={`/profile/${market.founderWallet}`}
                          className="mono uppercase tracking-[0.18em] text-[0.55rem] px-2 py-1 inline-flex items-center gap-1.5 transition-colors"
                          style={{
                            color: AMBER,
                            border: `1px solid ${AMBER}55`,
                            background: `${AMBER}0d`,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = `${AMBER}1f`)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = `${AMBER}0d`)}
                          title={`View ${market.founderDisplayName || 'owner'}'s profile`}
                        >
                          <RootIcon className="w-2.5 h-2.5" />
                          <span style={{ textTransform: 'none', letterSpacing: 'normal' }}>
                            {market.founderDisplayName || 'Unknown'}
                          </span>
                        </Link>
                      )}
                      {market.projectAge && (
                        <span
                          className="mono uppercase tracking-[0.2em] text-[0.55rem] px-2 py-1"
                          style={{ color: CREAM_FAINT, border: `1px solid ${HAIR_STRONG}` }}
                        >
                          {market.projectAge}
                        </span>
                      )}
                      <button
                        onClick={handleShare}
                        className="p-1.5 transition-colors"
                        style={{ color: CREAM_FAINT }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
                        title="Share this market"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={primaryWallet?.address ? toggleFavorite : undefined}
                        disabled={isTogglingFavorite || !primaryWallet?.address}
                        className="p-1.5 inline-flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ color: isFavorite ? EARTH : CREAM_FAINT }}
                        onMouseEnter={(e) => {
                          if (primaryWallet?.address && !isFavorite) e.currentTarget.style.color = EARTH;
                        }}
                        onMouseLeave={(e) => {
                          if (primaryWallet?.address && !isFavorite) e.currentTarget.style.color = CREAM_FAINT;
                        }}
                        title={
                          !primaryWallet?.address
                            ? 'Connect wallet to add to watchlist'
                            : isFavorite
                            ? 'Remove from watchlist'
                            : 'Add to watchlist'
                        }
                      >
                        <Heart
                          className={`w-4 h-4 transition-all ${
                            isFavorite ? 'fill-current' : ''
                          }`}
                        />
                        {(market.favoriteCount || 0) > 0 && (
                          <span className="mono text-[0.55rem] uppercase tracking-[0.18em]">
                            {market.favoriteCount}
                          </span>
                        )}
                      </button>
                      {/* Founder-only: edit media before resolution */}
                      {canEditMedia && (
                        <button
                          onClick={() => setShowMediaEdit(true)}
                          className="mono uppercase tracking-[0.18em] text-[0.55rem] px-2 py-1 inline-flex items-center gap-1.5 transition-colors"
                          style={{ color: AMBER, border: `1px solid ${AMBER}55`, background: `${AMBER}0d` }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = `${AMBER}1f`)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = `${AMBER}0d`)}
                          title="Edit media (founder only)"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                          <span style={{ textTransform: 'none', letterSpacing: 'normal' }}>Edit media</span>
                        </button>
                      )}
                      {/* Copyable Contract Address — only when token is minted */}
                      {mergedOnchainData?.success && mergedOnchainData.data.tokenMint && (
                        <button
                          onClick={() => handleCopyContract(mergedOnchainData.data.tokenMint!)}
                          className="mono uppercase tracking-[0.18em] text-[0.55rem] px-2 py-1 inline-flex items-center gap-1.5 transition-colors"
                          style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = CREAM;
                            e.currentTarget.style.borderColor = AMBER + '88';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = CREAM_DIM;
                            e.currentTarget.style.borderColor = HAIR_STRONG;
                          }}
                          title="Copy contract address"
                        >
                          <span className="hidden sm:inline" style={{ textTransform: 'none' }}>
                            {mergedOnchainData.data.tokenMint.slice(0, 4)}…{mergedOnchainData.data.tokenMint.slice(-4)}
                          </span>
                          <span className="sm:hidden">CA</span>
                          {copiedContract ? (
                            <Check className="w-3 h-3" style={{ color: FOREST }} />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Status row */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    <span
                      className="mono uppercase tracking-[0.22em] text-[0.55rem] px-1.5 py-0.5 inline-flex items-center gap-1"
                      style={{
                        color: statusPalette(marketStatus.status).color,
                        border: `1px solid ${statusPalette(marketStatus.status).color}55`,
                        background: `${statusPalette(marketStatus.status).color}0d`,
                      }}
                    >
                      {statusPalette(marketStatus.status).label}
                    </span>
                    {mergedOnchainData?.success && (
                      <span
                        className="mono uppercase tracking-[0.22em] text-[0.55rem] px-1.5 py-0.5"
                        style={{
                          color:
                            mergedOnchainData.data.phase === 'Funding' ? AMBER : PEACH,
                          border: `1px solid ${
                            mergedOnchainData.data.phase === 'Funding' ? AMBER : PEACH
                          }55`,
                        }}
                      >
                        {mergedOnchainData.data.phase === 'Funding' ? 'Funding' : 'Predicting'}
                      </span>
                    )}
                    {market.isStale && mergedOnchainData?.success && (
                      <span
                        className="mono uppercase tracking-[0.22em] text-[0.55rem] px-1.5 py-0.5"
                        style={{ color: FOREST, border: `1px solid ${FOREST}55` }}
                      >
                        ● Live
                      </span>
                    )}
                    {market.isStale && !mergedOnchainData?.success && (
                      <span
                        className="mono uppercase tracking-[0.22em] text-[0.55rem] px-1.5 py-0.5 animate-pulse"
                        style={{ color: AMBER, border: `1px solid ${AMBER}55` }}
                      >
                        ⚠ Syncing
                      </span>
                    )}
                  </div>

                  {/* Pool progress — hairline, amber fill */}
                  {mergedOnchainData?.success && (
                    <div className="flex items-center gap-3">
                      <div
                        className="flex-1 h-1.5 overflow-hidden relative"
                        style={{ background: HAIR_STRONG }}
                      >
                        <div
                          className="absolute inset-y-0 left-0 transition-all duration-500"
                          style={{
                            width: `${Math.min(mergedOnchainData.data?.poolProgressPercentage || 0, 100)}%`,
                            background:
                              (mergedOnchainData.data?.poolProgressPercentage || 0) >= 100
                                ? FOREST
                                : AMBER,
                          }}
                        />
                      </div>
                      <span
                        className="mono text-[0.6rem] tracking-[0.05em] tabular-nums whitespace-nowrap"
                        style={{
                          color:
                            (mergedOnchainData.data?.poolProgressPercentage || 0) >= 100
                              ? FOREST
                              : AMBER,
                          fontFeatureSettings: '"tnum" on',
                        }}
                      >
                        {mergedOnchainData.data?.poolProgressPercentage || 0}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <p
                className="leading-relaxed"
                style={{
                  color: CREAM_DIM,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontSize: 'clamp(0.95rem, 1.4vw, 1.05rem)',
                  lineHeight: 1.55,
                }}
              >
                {market.description}
              </p>

              {/* Provenance — the rich "Born in <agent>" card for agent-drafted
                  markets whose founder shared the originating context, or a
                  minimal "Born in the terminal" chip for any other MCP-created
                  market. Renders nothing for web/mobile creates. */}
              <ProvenanceBlock
                provenance={(market as { provenance?: unknown })?.provenance as never}
                createdVia={(market as { createdVia?: string })?.createdVia}
              />

              {/* Compact lineage — a one-line "Built on · <thesis> →". The full
                  citations + Project Pulse now live in the Review tab so the
                  header stays tight and the Updates feed comes up high. */}
              {market.marketAddress && (
                <MarketCitations marketIdOrAddress={market.marketAddress} variant="compact" />
              )}

            </div>
          </article>

        {/* Main-column tabs: Updates (build-in-public feed) | AI review (Grok) | Details */}
        <div className="flex items-stretch" style={{ borderBottom: `1px solid ${HAIR_STRONG}` }}>
          {(['updates', 'ai', 'details'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setMainTab(t)}
              className="mono uppercase tracking-[0.24em] text-[0.6rem] px-5 py-3 transition-colors"
              style={{
                color: mainTab === t ? AMBER : CREAM_FAINT,
                borderBottom: `2px solid ${mainTab === t ? AMBER : 'transparent'}`,
                marginBottom: '-1px',
              }}
            >
              {t === 'updates' ? 'Updates' : t === 'ai' ? 'Review' : 'Details'}
            </button>
          ))}
        </div>

        {/* Updates pane — the founder's build-in-public feed (the default) */}
        <div className={mainTab === 'updates' ? '' : 'hidden'}>
          <GitDigest
            marketId={params.id as string}
            founderWallet={market.founderWallet || null}
            onPosted={() => setUpdatesReloadToken((t) => t + 1)}
          />
          <ProjectUpdates
            key={updatesReloadToken}
            marketId={params.id as string}
            founderWallet={market.founderWallet || null}
            videoUrl={market.metadata?.videoUrl || null}
            onDiscuss={() => {
              setRailTab('community');
              document.getElementById('conviction-rail')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </div>

        {/* AI review pane — the structured Grok reading (legit score, red flags,
            positives, verdict), lifted out of Details into its own tab. */}
        <div className={mainTab === 'ai' ? '' : 'hidden'}>
          <article
            className="p-4 sm:p-5"
            style={{ background: 'rgba(244,238,228,0.025)', border: `1px solid ${HAIR_STRONG}` }}
          >
            <p
              className="mono uppercase tracking-[0.32em] text-[0.55rem] mb-1.5 inline-flex items-center gap-2"
              style={{ color: AMBER }}
            >
              <Sparkles className="w-3 h-3" />
              The reading
            </p>
            <h3
              className="leading-tight mb-3"
              style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)', fontWeight: 350, fontSize: '1.15rem' }}
            >
              What the data says
            </h3>
            <GrokRoast
              marketId={market.id}
              resolution={mergedOnchainData?.data?.resolution}
              votingData={{
                totalYesVotes: market.yesVotes || 0,
                totalNoVotes: market.noVotes || 0,
                yesPercentage: yesPercentage || 0,
                totalParticipants: market.totalParticipants || 0,
              }}
            />
          </article>

          {/* Verification plane — the founder-curated research lineage. The raw
              git activity feed (ProjectPulse) is intentionally hidden: auto/bot
              commits + CI churn read as a progress signal when they aren't. Git
              returns as founder-declared milestones settled by a git event (the
              component + /repo endpoints are kept for that). */}
          {market.marketAddress && (
            <div className="mt-5">
              <MarketCitations
                marketIdOrAddress={market.marketAddress}
                isFounder={!!primaryWallet?.address && market.founderWallet === primaryWallet.address}
              />
            </div>
          )}
        </div>

        {/* Details pane — analysis, video, holders. Kept mounted (hidden) so
            heavy children don't remount on every tab switch. */}
        <div className={mainTab === 'details' ? 'space-y-3 sm:space-y-4' : 'hidden'}>
        {/* Project meta — moved out of the header to keep it tight */}
              {/* Meta chips */}
              <div className="flex items-center flex-wrap gap-1.5">
                <span
                  className="mono uppercase tracking-[0.18em] text-[0.6rem] px-2 py-1 inline-flex items-center gap-1.5"
                  style={{ color: AMBER, border: `1px solid ${AMBER}55`, background: `${AMBER}0d` }}
                >
                  <span style={{ textTransform: 'none', letterSpacing: 'normal' }}>
                    ${market.tokenSymbol}
                  </span>
                </span>
                <span
                  className="mono uppercase tracking-[0.22em] text-[0.55rem] px-2 py-1"
                  style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
                >
                  {formatCategoryLabel(market.category)}
                </span>
                <span
                  className="mono uppercase tracking-[0.22em] text-[0.55rem] px-2 py-1"
                  style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
                >
                  {formatLabel(market.stage)}
                </span>
                {market.metadata?.projectType && (
                  <span
                    className="mono uppercase tracking-[0.22em] text-[0.55rem] px-2 py-1 capitalize"
                    style={{ color: PEACH, border: `1px solid ${PEACH}44` }}
                  >
                    {market.metadata.projectType}
                  </span>
                )}
                {market.metadata?.teamSize && (
                  <span
                    className="mono uppercase tracking-[0.22em] text-[0.55rem] px-2 py-1 inline-flex items-center gap-1"
                    style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
                  >
                    <Users className="w-2.5 h-2.5" />
                    {market.metadata.teamSize}
                  </span>
                )}
                {market.metadata?.location && (
                  <span
                    className="mono uppercase tracking-[0.22em] text-[0.55rem] px-2 py-1 inline-flex items-center gap-1"
                    style={{ color: FOREST, border: `1px solid ${FOREST}55` }}
                  >
                    <MapPin className="w-2.5 h-2.5" />
                    <span style={{ textTransform: 'none', letterSpacing: 'normal' }}>
                      {market.metadata.location}
                    </span>
                  </span>
                )}

                {/* Docs */}
                {market.documentUrls && market.documentUrls.length > 0 && safeExternalUrl(market.documentUrls[0]) && (
                  <a
                    href={safeExternalUrl(market.documentUrls[0])!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono uppercase tracking-[0.22em] text-[0.55rem] px-2 py-1 inline-flex items-center gap-1 transition-colors"
                    style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = AMBER;
                      e.currentTarget.style.borderColor = AMBER + '88';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = CREAM_DIM;
                      e.currentTarget.style.borderColor = HAIR_STRONG;
                    }}
                    title="View project documentation"
                  >
                    <FileText className="w-2.5 h-2.5" /> Docs
                  </a>
                )}

                {/* Social links */}
                {safeExternalUrl(market.metadata?.socialLinks?.website) && (
                  <a
                    href={safeExternalUrl(market.metadata!.socialLinks!.website)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono uppercase tracking-[0.22em] text-[0.55rem] px-2 py-1 inline-flex items-center gap-1 transition-colors"
                    style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = AMBER;
                      e.currentTarget.style.borderColor = AMBER + '88';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = CREAM_DIM;
                      e.currentTarget.style.borderColor = HAIR_STRONG;
                    }}
                    title="Website"
                  >
                    <Globe className="w-2.5 h-2.5" /> Site
                  </a>
                )}
                {safeExternalUrl(market.metadata?.socialLinks?.github) && (
                  <a
                    href={safeExternalUrl(market.metadata!.socialLinks!.github)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono uppercase tracking-[0.22em] text-[0.55rem] px-2 py-1 inline-flex items-center gap-1 transition-colors"
                    style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = AMBER;
                      e.currentTarget.style.borderColor = AMBER + '88';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = CREAM_DIM;
                      e.currentTarget.style.borderColor = HAIR_STRONG;
                    }}
                    title="GitHub"
                  >
                    <Github className="w-2.5 h-2.5" /> Code
                  </a>
                )}
              </div>

        {/* Voice + Video — only when token NOT launched */}
        {!isTokenLaunched && (market.metadata?.videoUrl || market.metadata?.additionalNotes) && (
          <div className={`grid gap-4 ${market.metadata?.videoUrl && market.metadata?.additionalNotes ? 'md:grid-cols-2' : ''}`}>
            {market.metadata?.additionalNotes && (
              <article className="py-2 flex flex-col h-full">
                <p
                  className="mono uppercase tracking-[0.32em] text-[0.55rem] mb-3 inline-flex items-center gap-2"
                  style={{ color: AMBER }}
                >
                  <BloomIcon className="w-3 h-3" />
                  What this project offers
                </p>
                <div
                  className="pl-4 flex-1"
                  style={{ borderLeft: `2px solid ${AMBER}66` }}
                >
                  <p
                    className="whitespace-pre-wrap italic"
                    style={{
                      color: CREAM,
                      fontFamily: 'var(--font-fraunces, serif)',
                      fontStyle: 'italic',
                      fontSize: '0.95rem',
                      lineHeight: 1.55,
                    }}
                  >
                    {market.metadata.additionalNotes}
                  </p>
                </div>
              </article>
            )}
            {market.metadata?.videoUrl && (
              <VideoEmbed url={market.metadata.videoUrl} className="h-full" />
            )}
          </div>
        )}

        {/* AI reading now lives in the "AI review" tab above. */}
        {/* End AI reading — conviction panel now lives in the right rail */}

        {/* Full Description — only when richer than the intro */}
        {market.metadata?.description && market.metadata.description !== market.description && (
          <article className="py-2">
            <p
              className="mono uppercase tracking-[0.32em] text-[0.55rem] mb-3"
              style={{ color: AMBER }}
            >
              ¶ The full story
            </p>
            <p
              className="whitespace-pre-wrap leading-relaxed"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: 'clamp(1rem, 1.4vw, 1.1rem)',
                lineHeight: 1.6,
              }}
            >
              {market.metadata.description}
            </p>
          </article>
        )}

        {/* Market Holders and Activity - Only show for resolved markets */}
        {mergedOnchainData?.data?.resolution !== 'Unresolved' ? (
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            <LiveActivityFeed
              trades={historyData?.data?.recentTrades || []}
              className="w-full"
            />
            {holdersData?.success && (
              <MarketHolders
                yesHolders={holdersData.data.yesHolders || []}
                noHolders={holdersData.data.noHolders || []}
                totalYesStake={holdersData.data.totalYesStake || 0}
                totalNoStake={holdersData.data.totalNoStake || 0}
                uniqueHolders={holdersData.data.uniqueHolders || 0}
                yesPercentage={market.yesPercentage ?? undefined}
                noPercentage={market.noPercentage ?? undefined}
                currentUserWallet={primaryWallet?.address}
                className="w-full"
              />
            )}
          </div>
        ) : (
          <article
            className="py-12 px-6 text-center"
            style={{
              background: 'rgba(244,238,228,0.02)',
              border: `1px solid ${HAIR}`,
            }}
          >
            <SeedIcon className="w-9 h-9 mx-auto mb-4" />
            <h3
              className="mb-2"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: '1.25rem',
                fontWeight: 350,
              }}
            >
              Voting in progress.
            </h3>
            <p
              className="mx-auto max-w-md italic"
              style={{
                color: CREAM_DIM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontStyle: 'italic',
                fontSize: '0.9rem',
              }}
            >
              Holder positions and activity stay hidden until close — to keep the
              vote unbiased.
            </p>
          </article>
        )}
        </div>
        {/* End Details pane */}

        </div>
        {/* End Left Content Area */}

        {/* Conviction rail — vote + on-chain. Sticky on desktop (30% column);
            stacks full-width on mobile so voting is never hidden. */}
        <div id="conviction-rail" className="w-full lg:w-[30%] lg:min-w-[320px] lg:max-w-[400px] scroll-mt-24">
          <div className="space-y-4">
          {/* Rail tabs: Conviction (vote + on-chain) | Community (chat + voice).
              Replaces the old fixed Chat/Voice overlay that floated over this column. */}
          <div className="flex items-stretch" style={{ border: `1px solid ${HAIR_STRONG}` }}>
            {(['conviction', 'community'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setRailTab(t)}
                className="flex-1 mono uppercase tracking-[0.22em] text-[0.55rem] py-2.5 transition-colors"
                style={{
                  background: railTab === t ? 'rgba(232,150,96,0.14)' : 'transparent',
                  color: railTab === t ? AMBER : CREAM_FAINT,
                  borderBottom: `2px solid ${railTab === t ? AMBER : 'transparent'}`,
                }}
              >
                {t === 'conviction' ? 'Conviction' : 'Community'}
              </button>
            ))}
          </div>

          {/* Conviction pane — kept mounted (hidden) when on Community so vote
              state (side, amount) survives a tab switch. */}
          <div className={railTab === 'conviction' ? 'space-y-4' : 'hidden'}>
          {/* Trading Section — cosmic-plant ─────────────────────────── */}
          {!isTokenLaunched && (
          <section
            className="h-fit p-4 sm:p-5"
            style={{
              background: 'rgba(244,238,228,0.025)',
              border: `1px solid ${HAIR_STRONG}`,
            }}
          >
            <div className="mb-4">
              <p
                className="mono uppercase tracking-[0.32em] text-[0.55rem] mb-1.5"
                style={{ color: AMBER }}
              >
                ¶ Vote
              </p>
              <h3
                className="leading-tight mb-1"
                style={{
                  color: CREAM,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontWeight: 350,
                  fontSize: '1.3rem',
                  letterSpacing: '-0.005em',
                }}
              >
                Should the grove launch{' '}
                <span style={{ color: AMBER }}>${market.tokenSymbol}</span>?
              </h3>
              <p
                className="italic"
                style={{
                  color: CREAM_DIM,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontStyle: 'italic',
                  fontSize: '0.85rem',
                }}
              >
                Stake SOL on YES or NO. Winners share the pool.
              </p>
            </div>

            <div className="space-y-3">
              {/* Pool progress + post-resolution distribution */}
              {mergedOnchainData?.success && (
                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                        style={{ color: CREAM_FAINT }}
                      >
                        Pool
                      </span>
                      <span
                        className="mono text-[0.6rem] tabular-nums"
                        style={{
                          color: AMBER,
                          fontFeatureSettings: '"tnum" on',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {(Number(mergedOnchainData.data.poolBalance || 0) / 1e9).toFixed(2)}
                        <span style={{ color: CREAM_FAINT }}>
                          {' / '}
                          {market.targetPool} SOL
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden" style={{ background: HAIR }}>
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${Math.min(mergedOnchainData.data.poolProgressPercentage || 0, 100)}%`,
                          background:
                            (mergedOnchainData.data.poolProgressPercentage || 0) >= 100
                              ? FOREST
                              : AMBER,
                        }}
                      />
                    </div>
                    <div className="text-right mt-0.5">
                      <span
                        className="mono uppercase tracking-[0.22em] text-[0.5rem]"
                        style={{
                          color:
                            (mergedOnchainData.data.poolProgressPercentage || 0) >= 100
                              ? FOREST
                              : CREAM_FAINT,
                        }}
                      >
                        {mergedOnchainData.data.poolProgressPercentage || 0}% funded
                      </span>
                    </div>
                  </div>

                  {mergedOnchainData.data.resolution !== 'Unresolved' && market.totalParticipants > 0 && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span
                          className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                          style={{ color: CREAM_FAINT }}
                        >
                          Final distribution
                        </span>
                        <span
                          className="mono uppercase tracking-[0.18em] text-[0.5rem]"
                          style={{ color: CREAM_FAINT }}
                        >
                          {market.totalParticipants || 0} votes
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden flex" style={{ background: HAIR }}>
                        <div
                          className="h-full transition-all duration-500"
                          style={{ width: `${yesPercentage || 50}%`, background: FOREST }}
                        />
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${100 - (yesPercentage || 50)}%`,
                            background: 'rgba(214,115,71,0.7)',
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <span
                          className="mono uppercase tracking-[0.22em] text-[0.5rem]"
                          style={{ color: FOREST }}
                        >
                          YES {(yesPercentage || 0).toFixed(0)}%
                        </span>
                        <span
                          className="mono uppercase tracking-[0.22em] text-[0.5rem]"
                          style={{ color: EARTH }}
                        >
                          NO {(100 - (yesPercentage || 0)).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {mergedOnchainData.data.resolution === 'Unresolved' && market.totalParticipants > 0 && (
                    <div className="text-center">
                      <span
                        className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                        style={{ color: CREAM_FAINT }}
                      >
                        {market.totalParticipants || 0} have voted ·{' '}
                        <span
                          style={{
                            color: CREAM_DIM,
                            fontFamily: 'var(--font-fraunces, serif)',
                            fontStyle: 'italic',
                            textTransform: 'none',
                            letterSpacing: 'normal',
                          }}
                        >
                          totals hidden until close
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* YES / NO side selection */}
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setSelectedSide('yes')}
                  disabled={isYesVoteDisabled() || isMarketExpired()}
                  className="mono uppercase tracking-[0.24em] text-[0.65rem] py-2.5 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: selectedSide === 'yes' ? FOREST : 'transparent',
                    color: selectedSide === 'yes' ? CREAM : CREAM_DIM,
                    border: `1px solid ${selectedSide === 'yes' ? FOREST : HAIR_STRONG}`,
                  }}
                  onMouseEnter={(e) => {
                    if (selectedSide !== 'yes' && !isYesVoteDisabled() && !isMarketExpired()) {
                      e.currentTarget.style.color = CREAM;
                      e.currentTarget.style.borderColor = FOREST + '88';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedSide !== 'yes') {
                      e.currentTarget.style.color = CREAM_DIM;
                      e.currentTarget.style.borderColor = HAIR_STRONG;
                    }
                  }}
                >
                  Yes
                  {mergedOnchainData?.data?.resolution !== 'Unresolved' && (
                    <span
                      style={{
                        fontFamily: 'var(--font-fraunces, serif)',
                        fontStyle: 'italic',
                        fontSize: '0.85rem',
                        letterSpacing: 'normal',
                        opacity: 0.85,
                      }}
                    >
                      {yesPercentage}%
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setSelectedSide('no')}
                  disabled={isNoVoteDisabled() || isMarketExpired()}
                  className="mono uppercase tracking-[0.24em] text-[0.65rem] py-2.5 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: selectedSide === 'no' ? 'rgba(214,115,71,0.18)' : 'transparent',
                    color: selectedSide === 'no' ? EARTH : CREAM_DIM,
                    border: `1px solid ${selectedSide === 'no' ? EARTH : HAIR_STRONG}`,
                  }}
                  onMouseEnter={(e) => {
                    if (selectedSide !== 'no' && !isNoVoteDisabled() && !isMarketExpired()) {
                      e.currentTarget.style.color = CREAM;
                      e.currentTarget.style.borderColor = EARTH + '88';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedSide !== 'no') {
                      e.currentTarget.style.color = CREAM_DIM;
                      e.currentTarget.style.borderColor = HAIR_STRONG;
                    }
                  }}
                >
                  No
                  {mergedOnchainData?.data?.resolution !== 'Unresolved' && (
                    <span
                      style={{
                        fontFamily: 'var(--font-fraunces, serif)',
                        fontStyle: 'italic',
                        fontSize: '0.85rem',
                        letterSpacing: 'normal',
                        opacity: 0.85,
                      }}
                    >
                      {100 - yesPercentage}%
                    </span>
                  )}
                </button>
              </div>

              {/* Amount input + quick chips */}
              <div className="space-y-2">
                <label
                  className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                  style={{ color: CREAM_FAINT }}
                >
                  Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min={QUICK_VOTE_AMOUNT}
                    step="0.01"
                    disabled={isSelectedSideDisabled() || isMarketExpired()}
                    className="w-full px-3 py-2.5 mono text-sm focus:outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'transparent',
                      color: CREAM,
                      border: `1px solid ${
                        selectedSide === 'yes' ? FOREST + '55' : EARTH + '55'
                      }`,
                      letterSpacing: '0.04em',
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor =
                        selectedSide === 'yes' ? FOREST : EARTH)
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor =
                        selectedSide === 'yes' ? FOREST + '55' : EARTH + '55')
                    }
                    placeholder="0.00"
                  />
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 mono uppercase tracking-[0.18em] text-[0.55rem]"
                    style={{ color: CREAM_FAINT }}
                  >
                    SOL
                  </span>
                </div>

                {/* Quick chips */}
                <div className="grid grid-cols-4 gap-1">
                  {[QUICK_VOTE_AMOUNT.toString(), '0.1', '0.5', '1'].map((quickAmount) => {
                    const active = amount === quickAmount;
                    const accent = selectedSide === 'yes' ? FOREST : EARTH;
                    return (
                      <button
                        key={quickAmount}
                        onClick={() => setAmount(quickAmount)}
                        disabled={isSelectedSideDisabled() || isMarketExpired()}
                        className="mono text-[0.6rem] py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          color: active ? accent : CREAM_DIM,
                          border: `1px solid ${active ? accent : HAIR_STRONG}`,
                          background: active ? `${accent}1a` : 'transparent',
                          letterSpacing: '0.04em',
                          fontFeatureSettings: '"tnum" on',
                        }}
                        onMouseEnter={(e) => {
                          if (!active && !isSelectedSideDisabled() && !isMarketExpired()) {
                            e.currentTarget.style.color = CREAM;
                            e.currentTarget.style.borderColor = accent + '88';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            e.currentTarget.style.color = CREAM_DIM;
                            e.currentTarget.style.borderColor = HAIR_STRONG;
                          }
                        }}
                      >
                        {quickAmount}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Trade summary */}
              <div
                className="p-3 space-y-1"
                style={{
                  background: 'rgba(244,238,228,0.025)',
                  border: `1px solid ${HAIR_STRONG}`,
                }}
              >
                <SummaryRow
                  label="Position"
                  value={selectedSide.toUpperCase()}
                  valueColor={selectedSide === 'yes' ? FOREST : EARTH}
                />
                <SummaryRow label="Amount" value={`${amount || '0.00'} SOL`} />
                <SummaryRow
                  label="Fee · 1.5%"
                  value={`${(parseFloat(amount || '0') * 0.015).toFixed(4)} SOL`}
                />
                <div
                  className="flex justify-between pt-1.5 mt-1.5"
                  style={{ borderTop: `1px solid ${HAIR}` }}
                >
                  <span
                    className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                    style={{ color: CREAM_DIM }}
                  >
                    Total
                  </span>
                  <span
                    className="mono text-[0.7rem] tabular-nums"
                    style={{
                      color: CREAM,
                      fontFeatureSettings: '"tnum" on',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {(parseFloat(amount || '0') * 1.015).toFixed(4)} SOL
                  </span>
                </div>
              </div>

              {/* Trade button */}
              <button
                onClick={() => handleVote(selectedSide)}
                className="w-full py-3 mono uppercase tracking-[0.24em] text-[0.65rem] transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed"
                style={{
                  background: isSelectedSideDisabled() || isMarketExpired() || isProcessingVote
                    ? HAIR_STRONG
                    : selectedSide === 'yes'
                    ? FOREST
                    : EARTH,
                  color: isSelectedSideDisabled() || isMarketExpired() || isProcessingVote
                    ? CREAM_FAINT
                    : CREAM,
                  opacity: isSelectedSideDisabled() || isMarketExpired() ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isProcessingVote && !isSelectedSideDisabled() && !isMarketExpired()) {
                    e.currentTarget.style.background =
                      selectedSide === 'yes' ? '#4a8d4d' : '#dd8456';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isProcessingVote && !isSelectedSideDisabled() && !isMarketExpired()) {
                    e.currentTarget.style.background =
                      selectedSide === 'yes' ? FOREST : EARTH;
                  }
                }}
                disabled={
                  isProcessingVote ||
                  !amount ||
                  parseFloat(amount) < QUICK_VOTE_AMOUNT ||
                  isMarketExpired() ||
                  isSelectedSideDisabled()
                }
              >
                {isSelectedSideDisabled() ? (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    {getVoteDisabledReason(selectedSide)}
                  </>
                ) : isMarketExpired() ? (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    Market closed
                  </>
                ) : isProcessingVote ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Planting…
                  </>
                ) : (
                  <>
                    {selectedSide === 'yes' ? <SeedIcon className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    Buy {selectedSide.toUpperCase()} · {amount || '0.00'} SOL
                  </>
                )}
              </button>

              {/* Existing position */}
              {positionData?.success && positionData.data.hasPosition && (
                <div
                  className="pt-3 mt-1"
                  style={{ borderTop: `1px solid ${HAIR}` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 flex items-center justify-center"
                        style={{
                          background:
                            positionData.data.side === 'yes'
                              ? `${FOREST}22`
                              : `${EARTH}22`,
                          border: `1px solid ${
                            positionData.data.side === 'yes' ? FOREST : EARTH
                          }55`,
                        }}
                      >
                        {positionData.data.side === 'yes' ? (
                          <CheckCircle
                            className="w-3.5 h-3.5"
                            style={{ color: FOREST }}
                          />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" style={{ color: EARTH }} />
                        )}
                      </div>
                      <div>
                        <p
                          className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                          style={{ color: CREAM_FAINT }}
                        >
                          Your position
                        </p>
                        <p
                          className="text-xs"
                          style={{
                            color: CREAM,
                            fontFamily: 'var(--font-fraunces, serif)',
                          }}
                        >
                          <span
                            style={{
                              color:
                                positionData.data.side === 'yes' ? FOREST : EARTH,
                              fontWeight: 500,
                            }}
                          >
                            {positionData.data.side.toUpperCase()}
                          </span>{' '}
                          ·{' '}
                          <span style={{ fontStyle: 'italic' }}>
                            {(Number(positionData.data?.totalAmount) || 0).toFixed(3)} SOL
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className="mono uppercase tracking-[0.22em] text-[0.5rem]"
                        style={{ color: CREAM_FAINT }}
                      >
                        Trades
                      </p>
                      <p
                        className="mono"
                        style={{
                          color: CREAM,
                          fontSize: '0.95rem',
                          fontFamily: 'var(--font-fraunces, serif)',
                          fontStyle: 'italic',
                        }}
                      >
                        {positionData.data.tradeCount}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Advanced details — collapsible */}
              <div className="pt-3 mt-1" style={{ borderTop: `1px solid ${HAIR}` }}>
                <button
                  onClick={() => setShowMarketInfo(!showMarketInfo)}
                  className="flex items-center justify-between w-full mono uppercase tracking-[0.22em] text-[0.55rem] mb-2 transition-colors"
                  style={{ color: CREAM_FAINT }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
                >
                  <span>Advanced details</span>
                  <svg
                    className="w-3 h-3 transition-transform"
                    style={{ transform: showMarketInfo ? 'rotate(180deg)' : 'rotate(0)' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {showMarketInfo && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <DetailTile label="Target" value={`${market.targetPool} SOL`} />
                    <DetailTile
                      label="Participants"
                      value={String(market.totalParticipants || 0)}
                      icon={<Users className="w-2.5 h-2.5" style={{ color: AMBER }} />}
                    />
                    <DetailTile
                      label="Market"
                      address={market.marketAddress}
                      addressColor={AMBER}
                      network={SOLANA_NETWORK}
                    />
                    {(() => {
                      try {
                        const [marketVaultPda] = getMarketVaultPDA(new PublicKey(market.marketAddress));
                        return (
                          <DetailTile
                            label="Vault"
                            address={marketVaultPda.toBase58()}
                            addressColor={PEACH}
                            network={SOLANA_NETWORK}
                          />
                        );
                      } catch {
                        return null;
                      }
                    })()}
                    {mergedOnchainData?.success && mergedOnchainData.data.founder && (
                      <DetailTile
                        label="Creator"
                        address={mergedOnchainData.data.founder}
                        addressColor={FOREST}
                        network={SOLANA_NETWORK}
                      />
                    )}
                    {mergedOnchainData?.success && mergedOnchainData.data.tokenMint && (
                      <DetailTile
                        label="Token"
                        address={mergedOnchainData.data.tokenMint}
                        addressColor={EARTH}
                        network={SOLANA_NETWORK}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

          {/* Market Status — cosmic-plant wrapper */}
          <section
            className="h-fit p-4 sm:p-5"
            style={{
              background: 'rgba(232,150,96,0.045)',
              border: `1px solid ${AMBER}33`,
            }}
          >
            <div className="mb-3">
              <p
                className="mono uppercase tracking-[0.32em] text-[0.55rem] mb-1.5"
                style={{ color: AMBER }}
              >
                ¶ Status
              </p>
              <h3
                className="leading-tight"
                style={{
                  color: CREAM,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontWeight: 350,
                  fontSize: '1.15rem',
                  letterSpacing: '-0.005em',
                }}
              >
                Where this market stands
              </h3>
            </div>
            <div className="space-y-3">
            {/* Market Status Section */}
            {mergedOnchainData?.success && (
              <>
                <div className="space-y-3">
                  {/* Status Message */}
                  {mergedOnchainData.data.resolution === 'Unresolved' && !isMarketExpiredFromDB && (
                    <>
                      {/* Pool Filled - Waiting for Resolution (but NOT in Funding Phase) */}
                      {mergedOnchainData.data.poolProgressPercentage >= 100 && mergedOnchainData.data.phase !== 'Funding' ? (
                        <div className="pt-2" style={{ borderTop: `1px solid ${HAIR}` }}>
                          <div className="p-4" style={{ background: `${PEACH}0d`, border: `1px solid ${PEACH}33` }}>
                            <div className="mb-3">
                              <p className="mono uppercase tracking-[0.28em] text-[0.55rem] mb-2" style={{ color: PEACH }}>
                                Pool complete · voting closed
                              </p>
                              <p style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: '0.5rem' }}>
                                The funding target has been reached. No more votes can be placed.
                              </p>
                              <p className="mono text-[0.62rem] uppercase tracking-[0.2em]" style={{
                                color: Number(mergedOnchainData.data.totalYesShares) > Number(mergedOnchainData.data.totalNoShares) ? FOREST : EARTH,
                              }}>
                                {Number(mergedOnchainData.data.totalYesShares) > Number(mergedOnchainData.data.totalNoShares)
                                  ? '● YES winning — token launch likely'
                                  : '● NO winning — no token launch'}
                              </p>
                            </div>
                            <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${HAIR}` }}>
                              <div>
                                <p className="mono uppercase tracking-[0.22em] text-[0.5rem] mb-1" style={{ color: CREAM_FAINT }}>Resolution available in</p>
                                <CountdownTimer expiryTime={market.expiryTime} size="lg" />
                              </div>
                              <span className="mono uppercase tracking-[0.24em] text-[0.55rem] px-2 py-1" style={{ color: AMBER, border: `1px solid ${AMBER}55`, background: `${AMBER}0d` }}>
                                Awaiting expiry
                              </span>
                            </div>
                          </div>

                          {/* Founder Actions - Only for founder when target reached and YES winning */}
                          {primaryWallet?.address === mergedOnchainData.data.founder &&
                           Number(mergedOnchainData.data.totalYesShares) > Number(mergedOnchainData.data.totalNoShares) && (
                            <div className="mt-4 p-4 space-y-3" style={{ background: `${AMBER}0d`, border: `1px solid ${AMBER}33` }}>
                              <div>
                                <p className="mono uppercase tracking-[0.28em] text-[0.55rem] mb-2" style={{ color: AMBER }}>
                                  Target reached · founder action
                                </p>
                                {mergedOnchainData.data.phase === 'Funding' ? (
                                  <>
                                    <p style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '0.4rem' }}>
                                      Market is in funding phase. You can now launch your token.
                                    </p>
                                    <p className="italic" style={{ color: PEACH, fontFamily: 'var(--font-fraunces, serif)', fontStyle: 'italic', fontSize: '0.78rem' }}>
                                      Token will have a branded PNL address ending with &quot;pnl&quot;.
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '0.4rem' }}>
                                      Your market has reached the target pool and YES is winning.{' '}
                                      <span style={{ color: AMBER, fontWeight: 500 }}>Extend to funding phase first</span> to enable token launch.
                                    </p>
                                    <p className="italic" style={{ color: PEACH, fontFamily: 'var(--font-fraunces, serif)', fontStyle: 'italic', fontSize: '0.78rem' }}>
                                      After extending, you can launch your token or continue raising funds.
                                    </p>
                                  </>
                                )}
                              </div>

                              {/* Show appropriate button based on phase */}
                              {mergedOnchainData.data.phase === 'Funding' ? (
                                /* In Funding Phase - Show Launch Token button */
                                <Button
                                  onClick={async () => {
                                    // Prepare token metadata from market data
                                    const tokenMetadata = {
                                      name: market.name,
                                      symbol: market.tokenSymbol,
                                      description: market.description,
                                      imageUrl: market.projectImageUrl || 'https://via.placeholder.com/300', // Fallback if no image
                                      twitter: market.metadata?.socialLinks?.twitter || '',
                                      telegram: market.metadata?.socialLinks?.telegram || '',
                                      website: market.metadata?.socialLinks?.website || '',
                                    };

                                    const result = await resolve({
                                      marketId: params.id as string,
                                      marketAddress: market.marketAddress,
                                      tokenMetadata,
                                      needsTokenLaunch: true,
                                    });

                                    if (result.success) {
                                      // Success! Refresh all data
                                      fetchMarketDetails(params.id as string);
                                      refetchOnchainData();
                                      refetchHistory();
                                      refetchHolders();

                                      setToastMessage(`✅ ${market.tokenSymbol} token launched! YES voters can claim`);
                                      setShowToast(true);
                                      setTimeout(() => setShowToast(false), 3000);
                                    } else {
                                      const parsedError = parseError(result.error);
                                      setToastMessage(`❌ ${parsedError.title}: ${parsedError.message}`);
                                      setShowToast(true);
                                      setTimeout(() => setShowToast(false), 5000);
                                    }
                                  }}
                                  disabled={isResolving}
                                  className="w-full mono uppercase tracking-[0.18em] text-[0.72rem] font-medium"
                                  style={{ background: AMBER, color: BG, border: 'none' }}
                                >
                                  {isResolving ? (
                                    <div className="flex flex-col items-center justify-center space-y-1">
                                      <div className="flex items-center">
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        <span>Launching token…</span>
                                      </div>
                                      <span className="text-[0.6rem]" style={{ color: BG, opacity: 0.7, letterSpacing: '0.16em' }}>
                                        ~30-60 sec
                                      </span>
                                    </div>
                                  ) : (
                                    <>Launch ${market.tokenSymbol}</>
                                  )}
                                </Button>
                              ) : (
                                /* In Prediction Phase - Show Extend button only */
                                <Button
                                  onClick={handleExtend}
                                  disabled={isExtending}
                                  className="w-full mono uppercase tracking-[0.18em] text-[0.72rem] font-medium"
                                  style={{ background: AMBER, color: BG, border: 'none' }}
                                >
                                  {isExtending ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Extending to funding phase…
                                    </>
                                  ) : (
                                    <>Extend to funding phase</>
                                  )}
                                </Button>
                              )}

                              <div className="pt-2" style={{ borderTop: `1px solid ${HAIR}` }}>
                                <div style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.78rem', lineHeight: 1.5 }}>
                                  {mergedOnchainData.data.phase === 'Funding' ? (
                                    <>
                                      <span style={{ color: FOREST, fontWeight: 500 }}>Ready to launch.</span> Create {market.tokenSymbol} token and distribute to YES voters.
                                    </>
                                  ) : (
                                    <>
                                      <span style={{ color: AMBER, fontWeight: 500 }}>Step 1.</span> Extend to funding phase (required before token launch).
                                      <br />
                                      <span style={{ color: FOREST, fontWeight: 500 }}>Step 2.</span> Launch token (available after extending).
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Resolve Button - Anyone can resolve when NO wins and pool is full (but not yet expired) */}
                          {Number(mergedOnchainData.data.totalNoShares) > Number(mergedOnchainData.data.totalYesShares) && !isMarketExpiredFromDB && (
                            <div className="mt-4 p-4" style={{ background: `${EARTH}0d`, border: `1px solid ${EARTH}33` }}>
                              <div className="mb-3">
                                <p className="mono uppercase tracking-[0.28em] text-[0.55rem] mb-2" style={{ color: EARTH }}>
                                  NO wins · market failed
                                </p>
                                <p style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '0.4rem' }}>
                                  The target pool was reached but NO won the vote. This market will not launch a token.
                                </p>
                                <p style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                                  <span style={{ color: FOREST, fontWeight: 500 }}>NO voters will win SOL rewards</span> — 95% pool, proportional to shares.
                                </p>
                                <p style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.82rem' }}>
                                  Anyone can resolve this market now or wait until expiry to unlock NO voter rewards.
                                </p>
                              </div>
                              <Button
                                onClick={handleResolve}
                                disabled={isResolving || !primaryWallet}
                                className="w-full mono uppercase tracking-[0.18em] text-[0.72rem] font-medium"
                                style={{ background: EARTH, color: CREAM, border: 'none' }}
                              >
                                {isResolving ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Resolving…
                                  </>
                                ) : (
                                  <>Resolve market (NO wins)</>
                                )}
                              </Button>
                              {!primaryWallet && (
                                <p className="mono uppercase tracking-[0.22em] text-[0.55rem] mt-2 text-center" style={{ color: AMBER }}>Connect wallet to resolve</p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Pool Not Filled - Active Market */
                        <div className="space-y-4">
                          {/* Funding Phase - Special UI for all users */}
                          {mergedOnchainData.data.phase === 'Funding' ? (
                            <div className="pt-2 space-y-3" style={{ borderTop: `1px solid ${HAIR}` }}>
                              <div className="p-4" style={{ background: `${AMBER}0d`, border: `1px solid ${AMBER}33` }}>
                                <div className="mb-3">
                                  <p className="mono uppercase tracking-[0.28em] text-[0.55rem] mb-2" style={{ color: AMBER }}>
                                    Funding phase · token launch guaranteed
                                  </p>
                                  <div className="space-y-2">
                                    <p style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.92rem', lineHeight: 1.5 }}>
                                      <span style={{ color: FOREST, fontWeight: 500 }}>YES won the vote.</span> Voting is locked and ${market.tokenSymbol} token will be launched.
                                    </p>
                                    <p style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.82rem' }}>
                                      The founder extended to funding phase to raise additional capital. You can still contribute to increase the pool size.
                                    </p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="mono uppercase tracking-[0.22em] text-[0.55rem] px-2 py-1 inline-flex items-center gap-1.5" style={{ color: FOREST, border: `1px solid ${FOREST}55`, background: `${FOREST}0d` }}>
                                        <CheckCircle className="w-3 h-3" />
                                        Locked · YES wins
                                      </span>
                                      <span className="mono uppercase tracking-[0.22em] text-[0.55rem] px-2 py-1" style={{ color: PEACH, border: `1px solid ${PEACH}55`, background: `${PEACH}0d` }}>
                                        Raising more funds
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${HAIR}` }}>
                                  <div>
                                    <p className="mono uppercase tracking-[0.22em] text-[0.5rem] mb-1" style={{ color: CREAM_FAINT }}>Funding deadline</p>
                                    <CountdownTimer expiryTime={market.expiryTime} size="lg" />
                                  </div>
                                  <span className="mono uppercase tracking-[0.24em] text-[0.55rem] px-2 py-1" style={{ color: AMBER, border: `1px solid ${AMBER}55`, background: `${AMBER}0d` }}>
                                    Accepting contributions
                                  </span>
                                </div>
                              </div>

                              {/* Founder-only resolve button */}
                              {primaryWallet?.address === mergedOnchainData.data.founder && (
                                <div className="p-4" style={{ background: `${FOREST}0d`, border: `1px solid ${FOREST}33` }}>
                                  <div className="mb-3">
                                    <p className="mono uppercase tracking-[0.28em] text-[0.55rem] mb-2" style={{ color: FOREST }}>
                                      Founder action
                                    </p>
                                    <p style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                                      You can continue accepting contributions or resolve the market now to launch ${market.tokenSymbol}.
                                    </p>
                                  </div>
                                  <Button
                                    onClick={async () => {
                                      // Prepare token metadata from market data
                                      const tokenMetadata = {
                                        name: market.name,
                                        symbol: market.tokenSymbol,
                                        description: market.description,
                                        imageUrl: market.projectImageUrl || '',
                                        twitter: market.metadata?.socialLinks?.twitter || '',
                                        telegram: market.metadata?.socialLinks?.telegram || '',
                                        website: market.metadata?.socialLinks?.website || '',
                                      };

                                      const result = await resolve({
                                        marketId: params.id as string,
                                        marketAddress: market.marketAddress,
                                        tokenMetadata,
                                        needsTokenLaunch: true,
                                      });

                                      if (result.success) {
                                        fetchMarketDetails(params.id as string);
                                        refetchOnchainData();
                                        refetchHistory();
                                        refetchHolders();

                                        setToastMessage(`✅ ${market.tokenSymbol} token launched! YES voters can claim`);
                                        setShowToast(true);
                                        setTimeout(() => setShowToast(false), 3000);
                                      } else {
                                        const parsedError = parseError(result.error);
                                        setToastMessage(`❌ ${parsedError.title}: ${parsedError.message}`);
                                        setShowToast(true);
                                        setTimeout(() => setShowToast(false), 5000);
                                      }
                                    }}
                                    disabled={isResolving}
                                    className="w-full mono uppercase tracking-[0.18em] text-[0.72rem] font-medium"
                                    style={{ background: FOREST, color: CREAM, border: 'none' }}
                                  >
                                    {isResolving ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Launching…
                                      </>
                                    ) : (
                                      <>Launch ${market.tokenSymbol} now</>
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Prediction Phase - Normal Active Market */
                            <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${HAIR}` }}>
                              <div>
                                <p className="mono uppercase tracking-[0.28em] text-[0.55rem] mb-1" style={{ color: FOREST }}>● Active market</p>
                                <p style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.82rem' }}>Voting is open</p>
                              </div>
                              <div className="text-right">
                                <div className="mono uppercase tracking-[0.22em] text-[0.5rem] mb-1" style={{ color: CREAM_FAINT }}>Expires in</div>
                                <CountdownTimer expiryTime={market.expiryTime} size="lg" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {mergedOnchainData.data.resolution === 'Unresolved' && isMarketExpiredFromDB && (
                    <div className="text-center py-4 space-y-3" style={{ borderTop: `1px solid ${HAIR}` }}>
                      <p className="mono uppercase tracking-[0.28em] text-[0.6rem] mb-1" style={{ color: AMBER }}>● Awaiting resolution</p>
                      <p style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                        {mergedOnchainData.data.poolProgressPercentage < 100
                          ? 'Market expired without reaching target pool. All participants will be refunded.'
                          : Number(mergedOnchainData.data.totalYesShares) > Number(mergedOnchainData.data.totalNoShares)
                            ? `Market expired with YES winning. ${market.tokenSymbol} token is ready to launch.`
                            : 'Market expired with NO winning. NO voters can claim SOL rewards.'}
                      </p>

                      {/* YES Wins - Show Launch Token button (only for founder) or waiting message (for others) */}
                      {mergedOnchainData.data.poolProgressPercentage >= 100 &&
                       Number(mergedOnchainData.data.totalYesShares) > Number(mergedOnchainData.data.totalNoShares) ? (
                        <div className="space-y-3">
                          <div className="p-4 text-left" style={{ background: `${FOREST}0d`, border: `1px solid ${FOREST}33` }}>
                            <p className="mono uppercase tracking-[0.28em] text-[0.55rem] mb-2" style={{ color: FOREST }}>YES wins · token launch required</p>

                            {/* Founder sees launch button */}
                            {primaryWallet?.address === mergedOnchainData.data.founder ? (
                              <>
                                <p style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '0.4rem' }}>
                                  The market has expired with YES winning. Click below to create the {market.tokenSymbol} token and complete resolution.
                                </p>
                                <p className="italic" style={{ color: PEACH, fontFamily: 'var(--font-fraunces, serif)', fontStyle: 'italic', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
                                  Token will have a branded PNL address ending with &quot;pnl&quot;.
                                </p>
                                <Button
                                  onClick={async () => {
                                    const tokenMetadata = {
                                      name: market.name,
                                      symbol: market.tokenSymbol,
                                      description: market.description,
                                      imageUrl: market.projectImageUrl || '',
                                      twitter: market.metadata?.socialLinks?.twitter || '',
                                      telegram: market.metadata?.socialLinks?.telegram || '',
                                      website: market.metadata?.socialLinks?.website || '',
                                    };

                                    const result = await resolve({
                                      marketId: params.id as string,
                                      marketAddress: market.marketAddress,
                                      tokenMetadata,
                                      needsTokenLaunch: true,
                                    });

                                    if (result.success) {
                                      fetchMarketDetails(params.id as string);
                                      refetchOnchainData();
                                      refetchHistory();
                                      refetchHolders();

                                      setToastMessage(`✅ ${market.tokenSymbol} token launched! YES voters can claim`);
                                      setShowToast(true);
                                      setTimeout(() => setShowToast(false), 3000);
                                    } else {
                                      const parsedError = parseError(result.error);
                                      setToastMessage(`❌ ${parsedError.title}: ${parsedError.message}`);
                                      setShowToast(true);
                                      setTimeout(() => setShowToast(false), 5000);
                                    }
                                  }}
                                  disabled={isResolving || !primaryWallet}
                                  className="w-full mono uppercase tracking-[0.18em] text-[0.72rem] font-medium py-2.5"
                                  style={{ background: FOREST, color: CREAM, border: 'none' }}
                                >
                                  {isResolving ? (
                                    <div className="flex flex-col items-center justify-center space-y-1">
                                      <div className="flex items-center">
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        <span>Launching token…</span>
                                      </div>
                                      <span className="text-[0.6rem]" style={{ opacity: 0.7, letterSpacing: '0.16em' }}>
                                        ~30-60 sec
                                      </span>
                                    </div>
                                  ) : (
                                    <>Launch ${market.tokenSymbol} token</>
                                  )}
                                </Button>
                              </>
                            ) : (
                              /* Other users see waiting message */
                              <>
                                <p style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '0.5rem' }}>
                                  The market has expired with YES winning. The {market.tokenSymbol} token will be launched soon.
                                </p>
                                <div className="flex items-center justify-center space-x-2 py-3" style={{ background: `${AMBER}0d`, border: `1px solid ${AMBER}33` }}>
                                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: AMBER }} />
                                  <span className="mono uppercase tracking-[0.22em] text-[0.6rem]" style={{ color: AMBER }}>
                                    Waiting for founder to launch token…
                                  </span>
                                </div>
                                <p style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.78rem', marginTop: '0.5rem', textAlign: 'center', fontStyle: 'italic' }}>
                                  Once launched, YES voters will be able to claim their token airdrop.
                                </p>
                              </>
                            )}
                          </div>
                          {(!primaryWallet || primaryWallet.address !== mergedOnchainData.data.founder) && (
                            <p className="mono uppercase tracking-[0.22em] text-[0.55rem]" style={{ color: AMBER }}>Connect wallet to see your position</p>
                          )}
                        </div>
                      ) : (
                        /* NO Wins or Refund - Show regular Resolve button */
                        <>
                          <Button
                            onClick={handleResolve}
                            disabled={isResolving || !primaryWallet}
                            className="mono uppercase tracking-[0.18em] text-[0.72rem] font-medium py-2.5 px-6"
                            style={{ background: AMBER, color: BG, border: 'none' }}
                          >
                            {isResolving ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Resolving market…
                              </>
                            ) : (
                              <>Resolve market</>
                            )}
                          </Button>
                          {!primaryWallet && (
                            <p className="mono uppercase tracking-[0.22em] text-[0.55rem] mt-2" style={{ color: AMBER }}>Connect wallet to resolve this market</p>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {mergedOnchainData.data.resolution === 'YesWins' && (
                    <div className="py-2 space-y-4" style={{ borderTop: `1px solid ${HAIR}` }}>
                      <div className="text-center">
                        <p className="mono uppercase tracking-[0.32em] text-[0.65rem] mb-2" style={{ color: FOREST }}>YES wins · token launched</p>
                        <p style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                          ${market.tokenSymbol} is live. Trade in the panel above.
                        </p>
                      </div>

                      {/* YES Voter Claim - Exclude founder (they have Team Token section) */}
                      {positionData?.success && positionData.data.hasPosition && !positionData.data.claimed && primaryWallet?.address !== mergedOnchainData.data.founder && (
                        <div className="mt-3 text-center">
                          {positionData.data.side === 'yes' ? (
                            <Button
                              onClick={handleClaim}
                              disabled={isClaiming}
                              className="mono uppercase tracking-[0.18em] text-[0.72rem] font-medium py-2.5 px-6"
                              style={{ background: FOREST, color: CREAM, border: 'none' }}
                            >
                              {isClaiming ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Claiming…
                                </>
                              ) : (
                                <>Claim token airdrop</>
                              )}
                            </Button>
                          ) : (
                            <p className="mono uppercase tracking-[0.22em] text-[0.55rem]" style={{ color: EARTH }}>You voted NO and lost this prediction</p>
                          )}
                        </div>
                      )}

                      {/* Already Claimed - YES Voters (exclude founder) */}
                      {positionData?.success && positionData.data.hasPosition && positionData.data.claimed && positionData.data.side === 'yes' && primaryWallet?.address !== mergedOnchainData.data.founder && (
                        <div className="mt-3">
                          <div className="p-4" style={{ background: `${FOREST}0d`, border: `1px solid ${FOREST}33` }}>
                            <p className="flex items-center justify-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem]" style={{ color: FOREST }}>
                              <CheckCircle className="w-4 h-4" />
                              Already claimed
                            </p>
                            <p className="mt-1" style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.82rem' }}>
                              Your token airdrop has been transferred to your wallet.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Team Token Transparency Section - Visible to ALL users when vesting initialized */}
                      {mergedOnchainData.data.tokenMint && mergedOnchainData.data.teamVestingInitialized && mergedOnchainData.data.teamVestingData && (
                        <div className="p-4 text-left space-y-3" style={{ background: `${AMBER}0d`, border: `1px solid ${AMBER}33` }}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Users className="w-4 h-4" style={{ color: AMBER }} />
                              <p className="mono uppercase tracking-[0.28em] text-[0.55rem]" style={{ color: AMBER }}>
                                Team token allocation · 33%
                              </p>
                            </div>
                            <span className="mono uppercase tracking-[0.22em] text-[0.5rem]" style={{ color: CREAM_FAINT }}>Transparency</span>
                          </div>

                          {/* Vesting Progress Bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between mono text-[0.6rem] uppercase tracking-[0.2em]">
                              <span style={{ color: CREAM_FAINT }}>Vesting progress</span>
                              <span style={{ color: AMBER, fontFeatureSettings: '"tnum" on' }}>{(Number(mergedOnchainData.data.teamVestingData?.vestingProgressPercent) || 0).toFixed(1)}%</span>
                            </div>
                            <div className="w-full h-1 overflow-hidden" style={{ background: HAIR_STRONG }}>
                              <div
                                className="h-full transition-all duration-500"
                                style={{ width: `${Math.min(100, mergedOnchainData.data.teamVestingData.vestingProgressPercent)}%`, background: AMBER }}
                              />
                            </div>
                          </div>

                          {/* Token Breakdown */}
                          <div className="space-y-2 pt-2" style={{ borderTop: `1px solid ${HAIR}` }}>
                            <div className="flex justify-between text-xs">
                              <span style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}>Total team tokens</span>
                              <span className="mono" style={{ color: CREAM, fontFeatureSettings: '"tnum" on' }}>
                                {(Number(mergedOnchainData.data.teamVestingData.totalTokens) / 1_000_000).toLocaleString()} {market.tokenSymbol}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}>Immediate · 8%</span>
                              <span className="mono" style={{ color: mergedOnchainData.data.teamVestingData.immediateClaimed ? FOREST : AMBER, fontFeatureSettings: '"tnum" on' }}>
                                {(Number(mergedOnchainData.data.teamVestingData.immediateTokens) / 1_000_000).toLocaleString()} {market.tokenSymbol}
                                {mergedOnchainData.data.teamVestingData.immediateClaimed && ' · claimed'}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}>Vested · 25%</span>
                              <span className="mono" style={{ color: PEACH, fontFeatureSettings: '"tnum" on' }}>
                                {(Number(mergedOnchainData.data.teamVestingData.vestingTokens) / 1_000_000).toLocaleString()} {market.tokenSymbol}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}>Vested unlocked</span>
                              <span className="mono" style={{ color: PEACH, fontFeatureSettings: '"tnum" on' }}>
                                {(Number(mergedOnchainData.data.teamVestingData.vestedUnlocked) / 1_000_000).toLocaleString()} {market.tokenSymbol}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}>Already claimed</span>
                              <span className="mono" style={{ color: FOREST, fontFeatureSettings: '"tnum" on' }}>
                                {(Number(mergedOnchainData.data.teamVestingData.claimedTokens) / 1_000_000).toLocaleString()} {market.tokenSymbol}
                              </span>
                            </div>
                          </div>

                          {/* Next Unlock Info */}
                          {mergedOnchainData.data.teamVestingData.vestingProgressPercent < 100 && mergedOnchainData.data.teamVestingData.nextUnlockTime && (
                            <div className="flex justify-between text-xs pt-2" style={{ borderTop: `1px solid ${HAIR}` }}>
                              <span style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}>Next unlock</span>
                              <span className="mono" style={{ color: PEACH, fontFeatureSettings: '"tnum" on' }}>
                                {(Number(mergedOnchainData.data.teamVestingData.nextUnlockAmount) / 1_000_000).toLocaleString()} {market.tokenSymbol} · {Math.max(0, Math.ceil((mergedOnchainData.data.teamVestingData.nextUnlockTime - Date.now() / 1000) / 86400))} days
                              </span>
                            </div>
                          )}

                          {/* Founder Actions */}
                          {primaryWallet?.address === mergedOnchainData.data.founder && (
                            <div className="pt-3" style={{ borderTop: `1px solid ${HAIR}` }}>
                              <Button
                                onClick={handleClaimTeamTokens}
                                disabled={isClaimingTeamTokens || Number(mergedOnchainData.data.teamVestingData.claimableNow) === 0}
                                className="w-full mono uppercase tracking-[0.18em] text-[0.72rem] font-medium"
                                style={
                                  Number(mergedOnchainData.data.teamVestingData.claimableNow) > 0
                                    ? { background: AMBER, color: BG, border: 'none' }
                                    : { background: 'rgba(244,238,228,0.06)', color: CREAM_FAINT, border: `1px solid ${HAIR_STRONG}`, cursor: 'not-allowed' }
                                }
                              >
                                {isClaimingTeamTokens ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Claiming…
                                  </>
                                ) : Number(mergedOnchainData.data.teamVestingData.claimableNow) > 0 ? (
                                  <>Claim {(Number(mergedOnchainData.data.teamVestingData.claimableNow) / 1_000_000).toLocaleString()} {market.tokenSymbol}</>
                                ) : (
                                  <>No tokens to claim yet</>
                                )}
                              </Button>
                              {Number(mergedOnchainData.data.teamVestingData.claimableNow) === 0 && mergedOnchainData.data.teamVestingData.vestingProgressPercent < 100 && (
                                <p className="italic mt-2 text-center" style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)', fontStyle: 'italic', fontSize: '0.78rem' }}>
                                  Next tokens unlock in ~{Math.max(0, Math.ceil((mergedOnchainData.data.teamVestingData.nextUnlockTime! - Date.now() / 1000) / 86400))} days
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Team Vesting Initialize Section - Only for founder when not initialized */}
                      {primaryWallet?.address === mergedOnchainData.data.founder && mergedOnchainData.data.tokenMint && !mergedOnchainData.data.teamVestingInitialized && (
                        <div className="p-4 text-left space-y-3" style={{ background: `${AMBER}0d`, border: `1px solid ${AMBER}33` }}>
                          <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4" style={{ color: AMBER }} />
                            <p className="mono uppercase tracking-[0.28em] text-[0.55rem]" style={{ color: AMBER }}>
                              Team token allocation · 33%
                            </p>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}>Immediate · 8%</span>
                              <span className="mono uppercase tracking-[0.2em] text-[0.6rem]" style={{ color: AMBER }}>Claimable after init</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}>Vested · 25%</span>
                              <span className="mono uppercase tracking-[0.2em] text-[0.6rem]" style={{ color: PEACH }}>12 month linear</span>
                            </div>
                          </div>

                          <Button
                            onClick={handleInitTeamVesting}
                            disabled={isInitializing}
                            className="w-full mono uppercase tracking-[0.18em] text-[0.72rem] font-medium"
                            style={{ background: AMBER, color: BG, border: 'none' }}
                          >
                            {isInitializing ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Initializing…
                              </>
                            ) : (
                              <>Initialize team vesting</>
                            )}
                          </Button>

                          <p className="italic" style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)', fontStyle: 'italic', fontSize: '0.78rem' }}>
                            Initialize vesting to start claiming your team tokens — 8% immediate + 25% over 12 months.
                          </p>
                        </div>
                      )}

                      {/* Founder SOL Vesting Section - Only for founder when pool > 50 SOL */}
                      {primaryWallet?.address === mergedOnchainData.data.founder && mergedOnchainData.data.hasExcessSol && (
                        <div className="p-4 text-left space-y-3" style={{ background: `${FOREST}0d`, border: `1px solid ${FOREST}33` }}>
                          <div className="flex items-center space-x-2">
                            <Target className="w-4 h-4" style={{ color: FOREST }} />
                            <p className="mono uppercase tracking-[0.28em] text-[0.55rem]" style={{ color: FOREST }}>
                              Excess SOL allocation
                            </p>
                          </div>

                          {/* Show actual vesting data if initialized, otherwise show estimates */}
                          {mergedOnchainData.data.founderVestingInitialized && mergedOnchainData.data.founderVestingData ? (
                            <>
                              {/* Vesting Progress Bar */}
                              <div className="space-y-1">
                                <div className="flex justify-between mono text-[0.6rem] uppercase tracking-[0.2em]">
                                  <span style={{ color: CREAM_FAINT }}>Vesting progress</span>
                                  <span style={{ color: FOREST, fontFeatureSettings: '"tnum" on' }}>{(Number(mergedOnchainData.data.founderVestingData?.vestingProgressPercent) || 0).toFixed(1)}%</span>
                                </div>
                                <div className="w-full h-1 overflow-hidden" style={{ background: HAIR_STRONG }}>
                                  <div
                                    className="h-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, mergedOnchainData.data.founderVestingData.vestingProgressPercent)}%`, background: FOREST }}
                                  />
                                </div>
                              </div>

                              {/* SOL Breakdown */}
                              <div className="space-y-2 pt-2" style={{ borderTop: `1px solid ${HAIR}` }}>
                                <div className="flex justify-between text-xs">
                                  <span style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}>Total excess SOL</span>
                                  <span className="mono" style={{ color: CREAM, fontFeatureSettings: '"tnum" on' }}>
                                    {(Number(mergedOnchainData.data.founderVestingData.totalSol) / 1_000_000_000).toFixed(4)} SOL
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}>Immediate · 8%</span>
                                  <span className="mono" style={{ color: mergedOnchainData.data.founderVestingData.immediateClaimed ? FOREST : PEACH, fontFeatureSettings: '"tnum" on' }}>
                                    {(Number(mergedOnchainData.data.founderVestingData.immediateSol) / 1_000_000_000).toFixed(4)} SOL
                                    {mergedOnchainData.data.founderVestingData.immediateClaimed && ' · claimed'}
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}>Vested · 92%</span>
                                  <span className="mono" style={{ color: PEACH, fontFeatureSettings: '"tnum" on' }}>
                                    {(Number(mergedOnchainData.data.founderVestingData.vestingSol) / 1_000_000_000).toFixed(4)} SOL
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}>Vested unlocked</span>
                                  <span className="mono" style={{ color: PEACH, fontFeatureSettings: '"tnum" on' }}>
                                    {(Number(mergedOnchainData.data.founderVestingData.vestedUnlocked) / 1_000_000_000).toFixed(4)} SOL
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}>Already claimed</span>
                                  <span className="mono" style={{ color: FOREST, fontFeatureSettings: '"tnum" on' }}>
                                    {(Number(mergedOnchainData.data.founderVestingData.claimedSol) / 1_000_000_000).toFixed(4)} SOL
                                  </span>
                                </div>
                              </div>

                              {/* Next Unlock Info */}
                              {mergedOnchainData.data.founderVestingData.vestingProgressPercent < 100 && mergedOnchainData.data.founderVestingData.nextUnlockTime && (
                                <div className="flex justify-between text-xs pt-2" style={{ borderTop: `1px solid ${HAIR}` }}>
                                  <span style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}>Next unlock</span>
                                  <span className="mono" style={{ color: PEACH, fontFeatureSettings: '"tnum" on' }}>
                                    {(Number(mergedOnchainData.data.founderVestingData.nextUnlockAmount) / 1_000_000_000).toFixed(4)} SOL · {Math.max(0, Math.ceil((mergedOnchainData.data.founderVestingData.nextUnlockTime - Date.now() / 1000) / 86400))} days
                                  </span>
                                </div>
                              )}

                              {/* Claim Button */}
                              <div className="pt-3" style={{ borderTop: `1px solid ${HAIR}` }}>
                                <Button
                                  onClick={handleClaimFounderSol}
                                  disabled={isClaimingFounderSol || Number(mergedOnchainData.data.founderVestingData.claimableNow) === 0}
                                  className="w-full mono uppercase tracking-[0.18em] text-[0.72rem] font-medium"
                                  style={
                                    Number(mergedOnchainData.data.founderVestingData.claimableNow) > 0
                                      ? { background: FOREST, color: CREAM, border: 'none' }
                                      : { background: 'rgba(244,238,228,0.06)', color: CREAM_FAINT, border: `1px solid ${HAIR_STRONG}`, cursor: 'not-allowed' }
                                  }
                                >
                                  {isClaimingFounderSol ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Claiming…
                                    </>
                                  ) : Number(mergedOnchainData.data.founderVestingData.claimableNow) > 0 ? (
                                    <>Claim {(Number(mergedOnchainData.data.founderVestingData.claimableNow) / 1_000_000_000).toFixed(4)} SOL</>
                                  ) : (
                                    <>No SOL to claim yet</>
                                  )}
                                </Button>
                                {Number(mergedOnchainData.data.founderVestingData.claimableNow) === 0 && mergedOnchainData.data.founderVestingData.vestingProgressPercent < 100 && (
                                  <p className="italic mt-2 text-center" style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)', fontStyle: 'italic', fontSize: '0.78rem' }}>
                                    Next SOL unlock in ~{Math.max(0, Math.ceil((mergedOnchainData.data.founderVestingData.nextUnlockTime! - Date.now() / 1000) / 86400))} days
                                  </p>
                                )}
                              </div>
                            </>
                          ) : (
                            <>
                              {/* Show estimates before vesting is initialized */}
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                  <span style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}>Total excess SOL</span>
                                  <span className="mono" style={{ color: FOREST, fontFeatureSettings: '"tnum" on' }}>{(Number(mergedOnchainData.data.excessSolInSol) || 0).toFixed(4)} SOL</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}>Immediate · 8%</span>
                                  <span className="mono" style={{ color: PEACH, fontFeatureSettings: '"tnum" on' }}>{((Number(mergedOnchainData.data.excessSolInSol) || 0) * 0.08).toFixed(4)} SOL</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}>Vested · 92%</span>
                                  <span className="mono" style={{ color: PEACH, fontFeatureSettings: '"tnum" on' }}>{((Number(mergedOnchainData.data.excessSolInSol) || 0) * 0.92).toFixed(4)} SOL · 12 mo</span>
                                </div>
                              </div>

                              {/* Initialize SOL Vesting Button */}
                              <Button
                                onClick={handleInitFounderSolVesting}
                                disabled={isInitializingFounderSol}
                                className="w-full mono uppercase tracking-[0.18em] text-[0.72rem] font-medium"
                                style={{ background: FOREST, color: CREAM, border: 'none' }}
                              >
                                {isInitializingFounderSol ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Initializing…
                                  </>
                                ) : (
                                  <>Initialize SOL vesting</>
                                )}
                              </Button>

                              <p className="italic" style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)', fontStyle: 'italic', fontSize: '0.78rem' }}>
                                Pool exceeded 50 SOL. 50 SOL was used for token launch — the rest is yours with vesting.
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {mergedOnchainData.data.resolution === 'NoWins' && (
                    <div className="text-center py-2 space-y-4" style={{ borderTop: `1px solid ${HAIR}` }}>
                      <div>
                        <p className="mono uppercase tracking-[0.32em] text-[0.65rem] mb-2" style={{ color: EARTH }}>NO wins · project won&apos;t launch</p>
                        <p style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                          NO voters receive proportional SOL rewards.
                        </p>
                      </div>

                      {positionData?.success && positionData.data.hasPosition && !positionData.data.claimed && (
                        <div className="mt-3">
                          {positionData.data.side === 'no' ? (
                            <Button
                              onClick={handleClaim}
                              disabled={isClaiming}
                              className="mono uppercase tracking-[0.18em] text-[0.72rem] font-medium py-2.5 px-6"
                              style={{ background: FOREST, color: CREAM, border: 'none' }}
                            >
                              {isClaiming ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Claiming…
                                </>
                              ) : (
                                <>Claim SOL rewards</>
                              )}
                            </Button>
                          ) : (
                            <p className="mono uppercase tracking-[0.22em] text-[0.55rem]" style={{ color: EARTH }}>You voted YES and lost this prediction</p>
                          )}
                        </div>
                      )}

                      {/* Already Claimed - NO Voters */}
                      {positionData?.success && positionData.data.hasPosition && positionData.data.claimed && positionData.data.side === 'no' && (
                        <div className="mt-3">
                          <div className="p-4" style={{ background: `${FOREST}0d`, border: `1px solid ${FOREST}33` }}>
                            <p className="flex items-center justify-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem]" style={{ color: FOREST }}>
                              <CheckCircle className="w-4 h-4" />
                              Already claimed
                            </p>
                            <p className="mt-1" style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.82rem' }}>
                              Your SOL rewards have been transferred to your wallet.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {mergedOnchainData.data.resolution === 'Refund' && (
                    <div className="text-center py-2" style={{ borderTop: `1px solid ${HAIR}` }}>
                      <p className="mono uppercase tracking-[0.32em] text-[0.65rem] mb-2" style={{ color: PEACH }}>Refund · market cancelled</p>
                      <p style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                        All participants receive full refunds.
                      </p>

                      {positionData?.success && positionData.data.hasPosition && !positionData.data.claimed ? (
                        <div className="mt-3">
                          <Button
                            onClick={handleClaim}
                            disabled={isClaiming}
                            className="mono uppercase tracking-[0.18em] text-[0.72rem] font-medium py-2.5 px-6"
                            style={{ background: PEACH, color: BG, border: 'none' }}
                          >
                            {isClaiming ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Claiming…
                              </>
                            ) : (
                              <>Claim refund · {(Number(positionData.data?.totalAmount) || 0).toFixed(3)} SOL</>
                            )}
                          </Button>
                        </div>
                      ) : positionData?.data?.claimed ? (
                        <div className="mt-3">
                          <div className="p-4" style={{ background: `${FOREST}0d`, border: `1px solid ${FOREST}33` }}>
                            <p className="flex items-center justify-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem]" style={{ color: FOREST }}>
                              <CheckCircle className="w-4 h-4" />
                              Already claimed
                            </p>
                            <p className="mt-1" style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.82rem' }}>
                              Your refund has been transferred to your wallet.
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Close Market Button - Only for founder after 30-day claim period */}
                  {mergedOnchainData.data.resolution !== 'Unresolved' && primaryWallet?.address === mergedOnchainData.data.founder && (
                    <div className="pt-4 mt-4" style={{ borderTop: `1px solid ${HAIR}` }}>
                      <div className="p-4" style={{ background: 'rgba(244,238,228,0.025)', border: `1px solid ${HAIR_STRONG}` }}>
                        <div className="flex items-center space-x-2 mb-3">
                          <Target className="w-4 h-4" style={{ color: CREAM_FAINT }} />
                          <p className="mono uppercase tracking-[0.28em] text-[0.55rem]" style={{ color: CREAM_DIM }}>
                            Market cleanup · founder only
                          </p>
                        </div>

                        <p className="mb-3" style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                          After 30 days from market expiry and when all rewards have been claimed (pool balance empty), you can close the market to recover rent — ~0.01 SOL.
                        </p>

                        <Button
                          onClick={handleCloseMarket}
                          disabled={isClosingMarket}
                          className="w-full mono uppercase tracking-[0.18em] text-[0.72rem] font-medium"
                          style={{ background: 'rgba(244,238,228,0.06)', color: CREAM, border: `1px solid ${HAIR_STRONG}` }}
                        >
                          {isClosingMarket ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Closing…
                            </>
                          ) : (
                            <>Close market &amp; recover rent</>
                          )}
                        </Button>

                        <p className="italic mt-2" style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)', fontStyle: 'italic', fontSize: '0.74rem' }}>
                          Will fail if the 30-day claim period hasn&apos;t passed or if the pool still has funds. The market account will be permanently deleted.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
            </div>
          </section>

          {/* Video + What This Project Offers - Only show when token IS launched */}
          {isTokenLaunched && tokenMintAddress && (
            <>
              {/* Video */}
              {market.metadata?.videoUrl && (
                <VideoEmbed url={market.metadata.videoUrl} />
              )}

              {/* What This Project Offers */}
              {market.metadata?.additionalNotes && (
                <div className="relative">
                  <div className="relative p-4" style={{ background: 'rgba(244,238,228,0.025)', border: `1px solid ${HAIR_STRONG}` }}>
                    <p className="mono uppercase tracking-[0.28em] text-[0.55rem] mb-3" style={{ color: AMBER }}>
                      What this project offers
                    </p>
                    <div className="pl-3" style={{ borderLeft: `2px solid ${AMBER}88` }}>
                      <p className="whitespace-pre-wrap italic" style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)', fontStyle: 'italic', fontSize: '0.92rem', lineHeight: 1.65 }}>{market.metadata.additionalNotes}</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Roadmap — founder-declared, git-settled milestones. The
              back-the-builder resolution surface; sits with the stake. */}
          <MilestoneRoadmap marketId={params.id as string} founderWallet={market.founderWallet || null} />
          </div>

          {/* Community pane — the chat/voice that used to float over this column,
              now an in-flow tab so it never overlaps the conviction panel. */}
          <div className={railTab === 'community' ? '' : 'hidden'}>
            <CommunityHub
              marketId={params.id as string}
              marketAddress={market?.marketAddress || (params.id as string)}
              marketName={(market as any)?.name || (market as any)?.title || ''}
              walletAddress={primaryWallet?.address ?? null}
              founderWallet={market?.founderWallet || null}
              hasPosition={true}
              socialLinks={market?.metadata?.socialLinks as any}
              className="h-[calc(100vh-11rem)]"
            />
          </div>
        </div>
        </div>

        {/* Chat/voice now lives in the rail's Community tab (above) */}

      </div>
      {/* End Main Layout */}

        {/* Error Dialog */}
        <ErrorDialog
          open={errorDialog.open}
          onClose={() => setErrorDialog(prev => ({ ...prev, open: false }))}
          title={errorDialog.title}
          message={errorDialog.message}
          details={errorDialog.details}
        />

        {/* Success Dialog */}
        <SuccessDialog
          open={successDialog.open}
          onClose={() => setSuccessDialog(prev => ({ ...prev, open: false }))}
          title={successDialog.title}
          message={successDialog.message}
          signature={successDialog.signature}
          details={successDialog.details}
        />

      </div>

      {/* Toast Notification - OUTSIDE transformed container for proper fixed positioning */}
      {showToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-2 px-3 sm:px-0 w-[calc(100%-24px)] sm:w-auto max-w-md">
          <div className="bg-gray-900 border border-white/20 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg shadow-lg flex items-center space-x-2">
            <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 flex-shrink-0" />
            <span className="text-sm sm:text-base">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Token Launch Animation Overlay */}
      <TokenLaunchAnimation
        isVisible={isResolving}
        tokenSymbol={market?.tokenSymbol}
      />

      {/* Founder-only media editor (pre-resolution) */}
      {showMediaEdit && market && (
        <MarketMediaEditModal
          marketId={params.id as string}
          current={{
            projectImageUrl: market.projectImageUrl,
            pitchVideoUrl: (market as any).pitchVideoUrl,
            documentUrls: market.documentUrls,
          }}
          onClose={() => setShowMediaEdit(false)}
          onUpdated={() => fetchMarketDetails(params.id as string)}
        />
      )}

      {/* Mobile community FAB — one-tap to the rail's Community (chat/voice) tab.
          Sits above the vote bar when that's shown. Single affordance, no
          double-mount of CommunityHub (it just switches the rail tab). */}
      <button
        type="button"
        onClick={() => {
          setRailTab('community');
          document.getElementById('conviction-rail')?.scrollIntoView({ behavior: 'smooth' });
        }}
        className="lg:hidden fixed right-4 z-40 p-3 rounded-full transition-transform hover:scale-105"
        style={{
          bottom:
            !isTokenLaunched && mergedOnchainData?.data?.resolution === 'Unresolved' ? '5.25rem' : '1.5rem',
          background: 'rgba(10,8,20,0.92)',
          border: `1px solid ${HAIR_STRONG}`,
          color: AMBER,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 10px 28px rgba(0,0,0,0.4)',
        }}
        aria-label="Community"
        title="Community chat & voice"
      >
        <MessageCircle className="w-5 h-5" />
      </button>

      {/* Mobile sticky vote bar — the conviction rail stacks at the bottom on
          mobile, so this keeps a one-tap path to it. It does NOT duplicate the
          trade logic: it switches the rail to the Conviction tab, pre-selects a
          side, and smooth-scrolls to the panel where the user confirms + signs.
          lg:hidden = desktop shows the rail inline (top-right column). */}
      {!isTokenLaunched && mergedOnchainData?.data?.resolution === 'Unresolved' && (
        <div
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 px-3 py-2.5 flex items-center gap-2"
          style={{
            background: 'rgba(10,8,20,0.92)',
            backdropFilter: 'blur(12px)',
            borderTop: `1px solid ${HAIR_STRONG}`,
          }}
        >
          <div className="flex flex-col leading-tight mr-1 shrink-0">
            <span
              className="mono uppercase tracking-[0.2em] text-[0.45rem]"
              style={{ color: CREAM_FAINT }}
            >
              Conviction
            </span>
            <span className="mono text-[0.72rem] tabular-nums" style={{ color: CREAM }}>
              {yesPercentage}% YES
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setRailTab('conviction');
              setSelectedSide('yes');
              document.getElementById('conviction-rail')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex-1 mono uppercase tracking-[0.22em] text-[0.6rem] py-2.5"
            style={{ background: FOREST, color: CREAM }}
          >
            Vote YES
          </button>
          <button
            type="button"
            onClick={() => {
              setRailTab('conviction');
              setSelectedSide('no');
              document.getElementById('conviction-rail')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex-1 mono uppercase tracking-[0.22em] text-[0.6rem] py-2.5"
            style={{ background: EARTH, color: CREAM }}
          >
            Vote NO
          </button>
        </div>
      )}
    </>
  );
}

// ─── Tiny shared helpers used by the voting panel ───
function SummaryRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span
        className="mono uppercase tracking-[0.22em] text-[0.55rem]"
        style={{ color: CREAM_FAINT }}
      >
        {label}
      </span>
      <span
        className="mono text-[0.65rem] tabular-nums"
        style={{
          color: valueColor || CREAM,
          fontFeatureSettings: '"tnum" on',
          letterSpacing: '0.04em',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ProofStat({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <div className="text-center">
      <p
        className="leading-none mb-0.5"
        style={{
          color: color || CREAM,
          fontFamily: 'var(--font-fraunces, serif)',
          fontWeight: 350,
          fontSize: '0.95rem',
          fontFeatureSettings: '"tnum" on',
        }}
      >
        {value}
      </p>
      <p
        className="mono uppercase tracking-[0.22em] text-[0.5rem]"
        style={{ color: CREAM_FAINT }}
      >
        {label}
      </p>
    </div>
  );
}

function DetailTile({
  label,
  value,
  address,
  addressColor,
  network,
  icon,
}: {
  label: string;
  value?: string;
  address?: string;
  addressColor?: string;
  network?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className="p-2"
      style={{
        background: 'rgba(244,238,228,0.025)',
        border: `1px solid ${HAIR}`,
      }}
    >
      <p
        className="mono uppercase tracking-[0.22em] text-[0.5rem] mb-0.5"
        style={{ color: CREAM_FAINT }}
      >
        {label}
      </p>
      {address ? (
        <a
          href={`https://orb.helius.dev/address/${address}${
            network === 'devnet' ? '?cluster=devnet' : ''
          }`}
          target="_blank"
          rel="noopener noreferrer"
          className="mono text-[0.6rem] inline-flex items-center gap-1 transition-opacity"
          style={{
            color: addressColor || AMBER,
            letterSpacing: '0.02em',
          }}
        >
          {address.slice(0, 4)}…{address.slice(-4)}
          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
        </a>
      ) : (
        <div className="flex items-center gap-1.5">
          {icon}
          <span
            className="mono text-[0.7rem]"
            style={{ color: CREAM, letterSpacing: '0.02em' }}
          >
            {value}
          </span>
        </div>
      )}
    </div>
  );
}
