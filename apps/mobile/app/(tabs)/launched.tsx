/**
 * Launched Tokens Screen — tokens from resolved YesWins markets
 * Includes real-time socket listener for new token launches
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  RefreshControl,
} from 'react-native';
import GorhomBottomSheet from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAllMarketsSocket } from '@pnl/shared/hooks';
import {
  ScreenHeader,
  SkeletonCard,
  EmptyState,
  PressableScale,
  SectionHeader,
  CategoryChip,
  CategorySheet,
} from '../../src/components';
import { LaunchedTokenCard } from '../../src/components/LaunchedTokenCard';
import { useLaunchedTokens } from '../../src/hooks/useLaunchedTokens';
import { useTokenStats } from '../../src/hooks/useTokenStats';
import { colors, spacing, borderRadius } from '../../src/theme';

const CATEGORIES = [
  'All', 'DeFi', 'Gaming', 'NFT', 'AI/ML', 'Social', 'Infrastructure', 'DAO', 'Meme', 'Creator',
  'Healthcare', 'Science', 'Education', 'Finance', 'Commerce', 'Real Estate', 'Energy', 'Media',
  'Manufacturing', 'Mobility', 'Other',
];

const SORT_OPTIONS = ['Gainers', 'Losers', 'MCap', 'New'] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

export default function LaunchedScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const categorySheetRef = useRef<GorhomBottomSheet>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('New');
  const [refreshing, setRefreshing] = useState(false);

  // Map UI category names to API values
  const categoryParam = useMemo(() => {
    if (selectedCategory === 'All') return 'all';
    const map: Record<string, string> = {
      'DeFi': 'defi', 'Gaming': 'gaming', 'NFT': 'nft', 'AI/ML': 'ai',
      'Social': 'social', 'Infrastructure': 'infrastructure', 'DAO': 'dao',
      'Meme': 'meme', 'Creator': 'creator', 'Healthcare': 'healthcare',
      'Science': 'science', 'Education': 'education', 'Finance': 'finance',
      'Commerce': 'commerce', 'Real Estate': 'realestate', 'Energy': 'energy',
      'Media': 'media', 'Manufacturing': 'manufacturing', 'Mobility': 'mobility',
      'Other': 'other',
    };
    return map[selectedCategory] ?? selectedCategory.toLowerCase();
  }, [selectedCategory]);

  const { tokens, total, isLoading, error, refresh } = useLaunchedTokens(1, 50, categoryParam);

  // ── Socket: listen for new token launches ──
  const { marketUpdates } = useAllMarketsSocket();
  const [newLaunchCount, setNewLaunchCount] = useState(0);
  const seenLaunchesRef = useRef(new Set<string>());

  // Seed seen launches with current token IDs
  useEffect(() => {
    tokens.forEach((t) => seenLaunchesRef.current.add(t.marketAddress));
  }, [tokens]);

  // Detect new YesWins resolutions from socket updates
  useEffect(() => {
    marketUpdates.forEach((update, marketAddress) => {
      if (seenLaunchesRef.current.has(marketAddress)) return;
      const hasToken = update.pumpFunTokenAddress || update.tokenMint;
      if (update.resolution === 'YesWins' && hasToken) {
        seenLaunchesRef.current.add(marketAddress);
        setNewLaunchCount((c) => c + 1);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });
  }, [marketUpdates]);

  const handleNewTokensBanner = useCallback(() => {
    setNewLaunchCount(0);
    refresh();
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [refresh]);

  // Collect token addresses for stats
  const tokenAddresses = useMemo(
    () => tokens.map((t) => t.tokenAddress).filter(Boolean),
    [tokens],
  );
  const { stats } = useTokenStats(tokenAddresses);

  const handleCategoryChange = useCallback((cat: string) => {
    setSelectedCategory(cat);
    setSearchQuery('');
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 1000);
  }, [refresh]);

  // Filter + sort
  const displayTokens = useMemo(() => {
    let result = tokens;

    // Local search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.symbol.toLowerCase().includes(q) ||
          t.tokenAddress.toLowerCase().includes(q),
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      const sa = stats.get(a.tokenAddress);
      const sb = stats.get(b.tokenAddress);

      switch (sortBy) {
        case 'Gainers':
          return (sb?.priceChange24h ?? -Infinity) - (sa?.priceChange24h ?? -Infinity);
        case 'Losers':
          return (sa?.priceChange24h ?? Infinity) - (sb?.priceChange24h ?? Infinity);
        case 'MCap':
          return (sb?.marketCap ?? 0) - (sa?.marketCap ?? 0);
        case 'New':
        default:
          return new Date(b.launchDate).getTime() - new Date(a.launchDate).getTime();
      }
    });

    return result;
  }, [tokens, searchQuery, sortBy, stats]);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Launched Tokens" />

      {/* New token launch banner */}
      {newLaunchCount > 0 && (
        <PressableScale onPress={handleNewTokensBanner} style={styles.newBanner}>
          <Ionicons name="rocket" size={14} color="#fff" />
          <Text style={styles.newBannerText}>
            {newLaunchCount} new token{newLaunchCount > 1 ? 's' : ''} launched — tap to refresh
          </Text>
          <Ionicons name="chevron-up" size={14} color="#fff" />
        </PressableScale>
      )}

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, symbol, or address..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <PressableScale onPress={() => setSearchQuery('')} haptic={false}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </PressableScale>
          ) : null}
        </View>
      </View>

      {/* Category chip */}
      <CategoryChip
        selected={selectedCategory}
        onPress={() => categorySheetRef.current?.expand()}
        onClear={() => handleCategoryChange('All')}
      />

      {/* Token list */}
      {isLoading && !tokens.length ? (
        <View style={styles.skeletons}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : error && !tokens.length ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Failed to load tokens"
          subtitle="Check your connection and try again"
          actionLabel="Retry"
          onAction={refresh}
          style={styles.empty}
        />
      ) : (
        <FlatList
          ref={listRef}
          data={displayTokens}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <LaunchedTokenCard
              token={item}
              index={index}
              stats={stats.get(item.tokenAddress)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <SectionHeader
              title="Tokens"
              count={displayTokens.length}
              sortOptions={[...SORT_OPTIONS]}
              selectedSort={sortBy}
              onSortChange={(s) => setSortBy(s as SortOption)}
              style={styles.sectionHeader}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="rocket-outline"
              title="No launched tokens"
              subtitle={searchQuery ? 'Try a different search term' : 'No tokens have launched yet'}
            />
          }
        />
      )}

      {/* Category bottom sheet */}
      <CategorySheet
        ref={categorySheetRef}
        categories={CATEGORIES}
        selected={selectedCategory}
        onSelect={handleCategoryChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
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
  listContent: {
    paddingBottom: 160,
  },
  sectionHeader: {
    paddingBottom: spacing.sm,
  },
  skeletons: {
    paddingTop: spacing.md,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
  },
  newBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  newBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#22c55e',
  },
});
