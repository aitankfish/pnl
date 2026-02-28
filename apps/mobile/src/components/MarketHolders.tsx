/**
 * MarketHolders — YES/NO position holders (ported from web MarketHolders.tsx)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../theme';

interface PositionHolder {
  wallet: string;
  totalAmount: number;
  tradeCount: number;
  percentage: number;
}

interface MarketHoldersProps {
  yesHolders: PositionHolder[];
  noHolders: PositionHolder[];
  totalYesStake: number;
  totalNoStake: number;
  uniqueHolders: number;
  yesPercentage?: number;
  noPercentage?: number;
  currentUserWallet?: string;
}

const safeFormat = (value: unknown, decimals: number = 0): string => {
  if (value === null || value === undefined) return '0';
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (Number.isNaN(num) || !Number.isFinite(num)) return '0';
  return String(Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals));
};

function truncateWallet(wallet: string): string {
  if (!wallet || wallet.length < 12) return wallet || '';
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

function HolderRow({
  holder,
  index,
  accentColor,
  isYou,
}: {
  holder: PositionHolder;
  index: number;
  accentColor: string;
  isYou: boolean;
}) {
  return (
    <View style={[styles.holderRow, isYou && { backgroundColor: accentColor === colors.success ? colors.successLight : colors.dangerLight, borderColor: accentColor === colors.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }]}>
      <View style={styles.holderLeft}>
        <Text style={styles.holderRank}>#{index + 1}</Text>
        <View style={{ flex: 1 }}>
          <View style={styles.walletRow}>
            <Text style={styles.holderWallet}>{truncateWallet(holder.wallet)}</Text>
            {isYou ? (
              <View style={[styles.youBadge, { backgroundColor: accentColor === colors.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)' }]}>
                <Text style={[styles.youText, { color: accentColor }]}>You</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.tradeCount}>
            {holder.tradeCount || 0} {(holder.tradeCount || 0) === 1 ? 'trade' : 'trades'}
          </Text>
        </View>
      </View>
      <View style={styles.holderRight}>
        <Text style={[styles.holderAmount, { color: accentColor }]}>
          {safeFormat(holder.totalAmount, 3)} SOL
        </Text>
        <Text style={styles.holderPercent}>{safeFormat(holder.percentage, 1)}%</Text>
      </View>
    </View>
  );
}

export function MarketHolders(props: MarketHoldersProps) {
  if (!props) return null;

  const yesHolders = Array.isArray(props.yesHolders) ? props.yesHolders : [];
  const noHolders = Array.isArray(props.noHolders) ? props.noHolders : [];
  const totalYesStake = Number(props.totalYesStake) || 0;
  const totalNoStake = Number(props.totalNoStake) || 0;
  const uniqueHolders = Number(props.uniqueHolders) || 0;
  const currentUserWallet = props.currentUserWallet;

  const totalStake = totalYesStake + totalNoStake;
  const yesPoolPct = typeof props.yesPercentage === 'number' && !isNaN(props.yesPercentage)
    ? props.yesPercentage
    : (totalStake > 0 ? (totalYesStake / totalStake) * 100 : 50);
  const noPoolPct = typeof props.noPercentage === 'number' && !isNaN(props.noPercentage)
    ? props.noPercentage
    : (100 - yesPoolPct);

  if (yesHolders.length === 0 && noHolders.length === 0) return null;

  const isCurrentUser = (wallet: string) => !!currentUserWallet && wallet === currentUserWallet;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Ionicons name="people-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.title}>Market Holders</Text>
          </View>
          <Text style={styles.subtitle}>
            {uniqueHolders} unique {uniqueHolders === 1 ? 'holder' : 'holders'}
          </Text>
        </View>
        <View style={styles.totalStake}>
          <Text style={styles.totalLabel}>Total Staked</Text>
          <Text style={styles.totalValue}>{safeFormat(totalStake, 2)} SOL</Text>
        </View>
      </View>

      {/* YES Holders */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name="trending-up" size={14} color={colors.success} />
            <Text style={[styles.sectionTitle, { color: colors.success }]}>
              YES HOLDERS ({safeFormat(yesPoolPct, 0)}%)
            </Text>
          </View>
          <Text style={styles.sectionStake}>{safeFormat(totalYesStake, 2)} SOL</Text>
        </View>
        {yesHolders.length === 0 ? (
          <Text style={styles.emptySection}>No YES positions yet</Text>
        ) : (
          yesHolders.filter(h => h && h.wallet).map((holder, i) => (
            <HolderRow
              key={holder.wallet || i}
              holder={holder}
              index={i}
              accentColor={colors.success}
              isYou={isCurrentUser(holder.wallet)}
            />
          ))
        )}
      </View>

      {/* NO Holders */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Ionicons name="trending-down" size={14} color={colors.danger} />
            <Text style={[styles.sectionTitle, { color: colors.danger }]}>
              NO HOLDERS ({safeFormat(noPoolPct, 0)}%)
            </Text>
          </View>
          <Text style={styles.sectionStake}>{safeFormat(totalNoStake, 2)} SOL</Text>
        </View>
        {noHolders.length === 0 ? (
          <Text style={styles.emptySection}>No NO positions yet</Text>
        ) : (
          noHolders.filter(h => h && h.wallet).map((holder, i) => (
            <HolderRow
              key={holder.wallet || i}
              holder={holder}
              index={i}
              accentColor={colors.danger}
              isYou={isCurrentUser(holder.wallet)}
            />
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  totalStake: { alignItems: 'flex-end' },
  totalLabel: { ...typography.micro, color: colors.textMuted },
  totalValue: { ...typography.bodyBold, color: colors.textPrimary },

  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionTitle: { ...typography.captionBold, textTransform: 'uppercase' as any },
  sectionStake: { ...typography.micro, color: colors.textMuted },
  emptySection: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },

  holderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.sm, borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'transparent',
  },
  holderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  holderRank: { ...typography.micro, color: colors.textMuted, fontVariant: ['tabular-nums'], width: 24 },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  holderWallet: { ...typography.captionBold, color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  youBadge: { paddingHorizontal: spacing.xs + 2, paddingVertical: 1, borderRadius: borderRadius.sm },
  youText: { ...typography.micro, fontWeight: '600' },
  tradeCount: { ...typography.micro, color: colors.textMuted, marginTop: 1 },
  holderRight: { alignItems: 'flex-end' },
  holderAmount: { ...typography.captionBold },
  holderPercent: { ...typography.micro, color: colors.textMuted },
});
