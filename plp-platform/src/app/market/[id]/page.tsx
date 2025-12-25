'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2, ArrowLeft, ExternalLink, Users, Target, MapPin, Briefcase, Globe, Github, Twitter, MessageCircle, Send, Share2, Heart, FileText, Copy, Check, Sparkles, X } from 'lucide-react';
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
import { parseError } from '@/lib/utils/errorParser';
import { useWallet } from '@/hooks/useWallet';
import useSWR from 'swr';
import ErrorDialog from '@/components/ErrorDialog';
import SuccessDialog from '@/components/SuccessDialog';
import { useMarketSocket } from '@/lib/hooks/useSocket';
import { TokenLaunchAnimation } from '@/components/TokenLaunchAnimation';

// Lazy load heavy components to reduce initial bundle size
const LiveActivityFeed = dynamic(() => import('@/components/LiveActivityFeed'), {
  loading: () => <div className="h-96 bg-white/5 animate-pulse rounded-lg" />,
  ssr: false,
});

const MarketHolders = dynamic(() => import('@/components/MarketHolders'), {
  loading: () => <div className="h-96 bg-white/5 animate-pulse rounded-lg" />,
  ssr: false,
});

const GrokRoast = dynamic(() => import('@/components/GrokRoast'), {
  loading: () => <div className="h-64 bg-white/5 animate-pulse rounded-lg" />,
  ssr: false,
});

