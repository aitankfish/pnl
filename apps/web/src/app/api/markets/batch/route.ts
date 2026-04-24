/**
 * GET /api/markets/batch?ids=<id1>,<id2>,<id3>
 *
 * Compact batch fetch for watchlist cards and similar N+1 patterns. Instead of
 * each <FavoriteMarketCard> hitting /api/markets/{id} with its own aggregation,
 * the parent fetches everything in ONE query via $in match.
 *
 * Returns ONLY the fields watchlist cards need (marketAddress, name, image,
 * resolution, expiryTime) — not the full market detail payload.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionMarket } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const logger = createClientLogger();

const MAX_IDS_PER_REQUEST = 40;

function isValidObjectId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

export async function GET(request: NextRequest) {
  try {
    const idsParam = request.nextUrl.searchParams.get('ids');
    if (!idsParam) {
      return NextResponse.json({ success: false, error: 'ids query param required' }, { status: 400 });
    }

    const ids = idsParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: { markets: {} } });
    }

    if (ids.length > MAX_IDS_PER_REQUEST) {
      return NextResponse.json(
        { success: false, error: `too many ids (max ${MAX_IDS_PER_REQUEST})` },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const mongoose = await import('mongoose');

    // Split ids into ObjectIds and marketAddresses so we can match either
    const objectIds: any[] = [];
    const marketAddresses: string[] = [];
    for (const id of ids) {
      if (isValidObjectId(id)) objectIds.push(new mongoose.Types.ObjectId(id));
      else marketAddresses.push(id);
    }

    const matchQuery: any = { $or: [] };
    if (objectIds.length) matchQuery.$or.push({ _id: { $in: objectIds } });
    if (marketAddresses.length) matchQuery.$or.push({ marketAddress: { $in: marketAddresses } });

    const rows = await PredictionMarket.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'projects',
          localField: 'projectId',
          foreignField: '_id',
          as: 'project',
        },
      },
      { $unwind: { path: '$project', preserveNullAndEmptyArrays: true } },
      // Compact projection — just what cards display
      {
        $project: {
          _id: 1,
          marketAddress: 1,
          resolution: 1,
          expiryTime: 1,
          targetPool: 1,
          totalYesStake: 1,
          totalNoStake: 1,
          totalYesShares: 1,
          totalNoShares: 1,
          yesVoteCount: 1,
          noVoteCount: 1,
          name: '$project.name',
          projectImageUrl: '$project.projectImageUrl',
          tokenSymbol: '$project.tokenSymbol',
        },
      },
    ]);

    // Build a map keyed by BOTH _id string and marketAddress so the caller
    // can look up by whichever identifier it has.
    const markets: Record<string, any> = {};
    const gatewayUrl = process.env.PINATA_GATEWAY_URL;

    for (const row of rows) {
      // Convert IPFS hash → HTTP gateway URL if possible
      let image = row.projectImageUrl;
      if (image && gatewayUrl) {
        if (image.startsWith('ipfs://')) {
          image = `https://${gatewayUrl}/ipfs/${image.replace('ipfs://', '')}`;
        } else if (!image.startsWith('http')) {
          image = `https://${gatewayUrl}/ipfs/${image}`;
        }
      }

      // Derived metrics for cards (saves client from doing the math)
      const totalYesStake = Number(row.totalYesStake || 0);
      const totalNoStake = Number(row.totalNoStake || 0);
      const poolBalance = totalYesStake + totalNoStake;
      const targetPool = Number(row.targetPool || 0);
      const poolProgressPercentage =
        targetPool > 0 ? Math.min(100, (poolBalance / targetPool) * 100) : 0;
      const totalYesShares = Number(row.totalYesShares || 0);
      const totalNoShares = Number(row.totalNoShares || 0);
      const totalShares = totalYesShares + totalNoShares;
      const sharesYesPercentage = totalShares > 0 ? (totalYesShares / totalShares) * 100 : 50;

      const summary = {
        marketId: row._id.toString(),
        marketAddress: row.marketAddress,
        name: row.name || 'Untitled market',
        image,
        resolution: row.resolution || null,
        expiryTime: row.expiryTime,
        tokenSymbol: row.tokenSymbol || null,
        totalYesStake,
        totalNoStake,
        poolBalance,
        targetPool,
        poolProgressPercentage,
        sharesYesPercentage,
        yesVoteCount: Number(row.yesVoteCount || 0),
        noVoteCount: Number(row.noVoteCount || 0),
      };

      // Index by both identifiers so any caller can find their market
      markets[row._id.toString()] = summary;
      if (row.marketAddress) markets[row.marketAddress] = summary;
    }

    return NextResponse.json({
      success: true,
      data: { markets, requestedCount: ids.length, foundCount: rows.length },
    });
  } catch (err: any) {
    logger.error('[markets/batch] failed', { error: err?.message });
    return NextResponse.json(
      { success: false, error: err?.message || 'batch fetch failed' },
      { status: 500 },
    );
  }
}
