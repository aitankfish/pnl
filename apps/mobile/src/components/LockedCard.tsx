/**
 * LockedCard — Shown when market is unresolved to hide activity/holder data
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../theme';

export function LockedCard() {
  return (
    <View style={styles.card}>
      <Ionicons name="lock-closed" size={28} color={colors.textMuted} />
      <Text style={styles.title}>Voting in Progress</Text>
      <Text style={styles.subtitle}>
        Holder positions and activity are hidden until the market resolves to ensure fair, unbiased voting.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.glass,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: spacing.sm,
  },
  title: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
