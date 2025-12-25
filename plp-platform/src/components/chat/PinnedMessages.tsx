'use client';

import React, { useState } from 'react';
import { Pin, ChevronDown, ChevronUp, X } from 'lucide-react';

interface PinnedMessage {
  _id: string;
  displayName: string;
  message: string;
  isFounder: boolean;
}

interface PinnedMessagesProps {
  messages: PinnedMessage[];
  founderWallet?: string | null;
  currentWallet?: string | null;
  onUnpin: (messageId: string) => Promise<boolean>;
}

export default function PinnedMessages({
  messages,
  founderWallet,
  currentWallet,
  onUnpin,
}: PinnedMessagesProps) {
  const [expanded, setExpanded] = useState(false);
  const canModerate = founderWallet === currentWallet;

  if (messages.length === 0) return null;

  const displayMessage = expanded ? messages : [messages[0]];

  return (
    <div className="border-b border-gray-700/30 bg-yellow-500/10 backdrop-blur-sm">
      {displayMessage.map((msg, index) => (
        <div
          key={msg._id}
          className={`px-3 py-2 flex items-start gap-2 ${
            index > 0 ? 'border-t border-gray-700/30' : ''
          }`}
        >
          <Pin className="w-3 h-3 text-yellow-400 mt-1 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-xs font-medium text-gray-300">{msg.displayName}</span>
              {msg.isFounder && (
                <span className="text-[10px] text-yellow-400">Founder</span>
              )}
            </div>
            <p className="text-xs text-gray-400 truncate">{msg.message}</p>
          </div>
          {canModerate && (
            <button
              onClick={() => onUnpin(msg._id)}
              className="p-1 rounded hover:bg-gray-700/50 text-gray-500 hover:text-gray-400 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ))}

      {/* Expand/collapse button */}
      {messages.length > 1 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-3 py-1 flex items-center justify-center gap-1 text-[10px] text-gray-500 hover:text-gray-400 transition-colors border-t border-gray-700/30"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Show {messages.length - 1} more pinned
            </>
          )}
        </button>
      )}
    </div>
  );
}
