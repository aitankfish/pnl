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
  galleryImageUrls: {
    type: [String],
    default: [],
  },
  pitchVideoUrl: {
    type: String,
  },
  pitchVideoStreamUid: {
    type: String,
  },
  documentUrls: {
    type: [String],
    default: [],
  },
  // Optional "tribute to the idea" record — attached when the market
  // was drafted by an agent (Claude Code / Cursor / Cline / Codex)
  // and the user opted in to sharing the originating context. Pinned
  // metadata-side at draft-creation; surfaced on the market detail
  // page as "Born in <agent> on <date>" with the excerpt + code
  // snippet on expand.
  provenance: {
    source: { type: String },              // 'claude-code' | 'cursor' | 'cline' | 'codex' | 'other'
    excerpt: { type: String, maxlength: 4000 },
    codeSnippet: { type: String, maxlength: 4000 },
    timestamp: { type: String },           // ISO 8601 from the agent's clock
  },
  // Which surface the idea was created from. Distinct from `provenance`
  // (which records the *agent* and only exists when the user opted in):
  // every market has a createdVia, so the detail page can always show
  // "Created via Web" or "Created via Terminal". 'web' is the default for
  // browser-signed creates; the MCP create paths set 'mcp'.
  createdVia: {
    type: String,
    enum: ['web', 'mcp'],
    default: 'web',
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
      type: String, // The analysis text (markdown prose, or a JSON string when format === 'json')
      required: true,
    },
    // How `content` is encoded. Legacy roasts are markdown prose parsed by regex
    // on the client; new roasts are a JSON string matching the structured schema.
    format: {
      type: String,
      enum: ['markdown', 'json'],
      default: 'markdown',
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
// One position per user per market — matches on-chain Position PDA constraint
PredictionParticipantSchema.index({ marketId: 1, participantWallet: 1 }, { unique: true });

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
      'announcement',
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
  // Verified ORCID identity — set only via the ORCID OAuth callback, never by
  // a client write. The non-gameable "this is a real researcher" signal; also
  // what makes any DOI minted on PNL carry trustworthy authorship.
  orcidId: {
    type: String,
    index: true,
  },
  orcidName: {
    type: String,
  },
  orcidVerifiedAt: {
    type: Date,
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
  },
});

// Compound indexes for chat messages
ChatMessageSchema.index({ marketAddress: 1, createdAt: -1 }); // Fetch messages by market
ChatMessageSchema.index({ marketAddress: 1, isPinned: 1 }); // Fetch pinned messages
ChatMessageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 }); // TTL: 30 days (also indexes createdAt)

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

// ========================================
// Research Paper Schemas (Phase 1: sentiment-only, no on-chain)
// ========================================

