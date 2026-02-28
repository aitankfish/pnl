/**
 * PNL Cosmic Dark Color System
 */

export const colors = {
  // Backgrounds
  background: '#0a0e1a',
  surface: '#111827',
  surfaceElevated: '#1f2937',

  // Borders
  border: '#374151',
  borderActive: '#6366f1',

  // Text
  textPrimary: '#f9fafb',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',

  // Primary / Accent
  primary: '#818cf8',
  primaryGlow: 'rgba(129, 140, 248, 0.3)',
  accent: '#a78bfa',

  // Semantic
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',

  // Gradients
  gradientStart: '#6366f1',
  gradientEnd: '#8b5cf6',

  // Glassmorphism
  glass: 'rgba(17, 24, 39, 0.8)',
  glassBorder: 'rgba(99, 102, 241, 0.15)',

  // Semantic tints (15% opacity)
  successLight: 'rgba(16, 185, 129, 0.15)',
  dangerLight: 'rgba(239, 68, 68, 0.15)',
  warningLight: 'rgba(245, 158, 11, 0.15)',

  // Overlays & sheets
  overlay: 'rgba(0, 0, 0, 0.6)',
  sheetBackground: '#1a1f2e',
  sheetHandle: '#4b5563',

  // Interaction
  pressedOverlay: 'rgba(255, 255, 255, 0.05)',

  // Live / urgency
  livePulse: '#22c55e',
  urgentRed: '#dc2626',
} as const;

export type ColorKey = keyof typeof colors;
