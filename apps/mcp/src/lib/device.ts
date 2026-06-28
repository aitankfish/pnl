// ─── Device-authorization token storage ──────────────────────────
//
// Persists the PNL device token (and the in-flight pending grant) under
// ~/.config/pnl, mode 0600 — same convention as the wallet. The token lets the
// MCP authenticate as the user's PNL web account (posts, milestones, DOI mint,
// cut-release) by sending `Authorization: Bearer <token>`.

import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, chmodSync } from 'node:fs';

const PNL_DIR = join(homedir(), '.config', 'pnl');
const TOKEN_PATH = join(PNL_DIR, 'token.json');
const PENDING_PATH = join(PNL_DIR, 'device-pending.json');

function ensureDir(): void {
  mkdirSync(PNL_DIR, { recursive: true, mode: 0o700 });
}

function writeSecure(path: string, data: unknown): void {
  ensureDir();
  writeFileSync(path, JSON.stringify(data, null, 2), { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* best-effort on platforms without chmod */
  }
}

function readJson<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

export interface StoredToken {
  token: string;
  walletAddress?: string;
  linkedAt: string;
}

export interface PendingGrant {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number; // epoch ms
}

export function saveToken(t: StoredToken): void {
  writeSecure(TOKEN_PATH, t);
}
export function readToken(): StoredToken | null {
  return readJson<StoredToken>(TOKEN_PATH);
}
export function clearToken(): void {
  try {
    rmSync(TOKEN_PATH, { force: true });
  } catch {
    /* ignore */
  }
}

/** The bearer token for authenticating MCP web-account actions, or null. */
export function getAuthToken(): string | null {
  return readToken()?.token ?? null;
}

export function savePending(p: PendingGrant): void {
  writeSecure(PENDING_PATH, p);
}
export function readPending(): PendingGrant | null {
  return readJson<PendingGrant>(PENDING_PATH);
}
export function clearPending(): void {
  try {
    rmSync(PENDING_PATH, { force: true });
  } catch {
    /* ignore */
  }
}
