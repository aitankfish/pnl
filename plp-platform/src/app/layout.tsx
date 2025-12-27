import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '@/lib/wallet';
import { ToastProvider } from '@/lib/hooks/useToast';
import { NetworkProvider } from '@/contexts/NetworkContext';
import { SWRProvider } from '@/components/providers/SWRProvider';
import AppLayoutWrapper from '@/components/AppLayoutWrapper';
import { AuthModalProvider } from '@/contexts/AuthModalContext';
import { VoiceRoomProvider } from '@/lib/context/VoiceRoomContext';
import FloatingVoicePanel from '@/components/voice/FloatingVoicePanel';

const inter = Inter({ subsets: ['latin'] });

// Force dynamic rendering to avoid SSG issues with Privy
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'PNL',
  description: 'Idea Tokenization Platform powered by Prediction Markets. A new creative way of fundraising using crypto rails.',
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
          <AuthModalProvider>
            <NetworkProvider>
              <SWRProvider>
                <VoiceRoomProvider>
                <ToastProvider>
                <FloatingVoicePanel />
                <AppLayoutWrapper footer={
                <footer className="py-6 border-t border-white/5">
                  <div className="container px-4 sm:px-6">
                    <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
                      <p className="text-center text-sm leading-loose text-gray-400">
                        Let the Market Decide - Built on Solana
                      </p>

                      {/* Social Links */}
                      <div className="flex items-center gap-4">
                        <a
                          href="/whitepaper"
                          className="text-gray-400 hover:text-blue-400 transition-colors"
                          aria-label="Whitepaper"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M5 4a2 2 0 012-2h6l6 6v12a2 2 0 01-2 2H7a2 2 0 01-2-2V4zm7 0H7v16h10V9h-4a1 1 0 01-1-1V4zm3.586 4L13 5.414V8h2.586z" />
                          </svg>
                        </a>
                        <a
                          href="https://x.com/pnldotmarket"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-white transition-colors"
                          aria-label="X (Twitter)"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                          </svg>
                        </a>
                        <a
                          href="https://discord.gg/Ygknrrtn4"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-indigo-400 transition-colors"
                          aria-label="Discord"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
                          </svg>
                        </a>
                                              </div>

                      <p className="text-center text-sm text-gray-400">
                        © 2025 P&L Platform. All rights reserved.
                      </p>
                    </div>
                  </div>
                </footer>
              }>
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