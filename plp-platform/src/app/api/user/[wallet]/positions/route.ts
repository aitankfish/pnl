/**
 * API endpoint for fetching user's active positions
 *
 * Returns all markets where the user has an active position
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import { COLLECTIONS, TradeHistory, PredictionMarket, Project } from '@/lib/database/models';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

interface UserPosition {
  marketId: string;
  marketName: string;
  marketAddress: string;
  voteType: 'yes' | 'no';
  totalAmount: number; // Total SOL staked
  totalShares: number; // Total shares held
  tradeCount: number; // Number of trades
  averagePrice: number; // Average price paid
  currentYesPrice: number;
  currentNoPrice: number;
  marketState: number;
  resolution?: string; // 'YesWins', 'NoWins', 'Refund', 'Unresolved'
  canClaim: boolean; // Can claim rewards (won and not yet claimed)
  isWinner: boolean; // Did the user win this position?
  claimed: boolean; // Has the user already claimed?
  expiryTime: Date;
  projectImageUrl?: string; // Add project image for display
  marketImage?: string; // Market/project image
  tokenSymbol?: string; // Token symbol for display
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ wallet: string }> }
) {
  try {
    const { wallet } = await params;

    logger.info('Fetching user positions', { wallet });

    // Connect to database
    await connectToDatabase();
    const db = await getDatabase();

    // Fetch all trades for this wallet
    console.log('[Positions API] Fetching trades for wallet:', wallet);
    console.log('[Positions API] Collection name:', COLLECTIONS.TRADE_HISTORY);
    const trades = await db
      .collection<TradeHistory>(COLLECTIONS.TRADE_HISTORY)
      .find({ traderWallet: wallet })
      .toArray();
    console.log('[Positions API] Found trades:', trades.length);

    // Group trades by market and vote type
    const positionMap = new Map<
      string,
      {
        marketId: string;
        voteType: 'yes' | 'no';
        amount: number;
        shares: number;
        count: number;
      }
    >();

    trades.forEach((trade) => {
      const key = `${trade.marketId.toString()}-${trade.voteType}`;
      const existing = positionMap.get(key) || {
        marketId: trade.marketId.toString(),
        voteType: trade.voteType,
        amount: 0,
        shares: 0,
        count: 0,
      };

      positionMap.set(key, {
        ...existing,
        amount: existing.amount + trade.amount,
        shares: existing.shares + trade.shares,
        count: existing.count + 1,
      });
    });

    // Fetch market details for all positions
    const marketIds = [...new Set(Array.from(positionMap.values()).map((p) => p.marketId))];
    console.log('[Positions API] Unique market IDs:', JSON.stringify(marketIds));
    console.log('[Positions API] Position map size:', positionMap.size);

    // Sample one trade to see structure
    if (trades.length > 0) {
      console.log('[Positions API] Sample trade marketId type:', typeof trades[0].marketId);
      console.log('[Positions API] Sample trade marketId value:', trades[0].marketId);
    }

    console.log('[Positions API] Fetching from collection:', COLLECTIONS.PREDICTION_MARKETS);

    // Check total markets in collection
    const totalMarkets = await db.collection<PredictionMarket>(COLLECTIONS.PREDICTION_MARKETS).countDocuments();
    console.log('[Positions API] Total markets in collection:', totalMarkets);

    const markets = await db
      .collection<PredictionMarket>(COLLECTIONS.PREDICTION_MARKETS)
      .find({
        _id: { $in: marketIds.map((id) => new (require('mongodb').ObjectId)(id)) },
      })
      .toArray();
    console.log('[Positions API] Found markets for user trades:', markets.length);

    // If no markets found, sample one market to see the ID format
    if (markets.length === 0 && totalMarkets > 0) {
      const sampleMarket = await db.collection<PredictionMarket>(COLLECTIONS.PREDICTION_MARKETS).findOne({});
      console.log('[Positions API] Sample market _id:', sampleMarket?._id);
    }

    // Create market map for quick lookup
    const marketMap = new Map(markets.map((m) => [m._id!.toString(), m]));

    // Fetch participant data to check claimed status
    const participants = await db
      .collection(COLLECTIONS.PREDICTION_PARTICIPANTS)
      .find({
        marketId: { $in: marketIds.map((id) => new (require('mongodb').ObjectId)(id)) },
        participantWallet: wallet,
      })
      .toArray();
    console.log('[Positions API] Found participants:', participants.length);

    // Create participant map for quick lookup (marketId -> participant)
    const participantMap = new Map(participants.map((p) => [p.marketId.toString(), p]));

    // Fetch project data for all markets
    const projectIds = [...new Set(markets.map((m) => m.projectId).filter(Boolean))];
    console.log('[Positions API] Fetching projects:', projectIds.length);

    const projects = await db
      .collection<Project>(COLLECTIONS.PROJECTS)
      .find({
        _id: { $in: projectIds.map((id) => new (require('mongodb').ObjectId)(id)) },
      })
      .toArray();
    console.log('[Positions API] Found projects:', projects.length);

    // Create project map for quick lookup
    const projectMap = new Map(projects.map((p) => [p._id!.toString(), p]));

    // Helper function to convert IPFS URL to gateway URL
    const convertToGatewayUrl = (imageUrl: string | undefined): string | undefined => {
      if (!imageUrl) return undefined;

      const gatewayUrl = process.env.PINATA_GATEWAY_URL;
      if (!gatewayUrl) return imageUrl.startsWith('http') ? imageUrl : undefined;

      if (imageUrl.startsWith('ipfs://')) {
        const ipfsHash = imageUrl.replace('ipfs://', '');
        return `https://${gatewayUrl}/ipfs/${ipfsHash}`;
      }

      if (imageUrl.startsWith('http')) {
        return imageUrl;
      }

      return `https://${gatewayUrl}/ipfs/${imageUrl}`;
    };

    // Build position list with market details
    const positions: UserPosition[] = Array.from(positionMap.values())
      .map((position) => {
        const market = marketMap.get(position.marketId);
        if (!market) return null;

        // Calculate current probability
        const totalYes = market.totalYesStake / 1_000_000_000;
        const totalNo = market.totalNoStake / 1_000_000_000;
        const total = totalYes + totalNo;
        const yesPrice = total > 0 ? (totalYes / total) * 100 : 50;
        const noPrice = 100 - yesPrice;

        // Get project for image
        const project = projectMap.get(market.projectId?.toString() || '');
        const projectImageUrl = convertToGatewayUrl(project?.projectImageUrl);

        // Get participant data for claimed status
        const participant = participantMap.get(position.marketId);
        const claimed = participant?.claimed === true;

        // Determine if user won based on resolution and their vote type
        const resolution = market.resolution || 'Unresolved';
        const isResolved = market.marketState === 1 || resolution !== 'Unresolved';

        // User wins if:
        // - YesWins and they voted YES
        // - NoWins and they voted NO
        // - Refund (everyone can claim refund)
        const isWinner =
          (resolution === 'YesWins' && position.voteType === 'yes') ||
          (resolution === 'NoWins' && position.voteType === 'no') ||
          resolution === 'Refund';

        // Can claim if resolved, user is a winner, AND hasn't claimed yet
        const canClaim = isResolved && isWinner && !claimed;

        return {
          marketId: position.marketId,
          marketName: market.marketName,
          marketAddress: market.marketAddress,
          voteType: position.voteType,
          totalAmount: position.amount / 1_000_000_000, // Convert to SOL
          totalShares: position.shares,
          tradeCount: position.count,
          averagePrice:
            position.voteType === 'yes'
              ? (position.amount / position.shares / 1_000_000_000) * 100
              : (position.amount / position.shares / 1_000_000_000) * 100,
          currentYesPrice: yesPrice,
          currentNoPrice: noPrice,
          marketState: market.marketState,
          resolution,
          canClaim,
          isWinner,
          claimed,
          expiryTime: market.expiryTime,
          projectImageUrl,
          marketImage: projectImageUrl,
          tokenSymbol: project?.tokenSymbol || market.tokenSymbol || 'TKN',
        };
      })
      .filter((p): p is UserPosition => p !== null);

    // Separate active and resolved positions
    const activePositions = positions.filter((p) => p.marketState === 0);
    const resolvedPositions = positions.filter((p) => p.marketState === 1);
    const claimablePositions = positions.filter((p) => p.canClaim);

    logger.info('User positions fetched', {
      wallet,
      totalPositions: positions.length,
      activePositions: activePositions.length,
      resolvedPositions: resolvedPositions.length,
      claimablePositions: claimablePositions.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        all: positions,
        active: activePositions,
        resolved: resolvedPositions,
        claimable: claimablePositions,
      },
    });
  } catch (error) {
    logger.error('Failed to fetch user positions:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch user positions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
