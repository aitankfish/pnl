/**
 * Notification Service
 * Handles creating notifications for various platform events
 */

import { connectToDatabase, Notification, PredictionMarket, PredictionParticipant } from '@/lib/mongodb';
import { getDatabase } from '@/lib/database/index';
import { COLLECTIONS } from '@/lib/database/models';
import logger from '@/lib/logger';
import { broadcastNotification } from '@/services/socket/socket-server';

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  priority?: 'high' | 'medium' | 'low';
  marketId?: string;
  projectId?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a notification
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    await connectToDatabase();

    const notification = await Notification.create({
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      priority: params.priority || 'medium',
      marketId: params.marketId,
      projectId: params.projectId,
      actionUrl: params.actionUrl,
      metadata: params.metadata,
    });

    logger.info('Notification created', {
      userId: params.userId,
      type: params.type,
      notificationId: notification._id?.toString(),
    });

    // Push real-time via Socket.IO (userId is wallet address)
    try {
      broadcastNotification(params.userId, {
        _id: notification._id?.toString(),
        type: params.type,
        title: params.title,
        message: params.message,
        priority: params.priority || 'medium',
        marketId: params.marketId,
        actionUrl: params.actionUrl,
        metadata: params.metadata,
        read: false,
        createdAt: new Date().toISOString(),
      });
    } catch {
      // Non-fatal — notification is saved in DB, socket push is best-effort
    }

    return notification;
  } catch (error) {
    logger.error('Failed to create notification:', error);
    throw error;
  }
}

/**
 * Send notifications when pool is completed (target reached)
 */
export async function notifyPoolCompletion(marketId: string) {
  try {
    await connectToDatabase();

    // Get market and project details
    const market = await PredictionMarket.findById(marketId).populate('projectId');
    if (!market) {
      logger.error('Market not found for pool completion notification', { marketId });
      return;
    }

    const project = market.projectId as any;
    const projectName = project?.name || 'Unknown Project';
    const tokenSymbol = project?.tokenSymbol || 'TKN';

    // Get all users who participated in this market
    const participants = await PredictionParticipant.find({ marketId: market._id }).distinct('participantWallet');

    // Send pool completion notification to all participants
    const notificationPromises = participants.map(async (userWallet: string) => {
      await createNotification({
        userId: userWallet,
        type: 'pool_complete',
        title: `Pool Filled - ${projectName}`,
        message: `The prediction pool for ${projectName} (${tokenSymbol}) has reached its target. Launch decision pending.`,
        priority: 'high',
        marketId: marketId,
        projectId: project?._id?.toString(),
        actionUrl: `/market/${marketId}`,
        metadata: {
          poolBalance: market.poolBalance,
          targetPool: market.targetPool,
          action: 'view_market',
        },
      });
    });

    await Promise.all(notificationPromises);

    logger.info('Pool completion notifications sent', {
      marketId,
      participantCount: participants.length,
    });
  } catch (error) {
    logger.error('Failed to send pool completion notifications:', error);
  }
}

/**
 * Send notifications when a founder joins voice room
 */
export async function notifyFounderJoinedVoice(marketAddress: string, marketName: string) {
  try {
    await connectToDatabase();

    // Get market details using marketAddress
    const market = await PredictionMarket.findOne({ marketAddress });
    if (!market) {
      logger.error('Market not found for founder voice notification', { marketAddress });
      return { success: false, error: 'Market not found' };
    }

    // Get all participants who voted on this market
    const participants = await PredictionParticipant.find({
      marketId: market._id
    }).distinct('participantWallet');

    // Filter out the founder from notification recipients
    const founderWallet = (market as any).founderWallet;
    const recipients = participants.filter((wallet: string) => wallet !== founderWallet);

    if (recipients.length === 0) {
      logger.info('No participants to notify for founder voice join', { marketAddress });
      return { success: true, notified: 0 };
    }

    // Send notifications to all participants
    const notificationPromises = recipients.map(async (userWallet: string) => {
      await createNotification({
        userId: userWallet,
        type: 'founder_voice_live',
        title: `${marketName} founder is live!`,
        message: `The founder of ${marketName} just joined the voice room. Tune in to ask questions and chat!`,
        priority: 'high',
        marketId: market._id?.toString(),
        actionUrl: `/market/${marketAddress}`,
        metadata: {
          action: 'join_voice',
          founderWallet,
        },
      });
    });

    await Promise.all(notificationPromises);

    logger.info('Founder voice join notifications sent', {
      marketAddress,
      marketName,
      participantCount: recipients.length,
    });

    return { success: true, notified: recipients.length };
  } catch (error) {
    logger.error('Failed to send founder voice join notifications:', error);
    return { success: false, error: 'Failed to send notifications' };
  }
}

/**
 * Send notifications when a founder posts a build-in-public update — pulls the
 * people who staked back to read + reply. Best-effort; never blocks the post.
 */
