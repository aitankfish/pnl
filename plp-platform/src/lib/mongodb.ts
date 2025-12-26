/**
 * MongoDB Connection Utility
 * Handles database connection and schema definitions
 */

import mongoose from 'mongoose';
import { getDatabaseConfig } from './environment';
import logger from './logger';

// Connection state
let isConnected = false;

export const connectToDatabase = async () => {
  if (isConnected) {
    logger.debug('Database already connected');
    return;
  }

  const dbConfig = getDatabaseConfig();

  if (!dbConfig.uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  try {
    // Append database name to URI (handle case with query parameters)
    let baseUri = dbConfig.uri.replace(/\/$/, ''); // Remove trailing slash
    const hasQueryParams = baseUri.includes('?');

    let connectionUri: string;
    if (hasQueryParams) {
      // Remove any slash before the query params, then insert database name
      connectionUri = baseUri.replace(/\/?\?/, `/${dbConfig.name}?`);
    } else {
      connectionUri = `${baseUri}/${dbConfig.name}`;
    }

    await mongoose.connect(connectionUri, {
      serverSelectionTimeoutMS: 10000, // 10 second timeout
      socketTimeoutMS: 45000, // 45 second socket timeout
    });
    isConnected = true;
    logger.info('Connected to MongoDB successfully', {
      database: dbConfig.name,
      connectionUri: connectionUri.replace(/:[^:@]+@/, ':***@'), // Hide password in logs
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', {
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      environment: process.env.NODE_ENV || 'development',
      hasMongoUri: !!dbConfig.uri
    });
    throw error;
  }
};

// Project Schema
const ProjectSchema = new mongoose.Schema({
  founderWallet: {
    type: String,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    maxlength: 255,
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000,
  },
  category: {
    type: String,
    required: true,
    enum: [
      // Crypto-native categories
      'DeFi', 'defi',
      'NFT', 'nft',
      'Gaming', 'gaming',
      'DAO', 'dao',
      'AI/ML', 'ai/ml', 'ai',
      'Infrastructure', 'infrastructure',
      'Social', 'social',
      'Meme', 'meme',
      'Creator', 'creator',
      // Broader market categories
      'Healthcare', 'healthcare',
      'Science', 'science',
      'Education', 'education',
      'Finance', 'finance',
      'Commerce', 'commerce',
      'Real Estate', 'real estate', 'realestate',
      'Energy', 'energy',
      'Media', 'media',
      'Manufacturing', 'manufacturing',
      'Mobility', 'mobility',
      'Other', 'other'
    ],
  },
  projectType: {
    type: String,
    required: true,
    enum: ['Protocol', 'Application', 'Platform', 'Service', 'Tool', 'protocol', 'application', 'platform', 'service', 'tool'],
  },
  projectStage: {
    type: String,
    required: true,
    enum: ['Idea', 'MVP', 'Beta', 'Production', 'Scaling', 'Prototype', 'Launched', 'idea', 'mvp', 'beta', 'production', 'scaling', 'prototype', 'launched'],
  },
  location: {
    type: String,
    maxlength: 255,
  },
  teamSize: {
    type: Number,
    required: true,
    min: 1,
  },
  tokenSymbol: {
    type: String,
    required: true,
    minlength: [3, 'Token symbol must be at least 3 characters long'],
    maxlength: [10, 'Token symbol cannot exceed 10 characters'],
    uppercase: true,
  },
  socialLinks: {
    type: Map,
    of: String,
    default: {},
  },
  projectImageUrl: {
    type: String,
  },
  documentUrls: {
    type: [String],
    default: [],
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'resolved', 'cancelled'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Prediction Market Schema
const PredictionMarketSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true, // Index for faster lookups
  },
  marketAddress: {
    type: String,
    required: true,
    unique: true,
    index: true, // Index for faster lookups
  },
  marketName: {
    type: String,
    required: true,
    maxlength: 255,
  },
  marketDescription: {
    type: String,
    required: true,
  },
  metadataUri: {
    type: String,
  },
  // Cached IPFS metadata to avoid fetching on every request
  cachedMetadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  metadataCachedAt: {
    type: Date,
  },
  expiryTime: {
    type: Date,
    required: true,
  },
  finalizationDeadline: {
    type: Date,
    required: true,
  },
  marketState: {
    type: Number,
    default: 0, // 0=Active, 1=Resolved, 2=Canceled, 3=AutoCanceled
    index: true, // Index for faster filtering by state
  },
  winningOption: {
    type: Boolean, // true=YES wins, false=NO wins, null=unresolved
  },
  resolution: {
    type: String,
    enum: ['Unresolved', 'YesWins', 'NoWins', 'Refund'],
    default: 'Unresolved',
  },
  targetPool: {
    type: Number,
    default: 5000000000, // 5 SOL in lamports
  },
  platformFee: {
    type: Number,
    default: 500000000, // 0.5 SOL in lamports
  },
  yesVoteCost: {
    type: Number,
    default: 50000000, // 0.05 SOL in lamports
  },
  totalYesStake: {
    type: Number,
    default: 0,
  },
  totalNoStake: {
    type: Number,
    default: 0,
  },
  yesVoteCount: {
    type: Number,
    default: 0,
  },
  noVoteCount: {
    type: Number,
    default: 0,
  },
  pumpFunTokenAddress: {
    type: String,
  },
  autoLaunch: {
    type: Boolean,
    default: true,
  },
  launchWindowEnd: {
    type: Date,
  },
  resolvedAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true, // Index for faster sorting
  },

  // ========================================
  // Blockchain Sync Fields (from on-chain)
  // ========================================
  poolBalance: {
    type: String, // bigint as string
    default: '0',
  },
  distributionPool: {
    type: String, // bigint as string
    default: '0',
  },
  yesPool: {
    type: String, // AMM pool state
    default: '0',
  },
  noPool: {
    type: String, // AMM pool state
    default: '0',
  },
  totalYesShares: {
    type: String, // Share tokens issued to YES voters
    default: '0',
  },
  totalNoShares: {
    type: String, // Share tokens issued to NO voters
    default: '0',
  },
  phase: {
    type: Number, // 0=Prediction, 1=Funding
    default: 0,
  },

  // Calculated fields for UI
  poolProgressPercentage: {
    type: Number,
    default: 0,
  },
  yesPercentage: {
    type: Number, // Based on SOL staked (user-friendly)
    default: 50,
  },
  noPercentage: {
    type: Number, // Based on SOL staked (complement of yesPercentage)
    default: 50,
  },
  sharesYesPercentage: {
    type: Number, // Based on shares (winner logic)
    default: 50,
  },

  // Available actions based on state
  availableActions: {
    type: [String], // ['vote', 'resolve', 'extend', 'claim']
    default: ['vote'],
  },

  // Token fields
  tokenMint: {
    type: String,
  },
  platformTokensAllocated: {
    type: String,
    default: '0',
  },
  platformTokensClaimed: {
    type: Boolean,
    default: false,
  },
  yesVoterTokensAllocated: {
    type: String,
    default: '0',
  },

  // Sync metadata
  lastSyncedAt: {
    type: Date,
  },
  lastSlot: {
    type: Number,
  },
  syncStatus: {
    type: String,
    enum: ['synced', 'syncing', 'error', 'pending'],
    default: 'pending',
  },
  syncCount: {
    type: Number,
    default: 0,
  },

  // ========================================
  // Grok AI Analyses (chat-like history)
  // ========================================
  // Legacy single roast field (for backward compatibility)
  grokRoast: {
    content: {
      type: String,
    },
    generatedAt: {
      type: Date,
    },
    model: {
      type: String,
    },
  },
  // New: Array of analyses for chat-like history
  grokAnalyses: [{
    type: {
      type: String, // 'initial_roast', 'resolution_analysis'
      enum: ['initial_roast', 'resolution_analysis'],
      required: true,
    },
    content: {
      type: String, // The analysis text
      required: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
    model: {
      type: String, // Grok model used
    },
    // Additional context for resolution analysis
    votingData: {
      totalYesVotes: Number,
      totalNoVotes: Number,
      yesPercentage: Number,
      totalParticipants: Number,
      outcome: String, // 'YesWins', 'NoWins', 'Refund'
    },
  }],
});

// Compound index for common queries (marketState + createdAt sorting)
PredictionMarketSchema.index({ marketState: 1, createdAt: -1 });

// Prediction Participants Schema
const PredictionParticipantSchema = new mongoose.Schema({
  marketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PredictionMarket',
    required: true,
  },
  participantWallet: {
    type: String,
    required: true,
    index: true,
  },
  voteOption: {
    type: Boolean,
    required: true, // true=YES, false=NO
  },
  stakeAmount: {
    type: Number,
    required: true,
  },
  voteCost: {
    type: Number,
    required: true,
  },
  tokensAirdropped: {
    type: Number,
    default: 0,
  },
  solRewarded: {
    type: Number,
    default: 0,
  },
  claimed: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },

  // ========================================
  // Position PDA Sync Fields
  // ========================================
  yesShares: {
    type: String, // Share tokens owned
    default: '0',
  },
  noShares: {
    type: String, // Share tokens owned
    default: '0',
  },
  totalInvested: {
    type: String, // Total SOL invested
    default: '0',
  },
  positionPdaAddress: {
    type: String, // Track the PDA address
  },
  positionClosed: {
    type: Boolean, // PDA closed after claim
    default: false,
  },
  lastSyncedAt: {
    type: Date,
  },
});

