/**
 * GET /api/user/[wallet]/creator-fees
 * Fetch claimable creator fees from pump.fun for tokens launched by this user
 *
 * Creator fees accumulate in a vault PDA on pump.fun whenever trades happen
 * on tokens created by this user. This endpoint fetches the real-time balance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { connectToDatabase, Project, PredictionMarket } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';
import { RPC_ENDPOINT } from '@/config/solana';
import { creatorVaultPda, PUMP_PROGRAM_ID } from '@pump-fun/pump-sdk';
import { getRedisClient, prefixKey } from '@/lib/redis/client';

export const dynamic = 'force-dynamic';

const logger = createClientLogger();

// Vault balances change rarely (only on trades against launched tokens or on claim).
// Cache for 5 minutes to avoid one Solana RPC call per page load per founder.
const VAULT_BALANCE_TTL_SECONDS = 300;

// Separately cache "this wallet has no launched tokens" to avoid running the $lookup
// aggregation on every page load for 99% of users who have never launched anything.
const NO_LAUNCHED_TOKENS_TTL_SECONDS = 3600; // 1 hour — invalidated on launch success

interface LaunchedToken {
  marketId: string;
  name: string;
  symbol: string;
  tokenAddress: string;
  imageUrl?: string;
}

interface CreatorFeeInfo {
  token: LaunchedToken;
  claimableAmount: number; // in SOL
  claimableLamports: string; // raw lamports as string for precision
  creatorVaultAddress: string;
}

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

    // Validate wallet address
    let walletPubkey: PublicKey;
    try {
      walletPubkey = new PublicKey(wallet);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    // Early-return check — is this wallet known to have NO launched tokens?
    // Most users will never launch; we cache this negative result so we skip the
    // expensive $lookup aggregation on every page load for them.
    const redis = (() => { try { return getRedisClient(); } catch { return null; } })();
    const noTokensKey = prefixKey(`creator-fees:none:${wallet}`);
    if (redis) {
      try {
        const sentinel = await redis.get(noTokensKey);
        if (sentinel === '1') {
          return NextResponse.json({
            success: true,
            data: {
              tokens: [],
              totalClaimable: 0,
              totalClaimableLamports: '0',
              cached: true,
            },
          });
        }
      } catch (err) {
        // Non-fatal — fall through to DB path
        logger.warn('[creator-fees] redis sentinel read failed', { err });
      }
    }

    await connectToDatabase();

    // Find all launched tokens where this user is the founder
    const projectsWithLaunchedTokens = await Project.aggregate([
      { $match: { founderWallet: wallet } },
      {
        $lookup: {
          from: 'predictionmarkets',
          localField: '_id',
          foreignField: 'projectId',
          as: 'market',
        },
      },
      { $unwind: { path: '$market', preserveNullAndEmptyArrays: false } },
      // Only include launched tokens (YesWins resolution with token address)
      {
        $match: {
          'market.resolution': 'YesWins',
          'market.pumpFunTokenAddress': { $exists: true, $ne: null },
        },
      },
    ]);

    if (projectsWithLaunchedTokens.length === 0) {
      logger.info('No launched tokens found for creator', { wallet });
      // Cache this negative result so future page loads for this wallet skip the
      // aggregation. Invalidated when the user successfully launches a token.
      if (redis) {
        try {
          await redis.set(noTokensKey, '1', 'EX', NO_LAUNCHED_TOKENS_TTL_SECONDS);
        } catch (err) {
          logger.warn('[creator-fees] redis sentinel write failed', { err });
        }
      }
      return NextResponse.json({
        success: true,
        data: {
          tokens: [],
          totalClaimable: 0,
          totalClaimableLamports: '0',
        },
      });
    }

    // Get creator vault PDA for this wallet
    const creatorVault = creatorVaultPda(walletPubkey);
    const vaultCacheKey = prefixKey(`creator-fees:vault:${creatorVault.toBase58()}`);

    // Try cache first (vault balances change rarely, ~5min TTL is safe)
    let totalClaimableLamports = BigInt(0);
    let vaultCached = false;
    if (redis) {
      try {
        const cached = await redis.get(vaultCacheKey);
        if (cached) {
          totalClaimableLamports = BigInt(cached);
          vaultCached = true;
        }
      } catch (err) {
        logger.warn('[creator-fees] redis vault read failed', { err });
      }
    }

    // Cache miss — query RPC and write result
    if (!vaultCached) {
      try {
        const connection = new Connection(RPC_ENDPOINT, 'confirmed');
        const vaultBalance = await connection.getBalance(creatorVault);
        totalClaimableLamports = BigInt(vaultBalance);

        logger.info('Fetched creator vault balance (RPC)', {
          wallet,
          creatorVault: creatorVault.toBase58(),
          balance: vaultBalance,
          balanceSOL: vaultBalance / LAMPORTS_PER_SOL,
        });

        if (redis) {
          try {
            await redis.set(
              vaultCacheKey,
              totalClaimableLamports.toString(),
              'EX',
              VAULT_BALANCE_TTL_SECONDS,
            );
          } catch (err) {
            logger.warn('[creator-fees] redis vault write failed', { err });
          }
        }
      } catch (error) {
        logger.warn('Failed to fetch creator vault balance', { wallet, error });
        // Continue with 0 balance
      }
    }

    // Build response with token info
    const tokens: CreatorFeeInfo[] = projectsWithLaunchedTokens.map((item: any) => {
      const project = item;
      const market = item.market;

      return {
        token: {
          marketId: market._id.toString(),
          name: project.name || 'Unknown Token',
          symbol: project.tokenSymbol || 'TKN',
          tokenAddress: market.pumpFunTokenAddress,
          imageUrl: project.projectImageUrl,
        },
        // Note: Individual token fee breakdown is not available from pump.fun
        // The creator vault holds total fees for all tokens by this creator
        claimableAmount: 0, // Individual amounts not tracked
        claimableLamports: '0',
        creatorVaultAddress: creatorVault.toBase58(),
      };
    });

    const totalClaimable = Number(totalClaimableLamports) / LAMPORTS_PER_SOL;

    return NextResponse.json({
      success: true,
      data: {
        tokens,
        totalClaimable,
        totalClaimableLamports: totalClaimableLamports.toString(),
        creatorVaultAddress: creatorVault.toBase58(),
        tokenCount: tokens.length,
      },
    });
  } catch (error: any) {
    logger.error('Failed to fetch creator fees:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch creator fees' },
      { status: 500 }
    );
  }
}
