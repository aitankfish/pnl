/**
 * POST /api/profile/[wallet]/favorites
 * Toggle a market as favorite/watchlist for a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import { COLLECTIONS, UserProfile, PredictionMarket } from '@/lib/database/models';

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
