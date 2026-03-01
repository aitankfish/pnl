import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../theme';
import { springs } from '../theme/animations';
import { GlassCard } from './GlassCard';

type Variant = 'inline' | 'card';

interface PoolProgressProps {
  current: number;
  target: number;
  tokenSymbol?: string;
  variant?: Variant;
  participants?: number;
  style?: StyleProp<ViewStyle>;
}

export function PoolProgress({
  current,
  target,
  tokenSymbol = 'SOL',
  variant = 'inline',
  participants,
  style,
}: PoolProgressProps) {
  const progress = useSharedValue(0);
  const hasTarget = Number.isFinite(target) && target > 0;
  const pct = hasTarget ? Math.min((current / target) * 100, 100) : 0;

  useEffect(() => {
    progress.value = withSpring(pct, springs.gentle);
  }, [pct]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%` as any,
  }));

  const amountText = hasTarget
    ? `${Number.isFinite(current) ? current.toFixed(2) : '0.00'} / ${target.toFixed(2)} ${tokenSymbol}`
    : `${Number.isFinite(current) ? current.toFixed(2) : '0.00'} ${tokenSymbol} raised`;

  const content = (
    <>
      <View style={styles.labelRow}>
        <Text style={styles.amount}>{amountText}</Text>
        <View style={styles.labelRight}>
          {participants != null && participants > 0 && (
            <View style={styles.participantsRow}>
              <Ionicons name="people-outline" size={11} color={colors.textMuted} />
              <Text style={styles.participantsText}>{participants}</Text>
            </View>
          )}
          {hasTarget && <Text style={styles.percent}>{Math.round(pct)}%</Text>}
        </View>
      </View>
      {hasTarget && (
        <View style={styles.track}>
          <Animated.View style={[styles.fill, barStyle]} />
        </View>
      )}
    </>
  );

  if (variant === 'card') {
    return (
      <GlassCard style={[styles.card, style]}>
        <Text style={styles.cardTitle}>Pool Progress</Text>
        {content}
      </GlassCard>
    );
  }

  return <View style={[styles.inline, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  inline: { gap: 4 },
  card: { padding: spacing.md, gap: 8 },
  cardTitle: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amount: {
    ...typography.caption,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  percent: {
    ...typography.micro,
    color: colors.textMuted,
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  participantsText: {
    ...typography.micro,
    color: colors.textMuted,
  },
  track: {
    height: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
});
