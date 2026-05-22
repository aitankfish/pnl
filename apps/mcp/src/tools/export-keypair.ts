import { z } from 'zod';
import { exportSecret, hasKeypair, loadKeypair, WALLET_PATHS } from '../lib/wallet.js';

// ─── pnl_export_keypair ──────────────────────────────────────────
//
// Reveals the local Solana secret key in both formats supported by
// Phantom / Solflare / Backpack / the Solana CLI:
//   - base58 string  (paste into Phantom's "Import Private Key")
//   - 64-byte JSON array  (compatible with `solana config set --keypair`)
//
// Requires `confirm: "EXPORT"` — this prevents an agent from silently
// dumping the key without the user explicitly asking.

export const exportKeypairInputSchema = {
  confirm: z
    .literal('EXPORT')
    .describe(
      'Must be the literal string "EXPORT". This is a deliberate friction step — the user must say "yes, export my secret key" before the agent will reveal it. Without this, the tool refuses.',
    ),
} as const;

const ExportKeypairInput = z.object(exportKeypairInputSchema);

export async function callExportKeypair(rawInput: unknown) {
  ExportKeypairInput.parse(rawInput ?? {});

  if (!hasKeypair()) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'No PNL wallet on this machine yet — nothing to export. Run pnl_init first.',
        },
      ],
    };
  }

  const kp = loadKeypair();
  const { base58, jsonArray } = exportSecret(kp);

  const text = [
    'PNL secret key — TREAT THIS LIKE A PASSWORD.',
    '',
    `Public address: ${kp.publicKey.toBase58()}`,
    '',
    'Base58 (paste into Phantom "Import Private Key", Solflare, Backpack):',
    base58,
    '',
    'JSON array (Solana CLI format, save as keypair.json):',
    JSON.stringify(jsonArray),
    '',
    `Source file on disk: ${WALLET_PATHS.keypair}`,
    '',
    'Anyone with this key can spend the SOL on this wallet. Do not paste it into untrusted forms, screenshots, or chats — back it up to a password manager and clear your terminal scrollback after using.',
  ].join('\n');

  return {
    content: [{ type: 'text' as const, text }],
  };
}
