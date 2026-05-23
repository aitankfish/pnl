/**
 * Socket.IO React Hook
 * Manages real-time WebSocket connections
 */

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { createClientLogger } from '../utils/logger';
import { getSocketUrl } from '../utils/api';

const logger = createClientLogger();

interface SocketConfig {
  url?: string;
  path?: string;
}

/**
 * Main Socket.IO hook
 */
export function useSocket(config?: SocketConfig) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const isMountedRef = useRef(true);
  const hasLoggedErrorRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    hasLoggedErrorRef.current = false;
    // Determine the correct socket URL
    // getSocketUrl() handles both web (window.location) and mobile (API_BASE_URL)
    const url = config?.url || getSocketUrl();
    const path = config?.path || '/api/socket/io';

    // Create socket connection
    const socket = io(url, {
      path,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    // Connection handlers
    socket.on('connect', () => {
      if (!isMountedRef.current) return;
      logger.info('Socket.IO connected');
      hasLoggedErrorRef.current = false;
      setIsConnected(true);
      setConnectionError(null);
    });

    socket.on('disconnect', (reason) => {
      if (!isMountedRef.current) return;
      logger.warn(`Socket.IO disconnected: ${reason}`);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      if (!isMountedRef.current) return;
      // Only log first error per connection attempt to reduce noise
      if (!hasLoggedErrorRef.current) {
        logger.warn(`Socket.IO connection error: ${error.message}`);
        hasLoggedErrorRef.current = true;
      }
      setConnectionError(error.message);
      setIsConnected(false);
    });

    // Cleanup on unmount
    return () => {
      // Set mounted to false BEFORE disconnecting to prevent state updates
      // during the synchronous disconnect event
      isMountedRef.current = false;
      socket.disconnect();
    };
  }, [config?.url, config?.path]);

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
  };
}

/**
 * Hook to subscribe to a specific market
 */
export function useMarketSocket(marketAddress: string | null) {
  const { socket, isConnected } = useSocket();
  const [marketData, setMarketData] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    if (!socket || !isConnected || !marketAddress) return;

    // Subscribe to market
    logger.info(`Subscribing to market: ${marketAddress}`);
    socket.emit('subscribe:market', marketAddress);

    // Listen for market updates
    const handleMarketUpdate = (data: any) => {
      if (!isMountedRef.current) return;
      if (data.marketAddress === marketAddress) {
        logger.info(`Market update received: ${marketAddress.slice(0, 8)}...`);
        setMarketData(data.data);
        setLastUpdate(data.timestamp);
      }
    };

    socket.on('market:update', handleMarketUpdate);

    // Cleanup
    return () => {
      isMountedRef.current = false;
      socket.off('market:update', handleMarketUpdate);
      socket.emit('unsubscribe:market', marketAddress);
      logger.info(`Unsubscribed from market: ${marketAddress}`);
    };
  }, [socket, isConnected, marketAddress]);

  return {
    marketData,
    lastUpdate,
    isConnected,
  };
}

/**
 * Hook to subscribe to all markets (for browse page)
 */
export function useAllMarketsSocket() {
  const { socket, isConnected } = useSocket();
  const [marketUpdates, setMarketUpdates] = useState<Map<string, any>>(new Map());
  const [newMarkets, setNewMarkets] = useState<any[]>([]);
  const [activeVoiceRooms, setActiveVoiceRooms] = useState<Map<string, number>>(new Map());
  const isMountedRef = useRef(true);

  // Batch incoming market:update events into a single setState per
  // animation frame. Without this, a burst of votes / pool changes
  // would fire N consecutive React renders on every consumer of this
  // hook (BrowsePage, LaunchpadPage), which cascades through every
  // market card — janky during slider drags + wasted CPU. rAF
  // batching collapses N events arriving in the same ~16ms tick into
  // one update with the latest data per market address.
  const pendingMarketUpdatesRef = useRef<Map<string, any>>(new Map());
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    if (!socket || !isConnected) return;

    // Subscribe to all markets
    logger.info('Subscribing to all markets');
    socket.emit('subscribe:all-markets');

    const flushPendingMarketUpdates = () => {
      rafIdRef.current = null;
      if (!isMountedRef.current) return;
      const batch = pendingMarketUpdatesRef.current;
      if (batch.size === 0) return;
      pendingMarketUpdatesRef.current = new Map();
      setMarketUpdates((prev) => {
        const next = new Map(prev);
        batch.forEach((data, addr) => next.set(addr, data));
        return next;
      });
    };

    // Listen for market updates
    const handleMarketUpdate = (data: any) => {
      if (!isMountedRef.current) return;
      logger.info(`Market update: ${data.marketAddress.slice(0, 8)}...`);
      // Stash + schedule one rAF flush. Re-entrant calls within the
      // same frame coalesce into the same flush.
      pendingMarketUpdatesRef.current.set(data.marketAddress, {
        ...data.data,
        timestamp: data.timestamp,
      });
      if (rafIdRef.current == null && typeof requestAnimationFrame !== 'undefined') {
        rafIdRef.current = requestAnimationFrame(flushPendingMarketUpdates);
      }
    };

    // Listen for new market creation
    const handleMarketCreated = (data: any) => {
      if (!isMountedRef.current) return;
      logger.info(`New market created: ${data.market?.name || data.market?.marketAddress?.slice(0, 8)}...`);
      setNewMarkets((prev) => {
        // Avoid duplicates
        if (prev.some(m => m.id === data.market.id || m.marketAddress === data.market.marketAddress)) {
          return prev;
        }
        return [{ ...data.market, isNew: true, timestamp: data.timestamp }, ...prev];
      });
    };

    // Listen for voice room activity
    const handleVoiceActivity = (data: { marketAddress: string; activeCount: number }) => {
      if (!isMountedRef.current) return;
      setActiveVoiceRooms((prev) => {
        const next = new Map(prev);
        if (data.activeCount > 0) {
          next.set(data.marketAddress, data.activeCount);
        } else {
          next.delete(data.marketAddress);
        }
        return next;
      });
    };

    socket.on('market:update', handleMarketUpdate);
    socket.on('market:created', handleMarketCreated);
    socket.on('voice:activity', handleVoiceActivity);

    // Cleanup
    return () => {
      isMountedRef.current = false;
      socket.off('market:update', handleMarketUpdate);
      socket.off('market:created', handleMarketCreated);
      socket.off('voice:activity', handleVoiceActivity);
      // Drop any pending rAF flush — if a market:update arrived in
      // the same tick as unmount, we don't want to setState on a dead
      // component.
      if (rafIdRef.current != null && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      pendingMarketUpdatesRef.current.clear();
      logger.info('Unsubscribed from all markets');
    };
  }, [socket, isConnected]);

  // Function to clear new markets (after they've been added to the list)
  const clearNewMarkets = () => {
    setNewMarkets([]);
  };

  return {
    marketUpdates,
    newMarkets,
    clearNewMarkets,
    activeVoiceRooms,
    isConnected,
  };
}

