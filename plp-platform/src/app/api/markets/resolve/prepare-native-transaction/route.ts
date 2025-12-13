/**
 * API endpoint for preparing market resolution with native Solana transactions
 *
 * Returns a SINGLE atomic transaction with both instructions:
 * 1. Create token (Pump.fun createV2)
 * 2. Create ATA + Resolve market (with Pump.fun buy CPI)
 *
 * Uses Address Lookup Tables (ALT) to compress transaction size below 1232 byte limit.
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
import { getTreasuryPDA, getProgramIdForNetwork, getMarketVaultPDA } from '@/lib/anchor-program';
import { derivePumpPDAs, PUMP_PROGRAM_ID } from '@/lib/pumpfun';
import logger from '@/lib/logger';
import { getSolanaConnection } from '@/lib/solana';
import {
  PumpSdk,
  GLOBAL_VOLUME_ACCUMULATOR_PDA,
  PUMP_FEE_CONFIG_PDA,
  userVolumeAccumulatorPda,
  creatorVaultPda,
} from '@pump-fun/pump-sdk';

// Pump.fun fee program address (from official IDL)
const PUMP_FEE_PROGRAM_ID = new PublicKey('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ');

// Pump.fun fee recipient address (hardcoded)
const PUMP_FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');

// Address Lookup Table (mainnet) - now contains all required accounts
const ALT_ADDRESS = new PublicKey('hs9SCzyzTgqURSxLm4p3gTtLRUkmL54BWQrtYFn9JeS');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      marketAddress,
      tokenMint,
      callerWallet,
      founderWallet,
      pumpMetadata, // Metadata to rebuild Pump.fun createV2 instruction
      creator,
      network,
    } = body;

    // Validate inputs
    if (!marketAddress || !tokenMint || !callerWallet || !founderWallet || !pumpMetadata) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: marketAddress, tokenMint, callerWallet, founderWallet, pumpMetadata',
        },
        { status: 400 }
      );
    }

    logger.info('[NATIVE] Preparing native atomic transaction for token launch + resolution', {
      marketAddress,
      tokenMint,
      callerWallet,
      founderWallet,
      creator: creator || founderWallet,
      network,
    });

    // Convert addresses to PublicKey
    const marketPubkey = new PublicKey(marketAddress);
    const tokenMintPubkey = new PublicKey(tokenMint);
    const callerPubkey = new PublicKey(callerWallet);
    const founderPubkey = new PublicKey(founderWallet);
    // creator account removed from Rust struct to fix AccountBorrowFailed when founder === caller
    // creator_vault is derived from creator pubkey and passed directly

    // Get network-specific program ID
    const targetNetwork = (network as 'devnet' | 'mainnet-beta') || 'devnet';
    const programId = getProgramIdForNetwork(targetNetwork);

    // Derive Treasury PDA
    const [treasuryPda] = getTreasuryPDA(targetNetwork);

    // Derive Market Vault PDA (simple derivation from market address)
    const [marketVaultPda] = getMarketVaultPDA(marketPubkey, targetNetwork);

    logger.info('[VAULT] Derived market vault PDA', {
      market: marketPubkey.toBase58(),
      vault: marketVaultPda.toBase58(),
    });

    // Get connection
    const connection = await getSolanaConnection(network);

    // Derive pump.fun PDAs
    const pumpPDAs = derivePumpPDAs(tokenMintPubkey);

    // Get market's token account (ATA) - using Token2022
    const marketTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      marketPubkey,
      true, // allowOwnerOffCurve
      TOKEN_2022_PROGRAM_ID
    );

    // Get bonding curve's token account (ATA)
    const bondingCurveTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      pumpPDAs.bondingCurve,
      true,
      TOKEN_2022_PROGRAM_ID
    );

    // Derive additional Pump.fun PDAs using SDK functions
    // Creator is the founder (who creates the token in createV2Instruction)
    const creatorVault = creatorVaultPda(founderPubkey);
    const globalVolumeAccumulator = GLOBAL_VOLUME_ACCUMULATOR_PDA;
    // CRITICAL: user_volume_accumulator MUST match the "user" in buy() CPI
    // Since market VAULT is the "user" (signer/payer), volume is tracked to market vault
    const userVolumeAccumulator = userVolumeAccumulatorPda(marketVaultPda);
    const feeConfig = PUMP_FEE_CONFIG_PDA;

    logger.info('[ACCOUNTS] All accounts derived for native transaction', {
      marketVault: marketVaultPda.toBase58(),
      creatorVault: creatorVault.toBase58(),
      globalVolumeAccumulator: globalVolumeAccumulator.toBase58(),
      userVolumeAccumulator: userVolumeAccumulator.toBase58(),
      feeConfig: feeConfig.toBase58(),
    });

    // ================================================================
    // SINGLE ATOMIC TRANSACTION: CREATE TOKEN + RESOLVE MARKET
    // ================================================================

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Fetch Address Lookup Table
    const lookupTableAccount = await connection.getAddressLookupTable(ALT_ADDRESS);
    if (!lookupTableAccount.value) {
      throw new Error('Address Lookup Table not found');
    }

    // Instruction 1: Compute budget (1M CU for both operations)
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 1_000_000,
    });

    // Instruction 2: Create token (Pump.fun createV2)
    const pumpSdk = new PumpSdk();
    const createTokenIx = await pumpSdk.createV2Instruction({
      mint: tokenMintPubkey,
      name: pumpMetadata.name,
      symbol: pumpMetadata.symbol,
      uri: pumpMetadata.uri,
      creator: founderPubkey,
      user: founderPubkey,
      mayhemMode: false,
    });

    // Instruction 3: Create market's ATA
    const createATAIx = createAssociatedTokenAccountInstruction(
      founderPubkey, // Founder pays (caller = founder for YES wins)
      marketTokenAccount,
      marketPubkey,
      tokenMintPubkey,
      TOKEN_2022_PROGRAM_ID
    );

    // Instruction 4: Resolve market (includes buy() CPI)
    const crypto = require('crypto');
    const discriminator = crypto
      .createHash('sha256')
      .update('global:resolve_market', 'utf8')
      .digest()
      .subarray(0, 8);

    const data = Buffer.alloc(8);
    discriminator.copy(data, 0);

    const { TransactionInstruction } = await import('@solana/web3.js');
    const resolveMarketIx = new TransactionInstruction({
      keys: [
        // MUST match ResolveMarket struct order in Rust program!
        // 1. market
        { pubkey: marketPubkey, isSigner: false, isWritable: true },
        // 2. market_vault (holds all SOL)
        { pubkey: marketVaultPda, isSigner: false, isWritable: true },
        // 3. treasury
        { pubkey: treasuryPda, isSigner: false, isWritable: true },
        // 4. token_mint
        { pubkey: tokenMintPubkey, isSigner: false, isWritable: true },
        // 5. market_token_account
        { pubkey: marketTokenAccount, isSigner: false, isWritable: true },
        // 6. pump_global
        { pubkey: pumpPDAs.global, isSigner: false, isWritable: false },
        // 7. bonding_curve
        { pubkey: pumpPDAs.bondingCurve, isSigner: false, isWritable: true },
        // 8. bonding_curve_token_account
        { pubkey: bondingCurveTokenAccount, isSigner: false, isWritable: true },
        // 9. pump_fee_recipient
        { pubkey: PUMP_FEE_RECIPIENT, isSigner: false, isWritable: true },
        // 10. pump_event_authority
        { pubkey: pumpPDAs.eventAuthority, isSigner: false, isWritable: false },
        // 11. pump_program
        { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
        // 12. creator_vault (creator account removed to fix AccountBorrowFailed)
        { pubkey: creatorVault, isSigner: false, isWritable: true },
        // 13. global_volume_accumulator
        { pubkey: globalVolumeAccumulator, isSigner: false, isWritable: true },
        // 14. user_volume_accumulator
        { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true },
        // 15. fee_config
        { pubkey: feeConfig, isSigner: false, isWritable: false },
        // 16. fee_program
        { pubkey: PUMP_FEE_PROGRAM_ID, isSigner: false, isWritable: false },
        // 17. caller (signer)
        { pubkey: callerPubkey, isSigner: true, isWritable: true },
        // 18. system_program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        // 19. token_program
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        // 20. token_2022_program
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
        // 21. associated_token_program
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        // 22. rent
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: programId,
      data,
    });

    // Build single atomic transaction with ALT compression
    const message = new TransactionMessage({
      payerKey: founderPubkey, // Founder pays for everything
      recentBlockhash: blockhash,
      instructions: [computeBudgetIx, createTokenIx, createATAIx, resolveMarketIx],
    }).compileToV0Message([lookupTableAccount.value]);

    const transaction = new VersionedTransaction(message);
    const serializedTx = Buffer.from(transaction.serialize()).toString('base64');

    const txSize = transaction.serialize().length;
    logger.info('[NATIVE] Atomic transaction prepared', {
      size: txSize,
      sizeLimit: 1232,
      underLimit: txSize < 1232,
      payer: founderPubkey.toBase58(),
      instructions: 4,
    });

    if (txSize >= 1232) {
      logger.error('[NATIVE] Transaction exceeds size limit!', {
        size: txSize,
        limit: 1232,
        overflow: txSize - 1232,
      });
      throw new Error(`Transaction too large: ${txSize} bytes (limit: 1232)`);
    }

    // ================================================================
    // RETURN UNSIGNED TRANSACTION
    // ================================================================

    return NextResponse.json({
      success: true,
      data: {
        // Single atomic transaction
        transaction: serializedTx,
        signers: ['founder', 'mint', 'caller'], // All required signers
        lastValidBlockHeight,

        // Transaction metadata
        size: txSize,
        sizeLimit: 1232,
        accountsCompressed: lookupTableAccount.value.state.addresses.length,

        // Account info
        treasuryPda: treasuryPda.toBase58(),
        marketVaultPda: marketVaultPda.toBase58(),
        tokenMint: tokenMintPubkey.toBase58(),
        marketTokenAccount: marketTokenAccount.toBase58(),
      },
    });
  } catch (error) {
    logger.error('Failed to prepare native transaction:', {
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
        error: 'Failed to prepare native transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
