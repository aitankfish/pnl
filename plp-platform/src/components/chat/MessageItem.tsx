'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Pin, Trash2, Star, Reply, CornerDownRight } from 'lucide-react';

interface Message {
  _id: string;
  walletAddress: string;
  displayName: string;
  message: string;
  position: 'YES' | 'NO' | 'NONE';
  positionSize: number;
  isFounder: boolean;
  isPinned: boolean;
  replyTo?: {
    _id: string;
    displayName: string;
    message: string;
  } | null;
  reactions?: Record<string, number>; // emoji -> count
}

interface MessageItemProps {
  message: Message;
  timeAgo: string;
  isOwn: boolean;
  canModerate: boolean;
  canReply: boolean;
  isConsecutive?: boolean; // Same user as previous message
  onReact: (messageId: string, emoji: string) => Promise<boolean>;
  onDelete: (messageId: string) => Promise<boolean>;
  onPin: (messageId: string, pinned: boolean) => Promise<boolean>;
  onReply: (messageId: string, displayName: string) => void;
}

const REACTION_EMOJIS = ['🚀', '💎', '🔥', '👀', '❤️'];

export default function MessageItem({
  message,
  timeAgo,
  isOwn,
  canModerate,
  canReply,
  isConsecutive = false,
  onReact,
  onDelete,
  onPin,
  onReply,
}: MessageItemProps) {
  const [showMenu, setShowMenu] = useState(false);

  // Position badge colors - more compact
  const getPositionBadge = () => {
    if (message.isFounder) {
      return (
        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium bg-yellow-500/20 text-yellow-400">
          <Star className="w-2.5 h-2.5" />
          Founder
        </span>
      );
    }

    if (message.position === 'YES') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400">
          YES {message.positionSize.toFixed(2)}
        </span>
      );
    }

    if (message.position === 'NO') {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400">
          NO {message.positionSize.toFixed(2)}
        </span>
      );
    }

    return null; // Don't show badge for spectators
  };

  const handleReact = async (emoji: string) => {
    await onReact(message._id, emoji);
  };

  const handleDelete = async () => {
    await onDelete(message._id);
    setShowMenu(false);
  };

  const handlePin = async () => {
    await onPin(message._id, !message.isPinned);
    setShowMenu(false);
  };

  // Get username color based on position
  const getUsernameColor = () => {
    if (message.isFounder) return 'text-yellow-400';
    if (message.position === 'YES') return 'text-green-400';
    if (message.position === 'NO') return 'text-red-400';
    return 'text-gray-400';
  };

  return (
    <div
      className={`group relative px-2 py-0.5 hover:bg-white/5 rounded transition-colors ${
        isConsecutive ? 'mt-0' : 'mt-2'
      }`}
    >
      {/* Action buttons - appear on hover */}
      <div className="absolute right-2 top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-[50]">
        <div className="flex items-center gap-0.5 bg-zinc-900 border border-white/10 rounded-md shadow-lg px-1">
          {/* Reaction emojis - directly in the bar */}
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReact(emoji)}
              className="p-1 text-sm hover:scale-125 hover:bg-white/10 rounded transition-all"
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}

          {/* Divider */}
          <div className="w-px h-4 bg-white/10 mx-0.5" />

          {/* Reply button */}
          {canReply && (
            <button
              onClick={() => onReply(message._id, message.displayName)}
              className="p-1.5 text-gray-400 hover:text-cyan-400 hover:bg-white/10 rounded transition-colors"
              title="Reply"
            >
              <Reply className="w-3.5 h-3.5" />
            </button>
          )}

          {/* More options */}
          {(isOwn || canModerate) && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 text-gray-400 hover:text-gray-300 hover:bg-white/10 rounded transition-colors"
                title="More"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-zinc-900 border border-white/10 rounded-lg shadow-lg py-1 min-w-[100px]">
                    {canModerate && (
                      <button
                        onClick={handlePin}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10"
                      >
                        <Pin className="w-3 h-3" />
                        {message.isPinned ? 'Unpin' : 'Pin'}
                      </button>
                    )}
                    {(isOwn || canModerate) && (
                      <button
                        onClick={handleDelete}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-white/10"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reply preview - show if this message is a reply */}
      {message.replyTo && (
        <div className="flex items-center gap-1.5 mb-0.5 text-[11px] text-gray-500">
          <CornerDownRight className="w-3 h-3 text-gray-600" />
          <span className="text-gray-500">replying to</span>
          <span className="text-gray-400 font-medium">{message.replyTo.displayName}</span>
          <span className="text-gray-600 truncate max-w-[150px]">— {message.replyTo.message}</span>
        </div>
      )}

      {/* Header - only show for non-consecutive messages */}
      {!isConsecutive && (
        <div className="flex items-center gap-2 mb-0.5">
          <Link
            href={`/profile/${message.walletAddress}`}
            className={`text-sm font-medium hover:underline ${getUsernameColor()}`}
          >
            {message.displayName}
          </Link>
          {getPositionBadge()}
          <span className="text-[10px] text-gray-600">{timeAgo}</span>
        </div>
      )}

      {/* Message content */}
      <p className={`text-[13px] text-gray-200 break-words whitespace-pre-wrap leading-relaxed ${
        isConsecutive ? 'pl-0' : ''
      }`}>
        {/* Show time on hover for consecutive messages */}
        {isConsecutive && (
          <span className="invisible group-hover:visible text-[10px] text-gray-600 mr-2 select-none">
            {timeAgo}
          </span>
        )}
        {message.message}
      </p>

      {/* Reactions display - Discord style */}
      {message.reactions && Object.keys(message.reactions).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5 -mb-0.5">
          {Object.entries(message.reactions).map(([emoji, count]) => (
            <button
              key={emoji}
              onClick={() => handleReact(emoji)}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/10 hover:bg-cyan-500/20 border border-transparent hover:border-cyan-500/30 transition-all text-sm"
            >
              <span>{emoji}</span>
              <span className="text-gray-300 text-xs font-medium">{count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
