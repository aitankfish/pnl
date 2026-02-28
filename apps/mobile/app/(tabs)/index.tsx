/**
 * Feed Screen — TikTok-style swipeable market cards
 * Swipe up/down between full-screen market cards.
 * Markets with pitch videos play inline (muted autoplay, tap to unmute).
 * Vote YES/NO with bottom buttons, auth-gated.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
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
import { FeedCard, VoteBottomSheet, SkeletonCard, EmptyState } from '../../src/components';
import { colors, spacing } from '../../src/theme';

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get('window');

type VoteDirection = 'yes' | 'no';

/* ── Pitch Video Card ─────────────────────────────────────── */

interface PitchVideoCardProps {
  market: Market;
  height: number;
  isActive: boolean;
  onVoteYes: () => void;
  onVoteNo: () => void;
  onPress: () => void;
}

function PitchVideoCard({
  market,
  height,
  isActive,
  onVoteYes,
  onVoteNo,
  onPress,
}: PitchVideoCardProps) {
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

        <Text style={styles.marketTitle} numberOfLines={2}>
          {market.name}
        </Text>

        <Text style={styles.tokenSymbol}>${market.tokenSymbol}</Text>

        {market.description ? (
          <Text style={styles.marketDescription} numberOfLines={2}>
            {market.description}
          </Text>
        ) : null}

        {/* Vote buttons */}
        <View style={styles.voteRow}>
          <Pressable
            style={[styles.voteBtn, styles.voteBtnYes]}
            onPress={(e) => {
              e.stopPropagation?.();
              onVoteYes();
            }}
          >
            <Ionicons name="trending-up" size={18} color="#fff" />
            <Text style={styles.voteBtnText}>YES</Text>
          </Pressable>

          <Pressable
            style={[styles.voteBtn, styles.voteBtnNo]}
            onPress={(e) => {
              e.stopPropagation?.();
              onVoteNo();
            }}
          >
            <Ionicons name="trending-down" size={18} color="#fff" />
            <Text style={styles.voteBtnText}>NO</Text>
          </Pressable>

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

  const { markets, isLoading, error, refresh } = useMarkets();
  const { isAuthenticated } = useAuth();

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
        renderItem={({ item, index }) =>
          item.pitchVideoUrl ? (
            <PitchVideoCard
              market={item}
              height={cardHeight}
              isActive={index === activeIndex}
              onVoteYes={() => handleVote(item, 'yes')}
              onVoteNo={() => handleVote(item, 'no')}
              onPress={() => router.push(`/market/${item.id}`)}
            />
          ) : (
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
              }}
              height={cardHeight}
              onVoteYes={() => handleVote(item, 'yes')}
              onVoteNo={() => handleVote(item, 'no')}
              onPress={() => router.push(`/market/${item.id}`)}
            />
          )
        }
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
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
  },
  voteBtnYes: {
    backgroundColor: 'rgba(34,197,94,0.8)',
  },
  voteBtnNo: {
    backgroundColor: 'rgba(239,68,68,0.8)',
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
});
