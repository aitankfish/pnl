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
  Animated,
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

/* ── Voice Live Indicator ────────────────────────────────── */

interface VoiceLiveIndicatorProps {
  active: boolean;
  onPress: () => void;
}

function VoiceLiveIndicator({ active, onPress }: VoiceLiveIndicatorProps) {
  const bar1 = useRef(new Animated.Value(0.4)).current;
  const bar2 = useRef(new Animated.Value(0.6)).current;
  const bar3 = useRef(new Animated.Value(0.4)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (anim: Animated.Value, lo: number, hi: number, dur: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: hi, duration: dur, useNativeDriver: true }),
          Animated.timing(anim, { toValue: lo, duration: dur, useNativeDriver: true }),
        ]),
      );

    if (active) {
      const anim = Animated.parallel([
        bounce(bar1, 0.3, 1, 340),
        bounce(bar2, 0.35, 1, 260),
        bounce(bar3, 0.25, 1, 400),
        Animated.loop(
          Animated.sequence([
            Animated.timing(shake, { toValue: 1, duration: 80, useNativeDriver: true }),
            Animated.timing(shake, { toValue: -1, duration: 80, useNativeDriver: true }),
            Animated.timing(shake, { toValue: 0, duration: 80, useNativeDriver: true }),
          ]),
        ),
        Animated.loop(
          Animated.sequence([
            Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
            Animated.timing(glow, { toValue: 0, duration: 1200, useNativeDriver: true }),
          ]),
        ),
      ]);
      anim.start();
      return () => anim.stop();
    }

    bar1.setValue(0.4);
    bar3.setValue(0.4);
    shake.setValue(0);
    glow.setValue(0);
    const idle = Animated.loop(
      Animated.sequence([
        Animated.timing(bar2, { toValue: 0.75, duration: 900, useNativeDriver: true }),
        Animated.timing(bar2, { toValue: 0.5, duration: 900, useNativeDriver: true }),
      ]),
    );
    idle.start();
    return () => idle.stop();
  }, [active, bar1, bar2, bar3, shake, glow]);

  return (
    <Pressable
      style={styles.voiceIndicator}
      onPress={(e) => {
        e.stopPropagation?.();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      hitSlop={8}
    >
      {active && (
        <Animated.View
          style={[
            styles.voiceGlowRing,
            {
              opacity: glow.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.8],
              }),
              transform: [
                {
                  scale: glow.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.4],
                  }),
                },
              ],
            },
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.voiceCircle,
          active && styles.voiceCircleActive,
          {
            transform: [
              {
                translateX: shake.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: [-1.5, 0, 1.5],
                }),
              },
            ],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.soundBar,
            active && styles.soundBarActive,
            { transform: [{ scaleY: bar1 }] },
          ]}
        />
        <Animated.View
          style={[
            styles.soundBar,
            styles.soundBarTall,
            active && styles.soundBarActiveCenter,
            { transform: [{ scaleY: bar2 }] },
          ]}
        />
        <Animated.View
          style={[
            styles.soundBar,
            active && styles.soundBarActive,
            { transform: [{ scaleY: bar3 }] },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

/* ── Pitch Video Card ─────────────────────────────────────── */

interface PitchVideoCardProps {
  market: Market;
  height: number;
  isActive: boolean;
  voiceActive: boolean;
  walletAddress: string | null;
  votingState?: { voteType: 'yes' | 'no' } | null;
  onVoteYes: () => void;
  onVoteNo: () => void;
  onPress: () => void;
}

function PitchVideoCard({
  market,
  height,
  isActive,
  voiceActive,
  walletAddress,
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
        <VoiceLiveIndicator active={voiceActive} onPress={onPress} />
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

  const { markets, isLoading, error, refresh, activeVoiceRooms, newMarkets, clearNewMarkets } =
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
  const voiceRoom = useVoiceRoomContextSafe();
  const { preferences, updatePreferences, resetToDefaults } = useCuratePreferences();

  const [activePage, setActivePage] = useState(0); // 0=Feed, 1=For You
  const [feedActiveIndex, setFeedActiveIndex] = useState(0);
  const [forYouActiveIndex, setForYouActiveIndex] = useState(0);

  // New projects notification
  const [showNewPill, setShowNewPill] = useState(false);
  const [seenNewIds, setSeenNewIds] = useState<Set<string>>(new Set());
  const pillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs
  const pagerRef = useRef<ScrollView>(null);
  const feedListRef = useRef<FlatList>(null);
  const forYouListRef = useRef<FlatList>(null);

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

  const handlePageScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const page = Math.round(offsetX / WINDOW_WIDTH);
      if (page !== activePage) setActivePage(page);
    },
    [activePage],
  );

  const handleTabPress = useCallback(
    (index: number) => {
      pagerRef.current?.scrollTo({ x: index * WINDOW_WIDTH, animated: true });
      setActivePage(index);
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
    // Scroll active feed to top
    if (activePage === 0) {
      feedListRef.current?.scrollToOffset({ offset: 0, animated: true });
      setFeedActiveIndex(0);
    } else {
      forYouListRef.current?.scrollToOffset({ offset: 0, animated: true });
      setForYouActiveIndex(0);
    }
  }, [newMarkets, clearNewMarkets, refresh, activePage]);

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

  const onForYouViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setForYouActiveIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  // Shared card renderer
  const renderCard = useCallback(
    (item: Market, index: number, isCardActive: boolean) => {
      const isVoiceActive = !!(
        (voiceRoom?.isConnected && voiceRoom.marketAddress === item.marketAddress) ||
        (activeVoiceRooms && activeVoiceRooms.get(item.marketAddress))
      );
      const isNew = seenNewIds.has(item.id) || seenNewIds.has(item.marketAddress);

      const card = item.pitchVideoUrl ? (
        <PitchVideoCard
          market={item}
          height={cardHeight}
          isActive={isCardActive}
          voiceActive={isVoiceActive}
          walletAddress={walletAddress}
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
            <VoiceLiveIndicator
              active={isVoiceActive}
              onPress={() =>
                router.push({ pathname: `/market/${item.id}`, params: { tab: 'community' } })
              }
            />
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
    [cardHeight, voiceRoom, activeVoiceRooms, walletAddress, handleVote, seenNewIds],
  );

  // Loading state
  if (isLoading && !markets.length) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading markets...</Text>
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
  const activeMarket =
    activePage === 0
      ? feedPageMarkets[feedActiveIndex]
      : forYouMarkets[forYouActiveIndex];
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
        <FeedTabs activeIndex={activePage} onTabPress={handleTabPress} />
      </View>

      {/* Gear icon — left side, only on For You page */}
      {activePage === 1 && (
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

      {/* Time countdown — right side, aligned with tabs */}
      {activeExpiry && (
        <View style={[styles.timeRight, { top: tabBarTop + 8 }]}>
          <TimeCountdown endTime={activeExpiry} size="small" />
        </View>
      )}

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
        {/* Page 0: Feed — all markets */}
        <View style={[styles.page, { width: WINDOW_WIDTH }]}>
          <FlatList
            ref={feedListRef}
            data={feedPageMarkets}
            keyExtractor={(item) => `feed-${item.id}`}
            renderItem={({ item, index }) =>
              renderCard(item, index, activePage === 0 && index === feedActiveIndex)
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
        </View>

        {/* Page 1: For You — curated markets */}
        <View style={[styles.page, { width: WINDOW_WIDTH }]}>
          {forYouMarkets.length === 0 ? (
            <View style={[styles.emptyForYou, { paddingTop: tabBarTop + 60 }]}>
              <EmptyState
                icon="compass-outline"
                title="No matches"
                subtitle="Tap the gear icon to adjust your preferences"
              />
            </View>
          ) : (
            <FlatList
              ref={forYouListRef}
              data={forYouMarkets}
              keyExtractor={(item) => `foryou-${item.id}`}
              renderItem={({ item, index }) =>
                renderCard(item, index, activePage === 1 && index === forYouActiveIndex)
              }
              pagingEnabled
              snapToInterval={cardHeight}
              snapToAlignment="start"
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              onViewableItemsChanged={onForYouViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={(_, index) => ({
                length: cardHeight,
                offset: cardHeight * index,
                index,
              })}
            />
          )}
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

  /* ── Voice Live Indicator styles ── */
  voiceIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2.5,
  },
  voiceCircleActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.9)',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  voiceGlowRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#a78bfa',
  },
  soundBar: {
    width: 3,
    height: 10,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  soundBarTall: {
    height: 14,
  },
  soundBarActive: {
    backgroundColor: '#c4b5fd',
  },
  soundBarActiveCenter: {
    backgroundColor: '#22d3ee',
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
