import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
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
}

export function CommunityHub({
  marketId,
  marketAddress,
  marketName,
  walletAddress,
  founderWallet,
  hasPosition,
}: CommunityHubProps) {
  const [activeTab, setActiveTab] = useState<SubTab>('Chat');
  const voice = useVoiceRoomContextSafe();
  const isConnectedToThisRoom = voice?.isConnected && voice.marketAddress === marketAddress;

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
    <View style={styles.container}>
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
    </View>
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
