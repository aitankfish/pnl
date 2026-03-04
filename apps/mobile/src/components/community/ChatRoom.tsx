import { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useChat } from '@pnl/shared/hooks';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { PinnedMessageBanner } from './PinnedMessageBanner';
import { colors } from '../../theme';

interface ChatRoomProps {
  marketAddress: string;
  walletAddress?: string | null;
  founderWallet?: string | null;
  hasPosition: boolean;
  getAccessToken?: () => Promise<string | null>;
}

export function ChatRoom({ marketAddress, walletAddress, founderWallet, hasPosition, getAccessToken }: ChatRoomProps) {
  const {
    messages,
    pinnedMessages,
    isLoading,
    hasMore,
    typingUsers,
    error,
    sendMessage,
    sendTyping,
    loadMore,
    addReaction,
    deleteMessage,
    togglePin,
  } = useChat({ marketAddress, walletAddress, getAccessToken });

  const [replyToId, setReplyToId] = useState<string | null>(null);

  const isFounder = !!walletAddress && !!founderWallet && walletAddress === founderWallet;

  const replyToMessage = useMemo(() => {
    if (!replyToId) return null;
    return messages.find((m) => m._id === replyToId) || null;
  }, [replyToId, messages]);

  const handleReply = useCallback((messageId: string) => {
    setReplyToId(messageId);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyToId(null);
  }, []);

  const handleReact = useCallback(
    (messageId: string, emoji: string) => {
      addReaction(messageId, emoji);
    },
    [addReaction],
  );

  const handleDelete = useCallback(
    (messageId: string) => {
      deleteMessage(messageId);
    },
    [deleteMessage],
  );

  const handlePin = useCallback(
    (messageId: string, pinned: boolean) => {
      togglePin(messageId, pinned);
    },
    [togglePin],
  );

  return (
    <View style={styles.container}>
      <PinnedMessageBanner
        messages={pinnedMessages}
        isFounder={isFounder}
        onUnpin={(id) => handlePin(id, false)}
      />

      <ChatMessageList
        messages={messages}
        walletAddress={walletAddress}
        founderWallet={founderWallet}
        hasPosition={hasPosition}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onReply={handleReply}
        onReact={handleReact}
        onDelete={handleDelete}
        onPin={handlePin}
      />

      <TypingIndicator users={typingUsers} />

      <ChatInput
        walletAddress={walletAddress}
        hasPosition={hasPosition}
        isFounder={isFounder}
        replyToMessage={replyToMessage}
        onSend={sendMessage}
        onTyping={sendTyping}
        onCancelReply={handleCancelReply}
        error={error}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
