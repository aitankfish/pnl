import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius } from '../theme';
import { springs } from '../theme/animations';
import { GlassCard } from './GlassCard';

type Variant = 'inline' | 'card';

interface PoolProgressProps {
  current: number;
  target: number;
  tokenSymbol?: string;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
}

export function PoolProgress({
  current,
  target,
  tokenSymbol = 'SOL',
  variant = 'inline',
  style,
}: PoolProgressProps) {
  const progress = useSharedValue(0);
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  useEffect(() => {
    progress.value = withSpring(pct, springs.gentle);
  }, [pct]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value}%` as any,
  }));

  const content = (
    <>
      <View style={styles.labelRow}>
        <Text style={styles.amount}>
          {current.toFixed(1)} / {target.toFixed(1)} {tokenSymbol}
        </Text>
        <Text style={styles.percent}>{Math.round(pct)}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, barStyle]} />
      </View>
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
  amount: {
    ...typography.caption,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  percent: {
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
