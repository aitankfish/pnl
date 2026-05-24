import { z } from 'zod';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  requireUnlockedKeypair,
  loadConfig,
  getConnection,
  getBalanceSol,
  reserveSpend,
  releaseSpend,
} from '../lib/wallet.js';
import {
  signSerializedTx,
  sendAndConfirm,
  freshNonce,
  signChallenge,
  challenge,
  signedRequestHash,
} from '../lib/sign.js';
import { getMarket } from '../lib/pnl-api.js';
import { Badge, headline, code, kvTable, inline, next, reply, hr } from '../lib/output.js';

// ─── pnl_vote_now ────────────────────────────────────────────────
//
// Autosign buy_yes / buy_no. Same shape as pnl_pitch_now: build the
// unsigned tx server-side, sign + send locally, sig-auth complete-vote
// to write trade history + bump participant counts.

export const voteNowInputSchema = {
  marketId: z
    .string()
    .min(1)
    .describe(
      'Market id from pnl_browse_markets or pnl_get_market. Accepts either the Mongo id or the on-chain market address — we resolve to the on-chain address internally.',
    ),
  vote: z
    .enum(['yes', 'no'])
    .describe("'yes' to back the idea, 'no' to fade it. NO voters split the pool if NO wins."),
  amountSol: z
    .number()
    .positive()
    .describe('Stake in SOL. Minimum 0.01 SOL. Total cost is amount + ~0.000005 SOL Solana tx fee.'),
  autosignCapSol: z
    .number()
    .positive()
    .optional()
    .describe(
      'Optional cap override that can only LOWER the autosign limit for this call, never raise it. Ceiling is from ~/.config/pnl/config.json (default 0.05 SOL). Stakes above the (lowered) cap fail before any signing — use pnl_vote for the deep-link flow in that case.',
    ),
} as const;

const VoteNowInput = z.object(voteNowInputSchema);

