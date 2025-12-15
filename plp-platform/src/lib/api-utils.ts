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
