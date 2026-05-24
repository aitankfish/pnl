// POST /api/mcp/markets/build-claim-tx
//
// Step 1 of the MCP autosign claim flow. Given a marketAddress + the
// user's walletAddress, returns the unsigned claim_rewards
// VersionedTransaction (base64). The MCP signs locally and sends.
//
// No auth — anyone can request a tx build. The user's signature gates
// the actual spend; the on-chain program enforces position ownership.
// Rate-limited 30/min per IP to bound abuse of the heavier on-chain
// reads (account fetch + position read + ATA derive).

import { NextRequest, NextResponse } from 'next/server';
import { createClientLogger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { buildClaimRewardsTx, BuildClaimError } from '@/lib/claim-builder';
import { PublicKey } from '@solana/web3.js';

export const dynamic = 'force-dynamic';

const logger = createClientLogger();

interface BuildClaimBody {
  walletAddress?: string;
  marketAddress?: string;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limited = await checkRateLimit(`mcp-build-claim:${ip}`, 30, 60_000);
    if (limited) return limited;

    const body = (await request.json()) as BuildClaimBody;

    if (!body.walletAddress || !body.marketAddress) {
      return NextResponse.json(
        { success: false, error: 'walletAddress and marketAddress are required' },
        { status: 400 },
      );
    }

    try {
      new PublicKey(body.walletAddress);
    } catch {
      return NextResponse.json(
        { success: false, error: 'walletAddress is not a valid base58 Solana public key' },
        { status: 400 },
      );
    }
    try {
      new PublicKey(body.marketAddress);
    } catch {
      return NextResponse.json(
        { success: false, error: 'marketAddress is not a valid base58 Solana public key' },
        { status: 400 },
      );
    }

    const result = await buildClaimRewardsTx(body.marketAddress, body.walletAddress);

    logger.info('[mcp/build-claim-tx] built', {
      walletAddress: body.walletAddress,
      marketAddress: body.marketAddress,
      resolutionType: result.resolutionType,
    });

    return NextResponse.json({
      success: true,
      data: {
        tx: result.serializedTransaction,
        positionPda: result.positionPda,
        resolutionType: result.resolutionType,
        lastValidBlockHeight: result.lastValidBlockHeight,
      },
    });
  } catch (error) {
    if (error instanceof BuildClaimError) {
      return NextResponse.json({ success: false, error: error.reason }, { status: error.status });
    }
    logger.error('[mcp/build-claim-tx] failed', {
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
