/**
 * Socket.IO Server
 * Manages real-time connections and broadcasts updates to clients
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { createClientLogger } from '@/lib/logger';

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

    console.log('✅ Socket.IO server initialized on path /api/socket/io');
    logger.info('✅ Socket.IO server initialized');
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
   */
  private doMarketBroadcast(marketAddress: string, data: any): void {
    if (!this.io) return;

    lastBroadcastTimes.set(marketAddress, Date.now());

    // Log only at debug level to reduce noise
    logger.debug(`📤 Broadcasting market update: ${marketAddress.slice(0, 8)}...`);

    const payload = {
      marketAddress,
      data,
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
