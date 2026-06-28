/**
 * GitHub App helpers — the "act on git" half of the milestone loop.
 *
 * Lets PNL create a release/tag on a repo the user has installed the PNL GitHub
 * App on (Contents: write). The milestone settlement then sees the tag and flips
 * the milestone to shipped — turning watching git into acting on it.
 *
 * App auth is a two-step dance, done here with Node's built-in crypto (no extra
 * dependency): sign a short-lived RS256 *app JWT* with the app's private key,
 * then exchange it for a per-installation access token scoped to that repo.
 *
 * Config via env (free — register a GitHub App with Contents: write):
 *   GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY (PEM; literal \n or base64 ok),
 *   GITHUB_APP_SLUG (for the install URL).
 */

import crypto from 'crypto';
import { GITHUB_API } from '@/lib/github';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export interface GithubAppConfig {
  appId: string;
  privateKey: string;
  slug: string;
}

export function getGithubAppConfig(): GithubAppConfig | null {
  const appId = process.env.GITHUB_APP_ID;
  const rawKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const slug = process.env.GITHUB_APP_SLUG;
  if (!appId || !rawKey || !slug) return null;

  // The PEM may arrive with literal "\n" (single-line env) or base64-encoded.
  let privateKey = rawKey;
  if (!privateKey.includes('BEGIN')) {
    try {
      privateKey = Buffer.from(rawKey, 'base64').toString('utf8');
    } catch {
      return null;
    }
  }
  privateKey = privateKey.replace(/\\n/g, '\n');
  if (!privateKey.includes('BEGIN')) return null;

  return { appId, privateKey, slug };
}

export function isGithubAppConfigured(): boolean {
  return getGithubAppConfig() !== null;
}

// GitHub installation IDs are integers. Validating before interpolating into a
// request path blocks any path-manipulation / SSRF via a crafted id (the value
// reaches us from the install callback URL, which is attacker-controllable).
const NUMERIC_ID = /^\d+$/;
export function isValidInstallationId(id: string): boolean {
  return NUMERIC_ID.test(id);
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Short-lived (≤10 min) RS256 app JWT, signed with the app private key.
 */
export function generateAppJwt(cfg: GithubAppConfig): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  // iat backdated 60s for clock skew; exp 9 min out (GitHub caps at 10).
  const payload = base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: cfg.appId }));
  const signingInput = `${header}.${payload}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), cfg.privateKey);
  return `${signingInput}.${base64url(signature)}`;
}

/**
 * Exchange the app JWT for an installation access token (lasts ~1h). Scoped to
 * whatever the installation grants.
 */
export async function getInstallationToken(cfg: GithubAppConfig, installationId: string): Promise<string | null> {
  try {
    if (!isValidInstallationId(installationId)) return null;
    const jwt = generateAppJwt(cfg);
    const res = await fetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'PNL-Milestones/1.0',
      },
    });
    if (!res.ok) {
      logger.error('[github-app] installation token failed', { status: res.status } as any);
      return null;
    }
    const data = await res.json();
    return data?.token || null;
  } catch (error) {
    logger.error('[github-app] installation token error', error as any);
    return null;
  }
}

export interface InstallationInfo {
  accountLogin: string;
  accountType?: string;
}

/** Look up which GitHub account an installation belongs to (the repo owner). */
export async function getInstallation(cfg: GithubAppConfig, installationId: string): Promise<InstallationInfo | null> {
  try {
    if (!isValidInstallationId(installationId)) return null;
    const jwt = generateAppJwt(cfg);
    const res = await fetch(`${GITHUB_API}/app/installations/${installationId}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'PNL-Milestones/1.0',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const login = data?.account?.login;
    if (!login) return null;
    return { accountLogin: login, accountType: data?.account?.type };
  } catch {
    return null;
  }
}

export interface CreateReleaseInput {
  owner: string;
  repo: string;
  tagName: string;
  name?: string;
  body?: string;
  targetCommitish?: string;
}

export interface CreateReleaseResult {
  ok: boolean;
  htmlUrl?: string;
  tagName?: string;
  error?: string;
  status?: number;
}

/**
 * Create a published release (which also creates the tag if it doesn't exist)
 * using an installation token. Returns a structured result; never throws.
 */
export async function createRelease(installationToken: string, input: CreateReleaseInput): Promise<CreateReleaseResult> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${input.owner}/${input.repo}/releases`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${installationToken}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'PNL-Milestones/1.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tag_name: input.tagName,
        name: input.name || input.tagName,
        body: input.body || '',
        target_commitish: input.targetCommitish,
        draft: false,
        prerelease: false,
      }),
    });
    if (!res.ok) {
      let msg = `GitHub returned ${res.status}`;
      try {
        const err = await res.json();
        if (err?.message) msg = err.message;
      } catch {
        /* keep generic */
      }
      return { ok: false, error: msg, status: res.status };
    }
    const data = await res.json();
    return { ok: true, htmlUrl: data?.html_url, tagName: data?.tag_name };
  } catch (error) {
    logger.error('[github-app] create release error', error as any);
    return { ok: false, error: 'Failed to create release' };
  }
}

/** Install URL for the app — sends the user to GitHub to pick repos. */
export function installUrl(cfg: GithubAppConfig, state: string): string {
  return `https://github.com/apps/${cfg.slug}/installations/new?state=${encodeURIComponent(state)}`;
}
