#!/usr/bin/env tsx
//
// recover-stranded-market.ts
//
// One-shot recovery for a create_market tx that landed ON-CHAIN but was
// never persisted off-chain — the failure mode fixed in sign.ts
// (confirmTransaction "block height exceeded" false-negative made
// pnl_pitch_now throw before reaching complete-create).
//
// It replays POST /api/mcp/markets/complete-create for an existing
// on-chain market: signs the canonical challenge with the LOCAL wallet
// (passphrase via OS dialog / PNL_PASSPHRASE, never chat) and posts the
// idempotent persist call. No new on-chain transaction, no new spend.
//
// Do NOT "recover" by re-running pnl_pitch_now: build-create-tx re-pins
// fresh-timestamped metadata each call → new CID → new PDA → a SECOND
// market (double-spend). Recovery must target the EXISTING marketAddress.
//
// Params come from env so the script is reusable:
//   RECOVER_MARKET_ADDRESS  on-chain market PDA
//   RECOVER_TX_SIGNATURE    the landed create_market signature
//   RECOVER_IPFS_CID        cid stored in the on-chain account's metadataUri
//   RECOVER_PAYLOAD_JSON    JSON: {name,description,category,projectType,
//                           projectStage,tokenSymbol,teamSize,
//                           targetPoolSol,durationDays,...}
//   PNL_API_BASE_URL        defaults to https://pnl.market
//
// Usage: pnpm tsx scripts/recover-stranded-market.ts

import { promptPassphrase } from '../src/lib/passphrase.js';
import { unlockWith, requireUnlockedKeypair, hasWallet, getAddress } from '../src/lib/wallet.js';
import { freshNonce, signChallenge, challenge, signedRequestHash } from '../src/lib/sign.js';

function reqEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`missing required env: ${name}`);
  return v;
}

function getApiBase(): string {
  const raw = process.env.PNL_API_BASE_URL?.trim();
  if (!raw) return 'https://pnl.market';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

async function main() {
  if (!hasWallet()) throw new Error('no local wallet on this machine — nothing to sign with');

  const marketAddress = reqEnv('RECOVER_MARKET_ADDRESS');
  const txSignature = reqEnv('RECOVER_TX_SIGNATURE');
  const ipfsCid = reqEnv('RECOVER_IPFS_CID');
  const payload = JSON.parse(reqEnv('RECOVER_PAYLOAD_JSON')) as Record<string, unknown>;
  if (!payload.name || !payload.tokenSymbol) {
    throw new Error('RECOVER_PAYLOAD_JSON must include at least name + tokenSymbol');
  }
  const metadataUri = `ipfs://${ipfsCid}`;
  const targetPoolSol = Number(payload.targetPoolSol ?? 0);
  const targetPool = Math.floor(targetPoolSol * 1_000_000_000);

  // Unlock (OS dialog / PNL_PASSPHRASE) — passphrase never enters chat.
  const passphrase = promptPassphrase({
    title: 'PNL Wallet — market recovery',
    prompt: 'Enter your PNL wallet passphrase to sign the recovery:',
  });
  const { address } = unlockWith(passphrase, 5);
  const keypair = requireUnlockedKeypair();
  if (address !== getAddress()) throw new Error('unlock address mismatch');

  // Build the complete-create core EXACTLY as pitch-now does, so the
  // backend's signedRequestHash over the received body matches the hash
  // we fold into the signed challenge.
  const completeBodyCore = {
    txSignature,
    marketAddress,
    ipfsCid,
    metadataUri,
    targetPool,
    payload,
  };
  const nonce = freshNonce();
  const payloadHash = signedRequestHash(completeBodyCore);
  const sig = signChallenge(challenge('complete-create', txSignature, nonce, payloadHash), keypair);

  const body = { walletAddress: address, nonce, signature: sig, ...completeBodyCore };

  const base = getApiBase();
  console.error(`[recover] posting complete-create for ${marketAddress} (wallet ${address}) → ${base}`);
  const res = await fetch(`${base}/api/mcp/markets/complete-create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { success?: boolean; data?: Record<string, unknown>; error?: string };
  if (!res.ok || !json.success) {
    throw new Error(`complete-create failed (${res.status}): ${json.error ?? 'unknown error'}`);
  }
  console.error('[recover] success');
  console.log(JSON.stringify(json.data, null, 2));
  if (json.data?.marketUrl) console.error(`[recover] live at ${base}${json.data.marketUrl}`);
  if (json.data?.alreadyExists) console.error('[recover] note: market was already persisted (idempotent)');
}

main().catch((e) => {
  console.error(`[recover] ERROR: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
