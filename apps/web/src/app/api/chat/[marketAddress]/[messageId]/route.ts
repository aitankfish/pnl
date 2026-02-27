/**
 * Chat Message API Route
 * DELETE - Soft delete a message (own message or founder)
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import { COLLECTIONS, ChatMessage, PredictionMarket, Project } from '@/lib/database/models';
import { broadcastChatDeleted } from '@/services/socket/socket-server';

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/chat/[marketAddress]/[messageId]
 * Soft delete a message (own message or founder can delete any)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ marketAddress: string; messageId: string }> }
) {
  try {
    const { marketAddress, messageId } = await params;
    const body = await request.json();
    const { walletAddress } = body;

    // Validation
    if (!marketAddress) {
      return NextResponse.json(
        { success: false, error: 'Market address is required' },
        { status: 400 }
      );
    }

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'Message ID is required' },
        { status: 400 }
      );
    }

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const db = getDatabase();

    const chatCollection = db.collection<ChatMessage>(COLLECTIONS.CHAT_MESSAGES);
    const marketsCollection = db.collection<PredictionMarket>(COLLECTIONS.PREDICTION_MARKETS);
    const projectsCollection = db.collection<Project>(COLLECTIONS.PROJECTS);

    // Find the message
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

    // Check if user is authorized to delete
    const isOwner = message.walletAddress === walletAddress;

    // Check if user is the founder
    let isFounder = false;
    const market = await marketsCollection.findOne({ marketAddress });
    if (market) {
      const project = await projectsCollection.findOne({ _id: market.projectId });
      isFounder = project?.founderWallet === walletAddress;
    }

    if (!isOwner && !isFounder) {
      return NextResponse.json(
        { success: false, error: 'Not authorized to delete this message' },
        { status: 403 }
      );
    }

    // Soft delete the message
    await chatCollection.updateOne(
      { _id: new ObjectId(messageId) },
      {
        $set: {
          deletedAt: new Date(),
          isPinned: false, // Unpin if was pinned
        },
      }
    );

    // Broadcast the deletion
    broadcastChatDeleted(marketAddress, messageId);

    return NextResponse.json({
      success: true,
      data: {
        messageId,
        deleted: true,
      },
    });
  } catch (error: any) {
    console.error('Error deleting message:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete message' },
      { status: 500 }
    );
  }
}
