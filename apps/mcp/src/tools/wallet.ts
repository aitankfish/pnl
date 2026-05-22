import { z } from 'zod';
import {
  getAddress,
  getBalanceSol,
  hasWallet,
  loadConfig,
  getRpcUrl,
  unlockStatus,
} from '../lib/wallet.js';
import { PublicKey } from '@solana/web3.js';

// ─── pnl_wallet ──────────────────────────────────────────────────
//
// Reports the local wallet's address, current balance, lock status,
// autosign cap, and active RPC URL. Read-only. Doesn't require the
// wallet to be unlocked — the public address is stored unencrypted
// alongside the encrypted secret.

export const walletInputSchema = {} as const;

export async function callWallet(_rawInput: unknown) {
  if (!hasWallet()) {
    return {
      content: [
        {
          type: 'text' as const,
          text: 'No PNL wallet on this machine yet. Run pnl_init — it generates a fresh BIP39 mnemonic, derives a Solana keypair, encrypts it with your passphrase, and shows you the deposit address.',
        },
      ],
    };
  }

  const address = getAddress();
  const config = loadConfig();
  const { unlocked, secondsRemaining } = unlockStatus();

  let balanceLine: string;
  try {
    const sol = await getBalanceSol(new PublicKey(address));
    balanceLine = `Balance: ${sol.toFixed(4)} SOL`;
  } catch (e) {
    balanceLine = `Balance: (lookup failed — ${e instanceof Error ? e.message.slice(0, 80) : String(e)})`;
  }

  const lockLine = unlocked
    ? `Status: UNLOCKED · ${Math.floor(secondsRemaining / 60)}m ${secondsRemaining % 60}s remaining`
    : 'Status: LOCKED — call pnl_unlock before signing.';

  return {
    content: [
      {
        type: 'text' as const,
        text: [
          `Address: ${address}`,
          balanceLine,
          lockLine,
          `Autosign cap: ${config.autosignCapSol} SOL`,
          `RPC: ${getRpcUrl()}`,
        ].join('\n'),
      },
    ],
  };
}
