import { z } from 'zod';
import { hasWallet, isUnlocked, exportToFile } from '../lib/wallet.js';

// ─── pnl_export_keypair ──────────────────────────────────────────
//
// Writes the wallet's secret key to a timestamped file under
// ~/.config/pnl/exports/ (mode 0600). Returns ONLY the file path to
// the agent — the secret itself never enters the chat transcript.
//
// The user opens the file with their editor / pastes it into a
// password manager / imports it into Phantom, then deletes the file.
//
// Requires:
//   1. Wallet to exist (pnl_init first)
//   2. Wallet to be unlocked (pnl_unlock first)
//   3. Explicit confirm: "EXPORT" argument so an agent can't dump
//      the secret to a file without the user asking
//
// Why a file instead of returning the key: chat transcripts get
// logged. The MCP server can write to a 0600 file on disk that only
// the user's processes can read, without the secret ever entering
// the conversation.

export const exportKeypairInputSchema = {
  confirm: z
    .literal('EXPORT')
    .describe(
      'Must be the literal string "EXPORT". This is a deliberate friction step — the user must say "yes, export my secret key" before the agent will dump it. Without this, the tool refuses.',
    ),
} as const;

const ExportKeypairInput = z.object(exportKeypairInputSchema);

export async function callExportKeypair(rawInput: unknown) {
  ExportKeypairInput.parse(rawInput ?? {});

  if (!hasWallet()) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'No PNL wallet on this machine — nothing to export. Run pnl_init first.',
        },
      ],
    };
  }
  if (!isUnlocked()) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'Wallet is locked. Call pnl_unlock first — the export operation needs the secret in memory. Your passphrase is read from PNL_PASSPHRASE env or via an OS-native dialog.',
        },
      ],
    };
  }

  try {
    const { path, address } = exportToFile();
    return {
      content: [
        {
          type: 'text' as const,
          text: [
            'Wallet exported to a file on disk.',
            '',
            `Address: ${address}`,
            `File:    ${path}`,
            '',
            'Open the file, copy both the base58 string (for Phantom / Solflare / Backpack) and the JSON array (for Solana CLI) into your password manager, then DELETE the file:',
            '',
            `    rm '${path}'`,
            '',
            'Anyone who reads this file can spend all SOL on the wallet. The file is mode 0600 (only your user can read it on this machine), but a backup tool that uploads ~/.config to cloud storage would expose it. Delete it as soon as you have the secret saved elsewhere.',
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
