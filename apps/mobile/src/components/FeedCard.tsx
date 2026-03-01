import React from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from './PressableScale';
import { PoolProgress } from './PoolProgress';
import { CategoryPill } from './CategoryPill';
import { TimeCountdown } from './TimeCountdown';
import { colors, typography, spacing, borderRadius } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FeedCardProps {
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
    isYesVoteEnabled?: boolean;
    isNoVoteEnabled?: boolean;
    status?: string;
    displayStatus?: string;
  };
  height: number;
  votingState?: { voteType: 'yes' | 'no' } | null;
  onVoteYes: () => void;
  onVoteNo: () => void;
  onPress: () => void;
}

export function FeedCard({ market, height, votingState, onVoteYes, onVoteNo, onPress }: FeedCardProps) {
  const insets = useSafeAreaInsets();
  const isActionable = market.isYesVoteEnabled || market.isNoVoteEnabled;
  const isVotingYes = votingState?.voteType === 'yes';
  const isVotingNo = votingState?.voteType === 'no';
  const isVoting = !!votingState;

  return (
    <PressableScale
      onPress={onPress}
      scaleDown={1}
      haptic={false}
      style={{ width: '100%', height } as any}
    >
      {market.projectImageUrl ? (
        <Image
          source={{ uri: market.projectImageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={300}
        />
      ) : (
        <LinearGradient
          colors={[colors.gradientStart, colors.background]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}

      {/* Dark gradient scrim for readability */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Content overlay */}
      <View style={[styles.content, { paddingTop: insets.top + spacing.sm }]}>
        {/* Top pills */}
        <View style={styles.topRow}>
          {market.category && <CategoryPill label={market.category} variant="tag" />}
          {market.endTime && <TimeCountdown endTime={market.endTime} />}
        </View>

        {/* Spacer pushes content to bottom */}
        <View style={styles.spacer} />

        {/* Market info */}
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={3}>
              {market.title}
            </Text>
            {market.tokenSymbol && (
              <Text style={styles.tokenSymbol}>${market.tokenSymbol}</Text>
            )}
          </View>
          {market.description && (
            <Text style={styles.description} numberOfLines={2}>
              {market.description}
            </Text>
          )}
          {market.totalParticipants != null && market.totalParticipants > 0 && (
            <View style={styles.metaRow}>
              <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.6)" />
              <Text style={styles.metaText}>{market.totalParticipants} participants</Text>
            </View>
          )}
        </View>

        {/* Pool progress */}
        {market.poolBalance != null && market.targetPool != null && (
          <PoolProgress
            current={market.poolBalance}
            target={market.targetPool}
            tokenSymbol={market.tokenSymbol || 'SOL'}
            variant="inline"
          />
        )}

        {/* Vote buttons — only when actionable */}
        {isActionable && (
          <View style={styles.voteRow}>
            <PressableScale
              onPress={onVoteYes}
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
                    <Ionicons name="trending-up" size={16} color="#fff" />
                    <Text style={styles.voteButtonText}>YES</Text>
                  </>
                )}
              </LinearGradient>
            </PressableScale>
            <PressableScale
              onPress={onVoteNo}
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
                    <Ionicons name="trending-down" size={16} color="#fff" />
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
  container: {
    width: '100%',
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    justifyContent: 'flex-start',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  spacer: {
    flex: 1,
  },
  info: {
    gap: 6,
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
    lineHeight: 32,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  tokenSymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: '#22d3ee',
    fontFamily: 'monospace' as any,
    marginTop: 6,
  },
  description: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.75)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  voteRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
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
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  voteGradientDisabled: {
    opacity: 0.6,
  },
  voteButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  noButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  noButtonDisabled: {
    opacity: 0.6,
  },
});
