/**
 * API endpoint for preparing market resolution transactions
 *
 * This endpoint builds a resolve_market transaction and returns
 * a serialized transaction for client-side signing
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
} from '@solana/spl-token';
import { getTreasuryPDA, getMarketVaultPDA, getProgramIdForNetwork } from '@/lib/anchor-program';
import { derivePumpPDAs, PUMP_PROGRAM_ID } from '@/lib/pumpfun';
import { createClientLogger } from '@/lib/logger';
import { getSolanaConnection } from '@/lib/solana';
import {
  GLOBAL_VOLUME_ACCUMULATOR_PDA,
  PUMP_FEE_CONFIG_PDA,
  userVolumeAccumulatorPda,
  creatorVaultPda,
} from '@pump-fun/pump-sdk';

// Pump.fun fee program address (from official IDL)
const PUMP_FEE_PROGRAM_ID = new PublicKey('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ');

// Pump.fun fee recipient address (hardcoded)
const PUMP_FEE_RECIPIENT = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketAddress, callerWallet, network } = body;

    // Validate inputs
    if (!marketAddress || !callerWallet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: marketAddress, callerWallet',
        },
        { status: 400 }
      );
    }

    logger.info('Preparing market resolution transaction', {
      marketAddress,
      callerWallet,
      network,
    });

    // Convert addresses to PublicKey
    const marketPubkey = new PublicKey(marketAddress);
    const callerPubkey = new PublicKey(callerWallet);

    // Get network-specific program ID
    const targetNetwork = (network as 'devnet' | 'mainnet-beta') || 'devnet';
    const programId = getProgramIdForNetwork(targetNetwork);

    // Derive Treasury PDA
    const [treasuryPda] = getTreasuryPDA(targetNetwork);

    // Derive Market Vault PDA (holds all SOL)
    const [marketVaultPda] = getMarketVaultPDA(marketPubkey, targetNetwork);

    logger.info('Derived market vault PDA', {
      market: marketPubkey.toBase58(),
      vault: marketVaultPda.toBase58(),
    });

    // Create a dummy token mint for pump.fun accounts
    // These accounts are required by the Anchor struct but won't be used for NO wins
    // We can't use PublicKey.default because it can't be marked as writable (mut)
    // So we derive a PDA from the market as a dummy mint
    const [dummyMintPubkey] = PublicKey.findProgramAddressSync(
      [Buffer.from('dummy_mint'), marketPubkey.toBuffer()],
      programId
    );

    // Derive pump.fun PDAs (using dummy mint)
    const pumpPDAs = derivePumpPDAs(dummyMintPubkey);

    // Get market's token account (ATA) for dummy mint - using Token2022
    const marketTokenAccount = await getAssociatedTokenAddress(
      dummyMintPubkey,
      marketPubkey,
      true, // allowOwnerOffCurve
      TOKEN_2022_PROGRAM_ID
    );

    // Get bonding curve's token account (ATA) - using Token2022
    const bondingCurveTokenAccount = await getAssociatedTokenAddress(
      dummyMintPubkey,
      pumpPDAs.bondingCurve,
      true,
      TOKEN_2022_PROGRAM_ID
    );

    // Derive additional Pump.fun PDAs using SDK functions
    // For NO wins/Refund, we use caller as dummy creator
    const creatorVault = creatorVaultPda(callerPubkey);
    const globalVolumeAccumulator = GLOBAL_VOLUME_ACCUMULATOR_PDA;
    // user_volume_accumulator must match the "user" in buy() CPI - market vault
    const userVolumeAccumulator = userVolumeAccumulatorPda(marketVaultPda);
    const feeConfig = PUMP_FEE_CONFIG_PDA;

    logger.info('Treasury PDA and pump.fun accounts derived', {
      treasuryPda: treasuryPda.toBase58(),
      marketVaultPda: marketVaultPda.toBase58(),
      pumpGlobal: pumpPDAs.global.toBase58(),
      bondingCurve: pumpPDAs.bondingCurve.toBase58(),
      creatorVault: creatorVault.toBase58(),
      globalVolumeAccumulator: globalVolumeAccumulator.toBase58(),
      userVolumeAccumulator: userVolumeAccumulator.toBase58(),
      feeConfig: feeConfig.toBase58(),
    });

    // Get connection for the target network
    const connection = await getSolanaConnection(network);

    // Build resolve_market instruction manually (since IDL is incomplete)
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

    // Create instruction with all accounts matching ResolveMarket struct in Rust
    // MUST match exact order from resolve_market.rs!
    const { TransactionInstruction } = await import('@solana/web3.js');
    const resolveIx = new TransactionInstruction({
      keys: [
        // 1. market
        { pubkey: marketPubkey, isSigner: false, isWritable: true },
        // 2. market_vault (holds all SOL) - THIS WAS MISSING!
        { pubkey: marketVaultPda, isSigner: false, isWritable: true },
        // 3. treasury
        { pubkey: treasuryPda, isSigner: false, isWritable: true },
        // 4. token_mint (dummy for NO wins)
        { pubkey: dummyMintPubkey, isSigner: false, isWritable: true },
        // 5. market_token_account (dummy for NO wins)
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
        // 12. creator (dummy for NO wins - use caller)
        { pubkey: callerPubkey, isSigner: false, isWritable: false },
        // 13. creator_vault
        { pubkey: creatorVault, isSigner: false, isWritable: true },
        // 14. global_volume_accumulator
        { pubkey: globalVolumeAccumulator, isSigner: false, isWritable: true },
        // 15. user_volume_accumulator
        { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true },
        // 16. fee_config
        { pubkey: feeConfig, isSigner: false, isWritable: false },
        // 17. fee_program
        { pubkey: PUMP_FEE_PROGRAM_ID, isSigner: false, isWritable: false },
        // 18. caller (signer)
        { pubkey: callerPubkey, isSigner: true, isWritable: true },
        // 19. system_program
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        // 20. token_program
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        // 21. token_2022_program
        { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
        // 22. associated_token_program
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        // 23. rent
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: programId,
      data,
    });

    // Build compute budget instruction
    const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
      units: 400_000,
    });

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    // Create VersionedTransaction (same as create page)
    const messageV0 = new TransactionMessage({
      payerKey: callerPubkey,
      recentBlockhash: blockhash,
      instructions: [computeBudgetIx, resolveIx],
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Serialize transaction for client-side signing
    const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');

    logger.info('Market resolution transaction prepared successfully', {
      marketAddress: marketPubkey.toBase58(),
      marketVaultPda: marketVaultPda.toBase58(),
      treasuryPda: treasuryPda.toBase58(),
      serializedLength: serializedTransaction.length,
      lastValidBlockHeight,
    });

    return NextResponse.json({
      success: true,
      data: {
        serializedTransaction,
        marketVaultPda: marketVaultPda.toBase58(),
        treasuryPda: treasuryPda.toBase58(),
        lastValidBlockHeight,
      },
    });

  } catch (error) {
    logger.error('Failed to prepare market resolution transaction:', error);

    // Log the full error stack for debugging
    console.error('=== FULL ERROR DETAILS ===');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('==========================');

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare market resolution transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
