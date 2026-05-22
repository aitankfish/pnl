import {
  Connection,
  Keypair,
  Transaction,
  TransactionSignature,
  SendOptions,
} from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { getConnection } from './wallet.js';

// ─── PNL MCP — transaction signing + send helpers ─────────────────
//
// The autosign create / vote flows fetch an unsigned transaction from
// the PNL backend (base64-encoded), sign it locally with the user's
// Keypair, then send it to the Solana cluster via our RPC.
//
// Keeping the surface small: one helper for partial-signing a
// base64 transaction, one for send-and-confirm, one for signing a
// raw challenge string (used by the sig-auth endpoints).

/** Decode a base64-encoded unsigned tx, partial-sign with the local
 *  Keypair, and return the fully-serialized signed transaction ready
 *  to be sent via Connection.sendRawTransaction.
 *
 *  Uses partialSign rather than sign so the tx can carry additional
 *  signers later (none today, but the shape generalizes). */
export function signSerializedTx(txBase64: string, keypair: Keypair): Buffer {
  const buf = Buffer.from(txBase64, 'base64');
  const tx = Transaction.from(buf);
  tx.partialSign(keypair);
  return tx.serialize();
}

export interface SendAndConfirmOptions extends SendOptions {
  /** Block-height based timeout for confirmation. Defaults to 60s.
   *  Solana blockhashes expire after ~60-90s, so this is the
   *  hard-stop for "will the tx still land". */
  confirmTimeoutMs?: number;
}

export interface SendResult {
  signature: TransactionSignature;
  /** Slot the tx landed in, if confirmation succeeded. */
  slot?: number;
}

/** Send a raw (already-signed) transaction and wait for it to confirm.
 *  Throws if the tx fails on-chain or if confirmation times out. */
export async function sendAndConfirm(
  rawTx: Buffer | Uint8Array,
  connection: Connection = getConnection(),
  opts: SendAndConfirmOptions = {},
): Promise<SendResult> {
  const { confirmTimeoutMs = 60_000, ...sendOpts } = opts;
  const signature = await connection.sendRawTransaction(rawTx, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 3,
    ...sendOpts,
  });

  // Use the latest blockhash + lastValidBlockHeight so confirmation
  // gives up exactly when the tx becomes unlandable, rather than
  // burning the full timeout on an already-expired tx.
  const latest = await connection.getLatestBlockhash('confirmed');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), confirmTimeoutMs);
  try {
    const result = await connection.confirmTransaction(
      {
        signature,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
        abortSignal: ctrl.signal,
      },
      'confirmed',
    );
    if (result.value.err) {
      throw new Error(`transaction failed on-chain: ${JSON.stringify(result.value.err)}`);
    }
  } finally {
    clearTimeout(timer);
  }

  // getSignatureStatuses for the landed slot — best-effort; never
  // block the caller on this.
  let slot: number | undefined;
  try {
    const status = await connection.getSignatureStatuses([signature]);
    slot = status.value[0]?.slot;
  } catch {
    /* ignore */
  }

  return { signature, slot };
}

/** Build a fresh nonce in the canonical "<unix-ms>-<hex>" format the
 *  /api/mcp/* endpoints expect. */
export function freshNonce(): string {
  const ms = Date.now();
  const random = nacl.randomBytes(8);
  const hex = Buffer.from(random).toString('hex');
  return `${ms}-${hex}`;
}

/** Sign a UTF-8 challenge string with the local Keypair and return a
 *  base58 signature suitable for the {walletAddress, nonce, signature}
 *  payload sent to /api/mcp/profile, /api/mcp/markets/complete-*. */
export function signChallenge(challenge: string, keypair: Keypair): string {
  const message = new TextEncoder().encode(challenge);
  const signature = nacl.sign.detached(message, keypair.secretKey);
  return bs58.encode(signature);
}

/** Re-export the canonical challenge string format so the MCP and the
 *  backend stay in lockstep. Mirrors apps/web/src/lib/mcp-auth.ts. */
export function challenge(
  kind: 'build-create' | 'build-vote' | 'complete-create' | 'complete-vote' | 'profile',
  fingerprint: string,
  nonce: string,
): string {
  return `pnl-mcp:${kind}:${fingerprint}:${nonce}`;
}
