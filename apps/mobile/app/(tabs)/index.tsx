/**
 * Feed Screen — TikTok-style dual feed with PagerView
 * Two swipeable pages: "Feed" (all markets) and "For You" (curated).
 * Gear icon on For You opens CuratePanel in a bottom sheet.
 * WebSocket-driven pill notification when new projects arrive.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ActivityIndicator,
  Text,
  Platform,
  ViewToken,
  Pressable,
  Share,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import GorhomBottomSheet from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useMarkets, useNetwork } from '@pnl/shared/hooks';
import type { Market } from '@pnl/shared/hooks';
import { apiUrl } from '@pnl/shared/utils';
import { useAuth } from '../../src/providers/AuthProvider';
import { useWalletBalance } from '../../src/hooks/useWalletBalance';
import { useVote } from '../../src/hooks/useVote';
import { VoiceRoom } from '../../src/components/community/VoiceRoom';
import { ChatRoom } from '../../src/components/community/ChatRoom';
import { VoiceRoomVoteButtons } from '../../src/components/community/VoiceRoomVoteButtons';
import { TradeSheet } from '../../src/components/TradeSheet';
import { useVoiceRoomContextSafe } from '../../src/providers/VoiceRoomProvider';
import {
  FeedCard,
  FavoriteButton,
  VoteBottomSheet,
  EmptyState,
  CuratePanel,
  FeedTabs,
  NewProjectsPill,
  NewBadge,
  TimeCountdown,
  PoolProgress,
  VoteToast,
  SkeletonCard,
} from '../../src/components';
import type { VoteToastState } from '../../src/components';
import { useCuratePreferences } from '../../src/hooks/useCuratePreferences';
import type { CurateSortOption } from '../../src/hooks/useCuratePreferences';
import { colors, spacing } from '../../src/theme';

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get('window');

type VoteDirection = 'yes' | 'no';

/**
 * Determine what action buttons to show for a market based on its lifecycle stage.
 * Used across feed cards, voice room, and any place that shows market actions.
 */
type MarketAction = 'vote' | 'trade' | 'claim' | 'none';

function getMarketAction(market: Market): {
  action: MarketAction;
  isExpired: boolean;
  isResolved: boolean;
  isTokenLaunched: boolean;
  tokenMint: string | null;
  resolution: string | null;
} {
  const resolution = market.resolution || null;
  const isResolved = !!resolution && resolution !== 'Unresolved';
  const isExpired = market.expiryTime ? new Date(market.expiryTime).getTime() < Date.now() : false;
  const tokenMint = (market as any)?.tokenMint || (market as any)?.pumpFunTokenAddress || null;
  const isTokenLaunched = isResolved && resolution === 'YesWins' && !!tokenMint;

  // Determine action — order matters for real-time correctness:
  // Socket updates `resolution` and `tokenMint` instantly, but `isYesVoteEnabled`
  // only refreshes on SWR poll. So we check resolution FIRST to ensure
  // buttons switch immediately when a market resolves/launches.
  let action: MarketAction = 'none';
  if (isTokenLaunched) {
    action = 'trade';
  } else if (isResolved) {
    // NoWins, Refund, or YesWins without token yet — claim in market detail
    action = 'none';
  } else if (isExpired) {
    // Expired but not yet resolved — no actions in feed
    action = 'none';
  } else if (market.isYesVoteEnabled || market.isNoVoteEnabled) {
    action = 'vote';
  }

  return { action, isExpired, isResolved, isTokenLaunched, tokenMint, resolution };
}

function applySortOption(list: Market[], sortBy: CurateSortOption): Market[] {
  const sorted = [...list];
  switch (sortBy) {
    case 'most_active':
      return sorted.sort((a, b) => (b.totalParticipants || 0) - (a.totalParticipants || 0));
    case 'biggest_pools':
      return sorted.sort((a, b) => (Number(b.poolBalance) || 0) - (Number(a.poolBalance) || 0));
    case 'most_favorited':
      return sorted.sort((a, b) => (b.favoriteCount || 0) - (a.favoriteCount || 0));
    case 'newest':
      return sorted.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
    case 'ending_soonest':
      return sorted.sort(
        (a, b) =>
          new Date(a.expiryTime || '9999').getTime() - new Date(b.expiryTime || '9999').getTime(),
      );
    default:
      return sorted;
  }
}

/* ── Pitch Video Card ─────────────────────────────────────── */

interface PitchVideoCardProps {
  market: Market;
  height: number;
  isActive: boolean;
  walletAddress: string | null;
  isAuthenticated: boolean;
  marketAction: ReturnType<typeof getMarketAction>;
  votingState?: { voteType: 'yes' | 'no' } | null;
  onVoteYes: () => void;
  onVoteNo: () => void;
  onTradeBuy: () => void;
  onTradeSell: () => void;
  onPress: () => void;
}

