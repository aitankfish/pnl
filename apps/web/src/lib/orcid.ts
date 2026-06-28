/**
 * ORCID OAuth helpers.
 *
 * The `/authenticate` scope is all PNL needs: it returns a *verified* ORCID iD
 * (the researcher proved they own it), which we store as the "verified
 * researcher" signal. We never request read/write scopes on their record.
 *
 * Config via env (the org must register a free ORCID API client):
 *   ORCID_CLIENT_ID, ORCID_CLIENT_SECRET   — from orcid.org developer tools
 *   ORCID_ENV = 'sandbox' | 'production'    — default 'sandbox'
 *   ORCID_REDIRECT_URI                      — optional; must EXACTLY match the
 *     value registered with the ORCID app. If unset, derived from the request
 *     origin + /api/auth/orcid/callback.
 */

export interface OrcidConfig {
  clientId: string;
  clientSecret: string;
  base: string; // https://orcid.org or https://sandbox.orcid.org
  redirectUri?: string;
}

export function getOrcidConfig(): OrcidConfig | null {
  const clientId = process.env.ORCID_CLIENT_ID;
  const clientSecret = process.env.ORCID_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const base = (process.env.ORCID_ENV || 'sandbox').toLowerCase() === 'production'
    ? 'https://orcid.org'
    : 'https://sandbox.orcid.org';
  return { clientId, clientSecret, base, redirectUri: process.env.ORCID_REDIRECT_URI };
}

export function isConfigured(): boolean {
  return getOrcidConfig() !== null;
}

// ORCID iDs are 16 digits in four groups; the final character may be 'X'.
const ORCID_RE = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
export function isValidOrcid(id: string): boolean {
  return ORCID_RE.test(id);
}

export function buildAuthorizeUrl(cfg: OrcidConfig, state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: 'code',
    scope: '/authenticate',
    redirect_uri: redirectUri,
    state,
  });
  return `${cfg.base}/oauth/authorize?${params.toString()}`;
}

export interface OrcidToken {
  orcid: string;
  name: string | null;
}

/**
 * Exchange the authorization code for the verified ORCID iD. The token
 * response itself carries `orcid` + `name`, so no extra record fetch is needed.
 */
export async function exchangeCode(cfg: OrcidConfig, code: string, redirectUri: string): Promise<OrcidToken | null> {
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${cfg.base}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: body.toString(),
  });
  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  const orcid = data?.orcid;
  if (!orcid || !isValidOrcid(orcid)) return null;
  return { orcid, name: data?.name || null };
}

export function orcidProfileUrl(id: string): string {
  // The public-facing iD always resolves on production orcid.org.
  return `https://orcid.org/${id}`;
}
