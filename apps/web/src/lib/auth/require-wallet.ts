/**
 * API Route Auth Middleware
 * Wraps route handlers with wallet ownership verification via Privy.
 *
 * Usage:
 *   export const POST = withAuth(async (request, user) => {
 *     // user.walletAddress is verified
 *     return NextResponse.json({ success: true });
 *   });
 *
 * For admin routes:
 *   export const POST = withAdmin(async (request, user) => { ... });
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, type AuthenticatedUser } from './privy-server';

const TREASURY_ADMIN_WALLETS = [
  '7iyZKvd28ZcfVKUxeezwSkvdoQ9sN1D7pEGe42w8yTkZ', // Main admin
];

type AuthHandler = (
  request: NextRequest,
  user: AuthenticatedUser & { walletAddress: string },
  ...args: any[]
) => Promise<NextResponse>;

/**
 * Require authenticated user with linked wallet.
 * Extracts and verifies Privy JWT from Authorization header.
 */
export function withAuth(handler: AuthHandler) {
  return async (request: NextRequest, ...args: any[]) => {
    try {
      const user = await verifyAuth(request);

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 },
        );
      }

      if (!user.walletAddress) {
        return NextResponse.json(
          { success: false, error: 'Wallet not linked' },
          { status: 401 },
        );
      }

      return handler(request, user as AuthenticatedUser & { walletAddress: string }, ...args);
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: 'Authentication failed' },
        { status: 401 },
      );
    }
  };
}

/**
 * Require the authenticated user's wallet matches a specific wallet from the request body.
 * Use for endpoints where the user claims to be a specific wallet.
 */
export function withWalletOwnership(handler: AuthHandler, walletField: string = 'userWallet') {
  return withAuth(async (request, user, ...args) => {
    // Clone the request so the handler can also read the body
    const body = await request.clone().json();
    const claimedWallet = body[walletField];

    if (claimedWallet && claimedWallet !== user.walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet mismatch — you can only act on behalf of your own wallet' },
        { status: 403 },
      );
    }

    return handler(request, user, ...args);
  });
}

/**
 * Require treasury admin wallet.
 */
export function withAdmin(handler: AuthHandler) {
  return withAuth(async (request, user, ...args) => {
    if (!TREASURY_ADMIN_WALLETS.includes(user.walletAddress)) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 },
      );
    }

    return handler(request, user, ...args);
  });
}
