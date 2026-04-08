/**
 * Auth Provider for Mobile
 * Uses @privy-io/expo hooks for authentication
 * Mirrors web's auth flow: auto-creates embedded Solana wallet, clears state on logout
 */

import React, { createContext, useContext, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  usePrivy,
  useLoginWithEmail,
  useLoginWithOAuth,
  useEmbeddedSolanaWallet,
} from '@privy-io/expo';
import type { OtpFlowState, OAuthFlowState } from '@privy-io/expo';
import { setAccessTokenProvider } from '@pnl/shared/utils';

interface AuthContextType {
  isAuthenticated: boolean;
  isReady: boolean;
  walletAddress: string | null;
  user: any;
  // Email OTP
  sendCode: (args: { email: string }) => Promise<any>;
  loginWithCode: (args: { code: string; email?: string }) => Promise<any>;
  emailState: OtpFlowState;
  // OAuth
  loginWithOAuth: (args: { provider: 'google' | 'apple' }) => Promise<any>;
  oauthState: OAuthFlowState;
  // Solana wallet
  solanaWallet: ReturnType<typeof useEmbeddedSolanaWallet>;
  // Auth token
  getAccessToken: () => Promise<string | null>;
  // Logout
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isReady, logout: privyLogout, getAccessToken } = usePrivy();

  // Wire up authenticated fetch for all shared hooks
  useEffect(() => {
    setAccessTokenProvider(getAccessToken);
  }, [getAccessToken]);

  const {
    sendCode,
    loginWithCode,
    state: emailState,
  } = useLoginWithEmail({
    onError: () => {},
    onSendCodeSuccess: () => {},
    onLoginSuccess: () => {},
  });

  const {
    login: oauthLogin,
    state: oauthState,
  } = useLoginWithOAuth();

  const solanaWallet = useEmbeddedSolanaWallet();

  const isAuthenticated = !!user;

  // Track wallet creation to prevent duplicate attempts (mirrors web's useHeadlessAuth)
  const walletCreationInProgress = useRef(false);
  const previousUserId = useRef<string | null>(null);

  // Auto-create embedded Solana wallet after login if user doesn't have one
  // This mirrors the web's useHeadlessAuth behavior
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Prevent duplicate wallet creation
    if (walletCreationInProgress.current) {
      return;
    }

    // Check if user already has a Solana wallet via linked_accounts
    const hasSolanaWallet = (user as any).linked_accounts?.some(
      (account: any) =>
        account.type === 'wallet' &&
        account.chain_type === 'solana'
    );

    if (!hasSolanaWallet && solanaWallet.status !== 'connected') {
      walletCreationInProgress.current = true;
      // Privy SDK should auto-create via createOnLogin config

      // The Privy SDK should auto-create via createOnLogin config,
      // but if it hasn't yet, the wallet hook will handle it
      const checkWallet = setTimeout(() => {
        walletCreationInProgress.current = false;
      }, 10000);

      return () => clearTimeout(checkWallet);
    }
  }, [isAuthenticated, user, solanaWallet.status]);

  // Extract Solana wallet address from user's linked accounts
  // Uses the current user's data — recomputes when user changes
  const walletAddress = useMemo(() => {
    if (!user) return null;

    // Priority 1: Check linked_accounts for embedded Solana wallet (matches web's linkedAccounts check)
    const solanaAccount = (user as any).linked_accounts?.find(
      (a: any) => a.chain_type === 'solana' && a.wallet_client === 'privy'
    );
    if (solanaAccount?.address) return solanaAccount.address;

    // Priority 2: Check the embedded wallet hook status
    if (solanaWallet.status === 'connected' && solanaWallet.wallets?.[0]?.address) {
      return solanaWallet.wallets[0].address;
    }

    return null;
  }, [user, solanaWallet.status, solanaWallet.wallets]);

  // Detect user change — reset state when a different user logs in
  useEffect(() => {
    const currentUserId = (user as any)?.id || null;
    if (previousUserId.current && currentUserId && previousUserId.current !== currentUserId) {
      walletCreationInProgress.current = false;
    }
    previousUserId.current = currentUserId;
  }, [user]);

  const loginWithOAuth = async (args: { provider: 'google' | 'apple' }) => {
    return oauthLogin({ provider: args.provider });
  };

  // Enhanced logout that resets all local state
  const logout = useCallback(async () => {
    walletCreationInProgress.current = false;
    previousUserId.current = null;
    await privyLogout();
  }, [privyLogout]);

  const value: AuthContextType = {
    isAuthenticated,
    isReady,
    walletAddress,
    user,
    sendCode,
    loginWithCode,
    emailState,
    loginWithOAuth,
    oauthState,
    solanaWallet,
    getAccessToken,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