function PitchVideoCard({
  market,
  height,
  isActive,
  walletAddress,
  isAuthenticated,
  marketAction,
  votingState,
  onVoteYes,
  onVoteNo,
  onTradeBuy,
  onTradeSell,
  onPress,
}: PitchVideoCardProps) {
  const isActionable = market.isYesVoteEnabled || market.isNoVoteEnabled;
  const isVotingYes = votingState?.voteType === 'yes';
  const isVotingNo = votingState?.voteType === 'no';
  const isVoting = !!votingState;
  const videoRef = useRef<Video>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const handleVideoTap = useCallback(async () => {
    if (!videoRef.current) return;
    if (isPaused) {
      await videoRef.current.playAsync();
    } else {
      await videoRef.current.pauseAsync();
    }
    setIsPaused(!isPaused);
  }, [isPaused]);

  const toggleMute = useCallback(async () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    await videoRef.current.setIsMutedAsync(newMuted);
  }, [isMuted]);

  // If video fails to load, show project image instead
  if (videoError) {
    return (
      <View style={[styles.videoCard, { height }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onPress}>
          {market.projectImageUrl ? (
            <Image source={{ uri: market.projectImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a1a2e' }]} />
          )}
        </Pressable>
        <LinearGradient
          colors={['rgba(0,0,0,0.5)', 'transparent']}
          locations={[0, 0.4]}
          style={styles.topGradient}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
          style={styles.gradient}
          pointerEvents="none"
        />

        <View style={styles.rightActions}>
          {market.projectImageUrl ? (
            <Pressable onPress={onPress}>
              <Image source={{ uri: market.projectImageUrl }} style={styles.projectAvatar} />
            </Pressable>
          ) : null}
          <FavoriteButton
            marketId={market.id}
            walletAddress={walletAddress}
            initialCount={market.favoriteCount ?? 0}
            variant="floating"
          />
          <Pressable
          style={styles.createBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(isAuthenticated ? '/create' : '/login');
          }}
          hitSlop={8}
        >
          <Ionicons name="add-circle" size={26} color="rgba(255,255,255,0.9)" />
        </Pressable>
          <Pressable
            style={styles.shareBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Share.share({
                message: `${market.name} — check it out on PNL!\nhttps://pnl.market/market/${market.id}`,
                url: `https://pnl.market/market/${market.id}`,
              });
            }}
            hitSlop={8}
          >
            <Ionicons name="share-social-outline" size={24} color="rgba(255,255,255,0.9)" />
          </Pressable>
        </View>

        <View style={styles.overlay}>
          {market.category ? (
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{market.category.toUpperCase()}</Text>
            </View>
          ) : null}
          <Pressable onPress={onPress}>
            <Text style={styles.marketTitle} numberOfLines={2}>
              {market.name}
            </Text>
            <Text style={styles.tokenSymbol}>${market.tokenSymbol}</Text>
            {market.description ? (
              <Text style={styles.marketDescription} numberOfLines={2}>
                {market.description}
              </Text>
            ) : null}
          </Pressable>
          {market.poolBalance != null && market.targetPool != null && (
            <PoolProgress
              current={Number(market.poolBalance) / 1e9}
              target={Number(market.targetPool)}
              tokenSymbol={market.tokenSymbol || 'SOL'}
              variant="inline"
            />
          )}
          <View style={styles.voteRow}>
            {isActionable && (
              <>
                <Pressable
                  style={[styles.voteBtn, (!market.isYesVoteEnabled || isVoting) && styles.voteBtnDisabled]}
                  disabled={isVoting || !market.isYesVoteEnabled}
                  onPress={onVoteYes}
                >
                  <LinearGradient
                    colors={['#10b981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.voteBtnGradient,
                      (!market.isYesVoteEnabled || isVoting) && styles.voteGradientDisabled,
                    ]}
                  >
                    {isVotingYes ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="trending-up" size={16} color="#fff" />
                        <Text style={styles.voteBtnText}>YES</Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
                <Pressable
                  style={[styles.voteBtn, (!market.isNoVoteEnabled || isVoting) && styles.voteBtnDisabled]}
                  disabled={isVoting || !market.isNoVoteEnabled}
                  onPress={onVoteNo}
                >
                  <View
                    style={[
                      styles.noBtnInner,
                      (!market.isNoVoteEnabled || isVoting) && styles.noBtnDisabled,
                    ]}
                  >
                    {isVotingNo ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="trending-down" size={16} color="#fff" />
                        <Text style={styles.voteBtnText}>NO</Text>
                      </>
                    )}
                  </View>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.videoCard, { height }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={handleVideoTap}>
        <Video
          ref={videoRef}
          source={{ uri: market.pitchVideoUrl! }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isActive && !isPaused}
          isLooping
          isMuted={isMuted}
          onError={() => setVideoError(true)}
        />
      </Pressable>

      {isPaused && (
        <View style={styles.pauseOverlay} pointerEvents="none">
          <Ionicons name="pause" size={64} color="rgba(255,255,255,0.7)" />
        </View>
      )}

      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'transparent']}
        locations={[0, 0.4]}
        style={styles.topGradient}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
        style={styles.gradient}
        pointerEvents="none"
      />

      <Pressable style={[styles.muteIndicator, { top: 110 }]} onPress={toggleMute} hitSlop={8}>
        <Ionicons
          name={isMuted ? 'volume-mute' : 'volume-high'}
          size={18}
          color="rgba(255,255,255,0.8)"
        />
      </Pressable>

      <View style={styles.rightActions}>
        {market.projectImageUrl ? (
          <Pressable onPress={onPress}>
            <Image source={{ uri: market.projectImageUrl }} style={styles.projectAvatar} />
          </Pressable>
        ) : null}
        <FavoriteButton
          marketId={market.id}
          walletAddress={walletAddress}
          initialCount={market.favoriteCount ?? 0}
          variant="floating"
        />
        <Pressable
          style={styles.createBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(isAuthenticated ? '/create' : '/login');
          }}
          hitSlop={8}
        >
          <Ionicons name="add-circle" size={26} color="rgba(255,255,255,0.9)" />
        </Pressable>
        <Pressable
          style={styles.shareBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Share.share({
              message: `${market.name} — check it out on PNL!\nhttps://pnl.market/market/${market.id}`,
              url: `https://pnl.market/market/${market.id}`,
            });
          }}
          hitSlop={8}
        >
          <Ionicons name="share-social-outline" size={24} color="rgba(255,255,255,0.9)" />
        </Pressable>
      </View>

      <View style={styles.overlay}>
        {/* Category near the title */}
        {market.category ? (
          <View style={styles.categoryPill}>
            <Text style={styles.categoryText}>{market.category.toUpperCase()}</Text>
          </View>
        ) : null}

        <Pressable onPress={onPress}>
          <Text style={styles.marketTitle} numberOfLines={2}>
            {market.name}
          </Text>
          <Text style={styles.tokenSymbol}>${market.tokenSymbol}</Text>
          {market.description ? (
            <Text style={styles.marketDescription} numberOfLines={2}>
              {market.description}
            </Text>
          ) : null}
        </Pressable>

        {market.poolBalance != null && market.targetPool != null && (
          <PoolProgress
            current={Number(market.poolBalance) / 1e9}
            target={Number(market.targetPool)}
            tokenSymbol={market.tokenSymbol || 'SOL'}
            variant="inline"
          />
        )}

        {/* Adaptive action buttons based on market stage */}
        <View style={styles.voteRow}>
          {marketAction.action === 'vote' && isActionable && (
            <>
              <Pressable
                style={[styles.voteBtn, (!market.isYesVoteEnabled || isVoting) && styles.voteBtnDisabled]}
                disabled={isVoting || !market.isYesVoteEnabled}
                onPress={onVoteYes}
              >
                <LinearGradient
                  colors={['#10b981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.voteBtnGradient,
                    (!market.isYesVoteEnabled || isVoting) && styles.voteGradientDisabled,
                  ]}
                >
                  {isVotingYes ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="trending-up" size={16} color="#fff" />
                      <Text style={styles.voteBtnText}>YES</Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
              <Pressable
                style={[styles.voteBtn, (!market.isNoVoteEnabled || isVoting) && styles.voteBtnDisabled]}
                disabled={isVoting || !market.isNoVoteEnabled}
                onPress={onVoteNo}
              >
                <View style={[styles.noBtnInner, (!market.isNoVoteEnabled || isVoting) && styles.noBtnDisabled]}>
                  {isVotingNo ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="trending-down" size={16} color="#fff" />
                      <Text style={styles.voteBtnText}>NO</Text>
                    </>
                  )}
                </View>
              </Pressable>
            </>
          )}
          {marketAction.action === 'trade' && (
            <>
              <Pressable style={styles.voteBtn} onPress={onTradeBuy}>
                <LinearGradient
                  colors={['#10b981', '#059669']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.voteBtnGradient}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.voteBtnText}>{market.tokenSymbol || 'BUY'}</Text>
                </LinearGradient>
              </Pressable>
              <Pressable style={styles.voteBtn} onPress={onTradeSell}>
                <View style={styles.noBtnInner}>
                  <Ionicons name="remove" size={16} color="#fff" />
                  <Text style={styles.voteBtnText}>{market.tokenSymbol || 'SELL'}</Text>
                </View>
              </Pressable>
            </>
          )}
          {marketAction.action === 'none' && marketAction.isResolved && (
            <View style={styles.resolvedBadge}>
              <Ionicons
                name={marketAction.resolution === 'YesWins' ? 'checkmark-circle' : marketAction.resolution === 'NoWins' ? 'close-circle' : 'refresh-circle'}
                size={16}
                color={marketAction.resolution === 'YesWins' ? '#10b981' : marketAction.resolution === 'NoWins' ? '#ef4444' : '#f59e0b'}
              />
              <Text style={styles.resolvedBadgeText}>
                {marketAction.resolution === 'YesWins' ? 'Launched' : marketAction.resolution === 'NoWins' ? 'Failed' : 'Refunded'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/* ── Feed Screen ──────────────────────────────────────────── */

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === 'ios' ? 60 + insets.bottom : 68;
  const cardHeight = WINDOW_HEIGHT - tabBarHeight;

  const { markets, isLoading, error, refresh, newMarkets, clearNewMarkets } =
    useMarkets();
  const { isAuthenticated, walletAddress } = useAuth();
  const { network } = useNetwork();
  const { solBalance } = useWalletBalance(walletAddress);

  // Vote toast state
  const [toastState, setToastState] = useState<VoteToastState>({ visible: false, stage: 'signing' });
  const { submitVote } = useVote({
    onSuccess: refresh,
    onStageChange: (stage, direction, amount, marketName, message) => {
      setToastState({ visible: true, stage, direction, amount, marketName, message });
    },
  });
  const { preferences, updatePreferences, resetToDefaults } = useCuratePreferences();

  const [activeTab, setActiveTab] = useState(0); // 0=Feed, 1=For You (tab tap only)
  const [feedActiveIndex, setFeedActiveIndex] = useState(0);

  // New projects notification
  const [showNewPill, setShowNewPill] = useState(false);
  const [seenNewIds, setSeenNewIds] = useState<Set<string>>(new Set());
  const pillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs
  const pagerRef = useRef<ScrollView>(null);
  const feedListRef = useRef<FlatList>(null);

  // Vote sheet state
  const sheetRef = useRef<GorhomBottomSheet>(null);
  const [voteDirection, setVoteDirection] = useState<VoteDirection | null>(null);
  const [voteMarket, setVoteMarket] = useState<Market | null>(null);
  const [votePositionData, setVotePositionData] = useState<any>(null);

  // Trade sheet (for launched tokens)
  const tradeSheetRef = useRef<GorhomBottomSheet>(null);
  const [tradeToken, setTradeToken] = useState<{ mint: string; symbol: string } | null>(null);
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');

  const handleOpenTrade = useCallback((market: Market, mode: 'buy' | 'sell') => {
    const { tokenMint } = getMarketAction(market);
    if (!tokenMint) return;
    if (!isAuthenticated) { router.push('/login'); return; }
    setTradeToken({ mint: tokenMint, symbol: market.tokenSymbol || 'TOKEN' });
    setTradeMode(mode);
    tradeSheetRef.current?.snapToIndex(0);
  }, [isAuthenticated]);

  // Curate sheet
  const curateSheetRef = useRef<GorhomBottomSheet>(null);

  // Show pill when new markets arrive
  useEffect(() => {
    if (newMarkets && newMarkets.length > 0) {
      setShowNewPill(true);
      // Clear previous timer
      if (pillTimerRef.current) clearTimeout(pillTimerRef.current);
      // Auto-hide after 8s
      pillTimerRef.current = setTimeout(() => setShowNewPill(false), 8000);
    }
    return () => {
      if (pillTimerRef.current) clearTimeout(pillTimerRef.current);
    };
  }, [newMarkets]);

  // Sort: video markets first
  const sortedMarkets = useMemo(() => {
    if (!markets.length) return markets;
    return [...markets].sort((a, b) => {
      const aHasVideo = a.pitchVideoUrl ? 1 : 0;
      const bHasVideo = b.pitchVideoUrl ? 1 : 0;
      return bHasVideo - aHasVideo;
    });
  }, [markets]);

  // Feed page: all markets, video-first sort
  const feedPageMarkets = sortedMarkets;

  // For You page: apply curate preferences
  const forYouMarkets = useMemo(() => {
    let result = [...sortedMarkets];
    const now = Date.now();

    if (!preferences.categories.includes('All')) {
      result = result.filter((m) =>
        preferences.categories.some(
          (c) => m.category.toLowerCase() === c.toLowerCase(),
        ),
      );
    }
    if (preferences.timeRange !== 'all') {
      const cutoffs = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      const cutoff = now - cutoffs[preferences.timeRange];
      result = result.filter(
        (m) => m.createdAt && new Date(m.createdAt).getTime() > cutoff,
      );
    }
    return applySortOption(result, preferences.sortBy);
  }, [sortedMarkets, preferences]);

  // Active data source based on tab selection
  const displayMarkets = activeTab === 0 ? feedPageMarkets : forYouMarkets;

  const [pagerPage, setPagerPage] = useState(1); // 0=Chat, 1=Feed (default), 2=Voice
  const voiceRoom = useVoiceRoomContextSafe();

  // Refs for syncing vertical scroll across pages
  const chatListRef = useRef<FlatList>(null);
  const voiceListRef = useRef<FlatList>(null);

  const handlePageScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const page = Math.round(offsetX / WINDOW_WIDTH);
      if (page !== pagerPage) {
        setPagerPage(page);

        // Sync vertical position when switching pages
        const syncOffset = feedActiveIndex * cardHeight;
        if (page === 0) {
          chatListRef.current?.scrollToOffset({ offset: syncOffset, animated: false });
        } else if (page === 2) {
          voiceListRef.current?.scrollToOffset({ offset: syncOffset, animated: false });
        }

        // Auto-join voice room when landing on page 2
        if (page === 2 && walletAddress && voiceRoom) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          const market = displayMarkets[feedActiveIndex];
          if (market) {
            voiceRoom.joinSilent(market.id, market.marketAddress, market.name, walletAddress, null);
          }
        }
      }
    },
    [pagerPage, walletAddress, voiceRoom, displayMarkets, feedActiveIndex, cardHeight],
  );

  // Tab press: switch data source (Feed vs For You) — no pager scroll
  const handleTabPress = useCallback(
    (index: number) => {
      setActiveTab(index);
      setFeedActiveIndex(0);
      feedListRef.current?.scrollToOffset({ offset: 0, animated: false });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [],
  );

  const handleNewPillPress = useCallback(() => {
    setShowNewPill(false);
    // Mark current new market IDs for badge display
    if (newMarkets && newMarkets.length > 0) {
      const ids = new Set(newMarkets.map((m: any) => m.id || m.marketAddress));
      setSeenNewIds(ids);
      // Clear badge after 3s
      setTimeout(() => setSeenNewIds(new Set()), 3000);
    }
    clearNewMarkets();
    refresh();
    feedListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setFeedActiveIndex(0);
  }, [newMarkets, clearNewMarkets, refresh]);

  const handleVote = useCallback(
    async (market: Market, direction: VoteDirection) => {
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Fetch position first, then open sheet with all data ready
      let posData = null;
      if (walletAddress) {
        try {
          const res = await fetch(apiUrl(`/api/markets/${market.id}/position?wallet=${walletAddress}&network=${network}`));
          const data = await res.json();
          if (data?.success && data.data) posData = data.data;
        } catch {}
      }

      setVoteMarket(market);
      setVoteDirection(direction);
      setVotePositionData(posData);
      sheetRef.current?.snapToIndex(0);
    },
    [isAuthenticated, walletAddress, network],
  );

  const handleVoteConfirm = useCallback(
    async (direction: VoteDirection, amount: number) => {
      if (!voteMarket) return;
      sheetRef.current?.close();
      await submitVote(voteMarket.marketAddress, voteMarket.id, direction, amount, voteMarket.name);
    },
    [voteMarket, submitVote],
  );

  const onFeedViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setFeedActiveIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  // Shared card renderer
  const renderCard = useCallback(
    (item: Market, _index: number, isCardActive: boolean) => {
      const isNew = seenNewIds.has(item.id) || seenNewIds.has(item.marketAddress);
      const mAction = getMarketAction(item);

      const card = item.pitchVideoUrl ? (
        <PitchVideoCard
          market={item}
          height={cardHeight}
          isActive={isCardActive}
          walletAddress={walletAddress}
          isAuthenticated={isAuthenticated}
          marketAction={mAction}
          onVoteYes={() => handleVote(item, 'yes')}
          onVoteNo={() => handleVote(item, 'no')}
          onTradeBuy={() => handleOpenTrade(item, 'buy')}
          onTradeSell={() => handleOpenTrade(item, 'sell')}
          onPress={() =>
            router.push(`/market/${item.id}` as any)
          }
        />
      ) : (
        <View style={{ width: '100%', height: cardHeight }}>
          <FeedCard
            market={{
              id: item.id,
              title: item.name,
              description: item.description,
              category: item.category,
              projectImageUrl: item.projectImageUrl,
              galleryImageUrls: item.galleryImageUrls,
              tokenSymbol: item.tokenSymbol,
              totalParticipants: (item.yesVotes || 0) + (item.noVotes || 0),
              poolBalance: item.poolBalance ? Number(item.poolBalance) / 1e9 : undefined,
              targetPool: item.targetPool ? Number(item.targetPool) : undefined,
              endTime: item.expiryTime,
              isYesVoteEnabled: item.isYesVoteEnabled,
              isNoVoteEnabled: item.isNoVoteEnabled,
              status: item.status,
              displayStatus: item.displayStatus,
              resolution: item.resolution || null,
            }}
            height={cardHeight}
            actionType={mAction.action}
            onVoteYes={() => handleVote(item, 'yes')}
            onVoteNo={() => handleVote(item, 'no')}
            onTradeBuy={() => handleOpenTrade(item, 'buy')}
            onTradeSell={() => handleOpenTrade(item, 'sell')}
            onPress={() => router.push(`/market/${item.id}`)}
          />
          <View style={styles.feedRightActions}>
            <FavoriteButton
              marketId={item.id}
              walletAddress={walletAddress}
              initialCount={item.favoriteCount ?? 0}
              variant="floating"
            />
            <Pressable
              style={styles.createBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(isAuthenticated ? '/create' : '/login');
              }}
              hitSlop={8}
            >
              <Ionicons name="add-circle" size={26} color="rgba(255,255,255,0.9)" />
            </Pressable>
            <Pressable
              style={styles.shareBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Share.share({
                  message: `${item.name} — check it out on PNL!\nhttps://pnl.market/market/${item.id}`,
                  url: `https://pnl.market/market/${item.id}`,
                });
              }}
              hitSlop={8}
            >
              <Ionicons name="share-social-outline" size={24} color="rgba(255,255,255,0.9)" />
            </Pressable>
          </View>
        </View>
      );

      return (
        <View>
          <NewBadge visible={isNew} />
          {card}
        </View>
      );
    },
    [cardHeight, walletAddress, isAuthenticated, handleVote, handleOpenTrade, seenNewIds],
  );

  // Loading state — show skeleton feed cards instead of a spinner
  if (isLoading && !markets.length) {
    return (
      <View style={styles.container}>
        <View style={[styles.floatingTabs, { top: insets.top + 4 }]}>
          <FeedTabs activeIndex={0} onTabPress={() => {}} />
        </View>
        {[0, 1].map((i) => (
          <SkeletonCard key={i} fullScreen style={{ height: cardHeight, marginBottom: 0 }} />
        ))}
      </View>
    );
  }

  // Error state
  if (error && !markets.length) {
    return (
      <View style={[styles.container, styles.center]}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Failed to load markets"
          subtitle="Check your connection and try again"
          actionLabel="Retry"
          onAction={refresh}
        />
      </View>
    );
  }

  // Empty state
  if (!markets.length) {
    return (
      <View style={[styles.container, styles.center]}>
        <EmptyState
          icon="flame-outline"
          title="No markets yet"
          subtitle="Markets will appear here when they're created"
        />
      </View>
    );
  }

  const tabBarTop = insets.top + 4;
  const pillTop = tabBarTop + 48;
  const newCount = newMarkets?.length ?? 0;

  // Active market's expiry for the floating time pill
  const activeMarket = displayMarkets[feedActiveIndex];
  const activeExpiry = activeMarket?.expiryTime;

  return (
    <View style={styles.container}>
      {/* Vote status toast */}
      <VoteToast
        state={toastState}
        onDismiss={() => setToastState((s) => ({ ...s, visible: false }))}
      />

      {/* Floating TikTok-style tabs — only on Feed page */}
      {pagerPage === 1 && (
        <View style={[styles.floatingTabs, { top: tabBarTop }]}>
          <FeedTabs activeIndex={activeTab} onTabPress={handleTabPress} />
        </View>
      )}

      {/* Gear icon — left side, only on For You tab + Feed page */}
      {pagerPage === 1 && activeTab === 1 && (
        <Pressable
          style={[styles.gearButton, { top: tabBarTop + 6 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            curateSheetRef.current?.snapToIndex(0);
          }}
          hitSlop={10}
        >
          <Ionicons name="settings-outline" size={16} color="rgba(255,255,255,0.7)" />
        </Pressable>
      )}

      {/* Time countdown — only on Feed page */}
      {pagerPage === 1 && activeExpiry && new Date(activeExpiry).getTime() > Date.now() && (
        <View style={[styles.timeRight, { top: tabBarTop + 8 }]}>
          <TimeCountdown endTime={activeExpiry} size="small" />
        </View>
      )}

      {/* Edge hints — only visible on Feed page */}
      {pagerPage === 1 && (
        <>
          <View style={[styles.edgeHintLeft, { top: cardHeight / 2 - 20 }]}>
            <Ionicons name="chevron-back" size={12} color="rgba(139,92,246,0.3)" />
            <Ionicons name="chatbubble-outline" size={13} color="rgba(139,92,246,0.4)" />
          </View>
          <View style={[styles.edgeHintRight, { top: cardHeight / 2 - 20 }]}>
            <Ionicons name="mic-outline" size={13} color="rgba(139,92,246,0.4)" />
            <Ionicons name="chevron-forward" size={12} color="rgba(139,92,246,0.3)" />
          </View>
        </>
      )}

      {/* New projects pill */}
      <NewProjectsPill
        count={newCount}
        visible={pagerPage === 1 && showNewPill && newCount > 0}
        onPress={handleNewPillPress}
        top={pillTop}
      />

      {/* 3-page horizontal pager: Chat ← Feed → Voice */}
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handlePageScroll}
        scrollEventThrottle={16}
        contentOffset={{ x: WINDOW_WIDTH, y: 0 }}
        style={styles.pager}
      >
        {/* Page 0: Chat Room */}
        <View style={[styles.page, { width: WINDOW_WIDTH }]}>
          <FlatList
            ref={chatListRef}
            data={displayMarkets}
            keyExtractor={(item) => `chat-${item.id}`}
            pagingEnabled
            snapToInterval={cardHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, index) => ({
              length: cardHeight,
              offset: cardHeight * index,
              index,
            })}
            onViewableItemsChanged={({ viewableItems }) => {
              if (pagerPage === 0 && viewableItems.length > 0 && viewableItems[0].index != null) {
                setFeedActiveIndex(viewableItems[0].index);
              }
            }}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item }) => (
              <View style={[styles.chatPage, { height: cardHeight, paddingTop: insets.top }]}>
                {/* Chat header with project context */}
                <View style={styles.chatHeader}>
                  <Pressable
                    onPress={() => pagerRef.current?.scrollTo({ x: WINDOW_WIDTH, animated: true })}
                    hitSlop={10}
                    style={styles.chatBackBtn}
                  >
                    <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
                  </Pressable>
                  {item.projectImageUrl ? (
                    <Image source={{ uri: item.projectImageUrl }} style={styles.chatHeaderAvatar} />
                  ) : (
                    <View style={[styles.chatHeaderAvatar, { backgroundColor: 'rgba(139,92,246,0.15)', alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="chatbubbles" size={16} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.chatHeaderInfo}>
                    <Text style={styles.chatHeaderName} numberOfLines={1}>{item.name}</Text>
                    {item.tokenSymbol ? (
                      <Text style={styles.chatHeaderToken}>${item.tokenSymbol}</Text>
                    ) : null}
                  </View>
                  <View style={styles.chatLiveBadge}>
                    <Ionicons name="chatbubbles-outline" size={12} color={colors.primary} />
                    <Text style={styles.chatLiveBadgeText}>Chat</Text>
                  </View>
                </View>
                {/* Chat content */}
                <ChatRoom
                  marketAddress={item.marketAddress}
                  walletAddress={walletAddress}
                  founderWallet={null}
                  hasPosition={false}
                />
              </View>
            )}
          />
        </View>

        {/* Page 1: Feed (default center page) */}
        <View style={[styles.page, { width: WINDOW_WIDTH }]}>
          {displayMarkets.length === 0 && activeTab === 1 ? (
            <View style={[styles.emptyForYou, { paddingTop: tabBarTop + 60 }]}>
              <EmptyState
                icon="compass-outline"
                title="No matches"
                subtitle="Tap the gear icon to adjust your preferences"
              />
            </View>
          ) : (
            <FlatList
              ref={feedListRef}
              data={displayMarkets}
              keyExtractor={(item) => `${activeTab}-${item.id}`}
              renderItem={({ item, index }) =>
                renderCard(item, index, index === feedActiveIndex)
              }
              pagingEnabled
              snapToInterval={cardHeight}
              snapToAlignment="start"
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              onViewableItemsChanged={onFeedViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={(_, index) => ({
                length: cardHeight,
                offset: cardHeight * index,
                index,
              })}
            />
          )}
        </View>

        {/* Page 2: Voice Room */}
        <View style={[styles.voiceRoomPage, { width: WINDOW_WIDTH }]}>
          <FlatList
            ref={voiceListRef}
            data={displayMarkets}
            keyExtractor={(item) => `voice-${item.id}`}
            pagingEnabled
            snapToInterval={cardHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, index) => ({
              length: cardHeight,
              offset: cardHeight * index,
              index,
            })}
            onViewableItemsChanged={({ viewableItems }) => {
              if (viewableItems.length > 0 && viewableItems[0].index != null) {
                const idx = viewableItems[0].index;
                const item = viewableItems[0].item as Market;
                if (pagerPage === 2) {
                  setFeedActiveIndex(idx);
                  // Auto-switch room
                  if (walletAddress && voiceRoom) {
                    voiceRoom.joinSilent(item.id, item.marketAddress, item.name, walletAddress, null);
                  }
                }
              }
            }}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            renderItem={({ item }) => (
              <View style={{ height: cardHeight }}>
                <VoiceRoom
                  marketId={item.id}
                  marketAddress={item.marketAddress}
                  marketName={item.name}
                  walletAddress={walletAddress}
                  founderWallet={null}
                  hasPosition={false}
                  tokenSymbol={item.tokenSymbol}
                  projectImageUrl={item.projectImageUrl}
                  poolBalance={item.poolBalance as number}
                  targetPool={Number(item.targetPool)}
                />
                {/* Adaptive voice room action overlay */}
                {voiceRoom?.isConnected && (() => {
                  const vAction = getMarketAction(item);
                  if (vAction.action === 'vote') {
                    return (
                      <View style={styles.voiceVoteOverlay}>
                        <VoiceRoomVoteButtons
                          onVoteYes={() => handleVote(item, 'yes')}
                          onVoteNo={() => handleVote(item, 'no')}
                          isVoting={false}
                        />
                      </View>
                    );
                  }
                  if (vAction.action === 'trade') {
                    return (
                      <View style={styles.voiceVoteOverlay}>
                        <View style={styles.tradeOverlayRow}>
                          <Pressable style={styles.tradeBuyBtn} onPress={() => handleOpenTrade(item, 'buy')}>
                            <Ionicons name="add" size={16} color="#fff" />
                            <Text style={styles.voteBtnText}>{item.tokenSymbol || 'BUY'}</Text>
                          </Pressable>
                          <Pressable style={styles.tradeSellBtn} onPress={() => handleOpenTrade(item, 'sell')}>
                            <Ionicons name="remove" size={16} color="#fff" />
                            <Text style={styles.voteBtnText}>{item.tokenSymbol || 'SELL'}</Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  }
                  return null;
                })()}
              </View>
            )}
          />
        </View>
      </ScrollView>

      {/* Curate bottom sheet (gear → opens this) */}
      <GorhomBottomSheet
        ref={curateSheetRef}
        index={-1}
        snapPoints={['60%']}
        enablePanDownToClose
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <CuratePanel
          preferences={preferences}
          updatePreferences={updatePreferences}
          resetToDefaults={resetToDefaults}
          onClose={() => curateSheetRef.current?.close()}
        />
      </GorhomBottomSheet>

      {/* Vote bottom sheet */}
      <VoteBottomSheet
        ref={sheetRef}
        direction={voteDirection}
        marketTitle={voteMarket?.name ?? ''}
        solBalance={solBalance}
        positionData={votePositionData}
        onConfirm={handleVoteConfirm}
        onClose={() => {
          setVoteDirection(null);
          setVoteMarket(null);
          setVotePositionData(null);
        }}
      />

      {/* Trade bottom sheet (for launched tokens) */}
      {tradeToken && (
        <TradeSheet
          ref={tradeSheetRef}
          tokenMint={tradeToken.mint}
          tokenSymbol={tradeToken.symbol}
          initialMode={tradeMode}
          onClose={() => setTradeToken(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: spacing.md,
    fontSize: 16,
  },
  floatingTabs: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 50,
    paddingBottom: 4,
  },
  gearButton: {
    position: 'absolute',
    left: 16,
    zIndex: 51,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  sheetBg: {
    backgroundColor: colors.sheetBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetHandle: {
    backgroundColor: colors.sheetHandle,
    width: 40,
  },
  emptyForYou: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  resolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flex: 1,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
  },
  resolvedBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  tradeOverlayRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tradeBuyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#10b981',
  },
  tradeSellBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  edgeHintLeft: {
    position: 'absolute',
    left: 0,
    zIndex: 40,
    backgroundColor: 'rgba(10, 14, 26, 0.5)',
    paddingVertical: 8,
    paddingHorizontal: 4,
    paddingRight: 6,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    alignItems: 'center',
    gap: 2,
  },
  edgeHintRight: {
    position: 'absolute',
    right: 0,
    zIndex: 40,
    backgroundColor: 'rgba(10, 14, 26, 0.5)',
    paddingVertical: 8,
    paddingHorizontal: 4,
    paddingLeft: 6,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    alignItems: 'center',
    gap: 2,
  },
  voiceRoomPage: {
    backgroundColor: '#0a0e1a',
    flex: 1,
  },
  voiceRoomEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  voiceVoteOverlay: {
    position: 'absolute',
    bottom: 140,
    left: spacing.md,
    right: spacing.md,
    zIndex: 20,
  },
  chatPage: {
    flex: 1,
    backgroundColor: colors.background,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: spacing.sm,
  },
  chatBackBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  chatHeaderToken: {
    color: '#22d3ee',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace' as any,
  },
  chatLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(129,140,248,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.2)',
  },
  chatLiveBadgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  voiceRoomHintTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 18,
    fontWeight: '600',
  },
  voiceRoomHintSub: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 13,
  },

  /* ── PitchVideoCard styles ── */
  videoCard: {
    width: WINDOW_WIDTH,
    backgroundColor: '#000',
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  topGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '30%',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
  },
  muteIndicator: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: 220,
    alignItems: 'center',
    gap: 18,
    zIndex: 10,
  },
  projectAvatar: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  overlay: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
  timeRight: {
    position: 'absolute',
    right: 16,
    zIndex: 51,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    backgroundColor: 'rgba(10, 14, 26, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  categoryText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  marketTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  tokenSymbol: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  marketDescription: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  voteRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  voteBtn: {
    flex: 1,
  },
  voteBtnDisabled: {
    opacity: 0.4,
  },
  voteBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
  },
  voteGradientDisabled: {
    opacity: 0.6,
  },
  noBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  noBtnDisabled: {
    opacity: 0.6,
  },
  voteBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  detailBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  shareBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedRightActions: {
    position: 'absolute',
    right: 12,
    bottom: 240,
    alignItems: 'center',
    gap: 18,
    zIndex: 10,
  },
});
