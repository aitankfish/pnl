import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { PressableScale } from './PressableScale';
import { colors, typography, spacing } from '../theme';

interface SectionHeaderProps {
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function SectionHeader({ title, count, actionLabel, onAction, style }: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {count != null && (
          <View style={styles.badge}>
            <Text style={styles.count}>{count}</Text>
          </View>
        )}
      </View>
      {actionLabel && onAction && (
        <PressableScale onPress={onAction}>
          <Text style={styles.action}>{actionLabel}</Text>
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  badge: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  count: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  action: {
    ...typography.captionBold,
    color: colors.primary,
  },
});
