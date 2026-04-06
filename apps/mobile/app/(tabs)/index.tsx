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
import { VoiceRoomVoteButtons } from '../../src/components/community/VoiceRoomVoteButtons';
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
  votingState?: { voteType: 'yes' | 'no' } | null;
  onVoteYes: () => void;
  onVoteNo: () => void;
  onPress: () => void;
}

function PitchVideoCard({
  market,
  height,
  isActive,
  walletAddress,
  isAuthenticated,
  votingState,
  onVoteYes,
  onVoteNo,
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

  const [pagerPage, setPagerPage] = useState(0); // 0=Feed, 1=Voice Room
  const voiceRoom = useVoiceRoomContextSafe();

  const handlePageScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const page = Math.round(offsetX / WINDOW_WIDTH);
      if (page !== pagerPage) {
        setPagerPage(page);
        if (page === 1 && walletAddress && voiceRoom) {
          // Auto-join as listener when swiping to voice room
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          const market = displayMarkets[feedActiveIndex];
          if (market) {
            voiceRoom.joinSilent(market.id, market.marketAddress, market.name, walletAddress, null);
          }
        }
      }
    },
    [pagerPage, walletAddress, voiceRoom, displayMarkets, feedActiveIndex],
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

      const card = item.pitchVideoUrl ? (
        <PitchVideoCard
          market={item}
          height={cardHeight}
          isActive={isCardActive}
          walletAddress={walletAddress}
          isAuthenticated={isAuthenticated}
          onVoteYes={() => handleVote(item, 'yes')}
          onVoteNo={() => handleVote(item, 'no')}
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
            }}
            height={cardHeight}
            onVoteYes={() => handleVote(item, 'yes')}
            onVoteNo={() => handleVote(item, 'no')}
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
    [cardHeight, walletAddress, isAuthenticated, handleVote, seenNewIds],
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

      {/* Floating TikTok-style tabs */}
      <View style={[styles.floatingTabs, { top: tabBarTop }]}>
        <FeedTabs activeIndex={activeTab} onTabPress={handleTabPress} />
      </View>

      {/* Gear icon — left side, only on For You page */}
      {activeTab === 1 && (
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

      {/* Time countdown — right side, aligned with tabs (hide if expired) */}
      {activeExpiry && new Date(activeExpiry).getTime() > Date.now() && (
        <View style={[styles.timeRight, { top: tabBarTop + 8 }]}>
          <TimeCountdown endTime={activeExpiry} size="small" />
        </View>
      )}

      {/* Voice room swipe hint — right edge */}
      <View style={[styles.voiceHint, { top: cardHeight / 2 - 30 }]}>
        <Ionicons name="mic-outline" size={14} color="rgba(139,92,246,0.4)" />
        <Ionicons name="chevron-forward" size={12} color="rgba(139,92,246,0.3)" />
      </View>

      {/* New projects pill */}
      <NewProjectsPill
        count={newCount}
        visible={showNewPill && newCount > 0}
        onPress={handleNewPillPress}
        top={pillTop}
      />

      {/* Horizontal paging ScrollView — swipe between Feed / For You */}
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handlePageScroll}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {/* Page 0: Feed / For You (single list, tab switches data) */}
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

        {/* Page 1: Voice Rooms — vertical swipe between project rooms */}
        <View style={[styles.voiceRoomPage, { width: WINDOW_WIDTH }]}>
          <FlatList
            data={displayMarkets}
            keyExtractor={(item) => `voice-${item.id}`}
            pagingEnabled
            snapToInterval={cardHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            initialScrollIndex={feedActiveIndex}
            getItemLayout={(_, index) => ({
              length: cardHeight,
              offset: cardHeight * index,
              index,
            })}
            onViewableItemsChanged={({ viewableItems }) => {
              if (viewableItems.length > 0 && viewableItems[0].index != null) {
                const item = viewableItems[0].item as Market;
                // Auto-switch room when swiping to a new project
                if (walletAddress && voiceRoom && pagerPage === 1) {
                  voiceRoom.joinSilent(item.id, item.marketAddress, item.name, walletAddress, null);
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
                {/* Vote overlay */}
                {voiceRoom?.isConnected && (item.isYesVoteEnabled || item.isNoVoteEnabled) && (
                  <View style={styles.voiceVoteOverlay}>
                    <VoiceRoomVoteButtons
                      onVoteYes={() => handleVote(item, 'yes')}
                      onVoteNo={() => handleVote(item, 'no')}
                      isVoting={false}
                    />
                  </View>
                )}
              </View>
            )}
          />
          {/* Swipe hints */}
          <View style={styles.voiceSwipeHint}>
            <Ionicons name="chevron-back" size={12} color={colors.textMuted} />
            <Text style={styles.voiceSwipeHintText}>Feed</Text>
            <Text style={[styles.voiceSwipeHintText, { marginLeft: 8 }]}>·</Text>
            <Ionicons name="swap-vertical" size={12} color={colors.textMuted} style={{ marginLeft: 8 }} />
            <Text style={styles.voiceSwipeHintText}>Rooms</Text>
          </View>
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
  voiceHint: {
    position: 'absolute',
    right: 0,
    zIndex: 40,
    backgroundColor: 'rgba(10, 14, 26, 0.6)',
    paddingVertical: 10,
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
  voiceSwipeHint: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    opacity: 0.4,
  },
  voiceSwipeHintText: {
    color: colors.textMuted,
    fontSize: 11,
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
