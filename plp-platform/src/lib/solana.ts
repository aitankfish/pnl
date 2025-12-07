/**
 * Solana Utilities with RPC Fallback
 * Handles connection issues by trying multiple RPC endpoints
 */

import { Connection, PublicKey, Transaction, VersionedTransaction, Signer } from '@solana/web3.js';
import { createClientLogger } from './logger';

const logger = createClientLogger();

/**
 * Redact API keys from RPC URLs before logging
 * Masks everything after 'api-key=' or similar patterns
 */
function redactApiKey(url: string): string {
  return url.replace(/(api[-_]key=)[^&\s]+/gi, '$1***REDACTED***');
}

// RPC endpoint configuration with fallbacks
const RPC_ENDPOINTS: Record<string, string[]> = {
  devnet: [
    // Primary: Helius RPC (if configured)
    process.env.NEXT_PUBLIC_HELIUS_DEVNET_RPC,
    // Fallback 1: Official Solana RPC
    'https://api.devnet.solana.com',
    // Fallback 2: Public RPC endpoints
    'https://rpc.ankr.com/solana_devnet',
    'https://solana-devnet.g.alchemy.com/v2/demo',
  ].filter(Boolean) as string[],

  'mainnet-beta': [
    // Primary: Helius RPC (best performance)
    process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC,
    // Fallback 1: QuickNode RPC (premium backup)
    process.env.NEXT_PUBLIC_QUICKNODE_MAINNET_RPC,
    // Fallback 2: Official Solana RPC (free)
    'https://api.mainnet-beta.solana.com',
    // Fallback 3: Public RPC endpoints (free)
    'https://rpc.ankr.com/solana',
    'https://solana-api.projectserum.com',
  ].filter(Boolean) as string[],
};

class SolanaConnectionManager {
  private static instance: SolanaConnectionManager;
  private connections: Map<string, Connection> = new Map();
  private currentEndpoint: string = '';
  private network: 'devnet' | 'mainnet-beta' = 'devnet';

  constructor() {
    this.network = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta' ? 'mainnet-beta' : 'devnet';
  }

  public static getInstance(): SolanaConnectionManager {
    if (!SolanaConnectionManager.instance) {
      SolanaConnectionManager.instance = new SolanaConnectionManager();
    }
    return SolanaConnectionManager.instance;
  }

  /**
   * Set the network dynamically
   */
  public setNetwork(network: 'devnet' | 'mainnet-beta'): void {
    if (this.network !== network) {
      logger.info(`🔄 Switching network from ${this.network} to ${network}`);
      this.network = network;
      // Clear connections when network changes
      this.connections.clear();
      this.currentEndpoint = '';
    }
  }

  /**
   * Get the current network
   */
  public getNetwork(): 'devnet' | 'mainnet-beta' {
    return this.network;
  }

  /**
   * Get a working connection with fallback support
   * @param network - Optional network override (devnet or mainnet-beta)
   */
  public async getConnection(network?: 'devnet' | 'mainnet-beta'): Promise<Connection> {
    // Use provided network or fall back to instance network
    const targetNetwork = network || this.network;

    // Update instance network if different
    if (network && network !== this.network) {
      this.setNetwork(network);
    }

    const endpoints = RPC_ENDPOINTS[targetNetwork];
    
    for (const endpoint of endpoints) {
      try {
        logger.info(`🔌 Trying RPC endpoint: ${redactApiKey(endpoint)}`);

        // Check if we already have a working connection for this endpoint
        if (this.connections.has(endpoint)) {
          const connection = this.connections.get(endpoint)!;
          // Test the connection
          await connection.getVersion();
          logger.info(`✅ Using cached connection: ${redactApiKey(endpoint)}`);
          this.currentEndpoint = endpoint;
          return connection;
        }

        // Create new connection
        const connection = new Connection(endpoint, 'confirmed');

        // Test the connection
        await connection.getVersion();

        // Cache the working connection
        this.connections.set(endpoint, connection);
        this.currentEndpoint = endpoint;

        logger.info(`✅ Successfully connected to: ${redactApiKey(endpoint)}`);
        return connection;
        
      } catch (error) {
        logger.warn(`❌ Failed to connect to ${redactApiKey(endpoint)}: ${error}`);
        continue;
      }
    }
    
    throw new Error(`Failed to connect to any RPC endpoint for ${this.network}`);
  }

  /**
   * Get the current working endpoint
   */
  public getCurrentEndpoint(): string {
    return this.currentEndpoint;
  }

  /**
   * Force refresh connection (useful when current endpoint fails)
   */
  public async refreshConnection(): Promise<Connection> {
    logger.info('🔄 Refreshing Solana connection...');
    
    // Clear current endpoint
    if (this.currentEndpoint) {
      this.connections.delete(this.currentEndpoint);
      this.currentEndpoint = '';
    }
    
    return await this.getConnection();
  }

  /**
   * Test transaction simulation with fallback
   */
  public async simulateTransaction(
    transaction: Transaction | VersionedTransaction,
    _options?: { commitment?: 'processed' | 'confirmed' | 'finalized' }
  ): Promise<unknown> {
    const connection = await this.getConnection();

    try {
      logger.info(`🧪 Simulating transaction with endpoint: ${redactApiKey(this.currentEndpoint)}`);

      // Handle different transaction types
      if ('message' in transaction) {
        // VersionedTransaction
        return await connection.simulateTransaction(transaction);
      } else {
        // Regular Transaction
        return await connection.simulateTransaction(transaction, []);
      }
    } catch (error) {
      logger.warn(`❌ Simulation failed with ${redactApiKey(this.currentEndpoint)}, trying fallback: ${error}`);
      
      // Try with a different endpoint
      const newConnection = await this.refreshConnection();
      
      if ('message' in transaction) {
        return await newConnection.simulateTransaction(transaction);
      } else {
        return await newConnection.simulateTransaction(transaction, []);
      }
    }
  }

