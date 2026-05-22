import { z } from 'zod';
import { hasWallet, isUnlocked, exportToFile } from '../lib/wallet.js';
import { Badge, headline, code, inline, next, reply, quote, truncAddress } from '../lib/output.js';

export const exportKeypairInputSchema = {
  confirm: z
    .literal('EXPORT')
    .describe(
      'Must be the literal string "EXPORT". Deliberate friction step — the user has to explicitly ask before the agent will dump the secret.',
    ),
} as const;

const ExportKeypairInput = z.object(exportKeypairInputSchema);

export async function callExportKeypair(rawInput: unknown) {
  ExportKeypairInput.parse(rawInput ?? {});

  if (!hasWallet()) {
    return reply(
      headline(`${Badge.warn} No PNL wallet to export.`),
      `Run ${inline('/pnl-init')} first.`,
    );
  }
  if (!isUnlocked()) {
    return reply(
      headline(`${Badge.locked} Wallet is locked.`),
      `Export needs the secret in memory. Run \`/pnl-unlock\` first — passphrase comes from \`PNL_PASSPHRASE\` env or OS-native dialog.`,
      next('`/pnl-unlock`, then `/pnl-export`.'),
    );
  }

  try {
    const { path, address } = exportToFile();
    return reply(
      headline(`${Badge.ok} Exported · ${truncAddress(address)}`),
      `**File:**`,
      code(path),
      'Open the file, copy the contents into your password manager (it has both base58 for Phantom-import and the Solana CLI JSON array), then delete:',
      code(`rm '${path}'`, 'bash'),
      quote(
        'Anyone who reads this file can spend all SOL on the wallet. The file is mode 0600 (only your user can read it on this machine), but cloud-backup tools that sync ~/.config would expose it. Delete after the secret is in your password manager.',
      ),
      next('Save the secret, then `rm` the file.'),
    );
  } catch (e) {
    return reply(
      headline(`${Badge.err} Export failed.`),
      e instanceof Error ? e.message : String(e),
    );
  }
}
