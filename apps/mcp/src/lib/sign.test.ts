import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Connection } from '@solana/web3.js';
import { sendAndConfirm } from './sign.js';

// ─── Regression tests for sendAndConfirm ─────────────────────────────
//
// Root cause this guards against: web3.js `confirmTransaction` rejects
// with "Signature <sig> has expired: block height exceeded." when it
// stops watching, NOT when the tx fails. On a laggy/rate-limited RPC the
// tx often lands anyway. The old code propagated that rejection as a
// fatal error, so pnl_pitch_now threw before calling complete-create and
// stranded a paid create_market on-chain (market existed, never indexed).
//
// The fix: on any confirmTransaction rejection, poll getSignatureStatuses
// authoritatively before declaring failure.

const SIG = '5cvv4GMrhBtYpFoCrdtqCeMt3p3V3G2CFiQsXtPJ63Ej';
const RAW = Buffer.from([1, 2, 3]);

class BlockheightExceeded extends Error {
  constructor(sig: string) {
    super(`Signature ${sig} has expired: block height exceeded.`);
    this.name = 'TransactionExpiredBlockheightExceededError';
  }
}

interface MockOpts {
  confirmBehavior: 'expire' | 'ok' | 'onchain-err';
  statusValue: unknown; // what getSignatureStatuses().value[0] returns
}

function mockConnection(o: MockOpts): Connection {
  return {
    sendRawTransaction: async () => SIG,
    getLatestBlockhash: async () => ({ blockhash: 'hh', lastValidBlockHeight: 1000 }),
    confirmTransaction: async () => {
      if (o.confirmBehavior === 'expire') throw new BlockheightExceeded(SIG);
      if (o.confirmBehavior === 'onchain-err') return { value: { err: { InstructionError: [0, 'X'] } } };
      return { value: { err: null } };
    },
    getSignatureStatuses: async () => ({ value: [o.statusValue] }),
  } as unknown as Connection;
}

// The bug repro: confirmTransaction expires, but the signature is
// confirmed on-chain. Must RESOLVE (so the caller persists the market),
// not throw. This test FAILS against the pre-fix code.
test('block-height-exceeded but tx landed → resolves with the signature', async () => {
  const conn = mockConnection({
    confirmBehavior: 'expire',
    statusValue: { err: null, slot: 422861713, confirmationStatus: 'confirmed', confirmations: 5 },
  });
  const res = await sendAndConfirm(RAW, conn, { confirmFallbackAttempts: 2, confirmFallbackIntervalMs: 1 });
  assert.equal(res.signature, SIG);
  assert.equal(res.slot, 422861713);
});

// confirmTransaction expires AND the tx truly never landed → must throw,
// and the message must warn against a blind resend (double-spend guard).
test('expired and never landed → throws, warns against resend', async () => {
  const conn = mockConnection({ confirmBehavior: 'expire', statusValue: null });
  await assert.rejects(
    sendAndConfirm(RAW, conn, { confirmFallbackAttempts: 2, confirmFallbackIntervalMs: 1 }),
    (err: Error) => {
      assert.match(err.message, new RegExp(SIG));
      assert.match(err.message, /second market|double-spend/i);
      return true;
    },
  );
});

// confirmTransaction expires but the on-chain status carries an err →
// genuine on-chain failure, must throw the failure (not swallow it).
test('expired then status shows on-chain err → throws on-chain failure', async () => {
  const conn = mockConnection({
    confirmBehavior: 'expire',
    statusValue: { err: { InstructionError: [0, 'Custom'] }, slot: 1, confirmationStatus: 'confirmed' },
  });
  await assert.rejects(
    sendAndConfirm(RAW, conn, { confirmFallbackAttempts: 2, confirmFallbackIntervalMs: 1 }),
    /failed on-chain/,
  );
});

// Fast path: clean confirmation resolves without touching the fallback.
test('clean confirmation → resolves', async () => {
  const conn = mockConnection({
    confirmBehavior: 'ok',
    statusValue: { err: null, slot: 999, confirmationStatus: 'confirmed' },
  });
  const res = await sendAndConfirm(RAW, conn);
  assert.equal(res.signature, SIG);
  assert.equal(res.slot, 999);
});

// Fast path on-chain error still throws.
test('fast-path on-chain err → throws', async () => {
  const conn = mockConnection({ confirmBehavior: 'onchain-err', statusValue: null });
  await assert.rejects(sendAndConfirm(RAW, conn), /failed on-chain/);
});
