import React, { forwardRef, useCallback, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import GorhomBottomSheet, { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from './BottomSheet';
import { PressableScale } from './PressableScale';
import { colors, typography, spacing, borderRadius } from '../theme';
import * as Haptics from 'expo-haptics';

type Direction = 'yes' | 'no';
const QUICK_AMOUNTS = [0.1, 0.5, 1, 5];

interface PositionData {
  hasPosition: boolean;
  side: 'yes' | 'no' | null;
  totalAmount: number;
}

interface VoteBottomSheetProps {
  direction: Direction | null;
  marketTitle: string;
  solBalance?: number;
  positionData?: PositionData | null;
  onConfirm: (direction: Direction, amount: number) => void;
  onClose: () => void;
}

export const VoteBottomSheet = forwardRef<GorhomBottomSheet, VoteBottomSheetProps>(
  ({ direction, marketTitle, solBalance, positionData, onConfirm, onClose }, ref) => {
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
      <BottomSheet ref={ref} snapPoints={['80%']} onClose={onClose}>
        <View style={styles.container}>
          <View style={[styles.directionBadge, { backgroundColor: isYes ? colors.successLight : colors.dangerLight }]}>
            <Text style={[styles.directionText, { color }]}>Vote {label}</Text>
          </View>

          <Text style={styles.title} numberOfLines={2}>
            {marketTitle}
          </Text>

          {positionData?.hasPosition && (
            <View style={styles.positionBanner}>
              <Ionicons name="wallet-outline" size={14} color={positionData.side === 'yes' ? colors.success : colors.danger} />
              <Text style={styles.positionText}>
                Your position: <Text style={{ color: positionData.side === 'yes' ? colors.success : colors.danger, fontWeight: '700' }}>{positionData.side?.toUpperCase()}</Text> — {positionData.totalAmount.toFixed(4)} SOL
              </Text>
            </View>
          )}

          <View style={styles.labelRow}>
            <Text style={styles.label}>Amount (SOL)</Text>
            {solBalance != null && (
              <Text style={styles.balanceText}>Balance: {solBalance.toFixed(4)} SOL</Text>
            )}
          </View>
          <BottomSheetTextInput
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
    gap: spacing.sm,
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
  positionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  positionText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    ...typography.captionBold,
    color: colors.textSecondary,
  },
  balanceText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.6)',
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
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
  },
  chipText: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  tradeSummary: {
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    borderRadius: borderRadius.md,
    padding: spacing.sm + 2,
    gap: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.glassBorder,
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
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
