'use client';

import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
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
    if (pathname === '/merch') return 'merch';
    return undefined;
  };

  // If landing page, render children without AppLayout and footer.
  // The landing has its own intentional tree-grow + scroll story so it
  // skips the layout-level entry fade below.
  if (isLandingPage) {
    return <div className="min-h-screen">{children}</div>;
  }

  // Layout-level entry fade — wraps the layout + footer in one motion.div
  // that fades opacity 0 → 1 over ~350ms on mount. Covers the cold-load
  // popcorn effect from things like the starfield (200 stars populated in
  // useEffect after hydration), SWR data-fetch flicker on market lists,
  // and async wallet/auth hydration. Internal nav doesn't re-trigger
  // (Next App Router keeps the layout mounted across pages — only
  // children change); the cinematic RouteTransition handles that case.
  return (
    <motion.div
      className="min-h-screen flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <AppLayout currentPage={getCurrentPage()}>
        <main className="flex-1">
          {children}
        </main>
      </AppLayout>
      {footer}
    </motion.div>
  );
}
