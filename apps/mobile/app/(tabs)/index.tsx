/**
 * Markets List (Home Tab)
 * - Sticky search bar (collapses on scroll)
 * - Horizontal category pills
 * - Trending hero cards + active markets list
 * - Real-time Socket.IO updates
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORIES = ['All', 'DeFi', 'AI', 'Gaming', 'DAO', 'NFT', 'Social'];

// Placeholder market card - will be replaced with real data from useMarkets
function MarketCard({ market }: { market: any }) {
  return (
    <TouchableOpacity
      style={styles.marketCard}
      activeOpacity={0.7}
      onPress={() => router.push(`/market/${market.id}`)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryText}>{market.category}</Text>
        </View>
        <View style={styles.timePill}>
          <Ionicons name="time-outline" size={12} color={colors.textMuted} />
          <Text style={styles.timeText}>{market.timeLeft}</Text>
        </View>
      </View>

      <Text style={styles.marketTitle} numberOfLines={2}>{market.name}</Text>

      <View style={styles.voteBar}>
        <View style={[styles.yesBar, { flex: market.yesPercent }]}>
          <Text style={styles.voteBarText}>YES {market.yesPercent}%</Text>
        </View>
        <View style={[styles.noBar, { flex: 100 - market.yesPercent }]}>
          <Text style={styles.voteBarText}>NO {100 - market.yesPercent}%</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.poolText}>{market.poolSize} SOL</Text>
        <View style={styles.progressContainer}>
          <View style={[styles.progressFill, { width: `${market.poolProgress}%` }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MarketsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  // Mock data - will be replaced with useMarkets from @pnl/shared/hooks
  const markets = [
    { id: '1', name: 'Will AI agents replace 50% of DeFi traders by 2026?', category: 'AI', yesPercent: 68, poolSize: '12.5', poolProgress: 83, timeLeft: '2d 14h' },
    { id: '2', name: 'Solana TVL to exceed $20B by Q3 2026?', category: 'DeFi', yesPercent: 45, poolSize: '8.2', poolProgress: 55, timeLeft: '5d 8h' },
    { id: '3', name: 'Gaming DAO treasury to surpass Uniswap?', category: 'Gaming', yesPercent: 23, poolSize: '3.7', poolProgress: 25, timeLeft: '12d' },
  ];

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search markets..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Category Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryContainer}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryFilterPill,
              selectedCategory === cat && styles.categoryFilterActive,
            ]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text
              style={[
                styles.categoryFilterText,
                selectedCategory === cat && styles.categoryFilterTextActive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Markets List */}
      <FlatList
        data={markets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MarketCard market={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>Active Markets</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 60,
  },
  searchContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.textPrimary,
    fontSize: 16,
  },
  categoryContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  categoryFilterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  categoryFilterActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryFilterText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  categoryFilterTextActive: {
    color: colors.textPrimary,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  listContent: {
    paddingBottom: 100,
  },
  marketCard: {
    backgroundColor: colors.glass,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  categoryPill: {
    backgroundColor: `${colors.primary}20`,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  categoryText: {
    ...typography.micro,
    color: colors.primary,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    ...typography.micro,
    color: colors.textMuted,
  },
  marketTitle: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  voteBar: {
    flexDirection: 'row',
    height: 32,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  yesBar: {
    backgroundColor: `${colors.success}30`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noBar: {
    backgroundColor: `${colors.danger}30`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voteBarText: {
    ...typography.micro,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  poolText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  progressContainer: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginLeft: spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
});
