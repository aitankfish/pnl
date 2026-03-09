/**
 * Cloudflare Stream — Upload, delete, and get playback URLs for pitch videos.
 *
 * Videos are uploaded via the Stream API, automatically transcoded into
 * adaptive-bitrate HLS, and served from Cloudflare's global CDN.
 *
 * Playback URL format: https://customer-{code}.cloudflarestream.com/{uid}/manifest/video.m3u8
 * Or simpler iframe/MP4: https://cloudflarestream.com/{uid}
 */

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN;
const BASE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream`;

function ensureConfig() {
  if (!ACCOUNT_ID || !API_TOKEN) {
    throw new Error('Cloudflare Stream not configured: missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_STREAM_API_TOKEN');
  }
}

/**
 * Upload a video file to Cloudflare Stream.
 * Returns the HLS playback URL (ready for adaptive bitrate streaming).
 *
 * Cloudflare automatically transcodes the video into multiple quality levels.
 * The HLS URL adapts to the viewer's connection speed.
 */
export async function uploadToStream(file: File): Promise<{ playbackUrl: string; uid: string }> {
  ensureConfig();

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Cloudflare Stream upload failed:', res.status, text);
    throw new Error(`Cloudflare Stream upload failed: ${res.status}`);
  }

  const data = await res.json();

  if (!data.success || !data.result?.uid) {
    console.error('Cloudflare Stream response error:', data);
    throw new Error('Cloudflare Stream upload returned invalid response');
  }

  const uid = data.result.uid;
  const playbackUrl = data.result.playback?.hls
    || `https://customer-${data.result.playback?.dash?.split('customer-')[1]?.split('/')[0] || ''}.cloudflarestream.com/${uid}/manifest/video.m3u8`;

  console.log(`[CloudflareStream] Uploaded video: uid=${uid}`);

  return {
    playbackUrl: data.result.playback?.hls || `https://cloudflarestream.com/${uid}/manifest/video.m3u8`,
    uid,
  };
}

/**
 * Delete a video from Cloudflare Stream by its UID.
 */
export async function deleteFromStream(uid: string): Promise<void> {
  ensureConfig();

  const res = await fetch(`${BASE_URL}/${uid}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Cloudflare Stream delete failed:', res.status, text);
    throw new Error(`Cloudflare Stream delete failed: ${res.status}`);
  }

  console.log(`[CloudflareStream] Deleted video: uid=${uid}`);
}

/**
 * Check if a URL is a Cloudflare Stream URL.
 */
export function isStreamUrl(url: string): boolean {
  return url.includes('cloudflarestream.com') || url.includes('videodelivery.net');
}

/**
 * Extract the Stream UID from a Cloudflare Stream playback URL.
 */
export function extractStreamUid(url: string): string | null {
  // Format: https://customer-xxx.cloudflarestream.com/{uid}/manifest/video.m3u8
  // Or: https://cloudflarestream.com/{uid}/...
  const match = url.match(/cloudflarestream\.com\/([a-f0-9]{32})/i)
    || url.match(/videodelivery\.net\/([a-f0-9]{32})/i);
  return match?.[1] || null;
}