export async function notifyProjectUpdate(marketAddress: string, snippet: string) {
  try {
    await connectToDatabase();

    const market = await PredictionMarket.findOne({ marketAddress }).populate('projectId');
    if (!market) {
      logger.error('Market not found for project update notification', { marketAddress });
      return { success: false, error: 'Market not found' };
    }

    const project = market.projectId as any;
    const projectName = project?.name || (market as any).name || 'A project you backed';
    const founderWallet = project?.founderWallet || (market as any).founderWallet;

    const participants = await PredictionParticipant.find({ marketId: market._id }).distinct('participantWallet');
    const recipients = participants.filter((wallet: string) => wallet && wallet !== founderWallet);
    if (recipients.length === 0) {
      return { success: true, notified: 0 };
    }

    const clean = (snippet || '').replace(/\s+/g, ' ').trim();
    const message = clean ? (clean.length > 140 ? `${clean.slice(0, 137)}…` : clean) : 'New build-in-public update.';

    await Promise.all(
      recipients.map((userWallet: string) =>
        createNotification({
          userId: userWallet,
          type: 'project_update',
          title: `${projectName} posted an update`,
          message,
          priority: 'medium',
          marketId: market._id?.toString(),
          projectId: project?._id?.toString(),
          actionUrl: `/market/${marketAddress}`,
          metadata: { action: 'view_updates' },
        }),
      ),
    );

    logger.info('Project update notifications sent', { marketAddress, notified: recipients.length });
    return { success: true, notified: recipients.length };
  } catch (error) {
    logger.error('Failed to send project update notifications:', error);
    return { success: false, error: 'Failed to send notifications' };
  }
}

/**
 * Send notifications when a market is resolved
 */
export async function notifyMarketResolution(marketId: string, resolution: string) {
  try {
    await connectToDatabase();

    // Get market and project details
    const market = await PredictionMarket.findById(marketId).populate('projectId');
    if (!market) {
      logger.error('Market not found for notification', { marketId });
      return;
    }

    const project = market.projectId as any;
    const projectName = project?.name || 'Unknown Project';
    const tokenSymbol = project?.tokenSymbol || 'TKN';

    // Get all users who participated in this market
    const trades = await PredictionParticipant.find({ marketId }).distinct('participantWallet');

    // Determine notification based on resolution
    let title = '';
    let message = '';
    let type = 'market_resolved';
    let priority: 'high' | 'medium' | 'low' = 'medium';

    if (resolution === 'YesWins') {
      title = `${projectName} Token Launched! 🚀`;
      message = `Great news! ${projectName} (${tokenSymbol}) has successfully launched. The market has been resolved in favor of YES voters.`;
      type = 'token_launched';
      priority = 'high';
    } else if (resolution === 'NoWins') {
      title = `${projectName} - Market Resolved`;
      message = `The prediction market for ${projectName} (${tokenSymbol}) has been resolved. The project did not meet launch criteria.`;
      priority = 'medium';
    } else if (resolution === 'Refund') {
      title = `${projectName} - Refund Available`;
      message = `The market for ${projectName} has been canceled. You can claim your refund now.`;
      priority = 'high';
    }

    // Send notifications to all participants
    const notificationPromises = trades.map(async (participantWallet) => {
      // Check if user has claimable rewards
      const userParticipations = await PredictionParticipant.find({
        marketId,
        participantWallet,
      });

      const hasClaimableRewards = userParticipations.some(p => !p.claimed);

      // Customize message based on whether user has claimable rewards
      let userMessage = message;
      let userType = type;
      let userPriority = priority;
      let action = 'view_market';

      if (hasClaimableRewards) {
        userType = 'claim_ready';
        userPriority = 'high';
        action = 'claim_rewards';

        if (resolution === 'YesWins') {
          userMessage = `${projectName} (${tokenSymbol}) has successfully launched! Claim your rewards now.`;
        } else if (resolution === 'NoWins') {
          userMessage = `The market for ${projectName} has been resolved. Your prediction was correct! Claim your SOL rewards now.`;
        } else if (resolution === 'Refund') {
          userMessage = `The market for ${projectName} has been canceled. Claim your refund now.`;
        }
      }

      // Create single notification per user
      await createNotification({
        userId: participantWallet,
        type: userType,
        title,
        message: userMessage,
        priority: userPriority,
        marketId: marketId,
        projectId: project?._id?.toString(),
        actionUrl: `/market/${marketId}`,
        metadata: {
          resolution,
          hasClaimableRewards,
          action,
        },
      });
    });

    await Promise.all(notificationPromises);

    logger.info('Market resolution notifications sent', {
      marketId,
      resolution,
      participantCount: trades.length,
    } as any);
  } catch (error) {
    logger.error('Failed to send market resolution notifications:', error);
  }
}
