/**
 * PNL Typography Scale (mobile) — "Moonlit Grove"
 *
 * Two type families, two jobs:
 *
 *   • SF Pro (system) — does 95% of the work. Faster, native, premium.
 *     Tight letter-spacing on display sizes is what gives it edge.
 *
 *   • Fraunces (italic + upright) — appears in three places only:
 *     1. § section markers (editorial.section)
 *     2. Empty-state mood lines (editorial.mood)
 *     3. Decorative numerals on profile stats (editorial.numeral)
 *
 * The earlier pass used Fraunces italic on every screen heading, which
 * read as "literary magazine" — wrong for thumb-scroll. Now Fraunces is
 * a punctuation mark, not a foundation.
 */

import { TextStyle } from 'react-native';

// Editorial accent fonts (loaded via useFonts in app/_layout.tsx)
const SERIF_ITALIC = 'Fraunces_400Regular_Italic';
const SERIF_UPRIGHT = 'Fraunces_400Regular';

export const typography: Record<string, TextStyle> = {
  // ─── Display & headings (system sans, tight tracking for character) ─
  display: { fontSize: 32, fontWeight: '700', letterSpacing: -0.5, lineHeight: 38 },
  heading: { fontSize: 22, fontWeight: '600', letterSpacing: -0.3, lineHeight: 28 },
  title: { fontSize: 18, fontWeight: '600', letterSpacing: -0.15, lineHeight: 24 },

  // ─── Body & captions (system sans, neutral tracking) ──────────────
  body: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  bodyBold: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  caption: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  captionBold: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  micro: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  tabLabel: { fontSize: 11, fontWeight: '600', lineHeight: 14, letterSpacing: 0.4 },

  // ─── Numerics (tabular sans, prices/amounts read at swipe speed) ───
  numeric: { fontSize: 16, fontWeight: '700', lineHeight: 22, fontVariant: ['tabular-nums'] },
  numericLarge: { fontSize: 28, fontWeight: '700', lineHeight: 34, fontVariant: ['tabular-nums'], letterSpacing: -0.3 },
  numericHero: { fontSize: 36, fontWeight: '800', lineHeight: 42, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
} as const;

/**
 * Editorial typography — Fraunces serif, ONLY for the three accent
 * contexts. Don't reach for these unless the surface is genuinely
 * editorial (not a routine title or button).
 */
export const editorial = {
  // § section markers on market detail / whitepaper-style surfaces.
  // Faint, italic, slightly tracked — like a typographer's pilcrow.
  section: {
    fontFamily: SERIF_ITALIC,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.05,
  } as TextStyle,

  // Empty-state mood lines, prose moments.
  // "The grove is bare. New ideas arrive daily."
  mood: {
    fontFamily: SERIF_ITALIC,
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: -0.1,
  } as TextStyle,

  // Decorative numerals on profile/stats — large, upright, amber-leaning.
  // Like the Roman numerals on the web whitepaper claims.
  numeral: {
    fontFamily: SERIF_UPRIGHT,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.5,
  } as TextStyle,
} as const;
