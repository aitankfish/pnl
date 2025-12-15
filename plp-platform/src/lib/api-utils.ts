/**
 * Shared API Utilities
 * Common functions used across API routes
 */

// Staleness threshold in milliseconds (2 minutes)
const STALENESS_THRESHOLD_MS = 2 * 60 * 1000;

/**
 * Check if market data is stale based on last sync time
 */
export function isMarketDataStale(lastSyncedAt: Date | null | undefined): boolean {
  if (!lastSyncedAt) return true; // No sync data = consider stale
  const now = Date.now();
  const lastSync = new Date(lastSyncedAt).getTime();
  return (now - lastSync) > STALENESS_THRESHOLD_MS;
}

/**
 * Convert IPFS URL to gateway URL for image display
 */
export function convertToGatewayUrl(imageUrl: string | undefined): string | undefined {
  if (!imageUrl) return undefined;

  const gatewayUrl = process.env.PINATA_GATEWAY_URL || process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL;
  if (!gatewayUrl) return imageUrl.startsWith('http') ? imageUrl : undefined;

  // If it's an IPFS URL (ipfs://...), convert to gateway URL
  if (imageUrl.startsWith('ipfs://')) {
    const ipfsHash = imageUrl.replace('ipfs://', '');
    return `https://${gatewayUrl}/ipfs/${ipfsHash}`;
  }

  // If it's already a full URL, keep it as is
  if (imageUrl.startsWith('http')) {
    return imageUrl;
  }

  // If it's just a hash (bafyXXX or QmXXX), add gateway
  return `https://${gatewayUrl}/ipfs/${imageUrl}`;
}

/**
 * Format project/market age as human-readable string
 */
export function formatProjectAge(createdAt: Date | string): string {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const diffMs = now - created;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else {
    return `${diffDays}d ago`;
  }
}

/**
 * Truncate wallet address for display (e.g., "ABC1...XYZ4")
 */
