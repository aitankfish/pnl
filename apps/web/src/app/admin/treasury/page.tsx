'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useNetwork } from '@/lib/hooks/useNetwork';
import { getSolanaConnection } from '@/lib/solana';
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js';
import { getTreasuryPDA } from '@/lib/anchor-program';
import { useWallets, useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import { VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Wallet, Shield, ArrowDownToLine, Coins, Target, AlertTriangle } from 'lucide-react';
import { usePlatformTokens } from '@/lib/hooks/usePlatformTokens';
import { useEmergencyDrain } from '@/lib/hooks/useEmergencyDrain';

interface TreasuryState {
  admin: string;
  totalFees: number;
  balance: number;
  bump: number;
}

interface MarketWithTokens {
  _id: string;
  marketName: string;
  marketAddress: string;
  tokenMint: string;
  pumpFunTokenAddress: string;
  platformTokensAllocated: string;
  platformTokensClaimed: boolean;
}

export default function TreasuryAdminPage() {
  const { primaryWallet } = useWallet();
  const { network } = useNetwork();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { claimPlatformTokens, isClaiming } = usePlatformTokens();
  const { drainVault, isDraining } = useEmergencyDrain();

  const [treasury, setTreasury] = useState<TreasuryState | null>(null);
  const [loading, setLoading] = useState(false);
  const [newAdminAddress, setNewAdminAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [marketsWithTokens, setMarketsWithTokens] = useState<MarketWithTokens[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [claimingMarket, setClaimingMarket] = useState<string | null>(null);

  // Emergency drain state
  const [drainMarketAddress, setDrainMarketAddress] = useState('');
  const [drainFounderAddress, setDrainFounderAddress] = useState('');

  // Platform wallet for 2% tokens (hardcoded in program)
  const PLATFORM_WALLET = '3MihVtsLsVuEccpmz4YG72Cr8CJWf1evRorTPdPiHeEQ';

  const isAdmin = primaryWallet?.address === treasury?.admin;
  const canInitialize = !treasury; // Can initialize if treasury doesn't exist yet

  // Fetch treasury state
  const fetchTreasury = async () => {
    try {
      setLoading(true);
      const connection = await getSolanaConnection();
      const [treasuryPda] = getTreasuryPDA();

      const accountInfo = await connection.getAccountInfo(treasuryPda);

      if (!accountInfo) {
        setTreasury(null);
        return;
      }

      // Parse treasury account data
      // Layout: [discriminator: 8 bytes][admin: 32 bytes][total_fees: 8 bytes][bump: 1 byte]
      const data = accountInfo.data;
      const admin = new PublicKey(data.slice(8, 40)).toBase58();
      const totalFees = Number(data.readBigUInt64LE(40));
      const bump = data[48];
      const balance = accountInfo.lamports;

      setTreasury({
        admin,
        totalFees,
        balance,
        bump,
      });
    } catch (error) {
      console.error('Failed to fetch treasury:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch markets with unclaimed platform tokens
  const fetchMarketsWithTokens = async () => {
    try {
      setLoadingMarkets(true);
      const response = await fetch('/api/markets/platform-tokens/list');
      const result = await response.json();

      if (result.success) {
        setMarketsWithTokens(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch markets with tokens:', error);
    } finally {
      setLoadingMarkets(false);
    }
  };

  useEffect(() => {
    if (primaryWallet) {
      fetchTreasury();
      fetchMarketsWithTokens();
    }
  }, [primaryWallet, network]);

  // Initialize treasury (deployer only, one-time)
  const handleInitializeTreasury = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/treasury/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callerWallet: primaryWallet!.address,
          network,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }

      // Get the first Solana wallet
      const solanaWallet = wallets[0];
      if (!solanaWallet) {
        throw new Error('No Solana wallet found. Please connect your wallet.');
      }

      console.log('Wallet found:', solanaWallet.address);

      // Get transaction buffer
      const txBuffer = Buffer.from(result.data.serializedTransaction, 'base64');

      console.log('Signing and sending transaction with Privy...');

      // Use signAndSendTransaction - works for both external and embedded wallets
      const txResult = await signAndSendTransaction({
        transaction: txBuffer,
        wallet: solanaWallet as any,
        chain: network === 'devnet' ? 'solana:devnet' : 'solana:mainnet',
      });

      // Extract signature and convert to base58
      const signature = bs58.encode(txResult.signature);
      console.log('Treasury initialized!', signature);

      // Wait for confirmation
      const connection = await getSolanaConnection(network);
      await connection.confirmTransaction(signature, 'confirmed');

      await fetchTreasury();
      alert('Treasury initialized successfully!');
    } catch (error: any) {
      console.error('Failed to initialize treasury:', error);
      alert(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Set new admin (current admin only)
  const handleSetAdmin = async () => {
    if (!newAdminAddress) {
      alert('Please enter a new admin address');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch('/api/treasury/set-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentAdmin: primaryWallet!.address,
          newAdmin: newAdminAddress,
          network,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }

      // Get wallet
      const solanaWallet = wallets[0];
      if (!solanaWallet) throw new Error('No Solana wallet found');

      const txBuffer = Buffer.from(result.data.serializedTransaction, 'base64');

      // Sign and send transaction
      const txResult = await signAndSendTransaction({
        transaction: txBuffer,
        wallet: solanaWallet as any,
        chain: network === 'devnet' ? 'solana:devnet' : 'solana:mainnet',
      });

      const signature = bs58.encode(txResult.signature);
      console.log('Admin changed:', signature);

      // Wait for confirmation
      const connection = await getSolanaConnection(network);
      await connection.confirmTransaction(signature, 'confirmed');

      await fetchTreasury();
      setNewAdminAddress('');
      alert('Admin changed successfully!');
    } catch (error: any) {
      console.error('Failed to set admin:', error);
      alert(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Claim platform tokens from a market
  const handleClaimPlatformTokens = async (market: MarketWithTokens) => {
    try {
      setClaimingMarket(market.marketAddress);

      const result = await claimPlatformTokens({
        marketAddress: market.marketAddress,
        tokenMint: market.tokenMint,
      });

      if (result.success) {
        alert(`Platform tokens claimed successfully! Signature: ${result.signature}`);
        // Refresh the list to update claimed status
        await fetchMarketsWithTokens();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Failed to claim platform tokens:', error);
      alert(`Failed to claim: ${error.message}`);
    } finally {
      setClaimingMarket(null);
    }
  };

  // Re-check claim status for a market
  const handleRecheckStatus = async (marketAddress: string) => {
    try {
      setClaimingMarket(marketAddress); // Use same state for loading indicator
      await fetchMarketsWithTokens(); // Refresh all markets from backend
    } catch (error: any) {
      console.error('Failed to re-check status:', error);
      alert(`Failed to re-check status: ${error.message}`);
    } finally {
      setClaimingMarket(null);
    }
  };

  // Emergency drain vault (admin only)
  const handleEmergencyDrain = async () => {
    if (!drainMarketAddress || !drainFounderAddress) {
      alert('Please enter both market address and founder address');
      return;
    }

    try {
      const result = await drainVault({
        marketAddress: drainMarketAddress,
        founderAddress: drainFounderAddress,
      });

      if (result.success) {
        alert(`Vault drained successfully! Signature: ${result.signature}`);
        setDrainMarketAddress('');
        setDrainFounderAddress('');
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Failed to drain vault:', error);
      alert(`Failed to drain vault: ${error.message}`);
    }
  };

  // Withdraw fees (admin only)
  const handleWithdrawFees = async () => {
    if (!withdrawAmount || !recipientAddress) {
      alert('Please enter amount and recipient address');
      return;
    }

    try {
      setLoading(true);

      const amountLamports = parseFloat(withdrawAmount) * 1e9;

      const response = await fetch('/api/treasury/withdraw-fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin: primaryWallet!.address,
          recipient: recipientAddress,
          amount: Math.floor(amountLamports),
          network,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }

      // Get wallet
      const solanaWallet = wallets[0];
      if (!solanaWallet) throw new Error('No Solana wallet found');

      const txBuffer = Buffer.from(result.data.serializedTransaction, 'base64');

      // Sign and send transaction
      const txResult = await signAndSendTransaction({
        transaction: txBuffer,
        wallet: solanaWallet as any,
        chain: network === 'devnet' ? 'solana:devnet' : 'solana:mainnet',
      });

      const signature = bs58.encode(txResult.signature);
      console.log('Fees withdrawn:', signature);

      // Wait for confirmation
      const connection = await getSolanaConnection(network);
      await connection.confirmTransaction(signature, 'confirmed');

      await fetchTreasury();
      setWithdrawAmount('');
      setRecipientAddress('');
      alert('Fees withdrawn successfully!');
    } catch (error: any) {
      console.error('Failed to withdraw fees:', error);
      alert(`Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white">Treasury Management</h1>
          <p className="text-gray-300">Platform fee collection and admin controls</p>
        </div>

        {/* Wallet Status */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Wallet Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-gray-300">
            <div className="flex justify-between">
              <span>Connected Wallet:</span>
              <span className="font-mono text-sm">{primaryWallet?.address || 'Not connected'}</span>
            </div>
            <div className="flex justify-between">
              <span>Is Admin:</span>
              <span className={isAdmin ? 'text-green-400' : 'text-red-400'}>
                {isAdmin ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Can Initialize:</span>
              <span className={canInitialize ? 'text-green-400' : 'text-gray-500'}>
                {canInitialize ? 'Yes (not initialized yet)' : 'No (already initialized)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Network:</span>
              <span className="uppercase">{network}</span>
            </div>
          </CardContent>
        </Card>

        {/* Treasury State */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Treasury Status
            </CardTitle>
            <CardDescription className="text-gray-400">
              Current treasury configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !treasury ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
              </div>
            ) : treasury ? (
              <div className="space-y-3 text-gray-300">
                <div className="flex justify-between">
                  <span>Treasury PDA:</span>
                  <span className="font-mono text-sm">{getTreasuryPDA()[0].toBase58()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Admin:</span>
                  <span className="font-mono text-sm">{treasury.admin}</span>
                </div>
                <div className="flex justify-between">
                  <span>Balance:</span>
                  <span className="font-bold text-cyan-400">
                    {(treasury.balance / 1e9).toFixed(4)} SOL
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Fees Collected:</span>
                  <span className="font-bold text-green-400">
                    {(treasury.totalFees / 1e9).toFixed(4)} SOL
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <p className="text-gray-400">Treasury not initialized</p>
                <p className="text-yellow-400 text-sm">
                  ⚠️ First person to initialize becomes admin!
                </p>
                {canInitialize && primaryWallet && (
                  <Button
                    onClick={handleInitializeTreasury}
                    disabled={loading}
                    className="bg-gradient-to-r from-purple-500 to-pink-500"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Initializing...
                      </>
                    ) : (
                      'Initialize Treasury'
                    )}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Admin Actions */}
        {treasury && isAdmin && (
          <>
            {/* Set Admin */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Transfer Admin Control
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Transfer treasury admin to a new wallet
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">New Admin Wallet Address</Label>
                  <Input
                    value={newAdminAddress}
                    onChange={(e) => setNewAdminAddress(e.target.value)}
                    placeholder="Enter new admin wallet address..."
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <Button
                  onClick={handleSetAdmin}
                  disabled={loading || !newAdminAddress}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Setting Admin...
                    </>
                  ) : (
                    'Set New Admin'
                  )}
                </Button>
                <p className="text-xs text-yellow-400">
                  Warning: You will lose admin access after transferring control
                </p>
              </CardContent>
            </Card>

            {/* Withdraw Fees */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <ArrowDownToLine className="w-5 h-5" />
                  Withdraw Fees
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Withdraw collected platform fees
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Amount (SOL)</Label>
                  <Input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.0"
                    step="0.001"
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  <p className="text-xs text-gray-400">
                    Available: {(treasury.balance / 1e9).toFixed(4)} SOL
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Recipient Wallet Address</Label>
                  <Input
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    placeholder="Enter recipient wallet address..."
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <Button
                  onClick={handleWithdrawFees}
                  disabled={loading || !withdrawAmount || !recipientAddress}
                  className="w-full bg-gradient-to-r from-green-500 to-cyan-500"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Withdrawing...
                    </>
                  ) : (
                    'Withdraw Fees'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Claim Platform Tokens */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Platform Token Claims (2%)
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Claim 2% token allocation from launched markets
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMarkets ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                  </div>
                ) : marketsWithTokens.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No markets with platform tokens yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {marketsWithTokens.map((market) => (
                      <div
                        key={market._id}
                        className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 space-y-3"
                      >
                        <div className="space-y-2">
                          <h4 className="text-white font-semibold">{market.marketName}</h4>
                          <div className="space-y-1 text-sm text-gray-300">
                            <div className="flex justify-between">
                              <span>Market Address:</span>
                              <span className="font-mono text-xs">{market.marketAddress.slice(0, 8)}...{market.marketAddress.slice(-8)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Token Mint:</span>
                              <span className="font-mono text-xs">{market.tokenMint.slice(0, 8)}...{market.tokenMint.slice(-8)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Allocated:</span>
                              <span className="text-cyan-400 font-bold">
                                {(Number(market.platformTokensAllocated) / 1_000_000).toLocaleString()} tokens
                              </span>
                            </div>
                          </div>
                        </div>
                        {market.platformTokensClaimed ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-center gap-2 p-3 bg-green-900/30 border border-green-600 rounded-lg">
                              <span className="text-green-400 font-bold">✓ Claimed</span>
                            </div>
                            <Button
                              onClick={() => handleRecheckStatus(market.marketAddress)}
                              disabled={claimingMarket === market.marketAddress}
                              variant="outline"
                              className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
                            >
                              {claimingMarket === market.marketAddress ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Refreshing...
                                </>
                              ) : (
                                'Re-check Status'
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            onClick={() => handleClaimPlatformTokens(market)}
                            disabled={claimingMarket === market.marketAddress || isClaiming}
                            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500"
                          >
                            {claimingMarket === market.marketAddress ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Claiming...
                              </>
                            ) : (
                              'Claim Platform Tokens'
                            )}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Emergency Drain Vault */}
            <Card className="bg-red-900/20 border-red-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Emergency Vault Drain
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Drain stuck SOL from market vaults back to founder (Admin only)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Market Address</Label>
                  <Input
                    value={drainMarketAddress}
                    onChange={(e) => setDrainMarketAddress(e.target.value)}
                    placeholder="Enter market address..."
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Founder Address</Label>
                  <Input
                    value={drainFounderAddress}
                    onChange={(e) => setDrainFounderAddress(e.target.value)}
                    placeholder="Enter founder address..."
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                </div>
                <Button
                  onClick={handleEmergencyDrain}
                  disabled={isDraining || !drainMarketAddress || !drainFounderAddress}
                  className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
                >
                  {isDraining ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Draining Vault...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Drain Vault (Emergency Only)
                    </>
                  )}
                </Button>
                <p className="text-xs text-yellow-400">
                  ⚠️ Warning: This will drain all SOL from the vault to the founder&apos;s wallet. Only use in emergency situations.
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {/* Platform Wallet Info */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Coins className="w-5 h-5" />
              Platform Token Wallet
            </CardTitle>
            <CardDescription className="text-gray-400">
              Receives 2% token allocation from each launched token
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-gray-300">
              <div className="flex justify-between">
                <span>Platform Wallet:</span>
                <span className="font-mono text-sm">{PLATFORM_WALLET}</span>
              </div>
              <p className="text-xs text-gray-400 mt-4">
                Token claiming is automatic and can be called by anyone after token launch.
                Tokens always go to this hardcoded platform wallet.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="bg-blue-900/20 border-blue-700">
          <CardHeader>
            <CardTitle className="text-blue-300">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="text-blue-200 space-y-2 text-sm">
            <p><strong>1. Initialize Treasury:</strong> First person to initialize becomes admin (one-time only)</p>
            <p><strong>2. Transfer Admin:</strong> Initial admin transfers control to operational wallet</p>
            <p><strong>3. Lock Initial Wallet:</strong> Store securely as emergency recovery</p>
            <p><strong>4. Fee Collection:</strong> 5% completion fees accumulate in treasury PDA</p>
            <p><strong>5. Token Collection:</strong> 2% tokens allocated for platform, claimed by admin</p>
            <p><strong>6. Withdrawal:</strong> Operational admin withdraws accumulated SOL fees and claims platform tokens anytime</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
