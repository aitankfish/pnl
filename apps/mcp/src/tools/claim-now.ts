import { z } from 'zod';
import { PublicKey } from '@solana/web3.js';
import { requireUnlockedKeypair, getConnection } from '../lib/wallet.js';
import {
  sendAndConfirm,
  freshNonce,
  signChallenge,
  challenge,
} from '../lib/sign.js';
import { getMarket } from '../lib/pnl-api.js';
import { Badge, headline, code, kvTable, inline, next, reply, hr } from '../lib/output.js';

// ─── pnl_claim_now ───────────────────────────────────────────────
//
// Autosign claim_rewards. Resolves marketId → on-chain market
// address, asks the backend to build the unsigned claim tx, signs
// locally, sends, and posts the result via /api/mcp/markets/complete-claim.
//
// Unlike pitch_now and vote_now, there is NO autosign cap on claims:
// claiming is a withdrawal of funds the user is already owed by the
// program — it doesn't spend anything besides the ~0.000005 SOL tx
// fee. Capping it would gate the user from their own money.

export const claimNowInputSchema = {
  marketId: z
    .string()
    .min(1)
    .describe(
      "Market id (Mongo id from pnl_browse_markets, or the on-chain market address). The market must be resolved and the wallet must hold an unclaimed position.",
    ),
} as const;

const ClaimNowInput = z.object(claimNowInputSchema);

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
    resolutionType: 'YesWins' | 'NoWins' | 'Refund';
    lastValidBlockHeight: number;
  };
  error?: string;
}

interface CompleteResponse {
  success: boolean;
  data?: {
    marketId: string;
    txSignature: string;
    solscan: string;
    claimAmount?: number;
    participantMatched?: boolean;
  };
  error?: string;
}

export async function callClaimNow(rawInput: unknown) {
  const { marketId } = ClaimNowInput.parse(rawInput ?? {});

  const keypair = requireUnlockedKeypair();
  const walletAddress = keypair.publicKey.toBase58();
  const base = getApiBase();

  // Resolve marketId → on-chain marketAddress + Mongo id.
  let marketAddress: string;
  let onchainId: string;
  let marketName = marketId;
  try {
    new PublicKey(marketId);
    // Caller gave us the on-chain address. We still need the Mongo id
    // for the complete-claim payload, so resolve via the public API.
    const m = await getMarket(marketId);
    marketAddress = marketId;
    onchainId = m.id ?? marketId;
    marketName = m.name ?? marketId;
  } catch {
    const m = await getMarket(marketId);
    if (!m.marketAddress) throw new Error(`market ${marketId} has no marketAddress`);
    marketAddress = m.marketAddress;
    onchainId = m.id ?? marketId;
    marketName = m.name ?? marketId;
  }

  // 1. build-claim-tx
  const buildRes = await fetch(`${base}/api/mcp/markets/build-claim-tx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ walletAddress, marketAddress }),
  });
  const buildJson = (await buildRes.json()) as BuildResponse;
  if (!buildRes.ok || !buildJson.success || !buildJson.data) {
    throw new Error(`build-claim-tx failed (${buildRes.status}): ${buildJson.error || 'unknown error'}`);
  }
  const built = buildJson.data;

  // 2. sign locally — claim returns a VersionedTransaction, so we
  // can't reuse signSerializedTx (which uses legacy Transaction.from).
  // Decode v0, sign with keypair, send raw.
  const { VersionedTransaction } = await import('@solana/web3.js');
  const txBuf = Buffer.from(built.tx, 'base64');
  const tx = VersionedTransaction.deserialize(txBuf);
  tx.sign([keypair]);
  const rawTx = tx.serialize();

  // 3. send + confirm
  const { signature: txSignature } = await sendAndConfirm(
    Buffer.from(rawTx),
    getConnection(),
    { confirmTimeoutMs: 90_000 },
  );

  // 4. sig-auth complete-claim
  const nonce = freshNonce();
  const sig = signChallenge(
    challenge('complete-claim', txSignature, nonce),
    keypair,
  );
  const completeRes = await fetch(`${base}/api/mcp/markets/complete-claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      walletAddress,
      nonce,
      signature: sig,
      txSignature,
      marketId: onchainId,
    }),
  });
  const completeJson = (await completeRes.json()) as CompleteResponse;
  if (!completeRes.ok || !completeJson.success || !completeJson.data) {
    throw new Error(
      `Tx confirmed on-chain (${txSignature}) but complete-claim failed (${completeRes.status}): ${completeJson.error || 'unknown error'}. Your rewards are already in your wallet — only the off-chain "claimed" flag failed to update. Safe to re-run pnl_claim_now (idempotent on tx signature).`,
    );
  }
  const done = completeJson.data;

  const resHint =
    built.resolutionType === 'YesWins'
      ? 'YES won — your tokens were minted into your wallet (Token2022 ATA created if needed).'
      : built.resolutionType === 'NoWins'
        ? "NO won — you've been paid your share of the pool in SOL."
        : 'Refund — pool returned to voters proportionally.';

  return reply(
    headline(`${Badge.live} Claimed · ${marketName}`),
    kvTable([
      ['Market', `${base}/market/${onchainId}`],
      ['Resolution', built.resolutionType],
      ['Wallet', inline(walletAddress)],
      ['Tx', `[${txSignature.slice(0, 8)}…${txSignature.slice(-6)}](${done.solscan})`],
      ['Profile', `${base}/profile/${walletAddress}`],
    ]),
    hr,
    resHint,
    code(`Tx: ${txSignature}`),
    next(`See your updated position at ${inline(`${base}/profile/${walletAddress}`)}.`),
  );
}
