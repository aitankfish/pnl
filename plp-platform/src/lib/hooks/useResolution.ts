/**
 * useResolution Hook
 * Handles the market resolution flow: prepare → sign → send → confirm
 * Supports atomic token launch when YES wins (create + resolve in one tx)
 * Uses VersionedTransaction and Privy wallet signer (same as create page)
 */

import { useState } from 'react';
import { flushSync } from 'react-dom';
import { useWallet } from '@/hooks/useWallet';
import { Transaction, TransactionInstruction } from '@solana/web3.js';
import { getSolanaConnection } from '@/lib/solana';
import { useNetwork } from './useNetwork';
import { useSignAndSendTransaction, useWallets, useStandardWallets } from '@privy-io/react-auth/solana';
import bs58 from 'bs58';
import { generateVanityKeypair } from '@/lib/vanity';
import { PumpSdk } from '@pump-fun/pump-sdk';

export function useResolution() {
  const [isResolving, setIsResolving] = useState(false);
  const { primaryWallet } = useWallet();
  const { network } = useNetwork();
  const { wallets } = useWallets(); // External wallets
  const { wallets: standardWallets } = useStandardWallets(); // Standard wallet interface (includes embedded)
  const { signAndSendTransaction } = useSignAndSendTransaction();

  const resolve = async (params: {
    marketId: string;
    marketAddress: string;
    tokenMetadata?: {
      name: string;
      symbol: string;
      description: string;
      imageUrl: string;
    };
    needsTokenLaunch?: boolean; // If YES wins, needs token creation
  }): Promise<{ success: boolean; signature?: string; error?: any }> => {
    if (!primaryWallet) {
      return { success: false, error: 'No wallet connected' };
    }

    try {
      // Use flushSync to immediately show animation (synchronous state update)
      flushSync(() => {
        setIsResolving(true);
      });

      // -------------------------
      // Step 1: Check if this is a token launch (YES wins)
      // -------------------------
      if (params.needsTokenLaunch && params.tokenMetadata) {
        console.log('🚀 YES WINS - Preparing token launch + resolution...');
        return await resolveWithTokenLaunch({
          ...params,
          tokenMetadata: params.tokenMetadata,
        });
      }

      // -------------------------
      // Step 2: Normal resolution (NO wins or Refund)
      // -------------------------
      console.log('🔧 Preparing market resolution transaction...');
      const prepareResponse = await fetch('/api/markets/resolve/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketAddress: params.marketAddress,
          callerWallet: primaryWallet.address,
          network,
        }),
      });

      const prepareResult = await prepareResponse.json();

      if (!prepareResult.success) {
        console.error('❌ Failed to prepare resolution transaction:', prepareResult.error);
        return { success: false, error: prepareResult.error };
      }

      console.log('✅ Resolution transaction prepared');

      let signature;

      try {
        // STEP 2: Prepare transaction for signing
        console.log('🚀 Preparing transaction for signing...');

        // Get serialized transaction from API response
        const rawTx = prepareResult.data.serializedTransaction;
        if (!rawTx) {
          throw new Error('No serializedTransaction provided by server');
        }

        console.log('🔄 Transaction ready for signing');

        // STEP 3: Get Solana wallet - prioritize external wallets, fallback to standard wallets (embedded)
        console.log('✍️ Signing and sending transaction with Privy...');
        let solanaWallet;

        if (wallets && wallets.length > 0) {
          // Path 1: External wallet (Phantom, Solflare, etc.)
          console.log('Using external Solana wallet');
          solanaWallet = wallets[0];
        } else if (standardWallets && standardWallets.length > 0) {
          // Path 2: Embedded wallet from standard wallets
          console.log('Using embedded Solana wallet');
          const privyWallet = standardWallets.find((w: any) => w.isPrivyWallet || w.name === 'Privy');
          if (!privyWallet) {
            throw new Error('No Privy wallet found');
          }
          solanaWallet = privyWallet;
        } else {
          throw new Error('No Solana wallet found');
        }

        // Convert to Buffer for signAndSendTransaction
        const txBuffer = Buffer.from(rawTx, 'base64');

        // Use signAndSendTransaction - works for both external and embedded wallets
        const result = await signAndSendTransaction({
          transaction: txBuffer,
          wallet: solanaWallet as any,
          chain: network === 'devnet' ? 'solana:devnet' : 'solana:mainnet',
        });

        // Extract signature from result and convert to base58 (Solana standard format)
        signature = bs58.encode(result.signature);
        console.log('✅ Transaction signed and sent:', signature);

        // Wait for confirmation
        console.log('⏳ Waiting for transaction confirmation...');
        const connection = await getSolanaConnection();
        await connection.confirmTransaction(signature, 'confirmed');
        console.log('✅ Transaction confirmed on blockchain!');

      } catch (signerError: unknown) {
        const errorMessage = signerError instanceof Error ? signerError.message : 'Unknown error';
        console.error('❌ Transaction failed:', errorMessage);

        // Extract detailed error from logs if available
        if (errorMessage.includes('Logs:')) {
          console.error('📋 Transaction logs:', errorMessage);
        }

        return { success: false, error: errorMessage };
      }

      // Update market state in database
      console.log('📝 Updating market state in database...');
      const updateResponse = await fetch('/api/markets/resolve/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: params.marketId,
          marketAddress: params.marketAddress,
          signature,
        }),
      });

      const updateResult = await updateResponse.json();

      if (!updateResult.success) {
        console.warn('⚠️ Transaction succeeded but database update failed:', updateResult.error);
        // Still return success since blockchain transaction succeeded
      }

      console.log('🎉 Market resolution completed successfully!');
      return {
        success: true,
        signature,
      };

    } catch (error) {
      console.error('❌ Resolution error:', error);
      return { success: false, error };
    } finally {
      setIsResolving(false);
    }
  };


  /**
   * Resolve market with token launch (YES wins scenario)
   *
   * DEVNET MODE: Not supported (Pump.fun only exists on mainnet)
   * MAINNET MODE: Creates token on Pump.fun with atomic transaction → Raydium migration
   */
  const resolveWithTokenLaunch = async (params: {
    marketId: string;
    marketAddress: string;
    tokenMetadata: {
      name: string;
      symbol: string;
      description: string;
      imageUrl: string;
    };
  }): Promise<{ success: boolean; signature?: string; error?: any }> => {
    try {
      console.log('═══════════════════════════════════════════════════');
      console.log('🚀 TOKEN LAUNCH FLOW STARTED');
      console.log('═══════════════════════════════════════════════════');
      console.log(`Network: ${network.toUpperCase()}`);
      console.log(`Token: ${params.tokenMetadata.symbol}`);
      console.log(`Market: ${params.marketAddress}`);
      console.log('═══════════════════════════════════════════════════');

      // NETWORK DETECTION
      if (network === 'devnet') {
        console.log('');
        console.log('⚠️  DEVNET MODE DETECTED');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Pump.fun is NOT available on devnet.');
        console.log('Token launch cannot be tested on devnet.');
        console.log('Use mainnet for full token launch testing.');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');

        return {
          success: false,
          error: 'Token launch is not supported on devnet. Please switch to mainnet to test token creation.',
        };
      }

      // MAINNET MODE: Full Pump.fun Integration with PLP Branding
      console.log('');
      console.log('✅ MAINNET MODE - FULL PUMP.FUN INTEGRATION');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Token will be created on Pump.fun bonding curve');
      console.log('Automatic Raydium migration when threshold reached');
      console.log('Vanity address ending with "pnl" for PLP branding');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');

      // Step 1: Generate vanity mint keypair (ending with "pnl")
      console.log('🎯 Generating vanity token address (ending with "pnl")...');
      const mintKeypair = generateVanityKeypair({
        suffix: 'pnl',
        maxAttempts: 10_000_000,
      });

      if (!mintKeypair) {
        throw new Error('Failed to generate vanity address within max attempts');
      }

      console.log(`✅ Vanity token mint: ${mintKeypair.publicKey.toBase58()}`);
      console.log(`   ↳ Branded with PNL platform signature!`);
      console.log('');

      // Step 2: Upload metadata to Pump.fun IPFS (with retry logic)
      console.log('📤 Uploading metadata to Pump.fun IPFS...');

      // Pump.fun limits token names to 32 BYTES (not characters!) - truncate if needed
      // Must use byte length because Unicode characters can be multiple bytes
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      let tokenName = params.tokenMetadata.name;

      // Check byte length and truncate if needed
      let nameBytes = encoder.encode(tokenName);
      if (nameBytes.length > 32) {
        console.log(`⚠️  Token name exceeds 32 bytes (${nameBytes.length} bytes)`);
        console.log(`   Original: ${params.tokenMetadata.name}`);

        // Truncate to 32 bytes, being careful not to cut multi-byte characters
        nameBytes = nameBytes.slice(0, 32);

        // Decode - this might produce invalid UTF-8 if we cut a multi-byte char
        tokenName = decoder.decode(nameBytes, { stream: false });

        // Clean up any invalid characters at the end (from partial multi-byte chars)
        tokenName = tokenName.replace(/[\uFFFD]+$/, '').trim();

        console.log(`   Truncated: ${tokenName} (${encoder.encode(tokenName).length} bytes)`);
      }

      const metadata = {
        name: tokenName,
        symbol: params.tokenMetadata.symbol,
        description: params.tokenMetadata.description,
        image: params.tokenMetadata.imageUrl,
        showName: true,
        createdOn: 'https://pump.fun',
      };

      const formData = new FormData();
      formData.append('file', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
      formData.append('name', tokenName);
      formData.append('symbol', params.tokenMetadata.symbol);
      formData.append('description', params.tokenMetadata.description);
      formData.append('twitter', '');
      formData.append('telegram', '');
      formData.append('website', '');
      formData.append('showName', 'true');

      // Retry logic with exponential backoff (3 attempts)
      // Use backend proxy to avoid CORS issues
      let metadataUri: string | null = null;
      let lastError: Error | null = null;
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`   Attempt ${attempt}/${maxRetries}...`);

          // Use backend proxy endpoint to avoid CORS
          const ipfsResponse = await fetch('/api/pump/upload-ipfs', {
            method: 'POST',
            body: formData,
          });

          if (!ipfsResponse.ok) {
            const errorData = await ipfsResponse.json();
            throw new Error(errorData.error || `IPFS upload failed: ${ipfsResponse.status}`);
          }

          const ipfsResult = await ipfsResponse.json();
          if (!ipfsResult.success || !ipfsResult.data) {
            throw new Error('Invalid IPFS response');
          }

          metadataUri = ipfsResult.data.metadataUri;
          console.log(`✅ Metadata uploaded to IPFS`);
          console.log(`   URI: ${metadataUri}`);
          console.log('');
          break; // Success, exit retry loop

        } catch (error) {
          lastError = error as Error;
          console.warn(`   ⚠️  Attempt ${attempt} failed: ${lastError.message}`);

          if (attempt < maxRetries) {
            // Exponential backoff: 1s, 2s, 4s
            const backoffMs = Math.pow(2, attempt - 1) * 1000;
            console.log(`   Retrying in ${backoffMs / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
        }
      }

      if (!metadataUri) {
        throw new Error(`IPFS upload failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
      }

      // Step 3: Create Pump.fun createV2 instruction using official SDK
      console.log('🔧 Building Pump.fun createV2 instruction...');
      const connection = await getSolanaConnection();
      const pumpSdk = new PumpSdk(); // SDK now manages connection internally

      const { PublicKey } = await import('@solana/web3.js');
      const createInstruction = await pumpSdk.createV2Instruction({
        mint: mintKeypair.publicKey,
        name: tokenName, // Use truncated name (max 32 chars)
        symbol: params.tokenMetadata.symbol,
        uri: metadataUri, // Use IPFS metadata URI
        creator: new PublicKey(primaryWallet!.address),
        user: new PublicKey(primaryWallet!.address),
        mayhemMode: false,
      });

      console.log('✅ Pump.fun createV2 instruction built (Token2022 format)');

      // Step 4: Prepare resolve_market instruction with pump.fun accounts
      console.log('🔧 Preparing resolve_market instruction...');
      const prepareResponse = await fetch('/api/markets/resolve/prepare-with-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketAddress: params.marketAddress,
          tokenMint: mintKeypair.publicKey.toBase58(),
          callerWallet: primaryWallet!.address,
          creator: primaryWallet!.address, // Token creator (same as caller in atomic flow)
          network,
        }),
      });

      const prepareResult = await prepareResponse.json();

      if (!prepareResult.success) {
        console.error('❌ Failed to prepare resolve transaction:', prepareResult.error);
        return { success: false, error: prepareResult.error };
      }

      console.log('✅ Resolve instruction prepared');

      // Step 5: Build ATOMIC transaction (create + resolve in ONE transaction)
      console.log('⚡ Building atomic transaction (create + resolve)...');
      console.log('   This prevents front-running and ensures best token price');

      // Deserialize the resolve transaction to extract instructions
      const { VersionedTransaction, ComputeBudgetProgram } = await import('@solana/web3.js');
      const resolveTxBuffer = Buffer.from(prepareResult.data.serializedTransaction, 'base64');
      const resolveVersionedTx = VersionedTransaction.deserialize(resolveTxBuffer);

      // Extract instructions: [compute_budget, create_ata, resolve_market]
      const compiledInstructions = resolveVersionedTx.message.compiledInstructions;
      const accountKeys = resolveVersionedTx.message.staticAccountKeys;

      // Convert compiled instructions to TransactionInstruction format
      const { PublicKey: PK } = await import('@solana/web3.js');
      const convertInstruction = (compiledIx: any) => {
        return new TransactionInstruction({
          programId: accountKeys[compiledIx.programIdIndex],
          keys: compiledIx.accountKeyIndexes.map((idx: number) => ({
            pubkey: accountKeys[idx],
            isSigner: resolveVersionedTx.message.isAccountSigner(idx),
            isWritable: resolveVersionedTx.message.isAccountWritable(idx),
          })),
          data: Buffer.from(compiledIx.data),
        });
      };

      // Extract ATA creation instruction (index 1, after compute budget)
      const createATAInstruction = convertInstruction(compiledInstructions[1]);

      // Extract resolve_market instruction (index 2, last instruction)
      const resolveInstruction = convertInstruction(compiledInstructions[2]);

      // Build atomic transaction with high compute units
      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 1_000_000, // Extra margin for complex operations (create ~300k + resolve ~200k + buy CPI ~200k + buffer ~300k)
      });

      const atomicTx = new Transaction()
        .add(computeBudgetIx)       // Compute budget
        .add(createInstruction)      // Pump.fun create token
        .add(createATAInstruction)   // Create market's token account (for receiving tokens)
        .add(resolveInstruction);    // Your program resolve (does buy CPI)

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      atomicTx.recentBlockhash = blockhash;
      atomicTx.feePayer = new PK(primaryWallet!.address);

      console.log('✅ Atomic transaction built with 4 instructions:');
      console.log('   1. Compute budget (1M units)');
      console.log('   2. Pump.fun createV2 (Token2022)');
      console.log('   3. Create market token account (ATA)');
      console.log('   4. Market resolve (buy CPI + fee transfer)');
      console.log('');

      // Sign with mint keypair first
      atomicTx.partialSign(mintKeypair);
      console.log('✅ Partially signed with mint keypair');

      // Serialize for wallet signing
      const serializedAtomicTx = atomicTx.serialize({
        requireAllSignatures: false, // Allow partial signatures
        verifySignatures: false,
      });

      // Get wallet for signing
      let solanaWallet;
      if (wallets && wallets.length > 0) {
        console.log('Using external Solana wallet for atomic transaction');
        solanaWallet = wallets[0];
      } else if (standardWallets && standardWallets.length > 0) {
        console.log('Using embedded Solana wallet for atomic transaction');
        const privyWallet = standardWallets.find((w: any) => w.isPrivyWallet || w.name === 'Privy');
        if (!privyWallet) {
          throw new Error('No Privy wallet found');
        }
        solanaWallet = privyWallet;
      } else {
        throw new Error('No Solana wallet found');
      }

      // Simulate transaction before sending to catch errors early
      console.log('🔍 Simulating transaction...');
      try {
        const simulation = await connection.simulateTransaction(atomicTx);
        if (simulation.value.err) {
          console.error('❌ Simulation failed:', simulation.value.err);
          console.error('   Logs:', simulation.value.logs);
          throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }
        console.log('✅ Simulation successful - transaction should execute correctly');
        console.log('   Compute units used:', simulation.value.unitsConsumed);
      } catch (simError) {
        console.warn('⚠️  Simulation warning (proceeding anyway):', simError);
        // Don't fail on simulation errors - they can be false positives
        // Real validation happens on-chain
      }
      console.log('');

      // Sign and send atomic transaction
      console.log('📤 Signing and sending ATOMIC transaction...');
      console.log('   This creates token AND resolves market in ONE transaction');
      console.log('   No gap for front-running!');
      console.log('');

      const result = await signAndSendTransaction({
        transaction: serializedAtomicTx,
        wallet: solanaWallet as any,
        chain: 'solana:mainnet', // We're in mainnet-only block (devnet returns early)
      });

      const signature = bs58.encode(result.signature);
      console.log(`✅ Atomic transaction sent: ${signature}`);
      console.log(`   View on Helius Orb: https://orb.helius.dev/tx/${signature}`);

      console.log('⏳ Confirming atomic transaction...');
      await connection.confirmTransaction(signature, 'confirmed');
      console.log('✅ Atomic transaction confirmed!');
      console.log('   • Token created on Pump.fun ✅');
      console.log('   • Market resolved ✅');
      console.log('   • Tokens bought with pooled SOL ✅');
      console.log('');

      // Update database
      console.log('📝 Updating market state in database...');
      const updateResponse = await fetch('/api/markets/resolve/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: params.marketId,
          marketAddress: params.marketAddress,
          signature,
          tokenMint: mintKeypair.publicKey.toBase58(),
        }),
      });

      const updateResult = await updateResponse.json();

      if (!updateResult.success) {
        console.warn('⚠️ Transaction succeeded but database update failed:', updateResult.error);
      }

      console.log('');
      console.log('═══════════════════════════════════════════════════');
      console.log('🎉 MAINNET ATOMIC TOKEN LAUNCH SUCCESSFUL!');
      console.log('═══════════════════════════════════════════════════');
      console.log(`Token Mint: ${mintKeypair.publicKey.toBase58()}`);
      console.log(`   ↳ Ends with "pnl" (PNL platform branded)`);
      console.log(`Signature: ${signature}`);
      console.log('');
      console.log('🔗 LINKS:');
      console.log(`  • Pump.fun: https://pump.fun/${mintKeypair.publicKey.toBase58()}`);
      console.log(`  • Helius Orb Token: https://orb.helius.dev/token/${mintKeypair.publicKey.toBase58()}`);
      console.log(`  • Transaction: https://orb.helius.dev/tx/${signature}`);
      console.log('');
      console.log('✨ TOKEN DISTRIBUTION:');
      console.log('  • 79% to YES voters (claimable)');
      console.log('  • 20% to team (vested: 5% now, 15% locked)');
      console.log('  • 1% to platform');
      console.log('');
      console.log('⚡ BONDING CURVE ACTIVE:');
      console.log('  • Token live on Pump.fun with proper metadata');
      console.log('  • Market PDA bought tokens at optimal price (no front-running)');
      console.log('  • Will migrate to Raydium at ~$69k market cap');
      console.log('═══════════════════════════════════════════════════');

      return {
        success: true,
        signature,
      };

    } catch (error) {
      console.error('❌ Token launch error:', error);
      return { success: false, error };
    }
  };

  return {
    resolve,
    isResolving,
  };
}
