'use client';

import React, { useState, useEffect } from 'react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { useWallet } from '@/hooks/useWallet';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { useFundWallet, useSignAndSendTransaction, useWallets, useStandardWallets, useExportWallet } from '@privy-io/react-auth/solana';
import { useSolPrice } from '@/hooks/useSolPrice';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import bs58 from 'bs58';
import {
  Wallet,
  Settings,
  Send,
  Download,
  Copy,
  Check,
  X,
  Camera,
  RefreshCw,
  User,
  Eye,
  EyeOff,
  Shield,
  ShoppingCart,
  Heart,
  Rocket,
  TrendingUp,
  Trophy,
  XCircle,
  ArrowLeftRight,
  ExternalLink,
  History,
  Sparkles,
  CreditCard,
  ArrowRight,
  Gift,
  Coins,
  Loader2
} from 'lucide-react';
import { Connection, PublicKey, LAMPORTS_PER_SOL, SystemProgram, VersionedTransaction, TransactionMessage } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, createTransferInstruction, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { RPC_ENDPOINT, SOLANA_NETWORK } from '@/config/solana';
import { getSolanaConnection } from '@/lib/solana';
import type { TokenBalance } from '@/lib/hooks/useAllTokenBalances';
import { ipfsUtils } from '@/lib/ipfs';
import useSWR from 'swr';
import { useUserSocket, useMarketSocket } from '@/lib/hooks/useSocket';
import { useTokenBalance } from '@/lib/hooks/useTokenBalance';
import { getUsdcMint, TOKEN_DECIMALS } from '@/config/tokens';
import { useNetwork } from '@/lib/hooks/useNetwork';
import { JupiterSwap } from '@/components/JupiterSwap';
import { useAllTokenBalances } from '@/lib/hooks/useAllTokenBalances';
import { useCreatorFees } from '@/lib/hooks/useCreatorFees';
import { SeedIcon, TreeIcon, BloomIcon, LeafIcon, BasketIcon } from '@/components/PlantIcons';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Enhanced component to display a favorite market with better UI.
// Accepts prefetched batch data to avoid N+1 individual /api/markets/{id} fetches.
// Socket updates still flow in via useMarketSocket for realtime state.
function FavoriteMarketCard({
  marketId,
  prefetchedMarket,
}: {
  marketId: string;
  prefetchedMarket?: any;
}) {
  // If no prefetched data was provided, fall back to individual SWR (backward compat)
  const { data: marketData } = useSWR(
    prefetchedMarket ? null : `/api/markets/${marketId}`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const baseMarket = prefetchedMarket || marketData?.data;
  const marketAddress = baseMarket?.marketAddress;
  const { marketData: realtimeData } = useMarketSocket(marketAddress || null);

  // Merge realtime updates on top of prefetched/static data
  const market = realtimeData ? { ...baseMarket, ...realtimeData } : baseMarket;

  if (!market) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-white/10 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-white/10 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Status badge styling
  const getStatusBadge = () => {
    switch (market.resolution) {
      case 'YesWins':
        return 'mono text-[0.56rem] uppercase tracking-[0.24em] text-[#3f7a42] border border-[#3f7a42]/40 bg-[#3f7a42]/10';
      case 'NoWins':
        return 'mono text-[0.56rem] uppercase tracking-[0.24em] text-[#d67347] border border-[#d67347]/40 bg-[#d67347]/10';
      case 'Refund':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-400/30';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-400/30';
    }
  };

  const getStatusText = () => {
    if (market.resolution === 'YesWins') return 'Launched';
    if (market.resolution === 'NoWins' || market.resolution === 'Refund') return 'Not Launched';
    return 'Active';
  };

  return (
    <Card className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm border-[#e89660]/20 hover:border-[#e89660]/40 transition-all hover:scale-[1.02] group overflow-hidden">
      <CardContent className="p-4">
        <a href={`/market/${marketId}`} className="block">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {market.image ? (
                <div className="flex-shrink-0 relative">
                  <div className="absolute inset-0 bg-[#e89660]/30 rounded-lg blur-md opacity-50 animate-pulse"></div>
                  <img
                    src={market.image}
                    alt={market.name}
                    className="relative w-12 h-12 rounded-lg object-cover ring-2 ring-[#e89660]/50 group-hover:ring-[#e89660] transition-all transform group-hover:scale-110"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-[#d67347]/15 border border-[#d67347]/40 flex items-center justify-center ring-2 ring-[#d67347]/50 group-hover:ring-[#d67347] transition-all transform group-hover:scale-110 flex-shrink-0">
                  <span className="text-xl font-bold text-white/90">{market.name.charAt(0)}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-semibold group-hover:text-[#e89660] transition-colors truncate">
                  {market.name}
                </h4>
                <p className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">{market.tokenSymbol}</p>
              </div>
            </div>
            <span className={`px-2 py-1 rounded text-xs border ${getStatusBadge()} whitespace-nowrap flex-shrink-0`}>
              {getStatusText()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-lg p-2.5 border border-white/20 group-hover:border-[#e89660]/35 transition-all">
              <div className="text-gray-400 text-xs mb-1">Pool Progress</div>
              <div className="font-bold text-white text-base">
                {(market.poolProgressPercentage || 0).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {((market.poolBalance || 0) / 1e9).toFixed(2)} / {((market.targetPool || 0) / 1e9).toFixed(0)} SOL
              </div>
            </div>
            <div className="bg-[#3f7a42]/10 p-2.5 border border-[#3f7a42]/25 group-hover:border-[#3f7a42]/50 transition-all">
              <div className="text-gray-400 text-xs mb-1">YES Rate</div>
              <div className="font-bold text-[#3f7a42] text-base">
                {(market.sharesYesPercentage || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {(market.yesVoteCount || 0) + (market.noVoteCount || 0)} votes
              </div>
            </div>
          </div>
        </a>
      </CardContent>
    </Card>
  );
}

// WatchlistGrid — batch-fetches ALL favorited markets in ONE /api/markets/batch call
// and passes prefetched data to each FavoriteMarketCard. Kills the N+1 pattern where
// each card used to fire its own /api/markets/{id} request.
function WatchlistGrid({
  favoriteMarkets,
  showAll,
}: {
  favoriteMarkets: string[];
  showAll: boolean;
}) {
  const visibleIds = showAll ? favoriteMarkets : favoriteMarkets.slice(0, 3);

  // One SWR fetch for the whole set — keyed by the comma-joined ids
  const batchKey = visibleIds.length > 0 ? `/api/markets/batch?ids=${visibleIds.join(',')}` : null;
  const { data: batch } = useSWR(batchKey, fetcher, { revalidateOnFocus: false });
  const marketsMap: Record<string, any> = batch?.data?.markets || {};

  return (
    <div className="space-y-3">
      {visibleIds.map((marketId: string) => (
        <FavoriteMarketCard
          key={marketId}
          marketId={marketId}
          prefetchedMarket={marketsMap[marketId]}
        />
      ))}
    </div>
  );
}

// Component to display vote history for a market
function VoteHistory({ marketId, walletAddress }: { marketId: string; walletAddress: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: voteHistory } = useSWR(
    isOpen ? `/api/markets/${marketId}/vote-history?wallet=${walletAddress}` : null,
    fetcher
  );

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 rounded-lg bg-white/5 hover:bg-[#e89660]/15 border border-white/10 hover:border-[#e89660]/35 transition-all group"
        title="View vote history"
      >
        <History className="w-4 h-4 text-gray-400 group-hover:text-[#e89660] transition-colors" />
      </button>

      {/* Vote History Modal/Dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-gradient-to-br from-gray-900 to-gray-800 border border-[#e89660]/30 rounded-lg max-w-lg w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#e89660]" />
                <h3 className="text-lg font-semibold text-white">Vote History</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              {voteHistory?.success ? (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#3f7a42]/10 border border-[#3f7a42]/30 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">YES Votes</div>
                      <div className="font-bold text-[#3f7a42] text-lg">
                        {voteHistory.data.summary.yesTradeCount}
                      </div>
                      <div className="text-xs text-gray-300">
                        {(Number(voteHistory.data.summary.totalYesAmount) || 0).toFixed(2)} SOL
                      </div>
                    </div>
                    <div className="bg-[#d67347]/10 border border-[#d67347]/30 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">NO Votes</div>
                      <div className="font-bold text-[#d67347] text-lg">
                        {voteHistory.data.summary.noTradeCount}
                      </div>
                      <div className="text-xs text-gray-300">
                        {(Number(voteHistory.data.summary.totalNoAmount) || 0).toFixed(2)} SOL
                      </div>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <div className="text-sm text-gray-400">Total Invested</div>
                    <div className="font-bold text-white text-xl">
                      {(Number(voteHistory.data.summary.totalInvested) || 0).toFixed(2)} SOL
                    </div>
                    <div className="text-xs text-gray-400">
                      {voteHistory.data.summary.totalTrades} {voteHistory.data.summary.totalTrades === 1 ? 'trade' : 'trades'}
                    </div>
                  </div>

                  {/* Individual trades */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Transaction History</h4>
                    <div className="space-y-2">
                      {voteHistory.data.trades.map((trade: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between text-sm bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors border border-white/10"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <span className={`px-2 py-1 rounded font-medium text-xs ${
                              trade.voteType === 'yes'
                                ? 'mono text-[0.56rem] uppercase tracking-[0.24em] text-[#3f7a42] border border-[#3f7a42]/40 bg-[#3f7a42]/10'
                                : 'mono text-[0.56rem] uppercase tracking-[0.24em] text-[#d67347] border border-[#d67347]/40 bg-[#d67347]/10'
                            }`}>
                              {trade.voteType.toUpperCase()}
                            </span>
                            <div className="flex-1">
                              <div className="text-white font-medium">{(Number(trade.amount) || 0).toFixed(3)} SOL</div>
                              <div className="text-xs text-gray-500">
                                {new Date(trade.timestamp).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          </div>
                          <a
                            href={`https://orb.helius.dev/tx/${trade.signature}${SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : ''}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#e89660] hover:text-[#ecb48a] p-2 hover:bg-[#e89660]/10 rounded transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  <p>Loading vote history...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Component to display a project created by the user
function MyProjectCard({ project }: { project: any }) {
  // Determine status badge color
  const getStatusBadge = () => {
    switch (project.status) {
      case 'Launched':
        return 'mono text-[0.56rem] uppercase tracking-[0.24em] text-[#3f7a42] border border-[#3f7a42]/40 bg-[#3f7a42]/10';
      case 'Not Launched':
        return 'mono text-[0.56rem] uppercase tracking-[0.24em] text-[#d67347] border border-[#d67347]/40 bg-[#d67347]/10';
      case 'Pending Resolution':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-400/30';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-400/30';
    }
  };

  return (
    <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
      <CardContent className="p-4">
        <a href={`/market/${project.id}`} className="block group">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {project.projectImageUrl ? (
                <img
                  src={project.projectImageUrl}
                  alt={project.name}
                  className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-10 h-10 bg-[#e89660]/15 border border-[#e89660]/40 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Rocket className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-semibold group-hover:text-[#e89660] transition-colors truncate">
                  {project.name}
                </h4>
                <p className="text-xs text-gray-400">{project.tokenSymbol}</p>
              </div>
            </div>
            <span className={`px-2 py-1 rounded text-xs border ${getStatusBadge()} whitespace-nowrap`}>
              {project.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white/5 rounded p-2 border border-white/10">
              <div className="text-gray-400 text-xs">Pool Progress</div>
              <div className="font-semibold text-white">
                {(project.poolProgressPercentage || 0).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500">
                {(project.poolBalance || 0).toFixed(2)} / {(project.targetPool || 0).toFixed(0)} SOL
              </div>
            </div>
            <div className="bg-white/5 rounded p-2 border border-white/10">
              <div className="text-gray-400 text-xs">YES Rate</div>
              <div className="font-semibold text-[#3f7a42]">
                {(project.sharesYesPercentage || 0).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">
                {(project.yesVoteCount || 0) + (project.noVoteCount || 0)} votes
              </div>
            </div>
          </div>

          {project.status === 'Active' && !project.isExpired && (
            <div className="mt-3 text-xs text-gray-400">
              <span className="text-white font-medium">{project.timeLeft}</span> remaining
            </div>
          )}
        </a>
      </CardContent>
    </Card>
  );
}

// Token option for sending (includes SOL as native)
interface SendableToken {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  logoURI?: string;
  programId?: string;
  isNative?: boolean;
}

interface SendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (recipientAddress: string, amount: number, token: SendableToken) => Promise<void>;
  solBalance: number;
  tokens: TokenBalance[];
}

function SendModal({ isOpen, onClose, onSend, solBalance, tokens }: SendModalProps) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [tokenSearch, setTokenSearch] = useState('');

  // Build sendable tokens list with SOL as first option
  const sendableTokens: SendableToken[] = React.useMemo(() => {
    const solToken: SendableToken = {
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
      balance: solBalance,
      logoURI: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
      isNative: true,
    };

    const splTokens: SendableToken[] = tokens.map((t) => ({
      mint: t.mint,
      symbol: t.symbol || t.mint.slice(0, 4) + '...',
      name: t.name || 'Unknown Token',
      decimals: t.decimals,
      balance: t.uiAmount,
      logoURI: t.logoURI,
      programId: t.programId,
      isNative: false,
    }));

    return [solToken, ...splTokens];
  }, [solBalance, tokens]);

  const [selectedToken, setSelectedToken] = useState<SendableToken>(sendableTokens[0]);

  // Update selected token when sendableTokens changes
  React.useEffect(() => {
    if (sendableTokens.length > 0) {
      // Try to keep the same token selected if it still exists
      const currentToken = sendableTokens.find((t) => t.mint === selectedToken.mint);
      if (currentToken) {
        setSelectedToken(currentToken);
      } else {
        setSelectedToken(sendableTokens[0]);
      }
    }
  }, [sendableTokens]);

  // Filter tokens by search
  const filteredTokens = sendableTokens.filter((token) =>
    token.symbol.toLowerCase().includes(tokenSearch.toLowerCase()) ||
    token.name.toLowerCase().includes(tokenSearch.toLowerCase()) ||
    token.mint.toLowerCase().includes(tokenSearch.toLowerCase())
  );

  const handleSendClick = async () => {
    setError('');

    if (!recipient || !amount) {
      setError('Please fill in all fields');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Invalid amount');
      return;
    }

    if (amountNum > selectedToken.balance) {
      setError(`Insufficient ${selectedToken.symbol} balance`);
      return;
    }

    // Validate recipient address
    try {
      new PublicKey(recipient);
    } catch {
      setError('Invalid Solana address');
      return;
    }

    try {
      setIsSending(true);
      await onSend(recipient, amountNum, selectedToken);
      setRecipient('');
      setAmount('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to send transaction');
    } finally {
      setIsSending(false);
    }
  };

  const handleMaxClick = () => {
    if (selectedToken.isNative) {
      // Reserve some SOL for transaction fees
      setAmount(Math.max(0, selectedToken.balance - 0.01).toString());
    } else {
      setAmount(selectedToken.balance.toString());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-gray-900 border-white/20 text-white">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Send Tokens</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Token Selector */}
          <div className="space-y-2">
            <Label className="text-white">Select Token</Label>
            <button
              onClick={() => setShowTokenSelector(!showTokenSelector)}
              className="w-full flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                {selectedToken.logoURI ? (
                  <img
                    src={selectedToken.logoURI}
                    alt={selectedToken.symbol}
                    className="w-8 h-8 rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png';
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#e89660]/15 border border-[#e89660]/40 flex items-center justify-center text-xs font-bold">
                    {selectedToken.symbol.slice(0, 2)}
                  </div>
                )}
                <div className="text-left">
                  <p className="font-medium">{selectedToken.symbol}</p>
                  <p className="text-xs text-gray-400">{selectedToken.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Balance</p>
                <p className="font-medium">{selectedToken.balance.toFixed(4)}</p>
              </div>
            </button>

            {/* Token Selector Dropdown */}
            {showTokenSelector && (
              <div className="absolute z-10 mt-1 w-[calc(100%-3rem)] bg-gray-800 border border-white/10 rounded-lg shadow-xl max-h-64 overflow-hidden">
                <div className="p-2 border-b border-white/10">
                  <Input
                    placeholder="Search tokens..."
                    value={tokenSearch}
                    onChange={(e) => setTokenSearch(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredTokens.length === 0 ? (
                    <div className="p-4 text-center text-gray-400">No tokens found</div>
                  ) : (
                    filteredTokens.map((token) => (
                      <button
                        key={token.mint}
                        onClick={() => {
                          setSelectedToken(token);
                          setShowTokenSelector(false);
                          setTokenSearch('');
                          setAmount(''); // Reset amount when token changes
                        }}
                        className={`w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors ${
                          token.mint === selectedToken.mint ? 'bg-white/10' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {token.logoURI ? (
                            <img
                              src={token.logoURI}
                              alt={token.symbol}
                              className="w-6 h-6 rounded-full"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-[#e89660]/15 border border-[#e89660]/40 flex items-center justify-center text-[10px] font-bold">
                              {token.symbol.slice(0, 2)}
                            </div>
                          )}
                          <div className="text-left">
                            <p className="font-medium text-sm">{token.symbol}</p>
                            <p className="text-xs text-gray-400 truncate max-w-[120px]">{token.name}</p>
                          </div>
                        </div>
                        <p className="text-sm">{token.balance.toFixed(4)}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient" className="text-white">Recipient Address</Label>
            <Input
              id="recipient"
              placeholder="Enter Solana address"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount" className="text-white">Amount ({selectedToken.symbol})</Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                step="any"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
              />
              <button
                onClick={handleMaxClick}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#e89660] hover:text-[#ecb48a]"
              >
                MAX
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Available: {selectedToken.balance.toFixed(4)} {selectedToken.symbol}
            </p>
          </div>

          {error && (
            <div className="p-3 bg-[#d67347]/10 border border-[#d67347]/30 rounded-lg text-[#d67347] text-sm">
              {error}
            </div>
          )}

          <div className="flex space-x-3 pt-2">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-white/10 text-white hover:bg-white/5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSendClick}
              disabled={isSending}
              className="flex-1 bg-[#e89660] hover:bg-[#ecb48a] text-[#0a0814]"
            >
              {isSending ? 'Sending...' : `Send ${selectedToken.symbol}`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DepositModal({ isOpen, onClose, address }: { isOpen: boolean; onClose: () => void; address: string }) {
  const [copied, setCopied] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-gray-900 border-white/20 text-white">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Deposit SOL / USDC</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-white p-4 rounded-lg">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${address}`}
              alt="Wallet QR Code"
              className="w-full h-auto"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-white">Your Wallet Address</Label>
            <div className="flex items-center space-x-2">
              <Input
                readOnly
                value={address}
                className="bg-white/5 border-white/10 text-white font-mono text-sm"
              />
              <Button
                onClick={copyAddress}
                size="sm"
                variant="outline"
                className="border-white/10 hover:bg-white/5"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="p-3 bg-[#e89660]/10 border border-[#e89660]/25 rounded-lg text-[#e89660] text-sm">
            <p className="font-semibold mb-1 flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Supported Tokens:
            </p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Send SOL to this address</li>
              <li>Send USDC on Solana to this same address</li>
              <li>Both tokens use the same Solana address</li>
            </ul>
          </div>

          <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400 text-sm">
            <p className="font-semibold mb-1">Network:</p>
            <p className="text-xs">{SOLANA_NETWORK === 'devnet' ? 'Devnet' : 'Mainnet-Beta'}</p>
          </div>

          <Button
            onClick={onClose}
            className="w-full bg-[#3f7a42] hover:bg-[#4a8a4d] text-[#0a0814]"
          >
            Done
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// First-time user banner — a dry seed bed waiting for water (zero-balance onboarding)
function FirstTimeUserBanner({
  onBuySol,
  onDeposit,
}: {
  onBuySol: () => void;
  onDeposit: () => void;
}) {
  return (
    <div className="max-w-4xl mx-auto mb-6">
      <div
        className="relative overflow-hidden"
        style={{
          background: 'rgba(232,150,96,0.05)',
          border: '1px solid rgba(232,150,96,0.2)',
        }}
      >
        {/* Warm radial glow, bottom-left — implies warmth / potential */}
        <div
          aria-hidden
          className="absolute -bottom-16 -left-16 w-64 h-64 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(232,150,96,0.15) 0%, transparent 70%)',
          }}
        />

        <div className="p-5 sm:p-7 relative">
          <div className="flex items-start gap-4">
            {/* Seed glyph instead of sparkle/rocket */}
            <div
              className="w-12 h-12 flex items-center justify-center flex-shrink-0"
              style={{
                background: 'rgba(232,150,96,0.1)',
                border: '1px solid rgba(232,150,96,0.3)',
                color: '#e89660',
              }}
            >
              <SeedIcon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="mono text-[0.58rem] uppercase tracking-[0.3em] mb-2" style={{ color: '#e89660' }}>
                · Welcome, new gardener ·
              </div>
              <h3
                className="serif leading-[1.1] tracking-[-0.015em] mb-2"
                style={{
                  color: '#f4eee4',
                  fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
                  fontWeight: 400,
                  fontVariationSettings: "'SOFT' 50, 'WONK' 0, 'opsz' 48",
                }}
              >
                Your garden is ready.
              </h3>
              <p className="serif text-[0.98rem] leading-[1.6] mb-5"
                style={{ color: '#d8cfc0', fontVariationSettings: "'SOFT' 50, 'opsz' 30" }}>
                It just needs water. Add SOL to start planting ideas and backing the ones you believe in.
              </p>

              {/* Funding options — flat mono tiles, no gradients */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={onBuySol}
                  className="group flex items-center gap-3 p-3.5 transition-colors duration-300 text-left"
                  style={{
                    background: 'rgba(244,238,228,0.02)',
                    border: '1px solid rgba(244,238,228,0.1)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(232,150,96,0.5)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(244,238,228,0.1)')}
                >
                  <div
                    className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                    style={{ background: '#e89660', color: '#0a0814' }}
                  >
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="mono text-[0.66rem] uppercase tracking-[0.24em]" style={{ color: '#f4eee4' }}>
                      Fund with card
                    </p>
                    <p className="mono text-[0.54rem] uppercase tracking-[0.24em] mt-1" style={{ color: '#8a7f72' }}>
                      Instant · credit or debit
                    </p>
                  </div>
                  <span style={{ color: '#8a7f72' }} className="group-hover:text-[#e89660] transition-colors">→</span>
                </button>

                <button
                  onClick={onDeposit}
                  className="group flex items-center gap-3 p-3.5 transition-colors duration-300 text-left"
                  style={{
                    background: 'rgba(244,238,228,0.02)',
                    border: '1px solid rgba(244,238,228,0.1)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(232,150,96,0.5)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(244,238,228,0.1)')}
                >
                  <div
                    className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(232,150,96,0.5)',
                      color: '#e89660',
                    }}
                  >
                    <Download className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="mono text-[0.66rem] uppercase tracking-[0.24em]" style={{ color: '#f4eee4' }}>
                      Deposit SOL
                    </p>
                    <p className="mono text-[0.54rem] uppercase tracking-[0.24em] mt-1" style={{ color: '#8a7f72' }}>
                      From another wallet
                    </p>
                  </div>
                  <span style={{ color: '#8a7f72' }} className="group-hover:text-[#e89660] transition-colors">→</span>
                </button>
              </div>

              <p className="mono text-[0.54rem] uppercase tracking-[0.26em] mt-4" style={{ color: '#6a6058' }}>
                · A sip of SOL covers fees · the rest fuels your ideas
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsModal({ isOpen, onClose, wallet, onLogout, primaryWallet, exportWallet }: any) {
  const [exportWarningShown, setExportWarningShown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string>('');

  // Check if this is a Privy embedded wallet (not external wallet like Phantom)
  const isPrivyWallet = primaryWallet?.isEmbedded === true || wallet?.walletClientType === 'privy';

  const handleExportPrivateKey = async () => {
    if (!isPrivyWallet) {
      setExportError('Private key export is only available for Privy embedded wallets. External wallet credentials should be managed through your wallet provider (Phantom, Solflare, etc.).');
      return;
    }

    if (!primaryWallet || !exportWallet) {
      setExportError('Unable to export wallet. Please try logging out and back in.');
      return;
    }

    try {
      setIsExporting(true);
      setExportError('');

      // Use Privy's Solana-specific export wallet function
      // Must pass the wallet address parameter
      await exportWallet({ address: primaryWallet.address });

      // Note: exportWallet opens a modal for the user to view/copy their private key
      // It doesn't return the key directly for security reasons
      setExportError('');

    } catch (error: any) {
      console.error('Error exporting private key:', error);

      // Handle specific error messages
      if (error.message?.includes('embedded wallet')) {
        setExportError('This feature is only available for Privy embedded wallets. If you\'re using an external wallet (Phantom, Solflare, etc.), please manage your credentials through your wallet provider.');
      } else {
        setExportError(error.message || 'Failed to export private key. Please try again.');
      }
    } finally {
      setIsExporting(false);
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-gray-900 border-white/20 text-white max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Security Settings</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Security Section */}
          <div className="space-y-4">

            {!exportWarningShown ? (
              <div className="space-y-3">
                <div className="p-4 bg-[#d67347]/10 border border-[#d67347]/30 rounded-lg text-[#d67347] text-sm">
                  <p className="font-semibold mb-2 flex items-center space-x-2">
                    <Shield className="w-4 h-4" />
                    <span>Security Warning</span>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Never share your private key or seed phrase with anyone</li>
                    <li>Anyone with access can control your wallet and funds</li>
                    <li>Store backups securely offline</li>
                    <li>Privy wallets use social recovery by default</li>
                  </ul>
                </div>
                <Button
                  onClick={() => setExportWarningShown(true)}
                  variant="outline"
                  className="w-full border-white/10 text-white hover:bg-white/5"
                >
                  I Understand - View Export Options
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                  <Label className="text-white mb-2 block">Wallet Type</Label>
                  <p className="text-sm text-gray-400">
                    {isPrivyWallet ? 'Privy Embedded Wallet' : 'External Wallet (Phantom, Solflare, etc.)'}
                  </p>
                  {!isPrivyWallet && (
                    <p className="text-xs text-gray-500 mt-2">
                      Manage your credentials through your wallet extension
                    </p>
                  )}
                </div>

                {exportError && (
                  <div className="p-3 bg-[#d67347]/10 border border-[#d67347]/30 rounded-lg text-[#d67347] text-sm">
                    {exportError}
                  </div>
                )}

                {/* Private Key Export */}
                {isPrivyWallet ? (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-white">Private Key</Label>
                        <p className="text-xs text-gray-400 mt-1">Export your wallet's private key</p>
                      </div>
                      <Button
                        onClick={handleExportPrivateKey}
                        disabled={isExporting}
                        size="sm"
                        className="bg-[#e89660] hover:bg-[#ecb48a] text-[#0a0814]"
                      >
                        {isExporting ? 'Opening...' : 'Export'}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Clicking Export will open a secure modal where you can view and copy your private key. The key never passes through our servers.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                    <Label className="text-white mb-2 block">Private Key</Label>
                    <p className="text-sm text-gray-400">
                      External wallet - private key managed by your wallet provider
                    </p>
                  </div>
                )}

                {/* Seed Phrase Information */}
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
                  <div className="flex items-start space-x-2">
                    <Shield className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <Label className="text-amber-300 text-sm">Seed Phrase Not Available</Label>
                      <p className="text-xs text-amber-200/70 mt-1">
                        Seed phrase export is not supported for Solana wallets because different wallet clients use different HD derivation paths, making seed phrases incompatible across wallets.
                      </p>
                      <p className="text-xs text-amber-200/70 mt-2">
                        <strong>Use private key export instead</strong> - it works with all Solana wallets (Phantom, Solflare, etc.)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex space-x-3 pt-2">
            <Button
              onClick={onLogout}
              variant="outline"
              className="flex-1 border-[#d67347]/50 text-[#d67347] hover:bg-[#d67347]/10"
            >
              Logout
            </Button>
            <Button
              onClick={onClose}
              className="flex-1 bg-[#e89660]/15 border border-[#e89660]/40 hover:border-[#e89660]/70"
            >
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function WalletPage() {
  const { primaryWallet, logout, user: contextUser, loading, ready, authenticated } = useWallet();
  const { showAuthModal } = useAuthModal();
  const { exportWallet } = useExportWallet(); // Get exportWallet from Solana-specific hook
  const { solPrice, isLoading: isPriceLoading } = useSolPrice();
  const { wallets } = useWallets(); // External wallets
  const { wallets: standardWallets } = useStandardWallets(); // Standard wallet interface (includes embedded)
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { network } = useNetwork();

  // USDC balance
  const usdcMint = getUsdcMint(network);
  const { balance: usdcBalance, formattedBalance: usdcFormatted, isLoading: isUsdcLoading } = useTokenBalance(
    primaryWallet?.address,
    usdcMint,
    TOKEN_DECIMALS.USDC
  );

  // Fetch all token balances (SPL Token + Token2022)
  const { tokens: allTokens, isLoading: isTokensLoading } = useAllTokenBalances(primaryWallet?.address);

  // Creator fees from pump.fun (for launched tokens)
  const {
    totalClaimable: creatorFeesClaimable,
    hasClaimableFees,
    launchedTokenCount,
    launchedTokens,
    claimFees,
    isClaiming: isClaimingFees,
    refresh: refreshCreatorFees,
    isLoading: isCreatorFeesLoading,
  } = useCreatorFees(primaryWallet?.address || null);

  // Privy fiat onramp hook
  const { fundWallet } = useFundWallet({
    onUserExited: ({ balance }) => {
      // Refresh balance after funding
      if (balance) {
        const balanceInSOL = Number(balance) / 1_000_000_000; // Convert lamports to SOL
        setSolBalance(balanceInSOL);
      }
    },
  });

  // State
  const [solBalance, setSolBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);

  // View more states for collapsible sections
  const [showAllPositions, setShowAllPositions] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [showAllWatchlist, setShowAllWatchlist] = useState(false);

  // Token stats (prices, market cap, etc.)
  const [tokenStats, setTokenStats] = useState<Map<string, {
    price: number | null;
    priceChange24h: number | null;
    marketCap: number | null;
  }>>(new Map());
  const [isLoadingTokenStats, setIsLoadingTokenStats] = useState(false);

  // Portfolio section tab state
  const [portfolioTab, setPortfolioTab] = useState<'predictions' | 'projects' | 'watchlist'>('predictions');

  // Fetch user profile
  const { data: profileData, mutate: mutateProfile } = useSWR(
    primaryWallet?.address ? `/api/profile/${primaryWallet.address}` : null,
    fetcher,
    { refreshInterval: 0 }
  );

  // Fetch user positions
  // When the socket is connected we don't need aggressive polling — socket events
  // will push updates. Fall back to polling only when socket is down.
  const { positions: realtimePositions, isConnected: socketConnected } = useUserSocket(
    primaryWallet?.address || null
  );

  const { data: positionsData, isLoading: positionsLoading, mutate: mutatePositions } = useSWR(
    primaryWallet?.address ? `/api/user/${primaryWallet.address}/positions` : null,
    fetcher,
    {
      // Poll every 15s only when socket is disconnected. Otherwise the socket keeps
      // us fresh and we save one DB aggregation per user every 15 seconds.
      refreshInterval: socketConnected ? 0 : 15000,
      revalidateOnFocus: true,
      dedupingInterval: 3000, // protect against back-to-back mutate() calls
    }
  );

  // Fetch user's created projects — same polling strategy
  const { data: projectsData, isLoading: projectsLoading, mutate: mutateProjects } = useSWR(
    primaryWallet?.address ? `/api/user/${primaryWallet.address}/projects` : null,
    fetcher,
    {
      refreshInterval: socketConnected ? 0 : 30000,
      dedupingInterval: 5000,
    }
  );

  // Real-time position updates — revalidate SWR cache when Socket.IO updates arrive.
  // Deduping intervals above prevent rapid-fire mutate() calls from stacking.
  useEffect(() => {
    if (realtimePositions && realtimePositions.size > 0) {
      mutatePositions();
      mutateProjects();
    }
  }, [realtimePositions, mutatePositions, mutateProjects]);

  // Fetch SOL balance
  useEffect(() => {
    if (!primaryWallet?.address || primaryWallet.chainType !== 'solana') {
      setSolBalance(0);
      return;
    }

    const fetchBalance = async () => {
      try {
        setBalanceLoading(true);
        // Hit the Redis-cached backend endpoint instead of Helius directly —
        // shared cache across tabs/sessions at 5s TTL.
        const res = await fetch(`/api/wallet/balance?address=${encodeURIComponent(primaryWallet.address)}`);
        const data = await res.json();
        if (data.success && typeof data.sol === 'number') {
          setSolBalance(data.sol);
        }
      } catch (error) {
        console.error('Failed to fetch SOL balance:', error);
        setSolBalance(0);
      } finally {
        setBalanceLoading(false);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, [primaryWallet?.address, primaryWallet?.chainType]);

  // Load profile data
  useEffect(() => {
    if (profileData?.success && profileData.data) {
      // Handle Privy email format (can be string or object with 'address' field)
      const emailString = typeof contextUser?.email === 'string'
        ? contextUser.email
        : (contextUser?.email as any)?.address;
      setUsername(profileData.data.username || (emailString ? emailString.split('@')[0] : '') || '');
      setBio(profileData.data.bio || '');
      setTwitterHandle(profileData.data.twitter || '');
      setProfilePhotoUrl(profileData.data.profilePhotoUrl || '');
    } else if (contextUser?.email) {
      // Handle Privy email format (can be string or object with 'address' field)
      const emailString = typeof contextUser.email === 'string'
        ? contextUser.email
        : (contextUser.email as any)?.address;
      setUsername(emailString ? emailString.split('@')[0] : '');
    }
  }, [profileData, contextUser]);

  // Fetch token stats (prices) for wallet tokens
  useEffect(() => {
    if (allTokens.length === 0) return;

    const fetchTokenStats = async () => {
      setIsLoadingTokenStats(true);
      try {
        const addresses = allTokens.map((t) => t.mint).filter(Boolean);
        const response = await authFetch('/api/tokens/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addresses }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const statsMap = new Map<string, { price: number | null; priceChange24h: number | null; marketCap: number | null }>();
            data.data.forEach((stat: any) => {
              statsMap.set(stat.address, {
                price: stat.price,
                priceChange24h: stat.priceChange24h,
                marketCap: stat.marketCap,
              });
            });
            setTokenStats(statsMap);
          }
        }
      } catch (error) {
        console.error('Error fetching token stats:', error);
      } finally {
        setIsLoadingTokenStats(false);
      }
    };

    fetchTokenStats();
    // Refresh every 60 seconds
    const interval = setInterval(fetchTokenStats, 60000);
    return () => clearInterval(interval);
  }, [allTokens]);

  const handleUsernameChange = async (newUsername: string) => {
    if (!newUsername.trim() || !primaryWallet) return;

    try {
      const response = await authFetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: primaryWallet.address,
          username: newUsername.trim(),
          email: contextUser?.email,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setUsername(newUsername.trim());
        mutateProfile();
      }
    } catch (error) {
      console.error('Error saving username:', error);
    }
  };

  const handleBioChange = async (newBio: string) => {
    if (!primaryWallet) return;

    try {
      const response = await authFetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: primaryWallet.address,
          bio: newBio.trim(),
          email: contextUser?.email,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setBio(newBio.trim());
        mutateProfile();
      }
    } catch (error) {
      console.error('Error saving bio:', error);
    }
  };

  const handleTwitterChange = async (newTwitter: string) => {
    if (!primaryWallet) return;

    // Remove @ if user includes it
    const cleanHandle = newTwitter.trim().replace(/^@/, '');

    try {
      const response = await authFetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: primaryWallet.address,
          twitter: cleanHandle,
          email: contextUser?.email,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setTwitterHandle(cleanHandle);
        mutateProfile();
      }
    } catch (error) {
      console.error('Error saving Twitter handle:', error);
    }
  };

  const handlePhotoUpload = async () => {
    if (!primaryWallet) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return;

      try {
        setIsUploadingPhoto(true);
        const ipfsUri = await ipfsUtils.uploadImage(file);
        const photoUrl = ipfsUtils.getGatewayUrl(ipfsUri);

        const response = await authFetch('/api/profile/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: primaryWallet.address,
            profilePhotoUrl: photoUrl,
            email: contextUser?.email,
          }),
        });

        const result = await response.json();
        if (result.success) {
          setProfilePhotoUrl(photoUrl);
          mutateProfile();
        }
      } catch (error: any) {
        console.error('Error uploading photo:', error);
      } finally {
        setIsUploadingPhoto(false);
      }
    };

    input.click();
  };

  const handleSend = async (recipientAddress: string, amount: number, token: SendableToken) => {
    if (!primaryWallet) throw new Error('No wallet connected');

    const connection = await getSolanaConnection();
    const fromPubkey = new PublicKey(primaryWallet.address);
    const toPubkey = new PublicKey(recipientAddress);

    const instructions: any[] = [];

    if (token.isNative) {
      // SOL transfer
      instructions.push(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: Math.floor(amount * LAMPORTS_PER_SOL),
        })
      );
    } else {
      // SPL Token transfer
      const mintPubkey = new PublicKey(token.mint);

      // Determine the token program to use
      const tokenProgram = token.programId === TOKEN_2022_PROGRAM_ID.toBase58()
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;

      // Get source and destination associated token accounts
      const sourceAta = getAssociatedTokenAddressSync(
        mintPubkey,
        fromPubkey,
        false,
        tokenProgram
      );

      const destinationAta = getAssociatedTokenAddressSync(
        mintPubkey,
        toPubkey,
        false,
        tokenProgram
      );

      // Check if destination ATA exists, if not create it
      const destinationAtaInfo = await connection.getAccountInfo(destinationAta);
      if (!destinationAtaInfo) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            fromPubkey, // payer
            destinationAta, // ata
            toPubkey, // owner
            mintPubkey, // mint
            tokenProgram
          )
        );
      }

      // Calculate amount in token's smallest unit (based on decimals)
      const tokenAmount = Math.floor(amount * Math.pow(10, token.decimals));

      // Add transfer instruction
      instructions.push(
        createTransferInstruction(
          sourceAta, // source
          destinationAta, // destination
          fromPubkey, // owner
          BigInt(tokenAmount), // amount
          [], // multi-signers (empty for single signer)
          tokenProgram
        )
      );
    }

    // Get latest blockhash
    const { blockhash } = await connection.getLatestBlockhash();

    // Create VersionedTransaction using TransactionMessage
    const messageV0 = new TransactionMessage({
      payerKey: fromPubkey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const transaction = new VersionedTransaction(messageV0);

    // Get Solana wallet - prioritize external wallets, fallback to standard wallets (embedded)
    let solanaWallet;

    if (wallets && wallets.length > 0) {
      solanaWallet = wallets[0];
    } else if (standardWallets && standardWallets.length > 0) {
      const privyWallet = standardWallets.find((w: any) => w.isPrivyWallet || w.name === 'Privy');
      if (!privyWallet) {
        throw new Error('No Privy wallet found');
      }
      solanaWallet = privyWallet;
    } else {
      throw new Error('No Solana wallet found');
    }

    // Serialize transaction to buffer
    const txBuffer = Buffer.from(transaction.serialize());

    // Use signAndSendTransaction - works for both external and embedded wallets
    const result = await signAndSendTransaction({
      transaction: txBuffer,
      wallet: solanaWallet as any,
      chain: SOLANA_NETWORK === 'devnet' ? 'solana:devnet' : 'solana:mainnet',
    });

    // Extract signature from result and convert to base58 (Solana standard format)
    const signature = bs58.encode(result.signature);

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');

    // Update SOL balance
    const balance = await connection.getBalance(fromPubkey);
    setSolBalance(balance / LAMPORTS_PER_SOL);
  };

  const handleRefresh = async () => {
    setBalanceLoading(true);
    try {
      const connection = new Connection(RPC_ENDPOINT, 'confirmed');
      const publicKey = new PublicKey(primaryWallet!.address);
      const balance = await connection.getBalance(publicKey);
      setSolBalance(balance / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error('Failed to refresh balance:', error);
    } finally {
      setBalanceLoading(false);
    }
  };

  const handleBuySol = async () => {
    if (!primaryWallet?.address) return;

    try {
      await fundWallet({
        address: primaryWallet.address,
        chain: {
          type: 'solana',
          id: SOLANA_NETWORK === 'devnet' ? 'solana:devnet' : 'solana:mainnet',
        },
      });
    } catch (error) {
      console.error('Error opening buy SOL modal:', error);
    }
  };

  const copyAddress = () => {
    if (!primaryWallet?.address) return;
    navigator.clipboard.writeText(primaryWallet.address);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 2000);
  };

  // Wait for Privy to be ready before checking wallet state
  if (loading || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-[#e89660] animate-spin" />
          <p className="text-gray-400 text-sm sm:text-base">Loading wallet...</p>
        </div>
      </div>
    );
  }

  // User is authenticated but embedded wallet is still being created (race condition fix)
  if (authenticated && !primaryWallet) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-[#e89660] animate-spin" />
          <p className="text-gray-400 text-sm sm:text-base">Setting up your wallet...</p>
        </div>
      </div>
    );
  }

  if (!primaryWallet) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
        <Card className="bg-white/5 border-white/10 text-white w-full max-w-md">
          <CardContent className="p-6 sm:p-8 text-center space-y-4">
            <Wallet className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-[#e89660]" />
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold mb-2">Sign in to Continue</h2>
              <p className="text-sm sm:text-base text-gray-400 mb-2">
                Create an account or sign in to access your wallet and start trading.
              </p>
            </div>
            <button
              onClick={showAuthModal}
              className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-[#e89660] hover:bg-[#ecb48a] text-[#0a0814] rounded-lg font-semibold transition-all text-sm sm:text-base"
            >
              Sign in
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const usdValue = solPrice ? (solBalance * solPrice).toFixed(2) : '...';
  const totalUsdValue = solPrice
    ? (solBalance * solPrice + usdcBalance).toFixed(2)
    : usdcBalance > 0
      ? usdcBalance.toFixed(2)
      : '...';

  return (
    <div className="min-h-screen pt-3 sm:pt-4 px-4 sm:px-6 pb-4 sm:pb-6 animate-fade-in">
      {/* ─── Garden page title ─── */}
      <div className="max-w-5xl mx-auto mb-6 sm:mb-8 text-center">
        <h1
          className="serif leading-[0.98] tracking-[-0.02em] mb-2"
          style={{
            fontSize: 'clamp(1.8rem, 3.5vw, 2.75rem)',
            fontWeight: 400,
            fontVariationSettings: "'SOFT' 50, 'WONK' 0, 'opsz' 72",
            color: '#f4eee4',
          }}
        >
          Your{' '}
          <em
            style={{
              fontVariationSettings: "'SOFT' 100, 'WONK' 0, 'opsz' 72",
              color: 'transparent',
              backgroundImage: 'linear-gradient(178deg, #fff2d8 0%, #ecb48a 35%, #d99875 70%, #d67347 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
            }}
          >
            garden.
          </em>
        </h1>
        <p className="mono text-[0.56rem] uppercase tracking-[0.3em]" style={{ color: '#8a7f72' }}>
          What you&rsquo;ve planted · what&rsquo;s growing · what has bloomed
        </p>
      </div>

      {/* ─── Dashboard Hero — cosmic editorial styling matching the landing ─── */}
      <div className="max-w-5xl mx-auto mb-8 sm:mb-12">
        {/* Top label */}
        <div className="mono text-[0.62rem] uppercase tracking-[0.3em] mb-5 flex items-center justify-center gap-3"
          style={{ color: '#e89660' }}>
          <span className="inline-block w-8 h-px" style={{ background: '#e89660' }} />
          <span>Water reserves</span>
          <span className="inline-block w-8 h-px" style={{ background: '#e89660' }} />
        </div>

        {/* Balance display — big serif, warm gradient */}
        <div className="text-center mb-6 px-4">
          <h2
            className="serif leading-[0.98] tracking-[-0.02em] mb-3"
            style={{
              fontSize: 'clamp(2.5rem, 6vw, 5rem)',
              fontWeight: 400,
              fontVariationSettings: "'SOFT' 50, 'WONK' 0, 'opsz' 144",
              color: 'transparent',
              backgroundImage: 'linear-gradient(178deg, #fff2d8 0%, #ecb48a 35%, #d99875 70%, #d67347 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
            }}
          >
            ${isPriceLoading ? '…' : totalUsdValue}
          </h2>
          <div className="flex items-center justify-center gap-4 flex-wrap mb-3">
            <span className="mono text-[0.72rem] uppercase tracking-[0.24em]" style={{ color: '#f4eee4' }}>
              ◎{balanceLoading ? '…' : solBalance.toFixed(4)} SOL
              {solPrice && !isPriceLoading && (
                <span className="ml-2" style={{ color: '#8a7f72' }}>@ ${solPrice.toFixed(2)}</span>
              )}
            </span>
            <span style={{ color: '#6a6058' }}>·</span>
            <span className="mono text-[0.72rem] uppercase tracking-[0.24em]" style={{ color: '#f4eee4' }}>
              {isUsdcLoading ? '…' : usdcFormatted} USDC
            </span>
          </div>

          {/* Address + live indicator */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={copyAddress}
              className="mono text-[0.6rem] uppercase tracking-[0.24em] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              style={{ color: '#8a7f72' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#e89660')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#8a7f72')}
            >
              <span>{primaryWallet.address.slice(0, 6)}…{primaryWallet.address.slice(-4)}</span>
              {addressCopied ? (
                <Check className="w-3 h-3" style={{ color: '#3f7a42' }} />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
            <span style={{ color: '#6a6058' }}>·</span>
            <span className="inline-flex items-center gap-1.5 mono text-[0.56rem] uppercase tracking-[0.26em]"
              style={{ color: socketConnected ? '#3f7a42' : '#8a7f72' }}>
              <span
                className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'animate-pulse' : ''}`}
                style={{ background: socketConnected ? '#3f7a42' : '#8a7f72' }}
              />
              {socketConnected ? 'Live' : 'Polling'}
            </span>
          </div>
        </div>

        {/* Profile row */}
        <div className="flex flex-col items-center gap-4 max-w-2xl mx-auto w-full px-4 mt-8">
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div
                className="w-14 h-14 flex items-center justify-center overflow-hidden"
                style={{
                  background: 'rgba(244,238,228,0.04)',
                  border: '1px solid rgba(232,150,96,0.35)',
                }}
              >
                {isUploadingPhoto ? (
                  <div className="animate-spin rounded-full h-5 w-5" style={{ border: '1.5px solid rgba(232,150,96,0.25)', borderTopColor: '#e89660' }} />
                ) : profilePhotoUrl ? (
                  <img src={profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6" style={{ color: '#e89660' }} />
                )}
              </div>
              <button
                onClick={handlePhotoUpload}
                disabled={isUploadingPhoto}
                className="absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center transition-colors disabled:opacity-50"
                style={{ background: '#e89660', color: '#0a0814' }}
                title="Upload new photo"
              >
                <Camera className="w-3 h-3" />
              </button>
            </div>

            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => handleUsernameChange(username)}
              className="mono text-[0.75rem] w-32 sm:w-44 h-10 rounded-none border"
              style={{
                background: 'rgba(244,238,228,0.04)',
                borderColor: 'rgba(244,238,228,0.12)',
                color: '#f4eee4',
                letterSpacing: '0.05em',
              }}
              placeholder="username"
            />
          </div>

          {/* Bio */}
          <div className="w-full max-w-md">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              onBlur={() => handleBioChange(bio)}
              className="serif w-full text-[0.95rem] leading-[1.55] p-3 min-h-[64px] max-h-[100px] resize-none focus:outline-none"
              style={{
                background: 'rgba(244,238,228,0.04)',
                border: '1px solid rgba(244,238,228,0.1)',
                color: '#f4eee4',
                fontStyle: 'italic',
                fontVariationSettings: "'SOFT' 100, 'opsz' 30",
              }}
              placeholder="Write a short bio…"
              maxLength={150}
            />
            <p className="mono text-[0.54rem] uppercase tracking-[0.26em] mt-1 text-right" style={{ color: '#6a6058' }}>
              {bio.length} / 150
            </p>
          </div>

          {/* Twitter */}
          <div className="w-full max-w-md">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 mono text-[0.72rem]" style={{ color: '#8a7f72' }}>@</span>
              <Input
                value={twitterHandle}
                onChange={(e) => setTwitterHandle(e.target.value)}
                onBlur={() => handleTwitterChange(twitterHandle)}
                className="mono text-[0.75rem] h-10 pl-8 rounded-none border"
                style={{
                  background: 'rgba(244,238,228,0.04)',
                  borderColor: 'rgba(244,238,228,0.12)',
                  color: '#f4eee4',
                  letterSpacing: '0.05em',
                }}
                placeholder="X handle"
              />
            </div>
          </div>
        </div>

        {/* Action buttons — flat mono tiles matching landing */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
          {[
            { label: 'Refresh', icon: RefreshCw, onClick: handleRefresh, disabled: balanceLoading, spinning: balanceLoading },
            { label: 'Buy SOL', icon: ShoppingCart, onClick: handleBuySol, accent: true },
            { label: 'Swap', icon: ArrowLeftRight, onClick: () => setShowSwapModal(true) },
            { label: 'Deposit', icon: Download, onClick: () => setShowDepositModal(true) },
            { label: 'Withdraw', icon: Send, onClick: () => setShowSendModal(true) },
            { label: 'Security', icon: Settings, onClick: () => setShowSettingsModal(true) },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={action.onClick}
                disabled={action.disabled}
                className="group inline-flex items-center gap-2 px-4 py-2.5 mono text-[0.62rem] uppercase tracking-[0.24em] transition-colors duration-300 disabled:opacity-40"
                style={{
                  background: action.accent ? '#e89660' : 'transparent',
                  color: action.accent ? '#0a0814' : '#d8cfc0',
                  border: action.accent
                    ? '1px solid #e89660'
                    : '1px solid rgba(244,238,228,0.12)',
                }}
                onMouseEnter={(e) => {
                  if (!action.accent) {
                    e.currentTarget.style.borderColor = 'rgba(232,150,96,0.4)';
                    e.currentTarget.style.color = '#f4eee4';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!action.accent) {
                    e.currentTarget.style.borderColor = 'rgba(244,238,228,0.12)';
                    e.currentTarget.style.color = '#d8cfc0';
                  }
                }}
              >
                <Icon className={`w-3.5 h-3.5 ${action.spinning ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{action.label}</span>
              </button>
            );
          })}
        </div>

        {/* Follower/Following */}
        {profileData?.success && (
          <div className="flex items-center justify-center gap-8 mt-6">
            <a href={`/profile/${primaryWallet.address}/followers`} className="text-center transition-opacity hover:opacity-70">
              <div className="serif text-[1.4rem] leading-none"
                style={{ color: '#f4eee4', fontVariationSettings: "'SOFT' 50, 'opsz' 48" }}>
                {profileData.data.followerCount || 0}
              </div>
              <div className="mono text-[0.56rem] uppercase tracking-[0.28em] mt-1" style={{ color: '#8a7f72' }}>Followers</div>
            </a>
            <span className="w-px h-8" style={{ background: 'rgba(244,238,228,0.08)' }} />
            <a href={`/profile/${primaryWallet.address}/following`} className="text-center transition-opacity hover:opacity-70">
              <div className="serif text-[1.4rem] leading-none"
                style={{ color: '#f4eee4', fontVariationSettings: "'SOFT' 50, 'opsz' 48" }}>
                {profileData.data.followingCount || 0}
              </div>
              <div className="mono text-[0.56rem] uppercase tracking-[0.28em] mt-1" style={{ color: '#8a7f72' }}>Following</div>
            </a>
          </div>
        )}
      </div>

      {/* First-time user onboarding banner - shows when balance is 0 */}
      {solBalance === 0 && usdcBalance === 0 && !balanceLoading && (
        <FirstTimeUserBanner
          onBuySol={handleBuySol}
          onDeposit={() => setShowDepositModal(true)}
        />
      )}

      {/* ─── Seeds in your pouch (tokens held) ─── */}
      <div className="max-w-4xl mx-auto space-y-2 mt-10">
        <div className="flex items-center justify-between px-2 sm:px-0 mb-4">
          <div className="flex items-center gap-3">
            <span style={{ color: '#e89660', display: 'inline-flex' }}>
              <SeedIcon className="w-[18px] h-[18px]" />
            </span>
            <h3
              className="serif tracking-[-0.015em]"
              style={{
                color: '#f4eee4',
                fontSize: 'clamp(1.05rem, 2vw, 1.3rem)',
                fontWeight: 400,
                fontVariationSettings: "'SOFT' 50, 'WONK' 0, 'opsz' 48",
              }}
            >
              Seeds in your pouch
            </h3>
          </div>
          {isTokensLoading && (
            <RefreshCw className="w-3 h-3 animate-spin" style={{ color: '#e89660' }} />
          )}
        </div>

        {/* SOL — the native seed, always first */}
        <div
          className="transition-colors cursor-pointer"
          style={{
            background: 'rgba(244,238,228,0.03)',
            border: '1px solid rgba(244,238,228,0.08)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(232,150,96,0.06)';
            e.currentTarget.style.borderColor = 'rgba(232,150,96,0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(244,238,228,0.03)';
            e.currentTarget.style.borderColor = 'rgba(244,238,228,0.08)';
          }}
        >
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 flex items-center justify-center p-1.5 overflow-hidden"
                style={{
                  background: 'rgba(244,238,228,0.04)',
                  border: '1px solid rgba(232,150,96,0.25)',
                }}
              >
                <img
                  src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                  alt="Solana"
                  className="w-full h-full"
                />
              </div>
              <div>
                <p className="mono text-[0.68rem] uppercase tracking-[0.24em]" style={{ color: '#f4eee4' }}>Solana</p>
                <p className="mono text-[0.56rem] uppercase tracking-[0.2em] mt-1" style={{ color: '#8a7f72' }}>
                  ◎{solBalance.toFixed(4)} SOL
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="serif" style={{ color: '#f4eee4', fontSize: '1.05rem', fontVariationSettings: "'SOFT' 50, 'opsz' 36" }}>
                ${isPriceLoading ? '…' : usdValue}
              </p>
            </div>
          </div>
        </div>

        {/* USDC - show if balance > 0 */}
        {usdcBalance > 0 && (
          <div
            className="transition-colors cursor-pointer"
            style={{
              background: 'rgba(244,238,228,0.03)',
              border: '1px solid rgba(244,238,228,0.08)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(232,150,96,0.06)';
              e.currentTarget.style.borderColor = 'rgba(232,150,96,0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(244,238,228,0.03)';
              e.currentTarget.style.borderColor = 'rgba(244,238,228,0.08)';
            }}
          >
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 flex items-center justify-center p-1.5 overflow-hidden"
                  style={{
                    background: 'rgba(244,238,228,0.04)',
                    border: '1px solid rgba(232,150,96,0.25)',
                  }}
                >
                  <img
                    src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png"
                    alt="USDC"
                    className="w-full h-full"
                  />
                </div>
                <div>
                  <p className="mono text-[0.68rem] uppercase tracking-[0.24em]" style={{ color: '#f4eee4' }}>USD Coin</p>
                  <p className="mono text-[0.56rem] uppercase tracking-[0.2em] mt-1" style={{ color: '#8a7f72' }}>
                    {usdcFormatted} USDC
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="serif" style={{ color: '#f4eee4', fontSize: '1.05rem', fontVariationSettings: "'SOFT' 50, 'opsz' 36" }}>
                  ${usdcFormatted}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Other Tokens (from claims and transfers) */}
        {allTokens.length > 0 && (
          <>
            {allTokens
              .filter(token => token.mint !== usdcMint.toBase58()) // Exclude USDC (already shown above)
              .map((token) => {
                const stats = tokenStats.get(token.mint);
                const price = stats?.price ?? null;
                const priceChange = stats?.priceChange24h ?? null;
                const usdValue = price !== null ? price * token.uiAmount : null;
                const isPositive = priceChange !== null && priceChange >= 0;

                return (
                <div
                  key={token.mint}
                  className="transition-colors cursor-pointer"
                  style={{
                    background: 'rgba(244,238,228,0.03)',
                    border: '1px solid rgba(244,238,228,0.08)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(232,150,96,0.06)';
                    e.currentTarget.style.borderColor = 'rgba(232,150,96,0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(244,238,228,0.03)';
                    e.currentTarget.style.borderColor = 'rgba(244,238,228,0.08)';
                  }}
                >
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="w-9 h-9 flex items-center justify-center overflow-hidden flex-shrink-0"
                        style={{
                          background: 'rgba(244,238,228,0.04)',
                          border: '1px solid rgba(232,150,96,0.25)',
                        }}
                      >
                        {token.logoURI ? (
                          <img
                            src={token.logoURI}
                            alt={token.symbol}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="mono text-[0.58rem] uppercase tracking-[0.12em]" style={{ color: '#e89660' }}>
                            {token.symbol?.slice(0, 3).toUpperCase() || 'TKN'}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="mono text-[0.68rem] uppercase tracking-[0.24em] truncate" style={{ color: '#f4eee4' }}>
                          {token.name}
                        </p>
                        <p className="mono text-[0.56rem] uppercase tracking-[0.2em] mt-1 truncate" style={{ color: '#8a7f72' }}>
                          {token.uiAmount.toLocaleString(undefined, {
                            maximumFractionDigits: token.decimals > 6 ? 4 : 2,
                          })} {token.symbol}
                        </p>
                      </div>
                    </div>
                    {/* Price & Value Column */}
                    <div className="text-right flex-shrink-0 mx-3">
                      {price !== null ? (
                        <>
                          <p className="serif" style={{ color: '#f4eee4', fontSize: '0.95rem', fontVariationSettings: "'SOFT' 50, 'opsz' 36" }}>
                            {usdValue !== null ? (
                              usdValue >= 1000 ? `$${(usdValue / 1000).toFixed(2)}K` :
                              usdValue >= 1 ? `$${usdValue.toFixed(2)}` :
                              `$${usdValue.toFixed(4)}`
                            ) : '—'}
                          </p>
                          <div className="flex items-center justify-end gap-1.5 mt-0.5">
                            <span className="mono text-[0.5rem] uppercase tracking-[0.2em]" style={{ color: '#6a6058' }}>
                              @{price < 0.000001 ? price.toExponential(1) : price < 0.01 ? `$${price.toFixed(6)}` : `$${price.toFixed(4)}`}
                            </span>
                            {priceChange !== null && (
                              <span className="mono text-[0.56rem] uppercase tracking-[0.16em]"
                                style={{ color: isPositive ? '#3f7a42' : '#d67347' }}>
                                {isPositive ? '+' : ''}{priceChange.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="mono text-[0.58rem] uppercase tracking-[0.24em]" style={{ color: '#6a6058' }}>
                          {isLoadingTokenStats ? '…' : '—'}
                        </p>
                      )}
                    </div>
                    {/* Actions Column */}
                    <div className="text-right flex-shrink-0 flex flex-col gap-1.5">
                      <a
                        href={`https://pump.fun/${token.mint}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono text-[0.56rem] uppercase tracking-[0.24em] flex items-center gap-1 justify-end transition-colors"
                        style={{ color: '#3f7a42' }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#5fa062')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#3f7a42')}
                        title="Trade on Pump.fun"
                      >
                        <TrendingUp className="w-2.5 h-2.5" /> Trade
                      </a>
                      <a
                        href={`https://orb.helius.dev/address/${token.mint}${SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono text-[0.56rem] uppercase tracking-[0.24em] flex items-center gap-1 justify-end transition-colors"
                        style={{ color: '#8a7f72' }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#e89660')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#8a7f72')}
                      >
                        View <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              );
              })}
          </>
        )}

        {/* Loading State */}
        {isTokensLoading && allTokens.length === 0 && (
          <div style={{ background: 'rgba(244,238,228,0.02)', border: '1px solid rgba(244,238,228,0.08)' }}>
            <div className="text-center py-6">
              <RefreshCw className="w-4 h-4 mx-auto mb-2 animate-spin" style={{ color: '#e89660' }} />
              <p className="mono text-[0.58rem] uppercase tracking-[0.26em]" style={{ color: '#8a7f72' }}>Loading seeds…</p>
            </div>
          </div>
        )}

        {/* Empty State — no seeds yet */}
        {!isTokensLoading && allTokens.length === 0 && usdcBalance === 0 && (
          <div style={{ background: 'rgba(244,238,228,0.02)', border: '1px solid rgba(244,238,228,0.08)' }}>
            <div className="text-center py-8 px-4">
              <span style={{ color: 'rgba(232,150,96,0.45)', display: 'inline-flex' }}>
                <SeedIcon className="w-6 h-6 mx-auto mb-3" />
              </span>
              <p className="serif italic" style={{ color: '#d8cfc0', fontSize: '0.98rem', fontVariationSettings: "'SOFT' 100, 'opsz' 30" }}>
                No seeds yet.
              </p>
              <p className="mono text-[0.56rem] uppercase tracking-[0.26em] mt-2" style={{ color: '#8a7f72' }}>
                Back a market or launch one to start collecting
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Your harvest (creator fees from pump.fun) ─── */}
      {launchedTokenCount > 0 && (
        <div className="max-w-4xl mx-auto space-y-2 mt-10">
          <div className="flex items-center justify-between px-2 sm:px-0 mb-4">
            <div className="flex items-center gap-3">
              <span style={{ color: '#e89660', display: 'inline-flex' }}>
                <BasketIcon className="w-[18px] h-[18px]" />
              </span>
              <h3
                className="serif tracking-[-0.015em]"
                style={{
                  color: '#f4eee4',
                  fontSize: 'clamp(1.05rem, 2vw, 1.3rem)',
                  fontWeight: 400,
                  fontVariationSettings: "'SOFT' 50, 'WONK' 0, 'opsz' 48",
                }}
              >
                Your harvest
              </h3>
            </div>
            <button
              onClick={refreshCreatorFees}
              disabled={isCreatorFeesLoading}
              className="mono text-[0.58rem] uppercase tracking-[0.26em] transition-colors flex items-center gap-1.5"
              style={{ color: '#8a7f72' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#e89660')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#8a7f72')}
            >
              <RefreshCw className={`w-3 h-3 ${isCreatorFeesLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Individual token cards */}
          <div className="space-y-2">
            {launchedTokens.map((token) => (
              <div
                key={token.tokenAddress}
                className="flex items-center gap-3 p-3 transition-colors"
                style={{
                  background: 'rgba(244,238,228,0.03)',
                  border: '1px solid rgba(244,238,228,0.08)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(232,150,96,0.06)';
                  e.currentTarget.style.borderColor = 'rgba(232,150,96,0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(244,238,228,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(244,238,228,0.08)';
                }}
              >
                {/* Token image */}
                <div
                  className="w-9 h-9 overflow-hidden flex-shrink-0"
                  style={{
                    background: 'rgba(244,238,228,0.04)',
                    border: '1px solid rgba(63,122,66,0.3)',
                  }}
                >
                  {token.imageUrl ? (
                    <img
                      src={token.imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/')}
                      alt={token.symbol}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span style={{ color: '#3f7a42', display: 'inline-flex' }}>
                        <BloomIcon className="w-4 h-4" />
                      </span>
                    </div>
                  )}
                </div>

                {/* Token info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="mono text-[0.68rem] uppercase tracking-[0.22em] truncate" style={{ color: '#f4eee4' }}>{token.name}</span>
                    <span className="mono text-[0.56rem] uppercase tracking-[0.18em]" style={{ color: '#8a7f72' }}>${token.symbol}</span>
                  </div>
                  <p className="mono text-[0.54rem] uppercase tracking-[0.22em] mt-1 truncate" style={{ color: '#6a6058' }}>
                    Generating creator fees · pump.fun
                  </p>
                </div>

                {/* External link */}
                <a
                  href={`https://pump.fun/coin/${token.tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 transition-colors"
                  style={{ color: '#8a7f72' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#e89660')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#8a7f72')}
                  title="View on pump.fun"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>

          {/* Total claimable — the ripe harvest */}
          <div
            className="relative overflow-hidden"
            style={{
              background: 'rgba(63,122,66,0.06)',
              border: '1px solid rgba(63,122,66,0.25)',
            }}
          >
            <div
              aria-hidden
              className="absolute -top-12 -right-12 w-48 h-48 pointer-events-none"
              style={{
                background: 'radial-gradient(circle, rgba(63,122,66,0.18) 0%, transparent 70%)',
              }}
            />
            <div className="p-4 relative">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(63,122,66,0.15)', border: '1px solid rgba(63,122,66,0.4)', color: '#3f7a42' }}
                  >
                    <BasketIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="mono text-[0.56rem] uppercase tracking-[0.26em]" style={{ color: '#8a7f72' }}>Ripe to harvest</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="serif" style={{ color: '#f4eee4', fontSize: '1.4rem', fontVariationSettings: "'SOFT' 50, 'opsz' 48" }}>
                        ◎{isCreatorFeesLoading ? '…' : creatorFeesClaimable.toFixed(4)}
                      </span>
                      {solPrice && !isPriceLoading && creatorFeesClaimable > 0 && (
                        <span className="mono text-[0.58rem] uppercase tracking-[0.2em]" style={{ color: '#8a7f72' }}>
                          ≈ ${(creatorFeesClaimable * solPrice).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    const result = await claimFees();
                    if (result.success) {
                      console.log('Fees claimed successfully:', result.signature);
                    } else {
                      console.error('Failed to claim fees:', result.error);
                    }
                  }}
                  disabled={!hasClaimableFees || isClaimingFees}
                  className="group relative inline-flex items-center gap-2 px-5 py-2.5 mono text-[0.64rem] uppercase tracking-[0.24em] font-semibold transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: hasClaimableFees ? '#3f7a42' : 'rgba(244,238,228,0.04)',
                    color: hasClaimableFees ? '#0a0814' : '#8a7f72',
                    border: hasClaimableFees ? 'none' : '1px solid rgba(244,238,228,0.1)',
                  }}
                >
                  {isClaimingFees ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Picking…</span>
                    </>
                  ) : hasClaimableFees ? (
                    <>
                      <BasketIcon className="w-3.5 h-3.5" />
                      <span>Harvest all</span>
                    </>
                  ) : (
                    <span>Nothing ripe yet</span>
                  )}
                </button>
              </div>

              <p className="mono text-[0.52rem] uppercase tracking-[0.24em] mt-3 pt-3"
                style={{ color: '#6a6058', borderTop: '1px solid rgba(244,238,228,0.05)' }}>
                Fees pool across all your tokens · paid out together by pump.fun
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Portfolio — Growing / Bloomed / Watching ─── */}
      <div className="max-w-4xl mx-auto space-y-6 mt-12">
        {/* Tab Navigation — plant-stage labels with plant icons */}
        <div className="flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-0 flex-wrap">
          {[
            { value: 'predictions' as const, label: 'Growing', Icon: TreeIcon, count: positionsData?.data?.all?.length || 0 },
            { value: 'projects' as const, label: 'Bloomed', Icon: BloomIcon, count: projectsData?.data?.projects?.length || 0 },
            { value: 'watchlist' as const, label: 'Watching', Icon: LeafIcon, count: profileData?.data?.favoriteMarkets?.length || 0 },
          ].map((tab) => {
            const Icon = tab.Icon;
            const isActive = portfolioTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setPortfolioTab(tab.value)}
                className="flex items-center gap-2 px-4 sm:px-5 py-2.5 mono text-[0.64rem] uppercase tracking-[0.26em] transition-colors duration-300"
                style={{
                  background: isActive ? 'rgba(232,150,96,0.12)' : 'transparent',
                  color: isActive ? '#e89660' : '#8a7f72',
                  border: isActive ? '1px solid rgba(232,150,96,0.4)' : '1px solid rgba(244,238,228,0.08)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#f4eee4';
                    e.currentTarget.style.borderColor = 'rgba(244,238,228,0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#8a7f72';
                    e.currentTarget.style.borderColor = 'rgba(244,238,228,0.08)';
                  }
                }}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span
                    className="mono text-[0.56rem] tracking-[0.1em] px-1.5 py-0.5 ml-1"
                    style={{
                      background: isActive ? 'rgba(232,150,96,0.15)' : 'rgba(244,238,228,0.06)',
                      color: isActive ? '#e89660' : '#d8cfc0',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {portfolioTab === 'predictions' && (
        <div className="space-y-4">

          {positionsLoading ? (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="text-center text-gray-400 py-8">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  <p className="text-sm">Loading your predictions...</p>
                </div>
              </CardContent>
            </Card>
          ) : positionsData?.success && positionsData.data?.all?.length > 0 ? (
            <>
              {/* Active Positions */}
              {positionsData.data.active.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-400">Active Positions</h4>
                    {positionsData.data.active.length > 3 && (
                      <button
                        onClick={() => setShowAllPositions(!showAllPositions)}
                        className="text-xs text-[#e89660] hover:text-[#ecb48a] transition-colors"
                      >
                        {showAllPositions ? 'View Less' : `View All (${positionsData.data.active.length})`}
                      </button>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {positionsData.data.active.slice(0, showAllPositions ? undefined : 3).map((position: any) => (
                      <Card key={position.marketId} className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
                        <CardContent className="p-3 sm:p-4">
                          <a href={`/market/${position.marketId}`} className="block group">
                            <div className="mb-3">
                              <div className="flex items-start gap-2 sm:gap-3 mb-2">
                                {position.marketImage ? (
                                  <img
                                    src={position.marketImage}
                                    alt={position.marketName}
                                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center flex-shrink-0 ${
                                    position.voteType === 'yes'
                                      ? 'bg-[#3f7a42]/15 border border-[#3f7a42]/40 text-[#3f7a42]'
                                      : 'bg-[#d67347]/15 border border-[#d67347]/40 text-[#d67347]'
                                  }`}>
                                    {position.voteType === 'yes' ? <TreeIcon className="w-5 h-5" /> : <LeafIcon className="w-5 h-5" />}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm sm:text-base text-white font-semibold group-hover:text-[#e89660] transition-colors truncate">
                                    {position.marketName}
                                  </h4>
                                  <p className="text-xs text-gray-400">{position.tokenSymbol || 'TKN'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-11 sm:ml-[52px]">
                                <span className={`px-2 py-0.5 sm:py-1 rounded text-xs border whitespace-nowrap ${
                                  position.voteType === 'yes'
                                    ? 'mono text-[0.56rem] uppercase tracking-[0.24em] text-[#3f7a42] border border-[#3f7a42]/40 bg-[#3f7a42]/10'
                                    : 'mono text-[0.56rem] uppercase tracking-[0.24em] text-[#d67347] border border-[#d67347]/40 bg-[#d67347]/10'
                                }`}>
                                  {position.voteType.toUpperCase()}
                                </span>
                                <VoteHistory marketId={position.marketId} walletAddress={primaryWallet?.address!} />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Your Stake</div>
                                <div className="font-semibold text-white">
                                  {(Number(position.totalAmount) || 0).toFixed(2)} SOL
                                </div>
                                <div className="text-xs text-gray-500">
                                  {position.tradeCount} {position.tradeCount === 1 ? 'trade' : 'trades'}
                                </div>
                              </div>
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Current Price</div>
                                <div className={`font-semibold ${
                                  position.voteType === 'yes' ? 'text-[#3f7a42]' : 'text-[#d67347]'
                                }`}>
                                  {position.voteType === 'yes' ? (Number(position.currentYesPrice) || 0).toFixed(1) : (Number(position.currentNoPrice) || 0).toFixed(1)}%
                                </div>
                                <div className="text-xs text-gray-500">
                                  {position.voteType === 'yes' ? 'YES' : 'NO'} rate
                                </div>
                              </div>
                            </div>
                          </a>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Claimable Positions */}
              {positionsData.data.claimable.length > 0 && (
                <div className="space-y-3 mt-6">
                  <h4 className="text-sm font-medium text-gray-400">Claimable Rewards</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {positionsData.data.claimable.map((position: any) => (
                      <Card key={position.marketId} className="bg-[#3f7a42]/8 border-[#3f7a42]/25 hover:border-[#3f7a42]/50 transition-colors">
                        <CardContent className="p-3 sm:p-4">
                          <a href={`/market/${position.marketId}`} className="block group">
                            <div className="mb-3">
                              <div className="flex items-start gap-2 sm:gap-3 mb-2">
                                {position.marketImage ? (
                                  <img
                                    src={position.marketImage}
                                    alt={position.marketName}
                                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center flex-shrink-0 bg-[#3f7a42]/15 border border-[#3f7a42]/40">
                                    <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm sm:text-base text-white font-semibold group-hover:text-[#e89660] transition-colors truncate">
                                    {position.marketName}
                                  </h4>
                                  <p className="text-xs text-gray-400">{position.tokenSymbol || 'TKN'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-11 sm:ml-[52px]">
                                <span className="px-2 py-0.5 sm:py-1 rounded text-xs border mono text-[0.56rem] uppercase tracking-[0.24em] text-[#3f7a42] border border-[#3f7a42]/40 bg-[#3f7a42]/10 whitespace-nowrap">
                                  WON
                                </span>
                                <VoteHistory marketId={position.marketId} walletAddress={primaryWallet?.address!} />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Your Stake</div>
                                <div className="font-semibold text-white">
                                  {(Number(position.totalAmount) || 0).toFixed(2)} SOL
                                </div>
                                <div className="text-xs text-gray-500">
                                  {position.voteType.toUpperCase()} vote
                                </div>
                              </div>
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Resolution</div>
                                <div className="font-semibold text-[#3f7a42]">
                                  {position.resolution || 'YesWins'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  You won!
                                </div>
                              </div>
                            </div>

                            <div className="px-4 py-2 text-[#0a0814] bg-[#3f7a42] hover:bg-[#4a8a4d] font-semibold transition-all text-center">
                              Claim Rewards
                            </div>
                          </a>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Already Claimed Positions (Won and claimed) */}
              {positionsData.data.resolved.filter((p: any) => p.isWinner && p.claimed).length > 0 && (
                <div className="space-y-3 mt-6">
                  <h4 className="text-sm font-medium text-gray-400">Claimed Rewards</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {positionsData.data.resolved.filter((p: any) => p.isWinner && p.claimed).map((position: any) => (
                      <Card key={position.marketId} className="bg-[#3f7a42]/5 border-[#3f7a42]/25 opacity-80 hover:opacity-100 transition-opacity">
                        <CardContent className="p-3 sm:p-4">
                          <a href={`/market/${position.marketId}`} className="block group">
                            <div className="mb-3">
                              <div className="flex items-start gap-2 sm:gap-3 mb-2">
                                {position.marketImage ? (
                                  <img
                                    src={position.marketImage}
                                    alt={position.marketName}
                                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center flex-shrink-0 bg-[#3f7a42]/15 border border-[#3f7a42]/40">
                                    <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm sm:text-base text-white font-semibold group-hover:text-[#e89660] transition-colors truncate">
                                    {position.marketName}
                                  </h4>
                                  <p className="text-xs text-gray-400">{position.tokenSymbol || 'TKN'}</p>
                                </div>
                              </div>
                              <div className="ml-11 sm:ml-[52px]">
                                <span className="inline-block px-2 py-0.5 sm:py-1 rounded text-xs border mono text-[0.56rem] uppercase tracking-[0.24em] text-[#3f7a42] border border-[#3f7a42]/40 bg-[#3f7a42]/10 whitespace-nowrap">
                                  CLAIMED
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Your Stake</div>
                                <div className="font-semibold text-white">
                                  {(Number(position.totalAmount) || 0).toFixed(2)} SOL
                                </div>
                                <div className="text-xs text-gray-500">
                                  {position.voteType.toUpperCase()} vote
                                </div>
                              </div>
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Resolution</div>
                                <div className="font-semibold text-[#3f7a42]">
                                  {position.resolution || 'YesWins'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Rewards claimed
                                </div>
                              </div>
                            </div>
                          </a>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Lost Positions (Not winner) */}
              {positionsData.data.resolved.filter((p: any) => !p.isWinner).length > 0 && (
                <div className="space-y-3 mt-6">
                  <h4 className="text-sm font-medium text-gray-400">Resolved Positions</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {positionsData.data.resolved.filter((p: any) => !p.isWinner).map((position: any) => (
                      <Card key={position.marketId} className="bg-white/5 border-white/10 opacity-70 hover:opacity-100 transition-opacity">
                        <CardContent className="p-3 sm:p-4">
                          <a href={`/market/${position.marketId}`} className="block group">
                            <div className="mb-3">
                              <div className="flex items-start gap-2 sm:gap-3 mb-2">
                                {position.marketImage ? (
                                  <img
                                    src={position.marketImage}
                                    alt={position.marketName}
                                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-cover flex-shrink-0 grayscale"
                                  />
                                ) : (
                                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-gray-500 to-gray-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm sm:text-base text-white font-semibold group-hover:text-[#e89660] transition-colors truncate">
                                    {position.marketName}
                                  </h4>
                                  <p className="text-xs text-gray-400">{position.tokenSymbol || 'TKN'}</p>
                                </div>
                              </div>
                              <div className="ml-11 sm:ml-[52px]">
                                <span className="inline-block px-2 py-0.5 sm:py-1 rounded text-xs border mono text-[0.56rem] uppercase tracking-[0.24em] text-[#d67347] border border-[#d67347]/40 bg-[#d67347]/10 whitespace-nowrap">
                                  LOST
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Your Stake</div>
                                <div className="font-semibold text-white">
                                  {(Number(position.totalAmount) || 0).toFixed(2)} SOL
                                </div>
                                <div className="text-xs text-gray-500">
                                  {position.voteType.toUpperCase()} vote
                                </div>
                              </div>
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Resolution</div>
                                <div className="font-semibold text-[#d67347]">
                                  {position.resolution || 'NoWins'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  No rewards
                                </div>
                              </div>
                            </div>
                          </a>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="text-center text-gray-400 py-8">
                  <p className="text-sm">No active predictions yet</p>
                  <p className="text-xs mt-2">Start voting on markets to see them here</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        )}

        {/* My Projects Tab Content */}
        {portfolioTab === 'projects' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            {projectsData?.success && projectsData.data?.projects?.length > 4 && (
              <button
                onClick={() => setShowAllProjects(!showAllProjects)}
                className="text-sm text-[#e89660] hover:text-[#ecb48a] transition-colors ml-auto"
              >
                {showAllProjects ? 'View Less' : `View All (${projectsData.data.projects.length})`}
              </button>
            )}
          </div>

          {projectsLoading ? (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="text-center text-gray-400 py-8">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  <p className="text-sm">Loading your projects...</p>
                </div>
              </CardContent>
            </Card>
          ) : projectsData?.success && projectsData.data?.projects?.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {projectsData.data.projects.slice(0, showAllProjects ? undefined : 3).map((project: any) => (
                <MyProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="text-center text-gray-400 py-8">
                  <Rocket className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">You haven't created any projects yet</p>
                  <p className="text-xs mt-2">Start by creating your first prediction market</p>
                  <a
                    href="/create"
                    className="inline-block mt-4 px-4 py-2 bg-[#e89660]/15 border border-[#e89660]/40 hover:border-[#e89660]/70 rounded-lg text-white font-semibold transition-all text-sm"
                  >
                    Create Project
                  </a>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        )}

        {/* Watchlist Tab Content */}
        {portfolioTab === 'watchlist' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            {profileData?.success && profileData.data?.favoriteMarkets?.length > 4 && (
              <button
                onClick={() => setShowAllWatchlist(!showAllWatchlist)}
                className="text-sm text-[#e89660] hover:text-[#ecb48a] transition-colors ml-auto"
              >
                {showAllWatchlist ? 'View Less' : `View All (${profileData.data.favoriteMarkets.length})`}
              </button>
            )}
          </div>

          {profileData?.success && profileData.data?.favoriteMarkets?.length > 0 ? (
            <WatchlistGrid
              favoriteMarkets={profileData.data.favoriteMarkets}
              showAll={showAllWatchlist}
            />
          ) : (
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="text-center text-gray-400 py-8">
                  <Heart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No markets in your watchlist yet</p>
                  <p className="text-xs mt-2">Click the heart icon on any market to add it to your watchlist</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
        )}
      </div>

      {/* Modals */}
      <SendModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        onSend={handleSend}
        solBalance={solBalance}
        tokens={allTokens}
      />
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        address={primaryWallet?.address || ''}
      />
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        wallet={(primaryWallet as any)._privyWallet}
        onLogout={logout}
        primaryWallet={primaryWallet}
        exportWallet={exportWallet}
      />
      <JupiterSwap
        isOpen={showSwapModal}
        onClose={() => setShowSwapModal(false)}
      />
    </div>
  );
}
