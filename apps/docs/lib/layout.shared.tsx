import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

// Shared layout options for both the home page and the docs section.
// Branding, top-nav links, GitHub repo, etc.
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: 'P&L — Predict & Launch',
    url: '/',
  },
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
    {
      type: 'main',
      text: 'GitHub',
      url: 'https://github.com/aitankfish/pnl',
      external: true,
    },
  ],
  githubUrl: 'https://github.com/aitankfish/pnl',
};
