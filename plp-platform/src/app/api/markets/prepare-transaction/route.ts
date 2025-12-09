/**
 * API endpoint for preparing create market transaction
 *
 * This endpoint builds the transaction on the server-side but returns it
 * unsigned for the client to sign with their wallet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { buildCreateMarketTransaction, extractIPFSCid } from '@/lib/anchor-program';
import { createClientLogger } from '@/lib/logger';
import { TARGET_POOL_OPTIONS, MIN_POOL_LAMPORTS, FEES, SOLANA_NETWORK } from '@/config/solana';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Get network from request or use environment configuration
    const network = (body.network as 'devnet' | 'mainnet-beta') || SOLANA_NETWORK;

    logger.info('Preparing create market transaction', {
      projectName: body.projectName,
      founderWallet: body.founderWallet,
      network
    });

    // Validate required fields
    const requiredFields = ['founderWallet', 'metadataUri', 'targetPool', 'marketDuration'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { success: false, error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate target pool (program now accepts any amount >= 0.08 SOL)
    const targetPoolLamports = parseInt(body.targetPool);
    if (targetPoolLamports < MIN_POOL_LAMPORTS) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid target pool. Must be at least ${MIN_POOL_LAMPORTS / 1e9} SOL`
        },
        { status: 400 }
      );
    }

    // Validate market duration
    const marketDuration = parseInt(body.marketDuration);
    if (marketDuration < 1 || marketDuration > 365) {
      return NextResponse.json(
        { success: false, error: 'Market duration must be between 1 and 365 days' },
        { status: 400 }
      );
    }

    // Extract IPFS CID from metadata URI
    const ipfsCid = extractIPFSCid(body.metadataUri);
    logger.info('Extracted IPFS CID:', ipfsCid);

    // Convert founder wallet to PublicKey
    const founderPubkey = new PublicKey(body.founderWallet);

    // Build transaction
    logger.info('Building create market transaction', {
      founderWallet: body.founderWallet,
      ipfsCid,
      ipfsCidLength: ipfsCid.length,
      metadataUri: body.metadataUri,
      metadataUriLength: body.metadataUri.length,
      targetPool: targetPoolLamports,
      marketDuration,
      network
    });
    const result = await buildCreateMarketTransaction({
      founder: founderPubkey,
      ipfsCid,
      targetPool: targetPoolLamports,
      marketDuration,
      metadataUri: body.metadataUri,
      network
    });

    // Serialize transaction for client-side signing
    const serializedTx = result.transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    logger.info('Transaction prepared successfully', {
      marketPda: result.marketPda,
      treasuryPda: result.treasuryPda,
      expiryTime: result.expiryTime,
      creationFee: result.creationFee / 1e9 + ' SOL'
    });

    return NextResponse.json({
      success: true,
      data: {
        serializedTransaction: Buffer.from(serializedTx).toString('base64'),
        marketPda: result.marketPda,
        treasuryPda: result.treasuryPda,
        expiryTime: result.expiryTime,
        creationFee: result.creationFee,
        ipfsCid,
      }
    });

  } catch (error) {
    logger.error('Failed to prepare create market transaction:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare transaction',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'PLP Prepare Market Transaction API',
    endpoints: {
      POST: 'Prepare a create market transaction for client-side signing',
      GET: 'Get API information'
    },
    requiredFields: [
      'founderWallet',      // Founder's wallet public key
      'metadataUri',        // IPFS URI of project metadata
      'targetPool',         // Target pool size in lamports (5/10/15 SOL)
      'marketDuration',     // Market duration in days
    ],
    fees: {
      creation: FEES.CREATION / 1e9 + ' SOL',
      trade: (FEES.TRADE_BPS / 100) + '%',
      completion: (FEES.COMPLETION_BPS / 100) + '%',
    },
    targetPoolOptions: TARGET_POOL_OPTIONS.map(v => ({
      lamports: v,
      sol: v / 1e9
    }))
  });
}
