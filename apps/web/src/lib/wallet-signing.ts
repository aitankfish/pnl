/**
 * Client-side wallet signing utilities using Dynamic Labs
 */

import { Transaction, Connection } from '@solana/web3.js';

export interface SignTransactionResult {
  success: boolean;
  signature?: string;
  error?: string;
}

// Dynamic Labs wallet interface
interface DynamicWallet {
  address?: string;
  signTransaction: (transaction: Uint8Array) => Promise<{ signature: string } | undefined>;
}

/**
 * Sign a transaction using the user's connected wallet via Dynamic Labs
 */
export async function signTransactionWithWallet(
  transaction: Transaction,
  primaryWallet: DynamicWallet
): Promise<SignTransactionResult> {
  try {
    if (!primaryWallet || !primaryWallet.address) {
      return {
        success: false,
        error: 'No wallet connected'
      };
    }

    // Serialize the transaction for signing
    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false
    });

    // Sign the transaction using Dynamic Labs wallet
    const signedTransaction = await primaryWallet.signTransaction(serializedTransaction);
    
    if (!signedTransaction) {
      return {
        success: false,
        error: 'Failed to sign transaction'
      };
    }

    // Get the signature
    const signature = signedTransaction.signature;
    
    return {
      success: true,
      signature
    };

  } catch (error) {
    console.error('Transaction signing failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown signing error'
    };
  }
}

/**
 * Sign and send a transaction using the user's connected wallet
 */
export async function signAndSendTransaction(
  transaction: Transaction,
  primaryWallet: DynamicWallet,
  connection: Connection
): Promise<SignTransactionResult> {
  try {
    // First sign the transaction
    const signResult = await signTransactionWithWallet(transaction, primaryWallet);

    if (!signResult.success || !signResult.signature) {
      return signResult;
    }

    // Send the signed transaction
    const signature = await connection.sendRawTransaction(Buffer.from(signResult.signature, 'base64'));
    
    // Wait for confirmation
    await connection.confirmTransaction(signature);

    return {
      success: true,
      signature
    };

  } catch (error) {
    console.error('Transaction sending failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown sending error'
    };
  }
}
