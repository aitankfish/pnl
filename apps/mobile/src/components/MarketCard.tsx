import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { PressableScale } from './PressableScale';
import { VoteGauge } from './VoteGauge';
import { CategoryPill } from './CategoryPill';
import { TimeCountdown } from './TimeCountdown';
import { LiveDot } from './LiveDot';
import { colors, typography, spacing, borderRadius } from '../theme';
import { shadows } from '../theme/shadows';

interface MarketCardProps {
  market: {
    id: string;
    title: string;
    category?: string;
    projectImageUrl?: string;
    yesPercentage: number;
    noPercentage: number;
    poolBalance?: number;
    targetPool?: number;
    endTime?: string;
    status?: string;
  };
  onPress: () => void;
}

export function MarketCard({ market, onPress }: MarketCardProps) {
  return (
    <PressableScale onPress={onPress} style={StyleSheet.flatten([styles.card, shadows.md])}>
      {market.projectImageUrl && (
        <Image
          source={{ uri: market.projectImageUrl }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
      )}
      <View style={styles.body}>
        <View style={styles.topRow}>
          {market.category && <CategoryPill label={market.category} variant="tag" />}
          <View style={styles.topRight}>
            {market.status === 'active' && <LiveDot />}
            {market.endTime && <TimeCountdown endTime={market.endTime} />}
          </View>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {market.title}
        </Text>
        <VoteGauge yesPercent={market.yesPercentage} noPercent={market.noPercentage} variant="compact" />
        {market.poolBalance != null && market.targetPool != null && (
          <View style={styles.poolRow}>
            <Text style={styles.poolText}>
              {market.poolBalance.toFixed(1)} / {market.targetPool.toFixed(1)} SOL
            </Text>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  image: {
    width: '100%',
    height: 120,
  },
  body: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  poolRow: {
    flexDirection: 'row',
  },
  poolText: {
    ...typography.micro,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },
});
