// POST /api/mcp/markets/complete-claim
//
// Step 2 of the MCP autosign claim flow. After the MCP signs + sends
// the claim_rewards tx, this endpoint:
//   1. Sig-auth verifies the wallet over `pnl-mcp:complete-claim:<txSig>:<nonce>`
//   2. Verifies on-chain: tx exists, succeeded, invokes the PNL program,
//      first signer == walletAddress
//   3. Marks the PredictionParticipant as claimed in MongoDB
//   4. Invalidates position caches
//
// Idempotent: re-running with the same tx signature returns success
// without double-update (we only `$set` claimed/positionClosed; safe).

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, PredictionParticipant } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { createClientLogger } from '@/lib/logger';
import { invalidateCache } from '@/lib/redis/invalidate';
import { verifyMcpSignature, challenge, signedRequestHash } from '@/lib/mcp-auth';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { getSolanaConnection } from '@/lib/solana';
import { getProgramIdForNetwork } from '@/lib/anchor-program';
import { SOLANA_NETWORK } from '@/config/solana';

export const dynamic = 'force-dynamic';

const logger = createClientLogger();

interface CompleteClaimBody {
  walletAddress?: string;
  nonce?: string;
  signature?: string;
  txSignature?: string;
  marketId?: string;
  claimAmount?: number; // SOL — best-effort metadata
}

async function verifyTxOnChain(
  signature: string,
  expectedSigner: string,
): Promise<{ ok: true } | { ok: false; status: 400 | 404 | 502; reason: string }> {
  let connection;
  try {
    connection = await getSolanaConnection(SOLANA_NETWORK);
  } catch (e) {
    logger.error('[mcp/complete-claim] Solana connection failed', {
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
      logger.warn('[mcp/complete-claim] getTransaction threw', {
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
    const limited = checkRateLimit(`mcp-complete-claim:${ip}`, 30, 60_000);
    if (limited) return limited;

    const body = (await request.json()) as CompleteClaimBody;

    if (!body.walletAddress || !body.nonce || !body.signature) {
      return NextResponse.json(
        { success: false, error: 'walletAddress, nonce, and signature are required' },
        { status: 400 },
      );
    }
    if (!body.txSignature || !body.marketId) {
      return NextResponse.json(
        { success: false, error: 'txSignature and marketId are required' },
        { status: 400 },
      );
    }

    const payloadHash = signedRequestHash(body as unknown as Record<string, unknown>);
    const challengeStr = challenge('complete-claim', body.txSignature, body.nonce, payloadHash);
    const verified = verifyMcpSignature(
      { walletAddress: body.walletAddress, nonce: body.nonce, signature: body.signature },
      challengeStr,
    );
    if (!verified.ok) {
      return NextResponse.json({ success: false, error: verified.reason }, { status: verified.status });
    }

    const chainCheck = await verifyTxOnChain(body.txSignature, body.walletAddress);
    if (!chainCheck.ok) {
      return NextResponse.json({ success: false, error: chainCheck.reason }, { status: chainCheck.status });
    }

    await connectToDatabase();

    // Mark participant as claimed. We `$set` (not `$inc`), so retries
    // with the same tx signature converge on the same state.
    const update = await PredictionParticipant.updateOne(
      { marketId: new ObjectId(body.marketId), participantWallet: body.walletAddress },
      {
        $set: {
          claimed: true,
          positionClosed: true,
          solRewarded: body.claimAmount ?? 0,
          lastSyncedAt: new Date(),
        },
      },
    );

    if (update.matchedCount === 0) {
      // Could be a tx-but-no-participant case (e.g. user never voted via
      // PNL UI but had an on-chain position). Don't fail — the on-chain
      // claim succeeded; that's the source of truth.
      logger.warn('[mcp/complete-claim] no participant row matched', {
        marketId: body.marketId,
        walletAddress: body.walletAddress,
      });
    }

    await invalidateCache(
      `markets:position:${body.marketId}:${body.walletAddress}`,
      `positions:${body.walletAddress}`,
    );

    logger.info('[mcp/complete-claim] persisted', {
      walletAddress: body.walletAddress,
      marketId: body.marketId,
      txSignature: body.txSignature,
      claimAmount: body.claimAmount,
    });

    return NextResponse.json({
      success: true,
      data: {
        marketId: body.marketId,
        txSignature: body.txSignature,
        solscan: `https://solscan.io/tx/${body.txSignature}`,
        claimAmount: body.claimAmount,
        participantMatched: update.matchedCount > 0,
      },
    });
  } catch (error) {
    logger.error('[mcp/complete-claim] failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        success: false,
        error: 'internal',
        stack: process.env.NODE_ENV !== 'production' && error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
