import { z } from 'zod';
import {
  readToken,
  saveToken,
  clearToken,
  readPending,
  savePending,
  clearPending,
} from '../lib/device.js';

// ─── pnl_login / pnl_logout ──────────────────────────────────────
//
// Device-authorization login: bind this terminal to the user's PNL web account
// so the MCP can act as them (post updates, declare/cut milestones, mint DOIs).
//
// Two-step by design — the verification URL must be shown BEFORE the user can
// approve, so a single blocking poll won't do. First call STARTS the flow and
// prints the URL + code; after the user approves in the browser, a second call
// POLLS and saves the token. `pnl_login` is the same tool for both steps:
//   - no pending grant  → start, print URL + code
//   - pending grant     → poll; on approval, save the token

function getApiBase(): string {
  const raw = process.env.PNL_API_BASE_URL?.trim();
  if (!raw) return 'https://pnl.market';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function text(t: string) {
  return { content: [{ type: 'text' as const, text: t }] };
}

export const loginInputSchema = {
  label: z
    .string()
    .max(120)
    .optional()
    .describe('Optional label for this terminal, e.g. "cli on macbook", shown in your linked-terminals list.'),
} as const;

const LoginInput = z.object(loginInputSchema);

export async function callLogin(rawInput: unknown) {
  const { label } = LoginInput.parse(rawInput ?? {});
  const base = getApiBase();

  const existing = readToken();
  if (existing?.token) {
    return text(
      `Already linked to PNL${existing.walletAddress ? ` as ${existing.walletAddress}` : ''}. Run pnl_logout first to switch accounts.`,
    );
  }

  // Step 2: a login is in flight — poll for approval.
  const pending = readPending();
  if (pending && pending.expiresAt > Date.now()) {
    try {
      const res = await fetch(`${base}/api/auth/device/poll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceCode: pending.deviceCode }),
      });
      const json: any = await res.json().catch(() => ({}));
      const data = json?.data || {};
      if (data.status === 'approved' && data.token) {
        saveToken({ token: data.token, walletAddress: data.walletAddress, linkedAt: new Date().toISOString() });
        clearPending();
        return text(
          `✓ Terminal linked${data.walletAddress ? ` to ${data.walletAddress}` : ''}. The MCP can now post updates, declare and cut milestones, and publish as your account. Manage or revoke this terminal from your PNL profile.`,
        );
      }
      if (data.status === 'pending') {
        return text(
          `Not approved yet. Open ${pending.verificationUri} , sign in, and approve code ${pending.userCode} — then run pnl_login again.`,
        );
      }
      if (data.status === 'denied') {
        clearPending();
        return text('That request was denied in the browser. Run pnl_login again to start over.');
      }
      // expired / not_found → fall through to a fresh start
      clearPending();
    } catch {
      return text('Network error while checking approval. Run pnl_login again to retry.');
    }
  }
  if (pending) clearPending(); // expired

  // Step 1: start a new device authorization.
  try {
    const res = await fetch(`${base}/api/auth/device/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!json?.success) {
      return text(`Couldn't start login: ${json?.error || 'unknown error'}`);
    }
    const d = json.data;
    const url = d.verificationUriComplete || d.verificationUri;
    const expiresIn = d.expiresIn || 900;
    savePending({
      deviceCode: d.deviceCode,
      userCode: d.userCode,
      verificationUri: url,
      expiresAt: Date.now() + expiresIn * 1000,
    });
    return text(
      `To link this terminal to your PNL account:\n\n` +
        `1. Open ${url}\n` +
        `2. Sign in and approve code ${d.userCode}\n` +
        `3. Run pnl_login again to finish.\n\n` +
        `The code expires in ${Math.floor(expiresIn / 60)} minutes.`,
    );
  } catch {
    return text('Network error reaching PNL. Check your connection and try pnl_login again.');
  }
}

export const logoutInputSchema = {} as const;

export async function callLogout() {
  const existing = readToken();
  clearToken();
  clearPending();
  return text(
    existing?.token
      ? 'Unlinked this terminal — the device token was removed from this machine. To be safe, also revoke it from your PNL profile’s linked-terminals list.'
      : 'No PNL login on this machine.',
  );
}
