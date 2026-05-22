import { z } from 'zod';
import { hasWallet, restoreWallet, isValidMnemonic, unlockWith } from '../lib/wallet.js';
import { promptPassphrase } from '../lib/passphrase.js';
import { Badge, headline, next, reply, truncAddress, inline } from '../lib/output.js';

export const restoreInputSchema = {
  mnemonic: z
    .string()
    .min(1)
    .describe(
      'The 12 or 24 word BIP39 phrase from pnl_init. Standard recovery format Phantom / Solflare / Backpack / Solana CLI all accept.',
    ),
  allowOverwrite: z
    .boolean()
    .optional()
    .describe(
      'Set to true to replace an existing wallet on this machine. Default false — refuses if one exists so the user can back it up first with pnl_export_keypair.',
    ),
} as const;

const RestoreInput = z.object(restoreInputSchema);

export async function callRestore(rawInput: unknown) {
  const { mnemonic, allowOverwrite } = RestoreInput.parse(rawInput ?? {});

  if (!isValidMnemonic(mnemonic.trim())) {
    return reply(
      headline(`${Badge.err} Not a valid BIP39 phrase.`),
      'Check spelling, word count (must be 12 or 24), and that all words are from the BIP39 wordlist.',
      next('Re-run `/pnl-restore` with the correct phrase.'),
    );
  }

  if (hasWallet() && !allowOverwrite) {
    return reply(
      headline(`${Badge.warn} A wallet already exists on this machine.`),
      `Refusing to overwrite. Back it up first with ${inline('pnl_export_keypair')}, then call \`pnl_restore\` again with \`allowOverwrite: true\`.`,
      next('`/pnl-export` to back up, then re-run `/pnl-restore`.'),
    );
  }

  let passphrase: string;
  try {
    passphrase = promptPassphrase({
      title: 'PNL Wallet — Restore',
      prompt: 'Choose a passphrase to encrypt the restored wallet on this machine.',
      confirm: true,
    });
  } catch (e) {
    return reply(
      headline(`${Badge.err} Couldn't read passphrase.`),
      e instanceof Error ? e.message : String(e),
    );
  }

  try {
    const { address } = restoreWallet(mnemonic.trim(), passphrase, {
      allowOverwrite: !!allowOverwrite,
    });
    unlockWith(passphrase, 30);
    return reply(
      headline(`${Badge.ok} Restored · ${truncAddress(address)} · unlocked 30m`),
      `On-chain history is preserved — markets, votes, balances tied to this address are visible immediately.`,
      `Full address: \`${address}\``,
      next('`/pnl-wallet` to see balance, `/pnl-pitch` to post an idea.'),
    );
  } catch (e) {
    return reply(
      headline(`${Badge.err} Restore failed.`),
      e instanceof Error ? e.message : String(e),
    );
  }
}
