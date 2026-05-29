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
import { pitchIdeaInputSchema } from './pitch-idea.js';
import { Badge, headline, code, kvTable, inline, next, reply, hr } from '../lib/output.js';

// ─── pnl_pitch_now ───────────────────────────────────────────────
//
// Autosign create_market. For stakes within the autosign cap, the
// MCP locally signs + sends the create_market tx, then calls
// /api/mcp/markets/complete-create to persist the Project +
// PredictionMarket docs. No browser bounce.
//
// Flow (six round-trips, ~6-12s end-to-end on mainnet):
//
//   1. requireUnlockedKeypair()          — fail fast if locked
//   2. balance check vs autosign cap     — fail before any I/O
//   3. POST /api/mcp/markets/build-create-tx
//                                        — pin IPFS, build unsigned tx
//   4. local sign + sendRawTransaction   — sign with the keypair, send
//                                          via configured RPC, confirm
//   5. sign canonical challenge          — for the complete-create call
//   6. POST /api/mcp/markets/complete-create
//                                        — persist + broadcast

// pnl_pitch_now accepts the same payload as pnl_pitch_idea plus an
// optional autosignCapSol override.
export const pitchNowInputSchema = {
  ...pitchIdeaInputSchema,
  autosignCapSol: z
    .number()
    .positive()
    .optional()
    .describe(
      'Optional cap override that can only LOWER the autosign limit for this call, never raise it. The ceiling is the cap from ~/.config/pnl/config.json (default 0.05 SOL). To raise the ceiling, the user must edit the config file directly — this arg cannot bypass it.',
    ),
} as const;

const PitchNowInput = z.object(pitchNowInputSchema);

