import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

// ─── The grown tree mark ──────────────────────────────────────────────
// The only branding element in the site chrome — renders in the top
// navbar via `nav.title`. Fumadocs's title accepts a React node, so we
// pass the SVG directly. `currentColor` keeps it in sync with text
// (cream in dark mode, deep-night in light mode).
//
// Form: small grown tree with rounded canopy, slim trunk, hint of roots.
// Deliberately abstract — not memecoin "🌱" emoji energy, not Lucide
// generic-tree icon either. Drawn at viewbox 24, displays at 22px so it
// sits cleanly next to the navbar links.
function TreeMark() {
  return (
    <span
      aria-label="Home"
      className="inline-flex items-center justify-center text-[#e89660]
                 transition-transform hover:scale-105"
    >
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* canopy */}
        <path d="M12 3c-3.6 0-6.2 2.5-6.2 5.7 0 1.3.5 2.5 1.4 3.4-1.4.5-2.3 1.6-2.3 2.9 0 1.7 1.6 2.9 3.7 2.9h7c2.1 0 3.6-1.2 3.6-2.9 0-1.3-.9-2.4-2.3-2.9.9-.9 1.4-2.1 1.4-3.4C18.3 5.5 15.6 3 12 3Z" />
        {/* trunk */}
        <path d="M12 18.9V22" />
        {/* roots, very subtle outward sprawl */}
        <path d="M9.8 22h4.4" />
      </svg>
    </span>
  );
}

// Shared layout options for both the home page and the docs section.
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: <TreeMark />,
    url: '/',
  },
  // 'GitHub' as a named text link was dropped — the githubUrl below
  // renders the official octocat icon in the same nav, and having both
  // surfaces was redundant.
  links: [
    {
      type: 'main',
      text: 'Docs',
      url: '/docs',
    },
    {
      type: 'main',
      text: 'Live site',
      url: 'https://pnl.market',
      external: true,
    },
  ],
  githubUrl: 'https://github.com/aitankfish/pnl',
};
