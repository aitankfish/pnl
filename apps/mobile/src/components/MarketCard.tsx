import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PressableScale } from './PressableScale';
import { PoolProgress } from './PoolProgress';
import { CategoryPill } from './CategoryPill';
import { TimeCountdown } from './TimeCountdown';
import { LiveDot } from './LiveDot';
import { NewBadge } from './NewBadge';
import { colors, typography, spacing, borderRadius } from '../theme';
import { shadows } from '../theme/shadows';

function getDisplayStatusColor(displayStatus: string): string {
  if (displayStatus.startsWith('✅')) return '#10b981'; // green
  if (displayStatus.startsWith('🎯')) return '#06b6d4'; // cyan
  if (displayStatus.startsWith('💰')) return '#8b5cf6'; // purple
  if (displayStatus.startsWith('🚀')) return '#06b6d4'; // cyan
  if (displayStatus.startsWith('🎉')) return '#10b981'; // green
  if (displayStatus.startsWith('❌')) return '#ef4444'; // red
  if (displayStatus.startsWith('↩️')) return '#f59e0b'; // amber
  if (displayStatus.startsWith('⏳')) return '#f97316'; // orange
  return '#6b7280'; // gray fallback
}

interface MarketCardProps {
  market: {
    id: string;
    title: string;
    description?: string;
    category?: string;
    projectImageUrl?: string;
    tokenSymbol?: string;
    totalParticipants?: number;
    poolBalance?: number;
    targetPool?: number;
    endTime?: string;
    status?: string;
    displayStatus?: string;
    isYesVoteEnabled?: boolean;
    isNoVoteEnabled?: boolean;
    yesVoteDisabledReason?: string;
    noVoteDisabledReason?: string;
  };
  hasVideo?: boolean;
  isNew?: boolean;
  votingState?: { voteType: 'yes' | 'no' } | null;
  onQuickVote?: (voteType: 'yes' | 'no') => void;
  onPress: () => void;
}

export function MarketCard({ market, hasVideo, isNew, votingState, onQuickVote, onPress }: MarketCardProps) {
  const isActionable = market.isYesVoteEnabled || market.isNoVoteEnabled;
  const isVotingYes = votingState?.voteType === 'yes';
  const isVotingNo = votingState?.voteType === 'no';
  const isVoting = !!votingState;
  const isEnded = market.status === 'ended' || market.status === 'resolved';

  return (
    <PressableScale
      onPress={onPress}
      style={StyleSheet.flatten([styles.card, shadows.md, isEnded && styles.cardEnded, isNew && styles.cardNew])}
    >
      {isNew && <NewBadge visible />}
      {market.projectImageUrl && (
        <View>
          <Image
            source={{ uri: market.projectImageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
          {/* Gradient scrim for overlay readability */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.6)']}
            style={styles.imageScrim}
          />
          {/* Overlay elements on image */}
          <View style={styles.imageOverlay}>
            <View style={styles.overlayLeft}>
              {market.category && <CategoryPill label={market.category} variant="tag" />}
            </View>
            <View style={styles.overlayRight}>
              {hasVideo && (
                <View style={styles.videoBadge}>
                  <Ionicons name="play" size={12} color="#fff" />
                </View>
              )}
              {market.displayStatus ? (
                <View style={[styles.statusBadge, { backgroundColor: getDisplayStatusColor(market.displayStatus) + '33' }]}>
                  <Text style={[styles.statusBadgeText, { color: getDisplayStatusColor(market.displayStatus) }]}>
                    {market.displayStatus}
                  </Text>
                </View>
              ) : (
                <>
                  {market.status === 'active' && <LiveDot />}
                </>
              )}
              {market.endTime && <TimeCountdown endTime={market.endTime} />}
            </View>
          </View>
        </View>
      )}
      <View style={styles.body}>
        {/* Title + token symbol */}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {market.title}
          </Text>
          {market.tokenSymbol && (
            <Text style={styles.tokenSymbol}>${market.tokenSymbol}</Text>
          )}
        </View>

        {/* Pool progress with inline participants */}
        {market.poolBalance != null && market.targetPool != null && (
          <PoolProgress
            current={market.poolBalance}
            target={market.targetPool}
            tokenSymbol={market.tokenSymbol || 'SOL'}
            variant="inline"
            participants={market.totalParticipants}
          />
        )}

        {/* Quick Vote Buttons — only when actionable */}
        {onQuickVote && isActionable && (
          <View style={styles.voteRow}>
            <PressableScale
              onPress={() => onQuickVote('yes')}
              disabled={isVoting || !market.isYesVoteEnabled}
              style={[
                styles.voteButton,
                (!market.isYesVoteEnabled || isVoting) && styles.voteButtonDisabled,
              ]}
            >
              <LinearGradient
                colors={['#10b981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.voteButtonGradient,
                  (!market.isYesVoteEnabled || isVoting) && styles.voteGradientDisabled,
                ]}
              >
                {isVotingYes ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trending-up" size={14} color="#fff" />
                    <Text style={styles.voteButtonText}>YES</Text>
                  </>
                )}
              </LinearGradient>
            </PressableScale>
            <PressableScale
              onPress={() => onQuickVote('no')}
              disabled={isVoting || !market.isNoVoteEnabled}
              style={[
                styles.voteButton,
                (!market.isNoVoteEnabled || isVoting) && styles.voteButtonDisabled,
              ]}
            >
              <View
                style={[
                  styles.noButtonInner,
                  (!market.isNoVoteEnabled || isVoting) && styles.noButtonDisabled,
                ]}
              >
                {isVotingNo ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="trending-down" size={14} color="#fff" />
                    <Text style={styles.voteButtonText}>NO</Text>
                  </>
                )}
              </View>
            </PressableScale>
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  cardEnded: {
    opacity: 0.65,
  },
  cardNew: {
    borderColor: '#8b5cf6',
    borderWidth: 1.5,
  },
  image: {
    width: '100%',
    height: 96,
  },
  imageScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 48,
  },
  imageOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 8,
  },
  overlayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  overlayRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  videoBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  body: {
    padding: 12,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
  },
  tokenSymbol: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22d3ee',
    fontFamily: 'monospace' as any,
    marginTop: 2,
  },
  voteRow: {
    flexDirection: 'row',
    gap: 8,
  },
  voteButton: {
    flex: 1,
  },
  voteButtonDisabled: {
    opacity: 0.4,
  },
  voteButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
  },
  voteGradientDisabled: {
    opacity: 0.6,
  },
  voteButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  noButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  noButtonDisabled: {
    opacity: 0.6,
  },
});
