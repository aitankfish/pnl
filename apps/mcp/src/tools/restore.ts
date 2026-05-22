import { z } from 'zod';
import { hasWallet, restoreWallet, isValidMnemonic, unlockWith } from '../lib/wallet.js';
import { promptPassphrase } from '../lib/passphrase.js';

// ─── pnl_restore ─────────────────────────────────────────────────
//
// Rebuild a PNL wallet from an existing BIP39 12 / 24-word mnemonic.
// Used when the user is setting up PNL on a new machine and already
// has the recovery phrase from a previous pnl_init.
//
// Mnemonic is accepted as a tool argument because:
//   - It's typed once per machine setup
//   - The user explicitly chooses to expose it (they're restoring,
//     not creating new). This is the standard wallet-restore flow.
// The passphrase, however, still comes from env / OS dialog — never
// through tool args.
//
// If a wallet already exists at the standard path, restore refuses
// unless allowOverwrite: true. This prevents an agent (or a confused
// user) from clobbering an existing wallet on accident.

export const restoreInputSchema = {
  mnemonic: z
    .string()
    .min(1)
    .describe(
      'The 12 or 24 word BIP39 phrase from pnl_init. Words separated by spaces, case-insensitive. The standard recovery phrase format used by Phantom, Solflare, Backpack, and Solana CLI.',
    ),
  allowOverwrite: z
    .boolean()
    .optional()
    .describe(
      'Set to true to replace an existing wallet on this machine. Default false — refuses if a wallet already exists, so the user can back it up first with pnl_export_keypair.',
    ),
} as const;

const RestoreInput = z.object(restoreInputSchema);

export async function callRestore(rawInput: unknown) {
  const { mnemonic, allowOverwrite } = RestoreInput.parse(rawInput ?? {});

  if (!isValidMnemonic(mnemonic.trim())) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'That doesn\'t look like a valid BIP39 phrase. Check spelling, word count (must be 12 or 24), and that all words are from the BIP39 wordlist.',
        },
      ],
    };
  }

  if (hasWallet() && !allowOverwrite) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'A PNL wallet already exists on this machine. Refusing to overwrite without explicit consent — call pnl_export_keypair to back it up first, then call pnl_restore again with allowOverwrite: true.',
        },
      ],
    };
  }

  let passphrase: string;
  try {
    passphrase = promptPassphrase({
      title: 'PNL Wallet — Restore',
      prompt: 'Choose a passphrase to encrypt the restored wallet on this machine.',
      confirm: true,
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
    const { address } = restoreWallet(mnemonic.trim(), passphrase, {
      allowOverwrite: !!allowOverwrite,
    });
    // Auto-unlock for the rest of the current session.
    unlockWith(passphrase, 30);

    return {
      content: [
        {
          type: 'text' as const,
          text: [
            'Wallet restored from mnemonic.',
            '',
            `Address: ${address}`,
            'Unlocked for 30 minutes. You can use pnl_set_username, pnl_export_keypair, and future signing tools immediately.',
            '',
            'On-chain history is preserved — any markets, votes, or balances tied to this wallet address will already be visible. Run pnl_wallet to see the current balance.',
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
