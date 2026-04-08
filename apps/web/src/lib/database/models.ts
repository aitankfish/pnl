/**
 * Database Models and Schemas for PLP Platform
 *
 * This file keeps the original ObjectId-based interfaces for server-side MongoDB usage
 * and also re-exports the shared string-based types for cross-platform compatibility.
 */

import { ObjectId } from 'mongodb';

// ============================================================
// Server-side ObjectId-based interfaces (used by API routes)
// These MUST stay here because MongoDB operations need ObjectId
// ============================================================

// Project Schema
export interface Project {
  _id?: ObjectId;
  founderWallet: string;
  name: string;
  description: string;
  category: string;
  projectType: string;
  projectStage: string;
  location?: string;
  teamSize: number;
  tokenSymbol: string;
  socialLinks: {
    website?: string;
    github?: string;
    linkedin?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
  projectImageUrl?: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

// Prediction Market Schema
export interface PredictionMarket {
  _id?: ObjectId;
  projectId: ObjectId;
  marketAddress: string;
  marketName: string;
  marketDescription: string;
  metadataUri?: string;
  expiryTime: Date;
  finalizationDeadline: Date;
  marketState: number;
  winningOption?: boolean;
  resolution?: string;
  targetPool: number;
  platformFee: number;
  yesVoteCost: number;
  totalYesStake: number;
  totalNoStake: number;
  yesVoteCount: number;
  noVoteCount: number;
  pumpFunTokenAddress?: string;
  tokenSymbol?: string;
  autoLaunch: boolean;
  launchWindowEnd?: Date;
  resolvedAt?: Date;
  finalPoolBalance?: number;
  finalPoolProgressPercentage?: number;
  finalYesPercentage?: number;
  finalNoPercentage?: number;
  favoriteCount?: number;
  createdAt: Date;
}

// Prediction Participant Schema
export interface PredictionParticipant {
  _id?: ObjectId;
  marketId: ObjectId;
  participantWallet: string;
  voteOption: boolean;
  stakeAmount: number;
  voteCost: number;
  tokensAirdropped: number;
  solRewarded: number;
  claimed: boolean;
  createdAt: Date;
}

// User Profile Schema
export interface UserProfile {
  _id?: ObjectId;
  walletAddress: string;
  email?: string;
  username?: string;
  profilePhotoUrl?: string;
  bio?: string;
  reputationScore: number;
  totalPredictions: number;
  correctPredictions: number;
  projectsCreated: number;
  successfulProjects: number;
  followerCount: number;
  followingCount: number;
  favoriteMarkets?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// User Follow Schema
export interface UserFollow {
  _id?: ObjectId;
  followerWallet: string;
  followingWallet: string;
  createdAt: Date;
}

// Transaction History Schema
export interface TransactionHistory {
  _id?: ObjectId;
  walletAddress: string;
  transactionType: 'prediction' | 'reward' | 'airdrop' | 'fee';
  marketId?: ObjectId;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  transactionHash?: string;
  createdAt: Date;
}

// Trade History Schema (DEPRECATED)
export interface TradeHistory {
  _id?: ObjectId;
  marketId: ObjectId;
  marketAddress: string;
  traderWallet: string;
  voteType: 'yes' | 'no';
  amount: number;
  shares: number;
  yesPrice: number;
  noPrice: number;
  signature: string;
  createdAt: Date;
}

// Chat Message Schema
export interface ChatMessage {
  _id?: ObjectId;
  marketAddress: string;
  walletAddress: string;
  displayName: string;
  message: string;
  position: 'YES' | 'NO' | 'NONE';
  positionSize: number;
  isFounder: boolean;
  isPinned: boolean;
  replyTo?: ObjectId | null;
  editedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
}

// Message Reaction Schema
export interface MessageReaction {
  _id?: ObjectId;
  messageId: ObjectId;
  walletAddress: string;
  emoji: string;
  createdAt: Date;
}

// Database Collection Names
export const COLLECTIONS = {
  PROJECTS: 'projects',
  PREDICTION_MARKETS: 'predictionmarkets',
  PREDICTION_PARTICIPANTS: 'predictionparticipants',
  USER_PROFILES: 'user_profiles',
  USER_FOLLOWS: 'user_follows',
  TRANSACTION_HISTORY: 'transaction_history',
  TRADE_HISTORY: 'trade_history',
  CHAT_MESSAGES: 'chat_messages',
  MESSAGE_REACTIONS: 'message_reactions',
} as const;

// Index definitions for better performance
export const INDEXES = {
  PROJECTS: [
    { founderWallet: 1 },
    { status: 1 },
    { createdAt: -1 },
    { category: 1 },
    { founderWallet: 1, status: 1, createdAt: -1 },
  ],
  PREDICTION_MARKETS: [
    { marketAddress: 1 },
    { projectId: 1 },
    { marketState: 1 },
    { expiryTime: 1 },
    { marketState: 1, createdAt: -1 },
    { resolution: 1, marketState: 1 },
    { lastSyncedAt: 1 },
    { syncStatus: 1 },
  ],
  PREDICTION_PARTICIPANTS: [
    { marketId: 1, participantWallet: 1, voteOption: 1 },
    { participantWallet: 1 },
    { marketId: 1 },
    { positionPdaAddress: 1 },
    { marketId: 1, yesShares: 1 },
    { marketId: 1, noShares: 1 },
  ],
  USER_PROFILES: [
    { walletAddress: 1 },
    { reputationScore: -1 },
    { username: 1 },
  ],
  USER_FOLLOWS: [
    { followerWallet: 1, followingWallet: 1 },
    { followingWallet: 1 },
    { followerWallet: 1 },
    { createdAt: -1 },
  ],
  TRANSACTION_HISTORY: [
    { walletAddress: 1 },
    { createdAt: -1 },
    { transactionType: 1 },
    { walletAddress: 1, createdAt: -1 },
    { walletAddress: 1, transactionType: 1, createdAt: -1 },
  ],
  MARKET_TIME_SERIES: [
    { marketId: 1, timestamp: -1 },
  ],
  TRADE_HISTORY: [
    { signature: 1 },  // Unique index added at runtime for replay protection
  ],
  CHAT_MESSAGES: [
    { marketAddress: 1, createdAt: -1 },
    { marketAddress: 1, isPinned: 1 },
    { walletAddress: 1 },
  ],
  MESSAGE_REACTIONS: [
    { messageId: 1, walletAddress: 1, emoji: 1 },
    { messageId: 1 },
  ],
} as const;

// ============================================================
// Re-export shared string-based types for cross-platform use
// Import these as SharedProject, SharedPredictionMarket, etc.
// ============================================================
export type {
  Project as SharedProject,
  PredictionMarket as SharedPredictionMarket,
  PredictionParticipant as SharedPredictionParticipant,
  UserProfile as SharedUserProfile,
  UserFollow as SharedUserFollow,
  TransactionHistory as SharedTransactionHistory,
  TradeHistory as SharedTradeHistory,
  ChatMessage as SharedChatMessage,
  MessageReaction as SharedMessageReaction,
} from '@pnl/shared/types';
