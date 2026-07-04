// POST /api/mcp/markets/complete-vote
//
// Step 2 of the MCP autosign vote flow. After the MCP signs + sends a
// buy_yes / buy_no tx, it calls this endpoint to:
//   1. verify the tx on-chain (signer, program, success)
//   2. write the TradeHistory record (Helius doesn't index everything)
//   3. upsert the PredictionParticipant record so vote counts reflect
//      the new stake before the sync manager catches up
//   4. broadcast the count update via socket
//   5. invalidate position caches
//
// Auth: signature-auth (challenge = `pnl-mcp:complete-vote:<txSig>:<nonce>`).
// Idempotent on the tx signature — replays return success without
// double-counting.

import { NextRequest, NextResponse } from 'next/server';
import {
  connectToDatabase as connectMongoose,
  PredictionMarket,
  PredictionParticipant,
} from '@/lib/mongodb';
import { connectToDatabase, getDatabase } from '@/lib/database/index';
import { COLLECTIONS, TradeHistory } from '@/lib/database/models';
import { createClientLogger } from '@/lib/logger';
import { updateMarketVoteCounts } from '@/lib/vote-counts';
import { broadcastMarketUpdate } from '@/services/socket/socket-server';
import { getSolanaConnection } from '@/lib/solana';
import { getProgramIdForNetwork } from '@/lib/anchor-program';
import { SOLANA_NETWORK } from '@/config/solana';
import { invalidateCache } from '@/lib/redis/invalidate';
import { verifyMcpSignature, challenge, signedRequestHash } from '@/lib/mcp-auth';
import { apiError, apiErrorForStatus } from '@/lib/api-error';
import { checkRateLimit } from '@/lib/auth/rate-limit';

export const dynamic = 'force-dynamic';

const logger = createClientLogger();

interface CompleteVoteBody {
  walletAddress?: string;
  nonce?: string;
  signature?: string;
  txSignature?: string;
  marketId?: string;
  voteType?: 'yes' | 'no';
  amountSol?: number;
}

