/**
 * GET /api/profile/check-username
 * Check if a username is available
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import { COLLECTIONS, UserProfile } from '@/lib/database/models';

// Force dynamic rendering (this route depends on query params)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const username = request.nextUrl.searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { available: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    // Validate username format (alphanumeric, underscores, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { available: false, error: 'Invalid username format' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const db = getDatabase();
    const profilesCollection = db.collection<UserProfile>(COLLECTIONS.USER_PROFILES);

    // Check if username exists (case-insensitive)
    const existingProfile = await profilesCollection.findOne({
      username: { $regex: new RegExp(`^${username}$`, 'i') }
    });

    return NextResponse.json({
      available: !existingProfile,
      username,
    });
  } catch (error: any) {
    console.error('Error checking username availability:', error);
    return NextResponse.json(
      { available: false, error: error.message || 'Failed to check username' },
      { status: 500 }
    );
  }
}
