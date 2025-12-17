/**
 * Database Connection and Operations
 * Centralized database access for PLP Platform
 */

import { MongoClient, Db } from 'mongodb';
import { config } from '@/lib/config';
import { COLLECTIONS, INDEXES } from './models';

class DatabaseManager {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private connectionPromise: Promise<void> | null = null;

  async connect(): Promise<void> {
    // If already connected and healthy, return immediately
    if (this.client && this.db) {
      try {
        // Quick health check to ensure connection is still alive
        await this.db.admin().ping();
        return;
      } catch (error) {
        // Connection is stale, reset and reconnect
        console.warn('⚠️ Stale MongoDB connection detected, reconnecting...');
        await this.disconnect();
      }
    }

    // If connection is in progress, wait for it
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    if (!config.mongodb.uri) {
      throw new Error('MongoDB URI not configured');
    }

    // Create a new connection promise
    this.connectionPromise = (async () => {
      try {
        // Enhanced connection options for better reliability
        this.client = new MongoClient(config.mongodb.uri!, {
          maxPoolSize: 10, // Limit connection pool size
          minPoolSize: 2,  // Maintain minimum connections
          maxIdleTimeMS: 60000, // Close idle connections after 1 minute
          serverSelectionTimeoutMS: 10000, // Faster timeout for server selection
          socketTimeoutMS: 45000, // Socket timeout
          connectTimeoutMS: 10000, // Connection timeout
        });

        await this.client.connect();
        this.db = this.client.db(config.mongodb.currentDatabase);

        // Create indexes for better performance
        await this.createIndexes();

        console.log('✅ Connected to MongoDB successfully');
      } catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        this.client = null;
        this.db = null;
        this.connectionPromise = null;
        throw error;
      }
    })();

    return this.connectionPromise;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.connectionPromise = null;
      console.log('🔌 Disconnected from MongoDB');
    }
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) return;

    const createIndexSafely = async (collection: string, index: any) => {
      try {
        await this.db!.collection(collection).createIndex(index);
      } catch (error: any) {
        // Ignore IndexKeySpecsConflict (code 86) - index exists with different spec
        // Ignore IndexOptionsConflict (code 85) - index exists with different options
        if (error.code === 86 || error.code === 85 || error.codeName === 'IndexKeySpecsConflict' || error.codeName === 'IndexOptionsConflict') {
          // Silently skip - index already exists
          return;
        }
        throw error;
      }
    };

    try {
      // Create indexes for projects collection
      for (const index of INDEXES.PROJECTS) {
        await createIndexSafely(COLLECTIONS.PROJECTS, index);
      }

      // Create indexes for prediction_markets collection
      for (const index of INDEXES.PREDICTION_MARKETS) {
        await createIndexSafely(COLLECTIONS.PREDICTION_MARKETS, index);
      }

      // Create indexes for prediction_participants collection
      for (const index of INDEXES.PREDICTION_PARTICIPANTS) {
        await createIndexSafely(COLLECTIONS.PREDICTION_PARTICIPANTS, index);
      }

      // Create indexes for user_profiles collection
      for (const index of INDEXES.USER_PROFILES) {
        await createIndexSafely(COLLECTIONS.USER_PROFILES, index);
      }

      // Create indexes for transaction_history collection
      for (const index of INDEXES.TRANSACTION_HISTORY) {
        await createIndexSafely(COLLECTIONS.TRANSACTION_HISTORY, index);
      }

      // Create indexes for market_time_series collection
      for (const index of INDEXES.MARKET_TIME_SERIES) {
        await createIndexSafely('market_time_series', index);
      }

      // Create TTL index for market_time_series (auto-delete after 30 days)
      try {
        await this.db!.collection('market_time_series').createIndex(
          { timestamp: 1 },
          { expireAfterSeconds: 30 * 24 * 60 * 60 } // 30 days
        );
      } catch (error: any) {
        // Ignore if index exists - TTL index options can't be changed without dropping
        if (error.code !== 86 && error.code !== 85 &&
            error.codeName !== 'IndexKeySpecsConflict' &&
            error.codeName !== 'IndexOptionsConflict') {
          console.warn('⚠️ Could not create TTL index for market_time_series:', error.message);
        }
      }

      console.log('📊 Database indexes ensured');
    } catch (error) {
      console.error('❌ Failed to create database indexes:', error);
      // Don't throw here, as indexes might already exist
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.db) return false;
      await this.db.admin().ping();
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
const databaseManager = new DatabaseManager();

// Export functions for easy use
export const connectToDatabase = () => databaseManager.connect();
export const disconnectFromDatabase = () => databaseManager.disconnect();
export const getDatabase = () => databaseManager.getDb();
export const isDatabaseHealthy = () => databaseManager.healthCheck();

// Export collections for easy access
export const getProjectsCollection = () => databaseManager.getDb().collection(COLLECTIONS.PROJECTS);
export const getPredictionMarketsCollection = () => databaseManager.getDb().collection(COLLECTIONS.PREDICTION_MARKETS);
export const getPredictionParticipantsCollection = () => databaseManager.getDb().collection(COLLECTIONS.PREDICTION_PARTICIPANTS);
export const getUserProfilesCollection = () => databaseManager.getDb().collection(COLLECTIONS.USER_PROFILES);
export const getTransactionHistoryCollection = () => databaseManager.getDb().collection(COLLECTIONS.TRANSACTION_HISTORY);

export default databaseManager;
