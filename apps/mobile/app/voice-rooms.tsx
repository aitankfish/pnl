/**
 * Voice Slide Room — Full-screen TikTok-style voice room browser.
 *
 * - Each card shows a preview with a single "Join" button
 * - Active room (has speakers): joins as listener
 * - Empty room (no speakers): joins as speaker (muted)
 * - After joining, card transforms to ConnectedRoomCard with controls
 * - Swiping away from connected room shows floating pill
 */

import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  ViewToken,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useMarkets } from '@pnl/shared/hooks';
import type { Market } from '@pnl/shared/hooks';
import { useAuth } from '../src/providers/AuthProvider';
import {
  useVoiceRoomContext,
  useVoiceRoomContextSafe,
  REACTION_EMOJIS,
} from '../src/providers/VoiceRoomProvider';
import type { VoiceParticipant } from '../src/providers/VoiceRoomProvider';
import { PressableScale } from '../src/components/PressableScale';
import { VoiceSpeakersGrid } from '../src/components/community/VoiceSpeakersGrid';
import { ListenerStars } from '../src/components/community/ListenerStars';
import { FloatingReaction } from '../src/components/community/FloatingReaction';
import { useProfile, resolveAvatarUrl } from '../src/hooks/useProfile';
import { colors, spacing } from '../src/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

/* ═══════════════════════════════════════════════════════════════════
 *  CONNECTED ROOM CARD — Inline voice room with speakers + controls
 * ═══════════════════════════════════════════════════════════════════ */
function ConnectedRoomCard({ room, cardHeight }: { room: BrowsableRoom; cardHeight: number }) {
  const voice = useVoiceRoomContext();
  const { walletAddress } = useAuth();
  const { profile } = useProfile(walletAddress ?? null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const allParticipants = useMemo(() => {
    if (!voice.isConnected || !voice.walletAddress) return voice.participants;

    const selfPhoto = profile?.profilePhotoUrl
      ? resolveAvatarUrl(profile.profilePhotoUrl)
      : undefined;

    const selfParticipant: VoiceParticipant = {
      peerId: voice.walletAddress,
      displayName: profile?.username || 'You',
      profilePhotoUrl: selfPhoto,
      isMuted: voice.isMuted,
      isSpeaking: voice.isSpeaking,
      hasRaisedHand: voice.hasRaisedHand,
      isSpeaker: voice.isSpeaker,
    };

    return [selfParticipant, ...voice.participants];
  }, [
    voice.isConnected, voice.walletAddress, voice.isMuted,
    voice.isSpeaking, voice.hasRaisedHand, voice.isSpeaker,
    voice.participants, profile,
  ]);

  const listenerCount = allParticipants.filter((p) => !p.isSpeaker).length;

  return (
    <View style={[styles.card, { height: cardHeight }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ListenerStars listenerCount={listenerCount} />
      </View>

      {/* Header */}
      <View style={styles.connectedHeader}>
        <View style={styles.connectedHeaderLeft}>
          <View style={styles.liveBadgeSmall}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <Text style={styles.connectedRoomName} numberOfLines={1}>
            {room.marketName}
          </Text>
        </View>
        <PressableScale
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            voice.leave();
          }}
          style={styles.leaveBtn}
        >
          <Text style={styles.leaveBtnText}>Leave</Text>
        </PressableScale>
      </View>

      {voice.isReconnecting && (
        <View style={styles.reconnectBanner}>
          <ActivityIndicator size="small" color={colors.warning} />
          <Text style={styles.reconnectText}>
            Reconnecting... (attempt {voice.reconnectAttempts})
          </Text>
        </View>
      )}

      {/* Speakers grid */}
      <ScrollView style={styles.speakersScroll} contentContainerStyle={styles.speakersScrollInner}>
        <VoiceSpeakersGrid
          participants={allParticipants}
          founderWallet={voice.founderWallet}
          coHosts={voice.coHosts}
          isCurrentUserHost={voice.isHost}
          isCurrentUserFounder={voice.isFounder}
          onMute={voice.muteUser}
          onKick={voice.kickUser}
          onApproveHand={voice.approveHand}
          onPromote={voice.promoteToSpeaker}
          onDemote={voice.demoteToListener}
          onAddCoHost={voice.addCoHost}
          onRemoveCoHost={voice.removeCoHost}
        />
      </ScrollView>

      {/* Floating reactions */}
      <View style={styles.reactionsOverlay} pointerEvents="none">
        {voice.reactions.map((r) => (
          <FloatingReaction key={r.id} emoji={r.emoji} onFinish={() => {}} />
        ))}
      </View>

      {showReactionPicker && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setShowReactionPicker(false)}
        />
      )}

      {/* Bottom toolbar */}
      <View style={styles.bottomToolbar}>
        {voice.isSpeaker ? (
          <PressableScale onPress={voice.toggleMute} style={styles.micBtnWrap}>
            <View style={[styles.micBtn, voice.isMuted && styles.micBtnMuted]}>
              <Ionicons
                name={voice.isMuted ? 'mic-off' : 'mic'}
                size={24}
                color={voice.isMuted ? '#ef4444' : colors.textPrimary}
              />
            </View>
            <Text style={[styles.micBtnLabel, voice.isMuted && { color: '#ef4444' }]}>
              {voice.isMuted ? 'Unmute' : 'Mute'}
            </Text>
          </PressableScale>
        ) : (
          <PressableScale onPress={voice.toggleHand} style={styles.micBtnWrap}>
            <View style={[styles.micBtn, voice.hasRaisedHand && styles.micBtnRaised]}>
              <Ionicons name="mic" size={24} color={colors.textMuted} />
            </View>
            <Text style={styles.micBtnLabel}>
              {voice.hasRaisedHand ? 'Requested' : 'Request'}
            </Text>
          </PressableScale>
        )}

        <View style={styles.toolbarCenter}>
          {voice.isHost && (
            <PressableScale onPress={voice.muteAll} style={styles.toolbarIcon}>
              <Ionicons name="volume-mute-outline" size={22} color={colors.textSecondary} />
            </PressableScale>
          )}
          <View>
            <PressableScale
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowReactionPicker((prev) => !prev);
              }}
              style={styles.toolbarIcon}
            >
              <Ionicons name="happy-outline" size={24} color={colors.textSecondary} />
            </PressableScale>

            {showReactionPicker && (
              <View style={styles.reactionPopup}>
                {REACTION_EMOJIS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      voice.sendReaction(emoji);
                      setShowReactionPicker(false);
                    }}
                    style={({ pressed }) => [
                      styles.reactionPopupBtn,
                      pressed && styles.reactionPopupBtnPressed,
                    ]}
                  >
                    <Text style={styles.reactionPopupEmoji}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.swipeHint}>
          <Ionicons name="chevron-up" size={14} color={colors.textMuted} />
        </View>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  PREVIEW CARD — Single "Join" button for both active & empty rooms
 * ═══════════════════════════════════════════════════════════════════ */
