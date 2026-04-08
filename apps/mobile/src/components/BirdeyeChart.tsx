/**
 * BirdeyeChart — WebView wrapper for Birdeye candlestick chart
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from './GlassCard';
import { PressableScale } from './PressableScale';
import { colors, spacing, borderRadius } from '../theme';

interface BirdeyeChartProps {
  tokenMint: string;
  height?: number;
}

export function BirdeyeChart({ tokenMint, height = 300 }: BirdeyeChartProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const chartUrl = `https://birdeye.so/tv-widget/${tokenMint}?chain=solana&viewMode=pair&chartInterval=15&chartType=CANDLE&chartTimezone=America%2FLos_Angeles&chartLeftToolbar=hide&theme=dark&backgroundColor=transparent`;

  if (hasError) {
    return (
      <GlassCard style={styles.card}>
        <View style={styles.errorContainer}>
          <Ionicons name="bar-chart-outline" size={32} color={colors.textMuted} />
          <Text style={styles.errorText}>Chart unavailable</Text>
          <PressableScale
            onPress={() => Linking.openURL(`https://birdeye.so/token/${tokenMint}?chain=solana`)}
            style={styles.errorLink}
          >
            <Text style={styles.errorLinkText}>View on Birdeye</Text>
            <Ionicons name="open-outline" size={12} color={colors.primary} />
          </PressableScale>
        </View>
      </GlassCard>
    );
  }

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="bar-chart-outline" size={14} color="#f59e0b" />
        <Text style={styles.headerText}>Price Chart</Text>
      </View>
      <View style={[styles.chartContainer, { height }]}>
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading chart...</Text>
          </View>
        )}
        <WebView
          source={{ uri: chartUrl }}
          style={styles.webview}
          scrollEnabled={false}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => { setHasError(true); setIsLoading(false); }}
          onHttpError={() => { setHasError(true); setIsLoading(false); }}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState={false}
          originWhitelist={['*']}
          allowsInlineMediaPlayback
        />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  headerText: { fontSize: 12, fontWeight: '700', color: '#f59e0b' },
  chartContainer: { position: 'relative' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,14,26,0.8)',
    gap: spacing.xs,
  },
  loadingText: { fontSize: 11, color: colors.textMuted },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  errorText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  errorLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(129,140,248,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.2)',
  },
  errorLinkText: { fontSize: 12, fontWeight: '600', color: colors.primary },
});
