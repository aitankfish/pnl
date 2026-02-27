'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useNetwork } from '@/lib/hooks/useNetwork';
import { PublicKey } from '@solana/web3.js';
import { useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import { getSolanaConnection, getSolanaBalance } from '@/lib/solana';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowDownUp, Loader2, ExternalLink, RefreshCw } from 'lucide-react';

interface TokenTradingProps {
  tokenMint: string;
  tokenSymbol: string;
  tokenImageUrl?: string;
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

// Native SOL mint address
const SOL_MINT = 'So11111111111111111111111111111111111111112';

export function TokenTrading({ tokenMint, tokenSymbol, tokenImageUrl }: TokenTradingProps) {
  const { primaryWallet } = useWallet();
  const { network } = useNetwork();
  const { signAndSendTransaction } = useSignAndSendTransaction();

  // Swap state
  const [isBuyMode, setIsBuyMode] = useState(true); // true = buy token with SOL, false = sell token for SOL
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [tokenBalance, setTokenBalance] = useState<number>(0);

  const jupiterApiKey = process.env.NEXT_PUBLIC_JUPITER_API_KEY;
  const isMainnet = network === 'mainnet-beta';

  // Fetch balances
  useEffect(() => {
    if (primaryWallet) {
      fetchBalances();
    }
  }, [primaryWallet, network]);

  const fetchBalances = async () => {
    if (!primaryWallet) return;

    try {
      const walletPubkey = new PublicKey(primaryWallet.address);
      const connection = await getSolanaConnection(network);

      // Get SOL balance
      const solBalanceLamports = await getSolanaBalance(walletPubkey);
      setSolBalance(solBalanceLamports / 1e9);

      // Get token balance
      try {
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPubkey, {
          mint: new PublicKey(tokenMint),
        });

        if (tokenAccounts.value.length > 0) {
          const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
          setTokenBalance(balance || 0);
        } else {
          setTokenBalance(0);
        }
      } catch {
        setTokenBalance(0);
      }
    } catch (err) {
      console.error('Error fetching balances:', err);
    }
  };

