/**
 * VoiceRoomBrowser — TikTok-style vertical swiper for discovering voice rooms.
 * Shows ALL markets (not just active ones) with smart sorting:
 *   1. Currently connected room (pinned at top)
 *   2. Active rooms sorted by participant count
 *   3. All other markets (empty rooms you can start)
 *
 * Empty rooms: "Start a room" → auto-join as speaker
 * Active rooms: "Start listening" → join muted as listener
 */

import { useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ViewToken,
} from 'react-native';
import { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCommunitySheet } from '../../providers/CommunitySheetProvider';
import { useVoiceRoomContextSafe } from '../../providers/VoiceRoomProvider';
import { PressableScale } from '../PressableScale';
import { ListenerStars } from './ListenerStars';
import { colors, spacing } from '../../theme';
import type { Market } from '@pnl/shared/hooks';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ITEM_HEIGHT = SCREEN_HEIGHT * 0.85;

interface BrowsableRoom {
  marketId: string;
  marketAddress: string;
  marketName: string;
  marketDescription?: string | null;
  founderWallet?: string | null;
  participantCount: number;
  isActive: boolean;
  isConnected: boolean;
}

interface VoiceRoomBrowserProps {
  /** All markets from the feed */
  markets: Market[];
  /** Map of marketAddress → participant count for active voice rooms */
  activeVoiceRooms?: Map<string, number>;
  onCollapse: () => void;
}

