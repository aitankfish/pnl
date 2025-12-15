/**
 * GET /api/user/[wallet]/projects
 * Fetch markets created by a specific user (founder)
 * Optimized with MongoDB aggregation pipeline for single-query data fetching
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, Project } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';
import { convertToGatewayUrl } from '@/lib/api-utils';

// Disable Next.js caching for this route
export const dynamic = 'force-dynamic';

const logger = createClientLogger();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;

    if (!wallet) {
      return NextResponse.json(
        { success: false, error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Use aggregation pipeline to fetch projects + markets in a single query
    const projectsWithMarkets = await Project.aggregate([
      // Match projects by founder wallet
      { $match: { founderWallet: wallet } },
      // Lookup associated markets
      {
        $lookup: {
          from: 'predictionmarkets',
          localField: '_id',
          foreignField: 'projectId',
          as: 'market',
        },
      },
      // Unwind to get one document per market
      { $unwind: { path: '$market', preserveNullAndEmptyArrays: false } },
      // Sort by market creation date
      { $sort: { 'market.createdAt': -1 } },
    ]);

    if (projectsWithMarkets.length === 0) {
      logger.info('No projects found for founder', { wallet });
      return NextResponse.json({
        success: true,
        data: {
          projects: [],
          total: 0,
        },
      });
    }

    logger.info('Fetched projects for founder', {
      wallet,
      count: projectsWithMarkets.length,
    });

    // Transform aggregation results into user-friendly format
    const userProjects = projectsWithMarkets.map((item: any) => {
      const project = item;
      const market = item.market;

      // Calculate time left or expired status
      const now = new Date();
      const expiryTime = new Date(market.expiryTime);
      const timeLeftMs = expiryTime.getTime() - now.getTime();
      const isExpired = timeLeftMs <= 0;

      let timeLeft;
      if (!isExpired) {
        const daysLeft = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((timeLeftMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (daysLeft > 0) {
          timeLeft = `${daysLeft} day${daysLeft > 1 ? 's' : ''}`;
        } else if (hoursLeft > 0) {
          timeLeft = `${hoursLeft} hour${hoursLeft > 1 ? 's' : ''}`;
        } else {
          timeLeft = 'Ending soon';
        }
      } else {
        timeLeft = 'Expired';
      }

      // Determine status based on resolution and market state
      let status = 'Active';
      if (market.resolution === 'YesWins') {
        status = 'Launched';
      } else if (market.resolution === 'NoWins' || market.resolution === 'Refund') {
        status = 'Not Launched';
      } else if (isExpired && market.resolution === 'Unresolved') {
        status = 'Pending Resolution';
      }

      return {
        id: market._id.toString(),
        marketAddress: market.marketAddress,
        name: project.name || 'Unknown Project',
        description: project.description || '',
        category: project.category || 'Other',
        tokenSymbol: project.tokenSymbol || 'TKN',
        projectImageUrl: convertToGatewayUrl(project.projectImageUrl),

        // Market stats
        targetPool: (market.targetPool || 0) / 1e9,
        poolBalance: parseFloat(market.poolBalance || '0') / 1e9,
        poolProgressPercentage: market.poolProgressPercentage || 0,

        // Vote stats
        yesVoteCount: market.yesVoteCount || 0,
        noVoteCount: market.noVoteCount || 0,
        sharesYesPercentage: market.sharesYesPercentage || 0,

        // Status
        status,
        resolution: market.resolution || 'Unresolved',
        phase: market.phase || 'Prediction',
        timeLeft,
        expiryTime: market.expiryTime,
        isExpired,

        // Token info (if launched)
        tokenAddress: market.pumpFunTokenAddress || null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        projects: userProjects,
        total: userProjects.length,
      },
    });

  } catch (error: any) {
    logger.error('Failed to fetch user projects:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
