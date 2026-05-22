import '@/lib/shared-init'; // Initialize @pnl/shared env config (must be first)
import type { Metadata } from 'next';
import { Inter, Caveat, Fraunces, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '@/lib/wallet';
import { ToastProvider } from '@/lib/hooks/useToast';
import { NetworkProvider } from '@/contexts/NetworkContext';
import { SWRProvider } from '@/components/providers/SWRProvider';
import AppLayoutWrapper from '@/components/AppLayoutWrapper';
import { AuthModalProvider } from '@/contexts/AuthModalContext';
import { DirectWalletProvider } from '@/contexts/DirectWalletContext';
import { VoiceRoomProvider } from '@/lib/context/VoiceRoomContext';
import FloatingVoicePanel from '@/components/voice/FloatingVoicePanel';
import AppFooter from '@/components/AppFooter';
import RouteTransition from '@/components/RouteTransition';

const inter = Inter({ subsets: ['latin'] });
const caveat = Caveat({ subsets: ['latin'], variable: '--font-caveat' });
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  axes: ['SOFT', 'WONK', 'opsz'],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

// Force dynamic rendering to avoid SSG issues with Privy
export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pnl.market';

export const metadata: Metadata = {
  // Required so Next.js resolves opengraph-image.tsx URLs as absolute
  // https://pnl.market/... rather than http://localhost:10000/... (the
  // bound port on Render). Without this, X / Discord / Slack scrapers
  // try to fetch localhost and the share card image renders blank.
  metadataBase: new URL(BASE_URL),
  title: 'PNL — Plant the idea, watch it grow',
  description: 'A conviction market for ideas. The community stakes YES or NO on what gets tokenized and launched on Solana.',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.png',
    apple: '/logo-512.png',
    shortcut: '/logo.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PNL',
  },
  // openGraph.images and twitter.images are intentionally absent — Next.js
  // auto-discovers opengraph-image.tsx files in the route tree (root,
  // /market/[id], /research/[id]) and wires the generated PNGs in as
  // og:image with the right size/type. Listing a URL here would shadow
  // those and force every share to the same generic card.
  openGraph: {
    title: 'PNL — Plant the idea, watch it grow',
    description: 'A conviction market for ideas. The community stakes YES or NO on what gets tokenized and launched on Solana.',
    url: BASE_URL,
    siteName: 'PNL',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PNL — Plant the idea, watch it grow',
    description: 'A conviction market for ideas. The community stakes YES or NO on what gets tokenized and launched on Solana.',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${fraunces.variable} ${jetbrainsMono.variable}`}>
      <body className={`${inter.className} min-h-screen bg-black text-white`}>
        <WalletProvider>
          <AuthModalProvider>
            <NetworkProvider>
              <SWRProvider>
                <VoiceRoomProvider>
                <ToastProvider>
                <FloatingVoicePanel />
                <RouteTransition />
                <AppLayoutWrapper footer={<AppFooter />}>
                {children}
                </AppLayoutWrapper>
                </ToastProvider>
                </VoiceRoomProvider>
              </SWRProvider>
            </NetworkProvider>
          </AuthModalProvider>
        </WalletProvider>
      </body>
    </html>
  );
}