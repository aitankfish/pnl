import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { VoiceParticipant } from '../../providers/VoiceRoomProvider';
import { colors, spacing, typography, borderRadius } from '../../theme';

interface VoiceListenersListProps {
  participants: VoiceParticipant[];
}

export function VoiceListenersList({ participants }: VoiceListenersListProps) {
  const listeners = participants.filter((p) => !p.isSpeaker);

  if (listeners.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Listeners ({listeners.length})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
        {listeners.map((p) => {
          const name = p.displayName || p.peerId.slice(0, 6) + '...';
          return (
            <View key={p.peerId} style={styles.pill}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              {p.hasRaisedHand && <Text style={styles.hand}>✋</Text>}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  title: {
    ...typography.captionBold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.micro,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  name: {
    ...typography.micro,
    color: colors.textSecondary,
    maxWidth: 80,
  },
  hand: {
    fontSize: 12,
  },
});
