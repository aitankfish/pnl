import { NextRequest, NextResponse } from 'next/server';
import { Keypair, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { config } from '@/lib/config';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export async function GET(request: NextRequest) {
  try {
    if (!config.isDevelopment) {
      return NextResponse.json({
        success: false,
        error: 'Devnet faucet test is only available in development mode'
      });
    }

    // Initialize Solana connection
    const connection = new Connection(config.solana.devnetRpc, 'confirmed');
    
    // Generate a test keypair
    const testKeypair = Keypair.generate();
    const walletAddress = testKeypair.publicKey.toString();
    
    logger.info('Testing devnet faucet', { walletAddress });
    
    // Check initial balance
    const initialBalance = await connection.getBalance(testKeypair.publicKey);
    logger.info('Initial balance', { 
      address: walletAddress, 
      balance: `${initialBalance / LAMPORTS_PER_SOL} SOL` 
    });
    
    // Request airdrop
    logger.info('Requesting 1 SOL airdrop from devnet faucet...');
    const airdropSignature = await connection.requestAirdrop(
      testKeypair.publicKey,
      1 * LAMPORTS_PER_SOL // 1 SOL
    );
    
    logger.info('Airdrop transaction submitted', { signature: airdropSignature });
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(airdropSignature);
    
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }
    
    // Check final balance
    const finalBalance = await connection.getBalance(testKeypair.publicKey);
    const balanceChange = finalBalance - initialBalance;
    
    logger.info('Airdrop completed', {
      walletAddress,
      initialBalance: `${initialBalance / LAMPORTS_PER_SOL} SOL`,
      finalBalance: `${finalBalance / LAMPORTS_PER_SOL} SOL`,
      balanceChange: `${balanceChange / LAMPORTS_PER_SOL} SOL`,
      airdropSignature,
      confirmed: true
    });
    
    return NextResponse.json({
      success: true,
      message: 'Devnet faucet test successful',
      data: {
        walletAddress,
        initialBalance: `${initialBalance / LAMPORTS_PER_SOL} SOL`,
        finalBalance: `${finalBalance / LAMPORTS_PER_SOL} SOL`,
        balanceChange: `${balanceChange / LAMPORTS_PER_SOL} SOL`,
        airdropSignature,
        confirmed: true
      }
    });
    
  } catch (error) {
    logger.error('Devnet faucet test failed', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error
      },
      { status: 500 }
    );
  }
}
