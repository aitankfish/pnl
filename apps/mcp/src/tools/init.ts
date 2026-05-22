import { z } from 'zod';
import { generateKeypair, getBalanceSol, hasKeypair, loadKeypair, loadConfig, WALLET_PATHS } from '../lib/wallet.js';

// ─── pnl_init ────────────────────────────────────────────────────
//
// First-run setup. Generates a local Solana keypair (saved to
// ~/.config/pnl/keypair.json, mode 0600), then returns the public
// key as the deposit address for funding.
//
// Idempotent: calling it a second time without `regenerate: true`
// just returns the existing wallet info, so an agent can safely call
// it at the start of any conversation.

export const initInputSchema = {
  regenerate: z
    .boolean()
    .optional()
    .describe(
      'If true and a keypair already exists, the tool refuses to overwrite it without first running pnl_export_keypair (so the user can back up the seed). Default false — repeated calls return the existing wallet.',
    ),
} as const;

const InitInput = z.object(initInputSchema);

export async function callInit(rawInput: unknown) {
  InitInput.parse(rawInput ?? {});

  const existed = hasKeypair();
  const kp = existed ? loadKeypair() : generateKeypair();
  const pubkey = kp.publicKey.toBase58();
  const config = loadConfig();

  // Try to fetch balance, but don't block on a slow RPC — the user can
  // call pnl_wallet later to refresh.
  let balanceLine: string;
  try {
    const sol = await getBalanceSol(kp.publicKey);
    balanceLine = `Current balance: ${sol.toFixed(4)} SOL`;
  } catch (e) {
    balanceLine = `(balance check failed — ${e instanceof Error ? e.message.slice(0, 80) : String(e)})`;
  }

  const lines: string[] = [];
  if (existed) {
    lines.push('PNL wallet already initialized on this machine.');
  } else {
    lines.push('PNL wallet created.');
  }
  lines.push('');
  lines.push(`Deposit address: ${pubkey}`);
  lines.push(`Phantom / Solflare deep-link: solana:${pubkey}`);
  lines.push('');
  lines.push(balanceLine);
  lines.push('');
  if (!existed) {
    lines.push('Next steps:');
    lines.push('  1. Send at least 0.05 SOL to the address above from any Solana wallet');
    lines.push('     (Phantom, Solflare, Backpack, an exchange withdrawal, etc.).');
    lines.push('  2. Once funded, post ideas with pnl_pitch_idea or vote with pnl_vote.');
    lines.push('  3. Back up your seed any time with pnl_export_keypair { confirm: "EXPORT" }.');
    lines.push('');
    lines.push('Files:');
    lines.push(`  keypair: ${WALLET_PATHS.keypair} (mode 0600)`);
    lines.push(`  config:  ${WALLET_PATHS.config}`);
  }
  lines.push('');
  lines.push(`Autosign cap: ${config.autosignCapSol} SOL — transactions at or below this size sign automatically. Larger ones return a deep-link you confirm in your external wallet. Tune with pnl_set_autosign.`);

  return {
    content: [
      {
        type: 'text' as const,
        text: lines.join('\n'),
      },
    ],
  };
}
