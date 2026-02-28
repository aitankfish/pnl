import { useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVoiceRoomContext } from '../../providers/VoiceRoomProvider';
import { VoiceJoinScreen } from './VoiceJoinScreen';
import { VoiceJoinChoiceSheet } from './VoiceJoinChoiceSheet';
import { VoiceSpeakersGrid } from './VoiceSpeakersGrid';
import { VoiceListenersList } from './VoiceListenersList';
import { VoiceReactionBar } from './VoiceReactionBar';
import { VoiceControls } from './VoiceControls';
import { FloatingReaction } from './FloatingReaction';
import { colors, spacing, typography, borderRadius } from '../../theme';

interface VoiceRoomProps {
  marketId: string;
  marketAddress: string;
  marketName: string;
  walletAddress?: string | null;
  founderWallet?: string | null;
  hasPosition: boolean;
}

export function VoiceRoom({
  marketId,
  marketAddress,
  marketName,
  walletAddress,
  founderWallet,
  hasPosition,
}: VoiceRoomProps) {
  const voice = useVoiceRoomContext();
  const isFounder = !!walletAddress && !!founderWallet && walletAddress === founderWallet;

  const handleJoin = useCallback(() => {
    if (!walletAddress) return;
    voice.join(marketId, marketAddress, marketName, walletAddress, founderWallet || null);
  }, [voice, marketId, marketAddress, marketName, walletAddress, founderWallet]);

  // Not connected — show join screen
  if (!voice.isConnected && !voice.isConnecting) {
    return (
      <View style={styles.container}>
        <VoiceJoinScreen
          hasPosition={hasPosition}
          isFounder={isFounder}
          isConnecting={voice.isConnecting}
          error={voice.error}
          onJoin={handleJoin}
        />
        <VoiceJoinChoiceSheet
          visible={voice.showJoinChoice}
          speakerCount={voice.speakerCount}
          onJoinAsSpeaker={voice.joinAsSpeaker}
          onJoinAsListener={voice.joinAsListener}
          onCancel={voice.cancelJoinChoice}
        />
      </View>
    );
  }

  // Connecting
  if (voice.isConnecting) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.connectingText}>Connecting to voice room...</Text>
      </View>
    );
  }

  // Connected — show full voice room
  return (
    <View style={styles.container}>
      {/* Reconnecting banner */}
      {voice.isReconnecting && (
        <View style={styles.reconnectBanner}>
          <ActivityIndicator size="small" color={colors.warning} />
          <Text style={styles.reconnectText}>
            Reconnecting... (attempt {voice.reconnectAttempts})
          </Text>
        </View>
      )}

      {/* Room title */}
      {voice.roomTitle ? (
        <View style={styles.titleContainer}>
          <Text style={styles.roomTitle}>{voice.roomTitle}</Text>
        </View>
      ) : null}

      {/* Participant count */}
      <View style={styles.statsRow}>
        <View style={styles.liveDot} />
        <Text style={styles.statsText}>
          {voice.participants.length + 1} in room
        </Text>
      </View>

      {/* Speakers grid */}
      <VoiceSpeakersGrid
        participants={voice.participants}
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

      {/* Listeners */}
      <VoiceListenersList participants={voice.participants} />

      {/* Floating reactions */}
      <View style={styles.reactionsOverlay} pointerEvents="none">
        {voice.reactions.map((r) => (
          <FloatingReaction
            key={r.id}
            emoji={r.emoji}
            onFinish={() => {}}
          />
        ))}
      </View>

      {/* Spacer */}
      <View style={styles.spacer} />

      {/* Reaction bar */}
      <VoiceReactionBar onReaction={voice.sendReaction} />

      {/* Controls */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  connectingText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  reconnectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(245,158,11,0.1)',
    paddingVertical: spacing.sm,
  },
  reconnectText: {
    ...typography.micro,
    color: colors.warning,
  },
  titleContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  roomTitle: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.livePulse,
  },
  statsText: {
    ...typography.micro,
    color: colors.textMuted,
  },
  reactionsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  spacer: {
    flex: 1,
  },
});
