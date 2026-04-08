import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from '../PressableScale';
import { colors, spacing, typography, borderRadius } from '../../theme';

interface VoiceJoinScreenProps {
  isConnecting: boolean;
  error: string | null;
  onJoin: () => void;
  walletAddress?: string | null;
}

export function VoiceJoinScreen({ isConnecting, error, onJoin, walletAddress }: VoiceJoinScreenProps) {
  const hasWallet = !!walletAddress;

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="mic" size={40} color={hasWallet ? colors.primary : colors.textMuted} />
      </View>

      <Text style={styles.title}>Voice Room</Text>
      <Text style={styles.subtitle}>
        {hasWallet
          ? 'Join the live conversation with other community members'
          : 'Sign in to join the voice room'}
      </Text>

      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <PressableScale
        onPress={onJoin}
        disabled={!hasWallet || isConnecting}
        style={[styles.joinButton, (!hasWallet || isConnecting) && styles.joinButtonDisabled]}
      >
        {isConnecting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="headset" size={20} color="#fff" />
            <Text style={styles.joinText}>Join Voice Room</Text>
          </>
        )}
      </PressableScale>

      {!hasWallet && (
        <View style={styles.lockRow}>
          <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
          <Text style={styles.lockText}>Sign in required</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(129,140,248,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.dangerLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.sm,
    minWidth: 200,
  },
  joinButtonDisabled: {
    opacity: 0.4,
  },
  joinText: {
    ...typography.bodyBold,
    color: '#fff',
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lockText: {
    ...typography.micro,
    color: colors.textMuted,
  },
});
