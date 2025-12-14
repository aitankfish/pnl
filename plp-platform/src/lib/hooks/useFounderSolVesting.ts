/**
 * useFounderSolVesting Hook
 * Handles founder SOL vesting operations: init and claim
 * Uses VersionedTransaction and Privy wallet signer (signAndSendTransaction)
 *
 * This is for excess SOL beyond 50 SOL when pool > target.
 * Distribution: 8% immediate + 92% vested over 12 months
 */

import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { getSolanaConnection } from '@/lib/solana';
import { useNetwork } from './useNetwork';
import { useSignAndSendTransaction, useWallets, useStandardWallets } from '@privy-io/react-auth/solana';
import bs58 from 'bs58';

export function useFounderSolVesting() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const { primaryWallet } = useWallet();
  const { network } = useNetwork();
  const { wallets } = useWallets(); // External wallets
  const { wallets: standardWallets } = useStandardWallets(); // Standard wallet interface (includes embedded)
  const { signAndSendTransaction } = useSignAndSendTransaction();

  const initFounderSolVesting = async (params: {
    marketAddress: string;
  }): Promise<{ success: boolean; signature?: string; error?: any }> => {
    if (!primaryWallet) {
      return { success: false, error: 'No wallet connected' };
    }

    try {
      setIsInitializing(true);

      console.log('Preparing init founder SOL vesting transaction...');
      const prepareResponse = await fetch('/api/markets/founder-sol/init', {
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
        console.error('Failed to prepare init founder SOL vesting transaction:', prepareResult.error);
        return { success: false, error: prepareResult.error };
      }

      console.log('Init founder SOL vesting transaction prepared');

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

      } catch (signerError: unknown) {
        const errorMessage = signerError instanceof Error ? signerError.message : 'Unknown error';
        console.error('Transaction failed:', errorMessage);

        // Extract detailed error from logs if available
        if (errorMessage.includes('Logs:')) {
          console.error('Transaction logs:', errorMessage);
        }

        return { success: false, error: errorMessage };
      }

      console.log('Founder SOL vesting initialized successfully!');
      return {
        success: true,
        signature,
      };

    } catch (error) {
      console.error('Init founder SOL vesting error:', error);
      return { success: false, error };
    } finally {
      setIsInitializing(false);
    }
  };

  const claimFounderSol = async (params: {
    marketAddress: string;
  }): Promise<{ success: boolean; signature?: string; error?: any }> => {
    if (!primaryWallet) {
      return { success: false, error: 'No wallet connected' };
    }

    try {
      setIsClaiming(true);

      console.log('Preparing claim founder SOL transaction...');
      const prepareResponse = await fetch('/api/markets/founder-sol/claim', {
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
        console.error('Failed to prepare claim founder SOL transaction:', prepareResult.error);
        return { success: false, error: prepareResult.error };
      }

      console.log('Claim founder SOL transaction prepared');

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

      } catch (signerError: unknown) {
        const errorMessage = signerError instanceof Error ? signerError.message : 'Unknown error';
        console.error('Transaction failed:', errorMessage);

        // Extract detailed error from logs if available
        if (errorMessage.includes('Logs:')) {
          console.error('Transaction logs:', errorMessage);
        }

        return { success: false, error: errorMessage };
      }

      console.log('Founder SOL claimed successfully!');
      return {
        success: true,
        signature,
      };

    } catch (error) {
      console.error('Claim founder SOL error:', error);
      return { success: false, error };
    } finally {
      setIsClaiming(false);
    }
  };

  return {
    initFounderSolVesting,
    isInitializing,
    claimFounderSol,
    isClaiming,
  };
}
