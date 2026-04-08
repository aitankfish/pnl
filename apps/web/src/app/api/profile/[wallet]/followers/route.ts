/**
 * API endpoint for getting followers list
 *
 * GET - Get list of followers for a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, UserFollow, UserProfile } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic';

const logger = createClientLogger();

/**
 * GET /api/profile/[wallet]/followers
 * Get list of followers for a user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    const { wallet: followingWallet } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Validate input
    if (!followingWallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Get followers from user_follows collection
    const followers = await UserFollow.find({ followingWallet })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit);

    // Get total count
    const totalCount = await UserFollow.countDocuments({ followingWallet });

    // Get follower wallet addresses
    const followerWallets = followers.map((f) => f.followerWallet);

    // Get user profiles for followers (if they exist)
    const followerProfiles = await UserProfile.find({
      walletAddress: { $in: followerWallets },
    });

    // Create a map of wallet -> profile for easy lookup
    const profileMap = new Map();
    followerProfiles.forEach((profile) => {
      profileMap.set(profile.walletAddress, profile);
    });

    // Transform data to include profile info
    const followersWithProfiles = followers.map((follow) => {
      const profile = profileMap.get(follow.followerWallet);
      return {
        walletAddress: follow.followerWallet,
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
        followers: followersWithProfiles,
        total: totalCount,
        limit,
        offset,
      },
    });

  } catch (error) {
    logger.error('Failed to get followers:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get followers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
