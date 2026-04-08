/**
 * User Information Component
 * Displays user data fetched from MongoDB profile
 */

'use client';

import React from 'react';
import { useWallet } from '@/hooks/useWallet';
import { useUserProfile } from '@/hooks/useUserProfile';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Wallet,
  DollarSign,
  Activity,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface UserInfoProps {
  showBalances?: boolean;
  showWallets?: boolean;
  compact?: boolean;
  className?: string;
}

export default function UserInfo({
  showBalances = true,
  showWallets = true,
  compact = false,
  className = ''
}: UserInfoProps) {
  const { user: contextUser, primaryWallet, authenticated: isLoggedIn, loading: isAuthenticating } = useWallet();
  const { displayName } = useUserProfile();

  // Get network directly from environment variable (no runtime switching)
  const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'devnet' | 'mainnet-beta') || 'devnet';
  const isDevnet = network === 'devnet';
  const isMainnet = network === 'mainnet-beta';

  // Use Dynamic context data directly
  const user = contextUser;
  const wallets = primaryWallet ? [primaryWallet] : [];

  // State for wallet balance
  const [walletBalance, setWalletBalance] = React.useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = React.useState(false);
  const fetchingRef = React.useRef(false);

  // Fetch actual SOL balance from the wallet
  React.useEffect(() => {
    const fetchBalance = async () => {
      // Only proceed if we have a wallet and it's authenticated
      if (!primaryWallet?.address || !isLoggedIn || fetchingRef.current) {
        setWalletBalance(null);
        return;
      }

      // Ensure it's a Solana wallet
      if (primaryWallet.chainType !== 'solana') {
        console.warn('UserInfo: Wallet is not a Solana wallet, skipping balance fetch');
        setWalletBalance(null);
        return;
      }

      try {
        fetchingRef.current = true;
        setIsLoadingBalance(true);
        const { Connection, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');

        // Get RPC endpoint based on detected network
        const RPC_MAINNET = process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';
        const RPC_DEVNET = process.env.NEXT_PUBLIC_HELIUS_DEVNET_RPC || 'https://api.devnet.solana.com';
        const rpcEndpoint = network === 'mainnet-beta' ? RPC_MAINNET : RPC_DEVNET;

        const connection = new Connection(rpcEndpoint, 'confirmed');

        // Validate Solana address before creating PublicKey
        let publicKey;
        try {
          publicKey = new PublicKey(primaryWallet.address);
        } catch (err) {
          console.error('Invalid Solana address:', primaryWallet.address);
          setWalletBalance(null);
          return;
        }

        const balance = await connection.getBalance(publicKey);
        const balanceInSOL = balance / LAMPORTS_PER_SOL;

        setWalletBalance(balanceInSOL);
      } catch (error) {
        console.error('Error fetching balance:', error);
        setWalletBalance(null);
      } finally {
        setIsLoadingBalance(false);
        fetchingRef.current = false;
      }
    };

    // Debounce: wait 300ms before fetching
    const timeout = setTimeout(fetchBalance, 300);

    // Refresh balance every 60 seconds (increased from 30)
    const interval = setInterval(fetchBalance, 60000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [primaryWallet?.address, primaryWallet?.chainType, isLoggedIn, network]);

  // Get balance from primaryWallet if available
  const getWalletBalance = () => {
    if (isLoadingBalance) {
      return '...';
    }

    if (walletBalance !== null && walletBalance !== undefined && !isNaN(walletBalance)) {
      return `${Number(walletBalance).toFixed(2)} SOL`;
    }

    return '0.00 SOL';
  };
  
  // Show loading state while authenticating
  if (isAuthenticating) {
    return (
      <div className={`flex items-center space-x-3 text-white/70 ${className || ''}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Connecting...</span>
      </div>
    );
  }

  // Check if we have any user data (either from context or wallet)
  const hasUserData = isLoggedIn || contextUser || primaryWallet;

  if (!hasUserData) {
    return (
      <div className={`flex items-center space-x-3 text-white/50 ${className || ''}`}>
        <User className="w-4 h-4" />
        <span className="text-sm">Not connected</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`flex flex-col items-end space-y-2 ${className || ''}`}>
        {showBalances && (
          <div className="flex flex-col items-end space-y-1.5">
            <span className="text-xs text-cyan-400 font-mono font-semibold">
              {getWalletBalance()}
            </span>

            {/* Network Badge - Read-only from environment */}
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              isDevnet
                ? 'bg-yellow-500/20 text-yellow-300'
                : 'bg-green-500/20 text-green-300'
            }`}>
              {isDevnet ? 'Devnet' : 'Mainnet'}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* User Profile */}
      {user && (
        <div className="flex items-center space-x-3 p-3 bg-white/5 rounded-lg border border-white/10">
          <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
            {user.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt="Profile"
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <User className="w-6 h-6 text-white" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">
              {user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.email?.split('@')[0] || 'User'
              }
            </h3>
            {user.email && (
              <p className="text-sm text-gray-300">{user.email}</p>
            )}
            {user.createdAt && (
              <div className="flex items-center space-x-2 mt-1">
                <Badge className="bg-green-500/20 text-green-300 border-green-400/30">
                  Member since {new Date(user.createdAt).toLocaleDateString()}
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wallets */}
      {showWallets && wallets.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-300 flex items-center space-x-2">
            <Wallet className="w-4 h-4" />
            <span>Connected Wallets ({wallets.length})</span>
          </h4>
          <div className="space-y-2">
            {wallets.slice(0, 3).map((wallet: any) => (
              <div key={wallet.id || wallet.address} className="flex items-center justify-between p-2 bg-white/5 rounded border border-white/10">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded flex items-center justify-center">
                    <span className="text-xs text-white font-bold">
                      {wallet.walletClientType?.charAt(0).toUpperCase() || 'W'}
                    </span>
                  </div>
                  <span className="text-sm text-white">{wallet.walletClientType || 'Wallet'}</span>
                </div>
                <span className="text-xs text-gray-400 font-mono">
                  {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                </span>
              </div>
            ))}
            {wallets.length > 3 && (
              <div className="text-xs text-gray-400 text-center">
                +{wallets.length - 3} more wallets
              </div>
            )}
          </div>
        </div>
      )}

      {/* Activity Indicator */}
      {user?.updatedAt && (
        <div className="flex items-center space-x-2 text-xs text-gray-400">
          <Activity className="w-3 h-3" />
          <span>Last active: {new Date(user.updatedAt).toLocaleDateString()}</span>
        </div>
      )}
    </div>
  );
}
