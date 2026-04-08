import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { PressableScale } from '../PressableScale';
import { colors, spacing, typography, borderRadius } from '../../theme';

interface VoiceControlsProps {
  isMuted: boolean;
  hasRaisedHand: boolean;
  isSpeaker: boolean;
  isHost: boolean;
  onToggleMute: () => void;
  onToggleHand: () => void;
  onMuteAll: () => void;
  onLeave: () => void;
}

export function VoiceControls({
  isMuted,
  hasRaisedHand,
  isSpeaker,
  isHost,
  onToggleMute,
  onToggleHand,
  onMuteAll,
  onLeave,
}: VoiceControlsProps) {
  const handleMute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onToggleMute();
  };

  const handleHand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleHand();
  };

  const handleMuteAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onMuteAll();
  };

  const handleLeave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onLeave();
  };

  return (
    <View style={styles.container}>
      {/* Mute toggle */}
      {isSpeaker && (
        <PressableScale
          onPress={handleMute}
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
        >
          <Ionicons
            name={isMuted ? 'mic-off' : 'mic'}
            size={22}
            color={isMuted ? colors.danger : colors.textPrimary}
          />
          <Text style={[styles.controlLabel, isMuted && { color: colors.danger }]}>
            {isMuted ? 'Unmute' : 'Mute'}
          </Text>
        </PressableScale>
      )}

      {/* Raise hand (listeners only) */}
      {!isSpeaker && (
        <PressableScale
          onPress={handleHand}
          style={[styles.controlButton, hasRaisedHand && styles.handActive]}
        >
          <Text style={styles.handEmoji}>✋</Text>
          <Text style={[styles.controlLabel, hasRaisedHand && { color: colors.warning }]}>
            {hasRaisedHand ? 'Lower' : 'Raise Hand'}
          </Text>
        </PressableScale>
      )}

      {/* Mute all (host only) */}
      {isHost && (
        <PressableScale onPress={handleMuteAll} style={styles.controlButton}>
          <Ionicons name="volume-mute" size={22} color={colors.textPrimary} />
          <Text style={styles.controlLabel}>Mute All</Text>
        </PressableScale>
      )}

      {/* Leave */}
      <PressableScale onPress={handleLeave} style={styles.leaveButton}>
        <Ionicons name="exit-outline" size={22} color="#fff" />
        <Text style={styles.leaveLabel}>Leave</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.06)',
    minWidth: 64,
  },
  controlButtonActive: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  handActive: {
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  controlLabel: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  handEmoji: {
    fontSize: 20,
  },
  leaveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.danger,
    minWidth: 64,
  },
  leaveLabel: {
    ...typography.micro,
    color: '#fff',
    fontWeight: '600',
  },
});