  /**
   * Send transaction with fallback
   */
  public async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    signers?: unknown[],
    options?: { skipPreflight?: boolean; preflightCommitment?: 'processed' | 'confirmed' | 'finalized' }
  ): Promise<string> {
    const connection = await this.getConnection();

    try {
      logger.info(`📤 Sending transaction with endpoint: ${redactApiKey(this.currentEndpoint)}`);

      // Handle different transaction types
      if ('message' in transaction) {
        // VersionedTransaction
        return await connection.sendTransaction(transaction, options);
      } else {
        // Regular Transaction - cast signers to proper type
        return await connection.sendTransaction(transaction, (signers || []) as Signer[], options);
      }
    } catch (error) {
      logger.warn(`❌ Transaction failed with ${redactApiKey(this.currentEndpoint)}, trying fallback: ${error}`);

      // Try with a different endpoint
      const newConnection = await this.refreshConnection();

      if ('message' in transaction) {
        return await newConnection.sendTransaction(transaction, options);
      } else {
        return await newConnection.sendTransaction(transaction, (signers || []) as Signer[], options);
      }
    }
  }

  /**
   * Get account info with fallback
   */
  public async getAccountInfo(publicKey: PublicKey): Promise<unknown> {
    const connection = await this.getConnection();
    
    try {
      return await connection.getAccountInfo(publicKey);
    } catch (error) {
      logger.warn(`❌ getAccountInfo failed with ${redactApiKey(this.currentEndpoint)}, trying fallback: ${error}`);
      
      const newConnection = await this.refreshConnection();
      return await newConnection.getAccountInfo(publicKey);
    }
  }

  /**
   * Get balance with fallback
   */
  public async getBalance(publicKey: PublicKey): Promise<number> {
    const connection = await this.getConnection();
    
    try {
      return await connection.getBalance(publicKey);
    } catch (error) {
      logger.warn(`❌ getBalance failed with ${redactApiKey(this.currentEndpoint)}, trying fallback: ${error}`);
      
      const newConnection = await this.refreshConnection();
      return await newConnection.getBalance(publicKey);
    }
  }

  /**
   * Get network status
   */
  public async getNetworkStatus(): Promise<{ endpoint: string; network: string; version: string }> {
    const connection = await this.getConnection();
    
    try {
      const version = await connection.getVersion();
      return {
        endpoint: this.currentEndpoint,
        network: this.network,
        version: version['solana-core'],
      };
    } catch (error) {
      throw new Error(`Failed to get network status: ${error}`);
    }
  }

  /**
   * Send raw transaction with fallback
   */
  public async sendRawTransaction(
    rawTransaction: Uint8Array,
    options?: { skipPreflight?: boolean; maxRetries?: number; preflightCommitment?: 'processed' | 'confirmed' | 'finalized' }
  ): Promise<string> {
    const connection = await this.getConnection();

    try {
      logger.info(`📤 Sending raw transaction with ${redactApiKey(this.currentEndpoint)}`);
      
      const signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: options?.skipPreflight || false,
        maxRetries: options?.maxRetries || 3,
        preflightCommitment: options?.preflightCommitment || 'confirmed'
      });
      
      logger.info(`✅ Transaction sent successfully: ${signature}`);
      return signature;

    } catch (error) {
      logger.warn(`❌ Transaction failed with ${redactApiKey(this.currentEndpoint)}, trying fallback: ${error}`);

      // Try with fallback RPC
      const newConnection = await this.refreshConnection();
      const signature = await newConnection.sendRawTransaction(rawTransaction, {
        skipPreflight: options?.skipPreflight || true, // Use skipPreflight for fallback
        maxRetries: options?.maxRetries || 3,
        preflightCommitment: options?.preflightCommitment || 'confirmed'
      });
      
      logger.info(`✅ Transaction sent via fallback: ${signature}`);
      return signature;
    }
  }
}

// Export singleton instance
export const solanaConnection = SolanaConnectionManager.getInstance();

// Export convenience functions
export const getSolanaConnection = (network?: 'devnet' | 'mainnet-beta') => solanaConnection.getConnection(network);
export const setNetwork = (network: 'devnet' | 'mainnet-beta') => solanaConnection.setNetwork(network);
export const getNetwork = () => solanaConnection.getNetwork();
export const getCurrentRpcEndpoint = () => solanaConnection.getCurrentEndpoint();
export const refreshSolanaConnection = () => solanaConnection.refreshConnection();
export const simulateSolanaTransaction = (transaction: Transaction | VersionedTransaction, options?: { commitment?: 'processed' | 'confirmed' | 'finalized' }) =>
  solanaConnection.simulateTransaction(transaction, options);
export const sendSolanaTransaction = (transaction: Transaction | VersionedTransaction, signers?: unknown[], options?: { skipPreflight?: boolean; preflightCommitment?: 'processed' | 'confirmed' | 'finalized' }) =>
  solanaConnection.sendTransaction(transaction, signers, options);
export const getSolanaAccountInfo = (publicKey: PublicKey) => solanaConnection.getAccountInfo(publicKey);
export const getSolanaBalance = (publicKey: PublicKey) => solanaConnection.getBalance(publicKey);
export const getSolanaNetworkStatus = () => solanaConnection.getNetworkStatus();
export const sendRawTransaction = (rawTransaction: Uint8Array, options?: { skipPreflight?: boolean; maxRetries?: number; preflightCommitment?: 'processed' | 'confirmed' | 'finalized' }) =>
  solanaConnection.sendRawTransaction(rawTransaction, options);

export default solanaConnection;