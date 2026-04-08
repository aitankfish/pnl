/**
 * API endpoint for completing market creation
 *
 * This endpoint is called after the transaction is confirmed on-chain
 * to save the market data to MongoDB.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, Project, PredictionMarket } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';
import { getSyncManager } from '@/services/blockchain-sync/sync-manager';
import { tweetMarketCreated } from '@/services/twitter/twitter-service';
import { broadcastNewMarket } from '@/services/socket/socket-server';
import { withWalletOwnership } from '@/lib/auth/require-wallet';

const logger = createClientLogger();

export const POST = withWalletOwnership(async (request: NextRequest) => {
  try {
    const body = await request.json();

    logger.info('Completing market creation', {
      projectId: body.projectId,
      marketAddress: body.marketAddress
    });

    // Validate required fields
    const requiredFields = ['projectId', 'marketAddress', 'signature', 'ipfsCid'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Connect to MongoDB
    await connectToDatabase();

    // Find the project
    const project = await Project.findById(body.projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Calculate finalizationDeadline (7 days after expiry)
    const expiryDate = body.expiryTime ? new Date(body.expiryTime * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const finalizationDeadline = new Date(expiryDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Create prediction market document
    const marketDoc = new PredictionMarket({
      projectId: body.projectId,
      marketAddress: body.marketAddress,
      marketName: project.name,
      marketDescription: project.description,
      metadataUri: body.ipfsCid ? `ipfs://${body.ipfsCid}` : undefined,
      targetPool: body.targetPool || 5000000000, // Default 5 SOL
      expiryTime: expiryDate,
      finalizationDeadline: finalizationDeadline,
      marketState: 0, // 0 = Active
      createdAt: new Date(),
    });

    // Save market to MongoDB
    const savedMarket = await marketDoc.save();

    // Update project status to active (market created)
    project.status = 'active';
    project.updatedAt = new Date();
    await project.save();

    // Auto-subscribe the new market to the sync manager
    // This ensures real-time updates without requiring server restart
    try {
      const syncManager = getSyncManager();
      await syncManager.subscribeToMarket(body.marketAddress);
      logger.info('Auto-subscribed new market to sync manager', {
        marketAddress: body.marketAddress
      });
    } catch (error) {
      // Don't fail the entire request if subscription fails
      // The market will be picked up on next server restart
      logger.warn('Failed to auto-subscribe market to sync manager:', {
        marketAddress: body.marketAddress,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    logger.info('Market creation completed', {
      marketId: savedMarket._id,
      marketAddress: savedMarket.marketAddress,
      projectId: project._id
    });

    // Broadcast new market to all connected clients (real-time update)
    try {
      broadcastNewMarket({
        id: savedMarket._id.toString(),
        marketAddress: savedMarket.marketAddress,
        name: project.name,
        description: project.description,
        category: project.category || 'Other',
        stage: project.projectStage || 'Idea',
        tokenSymbol: project.tokenSymbol || project.name.substring(0, 6).toUpperCase(),
        targetPool: `${(savedMarket.targetPool / 1_000_000_000).toFixed(0)} SOL`,
        expiryTime: savedMarket.expiryTime.toISOString(),
        status: 'active',
        projectImageUrl: project.projectImageUrl,
        poolBalance: 0,
        poolProgressPercentage: 0,
        totalParticipants: 0,
        resolution: 'Unresolved',
        phase: 'Initial',
        displayStatus: '✅ Active',
        badgeClass: 'bg-green-500/20 text-green-400 border-green-400/30',
      });
    } catch (broadcastError) {
      // Don't fail if broadcast fails
      logger.warn('Failed to broadcast new market:', {
        error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError)
      });
    }

    // Extract Twitter handle from socialLinks
    let twitterHandle: string | undefined;
    if (project.socialLinks) {
      const socialLinks = project.socialLinks instanceof Map
        ? Object.fromEntries(project.socialLinks)
        : project.socialLinks;
      twitterHandle = socialLinks.twitter || socialLinks.x || socialLinks.Twitter || socialLinks.X;
    }

    // Tweet about the new market (non-blocking)
    tweetMarketCreated({
      tokenSymbol: project.tokenSymbol || project.name.substring(0, 6).toUpperCase(),
      projectName: project.name,
      category: project.category || 'Project',
      stage: project.projectStage || 'Early Stage',
      marketId: savedMarket._id.toString(),
      description: project.description,
      twitterHandle,
      projectImageUrl: project.projectImageUrl || undefined,
    }).catch((error) => {
      logger.warn('Failed to tweet market creation:', {
        error: error instanceof Error ? error.message : String(error),
        marketId: savedMarket._id,
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        marketId: savedMarket._id,
        marketAddress: savedMarket.marketAddress,
        projectId: project._id,
        marketState: savedMarket.marketState,
        expiryTime: savedMarket.expiryTime,
        finalizationDeadline: savedMarket.finalizationDeadline,
        targetPool: savedMarket.targetPool,
      }
    });

  } catch (error) {
    logger.error('Failed to complete market creation:', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to complete market creation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});

export async function GET() {
  return NextResponse.json({
    message: 'PLP Complete Market Creation API',
    endpoints: {
      POST: 'Complete market creation after on-chain transaction confirmation',
      GET: 'Get API information'
    },
    requiredFields: [
      'projectId',      // MongoDB project ID
      'marketAddress',  // On-chain market PDA
      'signature',      // Transaction signature
      'ipfsCid',        // IPFS CID
    ],
    optionalFields: [
      'targetPool',     // Target pool size
      'expiryTime',     // Market expiry timestamp
    ]
  });
}
