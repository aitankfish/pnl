// POST /api/mcp/markets/complete-create
//
// Step 2 of the MCP autosign create_market flow. After the MCP signs +
// sends the unsigned tx built by /api/mcp/markets/build-create-tx, it
// calls this endpoint to persist the Project + PredictionMarket docs
// and kick off the sync manager + broadcast.
//
// Auth model: signature-auth. The MCP signs a canonical challenge
// (`pnl-mcp:complete-create:<txSignature>:<nonce>`) with the local
// keypair. We verify the signature is good for the claimed
// walletAddress (see mcp-auth.ts), then verify on-chain that the same
// wallet was the signer of `txSignature` — that's what makes this
// safe to call without a Privy session.
//
// On-chain verification: we fetch the tx via the configured RPC,
// confirm it succeeded, that our program was invoked, and that the
// first signer == walletAddress. If any of those fail we refuse to
// persist.
//
// Idempotency: if a PredictionMarket with the same marketAddress
// already exists we return its id rather than failing — covers the
// case where complete-create is retried after the on-chain tx already
// landed.

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, Project, PredictionMarket } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';
import { getSyncManager } from '@/services/blockchain-sync/sync-manager';
import { tweetMarketCreated } from '@/services/twitter/twitter-service';
import { broadcastNewMarket } from '@/services/socket/socket-server';
import { invalidateCache } from '@/lib/redis/invalidate';
import { ensureUserProfile } from '@/lib/user-profile-init';
import { verifyMcpSignature, challenge, signedRequestHash } from '@/lib/mcp-auth';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { getSolanaConnection } from '@/lib/solana';
import { getProgramIdForNetwork } from '@/lib/anchor-program';
import { SOLANA_NETWORK } from '@/config/solana';

export const dynamic = 'force-dynamic';

const logger = createClientLogger();

interface CompleteCreateBody {
  walletAddress?: string;
  nonce?: string;
  signature?: string; // base58 ed25519 signature

  // tx outcome
  txSignature?: string;
  marketAddress?: string;
  ipfsCid?: string;
  metadataUri?: string;

  // project payload (same shape build-create-tx received, minus
  // walletAddress which we already have)
  payload?: {
    name?: string;
    description?: string;
    category?: string;
    projectType?: string;
    projectStage?: string;
    tokenSymbol?: string;
    teamSize?: number;
    targetPoolSol?: number;
    durationDays?: number;
    location?: string;
    projectImageUrl?: string;
    pitchVideoUrl?: string;
    socialLinks?: Record<string, string>;
    additionalNotes?: string;
  };

  // optional: provenance for "born in claude code" UI thread
  provenance?: Record<string, unknown>;

  // on-chain tx outputs from build-create-tx
  targetPool?: number; // lamports
  expiryTime?: number; // unix seconds
}

