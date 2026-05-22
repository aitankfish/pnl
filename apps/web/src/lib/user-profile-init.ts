// ─── Cosmic profile init ─────────────────────────────────────────
//
// Shared logic for auto-creating a user profile when an unfamiliar
// wallet posts its first market. The browser flow has been doing this
// inline in page.tsx since launch; the MCP / external-pitch flow needs
// the same behavior (otherwise the market detail page shows a bare
// wallet address instead of a friendly Cosmic name).
//
// Generates a random {adjective}{noun}{0-999} username and picks a
// cosmic-avatar SVG. Same word lists as the page.tsx implementation
// so the two surfaces stay visually consistent.

import { connectToDatabase, UserProfile } from './mongodb';

const ADJECTIVES = [
  'Cosmic', 'Stellar', 'Lunar', 'Solar', 'Astral',
  'Nebula', 'Galactic', 'Celestial', 'Orbit', 'Quantum',
] as const;

const NOUNS = [
  'Explorer', 'Voyager', 'Pioneer', 'Wanderer', 'Navigator',
  'Traveler', 'Seeker', 'Dreamer', 'Rider', 'Hunter',
] as const;

const COSMIC_AVATARS = [
  '/cosmic-avatars/nebula.svg',
  '/cosmic-avatars/galaxy.svg',
  '/cosmic-avatars/pulsar.svg',
  '/cosmic-avatars/blackhole.svg',
  '/cosmic-avatars/supernova.svg',
  '/cosmic-avatars/quasar.svg',
  '/cosmic-avatars/moonphase.svg',
  '/cosmic-avatars/starcluster.svg',
  '/cosmic-avatars/comet.svg',
] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a fresh Cosmic name + avatar pair. Same shape as the
 * browser-side onboarding in apps/web/src/app/page.tsx — kept here so
 * server-side flows (MCP draft completion, future webhook integrations)
 * produce identical-looking identities.
 */
export function generateCosmicProfile(): { username: string; profilePhotoUrl: string } {
  const randomNum = Math.floor(Math.random() * 1000);
  const username = `${pick(ADJECTIVES)}${pick(NOUNS)}${randomNum}`;
  const profilePhotoUrl = pick(COSMIC_AVATARS);
  return { username, profilePhotoUrl };
}

export interface EnsureProfileOptions {
  /** Optional Privy / OAuth email if known. Omitted for MCP-onboarded users. */
  email?: string;
  /** Where the profile is being created from. Useful for analytics. */
  source?: 'web' | 'mcp' | 'api';
}

/**
 * Idempotent profile creation. Returns the existing profile for the
 * wallet if there is one, otherwise creates a new Cosmic-named one
 * and returns it. Safe to call from any flow that touches a wallet
 * address for the first time (market creation, voting, etc.).
 *
 * Handles the race condition where two concurrent first-touch flows
 * both pass the existence check and try to create — the unique
 * index on walletAddress catches the second, we just re-fetch.
 */
export async function ensureUserProfile(
  walletAddress: string,
  opts: EnsureProfileOptions = {},
) {
  if (!walletAddress) {
    throw new Error('ensureUserProfile: walletAddress is required');
  }
  await connectToDatabase();

  const existing = await UserProfile.findOne({ walletAddress });
  if (existing) return existing;

  const { username, profilePhotoUrl } = generateCosmicProfile();
  try {
    return await UserProfile.create({
      walletAddress,
      email: opts.email,
      username,
      profilePhotoUrl,
    });
  } catch (e) {
    // Race condition: another request created the profile between our
    // findOne and create. The unique index on walletAddress threw
    // E11000. Re-fetch and return that profile.
    const code = (e as { code?: number })?.code;
    if (code === 11000) {
      const winner = await UserProfile.findOne({ walletAddress });
      if (winner) return winner;
    }
    throw e;
  }
}
