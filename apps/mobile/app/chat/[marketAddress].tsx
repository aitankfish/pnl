/**
 * Project Chat — Dedicated full-screen chat room for a market.
 *
 * Gated to voters and token holders only.
 * Voice room stays connected in the background (user can hear while chatting).
 * Will eventually host agent updates, GitHub pushes, milestone alerts, etc.
 */

import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useSWR from 'swr';
import { useNetwork } from '@pnl/shared/hooks';
import { fetcher } from '@pnl/shared/services';
import { apiUrl } from '@pnl/shared/utils';
import { useAuth } from '../../src/providers/AuthProvider';
import { useVoiceRoomContextSafe } from '../../src/providers/VoiceRoomProvider';
import { ChatRoom } from '../../src/components/community/ChatRoom';
import { PressableScale } from '../../src/components/PressableScale';
import { StarField } from '../../src/components';
import { colors, spacing } from '../../src/theme';

export default function ProjectChatScreen() {
  const insets = useSafeAreaInsets();
  const { marketAddress, marketName, marketId, founderWallet } = useLocalSearchParams<{
    marketAddress: string;
    marketName?: string;
    marketId?: string;
    founderWallet?: string;
  }>();
  const { walletAddress } = useAuth();
  const { network } = useNetwork();
  const voice = useVoiceRoomContextSafe();

  // Check if user is in voice room for this market
  const isInVoiceRoom = voice?.isConnected && voice.marketAddress === marketAddress;

  // Fetch position data to gate chat
  const { data: positionResponse } = useSWR(
    marketId && walletAddress
      ? apiUrl(`/api/markets/${marketId}/position?wallet=${walletAddress}&network=${network}`)
      : null,
    fetcher,
    { dedupingInterval: 10000 },
  );
  const positionData = (positionResponse as any)?.success ? (positionResponse as any).data : null;
  const hasPosition = __DEV__ || !!positionData?.hasPosition;

  const displayName = marketName || marketAddress?.slice(0, 8) + '...';

  return (
    <StarField>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header — clean, no back button (swipe right to go back) */}
        <View style={styles.header}>
          <View style={styles.headerCenter}>
            <View style={styles.titleRow}>
              <Ionicons name="chatbubbles" size={14} color={colors.primary} />
              <Text style={styles.headerTitle} numberOfLines={1}>
                {displayName}
              </Text>
            </View>
            <View style={styles.badgeRow}>
              <View style={styles.votersBadge}>
                <Text style={styles.votersBadgeText}>Voters only</Text>
              </View>
              {isInVoiceRoom && (
                <View style={styles.voiceLiveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.voiceLiveText}>Voice live</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Chat room */}
        <View style={styles.chatContainer}>
          <ChatRoom
            marketAddress={marketAddress!}
            walletAddress={walletAddress}
            founderWallet={founderWallet || null}
            hasPosition={hasPosition}
          />
        </View>
      </View>
    </StarField>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: spacing.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    maxWidth: 200,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  votersBadge: {
    backgroundColor: 'rgba(129,140,248,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.2)',
  },
  votersBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: 0.3,
  },
  voiceLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(74,222,128,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#4ade80',
  },
  voiceLiveText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#4ade80',
  },

  // ─── Chat ───
  chatContainer: {
    flex: 1,
  },
});
