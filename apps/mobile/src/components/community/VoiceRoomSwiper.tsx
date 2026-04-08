/**
 * VoiceRoomSwiper — Horizontal swipeable voice room experience.
 *
 * Each page is a full voice room for a market. Swipe left/right to browse.
 * When you settle on a page for 500ms, it triggers switchRoom.
 * Integrates YES/NO voting directly inside each room.
 */

import { useCallback, useRef, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GorhomBottomSheet from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useVoiceRoomContextSafe } from '../../providers/VoiceRoomProvider';
import type { VoiceParticipant } from '../../providers/VoiceRoomProvider';
import { MAX_SPEAKERS } from '../../providers/VoiceRoomProvider';
import { useAuth } from '../../providers/AuthProvider';
import { useVote } from '../../hooks/useVote';
import { PressableScale } from '../PressableScale';
import { VoteBottomSheet } from '../VoteBottomSheet';
import { VoteToast } from '../VoteToast';
import { VoiceSpeakerCircle } from './VoiceSpeakerCircle';
import { VoiceListenerDots } from './VoiceListenerDots';
import { VoiceReactionBar } from './VoiceReactionBar';
import { VoiceRoomVoteButtons } from './VoiceRoomVoteButtons';
import { VoiceControls } from './VoiceControls';
import { FloatingReaction } from './FloatingReaction';
import { ListenerStars } from './ListenerStars';
import { StarField } from '../StarField';
import { colors, spacing, typography, borderRadius } from '../../theme';
import type { Market } from '@pnl/shared/hooks';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PAGE_HEIGHT = SCREEN_HEIGHT * 0.85;

interface VoiceRoomSwiperProps {
  markets: Market[];
  activeVoiceRooms?: Map<string, number>;
  initialMarketAddress?: string | null;
  onClose?: () => void;
}

interface RoomPage {
  marketId: string;
  marketAddress: string;
  marketName: string;
  marketDescription?: string | null;
  founderWallet?: string | null;
  participantCount: number;
  isActive: boolean;
}

