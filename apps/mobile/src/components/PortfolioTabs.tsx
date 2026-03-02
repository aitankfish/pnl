/**
 * PortfolioTabs — Segmented control: Predictions | Projects | Watchlist
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import GorhomBottomSheet from '@gorhom/bottom-sheet';
import { StatusTabs, type StatusTab } from './StatusTabs';
import { GlassCard } from './GlassCard';
import { PressableScale } from './PressableScale';
import { SectionHeader } from './SectionHeader';
import { EmptyState } from './EmptyState';
import { PoolProgress } from './PoolProgress';
import { VoteHistorySheet } from './VoteHistorySheet';
import { useProjects } from '../hooks/useProjects';
import { useFavorites } from '../hooks/useFavorites';
import type { Position } from '../hooks/usePositions';
import { colors, spacing, borderRadius, typography } from '../theme';

const TABS: StatusTab[] = [
  { value: 'predictions', label: 'Predictions' },
  { value: 'projects', label: 'Projects' },
  { value: 'watchlist', label: 'Watchlist' },
];

interface PortfolioTabsProps {
  walletAddress: string;
  active: Position[];
  claimable: Position[];
  resolved: Position[];
  all: Position[];
  positionsLoading: boolean;
  totalStaked: number;
  favoriteMarketIds: string[];
}

export function PortfolioTabs({
  walletAddress,
  active,
  claimable,
  resolved,
  all,
  positionsLoading,
  totalStaked,
  favoriteMarketIds,
}: PortfolioTabsProps) {
  const [tab, setTab] = useState('predictions');
  const { projects: rawProjects, isLoading: projectsLoading } = useProjects(walletAddress);
  const { favorites: rawFavorites, isLoading: favoritesLoading } = useFavorites(walletAddress, favoriteMarketIds);
  const projects = Array.isArray(rawProjects) ? rawProjects : [];
  const favorites = Array.isArray(rawFavorites) ? rawFavorites : [];

  // Vote history sheet state
  const voteHistoryRef = useRef<GorhomBottomSheet>(null);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);

  const handleOpenHistory = (pos: Position) => {
    setSelectedPosition(pos);
    voteHistoryRef.current?.snapToIndex(0);
  };

  return (
    <View style={styles.container}>
      <StatusTabs tabs={TABS} selectedTab={tab} onTabChange={setTab} />

      {tab === 'predictions' && (
        <PredictionsTab
          active={active}
          claimable={claimable}
          resolved={resolved}
          all={all}
          totalStaked={totalStaked}
          isLoading={positionsLoading}
          onOpenHistory={handleOpenHistory}
        />
      )}

      {tab === 'projects' && (
        <ProjectsTab projects={projects} isLoading={projectsLoading} />
      )}

      {tab === 'watchlist' && (
        <WatchlistTab favorites={favorites} isLoading={favoritesLoading} />
      )}

      <VoteHistorySheet
        ref={voteHistoryRef}
        position={selectedPosition}
        walletAddress={walletAddress}
        onClose={() => voteHistoryRef.current?.close()}
      />
    </View>
  );
}

/* ── Predictions Tab ── */

