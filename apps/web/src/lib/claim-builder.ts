// ─── Shared claim_rewards tx builder ─────────────────────────────
//
// Extracts the on-chain deserialization + tx-build logic that
// /api/markets/claim/prepare and /api/mcp/markets/build-claim-tx
// both need. The two routes only differ in auth: the browser route
// uses withWalletOwnership (Privy session), the MCP route takes the
// walletAddress from the body (any caller — the user's signature
// gates spend at RPC time).
//
// Throws BuildClaimError with a status code + reason that the
// route handler can lift into a NextResponse.

import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  ComputeBudgetProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { getPositionPDA } from '@/lib/anchor-program';
import { getSolanaConnection } from '@/lib/solana';
import { PROGRAM_ID } from '@/config/solana';
import { createHash } from 'node:crypto';

export class BuildClaimError extends Error {
  constructor(public status: 400 | 404, public reason: string) {
    super(reason);
  }
}

export type ResolutionType = 'YesWins' | 'NoWins' | 'Refund';

export interface BuildClaimResult {
  serializedTransaction: string;
  positionPda: string;
  resolutionType: ResolutionType;
  lastValidBlockHeight: number;
}

/** Build a claim_rewards transaction for `userWallet` on `marketAddress`.
 *  Throws BuildClaimError when the market is unresolved, the position
 *  doesn't exist, or the rewards have already been claimed.
 *
 *  Returns the serialized v0 transaction (base64) ready to be signed
 *  with the user's keypair. */
export async function buildClaimRewardsTx(
  marketAddress: string,
  userWallet: string,
): Promise<BuildClaimResult> {
  const marketPubkey = new PublicKey(marketAddress);
  const userPubkey = new PublicKey(userWallet);

  const connection = await getSolanaConnection();

  // ── Read market account ────────────────────────────────────
  const accountInfo = await connection.getAccountInfo(marketPubkey);
  if (!accountInfo) {
    throw new BuildClaimError(404, 'Market account not found on blockchain');
  }

  const data = accountInfo.data;
  const body = data.slice(8); // skip discriminator
  let offset = 0;

  offset += 32; // founder

  const ipfsCidLen = body.readUInt32LE(offset);
  offset += 4 + ipfsCidLen;

  offset += 8; // target_pool

  /* poolBalance */ body.readBigUInt64LE(offset);
  offset += 8;

  offset += 8; // distribution_pool
  offset += 16; // yes_pool + no_pool

  /* totalYesShares */ body.readBigUInt64LE(offset);
  offset += 8;

  /* totalNoShares */ body.readBigUInt64LE(offset);
  offset += 8;

  offset += 8; // expiry_time
  offset += 1; // phase

  const resolutionByte = body[offset];
  offset += 1;

  const metadataUriLen = body.readUInt32LE(offset);
  offset += 4 + metadataUriLen;

  const hasTokenMint = body[offset];
  offset += 1;
  const tokenMint = hasTokenMint
    ? new PublicKey(body.slice(offset, offset + 32))
    : null;
  if (hasTokenMint) offset += 32;

  // Rust enum: 0=Unresolved, 1=YesWins, 2=NoWins, 3=Refund
  if (resolutionByte === 0) {
    throw new BuildClaimError(400, 'Market is not yet resolved');
  }
  const resolutionType: ResolutionType =
    resolutionByte === 1 ? 'YesWins' : resolutionByte === 2 ? 'NoWins' : 'Refund';

  // ── Read position account ─────────────────────────────────
  const [positionPda] = getPositionPDA(marketPubkey, userPubkey);
  const positionAccountInfo = await connection.getAccountInfo(positionPda);
  if (!positionAccountInfo) {
    throw new BuildClaimError(404, 'Position account not found — this wallet has nothing to claim on this market');
  }
  const positionData = positionAccountInfo.data.slice(8);
  // Position layout: user(32) market(32) yes_shares(8) no_shares(8) total_invested(8) claimed(1) bump(1)
  const claimed = positionData[32 + 32 + 8 + 8 + 8] !== 0;
  if (claimed) {
    throw new BuildClaimError(400, 'Rewards already claimed for this position');
  }

  // ── Build claim_rewards instruction ───────────────────────
  const discriminator = createHash('sha256')
    .update('global:claim_rewards', 'utf8')
    .digest()
    .subarray(0, 8);
  const ixData = Buffer.alloc(8);
  discriminator.copy(ixData, 0);

  // For YesWins we need the Token2022 ATAs. For NoWins/Refund those
  // accounts are UncheckedAccount on the program side, so we use the
  // user pubkey as a placeholder.
  const instructions: TransactionInstruction[] = [];

  let marketTokenAccount: PublicKey = userPubkey;
  let userTokenAccount: PublicKey = userPubkey;
  let tokenMintAccount: PublicKey = userPubkey;
  const tokenProgramId = TOKEN_2022_PROGRAM_ID;

  if (resolutionByte === 1 && tokenMint) {
    marketTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      marketPubkey,
      true,
      TOKEN_2022_PROGRAM_ID,
    );
    userTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      userPubkey,
      false,
      TOKEN_2022_PROGRAM_ID,
    );
    tokenMintAccount = tokenMint;

    const createUserTokenIx = createAssociatedTokenAccountIdempotentInstruction(
      userPubkey,
      userTokenAccount,
      userPubkey,
      tokenMint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    instructions.push(createUserTokenIx);
  }

  // Account order must match the on-chain ClaimRewards struct exactly.
  const claimIx = new TransactionInstruction({
    keys: [
      { pubkey: marketPubkey, isSigner: false, isWritable: true },
      { pubkey: positionPda, isSigner: false, isWritable: true },
      { pubkey: marketTokenAccount, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: userPubkey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: tokenMintAccount, isSigner: false, isWritable: false },
      { pubkey: tokenProgramId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: ixData,
  });
  instructions.push(claimIx);

  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  const messageV0 = new TransactionMessage({
    payerKey: userPubkey,
    recentBlockhash: blockhash,
    instructions: [computeBudgetIx, ...instructions],
  }).compileToV0Message();
  const transaction = new VersionedTransaction(messageV0);

  return {
    serializedTransaction: Buffer.from(transaction.serialize()).toString('base64'),
    positionPda: positionPda.toBase58(),
    resolutionType,
    lastValidBlockHeight,
  };
}
