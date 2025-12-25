/**
 * Chat Hook for Market Community Hub
 * Manages real-time chat functionality using Socket.IO
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSocket } from './useSocket';
import { createClientLogger } from '@/lib/logger';
import { IChatMessage } from '@/lib/mongodb';

const logger = createClientLogger();

// Rate limiting constants
const RATE_LIMIT_MESSAGES = 5;
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

interface ChatState {
  messages: IChatMessage[];
  pinnedMessages: IChatMessage[];
  isLoading: boolean;
  hasMore: boolean;
  userCount: number;
  typingUsers: Map<string, { displayName: string; timestamp: number }>;
  error: string | null;
}

interface UseChatOptions {
  marketAddress: string;
  walletAddress?: string | null;
  autoJoin?: boolean;
  getAccessToken?: () => Promise<string | null>;
}

export function useChat({ marketAddress, walletAddress, autoJoin = true, getAccessToken }: UseChatOptions) {
  const { socket, isConnected } = useSocket();
  const [state, setState] = useState<ChatState>({
    messages: [],
    pinnedMessages: [],
    isLoading: true,
    hasMore: true,
    userCount: 0,
    typingUsers: new Map(),
    error: null,
  });

  // Rate limiting state
  const messageTimestamps = useRef<number[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial messages
  const fetchMessages = useCallback(async (before?: string) => {
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (before) params.set('before', before);

      const response = await fetch(`/api/chat/${marketAddress}?${params.toString()}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch messages');
      }

      return data.data;
    } catch (error) {
      logger.error('Failed to fetch chat messages:', { error });
      throw error;
    }
  }, [marketAddress]);

  // Load initial messages
  useEffect(() => {
    if (!marketAddress) return;

    const loadInitialMessages = async () => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      try {
        const data = await fetchMessages();
        setState(prev => ({
          ...prev,
          messages: data.messages || [],
          pinnedMessages: data.pinnedMessages || [],
          hasMore: data.hasMore || false,
          isLoading: false,
        }));
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load messages',
        }));
      }
    };

    loadInitialMessages();
  }, [marketAddress, fetchMessages]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !isConnected || !marketAddress) return;

    // Join chat room
    if (autoJoin) {
      logger.info(`💬 Joining chat room: ${marketAddress.slice(0, 8)}...`);
      socket.emit('chat:join', { marketAddress, walletAddress });
    }

    // Handle new messages
    const handleMessage = (data: { message: IChatMessage; marketAddress: string }) => {
      if (data.marketAddress === marketAddress) {
        setState(prev => ({
          ...prev,
          messages: [...prev.messages, data.message],
        }));
      }
    };

    // Handle user count updates
    const handleUserCount = (data: { count: number; marketAddress: string }) => {
      if (data.marketAddress === marketAddress) {
        setState(prev => ({ ...prev, userCount: data.count }));
      }
    };

    // Handle typing indicator
    const handleTyping = (data: { walletAddress: string; displayName?: string; marketAddress: string }) => {
      if (data.marketAddress === marketAddress && data.walletAddress !== walletAddress) {
        setState(prev => {
          const newTyping = new Map(prev.typingUsers);
          newTyping.set(data.walletAddress, {
            displayName: data.displayName || data.walletAddress.slice(0, 6) + '...',
            timestamp: Date.now(),
          });
          return { ...prev, typingUsers: newTyping };
        });

        // Clear typing indicator after 3 seconds
        setTimeout(() => {
          setState(prev => {
            const newTyping = new Map(prev.typingUsers);
            const entry = newTyping.get(data.walletAddress);
            if (entry && Date.now() - entry.timestamp >= 2900) {
              newTyping.delete(data.walletAddress);
            }
            return { ...prev, typingUsers: newTyping };
          });
        }, 3000);
      }
    };

    // Handle message deleted
    const handleDeleted = (data: { messageId: string }) => {
      setState(prev => ({
        ...prev,
        messages: prev.messages.filter(m => m._id !== data.messageId),
        pinnedMessages: prev.pinnedMessages.filter(m => m._id !== data.messageId),
      }));
    };

    // Handle message pinned/unpinned
    const handlePinned = (data: { messageId: string; isPinned: boolean }) => {
      setState(prev => {
        const message = prev.messages.find(m => m._id === data.messageId);
        if (!message) return prev;

        const updatedMessage = { ...message, isPinned: data.isPinned };

        return {
          ...prev,
          messages: prev.messages.map(m =>
            m._id === data.messageId ? updatedMessage : m
          ),
          pinnedMessages: data.isPinned
            ? [...prev.pinnedMessages, updatedMessage]
            : prev.pinnedMessages.filter(m => m._id !== data.messageId),
        };
      });
    };

    // Handle reaction updates
    const handleReaction = (data: { messageId: string; reactions: any }) => {
      // Reactions are handled separately - messages will be refetched
      // or we can update the message in place if needed
    };

    // Register event listeners
    socket.on('chat:message', handleMessage);
    socket.on('chat:user_count', handleUserCount);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:deleted', handleDeleted);
    socket.on('chat:pinned', handlePinned);
    socket.on('chat:reaction', handleReaction);
    socket.on('chat:joined', (data: { userCount: number }) => {
      setState(prev => ({ ...prev, userCount: data.userCount }));
    });

    // Cleanup
    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:user_count', handleUserCount);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:deleted', handleDeleted);
      socket.off('chat:pinned', handlePinned);
      socket.off('chat:reaction', handleReaction);
      socket.off('chat:joined');

      if (autoJoin) {
        socket.emit('chat:leave', { marketAddress });
        logger.info(`💬 Left chat room: ${marketAddress.slice(0, 8)}...`);
      }
    };
  }, [socket, isConnected, marketAddress, walletAddress, autoJoin]);

  // Check rate limit
  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    // Remove timestamps outside the window
    messageTimestamps.current = messageTimestamps.current.filter(
      ts => now - ts < RATE_LIMIT_WINDOW_MS
    );
    return messageTimestamps.current.length < RATE_LIMIT_MESSAGES;
  }, []);

  // Send message
  const sendMessage = useCallback(async (
    message: string,
    replyTo?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!walletAddress) {
      return { success: false, error: 'Wallet not connected' };
    }

    if (!message.trim()) {
      return { success: false, error: 'Message cannot be empty' };
    }

    if (message.length > 500) {
      return { success: false, error: 'Message too long (max 500 characters)' };
    }

    if (!checkRateLimit()) {
      return { success: false, error: 'Rate limit exceeded. Please wait a moment.' };
    }

    try {
      // Get access token for authentication
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (getAccessToken) {
        const token = await getAccessToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(`/api/chat/${marketAddress}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: message.trim(),
          replyTo,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        return { success: false, error: data.error };
      }

      // Record timestamp for rate limiting
      messageTimestamps.current.push(Date.now());

      return { success: true };
    } catch (error) {
      logger.error('Failed to send message:', { error });
      return { success: false, error: 'Failed to send message' };
    }
  }, [marketAddress, walletAddress, checkRateLimit, getAccessToken]);

  // Send typing indicator
  const sendTyping = useCallback((displayName?: string) => {
    if (!socket || !isConnected || !walletAddress) return;

    // Debounce typing events
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    socket.emit('chat:typing', {
      marketAddress,
      walletAddress,
      displayName,
    });

    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2000);
  }, [socket, isConnected, marketAddress, walletAddress]);

  // Load more messages (pagination)
  const loadMore = useCallback(async () => {
    if (!state.hasMore || state.isLoading || state.messages.length === 0) return;

    const oldestMessage = state.messages[0];

    setState(prev => ({ ...prev, isLoading: true }));
    try {
      const data = await fetchMessages(oldestMessage._id);
      setState(prev => ({
        ...prev,
        messages: [...(data.messages || []), ...prev.messages],
        hasMore: data.hasMore || false,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [state.hasMore, state.isLoading, state.messages, fetchMessages]);

  // Add reaction to message
  const addReaction = useCallback(async (messageId: string, emoji: string): Promise<boolean> => {
    if (!walletAddress) return false;

    try {
      const response = await fetch(`/api/chat/${marketAddress}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          messageId,
          emoji,
        }),
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      logger.error('Failed to add reaction:', { error });
      return false;
    }
  }, [marketAddress, walletAddress]);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string): Promise<boolean> => {
    if (!walletAddress) return false;

    try {
      const response = await fetch(`/api/chat/${marketAddress}/${messageId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      logger.error('Failed to delete message:', { error });
      return false;
    }
  }, [marketAddress, walletAddress]);

  // Pin/unpin message (founder only)
  const togglePin = useCallback(async (messageId: string, pinned: boolean): Promise<boolean> => {
    if (!walletAddress) return false;

    try {
      const response = await fetch(`/api/chat/${marketAddress}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          founderWallet: walletAddress,
          messageId,
          pinned,
        }),
      });

      const data = await response.json();
      return data.success;
    } catch (error) {
      logger.error('Failed to toggle pin:', { error });
      return false;
    }
  }, [marketAddress, walletAddress]);

  return {
    // State
    messages: state.messages,
    pinnedMessages: state.pinnedMessages,
    isLoading: state.isLoading,
    hasMore: state.hasMore,
    userCount: state.userCount,
    typingUsers: Array.from(state.typingUsers.values()),
    error: state.error,
    isConnected,

    // Actions
    sendMessage,
    sendTyping,
    loadMore,
    addReaction,
    deleteMessage,
    togglePin,

    // Utilities
    refetch: () => fetchMessages().then(data => {
      setState(prev => ({
        ...prev,
        messages: data.messages || [],
        pinnedMessages: data.pinnedMessages || [],
        hasMore: data.hasMore || false,
      }));
    }),
  };
}

export default useChat;
