import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, borderRadius, spacing } from '../theme';

interface SkeletonCardProps {
  fullScreen?: boolean;
  style?: ViewStyle;
}

export function SkeletonCard({ fullScreen, style }: SkeletonCardProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (fullScreen) {
    return (
      <Animated.View style={[styles.fullScreen, pulseStyle, style]}>
        <View style={styles.fullBar} />
        <View style={styles.fullBarShort} />
        <View style={[styles.fullBar, { marginTop: 'auto', marginBottom: 80 }]} />
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.card, pulseStyle, style]}>
      <View style={styles.imagePlaceholder} />
      <View style={styles.cardBody}>
        <View style={styles.bar} />
        <View style={styles.barShort} />
        <View style={[styles.barShort, { width: '40%' }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  imagePlaceholder: {
    height: 100,
    backgroundColor: colors.surfaceElevated,
  },
  cardBody: {
    padding: spacing.md,
    gap: 8,
  },
  bar: {
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    width: '80%',
  },
  barShort: {
    height: 10,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    width: '60%',
  },
  fullScreen: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: 16,
  },
  fullBar: {
    height: 20,
    borderRadius: 6,
    backgroundColor: colors.surfaceElevated,
    width: '75%',
  },
  fullBarShort: {
    height: 14,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    width: '50%',
  },
});
