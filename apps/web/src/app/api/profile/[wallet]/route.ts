/**
 * GET /api/profile/[wallet]
 * Fetch user profile by wallet address
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import { COLLECTIONS, UserProfile } from '@/lib/database/models';

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

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

    // Find user profile by wallet address
    let profile = await profilesCollection.findOne({
      walletAddress: wallet
    });

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

    // Calculate real-time counts from actual data
    const tradesCollection = db.collection(COLLECTIONS.TRADE_HISTORY);
    const projectsCollection = db.collection(COLLECTIONS.PROJECTS);

    // Count total unique markets the user has participated in (from trades)
    const uniqueMarkets = await tradesCollection.distinct('marketId', {
      traderWallet: wallet
    });
    const totalPredictions = uniqueMarkets.length;

    // Count markets created by this user (not projects, but prediction markets)
    const marketsCollection = db.collection(COLLECTIONS.PREDICTION_MARKETS);
    const userProjects = await projectsCollection.find({ founderWallet: wallet }).toArray();
    const projectIds = userProjects.map(p => p._id);

    const projectsCreated = await marketsCollection.countDocuments({
      projectId: { $in: projectIds }
    });

    // Merge calculated counts with profile data
    const profileWithCounts = {
      ...profile,
      totalPredictions,
      projectsCreated,
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
