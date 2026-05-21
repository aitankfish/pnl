import './global.css';
import { RootProvider } from 'fumadocs-ui/provider';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

const inter = Inter({
  subsets: ['latin'],
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
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
