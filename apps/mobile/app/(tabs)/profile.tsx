/**
 * Profile Tab
 * - Avatar with cosmic ring border
 * - Stats row: Predictions / Win Rate / Following / Followers
 * - Settings gear icon
 * - Activity feed
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Settings Icon */}
      <TouchableOpacity style={styles.settingsButton}>
        <Ionicons name="settings-outline" size={24} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={40} color={colors.textMuted} />
          </View>
        </View>
        <Text style={styles.username}>Connect Wallet</Text>
        <Text style={styles.walletAddress}>Sign in to see your profile</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatBox label="Predictions" value="--" />
        <StatBox label="Win Rate" value="--%" />
        <StatBox label="Following" value="--" />
        <StatBox label="Followers" value="--" />
      </View>

      {/* Connect CTA */}
      <TouchableOpacity style={styles.connectButton}>
        <Ionicons name="wallet" size={20} color={colors.textPrimary} />
        <Text style={styles.connectText}>Connect Wallet</Text>
      </TouchableOpacity>

      {/* Activity */}
      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No activity yet</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 60, paddingBottom: 100, alignItems: 'center' },
  settingsButton: { position: 'absolute', top: 60, right: spacing.xl, zIndex: 10 },
  avatarContainer: { alignItems: 'center', marginBottom: spacing.lg },
  avatarRing: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  username: { ...typography.heading, color: colors.textPrimary },
  walletAddress: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    width: '100%',
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { ...typography.title, color: colors.textPrimary },
  statLabel: { ...typography.micro, color: colors.textMuted, marginTop: 2 },
  connectButton: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  connectText: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  sectionTitle: { ...typography.heading, color: colors.textPrimary, alignSelf: 'flex-start', paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  emptyState: {
    width: '100%', paddingHorizontal: spacing.xl,
  },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing['2xl'] },
});