const CommunityHub = dynamic(() => import('@/components/chat/CommunityHub'), {
  loading: () => <div className="h-[500px] sm:h-[600px] bg-white/5 animate-pulse rounded-lg" />,
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

export default function MarketDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { primaryWallet } = useWallet();
  const { network } = useNetwork(); // Get current network from wallet
  const [market, setMarket] = useState<MarketDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSide, setSelectedSide] = useState<'yes' | 'no'>('yes');
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

  // Favorite/Watchlist state
  const [isFavorite, setIsFavorite] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  // Contract address copy state
  const [copiedContract, setCopiedContract] = useState(false);

  // Toast notification state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Swipe gesture state for mobile navigation
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Community Hub sidebar state (mobile)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Minimum swipe distance (in px) to trigger navigation
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null); // Reset end position
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchEnd - touchStart;
    const isRightSwipe = distance > minSwipeDistance;

    // Navigate back to browse page on right swipe
    if (isRightSwipe) {
      router.push('/browse');
    }
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
      const response = await fetch(`/api/profile/${primaryWallet.address}/favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId: params.id }),
      });

      const result = await response.json();
      if (result.success) {
        setIsFavorite(result.data.isFavorite);
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

  // Reduce polling when Socket.IO is connected (real-time updates handle it)
  // When socket is connected, we only do initial fetch (no polling) - socket handles updates
  const activityPollInterval = socketConnected ? 0 : 20000; // No poll when connected, 20s when not
  const onchainPollInterval = socketConnected ? 0 : 20000; // No poll when connected, socket has poolBalance

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

  // Fetch on-chain market data (resolution status, pool progress)
  const { data: onchainData, mutate: refetchOnchainData } = useSWR(
    market?.marketAddress ? `/api/markets/${market.marketAddress}/onchain?network=${network}` : null,
    fetcher,
    {
      refreshInterval: onchainPollInterval,
      revalidateOnFocus: true,
      dedupingInterval: 10000,
    }
  );

  // Merge SWR onchain data with real-time socket data (socket takes priority when connected)
  // This eliminates RPC polling when socket is connected - saves credits
  const mergedOnchainData = useMemo(() => {
    if (!onchainData?.success) return onchainData;

    // If socket is connected and has data, merge it in (socket is more recent)
    if (socketConnected && socketMarketData) {
      return {
        ...onchainData,
        data: {
          ...onchainData.data,
          // Use socket data for pool info when available (real-time from blockchain sync)
          poolBalance: socketMarketData.poolBalance ?? onchainData.data.poolBalance,
          poolProgressPercentage: socketMarketData.poolProgressPercentage ?? onchainData.data.poolProgressPercentage,
          resolution: socketMarketData.resolution ?? onchainData.data.resolution,
          phase: socketMarketData.phase ?? onchainData.data.phase,
        },
      };
    }

    return onchainData;
  }, [onchainData, socketMarketData, socketConnected]);

  useEffect(() => {
    if (params.id) {
      fetchMarketDetails(params.id as string);
    }
  }, [params.id]);

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

  const fetchMarketDetails = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/markets/${id}`);
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

  // Read vote button states from API (single source of truth)
  const isYesVoteDisabled = (): boolean => {
    return market?.isYesVoteEnabled === false;
  };

  const isNoVoteDisabled = (): boolean => {
    return market?.isNoVoteEnabled === false;
  };

  const getVoteDisabledReason = (voteType: 'yes' | 'no'): string => {
    if (!market) return '';
    return voteType === 'yes'
      ? (market.yesVoteDisabledReason || 'Disabled')
      : (market.noVoteDisabledReason || 'Disabled');
  };

  // Helper to check if the currently selected side is disabled
  const isSelectedSideDisabled = (): boolean => {
    return selectedSide === 'yes' ? isYesVoteDisabled() : isNoVoteDisabled();
  };

  const handleVote = async (voteType: 'yes' | 'no') => {
    if (!market) return;

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
        const statusCheckResponse = await fetch('/api/markets/check-onchain-status', {
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
      teamWallet: mergedOnchainData.data.founder,
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-white" />
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="text-center py-12">
          <p className="text-red-400 text-xl mb-4">{error || 'Market not found'}</p>
          <Button onClick={() => router.push('/browse')} className="bg-gradient-to-r from-purple-500 to-pink-500 hidden sm:inline-flex">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Markets
          </Button>
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

  // Calculate dynamic market status
  const marketStatus = getDetailedMarketStatus(market, onchainData);

  return (
    <div
      className="pt-0.5 px-3 pb-3 sm:p-4 max-w-[1600px] mx-auto"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Main Layout: Content + Sidebar */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left Content Area (70% on desktop) */}
        <div className="flex-1 lg:w-[70%] space-y-3 sm:space-y-4">
          {/* Combined Header & Voting Stats Section */}
        <Card className="bg-white/5 backdrop-blur-xl border-white/10">
          <CardHeader className="pb-3 sm:pb-4">
            <div className="flex flex-col gap-3">
              {/* Top Section: Image, Title, Badges, Actions */}
              <div className="flex items-start gap-2 sm:gap-4">
                {/* Project Image */}
                {market.projectImageUrl ? (
                  <img
                    src={market.projectImageUrl}
                    alt={market.name}
                    className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl object-cover ring-2 ring-white/10 flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center ring-2 ring-white/10 flex-shrink-0">
                    <span className="text-2xl sm:text-3xl font-bold text-white/70">{market.name.charAt(0)}</span>
                  </div>
                )}

                {/* Project Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start gap-1 sm:gap-2 mb-2">
                    <CardTitle className="text-lg sm:text-2xl text-white line-clamp-2">{market.name}</CardTitle>

                    {/* Creator, Age, Share and Favorite */}
                    <div className="flex items-center gap-2 ml-auto sm:ml-0">
                      {/* Project Owner */}
                      {market.founderWallet && (
                        <Link
                          href={`/profile/${market.founderWallet}`}
                          className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-400/30 rounded-lg transition-all hover:scale-105"
                          title={`View ${market.founderDisplayName || 'owner'}'s profile`}
                        >
                          <Users className="w-3 h-3 text-amber-400" />
                          <span className="text-white text-xs font-medium">
                            {market.founderDisplayName || 'Unknown'}
                          </span>
                        </Link>
                      )}
                      {/* Project Age */}
                      {market.projectAge && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-white/5 rounded-lg border border-white/10">
                          <span className="text-xs text-gray-400">{market.projectAge}</span>
                        </div>
                      )}
                      <button
                        onClick={handleShare}
                        className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-colors group"
                        title="Share this market"
                      >
                        <Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-white transition-colors" />
                      </button>
                      {primaryWallet?.address && (
                        <button
                          onClick={toggleFavorite}
                          disabled={isTogglingFavorite}
                          className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                          title={isFavorite ? "Remove from watchlist" : "Add to watchlist"}
                        >
                          <Heart
                            className={`w-4 h-4 sm:w-5 sm:h-5 transition-all ${
                              isFavorite
                                ? 'text-red-500 fill-red-500'
                                : 'text-gray-400 group-hover:text-red-400'
                            }`}
                          />
                        </button>
                      )}
                      {/* Copyable Contract Address - Only show when token is minted */}
                      {mergedOnchainData?.success && mergedOnchainData.data.tokenMint && (
                        <button
                          onClick={() => handleCopyContract(mergedOnchainData.data.tokenMint!)}
                          className="flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors group border border-white/10 hover:border-white/20"
                          title="Copy contract address"
                        >
                          <span className="text-xs text-gray-400 font-mono hidden sm:inline">
                            {mergedOnchainData.data.tokenMint.slice(0, 4)}...{mergedOnchainData.data.tokenMint.slice(-4)}
                          </span>
                          <span className="text-xs text-gray-400 font-mono sm:hidden">CA</span>
                          {copiedContract ? (
                            <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-400" />
                          ) : (
                            <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 group-hover:text-white transition-colors" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Badges Row */}
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    <Badge className={`${marketStatus.badgeClass} text-xs`}>{marketStatus.status}</Badge>
                    {/* Phase Badge */}
                    {mergedOnchainData?.success && (
                      <Badge className={`text-xs ${
                        mergedOnchainData.data.phase === 'Funding'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-400/30'
                          : 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                      }`}>
                        {mergedOnchainData.data.phase === 'Funding' ? '💰 Funding' : '📊 Prediction'}
                      </Badge>
                    )}
                    {/* Data Source Indicator */}
                    {market.isStale && mergedOnchainData?.success && (
                      <Badge className="text-xs bg-cyan-500/20 text-cyan-300 border-cyan-400/30">
                        ⛓️ Live
                      </Badge>
                    )}
                    {market.isStale && !mergedOnchainData?.success && (
                      <Badge className="text-xs bg-yellow-500/20 text-yellow-300 border-yellow-400/30 animate-pulse">
                        ⚠️ Syncing
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Description - Full Width */}
              <CardDescription className="text-gray-300 text-sm sm:text-base leading-relaxed text-justify">
                {market.description}
              </CardDescription>

              {/* Token, Category, Stage & Social Links - Full Width */}
              <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
                    <div className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-white/5 rounded-lg border border-white/10">
                      <Target className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                      <span className="text-xs sm:text-sm font-semibold text-white">${market.tokenSymbol}</span>
                    </div>
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30 text-xs">
                      {formatLabel(market.category)}
                    </Badge>
                    <Badge className="bg-white/10 text-white border-white/20 text-xs">
                      {formatLabel(market.stage)}
                    </Badge>

                    {/* Documentation Link */}
                    {market.documentUrls && market.documentUrls.length > 0 && (
                      <a
                        href={market.documentUrls[0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-500/20 rounded-lg border border-blue-400/30 hover:bg-blue-500/30 transition-colors"
                        title="View project documentation"
                      >
                        <FileText className="w-3 h-3 sm:w-4 sm:h-4 text-blue-300" />
                        <span className="text-xs sm:text-sm font-medium text-blue-300 hidden sm:inline">Documentation</span>
                        <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-blue-300 sm:inline hidden" />
                      </a>
                    )}

                    {/* Social Links */}
                    {market.metadata?.socialLinks && Object.values(market.metadata.socialLinks).some(link => link) && (
                      <>
                        {market.metadata.socialLinks.website && (
                          <a
                            href={market.metadata.socialLinks.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 border border-blue-400/30 rounded-lg transition-all hover:scale-105"
                            title="Website"
                          >
                            <Globe className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" />
                            <span className="text-white text-xs sm:text-sm font-medium hidden sm:inline">Website</span>
                          </a>
                        )}
                        {market.metadata.socialLinks.twitter && (
                          <a
                            href={market.metadata.socialLinks.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-sky-500/20 to-blue-500/20 hover:from-sky-500/30 hover:to-blue-500/30 border border-sky-400/30 rounded-lg transition-all hover:scale-105"
                            title="Twitter"
                          >
                            <Twitter className="w-3 h-3 sm:w-4 sm:h-4 text-sky-400" />
                            <span className="text-white text-xs sm:text-sm font-medium hidden sm:inline">Twitter</span>
                          </a>
                        )}
                        {market.metadata.socialLinks.discord && (
                          <a
                            href={market.metadata.socialLinks.discord}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 hover:to-purple-500/30 border border-indigo-400/30 rounded-lg transition-all hover:scale-105"
                            title="Discord"
                          >
                            <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-400" />
                            <span className="text-white text-xs sm:text-sm font-medium hidden sm:inline">Discord</span>
                          </a>
                        )}
                        {market.metadata.socialLinks.github && (
                          <a
                            href={market.metadata.socialLinks.github}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-gray-500/20 to-slate-500/20 hover:from-gray-500/30 hover:to-slate-500/30 border border-gray-400/30 rounded-lg transition-all hover:scale-105"
                            title="GitHub"
                          >
                            <Github className="w-3 h-3 sm:w-4 sm:h-4 text-gray-300" />
                            <span className="text-white text-xs sm:text-sm font-medium hidden sm:inline">GitHub</span>
                          </a>
                        )}
                        {market.metadata.socialLinks.telegram && (
                          <a
                            href={market.metadata.socialLinks.telegram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 hover:from-blue-400/30 hover:to-cyan-400/30 border border-blue-300/30 rounded-lg transition-all hover:scale-105"
                            title="Telegram"
                          >
                            <Send className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" />
                            <span className="text-white text-xs sm:text-sm font-medium hidden sm:inline">Telegram</span>
                          </a>
                        )}
                        {market.metadata.socialLinks.linkedin && (
                          <a
                            href={market.metadata.socialLinks.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-blue-600/20 to-blue-700/20 hover:from-blue-600/30 hover:to-blue-700/30 border border-blue-500/30 rounded-lg transition-all hover:scale-105"
                            title="LinkedIn"
                          >
                            <Globe className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
                            <span className="text-white text-xs sm:text-sm font-medium hidden sm:inline">LinkedIn</span>
                          </a>
                        )}
                      </>
                    )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Grok Analysis and Trading - Side by Side */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Deep Space Analysis - Left Side */}
          <Card className="bg-gradient-to-br from-purple-900/20 via-indigo-900/20 to-cyan-900/20 backdrop-blur-xl border-purple-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg sm:text-xl flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <span>Deep Space Analysis</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
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
            </CardContent>
          </Card>

          {/* Trading Section - Right Side */}
          <div className="space-y-4">
          <Card className="bg-white/5 backdrop-blur-xl border-white/10 text-white h-fit">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-base sm:text-lg text-white">Trade on Market</CardTitle>
              <CardDescription className="text-gray-300 text-xs sm:text-sm">
                Should we launch ${market.tokenSymbol} token?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 px-4 pb-4">
              {/* Pool Progress Bar - Always show for context */}
              {mergedOnchainData?.success && (
                <div className="space-y-2">
                  {/* Pool Funding Progress */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-gray-400">Pool Progress</span>
                      <span className="text-[10px] font-semibold text-cyan-400">
                        {(Number(mergedOnchainData.data.poolBalance || 0) / 1e9).toFixed(2)} / {market.targetPool} SOL
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(mergedOnchainData.data.poolProgressPercentage || 0, 100)}%` }}
                      />
                    </div>
                    <div className="text-right mt-0.5">
                      <span className="text-[9px] text-purple-400">{mergedOnchainData.data.poolProgressPercentage || 0}% funded</span>
                    </div>
                  </div>

                  {/* YES/NO Distribution - Only show for resolved markets to prevent bandwagon voting */}
                  {mergedOnchainData.data.resolution !== 'Unresolved' && (market.totalParticipants > 0) && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-gray-400">Final Vote Distribution</span>
                        <span className="text-[10px] text-gray-500">
                          {market.totalParticipants || 0} total votes
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-green-500 transition-all duration-500"
                          style={{ width: `${yesPercentage || 50}%` }}
                        />
                        <div
                          className="h-full bg-red-500 transition-all duration-500"
                          style={{ width: `${100 - (yesPercentage || 50)}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <span className="text-[9px] text-green-400">YES {(yesPercentage || 0).toFixed(0)}%</span>
                        <span className="text-[9px] text-red-400">NO {(100 - (yesPercentage || 0)).toFixed(0)}%</span>
                      </div>
                    </div>
                  )}

                  {/* Participant count for unresolved markets - no percentages */}
                  {mergedOnchainData.data.resolution === 'Unresolved' && (market.totalParticipants > 0) && (
                    <div className="text-center">
                      <span className="text-[10px] text-gray-400">
                        {market.totalParticipants || 0} participants voted
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Side Selection Tabs */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-white/5 rounded-lg">
                <button
                  onClick={() => setSelectedSide('yes')}
                  disabled={isYesVoteDisabled() || isMarketExpired()}
                  className={`py-2 px-2.5 rounded-md font-semibold transition-all ${
                    selectedSide === 'yes'
                      ? 'bg-gradient-to-r from-green-500 to-cyan-500 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-white/10'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-center space-x-1.5">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">YES</span>
                    {/* Only show percentage for resolved markets to prevent bandwagon voting */}
                    {mergedOnchainData?.data?.resolution !== 'Unresolved' && (
                      <span className="text-xs opacity-75">{yesPercentage}%</span>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => setSelectedSide('no')}
                  disabled={isNoVoteDisabled() || isMarketExpired()}
                  className={`py-2 px-2.5 rounded-md font-semibold transition-all ${
                    selectedSide === 'no'
                      ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-white/10'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-center space-x-1.5">
                    <XCircle className="w-4 h-4" />
                    <span className="text-sm">NO</span>
                    {/* Only show percentage for resolved markets to prevent bandwagon voting */}
                    {mergedOnchainData?.data?.resolution !== 'Unresolved' && (
                      <span className="text-xs opacity-75">{100 - yesPercentage}%</span>
                    )}
                  </div>
                </button>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-400 font-medium">Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min={QUICK_VOTE_AMOUNT}
                    step="0.01"
                    disabled={isSelectedSideDisabled() || isMarketExpired()}
                    className={`w-full px-3 py-2.5 bg-white/10 border-2 rounded-lg text-white text-sm font-mono focus:outline-none transition-all ${
                      selectedSide === 'yes'
                        ? 'border-green-500/30 focus:border-green-500 focus:ring-2 focus:ring-green-500/50'
                        : 'border-red-500/30 focus:border-red-500 focus:ring-2 focus:ring-red-500/50'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    placeholder="0.00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-xs">SOL</span>
                </div>

                {/* Quick Amount Buttons */}
                <div className="grid grid-cols-4 gap-1">
                  {[QUICK_VOTE_AMOUNT.toString(), '0.1', '0.5', '1'].map((quickAmount) => (
                    <button
                      key={quickAmount}
                      onClick={() => setAmount(quickAmount)}
                      disabled={isSelectedSideDisabled() || isMarketExpired()}
                      className={`py-1 px-2 text-xs font-semibold rounded-md border transition-all ${
                        amount === quickAmount
                          ? selectedSide === 'yes'
                            ? 'border-green-500 bg-green-500/20 text-green-400'
                            : 'border-red-500 bg-red-500/20 text-red-400'
                          : 'border-white/20 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {quickAmount}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trade Summary */}
              <div className="p-2 sm:p-3 bg-white/5 rounded-lg border border-white/10 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Position</span>
                  <span className={`font-semibold ${selectedSide === 'yes' ? 'text-green-400' : 'text-red-400'}`}>
                    {selectedSide.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Amount</span>
                  <span className="text-white font-mono">{amount || '0.00'} SOL</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Fee (1.5%)</span>
                  <span className="text-white font-mono">{(parseFloat(amount || '0') * 0.015).toFixed(4)} SOL</span>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-white/10">
                  <span className="text-gray-300 font-semibold">Total</span>
                  <span className="text-white font-mono font-bold">{(parseFloat(amount || '0') * 1.015).toFixed(4)} SOL</span>
                </div>
              </div>

              {/* Trade Button */}
              <Button
                onClick={() => handleVote(selectedSide)}
                className={`w-full py-2.5 sm:py-3 text-sm sm:text-base font-bold ${
                  selectedSide === 'yes'
                    ? 'bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600'
                    : 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600'
                } text-white shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed`}
                disabled={isProcessingVote || !amount || parseFloat(amount) < QUICK_VOTE_AMOUNT || isMarketExpired() || isSelectedSideDisabled()}
              >
                {isSelectedSideDisabled() ? (
                  <>
                    <XCircle className="w-4 h-4 mr-1.5" />
                    <span className="text-sm">{getVoteDisabledReason(selectedSide)}</span>
                  </>
                ) : isMarketExpired() ? (
                  <>
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Market Expired
                  </>
                ) : isProcessingVote ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {selectedSide === 'yes' ? (
                      <CheckCircle className="w-4 h-4 mr-1.5" />
                    ) : (
                      <XCircle className="w-4 h-4 mr-1.5" />
                    )}
                    Buy {selectedSide.toUpperCase()} for {amount || '0.00'} SOL
                  </>
                )}
              </Button>

              {/* User's Position Section - Show if user has position */}
              {positionData?.success && positionData.data.hasPosition && (
                <div className="border-t border-white/10 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`p-1 rounded-full ${
                        positionData.data.side === 'yes'
                          ? 'bg-green-500/20'
                          : 'bg-red-500/20'
                      }`}>
                        {positionData.data.side === 'yes' ? (
                          <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-white text-xs font-semibold">Your Position</h3>
                        <p className="text-gray-300 text-[10px]">
                          <span className={`font-bold ${
                            positionData.data.side === 'yes' ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {positionData.data.side.toUpperCase()}
                          </span> · {(Number(positionData.data?.totalAmount) || 0).toFixed(3)} SOL
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-400 text-[10px]">Trades</div>
                      <div className="text-white text-sm font-bold">{positionData.data.tradeCount}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Market Info Section */}
              <div className="border-t border-white/10 pt-2">
                <h3 className="text-[10px] font-semibold text-gray-400 mb-1.5">Market Info</h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {/* Target Pool */}
                  <div className="p-1.5 bg-white/5 rounded">
                    <div className="text-[10px] text-gray-400">Target</div>
                    <div className="text-xs font-bold text-white">{market.targetPool} SOL</div>
                  </div>

                  {/* Total Participants */}
                  <div className="p-1.5 bg-white/5 rounded">
                    <div className="text-[10px] text-gray-400">Participants</div>
                    <div className="flex items-center space-x-1">
                      <Users className="w-2.5 h-2.5 text-cyan-400" />
                      <span className="text-xs font-bold text-white">{market.totalParticipants || 0}</span>
                    </div>
                  </div>

                  {/* Market Address */}
                  <div className="p-1.5 bg-white/5 rounded">
                    <div className="text-[10px] text-gray-400">Market</div>
                    <a
                      href={`https://orb.helius.dev/address/${market.marketAddress}${SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-0.5 text-cyan-400 hover:text-cyan-300 transition-colors text-[10px] group"
                    >
                      <span className="font-mono">{market.marketAddress.slice(0, 4)}...{market.marketAddress.slice(-4)}</span>
                      <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                    </a>
                  </div>

                  {/* Market Vault */}
                  {(() => {
                    try {
                      const [marketVaultPda] = getMarketVaultPDA(new PublicKey(market.marketAddress));
                      return (
                        <div className="p-1.5 bg-white/5 rounded">
                          <div className="text-[10px] text-gray-400">Vault</div>
                          <a
                            href={`https://orb.helius.dev/address/${marketVaultPda.toBase58()}${SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : ''}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-0.5 text-yellow-400 hover:text-yellow-300 transition-colors text-[10px] group"
                          >
                            <span className="font-mono">{marketVaultPda.toBase58().slice(0, 4)}...{marketVaultPda.toBase58().slice(-4)}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                          </a>
                        </div>
                      );
                    } catch (e) {
                      return null;
                    }
                  })()}

                  {/* Creator */}
                  {mergedOnchainData?.success && mergedOnchainData.data.founder && (
                    <div className="p-1.5 bg-white/5 rounded">
                      <div className="text-[10px] text-gray-400">Creator</div>
                      <a
                        href={`https://orb.helius.dev/address/${mergedOnchainData.data.founder}${SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-0.5 text-purple-400 hover:text-purple-300 transition-colors text-[10px] group"
                      >
                        <span className="font-mono">{mergedOnchainData.data.founder.slice(0, 4)}...{mergedOnchainData.data.founder.slice(-4)}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                      </a>
                    </div>
                  )}

                  {/* Token Mint (if created) */}
                  {mergedOnchainData?.success && mergedOnchainData.data.tokenMint && (
                    <div className="p-1.5 bg-white/5 rounded">
                      <div className="text-[10px] text-gray-400">Token</div>
                      <a
                        href={`https://orb.helius.dev/address/${mergedOnchainData.data.tokenMint}${SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-0.5 text-pink-400 hover:text-pink-300 transition-colors text-[10px] group"
                      >
                        <span className="font-mono">{mergedOnchainData.data.tokenMint.slice(0, 4)}...{mergedOnchainData.data.tokenMint.slice(-4)}</span>
                        <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

        {/* Market Status Card - Below Trading */}
        <Card className="bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-cyan-500/10 backdrop-blur-xl border-purple-400/30 h-fit">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-white text-sm sm:text-base">Market Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            {/* Market Status Section */}
            {mergedOnchainData?.success && (
              <>
                <div className="space-y-3">
                  {/* Status Message */}
                  {mergedOnchainData.data.resolution === 'Unresolved' && !isMarketExpiredFromDB && (
                    <>
                      {/* Pool Filled - Waiting for Resolution (but NOT in Funding Phase) */}
                      {mergedOnchainData.data.poolProgressPercentage >= 100 && mergedOnchainData.data.phase !== 'Funding' ? (
                        <div className="pt-2 border-t border-white/5">
                          <div className="bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-pink-500/10 border border-cyan-400/30 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h4 className="text-cyan-400 text-base font-bold mb-2 flex items-center space-x-2">
                                  <span>🎯</span>
                                  <span>Pool Complete - Voting Closed</span>
                                </h4>
                                <p className="text-gray-300 text-sm mb-2">
                                  The funding target has been reached! No more votes can be placed.
                                </p>
                                <p className="text-gray-400 text-xs">
                                  {Number(mergedOnchainData.data.totalYesShares) > Number(mergedOnchainData.data.totalNoShares)
                                    ? '✅ YES is currently winning - Token launch likely!'
                                    : '❌ NO is currently winning - No token launch'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-3 border-t border-white/10">
                              <div>
                                <p className="text-xs text-gray-400 mb-1">Resolution available in</p>
                                <CountdownTimer expiryTime={market.expiryTime} size="lg" />
                              </div>
                              <Badge className="bg-orange-500/20 text-orange-300 border-orange-400/30">
                                Awaiting Expiry
                              </Badge>
                            </div>
                          </div>

                          {/* Founder Actions - Only for founder when target reached and YES winning */}
                          {primaryWallet?.address === mergedOnchainData.data.founder &&
                           Number(mergedOnchainData.data.totalYesShares) > Number(mergedOnchainData.data.totalNoShares) && (
                            <div className="mt-4 bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-cyan-500/10 border border-purple-400/30 rounded-lg p-4 space-y-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="text-purple-400 text-sm font-semibold mb-1">🎯 Target Reached!</h4>
                                  {mergedOnchainData.data.phase === 'Funding' ? (
                                    <>
                                      <p className="text-gray-300 text-xs mb-2">
                                        Market is in Funding Phase. You can now launch your token!
                                      </p>
                                      <p className="text-cyan-300 text-xs italic">
                                        ✨ Token will have a branded PNL address ending with "pnl"
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-gray-300 text-xs mb-2">
                                        Your market has reached the target pool and YES is winning. <span className="text-yellow-400 font-semibold">Extend to Funding Phase first</span> to enable token launch.
                                      </p>
                                      <p className="text-cyan-300 text-xs italic">
                                        ✨ After extending, you can launch your token or continue raising funds
                                      </p>
                                    </>
                                  )}
                                </div>
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
                                  className="w-full bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600 text-white font-semibold"
                                >
                                  {isResolving ? (
                                    <div className="flex flex-col items-center justify-center space-y-1">
                                      <div className="flex items-center">
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        <span>Launching Token...</span>
                                      </div>
                                      <span className="text-xs text-gray-300 font-normal">
                                        This may take 30-60 seconds
                                      </span>
                                    </div>
                                  ) : (
                                    <>
                                      🚀 Launch ${market.tokenSymbol}
                                    </>
                                  )}
                                </Button>
                              ) : (
                                /* In Prediction Phase - Show Extend button only */
                                <Button
                                  onClick={handleExtend}
                                  disabled={isExtending}
                                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold"
                                >
                                  {isExtending ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Extending to Funding Phase...
                                    </>
                                  ) : (
                                    <>
                                      💰 Extend to Funding Phase
                                    </>
                                  )}
                                </Button>
                              )}

                              <div className="flex items-start space-x-2 pt-2 border-t border-white/10">
                                <div className="text-xs text-gray-400">
                                  {mergedOnchainData.data.phase === 'Funding' ? (
                                    <>
                                      <span className="font-semibold text-green-400">Ready to Launch:</span> Create {market.tokenSymbol} token and distribute to YES voters
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-semibold text-purple-400">Step 1:</span> Extend to Funding Phase (required before token launch)
                                      <br />
                                      <span className="font-semibold text-green-400">Step 2:</span> Launch token (available after extending)
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Resolve Button - Anyone can resolve when NO wins and pool is full (but not yet expired) */}
                          {Number(mergedOnchainData.data.totalNoShares) > Number(mergedOnchainData.data.totalYesShares) && !isMarketExpiredFromDB && (
                            <div className="mt-4 bg-gradient-to-br from-red-500/10 via-orange-500/10 to-yellow-500/10 border border-red-400/30 rounded-lg p-4">
                              <div className="mb-3">
                                <h4 className="text-red-400 text-sm font-semibold mb-1">❌ NO Wins - Market Failed</h4>
                                <p className="text-gray-300 text-xs mb-2">
                                  The target pool was reached but NO won the vote. This market will not launch a token.
                                </p>
                                <p className="text-gray-400 text-xs mb-2">
                                  <span className="font-semibold text-green-400">NO voters will win SOL rewards</span> (95% pool, proportional to shares).
                                </p>
                                <p className="text-gray-400 text-xs">
                                  Anyone can resolve this market now or wait until expiry to unlock NO voter rewards.
                                </p>
                              </div>
                              <Button
                                onClick={handleResolve}
                                disabled={isResolving || !primaryWallet}
                                className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-semibold"
                              >
                                {isResolving ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Resolving...
                                  </>
                                ) : (
                                  <>
                                    🔧 Resolve Market (NO Wins)
                                  </>
                                )}
                              </Button>
                              {!primaryWallet && (
                                <p className="text-yellow-400 text-xs mt-2 text-center">Connect wallet to resolve</p>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Pool Not Filled - Active Market */
                        <div className="space-y-4">
                          {/* Funding Phase - Special UI for all users */}
                          {mergedOnchainData.data.phase === 'Funding' ? (
                            <div className="pt-2 border-t border-white/5 space-y-3">
                              <div className="bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-cyan-500/10 border border-purple-400/30 rounded-lg p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <h4 className="text-purple-400 text-base font-bold mb-2 flex items-center space-x-2">
                                      <span>💰</span>
                                      <span>Funding Phase - Token Launch Guaranteed!</span>
                                    </h4>
                                    <div className="space-y-2">
                                      <p className="text-gray-300 text-sm">
                                        <span className="font-semibold text-green-400">✅ YES Won the Vote</span> - Voting is now locked and ${market.tokenSymbol} token WILL be launched!
                                      </p>
                                      <p className="text-gray-400 text-xs">
                                        The founder extended to Funding Phase to raise additional capital. You can still contribute to increase the pool size.
                                      </p>
                                      <div className="flex items-center space-x-2 text-xs">
                                        <div className="flex items-center space-x-1 px-2 py-1 bg-green-500/20 rounded-lg border border-green-400/30">
                                          <CheckCircle className="w-3 h-3 text-green-400" />
                                          <span className="text-green-400 font-semibold">Locked: YES Wins</span>
                                        </div>
                                        <div className="flex items-center space-x-1 px-2 py-1 bg-cyan-500/20 rounded-lg border border-cyan-400/30">
                                          <span className="text-cyan-400 font-semibold">Raising More Funds</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                                  <div>
                                    <p className="text-xs text-gray-400 mb-1">Funding deadline</p>
                                    <CountdownTimer expiryTime={market.expiryTime} size="lg" />
                                  </div>
                                  <Badge className="bg-purple-500/20 text-purple-300 border-purple-400/30">
                                    Accepting Contributions
                                  </Badge>
                                </div>
                              </div>

                              {/* Founder-only resolve button */}
                              {primaryWallet?.address === mergedOnchainData.data.founder && (
                                <div className="bg-gradient-to-br from-green-500/10 via-cyan-500/10 to-blue-500/10 border border-green-400/30 rounded-lg p-4">
                                  <div className="mb-3">
                                    <h4 className="text-green-400 text-sm font-semibold mb-1">Founder Actions</h4>
                                    <p className="text-gray-300 text-xs">
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
                                    className="w-full bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600 text-white font-semibold"
                                  >
                                    {isResolving ? (
                                      <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Launching...
                                      </>
                                    ) : (
                                      <>
                                        🚀 Launch ${market.tokenSymbol} Now
                                      </>
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* Prediction Phase - Normal Active Market */
                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                              <div>
                                <h4 className="text-green-400 text-sm font-semibold">✅ Active Market</h4>
                                <p className="text-gray-300 text-xs">Voting is open</p>
                              </div>
                              <div className="text-right">
                                <div className="text-gray-400 text-xs">Expires in</div>
                                <CountdownTimer expiryTime={market.expiryTime} size="lg" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {mergedOnchainData.data.resolution === 'Unresolved' && isMarketExpiredFromDB && (
                    <div className="text-center py-4 border-t border-white/5 space-y-3">
                      <h4 className="text-orange-400 text-base font-semibold mb-1">⏳ Awaiting Resolution...</h4>
                      <p className="text-gray-300 text-xs mb-3">
                        {mergedOnchainData.data.poolProgressPercentage < 100
                          ? 'Market expired without reaching target pool. All participants will be refunded.'
                          : Number(mergedOnchainData.data.totalYesShares) > Number(mergedOnchainData.data.totalNoShares)
                            ? `Market expired with YES winning! ${market.tokenSymbol} token is ready to launch.`
                            : 'Market expired with NO winning. NO voters can claim SOL rewards.'}
                      </p>

                      {/* YES Wins - Show Launch Token button (only for founder) or waiting message (for others) */}
                      {mergedOnchainData.data.poolProgressPercentage >= 100 &&
                       Number(mergedOnchainData.data.totalYesShares) > Number(mergedOnchainData.data.totalNoShares) ? (
                        <div className="space-y-3">
                          <div className="bg-gradient-to-br from-green-500/10 via-cyan-500/10 to-blue-500/10 border border-green-400/30 rounded-lg p-4">
                            <h4 className="text-green-400 text-sm font-semibold mb-2">🎉 YES Wins - Token Launch Required!</h4>

                            {/* Founder sees launch button */}
                            {primaryWallet?.address === mergedOnchainData.data.founder ? (
                              <>
                                <p className="text-gray-300 text-xs mb-2">
                                  The market has expired with YES winning. Click below to create the {market.tokenSymbol} token and complete resolution.
                                </p>
                                <p className="text-cyan-300 text-xs italic mb-3">
                                  ✨ Token will have a branded PNL address ending with "pnl"
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
                                  className="w-full bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600 text-white font-bold py-2.5 px-6"
                                >
                                  {isResolving ? (
                                    <div className="flex flex-col items-center justify-center space-y-1">
                                      <div className="flex items-center">
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        <span>Launching Token...</span>
                                      </div>
                                      <span className="text-xs text-gray-300 font-normal">
                                        This may take 30-60 seconds
                                      </span>
                                    </div>
                                  ) : (
                                    <>
                                      🚀 Launch ${market.tokenSymbol} Token
                                    </>
                                  )}
                                </Button>
                              </>
                            ) : (
                              /* Other users see waiting message */
                              <>
                                <p className="text-gray-300 text-xs mb-2">
                                  The market has expired with YES winning! The {market.tokenSymbol} token will be launched soon.
                                </p>
                                <div className="flex items-center justify-center space-x-2 py-3 bg-purple-500/10 rounded-lg border border-purple-400/30">
                                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                                  <span className="text-purple-300 text-sm font-medium">
                                    Waiting for project founder to launch token...
                                  </span>
                                </div>
                                <p className="text-gray-400 text-xs mt-2 text-center">
                                  Once launched, YES voters will be able to claim their token airdrop.
                                </p>
                              </>
                            )}
                          </div>
                          {!primaryWallet && primaryWallet?.address !== mergedOnchainData.data.founder && (
                            <p className="text-yellow-400 text-xs">Connect wallet to see your position</p>
                          )}
                        </div>
                      ) : (
                        /* NO Wins or Refund - Show regular Resolve button */
                        <>
                          <Button
                            onClick={handleResolve}
                            disabled={isResolving || !primaryWallet}
                            className="bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-bold py-2.5 px-6"
                          >
                            {isResolving ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Resolving Market...
                              </>
                            ) : (
                              <>
                                🔧 Resolve Market
                              </>
                            )}
                          </Button>
                          {!primaryWallet && (
                            <p className="text-yellow-400 text-xs mt-2">Connect wallet to resolve this market</p>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {mergedOnchainData.data.resolution === 'YesWins' && (
                    <div className="text-center py-2 border-t border-white/5 space-y-4">
                      <div>
                        <h4 className="text-green-400 text-lg font-bold mb-1">🎉 YES WINS - Token Launch!</h4>
                        <p className="text-gray-300 text-xs mb-3">
                          Token will be launched on Pump.fun!
                        </p>
                        {/* Trade on Pump.fun Button - Only show when token is minted */}
                        {mergedOnchainData.data.tokenMint && (
                          <a
                            href={`https://pump.fun/coin/${mergedOnchainData.data.tokenMint}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500/20 to-cyan-500/20 hover:from-green-500/30 hover:to-cyan-500/30 border border-green-400/30 hover:border-green-400/50 rounded-lg text-green-400 text-sm font-medium transition-all hover:scale-105"
                          >
                            <img src="https://pump.fun/favicon.ico" alt="Pump.fun" className="w-4 h-4" />
                            Trade on Pump.fun
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {/* YES Voter Claim - Exclude founder (they have Team Token section) */}
                      {positionData?.success && positionData.data.hasPosition && !positionData.data.claimed && primaryWallet?.address !== mergedOnchainData.data.founder && (
                        <div className="mt-3">
                          {positionData.data.side === 'yes' ? (
                            <Button
                              onClick={handleClaim}
                              disabled={isClaiming}
                              className="bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-600 hover:to-cyan-600 text-white font-bold py-2.5 px-6"
                            >
                              {isClaiming ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Claiming...
                                </>
                              ) : (
                                <>
                                  🎁 Claim Token Airdrop
                                </>
                              )}
                            </Button>
                          ) : (
                            <p className="text-red-400 text-xs">You voted NO and lost this prediction</p>
                          )}
                        </div>
                      )}

                      {/* Already Claimed - YES Voters (exclude founder) */}
                      {positionData?.success && positionData.data.hasPosition && positionData.data.claimed && positionData.data.side === 'yes' && primaryWallet?.address !== mergedOnchainData.data.founder && (
                        <div className="mt-3">
                          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                            <p className="text-green-400 font-semibold flex items-center justify-center gap-2">
                              <CheckCircle className="w-5 h-5" />
                              Already Claimed
                            </p>
                            <p className="text-gray-400 text-sm mt-1">
                              Your token airdrop has been successfully claimed and transferred to your wallet.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Team Token Transparency Section - Visible to ALL users when vesting initialized */}
                      {mergedOnchainData.data.tokenMint && mergedOnchainData.data.teamVestingInitialized && mergedOnchainData.data.teamVestingData && (
                        <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-yellow-500/10 border border-amber-400/30 rounded-lg p-4 text-left space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="p-2 bg-amber-500/20 rounded-full">
                                <Users className="w-4 h-4 text-amber-400" />
                              </div>
                              <h4 className="text-amber-400 text-sm font-semibold">Team Token Allocation (33%)</h4>
                            </div>
                            <span className="text-xs text-gray-500">Transparency</span>
                          </div>

                          {/* Vesting Progress Bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Vesting Progress</span>
                              <span className="text-amber-300 font-semibold">{(Number(mergedOnchainData.data.teamVestingData?.vestingProgressPercent) || 0).toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, mergedOnchainData.data.teamVestingData.vestingProgressPercent)}%` }}
                              />
                            </div>
                          </div>

                          {/* Token Breakdown */}
                          <div className="space-y-2 pt-2 border-t border-white/10">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Total Team Tokens</span>
                              <span className="text-white font-semibold">
                                {(Number(mergedOnchainData.data.teamVestingData.totalTokens) / 1_000_000).toLocaleString()} {market.tokenSymbol}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Immediate (8%)</span>
                              <span className={`font-semibold ${mergedOnchainData.data.teamVestingData.immediateClaimed ? 'text-green-400' : 'text-amber-300'}`}>
                                {(Number(mergedOnchainData.data.teamVestingData.immediateTokens) / 1_000_000).toLocaleString()} {market.tokenSymbol}
                                {mergedOnchainData.data.teamVestingData.immediateClaimed && ' ✓ Claimed'}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Vested (25%)</span>
                              <span className="text-orange-300 font-semibold">
                                {(Number(mergedOnchainData.data.teamVestingData.vestingTokens) / 1_000_000).toLocaleString()} {market.tokenSymbol}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Vested Unlocked</span>
                              <span className="text-cyan-300 font-semibold">
                                {(Number(mergedOnchainData.data.teamVestingData.vestedUnlocked) / 1_000_000).toLocaleString()} {market.tokenSymbol}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Already Claimed</span>
                              <span className="text-green-400 font-semibold">
                                {(Number(mergedOnchainData.data.teamVestingData.claimedTokens) / 1_000_000).toLocaleString()} {market.tokenSymbol}
                              </span>
                            </div>
                          </div>

                          {/* Next Unlock Info */}
                          {mergedOnchainData.data.teamVestingData.vestingProgressPercent < 100 && mergedOnchainData.data.teamVestingData.nextUnlockTime && (
                            <div className="flex justify-between text-xs pt-2 border-t border-white/10">
                              <span className="text-gray-400">Next Unlock</span>
                              <span className="text-purple-300 font-semibold">
                                {(Number(mergedOnchainData.data.teamVestingData.nextUnlockAmount) / 1_000_000).toLocaleString()} {market.tokenSymbol} in {Math.max(0, Math.ceil((mergedOnchainData.data.teamVestingData.nextUnlockTime - Date.now() / 1000) / 86400))} days
                              </span>
                            </div>
                          )}

                          {/* Founder Actions */}
                          {primaryWallet?.address === mergedOnchainData.data.founder && (
                            <div className="pt-3 border-t border-white/10">
                              <Button
                                onClick={handleClaimTeamTokens}
                                disabled={isClaimingTeamTokens || Number(mergedOnchainData.data.teamVestingData.claimableNow) === 0}
                                className={`w-full font-semibold ${
                                  Number(mergedOnchainData.data.teamVestingData.claimableNow) > 0
                                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                }`}
                              >
                                {isClaimingTeamTokens ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Claiming...
                                  </>
                                ) : Number(mergedOnchainData.data.teamVestingData.claimableNow) > 0 ? (
                                  <>
                                    👥 Claim {(Number(mergedOnchainData.data.teamVestingData.claimableNow) / 1_000_000).toLocaleString()} {market.tokenSymbol}
                                  </>
                                ) : (
                                  <>
                                    ⏳ No Tokens to Claim Yet
                                  </>
                                )}
                              </Button>
                              {Number(mergedOnchainData.data.teamVestingData.claimableNow) === 0 && mergedOnchainData.data.teamVestingData.vestingProgressPercent < 100 && (
                                <p className="text-xs text-gray-400 italic mt-2 text-center">
                                  Next tokens unlock in ~{Math.max(0, Math.ceil((mergedOnchainData.data.teamVestingData.nextUnlockTime! - Date.now() / 1000) / 86400))} days
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Team Vesting Initialize Section - Only for founder when not initialized */}
                      {primaryWallet?.address === mergedOnchainData.data.founder && mergedOnchainData.data.tokenMint && !mergedOnchainData.data.teamVestingInitialized && (
                        <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-yellow-500/10 border border-amber-400/30 rounded-lg p-4 text-left space-y-3">
                          <div className="flex items-center space-x-2">
                            <div className="p-2 bg-amber-500/20 rounded-full">
                              <Users className="w-4 h-4 text-amber-400" />
                            </div>
                            <h4 className="text-amber-400 text-sm font-semibold">Team Token Allocation (33%)</h4>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Immediate (8%)</span>
                              <span className="text-amber-300 font-semibold">Claimable after init</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Vested (25%)</span>
                              <span className="text-orange-300 font-semibold">12 Month Linear</span>
                            </div>
                          </div>

                          <Button
                            onClick={handleInitTeamVesting}
                            disabled={isInitializing}
                            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold"
                          >
                            {isInitializing ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Initializing...
                              </>
                            ) : (
                              <>
                                🔧 Initialize Team Vesting
                              </>
                            )}
                          </Button>

                          <p className="text-xs text-gray-400 italic">
                            Initialize vesting to start claiming your team tokens (8% immediate + 25% over 12 months).
                          </p>
                        </div>
                      )}

                      {/* Founder SOL Vesting Section - Only for founder when pool > 50 SOL */}
                      {primaryWallet?.address === mergedOnchainData.data.founder && mergedOnchainData.data.hasExcessSol && (
                        <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-400/30 rounded-lg p-4 text-left space-y-3">
                          <div className="flex items-center space-x-2">
                            <div className="p-2 bg-emerald-500/20 rounded-full">
                              <Target className="w-4 h-4 text-emerald-400" />
                            </div>
                            <h4 className="text-emerald-400 text-sm font-semibold">Excess SOL Allocation</h4>
                          </div>

                          {/* Show actual vesting data if initialized, otherwise show estimates */}
                          {mergedOnchainData.data.founderVestingInitialized && mergedOnchainData.data.founderVestingData ? (
                            <>
                              {/* Vesting Progress Bar */}
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-400">Vesting Progress</span>
                                  <span className="text-emerald-300 font-semibold">{(Number(mergedOnchainData.data.founderVestingData?.vestingProgressPercent) || 0).toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                                  <div
                                    className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, mergedOnchainData.data.founderVestingData.vestingProgressPercent)}%` }}
                                  />
                                </div>
                              </div>

                              {/* SOL Breakdown */}
                              <div className="space-y-2 pt-2 border-t border-white/10">
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-400">Total Excess SOL</span>
                                  <span className="text-white font-semibold">
                                    {(Number(mergedOnchainData.data.founderVestingData.totalSol) / 1_000_000_000).toFixed(4)} SOL
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-400">Immediate (8%)</span>
                                  <span className={`font-semibold ${mergedOnchainData.data.founderVestingData.immediateClaimed ? 'text-green-400' : 'text-teal-300'}`}>
                                    {(Number(mergedOnchainData.data.founderVestingData.immediateSol) / 1_000_000_000).toFixed(4)} SOL
                                    {mergedOnchainData.data.founderVestingData.immediateClaimed && ' ✓ Claimed'}
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-400">Vested (92%)</span>
                                  <span className="text-cyan-300 font-semibold">
                                    {(Number(mergedOnchainData.data.founderVestingData.vestingSol) / 1_000_000_000).toFixed(4)} SOL
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-400">Vested Unlocked</span>
                                  <span className="text-teal-300 font-semibold">
                                    {(Number(mergedOnchainData.data.founderVestingData.vestedUnlocked) / 1_000_000_000).toFixed(4)} SOL
                                  </span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-400">Already Claimed</span>
                                  <span className="text-green-400 font-semibold">
                                    {(Number(mergedOnchainData.data.founderVestingData.claimedSol) / 1_000_000_000).toFixed(4)} SOL
                                  </span>
                                </div>
                              </div>

                              {/* Next Unlock Info */}
                              {mergedOnchainData.data.founderVestingData.vestingProgressPercent < 100 && mergedOnchainData.data.founderVestingData.nextUnlockTime && (
                                <div className="flex justify-between text-xs pt-2 border-t border-white/10">
                                  <span className="text-gray-400">Next Unlock</span>
                                  <span className="text-purple-300 font-semibold">
                                    {(Number(mergedOnchainData.data.founderVestingData.nextUnlockAmount) / 1_000_000_000).toFixed(4)} SOL in {Math.max(0, Math.ceil((mergedOnchainData.data.founderVestingData.nextUnlockTime - Date.now() / 1000) / 86400))} days
                                  </span>
                                </div>
                              )}

                              {/* Claim Button */}
                              <div className="pt-3 border-t border-white/10">
                                <Button
                                  onClick={handleClaimFounderSol}
                                  disabled={isClaimingFounderSol || Number(mergedOnchainData.data.founderVestingData.claimableNow) === 0}
                                  className={`w-full font-semibold ${
                                    Number(mergedOnchainData.data.founderVestingData.claimableNow) > 0
                                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white'
                                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                  }`}
                                >
                                  {isClaimingFounderSol ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Claiming...
                                    </>
                                  ) : Number(mergedOnchainData.data.founderVestingData.claimableNow) > 0 ? (
                                    <>
                                      💰 Claim {(Number(mergedOnchainData.data.founderVestingData.claimableNow) / 1_000_000_000).toFixed(4)} SOL
                                    </>
                                  ) : (
                                    <>
                                      ⏳ No SOL to Claim Yet
                                    </>
                                  )}
                                </Button>
                                {Number(mergedOnchainData.data.founderVestingData.claimableNow) === 0 && mergedOnchainData.data.founderVestingData.vestingProgressPercent < 100 && (
                                  <p className="text-xs text-gray-400 italic mt-2 text-center">
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
                                  <span className="text-gray-400">Total Excess SOL</span>
                                  <span className="text-emerald-300 font-semibold">{(Number(mergedOnchainData.data.excessSolInSol) || 0).toFixed(4)} SOL</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-400">Immediate (8%)</span>
                                  <span className="text-teal-300 font-semibold">{((Number(mergedOnchainData.data.excessSolInSol) || 0) * 0.08).toFixed(4)} SOL</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-400">Vested (92%)</span>
                                  <span className="text-cyan-300 font-semibold">{((Number(mergedOnchainData.data.excessSolInSol) || 0) * 0.92).toFixed(4)} SOL over 12 months</span>
                                </div>
                              </div>

                              {/* Initialize SOL Vesting Button */}
                              <Button
                                onClick={handleInitFounderSolVesting}
                                disabled={isInitializingFounderSol}
                                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold"
                              >
                                {isInitializingFounderSol ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Initializing...
                                  </>
                                ) : (
                                  <>
                                    🔧 Initialize SOL Vesting
                                  </>
                                )}
                              </Button>

                              <p className="text-xs text-gray-400 italic">
                                Pool exceeded 50 SOL. 50 SOL was used for token launch, the rest is yours with vesting.
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {mergedOnchainData.data.resolution === 'NoWins' && (
                    <div className="text-center py-2 border-t border-white/5 space-y-4">
                      <div>
                        <h4 className="text-red-400 text-lg font-bold mb-1">❌ NO WINS - Project Won&apos;t Launch</h4>
                        <p className="text-gray-300 text-xs mb-3">
                          NO voters receive proportional SOL rewards.
                        </p>
                      </div>

                      {positionData?.success && positionData.data.hasPosition && !positionData.data.claimed && (
                        <div className="mt-3">
                          {positionData.data.side === 'no' ? (
                            <Button
                              onClick={handleClaim}
                              disabled={isClaiming}
                              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-2.5 px-6"
                            >
                              {isClaiming ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Claiming...
                                </>
                              ) : (
                                <>
                                  💰 Claim SOL Rewards
                                </>
                              )}
                            </Button>
                          ) : (
                            <p className="text-red-400 text-xs">You voted YES and lost this prediction</p>
                          )}
                        </div>
                      )}

                      {/* Already Claimed - NO Voters */}
                      {positionData?.success && positionData.data.hasPosition && positionData.data.claimed && positionData.data.side === 'no' && (
                        <div className="mt-3">
                          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                            <p className="text-green-400 font-semibold flex items-center justify-center gap-2">
                              <CheckCircle className="w-5 h-5" />
                              Already Claimed
                            </p>
                            <p className="text-gray-400 text-sm mt-1">
                              Your SOL rewards have been successfully claimed and transferred to your wallet.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {mergedOnchainData.data.resolution === 'Refund' && (
                    <div className="text-center py-2 border-t border-white/5">
                      <h4 className="text-yellow-400 text-lg font-bold mb-1">↩️ REFUND - Market Cancelled</h4>
                      <p className="text-gray-300 text-xs mb-3">
                        All participants receive full refunds.
                      </p>

                      {positionData?.success && positionData.data.hasPosition && !positionData.data.claimed ? (
                        <div className="mt-3">
                          <Button
                            onClick={handleClaim}
                            disabled={isClaiming}
                            className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-2.5 px-6"
                          >
                            {isClaiming ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Claiming...
                              </>
                            ) : (
                              <>
                                ↩️ Claim Refund ({(Number(positionData.data?.totalAmount) || 0).toFixed(3)} SOL)
                              </>
                            )}
                          </Button>
                        </div>
                      ) : positionData?.data?.claimed ? (
                        <div className="mt-3">
                          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                            <p className="text-green-400 font-semibold flex items-center gap-2">
                              ✅ Already Claimed
                            </p>
                            <p className="text-gray-400 text-sm mt-1">
                              Your refund has been successfully claimed and transferred to your wallet.
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Close Market Button - Only for founder after 30-day claim period */}
                  {mergedOnchainData.data.resolution !== 'Unresolved' && primaryWallet?.address === mergedOnchainData.data.founder && (
                    <div className="border-t border-white/5 pt-4 mt-4">
                      <div className="bg-gradient-to-br from-gray-500/10 via-gray-600/10 to-gray-700/10 border border-gray-400/30 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <div className="p-2 bg-gray-500/20 rounded-full">
                            <Target className="w-4 h-4 text-gray-400" />
                          </div>
                          <h4 className="text-gray-300 text-sm font-semibold">Market Cleanup (Founder Only)</h4>
                        </div>

                        <p className="text-gray-400 text-xs mb-3">
                          After 30 days from market expiry and when all rewards have been claimed (pool balance is empty), you can close the market to recover rent (~0.01 SOL).
                        </p>

                        <Button
                          onClick={handleCloseMarket}
                          disabled={isClosingMarket}
                          className="w-full bg-gradient-to-r from-gray-500 to-gray-700 hover:from-gray-600 hover:to-gray-800 text-white font-semibold"
                        >
                          {isClosingMarket ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Closing...
                            </>
                          ) : (
                            <>
                              🗑️ Close Market & Recover Rent
                            </>
                          )}
                        </Button>

                        <p className="text-xs text-gray-500 italic mt-2">
                          Note: This will fail if the 30-day claim period hasn't passed or if the pool still has funds. The market account will be permanently deleted.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
        </div>
        </div>

        {/* Metadata/Project Details Section - Moved above Holders */}
        {market.metadata && (
          <Card className="bg-white/5 backdrop-blur-xl border-white/10 text-white">
            <CardHeader>
              <CardTitle className="text-lg sm:text-2xl text-white">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              {/* What This Project Offers */}
              {market.metadata.additionalNotes && (
                <div className="p-3 sm:p-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-lg border border-cyan-400/30">
                  <h3 className="text-cyan-400 text-sm sm:text-base mb-1.5 sm:mb-2 font-bold flex items-center gap-1.5 sm:gap-2">
                    <span className="text-base sm:text-xl">✨</span> What This Project Offers
                  </h3>
                  <p className="text-white text-sm sm:text-base leading-relaxed whitespace-pre-wrap text-justify">{market.metadata.additionalNotes}</p>
                </div>
              )}

              {/* Project Info Grid */}
              <div className="grid gap-2.5 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {market.metadata.projectType && (
                  <div className="flex items-start space-x-2 sm:space-x-3 p-2.5 sm:p-4 bg-white/5 rounded-lg">
                    <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 mt-0.5 sm:mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="text-gray-400 text-xs sm:text-sm mb-0.5 sm:mb-1">Project Type</h3>
                      <p className="text-white text-sm sm:text-lg font-medium capitalize">{market.metadata.projectType}</p>
                    </div>
                  </div>
                )}

                {market.metadata.projectStage && (
                  <div className="flex items-start space-x-2 sm:space-x-3 p-2.5 sm:p-4 bg-white/5 rounded-lg">
                    <Target className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 mt-0.5 sm:mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="text-gray-400 text-xs sm:text-sm mb-0.5 sm:mb-1">Stage</h3>
                      <p className="text-white text-sm sm:text-lg font-medium">{formatLabel(market.metadata.projectStage)}</p>
                    </div>
                  </div>
                )}

                {market.metadata.category && (
                  <div className="flex items-start space-x-2 sm:space-x-3 p-2.5 sm:p-4 bg-white/5 rounded-lg">
                    <Target className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400 mt-0.5 sm:mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="text-gray-400 text-xs sm:text-sm mb-0.5 sm:mb-1">Category</h3>
                      <p className="text-white text-sm sm:text-lg font-medium">{formatLabel(market.metadata.category)}</p>
                    </div>
                  </div>
                )}

                {market.metadata.location && (
                  <div className="flex items-start space-x-2 sm:space-x-3 p-2.5 sm:p-4 bg-white/5 rounded-lg">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 mt-0.5 sm:mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="text-gray-400 text-xs sm:text-sm mb-0.5 sm:mb-1">Location</h3>
                      <p className="text-white text-sm sm:text-lg font-medium">{market.metadata.location}</p>
                    </div>
                  </div>
                )}

                {market.metadata.teamSize && (
                  <div className="flex items-start space-x-2 sm:space-x-3 p-2.5 sm:p-4 bg-white/5 rounded-lg">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400 mt-0.5 sm:mt-1 flex-shrink-0" />
                    <div>
                      <h3 className="text-gray-400 text-xs sm:text-sm mb-0.5 sm:mb-1">Team Size</h3>
                      <p className="text-white text-sm sm:text-lg font-medium">{market.metadata.teamSize} {market.metadata.teamSize === 1 ? 'member' : 'members'}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {market.metadata.description && market.metadata.description !== market.description && (
                <div className="p-3 sm:p-4 bg-white/5 rounded-lg">
                  <h3 className="text-gray-400 text-xs sm:text-sm mb-1.5 sm:mb-2 font-semibold">Full Description</h3>
                  <p className="text-white text-sm sm:text-base leading-relaxed whitespace-pre-wrap">{market.metadata.description}</p>
                </div>
              )}

            </CardContent>
          </Card>
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
          <Card className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm border-gray-700/50">
            <CardContent className="py-8 text-center">
              <div className="text-4xl mb-3">🔒</div>
              <h3 className="text-white font-semibold mb-2">Voting in Progress</h3>
              <p className="text-gray-400 text-sm">
                Holder positions and activity are hidden until the market resolves to ensure fair, unbiased voting.
              </p>
            </CardContent>
          </Card>
        )}

        </div>
        {/* End Left Content Area */}

        {/* Right Sidebar - Community Hub (Desktop) - Fixed position floats in place while scrolling */}
        <div className="hidden lg:block lg:w-[30%] lg:min-w-[320px] lg:max-w-[400px]">
          {/* Placeholder to maintain layout spacing */}
        </div>

        {/* Fixed sidebar that stays in place */}
        <div className="hidden lg:block fixed top-[6.5rem] right-4 w-[28%] min-w-[320px] max-w-[400px] z-30">
          <CommunityHub
            marketAddress={market.marketAddress}
            walletAddress={primaryWallet?.address}
            founderWallet={market.founderWallet}
            hasPosition={positionData?.data?.hasPosition}
            className="h-[calc(100vh-7.5rem)]"
          />
        </div>

      </div>
      {/* End Main Layout */}

      {/* Mobile Chat Button */}
      <button
        onClick={() => setIsSidebarOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-40 p-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all hover:scale-105"
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </button>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
          {/* Sidebar Panel */}
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-gray-900 border-l border-gray-700/50 shadow-2xl animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
              <h2 className="text-lg font-semibold text-white">Community Hub</h2>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            {/* Content */}
            <div className="h-[calc(100%-60px)]">
              <CommunityHub
                marketAddress={market.marketAddress}
                walletAddress={primaryWallet?.address}
                founderWallet={market.founderWallet}
                hasPosition={positionData?.data?.hasPosition}
                className="h-full rounded-none border-0"
              />
            </div>
          </div>
        </div>
      )}

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

        {/* Toast Notification */}
        {showToast && (
          <div className="fixed top-3 sm:top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 px-3 sm:px-0">
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
      </div>
  );
}
