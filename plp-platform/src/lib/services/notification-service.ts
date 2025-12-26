/**
 * Notification Service
 * Handles creating notifications for various platform events
 */

import { connectToDatabase, Notification, PredictionMarket, TradeHistory, PredictionParticipant } from '@/lib/mongodb';
import { getDatabase } from '@/lib/database/index';
import { COLLECTIONS } from '@/lib/database/models';
import logger from '@/lib/logger';

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
    const founderWallet = market.founderWallet;
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
    const trades = await TradeHistory.find({ marketId }).distinct('userWallet');

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
    const notificationPromises = trades.map(async (userWallet) => {
      // Check if user has claimable rewards
      const userTrades = await TradeHistory.find({
        marketId,
        userWallet,
      });

      const hasClaimableRewards = userTrades.some(trade => !trade.claimed);

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
        userId: userWallet,
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
