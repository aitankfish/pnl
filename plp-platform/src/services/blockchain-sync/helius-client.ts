/**
 * Helius WebSocket Client
 * Connects to Helius and subscribes to account updates
 */

import WebSocket from 'ws';
import { createClientLogger } from '@/lib/logger';
import { pushEvent } from '@/lib/redis/queue';

const logger = createClientLogger();

type SubscriptionType = 'accountSubscribe' | 'programSubscribe';

interface AccountUpdateNotification {
  jsonrpc: string;
  method: string;
  params: {
    result: {
      context: {
        slot: number;
      };
      value: {
        account: {
          data: [string, string]; // [base64 data, encoding]
          executable: boolean;
          lamports: number;
          owner: string;
          rentEpoch: number;
        };
        pubkey: string;
      };
    };
    subscription: number;
  };
}

export class HeliusClient {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private subscriptions: Map<string, number> = new Map(); // subscription key -> subscription ID
  private subscriptionIdToPubkey: Map<number, string> = new Map(); // subscription ID -> pubkey
  private bufferedNotifications: Map<number, any[]> = new Map(); // subscription ID -> buffered notifications (arrived before confirmation)
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isConnecting = false;
  private isIntentionallyClosed = false;
  private programId: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat: number = Date.now();

  constructor(network: 'devnet' | 'mainnet', programId: string) {
    this.programId = programId;
    const apiKey = process.env.HELIUS_API_KEY;

    if (!apiKey) {
      throw new Error('HELIUS_API_KEY not found in environment');
    }

    this.wsUrl = network === 'devnet'
      ? `wss://devnet.helius-rpc.com/?api-key=${apiKey}`
      : `wss://mainnet.helius-rpc.com/?api-key=${apiKey}`;

    logger.info(`Helius client initialized for ${network}`);
  }

  /**
   * Connect to Helius WebSocket
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      logger.warn('WebSocket already connected');
      return;
    }

    if (this.isConnecting) {
      logger.warn('Connection already in progress');
      return;
    }

    this.isConnecting = true;
    this.isIntentionallyClosed = false;

    return new Promise((resolve, reject) => {
      try {
        logger.info('Connecting to Helius WebSocket...');
        this.ws = new WebSocket(this.wsUrl);

        this.ws.on('open', () => {
          logger.info('✅ Helius WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error) => {
          logger.error('❌ Helius WebSocket error:', error);
          this.isConnecting = false;
          if (this.reconnectAttempts === 0) {
            reject(error);
          }
        });

        this.ws.on('close', (code, reason) => {
          logger.warn(`⚠️ Helius WebSocket closed: ${code} - ${reason}`);
          this.isConnecting = false;
          this.ws = null;
          this.stopHeartbeat();

          if (!this.isIntentionallyClosed) {
            this.scheduleReconnect();
          }
        });

        this.ws.on('ping', () => {
          this.ws?.pong();
        });

        this.ws.on('pong', () => {
          logger.debug('💓 Pong received');
        });

      } catch (error) {
        this.isConnecting = false;
        logger.error('Failed to create WebSocket connection:', error instanceof Error ? { message: error.message } : { error: String(error) });
        reject(error);
      }
    });
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.isIntentionallyClosed) {
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached. Giving up.`);
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
        // Resubscribe to all previous subscriptions
        await this.resubscribeAll();
      } catch (error) {
        logger.error('Reconnection failed:', error instanceof Error ? { message: error.message } : { error: String(error) });
      }
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // Clear any existing heartbeat

    // Send ping every 30 seconds to keep connection alive
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
        this.lastHeartbeat = Date.now();
        logger.debug('💓 Heartbeat sent');
      }
    }, 30000); // 30 seconds

    logger.info('✅ Heartbeat started (30s interval)');
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.debug('Heartbeat stopped');
    }
  }

  /**
   * Resubscribe to all previous subscriptions after reconnection
   */
  private async resubscribeAll(): Promise<void> {
    // Save subscription keys AND pubkey mappings before clearing
    const subscriptionKeys = Array.from(this.subscriptions.keys());
    const oldMappings = new Map(this.subscriptionIdToPubkey);

    logger.info(`Resubscribing to ${subscriptionKeys.length} subscriptions...`, {
      accountSubscriptions: subscriptionKeys.filter(k => k.startsWith('account:')).length,
      programSubscriptions: subscriptionKeys.filter(k => k.startsWith('program:')).length,
      oldMappingsCount: oldMappings.size,
    });

    // Clear old subscription IDs (they're invalid after reconnect)
    this.subscriptions.clear();
    this.subscriptionIdToPubkey.clear(); // Also clear reverse mapping

    for (const key of subscriptionKeys) {
      if (key.startsWith('program:')) {
        const programId = key.replace('program:', '');
        await this.subscribeToProgram(programId);
      } else if (key.startsWith('account:')) {
        const address = key.replace('account:', '');
        await this.subscribeToAccount(address);
      }
    }

    logger.info(`✅ Resubscription requests sent for ${subscriptionKeys.length} subscriptions`);
    logger.info(`⏳ Waiting for subscription confirmations to rebuild pubkey mappings...`);
  }

