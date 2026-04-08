import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { LiveDot } from './LiveDot';
import { colors, spacing, borderRadius } from '../theme';

export type SmartFilter = 'all' | 'hot' | 'new' | 'ending_soon' | 'favorites' | 'big_pools' | 'live';

interface PillDef {
  key: SmartFilter;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const PILLS: PillDef[] = [
  { key: 'all', label: 'All', icon: 'grid-outline' },
  { key: 'hot', label: 'Hot', icon: 'flame-outline' },
  { key: 'new', label: 'New', icon: 'sparkles-outline' },
  { key: 'ending_soon', label: 'Ending Soon', icon: 'timer-outline' },
  { key: 'favorites', label: 'Favorites', icon: 'heart-outline' },
  { key: 'big_pools', label: 'Big Pools', icon: 'wallet-outline' },
  { key: 'live', label: 'Live', icon: 'mic-outline' },
];

interface SmartFilterPillsProps {
  selected: SmartFilter;
  onSelect: (filter: SmartFilter) => void;
  hasActiveVoiceRooms?: boolean;
}

export function SmartFilterPills({ selected, onSelect, hasActiveVoiceRooms }: SmartFilterPillsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {PILLS.map((pill) => {
        const active = selected === pill.key;
        return (
          <PressableScale
            key={pill.key}
            onPress={() => onSelect(pill.key)}
            haptic
            style={[styles.pill, active && styles.pillActive]}
          >
            <Ionicons
              name={pill.icon}
              size={16}
              color={active ? '#c4b5fd' : colors.textSecondary}
            />
            <Text style={[styles.label, active && styles.labelActive]}>
              {pill.label}
            </Text>
            {pill.key === 'live' && hasActiveVoiceRooms && (
              <LiveDot size={6} style={styles.liveDot} />
            )}
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  pillActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: 'rgba(139, 92, 246, 0.6)',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  labelActive: {
    color: '#c4b5fd',
  },
  liveDot: {
    marginLeft: 2,
  },
});
