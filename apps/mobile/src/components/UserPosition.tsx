/**
 * UserPosition — Shows user's current position in a market
 * Uses shared usePosition hook (platform-agnostic, SWR-based)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../theme';

interface UserPositionProps {
  positionData: {
    hasPosition: boolean;
    side?: 'yes' | 'no';
    totalAmount?: number;
    tradeCount?: number;
    claimed?: boolean;
  } | null;
}

export function UserPosition({ positionData }: UserPositionProps) {
  if (!positionData?.hasPosition) return null;

  const isYes = positionData.side === 'yes';
  const accentColor = isYes ? colors.success : colors.danger;
  const bgColor = isYes ? colors.successLight : colors.dangerLight;

  return (
    <View style={[styles.container, { borderColor: accentColor + '40' }]}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: bgColor }]}>
          <Ionicons
            name={isYes ? 'checkmark-circle' : 'close-circle'}
            size={16}
            color={accentColor}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Your Position</Text>
          <View style={styles.detailRow}>
            <Text style={[styles.side, { color: accentColor }]}>
              {positionData.side?.toUpperCase()}
            </Text>
            <Text style={styles.dot}> · </Text>
            <Text style={styles.amount}>
              {(Number(positionData.totalAmount) || 0).toFixed(3)} SOL
            </Text>
          </View>
        </View>
        <View style={styles.tradesWrap}>
          <Text style={styles.tradesCount}>{positionData.tradeCount || 0}</Text>
          <Text style={styles.tradesLabel}>
            {(positionData.tradeCount || 0) === 1 ? 'trade' : 'trades'}
          </Text>
        </View>
      </View>

      {positionData.claimed && (
        <View style={styles.claimedBanner}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={styles.claimedText}>Rewards claimed</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.glass,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.sm + 2,
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: {
    ...typography.captionBold,
  },
  dot: {
    ...typography.caption,
    color: colors.textMuted,
  },
  amount: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  tradesWrap: {
    alignItems: 'center',
  },
  tradesCount: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  tradesLabel: {
    ...typography.micro,
    color: colors.textMuted,
  },
  claimedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  claimedText: {
    ...typography.micro,
    color: colors.success,
    fontWeight: '600',
  },
});
