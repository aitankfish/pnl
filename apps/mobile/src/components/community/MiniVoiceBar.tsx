import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useVoiceRoomContextSafe } from '../../providers/VoiceRoomProvider';
import { PressableScale } from '../PressableScale';
import { colors, spacing, typography, borderRadius } from '../../theme';

interface MiniVoiceBarProps {
  /** The market ID of the currently viewed market page (if any) */
  currentMarketId?: string | null;
}

export function MiniVoiceBar({ currentMarketId }: MiniVoiceBarProps) {
  const voice = useVoiceRoomContextSafe();
  const insets = useSafeAreaInsets();

  if (!voice?.isConnected) return null;
  // Don't show when on the same market page (CommunityHub shows full voice UI there)
  if (currentMarketId && voice.marketId === currentMarketId) return null;

  const participantCount = voice.participants.length + 1; // +1 for self
  const roomLabel = voice.roomTitle || voice.marketName || 'Voice Room';

  const handleTapToReturn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (voice.marketId) {
      router.push(`/market/${voice.marketId}` as any);
    }
  };

  const handleMuteToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    voice.toggleMute();
  };

  const handleLeave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    voice.leave();
  };

  return (
    <Pressable onPress={handleTapToReturn} style={[styles.container, { bottom: 80 + insets.bottom }]}>
      <View style={styles.content}>
        {/* Live indicator */}
        <View style={styles.liveDot} />

        {/* Room info */}
        <View style={styles.info}>
          <Text style={styles.roomName} numberOfLines={1}>{roomLabel}</Text>
          <Text style={styles.tapHint}>
            {participantCount} in room · Tap to return
          </Text>
        </View>

        {/* Quick controls */}
        <View style={styles.controls}>
          {voice.isSpeaker && (
            <PressableScale onPress={handleMuteToggle} style={styles.controlBtn}>
              <Ionicons
                name={voice.isMuted ? 'mic-off' : 'mic'}
                size={18}
                color={voice.isMuted ? colors.danger : colors.textPrimary}
              />
            </PressableScale>
          )}
          <PressableScale onPress={handleLeave} style={[styles.controlBtn, styles.leaveBtn]}>
            <Ionicons name="call" size={16} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </PressableScale>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.livePulse,
  },
  info: {
    flex: 1,
  },
  roomName: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  tapHint: {
    ...typography.micro,
    color: colors.textMuted,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBtn: {
    backgroundColor: colors.danger,
  },
});
