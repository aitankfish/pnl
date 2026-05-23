import { z } from 'zod';
import {
  createWallet,
  hasWallet,
  getAddress,
  getBalanceSol,
  loadConfig,
  unlockWith,
  isUsingHostedRpc,
  writeMnemonicToFile,
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

  // The 12-word recovery phrase is the keys to the wallet. We MUST NOT
  // return it in the agent's reply — that text would flow through the
  // LLM API + sit in Claude Code's session transcript on disk. Instead,
  // write it to a 0600 file and tell the user the path so they can
  // `cat` it locally + move it to their password manager + delete.
  const { path: mnemonicPath } = writeMnemonicToFile(mnemonic, address);

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
    heading('Recovery phrase — written to disk, NOT shown here'),
    `The 12-word BIP39 recovery phrase was written to ${inline(mnemonicPath)} (mode 0600). Open the file locally to read it — it is NOT in this transcript by design, because anything in this reply flows through the LLM API + is logged by Claude Code.`,
    code(`cat "${mnemonicPath}"`),
    quote(
      'This 12-word phrase is the ONLY way to recover your wallet if you lose this machine. After you have moved it to a password manager / paper backup, DELETE the file: `rm "' + mnemonicPath + '"`. Anyone with the phrase can spend the funds.',
    ),
    hr,
    heading('Next'),
    [
      `1. \`cat\` the recovery file above and move the 12 words to your password manager / paper backup.`,
      `2. ${inline(`rm "${mnemonicPath}"`)} when you are done so the cleartext mnemonic is not sitting in \`~/.config/pnl/exports/\`.`,
      `3. Fund the wallet by sending ≥ 0.05 SOL to the deposit address from any Solana wallet.`,
      `4. The wallet is unlocked for 30 minutes. After that, run \`/pnl-unlock\` to sign more transactions.`,
    ].join('\n'),
    isUsingHostedRpc()
      ? `_RPC: pnl.market (hosted) — heavy use? Grab a free Helius key at helius.dev and set ${inline('PNL_RPC_URL')} in your Claude Code mcp config to skip the shared rate limit._`
      : null,
    `Files: ${inline(WALLET_PATHS.wallet)} (mode 0600) · ${inline(WALLET_PATHS.exports)} (mode 0700)`,
    next('`/pnl-wallet` to see the address again, `/pnl-pitch` once funded.'),
  );
}
