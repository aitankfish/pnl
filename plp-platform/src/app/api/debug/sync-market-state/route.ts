/**
 * Debug endpoint to force re-sync a market's state from blockchain
 * This reads the on-chain market account and updates MongoDB to match
 */

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getSolanaConnection } from '@/lib/solana';
import { connectToDatabase, PredictionMarket } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';
import { parseMarketAccount } from '@/services/blockchain-sync/account-parser';

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

    // Fetch on-chain market account using raw RPC + manual parsing (avoids IDL discriminator issues)
    const connection = await getSolanaConnection(targetNetwork);
    const marketPubkey = new PublicKey(marketAddress);

    let marketAccount: ReturnType<typeof parseMarketAccount> | null = null;
    try {
      const accountInfo = await connection.getAccountInfo(marketPubkey);
      if (!accountInfo || !accountInfo.data) {
        throw new Error('Account not found or has no data');
      }
      const base64Data = accountInfo.data.toString('base64');
      marketAccount = parseMarketAccount(base64Data);
    } catch (fetchError) {
      logger.error('Failed to fetch market account:', {
        error: fetchError instanceof Error ? fetchError.message : String(fetchError)
      });
      return NextResponse.json(
        { success: false, error: 'Market account not found on-chain or failed to decode' },
        { status: 404 }
      );
    }

    // parseMarketAccount returns resolution as number: 0=Unresolved, 1=YesWins, 2=NoWins, 3=Refund
    const resolutionMap = ['Unresolved', 'YesWins', 'NoWins', 'Refund'];
    const resolution = resolutionMap[marketAccount.resolution] || 'Unresolved';

    // parseMarketAccount returns phase as number: 0=Prediction, 1=Funding
    const phaseMap = ['prediction', 'funding'];
    const phaseKey = phaseMap[marketAccount.phase] || 'prediction';

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
    // parseMarketAccount returns bigint fields as strings already
    const updateData: any = {
      resolution,
      phase: phaseKey,
      poolBalance: marketAccount.poolBalance,
      totalYesShares: marketAccount.totalYesShares,
      totalNoShares: marketAccount.totalNoShares,
      updatedAt: new Date(),
    };

    // If resolved, mark as resolved
    if (resolution !== 'Unresolved') {
      updateData.resolvedAt = updateData.resolvedAt || new Date();
    }

    // If token mint provided or exists on-chain, save it
    // parseMarketAccount returns tokenMint as string (already base58) or null
    if (tokenMint) {
      updateData.pumpFunTokenAddress = tokenMint;
    } else if (marketAccount.tokenMint) {
      updateData.pumpFunTokenAddress = marketAccount.tokenMint;
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
          poolBalance: marketAccount.poolBalance,
          totalYesShares: marketAccount.totalYesShares,
          totalNoShares: marketAccount.totalNoShares,
          tokenMint: marketAccount.tokenMint || null,
        },
        mongodb: {
          previousResolution: market.resolution,
          newResolution: resolution,
          pumpFunTokenAddress: updateData.pumpFunTokenAddress || null,
        },
      }
    });

  } catch (error) {
    logger.error('Failed to sync market state:', {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
