/**
 * GET  /api/profile/[wallet]/favorites — fetch full market data for user's favorites
 * POST /api/profile/[wallet]/favorites — toggle a market as favorite/watchlist
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import { COLLECTIONS, UserProfile, PredictionMarket } from '@/lib/database/models';

export async function GET(
  _request: NextRequest,
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
    const marketsCollection = db.collection<PredictionMarket>(COLLECTIONS.PREDICTION_MARKETS);

    const profile = await profilesCollection.findOne({ walletAddress: wallet });
    const favoriteIds = profile?.favoriteMarkets ?? [];

    if (favoriteIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { favorites: [], total: 0 },
      });
    }

    // Fetch full market data for each favorited market
    const { ObjectId } = await import('mongodb');
    const objectIds = favoriteIds
      .map((id: string) => { try { return new ObjectId(id); } catch { return null; } })
      .filter(Boolean);

    const markets = await marketsCollection.aggregate([
      { $match: { _id: { $in: objectIds } } },
      {
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'project',
        },
      },
      { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
    ]).toArray();

    const favorites = markets.map((m: any) => ({
      id: m._id.toString(),
      title: m.project?.name || 'Unknown',
      tokenSymbol: m.project?.tokenSymbol,
      status: m.marketState === 0 ? 'active' : 'resolved',
      displayStatus: m.resolution === 'Unresolved' ? 'Active' : m.resolution,
      projectImageUrl: m.project?.projectImageUrl,
      poolBalance: parseFloat(m.poolBalance || '0') / 1e9,
      targetPool: (m.targetPool || 0) / 1e9,
      totalParticipants: (m.yesVoteCount || 0) + (m.noVoteCount || 0),
      endTime: m.expiryTime,
    }));

    return NextResponse.json({
      success: true,
      data: { favorites, total: favorites.length },
    });
  } catch (error: any) {
    console.error('Error fetching favorites:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch favorites' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;
    const body = await request.json();
    const { marketId } = body;

    if (!wallet || !marketId) {
      return NextResponse.json(
        { success: false, error: 'Wallet address and market ID are required' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const db = getDatabase();
    const profilesCollection = db.collection<UserProfile>(COLLECTIONS.USER_PROFILES);
    const marketsCollection = db.collection<PredictionMarket>(COLLECTIONS.PREDICTION_MARKETS);

    // Get user profile
    let profile = await profilesCollection.findOne({ walletAddress: wallet });

    // Create profile if it doesn't exist
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
        favoriteMarkets: [marketId],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await profilesCollection.insertOne(newProfile);

      // Increment favoriteCount on the market
      await marketsCollection.updateOne(
        { _id: marketId },
        { $inc: { favoriteCount: 1 } }
      );

      return NextResponse.json({
        success: true,
        data: {
          isFavorite: true,
          favoriteMarkets: [marketId],
        },
      });
    }

    // Toggle favorite
    const favoriteMarkets = profile.favoriteMarkets || [];
    const isFavorite = favoriteMarkets.includes(marketId);

    const updatedFavorites = isFavorite
      ? favoriteMarkets.filter(id => id !== marketId)
      : [...favoriteMarkets, marketId];

    // Update profile
    await profilesCollection.updateOne(
      { walletAddress: wallet },
      {
        $set: {
          favoriteMarkets: updatedFavorites,
          updatedAt: new Date(),
        },
      }
    );

    // Update favoriteCount on the market (increment if adding, decrement if removing)
    await marketsCollection.updateOne(
      { _id: marketId },
      { $inc: { favoriteCount: isFavorite ? -1 : 1 } }
    );

    return NextResponse.json({
      success: true,
      data: {
        isFavorite: !isFavorite,
        favoriteMarkets: updatedFavorites,
      },
    });
  } catch (error: any) {
    console.error('Error toggling favorite:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to toggle favorite' },
      { status: 500 }
    );
  }
}