/**
 * Hook to subscribe to user-specific updates (positions, notifications)
 */
export function useUserSocket(walletAddress: string | null) {
  const { socket, isConnected } = useSocket();
  const [positions, setPositions] = useState<Map<string, any>>(new Map());
  const [notifications, setNotifications] = useState<any[]>([]);
  const [userStats, setUserStats] = useState<{ followerCount?: number; followingCount?: number }>({});
  // Socket-pushed SOL balance for this wallet — server emits wallet:balance
  // when Helius accountSubscribe fires for the user's pubkey. null = no event
  // received yet (consumer should fall back to SWR/poll).
  const [walletBalance, setWalletBalance] = useState<{ lamports: number; sol: number; slot: number } | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    if (!socket || !isConnected || !walletAddress) return;

    // Subscribe to user updates with access token for wallet verification
    const subscribe = async () => {
      let token: string | undefined;
      try {
        const { getAccessToken } = await import('../utils/authenticated-fetch');
        const t = await getAccessToken();
        if (t) token = t;
      } catch {}
      logger.info(`Subscribing to user: ${walletAddress}`);
      socket.emit('subscribe:user', walletAddress, token);
    };
    subscribe();

    // Listen for position updates
    const handlePositionUpdate = (data: any) => {
      if (!isMountedRef.current) return;
      logger.info(`Position update: ${data.marketAddress.slice(0, 8)}...`);
      setPositions((prev) => {
        const next = new Map(prev);
        next.set(data.marketAddress, data.data);
        return next;
      });
    };

    // Listen for notifications
    const handleNotification = (data: any) => {
      if (!isMountedRef.current) return;
      logger.info('Notification received');
      setNotifications((prev) => [data.notification, ...prev]);
    };

    // Listen for follower/following count changes — drives the "live tick" on profile pages.
    const handleUserStats = (data: any) => {
      if (!isMountedRef.current) return;
      if (data?.stats) {
        setUserStats((prev) => ({ ...prev, ...data.stats }));
      }
    };

    // Listen for SOL balance updates pushed from Helius via the server.
    // Drop stale events that have an older slot than what we already saw —
    // Helius can deliver notifications out of order across reconnects.
    const handleWalletBalance = (data: any) => {
      if (!isMountedRef.current) return;
      if (typeof data?.lamports !== 'number' || typeof data?.sol !== 'number') return;
      setWalletBalance((prev) => {
        if (prev && typeof data.slot === 'number' && data.slot < prev.slot) return prev;
        return { lamports: data.lamports, sol: data.sol, slot: data.slot ?? 0 };
      });
    };

    socket.on('position:update', handlePositionUpdate);
    socket.on('notification', handleNotification);
    socket.on('user:stats', handleUserStats);
    socket.on('wallet:balance', handleWalletBalance);

    // Cleanup
    return () => {
      isMountedRef.current = false;
      socket.off('position:update', handlePositionUpdate);
      socket.off('notification', handleNotification);
      socket.off('user:stats', handleUserStats);
      socket.off('wallet:balance', handleWalletBalance);
      logger.info(`Unsubscribed from user: ${walletAddress}`);
    };
  }, [socket, isConnected, walletAddress]);

  return {
    positions,
    notifications,
    userStats,
    walletBalance,
    isConnected,
  };
}
