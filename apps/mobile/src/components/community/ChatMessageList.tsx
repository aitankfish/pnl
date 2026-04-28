import { useRef, useCallback, useMemo } from 'react';
import { View, FlatList, ActivityIndicator, Text, StyleSheet } from 'react-native';
import type { IChatMessage } from '@pnl/shared/hooks';
import { ChatMessageItem } from './ChatMessageItem';
import { colors, spacing, typography, editorial } from '../../theme';

interface ChatMessageListProps {
  messages: IChatMessage[];
  walletAddress?: string | null;
  founderWallet?: string | null;
  hasPosition: boolean;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onReply: (messageId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onDelete: (messageId: string) => void;
  onPin: (messageId: string, pinned: boolean) => void;
}

const CONSECUTIVE_THRESHOLD = 5 * 60 * 1000; // 5 minutes

export function ChatMessageList({
  messages,
  walletAddress,
  founderWallet,
  hasPosition,
  isLoading,
  hasMore,
  onLoadMore,
  onReply,
  onReact,
  onDelete,
  onPin,
}: ChatMessageListProps) {
  const flatListRef = useRef<FlatList>(null);
  const isFounder = !!walletAddress && !!founderWallet && walletAddress === founderWallet;

  // Build reply lookup
  const replyLookup = useMemo(() => {
    const map = new Map<string, IChatMessage>();
    messages.forEach((m) => map.set(m._id, m));
    return map;
  }, [messages]);

  const isConsecutive = useCallback(
    (msg: IChatMessage, idx: number): boolean => {
      // FlatList is inverted so index 0 = newest. Previous message = idx+1.
      const prevMsg = messages[idx + 1];
      if (!prevMsg) return false;
      if (prevMsg.walletAddress !== msg.walletAddress) return false;
      const timeDiff = new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime();
      return timeDiff < CONSECUTIVE_THRESHOLD;
    },
    [messages],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: IChatMessage; index: number }) => {
      const replyMsg = item.replyTo ? replyLookup.get(item.replyTo) : null;
      return (
        <ChatMessageItem
          message={item}
          isOwn={item.walletAddress === walletAddress}
          isFounder={isFounder}
          founderWallet={founderWallet}
          isConsecutive={isConsecutive(item, index)}
          canReply={hasPosition || isFounder}
          onReply={onReply}
          onReact={onReact}
          onDelete={onDelete}
          onPin={onPin}
          replyMessage={replyMsg}
        />
      );
    },
    [walletAddress, isFounder, founderWallet, hasPosition, isConsecutive, replyLookup, onReply, onReact, onDelete, onPin],
  );

  const renderFooter = useCallback(() => {
    if (!hasMore) return null;
    if (isLoading) {
      return (
        <View style={styles.loader}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }
    return null;
  }, [hasMore, isLoading]);

  if (messages.length === 0 && !isLoading) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyMood}>
          First word in this room.{'\n'}Make it count.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      renderItem={renderItem}
      keyExtractor={(item) => item._id}
      inverted
      onEndReached={hasMore ? onLoadMore : undefined}
      onEndReachedThreshold={0.3}
      ListFooterComponent={renderFooter}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: spacing.sm,
    flexGrow: 1,
  },
  loader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyMood: {
    ...editorial.mood,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
});
