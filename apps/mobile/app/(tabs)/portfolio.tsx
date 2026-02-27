/**
 * Portfolio / Wallet Tab
 * - Total portfolio value (large display)
 * - SOL balance with live USD conversion
 * - Active positions as expandable cards
 * - Claimable rewards with "Claim All"
 */

import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

export default function PortfolioScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.screenTitle}>Portfolio</Text>

      {/* Total Value */}
      <View style={styles.valueCard}>
        <Text style={styles.valueLabel}>Total Value</Text>
        <Text style={styles.valueAmount}>--.- SOL</Text>
        <Text style={styles.valueUsd}>$--.--</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="download-outline" size={20} color={colors.primary} />
          <Text style={styles.actionText}>Deposit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.claimButton]}>
          <Ionicons name="gift-outline" size={20} color={colors.success} />
          <Text style={[styles.actionText, { color: colors.success }]}>Claim All</Text>
        </TouchableOpacity>
      </View>

      {/* Positions Section */}
      <Text style={styles.sectionTitle}>Active Positions</Text>
      <View style={styles.emptyState}>
        <Ionicons name="planet-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyText}>No active positions yet</Text>
        <Text style={styles.emptySubtext}>Vote on markets to see your positions here</Text>
      </View>

      {/* Token Balances */}
      <Text style={styles.sectionTitle}>Token Balances</Text>
      <View style={styles.emptyState}>
        <Ionicons name="wallet-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyText}>Connect wallet to view balances</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: 60, paddingBottom: 100 },
  screenTitle: { ...typography.display, color: colors.textPrimary, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  valueCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.xl,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  valueLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  valueAmount: { ...typography.display, color: colors.textPrimary, marginBottom: spacing.xs },
  valueUsd: { ...typography.body, color: colors.textMuted },
  actionsRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.md, marginBottom: spacing.lg },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  claimButton: { borderColor: `${colors.success}40` },
  actionText: { ...typography.body, color: colors.primary, fontWeight: '600' },
  sectionTitle: { ...typography.heading, color: colors.textPrimary, paddingHorizontal: spacing.xl, paddingBottom: spacing.md, paddingTop: spacing.sm },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    marginHorizontal: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  emptyText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  emptySubtext: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
