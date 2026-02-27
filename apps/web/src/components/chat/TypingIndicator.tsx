'use client';

import React from 'react';

interface TypingUser {
  displayName: string;
  timestamp: number;
}

interface TypingIndicatorProps {
  users: TypingUser[];
}

export default function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const getTypingText = () => {
    if (users.length === 1) {
      return `${users[0].displayName} is typing...`;
    }
    if (users.length === 2) {
      return `${users[0].displayName} and ${users[1].displayName} are typing...`;
    }
    return `${users[0].displayName} and ${users.length - 1} others are typing...`;
  };

  return (
    <div className="px-3 py-1.5 border-t border-gray-700/30">
      <div className="flex items-center gap-2">
        {/* Animated dots */}
        <div className="flex gap-0.5">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-xs text-gray-400">{getTypingText()}</span>
      </div>
    </div>
  );
}
