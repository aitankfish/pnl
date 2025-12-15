/**
 * API endpoint for following/unfollowing users
 *
 * POST - Follow a user
 * DELETE - Unfollow a user
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, UserFollow, UserProfile } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic';

const logger = createClientLogger();

/**
 * POST /api/profile/[wallet]/follow
 * Follow a user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    const { wallet: followingWallet } = params;
    const body = await request.json();
    const { followerWallet } = body;

    // Validate input
    if (!followerWallet) {
      return NextResponse.json(
        { success: false, error: 'Follower wallet address is required' },
        { status: 400 }
      );
    }

    if (!followingWallet) {
      return NextResponse.json(
        { success: false, error: 'Following wallet address is required' },
        { status: 400 }
      );
    }

    // Cannot follow yourself
    if (followerWallet === followingWallet) {
      return NextResponse.json(
        { success: false, error: 'Cannot follow yourself' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Check if already following
    const existingFollow = await UserFollow.findOne({
      followerWallet,
      followingWallet,
    });

    if (existingFollow) {
      return NextResponse.json(
        { success: false, error: 'Already following this user' },
        { status: 400 }
      );
    }

    // Create follow relationship
    await UserFollow.create({
      followerWallet,
      followingWallet,
      createdAt: new Date(),
    });

    // Update follower count for the followed user (increment)
    await UserProfile.updateOne(
      { walletAddress: followingWallet },
      {
        $inc: { followerCount: 1 },
        $setOnInsert: {
          walletAddress: followingWallet,
          reputationScore: 0,
          totalPredictions: 0,
          correctPredictions: 0,
          projectsCreated: 0,
          successfulProjects: 0,
          followingCount: 0,
          createdAt: new Date(),
        },
        $set: { updatedAt: new Date() },
      },
      { upsert: true }
    );

    // Update following count for the follower (increment)
    await UserProfile.updateOne(
      { walletAddress: followerWallet },
      {
        $inc: { followingCount: 1 },
        $setOnInsert: {
          walletAddress: followerWallet,
          reputationScore: 0,
          totalPredictions: 0,
          correctPredictions: 0,
          projectsCreated: 0,
          successfulProjects: 0,
          followerCount: 0,
          createdAt: new Date(),
        },
        $set: { updatedAt: new Date() },
      },
      { upsert: true }
    );

    logger.info('User followed successfully', {
      followerWallet,
      followingWallet,
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully followed user',
    });

  } catch (error) {
    logger.error('Failed to follow user:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to follow user',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile/[wallet]/follow
 * Unfollow a user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    const { wallet: followingWallet } = params;
    const { searchParams } = new URL(request.url);
    const followerWallet = searchParams.get('followerWallet');

    // Validate input
    if (!followerWallet) {
      return NextResponse.json(
        { success: false, error: 'Follower wallet address is required' },
        { status: 400 }
      );
    }

    if (!followingWallet) {
      return NextResponse.json(
        { success: false, error: 'Following wallet address is required' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Check if follow relationship exists
    const existingFollow = await UserFollow.findOne({
      followerWallet,
      followingWallet,
    });

    if (!existingFollow) {
      return NextResponse.json(
        { success: false, error: 'Not following this user' },
        { status: 400 }
      );
    }

    // Delete follow relationship
    await UserFollow.deleteOne({
      followerWallet,
      followingWallet,
    });

    // Update follower count for the followed user (decrement)
    await UserProfile.updateOne(
      { walletAddress: followingWallet },
      {
        $inc: { followerCount: -1 },
        $set: { updatedAt: new Date() },
      }
    );

    // Update following count for the follower (decrement)
    await UserProfile.updateOne(
      { walletAddress: followerWallet },
      {
        $inc: { followingCount: -1 },
        $set: { updatedAt: new Date() },
      }
    );

    logger.info('User unfollowed successfully', {
      followerWallet,
      followingWallet,
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully unfollowed user',
    });

  } catch (error) {
    logger.error('Failed to unfollow user:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to unfollow user',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
