/**
 * Socket.IO Client (shared)
 * Platform-agnostic socket client using env abstraction
 */

import { io, Socket } from 'socket.io-client';
import { createClientLogger } from '../utils/logger';
import { getSocketUrl } from '../utils/api';

const logger = createClientLogger();

class SocketClient {
  private socket: Socket | null = null;
  private isConnected = false;

  connect(): void {
    if (this.socket) {
      logger.warn('Socket.IO client already connected');
      return;
    }

    const socketUrl = getSocketUrl();
    logger.info(`Connecting to Socket.IO server at ${socketUrl}...`);

    this.socket = io(socketUrl, {
      path: '/api/socket/io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    this.socket.on('connect', () => {
      logger.info('Connected to Socket.IO server');
      this.isConnected = true;
    });

    this.socket.on('disconnect', (reason) => {
      logger.warn(`Disconnected from Socket.IO server: ${reason}`);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      logger.error(`Connection error: ${error.message}`);
      this.isConnected = false;
    });
  }

  broadcastMarketUpdate(marketAddress: string, data: any): void {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('broadcast:market', { marketAddress, data, timestamp: Date.now() });
  }

  broadcastPositionUpdate(userWallet: string, marketAddress: string, data: any): void {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('broadcast:position', { userWallet, marketAddress, data, timestamp: Date.now() });
  }

  sendNotification(userWallet: string, notification: any): void {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('broadcast:notification', { userWallet, notification, timestamp: Date.now() });
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }
}

export const socketClient = new SocketClient();
