'use client';

import { useReducer, useCallback, useEffect } from 'react';
import { usePrivy, useLoginWithEmail, useLoginWithOAuth, useConnectWallet } from '@privy-io/react-auth';
// import { useStandardWallets } from '@privy-io/react-auth/solana';

// Auth flow status types
export type AuthStatus =
  | 'idle'              // Auth method selection
  | 'email-input'       // Email entry
  | 'email-sending'     // Sending OTP
  | 'otp-input'         // OTP entry
  | 'otp-verifying'     // Verifying OTP
  | 'oauth-pending'     // OAuth in progress
  | 'wallet-selecting'  // Wallet selection
  | 'wallet-connecting' // Connecting wallet
  | 'success'           // Auth complete
  | 'error';            // Error state

export type AuthMethod = 'email' | 'oauth' | 'wallet' | null;
export type OAuthProvider = 'google' | 'twitter' | 'discord';
export type WalletType = 'phantom' | 'backpack' | 'solflare';

export interface AuthState {
  status: AuthStatus;
  method: AuthMethod;
  email?: string;
  provider?: OAuthProvider;
  walletType?: WalletType;
  error?: Error | null;
}

type AuthAction =
  | { type: 'SELECT_EMAIL' }
  | { type: 'SELECT_OAUTH'; provider: OAuthProvider }
  | { type: 'SELECT_WALLET' }
  | { type: 'SET_EMAIL'; email: string }
  | { type: 'SEND_CODE_START' }
  | { type: 'SEND_CODE_SUCCESS' }
  | { type: 'SEND_CODE_ERROR'; error: Error }
  | { type: 'VERIFY_CODE_START' }
  | { type: 'VERIFY_CODE_SUCCESS' }
  | { type: 'VERIFY_CODE_ERROR'; error: Error }
  | { type: 'OAUTH_START' }
  | { type: 'OAUTH_SUCCESS' }
  | { type: 'OAUTH_ERROR'; error: Error }
  | { type: 'SELECT_WALLET_TYPE'; walletType: WalletType }
  | { type: 'WALLET_CONNECT_START' }
  | { type: 'WALLET_CONNECT_SUCCESS' }
  | { type: 'WALLET_CONNECT_ERROR'; error: Error }
  | { type: 'GO_BACK' }
  | { type: 'RESET' }
  | { type: 'CLEAR_ERROR' };

const initialState: AuthState = {
  status: 'idle',
  method: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SELECT_EMAIL':
      return { ...state, status: 'email-input', method: 'email', error: null };

    case 'SELECT_OAUTH':
      return { ...state, status: 'oauth-pending', method: 'oauth', provider: action.provider, error: null };

    case 'SELECT_WALLET':
      return { ...state, status: 'wallet-selecting', method: 'wallet', error: null };

    case 'SET_EMAIL':
      return { ...state, email: action.email };

    case 'SEND_CODE_START':
      return { ...state, status: 'email-sending', error: null };

    case 'SEND_CODE_SUCCESS':
      return { ...state, status: 'otp-input' };

    case 'SEND_CODE_ERROR':
      return { ...state, status: 'email-input', error: action.error };

    case 'VERIFY_CODE_START':
      return { ...state, status: 'otp-verifying', error: null };

    case 'VERIFY_CODE_SUCCESS':
      return { ...state, status: 'success' };

    case 'VERIFY_CODE_ERROR':
      return { ...state, status: 'otp-input', error: action.error };

    case 'OAUTH_START':
      return { ...state, status: 'oauth-pending', error: null };

    case 'OAUTH_SUCCESS':
      return { ...state, status: 'success' };

    case 'OAUTH_ERROR':
      return { ...state, status: 'idle', error: action.error };

    case 'SELECT_WALLET_TYPE':
      return { ...state, status: 'wallet-connecting', walletType: action.walletType, error: null };

    case 'WALLET_CONNECT_START':
      return { ...state, status: 'wallet-connecting', error: null };

    case 'WALLET_CONNECT_SUCCESS':
      return { ...state, status: 'success' };

    case 'WALLET_CONNECT_ERROR':
      return { ...state, status: 'wallet-selecting', error: action.error };

    case 'GO_BACK':
      if (state.status === 'otp-input') return { ...state, status: 'email-input', error: null };
      if (state.status === 'email-input') return { status: 'idle', method: null };
      if (state.status === 'wallet-selecting') return { status: 'idle', method: null };
      if (state.status === 'wallet-connecting') return { ...state, status: 'wallet-selecting', error: null };
      if (state.status === 'error') return { status: 'idle', method: null };
      return state;

    case 'RESET':
      return initialState;

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    default:
      return state;
  }
}

// Error message mapping
const ERROR_MESSAGES: Record<string, string> = {
  'invalid_email': 'Please enter a valid email address',
  'rate_limited': 'Too many attempts. Please try again in a few minutes',
  'code_expired': 'Your code has expired. Please request a new one',
  'invalid_code': 'Invalid code. Please check and try again',
  'oauth_cancelled': 'Login was cancelled. Please try again',
  'oauth_popup_blocked': 'Popup was blocked. Please allow popups for this site',
  'wallet_not_found': 'Wallet not detected. Please install the wallet extension',
  'wallet_rejected': 'Connection rejected. Please try again',
  'unknown_error': 'Something went wrong. Please try again',
};

