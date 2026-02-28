/**
 * Explore Screen — Traditional browsable list with search + filters
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMarkets } from '@pnl/shared/hooks';
import { useAuth } from '../../src/providers/AuthProvider';
import {
  ScreenHeader,
  MarketCard,
  CategoryPill,
  SkeletonCard,
  EmptyState,
  PressableScale,
  SectionHeader,
} from '../../src/components';
import { colors, spacing, borderRadius, typography } from '../../src/theme';

const CATEGORIES = ['All', 'DeFi', 'AI', 'Gaming', 'DAO', 'NFT', 'Social'];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const { isAuthenticated } = useAuth();

  const { markets, isLoading, error, refresh } = useMarkets(
    selectedCategory !== 'All' ? selectedCategory : undefined,
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 1000);
  }, [refresh]);

  const filteredMarkets = useMemo(() => {
    if (!searchQuery.trim()) return markets;
    const q = searchQuery.toLowerCase();
    return markets.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.tokenSymbol?.toLowerCase().includes(q),
    );
  }, [markets, searchQuery]);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Explore" />

      {/* Search bar */}
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
          {searchQuery ? (
            <PressableScale onPress={() => setSearchQuery('')} haptic={false}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </PressableScale>
          ) : null}
        </View>
      </View>

      {/* Category pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {CATEGORIES.map((cat) => (
          <CategoryPill
            key={cat}
            label={cat}
            active={selectedCategory === cat}
            variant="filter"
            onPress={() => setSelectedCategory(cat)}
          />
        ))}
      </ScrollView>

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
          data={filteredMarkets}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MarketCard
              market={{
                id: item.id,
                title: item.name,
                category: item.category,
                projectImageUrl: item.projectImageUrl,
                yesPercentage: item.yesPercentage ?? 50,
                noPercentage: item.noPercentage ?? 50,
                poolBalance: item.poolBalance ? Number(item.poolBalance) : undefined,
                targetPool: item.targetPool ? Number(item.targetPool) : undefined,
                endTime: item.endTime,
                status: item.status,
              }}
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
  categoryRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
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
