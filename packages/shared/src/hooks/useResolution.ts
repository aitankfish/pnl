/**
 * useResolution Hook
 * Handles the market resolution flow: prepare -> sign -> send -> confirm
 * Supports token launch when YES wins (create + resolve via single atomic transaction)
 * Uses Address Lookup Tables (ALT) to compress transaction size below 1232 byte limit
 * Single transaction with 4 instructions: compute budget, create token, create ATA, resolve market
 * Uses VersionedTransaction and Privy wallet signer (same as create page)
 */

import { useState } from 'react';
import { flushSync } from 'react-dom';
import { useWallet } from './useWallet';
import { TransactionInstruction } from '@solana/web3.js';
import { getSolanaConnection } from '../solana/connection';
import { useNetwork } from './useNetwork';
import { getEnvConfig } from '../config/environment';
import { apiUrl } from '../utils/api';
import { useSignAndSendTransaction, useSignTransaction, useWallets, useStandardWallets } from '@privy-io/react-auth/solana';
import bs58 from 'bs58';

// NOTE: generateVanityKeypair is a web-specific utility.
// Consumers should provide this via setVanityKeypairGenerator.
type VanityKeypairGenerator = (opts: { suffix: string; maxAttempts: number }) => any | null;
let _generateVanityKeypair: VanityKeypairGenerator | null = null;

export function setVanityKeypairGenerator(fn: VanityKeypairGenerator) {
  _generateVanityKeypair = fn;
}

