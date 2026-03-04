import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReAnimated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { useVoiceRoomContextSafe } from '../../providers/VoiceRoomProvider';
import { VOICE_SERVER_URL } from '../../config/init';
import { ChatRoom } from './ChatRoom';
import { VoiceRoom } from './VoiceRoom';
import { colors, spacing, typography, borderRadius } from '../../theme';

type SubTab = 'Chat' | 'Voice';

interface CommunityHubProps {
  marketId: string;
  marketAddress: string;
  marketName: string;
  walletAddress?: string | null;
  founderWallet?: string | null;
  hasPosition: boolean;
  /** Called when user swipes left to dismiss the Community tab */
  onDismiss?: () => void;
  /** Privy access token getter for authenticated API calls */
  getAccessToken?: () => Promise<string | null>;
  /** Open directly on the Voice sub-tab */
  initialSubTab?: 'Chat' | 'Voice';
}

export function CommunityHub({
  marketId,
  marketAddress,
  marketName,
  walletAddress,
  founderWallet,
  hasPosition,
  onDismiss,
  getAccessToken,
  initialSubTab,
}: CommunityHubProps) {
  const voice = useVoiceRoomContextSafe();
  const isConnectedToThisRoom = voice?.isConnected && voice.marketAddress === marketAddress;
  const [activeTab, setActiveTab] = useState<SubTab>(
    initialSubTab || (isConnectedToThisRoom ? 'Voice' : 'Chat'),
  );

  // Swipe right or swipe down to minimize/dismiss
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const gestureDirection = useSharedValue<'none' | 'horizontal' | 'vertical'>('none');

  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  const dismissWithMinimize = useCallback(() => {
    if (isConnectedToThisRoom && voice) {
      voice.setMinimized(true);
    }
    handleDismiss();
  }, [isConnectedToThisRoom, voice, handleDismiss]);

  const DISMISS_THRESHOLD = 120;

  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .activeOffsetY([-20, 20])
    .onUpdate((e) => {
      // Lock direction on first significant movement
      if (gestureDirection.value === 'none') {
        if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
          gestureDirection.value = 'horizontal';
        } else {
          gestureDirection.value = 'vertical';
        }
      }

      if (gestureDirection.value === 'horizontal' && e.translationX > 0) {
        translateX.value = e.translationX;
      } else if (gestureDirection.value === 'vertical' && e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (gestureDirection.value === 'horizontal' && e.translationX > DISMISS_THRESHOLD) {
        translateX.value = withSpring(400, { damping: 20 });
        runOnJS(dismissWithMinimize)();
      } else if (gestureDirection.value === 'vertical' && e.translationY > DISMISS_THRESHOLD) {
        translateY.value = withSpring(800, { damping: 20 });
        runOnJS(dismissWithMinimize)();
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
      gestureDirection.value = 'none';
    });

  const animatedStyle = useAnimatedStyle(() => {
    const progress = Math.max(translateX.value / 500, translateY.value / 600);
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        // Scale down slightly on swipe-down for a minimize feel
        { scale: 1 - translateY.value / 2000 },
      ],
      opacity: 1 - progress,
    };
  });

  // Voice room status polling for non-connected users (matches web CommunityHub)
  const [voiceRoomActive, setVoiceRoomActive] = useState(false);
  const [voiceParticipantCount, setVoiceParticipantCount] = useState(0);

  // If connected to this room, use real-time context data
  useEffect(() => {
    if (isConnectedToThisRoom) {
      setVoiceRoomActive(true);
      setVoiceParticipantCount((voice?.participants?.length || 0) + 1);
    }
  }, [isConnectedToThisRoom, voice?.participants?.length]);

  // Poll voice server for room status when NOT connected (for visitors/strangers)
  useEffect(() => {
    if (isConnectedToThisRoom) return;

    const fetchRoomStatus = async () => {
      try {
        const response = await fetch(`${VOICE_SERVER_URL}/room-status/${marketAddress}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (response.ok) {
          const data = await response.json();
          setVoiceRoomActive(data.active && data.participantCount > 0);
          setVoiceParticipantCount(data.participantCount || 0);
        }
      } catch {
        setVoiceRoomActive(false);
        setVoiceParticipantCount(0);
      }
    };

    fetchRoomStatus();
    const interval = setInterval(fetchRoomStatus, 10000);
    return () => clearInterval(interval);
  }, [marketAddress, isConnectedToThisRoom]);

  const showLiveIndicator = voiceRoomActive;

  return (
    <GestureDetector gesture={panGesture}>
      <ReAnimated.View style={[styles.container, animatedStyle]}>
        {/* Sub-tab switcher */}
        <View style={styles.tabBar}>
          <Pressable
            onPress={() => setActiveTab('Chat')}
            style={[styles.tab, activeTab === 'Chat' && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === 'Chat' && styles.tabTextActive]}>Chat</Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('Voice')}
            style={[styles.tab, activeTab === 'Voice' && styles.tabActive, showLiveIndicator && styles.tabVoiceLive]}
          >
            <View style={styles.voiceTabContent}>
              <Text style={[styles.tabText, activeTab === 'Voice' && styles.tabTextActive, showLiveIndicator && styles.tabTextLive]}>Voice</Text>
              {showLiveIndicator && (
                <>
                  <View style={styles.liveDot} />
                  {voiceParticipantCount > 0 && (
                    <Text style={styles.liveCount}>({voiceParticipantCount})</Text>
                  )}
                </>
              )}
            </View>
          </Pressable>
        </View>

        {/* Content */}
        {activeTab === 'Chat' ? (
          <ChatRoom
            marketAddress={marketAddress}
            walletAddress={walletAddress}
            founderWallet={founderWallet}
            hasPosition={hasPosition}
            getAccessToken={getAccessToken}
          />
        ) : (
          <VoiceRoom
            marketId={marketId}
            marketAddress={marketAddress}
            marketName={marketName}
            walletAddress={walletAddress}
            founderWallet={founderWallet}
            hasPosition={hasPosition}
          />
        )}
      </ReAnimated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.captionBold,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabVoiceLive: {
    borderBottomColor: '#22c55e',
  },
  tabTextLive: {
    color: '#4ade80',
  },
  voiceTabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  liveCount: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4ade80',
  },
});
