/**
 * GET /api/profile/[wallet]
 * Fetch user profile by wallet address
 *
 * OPTIMIZATION NOTE:
 *   The "totalPredictions" and "projectsCreated" counts used to require three
 *   aggregation queries on every request (a `distinct('marketId')` collection scan,
 *   a `find()` over projects, and a `countDocuments()` over prediction markets).
 *   These counts change only when a user writes (trades or creates a project), so
 *   we now cache them in Redis with a 60s TTL. The profile document itself is a
 *   fast primary-key lookup and not worth caching separately.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import { COLLECTIONS, UserProfile } from '@/lib/database/models';
import { getRedisClient, prefixKey } from '@/lib/redis/client';

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

const COUNTS_CACHE_TTL_SECONDS = 60;

interface ProfileCounts {
  totalPredictions: number;
  projectsCreated: number;
}

async function getCachedCounts(wallet: string): Promise<ProfileCounts | null> {
  try {
    const redis = getRedisClient();
    const cached = await redis.get(prefixKey(`profile-counts:${wallet}`));
    if (cached) return JSON.parse(cached) as ProfileCounts;
  } catch {
    // Non-fatal — fall through to DB
  }
  return null;
}

async function setCachedCounts(wallet: string, counts: ProfileCounts): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.set(
      prefixKey(`profile-counts:${wallet}`),
      JSON.stringify(counts),
      'EX',
      COUNTS_CACHE_TTL_SECONDS,
    );
  } catch {
    // Best-effort
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const db = getDatabase();
    const profilesCollection = db.collection<UserProfile>(COLLECTIONS.USER_PROFILES);

    // Find user profile by wallet address (fast — indexed primary key)
    let profile = await profilesCollection.findOne({ walletAddress: wallet });

    // If profile doesn't exist, create a default one
    if (!profile) {
      const newProfile = {
        walletAddress: wallet,
        username: undefined,
        profilePhotoUrl: undefined,
        bio: undefined,
        email: undefined,
        reputationScore: 0,
        totalPredictions: 0,
        correctPredictions: 0,
        projectsCreated: 0,
        successfulProjects: 0,
        followerCount: 0,
        followingCount: 0,
        favoriteMarkets: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await profilesCollection.insertOne(newProfile);
      profile = { ...newProfile, _id: result.insertedId };
    }

    // Counts — try Redis first, recalculate on miss
    let counts = await getCachedCounts(wallet);

    if (!counts) {
      const tradesCollection = db.collection(COLLECTIONS.TRADE_HISTORY);
      const projectsCollection = db.collection(COLLECTIONS.PROJECTS);
      const marketsCollection = db.collection(COLLECTIONS.PREDICTION_MARKETS);

      // Run the two independent queries in parallel instead of serially
      const [uniqueMarkets, userProjects] = await Promise.all([
        tradesCollection.distinct('marketId', { traderWallet: wallet }),
        projectsCollection.find({ founderWallet: wallet }).toArray(),
      ]);

      const projectIds = userProjects.map((p: any) => p._id);
      const projectsCreated = projectIds.length
        ? await marketsCollection.countDocuments({ projectId: { $in: projectIds } })
        : 0;

      counts = {
        totalPredictions: uniqueMarkets.length,
        projectsCreated,
      };

      // Cache asynchronously — don't block response
      setCachedCounts(wallet, counts);
    }

    const profileWithCounts = {
      ...profile,
      totalPredictions: counts.totalPredictions,
      projectsCreated: counts.projectsCreated,
    };

    return NextResponse.json({
      success: true,
      data: profileWithCounts,
    });
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
