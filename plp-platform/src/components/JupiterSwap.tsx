'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useNetwork } from '@/lib/hooks/useNetwork';
import { PublicKey } from '@solana/web3.js';
import { useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import { getSolanaConnection, getSolanaBalance } from '@/lib/solana';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowDownUp, Loader2, ChevronDown, Search, X } from 'lucide-react';

interface JupiterSwapProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
}

interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  logoURI?: string;
}

// Native SOL token info
const SOL_TOKEN: TokenInfo = {
  mint: 'So11111111111111111111111111111111111111112',
  symbol: 'SOL',
  name: 'Solana',
  decimals: 9,
  balance: 0,
  logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
};

// Popular tokens for output selection (when user doesn't have them)
const POPULAR_TOKENS: Omit<TokenInfo, 'balance'>[] = [
  {
    mint: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  },
  {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
  {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
  },
];

export function JupiterSwap({ isOpen, onClose }: JupiterSwapProps) {
  const { primaryWallet } = useWallet();
  const { network } = useNetwork();
  const { signAndSendTransaction } = useSignAndSendTransaction();

  const [userTokens, setUserTokens] = useState<TokenInfo[]>([]);
  const [inputToken, setInputToken] = useState<TokenInfo | null>(null);
  const [outputToken, setOutputToken] = useState<TokenInfo | null>(null);
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInputSelector, setShowInputSelector] = useState(false);
  const [showOutputSelector, setShowOutputSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const jupiterApiKey = process.env.NEXT_PUBLIC_JUPITER_API_KEY;
  const isJupiterSupported = network === 'mainnet-beta';

  // Fetch user's tokens when modal opens
  useEffect(() => {
    if (isOpen && primaryWallet) {
      fetchUserTokens();
    }
  }, [isOpen, primaryWallet]);

  // Set default tokens after loading
  useEffect(() => {
    if (userTokens.length > 0 && !inputToken) {
      // Default input to SOL or first token with balance
      const solToken = userTokens.find(t => t.symbol === 'SOL');
      const firstWithBalance = userTokens.find(t => t.balance > 0);
      const defaultInput = solToken || firstWithBalance || userTokens[0];
      setInputToken(defaultInput);

      // Default output to USDC if user has SOL, otherwise SOL
      const usdcInfo = POPULAR_TOKENS.find(t => t.symbol === 'USDC');
      const usdcToken = userTokens.find(t => t.symbol === 'USDC') ||
        (usdcInfo ? { ...usdcInfo, balance: 0 } : null);

      if (defaultInput?.symbol === 'SOL' && usdcToken) {
        setOutputToken(usdcToken);
      } else {
        setOutputToken({ ...SOL_TOKEN, balance: solToken?.balance || 0 });
      }
    }
  }, [userTokens]);

  const fetchUserTokens = async () => {
    if (!primaryWallet) return;

    setIsLoadingTokens(true);
    try {
      const walletPubkey = new PublicKey(primaryWallet.address);
      const connection = await getSolanaConnection(network);

      // Get SOL balance
      const solBalanceLamports = await getSolanaBalance(walletPubkey);
      const solBalance = solBalanceLamports / 1e9;

      const tokens: TokenInfo[] = [
        { ...SOL_TOKEN, balance: solBalance },
      ];

      // Get all SPL token accounts
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPubkey, {
        programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      });

      // Fetch token metadata from Jupiter API for better names/logos
      const tokenMints = tokenAccounts.value
        .filter(acc => {
          const amount = acc.account.data.parsed.info.tokenAmount;
          return parseFloat(amount.uiAmount) > 0;
        })
        .map(acc => acc.account.data.parsed.info.mint);

      // Get token info from our internal API (uses Helius DAS - more reliable)
      let tokenMetadata: Record<string, any> = {};
      if (tokenMints.length > 0) {
        try {
          // Fetch metadata for each token using our internal API
          const metadataPromises = tokenMints.map(async (mint) => {
            try {
              const response = await fetch('/api/tokens/metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mint }),
              });
              if (response.ok) {
                const data = await response.json();
                if (data.success && data.metadata) {
                  return { mint, metadata: data.metadata };
                }
              }
              return { mint, metadata: null };
            } catch {
              return { mint, metadata: null };
            }
          });

          const results = await Promise.all(metadataPromises);
          tokenMetadata = results.reduce((acc: Record<string, any>, { mint, metadata }) => {
            if (metadata) {
              acc[mint] = {
                symbol: metadata.symbol,
                name: metadata.name,
                logoURI: metadata.logoURI,
              };
            }
            return acc;
          }, {});
        } catch (e) {
          console.warn('Failed to fetch token metadata:', e);
        }
      }

      // Process token accounts
      for (const acc of tokenAccounts.value) {
        const parsed = acc.account.data.parsed.info;
        const mint = parsed.mint;
        const amount = parsed.tokenAmount;
        const balance = parseFloat(amount.uiAmount);

        if (balance > 0) {
          const metadata = tokenMetadata[mint];
          tokens.push({
            mint,
            symbol: metadata?.symbol || mint.slice(0, 4).toUpperCase(),
            name: metadata?.name || 'Unknown Token',
            decimals: amount.decimals,
            balance,
            logoURI: metadata?.logoURI,
          });
        }
      }

      setUserTokens(tokens);
    } catch (err) {
      console.error('Error fetching tokens:', err);
    } finally {
      setIsLoadingTokens(false);
    }
  };

  // Reverse swap direction
  const handleReverseDirection = () => {
    const temp = inputToken;
    setInputToken(outputToken);
    setOutputToken(temp);
    setInputAmount(outputAmount);
    setOutputAmount(inputAmount);
    setQuote(null);
  };

  // Get quote from Jupiter API
  const getQuote = useCallback(async (amount: string) => {
    if (!amount || parseFloat(amount) <= 0 || !inputToken || !outputToken) {
      setOutputAmount('');
      setQuote(null);
      return;
    }

    try {
      setIsLoadingQuote(true);
      setError(null);

      const amountInSmallestUnit = Math.floor(parseFloat(amount) * Math.pow(10, inputToken.decimals));

      console.log('Getting quote:', {
        input: inputToken.symbol,
        output: outputToken.symbol,
        amount,
        amountInSmallestUnit,
      });

      const quoteResponse = await fetch(
        `https://api.jup.ag/swap/v1/quote?inputMint=${inputToken.mint}&outputMint=${outputToken.mint}&amount=${amountInSmallestUnit}&slippageBps=50`,
        {
          headers: {
            'Accept': 'application/json',
            'x-api-key': jupiterApiKey || '',
          }
        }
      );

      if (!quoteResponse.ok) {
        const errorText = await quoteResponse.text();
        console.error('Jupiter API error:', errorText);
        throw new Error(`Jupiter API error: ${quoteResponse.status}`);
      }

      const quoteData = await quoteResponse.json();

      if (!quoteData || !quoteData.outAmount) {
        throw new Error('Invalid quote response from Jupiter');
      }

      setQuote(quoteData);

      const output = parseInt(quoteData.outAmount) / Math.pow(10, outputToken.decimals);
      setOutputAmount(output.toFixed(Math.min(outputToken.decimals, 6)));

      console.log('Quote received:', quoteData);
    } catch (err: any) {
      console.error('Error getting quote:', err);

      let errorMessage = 'Failed to fetch quote';
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        errorMessage = 'Network error: Unable to connect to Jupiter API.';
      } else if (err.message.includes('404') || err.message.includes('400')) {
        errorMessage = 'This token pair is not supported for swapping.';
      } else {
        errorMessage = err.message || errorMessage;
      }

      setError(errorMessage);
    } finally {
      setIsLoadingQuote(false);
    }
  }, [inputToken, outputToken, jupiterApiKey]);

  // Debounce quote fetching
  useEffect(() => {
    if (!isJupiterSupported) {
      setError('Jupiter swap is only available on Solana mainnet.');
      return;
    }

    const timer = setTimeout(() => {
      if (isOpen && inputAmount && inputToken && outputToken) {
        getQuote(inputAmount);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [inputAmount, inputToken, outputToken, isOpen, isJupiterSupported, getQuote]);

  // Execute swap
  const handleSwap = async () => {
    if (!quote || !primaryWallet || !inputToken || !outputToken) return;

    try {
      setIsSwapping(true);
      setError(null);

      console.log('Getting swap transaction from Jupiter...');

      const swapResponse = await fetch('https://api.jup.ag/swap/v1/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': jupiterApiKey || '',
        },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: primaryWallet.address,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
        }),
      });

      if (!swapResponse.ok) {
        const errorText = await swapResponse.text();
        console.error('Jupiter swap API error:', errorText);
        throw new Error('Failed to get swap transaction');
      }

      const { swapTransaction } = await swapResponse.json();

      console.log('Swap transaction received, signing and sending...');

      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      const privyWallet = (primaryWallet as any)._privyWallet;

      const result = await signAndSendTransaction({
        transaction: Buffer.from(swapTransactionBuf),
        wallet: privyWallet,
      });

      console.log('Swap successful!', result);

      alert(`Swap successful! ${inputAmount} ${inputToken.symbol} → ${outputAmount} ${outputToken.symbol}`);

      fetchUserTokens();
      onClose();
    } catch (err: any) {
      console.error('Swap error:', err);
      setError(err.message || 'Swap failed');
    } finally {
      setIsSwapping(false);
    }
  };

  // Token selector component
  const TokenSelector = ({
    isInput,
    onSelect,
    onClose: closeSelector
  }: {
    isInput: boolean;
    onSelect: (token: TokenInfo) => void;
    onClose: () => void;
  }) => {
    const availableTokens = isInput
      ? userTokens.filter(t => t.balance > 0)
      : [...userTokens, ...POPULAR_TOKENS.filter(pt => !userTokens.find(ut => ut.mint === pt.mint)).map(pt => ({ ...pt, balance: 0 }))];

    const filteredTokens = availableTokens.filter(t =>
      t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.mint.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="bg-[#1C1F2E] rounded-xl w-full max-w-sm mx-4 max-h-[70vh] flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-white">Select Token</h3>
              <button onClick={closeSelector} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or address"
                className="pl-10 bg-[#0F1419] border-gray-700 text-white"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {filteredTokens.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No tokens found</p>
            ) : (
              filteredTokens.map((token) => (
                <button
                  key={token.mint}
                  onClick={() => {
                    onSelect(token);
                    closeSelector();
                    setSearchQuery('');
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors"
                >
                  {token.logoURI ? (
                    <img
                      src={token.logoURI}
                      alt={token.symbol}
                      className="w-8 h-8 rounded-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23374151"/><text x="50" y="60" text-anchor="middle" fill="white" font-size="40">' + token.symbol[0] + '</text></svg>';
                      }}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold">
                      {token.symbol[0]}
                    </div>
                  )}
                  <div className="flex-1 text-left">
                    <p className="text-white font-medium">{token.symbol}</p>
                    <p className="text-gray-400 text-xs truncate">{token.name}</p>
                  </div>
                  {token.balance > 0 && (
                    <span className="text-gray-400 text-sm">
                      {token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4">
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors text-sm font-medium"
        >
          Close ✕
        </button>

        <div className="bg-[#1C1F2E] rounded-xl p-6 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6">Swap Tokens</h2>

          {!isJupiterSupported && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
              <p className="text-yellow-400 text-sm font-medium mb-2">⚠️ Mainnet Only</p>
              <p className="text-yellow-300/80 text-xs">
                Jupiter swap is only available on Solana mainnet.
              </p>
            </div>
          )}

          {isLoadingTokens ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              <span className="ml-3 text-gray-400">Loading tokens...</span>
            </div>
          ) : (
            <>
              {/* From Token */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm text-gray-400">You pay</label>
                  {inputToken && (
                    <button
                      onClick={() => setInputAmount(inputToken.balance.toString())}
                      className="text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      Balance: {inputToken.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {inputToken.symbol}
                    </button>
                  )}
                </div>
                <div className="bg-[#0F1419] rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      value={inputAmount}
                      onChange={(e) => setInputAmount(e.target.value)}
                      className="flex-1 bg-transparent border-none text-2xl text-white font-bold p-0 focus-visible:ring-0"
                      placeholder="0.00"
                      min="0"
                    />
                    <button
                      onClick={() => setShowInputSelector(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors"
                    >
                      {inputToken?.logoURI ? (
                        <img src={inputToken.logoURI} alt={inputToken.symbol} className="w-6 h-6 rounded-full" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500" />
                      )}
                      <span className="text-white font-semibold">{inputToken?.symbol || 'Select'}</span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Swap Direction Button */}
              <div className="flex justify-center -my-2 relative z-10">
                <button
                  onClick={handleReverseDirection}
                  className="bg-[#1C1F2E] border-4 border-[#0F1419] rounded-full p-2 hover:bg-[#2C2F3E] transition-colors cursor-pointer"
                  title="Reverse swap direction"
                >
                  <ArrowDownUp className="w-5 h-5 text-cyan-400" />
                </button>
              </div>

              {/* To Token */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm text-gray-400">You receive</label>
                  {outputToken && (
                    <span className="text-xs text-gray-500">
                      Balance: {(outputToken.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })} {outputToken.symbol}
                    </span>
                  )}
                </div>
                <div className="bg-[#0F1419] rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-2xl text-white font-bold">
                      {isLoadingQuote ? (
                        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                      ) : (
                        outputAmount || '0.00'
                      )}
                    </div>
                    <button
                      onClick={() => setShowOutputSelector(true)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 transition-colors"
                    >
                      {outputToken?.logoURI ? (
                        <img src={outputToken.logoURI} alt={outputToken.symbol} className="w-6 h-6 rounded-full" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500" />
                      )}
                      <span className="text-white font-semibold">{outputToken?.symbol || 'Select'}</span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Quote Info */}
              {quote && outputAmount && inputAmount && inputToken && outputToken && (
                <div className="bg-[#0F1419] rounded-lg p-3 mb-4 text-sm">
                  <div className="flex justify-between text-gray-400 mb-1">
                    <span>Rate</span>
                    <span className="text-white">
                      1 {inputToken.symbol} = {(parseFloat(inputAmount) > 0 ? parseFloat(outputAmount) / parseFloat(inputAmount) : 0).toFixed(6)} {outputToken.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Price Impact</span>
                    <span className={(parseFloat(quote.priceImpactPct) || 0) > 1 ? 'text-red-400' : 'text-green-400'}>
                      {(parseFloat(quote.priceImpactPct) || 0).toFixed(2)}%
                    </span>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Swap Button */}
              <Button
                onClick={handleSwap}
                disabled={!isJupiterSupported || !quote || isSwapping || isLoadingQuote || !inputAmount || parseFloat(inputAmount) <= 0 || !inputToken || !outputToken}
                className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-semibold py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSwapping ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Swapping...
                  </>
                ) : !isJupiterSupported ? (
                  'Switch to Mainnet'
                ) : !inputToken || !outputToken ? (
                  'Select Tokens'
                ) : (
                  'Swap'
                )}
              </Button>

              <p className="text-gray-500 text-xs text-center mt-4">
                Powered by Jupiter • Network: {network}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Token Selectors */}
      {showInputSelector && (
        <TokenSelector
          isInput={true}
          onSelect={(token) => {
            setInputToken(token);
            if (token.mint === outputToken?.mint) {
              setOutputToken(inputToken);
            }
          }}
          onClose={() => setShowInputSelector(false)}
        />
      )}

      {showOutputSelector && (
        <TokenSelector
          isInput={false}
          onSelect={(token) => {
            setOutputToken(token);
            if (token.mint === inputToken?.mint) {
              setInputToken(outputToken);
            }
          }}
          onClose={() => setShowOutputSelector(false)}
        />
      )}
    </div>
  );
}
