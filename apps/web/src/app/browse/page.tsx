'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useVoting } from '@/lib/hooks/useVoting';
import { useAllMarketsSocket } from '@/lib/hooks/useSocket';
import { FEES } from '@/config/solana';
import CountdownTimer from '@/components/CountdownTimer';
import ErrorDialog from '@/components/ErrorDialog';
import { parseError } from '@/lib/utils/errorParser';
import { getVoteButtonStates, getMarketDisplayStatus } from '@/lib/api-utils';
import { useWallet } from '@/hooks/useWallet';
import { Dropdown, DropdownOption } from '@/components/Dropdown';
import {
  SeedIcon,
  TreeIcon,
  BloomIcon,
  LeafIcon,
  SunIcon,
  RootIcon,
} from '@/components/PlantIcons';

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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Market {
  id: string;
  marketAddress: string;
  name: string;
  description: string;
  category: string;
  stage: string;
  tokenSymbol: string;
  targetPool: string;
  yesVotes: number | null;
  noVotes: number | null;
  totalYesStake: number | null;
  totalNoStake: number | null;
  totalParticipants?: number;
  timeLeft: string;
  expiryTime: string;
  status: string;
  metadataUri?: string;
  projectImageUrl?: string;
  yesPercentage?: number | null;
  noPercentage?: number | null;
  resolution?: string;
  phase?: string;
  poolProgressPercentage?: number;
  poolBalance?: number;
  tokenMint?: string | null;
  pumpFunTokenAddress?: string | null;
  displayStatus?: string;
  badgeClass?: string;
  isYesVoteEnabled?: boolean;
  isNoVoteEnabled?: boolean;
  yesVoteDisabledReason?: string;
  noVoteDisabledReason?: string;
  lastSyncedAt?: string | null;
  isStale?: boolean;
  syncStatus?: string;
}

