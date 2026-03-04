/**
 * Solana Connection Manager (shared)
 * Uses env abstraction instead of process.env
 */

import { Connection, PublicKey, Transaction, VersionedTransaction, Signer } from '@solana/web3.js';
import { getEnvConfig } from '../config/environment';
import { createClientLogger } from '../utils/logger';

const logger = createClientLogger();

function redactApiKey(url: string): string {
  return url.replace(/(api[-_]key=)[^&\s]+/gi, '$1***REDACTED***');
}

function getHeliusRpcEndpoint(network: 'devnet' | 'mainnet-beta'): string | undefined {
  const config = getEnvConfig();
  return network === 'devnet'
    ? config.HELIUS_DEVNET_RPC || undefined
    : config.HELIUS_MAINNET_RPC || undefined;
}

const getRpcEndpoints = (network: 'devnet' | 'mainnet-beta'): string[] => {
  if (network === 'devnet') {
    return [
      getHeliusRpcEndpoint('devnet'),
      'https://api.devnet.solana.com',
      'https://rpc.ankr.com/solana_devnet',
    ].filter(Boolean) as string[];
  } else {
    return [
      getHeliusRpcEndpoint('mainnet-beta'),
      'https://api.mainnet-beta.solana.com',
      'https://rpc.ankr.com/solana',
    ].filter(Boolean) as string[];
  }
};

class SolanaConnectionManager {
  private static instance: SolanaConnectionManager;
  private connections: Map<string, Connection> = new Map();
  private currentEndpoint: string = '';
  private network: 'devnet' | 'mainnet-beta' = 'devnet';
  private verifiedEndpoints: Map<string, number> = new Map(); // endpoint → timestamp of last successful verify
  private static VERIFY_INTERVAL_MS = 60_000; // re-verify every 60s, not on every call

  constructor() {
    try {
      this.network = getEnvConfig().SOLANA_NETWORK;
    } catch {
      this.network = 'devnet';
    }
  }

  public static getInstance(): SolanaConnectionManager {
    if (!SolanaConnectionManager.instance) {
      SolanaConnectionManager.instance = new SolanaConnectionManager();
    }
    return SolanaConnectionManager.instance;
  }

  public setNetwork(network: 'devnet' | 'mainnet-beta'): void {
    if (this.network !== network) {
      logger.info(`Switching network from ${this.network} to ${network}`);
      this.network = network;
      this.connections.clear();
      this.verifiedEndpoints.clear();
      this.currentEndpoint = '';
    }
  }

  public getNetwork(): 'devnet' | 'mainnet-beta' {
    return this.network;
  }

  public async getConnection(network?: 'devnet' | 'mainnet-beta'): Promise<Connection> {
    // Lazy sync: if no explicit network passed, re-check env config
    // in case it was set after the singleton was created
    if (!network) {
      try {
        const envNetwork = getEnvConfig().SOLANA_NETWORK;
        if (envNetwork !== this.network) {
          this.setNetwork(envNetwork);
        }
      } catch { /* config not yet initialized, use current */ }
    }
    const targetNetwork = network || this.network;
    if (network && network !== this.network) {
      this.setNetwork(network);
    }

    const endpoints = getRpcEndpoints(targetNetwork);
    const now = Date.now();

    for (const endpoint of endpoints) {
      try {
        if (this.connections.has(endpoint)) {
          const connection = this.connections.get(endpoint)!;
          const lastVerified = this.verifiedEndpoints.get(endpoint) ?? 0;

          // Skip getVersion() health check if recently verified
          if (now - lastVerified < SolanaConnectionManager.VERIFY_INTERVAL_MS) {
            this.currentEndpoint = endpoint;
            return connection;
          }

          await connection.getVersion();
          this.verifiedEndpoints.set(endpoint, now);
          this.currentEndpoint = endpoint;
          return connection;
        }

        const connection = new Connection(endpoint, 'confirmed');
        await connection.getVersion();
        this.connections.set(endpoint, connection);
        this.verifiedEndpoints.set(endpoint, now);
        this.currentEndpoint = endpoint;
        logger.info(`Connected to: ${redactApiKey(endpoint)}`);
        return connection;
      } catch (error) {
        logger.warn(`Failed to connect to ${redactApiKey(endpoint)}: ${error}`);
        this.verifiedEndpoints.delete(endpoint);
        continue;
      }
    }

    throw new Error(`Failed to connect to any RPC endpoint for ${this.network}`);
  }