function PreviewCard({
  room,
  cardHeight,
  onJoin,
}: {
  room: BrowsableRoom;
  cardHeight: number;
  onJoin: (room: BrowsableRoom) => void;
}) {
  return (
    <View style={[styles.card, { height: cardHeight }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ListenerStars listenerCount={room.isActive ? room.participantCount : 3} />
      </View>

      <View style={styles.cardContent}>
        {room.isActive ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
            <Text style={styles.liveCount}>{room.participantCount}</Text>
          </View>
        ) : (
          <View style={styles.emptyBadge}>
            <Ionicons name="radio-outline" size={14} color={colors.textMuted} />
            <Text style={styles.emptyBadgeText}>No one here yet</Text>
          </View>
        )}

        <Text style={styles.roomTitle} numberOfLines={3}>{room.marketName}</Text>

        {room.marketDescription ? (
          <Text style={styles.roomDesc} numberOfLines={2}>{room.marketDescription}</Text>
        ) : null}

        {room.isActive ? (
          <View style={styles.listenerRow}>
            <Ionicons name="headset-outline" size={14} color={colors.textMuted} />
            <Text style={styles.listenerText}>
              {room.participantCount} {room.participantCount === 1 ? 'person' : 'people'} listening
            </Text>
          </View>
        ) : (
          <Text style={styles.startHint}>Be the first to start a conversation</Text>
        )}
      </View>

      <View style={styles.cardBottom}>
        <PressableScale onPress={() => onJoin(room)} style={styles.joinBtnWrap}>
          <LinearGradient
            colors={room.isActive ? ['#6366f1', '#8b5cf6'] : ['#4ade80', '#22c55e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.joinBtn}
          >
            <Ionicons name={room.isActive ? 'headset' : 'mic'} size={18} color="#fff" />
            <Text style={styles.joinBtnText}>Join</Text>
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

/* ═══════════════════════════════════════════════════════════════════
 *  VOICE SLIDE ROOM SCREEN
 * ═══════════════════════════════════════════════════════════════════ */
export default function VoiceRoomsScreen() {
  const insets = useSafeAreaInsets();
  const { walletAddress } = useAuth();
  const voice = useVoiceRoomContextSafe();
  const { markets, activeVoiceRooms } = useMarkets();
  const flatListRef = useRef<FlatList>(null);

  const lastAutoJoinedRef = useRef<string | null>(null);
  // Whether user has joined at least once (enables auto-switch on swipe)
  const hasJoinedOnceRef = useRef(false);

  const CARD_HEIGHT = SCREEN_HEIGHT - insets.top - insets.bottom;
  const ITEM_HEIGHT = CARD_HEIGHT - 48;

  // Build room list — sort once on mount, keep order stable while browsing
  const sortedOrderRef = useRef<string[] | null>(null);

  const rooms = useMemo(() => {
    if (!markets?.length) return [];
    const connectedAddr = voice?.isConnected ? voice.marketAddress : null;

    const browsable: BrowsableRoom[] = markets.map((m: Market) => {
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

    // Sort only on first render, then keep that order stable
    if (!sortedOrderRef.current) {
      browsable.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        if (a.isActive && b.isActive) return b.participantCount - a.participantCount;
        return 0;
      });
      sortedOrderRef.current = browsable.map((r) => r.marketAddress);
    }

    // Re-order by frozen sort, update dynamic fields (isConnected, participantCount, isActive)
    const order = sortedOrderRef.current;
    const byAddress = new Map(browsable.map((r) => [r.marketAddress, r]));
    return order
      .map((addr) => byAddress.get(addr))
      .filter((r): r is BrowsableRoom => !!r);
  }, [markets, activeVoiceRooms, voice?.isConnected, voice?.marketAddress]);

  // ─── Join helper ───
  const joinRoom = useCallback(
    (room: BrowsableRoom) => {
      if (!walletAddress || !voice) return;

      // Already connected to this room — do nothing
      if (voice.isConnected && voice.marketAddress === room.marketAddress) return;

      // Connected to a different room — fast switch (keeps socket alive)
      if (voice.isConnected && voice.marketAddress !== room.marketAddress && !voice.isSwitchingRoom) {
        hasJoinedOnceRef.current = true;
        voice.switchRoom(room.marketId, room.marketAddress, room.marketName, room.founderWallet ?? null);
        return;
      }

      // Not connected — normal join
      lastAutoJoinedRef.current = room.isActive ? null : room.marketAddress;
      hasJoinedOnceRef.current = true;
      voice.join(room.marketId, room.marketAddress, room.marketName, walletAddress, room.founderWallet ?? null);
    },
    [walletAddress, voice],
  );

  // Keep a ref to joinRoom so the viewability callback can access the latest version
  const joinRoomRef = useRef(joinRoom);
  joinRoomRef.current = joinRoom;

  // Auto-pick speaker for empty rooms, listener for active rooms
  useEffect(() => {
    if (!voice?.showJoinChoice) return;
    if (lastAutoJoinedRef.current) {
      voice.joinAsSpeaker();
      lastAutoJoinedRef.current = null;
    } else {
      voice.joinAsListener();
    }
  }, [voice?.showJoinChoice]);

  // Keep voice state in refs so the viewability callback can read them
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  // Track visible card + auto-switch rooms on swipe
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) return;
      const item = viewableItems[0].item as BrowsableRoom;

      // Auto-switch: if user already joined once and is connected to a different room, fast-switch
      const v = voiceRef.current;
      if (
        hasJoinedOnceRef.current &&
        v?.isConnected &&
        v.marketAddress !== item.marketAddress &&
        !v.isConnecting &&
        !v.isSwitchingRoom
      ) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        joinRoomRef.current(item);
      }
    },
  ).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  // Mark as joined if already connected when screen opens
  useEffect(() => {
    if (voice?.isConnected) {
      hasJoinedOnceRef.current = true;
    }
  }, [voice?.isConnected]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </PressableScale>

        <Text style={styles.headerTitle}>Voice Rooms</Text>

        {/* Spacer to keep title centered */}
        <View style={styles.headerBtn} />
      </View>

      {/* Room cards */}
      {rooms.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="radio-outline" size={40} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No markets yet</Text>
          <Text style={styles.emptyText}>
            Markets will appear here as voice rooms you can start or join
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={rooms}
          keyExtractor={(item) => item.marketAddress}
          renderItem={({ item }) => {
            const isThisRoomActive = item.isConnected && voice?.isConnected;
            if (isThisRoomActive) {
              return <ConnectedRoomCard room={item} cardHeight={ITEM_HEIGHT} />;
            }
            return <PreviewCard room={item} cardHeight={ITEM_HEIGHT} onJoin={joinRoom} />;
          }}
          pagingEnabled
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />
      )}

      {/* Subtle connecting indicator (not full-screen blocking) */}
      {(voice?.isConnecting || voice?.isSwitchingRoom) && (
        <View style={styles.connectingPill}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.connectingPillText}>
            {voice?.isSwitchingRoom ? 'Switching...' : 'Connecting...'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    height: 48,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // ─── Card (shared) ───
  card: {
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
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
  liveBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(74,222,128,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
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

  // ─── Bottom actions (pre-join) ───
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

  // ─── Connected card ───
  connectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  connectedHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  connectedRoomName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  leaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  leaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
  },
  reconnectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 6,
  },
  reconnectText: {
    fontSize: 11,
    color: colors.warning,
  },
  speakersScroll: {
    flex: 1,
  },
  speakersScrollInner: {
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  reactionsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    pointerEvents: 'none',
  },

  // ─── Bottom toolbar (connected) ───
  bottomToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  micBtnWrap: {
    alignItems: 'center',
    gap: 3,
  },
  micBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnMuted: {
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  micBtnRaised: {
    borderColor: 'rgba(245,158,11,0.4)',
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  micBtnLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  toolbarCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  toolbarIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionPopup: {
    position: 'absolute',
    bottom: 48,
    left: '50%',
    transform: [{ translateX: -90 }],
    width: 180,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(20,26,46,0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  reactionPopupBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionPopupBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    transform: [{ scale: 1.2 }],
  },
  reactionPopupEmoji: {
    fontSize: 26,
  },

  // ─── Connecting pill (subtle, non-blocking) ───
  connectingPill: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(20,26,46,0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  connectingPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
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
