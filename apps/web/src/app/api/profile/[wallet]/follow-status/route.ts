/**
 * API endpoint for checking follow status
 *
 * GET - Check if viewer is following this user
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, UserFollow } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';

// Force dynamic rendering - this route uses request.url
export const dynamic = 'force-dynamic';

const logger = createClientLogger();

/**
 * GET /api/profile/[wallet]/follow-status?viewer=<wallet>
 * Check if viewer is following this user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  try {
    const { wallet: followingWallet } = params;
    const { searchParams } = new URL(request.url);
    const followerWallet = searchParams.get('viewer');

    // Validate input
    if (!followerWallet) {
      return NextResponse.json(
        { success: false, error: 'Viewer wallet address is required' },
        { status: 400 }
      );
    }

    if (!followingWallet) {
      return NextResponse.json(
        { success: false, error: 'Profile wallet address is required' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Check if follow relationship exists
    const followRelationship = await UserFollow.findOne({
      followerWallet,
      followingWallet,
    });

    const isFollowing = !!followRelationship;

    return NextResponse.json({
      success: true,
      data: {
        isFollowing,
        followerWallet,
        followingWallet,
      },
    });

  } catch (error) {
    logger.error('Failed to check follow status:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check follow status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
