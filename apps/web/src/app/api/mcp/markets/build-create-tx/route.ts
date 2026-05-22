// POST /api/mcp/markets/build-create-tx
//
// Step 1 of the MCP autosign create_market flow. The MCP server calls
// this with the agent-collected idea payload. We:
//   1. Compose ProjectMetadata JSON
//   2. Pin to IPFS via ipfsUtils.uploadProjectMetadata
//   3. Build the unsigned create_market Anchor instruction
//   4. Serialize the Transaction to base64 (no signatures yet)
//
// Return everything the MCP needs to sign + send: the base64 tx, the
// ipfs cid + metadataUri (caller sends them back to us in step 2 so
// we can persist them on the Project doc), and the derived PDAs for
// the Project/PredictionMarket docs.
//
// No auth on this endpoint — anyone can request a tx build. The MCP
// signs with the user's keypair, so RPC will reject if the user
// doesn't actually own the wallet they claimed. Rate-limited 30/min
// per IP to bound IPFS-spam abuse.

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { buildCreateMarketTransaction, extractIPFSCid } from '@/lib/anchor-program';
import { ipfsUtils } from '@/lib/ipfs';
import { createClientLogger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { SOLANA_NETWORK } from '@/config/solana';

export const dynamic = 'force-dynamic';

const logger = createClientLogger();

interface BuildBody {
  walletAddress?: string;
  name?: string;
  description?: string;
  category?: string;
  projectType?: string;
  projectStage?: string;
  tokenSymbol?: string;
  teamSize?: number;
  targetPoolSol?: number;
  durationDays?: number;
  projectImageUrl?: string;
  pitchVideoUrl?: string;
  socialLinks?: Record<string, string>;
  location?: string;
  additionalNotes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const limited = checkRateLimit(`mcp-build-create:${ip}`, 30, 60_000);
    if (limited) return limited;

    const body = (await request.json()) as BuildBody;

    // Required fields. We mirror the validation /api/projects/create
    // does — bail early with a clear message rather than letting the
    // metadata pin or tx build fail with a confusing error.
    const required: Array<keyof BuildBody> = [
      'walletAddress', 'name', 'description', 'category', 'projectType',
      'projectStage', 'tokenSymbol', 'teamSize', 'targetPoolSol', 'durationDays',
    ];
    const missing = required.filter((k) => body[k] == null || body[k] === '');
    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, error: `missing required field(s): ${missing.join(', ')}` },
        { status: 400 },
      );
    }

    let founder: PublicKey;
    try {
      founder = new PublicKey(body.walletAddress!);
    } catch {
      return NextResponse.json(
        { success: false, error: 'walletAddress is not a valid base58 Solana public key' },
        { status: 400 },
      );
    }

    // Compose the metadata JSON we pin to IPFS. Shape matches what
    // the browser flow uses, so the market detail page renders both
    // browser-created and MCP-created markets identically.
    const metadata = {
      name: body.name!,
      description: body.description!,
      category: body.category!,
      projectType: body.projectType!,
      projectStage: body.projectStage!,
      location: body.location || undefined,
      teamSize: body.teamSize!,
      tokenSymbol: body.tokenSymbol!,
      marketDuration: body.durationDays!,
      minimumStake: 0.05,
      socialLinks: body.socialLinks || {},
      pitchVideoUrl: body.pitchVideoUrl || undefined,
      additionalNotes: body.additionalNotes || undefined,
      image: body.projectImageUrl || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    logger.info('[mcp/build-create-tx] pinning metadata', { name: body.name, tokenSymbol: body.tokenSymbol });
    const metadataUri = await ipfsUtils.uploadProjectMetadata(metadata as never);
    const ipfsCid = extractIPFSCid(metadataUri);
    if (!ipfsCid) {
      return NextResponse.json(
        { success: false, error: 'metadata pinning succeeded but no IPFS CID could be extracted' },
        { status: 500 },
      );
    }

    // Target pool in lamports. The Anchor program uses u64 lamports.
    const targetPool = Math.floor(body.targetPoolSol! * 1_000_000_000);
    const marketDuration = body.durationDays!;

    const { transaction, marketPda, marketVaultPda, treasuryPda, expiryTime, creationFee } =
      await buildCreateMarketTransaction({
        founder,
        ipfsCid,
        targetPool,
        marketDuration,
        metadataUri,
        network: SOLANA_NETWORK as 'mainnet-beta' | 'devnet',
      });

    // Serialize for transport — requireAllSignatures: false so the
    // unsigned tx round-trips cleanly. MCP will sign with the user's
    // keypair and re-serialize before sending.
    const serialized = transaction.serialize({ requireAllSignatures: false }).toString('base64');

    logger.info('[mcp/build-create-tx] built', {
      walletAddress: body.walletAddress,
      marketPda,
      tokenSymbol: body.tokenSymbol,
      targetPoolSol: body.targetPoolSol,
    });

    return NextResponse.json({
      success: true,
      data: {
        tx: serialized,
        ipfsCid,
        metadataUri,
        marketPda,
        marketVaultPda,
        treasuryPda,
        expiryTime,
        creationFee, // lamports
      },
    });
  } catch (error) {
    logger.error('[mcp/build-create-tx] failed', {
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
