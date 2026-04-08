/**
 * FloatingMiniVoiceBar — Appears BELOW the tab bar when user is connected
 * to a voice room and has minimized the community sheet.
 *
 * Tap → re-opens the FloatingCommunitySheet for that market.
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useVoiceRoomContextSafe } from '../../providers/VoiceRoomProvider';
import { useCommunitySheetSafe } from '../../providers/CommunitySheetProvider';
import { PressableScale } from '../PressableScale';

export function FloatingMiniVoiceBar() {
  const voice = useVoiceRoomContextSafe();
  const communitySheet = useCommunitySheetSafe();
  const insets = useSafeAreaInsets();

  // Only show when user is connected AND minimized
  if (!voice?.isConnected || !voice.isMinimized) return null;

  const participantCount = voice.participants.length + 1;
  const roomLabel = voice.roomTitle || voice.marketName || 'Voice Room';

  const tabBarHeight = Platform.OS === 'ios' ? 60 + insets.bottom : 68;

  const handleTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    voice.setMinimized(false);

    // Re-open the floating community sheet
    if (communitySheet && voice.marketId && voice.marketAddress && voice.marketName) {
      communitySheet.open(
        {
          marketId: voice.marketId,
          marketAddress: voice.marketAddress,
          marketName: voice.marketName,
          founderWallet: voice.founderWallet,
        },
        'Voice',
      );
    }
  };

  return (
    <View style={[styles.wrapper, { bottom: tabBarHeight }]} pointerEvents="box-none">
      <PressableScale onPress={handleTap} style={styles.pill}>
        <View style={styles.liveDot} />
        <Text style={styles.label} numberOfLines={1}>
          {roomLabel}
        </Text>
        <View style={styles.countBadge}>
          <Ionicons name="people" size={9} color="#4ade80" />
          <Text style={styles.count}>{participantCount}</Text>
        </View>
        {voice.isMuted ? (
          <Ionicons name="mic-off" size={12} color="#ef4444" />
        ) : (
          <Ionicons name="mic" size={12} color="#4ade80" />
        )}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 200,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 14, 26, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
    maxWidth: 260,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e2e8f0',
    flexShrink: 1,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  count: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4ade80',
  },
});