export function getErrorMessage(error: Error | null | undefined): string {
  if (!error) return ERROR_MESSAGES.unknown_error;
  const errorCode = (error as any)?.code || 'unknown_error';
  return ERROR_MESSAGES[errorCode] || error.message || ERROR_MESSAGES.unknown_error;
}

export function useHeadlessAuth() {
  const { authenticated, user, ready } = usePrivy();
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Email login hook
  const {
    sendCode,
    loginWithCode,
    state: emailState
  } = useLoginWithEmail({
    onComplete: () => {
      dispatch({ type: 'VERIFY_CODE_SUCCESS' });
    },
    onError: (error: unknown) => {
      dispatch({ type: 'VERIFY_CODE_ERROR', error: error instanceof Error ? error : new Error(String(error)) });
    },
  });

  // OAuth login hook
  const {
    initOAuth,
    state: oauthState
  } = useLoginWithOAuth({
    onComplete: () => {
      dispatch({ type: 'OAUTH_SUCCESS' });
    },
    onError: (error: unknown) => {
      dispatch({ type: 'OAUTH_ERROR', error: error instanceof Error ? error : new Error(String(error)) });
    },
  });

  // Wallet connection hooks
  const { connectWallet } = useConnectWallet({
    onSuccess: () => {
      dispatch({ type: 'WALLET_CONNECT_SUCCESS' });
    },
    onError: (error: unknown) => {
      dispatch({ type: 'WALLET_CONNECT_ERROR', error: error instanceof Error ? error : new Error(String(error)) });
    },
  });
  // const { wallets: solanaWallets } = useStandardWallets();
  const solanaWallets: any[] = []; // Temporary placeholder

  // Sync email state with reducer
  useEffect(() => {
    if (emailState.status === 'sending-code' && state.status !== 'email-sending') {
      dispatch({ type: 'SEND_CODE_START' });
    } else if (emailState.status === 'awaiting-code-input' && state.status === 'email-sending') {
      dispatch({ type: 'SEND_CODE_SUCCESS' });
    } else if (emailState.status === 'submitting-code' && state.status !== 'otp-verifying') {
      dispatch({ type: 'VERIFY_CODE_START' });
    }
  }, [emailState.status, state.status]);

  // Handle email selection
  const selectEmail = useCallback(() => {
    dispatch({ type: 'SELECT_EMAIL' });
  }, []);

  // Handle OAuth selection
  const selectOAuth = useCallback((provider: OAuthProvider) => {
    dispatch({ type: 'SELECT_OAUTH', provider });
  }, []);

  // Handle wallet selection - show wallet list
  const selectWallet = useCallback(() => {
    dispatch({ type: 'SELECT_WALLET' });
  }, []);

  // Send email OTP code
  const handleSendCode = useCallback(async (email: string) => {
    dispatch({ type: 'SET_EMAIL', email });
    dispatch({ type: 'SEND_CODE_START' });
    try {
      await sendCode({ email });
    } catch (error) {
      dispatch({ type: 'SEND_CODE_ERROR', error: error as Error });
    }
  }, [sendCode]);

  // Verify OTP code
  const handleVerifyCode = useCallback(async (code: string) => {
    dispatch({ type: 'VERIFY_CODE_START' });
    try {
      await loginWithCode({ code });
    } catch (error) {
      dispatch({ type: 'VERIFY_CODE_ERROR', error: error as Error });
    }
  }, [loginWithCode]);

  // Initiate OAuth flow
  const handleOAuth = useCallback(async (provider: OAuthProvider) => {
    dispatch({ type: 'SELECT_OAUTH', provider });
    try {
      await initOAuth({ provider });
    } catch (error) {
      dispatch({ type: 'OAUTH_ERROR', error: error as Error });
    }
  }, [initOAuth]);

  // Connect wallet - opens Privy's wallet connection modal
  const handleConnectWallet = useCallback(async (walletType: WalletType) => {
    dispatch({ type: 'SELECT_WALLET_TYPE', walletType });
    try {
      // Privy handles wallet selection in its modal
      // The walletType is dispatched to track which wallet the user clicked
      connectWallet();
    } catch (error) {
      dispatch({ type: 'WALLET_CONNECT_ERROR', error: error as Error });
    }
  }, [connectWallet]);

  // Go back one step
  const goBack = useCallback(() => {
    dispatch({ type: 'GO_BACK' });
  }, []);

  // Reset to initial state
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  return {
    // State
    state,
    authenticated,
    user,
    ready,

    // Actions
    selectEmail,
    selectOAuth,
    selectWallet,
    handleSendCode,
    handleVerifyCode,
    handleOAuth,
    handleConnectWallet,
    goBack,
    reset,
    clearError,

    // Raw states for debugging
    emailState,
    oauthState,
    solanaWallets,
  };
}
