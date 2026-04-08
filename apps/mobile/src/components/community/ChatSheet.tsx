/**
 * ChatSheet — Bottom sheet that overlays the voice room with project chat.
 *
 * - Slides up at 55% (peek) or 90% (full)
 * - Voice room stays live underneath
 * - Header shows "Project Chat · Voters only"
 * - Body renders the existing ChatRoom component
 */

import { forwardRef, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import GorhomBottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { ChatRoom } from './ChatRoom';
import { colors, spacing, borderRadius } from '../../theme';

interface ChatSheetProps {
  marketAddress: string;
  marketName: string;
  walletAddress?: string | null;
  founderWallet?: string | null;
  hasPosition: boolean;
  getAccessToken?: () => Promise<string | null>;
}

export const ChatSheet = forwardRef<GorhomBottomSheet, ChatSheetProps>(
  ({ marketAddress, marketName, walletAddress, founderWallet, hasPosition, getAccessToken }, ref) => {
    const handleSheetChange = useCallback((index: number) => {
      // Could track analytics here
    }, []);

    return (
      <GorhomBottomSheet
        ref={ref}
        index={-1}
        snapPoints={['55%', '90%']}
        enablePanDownToClose
        onChange={handleSheetChange}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
        style={styles.sheet}
      >
        <BottomSheetView style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="chatbubbles" size={16} color={colors.primary} />
              <Text style={styles.headerTitle}>Project Chat</Text>
              <View style={styles.votersBadge}>
                <Text style={styles.votersBadgeText}>Voters only</Text>
              </View>
            </View>
          </View>

          {/* Chat room */}
          <View style={styles.chatContainer}>
            <ChatRoom
              marketAddress={marketAddress}
              walletAddress={walletAddress}
              founderWallet={founderWallet}
              hasPosition={hasPosition}
              getAccessToken={getAccessToken}
            />
          </View>
        </BottomSheetView>
      </GorhomBottomSheet>
    );
  },
);

ChatSheet.displayName = 'ChatSheet';

const styles = StyleSheet.create({
  sheet: {
    zIndex: 200,
  },
  sheetBackground: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.15)',
    // Glow effect at top
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  handleIndicator: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 36,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
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
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: 0.3,
  },
  chatContainer: {
    flex: 1,
  },
});
