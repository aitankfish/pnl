/**
 * Chat Reaction API Route
 * POST - Add or remove reaction from a message
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import { COLLECTIONS, MessageReaction, ChatMessage } from '@/lib/database/models';
import { broadcastChatReaction } from '@/services/socket/socket-server';

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

// Allowed emojis for reactions
const ALLOWED_EMOJIS = ['🚀', '💎', '🔥', '👀', '❤️', '👍', '👎', '😂', '🤔', '💪'];

/**
 * POST /api/chat/[marketAddress]/react
 * Toggle a reaction on a message
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ marketAddress: string }> }
) {
  try {
    const { marketAddress } = await params;
    const body = await request.json();
    const { walletAddress, messageId, emoji } = body;

    // Validation
    if (!marketAddress) {
      return NextResponse.json(
        { success: false, error: 'Market address is required' },
        { status: 400 }
      );
    }

    if (!walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'Message ID is required' },
        { status: 400 }
      );
    }

    if (!emoji || !ALLOWED_EMOJIS.includes(emoji)) {
      return NextResponse.json(
        { success: false, error: 'Invalid emoji' },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const db = getDatabase();
    const chatCollection = db.collection<ChatMessage>(COLLECTIONS.CHAT_MESSAGES);
    const reactionsCollection = db.collection<MessageReaction>(COLLECTIONS.MESSAGE_REACTIONS);

    // Verify the message exists and belongs to this market
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

    // Check if user already has this reaction
    const existingReaction = await reactionsCollection.findOne({
      messageId: new ObjectId(messageId),
      walletAddress,
      emoji,
    });

    if (existingReaction) {
      // Remove the reaction (toggle off)
      await reactionsCollection.deleteOne({ _id: existingReaction._id });
    } else {
      // Add the reaction
      await reactionsCollection.insertOne({
        messageId: new ObjectId(messageId),
        walletAddress,
        emoji,
        createdAt: new Date(),
      });
    }

    // Get updated reaction counts for this message
    const reactionCounts = await reactionsCollection.aggregate([
      { $match: { messageId: new ObjectId(messageId) } },
      { $group: { _id: '$emoji', count: { $sum: 1 } } },
    ]).toArray();

    const reactions = reactionCounts.reduce((acc, r) => {
      acc[r._id] = r.count;
      return acc;
    }, {} as Record<string, number>);

    // Broadcast reaction update
    broadcastChatReaction(marketAddress, messageId, reactions);

    return NextResponse.json({
      success: true,
      data: {
        messageId,
        reactions,
        action: existingReaction ? 'removed' : 'added',
      },
    });
  } catch (error: any) {
    console.error('Error toggling reaction:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to toggle reaction' },
      { status: 500 }
    );
  }
}
