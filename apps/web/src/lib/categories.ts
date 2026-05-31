/**
 * Canonical project category taxonomy.
 *
 * Single source of truth for the create form (grouped dropdown), the browse
 * filter, and every place that renders a market's category label. Built from
 * the Colosseum Solana Frontier directory's 33 categories — how ~2,860 real
 * Solana projects self-classified — merged with three of our own the directory
 * lacks but that matter here: Meme, Creator, and Science (PNL is
 * research-paper-centric).
 *
 * Slugs for pre-existing options are kept stable so older markets' stored
 * category values stay consistent. Folded-away legacy labels (commerce,
 * realestate, energy, media, manufacturing, mobility) are no longer offered as
 * choices but still render nicely via LEGACY_CATEGORY_LABELS for any historical
 * market that used them.
 */

import type { DropdownGroup } from '@/components/Dropdown';

export const CATEGORY_GROUPS: DropdownGroup[] = [
  {
    label: 'AI & Data',
    options: [
      { value: 'ai', label: 'AI Platforms / Agents' },
      { value: 'ai-models', label: 'AI / ML Models' },
      { value: 'data', label: 'Data & Analytics' },
    ],
  },
  {
    label: 'Money & Markets',
    options: [
      { value: 'defi', label: 'DeFi' },
      { value: 'payments', label: 'Payments & Remittance' },
      { value: 'finance', label: 'FinTech' },
      { value: 'stablecoins', label: 'Stablecoins' },
      { value: 'exchanges', label: 'Markets & Exchanges' },
      { value: 'tokenomics', label: 'Token Launch / Tokenomics' },
    ],
  },
  {
    label: 'Infrastructure & Dev',
    options: [
      { value: 'infrastructure', label: 'Developer Infrastructure' },
      { value: 'wallet-infra', label: 'Wallet Infrastructure' },
      { value: 'security', label: 'Security Tools' },
      { value: 'staking', label: 'Validator & Staking Infra' },
      { value: 'bridges', label: 'Interoperability & Bridges' },
      { value: 'gaming-infra', label: 'Gaming Infrastructure' },
    ],
  },
  {
    label: 'Consumer & Social',
    options: [
      { value: 'consumer', label: 'Consumer Apps' },
      { value: 'social', label: 'Social / SocialFi' },
      { value: 'gaming', label: 'Gaming' },
      { value: 'marketplace', label: 'Marketplace Platforms' },
      { value: 'nft', label: 'NFTs & Digital Assets' },
      { value: 'creator', label: 'Creator' },
      { value: 'meme', label: 'Meme' },
    ],
  },
  {
    label: 'Real World & Enterprise',
    options: [
      { value: 'rwa', label: 'Real World Assets (RWA)' },
      { value: 'depin', label: 'DePIN' },
      { value: 'hardware', label: 'Hardware & Devices' },
      { value: 'iot', label: 'IoT / Edge Computing' },
      { value: 'healthcare', label: 'Healthcare Tech' },
      { value: 'climate', label: 'Climate / Green Tech' },
      { value: 'supply-chain', label: 'Supply Chain & Logistics' },
      { value: 'education', label: 'EdTech' },
      { value: 'enterprise', label: 'Enterprise SaaS' },
      { value: 'regtech', label: 'RegTech & Compliance' },
      { value: 'identity', label: 'Identity & Privacy' },
      { value: 'dao', label: 'Governance & DAOs' },
    ],
  },
  {
    label: 'Science & Research',
    options: [
      { value: 'science', label: 'Science' },
      { value: 'zk', label: 'ZK / Crypto Research' },
    ],
  },
  {
    label: 'Etc',
    options: [{ value: 'other', label: 'Other' }],
  },
];

// Labels for slugs that are no longer offered but may exist on older markets.
export const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  commerce: 'Commerce',
  realestate: 'Real Estate',
  'real estate': 'Real Estate',
  energy: 'Energy',
  media: 'Media',
  manufacturing: 'Manufacturing',
  mobility: 'Mobility',
};

// slug -> display label, current taxonomy first then legacy fallbacks.
export const CATEGORY_LABELS: Record<string, string> = (() => {
  const map: Record<string, string> = { ...LEGACY_CATEGORY_LABELS };
  for (const group of CATEGORY_GROUPS) {
    for (const opt of group.options) map[opt.value] = opt.label;
  }
  return map;
})();

// Acronyms / special casings the generic title-caser can't infer.
const ACRONYMS: Record<string, string> = {
  ai: 'AI',
  ml: 'ML',
  defi: 'DeFi',
  dao: 'DAO',
  nft: 'NFT',
  rwa: 'RWA',
  zk: 'ZK',
  iot: 'IoT',
  depin: 'DePIN',
  mvp: 'MVP',
};

/**
 * Render a stored category value (a slug) as a human label. Falls back to a
 * graceful title-case (hyphens/underscores → spaces, acronym fixups) for any
 * value not in the taxonomy.
 */
export function formatCategoryLabel(value: string | null | undefined): string {
  if (!value) return 'Other';
  const direct = CATEGORY_LABELS[value] ?? CATEGORY_LABELS[value.toLowerCase()];
  if (direct) return direct;
  return value
    .replace(/[-_]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => ACRONYMS[w.toLowerCase()] ?? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
