/**
 * POST /api/upload/avatar
 * Accepts a multipart file upload, pins it to Pinata/IPFS,
 * and returns the gateway URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/require-wallet';
import { looksLikeImage, readMagic } from '@/lib/file-sniff';

const PINATA_JWT = process.env.PINATA_JWT || '';
const PINATA_API_KEY = process.env.PINATA_API_KEY || '';
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_KEY || '';
const PINATA_GATEWAY =
  process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud';

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Cap size + verify it's actually an image. Without this, a logged-in
    // user could pin arbitrary content of any size to IPFS on our Pinata
    // bill. file.type is client-supplied so it's checked AND sniffed.
    const MAX_AVATAR_BYTES = 8 * 1024 * 1024; // 8MB
    const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (file.size > MAX_AVATAR_BYTES) {
      return NextResponse.json({ success: false, error: 'Avatar too large (max 8MB)' }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ success: false, error: `Invalid avatar type: ${file.type}` }, { status: 400 });
    }
    if (!looksLikeImage(await readMagic(file))) {
      return NextResponse.json({ success: false, error: 'Avatar content is not a supported image (jpeg/png/gif/webp).' }, { status: 400 });
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
});