function formatLabel(value: string): string {
  const upper: { [k: string]: string } = {
    dao: 'DAO',
    nft: 'NFT',
    ai: 'AI/ML',
    defi: 'DeFi',
    mvp: 'MVP',
    realestate: 'Real Estate',
    'real estate': 'Real Estate',
  };
  if (upper[value.toLowerCase()]) return upper[value.toLowerCase()];
  return value
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function getMarketStatus(market: Market): { status: string; badgeClass: string } {
  const phase = typeof market.phase === 'string' ? (market.phase === 'Funding' ? 1 : 0) : market.phase ?? 0;
  const computed = getMarketDisplayStatus({
    resolution: market.resolution,
    phase,
    poolProgressPercentage: market.poolProgressPercentage,
    expiryTime: market.expiryTime,
    tokenMint: market.tokenMint,
    pumpFunTokenAddress: market.pumpFunTokenAddress,
  });
  return { status: computed.displayStatus, badgeClass: computed.badgeClass };
}

function getComputedVoteButtonStates(market: Market) {
  const phase = typeof market.phase === 'string' ? (market.phase === 'Funding' ? 1 : 0) : market.phase ?? 0;
  return getVoteButtonStates({
    resolution: market.resolution,
    phase,
    poolProgressPercentage: market.poolProgressPercentage,
    expiryTime: market.expiryTime,
    tokenMint: market.tokenMint,
    pumpFunTokenAddress: market.pumpFunTokenAddress,
  });
}

const isYesVoteDisabled = (m: Market) => !getComputedVoteButtonStates(m).isYesVoteEnabled;
const isNoVoteDisabled = (m: Market) => !getComputedVoteButtonStates(m).isNoVoteEnabled;

const ITEMS_PER_PAGE_OPTIONS = [25, 50, 100];

// Plant-themed status tabs — same API value, gentler vocabulary.
const STATUS_TABS: Array<{ value: string; label: string; sub: string }> = [
  { value: 'active', label: 'Living', sub: 'still voting' },
  { value: 'yesWins', label: 'Bloomed', sub: 'launched' },
  { value: 'noWins', label: 'Withered', sub: 'rejected' },
  { value: 'expired', label: 'Closed', sub: 'pool not met' },
  { value: 'refund', label: 'Returned', sub: 'refunded' },
];

const CATEGORY_OPTIONS: DropdownOption[] = [
  { value: 'All', label: 'All categories' },
  { value: 'DeFi', label: 'DeFi' },
  { value: 'Gaming', label: 'Gaming' },
  { value: 'NFT', label: 'NFT' },
  { value: 'AI/ML', label: 'AI/ML' },
  { value: 'Social', label: 'Social' },
  { value: 'Infrastructure', label: 'Infrastructure' },
  { value: 'DAO', label: 'DAO' },
  { value: 'Meme', label: 'Meme' },
  { value: 'Creator', label: 'Creator' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Science', label: 'Science' },
  { value: 'Education', label: 'Education' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Commerce', label: 'Commerce' },
  { value: 'Real Estate', label: 'Real Estate' },
  { value: 'Energy', label: 'Energy' },
  { value: 'Media', label: 'Media' },
  { value: 'Manufacturing', label: 'Manufacturing' },
  { value: 'Mobility', label: 'Mobility' },
  { value: 'Other', label: 'Other' },
];

const PER_PAGE_OPTIONS: DropdownOption[] = ITEMS_PER_PAGE_OPTIONS.map((n) => ({
  value: String(n),
  label: `${n} per page`,
}));

export default function BrowsePage() {
  const [votingState, setVotingState] = useState<{ marketId: string; voteType: 'yes' | 'no' } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('active');
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const { vote } = useVoting();
  const { primaryWallet } = useWallet();
  const walletAddress = primaryWallet?.address || null;

  // Debounce search input → searchQuery (200ms)
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 200);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch user positions for "you voted" badges
  const { data: positionsData } = useSWR(
    walletAddress ? `/api/user/${walletAddress}/positions` : null,
    fetcher,
    { refreshInterval: 60000, dedupingInterval: 15000 },
  );
  const userPositions = useMemo(() => {
    const map = new Map<string, { side: string; amount: number }>();
    if (positionsData?.data?.positions) {
      for (const p of positionsData.data.positions) {
        const side = Number(p.yesShares || 0) > Number(p.noShares || 0) ? 'YES' : 'NO';
        const amount = Number(p.totalInvested || 0) / 1e9;
        if (p.marketAddress) map.set(p.marketAddress, { side, amount });
      }
    }
    return map;
  }, [positionsData]);

  // Real-time socket updates
  const { marketUpdates, newMarkets, clearNewMarkets, isConnected } = useAllMarketsSocket();
  const [animatingMarketIds, setAnimatingMarketIds] = useState<Set<string>>(new Set());

  // ── Live-pulse: when a market gets a socket update, glow its border briefly ──
  const lastSeenUpdateRef = useRef<Map<string, number>>(new Map());
  const didMountRef = useRef(false);
  const [pulsingAddresses, setPulsingAddresses] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!didMountRef.current) {
      // On first render, seed last-seen with current timestamps so we don't
      // pulse every card on mount — only future updates trigger the glow.
      marketUpdates.forEach((data, addr) => {
        lastSeenUpdateRef.current.set(addr, data?.timestamp || Date.now());
      });
      didMountRef.current = true;
      return;
    }
    const fresh: string[] = [];
    marketUpdates.forEach((data, addr) => {
      const ts = data?.timestamp || 0;
      const last = lastSeenUpdateRef.current.get(addr) || 0;
      if (ts > last) {
        lastSeenUpdateRef.current.set(addr, ts);
        fresh.push(addr);
      }
    });
    if (fresh.length === 0) return;
    setPulsingAddresses((prev) => {
      const next = new Set(prev);
      fresh.forEach((a) => next.add(a));
      return next;
    });
    const t = setTimeout(() => {
      setPulsingAddresses((prev) => {
        const next = new Set(prev);
        fresh.forEach((a) => next.delete(a));
        return next;
      });
    }, 700);
    return () => clearTimeout(t);
  }, [marketUpdates]);

  // Adaptive polling — slow down when socket carries the live signal
  const pollInterval = isConnected ? 60000 : 15000;

  const { data: marketsResponse, error: fetchError, mutate: refetchMarkets } = useSWR(
    `/api/markets/list?status=${selectedStatus}&page=${page}&limit=${itemsPerPage}`,
    fetcher,
    {
      refreshInterval: pollInterval,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      keepPreviousData: true,
    },
  );

  const loading = !marketsResponse && !fetchError;
  const error = fetchError
    ? 'Failed to load markets'
    : marketsResponse?.success === false
    ? marketsResponse.error
    : null;
  const totalCount = marketsResponse?.data?.totalCount || 0;
  const pagination = marketsResponse?.data?.pagination || {
    page: 1,
    limit: 25,
    totalPages: 1,
    hasMore: false,
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setPage(1);
  };
  const handleItemsPerPageChange = (newLimit: number) => {
    setItemsPerPage(newLimit);
    setPage(1);
  };

  const startItem = totalCount > 0 ? (page - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(page * itemsPerPage, totalCount);

  // Merge SWR data with socket updates + new-market arrivals
  const markets = useMemo(() => {
    const baseMarkets: Market[] = marketsResponse?.data?.markets || [];
    let mergedMarkets = baseMarkets.map((market) => {
      const update = marketUpdates.get(market.marketAddress);
      if (update) {
        const isResolved = market.resolution && market.resolution !== 'Unresolved';
        if (isResolved) {
          const { poolBalance, poolProgressPercentage, ...safeUpdate } = update as any;
          return { ...market, ...safeUpdate };
        }
        return { ...market, ...update };
      }
      return market;
    });
    if (newMarkets.length > 0 && selectedStatus === 'active') {
      const existingIds = new Set(mergedMarkets.map((m) => m.id));
      const existingAddresses = new Set(mergedMarkets.map((m) => m.marketAddress));
      const newMarketsToAdd = newMarkets.filter(
        (m) => !existingIds.has(m.id) && !existingAddresses.has(m.marketAddress),
      );
      if (newMarketsToAdd.length > 0) {
        mergedMarkets = [...newMarketsToAdd, ...mergedMarkets];
      }
    }
    return mergedMarkets;
  }, [marketsResponse?.data?.markets, marketUpdates, newMarkets, selectedStatus]);

  // 2s pulse-glow + clear when fresh markets land via socket
  useEffect(() => {
    if (newMarkets.length > 0) {
      const newIds = new Set(newMarkets.map((m) => m.id));
      setAnimatingMarketIds((prev) => new Set([...prev, ...newIds]));
      const timeout = setTimeout(() => {
        setAnimatingMarketIds((prev) => {
          const next = new Set(prev);
          newIds.forEach((id) => next.delete(id));
          return next;
        });
        clearNewMarkets();
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [newMarkets, clearNewMarkets]);

  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    details?: string;
  }>({ open: false, title: '', message: '', details: undefined });

  const QUICK_VOTE_AMOUNT = FEES.MINIMUM_INVESTMENT / 1_000_000_000;
  const handleQuickVote = async (market: Market, voteType: 'yes' | 'no') => {
    setVotingState({ marketId: market.id, voteType });
    const result = await vote({
      marketId: market.id,
      marketAddress: market.marketAddress,
      voteType,
      amount: QUICK_VOTE_AMOUNT,
    });
    setVotingState(null);
    if (!result.success) {
      const parsedError = parseError(result.error);
      setErrorDialog({
        open: true,
        title: parsedError.title,
        message: parsedError.message,
        details: parsedError.details,
      });
    }
  };

  // Hot — top 2 by participants among active/pool-complete
  const hotProjects = useMemo(() => {
    if (markets.length === 0) return [];
    const activeMarkets = markets.filter((m) => {
      const status = getMarketStatus(m);
      return status.status === '✅ Active' || status.status === '🎯 Pool Complete';
    });
    const sortByVotes = (a: Market, b: Market) => {
      const aVotes = a.totalParticipants ?? ((a.yesVotes ?? 0) + (a.noVotes ?? 0));
      const bVotes = b.totalParticipants ?? ((b.yesVotes ?? 0) + (b.noVotes ?? 0));
      return bVotes - aVotes;
    };
    const marketsToUse = activeMarkets.length > 0 ? activeMarkets : markets;
    return [...marketsToUse].sort(sortByVotes).slice(0, 2);
  }, [markets]);

  const hotProjectIds = useMemo(() => new Set(hotProjects.map((p) => p.id)), [hotProjects]);

  const filteredMarkets = useMemo(() => {
    let filtered = markets;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.name?.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q) ||
          m.tokenSymbol?.toLowerCase().includes(q) ||
          m.category?.toLowerCase().includes(q),
      );
    }
    if (selectedCategory !== 'All') {
      filtered = filtered.filter((m) => {
        const categoryLower = m.category.toLowerCase();
        const selectedLower = selectedCategory.toLowerCase();
        return (
          categoryLower === selectedLower ||
          (selectedCategory === 'AI/ML' && (categoryLower === 'ai/ml' || categoryLower === 'ai'))
        );
      });
    }
    if (selectedStatus === 'active') {
      filtered = [...filtered].sort((a, b) => {
        const aIsHot = hotProjectIds.has(a.id) ? 1 : 0;
        const bIsHot = hotProjectIds.has(b.id) ? 1 : 0;
        return bIsHot - aIsHot;
      });
    }
    return filtered;
  }, [markets, hotProjectIds, selectedCategory, selectedStatus, searchQuery]);

  return (
    <div className="px-4 sm:px-6 pb-20" style={{ color: CREAM }}>
      <div className="max-w-6xl mx-auto pt-6 sm:pt-10">
        {/* ─── Editorial header ─── */}
        <header className="mb-8 sm:mb-10">
          <p
            className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-2"
            style={{ color: AMBER }}
          >
            The catalog
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
              What's growing
            </h1>
            {totalCount > 0 && (
              <p
                className="mono uppercase tracking-[0.24em] text-[0.6rem]"
                style={{ color: CREAM_DIM }}
              >
                {totalCount.toLocaleString()} {totalCount === 1 ? 'market' : 'markets'}
                <span className="mx-2" style={{ color: HAIR_STRONG }}>·</span>
                <span style={{ color: isConnected ? FOREST : CREAM_FAINT }}>
                  {isConnected ? '● live' : '○ idle'}
                </span>
              </p>
            )}
          </div>
          <p
            className="mt-3 max-w-prose"
            style={{
              color: CREAM_DIM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontSize: '1.05rem',
            }}
          >
            Every market in the grove. Filter, search, vote.
          </p>
        </header>

        {/* ─── Search + filters ─── */}
        <div className="mb-6 sm:mb-8 space-y-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name, token, or category…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-10 py-3 transition-colors focus:outline-none"
              style={{
                background: 'transparent',
                border: `1px solid ${HAIR_STRONG}`,
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: '0.95rem',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = AMBER)}
              onBlur={(e) => (e.currentTarget.style.borderColor = HAIR_STRONG)}
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              fill="none"
              stroke={CREAM_FAINT}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: CREAM_FAINT }}
                onMouseEnter={(e) => (e.currentTarget.style.color = AMBER)}
                onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Status tabs + category */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_TABS.map((tab) => {
                const active = selectedStatus === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => handleStatusChange(tab.value)}
                    className="mono uppercase tracking-[0.22em] text-[0.6rem] px-3 py-2 transition-colors"
                    style={{
                      background: active ? AMBER : 'transparent',
                      color: active ? BG : CREAM_DIM,
                      border: `1px solid ${active ? AMBER : HAIR_STRONG}`,
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = CREAM;
                        e.currentTarget.style.borderColor = 'rgba(232,150,96,0.45)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = CREAM_DIM;
                        e.currentTarget.style.borderColor = HAIR_STRONG;
                      }
                    }}
                    title={tab.sub}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <div className="flex-1" />
            <div className="w-full sm:w-56">
              <Dropdown
                value={selectedCategory}
                onChange={(v) => {
                  setSelectedCategory(v);
                  setPage(1);
                }}
                options={CATEGORY_OPTIONS}
                placeholder="All categories"
                compact
              />
            </div>
          </div>
        </div>

        {/* ─── Loading ─── */}
        {loading && <BrowseLoading />}

        {/* ─── Error ─── */}
        {error && !loading && (
          <div
            className="text-center py-12"
            style={{ background: 'rgba(214,115,71,0.06)', border: `1px solid ${EARTH}55` }}
          >
            <p
              className="mb-4"
              style={{ color: EARTH, fontFamily: 'var(--font-fraunces, serif)', fontSize: '1rem' }}
            >
              {error}
            </p>
            <button
              onClick={() => refetchMarkets()}
              className="mono uppercase tracking-[0.24em] text-[0.6rem] px-4 py-2 transition-colors"
              style={{ color: EARTH, border: `1px solid ${EARTH}55` }}
            >
              Try again
            </button>
          </div>
        )}

        {/* ─── Empty ─── */}
        {!loading && !error && filteredMarkets.length === 0 && (
          <div
            className="text-center py-16 px-6"
            style={{ background: 'rgba(244,238,228,0.02)', border: `1px solid ${HAIR}` }}
          >
            <SeedIcon className="w-10 h-10 mx-auto mb-4" />
            <h3
              className="mb-2"
              style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '1.4rem' }}
            >
              {markets.length === 0 ? 'Nothing has sprouted here yet.' : 'No matches.'}
            </h3>
            <p
              className="mono uppercase tracking-[0.22em] text-[0.6rem] mb-6"
              style={{ color: CREAM_FAINT }}
            >
              {markets.length === 0 ? 'Be the first to plant.' : 'Try another category or clear search.'}
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

        {/* ─── Grid ─── */}
        {!loading && !error && filteredMarkets.length > 0 && (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredMarkets.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                isHot={selectedStatus === 'active' && hotProjectIds.has(market.id)}
                isNew={animatingMarketIds.has(market.id)}
                isPulsing={pulsingAddresses.has(market.marketAddress)}
                position={userPositions.get(market.marketAddress)}
                voting={
                  votingState !== null && votingState.marketId === market.id
                    ? votingState.voteType
                    : null
                }
                anyVoting={votingState !== null}
                onQuickVote={handleQuickVote}
              />
            ))}
          </div>
        )}

        {/* ─── Pagination ─── */}
        {totalCount > ITEMS_PER_PAGE_OPTIONS[0] && (
          <div
            className="mt-10 pt-6 flex flex-col lg:flex-row items-center justify-between gap-4"
            style={{ borderTop: `1px solid ${HAIR}` }}
          >
            {/* Per-page (compact dropdown) */}
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

            {/* Range */}
            <p
              className="mono uppercase tracking-[0.24em] text-[0.55rem]"
              style={{ color: CREAM_FAINT }}
            >
              {startItem}–{endItem} of {totalCount.toLocaleString()}
            </p>

            {/* Navigation */}
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

        <ErrorDialog
          open={errorDialog.open}
          onClose={() => setErrorDialog({ ...errorDialog, open: false })}
          title={errorDialog.title}
          message={errorDialog.message}
          details={errorDialog.details}
        />
      </div>

      {/* Animations shared by every card */}
      <style jsx global>{`
        @keyframes liveGlow {
          0% { box-shadow: 0 0 0 0 rgba(232,150,96,0); }
          50% { box-shadow: 0 0 0 1px rgba(232,150,96,0.45), 0 0 18px rgba(232,150,96,0.3); }
          100% { box-shadow: 0 0 0 0 rgba(232,150,96,0); }
        }
        @keyframes newMarketIn {
          0% { transform: translateY(-12px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─── Page nav button helper ───
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

// ─── Loading skeleton ───
function BrowseLoading() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="p-4 animate-pulse"
          style={{ background: 'rgba(244,238,228,0.025)', border: `1px solid ${HAIR}` }}
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 flex-shrink-0" style={{ background: HAIR_STRONG }} />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4" style={{ background: HAIR_STRONG }} />
              <div className="h-3 w-full" style={{ background: HAIR }} />
              <div className="h-3 w-5/6" style={{ background: HAIR }} />
            </div>
          </div>
          <div className="h-1.5 w-full mb-3" style={{ background: HAIR }} />
          <div className="flex justify-between mb-3">
            <div className="h-3 w-16" style={{ background: HAIR }} />
            <div className="h-3 w-12" style={{ background: HAIR }} />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="h-7" style={{ background: HAIR_STRONG }} />
            <div className="h-7" style={{ background: HAIR }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Market card ───
function MarketCard({
  market,
  isHot,
  isNew,
  isPulsing,
  position,
  voting,
  anyVoting,
  onQuickVote,
}: {
  market: Market;
  isHot: boolean;
  isNew: boolean;
  isPulsing: boolean;
  position?: { side: string; amount: number };
  voting: 'yes' | 'no' | null;
  anyVoting: boolean;
  onQuickVote: (m: Market, v: 'yes' | 'no') => void;
}) {
  const status = getMarketStatus(market);
  const yesDisabled = isYesVoteDisabled(market);
  const noDisabled = isNoVoteDisabled(market);
  const isActionable = !yesDisabled || !noDisabled;
  const poolPercent = Math.min(market.poolProgressPercentage || 0, 100);
  const isResolved = market.resolution && market.resolution !== 'Unresolved';
  const tokenMint = (market as any).tokenMint || (market as any).pumpFunTokenAddress;
  const isTokenLaunched = isResolved && market.resolution === 'YesWins' && !!tokenMint;

  // Border color baseline; pulses to amber on socket update
  const borderColor = isNew ? FOREST + '88' : isHot ? AMBER + '55' : HAIR_STRONG;

  // Tint the card background slightly differently for resolved/hot/new states
  const bg = isNew
    ? 'rgba(63,122,66,0.08)'
    : isHot
    ? 'rgba(232,150,96,0.045)'
    : 'rgba(244,238,228,0.025)';

  return (
    <Link
      href={`/market/${market.id}`}
      prefetch
      className="block transition-colors h-full"
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        animation: isPulsing
          ? 'liveGlow 0.7s ease-out'
          : isNew
          ? 'newMarketIn 350ms ease-out'
          : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isPulsing) e.currentTarget.style.borderColor = AMBER + '88';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = borderColor;
      }}
    >
      <div className="p-4 flex flex-col h-full">
        {/* Top: image + name + token + description */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-12 h-12 flex-shrink-0 overflow-hidden flex items-center justify-center"
            style={{ background: 'rgba(232,150,96,0.08)', border: `1px solid ${HAIR_STRONG}` }}
          >
            {market.projectImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={market.projectImageUrl}
                alt={market.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const t = e.target as HTMLImageElement;
                  t.style.display = 'none';
                }}
              />
            ) : (
              <span
                style={{
                  color: AMBER,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontSize: '1.1rem',
                }}
              >
                {market.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3
                className="truncate"
                style={{
                  color: CREAM,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontWeight: 400,
                  fontSize: '0.98rem',
                }}
              >
                {market.name}
              </h3>
              {market.tokenSymbol && (
                <span
                  className="mono text-[0.55rem] uppercase tracking-[0.18em] flex-shrink-0"
                  style={{ color: AMBER }}
                >
                  ${market.tokenSymbol}
                </span>
              )}
            </div>
            <p className="text-xs line-clamp-2 leading-snug" style={{ color: CREAM_DIM }}>
              {market.description}
            </p>
          </div>
        </div>

        {/* Tags row: NEW / HOT / Category / Stage / Status */}
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {isNew && (
            <Tag color={FOREST}>
              <span
                className="w-1 h-1 inline-block mr-1"
                style={{ background: FOREST, boxShadow: `0 0 4px ${FOREST}` }}
              />
              NEW
            </Tag>
          )}
          {isHot && !isNew && (
            <Tag color={AMBER}>
              <BloomIcon className="w-2.5 h-2.5 inline mr-0.5" /> Hot
            </Tag>
          )}
          <Tag color={CREAM_DIM}>{formatLabel(market.category)}</Tag>
          <Tag color={CREAM_DIM}>{formatLabel(market.stage)}</Tag>
          <span className="ml-auto" />
          <Tag color={statusColor(market)} subtle>
            {plantStatusLabel(market)}
          </Tag>
        </div>

        {/* Pool progress */}
        <div className="mb-3">
          <div className="h-1.5 w-full" style={{ background: HAIR }}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${poolPercent}%`,
                background: poolPercent >= 100 ? FOREST : AMBER,
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span
              className="mono text-[0.55rem] uppercase tracking-[0.2em]"
              style={{ color: CREAM_FAINT }}
            >
              <span style={{ color: AMBER }}>{((market.poolBalance || 0) / 1e9).toFixed(2)}</span>
              <span> / {market.targetPool}</span>
            </span>
            <span
              className="mono text-[0.55rem] uppercase tracking-[0.2em]"
              style={{ color: poolPercent >= 100 ? FOREST : CREAM_DIM }}
            >
              {poolPercent}%
            </span>
          </div>
        </div>

        {/* Bottom: participants + countdown */}
        <div className="flex items-center justify-between mb-3 mt-auto pt-1">
          <span
            className="mono text-[0.55rem] uppercase tracking-[0.22em] inline-flex items-center gap-1"
            style={{ color: CREAM_FAINT }}
          >
            <LeafIcon className="w-3 h-3" />
            {market.totalParticipants ?? 0}
          </span>
          <CountdownTimer
            expiryTime={market.expiryTime}
            className="mono text-[0.55rem] uppercase tracking-[0.22em]"
          />
        </div>

        {/* Position badge */}
        {position && (
          <div
            className="mb-2 mono text-[0.55rem] uppercase tracking-[0.22em] px-2 py-1"
            style={{
              color: position.side === 'YES' ? FOREST : EARTH,
              border: `1px solid ${(position.side === 'YES' ? FOREST : EARTH) + '55'}`,
            }}
          >
            <span className="mr-1">{position.side === 'YES' ? '↑' : '↓'}</span>
            You voted {position.side} · {position.amount.toFixed(3)} SOL
          </div>
        )}

        {/* Adaptive action row */}
        {(() => {
          if (isTokenLaunched) {
            return (
              <div className="grid grid-cols-2 gap-1.5">
                <ActionBtn primary>+ {market.tokenSymbol || 'BUY'}</ActionBtn>
                <ActionBtn>− {market.tokenSymbol || 'SELL'}</ActionBtn>
              </div>
            );
          }
          if (isResolved) {
            const verdict =
              market.resolution === 'YesWins'
                ? { label: '✓ Launched', color: FOREST }
                : market.resolution === 'NoWins'
                ? { label: '✗ Withered', color: EARTH }
                : { label: '↩ Returned', color: PEACH };
            return (
              <div
                className="text-center py-2 mono uppercase tracking-[0.24em] text-[0.6rem]"
                style={{
                  background: verdict.color + '0d',
                  color: verdict.color,
                  border: `1px solid ${verdict.color}33`,
                }}
              >
                {verdict.label}
              </div>
            );
          }
          if (isActionable) {
            return (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onQuickVote(market, 'yes');
                  }}
                  disabled={anyVoting || yesDisabled}
                  className="mono uppercase tracking-[0.22em] text-[0.6rem] py-2 transition-colors flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: FOREST, color: CREAM }}
                  onMouseEnter={(e) => {
                    if (!anyVoting && !yesDisabled) e.currentTarget.style.background = '#4a8d4d';
                  }}
                  onMouseLeave={(e) => {
                    if (!anyVoting && !yesDisabled) e.currentTarget.style.background = FOREST;
                  }}
                >
                  {voting === 'yes' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Yes'}
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onQuickVote(market, 'no');
                  }}
                  disabled={anyVoting || noDisabled}
                  className="mono uppercase tracking-[0.22em] text-[0.6rem] py-2 transition-colors flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ color: EARTH, border: `1px solid ${EARTH}88` }}
                  onMouseEnter={(e) => {
                    if (!anyVoting && !noDisabled)
                      e.currentTarget.style.background = 'rgba(214,115,71,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    if (!anyVoting && !noDisabled) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {voting === 'no' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'No'}
                </button>
              </div>
            );
          }
          return (
            <div
              className="text-center py-2 mono uppercase tracking-[0.22em] text-[0.6rem]"
              style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
            >
              View details
            </div>
          );
        })()}
      </div>
    </Link>
  );
}

