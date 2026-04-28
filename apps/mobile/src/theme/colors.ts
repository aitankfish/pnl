/**
 * PNL Color System — "Moonlit Grove" (mobile)
 *
 * Mental image: a cool deep night sky with a single warm amber lantern.
 * Three-role accent system avoids the "amber wash" failure mode of the
 * earlier warm-dark port:
 *
 *   • amber  → conviction (vote/trade CTAs, live signals, editorial)
 *   • cool   → everyday active (focused inputs, tab indicators, chips)
 *   • semantic green/red → outcomes only (yes/no, success/error)
 *
 * Backgrounds carry a 2% warm undertone so they read slightly organic
 * without flooding the eye like a true warm-dark would. Text is cool
 * cream — pulled toward warm just enough to register as "moonlight on
 * stone," not pure-white clinical.
 */

export const colors = {
  // ─── Backgrounds (cool dark, faint warm undertone) ────────────────
  background: '#0a0a0e',
  surface: '#13131a',
  surfaceElevated: '#1d1d26',
  surfaceHigh: '#272730', // hero cards, modal sheets

  // ─── Borders (cream hairlines on dark) ────────────────────────────
  border: 'rgba(237, 229, 214, 0.06)',
  borderStrong: 'rgba(237, 229, 214, 0.12)',
  borderActive: '#7898a8', // cool blue-gray, NOT amber — daily active state

  // ─── Text (moonlight cream — cool-leaning to balance OLED warmth) ──
  textPrimary: '#ebe6dc',
  textSecondary: '#9a948a',
  textMuted: '#5a554d',
  textInverse: '#0a0a0e', // for text on amber backgrounds

  // ─── Conviction accent — amber, used SPARINGLY ────────────────────
  // Reserved for: vote/trade CTAs, live signals, § section markers,
  // empty-state mood lines. NOT for default focus/active/borders.
  primary: '#e89660',
  primaryGlow: 'rgba(232, 150, 96, 0.18)',
  amberSoft: '#f0b889',  // hover/highlighted text on amber surface
  amberDeep: '#b8773d',  // pressed/active state on amber CTAs

  // ─── Daily-active accent — cool blue-gray ─────────────────────────
  // The everyday "selected/focused/current tab" color. Things 3's blue
  // to amber's yellow.
  accent: '#7898a8',
  accentGlow: 'rgba(120, 152, 168, 0.18)',

  // ─── Outcome semantics (desaturated — "moonlit foliage" not neon) ──
  success: '#7ac484',
  danger: '#d97070',
  warning: '#e0b366',

  // ─── Gradients (rare, hero moments only) ──────────────────────────
  gradientStart: '#0a0a0e',
  gradientEnd: '#1d1d26',
  gradientLanternStart: '#e89660', // amber CTA gradient
  gradientLanternEnd: '#b8773d',

  // ─── Glassmorphism ────────────────────────────────────────────────
  glass: 'rgba(19, 19, 26, 0.72)',
  glassBorder: 'rgba(237, 229, 214, 0.08)',

  // ─── Semantic tints (15% opacity for backgrounds) ─────────────────
  successLight: 'rgba(122, 196, 132, 0.15)',
  dangerLight: 'rgba(217, 112, 112, 0.15)',
  warningLight: 'rgba(224, 179, 102, 0.15)',

  // ─── Overlays & sheets ────────────────────────────────────────────
  overlay: 'rgba(0, 0, 0, 0.6)',
  sheetBackground: '#13131a',
  sheetHandle: 'rgba(237, 229, 214, 0.22)',

  // ─── Interaction (cream-tinted press feedback) ────────────────────
  pressedOverlay: 'rgba(237, 229, 214, 0.04)',
  hoverOverlay: 'rgba(237, 229, 214, 0.06)',

  // ─── Live / urgency ───────────────────────────────────────────────
  // livePulse stays amber: a live voice room IS conviction in motion.
  livePulse: '#e89660',
  urgentRed: '#d97070',
} as const;

export type ColorKey = keyof typeof colors;
