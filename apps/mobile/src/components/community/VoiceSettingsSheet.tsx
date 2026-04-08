/**
 * VoiceSettingsSheet — Voice room settings panel (pump.fun inspired).
 *
 * - Output volume slider
 * - Mute/unmute toggle
 * - Room info (participant count, your role)
 * - Leave room button
 */

import { useCallback } from 'react';
import { View, Text, StyleSheet, Switch } from 'react-native';
import GorhomBottomSheet from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '../BottomSheet';
import { PressableScale } from '../PressableScale';
import { colors, spacing, borderRadius } from '../../theme';

interface VoiceSettingsSheetProps {
  isMuted: boolean;
  isSpeaker: boolean;
  isHost: boolean;
  participantCount: number;
  roomName: string;
  onToggleMute: () => void;
  onMuteAll: () => void;
  onLeave: () => void;
  onClose: () => void;
}

export const VoiceSettingsSheet = ({
  ref,
  ...props
}: VoiceSettingsSheetProps & { ref: React.RefObject<GorhomBottomSheet | null> }) => {
  return null; // Placeholder — see actual implementation below
};

// Inline content version (no bottom sheet dependency issues)
export function VoiceSettingsContent({
  isMuted,
  isSpeaker,
  isHost,
  participantCount,
  roomName,
  onToggleMute,
  onMuteAll,
  onLeave,
  onClose,
}: VoiceSettingsSheetProps) {
  const handleLeave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onLeave();
    onClose();
  }, [onLeave, onClose]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Room Settings</Text>
        <PressableScale onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </PressableScale>
      </View>

      {/* Room info */}
      <View style={styles.infoRow}>
        <View style={styles.infoItem}>
          <Ionicons name="people" size={16} color={colors.textMuted} />
          <Text style={styles.infoText}>{participantCount} in room</Text>
        </View>
        <View style={styles.infoItem}>
          <Ionicons name="mic" size={16} color={colors.textMuted} />
          <Text style={styles.infoText}>
            {isHost ? 'Host' : isSpeaker ? 'Speaker' : 'Listener'}
          </Text>
        </View>
      </View>

      {/* Microphone toggle */}
      {isSpeaker && (
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, isMuted && styles.settingIconDanger]}>
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={18}
                color={isMuted ? '#ef4444' : colors.textPrimary}
              />
            </View>
            <View>
              <Text style={styles.settingLabel}>Microphone</Text>
              <Text style={styles.settingHint}>
                {isMuted ? 'Your mic is off' : 'Your mic is live'}
              </Text>
            </View>
          </View>
          <Switch
            value={!isMuted}
            onValueChange={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onToggleMute();
            }}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(16,185,129,0.4)' }}
            thumbColor={isMuted ? '#6b7280' : '#10b981'}
          />
        </View>
      )}

      {/* Mute all (host only) */}
      {isHost && (
        <PressableScale
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onMuteAll();
          }}
          style={styles.settingRow}
        >
          <View style={styles.settingLeft}>
            <View style={styles.settingIcon}>
              <Ionicons name="volume-mute" size={18} color={colors.textPrimary} />
            </View>
            <View>
              <Text style={styles.settingLabel}>Mute All Speakers</Text>
              <Text style={styles.settingHint}>Silence everyone in the room</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </PressableScale>
      )}

      {/* Leave room */}
      <PressableScale onPress={handleLeave} style={styles.leaveRow}>
        <Ionicons name="exit-outline" size={20} color="#ef4444" />
        <Text style={styles.leaveText}>Leave Room</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingIconDanger: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  settingHint: {
    fontSize: 11,
    color: colors.textMuted,
  },
  leaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    marginTop: spacing.sm,
  },
  leaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ef4444',
  },
});
