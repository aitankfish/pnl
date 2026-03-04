/**
 * POST /api/upload/avatar
 * Accepts a multipart file upload, pins it to Pinata/IPFS,
 * and returns the gateway URL.
 */

import { NextRequest, NextResponse } from 'next/server';

const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT || process.env.PINATA_JWT || '';
const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY || process.env.PINATA_API_KEY || '';
const PINATA_SECRET_KEY = process.env.NEXT_PUBLIC_PINATA_SECRET_KEY || process.env.PINATA_SECRET_KEY || '';
const PINATA_GATEWAY =
  process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL || process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Build Pinata request
    const pinataForm = new FormData();
    pinataForm.append('file', file);
    pinataForm.append(
      'pinataMetadata',
      JSON.stringify({ name: `avatar-${Date.now()}` }),
    );
    pinataForm.append(
      'pinataOptions',
      JSON.stringify({ cidVersion: 1 }),
    );

    const headers: Record<string, string> = {};
    if (PINATA_JWT) {
      headers['Authorization'] = `Bearer ${PINATA_JWT}`;
    } else if (PINATA_API_KEY && PINATA_SECRET_KEY) {
      headers['pinata_api_key'] = PINATA_API_KEY;
      headers['pinata_secret_api_key'] = PINATA_SECRET_KEY;
    } else {
      return NextResponse.json(
        { success: false, error: 'Pinata credentials not configured' },
        { status: 500 },
      );
    }

    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers,
      body: pinataForm,
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { success: false, error: `Pinata upload failed: ${res.status}`, details: errorText },
        { status: 502 },
      );
    }

    const { IpfsHash } = await res.json();
    const gatewayUrl = `${PINATA_GATEWAY}/ipfs/${IpfsHash}`;

    return NextResponse.json({ success: true, data: { ipfsHash: IpfsHash, url: gatewayUrl } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