  /**
   * Subscribe to a specific account (market or position PDA)
   */
  async subscribeToAccount(address: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const subscriptionKey = `account:${address}`;

    if (this.subscriptions.has(subscriptionKey)) {
      logger.warn(`Already subscribed to account: ${address}`);
      return;
    }

    const requestId = Date.now();
    const subscribeRequest = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'accountSubscribe',
      params: [
        address,
        {
          encoding: 'base64',
          commitment: 'confirmed',
        },
      ],
    };

    this.pendingSubscriptions.set(requestId, subscriptionKey);
    this.ws.send(JSON.stringify(subscribeRequest));
    logger.info(`📡 Subscribed to account: ${address}`);
  }

  /**
   * Subscribe to all program accounts (catch all markets/positions)
   */
  async subscribeToProgram(programId?: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const targetProgramId = programId || this.programId;
    const subscriptionKey = `program:${targetProgramId}`;

    if (this.subscriptions.has(subscriptionKey)) {
      logger.warn(`Already subscribed to program: ${targetProgramId}`);
      return;
    }

    const requestId = Date.now();
    const subscribeRequest = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'programSubscribe',
      params: [
        targetProgramId,
        {
          encoding: 'base64',
          commitment: 'confirmed',
        },
      ],
    };

    this.pendingSubscriptions.set(requestId, subscriptionKey);
    this.ws.send(JSON.stringify(subscribeRequest));
    logger.info(`📡 Subscribed to program: ${targetProgramId}`);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private pendingSubscriptions: Map<number, string> = new Map(); // request ID -> subscription key

  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      // Handle subscription confirmation
      if (message.id && message.result && typeof message.result === 'number') {
        const subscriptionKey = this.pendingSubscriptions.get(message.id);
        if (subscriptionKey) {
          const subscriptionId = message.result;
          this.subscriptions.set(subscriptionKey, subscriptionId);
          this.pendingSubscriptions.delete(message.id);

          // Store reverse mapping for accountSubscribe (not programSubscribe)
          if (subscriptionKey.startsWith('account:')) {
            const pubkey = subscriptionKey.replace('account:', '');
            this.subscriptionIdToPubkey.set(subscriptionId, pubkey);
            logger.info(`✅ Account subscription confirmed: ${pubkey.slice(0, 8)}... -> ${subscriptionId}`, {
              subscriptionKey,
              subscriptionId,
              totalMappings: this.subscriptionIdToPubkey.size,
            });

            // Process any buffered notifications that arrived before confirmation
            const buffered = this.bufferedNotifications.get(subscriptionId);
            if (buffered && buffered.length > 0) {
              logger.info(`📦 Processing ${buffered.length} buffered notification(s) for subscription ${subscriptionId}`, {
                subscriptionId,
                pubkey: pubkey.slice(0, 8) + '...',
                count: buffered.length,
              });

              // Process each buffered notification
              for (const notification of buffered) {
                this.handleAccountUpdate(notification).catch((error) => {
                  logger.error('Error processing buffered notification:', {
                    error: error instanceof Error ? error.message : String(error),
                    subscriptionId,
                  });
                });
              }

              // Clear buffer
              this.bufferedNotifications.delete(subscriptionId);
            }
          } else {
            logger.info(`✅ Subscription confirmed: ${subscriptionKey} -> ${subscriptionId}`);
          }
        } else {
          logger.warn(`⚠️  Subscription confirmed but no pending request found`, {
            requestId: message.id,
            subscriptionId: message.result,
            pendingCount: this.pendingSubscriptions.size,
          });
        }
        return;
      }

      // Handle account updates
      if (message.method === 'accountNotification' || message.method === 'programNotification') {
        this.handleAccountUpdate(message as AccountUpdateNotification);
      }
    } catch (error) {
      logger.error('Error parsing WebSocket message:', error instanceof Error ? { message: error.message } : { error: String(error) });
    }
  }

  /**
   * Handle account update notification
   */
  private async handleAccountUpdate(notification: AccountUpdateNotification): Promise<void> {
    try {
      // Check the notification method type
      const method = notification.method;
      logger.info(`📨 Notification method: ${method}`);

      // Handle both accountNotification and programNotification formats
      let slot: number;
      let pubkey: string;
      let accountData: string;
      let encoding: string;

      if (method === 'accountNotification') {
        // Format: notification.params.result.value = { lamports, data, owner, ... }
        const result = notification.params?.result;
        if (!result || !result.value) {
          logger.warn('Invalid accountNotification format');
          return;
        }

        slot = result.context?.slot || 0;

        // Look up pubkey from subscription ID
        const subscriptionId = notification.params?.subscription;
        if (!subscriptionId) {
          logger.warn('No subscription ID in accountNotification');
          return;
        }

        const resolvedPubkey = this.subscriptionIdToPubkey.get(subscriptionId);
        if (!resolvedPubkey) {
          // Notification arrived before confirmation - buffer it for processing later
          logger.warn(`⚠️  Buffering notification: subscription confirmation not yet received`, {
            subscriptionId,
            availableMappings: Array.from(this.subscriptionIdToPubkey.keys()),
            totalSubscriptions: this.subscriptions.size,
            bufferedCount: this.bufferedNotifications.size,
          });

          // Add to buffer
          const buffered = this.bufferedNotifications.get(subscriptionId) || [];
          buffered.push(notification);
          this.bufferedNotifications.set(subscriptionId, buffered);

          // Clean up old buffers after 30 seconds (confirmation should arrive within seconds)
          setTimeout(() => {
            const stillBuffered = this.bufferedNotifications.get(subscriptionId);
            if (stillBuffered) {
              logger.error(`❌ CRITICAL: Buffered notifications never processed (confirmation timeout)`, {
                subscriptionId,
                bufferedCount: stillBuffered.length,
                timeoutSeconds: 30,
              });
              this.bufferedNotifications.delete(subscriptionId);
            }
          }, 30000);

          return;
        }

        pubkey = resolvedPubkey;
        // In accountNotification, result.value IS the account data directly
        const value: any = result.value;

        if (!value || !value.data) {
          logger.warn('No account data in accountNotification');
          return;
        }

        accountData = value.data[0];
        encoding = value.data[1];

      } else if (method === 'programNotification') {
        // Format: notification.params.result.value = { pubkey, account }
        const result = notification.params?.result;
        if (!result || !result.value) {
          logger.warn('Invalid programNotification format');
          return;
        }

        slot = result.context?.slot || 0;
        const value = result.value;

        pubkey = value.pubkey;
        const account = value.account;

        if (!account || !account.data) {
          logger.warn('No account data in programNotification');
          return;
        }

        accountData = account.data[0];
        encoding = account.data[1];

      } else {
        logger.warn(`Unknown notification method: ${method}`);
        return;
      }

      if (encoding !== 'base64') {
        logger.warn(`Unexpected encoding: ${encoding}`);
        return;
      }

      // Determine account type by checking discriminator or size
      const accountType = this.detectAccountType(accountData);

      logger.info(`📥 Account update received: ${pubkey.slice(0, 8)}... (${accountType})`);

      // Only process market and position accounts, skip unknown types (token accounts, etc.)
      if (accountType === 'unknown') {
        logger.debug(`⏭️  Skipping unknown account type: ${pubkey.slice(0, 8)}...`);
        return;
      }

      // Push to Redis queue
      await pushEvent({
        type: 'account_update',
        accountType,
        address: pubkey,
        data: accountData,
        slot,
        timestamp: Date.now(),
      });

    } catch (error) {
      logger.error('Error handling account update:', error instanceof Error ? { message: error.message, stack: error.stack } : { error: String(error) });
    }
  }

  /**
   * Detect account type (market or position) from data
   * Attempts to parse as each type to determine which it is
   */
  private detectAccountType(base64Data: string): 'market' | 'position' | 'unknown' {
    try {
      const buffer = Buffer.from(base64Data, 'base64');

      // Need at least 8 bytes for discriminator
      if (buffer.length < 8) {
        return 'unknown';
      }

      // Try parsing as market first (more complex structure)
      try {
        // Market has: 32 bytes (founder) + 4 bytes (string length) at start after discriminator
        if (buffer.length > 44) { // 8 + 32 + 4
          const dataWithoutDiscriminator = buffer.slice(8);
          // Check if string length is reasonable (< 1000)
          const ipfsCidLen = dataWithoutDiscriminator.readUInt32LE(32);
          if (ipfsCidLen < 1000) {
            return 'market';
          }
        }
      } catch (e) {
        // Not a market, try position
      }

      // Try parsing as position (simpler structure)
      try {
        // Position has size: 8 (discriminator) + 128 (account data with padding) = 136 bytes
        // This matches Position::SPACE in the Rust program
        if (buffer.length === 136) {
          return 'position';
        }
      } catch (e) {
        // Not a position either
      }

      logger.warn(`Could not detect account type, size: ${buffer.length} bytes`);
      return 'unknown';
    } catch (error) {
      logger.error('Error detecting account type:', error instanceof Error ? { message: error.message } : { error: String(error) });
      return 'unknown';
    }
  }

  /**
   * Unsubscribe from account
   */
  async unsubscribeFromAccount(address: string): Promise<void> {
    const subscriptionKey = `account:${address}`;
    const subscriptionId = this.subscriptions.get(subscriptionKey);

    if (!subscriptionId) {
      logger.warn(`No subscription found for: ${address}`);
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const unsubscribeRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'accountUnsubscribe',
        params: [subscriptionId],
      };

      this.ws.send(JSON.stringify(unsubscribeRequest));
      this.subscriptions.delete(subscriptionKey);
      logger.info(`🔕 Unsubscribed from account: ${address}`);
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      logger.info('Disconnecting from Helius WebSocket...');
      this.ws.close();
      this.ws = null;
    }

    this.subscriptions.clear();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get subscription count
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}
