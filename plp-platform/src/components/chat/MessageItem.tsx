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
}

interface MessageItemProps {
  message: Message;
  timeAgo: string;
  isOwn: boolean;
  canModerate: boolean;
  canReply: boolean;
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
  onReact,
  onDelete,
  onPin,
  onReply,
}: MessageItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  // Position badge colors
  const getPositionBadge = () => {
    if (message.isFounder) {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
          <Star className="w-2.5 h-2.5" />
          Founder
        </span>
      );
    }

    if (message.position === 'YES') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-400 border border-green-500/30">
          🟢 YES ({message.positionSize.toFixed(2)})
        </span>
      );
    }

    if (message.position === 'NO') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400 border border-red-500/30">
          🔴 NO ({message.positionSize.toFixed(2)})
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-500/20 text-gray-400 border border-gray-500/30">
        ⚪ Spectator
      </span>
    );
  };

  const handleReact = async (emoji: string) => {
    await onReact(message._id, emoji);
    setShowReactions(false);
  };

  const handleDelete = async () => {
    await onDelete(message._id);
    setShowMenu(false);
  };

  const handlePin = async () => {
    await onPin(message._id, !message.isPinned);
    setShowMenu(false);
  };

  return (
    <div
      className={`group relative p-2 rounded-lg transition-all ${
        isOwn
          ? 'bg-cyan-500/10 border border-cyan-500/20'
          : 'bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={`/profile/${message.walletAddress}`}
            className="text-xs font-medium text-gray-300 truncate hover:text-cyan-400 transition-colors"
          >
            {message.displayName}
          </Link>
          {getPositionBadge()}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-gray-500">{timeAgo}</span>

          {/* Menu button */}
          {(isOwn || canModerate) && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
              >
                <MoreHorizontal className="w-3 h-3 text-gray-400" />
              </button>

              {/* Menu dropdown */}
              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-black/80 backdrop-blur-md border border-white/20 rounded-lg shadow-lg py-1 min-w-[120px]">
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
        <div className="mb-1.5 pl-2 border-l-2 border-cyan-500/30 bg-white/5 rounded-r py-1 px-2">
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <CornerDownRight className="w-2.5 h-2.5" />
            <span>Replying to <span className="text-gray-400">{message.replyTo.displayName}</span></span>
          </div>
          <p className="text-xs text-gray-500 truncate">{message.replyTo.message}</p>
        </div>
      )}

      {/* Message content */}
      <p className="text-sm text-gray-200 break-words whitespace-pre-wrap">
        {message.message}
      </p>

      {/* Reactions and Reply */}
      <div className="flex items-center gap-1 mt-1.5">
        {/* Reply button */}
        {canReply && (
          <button
            onClick={() => onReply(message._id, message.displayName)}
            className="p-1 rounded text-gray-500 hover:text-cyan-400 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100 flex items-center gap-0.5"
          >
            <Reply className="w-3 h-3" />
            <span className="text-[10px]">Reply</span>
          </button>
        )}

        {/* Reaction picker toggle */}
        <div className="relative">
          <button
            onClick={() => setShowReactions(!showReactions)}
            className="p-1 rounded text-gray-500 hover:text-gray-400 hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
          >
            <span className="text-xs">+</span>
          </button>

          {/* Reaction picker */}
          {showReactions && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowReactions(false)}
              />
              <div className="absolute left-0 bottom-full mb-1 z-20 flex gap-1 bg-black/80 backdrop-blur-md border border-white/20 rounded-lg shadow-lg p-1">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className="p-1 rounded hover:bg-white/20 transition-colors text-sm"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
