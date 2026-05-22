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

export const metadata = {
  title: {
    default: 'P&L — Predict & Launch',
    template: '%s · P&L Docs',
  },
  description:
    'Idea tokenization on Solana. Anyone posts an idea; a conviction market of believers and critics decides with real SOL whether it launches as a token.',
  openGraph: {
    title: 'P&L — Predict & Launch',
    description:
      'The launchpad where the crowd decides which ideas deserve to launch. Live on Solana mainnet.',
    url: 'https://docs.pnl.market',
    siteName: 'P&L Docs',
    images: ['https://pnl.market/api/og'],
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
