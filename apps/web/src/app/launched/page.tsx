'use client';

import React, { useState } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { LaunchedTable } from '@/components/LaunchedTable';
import { BloomIcon, SeedIcon } from '@/components/PlantIcons';
import { Dropdown, DropdownOption } from '@/components/Dropdown';

// ── Cosmic-plant palette ──
const BG = '#0a0814';
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const PEACH = '#ecb48a';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

// Fetcher
const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface LaunchedToken {
  id: string;
  marketAddress: string;
  name: string;
  symbol: string;
  description: string;
  category: string;
  stage?: string;
  projectType?: string;
  launchDate: string;
  tokenAddress: string;
  projectImageUrl?: string;
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  yesPercentage: number;
  launchPool: string;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  discord?: string | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

// Single label map — colors come from the cosmic palette uniformly so
// every chip reads as part of the same family. The old per-category
// rainbow palette was visual noise.
const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  defi: 'DeFi',
  nft: 'NFT',
  gaming: 'Gaming',
  dao: 'DAO',
  ai: 'AI/ML',
  infrastructure: 'Infra',
  social: 'Social',
  meme: 'Meme',
  creator: 'Creator',
  healthcare: 'Healthcare',
  science: 'Science',
  education: 'Education',
  finance: 'Finance',
  commerce: 'Commerce',
  realestate: 'Real Estate',
  energy: 'Energy',
  media: 'Media',
  manufacturing: 'Manufacturing',
  mobility: 'Mobility',
  other: 'Other',
};

const PER_PAGE_OPTIONS: DropdownOption[] = [
  { value: '25', label: '25 per page' },
  { value: '50', label: '50 per page' },
  { value: '100', label: '100 per page' },
];

