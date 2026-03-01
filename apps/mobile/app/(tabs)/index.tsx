/**
 * Feed Screen — TikTok-style swipeable market cards
 * Swipe up/down between full-screen market cards.
 * Markets with pitch videos play inline (muted autoplay, tap to unmute).
 * Vote YES/NO with bottom buttons, auth-gated.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
  Text,
  Platform,
  ViewToken,
  Pressable,
  Animated,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import GorhomBottomSheet from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useMarkets } from '@pnl/shared/hooks';
import type { Market } from '@pnl/shared/hooks';
import { useAuth } from '../../src/providers/AuthProvider';
import { useVoiceRoomContextSafe } from '../../src/providers/VoiceRoomProvider';
import { FeedCard, VoteBottomSheet, SkeletonCard, EmptyState } from '../../src/components';
import { colors, spacing } from '../../src/theme';

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get('window');

type VoteDirection = 'yes' | 'no';

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
        // Flowing glow pulse
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

    // Idle — gentle middle bar breathing
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
      {/* Outer glow ring when active */}
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

  const handleTap = useCallback(async () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (!newMuted) {
      // Unmute and go fullscreen
      await videoRef.current.setIsMutedAsync(false);
      await videoRef.current.presentFullscreenPlayer();
    } else {
      await videoRef.current.setIsMutedAsync(true);
    }
  }, [isMuted]);

  const handleFullscreenUpdate = useCallback(
    async (event: { fullscreenUpdate: number }) => {
      // fullscreenUpdate 3 = DID_DISMISS
      if (event.fullscreenUpdate === 3) {
        setIsMuted(true);
        if (videoRef.current) {
          await videoRef.current.setIsMutedAsync(true);
        }
      }
    },
    [],
  );

  return (
    <Pressable style={[styles.videoCard, { height }]} onPress={handleTap}>
      <Video
        ref={videoRef}
        source={{ uri: market.pitchVideoUrl! }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay={isActive}
        isLooping
        isMuted={isMuted}
        onFullscreenUpdate={handleFullscreenUpdate as any}
      />

      {/* Bottom gradient scrim */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
        style={styles.gradient}
      />

      {/* Mute indicator */}
      <View style={styles.muteIndicator}>
        <Ionicons
          name={isMuted ? 'volume-mute' : 'volume-high'}
          size={18}
          color="rgba(255,255,255,0.8)"
        />
      </View>

      {/* Market info overlay */}
      <View style={styles.overlay}>
        {/* Category pill */}
        {market.category ? (
          <View style={styles.categoryPill}>
            <Text style={styles.categoryText}>
              {market.category.toUpperCase()}
            </Text>
          </View>
        ) : null}

        <View style={styles.titleRow}>
          <Text style={styles.marketTitle} numberOfLines={2}>
            {market.name}
          </Text>
          <VoiceLiveIndicator active={voiceActive} onPress={onPress} />
        </View>

        <Text style={styles.tokenSymbol}>${market.tokenSymbol}</Text>

        {market.description ? (
          <Text style={styles.marketDescription} numberOfLines={2}>
            {market.description}
          </Text>
        ) : null}

        {/* Vote buttons — only when actionable */}
        <View style={styles.voteRow}>
          {isActionable && (
            <>
              <Pressable
                style={[styles.voteBtn, (!market.isYesVoteEnabled || isVoting) && styles.voteBtnDisabled]}
                disabled={isVoting || !market.isYesVoteEnabled}
                onPress={(e) => {
                  e.stopPropagation?.();
                  onVoteYes();
                }}
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
                onPress={(e) => {
                  e.stopPropagation?.();
                  onVoteNo();
                }}
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

          <Pressable
            style={styles.detailBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              onPress();
            }}
          >
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

/* ── Feed Screen ──────────────────────────────────────────── */

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === 'ios' ? 60 + insets.bottom : 68;
  const cardHeight = WINDOW_HEIGHT - tabBarHeight;

  const { markets, isLoading, error, refresh, activeVoiceRooms } = useMarkets();
  const { isAuthenticated } = useAuth();
  const voiceRoom = useVoiceRoomContextSafe();

  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Vote sheet state
  const sheetRef = useRef<GorhomBottomSheet>(null);
  const [voteDirection, setVoteDirection] = useState<VoteDirection | null>(null);
  const [voteMarket, setVoteMarket] = useState<Market | null>(null);

  // Sort: video markets first, then by original order
  const sortedMarkets = useMemo(() => {
    if (!markets.length) return markets;
    return [...markets].sort((a, b) => {
      const aHasVideo = a.pitchVideoUrl ? 1 : 0;
      const bHasVideo = b.pitchVideoUrl ? 1 : 0;
      return bHasVideo - aHasVideo;
    });
  }, [markets]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 1000);
  }, [refresh]);

  const handleVote = useCallback(
    (market: Market, direction: VoteDirection) => {
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setVoteMarket(market);
      setVoteDirection(direction);
      sheetRef.current?.snapToIndex(0);
    },
    [isAuthenticated],
  );

  const handleVoteConfirm = useCallback(
    (direction: VoteDirection, amount: number) => {
      // TODO: Wire useVoting hook
      console.log('Vote confirmed:', direction, amount, voteMarket?.id);
      sheetRef.current?.close();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [voteMarket],
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

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

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedMarkets}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => {
          const isVoiceActive = !!(
            (voiceRoom?.isConnected && voiceRoom.marketAddress === item.marketAddress) ||
            (activeVoiceRooms && activeVoiceRooms.get(item.marketAddress))
          );
          return item.pitchVideoUrl ? (
            <PitchVideoCard
              market={item}
              height={cardHeight}
              isActive={index === activeIndex}
              voiceActive={isVoiceActive}
              onVoteYes={() => handleVote(item, 'yes')}
              onVoteNo={() => handleVote(item, 'no')}
              onPress={() => router.push(`/market/${item.id}`)}
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
              <View style={styles.voiceOverlay}>
                <VoiceLiveIndicator
                  active={isVoiceActive}
                  onPress={() => router.push(`/market/${item.id}`)}
                />
              </View>
            </View>
          );
        }}
        pagingEnabled
        snapToInterval={cardHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            progressViewOffset={insets.top}
          />
        }
        getItemLayout={(_, index) => ({
          length: cardHeight,
          offset: cardHeight * index,
          index,
        })}
      />

      {/* Position dots */}
      {sortedMarkets.length > 1 && (
        <View style={[styles.dots, { top: insets.top + 60 }]}>
          {sortedMarkets.slice(0, 10).map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}

      {/* Vote bottom sheet */}
      <VoteBottomSheet
        ref={sheetRef}
        direction={voteDirection}
        marketTitle={voteMarket?.name ?? ''}
        onConfirm={handleVoteConfirm}
        onClose={() => {
          setVoteDirection(null);
          setVoteMarket(null);
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
  dots: {
    position: 'absolute',
    right: 12,
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  /* ── PitchVideoCard styles ── */
  videoCard: {
    width: WINDOW_WIDTH,
    backgroundColor: '#000',
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
    bottom: 180,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(139,92,246,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  voiceIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
  voiceOverlay: {
    position: 'absolute',
    right: 20,
    bottom: 230,
  },
});
