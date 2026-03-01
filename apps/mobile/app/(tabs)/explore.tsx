/**
 * Explore Screen — Traditional browsable list with search + filters
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import GorhomBottomSheet from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useMarkets, useNetwork } from '@pnl/shared/hooks';
import { FEES } from '@pnl/shared/config';
import { apiUrl } from '@pnl/shared/utils';
import { useAuth } from '../../src/providers/AuthProvider';
import {
  ScreenHeader,
  MarketCard,
  SkeletonCard,
  EmptyState,
  PressableScale,
  SectionHeader,
  StatusTabs,
  CategoryChip,
  CategorySheet,
  SearchDropdown,
} from '../../src/components';
import { useSearch } from '../../src/hooks/useSearch';
import { colors, spacing, borderRadius, typography } from '../../src/theme';

const STATUS_TABS = [
  { value: 'active', label: 'Live' },
  { value: 'yesWins', label: 'Wins' },
  { value: 'noWins', label: 'No Wins' },
  { value: 'expired', label: 'Expired' },
  { value: 'refund', label: 'Refunded' },
];

const CATEGORIES = [
  'All', 'DeFi', 'Gaming', 'NFT', 'AI/ML', 'Social', 'Infrastructure', 'DAO', 'Meme', 'Creator',
  'Healthcare', 'Science', 'Education', 'Finance', 'Commerce', 'Real Estate', 'Energy', 'Media',
  'Manufacturing', 'Mobility', 'Other',
];
const SORT_OPTIONS = ['Trending', 'Newest', 'Ending Soon'] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const QUICK_VOTE_AMOUNT = FEES.MINIMUM_INVESTMENT / 1_000_000_000; // 0.01 SOL

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const categorySheetRef = useRef<GorhomBottomSheet>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('Trending');
  const [votingState, setVotingState] = useState<{ marketId: string; voteType: 'yes' | 'no' } | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const { isAuthenticated, walletAddress } = useAuth();
  const { network } = useNetwork();
  const { results: searchResults, isSearching, totalResults } = useSearch(searchQuery);

  const { markets, isLoading, error, refresh } = useMarkets(
    selectedCategory !== 'All' ? selectedCategory : undefined,
    selectedStatus,
  );

  const handleStatusChange = useCallback((status: string) => {
    setSelectedStatus(status);
    setSearchQuery('');
    setSelectedCategory('All');
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

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

  const handleQuickVote = useCallback(
    async (market: (typeof markets)[number], voteType: 'yes' | 'no') => {
      if (!isAuthenticated || !walletAddress) {
        router.push('/login');
        return;
      }

      // Check disabled state and show reason
      if (voteType === 'yes' && !market.isYesVoteEnabled) {
        if (market.yesVoteDisabledReason) Alert.alert('Cannot Vote', market.yesVoteDisabledReason);
        return;
      }
      if (voteType === 'no' && !market.isNoVoteEnabled) {
        if (market.noVoteDisabledReason) Alert.alert('Cannot Vote', market.noVoteDisabledReason);
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setVotingState({ marketId: market.id, voteType });

      try {
        const prepareRes = await fetch(apiUrl('/api/markets/vote/prepare'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marketAddress: market.marketAddress,
            voteType,
            amount: QUICK_VOTE_AMOUNT,
            userWallet: walletAddress,
            network,
          }),
        });
        const prepareData = await prepareRes.json();
        if (!prepareData.success) throw new Error(prepareData.error || 'Failed to prepare vote');

        // TODO: Sign with Privy Expo SDK once wired
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Transaction Prepared',
          `Quick vote ${voteType.toUpperCase()} (${QUICK_VOTE_AMOUNT} SOL) prepared. On-chain signing via Privy Expo SDK is not yet wired.`,
        );
      } catch (err: any) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Vote Failed', err.message || 'Something went wrong');
      } finally {
        setVotingState(null);
      }
    },
    [isAuthenticated, walletAddress, network],
  );

  const filteredMarkets = useMemo(() => {
    let result = markets;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          m.tokenSymbol?.toLowerCase().includes(q),
      );
    }
    // Sort
    if (sortBy === 'Newest') {
      result = [...result].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
    } else if (sortBy === 'Ending Soon') {
      result = [...result].sort(
        (a, b) => new Date(a.expiryTime || '9999').getTime() - new Date(b.expiryTime || '9999').getTime(),
      );
    }
    // 'Trending' uses default API order
    return result;
  }, [markets, searchQuery, sortBy]);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Explore" />

      {/* Search bar + dropdown */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users & markets..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
          />
          {isSearching ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : searchQuery ? (
            <PressableScale onPress={() => setSearchQuery('')} haptic={false}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </PressableScale>
          ) : null}
        </View>

        {/* Search results dropdown */}
        {searchFocused && searchQuery.trim().length > 0 && (
          <SearchDropdown
            results={searchResults}
            isSearching={isSearching}
            query={searchQuery}
            onUserPress={(user) => {
              setSearchQuery('');
              router.push(`/profile/${user.walletAddress}`);
            }}
            onMarketPress={(market) => {
              setSearchQuery('');
              router.push(`/market/${market.id}`);
            }}
          />
        )}
      </View>

      {/* Status tabs */}
      <StatusTabs
        tabs={STATUS_TABS}
        selectedTab={selectedStatus}
        onTabChange={handleStatusChange}
      />

      {/* Category chip */}
      <CategoryChip
        selected={selectedCategory}
        onPress={() => categorySheetRef.current?.expand()}
        onClear={() => handleCategoryChange('All')}
      />

      {/* Markets list */}
      {isLoading && !markets.length ? (
        <View style={styles.skeletons}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : error && !markets.length ? (
        <EmptyState
          icon="cloud-offline-outline"
          title="Failed to load markets"
          subtitle="Check your connection and try again"
          actionLabel="Retry"
          onAction={refresh}
          style={styles.empty}
        />
      ) : (
        <FlatList
          ref={listRef}
          data={filteredMarkets}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MarketCard
              market={{
                id: item.id,
                title: item.name,
                category: item.category,
                projectImageUrl: item.projectImageUrl,
                tokenSymbol: item.tokenSymbol,
                totalParticipants: item.totalParticipants ?? ((item.yesVotes || 0) + (item.noVotes || 0)),
                poolBalance: item.poolBalance ? Number(item.poolBalance) / 1e9 : undefined,
                targetPool: item.targetPool ? Number(item.targetPool) : undefined,
                endTime: item.expiryTime,
                status: item.status,
                displayStatus: item.displayStatus,
                isYesVoteEnabled: item.isYesVoteEnabled,
                isNoVoteEnabled: item.isNoVoteEnabled,
                yesVoteDisabledReason: item.yesVoteDisabledReason,
                noVoteDisabledReason: item.noVoteDisabledReason,
              }}
              hasVideo={!!item.metadataUri}
              votingState={votingState?.marketId === item.id ? votingState : null}
              onQuickVote={(voteType) => handleQuickVote(item, voteType)}
              onPress={() => router.push(`/market/${item.id}`)}
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
              title="Markets"
              count={filteredMarkets.length}
              sortOptions={[...SORT_OPTIONS]}
              selectedSort={sortBy}
              onSortChange={(s) => setSortBy(s as SortOption)}
              style={styles.sectionHeader}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="search-outline"
              title="No markets found"
              subtitle={searchQuery ? 'Try a different search term' : 'No active markets right now'}
            />
          }
        />
      )}

      {/* Floating action button — Create */}
      <PressableScale
        onPress={() => {
          if (!isAuthenticated) {
            router.push('/login');
            return;
          }
          // TODO: Navigate to create flow
        }}
        style={[styles.fab, { bottom: 80 + insets.bottom }]}
      >
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
      </PressableScale>

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
    zIndex: 200,
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
    paddingBottom: spacing.lg,
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
  fab: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 100,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