// Add indexes for better performance
PredictionParticipantSchema.index({ marketId: 1, participantWallet: 1, voteOption: 1 }, { unique: true });

// Notification Schema
const NotificationSchema = new mongoose.Schema({
  userId: {
    type: String, // Wallet address
    required: true,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: [
      'vote_result',
      'token_launched',
      'vote_reminder',
      'reward_earned',
      'project_update',
      'weekly_digest',
      'community_milestone',
      'market_resolved',
      'claim_ready',
      'pool_complete',
      'founder_voice_live',
    ],
  },
  title: {
    type: String,
    required: true,
    maxlength: 255,
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000,
  },
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium',
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  marketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PredictionMarket',
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
  },
  actionUrl: {
    type: String,
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed, // For flexible data like token amounts, etc.
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Compound indexes for efficient queries
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });

// User Profile Schema
const UserProfileSchema = new mongoose.Schema({
  walletAddress: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  email: {
    type: String,
  },
  username: {
    type: String,
    index: true,
  },
  profilePhotoUrl: {
    type: String,
  },
  bio: {
    type: String,
    maxlength: 500,
  },
  reputationScore: {
    type: Number,
    default: 0,
    index: true,
  },
  totalPredictions: {
    type: Number,
    default: 0,
  },
  correctPredictions: {
    type: Number,
    default: 0,
  },
  projectsCreated: {
    type: Number,
    default: 0,
  },
  successfulProjects: {
    type: Number,
    default: 0,
  },
  followerCount: {
    type: Number,
    default: 0,
  },
  followingCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for UserProfile (walletAddress already has index: true in schema)
UserProfileSchema.index({ reputationScore: -1 });
UserProfileSchema.index({ followerCount: -1 });

// User Follow Schema
const UserFollowSchema = new mongoose.Schema({
  followerWallet: {
    type: String,
    required: true,
    index: true,
  },
  followingWallet: {
    type: String,
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for efficient follow lookups
UserFollowSchema.index({ followerWallet: 1, followingWallet: 1 }, { unique: true });

// ========================================
// Chat System Schemas
// ========================================

// Chat Message Schema
const ChatMessageSchema = new mongoose.Schema({
  marketAddress: {
    type: String,
    required: true,
    index: true,
  },
  walletAddress: {
    type: String,
    required: true,
    index: true,
  },
  displayName: {
    type: String,
    default: '',
  },
  message: {
    type: String,
    required: true,
    maxlength: 500,
  },
  position: {
    type: String,
    enum: ['YES', 'NO', 'NONE'],
    default: 'NONE',
  },
  positionSize: {
    type: Number,
    default: 0,
  },
  isFounder: {
    type: Boolean,
    default: false,
  },
  isPinned: {
    type: Boolean,
    default: false,
    index: true,
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatMessage',
    default: null,
  },
  editedAt: {
    type: Date,
    default: null,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Compound indexes for chat messages
ChatMessageSchema.index({ marketAddress: 1, createdAt: -1 }); // Fetch messages by market
ChatMessageSchema.index({ marketAddress: 1, isPinned: 1 }); // Fetch pinned messages
ChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // TTL: 30 days

// Message Reaction Schema
const MessageReactionSchema = new mongoose.Schema({
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatMessage',
    required: true,
    index: true,
  },
  walletAddress: {
    type: String,
    required: true,
  },
  emoji: {
    type: String,
    required: true,
    maxlength: 4, // Single emoji
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index to ensure one reaction per user per message per emoji
MessageReactionSchema.index({ messageId: 1, walletAddress: 1, emoji: 1 }, { unique: true });

// Export models - Force recreation to pick up schema changes
if (mongoose.models.Project) {
  delete mongoose.models.Project;
}
if (mongoose.models.PredictionMarket) {
  delete mongoose.models.PredictionMarket;
}
if (mongoose.models.PredictionParticipant) {
  delete mongoose.models.PredictionParticipant;
}
if (mongoose.models.Notification) {
  delete mongoose.models.Notification;
}
if (mongoose.models.UserProfile) {
  delete mongoose.models.UserProfile;
}
if (mongoose.models.UserFollow) {
  delete mongoose.models.UserFollow;
}
if (mongoose.models.ChatMessage) {
  delete mongoose.models.ChatMessage;
}
if (mongoose.models.MessageReaction) {
  delete mongoose.models.MessageReaction;
}

export const Project = mongoose.model('Project', ProjectSchema);
export const PredictionMarket = mongoose.model('PredictionMarket', PredictionMarketSchema);
export const PredictionParticipant = mongoose.model('PredictionParticipant', PredictionParticipantSchema);
export const Notification = mongoose.model('Notification', NotificationSchema);
export const UserProfile = mongoose.model('UserProfile', UserProfileSchema, 'user_profiles');
export const UserFollow = mongoose.model('UserFollow', UserFollowSchema, 'user_follows');
export const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema, 'chat_messages');
export const MessageReaction = mongoose.model('MessageReaction', MessageReactionSchema, 'message_reactions');

// Type definitions
export interface IProject {
  _id: string;
  founderWallet: string;
  name: string;
  description: string;
  category: string;
  projectType: string;
  projectStage: string;
  location?: string;
  teamSize: number;
  tokenSymbol: string;
  socialLinks: Map<string, string>;
  projectImageUrl?: string;
  documentUrls?: string[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPredictionMarket {
  _id: string;
  projectId: string;
  marketAddress: string;
  marketName: string;
  marketDescription: string;
  metadataUri?: string;
  expiryTime: Date;
  finalizationDeadline: Date;
  marketState: number;
  winningOption?: boolean;
  targetPool: number;
  platformFee: number;
  yesVoteCost: number;
  totalYesStake: number;
  totalNoStake: number;
  yesVoteCount: number;
  noVoteCount: number;
  pumpFunTokenAddress?: string;
  autoLaunch: boolean;
  launchWindowEnd?: Date;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface IPredictionParticipant {
  _id: string;
  marketId: string;
  participantWallet: string;
  voteOption: boolean;
  stakeAmount: number;
  voteCost: number;
  tokensAirdropped: number;
  solRewarded: number;
  claimed: boolean;
  createdAt: Date;
}

// Chat System Types
export interface IChatMessage {
  _id: string;
  marketAddress: string;
  walletAddress: string;
  displayName: string;
  message: string;
  position: 'YES' | 'NO' | 'NONE';
  positionSize: number;
  isFounder: boolean;
  isPinned: boolean;
  replyTo: string | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
}

export interface IMessageReaction {
  _id: string;
  messageId: string;
  walletAddress: string;
  emoji: string;
  createdAt: Date;
}
