import {
  Connection,
  Keypair,
  Transaction,
  TransactionSignature,
  SendOptions,
} from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { createHash } from 'node:crypto';
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
  /** How many times to poll getSignatureStatuses if confirmTransaction
   *  rejects, before declaring the tx genuinely unlanded. Default 6. */
  confirmFallbackAttempts?: number;
  /** Delay between fallback signature-status polls, in ms. Default 2000. */
  confirmFallbackIntervalMs?: number;
}

export interface SendResult {
  signature: TransactionSignature;
  /** Slot the tx landed in, if confirmation succeeded. */
  slot?: number;
}

/** Authoritative "did this signature actually land?" check.
 *
 *  `confirmTransaction` rejecting (block-height exceeded, abort/timeout,
 *  or a transient RPC hiccup) means web3.js *stopped watching* — it is
 *  NOT proof the tx failed. The tx can be on-chain already. We poll
 *  `getSignatureStatuses` (with history search, since the tx may have
 *  rolled out of the recent-status cache) before declaring failure.
 *
 *  Returns the status when the signature is found on-chain (whether it
 *  succeeded or carries an err), or null if it's still nowhere to be
 *  seen after the grace window. */
async function confirmViaSignatureStatus(
  connection: Connection,
  signature: TransactionSignature,
  attempts = 6,
  intervalMs = 2_000,
): Promise<{ err: unknown; slot?: number } | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const { value } = await connection.getSignatureStatuses([signature], {
        searchTransactionHistory: true,
      });
      const st = value[0];
      if (st) {
        const landed =
          st.err != null ||
          st.confirmationStatus === 'confirmed' ||
          st.confirmationStatus === 'finalized' ||
          // `confirmations === null` means rooted/finalized.
          st.confirmations === null;
        if (landed) return { err: st.err, slot: st.slot };
      }
    } catch {
      /* transient RPC error — retry */
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

/** Send a raw (already-signed) transaction and wait for it to confirm.
 *  Throws if the tx fails on-chain or if confirmation times out.
 *
 *  Confirmation is two-tier: the fast path uses `confirmTransaction`
 *  with a blockhash-expiry deadline; if that rejects (the common
 *  "block height exceeded" on a laggy/rate-limited RPC) we fall back to
 *  an authoritative signature-status poll. A rejection from
 *  `confirmTransaction` is "I stopped watching", not "the tx failed", so
 *  treating it as fatal previously stranded txs that had actually landed
 *  (paid create_market on-chain, never persisted off-chain). */
export async function sendAndConfirm(
  rawTx: Buffer | Uint8Array,
  connection: Connection = getConnection(),
  opts: SendAndConfirmOptions = {},
): Promise<SendResult> {
  const {
    confirmTimeoutMs = 60_000,
    confirmFallbackAttempts = 6,
    confirmFallbackIntervalMs = 2_000,
    ...sendOpts
  } = opts;
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

  // Fast path. The try/catch wraps ONLY confirmTransaction: a *rejection*
  // (block height exceeded / abort / RPC hiccup) means "stopped watching"
  // and triggers the fallback poll. A *resolution* carrying an err is a
  // definitive on-chain failure and must throw straight through, never
  // get relabeled "could not be confirmed".
  let result;
  try {
    result = await connection.confirmTransaction(
      {
        signature,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
        abortSignal: ctrl.signal,
      },
      'confirmed',
    );
  } catch (err) {
    clearTimeout(timer);
    // Ask the chain directly whether the signature landed before treating
    // this as a failure — the guard against the "expired: block height
    // exceeded" false negative that strands paid txs.
    const onChain = await confirmViaSignatureStatus(
      connection,
      signature,
      confirmFallbackAttempts,
      confirmFallbackIntervalMs,
    );
    if (onChain) {
      if (onChain.err != null) {
        throw new Error(`transaction failed on-chain: ${JSON.stringify(onChain.err)}`);
      }
      // Landed despite the confirmation reject — return success so the
      // caller proceeds to persistence (complete-create) instead of
      // stranding a paid tx.
      return { signature, slot: onChain.slot };
    }
    // Genuinely not on-chain after the grace window. Surface the
    // signature and warn against a blind resend (create_market derives a
    // fresh PDA per build, so resending would mint a *second* market).
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Transaction ${signature} could not be confirmed (${reason}). ` +
        `It may still land — check the signature on-chain before retrying. ` +
        `Do NOT blindly resend a create_market: it would mint a second market and double-spend.`,
    );
  }
  clearTimeout(timer);

  if (result.value.err) {
    throw new Error(`transaction failed on-chain: ${JSON.stringify(result.value.err)}`);
  }

  // Confirmed cleanly. Best-effort slot lookup.
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
 *  backend stay in lockstep. Mirrors apps/web/src/lib/mcp-auth.ts.
 *  When payloadHash is supplied, the sig binds to the request body —
 *  see signedRequestHash() below. */
export function challenge(
  kind:
    | 'build-create'
    | 'build-vote'
    | 'build-claim'
    | 'complete-create'
    | 'complete-vote'
    | 'complete-claim'
    | 'profile',
  fingerprint: string,
  nonce: string,
  payloadHash?: string,
): string {
  if (payloadHash) {
    return `pnl-mcp:${kind}:${fingerprint}:${payloadHash}:${nonce}`;
  }
  return `pnl-mcp:${kind}:${fingerprint}:${nonce}`;
}

/** Canonical JSON: keys sorted, no whitespace, recursive. Matches
 *  apps/web/src/lib/mcp-auth.ts (and JSON.stringify's handling of
 *  `undefined`) so both sides hash identical bytes regardless of
 *  whether the body has been through JSON serialization yet. */
function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJson).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  // Drop undefined-valued keys (mirrors JSON.stringify) so the body
  // we hash before sending matches the body the backend receives.
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') +
    '}'
  );
}

/** SHA-256 of the request body minus auth fields (walletAddress,
 *  nonce, signature) — first 16 hex chars. Both MCP-side (before
 *  signing) and backend (verifying) compute the same hash so the sig
 *  is bound to the exact payload. Tampering with any payload field
 *  invalidates the sig. */
export function signedRequestHash(body: Record<string, unknown>): string {
  const { walletAddress: _w, nonce: _n, signature: _s, ...payload } = body;
  void _w; void _n; void _s;
  return createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex').slice(0, 16);
}