export function truncateWallet(wallet: string): string {
  if (!wallet || wallet.length < 10) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

/**
 * Format time remaining as human-readable string
 */
export function formatTimeRemaining(expiryTime: Date | string | number): string {
  const now = Date.now();
  const expiry = typeof expiryTime === 'number'
    ? expiryTime * 1000 // Convert seconds to ms if needed
    : new Date(expiryTime).getTime();

  const timeLeftMs = expiry - now;

  if (timeLeftMs <= 0) {
    return 'Ended';
  }

  const days = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeftMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Calculate percentage with safety for division by zero
 */
export function safePercentage(numerator: number | bigint, denominator: number | bigint): number {
  const num = typeof numerator === 'bigint' ? Number(numerator) : numerator;
  const den = typeof denominator === 'bigint' ? Number(denominator) : denominator;

  if (den === 0) return 50; // Default to 50/50 if no data
  return Math.round((num / den) * 100);
}

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: string | number | bigint): number {
  const value = typeof lamports === 'string' ? BigInt(lamports) : BigInt(lamports);
  return Number(value) / 1_000_000_000;
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): bigint {
  return BigInt(Math.floor(sol * 1_000_000_000));
}

/**
 * Create a standardized API success response
 */
export function apiSuccess<T>(data: T, status = 200) {
  return { success: true, data, status };
}

/**
 * Create a standardized API error response
 */
export function apiError(message: string, status = 400) {
  return { success: false, error: message, status };
}

/**
 * Parse and validate pagination params from URL
 */
export function getPaginationParams(
  searchParams: URLSearchParams,
  defaults = { page: 1, limit: 20, maxLimit: 100 }
): { page: number; limit: number; skip: number } {
  const page = Math.max(1, parseInt(searchParams.get('page') || String(defaults.page)));
  const limit = Math.min(
    defaults.maxLimit,
    Math.max(1, parseInt(searchParams.get('limit') || String(defaults.limit)))
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Generate cache control headers for API responses
 */
export function getCacheHeaders(maxAge: number = 60, staleWhileRevalidate: number = 120) {
  return {
    'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
  };
}

/**
 * Market status calculation input
 */
export interface MarketStatusInput {
  resolution?: string;
  phase?: number;
  poolProgressPercentage?: number;
  expiryTime: Date | string;
  tokenMint?: string | null;
  pumpFunTokenAddress?: string | null;
}

/**
 * Market display status result
 */
export interface MarketDisplayStatus {
  displayStatus: string;
  badgeClass: string;
  isExpired: boolean;
  hasTokenLaunched: boolean;
}

/**
 * Vote button states result
 */
export interface VoteButtonStates {
  isYesVoteEnabled: boolean;
  isNoVoteEnabled: boolean;
  yesVoteDisabledReason: string;
  noVoteDisabledReason: string;
}

/**
 * Calculate market display status (single source of truth)
 * Used by both list and detail APIs
 */
export function getMarketDisplayStatus(market: MarketStatusInput): MarketDisplayStatus {
  const now = new Date();
  const expiryTime = new Date(market.expiryTime);
  const resolution = market.resolution || 'Unresolved';
  const phase = market.phase ?? 0;
  const poolProgressPercentage = market.poolProgressPercentage || 0;
  const isExpired = now.getTime() > expiryTime.getTime();
  const hasTokenLaunched = !!(market.tokenMint || market.pumpFunTokenAddress);

  let displayStatus = '✅ Active';
  let badgeClass = 'bg-green-500/20 text-green-300 border-green-400/30';

  // Resolved states
  if (resolution === 'YesWins') {
    if (hasTokenLaunched) {
      displayStatus = '🚀 Token Launched';
      badgeClass = 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30';
    } else if (phase === 1) {
      displayStatus = '💰 Funding Phase';
      badgeClass = 'bg-purple-500/20 text-purple-300 border-purple-400/30';
    } else {
      displayStatus = '🎉 YES Wins';
      badgeClass = 'bg-green-500/20 text-green-300 border-green-400/30';
    }
  } else if (resolution === 'NoWins') {
    displayStatus = '❌ NO Wins';
    badgeClass = 'bg-red-500/20 text-red-300 border-red-400/30';
  } else if (resolution === 'Refund') {
    displayStatus = '↩️ Refund';
    badgeClass = 'bg-yellow-500/20 text-yellow-300 border-yellow-400/30';
  } else if (resolution === 'Unresolved') {
    if (isExpired) {
      displayStatus = '⏳ Awaiting Resolution';
      badgeClass = 'bg-orange-500/20 text-orange-300 border-orange-400/30';
    } else if (phase === 1) {
      displayStatus = '💰 Funding Phase';
      badgeClass = 'bg-purple-500/20 text-purple-300 border-purple-400/30';
    } else if (poolProgressPercentage >= 100) {
      displayStatus = '🎯 Pool Complete';
      badgeClass = 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30';
    }
  }

  return { displayStatus, badgeClass, isExpired, hasTokenLaunched };
}

/**
 * Calculate vote button states (single source of truth)
 * Used by both list and detail APIs
 */
export function getVoteButtonStates(market: MarketStatusInput): VoteButtonStates {
  const { isExpired, hasTokenLaunched } = getMarketDisplayStatus(market);
  const resolution = market.resolution || 'Unresolved';
  const phase = market.phase ?? 0;
  const poolProgressPercentage = market.poolProgressPercentage || 0;

  let isYesVoteEnabled = true;
  let isNoVoteEnabled = true;
  let yesVoteDisabledReason = '';
  let noVoteDisabledReason = '';

  if (hasTokenLaunched) {
    isYesVoteEnabled = false;
    isNoVoteEnabled = false;
    yesVoteDisabledReason = '🚀 Token Launched';
    noVoteDisabledReason = '🚀 Token Launched';
  } else if (isExpired) {
    isYesVoteEnabled = false;
    isNoVoteEnabled = false;
    yesVoteDisabledReason = '⏰ Market Expired';
    noVoteDisabledReason = '⏰ Market Expired';
  } else if (resolution === 'NoWins') {
    isYesVoteEnabled = false;
    isNoVoteEnabled = false;
    yesVoteDisabledReason = 'NO Won';
    noVoteDisabledReason = 'NO Won';
  } else if (resolution === 'Refund') {
    isYesVoteEnabled = false;
    isNoVoteEnabled = false;
    yesVoteDisabledReason = 'Refunded';
    noVoteDisabledReason = 'Refunded';
  } else if (resolution === 'YesWins') {
    if (phase === 0) {
      isYesVoteEnabled = false;
      isNoVoteEnabled = false;
      yesVoteDisabledReason = 'Awaiting Extension';
      noVoteDisabledReason = 'Awaiting Extension';
    } else if (phase === 1) {
      isYesVoteEnabled = true;
      isNoVoteEnabled = false;
      noVoteDisabledReason = 'YES Locked';
    }
  } else if (resolution === 'Unresolved') {
    if (phase === 1) {
      isYesVoteEnabled = true;
      isNoVoteEnabled = false;
      noVoteDisabledReason = 'YES Locked';
    } else if (phase === 0 && poolProgressPercentage >= 100) {
      isYesVoteEnabled = false;
      isNoVoteEnabled = false;
      yesVoteDisabledReason = 'Pool Complete';
      noVoteDisabledReason = 'Pool Complete';
    }
  }

  return { isYesVoteEnabled, isNoVoteEnabled, yesVoteDisabledReason, noVoteDisabledReason };
}
