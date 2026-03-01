import React from 'react';
import { Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { PressableScale } from './PressableScale';
import { colors, spacing, borderRadius } from '../theme';

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
      <Text style={[styles.label, isFilter && styles.filterLabel, active && styles.activeLabel]}>
        {label.toUpperCase()}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  active: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: 'rgba(139, 92, 246, 0.6)',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#c4b5fd',
  },
  filterLabel: {
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: 'none' as any,
    color: colors.textPrimary,
  },
  activeLabel: {
    color: '#c4b5fd',
  },
});
