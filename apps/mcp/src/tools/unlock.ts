import { z } from 'zod';
import { hasWallet, unlockWith, lock, unlockStatus } from '../lib/wallet.js';
import { promptPassphrase } from '../lib/passphrase.js';
import { Badge, headline, inline, next, reply, truncAddress } from '../lib/output.js';

// ─── pnl_unlock / pnl_lock ───────────────────────────────────────

export const unlockInputSchema = {
  ttlMinutes: z
    .number()
    .int()
    .min(1)
    .max(60)
    .optional()
    .describe(
      'How long to keep the wallet unlocked, in minutes. Default 5, max 60. The cached secret is wiped on TTL expiry, on pnl_lock, and on process exit.',
    ),
} as const;

const UnlockInput = z.object(unlockInputSchema);

export async function callUnlock(rawInput: unknown) {
  const { ttlMinutes } = UnlockInput.parse(rawInput ?? {});
  const ttl = ttlMinutes ?? 5;

  if (!hasWallet()) {
    return reply(
      headline('No PNL wallet to unlock.'),
      `Run ${inline('pnl_init')} first to create one, or ${inline('pnl_restore')} if you have a BIP39 mnemonic.`,
      next('`/pnl-init` or `/pnl-restore`.'),
    );
  }

  let passphrase: string;
  try {
    passphrase = promptPassphrase({
      title: 'PNL Wallet — Unlock',
      prompt: 'Enter your PNL wallet passphrase to unlock for signing:',
    });
  } catch (e) {
    return reply(
      headline(`${Badge.err} Couldn't read passphrase.`),
      e instanceof Error ? e.message : String(e),
    );
  }

  try {
    const { address } = unlockWith(passphrase, ttl);
    return reply(
      headline(`${Badge.unlocked} ${truncAddress(address)} unlocked for ${ttl}m`),
      `Signing tools (\`pnl_set_username\`, \`pnl_export_keypair\`, future write-prep) are available until lock expires.`,
      next('`/pnl-pitch` to post an idea, or `/pnl-lock` to wipe early.'),
    );
  } catch (e) {
    return reply(
      headline(`${Badge.err} Unlock failed.`),
      e instanceof Error ? e.message : String(e),
      next('Re-run `/pnl-unlock` to try again.'),
    );
  }
}

export const lockInputSchema = {} as const;

export async function callLock(_rawInput: unknown) {
  const before = unlockStatus();
  lock();
  return reply(
    headline(
      before.unlocked
        ? `${Badge.locked} Wallet locked. Cached secret wiped from memory.`
        : `${Badge.locked} Wallet was already locked.`,
    ),
    before.unlocked ? next('Run `/pnl-unlock` next time you need to sign.') : null,
  );
}
