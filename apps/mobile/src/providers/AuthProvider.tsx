/**
 * Auth Provider for Mobile
 * Uses @privy-io/expo hooks for authentication
 */

import React, { createContext, useContext, useMemo } from 'react';
import {
  usePrivy,
  useLoginWithEmail,
  useLoginWithOAuth,
  useEmbeddedSolanaWallet,
} from '@privy-io/expo';
import type { OtpFlowState, OAuthFlowState } from '@privy-io/expo';

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
  // Logout
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isReady, logout } = usePrivy();

  const {
    sendCode,
    loginWithCode,
    state: emailState,
  } = useLoginWithEmail({
    onError: (error) => {
      console.error('[Privy Email OTP Error]', error?.message || error);
    },
    onSendCodeSuccess: ({ email }) => {
      console.log('[Privy] OTP code sent to:', email);
    },
    onLoginSuccess: (user, isNewUser) => {
      console.log('[Privy] Login success, new user:', isNewUser);
    },
  });

  const {
    login: oauthLogin,
    state: oauthState,
  } = useLoginWithOAuth();

  const solanaWallet = useEmbeddedSolanaWallet();

  const isAuthenticated = !!user;

  // Extract Solana wallet address from user's linked accounts
  const walletAddress = useMemo(() => {
    if (!user) return null;
    const solanaAccount = (user as any).linked_accounts?.find(
      (a: any) => a.chain_type === 'solana' && a.wallet_client === 'privy'
    );
    return solanaAccount?.address || null;
  }, [user]);

  const loginWithOAuth = async (args: { provider: 'google' | 'apple' }) => {
    return oauthLogin({ provider: args.provider });
  };

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