// Subschema for individual paper revisions. Append-only — every "edit" is a
// new entry in the versions array; old PDFs stay pinned on IPFS forever.
const ResearchPaperVersionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    // Optional once a paper can be published DOI-first (canonical PDF lives on
    // the publisher, e.g. Zenodo) rather than uploaded to IPFS.
    paperUrl: { type: String },
    title: { type: String, required: true, maxlength: 255 },
    summary: { type: String, maxlength: 500 },
    githubUrl: { type: String, maxlength: 500 },
    // Published-paper provenance: bare DOI + canonical landing/published URL.
    doi: { type: String, maxlength: 200 },
    externalUrl: { type: String, maxlength: 500 },
    changelog: { type: String, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const ResearchPaperSchema = new mongoose.Schema({
  authorWallet: {
    type: String,
    required: true,
    index: true,
  },
  // Top-level fields always mirror the *current* version for fast reads.
  title: {
    type: String,
    required: true,
    maxlength: 255,
  },
  authorName: {
    type: String,
    required: true,
    maxlength: 120,
  },
  authorXHandle: {
    type: String,
    maxlength: 30,
  },
  // Optional: a paper can be published DOI-first with no uploaded PDF.
  paperUrl: {
    type: String,
  },
  summary: {
    type: String,
    maxlength: 500,
  },
  githubUrl: {
    type: String,
    maxlength: 500,
  },
  // Published-paper provenance (e.g. a Zenodo/DataCite/Crossref DOI). `doi` is
  // the bare identifier; `externalUrl` is the canonical landing/published page.
  doi: {
    type: String,
    maxlength: 200,
  },
  externalUrl: {
    type: String,
    maxlength: 500,
  },
  // Research-program grouping: a paper can belong to one program (e.g. Nakshatra)
  // and optionally name the paper it builds on, forming a lineage within the
  // program. Paper-level (not per-version) — these don't change between revisions.
  programId: {
    type: String,
    index: true,
  },
  parentPaperId: {
    type: String,
  },
  // Versioning — append-only history. v1 is written at first publish.
  versions: {
    type: [ResearchPaperVersionSchema],
    default: [],
  },
  currentVersion: {
    type: Number,
    default: 1,
  },
  likeCount: {
    type: Number,
    default: 0,
  },
  dislikeCount: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['active', 'hidden'],
    default: 'active',
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

ResearchPaperSchema.index({ status: 1, createdAt: -1 });
ResearchPaperSchema.index({ status: 1, updatedAt: -1 });
// Text-ish index for the search autocomplete (title is the dominant match).
ResearchPaperSchema.index({ authorWallet: 1, title: 1 });

// ========================================
// Research Programs — a body of work that accumulates papers over time.
// ========================================
//
// A program (e.g. "Nakshatra") groups multiple papers with lineage, so an
// outside researcher lands on a living body of work instead of scattered posts.
// Thin and off-chain on purpose: owner + slug + copy. Membership lives on the
// paper (`programId`); aggregate conviction is READ from the markets that cite
// the program's papers, never written here.
const ResearchProgramSchema = new mongoose.Schema({
  ownerWallet: {
    type: String,
    required: true,
    index: true,
  },
  // URL-safe handle used at /research/program/[slug]. Unique, lowercase.
  slug: {
    type: String,
    required: true,
    unique: true,
    maxlength: 64,
  },
  title: {
    type: String,
    required: true,
    maxlength: 120,
  },
  summary: {
    type: String,
    maxlength: 500,
  },
  status: {
    type: String,
    enum: ['active', 'hidden'],
    default: 'active',
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// ========================================
// Project Posts — the founder's build-in-public update feed on a market.
// ========================================
//
// Durable (unlike ChatMessage's 30-day TTL): the build log persists. Founder-
// authored; readers reply via ChatMessage threads (later). Media is IPFS-hosted
// images. `sourceUrl` records an imported X post for provenance (later phase).
const ProjectPostSchema = new mongoose.Schema({
  // Market the post belongs to — stored by on-chain address for stable lookup.
  marketAddress: {
    type: String,
    required: true,
    index: true,
  },
  projectId: {
    type: String,
    index: true,
  },
  authorWallet: {
    type: String,
    required: true,
  },
  body: {
    type: String,
    maxlength: 5000,
  },
  // IPFS-hosted images attached to the post.
  media: {
    type: [
      new mongoose.Schema(
        { url: { type: String, required: true }, kind: { type: String, default: 'image' } },
        { _id: false },
      ),
    ],
    default: [],
  },
  // Provenance for an imported X/social post (later phase).
  sourceUrl: {
    type: String,
    maxlength: 500,
  },
  pinned: {
    type: Boolean,
    default: false,
  },
  editedAt: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['active', 'hidden'],
    default: 'active',
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});
ProjectPostSchema.index({ marketAddress: 1, status: 1, pinned: -1, createdAt: -1 });

// Replies on a project post — the discussion layer. Durable (no TTL, unlike
// ChatMessage). Anyone may reply; the reply author, the post's founder, or a
// platform admin may hide one.
const PostReplySchema = new mongoose.Schema({
  postId: {
    type: String,
    required: true,
    index: true,
  },
  marketAddress: {
    type: String,
    required: true,
    index: true,
  },
  authorWallet: {
    type: String,
    required: true,
  },
  displayName: {
    type: String,
    maxlength: 60,
  },
  body: {
    type: String,
    required: true,
    maxlength: 1000,
  },
  status: {
    type: String,
    enum: ['active', 'hidden'],
    default: 'active',
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});
PostReplySchema.index({ postId: 1, status: 1, createdAt: 1 });

// ── Milestone ─────────────────────────────────────
//
// A founder-declared, git-settled checkpoint on a market: "I will ship X by
// <date>". OFF-CHAIN status only — settling a milestone flips this display
// record, it does NOT settle the on-chain stake (that's the audit-gated,
// chain-adjacent step deferred per the agentic-github design doc).
//
// Settlement is honest-by-construction: PNL does not judge whether the work is
// good — it reads an objective git signal the founder controls (a release/tag
// they cut). The public + the market judge whether that release actually
// delivers. Once a milestone goes 'shipped' or 'missed' it is frozen; only
// 'open' milestones can be edited or removed, so a founder can't erase a miss.
const MilestoneSchema = new mongoose.Schema({
  marketAddress: {
    type: String,
    required: true,
    index: true,
  },
  projectId: {
    type: String,
    index: true,
  },
  founderWallet: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 140,
  },
  detail: {
    type: String,
    maxlength: 500,
  },
  // The deadline. Absence of the git signal by this date settles the
  // milestone 'missed'.
  targetDate: {
    type: Date,
    required: true,
  },
  // How the milestone settles YES:
  //   'release' — a GitHub Release whose tag or name matches `triggerMatch`
  //   'tag'     — a git tag matching `triggerMatch`
  //   'manual'  — the founder marks it shipped (with an evidence link)
  triggerType: {
    type: String,
    enum: ['release', 'tag', 'manual'],
    default: 'manual',
  },
  // Tag / release name to match (exact, case-insensitive). Required for
  // 'release' / 'tag' triggers; ignored for 'manual'.
  triggerMatch: {
    type: String,
    maxlength: 120,
  },
  status: {
    type: String,
    enum: ['open', 'shipped', 'missed'],
    default: 'open',
    index: true,
  },
  // Link to the proof — the release/tag URL for a git trigger, or a
  // founder-provided URL for a manual settle.
  evidenceUrl: {
    type: String,
    maxlength: 500,
  },
  shippedAt: {
    type: Date,
  },
  // Display order within a project's roadmap.
  order: {
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
MilestoneSchema.index({ marketAddress: 1, order: 1, targetDate: 1 });

// Lightweight emoji reactions on a project post or one of its replies. One row
// per (target, wallet, emoji); toggling a reaction inserts/removes a row.
const PostReactionSchema = new mongoose.Schema({
  // 'post' | 'reply' — which kind of thing this reaction is attached to.
  targetType: {
    type: String,
    enum: ['post', 'reply'],
    required: true,
  },
  // ProjectPost._id or PostReply._id (stored as string for stable lookup).
  targetId: {
    type: String,
    required: true,
    index: true,
  },
  marketAddress: {
    type: String,
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
    maxlength: 8,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
// One reaction per user per target per emoji.
PostReactionSchema.index({ targetType: 1, targetId: 1, walletAddress: 1, emoji: 1 }, { unique: true });

const PaperReactionSchema = new mongoose.Schema({
  paperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ResearchPaper',
    required: true,
    index: true,
  },
  walletAddress: {
    type: String,
    required: true,
  },
  reaction: {
    type: String,
    enum: ['like', 'dislike'],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

PaperReactionSchema.index({ paperId: 1, walletAddress: 1 }, { unique: true });

// ========================================
// Paper Citations — junction collection between papers and projects.
// ========================================
//
// Designed for both Phase A (same-wallet, auto-accepted) and Phase B
// (cross-author, requires acceptance). Public surfaces filter on
// status IN ('auto', 'accepted'); pending citations stay invisible.
//
const PaperCitationSchema = new mongoose.Schema({
  paperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ResearchPaper',
    required: true,
    index: true,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  // Wallet of the project founder (the one requesting the citation).
  addedBy: {
    type: String,
    required: true,
    index: true,
  },
  // Denormalized author wallet so the inbox query is a single hit.
  paperAuthorWallet: {
    type: String,
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['auto', 'pending', 'accepted', 'rejected', 'withdrawn'],
    required: true,
    index: true,
  },
  role: {
    type: String,
    enum: ['thesis', 'foundation', 'reference'],
    default: 'reference',
  },
  // Optional one-line note from the founder explaining the citation.
  citationNote: {
    type: String,
    maxlength: 280,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  acceptedAt: { type: Date },
  rejectedAt: { type: Date },
});

// One paper cited at most once per project.
PaperCitationSchema.index({ paperId: 1, projectId: 1 }, { unique: true });
// Inbox: pending citations for a given author, newest first.
PaperCitationSchema.index({ paperAuthorWallet: 1, status: 1, createdAt: -1 });
// Project page: visible citations for a project, by role.
PaperCitationSchema.index({ projectId: 1, status: 1 });
// Paper page: projects citing a paper, accepted only.
PaperCitationSchema.index({ paperId: 1, status: 1 });

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
if (mongoose.models.ResearchPaper) {
  delete mongoose.models.ResearchPaper;
}
if (mongoose.models.PaperReaction) {
  delete mongoose.models.PaperReaction;
}
if (mongoose.models.PaperCitation) {
  delete mongoose.models.PaperCitation;
}
if (mongoose.models.ResearchProgram) {
  delete mongoose.models.ResearchProgram;
}
if (mongoose.models.ProjectPost) {
  delete mongoose.models.ProjectPost;
}
if (mongoose.models.PostReply) {
  delete mongoose.models.PostReply;
}
if (mongoose.models.Milestone) {
  delete mongoose.models.Milestone;
}
if (mongoose.models.PostReaction) {
  delete mongoose.models.PostReaction;
}

// ─── MarketDraft ─────────────────────────────────────────────────
//
// Agent-prepared market drafts. The MCP server (or any external pitch
// tool) POSTs a payload here, gets a draft id back, and hands the user
// a /create?draft=<id> deep-link. The /create page reads the draft on
// mount and pre-fills the form. The actual on-chain market creation
// still goes through the existing authenticated /api/projects/create
// + /api/markets/complete pipeline -- drafts are purely a pre-fill
// vehicle, never used as a substitute for the signed-by-user mainnet
// transaction.
//
// TTL: 24 hours. Mongo's expireAfterSeconds index on `expiresAt`
// reaps stale drafts automatically.
const MarketDraftSchema = new mongoose.Schema(
  {
    creatorWallet: { type: String, index: true },
    source: { type: String, default: 'mcp' },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    provenance: { type: mongoose.Schema.Types.Mixed },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'market_drafts' },
);
MarketDraftSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

if (mongoose.models.MarketDraft) {
  delete mongoose.models.MarketDraft;
}

export const MarketDraft = mongoose.model('MarketDraft', MarketDraftSchema);

export const Project = mongoose.model('Project', ProjectSchema);
export const PredictionMarket = mongoose.model('PredictionMarket', PredictionMarketSchema);
export const PredictionParticipant = mongoose.model('PredictionParticipant', PredictionParticipantSchema);
export const Notification = mongoose.model('Notification', NotificationSchema);
export const UserProfile = mongoose.model('UserProfile', UserProfileSchema, 'user_profiles');
export const UserFollow = mongoose.model('UserFollow', UserFollowSchema, 'user_follows');
export const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema, 'chat_messages');
export const MessageReaction = mongoose.model('MessageReaction', MessageReactionSchema, 'message_reactions');
export const ResearchPaper = mongoose.model('ResearchPaper', ResearchPaperSchema, 'research_papers');
export const PaperReaction = mongoose.model('PaperReaction', PaperReactionSchema, 'paper_reactions');
export const PaperCitation = mongoose.model('PaperCitation', PaperCitationSchema, 'paper_citations');
export const ResearchProgram = mongoose.model('ResearchProgram', ResearchProgramSchema, 'research_programs');
export const ProjectPost = mongoose.model('ProjectPost', ProjectPostSchema, 'project_posts');
export const PostReply = mongoose.model('PostReply', PostReplySchema, 'post_replies');
export const Milestone = mongoose.model('Milestone', MilestoneSchema, 'milestones');
export const PostReaction = mongoose.model('PostReaction', PostReactionSchema, 'post_reactions');

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
  galleryImageUrls?: string[];
  pitchVideoUrl?: string;
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
  reactions?: Record<string, number>; // emoji -> count (added by API)
}

export interface IMessageReaction {
  _id: string;
  messageId: string;
  walletAddress: string;
  emoji: string;
  createdAt: Date;
}

export interface IResearchPaperVersion {
  version: number;
  paperUrl?: string;
  title: string;
  summary?: string;
  githubUrl?: string;
  doi?: string;
  externalUrl?: string;
  changelog?: string;
  createdAt: Date;
}

export interface IResearchPaper {
  _id: string;
  authorWallet: string;
  title: string;
  authorName: string;
  authorXHandle?: string;
  paperUrl?: string;
  summary?: string;
  githubUrl?: string;
  doi?: string;
  externalUrl?: string;
  programId?: string;
  parentPaperId?: string;
  versions: IResearchPaperVersion[];
  currentVersion: number;
  likeCount: number;
  dislikeCount: number;
  status: 'active' | 'hidden';
  createdAt: Date;
  updatedAt: Date;
}

export interface IPostReply {
  _id: string;
  postId: string;
  marketAddress: string;
  authorWallet: string;
  displayName?: string;
  body: string;
  status: 'active' | 'hidden';
  createdAt: Date;
}

export interface IProjectPost {
  _id: string;
  marketAddress: string;
  projectId?: string;
  authorWallet: string;
  body?: string;
  media: { url: string; kind?: string }[];
  sourceUrl?: string;
  pinned: boolean;
  editedAt?: Date;
  status: 'active' | 'hidden';
  createdAt: Date;
  updatedAt: Date;
}

export interface IMilestone {
  _id: string;
  marketAddress: string;
  projectId?: string;
  founderWallet: string;
  title: string;
  detail?: string;
  targetDate: Date;
  triggerType: 'release' | 'tag' | 'manual';
  triggerMatch?: string;
  status: 'open' | 'shipped' | 'missed';
  evidenceUrl?: string;
  shippedAt?: Date;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPostReaction {
  _id: string;
  targetType: 'post' | 'reply';
  targetId: string;
  marketAddress: string;
  walletAddress: string;
  emoji: string;
  createdAt: Date;
}

export interface IResearchProgram {
  _id: string;
  ownerWallet: string;
  slug: string;
  title: string;
  summary?: string;
  status: 'active' | 'hidden';
  createdAt: Date;
  updatedAt: Date;
}

export interface IPaperReaction {
  _id: string;
  paperId: string;
  walletAddress: string;
  reaction: 'like' | 'dislike';
  createdAt: Date;
}

export interface IPaperCitation {
  _id: string;
  paperId: string;
  projectId: string;
  addedBy: string;
  paperAuthorWallet: string;
  status: 'auto' | 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  role: 'thesis' | 'foundation' | 'reference';
  citationNote?: string;
  createdAt: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
}