  public getCurrentEndpoint(): string {
    return this.currentEndpoint;
  }

  public async refreshConnection(): Promise<Connection> {
    if (this.currentEndpoint) {
      this.connections.delete(this.currentEndpoint);
      this.currentEndpoint = '';
    }
    return await this.getConnection();
  }

  public async simulateTransaction(
    transaction: Transaction | VersionedTransaction,
    _options?: { commitment?: 'processed' | 'confirmed' | 'finalized' }
  ): Promise<unknown> {
    const connection = await this.getConnection();
    try {
      if ('message' in transaction) {
        return await connection.simulateTransaction(transaction);
      } else {
        return await connection.simulateTransaction(transaction, []);
      }
    } catch (error) {
      const newConnection = await this.refreshConnection();
      if ('message' in transaction) {
        return await newConnection.simulateTransaction(transaction);
      } else {
        return await newConnection.simulateTransaction(transaction, []);
      }
    }
  }

  public async sendTransaction(
    transaction: Transaction | VersionedTransaction,
    signers?: unknown[],
    options?: { skipPreflight?: boolean; preflightCommitment?: 'processed' | 'confirmed' | 'finalized' }
  ): Promise<string> {
    const connection = await this.getConnection();
    try {
      if ('message' in transaction) {
        return await connection.sendTransaction(transaction, options);
      } else {
        return await connection.sendTransaction(transaction, (signers || []) as Signer[], options);
      }
    } catch (error) {
      const newConnection = await this.refreshConnection();
      if ('message' in transaction) {
        return await newConnection.sendTransaction(transaction, options);
      } else {
        return await newConnection.sendTransaction(transaction, (signers || []) as Signer[], options);
      }
    }
  }

  public async getAccountInfo(publicKey: PublicKey): Promise<unknown> {
    const connection = await this.getConnection();
    try {
      return await connection.getAccountInfo(publicKey);
    } catch (error) {
      const newConnection = await this.refreshConnection();
      return await newConnection.getAccountInfo(publicKey);
    }
  }

  public async getBalance(publicKey: PublicKey): Promise<number> {
    const connection = await this.getConnection();
    try {
      return await connection.getBalance(publicKey);
    } catch (error) {
      const newConnection = await this.refreshConnection();
      return await newConnection.getBalance(publicKey);
    }
  }

  public async getNetworkStatus(): Promise<{ endpoint: string; network: string; version: string }> {
    const connection = await this.getConnection();
    const version = await connection.getVersion();
    return {
      endpoint: this.currentEndpoint,
      network: this.network,
      version: version['solana-core'],
    };
  }

  public async sendRawTransaction(
    rawTransaction: Uint8Array,
    options?: { skipPreflight?: boolean; maxRetries?: number; preflightCommitment?: 'processed' | 'confirmed' | 'finalized' }
  ): Promise<string> {
    const connection = await this.getConnection();
    try {
      return await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: options?.skipPreflight || false,
        maxRetries: options?.maxRetries || 3,
        preflightCommitment: options?.preflightCommitment || 'confirmed',
      });
    } catch (error) {
      const newConnection = await this.refreshConnection();
      return await newConnection.sendRawTransaction(rawTransaction, {
        skipPreflight: options?.skipPreflight || true,
        maxRetries: options?.maxRetries || 3,
        preflightCommitment: options?.preflightCommitment || 'confirmed',
      });
    }
  }
}

export const solanaConnection = SolanaConnectionManager.getInstance();
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