/* ─── Active Room Card ──────────────────────────────────────────── */
function ActiveRoomCard({
  room,
  onJoin,
}: {
  room: BrowsableRoom;
  onJoin: (room: BrowsableRoom) => void;
}) {
  return (
    <View style={[styles.card, { height: ITEM_HEIGHT }]}>
      {/* Background stars */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ListenerStars listenerCount={room.participantCount} />
      </View>

      <View style={styles.cardContent}>
        {/* LIVE badge */}
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
          <Text style={styles.liveCount}>{room.participantCount}</Text>
        </View>

        <Text style={styles.roomTitle} numberOfLines={3}>
          {room.marketName}
        </Text>

        {room.marketDescription ? (
          <Text style={styles.roomDesc} numberOfLines={2}>
            {room.marketDescription}
          </Text>
        ) : null}

        <View style={styles.listenerRow}>
          <Ionicons name="headset-outline" size={14} color={colors.textMuted} />
          <Text style={styles.listenerText}>
            {room.participantCount} {room.participantCount === 1 ? 'person' : 'people'} listening
          </Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        {room.isConnected ? (
          <View style={styles.connectedBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#4ade80" />
            <Text style={styles.connectedText}>Currently connected</Text>
          </View>
        ) : (
          <PressableScale onPress={() => onJoin(room)} style={styles.joinBtnWrap}>
            <LinearGradient
              colors={['#6366f1', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.joinBtn}
            >
              <Ionicons name="headset" size={18} color="#fff" />
              <Text style={styles.joinBtnText}>Start listening</Text>
            </LinearGradient>
          </PressableScale>
        )}

        <View style={styles.swipeHint}>
          <Ionicons name="chevron-up" size={14} color={colors.textMuted} />
          <Text style={styles.swipeHintText}>Swipe for more rooms</Text>
        </View>
      </View>
    </View>
  );
}

/* ─── Empty Room Card ───────────────────────────────────────────── */
function EmptyRoomCard({
  room,
  onStart,
}: {
  room: BrowsableRoom;
  onStart: (room: BrowsableRoom) => void;
}) {
  return (
    <View style={[styles.card, { height: ITEM_HEIGHT }]}>
      {/* Subtle ambient stars for empty rooms */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ListenerStars listenerCount={3} />
      </View>

      <View style={styles.cardContent}>
        {/* Empty badge */}
        <View style={styles.emptyBadge}>
          <Ionicons name="radio-outline" size={14} color={colors.textMuted} />
          <Text style={styles.emptyBadgeText}>No one here yet</Text>
        </View>

        <Text style={styles.roomTitle} numberOfLines={3}>
          {room.marketName}
        </Text>

        {room.marketDescription ? (
          <Text style={styles.roomDesc} numberOfLines={2}>
            {room.marketDescription}
          </Text>
        ) : null}

        <Text style={styles.startHint}>
          Be the first to start a conversation
        </Text>
      </View>

      <View style={styles.cardBottom}>
        <PressableScale onPress={() => onStart(room)} style={styles.joinBtnWrap}>
          <LinearGradient
            colors={['#4ade80', '#22c55e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.joinBtn}
          >
            <Ionicons name="mic" size={18} color="#fff" />
            <Text style={styles.joinBtnText}>Start a room</Text>
          </LinearGradient>
        </PressableScale>

        <View style={styles.swipeHint}>
          <Ionicons name="chevron-up" size={14} color={colors.textMuted} />
          <Text style={styles.swipeHintText}>Swipe for more rooms</Text>
        </View>
      </View>
    </View>
  );
}

/* ─── Browser ───────────────────────────────────────────────────── */
export function VoiceRoomBrowser({ markets, activeVoiceRooms, onCollapse }: VoiceRoomBrowserProps) {
  const communitySheet = useCommunitySheet();
  const voice = useVoiceRoomContextSafe();
  const lastAutoJoinedRef = useRef<string | null>(null);

  // Build sorted room list: connected → active → empty
  const rooms = useMemo(() => {
    const connectedAddr = voice?.isConnected ? voice.marketAddress : null;

    const browsable: BrowsableRoom[] = markets.map((m) => {
      const count = activeVoiceRooms?.get(m.marketAddress) ?? 0;
      return {
        marketId: m.id,
        marketAddress: m.marketAddress,
        marketName: m.name,
        marketDescription: m.description ?? null,
        founderWallet: (m as any).founderWallet ?? null,
        participantCount: count,
        isActive: count > 0,
        isConnected: m.marketAddress === connectedAddr,
      };
    });

    return browsable.sort((a, b) => {
      // Connected room always first
      if (a.isConnected && !b.isConnected) return -1;
      if (!a.isConnected && b.isConnected) return 1;
      // Active rooms next, sorted by participant count
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      if (a.isActive && b.isActive) return b.participantCount - a.participantCount;
      // Empty rooms last (keep original order / trending)
      return 0;
    });
  }, [markets, activeVoiceRooms, voice?.isConnected, voice?.marketAddress]);

  // Join active room as listener
  const handleJoinActive = useCallback(
    (room: BrowsableRoom) => {
      communitySheet.open(
        {
          marketId: room.marketId,
          marketAddress: room.marketAddress,
          marketName: room.marketName,
          marketDescription: room.marketDescription,
          founderWallet: room.founderWallet ?? null,
        },
        'Voice',
      );
      onCollapse();
    },
    [communitySheet, onCollapse],
  );

  // Start empty room as speaker (auto-join)
  const handleStartRoom = useCallback(
    (room: BrowsableRoom) => {
      lastAutoJoinedRef.current = room.marketAddress;
      communitySheet.open(
        {
          marketId: room.marketId,
          marketAddress: room.marketAddress,
          marketName: room.marketName,
          marketDescription: room.marketDescription,
          founderWallet: room.founderWallet ?? null,
        },
        'Voice',
        true, // autoJoinAsSpeaker
      );
      onCollapse();
    },
    [communitySheet, onCollapse],
  );

  // Auto-join when swiping to an empty room
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) return;
      const visible = viewableItems[0].item as BrowsableRoom;
      // Skip if it's the connected room, an active room, or already auto-joined this one
      if (visible.isConnected || visible.isActive) return;
      if (lastAutoJoinedRef.current === visible.marketAddress) return;
      // Auto-join empty room as speaker
      lastAutoJoinedRef.current = visible.marketAddress;
      communitySheet.open(
        {
          marketId: visible.marketId,
          marketAddress: visible.marketAddress,
          marketName: visible.marketName,
          marketDescription: visible.marketDescription,
          founderWallet: visible.founderWallet ?? null,
        },
        'Voice',
        true,
      );
      onCollapse();
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  if (rooms.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons name="radio-outline" size={40} color={colors.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>No markets yet</Text>
        <Text style={styles.emptyText}>
          Markets will appear here as voice rooms you can start or join
        </Text>
      </View>
    );
  }

  return (
    <BottomSheetFlatList
      data={rooms}
      keyExtractor={(item: BrowsableRoom) => item.marketAddress}
      renderItem={({ item }: { item: BrowsableRoom }) =>
        item.isActive || item.isConnected ? (
          <ActiveRoomCard room={item} onJoin={handleJoinActive} />
        ) : (
          <EmptyRoomCard room={item} onStart={handleStartRoom} />
        )
      }
      pagingEnabled
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      getItemLayout={(_: any, index: number) => ({
        length: ITEM_HEIGHT,
        offset: ITEM_HEIGHT * index,
        index,
      })}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
    />
  );
}

const styles = StyleSheet.create({
  // ─── Card ───
  card: {
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    gap: 12,
  },

  // ─── LIVE badge ───
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(74,222,128,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  liveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4ade80',
    letterSpacing: 1,
  },
  liveCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4ade80',
  },

  // ─── Empty badge ───
  emptyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },

  // ─── Text ───
  roomTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 34,
  },
  roomDesc: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  listenerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listenerText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  startHint: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  // ─── Connected badge ───
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)',
    backgroundColor: 'rgba(74,222,128,0.08)',
  },
  connectedText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#4ade80',
  },

  // ─── Bottom actions ───
  cardBottom: {
    gap: 12,
    alignItems: 'center',
  },
  joinBtnWrap: {
    width: '100%',
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 24,
  },
  joinBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  swipeHintText: {
    fontSize: 12,
    color: colors.textMuted,
  },

  // ─── Empty state ───
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
