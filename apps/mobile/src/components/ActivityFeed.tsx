/**
 * ActivityFeed — Voting history list (ported from web LiveActivityFeed.tsx)
 */

import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiUrl } from '@pnl/shared/utils';
import { useNetwork } from '@pnl/shared/hooks';
import { colors, spacing, borderRadius, typography } from '../theme';

interface Trade {
  id: string;
  traderWallet: string;
  voteType: 'yes' | 'no';
  amount: number;
  yesPrice: number;
  noPrice: number;
  signature: string;
  timestamp: number;
  timeAgo: string;
}

interface ActivityFeedProps {
  marketId: string;
}

function shortenAddress(address: string): string {
  if (!address || address.length < 12) return address || '';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function ActivityFeed({ marketId }: ActivityFeedProps) {
  const { network } = useNetwork();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchTrades = async () => {
      try {
        setLoading(true);
        const res = await fetch(apiUrl(`/api/markets/${marketId}/activity?network=${network}`));
        const data = await res.json();
        if (mounted && data.success) {
          const raw = data.data?.trades ?? data.data;
          setTrades(Array.isArray(raw) ? raw : []);
        }
      } catch {
        // silently fail
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchTrades();
    return () => { mounted = false; };
  }, [marketId, network]);

  // Deduplicate by id
  const uniqueTrades = useMemo(() => {
    const seen = new Set<string>();
    return trades.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [trades]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={colors.textMuted} />
        <Text style={styles.emptyText}>Loading activity...</Text>
      </View>
    );
  }

  if (uniqueTrades.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyEmoji}>💬</Text>
        <Text style={styles.emptyTitle}>No votes yet</Text>
        <Text style={styles.emptyText}>Votes will appear here</Text>
      </View>
    );
  }

  const renderTrade = ({ item }: { item: Trade }) => {
    const isYes = item.voteType === 'yes';
    return (
      <View style={styles.tradeRow}>
        <Ionicons
          name={isYes ? 'trending-up' : 'trending-down'}
          size={18}
          color={isYes ? colors.success : colors.danger}
          style={styles.tradeIcon}
        />
        <View style={styles.tradeBody}>
          <View style={styles.tradeTopRow}>
            <Text style={styles.walletText}>{shortenAddress(item.traderWallet)}</Text>
            <Text style={styles.timeAgo}>{item.timeAgo}</Text>
          </View>
          <Text style={styles.tradeDetail}>
            Voted{' '}
            <Text style={{ color: isYes ? colors.success : colors.danger, fontWeight: '600' }}>
              {item.voteType.toUpperCase()}
            </Text>
            {' '}with{' '}
            <Text style={{ color: '#22d3ee', fontWeight: '500' }}>
              {(item.amount || 0).toFixed(3)} SOL
            </Text>
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>YES: {item.yesPrice}%</Text>
            <Text style={styles.priceDot}>•</Text>
            <Text style={styles.priceText}>NO: {item.noPrice}%</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View>
      <Text style={styles.sectionTitle}>Voting History</Text>
      <FlatList
        data={uniqueTrades}
        keyExtractor={(item) => item.id}
        renderItem={renderTrade}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyEmoji: { fontSize: 32 },
  emptyTitle: { ...typography.body, color: colors.textSecondary },
  emptyText: { ...typography.caption, color: colors.textMuted },
  sectionTitle: { ...typography.title, color: colors.textPrimary, marginBottom: spacing.md },
  tradeRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    padding: spacing.sm, borderRadius: borderRadius.md,
    backgroundColor: 'rgba(31,41,55,0.3)', borderWidth: 1, borderColor: 'rgba(55,65,81,0.3)',
  },
  tradeIcon: { marginTop: 2 },
  tradeBody: { flex: 1, gap: 2 },
  tradeTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  walletText: { ...typography.captionBold, color: colors.textSecondary, fontFamily: undefined, fontVariant: ['tabular-nums'] },
  timeAgo: { ...typography.micro, color: colors.textMuted },
  tradeDetail: { ...typography.caption, color: colors.textMuted },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  priceText: { ...typography.micro, color: colors.textMuted },
  priceDot: { ...typography.micro, color: colors.textMuted },
});
