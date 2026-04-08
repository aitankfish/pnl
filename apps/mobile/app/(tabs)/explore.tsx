/**
 * Explore Screen — Traditional browsable list with search + filters
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
import type { Market } from '@pnl/shared/hooks';
import { apiUrl } from '@pnl/shared/utils';
import { useAuth } from '../../src/providers/AuthProvider';
import { useVote } from '../../src/hooks/useVote';
import { useWalletBalance } from '../../src/hooks/useWalletBalance';
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
  VoteToast,
  VoteBottomSheet,
} from '../../src/components';
import type { VoteToastState } from '../../src/components';
import { useSearch } from '../../src/hooks/useSearch';
import { colors, spacing, borderRadius } from '../../src/theme';

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

type VoteDirection = 'yes' | 'no';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const categorySheetRef = useRef<GorhomBottomSheet>(null);
  const voteSheetRef = useRef<GorhomBottomSheet>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('Trending');
  const [searchFocused, setSearchFocused] = useState(false);
  const [toastState, setToastState] = useState<VoteToastState>({ visible: false, stage: 'signing' });
  const { isAuthenticated, walletAddress } = useAuth();
  const { network } = useNetwork();
  const { solBalance } = useWalletBalance(walletAddress);
  const { results: searchResults, isSearching } = useSearch(searchQuery);

  // Vote sheet state
  const [voteDirection, setVoteDirection] = useState<VoteDirection | null>(null);
  const [voteMarket, setVoteMarket] = useState<Market | null>(null);
  const [votePositionData, setVotePositionData] = useState<any>(null);

  const { markets, newMarkets, isLoading, error, refresh } = useMarkets(
    selectedCategory !== 'All' ? selectedCategory : undefined,
    selectedStatus,
  );

  // Track new market IDs for "NEW" badge animation
  const [newMarketIds, setNewMarketIds] = useState<Set<string>>(new Set());
  const prevNewMarketsCount = useRef(0);

  useEffect(() => {
    if (newMarkets.length > prevNewMarketsCount.current && selectedStatus === 'active') {
      const fresh = newMarkets.slice(0, newMarkets.length - prevNewMarketsCount.current);
      const freshIds = fresh.map((m: any) => m.marketAddress || m.id).filter(Boolean);
      if (freshIds.length > 0) {
        setNewMarketIds((prev) => new Set([...prev, ...freshIds]));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Clear "NEW" badges after 5 seconds
        setTimeout(() => {
          setNewMarketIds((prev) => {
            const next = new Set(prev);
            freshIds.forEach((id: string) => next.delete(id));
            return next;
          });
        }, 5000);
      }
    }
    prevNewMarketsCount.current = newMarkets.length;
  }, [newMarkets, selectedStatus]);

  const handleStatusChange = useCallback((status: string) => {
    setSelectedStatus(status);
    // Preserve search query — compose filters instead of resetting
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const handleCategoryChange = useCallback((cat: string) => {
    setSelectedCategory(cat);
    // Preserve search query when changing category
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 1000);
  }, [refresh]);

  const { submitVote } = useVote({
    onSuccess: refresh,
    onStageChange: (stage, direction, amount, marketName, message) => {
      setToastState({ visible: true, stage, direction, amount, marketName, message });
    },
  });

  const handleVote = useCallback(
    async (market: Market, voteType: VoteDirection) => {
      if (!isAuthenticated || !walletAddress) {
        router.push('/login');
        return;
      }

      if (voteType === 'yes' && !market.isYesVoteEnabled) {
        if (market.yesVoteDisabledReason) Alert.alert('Cannot Vote', market.yesVoteDisabledReason);
        return;
      }
      if (voteType === 'no' && !market.isNoVoteEnabled) {
        if (market.noVoteDisabledReason) Alert.alert('Cannot Vote', market.noVoteDisabledReason);
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Fetch position first, then open sheet with all data ready
      let posData = null;
      try {
        const res = await fetch(apiUrl(`/api/markets/${market.id}/position?wallet=${walletAddress}&network=${network}`));
        const data = await res.json();
        if (data?.success && data.data) posData = data.data;
      } catch {}

      setVoteMarket(market);
      setVoteDirection(voteType);
      setVotePositionData(posData);
      voteSheetRef.current?.snapToIndex(0);
    },
    [isAuthenticated, walletAddress, network],
  );

  const handleVoteConfirm = useCallback(
    async (direction: VoteDirection, amount: number) => {
      if (!voteMarket) return;
      voteSheetRef.current?.close();
      await submitVote(voteMarket.marketAddress, voteMarket.id, direction, amount, voteMarket.name);
    },
    [voteMarket, submitVote],
  );

  const filteredMarkets = useMemo(() => {
    let result = markets;

    // Prepend new markets from socket that aren't already in the list
    if (newMarkets.length > 0 && selectedStatus === 'active') {
      const existingAddresses = new Set(result.map((m) => m.marketAddress));
      const toAdd = newMarkets.filter((m: any) => !existingAddresses.has(m.marketAddress));
      if (toAdd.length > 0) {
        result = [...toAdd, ...result];
      }
    }

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
    if (sortBy === 'Newest') {
      result = [...result].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
    } else if (sortBy === 'Ending Soon') {
      result = [...result].sort(
        (a, b) => new Date(a.expiryTime || '9999').getTime() - new Date(b.expiryTime || '9999').getTime(),
      );
    }
    return result;
  }, [markets, newMarkets, selectedStatus, searchQuery, sortBy]);

  return (
    <View style={styles.container}>
      <VoteToast
        state={toastState}
        onDismiss={() => setToastState((s) => ({ ...s, visible: false }))}
      />
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
          renderItem={({ item }) => {
            const isNew = newMarketIds.has(item.marketAddress);
            return (
              <View style={isNew ? styles.newMarketGlow : undefined}>
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
                  isNew={isNew}
                  onQuickVote={(voteType) => handleVote(item as Market, voteType)}
                  onPress={() => router.push(`/market/${item.id}`)}
                />
              </View>
            );
          }}
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
          router.push('/create');
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

      {/* Vote bottom sheet */}
      <VoteBottomSheet
        ref={voteSheetRef}
        direction={voteDirection}
        marketTitle={voteMarket?.name ?? ''}
        solBalance={solBalance}
        positionData={votePositionData}
        onConfirm={handleVoteConfirm}
        onClose={() => {
          setVoteDirection(null);
          setVoteMarket(null);
          setVotePositionData(null);
        }}
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
  newMarketGlow: {
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
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
