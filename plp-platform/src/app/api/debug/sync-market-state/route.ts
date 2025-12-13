/**
 * Debug endpoint to force re-sync a market's state from blockchain
 * This reads the on-chain market account and updates MongoDB to match
 */

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getSolanaConnection } from '@/lib/solana';
import { connectToDatabase, PredictionMarket } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';
import { getProgram } from '@/lib/anchor-program';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketAddress, network, tokenMint, forceUpdate } = body;

    if (!marketAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing marketAddress' },
        { status: 400 }
      );
    }

    // Determine network (default to mainnet)
    const targetNetwork = (network as 'devnet' | 'mainnet-beta') || 'mainnet-beta';

    logger.info('Syncing market state from blockchain...', { marketAddress, network: targetNetwork });

    // Fetch on-chain market account using Anchor
    const program = getProgram(undefined, targetNetwork);
    const marketPubkey = new PublicKey(marketAddress);

    let marketAccount: any = null;
    try {
      marketAccount = await program.account.market.fetch(marketPubkey);
    } catch (fetchError) {
      logger.error('Failed to fetch market account:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Market account not found on-chain or failed to decode' },
        { status: 404 }
      );
    }

    // Parse resolution from Anchor enum format
    const resolutionKey = Object.keys(marketAccount.resolution)[0];
    let resolution = 'Unresolved';
    if (resolutionKey === 'yesWins') resolution = 'YesWins';
    else if (resolutionKey === 'noWins') resolution = 'NoWins';
    else if (resolutionKey === 'refund') resolution = 'Refund';

    // Parse phase from Anchor enum format
    const phaseKey = Object.keys(marketAccount.phase)[0];

    // Connect to MongoDB
    await connectToDatabase();

    // Find market in MongoDB
    const market = await PredictionMarket.findOne({ marketAddress });

    if (!market) {
      return NextResponse.json(
        { success: false, error: 'Market not found in MongoDB' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {
      resolution,
      phase: phaseKey,
      poolBalance: marketAccount.poolBalance?.toString(),
      totalYesShares: marketAccount.totalYesShares?.toString(),
      totalNoShares: marketAccount.totalNoShares?.toString(),
      updatedAt: new Date(),
    };

    // If resolved, mark as resolved
    if (resolution !== 'Unresolved') {
      updateData.resolvedAt = updateData.resolvedAt || new Date();
    }

    // If token mint provided or exists on-chain, save it
    if (tokenMint) {
      updateData.pumpFunTokenAddress = tokenMint;
    } else if (marketAccount.tokenMint) {
      updateData.pumpFunTokenAddress = marketAccount.tokenMint.toBase58();
    }

    // Only update if forceUpdate is true or resolution changed
    const shouldUpdate = forceUpdate || market.resolution !== resolution;

    if (shouldUpdate) {
      await PredictionMarket.updateOne(
        { marketAddress },
        { $set: updateData }
      );
      logger.info('Market state synced from blockchain', {
        marketAddress,
        oldResolution: market.resolution,
        newResolution: resolution,
        tokenMint: updateData.pumpFunTokenAddress,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        marketAddress,
        updated: shouldUpdate,
        onChain: {
          resolution,
          phase: phaseKey,
          poolBalance: marketAccount.poolBalance?.toString(),
          totalYesShares: marketAccount.totalYesShares?.toString(),
          totalNoShares: marketAccount.totalNoShares?.toString(),
          tokenMint: marketAccount.tokenMint?.toBase58() || null,
        },
        mongodb: {
          previousResolution: market.resolution,
          newResolution: resolution,
          pumpFunTokenAddress: updateData.pumpFunTokenAddress || null,
        },
      }
    });

  } catch (error) {
    logger.error('Failed to sync market state:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
