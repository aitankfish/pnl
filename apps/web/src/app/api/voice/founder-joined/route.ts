import { NextRequest, NextResponse } from 'next/server';
import { notifyFounderJoinedVoice } from '@/lib/services/notification-service';
import { withAuth } from '@/lib/auth/require-wallet';

export const POST = withAuth(async (request: NextRequest, authUser) => {
  try {
    const { marketAddress, marketName, founderWallet } = await request.json();
    const walletAddress = authUser.walletAddress;

    // Validate required fields
    if (!marketAddress || !marketName || !founderWallet) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify the caller is the founder
    if (walletAddress !== founderWallet) {
      return NextResponse.json(
        { error: 'Only the founder can trigger this notification' },
        { status: 403 }
      );
    }

    // Send notifications to all voters
    const result = await notifyFounderJoinedVoice(marketAddress, marketName);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in founder-joined notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
