/**
 * POST /api/profiles/batch
 * Fetch multiple user profiles by wallet addresses
 * Used by voice rooms to display participant names and avatars
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import { COLLECTIONS, UserProfile } from '@/lib/database/models';

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { wallets } = await request.json();

    if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Wallet addresses array is required' },
        { status: 400 }
      );
    }

    // Limit to 50 wallets max for performance
    const walletsToFetch = wallets.slice(0, 50);

    await connectToDatabase();
    const db = getDatabase();
    const profilesCollection = db.collection<UserProfile>(COLLECTIONS.USER_PROFILES);

    // Fetch all profiles in one query
    const profiles = await profilesCollection.find({
      walletAddress: { $in: walletsToFetch }
    }).toArray();

    // Create a map of wallet -> profile data (only essential fields)
    const profileMap: Record<string, { username?: string; profilePhotoUrl?: string }> = {};

    // Initialize with empty values for all requested wallets
    walletsToFetch.forEach(wallet => {
      profileMap[wallet] = {};
    });

    // Fill in data for found profiles
    profiles.forEach(profile => {
      profileMap[profile.walletAddress] = {
        username: profile.username,
        profilePhotoUrl: profile.profilePhotoUrl,
      };
    });

    return NextResponse.json({
      success: true,
      data: profileMap,
    }, {
      headers: {
        // Cache for 60 seconds - profile data doesn't change frequently
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error: any) {
    console.error('Error fetching batch profiles:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch profiles' },
      { status: 500 }
    );
  }
}
