/**
 * Platform admin allow-list — client-safe (just public wallet pubkeys, no
 * secrets). Single source of truth shared by the server admin gate
 * (`withAdmin`) and client-side admin-only UI (e.g. the founder hide button).
 */

export const PLATFORM_ADMIN_WALLETS = [
  '7iyZKvd28ZcfVKUxeezwSkvdoQ9sN1D7pEGe42w8yTkZ', // Main admin
];

export function isPlatformAdmin(wallet?: string | null): boolean {
  return !!wallet && PLATFORM_ADMIN_WALLETS.includes(wallet);
}
