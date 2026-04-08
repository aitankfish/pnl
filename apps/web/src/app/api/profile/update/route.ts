/**
 * POST /api/profile/update
 * Update user profile (username, photo, bio)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import { COLLECTIONS, UserProfile } from '@/lib/database/models';
import { withAuth } from '@/lib/auth/require-wallet';

export const POST = withAuth(async (request, authUser) => {
  try {
    const body = await request.json();
    const { username, profilePhotoUrl, bio, twitter, email } = body;
    const walletAddress = authUser.walletAddress; // Use verified wallet

    await connectToDatabase();
    const db = getDatabase();
    const profilesCollection = db.collection<UserProfile>(COLLECTIONS.USER_PROFILES);

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (username !== undefined) updateData.username = username;
    if (profilePhotoUrl !== undefined) updateData.profilePhotoUrl = profilePhotoUrl;
    if (bio !== undefined) updateData.bio = bio;
    if (twitter !== undefined) updateData.twitter = twitter;
    if (email !== undefined) updateData.email = email;

    // Update or create profile
    const result = await profilesCollection.findOneAndUpdate(
      { walletAddress },
      {
        $set: updateData,
        $setOnInsert: {
          walletAddress,
          reputationScore: 0,
          totalPredictions: 0,
          correctPredictions: 0,
          projectsCreated: 0,
          successfulProjects: 0,
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      }
    );

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Profile updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update profile' },
      { status: 500 }
    );
  }
});
