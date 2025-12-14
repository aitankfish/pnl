'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useNetwork } from '@/lib/hooks/useNetwork';
import { getUsdcMint, TOKEN_DECIMALS } from '@/config/tokens';
import { PublicKey } from '@solana/web3.js';
import { useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import { getSolanaConnection, getSolanaBalance } from '@/lib/solana';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowDownUp, Loader2 } from 'lucide-react';

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

type SwapDirection = 'USDC_TO_SOL' | 'SOL_TO_USDC';

export function JupiterSwap({ isOpen, onClose }: JupiterSwapProps) {
  const { primaryWallet } = useWallet();
  const { network } = useNetwork();
  const { signAndSendTransaction } = useSignAndSendTransaction();

  const [direction, setDirection] = useState<SwapDirection>('USDC_TO_SOL');
  const [inputAmount, setInputAmount] = useState('10');
  const [outputAmount, setOutputAmount] = useState('');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState(0);
  const [usdcBalance, setUsdcBalance] = useState(0);

  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  const usdcMint = getUsdcMint(network);

  // Check if Jupiter supports this network
  const isJupiterSupported = network === 'mainnet-beta';

  // Fetch user balances when modal opens
  useEffect(() => {
    if (isOpen && primaryWallet) {
      fetchBalances();
    }
  }, [isOpen, primaryWallet]);

  // Set initial direction based on which token user has more of
  useEffect(() => {
    if (solBalance > 0 || usdcBalance > 0) {
      // Default to showing the token they have more of (in USD value, assuming 1 USDC = $1)
      // We'll estimate SOL price as ~$100 for comparison
      const solValueUsd = solBalance * 100;
      const usdcValueUsd = usdcBalance;

      if (solValueUsd > usdcValueUsd) {
        setDirection('SOL_TO_USDC');
        setInputAmount('0.1'); // Start with 0.1 SOL
      } else {
        setDirection('USDC_TO_SOL');
        setInputAmount('10'); // Start with 10 USDC
      }
    }
  }, [solBalance, usdcBalance]);

  const fetchBalances = async () => {
    if (!primaryWallet) return;

    try {
      const walletPubkey = new PublicKey(primaryWallet.address);

      // Get SOL balance using the helper function
      const solBalanceLamports = await getSolanaBalance(walletPubkey);
      const solBal = solBalanceLamports / Math.pow(10, TOKEN_DECIMALS.SOL);
      setSolBalance(solBal);

      // Get USDC balance - need to await the connection
      const connection = await getSolanaConnection(network);
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPubkey, {
        mint: usdcMint,
      });

      if (tokenAccounts.value.length > 0) {
        const usdcBal = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
        setUsdcBalance(usdcBal || 0);
      } else {
        setUsdcBalance(0);
      }
    } catch (err) {
      console.error('Error fetching balances:', err);
    }
  };

  // Reverse swap direction
  const handleReverseDirection = () => {
    setDirection(prev => prev === 'USDC_TO_SOL' ? 'SOL_TO_USDC' : 'USDC_TO_SOL');
    // Swap the amounts
    setInputAmount(outputAmount || '');
    setOutputAmount(inputAmount);
    setQuote(null);
  };

  // Get quote from Jupiter API
  const getQuote = async (amount: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      setOutputAmount('');
      setQuote(null);
      return;
    }

    try {
      setIsLoadingQuote(true);
      setError(null);

      // Determine input/output mints based on direction
      const isUsdcToSol = direction === 'USDC_TO_SOL';
      const inputMint = isUsdcToSol ? usdcMint.toBase58() : SOL_MINT;
      const outputMint = isUsdcToSol ? SOL_MINT : usdcMint.toBase58();
      const inputDecimals = isUsdcToSol ? TOKEN_DECIMALS.USDC : TOKEN_DECIMALS.SOL;
      const outputDecimals = isUsdcToSol ? TOKEN_DECIMALS.SOL : TOKEN_DECIMALS.USDC;

      // Convert amount to smallest unit
      const amountInSmallestUnit = Math.floor(parseFloat(amount) * Math.pow(10, inputDecimals));

      console.log('Getting quote:', {
        direction,
        amount,
        inputMint,
        outputMint,
        amountInSmallestUnit
      });

      // Call Jupiter Quote API (using public API endpoint)
      // Note: quote-api.jup.ag was deprecated, now using public.jupiterapi.com
      const quoteResponse = await fetch(
        `https://public.jupiterapi.com/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountInSmallestUnit}&slippageBps=50`,
        {
          headers: {
            'Accept': 'application/json',
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

      // Convert output amount to readable format
      const output = parseInt(quoteData.outAmount) / Math.pow(10, outputDecimals);
      setOutputAmount(output.toFixed(outputDecimals === TOKEN_DECIMALS.SOL ? 6 : 2));

      console.log('Quote received:', quoteData);
    } catch (err: any) {
      console.error('Error getting quote:', err);

      // Provide helpful error messages
      let errorMessage = 'Failed to fetch quote';

      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        errorMessage = 'Network error: Unable to connect to Jupiter API. Please check your internet connection.';
      } else if (err.message.includes('404') || err.message.includes('400')) {
        errorMessage = 'Jupiter does not support trading this token pair on this network.';
      } else {
        errorMessage = err.message || errorMessage;
      }

      setError(errorMessage);
    } finally {
      setIsLoadingQuote(false);
    }
  };

  // Debounce quote fetching
  useEffect(() => {
    // Only fetch quotes on supported networks
    if (!isJupiterSupported) {
      setError('Jupiter swap is only available on Solana mainnet. Please switch networks to use this feature.');
      return;
    }

    const timer = setTimeout(() => {
      if (isOpen && inputAmount) {
        getQuote(inputAmount);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [inputAmount, direction, isOpen, isJupiterSupported]);

  // Execute swap
  const handleSwap = async () => {
    if (!quote || !primaryWallet) return;

    try {
      setIsSwapping(true);
      setError(null);

      console.log('Getting swap transaction from Jupiter...');

      // Get swap transaction from Jupiter (using public API endpoint)
      const swapResponse = await fetch('https://public.jupiterapi.com/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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

      // Convert transaction to buffer for Privy
      const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');

      // Get the Privy wallet for signing
      const privyWallet = (primaryWallet as any)._privyWallet;

      // Sign and send using Privy
      const result = await signAndSendTransaction({
        transaction: Buffer.from(swapTransactionBuf),
        wallet: privyWallet,
      });

      console.log('Swap successful!', result);

      // Show success message
      const fromToken = direction === 'USDC_TO_SOL' ? 'USDC' : 'SOL';
      const toToken = direction === 'USDC_TO_SOL' ? 'SOL' : 'USDC';
      alert(`Swap successful! ${inputAmount} ${fromToken} → ${outputAmount} ${toToken}`);

      // Refresh balances
      fetchBalances();

      onClose();
    } catch (err: any) {
      console.error('Swap error:', err);
      setError(err.message || 'Swap failed');
    } finally {
      setIsSwapping(false);
    }
  };

  if (!isOpen) return null;

  // Determine which token is input and which is output
  const isUsdcToSol = direction === 'USDC_TO_SOL';
  const inputToken = isUsdcToSol ? 'USDC' : 'SOL';
  const outputToken = isUsdcToSol ? 'SOL' : 'USDC';
  const inputBalance = isUsdcToSol ? usdcBalance : solBalance;
  const outputBalance = isUsdcToSol ? solBalance : usdcBalance;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors text-sm font-medium"
        >
          Close ✕
        </button>

        {/* Swap UI */}
        <div className="bg-[#1C1F2E] rounded-xl p-6 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6">Swap Tokens</h2>

          {/* Network Warning */}
          {!isJupiterSupported && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
              <p className="text-yellow-400 text-sm font-medium mb-2">⚠️ Mainnet Only</p>
              <p className="text-yellow-300/80 text-xs">
                Jupiter swap is only available on Solana mainnet. The current network ({network}) is not supported.
              </p>
            </div>
          )}

          {/* From Token */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-gray-400">You pay</label>
              <span className="text-xs text-gray-500">
                Balance: {inputBalance.toFixed(inputToken === 'SOL' ? 4 : 2)} {inputToken}
              </span>
            </div>
            <div className="bg-[#0F1419] rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <Input
                  type="number"
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  className="bg-transparent border-none text-2xl text-white font-bold p-0 focus-visible:ring-0"
                  placeholder="0.00"
                  min="0"
                  step={inputToken === 'SOL' ? '0.01' : '1'}
                />
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  inputToken === 'USDC' ? 'bg-cyan-500/10' : 'bg-purple-500/10'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                    inputToken === 'USDC' ? 'bg-cyan-500' : 'bg-gradient-to-r from-purple-500 to-cyan-500'
                  }`}>
                    {inputToken === 'USDC' ? '$' : 'S'}
                  </div>
                  <span className="text-white font-semibold">{inputToken}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Swap Icon - Now Clickable */}
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
              <span className="text-xs text-gray-500">
                Balance: {outputBalance.toFixed(outputToken === 'SOL' ? 4 : 2)} {outputToken}
              </span>
            </div>
            <div className="bg-[#0F1419] rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-2xl text-white font-bold">
                  {isLoadingQuote ? (
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                  ) : (
                    outputAmount || '0.00'
                  )}
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  outputToken === 'USDC' ? 'bg-cyan-500/10' : 'bg-purple-500/10'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                    outputToken === 'USDC' ? 'bg-cyan-500' : 'bg-gradient-to-r from-purple-500 to-cyan-500'
                  }`}>
                    {outputToken === 'USDC' ? '$' : 'S'}
                  </div>
                  <span className="text-white font-semibold">{outputToken}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quote Info */}
          {quote && outputAmount && inputAmount && (
            <div className="bg-[#0F1419] rounded-lg p-3 mb-4 text-sm">
              <div className="flex justify-between text-gray-400 mb-1">
                <span>Rate</span>
                <span className="text-white">
                  1 {inputToken} = {(parseFloat(outputAmount) / parseFloat(inputAmount)).toFixed(6)} {outputToken}
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Price Impact</span>
                <span className={parseFloat(quote.priceImpactPct) > 1 ? 'text-red-400' : 'text-green-400'}>
                  {parseFloat(quote.priceImpactPct).toFixed(2)}%
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
            disabled={!isJupiterSupported || !quote || isSwapping || isLoadingQuote || !inputAmount || parseFloat(inputAmount) <= 0}
            className="w-full bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-semibold py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSwapping ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Swapping...
              </>
            ) : !isJupiterSupported ? (
              'Switch to Mainnet'
            ) : (
              'Swap'
            )}
          </Button>

          <p className="text-gray-500 text-xs text-center mt-4">
            Powered by Jupiter • Network: {network} • 0.2% fee
          </p>
        </div>
      </div>
    </div>
  );
}
