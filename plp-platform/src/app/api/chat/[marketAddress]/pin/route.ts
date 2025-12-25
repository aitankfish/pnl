/**
 * Chat Pin API Route
 * POST - Pin or unpin a message (founder only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import { COLLECTIONS, ChatMessage, PredictionMarket, Project } from '@/lib/database/models';
import { broadcastChatPinned } from '@/services/socket/socket-server';

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/[marketAddress]/pin
 * Pin or unpin a message (founder only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ marketAddress: string }> }
) {
  try {
    const { marketAddress } = await params;
    const body = await request.json();
    const { founderWallet, messageId, pinned } = body;

    // Validation
    if (!marketAddress) {
      return NextResponse.json(
        { success: false, error: 'Market address is required' },
        { status: 400 }
      );
    }

    if (!founderWallet) {
      return NextResponse.json(
        { success: false, error: 'Founder wallet is required' },
        { status: 400 }
      );
    }

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'Message ID is required' },
        { status: 400 }
      );
    }

    if (typeof pinned !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Pinned status is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const db = getDatabase();

    // Verify the caller is the founder
    const marketsCollection = db.collection<PredictionMarket>(COLLECTIONS.PREDICTION_MARKETS);
    const projectsCollection = db.collection<Project>(COLLECTIONS.PROJECTS);
    const chatCollection = db.collection<ChatMessage>(COLLECTIONS.CHAT_MESSAGES);

    const market = await marketsCollection.findOne({ marketAddress });
    if (!market) {
      return NextResponse.json(
        { success: false, error: 'Market not found' },
        { status: 404 }
      );
    }

    const project = await projectsCollection.findOne({ _id: market.projectId });
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    if (project.founderWallet !== founderWallet) {
      return NextResponse.json(
        { success: false, error: 'Only the founder can pin messages' },
        { status: 403 }
      );
    }

    // Verify the message exists
    const message = await chatCollection.findOne({
      _id: new ObjectId(messageId),
      marketAddress,
      deletedAt: null,
    });

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message not found' },
        { status: 404 }
      );
    }

    // Check pin limit (max 5 pinned messages per market)
    if (pinned) {
      const pinnedCount = await chatCollection.countDocuments({
        marketAddress,
        isPinned: true,
        deletedAt: null,
      });

      if (pinnedCount >= 5) {
        return NextResponse.json(
          { success: false, error: 'Maximum 5 pinned messages allowed' },
          { status: 400 }
        );
      }
    }

    // Update the message
    await chatCollection.updateOne(
      { _id: new ObjectId(messageId) },
      { $set: { isPinned: pinned } }
    );

    // Broadcast the pin status change
    broadcastChatPinned(marketAddress, messageId, pinned);

    return NextResponse.json({
      success: true,
      data: {
        messageId,
        isPinned: pinned,
      },
    });
  } catch (error: any) {
    console.error('Error toggling pin:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to toggle pin' },
      { status: 500 }
    );
  }
}
