/**
 * Hook to fetch all SPL Token and Token2022 balances for a wallet
 * Returns token accounts with metadata (symbol, name, logo, balance)
 */

import { useEffect, useState } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { getSolanaConnection } from '@/lib/solana';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export interface TokenBalance {
  mint: string;
  balance: number;
  decimals: number;
  uiAmount: number;
  symbol?: string;
  name?: string;
  logoURI?: string;
  programId: string;
}

/**
 * Fetch all token balances for a wallet (both SPL Token and Token2022)
 */
export function useAllTokenBalances(walletAddress: string | null | undefined) {
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setTokens([]);
      return;
    }

    let isMounted = true;

    const fetchTokenBalances = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const connection = await getSolanaConnection();
        const ownerPubkey = new PublicKey(walletAddress);

        // Fetch token accounts for both programs
        const [splTokenAccounts, token2022Accounts] = await Promise.all([
          connection.getParsedTokenAccountsByOwner(ownerPubkey, {
            programId: TOKEN_PROGRAM_ID,
          }),
          connection.getParsedTokenAccountsByOwner(ownerPubkey, {
            programId: TOKEN_2022_PROGRAM_ID,
          }),
        ]);

        // Combine and parse accounts
        const allAccounts = [
          ...splTokenAccounts.value.map(acc => ({ ...acc, programId: TOKEN_PROGRAM_ID.toBase58() })),
          ...token2022Accounts.value.map(acc => ({ ...acc, programId: TOKEN_2022_PROGRAM_ID.toBase58() })),
        ];

        // Parse token data
        const tokenBalances: TokenBalance[] = [];

        for (const account of allAccounts) {
          const parsedInfo = account.account.data.parsed.info;
          const balance = parsedInfo.tokenAmount.amount;
          const decimals = parsedInfo.tokenAmount.decimals;
          const uiAmount = parsedInfo.tokenAmount.uiAmount;
          const mint = parsedInfo.mint;

          // Only include tokens with non-zero balance
          if (uiAmount > 0) {
            tokenBalances.push({
              mint,
              balance: Number(balance),
              decimals,
              uiAmount,
              programId: account.programId,
            });
          }
        }

        // Fetch metadata for all tokens using Helius DAS API
        if (tokenBalances.length > 0) {
          try {
            const metadataPromises = tokenBalances.map(async (token) => {
              try {
                // Use Helius DAS API to fetch token metadata
                const response = await fetch('/api/tokens/metadata', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mint: token.mint }),
                });

                if (response.ok) {
                  const data = await response.json();
                  if (data.success && data.metadata) {
                    return {
                      ...token,
                      symbol: data.metadata.symbol || 'UNKNOWN',
                      name: data.metadata.name || 'Unknown Token',
                      logoURI: data.metadata.logoURI,
                    };
                  }
                }

                // Fallback if metadata fetch fails
                return {
                  ...token,
                  symbol: `${token.mint.slice(0, 4)}...${token.mint.slice(-4)}`,
                  name: 'Unknown Token',
                };
              } catch (err) {
                logger.error('Failed to fetch token metadata', { mint: token.mint, error: err });
                return {
                  ...token,
                  symbol: `${token.mint.slice(0, 4)}...${token.mint.slice(-4)}`,
                  name: 'Unknown Token',
                };
              }
            });

            const tokensWithMetadata = await Promise.all(metadataPromises);

            if (isMounted) {
              setTokens(tokensWithMetadata);
            }
          } catch (err) {
            logger.error('Failed to fetch token metadata batch', err);
            if (isMounted) {
              setTokens(tokenBalances);
            }
          }
        } else {
          if (isMounted) {
            setTokens([]);
          }
        }
      } catch (err) {
        logger.error('Failed to fetch token balances', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch token balances');
          setTokens([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTokenBalances();

    // Refresh every 30 seconds
    const interval = setInterval(fetchTokenBalances, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [walletAddress]);

  return { tokens, isLoading, error };
}