async function verifyTxOnChain(
  signature: string,
  expectedSigner: string,
): Promise<{ ok: true } | { ok: false; status: 400 | 404 | 502; reason: string }> {
  let connection;
  try {
    connection = await getSolanaConnection(SOLANA_NETWORK);
  } catch (e) {
    logger.error('[mcp/complete-create] failed to open Solana connection', {
      error: e instanceof Error ? e.message : String(e),
    });
    return { ok: false, status: 502, reason: 'unable to reach Solana RPC for verification' };
  }

  // Brief retry — when MCP confirms a tx and immediately calls this,
  // the RPC has the tx; under load there's occasionally a 1-2s lag.
  let tx = null;
  for (let attempt = 0; attempt < 3 && tx == null; attempt++) {
    try {
      tx = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
    } catch (e) {
      logger.warn('[mcp/complete-create] getTransaction threw', {
        signature,
        attempt,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    if (tx == null && attempt < 2) await new Promise((r) => setTimeout(r, 1500));
  }
  if (tx == null) {
    return { ok: false, status: 404, reason: 'transaction not found on-chain (yet?)' };
  }
  if (tx.meta?.err) {
    return { ok: false, status: 400, reason: `transaction failed on-chain: ${JSON.stringify(tx.meta.err)}` };
  }

  const accountKeys = tx.transaction.message.getAccountKeys();
  const programId = getProgramIdForNetwork(SOLANA_NETWORK as 'mainnet-beta' | 'devnet').toBase58();
  const programInvolved = accountKeys.staticAccountKeys.some((k) => k.toBase58() === programId);
  if (!programInvolved) {
    return { ok: false, status: 400, reason: 'transaction does not invoke the PNL program' };
  }

  const signer = accountKeys.staticAccountKeys[0]?.toBase58();
  if (signer !== expectedSigner) {
    return { ok: false, status: 400, reason: 'transaction signer does not match walletAddress' };
  }

  return { ok: true };
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limited = await checkRateLimit(`mcp-complete-create:${ip}`, 10, 60_000);
    if (limited) return limited;

    const body = (await request.json()) as CompleteCreateBody;

    if (!body.walletAddress || !body.nonce || !body.signature) {
      return NextResponse.json(
        { success: false, error: 'walletAddress, nonce, and signature are required' },
        { status: 400 },
      );
    }
    if (!body.txSignature || !body.marketAddress || !body.ipfsCid) {
      return NextResponse.json(
        { success: false, error: 'txSignature, marketAddress, and ipfsCid are required' },
        { status: 400 },
      );
    }
    if (!body.payload || !body.payload.name || !body.payload.tokenSymbol) {
      return NextResponse.json(
        { success: false, error: 'payload (with name + tokenSymbol) is required' },
        { status: 400 },
      );
    }

    // Verify signature first — cheap, in-memory. Bail before the RPC
    // call if the request is malformed or unauthorized.
    //
    // The challenge folds in a SHA-256 of the request body minus auth
    // fields, so an attacker who captures a sig within the 5min nonce
    // window cannot rewrite the project name / description / ticker /
    // ipfsCid without invalidating the sig.
    const payloadHash = signedRequestHash(body as unknown as Record<string, unknown>);
    const challengeStr = challenge('complete-create', body.txSignature, body.nonce, payloadHash);
    const verified = verifyMcpSignature(
      { walletAddress: body.walletAddress, nonce: body.nonce, signature: body.signature },
      challengeStr,
    );
    if (!verified.ok) {
      return NextResponse.json({ success: false, error: verified.reason }, { status: verified.status });
    }

    // Verify the on-chain tx was signed by the same wallet.
    const chainCheck = await verifyTxOnChain(body.txSignature, body.walletAddress);
    if (!chainCheck.ok) {
      return NextResponse.json({ success: false, error: chainCheck.reason }, { status: chainCheck.status });
    }

    await connectToDatabase();

    // Idempotency — if we've already persisted this market, return it.
    // Covers retries after a flaky network mid-call.
    const existingMarket = await PredictionMarket.findOne({ marketAddress: body.marketAddress });
    if (existingMarket) {
      logger.info('[mcp/complete-create] market already persisted — returning existing', {
        marketAddress: body.marketAddress,
        marketId: existingMarket._id,
      });
      return NextResponse.json({
        success: true,
        data: {
          marketId: existingMarket._id,
          projectId: existingMarket.projectId,
          marketAddress: existingMarket.marketAddress,
          alreadyExists: true,
        },
      });
    }

    const p = body.payload;
    const metadataUri = body.metadataUri || `ipfs://${body.ipfsCid}`;

    // Mirror /api/projects/create's Project document shape. The MCP
    // payload is a subset (no file uploads) so most fields are
    // straight passthroughs.
    const socialLinks: Record<string, string> = {};
    if (p.socialLinks) {
      for (const [k, v] of Object.entries(p.socialLinks)) {
        if (typeof v === 'string' && v.length > 0) socialLinks[k] = v;
      }
    }

    const project = await new Project({
      founderWallet: body.walletAddress,
      name: p.name,
      description: p.description,
      category: p.category,
      projectType: p.projectType,
      projectStage: p.projectStage,
      location: p.location,
      teamSize: p.teamSize,
      tokenSymbol: p.tokenSymbol,
      socialLinks,
      projectImageUrl: p.projectImageUrl,
      galleryImageUrls: [],
      pitchVideoUrl: p.pitchVideoUrl,
      documentUrls: [],
      provenance: body.provenance,
      createdVia: 'mcp', // autosigned straight from the terminal
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    }).save();

    // PredictionMarket — same shape as /api/markets/complete uses.
    const expiryDate = body.expiryTime
      ? new Date(body.expiryTime * 1000)
      : new Date(Date.now() + (p.durationDays ?? 30) * 24 * 60 * 60 * 1000);
    const finalizationDeadline = new Date(expiryDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const targetPoolLamports =
      typeof body.targetPool === 'number' && body.targetPool > 0
        ? body.targetPool
        : Math.floor((p.targetPoolSol ?? 5) * 1_000_000_000);

    const market = await new PredictionMarket({
      projectId: project._id,
      marketAddress: body.marketAddress,
      marketName: project.name,
      marketDescription: project.description,
      metadataUri,
      targetPool: targetPoolLamports,
      expiryTime: expiryDate,
      finalizationDeadline,
      marketState: 0,
      createdAt: new Date(),
    }).save();

    // Auto-subscribe to sync manager so future on-chain events stream
    // into Mongo without a server restart.
    try {
      await getSyncManager().subscribeToMarket(body.marketAddress);
    } catch (e) {
      logger.warn('[mcp/complete-create] sync subscribe failed (non-fatal)', {
        marketAddress: body.marketAddress,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Founder needs a Cosmic profile so the market detail page renders
    // a name instead of a bare wallet. Non-blocking.
    ensureUserProfile(body.walletAddress, { source: 'mcp' }).catch((e) => {
      logger.warn('[mcp/complete-create] ensureUserProfile failed', {
        walletAddress: body.walletAddress,
        error: e instanceof Error ? e.message : String(e),
      });
    });

    // Socket broadcast — non-blocking.
    try {
      broadcastNewMarket({
        id: market._id.toString(),
        marketAddress: market.marketAddress,
        name: project.name,
        description: project.description,
        category: project.category || 'Other',
        stage: project.projectStage || 'Idea',
        tokenSymbol: project.tokenSymbol || project.name.substring(0, 6).toUpperCase(),
        targetPool: `${(targetPoolLamports / 1_000_000_000).toFixed(0)} SOL`,
        expiryTime: market.expiryTime.toISOString(),
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
    } catch (e) {
      logger.warn('[mcp/complete-create] broadcast failed (non-fatal)', {
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Tweet — non-blocking.
    const twitterHandle = socialLinks.twitter || socialLinks.x;
    tweetMarketCreated({
      tokenSymbol: project.tokenSymbol || project.name.substring(0, 6).toUpperCase(),
      projectName: project.name,
      category: project.category || 'Project',
      stage: project.projectStage || 'Early Stage',
      marketId: market._id.toString(),
      description: project.description,
      twitterHandle,
      projectImageUrl: project.projectImageUrl || undefined,
    }).catch((e) => {
      logger.warn('[mcp/complete-create] tweet failed', {
        error: e instanceof Error ? e.message : String(e),
      });
    });

    await invalidateCache(
      'markets:list:*',
      `profile-counts:${body.walletAddress}`,
      `creator-fees:none:${body.walletAddress}`,
    );

    logger.info('[mcp/complete-create] persisted', {
      walletAddress: body.walletAddress,
      marketAddress: body.marketAddress,
      marketId: market._id,
      projectId: project._id,
    });

    return NextResponse.json({
      success: true,
      data: {
        marketId: market._id,
        projectId: project._id,
        marketAddress: market.marketAddress,
        marketUrl: `/market/${market._id}`,
        txSignature: body.txSignature,
        solscan: `https://solscan.io/tx/${body.txSignature}`,
      },
    });
  } catch (error) {
    logger.error('[mcp/complete-create] failed', {
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
