/**
 * Chat API Route
 * GET - Fetch messages for a market
 * POST - Send a new message
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import { COLLECTIONS, ChatMessage, PredictionMarket, Project } from '@/lib/database/models';
import { publishChatMessage, getRedisClient } from '@/lib/redis/client';
import { verifyAuth } from '@/lib/auth/privy-server';

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

// ========================================
// Anti-Bot Configuration
// ========================================
const RATE_LIMIT_MESSAGES = 5;           // Max messages per window
const RATE_LIMIT_WINDOW_MS = 60000;      // 1 minute window
const MIN_MESSAGE_COOLDOWN_MS = 2000;    // 2 seconds between messages
const MAX_DUPLICATE_COUNT = 2;           // Allow max 2 similar messages in window

// Spam patterns to detect
const SPAM_PATTERNS = [
  /(.)\1{10,}/i,                           // Repeated characters (aaaaaaaaaa)
  /\b(buy|sell|pump|moon|lambo)\b.*\b(now|fast|quick)\b/i, // Pump & dump language
  /https?:\/\/[^\s]+/gi,                   // URLs (can be relaxed if needed)
  /t\.me\/|discord\.gg\/|bit\.ly\//i,      // Suspicious links
  /\$[A-Z]{2,10}\b/g,                      // Ticker spam ($COIN)
  /free\s*(money|crypto|sol|airdrop)/i,    // Scam patterns
  /dm\s*me|send\s*dm|check\s*dm/i,         // DM solicitation
];

// Fallback in-memory storage (used when Redis unavailable)
const rateLimitMap = new Map<string, { count: number; resetTime: number; lastMessage: number; recentHashes: string[] }>();

/**
 * Generate a simple hash of message content for duplicate detection
 */
function hashMessage(message: string): string {
  // Normalize: lowercase, remove spaces, take first 100 chars
  const normalized = message.toLowerCase().replace(/\s+/g, '').slice(0, 100);
  // Simple hash using char codes
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Check for spam patterns in message
 */
function detectSpam(message: string): { isSpam: boolean; reason?: string } {
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(message)) {
      // Check for URLs - allow some legitimate ones
      if (pattern.source.includes('https')) {
        // Allow links to known good domains
        const allowedDomains = ['twitter.com', 'x.com', 'github.com', 'youtube.com'];
        const hasAllowedLink = allowedDomains.some(domain => message.toLowerCase().includes(domain));
        if (hasAllowedLink) continue;
      }
      return { isSpam: true, reason: 'Message contains spam patterns' };
    }
  }
  return { isSpam: false };
}

/**
 * Redis-based rate limiting with anti-bot measures
 */
async function checkRateLimitRedis(walletAddress: string, message: string): Promise<{ allowed: boolean; error?: string }> {
  try {
    const redis = getRedisClient();
    const now = Date.now();
    const key = `chat:ratelimit:${walletAddress}`;

    // Get current rate limit data
    const data = await redis.get(key);
    let limitData = data ? JSON.parse(data) : { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS, lastMessage: 0, recentHashes: [] };

    // Check if window expired
    if (now > limitData.resetTime) {
      limitData = { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS, lastMessage: 0, recentHashes: [] };
    }

    // Check minimum cooldown between messages
    if (limitData.lastMessage && (now - limitData.lastMessage) < MIN_MESSAGE_COOLDOWN_MS) {
      return { allowed: false, error: 'Please wait a moment before sending another message' };
    }

    // Check rate limit
    if (limitData.count >= RATE_LIMIT_MESSAGES) {
      return { allowed: false, error: 'Rate limit exceeded. Please wait a minute.' };
    }

    // Check for duplicate messages
    const messageHash = hashMessage(message);
    const duplicateCount = limitData.recentHashes.filter((h: string) => h === messageHash).length;
    if (duplicateCount >= MAX_DUPLICATE_COUNT) {
      return { allowed: false, error: 'Please avoid sending duplicate messages' };
    }

    // Update rate limit data
    limitData.count++;
    limitData.lastMessage = now;
    limitData.recentHashes.push(messageHash);
    // Keep only recent hashes (last 10)
    if (limitData.recentHashes.length > 10) {
      limitData.recentHashes = limitData.recentHashes.slice(-10);
    }

    // Store with TTL
    await redis.setex(key, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000), JSON.stringify(limitData));

    return { allowed: true };
  } catch (error) {
    // Fallback to in-memory if Redis fails
    console.warn('Redis rate limit check failed, using fallback:', error);
    return checkRateLimitFallback(walletAddress, message);
  }
}

/**
 * Fallback in-memory rate limiting
 */
function checkRateLimitFallback(walletAddress: string, message: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  let entry = rateLimitMap.get(walletAddress);

  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS, lastMessage: 0, recentHashes: [] };
  }

  // Check cooldown
  if (entry.lastMessage && (now - entry.lastMessage) < MIN_MESSAGE_COOLDOWN_MS) {
    return { allowed: false, error: 'Please wait a moment before sending another message' };
  }

  // Check rate limit
  if (entry.count >= RATE_LIMIT_MESSAGES) {
    return { allowed: false, error: 'Rate limit exceeded. Please wait a minute.' };
  }

  // Check duplicates
  const messageHash = hashMessage(message);
  const duplicateCount = entry.recentHashes.filter(h => h === messageHash).length;
  if (duplicateCount >= MAX_DUPLICATE_COUNT) {
    return { allowed: false, error: 'Please avoid sending duplicate messages' };
  }

  // Update
  entry.count++;
  entry.lastMessage = now;
  entry.recentHashes.push(messageHash);
  if (entry.recentHashes.length > 10) {
    entry.recentHashes = entry.recentHashes.slice(-10);
  }
  rateLimitMap.set(walletAddress, entry);

  return { allowed: true };
}

