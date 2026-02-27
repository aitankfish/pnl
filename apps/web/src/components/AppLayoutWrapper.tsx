'use client';

import { usePathname } from 'next/navigation';
import AppLayout from './AppLayout';

interface AppLayoutWrapperProps {
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function AppLayoutWrapper({ children, footer }: AppLayoutWrapperProps) {
  const pathname = usePathname();

  // Hide navbar and footer on the landing page
  const isLandingPage = pathname === '/';

  // Map pathnames to page IDs for sidebar active state
  const getCurrentPage = (): string | undefined => {
    if (pathname === '/' || pathname === '/launchpad') return 'dashboard';
    if (pathname === '/create') return 'create';
    if (pathname === '/browse') return 'markets';
    if (pathname.startsWith('/market/')) return 'markets';
    if (pathname === '/launched') return 'launched';
    if (pathname === '/notifications') return 'notifications';
    if (pathname === '/wallet') return 'wallet';
    return undefined;
  };

  // If landing page, render children without AppLayout and footer
  if (isLandingPage) {
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppLayout currentPage={getCurrentPage()}>
        <main className="flex-1">
          {children}
        </main>
      </AppLayout>
      {footer}
    </div>
  );
}
