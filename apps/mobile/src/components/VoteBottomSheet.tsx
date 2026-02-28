import React, { forwardRef, useCallback, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import GorhomBottomSheet from '@gorhom/bottom-sheet';
import { BottomSheet } from './BottomSheet';
import { PressableScale } from './PressableScale';
import { colors, typography, spacing, borderRadius } from '../theme';
import * as Haptics from 'expo-haptics';

type Direction = 'yes' | 'no';
const QUICK_AMOUNTS = [0.1, 0.5, 1, 5];

interface VoteBottomSheetProps {
  direction: Direction | null;
  marketTitle: string;
  onConfirm: (direction: Direction, amount: number) => void;
  onClose: () => void;
}

export const VoteBottomSheet = forwardRef<GorhomBottomSheet, VoteBottomSheetProps>(
  ({ direction, marketTitle, onConfirm, onClose }, ref) => {
    const [amount, setAmount] = useState('');

    const handleQuickAmount = useCallback((val: number) => {
      setAmount(val.toString());
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, []);

    const handleConfirm = useCallback(() => {
      if (!direction || !amount) return;
      const num = parseFloat(amount);
      if (isNaN(num) || num <= 0) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onConfirm(direction, num);
      setAmount('');
    }, [direction, amount, onConfirm]);

    const isYes = direction === 'yes';
    const color = isYes ? colors.success : colors.danger;
    const label = isYes ? 'YES' : 'NO';

    return (
      <BottomSheet ref={ref} snapPoints={['65%']} onClose={onClose}>
        <View style={styles.container}>
          <View style={[styles.directionBadge, { backgroundColor: isYes ? colors.successLight : colors.dangerLight }]}>
            <Text style={[styles.directionText, { color }]}>Vote {label}</Text>
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {marketTitle}
          </Text>

          <Text style={styles.label}>Amount (SOL)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            selectionColor={colors.primary}
          />

          <View style={styles.chipRow}>
            {QUICK_AMOUNTS.map(val => (
              <PressableScale
                key={val}
                onPress={() => handleQuickAmount(val)}
                style={[styles.chip, amount === val.toString() && { borderColor: color }]}
              >
                <Text style={styles.chipText}>{val} SOL</Text>
              </PressableScale>
            ))}
          </View>

          {/* Trade summary */}
          {amount ? (
            <View style={styles.tradeSummary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Position</Text>
                <Text style={[styles.summaryValue, { color }]}>{label}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={styles.summaryValue}>{amount} SOL</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Fee (1.5%)</Text>
                <Text style={styles.summaryValue}>
                  {(parseFloat(amount) * 0.015).toFixed(4)} SOL
                </Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryTotal]}>
                <Text style={styles.summaryTotalLabel}>Total Cost</Text>
                <Text style={styles.summaryTotalValue}>
                  {(parseFloat(amount) * 1.015).toFixed(4)} SOL
                </Text>
              </View>
            </View>
          ) : null}

          <PressableScale
            onPress={handleConfirm}
            style={[styles.confirmButton, { backgroundColor: color, opacity: amount ? 1 : 0.4 }]}
            disabled={!amount}
          >
            <Text style={styles.confirmText}>
              Confirm {label} — {amount || '0'} SOL
            </Text>
          </PressableScale>
        </View>
      </BottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  directionBadge: {
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  directionText: {
    ...typography.bodyBold,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  label: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: colors.surface,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipText: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  tradeSummary: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    gap: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  summaryValue: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs + 2,
    marginTop: spacing.xs,
  },
  summaryTotalLabel: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  summaryTotalValue: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  confirmButton: {
    paddingVertical: 16,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
