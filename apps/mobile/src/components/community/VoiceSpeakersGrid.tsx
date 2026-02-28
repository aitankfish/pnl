import { View, Text, StyleSheet } from 'react-native';
import type { VoiceParticipant } from '../../providers/VoiceRoomProvider';
import { VoiceSpeakerAvatar } from './VoiceSpeakerAvatar';
import { colors, spacing, typography } from '../../theme';

interface VoiceSpeakersGridProps {
  participants: VoiceParticipant[];
  founderWallet?: string | null;
  coHosts: string[];
  isCurrentUserHost: boolean;
  isCurrentUserFounder: boolean;
  onMute: (peerId: string) => void;
  onKick: (peerId: string) => void;
  onApproveHand: (peerId: string) => void;
  onPromote: (peerId: string) => void;
  onDemote: (peerId: string) => void;
  onAddCoHost: (peerId: string) => void;
  onRemoveCoHost: (peerId: string) => void;
}

export function VoiceSpeakersGrid({
  participants,
  founderWallet,
  coHosts,
  isCurrentUserHost,
  isCurrentUserFounder,
  onMute,
  onKick,
  onApproveHand,
  onPromote,
  onDemote,
  onAddCoHost,
  onRemoveCoHost,
}: VoiceSpeakersGridProps) {
  const speakers = participants.filter((p) => p.isSpeaker);
  const raisedHands = participants.filter((p) => p.hasRaisedHand && !p.isSpeaker);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Speakers ({speakers.length})</Text>
      <View style={styles.grid}>
        {speakers.map((p) => (
          <VoiceSpeakerAvatar
            key={p.peerId}
            participant={p}
            founderWallet={founderWallet}
            coHosts={coHosts}
            isCurrentUserHost={isCurrentUserHost}
            isCurrentUserFounder={isCurrentUserFounder}
            onMute={onMute}
            onKick={onKick}
            onApproveHand={onApproveHand}
            onPromote={onPromote}
            onDemote={onDemote}
            onAddCoHost={onAddCoHost}
            onRemoveCoHost={onRemoveCoHost}
          />
        ))}
      </View>

      {/* Raised hands queue (host view) */}
      {isCurrentUserHost && raisedHands.length > 0 && (
        <View style={styles.handsSection}>
          <Text style={styles.handsTitle}>✋ Raised Hands ({raisedHands.length})</Text>
          <View style={styles.grid}>
            {raisedHands.map((p) => (
              <VoiceSpeakerAvatar
                key={p.peerId}
                participant={p}
                founderWallet={founderWallet}
                coHosts={coHosts}
                isCurrentUserHost={isCurrentUserHost}
                isCurrentUserFounder={isCurrentUserFounder}
                onMute={onMute}
                onKick={onKick}
                onApproveHand={onApproveHand}
                onPromote={onPromote}
                onDemote={onDemote}
                onAddCoHost={onAddCoHost}
                onRemoveCoHost={onRemoveCoHost}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.captionBold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  handsSection: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  handsTitle: {
    ...typography.captionBold,
    color: colors.warning,
    paddingHorizontal: spacing.md,
  },
});
