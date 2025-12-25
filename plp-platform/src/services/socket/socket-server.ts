/**
 * Socket.IO Server
 * Manages real-time connections and broadcasts updates to clients
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { createClientLogger } from '@/lib/logger';
import { getRedisSubClient, REDIS_CHANNELS } from '@/lib/redis/client';

const logger = createClientLogger();

// Rate limiting for broadcasts (prevent spam)
const BROADCAST_RATE_LIMIT_MS = 100; // Min 100ms between broadcasts per market
const lastBroadcastTimes = new Map<string, number>();

// Batch updates for high-frequency changes
const pendingBroadcasts = new Map<string, { data: any; timeout: NodeJS.Timeout }>();
const BATCH_DELAY_MS = 50; // Batch updates within 50ms window

export class SocketServer {
  private io: SocketIOServer | null = null;
  private httpServer: HTTPServer | null = null;

  /**
   * Initialize Socket.IO server
   */
  initialize(httpServer: HTTPServer): void {
    if (this.io) {
      console.log('⚠️  Socket.IO server already initialized');
      logger.warn('Socket.IO server already initialized');
      return;
    }

    console.log('🔌 Initializing Socket.IO server...');
    logger.info('🔌 Initializing Socket.IO server...');

    this.httpServer = httpServer;
    // Build list of allowed origins
    const allowedOrigins: (string | RegExp)[] = [];
    if (process.env.NEXT_PUBLIC_APP_URL) {
      allowedOrigins.push(process.env.NEXT_PUBLIC_APP_URL);
    }
    // Always allow localhost for development
    allowedOrigins.push('http://localhost:3000', 'http://localhost:3001');
    // Allow Render URLs
    allowedOrigins.push(/\.onrender\.com$/);
    // Allow production domain
    allowedOrigins.push('https://pnl.market', 'https://www.pnl.market');

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: (origin, callback) => {
          // Allow requests with no origin (mobile apps, curl, etc.)
          if (!origin) return callback(null, true);

          // Check against allowed origins
          const isAllowed = allowedOrigins.some(allowed => {
            if (allowed instanceof RegExp) {
              return allowed.test(origin);
            }
            return allowed === origin;
          });

          if (isAllowed) {
            callback(null, true);
          } else {
            console.log(`Socket.IO CORS blocked origin: ${origin}`);
            callback(null, true); // Still allow for now, just log
          }
        },
        methods: ['GET', 'POST'],
        credentials: true,
      },
      path: '/api/socket/io',
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    this.setupRedisSubscription();

    console.log('✅ Socket.IO server initialized on path /api/socket/io');
    logger.info('✅ Socket.IO server initialized');
  }

  /**
   * Setup Redis subscription for cross-process communication
   * This allows API routes to publish messages that get broadcast via Socket.IO
   */
  private setupRedisSubscription(): void {
    try {
      console.log('🔄 Setting up Redis subscription for chat...');
      const sub = getRedisSubClient();

      // Subscribe to chat channels
      sub.subscribe(REDIS_CHANNELS.CHAT_MESSAGE, (err: Error | null) => {
        if (err) {
          console.error('❌ Failed to subscribe to chat:message channel:', err.message);
          logger.error('Failed to subscribe to chat:message channel:', { error: err.message });
        } else {
          console.log('📡 Subscribed to Redis chat:message channel');
          logger.info('📡 Subscribed to Redis chat:message channel');
        }
      });

      // Handle incoming messages from Redis
      sub.on('message', (channel: string, message: string) => {
        try {
          console.log(`📨 Redis message received on channel: ${channel}`);
          const data = JSON.parse(message);

          if (channel === REDIS_CHANNELS.CHAT_MESSAGE) {
            // Broadcast chat message via Socket.IO
            console.log(`💬 Broadcasting chat message for market: ${data.marketAddress?.slice(0, 8)}...`);
            this.broadcastChatMessage(data.marketAddress, data.message);
          }
        } catch (error) {
          console.error('Failed to process Redis message:', error);
          logger.error('Failed to process Redis message:', { error, channel });
        }
      });

      console.log('✅ Redis subscription setup complete');
      logger.info('✅ Redis subscription setup complete');
    } catch (error) {
      console.warn('⚠️ Redis subscription not available:', error instanceof Error ? error.message : String(error));
      logger.warn('⚠️ Redis subscription not available (chat will work via direct broadcast):', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Setup connection handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      logger.debug(`🔗 Client connected: ${socket.id}`);

      // Handle market subscriptions
      socket.on('subscribe:market', (marketAddress: string) => {
        logger.debug(`📡 Client subscribing to market: ${marketAddress.slice(0, 8)}...`);
        socket.join(`market:${marketAddress}`);
        socket.emit('subscribed', { marketAddress });
      });

      // Handle market unsubscriptions
      socket.on('unsubscribe:market', (marketAddress: string) => {
        socket.leave(`market:${marketAddress}`);
        socket.emit('unsubscribed', { marketAddress });
      });

      // Handle all markets subscription
      socket.on('subscribe:all-markets', () => {
        socket.join('all-markets');
        socket.emit('subscribed', { room: 'all-markets' });
      });

      // Handle user-specific subscriptions (for notifications)
      socket.on('subscribe:user', (walletAddress: string) => {
        socket.join(`user:${walletAddress}`);
        socket.emit('subscribed', { walletAddress });
      });

      // Handle broadcast requests from blockchain sync (server-to-server)
      socket.on('broadcast:market', (payload: { marketAddress: string; data: any; timestamp: number }) => {
        this.broadcastMarketUpdate(payload.marketAddress, payload.data);
      });

      socket.on('broadcast:position', (payload: { userWallet: string; marketAddress: string; data: any; timestamp: number }) => {
        this.broadcastPositionUpdate(payload.userWallet, payload.marketAddress, payload.data);
      });

      socket.on('broadcast:notification', (payload: { userWallet: string; notification: any; timestamp: number }) => {
        this.broadcastNotification(payload.userWallet, payload.notification);
      });

      // ========================================
      // Chat Events
      // ========================================

      // Handle chat room joins
      socket.on('chat:join', (payload: { marketAddress: string; walletAddress?: string }) => {
        const roomName = `chat:${payload.marketAddress}`;
        logger.debug(`💬 Client joining chat room: ${payload.marketAddress.slice(0, 8)}...`);
        socket.join(roomName);

        // Notify others in the room about user count
        const roomSize = this.getRoomSize(roomName);
        this.io?.to(roomName).emit('chat:user_count', { count: roomSize, marketAddress: payload.marketAddress });

        socket.emit('chat:joined', { marketAddress: payload.marketAddress, userCount: roomSize });
      });

      // Handle chat room leaves
      socket.on('chat:leave', (payload: { marketAddress: string }) => {
        const roomName = `chat:${payload.marketAddress}`;
        socket.leave(roomName);

        // Notify others about updated user count
        const roomSize = this.getRoomSize(roomName);
        this.io?.to(roomName).emit('chat:user_count', { count: roomSize, marketAddress: payload.marketAddress });
      });

      // Handle typing indicator
      socket.on('chat:typing', (payload: { marketAddress: string; walletAddress: string; displayName?: string }) => {
        const roomName = `chat:${payload.marketAddress}`;
        // Broadcast to all other users in the room (except sender)
        socket.to(roomName).emit('chat:typing', {
          walletAddress: payload.walletAddress,
          displayName: payload.displayName,
          marketAddress: payload.marketAddress,
        });
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.debug(`🔌 Client disconnected: ${socket.id}`);
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error('Socket error:', { socketId: socket.id, error: error instanceof Error ? error.message : String(error) });
      });
    });
  }

  /**
   * Broadcast market update to subscribed clients
   * Uses batching and rate limiting to prevent spam
   */
  broadcastMarketUpdate(marketAddress: string, data: any): void {
    if (!this.io) {
      // Silently skip if server not initialized yet (expected during startup)
      return;
    }

    // Check rate limit
    const now = Date.now();
    const lastBroadcast = lastBroadcastTimes.get(marketAddress) || 0;
    const timeSinceLastBroadcast = now - lastBroadcast;

    if (timeSinceLastBroadcast < BROADCAST_RATE_LIMIT_MS) {
      // Batch this update - cancel any pending and reschedule
      const pending = pendingBroadcasts.get(marketAddress);
      if (pending) {
        clearTimeout(pending.timeout);
      }

      const timeout = setTimeout(() => {
        this.doMarketBroadcast(marketAddress, data);
        pendingBroadcasts.delete(marketAddress);
      }, BATCH_DELAY_MS);

      pendingBroadcasts.set(marketAddress, { data, timeout });
      return;
    }

    // Immediate broadcast
    this.doMarketBroadcast(marketAddress, data);
  }

  /**
   * Perform the actual market broadcast
   * Filters out vote data for unresolved markets to prevent bandwagon voting
   */
  private doMarketBroadcast(marketAddress: string, data: any): void {
    if (!this.io) return;

    lastBroadcastTimes.set(marketAddress, Date.now());

    // Log only at debug level to reduce noise
    logger.debug(`📤 Broadcasting market update: ${marketAddress.slice(0, 8)}...`);

    // Filter out vote data for unresolved markets to prevent bandwagon voting
    let filteredData = data;
    if (!data.resolution || data.resolution === 'Unresolved') {
      filteredData = { ...data };
      // Hide vote-revealing fields
      filteredData.yesPercentage = null;
      filteredData.noPercentage = null;
      filteredData.sharesYesPercentage = null;
      filteredData.yesVotes = null;
      filteredData.noVotes = null;
      filteredData.totalYesStake = null;
      filteredData.totalNoStake = null;
      filteredData.yesPool = null;
      filteredData.noPool = null;
      filteredData.totalYesShares = null;
      filteredData.totalNoShares = null;
    }

    const payload = {
      marketAddress,
      data: filteredData,
      timestamp: Date.now(),
    };

    // Broadcast to specific market room
    this.io.to(`market:${marketAddress}`).emit('market:update', payload);

    // Also broadcast to all-markets room
    this.io.to('all-markets').emit('market:update', payload);
  }

  /**
   * Broadcast position update to user
   */
  broadcastPositionUpdate(walletAddress: string, marketAddress: string, data: any): void {
    if (!this.io) return;

    logger.debug(`📤 Broadcasting position update for ${walletAddress.slice(0, 8)}...`);

    this.io.to(`user:${walletAddress}`).emit('position:update', {
      walletAddress,
      marketAddress,
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast notification to user
   */
  broadcastNotification(walletAddress: string, notification: any): void {
    if (!this.io) return;

    logger.debug(`🔔 Broadcasting notification to ${walletAddress.slice(0, 8)}...`);

    this.io.to(`user:${walletAddress}`).emit('notification', {
      notification,
      timestamp: Date.now(),
    });
  }

  // ========================================
  // Chat Broadcast Methods
  // ========================================

  /**
   * Broadcast new chat message to market chat room
   */
  broadcastChatMessage(marketAddress: string, message: any): void {
    if (!this.io) return;

    logger.debug(`💬 Broadcasting chat message in ${marketAddress.slice(0, 8)}...`);

    this.io.to(`chat:${marketAddress}`).emit('chat:message', {
      message,
      marketAddress,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast message reaction update
   */
  broadcastChatReaction(marketAddress: string, messageId: string, reactions: any): void {
    if (!this.io) return;

    this.io.to(`chat:${marketAddress}`).emit('chat:reaction', {
      messageId,
      reactions,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast message deleted
   */
  broadcastChatDeleted(marketAddress: string, messageId: string): void {
    if (!this.io) return;

    this.io.to(`chat:${marketAddress}`).emit('chat:deleted', {
      messageId,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast message pinned/unpinned
   */
  broadcastChatPinned(marketAddress: string, messageId: string, isPinned: boolean): void {
    if (!this.io) return;

    this.io.to(`chat:${marketAddress}`).emit('chat:pinned', {
      messageId,
      isPinned,
      timestamp: Date.now(),
    });
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.io?.sockets.sockets.size || 0;
  }

  /**
   * Get room subscriber count
   */
  getRoomSize(room: string): number {
    if (!this.io) return 0;
    const roomSockets = this.io.sockets.adapter.rooms.get(room);
    return roomSockets?.size || 0;
  }

  /**
   * Get all active rooms
   */
  getActiveRooms(): string[] {
    if (!this.io) return [];
    return Array.from(this.io.sockets.adapter.rooms.keys()).filter(
      (room) => !this.io!.sockets.sockets.has(room) // Exclude socket IDs
    );
  }

  /**
   * Shutdown server
   */
  async shutdown(): Promise<void> {
    if (this.io) {
      logger.info('⏹️  Shutting down Socket.IO server...');
      await this.io.close();
      this.io = null;
      logger.info('✅ Socket.IO server shut down');
    }
  }
}

// Singleton instance
let socketServerInstance: SocketServer | null = null;

/**
 * Get Socket.IO server instance
 */
export function getSocketServer(): SocketServer {
  if (!socketServerInstance) {
    socketServerInstance = new SocketServer();
  }
  return socketServerInstance;
}

/**
 * Initialize Socket.IO server
 */
export function initializeSocketServer(httpServer: HTTPServer): void {
  console.log('📞 initializeSocketServer() called');
  const server = getSocketServer();
  server.initialize(httpServer);
}

/**
 * Broadcast helpers (convenience functions)
 */
export function broadcastMarketUpdate(marketAddress: string, data: any): void {
  const server = getSocketServer();
  server.broadcastMarketUpdate(marketAddress, data);
}

export function broadcastPositionUpdate(
  walletAddress: string,
  marketAddress: string,
  data: any
): void {
  const server = getSocketServer();
  server.broadcastPositionUpdate(walletAddress, marketAddress, data);
}

export function broadcastNotification(walletAddress: string, notification: any): void {
  const server = getSocketServer();
  server.broadcastNotification(walletAddress, notification);
}

// Chat broadcast helpers
export function broadcastChatMessage(marketAddress: string, message: any): void {
  const server = getSocketServer();
  server.broadcastChatMessage(marketAddress, message);
}

export function broadcastChatReaction(marketAddress: string, messageId: string, reactions: any): void {
  const server = getSocketServer();
  server.broadcastChatReaction(marketAddress, messageId, reactions);
}

export function broadcastChatDeleted(marketAddress: string, messageId: string): void {
  const server = getSocketServer();
  server.broadcastChatDeleted(marketAddress, messageId);
}

export function broadcastChatPinned(marketAddress: string, messageId: string, isPinned: boolean): void {
  const server = getSocketServer();
  server.broadcastChatPinned(marketAddress, messageId, isPinned);
}
