/**
 * Socket.IO React Hook
 * Manages real-time WebSocket connections
 */

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { createClientLogger } from '@/lib/logger';

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

  useEffect(() => {
    isMountedRef.current = true;
    // Determine the correct socket URL based on environment
    let defaultUrl: string;

    // In production (Vercel/deployment), use the same origin without custom port
    // In development, use the custom socket port (3001)
    if (process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost') {
      // Production: use same domain/protocol (reverse proxy or unified server handles routing)
      defaultUrl = window.location.origin;
    } else {
      // Development: use separate socket server on port 3001
      const socketPort = process.env.NEXT_PUBLIC_SOCKET_PORT || '3001';
      defaultUrl = `${window.location.protocol}//${window.location.hostname}:${socketPort}`;
    }

    const url = config?.url || defaultUrl;
    const path = config?.path || '/api/socket/io';

    // Create socket connection
    const socket = io(url, {
      path,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection handlers
    socket.on('connect', () => {
      if (!isMountedRef.current) return;
      logger.info('🔌 Socket.IO connected');
      setIsConnected(true);
      setConnectionError(null);
    });

    socket.on('disconnect', (reason) => {
      if (!isMountedRef.current) return;
      logger.warn(`🔌 Socket.IO disconnected: ${reason}`);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      if (!isMountedRef.current) return;
      logger.error(`🔌 Socket.IO connection error: ${error.message}`);
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
    logger.info(`📡 Subscribing to market: ${marketAddress}`);
    socket.emit('subscribe:market', marketAddress);

    // Listen for market updates
    const handleMarketUpdate = (data: any) => {
      if (!isMountedRef.current) return;
      if (data.marketAddress === marketAddress) {
        logger.info(`📥 Market update received: ${marketAddress.slice(0, 8)}...`);
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
      logger.info(`📡 Unsubscribed from market: ${marketAddress}`);
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
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    if (!socket || !isConnected) return;

    // Subscribe to all markets
    logger.info('📡 Subscribing to all markets');
    socket.emit('subscribe:all-markets');

    // Listen for market updates
    const handleMarketUpdate = (data: any) => {
      if (!isMountedRef.current) return;
      logger.info(`📥 Market update: ${data.marketAddress.slice(0, 8)}...`);
      setMarketUpdates((prev) => {
        const next = new Map(prev);
        next.set(data.marketAddress, {
          ...data.data,
          timestamp: data.timestamp,
        });
        return next;
      });
    };

    // Listen for new market creation
    const handleMarketCreated = (data: any) => {
      if (!isMountedRef.current) return;
      logger.info(`🆕 New market created: ${data.market?.name || data.market?.marketAddress?.slice(0, 8)}...`);
      setNewMarkets((prev) => {
        // Avoid duplicates
        if (prev.some(m => m.id === data.market.id || m.marketAddress === data.market.marketAddress)) {
          return prev;
        }
        return [{ ...data.market, isNew: true, timestamp: data.timestamp }, ...prev];
      });
    };

    socket.on('market:update', handleMarketUpdate);
    socket.on('market:created', handleMarketCreated);

    // Cleanup
    return () => {
      isMountedRef.current = false;
      socket.off('market:update', handleMarketUpdate);
      socket.off('market:created', handleMarketCreated);
      logger.info('📡 Unsubscribed from all markets');
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
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    if (!socket || !isConnected || !walletAddress) return;

    // Subscribe to user updates
    logger.info(`📡 Subscribing to user: ${walletAddress}`);
    socket.emit('subscribe:user', walletAddress);

    // Listen for position updates
    const handlePositionUpdate = (data: any) => {
      if (!isMountedRef.current) return;
      logger.info(`📥 Position update: ${data.marketAddress.slice(0, 8)}...`);
      setPositions((prev) => {
        const next = new Map(prev);
        next.set(data.marketAddress, data.data);
        return next;
      });
    };

    // Listen for notifications
    const handleNotification = (data: any) => {
      if (!isMountedRef.current) return;
      logger.info('🔔 Notification received');
      setNotifications((prev) => [data.notification, ...prev]);
    };

    socket.on('position:update', handlePositionUpdate);
    socket.on('notification', handleNotification);

    // Cleanup
    return () => {
      isMountedRef.current = false;
      socket.off('position:update', handlePositionUpdate);
      socket.off('notification', handleNotification);
      logger.info(`📡 Unsubscribed from user: ${walletAddress}`);
    };
  }, [socket, isConnected, walletAddress]);

  return {
    positions,
    notifications,
    isConnected,
  };
}
