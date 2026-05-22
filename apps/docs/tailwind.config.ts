import type { Config } from 'tailwindcss';
import { createPreset } from 'fumadocs-ui/tailwind-plugin';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './content/**/*.{md,mdx}',
    './node_modules/fumadocs-ui/dist/**/*.js',
  ],
  presets: [createPreset()],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Cosmic-plant brand palette — referenced as bg-amber-pnl, etc.
        // (Renamed from generic 'amber' to avoid clashing with Tailwind's
        // own amber-50..950 scale.)
        'pnl-amber': '#e89660',
        'pnl-peach': '#ecb48a',
        'pnl-forest': '#3f7a42',
        'pnl-earth': '#d67347',
        'pnl-night': '#0a0814',
        'pnl-cream': '#f4eee4',
      },
      animation: {
        'almanac-in': 'almanacIn 700ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      keyframes: {
        almanacIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
};

export default config;
