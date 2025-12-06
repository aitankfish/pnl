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

// Address Lookup Table (mainnet) - contains frequently-used program accounts
// Created via scripts/create-alt.ts - saves ~186 bytes per transaction
const ALT_ADDRESS = new PublicKey('hs9SCzyzTgqURSxLm4p3gTtLRUkmL54BWQrtYFn9JeS');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketAddress, tokenMint, callerWallet, creator, network } = body;

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

    // Creator defaults to callerWallet if not provided (backward compatibility)
    const creatorAddress = creator || callerWallet;

    logger.info('Preparing market resolution with token launch', {
      marketAddress,
      tokenMint,
      callerWallet,
      creator: creatorAddress,
      network,
    });

    // Convert addresses to PublicKey
    const marketPubkey = new PublicKey(marketAddress);
    const tokenMintPubkey = new PublicKey(tokenMint);
    const callerPubkey = new PublicKey(callerWallet);
    const creatorPubkey = new PublicKey(creatorAddress);

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

    // Note: We don't fetch the bonding curve account here because in the atomic flow,
    // the token hasn't been created yet when this endpoint is called.
    // The creator is passed from the frontend (it's the wallet creating the token).

    // Derive additional Pump.fun PDAs required for buy() CPI
    // 1. creator_vault = ["creator-vault", creator]
    const [creatorVault] = PublicKey.findProgramAddressSync(
      [Buffer.from('creator-vault'), creatorPubkey.toBuffer()],
      PUMP_PROGRAM_ID
    );

    logger.info('All accounts derived', {
      treasuryPda: treasuryPda.toBase58(),
      marketTokenAccount: marketTokenAccount.toBase58(),
      pumpGlobal: pumpPDAs.global.toBase58(),
      bondingCurve: pumpPDAs.bondingCurve.toBase58(),
      bondingCurveTokenAccount: bondingCurveTokenAccount.toBase58(),
      creator: creatorPubkey.toBase58(),
      creatorVault: creatorVault.toBase58(),
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

    // Create instruction with all accounts (2 core + 10 pump.fun + 5 program = 17 total)
    const { TransactionInstruction } = await import('@solana/web3.js');
    const resolveIx = new TransactionInstruction({
      keys: [
        // Core market accounts (2)
        { pubkey: marketPubkey, isSigner: false, isWritable: true },       // market
        { pubkey: treasuryPda, isSigner: false, isWritable: true },        // treasury

        // Pump.fun accounts (10)
        { pubkey: tokenMintPubkey, isSigner: false, isWritable: true },    // token_mint
        { pubkey: marketTokenAccount, isSigner: false, isWritable: true }, // market_token_account
        { pubkey: pumpPDAs.global, isSigner: false, isWritable: false },   // pump_global (readonly per Pump IDL)
        { pubkey: pumpPDAs.bondingCurve, isSigner: false, isWritable: true }, // bonding_curve
        { pubkey: bondingCurveTokenAccount, isSigner: false, isWritable: true }, // bonding_curve_token_account
        { pubkey: pumpPDAs.global, isSigner: false, isWritable: true },    // pump_fee_recipient (same as global)
        { pubkey: pumpPDAs.eventAuthority, isSigner: false, isWritable: false }, // pump_event_authority
        { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },   // pump_program
        { pubkey: creatorPubkey, isSigner: false, isWritable: false },     // creator
        { pubkey: creatorVault, isSigner: false, isWritable: true },       // creator_vault

        // System program accounts (5)
        { pubkey: callerPubkey, isSigner: true, isWritable: true },        // caller (MUST BE SIGNER!)
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

    // Fetch Address Lookup Table to reduce transaction size
    // The ALT contains: System, Token2022, ATA, Rent, Pump, Fee programs
    const lookupTableAccount = await connection.getAddressLookupTable(ALT_ADDRESS);
    if (!lookupTableAccount.value) {
      throw new Error('Address Lookup Table not found. Run scripts/create-alt.ts first.');
    }

    logger.info('Using Address Lookup Table', {
      altAddress: ALT_ADDRESS.toBase58(),
      accountsInTable: lookupTableAccount.value.state.addresses.length,
    });

    // Create VersionedTransaction with ATA creation BEFORE resolve
    // Using ALT reduces transaction size by ~186 bytes (6 accounts × 31 bytes)
    const messageV0 = new TransactionMessage({
      payerKey: callerPubkey,
      recentBlockhash: blockhash,
      instructions: [computeBudgetIx, createATAIx, resolveIx], // ATA first, then resolve
    }).compileToV0Message([lookupTableAccount.value]); // Pass ALT for account compression

    const transaction = new VersionedTransaction(messageV0);

    // Serialize transaction for client-side signing
    const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');
    const transactionSize = transaction.serialize().length;

    logger.info('Market resolution with token launch transaction prepared', {
      marketAddress: marketPubkey.toBase58(),
      tokenMint: tokenMintPubkey.toBase58(),
      treasuryPda: treasuryPda.toBase58(),
      transactionSize,
      transactionSizeLimit: 1232,
      underLimit: transactionSize <= 1232,
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
