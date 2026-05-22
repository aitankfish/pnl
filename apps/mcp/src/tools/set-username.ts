import { z } from 'zod';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { randomBytes } from 'node:crypto';
import { hasWallet, isUnlocked, requireUnlockedKeypair } from '../lib/wallet.js';
import { Badge, headline, kvTable, next, reply, truncAddress, code } from '../lib/output.js';

// ─── pnl_set_username ────────────────────────────────────────────
//
// Claim or rename the PNL username for the local wallet. Signs a
// time-bounded challenge with the local keypair so the backend can
// verify ownership without a Privy session.
//
// Username constraints (enforced server-side too):
//   - 3-20 characters
//   - Letters, numbers, underscores, hyphens
//   - Must not already be taken by another wallet
//
// Idempotent: setting the same username twice is a no-op.

export const setUsernameInputSchema = {
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, 'username must be letters, numbers, underscores, or hyphens only')
    .describe(
      "The username to claim on PNL. 3-20 characters of letters, numbers, underscores, or hyphens. Shown on the user's market detail pages, profile, and any markets they create.",
    ),
} as const;

const SetUsernameInput = z.object(setUsernameInputSchema);

function getApiBase(): string {
  const raw = process.env.PNL_API_BASE_URL?.trim();
  if (!raw) return 'https://pnl.market';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export async function callSetUsername(rawInput: unknown) {
  const { username } = SetUsernameInput.parse(rawInput ?? {});

  if (!hasWallet()) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'No PNL wallet on this machine yet. Run pnl_init first — the username gets attached to your wallet address.',
        },
      ],
    };
  }
  if (!isUnlocked()) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'Wallet is locked. Call pnl_unlock first — claiming a username requires a signature from your wallet. Passphrase is read from PNL_PASSPHRASE env or via an OS-native dialog.',
        },
      ],
    };
  }

  const keypair = requireUnlockedKeypair();
  const walletAddress = keypair.publicKey.toBase58();

  // Nonce: timestamped (ms) + hex randomness. Server checks the
  // timestamp is within 5 minutes of receipt to prevent replay.
  const nonce = `${Date.now()}-${randomBytes(8).toString('hex')}`;
  const challenge = `pnl-set-username:${username}:${walletAddress}:${nonce}`;

  const messageBytes = new TextEncoder().encode(challenge);
  const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signatureB58 = bs58.encode(signatureBytes);

  const res = await fetch(`${getApiBase()}/api/mcp/profile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'pnl-mcp-server/0.2.0 (+https://docs.pnl.market)',
    },
    body: JSON.stringify({ walletAddress, username, nonce, signature: signatureB58 }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    data?: { walletAddress: string; username: string; profilePhotoUrl?: string };
  };

  if (res.status === 409) {
    return reply(
      headline(`${Badge.warn} Username \`${username}\` already taken.`),
      `Suggest variations like \`${username}_pnl\`, \`${username}2\`, or different separators — then call \`pnl_set_username\` again.`,
      next('Pick a different name and re-run.'),
    );
  }
  if (!res.ok || !data.success) {
    throw new Error(`PNL profile API ${res.status} ${res.statusText}${data.error ? ` — ${data.error}` : ''}`);
  }

  const profile = data.data;
  return reply(
    headline(`${Badge.ok} Username set · ${profile?.username}`),
    kvTable([
      ['Username', profile?.username ?? null],
      ['Wallet', profile?.walletAddress ? `\`${truncAddress(profile.walletAddress)}\`` : null],
      ['Avatar', profile?.profilePhotoUrl ? `\`${profile.profilePhotoUrl}\`` : null],
    ]),
    profile?.walletAddress ? code(profile.walletAddress) : null,
    `This name shows on the market detail page for any market you create, in place of the truncated wallet address.`,
    next('`/pnl-pitch` to post an idea under your new name.'),
  );
}