function getApiBase(): string {
  const raw = process.env.PNL_API_BASE_URL?.trim();
  if (!raw) return 'https://pnl.market';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

interface BuildResponse {
  success: boolean;
  data?: {
    tx: string;
    ipfsCid: string;
    metadataUri: string;
    marketPda: string;
    marketVaultPda: string;
    treasuryPda: string;
    expiryTime: number;
    creationFee: number;
  };
  error?: string;
}

interface CompleteResponse {
  success: boolean;
  data?: {
    marketId: string;
    projectId: string;
    marketAddress: string;
    marketUrl: string;
    txSignature: string;
    solscan: string;
    alreadyExists?: boolean;
  };
  error?: string;
}

export async function callPitchNow(rawInput: unknown) {
  const input = PitchNowInput.parse(rawInput ?? {});

  // 1. Keypair (throws helpful "wallet locked" if unavailable).
  const keypair = requireUnlockedKeypair();
  const walletAddress = keypair.publicKey.toBase58();

  // 2. Balance check. We need at least the autosign cap available —
  //    the creation fee + tx fee combined are well under 0.02 SOL but
  //    we sanity-check against the user's configured cap to catch
  //    "wallet only has 0.001 SOL" before pinning IPFS.
  //
  //    Cap policy: the user's configured cap (~/.config/pnl/config.json)
  //    is the ceiling — the per-call autosignCapSol arg can only LOWER
  //    it, never raise. This blocks prompt-injection where a malicious
  //    project description coaxes the agent into passing a huge
  //    autosignCapSol to bypass the user-set ceiling. To raise the cap
  //    the user has to edit the config file themselves.
  const configCap = loadConfig().autosignCapSol;
  const cap = input.autosignCapSol != null
    ? Math.min(input.autosignCapSol, configCap)
    : configCap;
  const balance = await getBalanceSol(new PublicKey(walletAddress));
  if (balance < 0.02) {
    throw new Error(
      `Wallet balance ${balance.toFixed(4)} SOL is below the minimum ~0.02 SOL needed for create_market (creation fee ~0.015 + tx fee). Fund ${walletAddress} and try again.`,
    );
  }
  if (cap < 0.02) {
    throw new Error(
      `Autosign cap ${cap} SOL is below the minimum 0.02 SOL needed for create_market. Either raise the cap (autosignCapSol arg) or use pnl_pitch_idea for the deep-link flow.`,
    );
  }

  const base = getApiBase();

  // 3. Build unsigned tx server-side.
  const buildBody: Record<string, unknown> = {
    walletAddress,
    name: input.name,
    description: input.description,
    category: input.category,
    projectType: input.projectType,
    projectStage: input.projectStage,
    tokenSymbol: input.tokenSymbol.toUpperCase(),
    teamSize: input.teamSize,
    targetPoolSol: input.targetPoolSol,
    durationDays: input.durationDays,
  };
  if (input.projectImageUrl) buildBody.projectImageUrl = input.projectImageUrl;
  if (input.pitchVideoUrl) buildBody.pitchVideoUrl = input.pitchVideoUrl;
  if (input.twitterHandle) buildBody.socialLinks = { twitter: input.twitterHandle.replace(/^@/, '') };
  if (input.location) buildBody.location = input.location;

  const buildRes = await fetch(`${base}/api/mcp/markets/build-create-tx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(buildBody),
  });
  const buildJson = (await buildRes.json()) as BuildResponse;
  if (!buildRes.ok || !buildJson.success || !buildJson.data) {
    throw new Error(
      `build-create-tx failed (${buildRes.status}): ${buildJson.error || 'unknown error'}`,
    );
  }
  const built = buildJson.data;

  // Final cost check now that we have the actual creation fee from
  // the program config. cap is in SOL; creationFee is in lamports.
  const creationFeeSol = built.creationFee / LAMPORTS_PER_SOL;
  if (creationFeeSol > cap) {
    throw new Error(
      `create_market creation fee ${creationFeeSol.toFixed(4)} SOL exceeds autosign cap ${cap} SOL. Raise the cap with autosignCapSol arg or use pnl_pitch_idea for the deep-link flow.`,
    );
  }

  // Daily ceiling — see wallet.ts `reserveSpend`. Per-tx cap alone is
  // bypassable by chaining sub-cap calls; this caps the rolling total.
  // Reserved BEFORE sign; rolled back on send failure.
  reserveSpend(built.creationFee);
  let spendReleased = false;
  const releaseOnFailure = () => {
    if (!spendReleased) {
      try { releaseSpend(built.creationFee); } catch { /* best effort */ }
      spendReleased = true;
    }
  };

  // 4. Sign locally and send.
  let txSignature: string;
  try {
    const rawTx = signSerializedTx(built.tx, keypair);
    const sent = await sendAndConfirm(rawTx, getConnection(), {
      confirmTimeoutMs: 90_000,
    });
    txSignature = sent.signature;
  } catch (err) {
    releaseOnFailure();
    throw err;
  }

  // 5. Build the complete-create body first, then sign a challenge that
  //    folds in a SHA-256 of the body. The hash binds the sig to the
  //    exact payload — a captured sig cannot be replayed with a tampered
  //    project name / description / cid before our own complete-create
  //    call lands (5min nonce window).
  const nonce = freshNonce();
  const completeBodyCore = {
    txSignature,
    marketAddress: built.marketPda,
    ipfsCid: built.ipfsCid,
    metadataUri: built.metadataUri,
    targetPool: Math.floor(input.targetPoolSol * 1_000_000_000),
    expiryTime: built.expiryTime,
    payload: {
      name: input.name,
      description: input.description,
      category: input.category,
      projectType: input.projectType,
      projectStage: input.projectStage,
      tokenSymbol: input.tokenSymbol.toUpperCase(),
      teamSize: input.teamSize,
      targetPoolSol: input.targetPoolSol,
      durationDays: input.durationDays,
      location: input.location,
      projectImageUrl: input.projectImageUrl,
      pitchVideoUrl: input.pitchVideoUrl,
      socialLinks: input.twitterHandle
        ? { twitter: input.twitterHandle.replace(/^@/, '') }
        : undefined,
    },
    provenance: input.provenance,
  };
  const payloadHash = signedRequestHash(completeBodyCore);
  const sig = signChallenge(
    challenge('complete-create', txSignature, nonce, payloadHash),
    keypair,
  );

  // 6. Persist + broadcast via complete-create.
  const completeBody = {
    walletAddress,
    nonce,
    signature: sig,
    ...completeBodyCore,
  };

  const completeRes = await fetch(`${base}/api/mcp/markets/complete-create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(completeBody),
  });
  const completeJson = (await completeRes.json()) as CompleteResponse;
  if (!completeRes.ok || !completeJson.success || !completeJson.data) {
    // Tx confirmed on-chain but persistence failed. Surface the tx +
    // marketAddress so the market can be recovered via a direct
    // complete-create replay, then throw.
    //
    // Do NOT re-run pnl_pitch_now to recover: build-create-tx pins fresh
    // IPFS metadata (new timestamps) on every call, which yields a new
    // CID and therefore a new market PDA — a re-run mints a *second*
    // market and double-spends. complete-create is idempotent on
    // marketAddress, so recovery means replaying complete-create for THIS
    // marketAddress (${built.marketPda}) with the same txSignature + cid.
    throw new Error(
      `Tx confirmed on-chain (${txSignature}) but complete-create failed (${completeRes.status}): ${completeJson.error || 'unknown error'}. ` +
        `The market exists on Solana at ${built.marketPda} (cid ${built.ipfsCid}). ` +
        `Recover by replaying complete-create for this marketAddress — do NOT re-run pnl_pitch_now (it would mint a second market).`,
    );
  }
  const done = completeJson.data;

  return reply(
    headline(`${Badge.live} Market live · $${input.tokenSymbol.toUpperCase()} — ${input.name}`),
    kvTable([
      ['Market', `${base}${done.marketUrl}`],
      ['Token', `$${input.tokenSymbol.toUpperCase()}`],
      ['Target pool', `${input.targetPoolSol} SOL`],
      ['Duration', `${input.durationDays} days`],
      ['Stage', `${input.projectStage} · ${input.category}`],
      ['Founder', inline(walletAddress)],
      ['Creation fee', `${creationFeeSol.toFixed(4)} SOL`],
      input.provenance
        ? ['Provenance', `${input.provenance.source}${input.provenance.timestamp ? ' · ' + input.provenance.timestamp : ''}`]
        : (null as any),
      ['Tx', `[${txSignature.slice(0, 8)}…${txSignature.slice(-6)}](${done.solscan})`],
      done.alreadyExists ? ['Note', 'idempotent retry — market was already persisted'] : (null as any),
    ].filter((r): r is [string, string] => Array.isArray(r))),
    hr,
    `The MCP signed and sent the \`create_market\` transaction locally — no browser bounce needed because the cost (${creationFeeSol.toFixed(4)} SOL) was within the autosign cap (${cap} SOL).`,
    code(`Tx: ${txSignature}`),
    next(`Share the market URL or open ${inline(`${base}${done.marketUrl}`)} to watch the first votes come in.`),
  );
}
