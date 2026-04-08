/**
 * useExtend Hook
 * Handles the market extension flow: prepare -> sign -> send -> confirm
 * Uses VersionedTransaction and Privy wallet signer (signAndSendTransaction)
 */

import { useState } from 'react';
import { useWallet } from './useWallet';
import { getSolanaConnection } from '../solana/connection';
import { useNetwork } from './useNetwork';
import { apiUrl } from '../utils/api';
import { useSignAndSendTransaction, useWallets, useStandardWallets } from '@privy-io/react-auth/solana';
import bs58 from 'bs58';

export function useExtend() {
  const [isExtending, setIsExtending] = useState(false);
  const { primaryWallet } = useWallet();
  const { network } = useNetwork();
  const { wallets } = useWallets(); // External wallets
  const { wallets: standardWallets } = useStandardWallets(); // Standard wallet interface (includes embedded)
  const { signAndSendTransaction } = useSignAndSendTransaction();

  const extend = async (params: {
    marketId: string;
    marketAddress: string;
  }): Promise<{ success: boolean; signature?: string; error?: any }> => {
    if (!primaryWallet) {
      return { success: false, error: 'No wallet connected' };
    }

    // Only founder can extend a market

    try {
      setIsExtending(true);

      // Step 1: Prepare transaction
      console.log('Preparing extend market transaction...');
      const prepareResponse = await fetch(apiUrl('/api/markets/extend/prepare'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketAddress: params.marketAddress,
          founderWallet: primaryWallet.address,
          network,
        }),
      });

      const prepareResult = await prepareResponse.json();

      if (!prepareResult.success) {
        console.error('Failed to prepare extend transaction:', prepareResult.error);
        return { success: false, error: prepareResult.error };
      }

      console.log('Extend transaction prepared');

      let signature;

      try {
        console.log('Signing and sending transaction with Privy...');

        const rawTx = prepareResult.data.serializedTransaction;
        if (!rawTx) {
          throw new Error('No serializedTransaction provided by server');
        }

        // Get Solana wallet - prioritize external wallets, fallback to standard wallets (embedded)
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
        const connection = await getSolanaConnection(network);
        await connection.confirmTransaction(signature, 'confirmed');
        console.log('Transaction confirmed on blockchain!');

        // Step 3: Call complete endpoint to update database and create notifications
        console.log('Updating database and creating notifications...');
        try {
          const completeResponse = await fetch(apiUrl('/api/markets/extend/complete'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              marketId: params.marketId,
              marketAddress: params.marketAddress,
              signature,
            }),
          });

          const completeResult = await completeResponse.json();
          if (completeResult.success) {
            console.log('Database updated and notifications created');
          } else {
            console.warn('Complete endpoint failed (non-fatal):', completeResult.error);
          }
        } catch (completeError) {
          console.warn('Failed to call complete endpoint (non-fatal):', completeError);
        }

      } catch (signerError: unknown) {
        const errorMessage = signerError instanceof Error ? signerError.message : 'Unknown error';
        console.error('Transaction failed:', errorMessage);

        // Extract detailed error from logs if available
        if (errorMessage.includes('Logs:')) {
          console.error('Transaction logs:', errorMessage);
        }

        return { success: false, error: errorMessage };
      }

      console.log('Market extended successfully to Funding Phase!');
      return {
        success: true,
        signature,
      };

    } catch (error) {
      console.error('Extend error:', error);
      return { success: false, error };
    } finally {
      setIsExtending(false);
    }
  };

  return {
    extend,
    isExtending,
  };
}
