/**
 * Voice Rooms — Full-screen horizontal swipeable voice room browser.
 *
 * Pitch-deck style: large speaker circles, listener dots, YES/NO vote buttons.
 * Swipe left/right to browse rooms. Auto-switches on settle (500ms debounce).
 */

import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GorhomBottomSheet from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useMarkets } from '@pnl/shared/hooks';
import type { Market } from '@pnl/shared/hooks';
import { useAuth } from '../src/providers/AuthProvider';
import {
  useVoiceRoomContext,
  useVoiceRoomContextSafe,
} from '../src/providers/VoiceRoomProvider';
import type { VoiceParticipant } from '../src/providers/VoiceRoomProvider';
import { useVote } from '../src/hooks/useVote';
import { PressableScale } from '../src/components/PressableScale';
import { VoteBottomSheet } from '../src/components/VoteBottomSheet';
import { VoteToast } from '../src/components/VoteToast';
import type { VoteToastState } from '../src/components/VoteToast';
import { VoiceSpeakerCircle } from '../src/components/community/VoiceSpeakerCircle';
import { VoiceListenerDots } from '../src/components/community/VoiceListenerDots';
import { VoiceReactionBar } from '../src/components/community/VoiceReactionBar';
import { VoiceRoomVoteButtons } from '../src/components/community/VoiceRoomVoteButtons';
import { ListenerStars } from '../src/components/community/ListenerStars';
import { FloatingReaction } from '../src/components/community/FloatingReaction';
import { VoiceSettingsContent } from '../src/components/community/VoiceSettingsSheet';
import { BottomSheet } from '../src/components/BottomSheet';
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
 *  CONNECTED ROOM CARD — Pitch-deck style with circles + vote buttons
 * ═══════════════════════════════════════════════════════════════════ */
