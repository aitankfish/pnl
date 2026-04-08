/**
 * VoteHistorySheet — Bottom sheet showing per-position vote/trade history
 */

import React, { forwardRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import useSWR from 'swr';
import { fetcher, type ApiResponse } from '@pnl/shared/services';
import { PressableScale } from './PressableScale';
import { GlassCard } from './GlassCard';
import type { Position } from '../hooks/usePositions';
import { colors, spacing, borderRadius, typography } from '../theme';

interface VoteHistoryEntry {
  voteType: 'yes' | 'no';
  amount: number;
  timestamp: string;
  signature: string;
}

interface VoteHistoryApiResponse {
  trades: VoteHistoryEntry[];
  summary: {
    totalInvested: number;
    totalYesAmount: number;
    totalNoAmount: number;
    yesTradeCount: number;
    noTradeCount: number;
    totalTrades: number;
  };
}

interface VoteHistorySheetProps {
  position: Position | null;
  walletAddress: string;
  onClose: () => void;
}

export const VoteHistorySheet = forwardRef<GorhomBottomSheet, VoteHistorySheetProps>(
  ({ position, walletAddress, onClose }, ref) => {
    const snapPoints = useMemo(() => ['70%'], []);

    const { data, isLoading } = useSWR<ApiResponse<VoteHistoryApiResponse>>(
      position
        ? `/api/markets/${position.marketId}/vote-history?wallet=${walletAddress}`
        : null,
      fetcher,
      { dedupingInterval: 10_000 },
    );

    const apiData = data?.data ?? null;
    const history = apiData ? {
      yesVotes: apiData.summary.yesTradeCount,
      yesTotal: apiData.summary.totalYesAmount,
      noVotes: apiData.summary.noTradeCount,
      noTotal: apiData.summary.totalNoAmount,
      totalInvested: apiData.summary.totalInvested,
      trades: apiData.trades,
    } : null;

    const renderBackdrop = (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.6} />
    );

    return (
      <GorhomBottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onClose}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>
            Vote History
          </Text>
          {position && (
            <Text style={styles.marketName} numberOfLines={1}>
              {position.marketName}
            </Text>
          )}

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Loading history...</Text>
            </View>
          ) : history ? (
            <>
              {/* Summary row */}
              <View style={styles.summaryRow}>
                <GlassCard style={styles.summaryCard}>
                  <Ionicons name="trending-up" size={16} color={colors.success} />
                  <Text style={styles.summaryLabel}>YES</Text>
                  <Text style={styles.summaryCount}>{history.yesVotes} votes</Text>
                  <Text style={styles.summaryAmount}>{history.yesTotal.toFixed(3)} SOL</Text>
                </GlassCard>
                <GlassCard style={styles.summaryCard}>
                  <Ionicons name="trending-down" size={16} color={colors.danger} />
                  <Text style={styles.summaryLabel}>NO</Text>
                  <Text style={styles.summaryCount}>{history.noVotes} votes</Text>
                  <Text style={styles.summaryAmount}>{history.noTotal.toFixed(3)} SOL</Text>
                </GlassCard>
              </View>

              {/* Total invested */}
              <GlassCard style={styles.totalCard}>
                <Text style={styles.totalLabel}>Total Invested</Text>
                <Text style={styles.totalValue}>
                  {history.totalInvested.toFixed(4)} SOL
                </Text>
              </GlassCard>

              {/* Trade list */}
              <Text style={styles.tradesTitle}>Trades</Text>
              {history.trades.length > 0 ? (
                history.trades.map((trade, i) => (
                  <View key={`${trade.signature}-${i}`} style={styles.tradeRow}>
                    <View
                      style={[
                        styles.tradeBadge,
                        {
                          backgroundColor:
                            trade.voteType === 'yes'
                              ? 'rgba(16, 185, 129, 0.15)'
                              : 'rgba(239, 68, 68, 0.15)',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tradeBadgeText,
                          {
                            color:
                              trade.voteType === 'yes' ? colors.success : colors.danger,
                          },
                        ]}
                      >
                        {trade.voteType.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.tradeInfo}>
                      <Text style={styles.tradeAmount}>
                        {trade.amount.toFixed(4)} SOL
                      </Text>
                      <Text style={styles.tradeTime}>
                        {new Date(trade.timestamp).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <PressableScale
                      onPress={() =>
                        Linking.openURL(`https://orb.helius.dev/tx/${trade.signature}`)
                      }
                    >
                      <Ionicons name="open-outline" size={16} color={colors.primary} />
                    </PressableScale>
                  </View>
                ))
              ) : (
                <Text style={styles.noTrades}>No trades recorded</Text>
              )}
            </>
          ) : (
            <View style={styles.loading}>
              <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
              <Text style={styles.loadingText}>No history available</Text>
            </View>
          )}
        </BottomSheetScrollView>
      </GorhomBottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  background: {
    backgroundColor: colors.sheetBackground,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
  },
  handle: {
    backgroundColor: colors.sheetHandle,
    width: 40,
  },
  content: {
    padding: spacing.md,
    paddingBottom: 40,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  marketName: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  summaryLabel: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 13,
  },
  summaryCount: {
    ...typography.micro,
    color: colors.textMuted,
  },
  summaryAmount: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },

  // Total
  totalCard: {
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  totalLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  totalValue: {
    ...typography.numericLarge,
    color: colors.textPrimary,
    fontSize: 20,
  },

  // Trades
  tradesTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tradeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    minWidth: 40,
    alignItems: 'center',
  },
  tradeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tradeInfo: {
    flex: 1,
  },
  tradeAmount: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  tradeTime: {
    ...typography.micro,
    color: colors.textMuted,
  },
  noTrades: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
