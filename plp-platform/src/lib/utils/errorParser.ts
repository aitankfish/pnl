/**
 * Error Parser Utility
 *
 * Parses on-chain errors and RPC errors into user-friendly messages
 */

export interface ParsedError {
  title: string;
  message: string;
  details?: string;
}

// Map of program error codes to user-friendly messages
const PROGRAM_ERRORS: Record<number, { title: string; message: string }> = {
  6000: {
    title: 'Market Expired',
    message: 'This market has already expired. You can no longer vote on this market.',
  },
  6001: {
    title: 'Market Not Expired',
    message: 'This market has not expired yet. Please wait for the expiry time.',
  },
  6002: {
    title: 'Already Resolved',
    message: 'This market has already been resolved. No further actions are possible.',
  },
  6003: {
    title: 'Already Has Position',
    message: 'You already have a position on the opposite side. Each wallet can only hold one position per market.',
  },
  6004: {
    title: 'Investment Too Small',
    message: 'The minimum investment is 0.01 SOL. Please increase your amount.',
  },
  6005: {
    title: 'Pool Capacity Reached',
    message: 'The target pool for this market has been filled. No more votes can be accepted.',
  },
  6006: {
    title: 'Already Claimed',
    message: 'You have already claimed your rewards for this market.',
  },
  6007: {
    title: 'Unauthorized',
    message: 'You do not have permission to perform this action.',
  },
  6008: {
    title: 'Math Error',
    message: 'A calculation error occurred. This is usually due to the trade amount being too large or too small.',
  },
  6009: {
    title: 'Token Creation Failed',
    message: 'Failed to create token via Pump.fun. Please try again.',
  },
  6010: {
    title: 'Invalid Metadata',
    message: 'The market metadata is invalid or too long.',
  },
  6011: {
    title: 'Insufficient Balance',
    message: 'You do not have enough SOL in your wallet for this transaction.',
  },
  6012: {
    title: 'Invalid Target Pool',
    message: 'The target pool size must be 5, 10, or 15 SOL.',
  },
  6013: {
    title: 'Invalid Resolution State',
    message: 'The market is not in the correct state for this action.',
  },
  6014: {
    title: 'Cannot Close Position',
    message: 'You must claim your rewards first or wait for the refund state.',
  },
  6015: {
    title: 'Claim Period Not Over',
    message: 'The claim period has not ended yet (30 days after expiry).',
  },
  6016: {
    title: 'Pool Not Empty',
    message: 'Cannot close market - there are still unclaimed funds in the pool.',
  },
};

/**
 * Parse an error from the blockchain into a user-friendly message
 */
export function parseError(error: unknown): ParsedError {
  // Helper to safely get error message
  const getErrorMessage = (err: unknown): string => {
    if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
      return err.message;
    }
    return String(err);
  };

  // Default error response
  const defaultError: ParsedError = {
    title: 'Transaction Failed',
    message: 'An unexpected error occurred. Please try again.',
    details: getErrorMessage(error),
  };

  if (!error) {
    return defaultError;
  }

  const errorString = String(error);

  // Check for program errors (format: "Error Code: ErrorName. Error Number: 6000.")
  const programErrorMatch = errorString.match(/Error Number: (\d+)/);
  if (programErrorMatch) {
    const errorCode = parseInt(programErrorMatch[1], 10);
    const errorInfo = PROGRAM_ERRORS[errorCode];

    if (errorInfo) {
      return {
        title: errorInfo.title,
        message: errorInfo.message,
        details: `Error Code: ${errorCode}`,
      };
    }
  }

  // Check for custom program error messages
  const customErrorMatch = errorString.match(/custom program error: (0x[0-9a-fA-F]+)/);
  if (customErrorMatch) {
    const hexCode = customErrorMatch[1];
    const errorCode = parseInt(hexCode, 16);
    const errorInfo = PROGRAM_ERRORS[errorCode];

    if (errorInfo) {
      return {
        title: errorInfo.title,
        message: errorInfo.message,
        details: `Error Code: ${errorCode} (${hexCode})`,
      };
    }
  }

  // Check for token launch errors
  if (errorString.includes('Insufficient balance to launch token')) {
    // Extract the detailed message if available
    return {
      title: 'Insufficient Balance',
      message: errorString,
      details: 'You need more SOL in your wallet to launch the token.',
    };
  }

  // Check for devnet mode error
  if (errorString.includes('Token launch is not supported on devnet')) {
    return {
      title: 'Devnet Not Supported',
      message: errorString,
      details: 'Please switch to mainnet to test token creation.',
    };
  }

  // Check for insufficient funds errors
  if (errorString.includes('insufficient funds') || errorString.includes('Attempt to debit an account but found no record of a prior credit')) {
    return {
      title: 'Insufficient Funds',
      message: 'You do not have enough SOL in your wallet to complete this transaction.',
      details: 'Please add more SOL to your wallet and try again.',
    };
  }

  // Check for "No position found" error (already claimed)
  if (errorString.includes('No position found') || errorString.includes('position not found')) {
    return {
      title: 'No Position Found',
      message: 'You have already claimed your rewards or closed your position for this market.',
      details: 'Your position account no longer exists on the blockchain.',
    };
  }

  // Check for user rejected transaction
  if (errorString.includes('User rejected') || errorString.includes('user rejected')) {
    return {
      title: 'Transaction Cancelled',
      message: 'You cancelled the transaction in your wallet.',
      details: 'No funds were transferred.',
    };
  }

  // Check for network/RPC errors
  if (errorString.includes('429') || errorString.includes('rate limit')) {
    return {
      title: 'Network Busy',
      message: 'The Solana network is experiencing high traffic. Please wait a moment and try again.',
      details: 'Rate limit exceeded',
    };
  }

  if (errorString.includes('timeout') || errorString.includes('timed out')) {
    return {
      title: 'Transaction Timeout',
      message: 'The transaction took too long to process. It may still complete - please check your wallet.',
      details: 'Network timeout',
    };
  }

  // Check for blockhash errors
  if (errorString.includes('Blockhash not found') || errorString.includes('block height exceeded')) {
    return {
      title: 'Transaction Expired',
      message: 'The transaction expired before it could be confirmed. Please try again.',
      details: 'Blockhash expired',
    };
  }

  // Return default error with original message
  return defaultError;
}

/**
 * Format a transaction signature for display
 */
export function formatSignature(signature: string): string {
  if (!signature || signature.length < 20) return signature;
  return `${signature.slice(0, 8)}...${signature.slice(-8)}`;
}

/**
 * Get Helius Orb URL for a transaction
 */
export function getExplorerUrl(signature: string, cluster: 'mainnet' | 'devnet' = 'devnet'): string {
  const clusterParam = cluster === 'devnet' ? '?cluster=devnet' : '';
  return `https://orb.helius.dev/tx/${signature}${clusterParam}`;
}