function PredictionsTab({
  active,
  claimable,
  resolved,
  all,
  totalStaked,
  isLoading,
  onOpenHistory,
}: {
  active: Position[];
  claimable: Position[];
  resolved: Position[];
  all: Position[];
  totalStaked: number;
  isLoading: boolean;
  onOpenHistory: (pos: Position) => void;
}) {
  return (
    <View style={styles.tabContent}>
      {/* Total Staked summary */}
      <GlassCard style={styles.portfolioCard}>
        <Text style={styles.portfolioLabel}>Total Staked</Text>
        <Text style={styles.portfolioValue}>
          {totalStaked > 0 ? `${totalStaked.toFixed(2)} SOL` : '0.00 SOL'}
        </Text>
        <View style={styles.positionCounts}>
          <CountDot color={colors.primary} label={`${active.length} Active`} />
          <CountDot color={colors.success} label={`${claimable.length} Claimable`} />
          <CountDot color={colors.textMuted} label={`${resolved.length} Resolved`} />
        </View>
      </GlassCard>

      {/* Active */}
      <SectionHeader title="Active Positions" count={active.length} />
      {isLoading && active.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : active.length > 0 ? (
        active.map((pos) => (
          <PositionCard key={`${pos.marketId}-${pos.voteType}`} pos={pos} onOpenHistory={onOpenHistory} />
        ))
      ) : (
        <EmptyState
          icon="bar-chart-outline"
          title="No positions yet"
          subtitle="Vote on markets to start building your portfolio"
          actionLabel="Browse Markets"
          onAction={() => router.push('/(tabs)/explore')}
        />
      )}

      {/* Claimable */}
      {claimable.length > 0 && (
        <>
          <SectionHeader title="Claimable Rewards" count={claimable.length} style={styles.sectionGap} />
          {claimable.map((pos) => (
            <PressableScale
              key={`claim-${pos.marketId}-${pos.voteType}`}
              onPress={() => router.push(`/market/${pos.marketId}`)}
              style={[styles.positionCard, styles.claimableCard]}
            >
              <View style={styles.positionHeader}>
                <Text style={styles.positionName} numberOfLines={1}>
                  {pos.marketName}
                </Text>
                <View style={styles.claimBadge}>
                  <Ionicons name="gift" size={12} color={colors.success} />
                  <Text style={styles.claimBadgeText}>Claim</Text>
                </View>
              </View>
              <Text style={styles.positionDetail}>
                {pos.totalAmount.toFixed(3)} SOL staked
              </Text>
            </PressableScale>
          ))}
        </>
      )}
    </View>
  );
}

/* ── Position Card with history icon ── */

