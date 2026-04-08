/**
 * Proxy endpoint for Pump.fun IPFS uploads
 *
 * This endpoint forwards IPFS uploads to Pump.fun to avoid CORS issues
 * when calling directly from the browser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    // Get the FormData from the request
    const formData = await request.formData();

    logger.info('Proxying IPFS upload to Pump.fun', {
      name: formData.get('name'),
      symbol: formData.get('symbol'),
    });

    // Forward to Pump.fun IPFS API (server-to-server, no CORS)
    const ipfsResponse = await fetch('https://pump.fun/api/ipfs', {
      method: 'POST',
      body: formData,
    });

    if (!ipfsResponse.ok) {
      const errorText = await ipfsResponse.text();
      logger.error('Pump.fun IPFS upload failed', {
        status: ipfsResponse.status,
        statusText: ipfsResponse.statusText,
        error: errorText,
      });

      return NextResponse.json(
        {
          success: false,
          error: `IPFS upload failed: ${ipfsResponse.status} ${ipfsResponse.statusText}`,
          details: errorText,
        },
        { status: ipfsResponse.status }
      );
    }

    // Parse the response
    const ipfsResult = await ipfsResponse.json();

    logger.info('IPFS upload successful', {
      metadataUri: ipfsResult.metadataUri,
    });

    // Return the result
    return NextResponse.json({
      success: true,
      data: ipfsResult,
    });

  } catch (error) {
    logger.error('IPFS proxy error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload to IPFS',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
