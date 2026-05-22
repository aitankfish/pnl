import { hasWallet, unlockStatus } from '../lib/wallet.js';
import { Badge, headline, table, heading, next, reply } from '../lib/output.js';

// ─── pnl_help ────────────────────────────────────────────────────
//
// Discoverability tool. Lists every PNL command + the typical flow
// a new user follows. Surfaces context-aware suggestions based on
// current state (does the user have a wallet? is it unlocked?).

export const helpInputSchema = {} as const;

export async function callHelp(_rawInput: unknown) {
  const wallet = hasWallet();
  const { unlocked } = wallet ? unlockStatus() : { unlocked: false };

  let situation: string;
  let nextHint: string;
  if (!wallet) {
    situation = 'No wallet on this machine yet.';
    nextHint = '`/pnl-init` to create one (or `/pnl-restore` if you have a BIP39 phrase).';
  } else if (!unlocked) {
    situation = `Wallet exists · ${Badge.locked}`;
    nextHint = '`/pnl-unlock` to enable signing, or `/pnl-pitch` to draft an idea (no unlock needed).';
  } else {
    situation = `Wallet exists · ${Badge.unlocked}`;
    nextHint = '`/pnl-pitch` to post an idea, `/pnl-wallet` for balance, `/pnl-browse` to see what\'s live.';
  }

  return reply(
    headline('PNL on the terminal — command reference'),
    `**Now:** ${situation}`,
    heading('Wallet (local, encrypted, BIP39-recoverable)'),
    table(
      ['Command', 'What it does'],
      [
        ['`/pnl-init`', 'First-run: generate keypair + 12-word mnemonic, encrypt with passphrase'],
        ['`/pnl-wallet`', 'Address, balance, lock status, autosign cap (no unlock needed)'],
        ['`/pnl-unlock`', 'Decrypt secret in memory for 5m (default). Passphrase via OS dialog or env'],
        ['`/pnl-lock`', 'Wipe cached secret immediately'],
        ['`/pnl-restore`', 'Rebuild wallet on a new machine from a BIP39 mnemonic'],
        ['`/pnl-export`', 'Write secret to a 0600 file for password-manager backup (never to chat)'],
      ],
    ),
    heading('Identity'),
    table(
      ['Command', 'What it does'],
      [
        ['`/pnl-name`', 'Claim or rename your PNL username (signature-auth, no Privy / no email)'],
      ],
    ),
    heading('Markets'),
    table(
      ['Command', 'What it does'],
      [
        ['`/pnl-browse`', 'List live conviction markets — YES%, pool, votes, founder'],
        ['`/pnl-pitch`', 'Draft a market from current conversation context, return deep-link to confirm'],
        ['`/pnl-vote`', 'Stake YES or NO on an existing market (deep-link to confirm in wallet)'],
      ],
    ),
    heading('Typical first run'),
    [
      '1. `/pnl-init` — set up wallet, write down the 12-word phrase',
      '2. Send ≥ 0.05 SOL to the deposit address from Phantom / Solflare / exchange',
      '3. `/pnl-unlock` — passphrase via OS dialog (or set `PNL_PASSPHRASE` in mcp config)',
      '4. `/pnl-name` — pick a username',
      '5. `/pnl-pitch` — post your first idea',
    ].join('\n'),
    next(nextHint),
  );
}
