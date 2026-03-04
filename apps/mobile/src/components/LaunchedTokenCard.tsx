/**
 * LaunchedTokenCard — mobile card for launched tokens
 * Matches the web's lg:hidden card layout
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, withSequence } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { PressableScale } from './PressableScale';
import { colors, spacing, borderRadius, typography } from '../theme';
import type { LaunchedToken } from '../hooks/useLaunchedTokens';
import type { TokenStats } from '../hooks/useTokenStats';

// ── Format helpers ──────────────────────────────────────────────

function formatPrice(price: number | null): string {
  if (price === null) return '-';
  if (price < 0.000001) return `$${price.toExponential(2)}`;
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
}

function formatLargeNumber(num: number | null): string {
  if (num === null) return '-';
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

function formatNumber(num: number | null): string {
  if (num === null) return '-';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatAge(launchDate: string): string {
  const now = new Date();
  const launch = new Date(launchDate);
  const diffMs = now.getTime() - launch.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1d';
  if (diffDays < 30) return `${diffDays}d`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo`;
  return `${Math.floor(diffDays / 365)}y`;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

// ── Stage / Type color maps ─────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  idea: '#a855f7',       // purple
  prototype: '#3b82f6',  // blue
  mvp: '#06b6d4',        // cyan
  beta: '#eab308',       // yellow
  launched: '#22c55e',   // green
};

const TYPE_COLORS: Record<string, string> = {
  protocol: '#6366f1',   // indigo
  application: '#ec4899', // pink
  platform: '#f97316',   // orange
  service: '#14b8a6',    // teal
  tool: '#f59e0b',       // amber
};

const TYPE_LABELS: Record<string, string> = {
  protocol: 'Protocol',
  application: 'App',
  platform: 'Platform',
  service: 'Service',
  tool: 'Tool',
};

const STAGE_LABELS: Record<string, string> = {
  idea: 'Idea',
  prototype: 'Prototype',
  mvp: 'MVP',
  beta: 'Beta',
  launched: 'Live',
};

// ── External links ──────────────────────────────────────────────

interface ExternalLink {
  label: string;
  url: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

function getExternalLinks(token: LaunchedToken): ExternalLink[] {
  return [
    {
      label: 'Token',
      url: `https://orb.helius.dev/address/${token.tokenAddress}`,
      icon: 'wallet-outline',
      color: '#a855f7',
    },
    {
      label: 'Market',
      url: `https://orb.helius.dev/address/${token.marketAddress}`,
      icon: 'stats-chart-outline',
      color: '#06b6d4',
    },
    {
      label: 'Birdeye',
      url: `https://birdeye.so/token/${token.tokenAddress}?chain=solana`,
      icon: 'eye-outline',
      color: '#f59e0b',
    },
    {
      label: 'DEX',
      url: `https://dexscreener.com/solana/${token.tokenAddress}`,
      icon: 'bar-chart-outline',
      color: '#22c55e',
    },
    {
      label: 'Pump',
      url: `https://pump.fun/coin/${token.tokenAddress}`,
      icon: 'rocket-outline',
      color: '#ec4899',
    },
  ];
}

// ── Component ───────────────────────────────────────────────────

interface LaunchedTokenCardProps {
  token: LaunchedToken;
  index: number;
  stats?: TokenStats;
}

export function LaunchedTokenCard({ token, index, stats }: LaunchedTokenCardProps) {
  const priceChange = stats?.priceChange24h ?? null;
  const isPositive = priceChange !== null && priceChange >= 0;

  const [showCopied, setShowCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(token.tokenAddress);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 1500);
  }, [token.tokenAddress]);

  const handleLink = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  const handleCardPress = useCallback(() => {
    router.push(`/market/${token.id}` as any);
  }, [token.id]);

  const stageKey = token.stage?.toLowerCase() ?? '';
  const typeKey = token.projectType?.toLowerCase() ?? '';
  const links = getExternalLinks(token);

  return (
    <PressableScale onPress={handleCardPress} scaleDown={0.98} style={styles.card}>
      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.index}>{index + 1}</Text>
          {token.projectImageUrl ? (
            <Image
              source={{ uri: token.projectImageUrl }}
              style={styles.tokenImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.fallbackImage}>
              <Text style={styles.fallbackText}>
                {token.symbol?.charAt(0) ?? '?'}
              </Text>
            </View>
          )}
          <View style={styles.nameCol}>
            <Text style={styles.tokenName} numberOfLines={1}>
              {token.name}
            </Text>
            <Text style={styles.tokenSymbol}>${token.symbol}</Text>
          </View>
        </View>
        <View style={styles.priceCol}>
          <Text style={styles.price}>{formatPrice(stats?.price ?? null)}</Text>
          {priceChange !== null && (
            <View style={[styles.changeBadge, isPositive ? styles.changeBadgeUp : styles.changeBadgeDown]}>
              <Ionicons
                name={isPositive ? 'trending-up' : 'trending-down'}
                size={10}
                color={isPositive ? '#10b981' : '#ef4444'}
              />
              <Text style={[styles.changeText, isPositive ? styles.changeUp : styles.changeDown]}>
                {isPositive ? '+' : ''}{priceChange.toFixed(1)}%
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>MCap</Text>
          <Text style={styles.statValue}>{formatLargeNumber(stats?.marketCap ?? null)}</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Holders</Text>
          <Text style={styles.statValue}>{formatNumber(stats?.holders ?? null)}</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Raised</Text>
          <Text style={styles.statValue}>
            {parseFloat(token.launchPool || '0').toFixed(2)} SOL
          </Text>
        </View>
      </View>
      <View style={styles.statsGrid}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Stage</Text>
          <Text style={[styles.statValue, { color: STAGE_COLORS[stageKey] ?? colors.textSecondary }]}>
            {STAGE_LABELS[stageKey] ?? token.stage ?? '-'}
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Type</Text>
          <Text style={[styles.statValue, { color: TYPE_COLORS[typeKey] ?? colors.textSecondary }]}>
            {TYPE_LABELS[typeKey] ?? token.projectType ?? '-'}
          </Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>Yes %</Text>
          <Text style={[styles.statValue, { color: '#10b981' }]}>
            {token.yesPercentage?.toFixed(1) ?? '-'}%
          </Text>
        </View>
      </View>

      {/* Address + age footer */}
      <View style={styles.footer}>
        <View style={styles.addressRow}>
          <Text style={styles.addressLabel}>CA:</Text>
          <Text style={styles.address}>{truncateAddress(token.tokenAddress)}</Text>
          <PressableScale onPress={handleCopy} style={styles.copyButton} scaleDown={0.9}>
            <Ionicons name={showCopied ? 'checkmark' : 'copy-outline'} size={13} color={showCopied ? '#10b981' : colors.textSecondary} />
          </PressableScale>
          {showCopied && (
            <View style={styles.copiedToast}>
              <Text style={styles.copiedText}>Copied!</Text>
            </View>
          )}
        </View>
        <Text style={styles.age}>{formatAge(token.launchDate)}</Text>
      </View>

      {/* External links */}
      <View style={styles.linksRow}>
        {links.map((link) => (
          <PressableScale
            key={link.label}
            onPress={() => handleLink(link.url)}
            style={styles.linkButton}
            scaleDown={0.92}
          >
            <Ionicons name={link.icon} size={12} color={link.color} />
            <Text style={[styles.linkText, { color: link.color }]}>{link.label}</Text>
          </PressableScale>
        ))}
      </View>
    </PressableScale>
  );
}

// ── Styles ──────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  index: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    width: 20,
    textAlign: 'center',
  },
  tokenImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
  },
  fallbackImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  nameCol: {
    flex: 1,
  },
  tokenName: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  tokenSymbol: {
    fontSize: 11,
    fontWeight: '600',
    color: '#22d3ee',
    fontFamily: 'monospace' as any,
    marginTop: 1,
  },
  priceCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  price: {
    ...typography.captionBold,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  changeBadgeUp: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  changeBadgeDown: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  changeText: {
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  changeUp: { color: '#10b981' },
  changeDown: { color: '#ef4444' },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: 12,
    marginBottom: 4,
    gap: 4,
  },
  statCell: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textMuted,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addressLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  address: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    fontFamily: 'monospace' as any,
  },
  copyButton: {
    padding: 4,
  },
  copiedToast: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  copiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
  },
  age: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
  },

  // Links
  linksRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 4,
  },
  linkButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  linkText: {
    fontSize: 9,
    fontWeight: '700',
  },
});
