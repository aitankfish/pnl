import { z } from 'zod';
import {
  createWallet,
  hasWallet,
  getAddress,
  getBalanceSol,
  loadConfig,
  unlockWith,
  WALLET_PATHS,
} from '../lib/wallet.js';
import { promptPassphrase } from '../lib/passphrase.js';
import { PublicKey } from '@solana/web3.js';

// ─── pnl_init ────────────────────────────────────────────────────
//
// First-run setup. Generates a BIP39 mnemonic, derives a Solana
// keypair at the Phantom-compatible path m/44'/501'/0'/0', encrypts
// the secret with the user's passphrase (scrypt + AES-256-GCM), and
// stores the encrypted blob on disk.
//
// The mnemonic is shown to the user ONCE and never stored on disk.
// They must back it up — that's the only recovery path.
//
// Passphrase source (in priority order):
//   1. PNL_PASSPHRASE env var (set in Claude Code mcp config)
//   2. OS-native dialog (osascript on macOS, zenity on Linux)
//   3. Throws with a clear message on unsupported platforms
//
// The passphrase NEVER comes through tool arguments (no chat
// exposure). Idempotent: calling pnl_init when a wallet exists
// returns the existing address without prompting.

export const initInputSchema = {} as const;

const InitInput = z.object(initInputSchema);

export async function callInit(rawInput: unknown) {
  InitInput.parse(rawInput ?? {});

  // If a wallet already exists, return the existing info — no prompt,
  // no surprises. The user can run pnl_export_keypair to back it up,
  // or pnl_restore to replace it with a different mnemonic.
  if (hasWallet()) {
    const address = getAddress();
    const config = loadConfig();
    let balanceLine: string;
    try {
      const sol = await getBalanceSol(new PublicKey(address));
      balanceLine = `Balance: ${sol.toFixed(4)} SOL`;
    } catch (e) {
      balanceLine = `(balance check failed — ${e instanceof Error ? e.message.slice(0, 80) : String(e)})`;
    }
    return {
      content: [
        {
          type: 'text' as const,
          text: [
            'PNL wallet already initialized on this machine.',
            '',
            `Address: ${address}`,
            balanceLine,
            `Autosign cap: ${config.autosignCapSol} SOL`,
            '',
            'To use the wallet for signing, call pnl_unlock — passphrase is read from your PNL_PASSPHRASE env var or via an OS-native dialog. Never type it directly in chat.',
            '',
            'Files:',
            `  encrypted wallet: ${WALLET_PATHS.wallet}`,
            `  exports: ${WALLET_PATHS.exports}`,
          ].join('\n'),
        },
      ],
    };
  }

  // Fresh setup. Pull the passphrase from env or pop the OS dialog.
  // With confirm: true the user types it twice to catch typos.
  const passphrase = promptPassphrase({
    title: 'PNL Wallet — Setup',
    prompt: 'Choose a passphrase for your new PNL wallet. You\'ll enter it again to confirm.',
    confirm: true,
  });

  const { address, mnemonic } = createWallet(passphrase);

  // Auto-unlock so the user can immediately use the wallet for the
  // current session without a second prompt.
  unlockWith(passphrase, 30);

  // Public balance check is best-effort; safe to skip if RPC is slow.
  let balanceLine = '';
  try {
    const sol = await getBalanceSol(new PublicKey(address));
    balanceLine = `Current balance: ${sol.toFixed(4)} SOL`;
  } catch {
    balanceLine = '';
  }

  const lines = [
    'PNL wallet created.',
    '',
    `Deposit address: ${address}`,
    `Phantom / Solflare deep-link: solana:${address}`,
    balanceLine,
    balanceLine ? '' : null,
    '────────────────────────────────────────────────────',
    'IMPORTANT — WRITE THIS DOWN NOW',
    '────────────────────────────────────────────────────',
    '',
    'Your 12-word recovery phrase (BIP39):',
    '',
    `    ${mnemonic}`,
    '',
    'This phrase is the ONLY way to recover your wallet if you',
    'lose access to this machine. Write it on paper and store',
    'it somewhere safe. Anyone who has this phrase can spend',
    'all funds on this wallet — never share it, never type it',
    'into a website, never store it in a screenshot or cloud',
    'note. Phantom / Solflare / Backpack will all accept this',
    'phrase under their "Import wallet" flows.',
    '',
    '────────────────────────────────────────────────────',
    '',
    'Next steps:',
    '  1. Save the phrase above to paper or a password manager.',
    '  2. Send at least 0.05 SOL to the deposit address from any',
    '     Solana wallet (Phantom, Solflare, exchange withdrawal).',
    '  3. The wallet is now unlocked for 30 minutes. After that, run',
    '     pnl_unlock to sign more transactions.',
    '',
    `Encrypted wallet file: ${WALLET_PATHS.wallet} (mode 0600)`,
    `Exports directory:     ${WALLET_PATHS.exports} (mode 0700)`,
  ]
    .filter((l) => l !== null)
    .join('\n');

  return {
    content: [{ type: 'text' as const, text: lines }],
  };
}
