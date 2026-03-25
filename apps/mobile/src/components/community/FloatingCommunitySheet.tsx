/**
 * FloatingCommunitySheet — Uses the same BottomSheet wrapper as VoteBottomSheet.
 *
 * Behavior:
 * - Opens when CommunitySheetProvider.market is set
 * - At 90%: Single voice room view (CommunityHub)
 * - Swipe up to 100%: TikTok-style voice room browser (VoiceRoomBrowser)
 * - Swipe down while NOT joined → closes completely
 * - Swipe down while joined → collapses to mini bar
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import GorhomBottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useCommunitySheet } from '../../providers/CommunitySheetProvider';
import { useVoiceRoomContextSafe } from '../../providers/VoiceRoomProvider';
import { useAuth } from '../../providers/AuthProvider';
import { BottomSheet } from '../BottomSheet';
import { CommunityHub } from './CommunityHub';
import { VoiceRoomBrowser } from './VoiceRoomBrowser';
import type { Market } from '@pnl/shared/hooks';

interface FloatingCommunitySheetProps {
  /** All markets from the feed */
  markets?: Market[];
  /** Map of marketAddress → participant count for active voice rooms */
  activeVoiceRooms?: Map<string, number>;
}

export function FloatingCommunitySheet({ markets, activeVoiceRooms }: FloatingCommunitySheetProps) {
  const sheetRef = useRef<GorhomBottomSheet>(null);
  const { market, initialSubTab, autoJoinAsSpeaker, close } = useCommunitySheet();
  const voice = useVoiceRoomContextSafe();
  const { walletAddress } = useAuth();
  const [isFullScreen, setIsFullScreen] = useState(false);

  const isJoinedToThisRoom = !!(
    voice?.isConnected &&
    market &&
    voice.marketAddress === market.marketAddress
  );

  // All markets for browser (sorting handled inside VoiceRoomBrowser)
  const allMarkets = markets ?? [];

  // Open sheet when market changes
  useEffect(() => {
    if (market) {
      setIsFullScreen(false);
      sheetRef.current?.snapToIndex(0);
    }
  }, [market]);

  const handleClose = useCallback(() => {
    setIsFullScreen(false);
    if (isJoinedToThisRoom && voice) {
      voice.setMinimized(true);
    }
    close();
  }, [isJoinedToThisRoom, voice, close]);

  const changeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleChange = useCallback((index: number) => {
    // Delay the content swap until the snap animation finishes to avoid glitch
    if (changeTimer.current) clearTimeout(changeTimer.current);
    changeTimer.current = setTimeout(() => {
      setIsFullScreen(index === 1);
    }, 200);
  }, []);

  const handleCollapse = useCallback(() => {
    // Go back to single room mode
    sheetRef.current?.snapToIndex(0);
    setIsFullScreen(false);
  }, []);

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={['60%', '100%']}
      onClose={handleClose}
      onChange={handleChange}
      rawContent
    >
      {isFullScreen ? (
        <VoiceRoomBrowser
          markets={allMarkets}
          activeVoiceRooms={activeVoiceRooms}
          onCollapse={handleCollapse}
        />
      ) : market ? (
        <BottomSheetView style={localStyles.content}>
          <CommunityHub
            marketId={market.marketId}
            marketAddress={market.marketAddress}
            marketName={market.marketName}
            marketDescription={market.marketDescription}
            walletAddress={walletAddress}
            founderWallet={market.founderWallet}
            hasPosition={false}
            onDismiss={() => sheetRef.current?.close()}
            initialSubTab={initialSubTab}
            autoJoinAsSpeaker={autoJoinAsSpeaker}
          />
        </BottomSheetView>
      ) : (
        <View />
      )}
    </BottomSheet>
  );
}

const localStyles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 16,
  },
});
