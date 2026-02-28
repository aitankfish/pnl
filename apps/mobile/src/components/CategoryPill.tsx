import React from 'react';
import { Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { PressableScale } from './PressableScale';
import { colors, typography, spacing, borderRadius } from '../theme';

type Variant = 'tag' | 'filter';

interface CategoryPillProps {
  label: string;
  active?: boolean;
  variant?: Variant;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function CategoryPill({
  label,
  active = false,
  variant = 'tag',
  onPress,
  style,
}: CategoryPillProps) {
  const isFilter = variant === 'filter';

  return (
    <PressableScale
      onPress={onPress}
      haptic={isFilter}
      style={[
        styles.pill,
        isFilter && styles.filterPill,
        active && styles.active,
        style,
      ]}
    >
      <Text style={[styles.label, active && styles.activeLabel]}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  active: {
    backgroundColor: colors.primary,
  },
  label: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  activeLabel: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
