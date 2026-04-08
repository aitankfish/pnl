import { useCallback, useMemo } from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVoiceRoomContext, MAX_SPEAKERS } from '../../providers/VoiceRoomProvider';
import type { VoiceParticipant } from '../../providers/VoiceRoomProvider';
import { useProfile, resolveAvatarUrl } from '../../hooks/useProfile';
import { VoiceJoinScreen } from './VoiceJoinScreen';
import { VoiceSpeakerCircle } from './VoiceSpeakerCircle';
import { VoiceListenerDots } from './VoiceListenerDots';
import { VoiceReactionBar } from './VoiceReactionBar';
import { VoiceControls } from './VoiceControls';
import { FloatingReaction } from './FloatingReaction';
import { PressableScale } from '../PressableScale';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { StarField } from '../StarField';

interface VoiceRoomProps {
  marketId: string;
  marketAddress: string;
  marketName: string;
  walletAddress?: string | null;
  founderWallet?: string | null;
  hasPosition: boolean;
  tokenSymbol?: string;
  projectImageUrl?: string;
  poolBalance?: number;
  targetPool?: number;
}

export function VoiceRoom({
  marketId,
  marketAddress,
  marketName,
  walletAddress,
  founderWallet,
  hasPosition,
  tokenSymbol,
  projectImageUrl,
  poolBalance,
  targetPool,
}: VoiceRoomProps) {
  const voice = useVoiceRoomContext();
  const { profile } = useProfile(walletAddress ?? null);

  const handleJoin = useCallback(() => {
    if (!walletAddress) return;
    voice.join(marketId, marketAddress, marketName, walletAddress, founderWallet || null);
  }, [voice, marketId, marketAddress, marketName, walletAddress, founderWallet]);

  const canSpeaker = voice.speakerCount < MAX_SPEAKERS;

  // Build participants list with self included (web pattern)
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

    // Self first, then others
    return [selfParticipant, ...voice.participants];
  }, [
    voice.isConnected, voice.walletAddress, voice.isMuted,
    voice.isSpeaking, voice.hasRaisedHand, voice.isSpeaker,
    voice.participants, profile,
  ]);

  const totalCount = voice.participants.length + 1; // +1 for self

  // Join choice — inline like web (replaces entire view)
  if (voice.showJoinChoice) {
    return (
      <StarField>
        <View style={[styles.container, styles.center]}>
          <View style={styles.choiceIconWrap}>
            <Ionicons name="mic" size={36} color={colors.primary} />
          </View>

          <Text style={styles.choiceTitle}>How do you want to join?</Text>
          <Text style={styles.choiceSubtitle}>
            {canSpeaker
              ? `${MAX_SPEAKERS - voice.speakerCount} speaker spot${MAX_SPEAKERS - voice.speakerCount !== 1 ? 's' : ''} available`
              : 'Speaker spots are full'}
          </Text>

          <View style={styles.choiceButtons}>
            <PressableScale
              onPress={voice.joinAsSpeaker}
              disabled={!canSpeaker}
              style={[styles.choiceBtn, styles.choiceBtnSpeaker, !canSpeaker && styles.choiceBtnDisabled]}
            >
              <Ionicons name="mic" size={20} color={canSpeaker ? '#fff' : colors.textMuted} />
              <Text style={[styles.choiceBtnText, !canSpeaker && styles.choiceBtnTextDisabled]}>
                Join as Speaker
              </Text>
            </PressableScale>

            <PressableScale
              onPress={voice.joinAsListener}
              style={[styles.choiceBtn, styles.choiceBtnListener]}
            >
              <Ionicons name="headset" size={20} color={colors.textPrimary} />
              <Text style={[styles.choiceBtnText, styles.choiceBtnTextListener]}>
                Join as Listener
              </Text>
            </PressableScale>

            <PressableScale onPress={voice.cancelJoinChoice} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </PressableScale>
          </View>

          <Text style={styles.choiceFooter}>Listeners can raise hand to request speaking</Text>
        </View>
      </StarField>
    );
  }

  // Not connected — show join screen
  if (!voice.isConnected && !voice.isConnecting) {
    return (
      <StarField>
        <View style={styles.container}>
          <VoiceJoinScreen
            walletAddress={walletAddress}
            isConnecting={voice.isConnecting}
            error={voice.error}
            onJoin={handleJoin}
          />
        </View>
      </StarField>
    );
  }

  // Connecting
  if (voice.isConnecting) {
    return (
      <StarField>
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.connectingText}>Connecting to voice room...</Text>
        </View>
      </StarField>
    );
  }

  // ─── Connected — full voice room (matches web layout) ───
  return (
    <StarField>
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

      {/* Header: project context + live indicator */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {projectImageUrl ? (
            <Image source={{ uri: projectImageUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
              <Ionicons name="mic" size={14} color={colors.primary} />
            </View>
          )}
          <View style={styles.headerInfo}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerName} numberOfLines={1}>{marketName}</Text>
              {tokenSymbol && <Text style={styles.headerToken}>${tokenSymbol}</Text>}
            </View>
            <View style={styles.headerMeta}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>{totalCount} listening</Text>
              {poolBalance != null && targetPool != null && (
                <Text style={styles.headerPool}>
                  · {(poolBalance / 1e9).toFixed(2)}/{targetPool} SOL
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Pool progress bar */}
      {poolBalance != null && targetPool != null && targetPool > 0 && (
        <View style={styles.progressBarWrap}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(100, ((poolBalance / 1e9) / targetPool) * 100)}%` },
            ]}
          />
        </View>
      )}

      {/* Scrollable content */}
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
        {/* Speakers — large circles (pitch-deck style) */}
        <View style={styles.speakersSection}>
          <View style={styles.speakersGrid}>
            {allParticipants.filter((p) => p.isSpeaker).map((p, i) => (
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
        </View>

        {/* Listeners — dots */}
        <VoiceListenerDots participants={allParticipants} />
      </ScrollView>

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
    </StarField>
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
    gap: spacing.md,
    padding: spacing.xl,
  },
  connectingText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  // -- Join choice (inline, matches web) --
  choiceIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(129,140,248,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  choiceTitle: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  choiceSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  choiceButtons: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  choiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
  },
  choiceBtnSpeaker: {
    backgroundColor: colors.success,
  },
  choiceBtnListener: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceBtnDisabled: {
    opacity: 0.35,
  },
  choiceBtnText: {
    ...typography.bodyBold,
    color: '#fff',
  },
  choiceBtnTextDisabled: {
    color: colors.textMuted,
  },
  choiceBtnTextListener: {
    color: colors.textPrimary,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cancelBtnText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  choiceFooter: {
    ...typography.micro,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  // -- Connected header with project context --
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  headerAvatarPlaceholder: {
    backgroundColor: 'rgba(129,140,248,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerName: {
    ...typography.captionBold,
    color: '#fff',
    fontSize: 14,
    flexShrink: 1,
  },
  headerToken: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22d3ee',
    fontFamily: 'monospace' as any,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
  },
  liveLabel: {
    ...typography.micro,
    color: colors.textMuted,
  },
  headerPool: {
    ...typography.micro,
    color: colors.textMuted,
  },
  progressBarWrap: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  progressBarFill: {
    height: 3,
    backgroundColor: '#10b981',
    borderRadius: 1.5,
  },
  // -- Scrollable content --
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingVertical: spacing.md,
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
  // -- Overlays --
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
  reactionsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    pointerEvents: 'none',
  },
});