export default function LaunchedPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [refreshKey, setRefreshKey] = useState(0);

  const apiUrl = `/api/markets/launched?page=${page}&limit=${itemsPerPage}${
    selectedCategory !== 'all' ? `&category=${selectedCategory}` : ''
  }`;

  const { data, error, isLoading, mutate } = useSWR(apiUrl, fetcher, {
    refreshInterval: 60000,
    keepPreviousData: true,
  });

  const launchedTokens: LaunchedToken[] = data?.data?.launched || [];
  const totalCount: number = data?.data?.total || 0;
  const pagination: PaginationInfo = data?.data?.pagination || {
    page: 1,
    limit: 25,
    totalPages: 1,
    hasMore: false,
  };

  const { data: allData } = useSWR('/api/markets/launched?limit=1000', fetcher, {
    refreshInterval: 120000,
  });
  const allTokens: LaunchedToken[] = allData?.data?.launched || [];

  const getCategoryCount = (category: string) => {
    if (category === 'all') return allData?.data?.total || totalCount;
    if (category === 'other') {
      return allTokens.filter((t) => {
        const cat = t.category?.toLowerCase() || 'other';
        return !CATEGORY_LABELS[cat] || cat === 'other';
      }).length;
    }
    return allTokens.filter((t) => (t.category?.toLowerCase() || 'other') === category).length;
  };

  const availableCategories = (() => {
    if (allTokens.length === 0) return ['all'];
    const set = new Set<string>();
    allTokens.forEach((t) => {
      const cat = t.category?.toLowerCase() || 'other';
      if (CATEGORY_LABELS[cat]) set.add(cat);
      else set.add('other');
    });
    return ['all', ...Array.from(set)];
  })();

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setPage(1);
  };
  const handleItemsPerPageChange = (newLimit: number) => {
    setItemsPerPage(newLimit);
    setPage(1);
  };

  const startItem = (page - 1) * itemsPerPage + 1;
  const endItem = Math.min(page * itemsPerPage, totalCount);

  return (
    <div className="px-4 sm:px-6 pb-20" style={{ color: CREAM }}>
      <div className="max-w-7xl mx-auto pt-6 sm:pt-10">
        {/* ─── Editorial header ─── */}
        <header className="mb-8 sm:mb-10">
          <p
            className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-2"
            style={{ color: AMBER }}
          >
            The orchard
          </p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <h1
              className="leading-[1.05]"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontWeight: 350,
                fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
                fontFeatureSettings: '"ss01"',
              }}
            >
              What's bloomed
            </h1>
            <div className="flex items-center gap-2">
              {totalCount > 0 && (
                <p
                  className="mono uppercase tracking-[0.24em] text-[0.6rem]"
                  style={{ color: CREAM_DIM }}
                >
                  {totalCount.toLocaleString()} {totalCount === 1 ? 'token' : 'tokens'}
                </p>
              )}
              <button
                onClick={() => {
                  mutate();
                  setRefreshKey((k) => k + 1);
                }}
                className="ml-2 mono uppercase tracking-[0.22em] text-[0.55rem] px-2.5 py-1.5 inline-flex items-center gap-1.5 transition-colors"
                style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = CREAM;
                  e.currentTarget.style.borderColor = AMBER + '88';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = CREAM_DIM;
                  e.currentTarget.style.borderColor = HAIR_STRONG;
                }}
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
              <Link
                href="/create"
                prefetch
                className="mono uppercase tracking-[0.22em] text-[0.55rem] px-3 py-1.5 inline-flex items-center gap-1.5 transition-colors"
                style={{ background: AMBER, color: BG }}
                onMouseEnter={(e) => (e.currentTarget.style.background = PEACH)}
                onMouseLeave={(e) => (e.currentTarget.style.background = AMBER)}
              >
                <BloomIcon className="w-3 h-3" />
                Plant a token
              </Link>
            </div>
          </div>
          <p
            className="mt-3 max-w-prose"
            style={{
              color: CREAM_DIM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontSize: '1.05rem',
            }}
          >
            Every project that grew from prediction to launch. Sorted by what's moving.
          </p>
        </header>

        {/* ─── Category filters — uniform cosmic ─── */}
        {(allTokens.length > 0 || launchedTokens.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mb-6 sm:mb-8">
            {availableCategories.map((category) => {
              const isSelected = selectedCategory === category;
              const count = getCategoryCount(category);
              return (
                <button
                  key={category}
                  onClick={() => handleCategoryChange(category)}
                  className="mono uppercase tracking-[0.22em] text-[0.6rem] px-3 py-1.5 inline-flex items-center gap-1.5 transition-colors"
                  style={{
                    background: isSelected ? AMBER : 'transparent',
                    color: isSelected ? BG : CREAM_DIM,
                    border: `1px solid ${isSelected ? AMBER : HAIR_STRONG}`,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.color = CREAM;
                      e.currentTarget.style.borderColor = 'rgba(232,150,96,0.5)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.color = CREAM_DIM;
                      e.currentTarget.style.borderColor = HAIR_STRONG;
                    }
                  }}
                >
                  {CATEGORY_LABELS[category] || 'Other'}
                  <span
                    className="text-[0.5rem]"
                    style={{
                      color: isSelected ? 'rgba(10,8,20,0.7)' : CREAM_FAINT,
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* ─── Loading ─── */}
        {isLoading && launchedTokens.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-20"
            style={{ color: CREAM_FAINT }}
          >
            <div
              className="w-7 h-7 mb-4 animate-spin"
              style={{
                border: `1.5px solid ${HAIR_STRONG}`,
                borderTopColor: AMBER,
                borderRadius: '50%',
              }}
            />
            <p className="mono text-[0.62rem] uppercase tracking-[0.24em]">
              Reading the leaves…
            </p>
          </div>
        )}

        {/* ─── Error ─── */}
        {error && (
          <div
            className="text-center py-12 px-6"
            style={{
              background: 'rgba(214,115,71,0.06)',
              border: `1px solid ${EARTH}55`,
            }}
          >
            <SeedIcon className="w-8 h-8 mx-auto mb-3" />
            <p
              className="mb-2"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: '1.1rem',
                fontWeight: 350,
              }}
            >
              The orchard is unreachable.
            </p>
            <button
              onClick={() => mutate()}
              className="mono uppercase tracking-[0.24em] text-[0.6rem] px-4 py-2 transition-colors"
              style={{ color: EARTH, border: `1px solid ${EARTH}55` }}
            >
              Try again
            </button>
          </div>
        )}

        {/* ─── Empty ─── */}
        {!isLoading && !error && totalCount === 0 && (
          <div
            className="text-center py-20 px-6"
            style={{ background: 'rgba(244,238,228,0.02)', border: `1px solid ${HAIR}` }}
          >
            <BloomIcon className="w-12 h-12 mx-auto mb-4" />
            <h3
              className="mb-2"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: '1.5rem',
                fontWeight: 350,
              }}
            >
              No blossoms yet.
            </h3>
            <p
              className="mono uppercase tracking-[0.22em] text-[0.6rem] mb-6"
              style={{ color: CREAM_FAINT }}
            >
              Be the first to plant something the grove decides to grow.
            </p>
            <Link
              href="/create"
              prefetch
              className="mono uppercase tracking-[0.26em] text-[0.62rem] inline-block px-5 py-2.5 transition-colors"
              style={{ background: AMBER, color: BG }}
              onMouseEnter={(e) => (e.currentTarget.style.background = PEACH)}
              onMouseLeave={(e) => (e.currentTarget.style.background = AMBER)}
            >
              Plant something
            </Link>
          </div>
        )}

        {/* ─── Token table ─── */}
        {!error && (launchedTokens.length > 0 || (isLoading && totalCount > 0)) && (
          <>
            <LaunchedTable
              tokens={launchedTokens}
              isLoading={isLoading && launchedTokens.length === 0}
              refreshKey={refreshKey}
            />

            {/* Pagination */}
            {totalCount > 0 && (
              <div
                className="mt-8 pt-6 flex flex-col lg:flex-row items-center justify-between gap-4"
                style={{ borderTop: `1px solid ${HAIR}` }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="mono uppercase tracking-[0.24em] text-[0.55rem]"
                    style={{ color: CREAM_FAINT }}
                  >
                    Show
                  </span>
                  <div className="w-32">
                    <Dropdown
                      value={String(itemsPerPage)}
                      onChange={(v) => handleItemsPerPageChange(parseInt(v, 10))}
                      options={PER_PAGE_OPTIONS}
                      placeholder="25"
                      compact
                    />
                  </div>
                </div>

                <p
                  className="mono uppercase tracking-[0.24em] text-[0.55rem]"
                  style={{ color: CREAM_FAINT }}
                >
                  {startItem}–{endItem} of {totalCount.toLocaleString()}
                </p>

                <div className="flex items-center gap-1">
                  <PageBtn
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    aria="First page"
                  >
                    «
                  </PageBtn>
                  <PageBtn
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    aria="Previous page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </PageBtn>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 5) pageNum = i + 1;
                    else if (page <= 3) pageNum = i + 1;
                    else if (page >= pagination.totalPages - 2)
                      pageNum = pagination.totalPages - 4 + i;
                    else pageNum = page - 2 + i;
                    const active = page === pageNum;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className="w-8 h-8 mono text-[0.6rem] tracking-[0.1em] transition-colors"
                        style={{
                          background: active ? AMBER : 'transparent',
                          color: active ? BG : CREAM_DIM,
                          border: `1px solid ${active ? AMBER : HAIR_STRONG}`,
                        }}
                        onMouseEnter={(e) => {
                          if (!active) {
                            e.currentTarget.style.color = CREAM;
                            e.currentTarget.style.borderColor = AMBER + '88';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!active) {
                            e.currentTarget.style.color = CREAM_DIM;
                            e.currentTarget.style.borderColor = HAIR_STRONG;
                          }
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <PageBtn
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={!pagination.hasMore}
                    aria="Next page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </PageBtn>
                  <PageBtn
                    onClick={() => setPage(pagination.totalPages)}
                    disabled={page === pagination.totalPages}
                    aria="Last page"
                  >
                    »
                  </PageBtn>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PageBtn({
  onClick,
  disabled,
  children,
  aria,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  aria: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      className="w-8 h-8 mono text-[0.62rem] flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.color = CREAM;
          e.currentTarget.style.borderColor = AMBER + '88';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = CREAM_DIM;
        e.currentTarget.style.borderColor = HAIR_STRONG;
      }}
    >
      {children}
    </button>
  );
}