function PositionCard({
  pos,
  onOpenHistory,
}: {
  pos: Position;
  onOpenHistory: (pos: Position) => void;
}) {
  return (
    <PressableScale
      onPress={() => router.push(`/market/${pos.marketId}`)}
      style={styles.positionCard}
    >
      <View style={styles.positionHeader}>
        <Text style={styles.positionName} numberOfLines={1}>
          {pos.marketName}
        </Text>
        <View style={styles.positionHeaderRight}>
          <PressableScale
            onPress={() => onOpenHistory(pos)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="time-outline" size={16} color={colors.textMuted} />
          </PressableScale>
          <View
            style={[
              styles.voteBadge,
              {
                backgroundColor:
                  pos.voteType === 'yes'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
              },
            ]}
          >
            <Text
              style={[
                styles.voteBadgeText,
                { color: pos.voteType === 'yes' ? colors.success : colors.danger },
              ]}
            >
              {pos.voteType.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.positionDetails}>
        <Text style={styles.positionDetail}>{pos.totalAmount.toFixed(3)} SOL</Text>
        <Text style={styles.positionDetailMuted}>{pos.totalShares.toFixed(1)} shares</Text>
        <Text style={styles.positionDetailMuted}>
          {((pos.voteType === 'yes' ? pos.currentYesPrice : pos.currentNoPrice) * 100).toFixed(1)}%
        </Text>
      </View>
    </PressableScale>
  );
}

/* ── Projects Tab ── */

function ProjectsTab({
  projects,
  isLoading,
}: {
  projects: any[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (projects.length === 0) {
    return (
      <EmptyState
        icon="rocket-outline"
        title="No projects yet"
        subtitle="Launch your first prediction market"
      />
    );
  }

  return (
    <View style={styles.tabContent}>
      {projects.map((project) => (
        <PressableScale
          key={project.id}
          onPress={() => router.push(`/market/${project.id}`)}
          style={styles.projectCard}
        >
          <View style={styles.projectRow}>
            {project.projectImageUrl ? (
              <Image source={{ uri: project.projectImageUrl }} style={styles.projectImage} />
            ) : (
              <View style={[styles.projectImage, styles.projectImagePlaceholder]}>
                <Ionicons name="rocket" size={18} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.projectInfo}>
              <Text style={styles.projectName} numberOfLines={1}>
                {project.name}
              </Text>
              {project.tokenSymbol && (
                <Text style={styles.projectSymbol}>${project.tokenSymbol}</Text>
              )}
            </View>
            <View style={styles.projectMeta}>
              <View style={[styles.statusPill, { backgroundColor: getStatusColor(project.status) + '22' }]}>
                <Text style={[styles.statusPillText, { color: getStatusColor(project.status) }]}>
                  {project.displayStatus || project.status}
                </Text>
              </View>
            </View>
          </View>

          {project.poolBalance != null && project.targetPool != null && (
            <PoolProgress
              current={project.poolBalance}
              target={project.targetPool}
              tokenSymbol={project.tokenSymbol || 'SOL'}
              variant="inline"
              participants={project.totalParticipants}
            />
          )}

          {project.sharesYesPercentage != null && (
            <View style={styles.yesBarContainer}>
              <View style={[styles.yesBar, { width: `${project.sharesYesPercentage}%` }]} />
              <Text style={styles.yesBarText}>
                {project.sharesYesPercentage.toFixed(0)}% YES
              </Text>
            </View>
          )}
        </PressableScale>
      ))}
    </View>
  );
}

/* ── Watchlist Tab ── */

function WatchlistTab({
  favorites,
  isLoading,
}: {
  favorites: any[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (favorites.length === 0) {
    return (
      <EmptyState
        icon="heart-outline"
        title="No favorites yet"
        subtitle="Tap the heart on any market to add it to your watchlist"
        actionLabel="Browse Markets"
        onAction={() => router.push('/(tabs)/explore')}
      />
    );
  }

  return (
    <View style={styles.tabContent}>
      {favorites.map((market) => (
        <PressableScale
          key={market.id}
          onPress={() => router.push(`/market/${market.id}`)}
          style={styles.projectCard}
        >
          <View style={styles.projectRow}>
            {market.projectImageUrl ? (
              <Image source={{ uri: market.projectImageUrl }} style={styles.projectImage} />
            ) : (
              <View style={[styles.projectImage, styles.projectImagePlaceholder]}>
                <Ionicons name="heart" size={18} color={colors.danger} />
              </View>
            )}
            <View style={styles.projectInfo}>
              <Text style={styles.projectName} numberOfLines={1}>
                {market.title}
              </Text>
              {market.tokenSymbol && (
                <Text style={styles.projectSymbol}>${market.tokenSymbol}</Text>
              )}
            </View>
            {market.displayStatus && (
              <View style={[styles.statusPill, { backgroundColor: getStatusColor(market.status) + '22' }]}>
                <Text style={[styles.statusPillText, { color: getStatusColor(market.status) }]}>
                  {market.displayStatus}
                </Text>
              </View>
            )}
          </View>
        </PressableScale>
      ))}
    </View>
  );
}

/* ── Helpers ── */

function CountDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.positionCountItem}>
      <View style={[styles.positionDot, { backgroundColor: color }]} />
      <Text style={styles.positionCountText}>{label}</Text>
    </View>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return colors.primary;
    case 'ended':
    case 'resolved':
      return colors.success;
    case 'expired':
      return colors.danger;
    default:
      return colors.textMuted;
  }
}

/* ── Styles ── */

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.md,
  },
  tabContent: {
    paddingTop: spacing.xs,
  },
  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  sectionGap: {
    marginTop: spacing.md,
  },

  // Portfolio summary card
  portfolioCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  portfolioLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  portfolioValue: {
    ...typography.numericLarge,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  positionCounts: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  positionCountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  positionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  positionCountText: {
    ...typography.micro,
    color: colors.textSecondary,
  },

  // Position cards
  positionCard: {
    backgroundColor: colors.glass,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  claimableCard: {
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  positionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  positionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  positionName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  voteBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  voteBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  claimBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  claimBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  positionDetails: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  positionDetail: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  positionDetailMuted: {
    ...typography.caption,
    color: colors.textMuted,
  },

  // Project cards
  projectCard: {
    backgroundColor: colors.glass,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  projectImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  projectImagePlaceholder: {
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  projectSymbol: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22d3ee',
    fontFamily: 'monospace' as any,
  },
  projectMeta: {
    alignItems: 'flex-end',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  // Yes bar
  yesBarContainer: {
    height: 20,
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  yesBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: borderRadius.sm,
  },
  yesBarText: {
    ...typography.micro,
    color: colors.success,
    fontWeight: '700',
    textAlign: 'center',
  },
});
