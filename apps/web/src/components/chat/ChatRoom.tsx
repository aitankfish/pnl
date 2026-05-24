'use client';

import React, { useState, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useChat } from '@/lib/hooks/useChat';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import PinnedMessages from './PinnedMessages';
import TypingIndicator from './TypingIndicator';
import { SeedIcon } from '@/components/PlantIcons';

// Cosmic-plant palette
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const EARTH = '#d67347';

interface ChatRoomProps {
  marketAddress: string;
  walletAddress?: string | null;
  founderWallet?: string | null;
  hasPosition?: boolean;
  className?: string;
}

export default function ChatRoom({ marketAddress, walletAddress, founderWallet, hasPosition, className }: ChatRoomProps) {
  const { getAccessToken } = usePrivy();
  const [replyTo, setReplyTo] = useState<{ id: string; displayName: string } | null>(null);

  const {
    messages,
    pinnedMessages,
    isLoading,
    hasMore,
    typingUsers,
    error,
    isConnected,
    sendMessage,
    sendTyping,
    loadMore,
    addReaction,
    deleteMessage,
    togglePin,
  } = useChat({ marketAddress, walletAddress, getAccessToken });

  const handleSendMessage = async (text: string, replyToId?: string) => {
    const result = await sendMessage(text, replyToId);
    return result;
  };

  const handleReply = useCallback((messageId: string, displayName: string) => {
    setReplyTo({ id: messageId, displayName });
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  if (error && !messages.length) {
    return (
      <div className={`flex flex-col h-full bg-transparent ${className}`}>
        <div className="flex-1 flex items-center justify-center px-6">
          <div
            className="text-center max-w-xs px-6 py-8"
            style={{
              background: 'rgba(214,115,71,0.06)',
              border: `1px solid ${EARTH}55`,
            }}
          >
            <SeedIcon className="w-7 h-7 mx-auto mb-3" />
            <p
              className="mb-2"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: '0.95rem',
                fontWeight: 350,
              }}
            >
              The grove is quiet.
            </p>
            <p
              className="mono uppercase tracking-[0.22em] text-[0.55rem]"
              style={{ color: CREAM_FAINT }}
            >
              Couldn't reach the chat
            </p>
            {error && (
              <p
                className="mt-2 italic text-[0.7rem]"
                style={{
                  color: CREAM_DIM,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontStyle: 'italic',
                }}
              >
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-transparent ${className}`}>
      {/* Pinned Messages */}
      {pinnedMessages.length > 0 && (
        <PinnedMessages
          messages={pinnedMessages as any}
          founderWallet={founderWallet}
          currentWallet={walletAddress}
          onUnpin={(messageId) => togglePin(messageId, false)}
        />
      )}

      {/* Message List */}
      <MessageList
        messages={messages as any}
        isLoading={isLoading}
        hasMore={hasMore}
        currentWallet={walletAddress}
        founderWallet={founderWallet}
        hasPosition={hasPosition}
        onLoadMore={loadMore}
        onReact={addReaction}
        onDelete={deleteMessage}
        onPin={(messageId, pinned) => togglePin(messageId, pinned)}
        onReply={handleReply}
      />

      {/* Typing Indicator */}
      <TypingIndicator users={typingUsers} />

      {/* Message Input */}
      <MessageInput
        onSend={handleSendMessage}
        onTyping={sendTyping}
        disabled={!walletAddress}
        isConnected={isConnected}
        hasPosition={hasPosition}
        isFounder={walletAddress === founderWallet}
        replyTo={replyTo}
        onCancelReply={handleCancelReply}
      />
    </div>
  );
}
