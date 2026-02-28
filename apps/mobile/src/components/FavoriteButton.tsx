/**
 * FavoriteButton — Heart toggle with count
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { apiUrl } from '@pnl/shared/utils';
import { PressableScale } from './PressableScale';
import { colors, spacing, borderRadius, typography } from '../theme';

interface FavoriteButtonProps {
  marketId: string;
  walletAddress: string | null;
  initialCount?: number;
}

export function FavoriteButton({ marketId, walletAddress, initialCount = 0 }: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);

  // Check if user has favorited this market
  useEffect(() => {
    if (!walletAddress) return;
    let mounted = true;

    const checkFavorite = async () => {
      try {
        const res = await fetch(apiUrl(`/api/profile/${walletAddress}`));
        const data = await res.json();
        if (mounted && data.success && data.data?.favoriteMarkets) {
          setIsFavorite(data.data.favoriteMarkets.includes(marketId));
        }
      } catch {
        // non-critical
      }
    };

    checkFavorite();
    return () => { mounted = false; };
  }, [walletAddress, marketId]);

  const toggleFavorite = useCallback(async () => {
    if (!walletAddress || isLoading) return;
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Optimistic update
    const wasFavorite = isFavorite;
    setIsFavorite(!wasFavorite);
    setCount(prev => wasFavorite ? prev - 1 : prev + 1);

    try {
      const res = await fetch(apiUrl(`/api/profile/${walletAddress}/favorites`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId }),
      });
      const data = await res.json();
      if (data.success) {
        setIsFavorite(data.data?.isFavorite ?? !wasFavorite);
      } else {
        // Revert optimistic update
        setIsFavorite(wasFavorite);
        setCount(prev => wasFavorite ? prev + 1 : prev - 1);
      }
    } catch {
      // Revert
      setIsFavorite(wasFavorite);
      setCount(prev => wasFavorite ? prev + 1 : prev - 1);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, marketId, isFavorite, isLoading]);

  return (
    <PressableScale onPress={toggleFavorite} style={styles.container} disabled={!walletAddress}>
      <Ionicons
        name={isFavorite ? 'heart' : 'heart-outline'}
        size={20}
        color={isFavorite ? colors.danger : '#fff'}
      />
      {count > 0 && (
        <Text style={styles.count}>{count}</Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  count: {
    ...typography.micro,
    color: '#fff',
  },
});
