import { NextRequest, NextResponse } from 'next/server';
import { notifyFounderJoinedVoice } from '@/lib/services/notification-service';

export async function POST(request: NextRequest) {
  try {
    const { marketAddress, marketName, founderWallet, walletAddress } = await request.json();

    // Validate required fields
    if (!marketAddress || !marketName || !founderWallet || !walletAddress) {
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
}
