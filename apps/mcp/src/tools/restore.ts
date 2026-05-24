import { z } from 'zod';
import {
  hasWallet,
  restoreWallet,
  isValidMnemonic,
  keypairFromMnemonic,
  unlockWith,
  getAddress,
} from '../lib/wallet.js';
import { promptPassphrase } from '../lib/passphrase.js';
import { promptMnemonic, confirmOverwrite } from '../lib/mnemonic.js';
import { Badge, headline, next, reply, truncAddress, inline } from '../lib/output.js';

// Tool input: intentionally NO `mnemonic` field. The seed phrase is the
// most sensitive secret in PNL — passing it as a tool argument would
// leak it into the agent's chat transcript (Claude Code history,
// Anthropic API logs, anywhere the conversation is exported). Instead,
// the user types it into an OS-native dialog (`promptMnemonic`), same
// pattern as the wallet passphrase.
//
// We also no longer accept `allowOverwrite` from the agent. Overwriting
// an existing wallet is irreversible; prompt-injection could trick the
// agent into passing `allowOverwrite: true` on attacker-controlled
// metadata. The user has to click "Replace wallet" in an OS dialog
// (`confirmOverwrite`) — something the agent cannot synthesize.
export const restoreInputSchema = {} as const;

const RestoreInput = z.object(restoreInputSchema).strict();

export async function callRestore(rawInput: unknown) {
  RestoreInput.parse(rawInput ?? {});

  let mnemonic: string;
  try {
    mnemonic = promptMnemonic({
      title: 'PNL Wallet — Restore',
      prompt: 'Enter your 12 or 24 word recovery phrase (words separated by spaces):',
    });
  } catch (e) {
    return reply(
      headline(`${Badge.err} Couldn't read recovery phrase.`),
      e instanceof Error ? e.message : String(e),
    );
  }

  const trimmed = mnemonic.trim();
  if (!isValidMnemonic(trimmed)) {
    return reply(
      headline(`${Badge.err} Not a valid BIP39 phrase.`),
      'Check spelling, word count (must be 12 or 24), and that all words are from the BIP39 wordlist.',
      next('Re-run `/pnl-restore` and re-enter the phrase carefully.'),
    );
  }

  // If a wallet already exists, surface an OS-native YES/NO dialog
  // showing both addresses. Only proceed if the user clicks "Replace".
  if (hasWallet()) {
    const oldAddress = getAddress();
    let newAddress: string;
    try {
      newAddress = keypairFromMnemonic(trimmed).publicKey.toBase58();
    } catch (e) {
      return reply(
        headline(`${Badge.err} Couldn't derive address from phrase.`),
        e instanceof Error ? e.message : String(e),
      );
    }
    if (oldAddress === newAddress) {
      return reply(
        headline(`${Badge.warn} Recovery phrase matches the existing wallet.`),
        `Already restored to ${truncAddress(oldAddress)} — nothing to do.`,
        next(`${inline('/pnl-wallet')} to see balance.`),
      );
    }
    const ok = confirmOverwrite(oldAddress, newAddress);
    if (!ok) {
      return reply(
        headline(`${Badge.warn} Replace cancelled.`),
        `Existing wallet ${truncAddress(oldAddress)} kept intact.`,
        `Back up the old wallet first with ${inline('pnl_export_keypair')}, then re-run ${inline('/pnl-restore')} if you really want to swap.`,
      );
    }
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
    const { address } = restoreWallet(trimmed, passphrase, { allowOverwrite: true });
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
