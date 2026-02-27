/**
 * Shared Data Model Interfaces
 * Uses string instead of ObjectId for platform-agnostic compatibility
 */

export interface Project {
  _id?: string;
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

export interface PredictionMarket {
  _id?: string;
  projectId: string;
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

export interface PredictionParticipant {
  _id?: string;
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

export interface UserProfile {
  _id?: string;
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

export interface UserFollow {
  _id?: string;
  followerWallet: string;
  followingWallet: string;
  createdAt: Date;
}

export interface TransactionHistory {
  _id?: string;
  walletAddress: string;
  transactionType: 'prediction' | 'reward' | 'airdrop' | 'fee';
  marketId?: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  transactionHash?: string;
  createdAt: Date;
}

export interface TradeHistory {
  _id?: string;
  marketId: string;
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

export interface ChatMessage {
  _id?: string;
  marketAddress: string;
  walletAddress: string;
  displayName: string;
  message: string;
  position: 'YES' | 'NO' | 'NONE';
  positionSize: number;
  isFounder: boolean;
  isPinned: boolean;
  replyTo?: string | null;
  editedAt?: Date | null;
  deletedAt?: Date | null;
  createdAt: Date;
}

export interface MessageReaction {
  _id?: string;
  messageId: string;
  walletAddress: string;
  emoji: string;
  createdAt: Date;
}

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
