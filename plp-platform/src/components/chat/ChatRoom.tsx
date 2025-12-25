'use client';

import React, { useState, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useChat } from '@/lib/hooks/useChat';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import PinnedMessages from './PinnedMessages';
import TypingIndicator from './TypingIndicator';
import { Users, Wifi, WifiOff } from 'lucide-react';

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
    userCount,
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
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2 p-4">
            <div className="text-3xl">😕</div>
            <p className="text-sm text-gray-400">Failed to load chat</p>
            <p className="text-xs text-gray-500">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-transparent ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/30 bg-gray-900/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">Chat</span>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Users className="w-3 h-3" />
            <span>{userCount}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isConnected ? (
            <Wifi className="w-3 h-3 text-green-400" />
          ) : (
            <WifiOff className="w-3 h-3 text-red-400" />
          )}
        </div>
      </div>

      {/* Pinned Messages */}
      {pinnedMessages.length > 0 && (
        <PinnedMessages
          messages={pinnedMessages}
          founderWallet={founderWallet}
          currentWallet={walletAddress}
          onUnpin={(messageId) => togglePin(messageId, false)}
        />
      )}

      {/* Message List */}
      <MessageList
        messages={messages}
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
