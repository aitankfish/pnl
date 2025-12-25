'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import MessageItem from './MessageItem';
import { Loader2 } from 'lucide-react';

interface Message {
  _id: string;
  walletAddress: string;
  displayName: string;
  message: string;
  position: 'YES' | 'NO' | 'NONE';
  positionSize: number;
  isFounder: boolean;
  isPinned: boolean;
  createdAt: Date | string;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  hasMore: boolean;
  currentWallet?: string | null;
  founderWallet?: string | null;
  hasPosition?: boolean;
  onLoadMore: () => void;
  onReact: (messageId: string, emoji: string) => Promise<boolean>;
  onDelete: (messageId: string) => Promise<boolean>;
  onPin: (messageId: string, pinned: boolean) => Promise<boolean>;
  onReply: (messageId: string, displayName: string) => void;
}

export default function MessageList({
  messages,
  isLoading,
  hasMore,
  currentWallet,
  founderWallet,
  hasPosition,
  onLoadMore,
  onReact,
  onDelete,
  onPin,
  onReply,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (shouldAutoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, shouldAutoScroll]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

    setShouldAutoScroll(isNearBottom);

    // Load more when scrolling to top
    if (scrollTop < 50 && hasMore && !isLoading) {
      onLoadMore();
    }
  }, [hasMore, isLoading, onLoadMore]);

  // Format timestamp
  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2 p-4">
          <div className="text-3xl">💬</div>
          <p className="text-sm text-gray-400">No messages yet</p>
          <p className="text-xs text-gray-500">Be the first to start the conversation!</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-3 py-2 space-y-2 custom-scrollbar"
      onScroll={handleScroll}
    >
      {/* Load more indicator */}
      {isLoading && hasMore && (
        <div className="flex justify-center py-2">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        </div>
      )}

      {hasMore && !isLoading && (
        <button
          onClick={onLoadMore}
          className="w-full py-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
        >
          Load earlier messages
        </button>
      )}

      {/* Messages */}
      {messages.map((msg) => (
        <MessageItem
          key={msg._id}
          message={msg}
          timeAgo={formatTime(msg.createdAt)}
          isOwn={msg.walletAddress === currentWallet}
          canModerate={founderWallet === currentWallet}
          canReply={!!currentWallet && (hasPosition || founderWallet === currentWallet)}
          onReact={onReact}
          onDelete={onDelete}
          onPin={onPin}
          onReply={onReply}
        />
      ))}

      {/* Scroll anchor */}
      <div ref={bottomRef} />

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(55, 65, 81, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(107, 114, 128, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(107, 114, 128, 0.7);
        }
      `}</style>
    </div>
  );
}
