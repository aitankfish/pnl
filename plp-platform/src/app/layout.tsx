import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '@/lib/wallet';
import { ToastProvider } from '@/lib/hooks/useToast';
import { NetworkProvider } from '@/contexts/NetworkContext';
import AppLayoutWrapper from '@/components/AppLayoutWrapper';

const inter = Inter({ subsets: ['latin'] });

// Force dynamic rendering to avoid SSG issues with Privy
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'P&L - Predict and Launch',
  description: 'Community-driven token launch platform powered by prediction markets',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
    shortcut: '/logo.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'P&L',
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
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-black text-white`}>
        <WalletProvider>
          <NetworkProvider>
            <ToastProvider>
              <AppLayoutWrapper>
                <div className="min-h-screen flex flex-col">
                  {/* Main Content */}
                  <main className="flex-1">
                    {children}
                  </main>

                  {/* Footer */}
                  <footer className="py-6">
                    <div className="container px-4 sm:px-6">
                      <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-6">
                        <p className="text-center text-sm leading-loose text-gray-400">
                          Let the Market Decide - Built on Solana
                        </p>
                        <p className="text-center text-sm text-gray-400">
                          © 2025 P&L Platform. All rights reserved.
                        </p>
                      </div>
                    </div>
                  </footer>
                </div>
              </AppLayoutWrapper>
            </ToastProvider>
          </NetworkProvider>
        </WalletProvider>
      </body>
    </html>
  );
}