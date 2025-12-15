'use client';

import React, { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWallet';
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
  History
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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Enhanced component to display a favorite market with better UI
function FavoriteMarketCard({ marketId }: { marketId: string }) {
  const { data: marketData, mutate } = useSWR(`/api/markets/${marketId}`, fetcher, {
    revalidateOnFocus: false,
  });

  // Get market address for real-time updates
  const marketAddress = marketData?.data?.marketAddress;
  const { marketData: realtimeData } = useMarketSocket(marketAddress || null);

  // Merge real-time updates with SWR data
  const market = realtimeData
    ? { ...marketData?.data, ...realtimeData }
    : marketData?.data;

  if (!marketData?.success) {
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
        return 'bg-green-500/20 text-green-400 border-green-400/30';
      case 'NoWins':
        return 'bg-red-500/20 text-red-400 border-red-400/30';
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
    <Card className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm border-cyan-500/20 hover:border-cyan-400/40 transition-all hover:scale-[1.02] group overflow-hidden">
      <CardContent className="p-4">
        <a href={`/market/${marketId}`} className="block">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {market.image ? (
                <div className="flex-shrink-0 relative">
                  <div className="absolute inset-0 bg-cyan-500/30 rounded-lg blur-md opacity-50 animate-pulse"></div>
                  <img
                    src={market.image}
                    alt={market.name}
                    className="relative w-12 h-12 rounded-lg object-cover ring-2 ring-cyan-500/50 group-hover:ring-cyan-400 transition-all transform group-hover:scale-110"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-red-500 via-pink-500 to-purple-500 flex items-center justify-center ring-2 ring-pink-500/50 group-hover:ring-pink-400 transition-all transform group-hover:scale-110 flex-shrink-0">
                  <span className="text-xl font-bold text-white/90">{market.name.charAt(0)}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-semibold group-hover:text-cyan-400 transition-colors truncate">
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
            <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-lg p-2.5 border border-white/20 group-hover:border-cyan-400/30 transition-all">
              <div className="text-gray-400 text-xs mb-1">Pool Progress</div>
              <div className="font-bold text-white text-base">
                {(market.poolProgressPercentage || 0).toFixed(0)}%
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {((market.poolBalance || 0) / 1e9).toFixed(2)} / {((market.targetPool || 0) / 1e9).toFixed(0)} SOL
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 rounded-lg p-2.5 border border-green-400/20 group-hover:border-green-400/40 transition-all">
              <div className="text-gray-400 text-xs mb-1">YES Rate</div>
              <div className="font-bold text-green-400 text-base">
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
        className="p-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/30 transition-all group"
        title="View vote history"
      >
        <History className="w-4 h-4 text-gray-400 group-hover:text-cyan-400 transition-colors" />
      </button>

      {/* Vote History Modal/Dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-gradient-to-br from-gray-900 to-gray-800 border border-cyan-500/30 rounded-lg max-w-lg w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-cyan-400" />
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
                    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">YES Votes</div>
                      <div className="font-bold text-green-400 text-lg">
                        {voteHistory.data.summary.yesTradeCount}
                      </div>
                      <div className="text-xs text-gray-300">
                        {voteHistory.data.summary.totalYesAmount.toFixed(2)} SOL
                      </div>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                      <div className="text-xs text-gray-400 mb-1">NO Votes</div>
                      <div className="font-bold text-red-400 text-lg">
                        {voteHistory.data.summary.noTradeCount}
                      </div>
                      <div className="text-xs text-gray-300">
                        {voteHistory.data.summary.totalNoAmount.toFixed(2)} SOL
                      </div>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <div className="text-sm text-gray-400">Total Invested</div>
                    <div className="font-bold text-white text-xl">
                      {voteHistory.data.summary.totalInvested.toFixed(2)} SOL
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
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              {trade.voteType.toUpperCase()}
                            </span>
                            <div className="flex-1">
                              <div className="text-white font-medium">{trade.amount.toFixed(3)} SOL</div>
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
                            className="text-cyan-400 hover:text-cyan-300 p-2 hover:bg-cyan-500/10 rounded transition-colors"
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
        return 'bg-green-500/20 text-green-400 border-green-400/30';
      case 'Not Launched':
        return 'bg-red-500/20 text-red-400 border-red-400/30';
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
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Rocket className="w-5 h-5 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-white font-semibold group-hover:text-cyan-400 transition-colors truncate">
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
              <div className="font-semibold text-green-400">
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
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold">
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
                            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-bold">
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
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-cyan-400 hover:text-cyan-300"
              >
                MAX
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Available: {selectedToken.balance.toFixed(4)} {selectedToken.symbol}
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
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
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
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

          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400 text-sm">
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
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
          >
            Done
          </Button>
        </CardContent>
      </Card>
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
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
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
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
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
                        className="bg-cyan-500 hover:bg-cyan-600"
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
              className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
            >
              Logout
            </Button>
            <Button
              onClick={onClose}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
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
  const { primaryWallet, logout, login, user: contextUser } = useWallet();
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

  // Fetch user profile
  const { data: profileData, mutate: mutateProfile } = useSWR(
    primaryWallet?.address ? `/api/profile/${primaryWallet.address}` : null,
    fetcher,
    { refreshInterval: 0 }
  );

  // Fetch user positions
  const { data: positionsData, isLoading: positionsLoading, mutate: mutatePositions } = useSWR(
    primaryWallet?.address ? `/api/user/${primaryWallet.address}/positions` : null,
    fetcher,
    {
      refreshInterval: 15000, // Refresh every 15 seconds
      revalidateOnFocus: true, // Refresh when user switches back to tab
    }
  );

  // Fetch user's created projects
  const { data: projectsData, isLoading: projectsLoading, mutate: mutateProjects } = useSWR(
    primaryWallet?.address ? `/api/user/${primaryWallet.address}/projects` : null,
    fetcher,
    { refreshInterval: 30000 } // Refresh every 30 seconds
  );

  // Real-time Socket.IO updates
  const { positions: realtimePositions, isConnected: socketConnected } = useUserSocket(
    primaryWallet?.address || null
  );

  // Real-time position updates - revalidate SWR cache when Socket.IO updates arrive
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
        const connection = new Connection(RPC_ENDPOINT, 'confirmed');
        const publicKey = new PublicKey(primaryWallet.address);
        const balance = await connection.getBalance(publicKey);
        setSolBalance(balance / LAMPORTS_PER_SOL);
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

  const handleUsernameChange = async (newUsername: string) => {
    if (!newUsername.trim() || !primaryWallet) return;

    try {
      const response = await fetch('/api/profile/update', {
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
      const response = await fetch('/api/profile/update', {
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
      const response = await fetch('/api/profile/update', {
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

        const response = await fetch('/api/profile/update', {
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

  if (!primaryWallet) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
        <Card className="bg-white/5 border-white/10 text-white w-full max-w-md">
          <CardContent className="p-6 sm:p-8 text-center space-y-4">
            <Wallet className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-cyan-400" />
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold mb-2">Connect Solana Wallet</h2>
              <p className="text-sm sm:text-base text-gray-400 mb-2">
                This platform requires a Solana wallet to access features.
              </p>
            </div>
            <button
              onClick={() => login()}
              className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg font-semibold transition-all text-sm sm:text-base"
            >
              Connect Solana Wallet
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
    <div className="min-h-screen pt-3 sm:pt-4 px-4 sm:px-6 pb-4 sm:pb-6">
      {/* Profile & Balance Section */}
      <div className="max-w-5xl mx-auto mb-6 sm:mb-8">
        {/* Balance Display */}
        <div className="text-center mb-6 px-4">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-1">
            ${isPriceLoading ? '...' : totalUsdValue}
          </h2>
          <div className="space-y-1">
            <p className="text-gray-400 text-base sm:text-lg">
              {balanceLoading ? '...' : solBalance.toFixed(4)} SOL
              {solPrice && !isPriceLoading && (
                <span className="text-xs sm:text-sm text-gray-500 ml-2">
                  @ ${solPrice.toFixed(2)}
                </span>
              )}
            </p>
            <p className="text-gray-400 text-sm sm:text-base">
              {isUsdcLoading ? '...' : usdcFormatted} USDC
            </p>
          </div>
          <button
            onClick={copyAddress}
            className="text-xs text-gray-500 mt-2 hover:text-cyan-400 transition-colors cursor-pointer inline-flex items-center gap-1 break-all max-w-full px-2"
          >
            <span className="truncate">
              {primaryWallet.address.slice(0, 8)}...{primaryWallet.address.slice(-6)}
            </span>
            {addressCopied ? (
              <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
            ) : (
              <Copy className="w-3 h-3 flex-shrink-0" />
            )}
          </button>
          {addressCopied && (
            <p className="text-xs text-green-400 mt-1">Copied!</p>
          )}
          {/* Real-time Status Indicator */}
          <div className="flex items-center gap-1 mt-1">
            <div className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
            <span className="text-xs text-gray-400">
              {socketConnected ? 'Live updates' : 'Polling mode'}
            </span>
          </div>
        </div>

        {/* Profile Photo + Username Input + Bio + Twitter */}
        <div className="flex flex-col items-center gap-3 max-w-2xl mx-auto w-full px-4">
          {/* Profile Photo + Username Row */}
          <div className="flex items-center gap-2">
            {/* Profile Photo */}
            <div className="relative group">
              <div className="w-14 h-14 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center overflow-hidden ring-2 ring-white/20">
                {isUploadingPhoto ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                ) : profilePhotoUrl ? (
                  <img src={profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-7 h-7 text-white" />
                )}
              </div>
              <button
                onClick={handlePhotoUpload}
                disabled={isUploadingPhoto}
                className="absolute bottom-0 right-0 w-5 h-5 bg-cyan-500 rounded-full flex items-center justify-center hover:bg-cyan-600 transition-colors shadow-lg disabled:opacity-50"
              >
                <Camera className="w-3 h-3 text-white" />
              </button>
            </div>

            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => handleUsernameChange(username)}
              className="bg-white/5 border-white/10 text-white font-medium w-32 sm:w-40 h-9"
              placeholder="username"
            />
          </div>

          {/* Bio Input */}
          <div className="w-full max-w-md">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              onBlur={() => handleBioChange(bio)}
              className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-md p-2 min-h-[60px] max-h-[100px] resize-none placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              placeholder="Write a short bio..."
              maxLength={150}
            />
            <p className="text-xs text-gray-500 mt-1 text-right">{bio.length}/150</p>
          </div>

          {/* Twitter Handle Input */}
          <div className="w-full max-w-md">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
              <Input
                value={twitterHandle}
                onChange={(e) => setTwitterHandle(e.target.value)}
                onBlur={() => handleTwitterChange(twitterHandle)}
                className="bg-white/5 border-white/10 text-white text-sm pl-8"
                placeholder="X handle"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            <Button
              onClick={handleRefresh}
              disabled={balanceLoading}
              variant="outline"
              size="sm"
              className="border-white/10 text-white hover:bg-white/5"
            >
              <RefreshCw className={`w-4 h-4 sm:mr-2 ${balanceLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              onClick={handleBuySol}
              variant="outline"
              size="sm"
              className="border-green-500/50 text-green-400 hover:bg-green-500/10"
            >
              <ShoppingCart className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Buy SOL</span>
            </Button>
            <Button
              onClick={() => setShowSwapModal(true)}
              variant="outline"
              size="sm"
              className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
            >
              <ArrowLeftRight className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Swap</span>
            </Button>
            <Button
              onClick={() => setShowDepositModal(true)}
              variant="outline"
              size="sm"
              className="border-white/10 text-white hover:bg-white/5"
            >
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Deposit</span>
            </Button>
            <Button
              onClick={() => setShowSendModal(true)}
              variant="outline"
              size="sm"
              className="border-white/10 text-white hover:bg-white/5"
            >
              <Send className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Withdraw</span>
            </Button>
            <Button
              onClick={() => setShowSettingsModal(true)}
              variant="outline"
              size="sm"
              className="border-white/10 text-white hover:bg-white/5"
            >
              <Settings className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Security</span>
            </Button>
        </div>

        {/* Follower/Following Stats */}
        {profileData?.success && (
          <div className="flex items-center justify-center gap-6 mt-4">
            <a href={`/profile/${primaryWallet.address}/followers`} className="text-center hover:opacity-80 transition-opacity">
              <div className="text-xl font-bold text-white">{profileData.data.followerCount || 0}</div>
              <div className="text-xs text-gray-400">Followers</div>
            </a>
            <a href={`/profile/${primaryWallet.address}/following`} className="text-center hover:opacity-80 transition-opacity">
              <div className="text-xl font-bold text-white">{profileData.data.followingCount || 0}</div>
              <div className="text-xs text-gray-400">Following</div>
            </a>
          </div>
        )}
      </div>

      {/* Tokens List */}
      <div className="max-w-4xl mx-auto space-y-3">
        <div className="flex items-center justify-between px-2 sm:px-0 mb-3">
          <h3 className="text-base font-semibold text-white">Your Tokens</h3>
          {isTokensLoading && (
            <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
          )}
        </div>

        {/* SOL - Always show first */}
        <div className="bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center p-1.5">
                <img
                  src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
                  alt="Solana"
                  className="w-full h-full"
                />
              </div>
              <div>
                <h3 className="text-white font-medium text-sm">Solana</h3>
                <p className="text-[11px] text-gray-400">{solBalance.toFixed(4)} SOL</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white font-medium text-sm">${isPriceLoading ? '...' : usdValue}</p>
            </div>
          </div>
        </div>

        {/* USDC - Show if balance > 0 */}
        {usdcBalance > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-r from-blue-500 to-green-500 flex items-center justify-center p-1.5">
                  <img
                    src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png"
                    alt="USDC"
                    className="w-full h-full"
                  />
                </div>
                <div>
                  <h3 className="text-white font-medium text-sm">USD Coin</h3>
                  <p className="text-[11px] text-gray-400">{usdcFormatted} USDC</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-white font-medium text-sm">${usdcFormatted}</p>
              </div>
            </div>
          </div>
        )}

        {/* Other Tokens (from claims and transfers) */}
        {allTokens.length > 0 && (
          <>
            {allTokens
              .filter(token => token.mint !== usdcMint.toBase58()) // Exclude USDC (already shown above)
              .map((token) => (
                <div key={token.mint} className="bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center p-1.5 overflow-hidden flex-shrink-0">
                        {token.logoURI ? (
                          <img
                            src={token.logoURI}
                            alt={token.symbol}
                            className="w-full h-full object-cover rounded-full"
                            onError={(e) => {
                              // Fallback to gradient if image fails to load
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <span className="text-white font-bold text-xs">
                            {token.symbol?.slice(0, 3).toUpperCase() || 'TKN'}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium text-sm truncate">{token.name}</h3>
                        <p className="text-[11px] text-gray-400 truncate">
                          {token.uiAmount.toLocaleString(undefined, {
                            maximumFractionDigits: token.decimals > 6 ? 4 : 2,
                          })} {token.symbol}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2 flex flex-col gap-1">
                      <a
                        href={`https://pump.fun/${token.mint}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-green-400 hover:text-green-300 flex items-center gap-0.5 justify-end"
                        onClick={(e) => e.stopPropagation()}
                        title="Trade on Pump.fun"
                      >
                        <TrendingUp className="w-2.5 h-2.5" /> Trade
                      </a>
                      <a
                        href={`https://orb.helius.dev/address/${token.mint}${SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
          </>
        )}

        {/* Loading State */}
        {isTokensLoading && allTokens.length === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-lg">
            <div className="text-center text-gray-400 py-6">
              <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin" />
              <p className="text-xs">Loading tokens...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isTokensLoading && allTokens.length === 0 && usdcBalance === 0 && (
          <div className="bg-white/5 border border-white/10 rounded-lg">
            <div className="text-center text-gray-400 py-6">
              <p className="text-xs">No tokens found</p>
              <p className="text-[11px] mt-1 text-gray-500">Claim rewards from markets to receive tokens</p>
            </div>
          </div>
        )}
      </div>

      {/* Your Predictions Section */}
      <div className="max-w-4xl mx-auto space-y-6 mt-8">
        <div className="space-y-4">
          <h3 className="text-lg sm:text-xl font-semibold text-white px-2 sm:px-0">Your Predictions</h3>

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
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
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
                                  <div className={`w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r ${
                                    position.voteType === 'yes'
                                      ? 'from-green-500 to-emerald-500'
                                      : 'from-red-500 to-pink-500'
                                  } rounded-lg flex items-center justify-center flex-shrink-0`}>
                                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm sm:text-base text-white font-semibold group-hover:text-cyan-400 transition-colors truncate">
                                    {position.marketName}
                                  </h4>
                                  <p className="text-xs text-gray-400">{position.tokenSymbol || 'TKN'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-11 sm:ml-[52px]">
                                <span className={`px-2 py-0.5 sm:py-1 rounded text-xs border whitespace-nowrap ${
                                  position.voteType === 'yes'
                                    ? 'bg-green-500/20 text-green-400 border-green-400/30'
                                    : 'bg-red-500/20 text-red-400 border-red-400/30'
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
                                  {position.totalAmount.toFixed(2)} SOL
                                </div>
                                <div className="text-xs text-gray-500">
                                  {position.tradeCount} {position.tradeCount === 1 ? 'trade' : 'trades'}
                                </div>
                              </div>
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Current Price</div>
                                <div className={`font-semibold ${
                                  position.voteType === 'yes' ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {position.voteType === 'yes' ? position.currentYesPrice.toFixed(1) : position.currentNoPrice.toFixed(1)}%
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
                      <Card key={position.marketId} className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20 hover:border-green-500/40 transition-colors">
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
                                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm sm:text-base text-white font-semibold group-hover:text-cyan-400 transition-colors truncate">
                                    {position.marketName}
                                  </h4>
                                  <p className="text-xs text-gray-400">{position.tokenSymbol || 'TKN'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-11 sm:ml-[52px]">
                                <span className="px-2 py-0.5 sm:py-1 rounded text-xs border bg-green-500/20 text-green-400 border-green-400/30 whitespace-nowrap">
                                  WON
                                </span>
                                <VoteHistory marketId={position.marketId} walletAddress={primaryWallet?.address!} />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Your Stake</div>
                                <div className="font-semibold text-white">
                                  {position.totalAmount.toFixed(2)} SOL
                                </div>
                                <div className="text-xs text-gray-500">
                                  {position.voteType.toUpperCase()} vote
                                </div>
                              </div>
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Resolution</div>
                                <div className="font-semibold text-green-400">
                                  {position.resolution || 'YesWins'}
                                </div>
                                <div className="text-xs text-gray-500">
                                  You won!
                                </div>
                              </div>
                            </div>

                            <div className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg text-white font-semibold transition-all text-center">
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
                      <Card key={position.marketId} className="bg-green-500/5 border-green-500/20 opacity-80 hover:opacity-100 transition-opacity">
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
                                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm sm:text-base text-white font-semibold group-hover:text-cyan-400 transition-colors truncate">
                                    {position.marketName}
                                  </h4>
                                  <p className="text-xs text-gray-400">{position.tokenSymbol || 'TKN'}</p>
                                </div>
                              </div>
                              <div className="ml-11 sm:ml-[52px]">
                                <span className="inline-block px-2 py-0.5 sm:py-1 rounded text-xs border bg-green-500/20 text-green-400 border-green-400/30 whitespace-nowrap">
                                  CLAIMED
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Your Stake</div>
                                <div className="font-semibold text-white">
                                  {position.totalAmount.toFixed(2)} SOL
                                </div>
                                <div className="text-xs text-gray-500">
                                  {position.voteType.toUpperCase()} vote
                                </div>
                              </div>
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Resolution</div>
                                <div className="font-semibold text-green-400">
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
                                  <h4 className="text-sm sm:text-base text-white font-semibold group-hover:text-cyan-400 transition-colors truncate">
                                    {position.marketName}
                                  </h4>
                                  <p className="text-xs text-gray-400">{position.tokenSymbol || 'TKN'}</p>
                                </div>
                              </div>
                              <div className="ml-11 sm:ml-[52px]">
                                <span className="inline-block px-2 py-0.5 sm:py-1 rounded text-xs border bg-red-500/20 text-red-400 border-red-400/30 whitespace-nowrap">
                                  LOST
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Your Stake</div>
                                <div className="font-semibold text-white">
                                  {position.totalAmount.toFixed(2)} SOL
                                </div>
                                <div className="text-xs text-gray-500">
                                  {position.voteType.toUpperCase()} vote
                                </div>
                              </div>
                              <div className="bg-white/5 rounded p-2 border border-white/10">
                                <div className="text-gray-400 text-xs">Resolution</div>
                                <div className="font-semibold text-red-400">
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

        {/* My Projects Section */}
        <div className="space-y-4 mt-8">
          <div className="flex items-center justify-between px-2 sm:px-0">
            <div className="flex items-center space-x-2">
              <Rocket className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg sm:text-xl font-semibold text-white">My Projects</h3>
            </div>
            {projectsData?.success && projectsData.data?.projects?.length > 3 && (
              <button
                onClick={() => setShowAllProjects(!showAllProjects)}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
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
                    className="inline-block mt-4 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-lg text-white font-semibold transition-all text-sm"
                  >
                    Create Project
                  </a>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Watchlist/Favorites Section */}
        <div className="space-y-4 mt-8">
          <div className="flex items-center justify-between px-2 sm:px-0">
            <div className="flex items-center space-x-2">
              <Heart className="w-5 h-5 text-red-400 fill-red-400" />
              <h3 className="text-lg sm:text-xl font-semibold text-white">Your Watchlist</h3>
            </div>
            {profileData?.success && profileData.data?.favoriteMarkets?.length > 3 && (
              <button
                onClick={() => setShowAllWatchlist(!showAllWatchlist)}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                {showAllWatchlist ? 'View Less' : `View All (${profileData.data.favoriteMarkets.length})`}
              </button>
            )}
          </div>

          {profileData?.success && profileData.data?.favoriteMarkets?.length > 0 ? (
            <div className="space-y-3">
              {profileData.data.favoriteMarkets.slice(0, showAllWatchlist ? undefined : 3).map((marketId: string) => (
                <FavoriteMarketCard key={marketId} marketId={marketId} />
              ))}
            </div>
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
