import React from 'react';
import { View, Text, StyleSheet, ViewStyle, ScrollView } from 'react-native';
import { PressableScale } from './PressableScale';
import { colors, typography, spacing, borderRadius } from '../theme';

interface SectionHeaderProps {
  title: string;
  count?: number;
  actionLabel?: string;
  onAction?: () => void;
  sortOptions?: string[];
  selectedSort?: string;
  onSortChange?: (sort: string) => void;
  style?: ViewStyle;
}

export function SectionHeader({
  title,
  count,
  actionLabel,
  onAction,
  sortOptions,
  selectedSort,
  onSortChange,
  style,
}: SectionHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.topRow}>
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
      {sortOptions && sortOptions.length > 0 && onSortChange && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortRow}
        >
          {sortOptions.map((option) => {
            const isActive = option === selectedSort;
            return (
              <PressableScale
                key={option}
                onPress={() => onSortChange(option)}
                style={[styles.sortChip, isActive && styles.sortChipActive]}
              >
                <Text style={[styles.sortChipText, isActive && styles.sortChipTextActive]}>
                  {option}
                </Text>
              </PressableScale>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  sortRow: {
    gap: 6,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  sortChipActive: {
    borderColor: 'rgba(139, 92, 246, 0.6)',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  sortChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sortChipTextActive: {
    color: '#c4b5fd',
  },
});