export function VoiceRoomSwiper({
  markets,
  activeVoiceRooms,
  initialMarketAddress,
  onClose,
}: VoiceRoomSwiperProps) {
  const voice = useVoiceRoomContextSafe();
  const { walletAddress } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentIndexRef = useRef(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Vote state
  const voteSheetRef = useRef<GorhomBottomSheet>(null);
  const [voteDirection, setVoteDirection] = useState<'yes' | 'no' | null>(null);
  const [voteToastState, setVoteToastState] = useState({
    visible: false,
    stage: 'signing' as 'signing' | 'confirming' | 'success' | 'error',
    direction: undefined as 'yes' | 'no' | undefined,
    amount: undefined as number | undefined,
    marketName: undefined as string | undefined,
    message: undefined as string | undefined,
  });

  const { submitVote, isVoting } = useVote({
    onStageChange: (stage, direction, amount, marketName, message) => {
      setVoteToastState({ visible: true, stage, direction, amount, marketName, message });
    },
    onSuccess: () => {
      voteSheetRef.current?.close();
    },
  });

  // Build sorted room list: connected → active → empty
  const rooms = useMemo(() => {
    const connectedAddr = voice?.isConnected ? voice.marketAddress : null;

    const pages: RoomPage[] = markets.map((m) => {
      const count = activeVoiceRooms?.get(m.marketAddress) ?? 0;
      return {
        marketId: m.id,
        marketAddress: m.marketAddress,
        marketName: m.name,
        marketDescription: m.description ?? null,
        founderWallet: (m as any).founderWallet ?? null,
        participantCount: count,
        isActive: count > 0,
      };
    });

    return pages.sort((a, b) => {
      // Connected room always first
      if (connectedAddr) {
        if (a.marketAddress === connectedAddr && b.marketAddress !== connectedAddr) return -1;
        if (a.marketAddress !== connectedAddr && b.marketAddress === connectedAddr) return 1;
      }
      // Active rooms next
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      if (a.isActive && b.isActive) return b.participantCount - a.participantCount;
      return 0;
    });
  }, [markets, activeVoiceRooms, voice?.isConnected, voice?.marketAddress]);

  // Scroll to initial market on mount
  useEffect(() => {
    if (!initialMarketAddress || rooms.length === 0) return;
    const idx = rooms.findIndex((r) => r.marketAddress === initialMarketAddress);
    if (idx > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: idx, animated: false });
        currentIndexRef.current = idx;
        setCurrentIndex(idx);
      }, 100);
    }
  }, [initialMarketAddress, rooms.length]);

  // Debounced room switch on swipe settle
  const handleSwipeSettle = useCallback(
    (room: RoomPage) => {
      if (!voice || !walletAddress) return;

      // Already in this room
      if (voice.isConnected && voice.marketAddress === room.marketAddress) return;

      if (switchTimerRef.current) clearTimeout(switchTimerRef.current);

      switchTimerRef.current = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (voice.isConnected) {
          // Switch from current room to this one
          voice.switchRoom(
            room.marketId,
            room.marketAddress,
            room.marketName,
            room.founderWallet || null,
          );
        } else {
          // Not connected — auto-join
          voice.join(
            room.marketId,
            room.marketAddress,
            room.marketName,
            walletAddress,
            room.founderWallet || null,
          );
        }
      }, 500);
    },
    [voice, walletAddress],
  );

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ item: RoomPage; index: number | null }> }) => {
      if (viewableItems.length === 0) return;
      const visible = viewableItems[0];
      const idx = visible.index ?? 0;
      currentIndexRef.current = idx;
      setCurrentIndex(idx);
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  // Handle momentum end — this is when we trigger the room switch
  const handleMomentumEnd = useCallback(() => {
    const room = rooms[currentIndexRef.current];
    if (room) handleSwipeSettle(room);
  }, [rooms, handleSwipeSettle]);

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

  const handleVoteClose = useCallback(() => {
    setVoteDirection(null);
    voteSheetRef.current?.close();
  }, []);

  const renderRoomPage = useCallback(
    ({ item: room, index }: { item: RoomPage; index: number }) => {
      const isConnectedToThis = voice?.isConnected && voice.marketAddress === room.marketAddress;
      const isSwitching = voice?.isSwitchingRoom && currentIndexRef.current === index;

      return (
        <View style={[styles.page, { height: PAGE_HEIGHT }]}>
          <RoomPageContent
            room={room}
            isConnected={!!isConnectedToThis}
            isSwitching={!!isSwitching}
            voice={voice}
            walletAddress={walletAddress}
            onVoteYes={handleVoteYes}
            onVoteNo={handleVoteNo}
            isVoting={isVoting}
            voteDirection={voteDirection}
            onJoin={() => {
              if (!walletAddress || !voice) return;
              voice.join(
                room.marketId,
                room.marketAddress,
                room.marketName,
                walletAddress,
                room.founderWallet || null,
              );
            }}
          />
        </View>
      );
    },
    [voice, walletAddress, handleVoteYes, handleVoteNo, isVoting, voteDirection],
  );

  const currentRoom = rooms[currentIndex];

  if (rooms.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="radio-outline" size={40} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No markets yet</Text>
        <Text style={styles.emptyText}>Markets will appear here as voice rooms</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={rooms}
        keyExtractor={(item) => item.marketAddress}
        renderItem={renderRoomPage}
        pagingEnabled
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onMomentumScrollEnd={handleMomentumEnd}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
      />

      {/* Dot indicators */}
      {rooms.length > 1 && (
        <View style={styles.dotsContainer}>
          {rooms.map((room, i) => {
            const isActive = i === currentIndex;
            const isConnected = voice?.isConnected && voice.marketAddress === room.marketAddress;
            return (
              <View
                key={room.marketAddress}
                style={[
                  styles.pageIndicator,
                  isActive && styles.pageIndicatorActive,
                  isConnected && styles.pageIndicatorConnected,
                ]}
              />
            );
          })}
        </View>
      )}

      {/* Vote bottom sheet */}
      <VoteBottomSheet
        ref={voteSheetRef}
        direction={voteDirection}
        marketTitle={currentRoom?.marketName || ''}
        onConfirm={handleVoteConfirm}
        onClose={handleVoteClose}
      />

      {/* Vote toast */}
      <VoteToast
        state={voteToastState}
        onDismiss={() => setVoteToastState((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

/* ─── Individual Room Page Content ──────────────────────────────────── */

interface RoomPageContentProps {
  room: RoomPage;
  isConnected: boolean;
  isSwitching: boolean;
  voice: ReturnType<typeof useVoiceRoomContextSafe>;
  walletAddress?: string | null;
  onVoteYes: () => void;
  onVoteNo: () => void;
  isVoting: boolean;
  voteDirection: 'yes' | 'no' | null;
  onJoin: () => void;
}

function RoomPageContent({
  room,
  isConnected,
  isSwitching,
  voice,
  walletAddress,
  onVoteYes,
  onVoteNo,
  isVoting,
  voteDirection,
  onJoin,
}: RoomPageContentProps) {
  // Build participants list with self when connected
  const allParticipants = useMemo(() => {
    if (!isConnected || !voice?.isConnected || !voice.walletAddress) return [];

    const selfParticipant: VoiceParticipant = {
      peerId: voice.walletAddress,
      displayName: 'You',
      isMuted: voice.isMuted,
      isSpeaking: voice.isSpeaking,
      hasRaisedHand: voice.hasRaisedHand,
      isSpeaker: voice.isSpeaker,
    };

    return [selfParticipant, ...voice.participants];
  }, [
    isConnected, voice?.isConnected, voice?.walletAddress, voice?.isMuted,
    voice?.isSpeaking, voice?.hasRaisedHand, voice?.isSpeaker, voice?.participants,
  ]);

  const speakers = allParticipants.filter((p) => p.isSpeaker);
  const totalCount = isConnected ? allParticipants.length : room.participantCount;

  // ─── Switching overlay ───
  if (isSwitching) {
    return (
      <StarField>
        <View style={[pageStyles.container, pageStyles.center]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={pageStyles.switchingText}>Switching rooms...</Text>
        </View>
      </StarField>
    );
  }

  // ─── Not connected — preview card ───
  if (!isConnected) {
    return (
      <View style={pageStyles.container}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <ListenerStars listenerCount={room.participantCount || 3} />
        </View>

        <View style={pageStyles.previewContent}>
          {/* Header */}
          <View style={pageStyles.header}>
            <View style={pageStyles.headerLeft}>
              <Ionicons name="mic" size={16} color={colors.primary} />
              <Text style={pageStyles.roomName} numberOfLines={2}>
                {room.marketName}
              </Text>
            </View>
          </View>

          {room.isActive ? (
            <>
              <View style={pageStyles.liveRow}>
                <View style={pageStyles.liveDot} />
                <Text style={pageStyles.liveText}>
                  LIVE · {room.participantCount} listening
                </Text>
              </View>
              <Text style={pageStyles.previewHint}>
                Swipe here to join the conversation
              </Text>
            </>
          ) : (
            <Text style={pageStyles.emptyHint}>
              Be the first to start a conversation
            </Text>
          )}

          {/* Join button */}
          <PressableScale onPress={onJoin} style={pageStyles.joinBtnWrap} disabled={!walletAddress}>
            <LinearGradient
              colors={room.isActive ? ['#6366f1', '#8b5cf6'] : ['#4ade80', '#22c55e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={pageStyles.joinBtn}
            >
              <Ionicons name={room.isActive ? 'headset' : 'mic'} size={18} color="#fff" />
              <Text style={pageStyles.joinBtnText}>
                {room.isActive ? 'Start listening' : 'Start a room'}
              </Text>
            </LinearGradient>
          </PressableScale>

          {/* Vote buttons even when not connected */}
          <VoiceRoomVoteButtons
            onVoteYes={onVoteYes}
            onVoteNo={onVoteNo}
            isVoting={isVoting}
            votingDirection={voteDirection}
            disabled={!walletAddress}
          />
        </View>
      </View>
    );
  }

  // ─── Connected — full voice room ───
  return (
    <StarField>
      <View style={pageStyles.container}>
        {/* Reconnecting banner */}
        {voice?.isReconnecting && (
          <View style={pageStyles.reconnectBanner}>
            <ActivityIndicator size="small" color={colors.warning} />
            <Text style={pageStyles.reconnectText}>
              Reconnecting... (attempt {voice.reconnectAttempts})
            </Text>
          </View>
        )}

        {/* Header */}
        <View style={pageStyles.header}>
          <View style={pageStyles.headerLeft}>
            <Ionicons name="mic" size={16} color={colors.primary} />
            <Text style={pageStyles.roomName} numberOfLines={1}>
              {room.marketName}
            </Text>
          </View>
          <View style={pageStyles.headerRight}>
            <View style={pageStyles.liveDot} />
            <Text style={pageStyles.liveLabel}>LIVE</Text>
            <Text style={pageStyles.countLabel}>· {totalCount} listening</Text>
          </View>
        </View>

        {/* Scrollable content */}
        <ScrollView
          style={pageStyles.scrollContent}
          contentContainerStyle={pageStyles.scrollInner}
          showsVerticalScrollIndicator={false}
        >
          {/* Speakers — large circles */}
          <View style={pageStyles.speakersSection}>
            <View style={pageStyles.speakersGrid}>
              {speakers.map((p, i) => (
                <VoiceSpeakerCircle
                  key={p.peerId}
                  participant={p}
                  index={i}
                  founderWallet={voice?.founderWallet}
                  coHosts={voice?.coHosts || []}
                  isCurrentUserHost={!!voice?.isHost}
                  isCurrentUserFounder={!!voice?.isFounder}
                  onMute={voice?.muteUser}
                  onKick={voice?.kickUser}
                  onApproveHand={voice?.approveHand}
                  onPromote={voice?.promoteToSpeaker}
                  onDemote={voice?.demoteToListener}
                  onAddCoHost={voice?.addCoHost}
                  onRemoveCoHost={voice?.removeCoHost}
                />
              ))}
            </View>
          </View>

          {/* Listeners — dots */}
          <VoiceListenerDots participants={allParticipants} />
        </ScrollView>

        {/* Floating reactions */}
        <View style={pageStyles.reactionsOverlay} pointerEvents="none">
          {voice?.reactions.map((r) => (
            <FloatingReaction key={r.id} emoji={r.emoji} onFinish={() => {}} />
          ))}
        </View>

        {/* Reaction bar */}
        {voice && <VoiceReactionBar onReaction={voice.sendReaction} />}

        {/* YES / NO vote buttons */}
        <VoiceRoomVoteButtons
          onVoteYes={onVoteYes}
          onVoteNo={onVoteNo}
          isVoting={isVoting}
          votingDirection={voteDirection}
        />

        {/* Voice controls */}
        {voice && (
          <VoiceControls
            isMuted={voice.isMuted}
            hasRaisedHand={voice.hasRaisedHand}
            isSpeaker={voice.isSpeaker}
            isHost={voice.isHost}
            onToggleMute={voice.toggleMute}
            onToggleHand={voice.toggleHand}
            onMuteAll={voice.muteAll}
            onLeave={voice.leave}
          />
        )}
      </View>
    </StarField>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    paddingBottom: spacing.xs,
  },
  pageIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  pageIndicatorActive: {
    width: 18,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  pageIndicatorConnected: {
    backgroundColor: '#4ade80',
  },
  page: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: spacing.xl,
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
  },
});

const pageStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  switchingText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roomName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  liveLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4ade80',
    letterSpacing: 1,
  },
  countLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  // Preview (not connected)
  previewContent: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4ade80',
  },
  previewHint: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: 'italic',
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
  // Connected
  reconnectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingVertical: spacing.sm,
  },
  reconnectText: {
    fontSize: 11,
    color: colors.warning,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  speakersSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
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
});
