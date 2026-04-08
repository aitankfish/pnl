import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { colors, spacing, borderRadius } from '../theme';

interface CategoryChipProps {
  selected: string;
  onPress: () => void;
  onClear: () => void;
}

export function CategoryChip({ selected, onPress, onClear }: CategoryChipProps) {
  const isAll = selected === 'All';

  return (
    <View style={styles.wrapper}>
      <PressableScale
        onPress={onPress}
        style={[styles.chip, !isAll && styles.chipSelected]}
      >
        {isAll ? (
          <>
            <Ionicons name="filter" size={14} color={colors.textSecondary} />
            <Text style={styles.text}>All Categories</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </>
        ) : (
          <>
            <Text style={[styles.text, styles.textSelected]}>{selected}</Text>
            <PressableScale
              onPress={(e) => {
                e?.stopPropagation?.();
                onClear();
              }}
              scaleDown={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearBtn}
            >
              <Ionicons name="close" size={12} color="#fff" />
            </PressableScale>
          </>
        )}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 14,
    borderRadius: borderRadius.full,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chipSelected: {
    borderColor: 'rgba(139, 92, 246, 0.5)',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  textSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  clearBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(139, 92, 246, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
