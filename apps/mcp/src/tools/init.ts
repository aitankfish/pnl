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
import {
  Badge,
  headline,
  kvTable,
  code,
  inline,
  next,
  reply,
  hr,
  heading,
  quote,
} from '../lib/output.js';

// ─── pnl_init ────────────────────────────────────────────────────
//
// First-run setup. BIP39 mnemonic + Ed25519 keypair at
// m/44'/501'/0'/0' (Phantom-compatible). Secret encrypted with
// scrypt + AES-256-GCM, stored at ~/.config/pnl/wallet.enc (0600).
// Passphrase pulled from PNL_PASSPHRASE env or OS-native dialog;
// the mnemonic is displayed once and never persisted.

export const initInputSchema = {} as const;

const InitInput = z.object(initInputSchema);

export async function callInit(rawInput: unknown) {
  InitInput.parse(rawInput ?? {});

  if (hasWallet()) {
    const address = getAddress();
    const config = loadConfig();
    let balance = '(unknown)';
    try {
      balance = `${(await getBalanceSol(new PublicKey(address))).toFixed(4)} SOL`;
    } catch {
      /* leave as unknown */
    }
    return reply(
      headline(`Wallet already initialized · ${balance}`),
      kvTable([
        ['Address', `\`${address}\``],
        ['Balance', balance],
        ['Autosign cap', `${config.autosignCapSol} SOL`],
        ['Wallet file', `\`${WALLET_PATHS.wallet}\``],
      ]),
      `To use the wallet for signing, run ${inline('/pnl-unlock')} — passphrase comes from your ${inline('PNL_PASSPHRASE')} env or an OS-native dialog. Never typed in chat.`,
      next('`/pnl-wallet` for current state, `/pnl-pitch` to post an idea.'),
    );
  }

  // Fresh setup. Two-prompt confirm to catch typos.
  const passphrase = promptPassphrase({
    title: 'PNL Wallet — Setup',
    prompt: 'Choose a passphrase for your new PNL wallet. You\'ll enter it again to confirm.',
    confirm: true,
  });

  const { address, mnemonic } = createWallet(passphrase);
  unlockWith(passphrase, 30); // auto-unlock for the next 30min

  let balanceLine = '';
  try {
    const sol = await getBalanceSol(new PublicKey(address));
    balanceLine = `${sol.toFixed(4)} SOL`;
  } catch {
    /* skip */
  }

  return reply(
    headline(`Wallet created ${Badge.ok}`),
    kvTable([
      ['Deposit address', `\`${address}\``],
      ['Phantom deep-link', `\`solana:${address}\``],
      balanceLine ? ['Balance', balanceLine] : (null as any),
      ['Status', `${Badge.unlocked} 30m`],
    ].filter((r): r is [string, string] => Array.isArray(r))),
    hr,
    heading('Write this down NOW — recovery phrase'),
    code(mnemonic),
    quote(
      'This 12-word phrase is the ONLY way to recover your wallet if you lose this machine. Paper or password manager only. Anyone with the phrase can spend the funds — never share it, never paste it into a website, never store it in a screenshot. Phantom / Solflare / Backpack will all import it.',
    ),
    hr,
    heading('Next'),
    [
      `1. Save the phrase above before continuing.`,
      `2. Fund the wallet by sending ≥ 0.05 SOL to the deposit address from any Solana wallet.`,
      `3. The wallet is unlocked for 30 minutes. After that, run \`/pnl-unlock\` to sign more transactions.`,
    ].join('\n'),
    `Files: ${inline(WALLET_PATHS.wallet)} (mode 0600) · ${inline(WALLET_PATHS.exports)} (mode 0700)`,
    next('`/pnl-wallet` to see the address again, `/pnl-pitch` once funded.'),
  );
}
