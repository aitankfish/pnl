'use client';

// Docs landing — book cover.
//
// Same top navbar strip as the docs interior (tree mark left + Search /
// theme toggle / GitHub right), overlaid on the cosmic tree scene.
// The body of the page is just the tree. Clicking the yellow seed at
// the base of the trunk enters /docs.

import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';

const CosmicTree3D = dynamic(
  () => import('./_components/CosmicTree3D'),
  { ssr: false },
);

export default function HomePage() {
  const router = useRouter();

  return (
    // HomeLayout gives us the same nav chrome as the docs interior.
    // We extend baseOptions with `nav.transparentMode: 'top'` so the
    // bar is transparent at scroll-top, letting the cosmic tree scene
    // show through behind it.
    <HomeLayout
      {...baseOptions}
      nav={{ ...baseOptions.nav, transparentMode: 'top' }}
    >
      <main className="relative w-full h-[calc(100vh-3.5rem)] overflow-hidden bg-[#0a0814]">
        {/* The 3D tree. CosmicTree3D positions itself absolute inset-0.
            skipIntro renders it fully grown immediately. The seed at the
            base is the only interactive element. */}
        <CosmicTree3D
          markets={[]}
          skipIntro
          onSeedClick={() => router.push('/docs')}
        />
      </main>
    </HomeLayout>
  );
}
