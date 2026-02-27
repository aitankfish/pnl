/**
 * Privy Server-Side Authentication
 * Verifies access tokens and extracts authenticated user data
 */

import { PrivyClient } from '@privy-io/server-auth';
import { NextRequest } from 'next/server';

// Initialize Privy client (singleton)
let privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (!privyClient) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error('Privy credentials not configured (NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET required)');
    }

    privyClient = new PrivyClient(appId, appSecret);
  }
  return privyClient;
}

export interface AuthenticatedUser {
  userId: string;
  walletAddress: string | null;
  email?: string;
  createdAt: Date;
}

/**
 * Verify the Privy access token from request headers
 * Returns the authenticated user or null if not authenticated
 */
export async function verifyAuth(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    // Get the access token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the token with Privy
    const privy = getPrivyClient();
    const verifiedClaims = await privy.verifyAuthToken(accessToken);

    // Get the user data
    const user = await privy.getUser(verifiedClaims.userId);

    // Extract the primary wallet address (Solana)
    let walletAddress: string | null = null;

    // Check linked accounts for Solana wallet
    if (user.linkedAccounts) {
      for (const account of user.linkedAccounts) {
        if (account.type === 'wallet' && account.chainType === 'solana') {
          walletAddress = account.address;
          break;
        }
      }
    }

    // Also check embedded wallet
    if (!walletAddress && user.wallet?.address) {
      walletAddress = user.wallet.address;
    }

    return {
      userId: user.id,
      walletAddress,
      email: user.email?.address,
      createdAt: new Date(user.createdAt),
    };
  } catch (error) {
    console.error('Auth verification failed:', error);
    return null;
  }
}

/**
 * Require authentication - returns user or throws error response
 */
export async function requireAuth(request: NextRequest): Promise<AuthenticatedUser> {
  const user = await verifyAuth(request);

  if (!user) {
    throw new Error('Authentication required');
  }

  if (!user.walletAddress) {
    throw new Error('Wallet not linked');
  }

  return user;
}
