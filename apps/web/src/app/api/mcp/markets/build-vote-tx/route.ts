// POST /api/mcp/markets/build-vote-tx
//
// Step 1 of the MCP autosign vote flow. Builds an unsigned buy_yes /
// buy_no Anchor transaction for the given market + amount and returns
// the base64-serialized tx for the MCP to sign + send locally.
//
// No auth — the MCP signs with the user's keypair, so the on-chain
// program enforces ownership. Rate-limited 30/min per IP.

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { buildBuyYesTransaction, buildBuyNoTransaction } from '@/lib/anchor-program';
import { createClientLogger } from '@/lib/logger';
import { SOLANA_NETWORK, RPC_ENDPOINT } from '@/config/solana';
import { checkRateLimit } from '@/lib/auth/rate-limit';

export const dynamic = 'force-dynamic';

const logger = createClientLogger();

interface BuildVoteBody {
  walletAddress?: string;
  marketAddress?: string;
  voteType?: 'yes' | 'no';
  amountSol?: number;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limited = checkRateLimit(`mcp-build-vote:${ip}`, 30, 60_000);
    if (limited) return limited;

    const body = (await request.json()) as BuildVoteBody;

    if (!body.walletAddress || !body.marketAddress || !body.voteType || !body.amountSol) {
      return NextResponse.json(
        { success: false, error: 'walletAddress, marketAddress, voteType, and amountSol are required' },
        { status: 400 },
      );
    }
    if (body.voteType !== 'yes' && body.voteType !== 'no') {
      return NextResponse.json(
        { success: false, error: "voteType must be 'yes' or 'no'" },
        { status: 400 },
      );
    }

    const lamports = Math.floor(body.amountSol * 1_000_000_000);
    if (lamports < 10_000_000) {
      return NextResponse.json(
        { success: false, error: 'minimum vote amount is 0.01 SOL' },
        { status: 400 },
      );
    }

    let user: PublicKey;
    let market: PublicKey;
    try {
      user = new PublicKey(body.walletAddress);
    } catch {
      return NextResponse.json(
        { success: false, error: 'walletAddress is not a valid base58 Solana public key' },
        { status: 400 },
      );
    }
    try {
      market = new PublicKey(body.marketAddress);
    } catch {
      return NextResponse.json(
        { success: false, error: 'marketAddress is not a valid base58 Solana public key' },
        { status: 400 },
      );
    }

    const builder = body.voteType === 'yes' ? buildBuyYesTransaction : buildBuyNoTransaction;
    const result = await builder({
      market,
      user,
      solAmount: lamports,
      network: SOLANA_NETWORK as 'mainnet-beta' | 'devnet',
      rpcEndpoint: RPC_ENDPOINT,
    });

    const serialized = result.transaction
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString('base64');

    logger.info('[mcp/build-vote-tx] built', {
      walletAddress: body.walletAddress,
      marketAddress: body.marketAddress,
      voteType: body.voteType,
      amountSol: body.amountSol,
    });

    return NextResponse.json({
      success: true,
      data: {
        tx: serialized,
        positionPda: result.positionPda,
        voteType: body.voteType,
        amountSol: body.amountSol,
        lamports,
      },
    });
  } catch (error) {
    logger.error('[mcp/build-vote-tx] failed', {
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