/**
 * GET /api/chat/[marketAddress]
 * Fetch chat messages for a market
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ marketAddress: string }> }
) {
  try {
    const { marketAddress } = await params;

    if (!marketAddress) {
      return NextResponse.json(
        { success: false, error: 'Market address is required' },
        { status: 400 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const before = searchParams.get('before');

    await connectToDatabase();
    const db = getDatabase();
    const chatCollection = db.collection<ChatMessage>(COLLECTIONS.CHAT_MESSAGES);

    // Build query
    const query: any = {
      marketAddress,
      deletedAt: null,
    };

    if (before) {
      query._id = { $lt: new ObjectId(before) };
    }

    // Fetch messages (newest last for chat display)
    const messages = await chatCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1) // Fetch one extra to check if there are more
      .toArray();

    // Check if there are more messages
    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop(); // Remove the extra one
    }

    // Reverse to get chronological order (oldest first)
    messages.reverse();

    // Fetch pinned messages separately
    const pinnedMessages = await chatCollection
      .find({
        marketAddress,
        isPinned: true,
        deletedAt: null,
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .toArray();

    return NextResponse.json({
      success: true,
      data: {
        messages,
        pinnedMessages,
        hasMore,
        cursor: messages.length > 0 ? messages[0]._id?.toString() : null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching chat messages:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/[marketAddress]
 * Send a new chat message
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ marketAddress: string }> }
) {
  try {
    const { marketAddress } = await params;

    // Verify authentication - this ensures the wallet address is genuine
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!authUser.walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet not linked to account' },
        { status: 401 }
      );
    }

    // Use the verified wallet address from auth, NOT from request body
    const walletAddress = authUser.walletAddress;

    const body = await request.json();
    const { message, replyTo } = body;

    // Validation
    if (!marketAddress) {
      return NextResponse.json(
        { success: false, error: 'Market address is required' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    if (message.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Message too long (max 500 characters)' },
        { status: 400 }
      );
    }

    // Anti-bot: Check for spam patterns
    const spamCheck = detectSpam(message);
    if (spamCheck.isSpam) {
      return NextResponse.json(
        { success: false, error: spamCheck.reason || 'Message flagged as spam' },
        { status: 400 }
      );
    }

    // Anti-bot: Check rate limit, cooldown, and duplicates
    const rateLimitCheck = await checkRateLimitRedis(walletAddress, message);
    if (!rateLimitCheck.allowed) {
      return NextResponse.json(
        { success: false, error: rateLimitCheck.error },
        { status: 429 }
      );
    }

    await connectToDatabase();
    const db = getDatabase();

    // Get user's position in this market
    const marketsCollection = db.collection<PredictionMarket>(COLLECTIONS.PREDICTION_MARKETS);
    const participantsCollection = db.collection(COLLECTIONS.PREDICTION_PARTICIPANTS);
    const projectsCollection = db.collection<Project>(COLLECTIONS.PROJECTS);
    const profilesCollection = db.collection(COLLECTIONS.USER_PROFILES);

    // Find the market
    const market = await marketsCollection.findOne({ marketAddress });
    if (!market) {
      return NextResponse.json(
        { success: false, error: 'Market not found' },
        { status: 404 }
      );
    }

    // Check if user is the founder
    const project = await projectsCollection.findOne({ _id: market.projectId });
    const isFounder = project?.founderWallet === walletAddress;

    // Get user's position
    let position: 'YES' | 'NO' | 'NONE' = 'NONE';
    let positionSize = 0;

    const participant = await participantsCollection.findOne({
      marketId: market._id,
      participantWallet: walletAddress,
    });

    if (participant) {
      // Calculate position from shares
      const yesShares = parseFloat(participant.yesShares || '0');
      const noShares = parseFloat(participant.noShares || '0');

      if (yesShares > noShares) {
        position = 'YES';
        positionSize = yesShares / 1e9; // Convert lamports to SOL
      } else if (noShares > yesShares) {
        position = 'NO';
        positionSize = noShares / 1e9;
      }
    }

    // Anti-bot: Require position to chat (founders exempt)
    if (!isFounder && position === 'NONE') {
      return NextResponse.json(
        { success: false, error: 'You must hold a position in this market to chat' },
        { status: 403 }
      );
    }

    // Get user's display name
    const profile = await profilesCollection.findOne({ walletAddress });
    const displayName = profile?.username || walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);

    // Create the message
    const chatCollection = db.collection<ChatMessage>(COLLECTIONS.CHAT_MESSAGES);

    const newMessage: ChatMessage = {
      marketAddress,
      walletAddress,
      displayName,
      message: message.trim(),
      position,
      positionSize,
      isFounder,
      isPinned: false,
      replyTo: replyTo ? new ObjectId(replyTo) : null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date(),
    };

    const result = await chatCollection.insertOne(newMessage);
    const insertedMessage = { ...newMessage, _id: result.insertedId };

    // Broadcast the message to all connected clients via Redis pub/sub
    await publishChatMessage(marketAddress, insertedMessage);

    return NextResponse.json({
      success: true,
      data: {
        message: insertedMessage,
      },
    });
  } catch (error: any) {
    console.error('Error sending chat message:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}
