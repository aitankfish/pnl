'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Send, Loader2, X, Reply } from 'lucide-react';

interface MessageInputProps {
  onSend: (message: string, replyTo?: string) => Promise<{ success: boolean; error?: string }>;
  onTyping: (displayName?: string) => void;
  disabled?: boolean;
  isConnected: boolean;
  hasPosition?: boolean;
  isFounder?: boolean;
  replyTo?: { id: string; displayName: string } | null;
  onCancelReply?: () => void;
}

export default function MessageInput({
  onSend,
  onTyping,
  disabled,
  isConnected,
  hasPosition,
  isFounder,
  replyTo,
  onCancelReply,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;

    // Limit to 500 characters
    if (value.length > 500) return;

    setMessage(value);
    setError(null);

    // Send typing indicator (debounced)
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onTyping();
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleSubmit = useCallback(async () => {
    if (!message.trim() || disabled || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      const result = await onSend(message.trim(), replyTo?.id);

      if (result.success) {
        setMessage('');
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
        }
        // Clear reply after successful send
        if (onCancelReply) {
          onCancelReply();
        }
      } else {
        setError(result.error || 'Failed to send message');
      }
    } catch (err) {
      setError('Failed to send message');
    } finally {
      setIsSending(false);
    }
  }, [message, disabled, isSending, onSend, replyTo, onCancelReply]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 100) + 'px';
  };

  return (
    <div className="px-3 py-2 border-t border-gray-700/50">
      {/* Error message */}
      {error && (
        <div className="mb-2 px-2 py-1 text-xs text-red-400 bg-red-500/10 rounded">
          {error}
        </div>
      )}

      {/* Disabled state message */}
      {disabled && !error && (
        <div className="mb-2 px-3 py-2 text-sm text-gray-300 bg-gray-700/30 rounded-lg text-center">
          Sign in to join the conversation
        </div>
      )}

      {/* No position message - shown when signed in but no position */}
      {!disabled && !hasPosition && !isFounder && (
        <div className="mb-2 px-3 py-2 text-sm text-amber-300 bg-amber-500/10 rounded-lg text-center">
          Vote YES or NO to unlock chat
        </div>
      )}

      {/* Reply indicator */}
      {replyTo && (
        <div className="mb-2 px-3 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Reply className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <span className="text-xs text-gray-400">
              Replying to <span className="text-cyan-400 font-medium">{replyTo.displayName}</span>
            </span>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 rounded hover:bg-gray-700/50 text-gray-400 hover:text-gray-300 transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={
              disabled
                ? 'Sign in to chat...'
                : (!hasPosition && !isFounder)
                  ? 'Vote to unlock chat...'
                  : 'Type a message...'
            }
            disabled={disabled || isSending || (!hasPosition && !isFounder)}
            rows={1}
            className="w-full px-3 py-2 text-sm bg-gray-800/50 border border-gray-700/50 rounded-lg text-gray-200 placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ maxHeight: '100px' }}
          />
          {/* Character count */}
          {message.length > 400 && (
            <span
              className={`absolute right-2 bottom-2 text-[10px] ${
                message.length > 480 ? 'text-red-400' : 'text-gray-500'
              }`}
            >
              {message.length}/500
            </span>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!message.trim() || disabled || isSending || !isConnected || (!hasPosition && !isFounder)}
          className="p-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          ) : (
            <Send className="w-4 h-4 text-white" />
          )}
        </button>
      </div>
    </div>
  );
}