async function verifyTxOnChain(
  signature: string,
  expectedSigner: string,
): Promise<{ ok: true } | { ok: false; status: 400 | 404 | 502; reason: string }> {
  let connection;
  try {
    connection = await getSolanaConnection(SOLANA_NETWORK);
  } catch (e) {
    logger.error('[mcp/complete-vote] failed to open Solana connection', {
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, status: 502, reason: 'unable to reach Solana RPC' };
  }

  let tx = null;
  for (let attempt = 0; attempt < 3 && tx == null; attempt++) {
    try {
      tx = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
    } catch (e) {
      logger.warn('[mcp/complete-vote] getTransaction threw', {
        attempt,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    if (tx == null && attempt < 2) await new Promise((r) => setTimeout(r, 1500));
  }
  if (tx == null) return { ok: false, status: 404, reason: 'transaction not found on-chain' };
  if (tx.meta?.err) {
    return { ok: false, status: 400, reason: `transaction failed on-chain: ${JSON.stringify(tx.meta.err)}` };
  }

  const accountKeys = tx.transaction.message.getAccountKeys();
  const programId = getProgramIdForNetwork(SOLANA_NETWORK as 'mainnet-beta' | 'devnet').toBase58();
  const programInvolved = accountKeys.staticAccountKeys.some((k) => k.toBase58() === programId);
  if (!programInvolved) return { ok: false, status: 400, reason: 'transaction does not invoke the PNL program' };

  const signer = accountKeys.staticAccountKeys[0]?.toBase58();
  if (signer !== expectedSigner) {
    return { ok: false, status: 400, reason: 'transaction signer does not match walletAddress' };
  }
  return { ok: true };
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limited = await checkRateLimit(`mcp-complete-vote:${ip}`, 30, 60_000);
    if (limited) return limited;

    const body = (await request.json()) as CompleteVoteBody;
    if (!body.walletAddress || !body.nonce || !body.signature) {
      return apiError('BAD_REQUEST', 'walletAddress, nonce, and signature are required');
    }
    if (!body.txSignature || !body.marketId || !body.voteType || !body.amountSol) {
      return apiError('BAD_REQUEST', 'txSignature, marketId, voteType, and amountSol are required');
    }
    if (body.voteType !== 'yes' && body.voteType !== 'no') {
      return apiError('BAD_REQUEST', "voteType must be 'yes' or 'no'");
    }

    // Signature verification first — cheap. Payload-bound: the sig
    // covers voteType + amountSol + marketId so an attacker cannot
    // rewrite the side or amount on the persisted trade row given a
    // captured sig.
    const payloadHash = signedRequestHash(body as unknown as Record<string, unknown>);
    const challengeStr = challenge('complete-vote', body.txSignature, body.nonce, payloadHash);
    const verified = verifyMcpSignature(
      { walletAddress: body.walletAddress, nonce: body.nonce, signature: body.signature },
      challengeStr,
    );
    if (!verified.ok) {
      return apiErrorForStatus(verified.status, verified.reason);
    }

    // On-chain verification.
    const chainCheck = await verifyTxOnChain(body.txSignature, body.walletAddress);
    if (!chainCheck.ok) {
      return apiErrorForStatus(chainCheck.status, chainCheck.reason);
    }

    await connectMongoose();
    await connectToDatabase();

    // Idempotency on tx signature.
    const db = getDatabase();
    const existing = await db.collection(COLLECTIONS.TRADE_HISTORY).findOne({ signature: body.txSignature });
    if (existing) {
      return NextResponse.json({
        success: true,
        data: {
          marketId: body.marketId,
          txSignature: body.txSignature,
          alreadyExists: true,
          message: 'vote already recorded',
        },
      });
    }

    const market = await PredictionMarket.findById(body.marketId);
    if (!market) {
      return NextResponse.json({ success: false, error: 'market not found' }, { status: 404 });
    }

    const lamports = Math.floor(body.amountSol * 1_000_000_000);

    // TradeHistory record.
    const totalStake = (market.totalYesStake ?? 0) + (market.totalNoStake ?? 0);
    const yesPrice = totalStake > 0 ? ((market.totalYesStake ?? 0) / totalStake) * 100 : 50;
    const noPrice = totalStake > 0 ? ((market.totalNoStake ?? 0) / totalStake) * 100 : 50;
    const tradeRecord: TradeHistory = {
      marketId: market._id,
      marketAddress: market.marketAddress,
      traderWallet: body.walletAddress,
      voteType: body.voteType,
      amount: lamports,
      shares: lamports,
      yesPrice,
      noPrice,
      signature: body.txSignature,
      createdAt: new Date(),
    };
    try {
      await db.collection(COLLECTIONS.TRADE_HISTORY).insertOne(tradeRecord);
    } catch (e: any) {
      // E11000 = race-loser: a concurrent /complete-vote request with the
      // same signature already wrote the trade. Reject as already-processed
      // so we don't double-count via the participant upsert below.
      if (e?.code === 11000) {
        return NextResponse.json(
          { success: false, error: 'Transaction already processed' },
          { status: 409 },
        );
      }
      logger.error('[mcp/complete-vote] trade insert failed (non-fatal)', {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // PredictionParticipant upsert.
    try {
      const existingParticipant = await PredictionParticipant.findOne({
        marketId: market._id,
        participantWallet: body.walletAddress,
      });
      if (existingParticipant) {
        const cYes = BigInt(existingParticipant.yesShares || '0');
        const cNo = BigInt(existingParticipant.noShares || '0');
        const cInv = BigInt(existingParticipant.totalInvested || '0');
        if (body.voteType === 'yes') {
          existingParticipant.yesShares = (cYes + BigInt(lamports)).toString();
        } else {
          existingParticipant.noShares = (cNo + BigInt(lamports)).toString();
        }
        existingParticipant.totalInvested = (cInv + BigInt(lamports)).toString();
        await existingParticipant.save();
      } else {
        await PredictionParticipant.create({
          marketId: market._id,
          participantWallet: body.walletAddress,
          voteOption: body.voteType === 'yes',
          stakeAmount: lamports,
          voteCost: lamports,
          yesShares: body.voteType === 'yes' ? lamports.toString() : '0',
          noShares: body.voteType === 'no' ? lamports.toString() : '0',
          totalInvested: lamports.toString(),
        });
      }
    } catch (e) {
      logger.error('[mcp/complete-vote] participant upsert failed (non-fatal)', {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Vote-count update + broadcast.
    try {
      const counts = await updateMarketVoteCounts(body.marketId);
      broadcastMarketUpdate(market.marketAddress, {
        yesVotes: counts.yesVoteCount,
        noVotes: counts.noVoteCount,
      });
    } catch (e) {
      logger.warn('[mcp/complete-vote] count update failed (non-fatal)', {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    await invalidateCache(
      `markets:position:${body.marketId}:${body.walletAddress}`,
      `positions:${body.walletAddress}`,
      `profile-counts:${body.walletAddress}`,
    );

    logger.info('[mcp/complete-vote] persisted', {
      walletAddress: body.walletAddress,
      marketId: body.marketId,
      txSignature: body.txSignature,
      voteType: body.voteType,
      amountSol: body.amountSol,
    });

    return NextResponse.json({
      success: true,
      data: {
        marketId: body.marketId,
        marketAddress: market.marketAddress,
        txSignature: body.txSignature,
        solscan: `https://solscan.io/tx/${body.txSignature}`,
        voteType: body.voteType,
        amountSol: body.amountSol,
      },
    });
  } catch (error) {
    logger.error('[mcp/complete-vote] failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return apiError('INTERNAL', 'internal', {
      details: process.env.NODE_ENV !== 'production' && error instanceof Error ? error.stack : undefined,
    });
  }
}
