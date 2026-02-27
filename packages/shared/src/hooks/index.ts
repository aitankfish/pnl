/**
 * Shared Hooks - Barrel Export
 * All hooks extracted from the web app for cross-platform use
 */

// Auth & Wallet
export { useWallet, useWalletAddress, useIsConnected } from './useWallet';
export type { WalletHookReturn } from './useWallet';
export { useHeadlessAuth, getErrorMessage } from './useHeadlessAuth';
export type { AuthStatus, AuthMethod, OAuthProvider, WalletType, AuthState } from './useHeadlessAuth';

// Data
export { useSolPrice } from './useSolPrice';
export { useUserProfile } from './useUserProfile';
export type { UserProfile } from './useUserProfile';
export { useNotifications } from './useNotifications';
export type { Notification } from './useNotifications';

// Markets
export { useMarkets, useMarket, useLaunchedMarkets, useMarketByAddress } from './useMarkets';
export type { Market, SyncHealth } from './useMarkets';
export { useMarketChart } from './useMarketChart';
export type { Timeframe } from './useMarketChart';

// Positions
export { usePositions, usePosition, useTransactionHistory, usePortfolioStats } from './usePositions';
export type { Position, PositionStats } from './usePositions';

// Transactions
export { useVoting } from './useVoting';
export type { VoteParams, VoteResult } from './useVoting';
export { useClaiming, setParseClaimAmount } from './useClaiming';
export { useResolution, setVanityKeypairGenerator } from './useResolution';
export { useExtend } from './useExtend';
export { useClose } from './useClose';
export { useTeamVesting } from './useTeamVesting';
export { useFounderSolVesting } from './useFounderSolVesting';
export { useCreatorFees } from './useCreatorFees';
export { usePlatformTokens } from './usePlatformTokens';
export { useEmergencyDrain } from './useEmergencyDrain';

// Token Balances
export { useAllTokenBalances } from './useAllTokenBalances';
export type { TokenBalance } from './useAllTokenBalances';
export { useTokenBalance } from './useTokenBalance';

// Real-time
export { useSocket, useMarketSocket, useAllMarketsSocket, useUserSocket } from './useSocket';
export { useChat } from './useChat';
export type { IChatMessage } from './useChat';

// Network
export { useNetwork } from './useNetwork';
export type { SolanaNetwork } from './useNetwork';
