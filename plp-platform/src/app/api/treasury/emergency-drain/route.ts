/**
 * API endpoint for emergency vault drain
 *
 * Only callable by treasury admin
 * Drains vault SOL back to market founder
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSolanaConnection } from '@/lib/solana';
import { PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { getTreasuryPDA, getProgramIdForNetwork } from '@/lib/anchor-program';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketAddress, founderAddress, adminWallet, network } = body;

    // Validate inputs
    if (!marketAddress || !founderAddress || !adminWallet) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: marketAddress, founderAddress, adminWallet',
        },
        { status: 400 }
      );
    }

    logger.info('Emergency vault drain requested', {
      marketAddress,
      founderAddress,
      adminWallet,
      network,
    });

    // Get connection
    const connection = await getSolanaConnection(network);
    const programId = getProgramIdForNetwork(network);

    const marketPubkey = new PublicKey(marketAddress);
    const founderPubkey = new PublicKey(founderAddress);
    const adminPubkey = new PublicKey(adminWallet);

    // Derive vault PDA
    const [marketVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market_vault'), marketPubkey.toBuffer()],
      programId
    );

    // Derive treasury PDA
    const [treasuryPda] = getTreasuryPDA(network);

    // Check vault balance before draining
    const vaultBalance = await connection.getBalance(marketVaultPda);
    logger.info('Vault balance before drain', {
      vault: marketVaultPda.toBase58(),
      balance: vaultBalance / 1e9,
    });

    logger.info('Building emergency drain transaction', {
      marketVault: marketVaultPda.toBase58(),
      treasury: treasuryPda.toBase58(),
    });

    // Build emergency drain instruction discriminator
    // sha256('global:emergency_drain_vault')[0..8]
    const crypto = require('crypto');
    const discriminator = crypto
      .createHash('sha256')
      .update('global:emergency_drain_vault', 'utf8')
      .digest()
      .subarray(0, 8);

    // Build instruction
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: marketPubkey, isSigner: false, isWritable: true },
        { pubkey: marketVaultPda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: false },
        { pubkey: founderPubkey, isSigner: false, isWritable: true },
        { pubkey: adminPubkey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: programId,
      data: discriminator,
    });

    // Build transaction
    const tx = new Transaction();
    tx.add(instruction);

    // Get latest blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = adminPubkey;

    // Serialize transaction
    const serializedTransaction = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    logger.info('Emergency drain transaction prepared', {
      vaultBalance: vaultBalance / 1e9,
      founderWillReceive: (vaultBalance - 890880) / 1e9, // Minus rent-exempt amount
    });

    return NextResponse.json({
      success: true,
      data: {
        serializedTransaction: serializedTransaction.toString('base64'),
        vaultBalance: vaultBalance / 1e9,
        marketVault: marketVaultPda.toBase58(),
        message: `Ready to drain ${vaultBalance / 1e9} SOL to founder`,
      },
    });

  } catch (error: any) {
    logger.error('Failed to prepare emergency drain:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare emergency drain transaction',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
