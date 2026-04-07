/**
 * Market Detail Screen — Full Web Feature Parity
 * - Parallax hero image
 * - Anti-bandwagon vote gauge (hide % when unresolved)
 * - Pool progress, countdown
 * - Market status card (all resolution states, claims, vesting, founder actions)
 * - User position display
 * - Tabbed content: Overview / AI Analysis / Activity
 * - VoteBottomSheet with fee summary
 * - Favorite button, creator badge, social links, on-chain info
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Share,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Linking,
  Alert,
  Pressable,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, interpolate, Extrapolation } from 'react-native-reanimated';
import GorhomBottomSheet from '@gorhom/bottom-sheet';
import useSWR from 'swr';
import { useMarket, useNetwork } from '@pnl/shared/hooks';
import { fetcher } from '@pnl/shared/services';
import { apiUrl } from '@pnl/shared/utils';
import { useAuth } from '../../src/providers/AuthProvider';
import { useWalletBalance } from '../../src/hooks/useWalletBalance';
import { useVote } from '../../src/hooks/useVote';
import { useTokenStats } from '../../src/hooks/useTokenStats';
import { usePitchVideo } from '../../src/hooks/usePitchVideo';
import { useToggleFollow } from '../../src/hooks/useFollow';
import {
  ScreenHeader,
  PressableScale,
  VoteGauge,
  TimeCountdown,
  CategoryPill,
  GlassCard,
  EmptyState,
  VoteBottomSheet,
  GrokAnalysis,
  ActivityFeed,
  MarketHolders,
  MarketStatusCard,
  FavoriteButton,
  BirdeyeChart,
  TradeSheet,
  VoteToast,
} from '../../src/components';
import type { VoteToastState } from '../../src/components';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

const HERO_HEIGHT = 260;
const SCREEN_WIDTH = Dimensions.get('window').width;
const TABS = ['Overview', 'AI Analysis', 'Activity'] as const;
type TabName = (typeof TABS)[number];
type VoteDirection = 'yes' | 'no';

const TAB_ICONS: Record<TabName, { outline: keyof typeof Ionicons.glyphMap; filled: keyof typeof Ionicons.glyphMap; shortLabel: string }> = {
  'Overview':    { outline: 'layers-outline',      filled: 'layers',      shortLabel: 'Info' },
  'AI Analysis': { outline: 'sparkles-outline',    filled: 'sparkles',    shortLabel: 'AI' },
  'Activity':    { outline: 'pulse-outline',       filled: 'pulse',       shortLabel: 'Activity' },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function truncateAddress(addr?: string): string {
  if (!addr || addr.length < 12) return addr || '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}


function getExplorerUrl(address: string, network: string): string {
  const cluster = network === 'mainnet-beta' ? '' : `?cluster=${network}`;
  return `https://solscan.io/account/${address}${cluster}`;
}

function formatLabel(value: string): string {
  const map: Record<string, string> = {
    dao: 'DAO', nft: 'NFT', ai: 'AI/ML', defi: 'DeFi', mvp: 'MVP',
    realestate: 'Real Estate', 'real estate': 'Real Estate',
  };
  if (map[value.toLowerCase()]) return map[value.toLowerCase()];
  return value.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function isDirectVideoUrl(url?: string): boolean {
  if (!url) return false;
  return /\.(mp4|mov|webm|m3u8)(\?|$)/i.test(url);
}

function isEmbeddableVideo(url?: string): boolean {
  if (!url) return false;
  return /youtube\.com|youtu\.be|vimeo\.com/i.test(url);
}

function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match?.[1] || null;
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function MarketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { market, isLoading, error, refresh: refreshMarket, socketConnected } = useMarket(id ?? null);
  const { isAuthenticated, walletAddress, solanaWallet } = useAuth();
  const { network } = useNetwork();
  const { solBalance } = useWalletBalance(walletAddress);
  const [toastState, setToastState] = useState<VoteToastState>({ visible: false, stage: 'signing' });
  const { submitVote, isVoting } = useVote({
    onSuccess: () => { refetchPosition(); refreshMarket(); },
    onStageChange: (stage, direction, amount, marketName, message) => {
      setToastState({ visible: true, stage, direction, amount, marketName, message });
    },
  });

  // ── Creator follow ──
  const founderWallet = (market as any)?.founderWallet;
  const isOwnMarket = !!walletAddress && walletAddress === founderWallet;
  const { toggleFollow, isToggling: isFollowToggling } = useToggleFollow(walletAddress ?? null);
  const [isFollowingCreator, setIsFollowingCreator] = useState(false);

  // Check follow status on mount
  useEffect(() => {
    if (!walletAddress || !founderWallet || isOwnMarket) return;
    let mounted = true;
    fetch(apiUrl(`/api/profile/${founderWallet}/follow-status?viewer=${walletAddress}`))
      .then(r => r.json())
      .then(data => { if (mounted && data.success) setIsFollowingCreator(data.data.isFollowing); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [walletAddress, founderWallet, isOwnMarket]);

  const handleFollowToggle = useCallback(async () => {
    if (!founderWallet) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const success = await toggleFollow(founderWallet, isFollowingCreator);
    if (success) setIsFollowingCreator(prev => !prev);
  }, [founderWallet, isFollowingCreator, toggleFollow]);
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabName>('Overview');

  const handleSetActiveTab = useCallback((newTab: TabName) => {
    setActiveTab(newTab);
  }, []);

  // ── Position data (platform-agnostic SWR) ──
  const { data: positionResponse, mutate: refetchPosition } = useSWR(
    id && walletAddress ? `/api/markets/${id}/position?wallet=${walletAddress}&network=${network}` : null,
    fetcher,
    { revalidateOnFocus: true, dedupingInterval: 5000 },
  );
  const positionData = (positionResponse as any)?.success ? (positionResponse as any).data : null;

  // ── Activity + holders data — adaptive polling (skip when socket handles updates) ──
  const activityPollInterval = socketConnected ? 0 : 20000;
  const { data: activityResponse, mutate: refetchActivity } = useSWR(
    id ? `/api/markets/${id}/activity?network=${network}` : null,
    fetcher,
    { refreshInterval: activityPollInterval, revalidateOnFocus: true, dedupingInterval: 10000, keepPreviousData: true },
  );
  const holdersData = (activityResponse as any)?.success ? (activityResponse as any).data : null;

  // ── Vesting data (founder-only, YesWins markets) ──
  const isFounder = !!walletAddress && !!market?.founderWallet && walletAddress === market.founderWallet;
  const isYesWins = market?.resolution === 'YesWins';
  const { data: vestingResponse, mutate: refetchVesting } = useSWR(
    isYesWins && market?.marketAddress
      ? `/api/markets/${market.marketAddress}/vesting?network=${network}`
      : null,
    fetcher,
    { dedupingInterval: 30000, shouldRetryOnError: false },
  );
  const vestingData = (vestingResponse as any)?.success ? (vestingResponse as any).data : null;

  // ── Debounced refetch on socket updates (matches web behavior) ──
  const prevMarketRef = useRef<string | null>(null);
  useEffect(() => {
    if (!market || !socketConnected) return;
    // Build a fingerprint of frequently-changing fields
    const fingerprint = `${market.yesVotes}-${market.noVotes}-${market.poolBalance}-${market.resolution}`;
    if (prevMarketRef.current === fingerprint) return;
    prevMarketRef.current = fingerprint;
    // Debounce: wait 1s after last socket update before refetching activity/position
    const timer = setTimeout(() => {
      refetchActivity();
      refetchPosition();
    }, 1000);
    return () => clearTimeout(timer);
  }, [market?.yesVotes, market?.noVotes, market?.poolBalance, market?.resolution, socketConnected, refetchActivity, refetchPosition]);

  // ── Parallax scroll ──
  const scrollY = useSharedValue(0);
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.value = e.nativeEvent.contentOffset.y;
  }, []);
  const heroStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollY.value, [-100, 0, HERO_HEIGHT], [-50, 0, HERO_HEIGHT * 0.4], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-100, 0], [1.3, 1], Extrapolation.CLAMP) },
    ],
  }));
  const headerBgStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HERO_HEIGHT - 120, HERO_HEIGHT - 60], [0, 1], Extrapolation.CLAMP),
  }));

  // ── Hero carousel (image + pitch video) ──
  const [heroPage, setHeroPage] = useState(0);
  const hasPitchVideo = !!(market as any)?.pitchVideoUrl;
  const pitchVideoRef = useRef<Video>(null);

  const handleExpandPitchVideo = useCallback(async () => {
    if (!pitchVideoRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await pitchVideoRef.current.setIsMutedAsync(false);
    await pitchVideoRef.current.presentFullscreenPlayer();
  }, []);

  // ── Hero video ──
  const videoRef = useRef<Video>(null);
  const videoUrl = (market as any)?.metadata?.videoUrl;
  const hasDirectVideo = isDirectVideoUrl(videoUrl);
  const hasYouTubeVideo = isEmbeddableVideo(videoUrl);
  const [ytPlaying, setYtPlaying] = useState(false);

  const handleVideoTap = useCallback(async () => {
    if (!videoRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await videoRef.current.setIsMutedAsync(false);
    await videoRef.current.presentFullscreenPlayer();
  }, []);

  const handleFullscreenUpdate = useCallback(async (event: { fullscreenUpdate: number }) => {
    if (event.fullscreenUpdate === 3 && videoRef.current) {
      await videoRef.current.setIsMutedAsync(true);
    }
  }, []);

  // ── Hero media helper (used in pager page 2 & non-launched fallback) ──
  const renderHeroMedia = useCallback(() => {
    if (hasDirectVideo) {
      return (
        <>
          <Pressable onPress={handleVideoTap} style={StyleSheet.absoluteFill}>
            <Video
              ref={videoRef}
              source={{ uri: videoUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
              isMuted
              onFullscreenUpdate={handleFullscreenUpdate as any}
            />
          </Pressable>
          <View style={styles.videoPlayHint} pointerEvents="none">
            <View style={styles.videoPlayBtn}>
              <Ionicons name="volume-mute" size={16} color="#fff" />
            </View>
          </View>
        </>
      );
    }
    if (hasYouTubeVideo) {
      const ytId = extractYouTubeId(videoUrl);
      // Playing state: show inline WebView player
      if (ytPlaying && ytId) {
        return (
          <WebView
            source={{ uri: `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&playsinline=1&controls=1&modestbranding=1&rel=0&origin=https://pnl.market` }}
            style={StyleSheet.absoluteFill}
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            scrollEnabled={false}
            originWhitelist={['*']}
            userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
          />
        );
      }
      // Thumbnail state: show image with play button
      return (
        <Pressable onPress={() => ytId ? setYtPlaying(true) : Linking.openURL(videoUrl)} style={StyleSheet.absoluteFill}>
          {market?.projectImageUrl ? (
            <Image source={{ uri: market.projectImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
          ) : (
            <LinearGradient colors={[colors.gradientStart, colors.background]} style={StyleSheet.absoluteFill} />
          )}
          <View style={styles.videoPlayCenter} pointerEvents="none">
            <View style={styles.videoPlayBtnLg}>
              <Ionicons name="play" size={28} color="#fff" />
            </View>
          </View>
        </Pressable>
      );
    }
    if (market?.projectImageUrl) {
      return <Image source={{ uri: market.projectImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />;
    }
    return <LinearGradient colors={[colors.gradientStart, colors.background]} style={StyleSheet.absoluteFill} />;
  }, [hasDirectVideo, hasYouTubeVideo, videoUrl, market?.projectImageUrl, handleVideoTap, handleFullscreenUpdate, ytPlaying]);

  // ── Vote sheet ──
  const sheetRef = useRef<GorhomBottomSheet>(null);
  const [voteDirection, setVoteDirection] = useState<VoteDirection | null>(null);

  // ── Trade sheet (launched tokens) ──
  const tradeSheetRef = useRef<GorhomBottomSheet>(null);
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell'>('buy');

  // ── Derived state ──
  const isResolved = market?.resolution && market.resolution !== 'Unresolved';
  const isExpired = market?.expiryTime ? new Date(market.expiryTime) < new Date() : false;
  const yesDisabled = !market?.isYesVoteEnabled || isExpired;
  const noDisabled = !market?.isNoVoteEnabled || isExpired;
  const totalParticipants = market?.totalParticipants ?? 0;
  const yesPercent = market?.yesPercentage ?? 50;
  const noPercent = market?.noPercentage ?? 50;

  const grokVotingData = useMemo(() => {
    if (!market) return undefined;
    return { totalYesVotes: market.yesVotes ?? 0, totalNoVotes: market.noVotes ?? 0, yesPercentage: yesPercent, totalParticipants };
  }, [market, yesPercent, totalParticipants]);

  // ── Launched token detection ──
  const tokenMintAddress = (market as any)?.tokenMint || (market as any)?.pumpFunTokenAddress || null;
  const isTokenLaunched = isResolved && market?.resolution === 'YesWins' && !!tokenMintAddress;
  const tokenAddresses = useMemo(() => tokenMintAddress ? [tokenMintAddress] : [], [tokenMintAddress]);
  const { stats: tokenStats } = useTokenStats(tokenAddresses);
  const liveStats = tokenMintAddress ? tokenStats.get(tokenMintAddress) : null;

  // ── Handlers ──

  const openTrade = useCallback(
    (mode: 'buy' | 'sell') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (!isAuthenticated) { router.push('/login'); return; }
      setTradeMode(mode);
      tradeSheetRef.current?.snapToIndex(0);
    },
    [isAuthenticated],
  );

  const handleVote = useCallback(
    (direction: VoteDirection) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (!isAuthenticated) { router.push('/login'); return; }
      if (direction === 'yes' && yesDisabled) {
        if (market?.yesVoteDisabledReason) Alert.alert('Cannot Vote', market.yesVoteDisabledReason);
        return;
      }
      if (direction === 'no' && noDisabled) {
        if (market?.noVoteDisabledReason) Alert.alert('Cannot Vote', market.noVoteDisabledReason);
        return;
      }
      // Check if user already has a position on the opposite side
      if (positionData?.hasPosition && positionData.side !== direction) {
        Alert.alert('Cannot Vote', `You already voted ${positionData.side.toUpperCase()} — can't switch sides.`);
        return;
      }
      setVoteDirection(direction);
      sheetRef.current?.snapToIndex(0);
    },
    [isAuthenticated, yesDisabled, noDisabled, market, positionData],
  );

  const handleVoteConfirm = useCallback(
    async (direction: VoteDirection, amount: number) => {
      if (!market) return;
      sheetRef.current?.close();
      await submitVote(market.marketAddress, market.id, direction, amount, market.name);
    },
    [market, submitVote],
  );

  const handleShare = useCallback(async () => {
    if (!market) return;
    await Share.share({ message: `Check out "${market.name}" on PNL — predict & launch!`, url: `https://pnl.market/market/${market.id}` });
  }, [market]);

  const handleCopyAddress = useCallback(async (addr: string) => {
    await Clipboard.setStringAsync(addr);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Copied', 'Address copied to clipboard');
  }, []);

  // ── Loading / Error ──

  if (isLoading && !market) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading market...</Text>
      </View>
    );
  }

  if (error || !market) {
    return (
      <View style={[styles.container, styles.center]}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Failed to load market"
          subtitle="This market may no longer exist"
          actionLabel="Go Back"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  const getDisabledReason = (dir: VoteDirection): string | null => {
    if (isResolved) return 'Market has been resolved';
    if (isExpired) return 'Market has expired';
    if (dir === 'yes' && market.yesVoteDisabledReason) return market.yesVoteDisabledReason;
    if (dir === 'no' && market.noVoteDisabledReason) return market.noVoteDisabledReason;
    return null;
  };

  const disabledReason = getDisabledReason('yes') || getDisabledReason('no');

  // ── Render ──

  return (
    <View style={styles.container}>
      <VoteToast
        state={toastState}
        onDismiss={() => setToastState((s) => ({ ...s, visible: false }))}
      />
      <ScreenHeader
        transparent
        left={
          <PressableScale onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </PressableScale>
        }
        right={
          <PressableScale onPress={handleShare} style={styles.headerButton}>
            <Ionicons name="arrow-redo-outline" size={20} color="#fff" />
          </PressableScale>
        }
      />
      <Animated.View style={[styles.headerBg, { height: insets.top + 52 }, headerBgStyle]} />

      {/* Main scrollable content */}
        <ScrollView
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
        >
          {/* Parallax hero — carousel if pitch video exists */}
          <Animated.View style={[styles.heroContainer, heroStyle]}>
            {hasPitchVideo ? (
              <>
                <FlatList
                  data={['image', 'pitchVideo']}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => item}
                  onMomentumScrollEnd={(e) => {
                    const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                    setHeroPage(page);
                  }}
                  renderItem={({ item }) => (
                    <View style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}>
                      {item === 'image' ? (
                        renderHeroMedia()
                      ) : (
                        <>
                          <Video
                            ref={pitchVideoRef}
                            source={{ uri: (market as any).pitchVideoUrl }}
                            style={StyleSheet.absoluteFill}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay={heroPage === 1}
                            isLooping
                            isMuted
                          />
                          <Pressable
                            style={styles.expandBtn}
                            onPress={handleExpandPitchVideo}
                            hitSlop={8}
                          >
                            <Ionicons name="expand-outline" size={20} color="#fff" />
                          </Pressable>
                        </>
                      )}
                    </View>
                  )}
                />
                {/* Pagination dots */}
                <View style={styles.heroDots}>
                  {['image', 'pitchVideo'].map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.heroDot,
                        heroPage === i && styles.heroDotActive,
                      ]}
                    />
                  ))}
                </View>
              </>
            ) : (
              renderHeroMedia()
            )}
            <LinearGradient colors={['transparent', colors.background]} style={styles.heroScrim} />
          </Animated.View>

          {/* Market info */}
          <View style={styles.infoSection}>
            {!isTokenLaunched && (
              <View style={styles.pillRow}>
                {market.category && <CategoryPill label={formatLabel(market.category)} variant="tag" />}
                {market.displayStatus && <CategoryPill label={market.displayStatus} variant="tag" />}
                {(market as any).projectAge && <CategoryPill label={(market as any).projectAge} variant="tag" />}
                {!isResolved && (
                  <View style={styles.participantInlineBadge}>
                    <Ionicons name="people-outline" size={10} color={colors.textSecondary} />
                    <Text style={styles.participantInlineText}>
                      {totalParticipants}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Launched token: horizontal identity bar — image | ticker + name | CA */}
            {isTokenLaunched && tokenMintAddress ? (
              <View style={styles.tokenIdentityBar}>
                <Image
                  source={{ uri: market.projectImageUrl }}
                  style={styles.tokenIdentityImage}
                  contentFit="cover"
                  transition={200}
                />
                <View style={styles.tokenIdentityInfo}>
                  <Text style={styles.tokenIdentityName} numberOfLines={1}>{market.name}</Text>
                  <Text style={styles.tokenIdentityTicker}>${market.tokenSymbol || 'TOKEN'}</Text>
                  {(market as any).founderWallet && (
                    <View style={styles.tokenIdentityFounder}>
                      <Ionicons name="person-circle-outline" size={11} color={colors.warning} />
                      <Text style={styles.tokenIdentityFounderText} numberOfLines={1}>
                        {(market as any).founderDisplayName || (market as any).founderUsername || truncateAddress((market as any).founderWallet)}
                      </Text>
                    </View>
                  )}
                </View>
                <PressableScale
                  onPress={() => handleCopyAddress(tokenMintAddress)}
                  style={styles.tokenIdentityCA}
                >
                  <Text style={styles.tokenIdentityCAText}>{truncateAddress(tokenMintAddress)}</Text>
                  <Ionicons name="copy-outline" size={11} color={colors.textMuted} />
                </PressableScale>
              </View>
            ) : (
              <Text style={styles.title}>{market.name}</Text>
            )}

            {/* Creator badge + follow */}
            {founderWallet && !isTokenLaunched && (
              <View style={styles.creatorRow}>
                <PressableScale onPress={() => router.push(`/profile/${founderWallet}` as any)} style={styles.creatorInfo}>
                  <Ionicons name="person-circle-outline" size={16} color={colors.warning} />
                  <Text style={styles.creatorText}>
                    by {(market as any).founderDisplayName || (market as any).founderUsername || truncateAddress(founderWallet)}
                  </Text>
                </PressableScale>
                {walletAddress && !isOwnMarket && (
                  <PressableScale
                    onPress={handleFollowToggle}
                    disabled={isFollowToggling}
                    style={[styles.followBtn, isFollowingCreator && styles.followBtnActive]}
                  >
                    <Ionicons
                      name={isFollowingCreator ? 'checkmark' : 'add'}
                      size={12}
                      color={isFollowingCreator ? colors.textSecondary : '#fff'}
                    />
                    <Text style={[styles.followBtnText, isFollowingCreator && styles.followBtnTextActive]}>
                      {isFollowingCreator ? 'Following' : 'Follow'}
                    </Text>
                  </PressableScale>
                )}
              </View>
            )}

          </View>

          {/* Community validation — vote gauge or pool progress */}
          <View style={styles.section}>
            {isResolved ? (
              <VoteGauge yesPercent={yesPercent} noPercent={noPercent} yesCount={market.yesVotes} noCount={market.noVotes} variant="detailed" />
            ) : (
              <AnimatedPoolBar market={market} />
            )}
          </View>

          {/* Chart + live stats — only for launched tokens, placed after community data */}
          {isTokenLaunched && tokenMintAddress && (
            <View style={styles.section}>
              <BirdeyeChart tokenMint={tokenMintAddress} height={300} />

              {/* Live token stats grid */}
              <GlassCard style={styles.tokenStatsCard}>
                <View style={styles.tokenStatsGrid}>
                  <View style={styles.tokenStatCell}>
                    <Text style={styles.tokenStatLabel}>Price</Text>
                    <Text style={styles.tokenStatValue}>
                      {liveStats?.price != null
                        ? liveStats.price < 0.000001 ? `$${liveStats.price.toExponential(2)}`
                        : liveStats.price < 0.01 ? `$${liveStats.price.toFixed(6)}`
                        : liveStats.price < 1 ? `$${liveStats.price.toFixed(4)}`
                        : `$${liveStats.price.toFixed(2)}`
                        : '-'}
                    </Text>
                  </View>
                  <View style={styles.tokenStatCell}>
                    <Text style={styles.tokenStatLabel}>24h</Text>
                    <Text style={[
                      styles.tokenStatValue,
                      liveStats?.priceChange24h != null && {
                        color: liveStats.priceChange24h >= 0 ? '#10b981' : '#ef4444',
                      },
                    ]}>
                      {liveStats?.priceChange24h != null
                        ? `${liveStats.priceChange24h >= 0 ? '+' : ''}${liveStats.priceChange24h.toFixed(1)}%`
                        : '-'}
                    </Text>
                  </View>
                  <View style={styles.tokenStatCell}>
                    <Text style={styles.tokenStatLabel}>MCap</Text>
                    <Text style={styles.tokenStatValue}>
                      {liveStats?.marketCap != null
                        ? liveStats.marketCap >= 1e9 ? `$${(liveStats.marketCap / 1e9).toFixed(2)}B`
                        : liveStats.marketCap >= 1e6 ? `$${(liveStats.marketCap / 1e6).toFixed(2)}M`
                        : liveStats.marketCap >= 1e3 ? `$${(liveStats.marketCap / 1e3).toFixed(2)}K`
                        : `$${liveStats.marketCap.toFixed(2)}`
                        : '-'}
                    </Text>
                  </View>
                </View>
                <View style={styles.tokenStatsGrid}>
                  <View style={styles.tokenStatCell}>
                    <Text style={styles.tokenStatLabel}>Volume</Text>
                    <Text style={styles.tokenStatValue}>
                      {liveStats?.volume24h != null
                        ? liveStats.volume24h >= 1e9 ? `$${(liveStats.volume24h / 1e9).toFixed(2)}B`
                        : liveStats.volume24h >= 1e6 ? `$${(liveStats.volume24h / 1e6).toFixed(2)}M`
                        : liveStats.volume24h >= 1e3 ? `$${(liveStats.volume24h / 1e3).toFixed(2)}K`
                        : `$${liveStats.volume24h.toFixed(2)}`
                        : '-'}
                    </Text>
                  </View>
                  <View style={styles.tokenStatCell}>
                    <Text style={styles.tokenStatLabel}>Liquidity</Text>
                    <Text style={styles.tokenStatValue}>
                      {liveStats?.liquidity != null
                        ? liveStats.liquidity >= 1e9 ? `$${(liveStats.liquidity / 1e9).toFixed(2)}B`
                        : liveStats.liquidity >= 1e6 ? `$${(liveStats.liquidity / 1e6).toFixed(2)}M`
                        : liveStats.liquidity >= 1e3 ? `$${(liveStats.liquidity / 1e3).toFixed(2)}K`
                        : `$${liveStats.liquidity.toFixed(2)}`
                        : '-'}
                    </Text>
                  </View>
                  <View style={styles.tokenStatCell}>
                    <Text style={styles.tokenStatLabel}>Holders</Text>
                    <Text style={styles.tokenStatValue}>
                      {liveStats?.holders != null
                        ? liveStats.holders >= 1e6 ? `${(liveStats.holders / 1e6).toFixed(1)}M`
                        : liveStats.holders >= 1e3 ? `${(liveStats.holders / 1e3).toFixed(1)}K`
                        : liveStats.holders.toLocaleString()
                        : '-'}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            </View>
          )}

          {/* Description excerpt */}
          {market.description && (
            <View style={styles.descriptionExcerpt}>
              <Text style={styles.descriptionText} numberOfLines={2}>
                {market.description}
              </Text>
            </View>
          )}

          {/* Inline horizontal tabs */}
          <View style={styles.inlineTabs}>
            <FavoriteButton
              marketId={market.id}
              walletAddress={walletAddress}
              initialCount={(market as any).favoriteCount ?? 0}
              variant="floating"
            />
            {TABS.map(t => {
              const active = activeTab === t;
              const { outline, filled, shortLabel } = TAB_ICONS[t];
              return (
                <Pressable
                  key={t}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); handleSetActiveTab(t); }}
                  style={[styles.inlineTab, active && styles.inlineTabActive]}
                >
                  <Ionicons name={active ? filled : outline} size={16} color={active ? colors.primary : colors.textMuted} />
                  <Text style={[styles.inlineTabText, active && styles.inlineTabTextActive]}>{shortLabel}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Tab content */}
          <View style={styles.tabContent}>
            {activeTab === 'Overview' && (
              <OverviewTab
                market={market}
                network={network}
                onCopyAddress={handleCopyAddress}
                positionData={positionData}
                vestingData={vestingData}
                walletAddress={walletAddress}
                solanaWallet={solanaWallet}
                onRefresh={() => { refreshMarket(); refetchPosition(); refetchVesting(); refetchActivity(); }}
                tokenMintAddr={tokenMintAddress}
              />
            )}
            {activeTab === 'AI Analysis' && (
              <GrokAnalysis marketId={market.id} resolution={market.resolution} votingData={grokVotingData} />
            )}
            {activeTab === 'Activity' && (
              <View style={{ gap: spacing.lg }}>
                <ActivityFeed marketId={market.id} />
                {holdersData ? (
                  <MarketHolders
                    yesHolders={holdersData.yesHolders ?? []}
                    noHolders={holdersData.noHolders ?? []}
                    totalYesStake={holdersData.totalYesStake ?? 0}
                    totalNoStake={holdersData.totalNoStake ?? 0}
                    uniqueHolders={holdersData.uniqueHolders ?? 0}
                    yesPercentage={market.yesPercentage}
                    noPercentage={market.noPercentage}
                    currentUserWallet={walletAddress ?? undefined}
                  />
                ) : null}
              </View>
            )}
          </View>
        </ScrollView>

      {/* Removed: floating right tab bar — tabs are now inline in scrollable content */}

      {/* Sticky bottom buttons — trade for launched, vote otherwise */}
      {isTokenLaunched ? (
          <View style={[styles.stickyVotes, { paddingBottom: insets.bottom || 16 }]}>
            <PressableScale
              onPress={() => openTrade('buy')}
              style={[styles.voteButton, styles.buyButton]}
            >
              <Text style={styles.tradeButtonText}>+ {market.tokenSymbol || 'TOKEN'}</Text>
            </PressableScale>
            <PressableScale
              onPress={() => openTrade('sell')}
              style={[styles.voteButton, styles.sellButton]}
            >
              <Text style={styles.tradeButtonText}>{'\u2212'} {market.tokenSymbol || 'TOKEN'}</Text>
            </PressableScale>
          </View>
        ) : (
          <>
            {/* User position badge */}
            {positionData?.hasPosition && (
              <View style={styles.positionBadge}>
                <Ionicons
                  name={positionData.side === 'yes' ? 'trending-up' : 'trending-down'}
                  size={14}
                  color={positionData.side === 'yes' ? '#10b981' : '#ef4444'}
                />
                <Text style={[styles.positionBadgeText, { color: positionData.side === 'yes' ? '#10b981' : '#ef4444' }]}>
                  You voted {positionData.side?.toUpperCase()} — {positionData.totalAmount?.toFixed(3)} SOL
                </Text>
              </View>
            )}
            <View style={[styles.stickyVotes, { paddingBottom: insets.bottom || 16 }]}>
              <PressableScale
                onPress={() => handleVote('yes')}
                style={[styles.voteButton, styles.yesButton, (yesDisabled || isVoting) && styles.voteButtonDisabled]}
                disabled={isVoting}
              >
                <Ionicons name="trending-up" size={20} color="#fff" />
                <Text style={styles.voteButtonText}>{isVoting && voteDirection === 'yes' ? 'Voting...' : 'Vote YES'}</Text>
              </PressableScale>
              <PressableScale
                onPress={() => handleVote('no')}
                style={[styles.voteButton, styles.noButton, (noDisabled || isVoting) && styles.voteButtonDisabled]}
                disabled={isVoting}
              >
                <Ionicons name="trending-down" size={20} color="#fff" />
                <Text style={styles.voteButtonText}>{isVoting && voteDirection === 'no' ? 'Voting...' : 'Vote NO'}</Text>
              </PressableScale>
            </View>

            {/* Disabled reason */}
            {disabledReason && !isVoting ? (
              <View style={[styles.disabledBanner, { bottom: (insets.bottom || 16) + 60 }]}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                <Text style={styles.disabledText}>{disabledReason}</Text>
              </View>
            ) : null}
          </>
        )
      }

      {/* Vote bottom sheet */}
      <VoteBottomSheet
        ref={sheetRef}
        direction={voteDirection}
        marketTitle={market.name}
        solBalance={solBalance}
        positionData={positionData}
        onConfirm={handleVoteConfirm}
        onClose={() => setVoteDirection(null)}
      />

      {/* Trade bottom sheet (launched tokens) */}
      {isTokenLaunched && (
        <TradeSheet
          ref={tradeSheetRef}
          tokenMint={tokenMintAddress}
          tokenSymbol={market.tokenSymbol || 'TOKEN'}
          initialMode={tradeMode}
          onClose={() => {}}
        />
      )}
    </View>
  );
}

// ── Overview Tab ────────────────────────────────────────────────────────────

// ── Animated Pool Progress Bar ─────────────────────────────────────────────

function AnimatedPoolBar({ market }: { market: any }) {
  const poolBalance = market.poolBalance ? Number(market.poolBalance) / 1e9 : 0;
  const target = parseFloat(String(market.targetPool)) || 1;
  const pct = Math.min((poolBalance / target) * 100, 100);

  const animatedWidth = useSharedValue(0);

  React.useEffect(() => {
    animatedWidth.value = withTiming(pct, { duration: 600 });
  }, [pct, animatedWidth]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${animatedWidth.value}%`,
  }));

  return (
    <View style={styles.poolProgressRow}>
      <View style={styles.poolProgressBarBg}>
        <Animated.View style={[styles.poolProgressBarFill, barStyle]} />
      </View>
      <Text style={styles.poolProgressText}>
        {poolBalance.toFixed(2)}/{parseFloat(String(market.targetPool)) || '?'} SOL
      </Text>
    </View>
  );
}

// ── Overview Tab ────────────────────────────────────────────────────────────

// ── Founder Pitch Video Management ────────────────────────────────────────
function FounderPitchVideoSection({
  projectId,
  walletAddress,
  hasPitchVideo,
  onSuccess,
}: {
  projectId: string;
  walletAddress: string;
  hasPitchVideo: boolean;
  onSuccess: () => void;
}) {
  const { status, isLoading, uploadProgress, handleRecord, handlePick, handleDelete } = usePitchVideo({
    projectId,
    walletAddress,
    onSuccess,
  });

  return (
    <View style={pvStyles.container}>
      <View style={pvStyles.header}>
        <Ionicons name="videocam-outline" size={16} color={colors.primary} />
        <Text style={pvStyles.title}>Pitch Video</Text>
      </View>

      {status === 'uploading' && (
        <View style={pvStyles.progressContainer}>
          <View style={pvStyles.progressBarBg}>
            <View style={[pvStyles.progressBarFill, { width: `${uploadProgress}%` }]} />
          </View>
          <Text style={pvStyles.progressText}>Uploading {uploadProgress}%</Text>
        </View>
      )}

      {hasPitchVideo ? (
        /* ── Has video — show status + replace/delete ── */
        <View style={pvStyles.hasVideoRow}>
          <View style={pvStyles.statusBadge}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={pvStyles.statusText}>Video live on feed</Text>
          </View>
          <View style={pvStyles.actions}>
            <PressableScale
              onPress={handlePick}
              disabled={isLoading}
              style={pvStyles.actionBtn}
            >
              {status === 'uploading' ? (
                <ActivityIndicator size={12} color={colors.primary} />
              ) : (
                <Ionicons name="swap-horizontal-outline" size={14} color={colors.primary} />
              )}
              <Text style={pvStyles.actionText}>Replace</Text>
            </PressableScale>
            <PressableScale
              onPress={handleDelete}
              disabled={isLoading}
              style={pvStyles.actionBtn}
            >
              {status === 'deleting' ? (
                <ActivityIndicator size={12} color={colors.danger} />
              ) : (
                <Ionicons name="trash-outline" size={14} color={colors.danger} />
              )}
              <Text style={[pvStyles.actionText, { color: colors.danger }]}>Delete</Text>
            </PressableScale>
          </View>
        </View>
      ) : (
        /* ── No video — show add options ── */
        <View style={pvStyles.addRow}>
          <PressableScale
            onPress={handleRecord}
            disabled={isLoading}
            style={pvStyles.addBtn}
          >
            <Ionicons name="videocam" size={18} color={colors.primary} />
            <Text style={pvStyles.addBtnText}>Record</Text>
          </PressableScale>
          <PressableScale
            onPress={handlePick}
            disabled={isLoading}
            style={pvStyles.addBtn}
          >
            {status === 'uploading' ? (
              <ActivityIndicator size={16} color={colors.primary} />
            ) : (
              <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
            )}
            <Text style={pvStyles.addBtnText}>Upload</Text>
          </PressableScale>
        </View>
      )}

      <Text style={pvStyles.hint}>
        {hasPitchVideo
          ? 'Your pitch video appears in the feed for all users.'
          : 'Add a pitch video to stand out in the feed.'}
      </Text>
    </View>
  );
}

const pvStyles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(99, 102, 241, 0.06)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  hasVideoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    ...typography.caption,
    color: colors.success,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  addBtnText: {
    ...typography.captionBold,
    color: colors.primary,
  },
  hint: {
    ...typography.micro,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  progressContainer: {
    gap: 4,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 2,
    overflow: 'hidden' as const,
  },
  progressBarFill: {
    height: '100%' as any,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressText: {
    ...typography.micro,
    color: colors.primary,
    textAlign: 'center' as const,
  },
});

function OverviewTab({ market, network, onCopyAddress, positionData, vestingData, walletAddress, solanaWallet, onRefresh, tokenMintAddr }: {
  market: any;
  network: string;
  onCopyAddress: (addr: string) => void;
  positionData: any;
  vestingData: any;
  walletAddress: string | null | undefined;
  solanaWallet: any;
  onRefresh: () => void;
  tokenMintAddr: string | null;
}) {
  const metadata = market.metadata;
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <View style={ov.container}>
      {/* Countdown */}
      {market.endTime && (
        <GlassCard style={ov.countdownCard}>
          <View style={ov.countdownRow}>
            <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
            <Text style={ov.countdownLabel}>Time Remaining</Text>
            <TimeCountdown endTime={market.endTime} />
          </View>
        </GlassCard>
      )}

      {/* Market Status Card — hide for plain active markets (redundant with ACTIVE pill) */}
      {!(market.resolution === 'Unresolved' && market.phase !== 'Funding' && !(market.poolProgressPercentage >= 100) && !(market.expiryTime && new Date(market.expiryTime).getTime() < Date.now())) && (
        <MarketStatusCard
          market={market}
          positionData={positionData}
          vestingData={vestingData}
          walletAddress={walletAddress ?? null}
          solanaWallet={solanaWallet}
          network={network}
          onRefresh={onRefresh}
        />
      )}

      {/* Full description */}
      {market.description ? <Text style={ov.description}>{market.description}</Text> : null}

      {/* Founder: Pitch Video management */}
      {walletAddress && market.founderWallet === walletAddress && (
        <FounderPitchVideoSection
          projectId={market.id}
          walletAddress={walletAddress}
          hasPitchVideo={!!market.pitchVideoUrl}
          onSuccess={onRefresh}
        />
      )}

      {/* Additional notes */}
      {metadata?.additionalNotes ? (
        <GlassCard style={ov.notesCard}>
          <Text style={ov.notesTitle}>What This Project Offers</Text>
          <Text style={ov.notesText}>{metadata.additionalNotes}</Text>
        </GlassCard>
      ) : null}

      {/* All badges + docs + social — single unified row like web */}
      <View style={ov.metaGrid}>
        {market.tokenSymbol ? <MetaTag icon="pricetag" label={`$${market.tokenSymbol}`} bg="rgba(255,255,255,0.05)" border="rgba(255,255,255,0.1)" color="#fff" /> : null}
        {market.category ? <MetaTag icon="grid" label={formatLabel(market.category)} bg="rgba(168,85,247,0.15)" border="rgba(168,85,247,0.3)" color="#c084fc" /> : null}
        {market.stage ? <MetaTag icon="flag" label={formatLabel(market.stage)} bg="rgba(255,255,255,0.08)" border="rgba(255,255,255,0.15)" color="#e2e8f0" /> : null}
        {metadata?.projectType ? <MetaTag icon="rocket" label={formatLabel(metadata.projectType)} bg="rgba(34,211,238,0.12)" border="rgba(34,211,238,0.25)" color="#67e8f9" /> : null}
        {metadata?.teamSize ? <MetaTag icon="people" label={`${metadata.teamSize}`} bg="rgba(251,146,60,0.1)" border="rgba(251,146,60,0.2)" color="#fdba74" /> : null}
        {metadata?.location ? <MetaTag icon="location" label={metadata.location} bg="rgba(74,222,128,0.1)" border="rgba(74,222,128,0.2)" color="#86efac" /> : null}
        {market.phase ? <MetaTag icon="layers" label={market.phase} bg="rgba(255,255,255,0.05)" border="rgba(255,255,255,0.1)" color="#94a3b8" /> : null}
        {market.documentUrls?.map((url: string, i: number) => (
          <PressableScale key={`doc-${i}`} onPress={() => Linking.openURL(url)}>
            <MetaTag icon="document-text" label="Docs" bg="rgba(96,165,250,0.1)" border="rgba(96,165,250,0.2)" color="#93c5fd" />
          </PressableScale>
        ))}
        {metadata?.socialLinks?.website ? <SocialLink icon="globe-outline" label="Web" url={metadata.socialLinks.website} /> : null}
        {metadata?.socialLinks?.twitter ? <SocialLink icon="logo-twitter" label="X" url={metadata.socialLinks.twitter} /> : null}
        {metadata?.socialLinks?.discord ? <SocialLink icon="logo-discord" label="Discord" url={metadata.socialLinks.discord} /> : null}
        {metadata?.socialLinks?.github ? <SocialLink icon="logo-github" label="GitHub" url={metadata.socialLinks.github} /> : null}
        {metadata?.socialLinks?.telegram ? <SocialLink icon="paper-plane-outline" label="TG" url={metadata.socialLinks.telegram} /> : null}
      </View>

      {/* On-chain info — collapsible advanced section */}
      <Pressable
        style={ov.advancedToggle}
        onPress={() => setShowAdvanced?.((p: boolean) => !p)}
      >
        <Ionicons name="code-slash-outline" size={14} color={colors.textMuted} />
        <Text style={ov.advancedToggleText}>Advanced Details</Text>
        <Ionicons name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
      </Pressable>
      {showAdvanced && (<>
      <View style={ov.onchainCard}>
        <View style={ov.onchainHeader}>
          <Ionicons name="link-outline" size={14} color="#c084fc" />
          <Text style={ov.onchainTitle}>On-chain</Text>
        </View>
        <View style={ov.onchainGrid}>
          {tokenMintAddr ? (
            <AddressRow label="Token" address={tokenMintAddr} network={network} onCopy={onCopyAddress} color="#22c55e" explorerUrl={`https://orb.helius.dev/address/${tokenMintAddr}`} />
          ) : null}
          {market.marketAddress ? (
            <AddressRow label="Market" address={market.marketAddress} network={network} onCopy={onCopyAddress} color="#22d3ee" explorerUrl={`https://orb.helius.dev/address/${market.marketAddress}`} />
          ) : null}
          {market.founderWallet ? (
            <AddressRow label="Founder" address={market.founderWallet} network={network} onCopy={onCopyAddress} color="#c084fc" />
          ) : null}
          {market.id ? (
            <AddressRow label="ID" address={market.id} network={network} onCopy={onCopyAddress} color="#94a3b8" noExplorer />
          ) : null}
        </View>
      </View>

      {/* External links — only when token is launched */}
      {tokenMintAddr ? (
        <View style={ov.externalLinksCard}>
          <View style={ov.onchainHeader}>
            <Ionicons name="open-outline" size={14} color="#22d3ee" />
            <Text style={ov.onchainTitle}>View on</Text>
          </View>
          <View style={ov.externalLinksRow}>
            <PressableScale onPress={() => Linking.openURL(`https://orb.helius.dev/address/${tokenMintAddr}`)} style={ov.externalLinkBtn}>
              <Ionicons name="wallet-outline" size={14} color="#a855f7" />
              <Text style={[ov.externalLinkText, { color: '#a855f7' }]}>Helius</Text>
            </PressableScale>
            <PressableScale onPress={() => Linking.openURL(`https://birdeye.so/token/${tokenMintAddr}?chain=solana`)} style={ov.externalLinkBtn}>
              <Ionicons name="eye-outline" size={14} color="#f59e0b" />
              <Text style={[ov.externalLinkText, { color: '#f59e0b' }]}>Birdeye</Text>
            </PressableScale>
            <PressableScale onPress={() => Linking.openURL(`https://dexscreener.com/solana/${tokenMintAddr}`)} style={ov.externalLinkBtn}>
              <Ionicons name="bar-chart-outline" size={14} color="#22c55e" />
              <Text style={[ov.externalLinkText, { color: '#22c55e' }]}>DEX</Text>
            </PressableScale>
            <PressableScale onPress={() => Linking.openURL(`https://pump.fun/coin/${tokenMintAddr}`)} style={ov.externalLinkBtn}>
              <Ionicons name="rocket-outline" size={14} color="#ec4899" />
              <Text style={[ov.externalLinkText, { color: '#ec4899' }]}>Pump</Text>
            </PressableScale>
          </View>
        </View>
      ) : null}
      </>)}
    </View>
  );
}

