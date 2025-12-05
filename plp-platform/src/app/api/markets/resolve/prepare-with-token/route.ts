/**
 * API endpoint for preparing market resolution with token launch (YES wins)
 *
 * This endpoint builds a resolve_market transaction with pump.fun integration
 * for when YES wins and token needs to be launched
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { getTreasuryPDA, getProgramIdForNetwork } from '@/lib/anchor-program';
import { derivePumpPDAs, PUMP_PROGRAM_ID } from '@/lib/pumpfun';
import { createClientLogger } from '@/lib/logger';
import { getSolanaConnection } from '@/lib/solana';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketAddress, tokenMint, callerWallet, network } = body;

    // Validate inputs
    if (!marketAddress || !tokenMint || !callerWallet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: marketAddress, tokenMint, callerWallet',
        },
        { status: 400 }
      );
    }

    logger.info('Preparing market resolution with token launch', {
      marketAddress,
      tokenMint,
      callerWallet,
      network,
    });

    // Convert addresses to PublicKey
    const marketPubkey = new PublicKey(marketAddress);
    const tokenMintPubkey = new PublicKey(tokenMint);
    const callerPubkey = new PublicKey(callerWallet);

    // Get network-specific program ID
    const targetNetwork = (network as 'devnet' | 'mainnet-beta') || 'devnet';
    const programId = getProgramIdForNetwork(targetNetwork);

    // Derive Treasury PDA with network-specific program ID
    const [treasuryPda] = getTreasuryPDA(targetNetwork);

    // Get connection (needed for fetching bonding curve)
    const connection = await getSolanaConnection(network);

    // Derive pump.fun PDAs
    const pumpPDAs = derivePumpPDAs(tokenMintPubkey);

    // Get market's token account (ATA) - using Token2022 program for Pump.fun tokens
    const marketTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      marketPubkey,
      true, // allowOwnerOffCurve
      TOKEN_2022_PROGRAM_ID // Pump.fun uses Token Extensions (Token2022)
    );

    // Get bonding curve's token account (ATA) - using Token2022 program
    const bondingCurveTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      pumpPDAs.bondingCurve,
      true, // allowOwnerOffCurve
      TOKEN_2022_PROGRAM_ID // Pump.fun uses Token Extensions (Token2022)
    );

    // Fetch bonding curve account to get creator
    // BondingCurve struct (first 8 bytes discriminator, then fields):
    // - virtual_sol_reserves: u64 (8 bytes)
    // - virtual_token_reserves: u64 (8 bytes)
    // - real_sol_reserves: u64 (8 bytes)
    // - real_token_reserves: u64 (8 bytes)
    // - token_total_supply: u64 (8 bytes)
    // - complete: bool (1 byte)
    // - creator: Pubkey (32 bytes) at offset 8 + 8*5 + 1 = 49
    const bondingCurveAccountInfo = await connection.getAccountInfo(pumpPDAs.bondingCurve);
    if (!bondingCurveAccountInfo) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bonding curve account not found - token may not be created yet',
        },
        { status: 400 }
      );
    }

    // Extract creator pubkey from bonding curve data (at offset 49)
    const creatorOffset = 49;
    const creatorBytes = bondingCurveAccountInfo.data.slice(creatorOffset, creatorOffset + 32);
    const creator = new PublicKey(creatorBytes);

    logger.info('All accounts derived', {
      treasuryPda: treasuryPda.toBase58(),
      marketTokenAccount: marketTokenAccount.toBase58(),
      pumpGlobal: pumpPDAs.global.toBase58(),
      bondingCurve: pumpPDAs.bondingCurve.toBase58(),
      bondingCurveTokenAccount: bondingCurveTokenAccount.toBase58(),
      creator: creator.toBase58(),
    });

    // Build resolve_market instruction manually
    // Calculate resolveMarket discriminator: sha256("global:resolve_market")[0..8]
    const crypto = require('crypto');
    const discriminator = crypto
      .createHash('sha256')
      .update('global:resolve_market', 'utf8')
      .digest()
      .subarray(0, 8);

    // No args for resolveMarket - just discriminator
    const data = Buffer.alloc(8);
    discriminator.copy(data, 0);

    // Create instruction with all accounts (4 original + 14 pump.fun = 18 total)
    const { TransactionInstruction } = await import('@solana/web3.js');
    const resolveIx = new TransactionInstruction({
      keys: [
        // Original 4 accounts
        { pubkey: marketPubkey, isSigner: false, isWritable: true },       // market
        { pubkey: treasuryPda, isSigner: false, isWritable: true },        // treasury

        // Pump.fun accounts (14 accounts)
        { pubkey: tokenMintPubkey, isSigner: false, isWritable: true },    // token_mint
        { pubkey: marketTokenAccount, isSigner: false, isWritable: true }, // market_token_account
        { pubkey: pumpPDAs.global, isSigner: false, isWritable: true },    // pump_global
        { pubkey: pumpPDAs.bondingCurve, isSigner: false, isWritable: true }, // bonding_curve
        { pubkey: bondingCurveTokenAccount, isSigner: false, isWritable: true }, // bonding_curve_token_account
        { pubkey: pumpPDAs.global, isSigner: false, isWritable: true },    // pump_fee_recipient (same as global)
        { pubkey: pumpPDAs.eventAuthority, isSigner: false, isWritable: false }, // pump_event_authority
        { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },   // pump_program
        { pubkey: creator, isSigner: false, isWritable: false },           // creator (for deriving creator_vault)

        // Remaining accounts
        { pubkey: callerPubkey, isSigner: true, isWritable: true },        // caller
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },  // token_program (Token2022 for Pump.fun)
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // associated_token_program
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // rent
      ],
      programId: programId,
      data,
    });

    // Create instruction to initialize market's token account (ATA)
    // This MUST be done before resolve_market to avoid ATA rent being deducted from pool
    // IMPORTANT: Use Token2022 program since Pump.fun creates tokens with Token Extensions
    const createATAIx = createAssociatedTokenAccountInstruction(
      callerPubkey,           // payer (caller pays ATA rent)
      marketTokenAccount,     // ata address to create
      marketPubkey,          // owner (market PDA owns the token account)
      tokenMintPubkey,       // mint
      TOKEN_2022_PROGRAM_ID  // Pump.fun uses Token Extensions (Token2022), not legacy SPL Token
    );

    logger.info('ATA creation instruction added', {
      payer: callerPubkey.toBase58(),
      ata: marketTokenAccount.toBase58(),
      owner: marketPubkey.toBase58(),
      mint: tokenMintPubkey.toBase58(),
    });

    // Build compute budget instruction (increase units for CPI + ATA creation)
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 800_000, // Higher than normal due to ATA creation + pump.fun CPI
    });

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Create VersionedTransaction with ATA creation BEFORE resolve
    const messageV0 = new TransactionMessage({
      payerKey: callerPubkey,
      recentBlockhash: blockhash,
      instructions: [computeBudgetIx, createATAIx, resolveIx], // ATA first, then resolve
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Serialize transaction for client-side signing
    const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');

    logger.info('Market resolution with token launch transaction prepared', {
      marketAddress: marketPubkey.toBase58(),
      tokenMint: tokenMintPubkey.toBase58(),
      treasuryPda: treasuryPda.toBase58(),
      serializedLength: serializedTransaction.length,
      lastValidBlockHeight,
    });

    return NextResponse.json({
      success: true,
      data: {
        serializedTransaction,
        treasuryPda: treasuryPda.toBase58(),
        tokenMint: tokenMintPubkey.toBase58(),
        marketTokenAccount: marketTokenAccount.toBase58(),
        lastValidBlockHeight,
      },
    });

  } catch (error) {
    logger.error('Failed to prepare resolution with token launch:', {
      error: error instanceof Error ? error.message : String(error),
    });

    console.error('=== FULL ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('==========================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare resolution with token launch',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