function getApiBase(): string {
  const raw = process.env.PNL_API_BASE_URL?.trim();
  if (!raw) return 'https://pnl.market';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

interface BuildResponse {
  success: boolean;
  data?: {
    tx: string;
    positionPda: string;
    voteType: 'yes' | 'no';
    amountSol: number;
    lamports: number;
  };
  error?: string;
}

interface CompleteResponse {
  success: boolean;
  data?: {
    marketId: string;
    marketAddress: string;
    txSignature: string;
    solscan: string;
    voteType: 'yes' | 'no';
    amountSol: number;
    alreadyExists?: boolean;
  };
  error?: string;
}

export async function callVoteNow(rawInput: unknown) {
  const input = VoteNowInput.parse(rawInput ?? {});

  // Cap check before any I/O. The user's stake itself is the dominant
  // cost — Solana tx fees are ~5000 lamports (0.000005 SOL).
  //
  // Cap policy: the user's configured cap is the ceiling — the
  // per-call autosignCapSol arg can only LOWER it, never raise.
  // To raise the cap the user edits ~/.config/pnl/config.json directly.
  const configCap = loadConfig().autosignCapSol;
  const cap = input.autosignCapSol != null
    ? Math.min(input.autosignCapSol, configCap)
    : configCap;
  if (input.amountSol > cap) {
    throw new Error(
      `Stake ${input.amountSol} SOL exceeds autosign cap ${cap} SOL. Either raise the cap (autosignCapSol arg) or use pnl_vote for the browser deep-link flow.`,
    );
  }

  // Daily ceiling — see wallet.ts `reserveSpend`. Per-tx cap alone is
  // trivially bypassed by chaining N sub-cap calls; this enforces a
  // rolling total. Reserved BEFORE sign so racing autosign calls can't
  // each pass the check on a stale read. Rolled back on tx failure.
  const requiredLamports = Math.floor(input.amountSol * LAMPORTS_PER_SOL);
  reserveSpend(requiredLamports);
  let spendReleased = false;
  const releaseOnFailure = () => {
    if (!spendReleased) {
      try { releaseSpend(requiredLamports); } catch { /* best effort */ }
      spendReleased = true;
    }
  };

  const keypair = requireUnlockedKeypair();
  const walletAddress = keypair.publicKey.toBase58();
  const base = getApiBase();

  // Resolve marketId → on-chain address. The user-facing arg accepts
  // either the Mongo id (returned by pnl_browse_markets) or the
  // already-base58 market address; the on-chain build needs the
  // latter. /api/markets/<id> returns both so we can be flexible.
  let marketAddress: string;
  let onchainId: string;
  try {
    new PublicKey(input.marketId);
    marketAddress = input.marketId;
    onchainId = input.marketId; // assume the user supplied the on-chain one
    // For the complete-vote call we still want the Mongo id (it's what
    // /market/<id> uses + how participants are keyed). Look it up.
    const market = await getMarket(input.marketId);
    onchainId = market.id ?? input.marketId;
  } catch {
    // Not a valid base58 pubkey — treat as Mongo id.
    const market = await getMarket(input.marketId);
    if (!market.marketAddress) {
      throw new Error(`market ${input.marketId} has no marketAddress — cannot autosign vote`);
    }
    marketAddress = market.marketAddress;
    onchainId = market.id ?? input.marketId;
  }

  // Balance sanity-check.
  const balance = await getBalanceSol(new PublicKey(walletAddress));
  const required = input.amountSol + 0.001; // stake + comfortable tx-fee buffer
  if (balance < required) {
    throw new Error(
      `Wallet balance ${balance.toFixed(4)} SOL is below the ${required.toFixed(4)} SOL needed (stake + fee buffer). Fund ${walletAddress} and try again.`,
    );
  }

  let txSignature: string;
  try {
    // 1. build-vote-tx
    const buildRes = await fetch(`${base}/api/mcp/markets/build-vote-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        walletAddress,
        marketAddress,
        voteType: input.vote,
        amountSol: input.amountSol,
      }),
    });
    const buildJson = (await buildRes.json()) as BuildResponse;
    if (!buildRes.ok || !buildJson.success || !buildJson.data) {
      throw new Error(
        `build-vote-tx failed (${buildRes.status}): ${buildJson.error || 'unknown error'}`,
      );
    }
    const built = buildJson.data;

    // 2. sign + send locally
    const rawTx = signSerializedTx(built.tx, keypair);
    const sent = await sendAndConfirm(rawTx, getConnection(), {
      confirmTimeoutMs: 90_000,
    });
    txSignature = sent.signature;
  } catch (err) {
    // Build/sign/send failed → tx never landed → roll back the reservation
    // so the user keeps their daily budget for the retry.
    releaseOnFailure();
    throw err;
  }

  // 3. Build complete-vote body, hash it into the challenge, sign.
  //    The hash binds the sig to voteType + amountSol + marketId so an
  //    attacker who captures the sig within the nonce window cannot
  //    rewrite the side or amount on the persisted trade row.
  const nonce = freshNonce();
  const completeBodyCore = {
    txSignature,
    marketId: onchainId,
    voteType: input.vote,
    amountSol: input.amountSol,
  };
  const payloadHash = signedRequestHash(completeBodyCore);
  const sig = signChallenge(
    challenge('complete-vote', txSignature, nonce, payloadHash),
    keypair,
  );
  const completeRes = await fetch(`${base}/api/mcp/markets/complete-vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      walletAddress,
      nonce,
      signature: sig,
      ...completeBodyCore,
    }),
  });
  const completeJson = (await completeRes.json()) as CompleteResponse;
  if (!completeRes.ok || !completeJson.success || !completeJson.data) {
    throw new Error(
      `Tx confirmed on-chain (${txSignature}) but complete-vote failed (${completeRes.status}): ${completeJson.error || 'unknown error'}. The on-chain vote is recorded — re-running pnl_vote_now with the same args is idempotent on the tx signature.`,
    );
  }
  const done = completeJson.data;

  const side = input.vote === 'yes' ? 'YES' : 'NO';
  const sideHint =
    input.vote === 'yes'
      ? '(backing the idea)'
      : "(fading the idea — split the pool with other critics if NO wins)";

  return reply(
    headline(`${Badge.live} ${side} ${input.amountSol} SOL recorded`),
    kvTable([
      ['Market', `${base}/market/${onchainId}`],
      ['Side', `${side} ${sideHint}`],
      ['Stake', `${input.amountSol} SOL`],
      ['Wallet', inline(walletAddress)],
      ['Tx', `[${txSignature.slice(0, 8)}…${txSignature.slice(-6)}](${done.solscan})`],
      done.alreadyExists ? ['Note', 'idempotent retry — vote was already recorded'] : (null as any),
    ].filter((r): r is [string, string] => Array.isArray(r))),
    hr,
    `The MCP signed and sent the \`buy_${input.vote}\` transaction locally — no browser bounce needed because the stake (${input.amountSol} SOL) was within the autosign cap (${cap} SOL).`,
    code(`Tx: ${txSignature}`),
    next(`Check pool movement at ${inline(`${base}/market/${onchainId}`)}.`),
  );
}