function ConnectedRoomCard({
  room,
  cardHeight,
  onVoteYes,
  onVoteNo,
  isVoting,
  voteDirection,
  onSettings,
}: {
  room: BrowsableRoom;
  cardHeight: number;
  onVoteYes: () => void;
  onVoteNo: () => void;
  isVoting: boolean;
  voteDirection: 'yes' | 'no' | null;
  onSettings: () => void;
}) {
  const voice = useVoiceRoomContext();
  const { walletAddress } = useAuth();
  const { profile } = useProfile(walletAddress ?? null);

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

  const speakers = allParticipants.filter((p) => p.isSpeaker);
  const totalCount = allParticipants.length;

  return (
    <View style={[styles.card, { height: cardHeight }]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ListenerStars listenerCount={totalCount} />
      </View>

      {/* Header — room name + LIVE + settings */}
      <View style={styles.connectedHeader}>
        <View style={styles.headerInfo}>
          <View style={styles.liveChip}>
            <View style={styles.liveDot} />
            <Text style={styles.liveChipText}>LIVE</Text>
            <Text style={styles.liveChipCount}>· {totalCount}</Text>
          </View>
          <Text style={styles.connectedRoomName} numberOfLines={1}>
            {room.marketName}
          </Text>
        </View>
        <PressableScale onPress={onSettings} style={styles.settingsBtn}>
          <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
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

      {/* Main content — centered vertically */}
      <View style={styles.mainContent}>
        <ScrollView
          style={styles.speakersScroll}
          contentContainerStyle={styles.speakersScrollInner}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.speakersGrid}>
            {speakers.map((p, i) => (
              <VoiceSpeakerCircle
                key={p.peerId}
                participant={p}
                index={i}
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
            ))}
          </View>

          {/* Listeners — dots */}
          <VoiceListenerDots participants={allParticipants} />
        </ScrollView>

        {/* Floating reactions */}
        <View style={styles.reactionsOverlay} pointerEvents="none">
          {voice.reactions.map((r) => (
            <FloatingReaction key={r.id} emoji={r.emoji} onFinish={() => {}} />
          ))}
        </View>
      </View>

      {/* Bottom section — reactions + vote + controls */}
      <View style={styles.bottomSection}>
        <VoiceReactionBar onReaction={voice.sendReaction} />

        <VoiceRoomVoteButtons
          onVoteYes={onVoteYes}
          onVoteNo={onVoteNo}
          isVoting={isVoting}
          votingDirection={voteDirection}
        />

        <View style={styles.bottomToolbar}>
        {voice.isSpeaker ? (
          <PressableScale onPress={voice.toggleMute} style={styles.controlItem}>
            <View style={[styles.controlCircle, voice.isMuted && styles.controlCircleMuted]}>
              <Ionicons
                name={voice.isMuted ? 'mic-off' : 'mic'}
                size={22}
                color={voice.isMuted ? '#ef4444' : colors.textPrimary}
              />
            </View>
            <Text style={[styles.controlLabel, voice.isMuted && { color: '#ef4444' }]}>
              {voice.isMuted ? 'Unmute' : 'Mute'}
            </Text>
          </PressableScale>
        ) : (
          <PressableScale onPress={voice.toggleHand} style={styles.controlItem}>
            <View style={[styles.controlCircle, voice.hasRaisedHand && styles.controlCircleHand]}>
              <Text style={{ fontSize: 20 }}>✋</Text>
            </View>
            <Text style={[styles.controlLabel, voice.hasRaisedHand && { color: colors.warning }]}>
              {voice.hasRaisedHand ? 'Lower' : 'Raise'}
            </Text>
          </PressableScale>
        )}

        {voice.isHost && (
          <PressableScale onPress={voice.muteAll} style={styles.controlItem}>
            <View style={styles.controlCircle}>
              <Ionicons name="volume-mute-outline" size={20} color={colors.textSecondary} />
            </View>
            <Text style={styles.controlLabel}>Mute All</Text>
          </PressableScale>
        )}

        <View style={styles.swipeHintRow}>
          <Ionicons name="swap-vertical" size={14} color={colors.textMuted} />
          <Text style={styles.swipeHintText}>Swipe</Text>
        </View>
      </View>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  PREVIEW CARD — "Join" button for rooms user isn't in
 * ═══════════════════════════════════════════════════════════════════ */
function PreviewCard({
  room,
  cardHeight,
  onJoin,
  onVoteYes,
  onVoteNo,
  isVoting,
  voteDirection,
}: {
  room: BrowsableRoom;
  cardHeight: number;
  onJoin: (room: BrowsableRoom) => void;
  onVoteYes: () => void;
  onVoteNo: () => void;
  isVoting: boolean;
  voteDirection: 'yes' | 'no' | null;
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

        {/* Vote buttons available even before joining */}
        <VoiceRoomVoteButtons
          onVoteYes={onVoteYes}
          onVoteNo={onVoteNo}
          isVoting={isVoting}
          votingDirection={voteDirection}
        />

        <View style={styles.swipeHintRow}>
          <Ionicons name="swap-vertical" size={14} color={colors.textMuted} />
          <Text style={styles.swipeHintText}>Swipe for more rooms</Text>
        </View>
      </View>
    </View>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  VOICE ROOMS SCREEN — Horizontal swipeable pager
 * ═══════════════════════════════════════════════════════════════════ */
export default function VoiceRoomsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ marketAddress?: string }>();
  const { walletAddress } = useAuth();
  const voice = useVoiceRoomContextSafe();
  const { markets, activeVoiceRooms } = useMarkets();
  const flatListRef = useRef<FlatList>(null);
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentIndexRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  const lastAutoJoinedRef = useRef<string | null>(null);
  const hasJoinedOnceRef = useRef(false);

  const CARD_HEIGHT = SCREEN_HEIGHT - insets.top - insets.bottom;

  // Vote state
  const voteSheetRef = useRef<GorhomBottomSheet>(null);
  const [voteDirection, setVoteDirection] = useState<'yes' | 'no' | null>(null);
  const [voteToastState, setVoteToastState] = useState<VoteToastState>({
    visible: false,
    stage: 'signing',
  });

  const { submitVote, isVoting } = useVote({
    onStageChange: (stage, direction, amount, marketName, message) => {
      setVoteToastState({ visible: true, stage, direction, amount, marketName, message });
    },
    onSuccess: () => {
      voteSheetRef.current?.close();
    },
  });

  // Build room list — stable order (no re-sorting on connect/switch)
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

    // Sort only once on first render, then keep order stable
    if (!sortedOrderRef.current) {
      browsable.sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        if (a.isActive && b.isActive) return b.participantCount - a.participantCount;
        return 0;
      });
      sortedOrderRef.current = browsable.map((r) => r.marketAddress);
    }

    // Maintain frozen order, update dynamic fields
    const byAddress = new Map(browsable.map((r) => [r.marketAddress, r]));
    return sortedOrderRef.current
      .map((addr) => byAddress.get(addr))
      .filter((r): r is BrowsableRoom => !!r);
  }, [markets, activeVoiceRooms, voice?.isConnected, voice?.marketAddress]);

  // Scroll to initial market on mount
  useEffect(() => {
    if (!params.marketAddress || rooms.length === 0) return;
    const idx = rooms.findIndex((r) => r.marketAddress === params.marketAddress);
    if (idx > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: idx, animated: false });
        currentIndexRef.current = idx;
        setCurrentIndex(idx);
      }, 100);
    }
  }, [params.marketAddress, rooms.length]);

  // ─── Join helper ───
  const joinRoom = useCallback(
    (room: BrowsableRoom) => {
      if (!walletAddress || !voice) return;
      if (voice.isConnected && voice.marketAddress === room.marketAddress) return;

      if (voice.isConnected && voice.marketAddress !== room.marketAddress && !voice.isSwitchingRoom) {
        hasJoinedOnceRef.current = true;
        voice.switchRoom(room.marketId, room.marketAddress, room.marketName, room.founderWallet ?? null);
        return;
      }

      lastAutoJoinedRef.current = room.isActive ? null : room.marketAddress;
      hasJoinedOnceRef.current = true;
      voice.join(room.marketId, room.marketAddress, room.marketName, walletAddress, room.founderWallet ?? null);
    },
    [walletAddress, voice],
  );

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

  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  // Debounced room switch on swipe settle
  const handleMomentumEnd = useCallback(() => {
    const room = rooms[currentIndexRef.current];
    if (!room) return;

    const v = voiceRef.current;
    if (!v || !hasJoinedOnceRef.current) return;
    if (!v.isConnected) return;
    if (v.marketAddress === room.marketAddress) return;
    if (v.isConnecting || v.isSwitchingRoom) return;

    if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    switchTimerRef.current = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      joinRoomRef.current(room);
    }, 500);
  }, [rooms]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: BrowsableRoom; index: number | null }> }) => {
      if (viewableItems.length === 0) return;
      const idx = viewableItems[0].index ?? 0;
      currentIndexRef.current = idx;
      setCurrentIndex(idx);
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  useEffect(() => {
    if (voice?.isConnected) hasJoinedOnceRef.current = true;
  }, [voice?.isConnected]);

  // Settings sheet
  const settingsSheetRef = useRef<GorhomBottomSheet>(null);
  const handleOpenSettings = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    settingsSheetRef.current?.snapToIndex(0);
  }, []);

  // Vote handlers
  const handleVoteYes = useCallback(() => {
    setVoteDirection('yes');
    voteSheetRef.current?.snapToIndex(0);
  }, []);

  const handleVoteNo = useCallback(() => {
    setVoteDirection('no');
    voteSheetRef.current?.snapToIndex(0);
  }, []);

  const handleVoteConfirm = useCallback(
    (direction: 'yes' | 'no', amount: number) => {
      const room = rooms[currentIndexRef.current];
      if (!room) return;
      submitVote(room.marketAddress, room.marketId, direction, amount, room.marketName);
    },
    [rooms, submitVote],
  );

  const currentRoom = rooms[currentIndex];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Minimal top bar — swipe down to go back, no back button needed */}

      {/* Room cards — HORIZONTAL swipe */}
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
              return (
                <ConnectedRoomCard
                  room={item}
                  cardHeight={CARD_HEIGHT}
                  onVoteYes={handleVoteYes}
                  onVoteNo={handleVoteNo}
                  isVoting={isVoting}
                  voteDirection={voteDirection}
                  onSettings={handleOpenSettings}
                />
              );
            }
            return (
              <PreviewCard
                room={item}
                cardHeight={CARD_HEIGHT}
                onJoin={joinRoom}
                onVoteYes={handleVoteYes}
                onVoteNo={handleVoteNo}
                isVoting={isVoting}
                voteDirection={voteDirection}
              />
            );
          }}
          pagingEnabled
          snapToInterval={CARD_HEIGHT}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          onMomentumScrollEnd={handleMomentumEnd}
          getItemLayout={(_, index) => ({
            length: CARD_HEIGHT,
            offset: CARD_HEIGHT * index,
            index,
          })}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
        />
      )}

      {/* Vertical dot indicators — right edge */}
      {rooms.length > 1 && (
        <View style={styles.dotsStrip}>
          {rooms.slice(0, 10).map((room, i) => {
            const isActive = i === currentIndex;
            const isConnected = voice?.isConnected && voice.marketAddress === room.marketAddress;
            return (
              <View
                key={room.marketAddress}
                style={[
                  styles.dot,
                  isActive && styles.dotActive,
                  isConnected && styles.dotConnected,
                ]}
              />
            );
          })}
          {rooms.length > 10 && <Text style={styles.dotMore}>+{rooms.length - 10}</Text>}
        </View>
      )}

      {/* Connecting pill */}
      {(voice?.isConnecting || voice?.isSwitchingRoom) && (
        <View style={styles.connectingPill}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.connectingPillText}>
            {voice?.isSwitchingRoom ? 'Switching...' : 'Connecting...'}
          </Text>
        </View>
      )}

      {/* Vote bottom sheet */}
      <VoteBottomSheet
        ref={voteSheetRef}
        direction={voteDirection}
        marketTitle={currentRoom?.marketName || ''}
        onConfirm={handleVoteConfirm}
        onClose={() => {
          setVoteDirection(null);
          voteSheetRef.current?.close();
        }}
      />

      {/* Vote toast */}
      <VoteToast
        state={voteToastState}
        onDismiss={() => setVoteToastState((prev) => ({ ...prev, visible: false }))}
      />

      {/* Settings sheet */}
      {voice?.isConnected && (
        <BottomSheet ref={settingsSheetRef} snapPoints={['45%']} onClose={() => {}}>
          <VoiceSettingsContent
            isMuted={voice.isMuted}
            isSpeaker={voice.isSpeaker}
            isHost={voice.isHost}
            participantCount={(voice.participants?.length || 0) + 1}
            roomName={voice.marketName || ''}
            onToggleMute={voice.toggleMute}
            onMuteAll={voice.muteAll}
            onLeave={voice.leave}
            onClose={() => settingsSheetRef.current?.close()}
          />
        </BottomSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  dotsStrip: {
    position: 'absolute',
    right: 8,
    top: '30%',
    alignItems: 'center',
    gap: 6,
    zIndex: 50,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    height: 18,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  dotConnected: {
    backgroundColor: '#4ade80',
  },
  dotMore: {
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 2,
  },

  // ─── Card (shared) ───
  card: {
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
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
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
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
    gap: 10,
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

  // ─── Connected card ───
  connectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectedRoomName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(74,222,128,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4ade80',
    letterSpacing: 0.5,
  },
  liveChipCount: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4ade80',
  },
  leaveBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
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
  mainContent: {
    flex: 1,
  },
  speakersScroll: {
    flex: 1,
  },
  speakersScrollInner: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  speakersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  reactionsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    pointerEvents: 'none',
  },

  // ─── Bottom section ───
  bottomSection: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },

  bottomToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  controlItem: {
    alignItems: 'center',
    gap: 3,
  },
  controlCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlCircleMuted: {
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  controlCircleHand: {
    borderColor: 'rgba(245,158,11,0.4)',
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  controlLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  swipeHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  swipeHintText: {
    fontSize: 11,
    color: colors.textMuted,
  },

  // ─── Connecting pill ───
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
