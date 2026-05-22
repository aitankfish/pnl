import { z } from 'zod';
import { getBalanceSol, hasKeypair, loadKeypair, loadConfig, getRpcUrl } from '../lib/wallet.js';

// ─── pnl_wallet ──────────────────────────────────────────────────
//
// Reports the local wallet's address, current balance, and current
// autosign cap. Read-only. Safe to call any time.

export const walletInputSchema = {} as const;

export async function callWallet(_rawInput: unknown) {
  if (!hasKeypair()) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'No PNL wallet on this machine yet. Run pnl_init to generate one — it produces a fresh Solana keypair locally and shows you the deposit address.',
        },
      ],
    };
  }

  const kp = loadKeypair();
  const pubkey = kp.publicKey.toBase58();
  const config = loadConfig();

  let balanceLine: string;
  try {
    const sol = await getBalanceSol(kp.publicKey);
    balanceLine = `Balance: ${sol.toFixed(4)} SOL`;
  } catch (e) {
    balanceLine = `Balance: (lookup failed — ${e instanceof Error ? e.message.slice(0, 80) : String(e)})`;
  }

  const text = [
    `Address: ${pubkey}`,
    balanceLine,
    `Autosign cap: ${config.autosignCapSol} SOL`,
    `RPC: ${getRpcUrl()}`,
  ].join('\n');

  return {
    content: [{ type: 'text' as const, text }],
  };
}