export function useResolution() {
  const [isResolving, setIsResolving] = useState(false);
  const { primaryWallet } = useWallet();
  const { network } = useNetwork();
  const { wallets } = useWallets(); // External wallets
  const { wallets: standardWallets } = useStandardWallets(); // Standard wallet interface (includes embedded)
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { signTransaction } = useSignTransaction(); // For multi-signer transactions (sign without sending)

  const resolve = async (params: {
    marketId: string;
    marketAddress: string;
    tokenMetadata?: {
      name: string;
      symbol: string;
      description: string;
      imageUrl: string;
      twitter?: string;
      telegram?: string;
      website?: string;
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
        console.log('YES WINS - Preparing token launch + resolution...');
        return await resolveWithTokenLaunch({
          ...params,
          tokenMetadata: params.tokenMetadata,
        });
      }

      // -------------------------
      // Step 2: Normal resolution (NO wins or Refund)
      // -------------------------
      console.log('Preparing market resolution transaction...');
      const prepareResponse = await fetch(apiUrl('/api/markets/resolve/prepare'), {
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
        console.error('Failed to prepare resolution transaction:', prepareResult.error);
        return { success: false, error: prepareResult.error };
      }

      console.log('Resolution transaction prepared');

      let signature;

      try {
        // STEP 2: Prepare transaction for signing
        console.log('Preparing transaction for signing...');

        // Get serialized transaction from API response
        const rawTx = prepareResult.data.serializedTransaction;
        if (!rawTx) {
          throw new Error('No serializedTransaction provided by server');
        }

        console.log('Transaction ready for signing');

        // STEP 3: Get Solana wallet - prioritize external wallets, fallback to standard wallets (embedded)
        console.log('Signing and sending transaction with Privy...');
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
        console.log('Transaction signed and sent:', signature);

        // Wait for confirmation
        console.log('Waiting for transaction confirmation...');
        const connection = await getSolanaConnection();
        await connection.confirmTransaction(signature, 'confirmed');
        console.log('Transaction confirmed on blockchain!');

      } catch (signerError: unknown) {
        const errorMessage = signerError instanceof Error ? signerError.message : 'Unknown error';
        console.error('Transaction failed:', errorMessage);

        // Extract detailed error from logs if available
        if (errorMessage.includes('Logs:')) {
          console.error('Transaction logs:', errorMessage);
        }

        return { success: false, error: errorMessage };
      }

      // Update market state in database
      console.log('Updating market state in database...');
      const updateResponse = await fetch(apiUrl('/api/markets/resolve/complete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: params.marketId,
          marketAddress: params.marketAddress,
          signature,
          network,
        }),
      });

      const updateResult = await updateResponse.json();

      if (!updateResult.success) {
        console.warn('Transaction succeeded but database update failed:', updateResult.error);
        // Still return success since blockchain transaction succeeded
      }

      console.log('Market resolution completed successfully!');
      return {
        success: true,
        signature,
      };

    } catch (error) {
      console.error('Resolution error:', error);
      return { success: false, error };
    } finally {
      setIsResolving(false);
    }
  };


  /**
   * Resolve market with token launch using native atomic transaction (YES wins scenario)
   *
   * DEVNET MODE: Not supported (Pump.fun only exists on mainnet)
   * MAINNET MODE: Creates token on Pump.fun + resolves market via single atomic transaction (with ALT compression)
   */
  const resolveWithTokenLaunch = async (params: {
    marketId: string;
    marketAddress: string;
    tokenMetadata: {
      name: string;
      symbol: string;
      description: string;
      imageUrl: string;
      twitter?: string;
      telegram?: string;
      website?: string;
    };
  }): Promise<{ success: boolean; signature?: string; error?: any }> => {
    try {
      console.log('TOKEN LAUNCH FLOW STARTED (NATIVE ATOMIC TX)');
      console.log(`Network: ${network.toUpperCase()}`);
      console.log(`Token: ${params.tokenMetadata.symbol}`);
      console.log(`Market: ${params.marketAddress}`);

      // NETWORK DETECTION
      if (network === 'devnet') {
        console.log('DEVNET MODE DETECTED');
        console.log('Pump.fun is NOT available on devnet.');

        return {
          success: false,
          error: 'Token launch is not supported on devnet. Please switch to mainnet to test token creation.',
        };
      }

      // MAINNET MODE: Native Atomic Transaction
      console.log('MAINNET MODE - NATIVE ATOMIC TRANSACTION');

      // Check wallet balance before proceeding
      console.log('Checking wallet balance...');
      const { Connection, LAMPORTS_PER_SOL, PublicKey: SolanaPublicKey } = await import('@solana/web3.js');

      // Use Helius RPC for balance check (primary endpoint)
      const envConfig = getEnvConfig();
      const rpcUrl = envConfig.HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
      const balanceConnection = new Connection(rpcUrl);

      const walletPubkey = new SolanaPublicKey(primaryWallet!.address);
      const balance = await balanceConnection.getBalance(walletPubkey);
      const balanceSOL = balance / LAMPORTS_PER_SOL;

      // Estimated costs
      const ESTIMATED_COST = 0.020; // SOL
      const BUFFER = 0.005; // Extra buffer for safety
      const REQUIRED_BALANCE = ESTIMATED_COST + BUFFER;

      console.log(`   Current balance: ${balanceSOL.toFixed(6)} SOL`);
      console.log(`   Required minimum: ${REQUIRED_BALANCE.toFixed(6)} SOL`);

      if (balanceSOL < REQUIRED_BALANCE) {
        const shortfall = REQUIRED_BALANCE - balanceSOL;
        console.error('INSUFFICIENT BALANCE');

        return {
          success: false,
          error: `Insufficient balance to launch token. You need at least ${REQUIRED_BALANCE.toFixed(4)} SOL (you have ${balanceSOL.toFixed(4)} SOL). Please add ${shortfall.toFixed(4)} SOL to your wallet and try again.`,
        };
      }

      console.log('Sufficient balance confirmed');

      // Step 1: Generate vanity mint keypair (ending with "pnl")
      if (!_generateVanityKeypair) {
        throw new Error('Vanity keypair generator not configured. Call setVanityKeypairGenerator() first.');
      }

      console.log('Generating vanity token address (ending with "pnl")...');
      const mintKeypair = _generateVanityKeypair({
        suffix: 'pnl',
        maxAttempts: 10_000_000,
      });

      if (!mintKeypair) {
        throw new Error('Failed to generate vanity address within max attempts');
      }

      console.log(`Vanity token mint: ${mintKeypair.publicKey.toBase58()}`);

      // Step 2: Upload image + metadata to Pump.fun IPFS (with retry logic)
      console.log('Uploading image + metadata to Pump.fun IPFS...');

      // Pump.fun limits token names to 32 BYTES (not characters!) - truncate if needed
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      let tokenName = params.tokenMetadata.name;

      // Check byte length and truncate if needed
      let nameBytes = encoder.encode(tokenName);
      if (nameBytes.length > 32) {
        console.log(`Token name exceeds 32 bytes (${nameBytes.length} bytes)`);

        // Truncate to 32 bytes, being careful not to cut multi-byte characters
        nameBytes = nameBytes.slice(0, 32);
        tokenName = decoder.decode(nameBytes, { stream: false });
        tokenName = tokenName.replace(/[\uFFFD]+$/, '').trim();

        console.log(`Truncated: ${tokenName} (${encoder.encode(tokenName).length} bytes)`);
      }

      // Fetch the image from market's imageUrl and upload to Pump.fun's IPFS
      console.log('Fetching market image for IPFS upload...');
      console.log(`   Source: ${params.tokenMetadata.imageUrl}`);

      let imageBlob: Blob;
      try {
        const imageResponse = await fetch(params.tokenMetadata.imageUrl);
        if (!imageResponse.ok) {
          throw new Error(`Failed to fetch image: ${imageResponse.status}`);
        }
        imageBlob = await imageResponse.blob();
        console.log(`Image fetched (${(imageBlob.size / 1024).toFixed(2)} KB)`);
      } catch (error) {
        console.error('Failed to fetch image:', error);
        throw new Error(`Cannot fetch market image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Build PNL market link
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : envConfig.APP_URL || 'https://plp.fun';
      const marketUrl = `${baseUrl}/market/${params.marketId}`;

      // Create FormData with actual image file
      const formData = new FormData();
      formData.append('file', imageBlob, 'image.png');
      formData.append('name', tokenName);
      formData.append('symbol', params.tokenMetadata.symbol);

      // Append market link to description for visibility
      const descriptionWithMarket = params.tokenMetadata.description +
        `\n\nPrediction Market: ${marketUrl}`;
      formData.append('description', descriptionWithMarket);

      formData.append('twitter', params.tokenMetadata.twitter || '');
      formData.append('telegram', params.tokenMetadata.telegram || '');
      formData.append('website', params.tokenMetadata.website || marketUrl);
      formData.append('showName', 'true');

      // Retry logic with exponential backoff (3 attempts)
      let metadataUri: string | null = null;
      let lastError: Error | null = null;
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`   Attempt ${attempt}/${maxRetries}...`);

          // Use backend proxy endpoint to avoid CORS
          const ipfsResponse = await fetch(apiUrl('/api/pump/upload-ipfs'), {
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
          console.log(`Image + metadata uploaded to IPFS`);
          console.log(`   Metadata URI: ${metadataUri}`);
          break; // Success, exit retry loop

        } catch (error) {
          lastError = error as Error;
          console.warn(`   Attempt ${attempt} failed: ${lastError.message}`);

          if (attempt < maxRetries) {
            const backoffMs = Math.pow(2, attempt - 1) * 1000;
            console.log(`   Retrying in ${backoffMs / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
        }
      }

      if (!metadataUri) {
        throw new Error(`IPFS upload failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
      }

      // Step 3: Prepare native atomic transaction
      console.log('Preparing native atomic transaction...');
      const connection = await getSolanaConnection();

      const prepareResponse = await fetch(apiUrl('/api/markets/resolve/prepare-native-transaction'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketAddress: params.marketAddress,
          tokenMint: mintKeypair.publicKey.toBase58(),
          callerWallet: primaryWallet!.address,
          founderWallet: primaryWallet!.address,
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
        console.error('Failed to prepare native transaction:', prepareResult.error);
        return { success: false, error: prepareResult.error };
      }

      console.log('Native transaction prepared');
      console.log(`   Transaction size: ${prepareResult.data.size} bytes (limit: ${prepareResult.data.sizeLimit})`);

      // Step 4: Deserialize atomic transaction
      console.log('Loading atomic transaction...');
      const { VersionedTransaction } = await import('@solana/web3.js');

      const txBuffer = Buffer.from(prepareResult.data.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(txBuffer);

      console.log('Transaction deserialized');
      console.log(`   Size: ${txBuffer.length} bytes`);

      // Step 5: Get wallet for signing
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

      // Step 6: Request wallet signature FIRST (before mint keypair)
      console.log('Signing atomic transaction...');

      console.log('Requesting wallet signature (founder + caller)...');
      const signedTxResult = await signTransaction({
        transaction: transaction.serialize(), // Serialize UNSIGNED transaction
        wallet: solanaWallet as any,
      });

      // Deserialize the wallet-signed transaction
      let signedTx = VersionedTransaction.deserialize(
        signedTxResult.signedTransaction
      );
      console.log('Wallet signature added');

      // Step 7: Manually add mint keypair signature to the correct position
      console.log('Adding mint keypair signature manually...');

      try {
        // Get the message bytes that need to be signed
        const messageBytes = signedTx.message.serialize();

        // Sign the message with mint keypair using nacl
        const nacl = await import('tweetnacl');
        const mintSignature = nacl.default.sign.detached(messageBytes, mintKeypair.secretKey);

        // Find which signature position belongs to the mint keypair
        const { PublicKey: SolanaPublicKey } = await import('@solana/web3.js');
        const mintPubkey = mintKeypair.publicKey;
        const walletPubkeyForSigning = new SolanaPublicKey(primaryWallet!.address);

        // Check which position each signer is in
        let mintSignatureIndex = -1;
        let walletSignatureIndex = -1;

        for (let i = 0; i < signedTx.message.staticAccountKeys.length; i++) {
          const accountKey = signedTx.message.staticAccountKeys[i];
          if (accountKey.equals(mintPubkey)) {
            mintSignatureIndex = i;
          }
          if (accountKey.equals(walletPubkeyForSigning)) {
            walletSignatureIndex = i;
          }
        }

        if (mintSignatureIndex === -1) {
          throw new Error('Mint keypair not found in transaction signers');
        }

        if (walletSignatureIndex === -1) {
          throw new Error('Wallet not found in transaction signers');
        }

        // Create a new signatures array with correct signatures in correct positions
        const newSignatures = [...signedTx.signatures];

        // Insert mint signature at correct position
        if (mintSignatureIndex >= 0 && mintSignatureIndex < newSignatures.length) {
          newSignatures[mintSignatureIndex] = mintSignature;
          console.log('Mint signature inserted at position', mintSignatureIndex);
        } else {
          throw new Error(`Invalid mint signature position: ${mintSignatureIndex} (max: ${newSignatures.length - 1})`);
        }

        // Reconstruct the transaction with correct signatures
        signedTx = new VersionedTransaction(signedTx.message, newSignatures);

        console.log('Atomic transaction fully signed');

        // VERIFY SIGNATURES ARE VALID
        const isWalletSigValid = nacl.default.sign.detached.verify(
          messageBytes,
          newSignatures[walletSignatureIndex],
          walletPubkeyForSigning.toBytes()
        );
        const isMintSigValid = nacl.default.sign.detached.verify(
          messageBytes,
          newSignatures[mintSignatureIndex],
          mintPubkey.toBytes()
        );

        if (!isWalletSigValid || !isMintSigValid) {
          throw new Error('Signature validation failed');
        }

        console.log('All signatures are cryptographically valid!');

      } catch (manualSigningError) {
        console.error('Failed to manually add mint signature:', manualSigningError);
        throw new Error(`Manual signature insertion failed: ${manualSigningError instanceof Error ? manualSigningError.message : 'Unknown error'}`);
      }

      // Step 8: Send atomic transaction to Solana network
      console.log('Sending transaction to Solana network...');

      const txSignature = await connection.sendTransaction(signedTx, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      console.log('Transaction sent!');
      console.log(`   Signature: ${txSignature}`);

      // Step 9: Confirm transaction on-chain
      console.log('Confirming transaction on-chain...');

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      await connection.confirmTransaction({
        signature: txSignature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      console.log('Transaction confirmed on-chain!');

      // Update database
      console.log('Updating market state in database...');
      const updateResponse = await fetch(apiUrl('/api/markets/resolve/complete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: params.marketId,
          marketAddress: params.marketAddress,
          signature: txSignature,
          tokenMint: mintKeypair.publicKey.toBase58(),
          network,
        }),
      });

      const updateResult = await updateResponse.json();

      if (!updateResult.success) {
        console.warn('Transaction succeeded but database update failed:', updateResult.error);
      }

      console.log('NATIVE ATOMIC TOKEN LAUNCH SUCCESSFUL!');
      console.log(`Token Mint: ${mintKeypair.publicKey.toBase58()}`);
      console.log(`Signature: ${txSignature}`);

      return {
        success: true,
        signature: txSignature,
      };

    } catch (error) {
      console.error('Token launch error:', error);
      return { success: false, error };
    }
  };

  return {
    resolve,
    isResolving,
  };
}
