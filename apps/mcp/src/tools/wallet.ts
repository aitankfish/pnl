import {
  getAddress,
  getBalanceSol,
  hasWallet,
  loadConfig,
  getRpcUrl,
  unlockStatus,
} from '../lib/wallet.js';
import { PublicKey } from '@solana/web3.js';
import { Badge, headline, kvTable, inline, truncAddress, next, reply } from '../lib/output.js';

// ─── pnl_wallet ──────────────────────────────────────────────────
//
// Read-only status snapshot. Address (truncated + full), balance,
// lock state, autosign cap, RPC. Doesn't require unlock.

export const walletInputSchema = {} as const;

export async function callWallet(_rawInput: unknown) {
  if (!hasWallet()) {
    return reply(
      headline('No PNL wallet on this machine yet.'),
      `Run ${inline('pnl_init')} to generate one — fresh BIP39 mnemonic, encrypted local keypair, deposit address ready in seconds.`,
      next(`Type \`/pnl-init\` or ask the agent to set up PNL.`),
    );
  }

  const address = getAddress();
  const config = loadConfig();
  const { unlocked, secondsRemaining } = unlockStatus();

  let balance: string;
  try {
    const sol = await getBalanceSol(new PublicKey(address));
    balance = `${sol.toFixed(4)} SOL`;
  } catch (e) {
    balance = `(lookup failed — ${e instanceof Error ? e.message.slice(0, 60) : 'network'})`;
  }

  const lockState = unlocked
    ? `${Badge.unlocked} ${Math.floor(secondsRemaining / 60)}m ${secondsRemaining % 60}s remaining`
    : `${Badge.locked} — run \`/pnl-unlock\` before signing`;

  return reply(
    headline(`${truncAddress(address)} · ${balance} · ${unlocked ? Badge.unlocked : Badge.locked}`),
    kvTable([
      ['Address', `\`${address}\``],
      ['Balance', balance],
      ['Status', lockState],
      ['Autosign cap', `${config.autosignCapSol} SOL`],
      ['RPC', `\`${getRpcUrl()}\``],
    ]),
    unlocked
      ? next('Pitch an idea with `/pnl-pitch` or vote with `/pnl-vote` (coming in Phase B).')
      : next('Run `/pnl-unlock` to enable signing.'),
  );
}
