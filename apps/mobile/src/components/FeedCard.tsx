import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { PressableScale } from './PressableScale';
import { VoteGauge } from './VoteGauge';
import { PoolProgress } from './PoolProgress';
import { CategoryPill } from './CategoryPill';
import { TimeCountdown } from './TimeCountdown';
import { colors, typography, spacing } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FeedCardProps {
  market: {
    id: string;
    title: string;
    description?: string;
    category?: string;
    projectImageUrl?: string;
    yesPercentage: number;
    noPercentage: number;
    poolBalance?: number;
    targetPool?: number;
    endTime?: string;
  };
  height: number;
  onVoteYes: () => void;
  onVoteNo: () => void;
  onPress: () => void;
}

export function FeedCard({ market, height, onVoteYes, onVoteNo, onPress }: FeedCardProps) {
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
      <View style={styles.content}>
        {/* Top pills */}
        <View style={styles.topRow}>
          {market.category && <CategoryPill label={market.category} variant="tag" />}
          {market.endTime && <TimeCountdown endTime={market.endTime} />}
        </View>

        {/* Spacer pushes content to bottom */}
        <View style={styles.spacer} />

        {/* Market info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={3}>
            {market.title}
          </Text>
          {market.description && (
            <Text style={styles.description} numberOfLines={2}>
              {market.description}
            </Text>
          )}
        </View>

        {/* Vote gauge */}
        <VoteGauge
          yesPercent={market.yesPercentage}
          noPercent={market.noPercentage}
          variant="large"
          style={styles.gauge}
        />

        {/* Pool progress */}
        {market.poolBalance != null && market.targetPool != null && (
          <PoolProgress
            current={market.poolBalance}
            target={market.targetPool}
            variant="inline"
          />
        )}

        {/* Vote buttons */}
        <View style={styles.voteRow}>
          <PressableScale onPress={onVoteYes} style={StyleSheet.flatten([styles.voteButton, styles.yesButton])}>
            <Text style={styles.voteButtonText}>YES</Text>
          </PressableScale>
          <PressableScale onPress={onVoteNo} style={StyleSheet.flatten([styles.voteButton, styles.noButton])}>
            <Text style={styles.voteButtonText}>NO</Text>
          </PressableScale>
        </View>
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
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
    lineHeight: 32,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  description: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.75)',
  },
  gauge: {
    marginBottom: spacing.sm,
  },
  voteRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  voteButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yesButton: {
    backgroundColor: colors.success,
  },
  noButton: {
    backgroundColor: colors.danger,
  },
  voteButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
});
