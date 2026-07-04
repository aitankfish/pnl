/**
 * X (Twitter) broadcast — post a project's achievements to X from PNL's account.
 *
 * Gated on config (the X API is paid), so it stays dormant — `isXConfigured()`
 * is false and callers no-op — until the keys are set. Posts via X API v2
 * (POST /2/tweets) signed with OAuth 1.0a user context, implemented on Node's
 * built-in crypto (no dependency). For v2 the JSON body is NOT part of the
 * OAuth signature base string, which keeps the signing simple.
 *
 * Config via env (paid X API; PNL's own account's tokens):
 *   X_CONSUMER_KEY, X_CONSUMER_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
 */

import crypto from 'crypto';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const TWEET_ENDPOINT = 'https://api.twitter.com/2/tweets';

interface XConfig {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessSecret: string;
}

export function getXConfig(): XConfig | null {
  // Prefer the X_* names, but fall back to the older TWITTER_* names that the
  // market-created tweet path (services/twitter/twitter-service) already reads.
  // Same four OAuth 1.0a credentials — "consumer key" is Twitter's "API key" —
  // so one set in Render powers every broadcaster and there's nothing to drift.
  const consumerKey = process.env.X_CONSUMER_KEY || process.env.TWITTER_API_KEY;
  const consumerSecret = process.env.X_CONSUMER_SECRET || process.env.TWITTER_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN || process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_SECRET || process.env.TWITTER_ACCESS_TOKEN_SECRET;
  if (!consumerKey || !consumerSecret || !accessToken || !accessSecret) return null;
  return { consumerKey, consumerSecret, accessToken, accessSecret };
}

export function isXConfigured(): boolean {
  return getXConfig() !== null;
}

// RFC 3986 percent-encoding (stricter than encodeURIComponent).
function pct(s: string): string {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function oauthHeader(cfg: XConfig, method: string, url: string): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: cfg.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: cfg.accessToken,
    oauth_version: '1.0',
  };

  // Signature base string: METHOD & url & sorted-encoded-params. For a v2 JSON
  // POST there are no query/body params to include — just the oauth set.
  const paramString = Object.keys(oauth)
    .sort()
    .map((k) => `${pct(k)}=${pct(oauth[k])}`)
    .join('&');
  const baseString = [method.toUpperCase(), pct(url), pct(paramString)].join('&');
  const signingKey = `${pct(cfg.consumerSecret)}&${pct(cfg.accessSecret)}`;
  // NOTE: HMAC-SHA1 is REQUIRED by the OAuth 1.0a spec (RFC 5849 §3.4.2) — it's
  // a request signature, not password hashing, and the secrets here are OAuth
  // signing keys, not stored credentials. CodeQL's "insufficient password hash"
  // rule is a false positive in this context; there is no stronger option for
  // OAuth 1.0a. (The alternative is OAuth 2.0, which needs token-refresh infra.)
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  const headerParams = { ...oauth, oauth_signature: signature };
  return (
    'OAuth ' +
    Object.keys(headerParams)
      .sort()
      .map((k) => `${pct(k)}="${pct(headerParams[k as keyof typeof headerParams])}"`)
      .join(', ')
  );
}

export interface XPostResult {
  ok: boolean;
  id?: string;
  url?: string;
  error?: string;
}

/**
 * Post a tweet. Returns a structured result; never throws. No-ops (ok:false)
 * when X isn't configured, so callers can fire it unconditionally.
 */
export async function postToX(textRaw: string): Promise<XPostResult> {
  const cfg = getXConfig();
  if (!cfg) return { ok: false, error: 'not_configured' };

  const text = textRaw.slice(0, 280);
  try {
    const res = await fetch(TWEET_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: oauthHeader(cfg, 'POST', TWEET_ENDPOINT),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error('[x] post failed', { status: res.status, body: body.slice(0, 200) } as any);
      return { ok: false, error: `X returned ${res.status}` };
    }
    const json = await res.json();
    const id = json?.data?.id;
    return { ok: true, id, url: id ? `https://x.com/i/web/status/${id}` : undefined };
  } catch (error) {
    logger.error('[x] post error', error as any);
    return { ok: false, error: 'Failed to post to X' };
  }
}

/** Normalize a stored handle/url to a bare @-less handle, or null. */
export function normalizeXHandle(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = String(input)
    .trim()
    .replace(/^https?:\/\/(www\.)?(twitter|x)\.com\//i, '')
    .replace(/^@/, '')
    .match(/^([A-Za-z0-9_]{1,15})/);
  return m ? m[1] : null;
}

/** Pull a bare X handle out of a project's socialLinks (Map or plain object). */
export function xHandleFrom(socials: any): string | null {
  if (!socials) return null;
  const obj = socials instanceof Map ? Object.fromEntries(socials) : socials;
  for (const k of Object.keys(obj)) {
    if (/^(twitter|x)$/i.test(k)) {
      const h = normalizeXHandle(obj[k]);
      if (h) return h;
    }
  }
  return null;
}
