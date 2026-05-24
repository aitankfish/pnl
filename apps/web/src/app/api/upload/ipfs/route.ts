/**
 * POST /api/upload/ipfs — Proxy IPFS uploads through backend
 *
 * Accepts file uploads from mobile/web clients and forwards to Pinata.
 * The Pinata JWT never leaves the server.
 *
 * Auth: requires authenticated user (withAuth)
 * Rate limit: 5 uploads per minute per wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';

const PINATA_JWT = process.env.PINATA_JWT || '';
const PINATA_GATEWAY = process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const POST = withAuth(async (request, authUser) => {
  try {
    // Rate limit
    const rateLimited = await checkRateLimit(`upload:${authUser.walletAddress}`, 5, 60_000);
    if (rateLimited) return rateLimited;

    if (!PINATA_JWT) {
      return NextResponse.json(
        { success: false, error: 'IPFS upload not configured' },
        { status: 500 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file || file.size === 0) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 400 },
      );
    }

    // Forward to Pinata
    const pinataFormData = new FormData();
    pinataFormData.append('file', file);

    // Add metadata
    const metadata = formData.get('metadata');
    if (metadata) {
      pinataFormData.append('pinataMetadata', metadata as string);
    }

    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
      },
      body: pinataFormData,
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { success: false, error: `Pinata upload failed: ${res.status}` },
        { status: 502 },
      );
    }

    const data = await res.json();

    return NextResponse.json({
      success: true,
      data: {
        ipfsHash: data.IpfsHash,
        pinSize: data.PinSize,
        timestamp: data.Timestamp,
        url: `${PINATA_GATEWAY}/ipfs/${data.IpfsHash}`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Upload failed' },
      { status: 500 },
    );
  }
});

/**
 * POST /api/upload/ipfs/json — Upload JSON metadata to IPFS
 */
export async function PUT(request: NextRequest) {
  // Reuse the auth from the import
  const handler = withAuth(async (req, authUser) => {
    try {
      const rateLimited = await checkRateLimit(`upload:${authUser.walletAddress}`, 5, 60_000);
      if (rateLimited) return rateLimited;

      if (!PINATA_JWT) {
        return NextResponse.json(
          { success: false, error: 'IPFS upload not configured' },
          { status: 500 },
        );
      }

      const jsonData = await req.json();

      const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: JSON.stringify({
          pinataContent: jsonData.content,
          pinataMetadata: jsonData.metadata || { name: 'pnl-metadata' },
        }),
      });

      if (!res.ok) {
        return NextResponse.json(
          { success: false, error: `Pinata upload failed: ${res.status}` },
          { status: 502 },
        );
      }

      const data = await res.json();

      return NextResponse.json({
        success: true,
        data: {
          ipfsHash: data.IpfsHash,
          url: `${PINATA_GATEWAY}/ipfs/${data.IpfsHash}`,
        },
      });
    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message || 'Upload failed' },
        { status: 500 },
      );
    }
  });

  return handler(request);
}
