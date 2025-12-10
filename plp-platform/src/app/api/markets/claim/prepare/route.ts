/**
 * API endpoint for preparing claim rewards transactions
 *
 * This endpoint:
 * 1. Fetches on-chain market and position data
 * 2. Validates market is resolved and position can claim
 * 3. Calculates claimable amount based on resolution type
 * 4. Builds claim_rewards transaction
 * 5. Returns serialized transaction for client-side signing
 */

import { NextRequest, NextResponse } from 'next/server';
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
import { getProgram, getPositionPDA } from '@/lib/anchor-program';
import { createClientLogger } from '@/lib/logger';
import { getSolanaConnection } from '@/lib/solana';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketAddress, userWallet } = body;

    // Validate inputs
    if (!marketAddress || !userWallet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: marketAddress, userWallet',
        },
        { status: 400 }
      );
    }

    logger.info('Preparing claim rewards transaction', {
      marketAddress,
      userWallet,
    });

    // Convert addresses to PublicKey
    const marketPubkey = new PublicKey(marketAddress);
    const userPubkey = new PublicKey(userWallet);

    // Fetch on-chain market account manually (IDL doesn't have full type definitions)
    const connection = await getSolanaConnection();

    logger.info('Fetching on-chain market account...');
    const accountInfo = await connection.getAccountInfo(marketPubkey);

    if (!accountInfo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Market account not found on blockchain',
        },
        { status: 404 }
      );
    }

    // Manually deserialize market account data
    const accountData = accountInfo.data;
    const dataWithoutDiscriminator = accountData.slice(8);
    const decoder = new TextDecoder();
    let offset = 0;

    // Skip founder (32 bytes)
    offset += 32;

    // Skip ipfs_cid (String - 4 bytes length + data)
    const ipfsCidLen = dataWithoutDiscriminator.readUInt32LE(offset);
    offset += 4 + ipfsCidLen;

    // Skip target_pool (8 bytes)
    offset += 8;

    // Read pool_balance (8 bytes)
    const poolBalance = dataWithoutDiscriminator.readBigUInt64LE(offset);
    offset += 8;

    // Skip distribution_pool (8 bytes)
    offset += 8;

    // Skip yes_pool and no_pool (16 bytes)
    offset += 16;

    // Read total_yes_shares (8 bytes)
    const totalYesShares = dataWithoutDiscriminator.readBigUInt64LE(offset);
    offset += 8;

    // Read total_no_shares (8 bytes)
    const totalNoShares = dataWithoutDiscriminator.readBigUInt64LE(offset);
    offset += 8;

    // Skip expiry_time (8 bytes)
    offset += 8;

    // Skip phase (1 byte)
    offset += 1;

    // Read resolution (1 byte)
    const resolutionByte = dataWithoutDiscriminator[offset];
    offset += 1;

    // Skip metadata_uri (String - 4 bytes length + data)
    const metadataUriLen = dataWithoutDiscriminator.readUInt32LE(offset);
    offset += 4 + metadataUriLen;

    // Read token_mint (Option<PublicKey> - 1 byte for Some/None + 32 bytes if Some)
    const hasTokenMint = dataWithoutDiscriminator[offset];
    offset += 1;
    const tokenMint = hasTokenMint ? new PublicKey(dataWithoutDiscriminator.slice(offset, offset + 32)) : null;
    if (hasTokenMint) offset += 32;

    // Read platform_tokens_allocated and yes_voter_tokens_allocated if available
    let platformTokensAllocated = BigInt(0);
    let yesVoterTokensAllocated = BigInt(0);

    if (offset + 17 <= dataWithoutDiscriminator.length) {
      try {
        platformTokensAllocated = dataWithoutDiscriminator.readBigUInt64LE(offset);
        offset += 8;

        // Skip platform_tokens_claimed (1 byte)
        offset += 1;

        yesVoterTokensAllocated = dataWithoutDiscriminator.readBigUInt64LE(offset);
      } catch (e) {
        // Old market format
      }
    }

    const marketAccount = {
      resolution: resolutionByte,
      poolBalance,
      totalYesShares,
      totalNoShares,
      tokenMint,
      platformTokensAllocated,
      yesVoterTokensAllocated,
    };

    // Check if market is resolved
    // Rust enum: 0=Unresolved, 1=YesWins, 2=NoWins, 3=Refund
    if (marketAccount.resolution === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Market is not yet resolved',
        },
        { status: 400 }
      );
    }

    // Derive position PDA
    const [positionPda] = getPositionPDA(marketPubkey, userPubkey);

    logger.info('Fetching on-chain position account...', {
      positionPda: positionPda.toBase58(),
    });

    // Fetch on-chain position account manually
    const positionAccountInfo = await connection.getAccountInfo(positionPda);

    if (!positionAccountInfo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Position account not found',
        },
        { status: 404 }
      );
    }

    // Manually deserialize position account data
    // Position struct: user (32), market (32), yes_shares (8), no_shares (8), total_invested (8), claimed (1), bump (1)
    const positionData = positionAccountInfo.data.slice(8); // Skip discriminator
    let posOffset = 0;

    // Skip user (32 bytes)
    posOffset += 32;

    // Skip market (32 bytes)
    posOffset += 32;

    // Read yes_shares (8 bytes)
    const yesShares = positionData.readBigUInt64LE(posOffset);
    posOffset += 8;

    // Read no_shares (8 bytes)
    const noShares = positionData.readBigUInt64LE(posOffset);
    posOffset += 8;

    // Read total_invested (8 bytes)
    const totalInvested = positionData.readBigUInt64LE(posOffset);
    posOffset += 8;

    // Read claimed (1 byte)
    const claimed = positionData[posOffset] !== 0;

    const positionAccount = {
      yesShares,
      noShares,
      totalInvested,
      claimed,
    };

    if (positionAccount.claimed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rewards already claimed',
        },
        { status: 400 }
      );
    }

    // Determine resolution type (actual amount will be parsed from transaction after claim)
    let resolutionType = '';

    if (marketAccount.resolution === 1) {
      resolutionType = 'YesWins';
    } else if (marketAccount.resolution === 2) {
      resolutionType = 'NoWins';
    } else if (marketAccount.resolution === 3) {
      resolutionType = 'Refund';
    }

    logger.info('Preparing claim transaction', {
      resolutionType,
      userYesShares: positionAccount.yesShares.toString(),
      userNoShares: positionAccount.noShares.toString(),
      totalInvested: positionAccount.totalInvested.toString(),
    });

    // Build claim_rewards instruction manually (since IDL is incomplete)
    // Calculate claimRewards discriminator: sha256("global:claim_rewards")[0..8]
    const crypto = require('crypto');
    const discriminator = crypto
      .createHash('sha256')
      .update('global:claim_rewards', 'utf8')
      .digest()
      .subarray(0, 8);

    // No args for claimRewards - just discriminator
    const data = Buffer.alloc(8);
    discriminator.copy(data, 0);

    // Get program ID
    const { PROGRAM_ID } = await import('@/config/solana');

    // For YesWins: need to derive Token2022 accounts
    // For NoWins/Refund: token accounts are checked as UncheckedAccount, so we can use placeholders
    const instructions = [];

    let marketTokenAccount = userPubkey; // Placeholder for NoWins/Refund
    let userTokenAccount = userPubkey;   // Placeholder for NoWins/Refund
    let tokenMintAccount = userPubkey;   // Placeholder for NoWins/Refund
    let tokenProgramId = TOKEN_2022_PROGRAM_ID; // Always Token2022 (Pump.fun standard)

    if (marketAccount.resolution === 1 && marketAccount.tokenMint) {
      // YesWins - derive actual Token2022 ATAs
      logger.info('YesWins claim - deriving Token2022 accounts');

      marketTokenAccount = getAssociatedTokenAddressSync(
        marketAccount.tokenMint,
        marketPubkey,
        true, // allowOwnerOffCurve - market is a PDA
        TOKEN_2022_PROGRAM_ID
      );

      userTokenAccount = getAssociatedTokenAddressSync(
        marketAccount.tokenMint,
        userPubkey,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      tokenMintAccount = marketAccount.tokenMint;

      // Create user token account if it doesn't exist (idempotent)
      const createUserTokenAccountIx = createAssociatedTokenAccountIdempotentInstruction(
        userPubkey,      // payer
        userTokenAccount, // associated token account address
        userPubkey,      // owner
        marketAccount.tokenMint, // mint
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      instructions.push(createUserTokenAccountIx);

      logger.info('Token2022 accounts derived', {
        tokenMint: marketAccount.tokenMint.toBase58(),
        marketTokenAccount: marketTokenAccount.toBase58(),
        userTokenAccount: userTokenAccount.toBase58(),
      });
    }

    // Create claim instruction with proper accounts
    // Order must match ClaimRewards struct in Rust program:
    // 1. market, 2. position, 3. market_token_account, 4. user_token_account,
    // 5. user, 6. system_program, 7. token_mint, 8. token_program
    const claimIx = new TransactionInstruction({
      keys: [
        { pubkey: marketPubkey, isSigner: false, isWritable: true },   // market
        { pubkey: positionPda, isSigner: false, isWritable: true },    // position (will be closed)
        { pubkey: marketTokenAccount, isSigner: false, isWritable: true }, // market_token_account
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },   // user_token_account
        { pubkey: userPubkey, isSigner: true, isWritable: true },      // user
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        { pubkey: tokenMintAccount, isSigner: false, isWritable: false }, // token_mint
        { pubkey: tokenProgramId, isSigner: false, isWritable: false }, // token_program
      ],
      programId: PROGRAM_ID,
      data,
    });

    instructions.push(claimIx);

    // Build compute budget instruction
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400_000, // Increased for ATA creation
    });

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Create VersionedTransaction with all instructions
    // For YesWins: [computeBudget, createUserTokenAccount, claim]
    // For NoWins/Refund: [computeBudget, claim]
    const messageV0 = new TransactionMessage({
      payerKey: userPubkey,
      recentBlockhash: blockhash,
      instructions: [computeBudgetIx, ...instructions],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Serialize transaction for client-side signing
    const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');

    logger.info('Claim rewards transaction prepared successfully', {
      marketAddress: marketPubkey.toBase58(),
      positionPda: positionPda.toBase58(),
      resolutionType,
      serializedLength: serializedTransaction.length,
      lastValidBlockHeight,
    });

    return NextResponse.json({
      success: true,
      data: {
        serializedTransaction,
        positionPda: positionPda.toBase58(),
        resolutionType,
        lastValidBlockHeight,
      },
    });

  } catch (error) {
    logger.error('Failed to prepare claim rewards transaction:', error);

    // Log the full error stack for debugging
    console.error('=== FULL ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('==========================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare claim rewards transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
