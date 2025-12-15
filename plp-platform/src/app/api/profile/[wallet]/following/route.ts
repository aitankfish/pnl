/**
 * API endpoint for getting following list
 *
 * GET - Get list of users that this user is following
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, UserFollow, UserProfile } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic';

const logger = createClientLogger();

/**
 * GET /api/profile/[wallet]/following
 * Get list of users that this user is following
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    const { wallet: followerWallet } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate input
    if (!followerWallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Get following from user_follows collection
    const following = await UserFollow.find({ followerWallet })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);

    // Get total count
    const totalCount = await UserFollow.countDocuments({ followerWallet });

    // Get following wallet addresses
    const followingWallets = following.map((f) => f.followingWallet);

    // Get user profiles for following users (if they exist)
    const followingProfiles = await UserProfile.find({
      walletAddress: { $in: followingWallets },
    });

    // Create a map of wallet -> profile for easy lookup
    const profileMap = new Map();
    followingProfiles.forEach((profile) => {
      profileMap.set(profile.walletAddress, profile);
    });

    // Transform data to include profile info
    const followingWithProfiles = following.map((follow) => {
      const profile = profileMap.get(follow.followingWallet);
      return {
        walletAddress: follow.followingWallet,
        username: profile?.username || null,
        profilePhotoUrl: profile?.profilePhotoUrl || null,
        bio: profile?.bio || null,
        reputationScore: profile?.reputationScore || 0,
        followerCount: profile?.followerCount || 0,
        followingCount: profile?.followingCount || 0,
        followedAt: follow.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        following: followingWithProfiles,
        total: totalCount,
        limit,
        offset,
      },
    });

  } catch (error) {
    logger.error('Failed to get following:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get following',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
