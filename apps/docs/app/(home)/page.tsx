'use client';

// Docs landing — book cover.
//
// Desktop (≥ 768px): cosmic 3D tree, same nav chrome as docs interior,
// only the yellow seed is clickable, leaves wiggle individually but the
// trunk is static, energy photons flow continuously root-to-sky. An "AI
// copy" pill in the top-right corner lets agent-tool users drop the
// protocol context into their chat without leaving the page.
//
// Mobile (< 768px): the WebGL scene crashes on most phones (50+ tube
// geometries + chromatic-aberration post-processing exceeds available
// GPU memory on common devices). The mobile path renders a bespoke
// MobileHero — still tree-mark, manifesto pull-quote, and the same two
// CTAs (Read docs / Copy for your AI tool).

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import MobileHero from './_components/MobileHero';
import AiCopyButton from './_components/AiCopyButton';

const CosmicTree3D = dynamic(
  () => import('./_components/CosmicTree3D'),
  { ssr: false },
);

// Single source of truth for the desktop/mobile breakpoint. Matches
// Tailwind's `md:` so any media-query-driven layout reads the same.
const MOBILE_BREAKPOINT = 768;

export default function HomePage() {
  const router = useRouter();

  // null = pre-hydration (we don't know yet). Render nothing to avoid
  // mounting the WebGL scene before we know if we're on mobile — that
  // costs hundreds of ms of geometry construction we'd immediately throw
  // away if it turned out to be a phone.
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    // Modern browsers expose addEventListener('change'); older Safari has addListener.
    if (mq.addEventListener) mq.addEventListener('change', update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', update);
      else mq.removeListener(update);
    };
  }, []);

  // First paint before hydration finishes — pure-CSS skeleton that picks
  // up the cosmic palette so the swap to either real surface is invisible.
  if (isMobile === null) {
    return (
      <main className="relative w-full h-[100dvh] overflow-hidden bg-[#0a0814]" />
    );
  }

  if (isMobile) {
    return <MobileHero />;
  }

  // Desktop — full cosmic scene with shared nav chrome.
  return (
    <HomeLayout
      {...baseOptions}
      nav={{ ...baseOptions.nav, transparentMode: 'top' }}
    >
      <main className="relative w-full h-[calc(100vh-3.5rem)] overflow-hidden bg-[#0a0814]">
        <CosmicTree3D
          markets={[]}
          skipIntro
          onSeedClick={() => router.push('/docs')}
        />
        {/* Discreet corner affordance — the AI-builder thesis lives in the
            manifesto; this is the in-product way to act on it without
            having to read first. */}
        <AiCopyButton variant="overlay" />
      </main>
    </HomeLayout>
  );
}
