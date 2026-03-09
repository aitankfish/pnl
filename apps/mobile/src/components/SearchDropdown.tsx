import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PressableScale } from './PressableScale';
import { AvatarImage } from './AvatarImage';
import { colors, spacing, borderRadius } from '../theme';
import type {
  SearchResults,
  SearchUserResult,
  SearchMarketResult,
} from '../hooks/useSearch';

interface SearchDropdownProps {
  results: SearchResults;
  isSearching: boolean;
  query: string;
  onUserPress: (user: SearchUserResult) => void;
  onMarketPress: (market: SearchMarketResult) => void;
}

export function SearchDropdown({
  results,
  isSearching,
  query,
  onUserPress,
  onMarketPress,
}: SearchDropdownProps) {
  const totalResults = results.users.length + results.markets.length;
  const hasQuery = query.trim().length > 0;

  if (!hasQuery) return null;

  // Loading state
  if (isSearching && totalResults === 0) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
      </View>
    );
  }

  // No results
  if (!isSearching && totalResults === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={24} color={colors.textMuted} />
          <Text style={styles.emptyText}>No results for "{query}"</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Users section */}
      {results.users.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person" size={12} color={colors.textMuted} />
            <Text style={styles.sectionTitle}>
              Users ({results.users.length})
            </Text>
          </View>
          {results.users.map((user) => (
            <PressableScale
              key={user.walletAddress}
              onPress={() => onUserPress(user)}
              style={styles.row}
            >
              <View style={styles.avatarUser}>
                <AvatarImage uri={user.profilePhotoUrl} size={32} fallbackIconSize={16} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {user.username || 'Anonymous'}
                </Text>
                <Text style={styles.rowSubtitle} numberOfLines={1}>
                  {user.walletAddress.slice(0, 8)}...{user.walletAddress.slice(-6)}
                </Text>
              </View>
              <Text style={styles.rowMeta}>{user.followerCount} followers</Text>
            </PressableScale>
          ))}
        </View>
      )}

      {/* Markets section */}
      {results.markets.length > 0 && (
        <View
          style={[
            styles.section,
            results.users.length > 0 && styles.sectionDivider,
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons name="trending-up" size={12} color={colors.textMuted} />
            <Text style={styles.sectionTitle}>
              Markets ({results.markets.length})
            </Text>
          </View>
          {results.markets.map((market) => (
            <PressableScale
              key={market.id}
              onPress={() => onMarketPress(market)}
              style={styles.row}
            >
              <View style={styles.avatarMarket}>
                <AvatarImage uri={market.projectImageUrl} size={32} fallbackIconSize={16} />
              </View>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {market.marketName}
                </Text>
                <Text style={styles.rowSubtitle} numberOfLines={1}>
                  {market.projectName}
                  {market.tokenSymbol ? ` · ${market.tokenSymbol}` : ''}
                </Text>
              </View>
              <Text style={styles.rowMeta}>
                {market.marketState === 0
                  ? 'Active'
                  : market.marketState === 1
                    ? 'Resolved'
                    : 'Closed'}
              </Text>
            </PressableScale>
          ))}
        </View>
      )}

      {isSearching && (
        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={styles.inlineLoader}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 200,
    marginTop: 4,
    backgroundColor: 'rgba(26, 31, 46, 0.97)',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    maxHeight: 340,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    overflow: 'hidden',
  },
  loader: {
    paddingVertical: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: 8,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  section: {
    paddingHorizontal: spacing.sm + 4,
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.xs,
  },
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: borderRadius.sm,
    gap: spacing.sm + 2,
  },
  avatarUser: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(139, 92, 246, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarMarket: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(6, 182, 212, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1,
  },
  rowMeta: {
    fontSize: 10,
    color: colors.textMuted,
    flexShrink: 0,
  },
  inlineLoader: {
    paddingVertical: spacing.sm,
  },
});