function Tag({
  children,
  color,
  subtle,
}: {
  children: React.ReactNode;
  color: string;
  subtle?: boolean;
}) {
  return (
    <span
      className="mono uppercase tracking-[0.22em] text-[0.5rem] px-1.5 py-0.5 inline-flex items-center"
      style={{
        color,
        border: `1px solid ${color}${subtle ? '44' : '55'}`,
        background: subtle ? `${color}0a` : 'transparent',
      }}
    >
      {children}
    </span>
  );
}

function ActionBtn({
  children,
  primary,
}: {
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <span
      className="mono uppercase tracking-[0.22em] text-[0.6rem] py-2 text-center transition-colors"
      style={{
        background: primary ? FOREST : 'transparent',
        color: primary ? CREAM : CREAM_DIM,
        border: primary ? '1px solid transparent' : `1px solid ${HAIR_STRONG}`,
      }}
    >
      {children}
    </span>
  );
}

// ── Status helpers (plant-themed labels for the status pill) ──
function plantStatusLabel(market: Market): string {
  if (market.resolution === 'YesWins') return 'Bloomed';
  if (market.resolution === 'NoWins') return 'Withered';
  if (market.resolution === 'Refund') return 'Returned';
  const status = getMarketStatus(market).status;
  if (status.includes('Active')) return 'Living';
  if (status.includes('Pool Complete')) return 'Ready';
  if (status.includes('Expired')) return 'Closed';
  return 'Quiet';
}
function statusColor(market: Market): string {
  if (market.resolution === 'YesWins') return FOREST;
  if (market.resolution === 'NoWins') return EARTH;
  if (market.resolution === 'Refund') return PEACH;
  const status = getMarketStatus(market).status;
  if (status.includes('Active')) return AMBER;
  if (status.includes('Pool Complete')) return AMBER;
  return CREAM_FAINT;
}
