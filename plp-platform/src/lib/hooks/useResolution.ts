/**
 * useResolution Hook
 * Handles the market resolution flow: prepare → sign → send → confirm
 * Supports token launch when YES wins (create + resolve via Jito bundle)
 * Uses Jito bundling for atomic execution of 2 transactions in same block
 * Uses VersionedTransaction and Privy wallet signer (same as create page)
 */

import { useState } from 'react';
import { flushSync } from 'react-dom';
import { useWallet } from '@/hooks/useWallet';
import { TransactionInstruction } from '@solana/web3.js';
import { getSolanaConnection } from '@/lib/solana';
import { useNetwork } from './useNetwork';
import { useSignAndSendTransaction, useSignTransaction, useWallets, useStandardWallets } from '@privy-io/react-auth/solana';
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
  const { signTransaction } = useSignTransaction(); // For Jito bundling (sign without sending)

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
   * Resolve market with token launch using Jito bundling (YES wins scenario)
   *
   * DEVNET MODE: Not supported (Pump.fun only exists on mainnet)
   * MAINNET MODE: Creates token on Pump.fun + resolves market via Jito bundle (2 transactions)
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
      console.log('🚀 TOKEN LAUNCH FLOW STARTED (JITO BUNDLING)');
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

      // MAINNET MODE: Jito Bundle Integration
      console.log('');
      console.log('✅ MAINNET MODE - JITO BUNDLE INTEGRATION');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Token creation + resolution as 2-transaction bundle');
      console.log('Bypasses 1232 byte transaction size limit');
      console.log('Maintains atomic execution via Jito validators');
      console.log('Vanity address ending with "pnl" for PLP branding');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');

      // Check wallet balance before proceeding
      console.log('💰 Checking wallet balance...');
      const { Connection, LAMPORTS_PER_SOL, PublicKey: SolanaPublicKey } = await import('@solana/web3.js');

      // Use Helius RPC for balance check (primary endpoint)
      const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC ||
                     process.env.NEXT_PUBLIC_QUICKNODE_MAINNET_RPC ||
                     'https://api.mainnet-beta.solana.com';
      const balanceConnection = new Connection(rpcUrl);

      const walletPubkey = new SolanaPublicKey(primaryWallet!.address);
      const balance = await balanceConnection.getBalance(walletPubkey);
      const balanceSOL = balance / LAMPORTS_PER_SOL;

      // Estimated costs:
      // TX1 (token creation): ~0.02 SOL (Pump.fun fees + rent)
      // TX2 (resolution): ~0.003 SOL (ATA creation + Jito tip + fees)
      const ESTIMATED_COST = 0.025; // SOL
      const BUFFER = 0.005; // Extra buffer for safety
      const REQUIRED_BALANCE = ESTIMATED_COST + BUFFER;

      console.log(`   Current balance: ${balanceSOL.toFixed(6)} SOL`);
      console.log(`   Required minimum: ${REQUIRED_BALANCE.toFixed(6)} SOL`);
      console.log(`   ↳ TX1 (token creation): ~0.020 SOL`);
      console.log(`   ↳ TX2 (resolution + Jito): ~0.003 SOL`);
      console.log(`   ↳ Safety buffer: ~0.005 SOL`);

      if (balanceSOL < REQUIRED_BALANCE) {
        const shortfall = REQUIRED_BALANCE - balanceSOL;
        console.error('❌ INSUFFICIENT BALANCE');
        console.error(`   Need at least ${REQUIRED_BALANCE.toFixed(6)} SOL`);
        console.error(`   Short by ${shortfall.toFixed(6)} SOL`);
        console.error('');

        return {
          success: false,
          error: `Insufficient balance to launch token. You need at least ${REQUIRED_BALANCE.toFixed(4)} SOL (you have ${balanceSOL.toFixed(4)} SOL). Please add ${shortfall.toFixed(4)} SOL to your wallet and try again.`,
        };
      }

      console.log('✅ Sufficient balance confirmed');
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

      // Step 2: Upload image + metadata to Pump.fun IPFS (with retry logic)
      console.log('📤 Uploading image + metadata to Pump.fun IPFS...');

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

      // Fetch the image from market's imageUrl and upload to Pump.fun's IPFS
      console.log('📷 Fetching market image for IPFS upload...');
      console.log(`   Source: ${params.tokenMetadata.imageUrl}`);

      let imageBlob: Blob;
      try {
        const imageResponse = await fetch(params.tokenMetadata.imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status}`);
        }
        imageBlob = await imageResponse.blob();
        console.log(`✅ Image fetched (${(imageBlob.size / 1024).toFixed(2)} KB)`);
      } catch (error) {
        console.error('❌ Failed to fetch image:', error);
        throw new Error(`Cannot fetch market image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Create FormData with actual image file (Pump.fun expects this format)
      const formData = new FormData();
      formData.append('file', imageBlob, 'image.png');
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
          console.log(`✅ Image + metadata uploaded to IPFS`);
          console.log(`   Metadata URI: ${metadataUri}`);
          if (ipfsResult.data.imageUri) {
            console.log(`   Image URI: ${ipfsResult.data.imageUri}`);
          }
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

      // Step 3: Get Pump.fun createV2 instruction data
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

      // Step 4: Prepare Jito bundle (2 separate transactions)
      // Send only the instruction data buffer (not the full instruction object)
      // Backend will rebuild with proper PublicKey objects using Pump SDK
      console.log('🔧 Preparing Jito bundle transactions...');
      const prepareResponse = await fetch('/api/markets/resolve/prepare-jito-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketAddress: params.marketAddress,
          tokenMint: mintKeypair.publicKey.toBase58(),
          callerWallet: primaryWallet!.address,
          founderWallet: primaryWallet!.address,
          // Send metadata for backend to rebuild instruction
          pumpMetadata: {
            name: tokenName,
            symbol: params.tokenMetadata.symbol,
            uri: metadataUri,
          },
          creator: primaryWallet!.address,
          network,
        }),
      });

      const prepareResult = await prepareResponse.json();

      if (!prepareResult.success) {
        console.error('❌ Failed to prepare Jito bundle:', prepareResult.error);
        return { success: false, error: prepareResult.error };
      }

      console.log('✅ Jito bundle prepared');
      console.log(`   Jito tip: ${prepareResult.data.jitoTipLamports} lamports (~$0.0002)`);
      console.log('');

      // Step 5: Deserialize both transactions from Jito bundle
      console.log('📦 Loading bundle transactions...');
      const { VersionedTransaction } = await import('@solana/web3.js');

      const createTxBuffer = Buffer.from(prepareResult.data.createTransaction, 'base64');
      const createTx = VersionedTransaction.deserialize(createTxBuffer);

      const resolveTxBuffer = Buffer.from(prepareResult.data.resolveTransaction, 'base64');
      const resolveTx = VersionedTransaction.deserialize(resolveTxBuffer);

      console.log('✅ Transactions deserialized');
      console.log(`   TX1 size: ${createTxBuffer.length} bytes (create token)`);
      console.log(`   TX2 size: ${resolveTxBuffer.length} bytes (resolve market + tip)`);
      console.log('');

      // Step 6: Get wallet for signing first (before any partial signing)
      let solanaWallet;
      if (wallets && wallets.length > 0) {
        console.log('Using external Solana wallet');
        solanaWallet = wallets[0];
      } else if (standardWallets && standardWallets.length > 0) {
        console.log('Using embedded Solana wallet');
        const privyWallet = standardWallets.find((w: any) => w.isPrivyWallet || w.name === 'Privy');
        if (!privyWallet) {
          throw new Error('No Privy wallet found');
        }
        solanaWallet = privyWallet;
      } else {
        throw new Error('No Solana wallet found');
      }

      // Step 7: Request founder signature for TX1 FIRST (before mint keypair)
      // This is critical: Privy wallet must sign the unsigned transaction
      console.log('✍️ Signing transaction 1 (create token)...');
      console.log('🔐 Requesting wallet signature for token creation...');
      const signedCreateTxResult = await signTransaction({
        transaction: createTx.serialize(), // Serialize UNSIGNED transaction
        wallet: solanaWallet as any,
      });

      // Deserialize the wallet-signed transaction
      const signedCreateTx = VersionedTransaction.deserialize(
        signedCreateTxResult.signedTransaction
      );
      console.log('✅ Wallet signature added');

      // Now add mint keypair signature to the wallet-signed transaction
      console.log('✍️ Adding mint keypair signature...');
      signedCreateTx.sign([mintKeypair]);
      console.log('✅ Transaction 1 fully signed (wallet + mint keypair)');

      // Step 8: Sign TX2 with caller wallet
      console.log('✍️ Signing transaction 2 (resolve market)...');
      console.log('🔐 Requesting wallet signature for market resolution...');

      const signedResolveTxResult = await signTransaction({
        transaction: resolveTx.serialize(),
        wallet: solanaWallet as any,
      });

      const signedResolveTx = VersionedTransaction.deserialize(
        signedResolveTxResult.signedTransaction
      );
      console.log('✅ Transaction 2 signed');
      console.log('');

      // Step 9: Submit Jito bundle
      console.log('📤 Submitting bundle to Jito block engine...');
      const { submitAndConfirmBundle, getJitoExplorerUrl } = await import('@/lib/jito');

      const bundleResult = await submitAndConfirmBundle([
        signedCreateTx,
        signedResolveTx,
      ]);

      if (bundleResult.status !== 'Landed') {
        console.error('❌ Bundle failed:', bundleResult.error);
        console.log(`   Check status: ${getJitoExplorerUrl(bundleResult.bundleId)}`);
        throw new Error(`Jito bundle ${bundleResult.status}: ${bundleResult.error || 'Unknown error'}`);
      }

      console.log('✅ Bundle landed successfully!');
      console.log(`   Bundle ID: ${bundleResult.bundleId}`);
      console.log(`   Jito Explorer: ${getJitoExplorerUrl(bundleResult.bundleId)}`);
      console.log('');

      // Step 10: Extract transaction signature (first transaction's signature)
      const signature = bs58.encode(signedCreateTx.signatures[0]);
      console.log(`✅ Token created: ${signature}`);

      // Step 11: Confirm on-chain
      console.log('⏳ Confirming transactions on-chain...');
      await connection.confirmTransaction(signature, 'confirmed');
      console.log('✅ Confirmed!');
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
      console.log('🎉 JITO BUNDLE TOKEN LAUNCH SUCCESSFUL!');
      console.log('═══════════════════════════════════════════════════');
      console.log(`Token Mint: ${mintKeypair.publicKey.toBase58()}`);
      console.log(`   ↳ Ends with "pnl" (PNL platform branded)`);
      console.log(`Bundle ID: ${bundleResult.bundleId}`);
      console.log(`Signature: ${signature}`);
      console.log('');
      console.log('🔗 LINKS:');
      console.log(`  • Pump.fun: https://pump.fun/${mintKeypair.publicKey.toBase58()}`);
      console.log(`  • Jito Explorer: ${getJitoExplorerUrl(bundleResult.bundleId)}`);
      console.log(`  • Transaction: https://orb.helius.dev/tx/${signature}`);
      console.log('');
      console.log('✨ TOKEN DISTRIBUTION:');
      console.log('  • 79% to YES voters (claimable)');
      console.log('  • 20% to team (vested: 5% now, 15% locked)');
      console.log('  • 1% to platform');
      console.log('');
      console.log('⚡ EXECUTION METHOD:');
      console.log('  • 2 transactions bundled atomically via Jito');
      console.log('  • Bypassed 1232 byte transaction size limit');
      console.log('  • MEV-protected (no front-running)');
      console.log('  • Both transactions in same block');
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
