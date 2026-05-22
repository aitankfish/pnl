// Order matters: fumadocs base styles first so our overrides in global.css win
// without specificity gymnastics. Importing the CSS file directly here (rather
// than via @import in global.css) bypasses PostCSS's @import-rejection behavior
// that was silently dropping the Fumadocs base layout rules — without them,
// #nd-docs-layout sidebar positioning collapsed and content stacked below.
import 'fumadocs-ui/style.css';
import './global.css';
import { RootProvider } from 'fumadocs-ui/provider';
import { Inter, Fraunces, JetBrains_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

// Inter for body — Fumadocs UI ships with utilitarian sans expectations and
// Inter is what their reset assumes. Keep it as the default so the chrome
// (sidebar, search, nav) stays readable.
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

// Fraunces — the editorial display serif used on pnl.market and the
// whitepaper. Variable font, large optical-size axis. Gives us the
// "almanac / botanical journal" feel that matches the brand voice.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  axes: ['SOFT', 'WONK', 'opsz'],
});

// JetBrains Mono for on-chain addresses and code samples. The Solana
// pubkeys deserve typographic precision.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

// Note: og:image is intentionally absent here — Next.js auto-discovers the
// route-local opengraph-image.tsx files (one at the root for the cover, one
// at /docs/[[...slug]] for per-MDX pages) and wires their generated PNGs in
// as og:image with the right size/type. Listing an image URL here would
// shadow that and force every share to the same generic card.
export const metadata = {
  title: {
    default: 'PNL Docs',
    template: '%s · PNL Docs',
  },
  description:
    'Idea tokenization on Solana. Anyone posts an idea; a conviction market of believers and critics decides with real SOL whether it launches as a token.',
  openGraph: {
    title: 'PNL Docs',
    description:
      'The launchpad where the crowd decides which ideas deserve to launch. Live on Solana mainnet.',
    url: 'https://docs.pnl.market',
    siteName: 'PNL',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PNL Docs',
    description:
      'Idea tokenization on Solana. A conviction market for what should be built next.',
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} ${inter.className}`}
      suppressHydrationWarning
    >
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
