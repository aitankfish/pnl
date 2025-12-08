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

const logger = createClientLogger();

export async function POST(request: NextRequest) {
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
}

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
