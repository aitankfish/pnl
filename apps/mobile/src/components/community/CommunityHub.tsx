import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useVoiceRoomContextSafe } from '../../providers/VoiceRoomProvider';
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
  const voiceIsLive = voice?.isConnected && voice.marketAddress === marketAddress;

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
          style={[styles.tab, activeTab === 'Voice' && styles.tabActive]}
        >
          <View style={styles.voiceTabContent}>
            <Text style={[styles.tabText, activeTab === 'Voice' && styles.tabTextActive]}>Voice</Text>
            {voiceIsLive && <View style={styles.liveDot} />}
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
  voiceTabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.livePulse,
  },
});
