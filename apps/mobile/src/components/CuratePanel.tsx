import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { CategoryPill } from './CategoryPill';
import { PressableScale } from './PressableScale';
import type { CuratePreferences, CurateSortOption, TimeRange } from '../hooks/useCuratePreferences';
import { colors, spacing, borderRadius } from '../theme';

const CATEGORIES = [
  'All', 'DeFi', 'Gaming', 'Meme', 'AI/ML', 'Social', 'Infrastructure',
  'DAO', 'Creator', 'NFT', 'Healthcare', 'Science', 'Education', 'Finance',
  'Commerce', 'Real Estate', 'Energy', 'Media', 'Manufacturing', 'Mobility', 'Other',
];

const SORT_OPTIONS: { key: CurateSortOption; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'most_active', label: 'Most Active', icon: 'flame-outline' },
  { key: 'biggest_pools', label: 'Biggest Pools', icon: 'wallet-outline' },
  { key: 'most_favorited', label: 'Most Favorited', icon: 'heart-outline' },
  { key: 'newest', label: 'Newest First', icon: 'sparkles-outline' },
  { key: 'ending_soonest', label: 'Ending Soonest', icon: 'timer-outline' },
];

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
];

interface CuratePanelProps {
  preferences: CuratePreferences;
  updatePreferences: (partial: Partial<CuratePreferences>) => void;
  resetToDefaults: () => void;
  onClose?: () => void;
}

export function CuratePanel({ preferences, updatePreferences, resetToDefaults, onClose }: CuratePanelProps) {
  const toggleCategory = (cat: string) => {
    if (cat === 'All') {
      updatePreferences({ categories: ['All'] });
      return;
    }
    const current = preferences.categories.filter((c) => c !== 'All');
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    updatePreferences({ categories: next.length === 0 ? ['All'] : next });
  };

  return (
    <BottomSheetScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Curate Feed</Text>
          <Text style={styles.subtitle}>Changes apply instantly</Text>
        </View>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Sort + Time in a compact row */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Sort By</Text>
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => {
            const active = preferences.sortBy === opt.key;
            return (
              <PressableScale
                key={opt.key}
                onPress={() => updatePreferences({ sortBy: opt.key })}
                haptic
                style={[styles.sortChip, active && styles.sortChipActive]}
              >
                <Ionicons
                  name={opt.icon}
                  size={14}
                  color={active ? '#c4b5fd' : colors.textMuted}
                />
                <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                  {opt.label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Time Range</Text>
        <View style={styles.timeRow}>
          {TIME_RANGES.map((tr) => {
            const active = preferences.timeRange === tr.key;
            return (
              <PressableScale
                key={tr.key}
                onPress={() => updatePreferences({ timeRange: tr.key })}
                haptic
                style={[styles.timePill, active && styles.timePillActive]}
              >
                <Text style={[styles.timeLabel, active && styles.timeLabelActive]}>
                  {tr.label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      {/* Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Categories</Text>
        <View style={styles.pillGrid}>
          {CATEGORIES.map((cat) => (
            <CategoryPill
              key={cat}
              label={cat}
              variant="filter"
              active={
                cat === 'All'
                  ? preferences.categories.includes('All')
                  : preferences.categories.includes(cat)
              }
              onPress={() => toggleCategory(cat)}
              style={styles.compactPill}
            />
          ))}
        </View>
      </View>

      {/* Reset */}
      <PressableScale onPress={resetToDefaults} style={styles.resetButton}>
        <Ionicons name="refresh-outline" size={14} color={colors.primary} />
        <Text style={styles.resetText}>Reset to Defaults</Text>
      </PressableScale>
    </BottomSheetScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.5)',
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sortChipTextActive: {
    color: '#c4b5fd',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timePill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timePillActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.5)',
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  timeLabelActive: {
    color: '#c4b5fd',
  },
  pillGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  compactPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  resetButton: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  resetText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
