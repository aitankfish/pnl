import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, typography, spacing, borderRadius } from '../theme';
import { springs } from '../theme/animations';

type Variant = 'compact' | 'detailed' | 'large';

interface VoteGaugeProps {
  yesPercent: number;
  noPercent: number;
  yesCount?: number;
  noCount?: number;
  variant?: Variant;
  style?: ViewStyle;
}

export function VoteGauge({
  yesPercent,
  noPercent,
  yesCount,
  noCount,
  variant = 'compact',
  style,
}: VoteGaugeProps) {
  const yesWidth = useSharedValue(0);

  useEffect(() => {
    yesWidth.value = withSpring(yesPercent, springs.gentle);
  }, [yesPercent]);

  const yesBarStyle = useAnimatedStyle(() => ({
    width: `${yesWidth.value}%` as any,
  }));

  const isLarge = variant === 'large';
  const isDetailed = variant === 'detailed';
  const barHeight = isLarge ? 12 : isDetailed ? 8 : 6;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.labels}>
        <View style={styles.labelRow}>
          <View style={[styles.dot, { backgroundColor: colors.success }]} />
          <Text style={[isLarge ? styles.labelLarge : styles.label, { color: colors.success }]}>
            YES {Math.round(yesPercent)}%
          </Text>
          {isDetailed && yesCount != null && (
            <Text style={styles.count}>{yesCount} votes</Text>
          )}
        </View>
        <View style={styles.labelRow}>
          {isDetailed && noCount != null && (
            <Text style={styles.count}>{noCount} votes</Text>
          )}
          <Text style={[isLarge ? styles.labelLarge : styles.label, { color: colors.danger }]}>
            NO {Math.round(noPercent)}%
          </Text>
          <View style={[styles.dot, { backgroundColor: colors.danger }]} />
        </View>
      </View>
      <View style={[styles.track, { height: barHeight }]}>
        <Animated.View style={[styles.yesBar, { height: barHeight }, yesBarStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
  },
  labelLarge: {
    ...typography.bodyBold,
  },
  count: {
    ...typography.micro,
    color: colors.textMuted,
  },
  track: {
    borderRadius: borderRadius.full,
    backgroundColor: colors.dangerLight,
    overflow: 'hidden',
  },
  yesBar: {
    borderRadius: borderRadius.full,
    backgroundColor: colors.success,
  },
});
