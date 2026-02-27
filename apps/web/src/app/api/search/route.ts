/**
 * Global Search API
 * Search across users and markets
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, UserProfile, PredictionMarket, Project } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

// Force dynamic rendering for API route with query parameters
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          users: [],
          markets: [],
        },
      });
    }

    await connectToDatabase();

    // Search users by username or wallet address
    const users = await UserProfile.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { walletAddress: { $regex: query, $options: 'i' } },
        { bio: { $regex: query, $options: 'i' } },
      ],
    })
      .limit(limit)
      .sort({ reputationScore: -1, followerCount: -1 })
      .lean();

    // Search markets by name or description with populated project
    const markets = await PredictionMarket.find({
      $or: [
        { marketName: { $regex: query, $options: 'i' } },
        { marketDescription: { $regex: query, $options: 'i' } },
      ],
    })
      .populate('projectId')
      .limit(limit)
      .lean();

    // Format user results
    const formattedUsers = users.map((user: any) => ({
      type: 'user' as const,
      walletAddress: user.walletAddress,
      username: user.username || null,
      profilePhotoUrl: user.profilePhotoUrl || null,
      bio: user.bio || null,
      reputationScore: user.reputationScore || 0,
      followerCount: user.followerCount || 0,
      followingCount: user.followingCount || 0,
    }));

    // Format market results
    const formattedMarkets = markets.map((market: any) => {
      const project = market.projectId; // populated project
      return {
        type: 'market' as const,
        id: market._id.toString(),
        marketAddress: market.marketAddress,
        marketName: market.marketName,
        marketDescription: market.marketDescription,
        marketState: market.marketState,
        projectName: project?.name || 'Unknown Project',
        projectImageUrl: project?.projectImageUrl || null,
        tokenSymbol: project?.tokenSymbol || null,
        expiryTime: market.expiryTime,
      };
    });

    logger.info('Search completed', {
      query,
      userResults: formattedUsers.length,
      marketResults: formattedMarkets.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        users: formattedUsers,
        markets: formattedMarkets,
        query,
      },
    });
  } catch (error) {
    logger.error('Search failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