  // Get quote from Jupiter API
  const getQuote = useCallback(async (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      setOutputAmount('');
      setQuote(null);
      return;
    }

    const inputMint = isBuyMode ? SOL_MINT : tokenMint;
    const outputMint = isBuyMode ? tokenMint : SOL_MINT;
    const inputDecimals = isBuyMode ? 9 : 6; // SOL has 9, most tokens have 6

    try {
      setIsLoadingQuote(true);
      setError(null);

      const amountInSmallestUnit = Math.floor(parseFloat(amount) * Math.pow(10, inputDecimals));

      const quoteResponse = await fetch(
        `https://api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountInSmallestUnit}&slippageBps=100`,
        {
          headers: {
            'Accept': 'application/json',
            'x-api-key': jupiterApiKey || '',
          }
        }
      );

      if (!quoteResponse.ok) {
        throw new Error(`Jupiter API error: ${quoteResponse.status}`);
      }

      const quoteData = await quoteResponse.json();

      if (!quoteData || !quoteData.outAmount) {
        throw new Error('No route found for this swap');
      }

      setQuote(quoteData);

      const outputDecimals = isBuyMode ? 6 : 9;
      const output = parseInt(quoteData.outAmount) / Math.pow(10, outputDecimals);
      setOutputAmount(output.toFixed(Math.min(outputDecimals, 6)));
    } catch (err: any) {
      console.error('Error getting quote:', err);
      setError(err.message || 'Failed to fetch quote');
      setOutputAmount('');
    } finally {
      setIsLoadingQuote(false);
    }
  }, [isBuyMode, tokenMint, jupiterApiKey]);

  // Debounce quote fetching
  useEffect(() => {
    if (!isMainnet) {
      setError('Trading is only available on mainnet');
      return;
    }

    const timer = setTimeout(() => {
      if (inputAmount) {
        getQuote(inputAmount);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [inputAmount, isBuyMode, isMainnet, getQuote]);

  // Execute swap
  const handleSwap = async () => {
    if (!quote || !primaryWallet) return;

    try {
      setIsSwapping(true);
      setError(null);

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
        throw new Error('Failed to get swap transaction');
      }

      const { swapTransaction } = await swapResponse.json();
      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
      const privyWallet = (primaryWallet as any)._privyWallet;

      await signAndSendTransaction({
        transaction: Buffer.from(swapTransactionBuf),
        wallet: privyWallet,
      });

      // Reset and refresh
      setInputAmount('');
      setOutputAmount('');
      setQuote(null);
      fetchBalances();
    } catch (err: any) {
      console.error('Swap error:', err);
      setError(err.message || 'Swap failed');
    } finally {
      setIsSwapping(false);
    }
  };

  // Toggle buy/sell mode
  const toggleMode = () => {
    setIsBuyMode(!isBuyMode);
    setInputAmount('');
    setOutputAmount('');
    setQuote(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* Swap Widget */}
      <div className="bg-gradient-to-br from-white/5 to-white/10 rounded-xl p-4 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">
            {isBuyMode ? `Buy ${tokenSymbol}` : `Sell ${tokenSymbol}`}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchBalances}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
              title="Refresh balances"
            >
              <RefreshCw className="w-4 h-4 text-gray-400" />
            </button>
            <button
              onClick={toggleMode}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                isBuyMode
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              {isBuyMode ? 'Buy' : 'Sell'}
            </button>
          </div>
        </div>

        {!isMainnet && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
            <p className="text-yellow-400 text-sm">Trading is only available on Solana mainnet</p>
          </div>
        )}

        {/* Input */}
        <div className="mb-3">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs text-gray-400">You pay</label>
            <button
              onClick={() => setInputAmount(isBuyMode ? solBalance.toString() : tokenBalance.toString())}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              Balance: {(isBuyMode ? solBalance : tokenBalance).toFixed(4)} {isBuyMode ? 'SOL' : tokenSymbol}
            </button>
          </div>
          <div className="bg-black/30 rounded-lg p-3 border border-white/10">
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                className="flex-1 bg-transparent border-none text-xl text-white font-bold p-0 focus-visible:ring-0"
                placeholder="0.00"
                min="0"
                disabled={!isMainnet}
              />
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10">
                {isBuyMode ? (
                  <img
                    src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                    alt="SOL"
                    className="w-5 h-5 rounded-full"
                  />
                ) : tokenImageUrl ? (
                  <img src={tokenImageUrl} alt={tokenSymbol} className="w-5 h-5 rounded-full" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500" />
                )}
                <span className="text-white font-medium text-sm">{isBuyMode ? 'SOL' : tokenSymbol}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center -my-1.5 relative z-10">
          <button
            onClick={toggleMode}
            className="bg-[#1C1F2E] border-2 border-white/10 rounded-full p-1.5 hover:bg-white/10 transition-colors"
          >
            <ArrowDownUp className="w-4 h-4 text-cyan-400" />
          </button>
        </div>

        {/* Output */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs text-gray-400">You receive</label>
            <span className="text-xs text-gray-500">
              Balance: {(isBuyMode ? tokenBalance : solBalance).toFixed(4)} {isBuyMode ? tokenSymbol : 'SOL'}
            </span>
          </div>
          <div className="bg-black/30 rounded-lg p-3 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex-1 text-xl text-white font-bold">
                {isLoadingQuote ? (
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                ) : (
                  outputAmount || '0.00'
                )}
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10">
                {isBuyMode ? (
                  tokenImageUrl ? (
                    <img src={tokenImageUrl} alt={tokenSymbol} className="w-5 h-5 rounded-full" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500" />
                  )
                ) : (
                  <img
                    src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                    alt="SOL"
                    className="w-5 h-5 rounded-full"
                  />
                )}
                <span className="text-white font-medium text-sm">{isBuyMode ? tokenSymbol : 'SOL'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quote Info */}
        {quote && outputAmount && inputAmount && (
          <div className="bg-black/20 rounded-lg p-2.5 mb-3 text-xs">
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
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 mb-3">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* Swap Button */}
        <Button
          onClick={handleSwap}
          disabled={!isMainnet || !quote || isSwapping || isLoadingQuote || !inputAmount || parseFloat(inputAmount) <= 0 || !primaryWallet}
          className={`w-full font-semibold py-5 text-base disabled:opacity-50 disabled:cursor-not-allowed ${
            isBuyMode
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
              : 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white'
          }`}
        >
          {isSwapping ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Swapping...
            </>
          ) : !primaryWallet ? (
            'Connect Wallet'
          ) : !isMainnet ? (
            'Switch to Mainnet'
          ) : (
            <>
              {isBuyMode ? 'Buy' : 'Sell'} {tokenSymbol}
            </>
          )}
        </Button>

        <p className="text-gray-500 text-xs text-center mt-3">
          Powered by Jupiter Aggregator
        </p>
      </div>

      {/* External Links */}
      <div className="flex flex-wrap gap-2 justify-center">
        <a
          href={`https://birdeye.so/token/${tokenMint}?chain=solana`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 text-xs transition-colors"
        >
          <img src="https://birdeye.so/favicon.ico" alt="Birdeye" className="w-3.5 h-3.5" />
          Birdeye
          <ExternalLink className="w-3 h-3" />
        </a>
        <a
          href={`https://dexscreener.com/solana/${tokenMint}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 text-xs transition-colors"
        >
          <img src="https://dexscreener.com/favicon.ico" alt="DexScreener" className="w-3.5 h-3.5" />
          DexScreener
          <ExternalLink className="w-3 h-3" />
        </a>
        <a
          href={`https://pump.fun/coin/${tokenMint}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-300 text-xs transition-colors"
        >
          <img src="https://pump.fun/favicon.ico" alt="Pump.fun" className="w-3.5 h-3.5" />
          Pump.fun
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