function MetaTag({ icon, label, bg, border, color }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; bg: string; border: string; color: string;
}) {
  return (
    <View style={[ov.metaTag, { backgroundColor: bg, borderColor: border }]}>
      <Ionicons name={icon} size={12} color={color} />
      <Text style={[ov.metaValue, { color }]}>{label}</Text>
    </View>
  );
}

function SocialLink({ icon, label, url }: { icon: keyof typeof Ionicons.glyphMap; label: string; url: string }) {
  return (
    <PressableScale onPress={() => Linking.openURL(url)} style={ov.socialLink}>
      <Ionicons name={icon} size={14} color={colors.primary} />
      <Text style={ov.socialLinkText}>{label}</Text>
    </PressableScale>
  );
}

function AddressRow({ label, address, network, onCopy, noExplorer, color, explorerUrl }: {
  label: string; address: string; network: string; onCopy: (addr: string) => void; noExplorer?: boolean; color?: string; explorerUrl?: string;
}) {
  return (
    <View style={ov.addressRow}>
      <Text style={[ov.addressLabel, { color: color || colors.textSecondary }]}>{label}</Text>
      <View style={ov.addressActions}>
        <Text style={[ov.addressValue, { color: color || colors.textMuted }]}>{truncateAddress(address)}</Text>
        <PressableScale onPress={() => onCopy(address)} style={ov.addressBtn}>
          <Ionicons name="copy-outline" size={12} color={color || colors.textMuted} />
        </PressableScale>
        {!noExplorer ? (
          <PressableScale onPress={() => Linking.openURL(explorerUrl || getExplorerUrl(address, network))} style={ov.addressBtn}>
            <Ionicons name="open-outline" size={12} color={color || colors.textMuted} />
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

const ov = StyleSheet.create({
  container: { gap: spacing.md },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  advancedToggleText: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
  },
  countdownCard: { padding: spacing.sm },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  countdownLabel: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  description: { ...typography.caption, color: colors.textSecondary, lineHeight: 20, textAlign: 'center' },
  notesCard: { padding: spacing.sm, gap: spacing.xs },
  notesTitle: { ...typography.captionBold, color: '#22d3ee', fontSize: 11 },
  notesText: { ...typography.caption, color: colors.textSecondary, lineHeight: 20, fontSize: 12 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  metaValue: { fontSize: 11, fontWeight: '600' },
  socialLink: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8, paddingVertical: 5,
  },
  socialLinkText: { fontSize: 11, fontWeight: '500', color: colors.textPrimary },
  onchainCard: {
    backgroundColor: 'rgba(168,85,247,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, padding: spacing.sm, gap: 8,
  },
  onchainHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onchainTitle: { fontSize: 12, fontWeight: '600', color: '#fff' },
  onchainGrid: { gap: 4 },
  addressRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 6,
  },
  addressLabel: { fontSize: 11, fontWeight: '600' },
  addressActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addressValue: { fontSize: 11, fontFamily: 'Courier', fontVariant: ['tabular-nums'] as any },
  addressBtn: { padding: 3 },
  externalLinksCard: {
    backgroundColor: 'rgba(34,211,238,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12, padding: spacing.sm, gap: 8,
  },
  externalLinksRow: {
    flexDirection: 'row', gap: 6,
  },
  externalLinkBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: 8, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  externalLinkText: {
    fontSize: 10, fontWeight: '700',
  },
});

// ── Main Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { ...typography.body, color: colors.textMuted, marginTop: spacing.md },
  headerButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerBg: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(10,14,26,0.95)', zIndex: 9 },
  heroContainer: { height: HERO_HEIGHT, overflow: 'hidden' },
  heroScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 },
  heroDots: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    zIndex: 10,
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  heroDotActive: {
    backgroundColor: '#fff',
  },
  expandBtn: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -24,
    marginLeft: -24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  videoPlayHint: {
    position: 'absolute', bottom: 12, left: 12,
  },
  videoPlayCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  videoPlayBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  videoPlayBtnLg: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  scrollContent: {},
  infoSection: { paddingHorizontal: spacing.md, marginTop: -spacing.xl, marginBottom: spacing.sm },
  pillRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, gap: spacing.xs, flexWrap: 'wrap' },
  participantInlineBadge: {
    flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: borderRadius.full,
    paddingHorizontal: 6, paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  participantInlineText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  poolProgressRow: { gap: 6 },
  poolProgressBarBg: {
    height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  poolProgressBarFill: {
    height: '100%', borderRadius: 3, backgroundColor: colors.success,
  },
  poolProgressText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
  title: { ...typography.display, color: colors.textPrimary, marginBottom: 2 },
  tokenIdentityBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: borderRadius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    padding: 10, marginBottom: 4,
  },
  tokenIdentityImage: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)',
  },
  tokenIdentityInfo: { flex: 1, gap: 1 },
  tokenIdentityName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, lineHeight: 20 },
  tokenIdentityTicker: { fontSize: 12, fontWeight: '600', color: colors.primary },
  tokenIdentityFounder: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  tokenIdentityFounderText: { fontSize: 10, fontWeight: '500', color: colors.warning },
  tokenIdentityCA: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: borderRadius.full,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  tokenIdentityCAText: { fontSize: 10, fontWeight: '500', color: colors.textMuted, fontFamily: 'Courier', fontVariant: ['tabular-nums'] as any },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  creatorInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  creatorText: { ...typography.caption, color: colors.warning },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  followBtnActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
  },
  followBtnText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  followBtnTextActive: { color: colors.textSecondary },
  section: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  sectionFullWidth: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  tabContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  inlineTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  inlineTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  inlineTabActive: {
    backgroundColor: 'rgba(129,140,248,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.25)',
  },
  inlineTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  inlineTabTextActive: {
    color: colors.primary,
  },
  _deprecated_floatingTabs: {
    position: 'absolute', right: 2, zIndex: 20,
    alignItems: 'center', gap: 4,
  },
  floatingTabItem: { alignItems: 'center', gap: 3 },
  floatingTabIcon: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  floatingTabIconActive: {
    backgroundColor: 'rgba(129,140,248,0.18)',
    borderColor: 'rgba(129,140,248,0.4)',
  },
  floatingTabLabel: { ...typography.micro, color: 'rgba(255,255,255,0.6)', fontSize: 10 },
  floatingTabLabelActive: { color: colors.primary },
  floatingDivider: { width: 28, height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 2 },
  stickyVotes: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm,
    backgroundColor: 'rgba(10,14,26,0.92)', borderTopWidth: 1, borderTopColor: colors.border,
  },
  voteButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, paddingVertical: 16, borderRadius: borderRadius.lg,
  },
  yesButton: { backgroundColor: colors.success },
  noButton: { backgroundColor: colors.danger },
  voteButtonDisabled: { opacity: 0.4 },
  voteButtonText: { ...typography.bodyBold, color: '#fff' },
  buyButton: { backgroundColor: '#86efac' },
  sellButton: { backgroundColor: '#fca5a5' },
  tradeButtonText: { ...typography.bodyBold, color: '#1a1a2e', fontSize: 16 },
  antiBandwagon: { gap: spacing.sm },
  antiBandwagonBar: { height: 8, borderRadius: borderRadius.full, backgroundColor: colors.surface, overflow: 'hidden', flexDirection: 'row' },
  antiBandwagonFill: { borderRadius: borderRadius.full },
  antiBandwagonText: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  disabledBanner: {
    position: 'absolute', left: spacing.md, right: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, justifyContent: 'center',
  },
  disabledText: { ...typography.micro, color: colors.textMuted },
  // Token stats bar (launched markets)
  tokenStatsCard: { padding: spacing.sm, gap: 8 },
  tokenStatsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tokenStatsTitle: { fontSize: 12, fontWeight: '700', color: '#22c55e' },
  tokenStatsGrid: { flexDirection: 'row', gap: 4 },
  tokenStatCell: {
    flex: 1, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8, padding: 8,
  },
  tokenStatLabel: { fontSize: 9, fontWeight: '500', color: colors.textMuted, marginBottom: 2 },
  tokenStatValue: { fontSize: 11, fontWeight: '700', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  descriptionExcerpt: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  descriptionText: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  positionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  positionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
