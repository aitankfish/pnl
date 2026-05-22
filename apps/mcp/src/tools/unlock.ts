import { z } from 'zod';
import { hasWallet, unlockWith, lock, unlockStatus } from '../lib/wallet.js';
import { promptPassphrase } from '../lib/passphrase.js';

// ─── pnl_unlock / pnl_lock ───────────────────────────────────────
//
// Two tools that gate every signing operation. The wallet is locked
// by default at process start. The user must explicitly unlock with
// their passphrase before any tool that signs (pnl_set_username,
// pnl_export_keypair, future Phase B autosign).
//
// Passphrase NEVER comes through tool args — it's pulled from the
// PNL_PASSPHRASE env var or via an OS-native dialog. The agent's
// chat transcript never sees it.
//
// Auto-locks after ttl_minutes (default 5, max 60). A new
// pnl_unlock call refreshes the TTL.

export const unlockInputSchema = {
  ttlMinutes: z
    .number()
    .int()
    .min(1)
    .max(60)
    .optional()
    .describe(
      'How long to keep the wallet unlocked in this MCP-server process, in minutes. Default 5. Max 60. The unlocked secret is wiped from memory on TTL expiry, on pnl_lock, and on process exit.',
    ),
} as const;

const UnlockInput = z.object(unlockInputSchema);

export async function callUnlock(rawInput: unknown) {
  const { ttlMinutes } = UnlockInput.parse(rawInput ?? {});
  const ttl = ttlMinutes ?? 5;

  if (!hasWallet()) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'No PNL wallet on this machine. Run pnl_init first, or pnl_restore if you have a BIP39 mnemonic from a previous machine.',
        },
      ],
    };
  }

  // promptPassphrase pulls from PNL_PASSPHRASE env or pops the OS
  // dialog. The agent never sees what the user types.
  let passphrase: string;
  try {
    passphrase = promptPassphrase({
      title: 'PNL Wallet — Unlock',
      prompt: 'Enter your PNL wallet passphrase to unlock for signing:',
    });
  } catch (e) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Couldn't read the passphrase. ${e instanceof Error ? e.message : String(e)}`,
        },
      ],
    };
  }

  try {
    const { address } = unlockWith(passphrase, ttl);
    return {
      content: [
        {
          type: 'text' as const,
          text: [
            `Wallet unlocked for ${ttl} minute${ttl === 1 ? '' : 's'}.`,
            `Address: ${address}`,
            'You can now sign transactions (pnl_set_username, pnl_export_keypair, future write-prep tools). Call pnl_lock to clear the cached secret early.',
          ].join('\n'),
        },
      ],
    };
  } catch (e) {
    return {
      content: [
        {
          type: 'text' as const,
          text: e instanceof Error ? e.message : String(e),
        },
      ],
    };
  }
}

export const lockInputSchema = {} as const;

export async function callLock(_rawInput: unknown) {
  const before = unlockStatus();
  lock();
  return {
    content: [
      {
        type: 'text' as const,
        text: before.unlocked
          ? 'Wallet locked. The cached secret has been wiped from memory. Sign again? Run pnl_unlock first.'
          : 'Wallet was already locked.',
      },
    ],
  };
}
