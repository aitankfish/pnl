/**
 * Notifications API
 * Handles fetching, updating, and deleting user notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, Notification } from '@/lib/mongodb';
import logger from '@/lib/logger';

/**
 * GET /api/notifications
 * Fetch notifications for a specific user
 * Query params:
 *   - wallet: User's wallet address (required)
 *   - unread: Filter for unread notifications only (optional)
 *   - limit: Number of notifications to return (default: 50)
 *   - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const wallet = searchParams.get('wallet');
    const unreadOnly = searchParams.get('unread') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Build query
    const query: any = { userId: wallet };
    if (unreadOnly) {
      query.isRead = false;
    }

    // Fetch notifications
    const notifications = await Notification
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .populate('marketId', 'marketName marketAddress')
      .populate('projectId', 'name tokenSymbol category')
      .lean();

    // Get total count for pagination
    const total = await Notification.countDocuments(query);

    // Get unread count
    const unreadCount = await Notification.countDocuments({
      userId: wallet,
      isRead: false,
    });

    return NextResponse.json({
      notifications,
      total,
      unreadCount,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * Mark notifications as read
 * Body:
 *   - wallet: User's wallet address (required)
 *   - notificationId: ID of notification to mark as read (optional)
 *   - markAll: Mark all notifications as read (optional)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, notificationId, markAll } = body;

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    if (markAll) {
      // Mark all notifications as read for this user
      const result = await Notification.updateMany(
        { userId: wallet, isRead: false },
        { $set: { isRead: true } }
      );

      return NextResponse.json({
        success: true,
        message: `Marked ${result.modifiedCount} notifications as read`,
        modifiedCount: result.modifiedCount,
      });
    } else if (notificationId) {
      // Mark single notification as read
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId: wallet },
        { $set: { isRead: true } },
        { new: true }
      );

      if (!notification) {
        return NextResponse.json(
          { error: 'Notification not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Notification marked as read',
        notification,
      });
    } else {
      return NextResponse.json(
        { error: 'Either notificationId or markAll must be provided' },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications
 * Delete a notification
 * Body:
 *   - wallet: User's wallet address (required)
 *   - notificationId: ID of notification to delete (required)
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, notificationId } = body;

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    if (!notificationId) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Delete notification (ensure it belongs to the user)
    const result = await Notification.findOneAndDelete({
      _id: notificationId,
      userId: wallet,
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * Create a new notification (internal use only, triggered by system events)
 * Body:
 *   - userId: Wallet address (required)
 *   - type: Notification type (required)
 *   - title: Notification title (required)
 *   - message: Notification message (required)
 *   - priority: Priority level (optional, default: 'medium')
 *   - marketId: Related market ID (optional)
 *   - projectId: Related project ID (optional)
 *   - actionUrl: Action URL (optional)
 *   - metadata: Additional metadata (optional)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      type,
      title,
      message,
      priority = 'medium',
      marketId,
      projectId,
      actionUrl,
      metadata,
    } = body;

    // Validate required fields
    if (!userId || !type || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, type, title, message' },
        { status: 400 }
      );
    }

    // Validate type (must match Notification schema enum in mongodb.ts)
    const validTypes = [
      'vote_result',
      'token_launched',
      'vote_reminder',
      'reward_earned',
      'project_update',
      'weekly_digest',
      'community_milestone',
      'market_resolved',
      'claim_ready',
      'pool_complete',
    ];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid notification type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Create notification
    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      priority,
      marketId,
      projectId,
      actionUrl,
      metadata,
    });

    logger.info('Notification created', {
      userId,
      type,
      notificationId: notification._id?.toString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Notification created successfully',
      notification,
    }, { status: 201 });
  } catch (error) {
    logger.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}
