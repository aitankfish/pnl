/**
 * API endpoint to fetch token metadata using Helius DAS API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const { mint } = await request.json();

    if (!mint) {
      return NextResponse.json(
        { success: false, error: 'Missing mint address' },
        { status: 400 }
      );
    }

    logger.info('Fetching token metadata', { mint });

    // Use Helius DAS API to fetch token metadata
    const heliusApiKey = process.env.HELIUS_API_KEY;
    if (!heliusApiKey) {
      throw new Error('HELIUS_API_KEY not configured');
    }

    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'devnet' ? 'devnet' : 'mainnet';
    const heliusUrl = `https://${network}.helius-rpc.com/?api-key=${heliusApiKey}`;

    // Call Helius DAS API getAsset
    const response = await fetch(heliusUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'token-metadata',
        method: 'getAsset',
        params: {
          id: mint,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      logger.warn('Helius API returned error', { mint, error: data.error });
      return NextResponse.json({
        success: false,
        error: 'Token metadata not found',
      });
    }

    // Extract metadata from DAS response
    const asset = data.result;

    // Check if this is a fungible token
    if (asset?.interface !== 'FungibleToken' && asset?.interface !== 'FungibleAsset') {
      logger.warn('Asset is not a fungible token', { mint, interface: asset?.interface });
    }

    const metadata = {
      symbol: asset?.content?.metadata?.symbol || asset?.token_info?.symbol || 'UNKNOWN',
      name: asset?.content?.metadata?.name || asset?.token_info?.name || 'Unknown Token',
      logoURI: asset?.content?.links?.image || asset?.content?.files?.[0]?.uri,
      decimals: asset?.token_info?.decimals || 9,
    };

    logger.info('Token metadata fetched successfully', { mint, metadata });

    return NextResponse.json({
      success: true,
      metadata,
    });
  } catch (error) {
    logger.error('Failed to fetch token metadata:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch token metadata',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
