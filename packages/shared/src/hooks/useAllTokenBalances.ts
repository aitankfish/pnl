/**
 * Hook to fetch all SPL Token and Token2022 balances for a wallet
 * Returns token accounts with metadata (symbol, name, logo, balance)
 * Uses SWR for smart caching — no raw setInterval
 */

import { useMemo } from 'react';
import useSWR from 'swr';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { getSolanaConnection } from '../solana/connection';
import { createClientLogger } from '../utils/logger';
import { apiUrl } from '../utils/api';

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

async function fetchTokenBalances(walletAddress: string): Promise<TokenBalance[]> {
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

  // Parse token data — only non-zero balances
  const tokenBalances: TokenBalance[] = [];
  for (const account of allAccounts) {
    const parsedInfo = account.account.data.parsed.info;
    const balance = parsedInfo.tokenAmount.amount;
    const decimals = parsedInfo.tokenAmount.decimals;
    const uiAmount = parsedInfo.tokenAmount.uiAmount;
    const mint = parsedInfo.mint;

    if (uiAmount > 0) {
      tokenBalances.push({ mint, balance: Number(balance), decimals, uiAmount, programId: account.programId });
    }
  }

  if (tokenBalances.length === 0) return [];

  // Fetch metadata in a single batch request (instead of N individual calls)
  try {
    const allMints = tokenBalances.map((t) => t.mint);
    const response = await fetch(apiUrl('/api/tokens/metadata'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mints: allMints }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.metadata && Array.isArray(data.metadata)) {
        const metaMap = new Map(data.metadata.map((m: any) => [m.mint, m]));
        return tokenBalances.map((token) => {
          const meta = metaMap.get(token.mint);
          return meta
            ? { ...token, symbol: meta.symbol || 'UNKNOWN', name: meta.name || 'Unknown Token', logoURI: meta.logoURI }
            : { ...token, symbol: `${token.mint.slice(0, 4)}...${token.mint.slice(-4)}`, name: 'Unknown Token' };
        });
      }
    }
    // Fallback: return tokens without metadata
    return tokenBalances.map((t) => ({ ...t, symbol: `${t.mint.slice(0, 4)}...${t.mint.slice(-4)}`, name: 'Unknown Token' }));
  } catch {
    return tokenBalances;
  }
}

export function useAllTokenBalances(walletAddress: string | null | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    walletAddress ? `token-balances:${walletAddress}` : null,
    () => fetchTokenBalances(walletAddress!),
    {
      refreshInterval: 180_000, // 3 minutes — RPC-heavy, avoid rate limits
      dedupingInterval: 30_000,
      revalidateOnFocus: false,
      errorRetryCount: 2,
    },
  );

  const tokens = useMemo(() => data ?? [], [data]);

  return { tokens, isLoading, error: error?.message ?? null, refresh: mutate };
}
