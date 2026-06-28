/**
 * PNL cosmic palette — the single source of truth for the brand colours.
 *
 * These were previously redeclared inline in ~75 components and had drifted
 * (HAIR alone shipped with three different alphas). Import from here instead of
 * re-declaring `const CREAM = …`. The exact same values are mirrored as CSS
 * variables in `globals.css` and as Tailwind tokens (cream / ember / cosmic /
 * forest / earth / hair / signal-*) in `tailwind.config.js`, so both the
 * inline-style usage and class-based usage point at one place.
 *
 * Canonical values = the most common definition found in the codebase.
 */

export const CREAM = '#f4eee4';
export const CREAM_DIM = 'rgba(244,238,228,0.65)';
export const CREAM_FAINT = 'rgba(244,238,228,0.4)';
export const HAIR = 'rgba(244,238,228,0.08)';
export const HAIR_STRONG = 'rgba(244,238,228,0.16)';
export const AMBER = '#e89660';
export const PEACH = '#ecb48a';
export const BG = '#0a0814';
export const FOREST = '#3f7a42';
export const EARTH = '#d67347';
export const SIGNAL_GREEN = '#5fbf8f';
export const SIGNAL_RED = '#cf7a6f';

export const palette = {
  CREAM,
  CREAM_DIM,
  CREAM_FAINT,
  HAIR,
  HAIR_STRONG,
  AMBER,
  PEACH,
  BG,
  FOREST,
  EARTH,
  SIGNAL_GREEN,
  SIGNAL_RED,
} as const;

export type Palette = typeof palette;
