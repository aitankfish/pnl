'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAllMarketsSocket } from '@/lib/hooks/useSocket';
import { useWallet } from '@/hooks/useWallet';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
  SeedIcon,
  TreeIcon,
  BloomIcon,
  SunIcon,
  LeafIcon,
  BellflowerIcon,
} from '@/components/PlantIcons';
import { Loader2 } from 'lucide-react';

// ── Cosmic-plant palette (shared across landing + app) ──
const BG = '#0a0814';
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.14)';
const AMBER = '#e89660';
const PEACH = '#ecb48a';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

interface Market {
  id: string;
  marketAddress: string;
  name: string;
  description: string;
  category: string;
  stage: string;
  tokenSymbol: string;
  targetPool: string;
  yesVotes: number;
  noVotes: number;
  totalYesStake: number;
  totalNoStake: number;
  timeLeft: string;
  expiryTime: string;
  status: string;
  metadataUri?: string;
  projectImageUrl?: string;
  resolution?: string;
  poolBalance?: number;
}

interface LaunchedToken {
  id: string;
  marketAddress: string;
  name: string;
  symbol: string;
  description: string;
  category: string;
  launchDate: string;
  tokenAddress: string;
  projectImageUrl?: string;
  totalVotes: number;
  yesVotes: number;
  noVotes: number;
  yesPercentage: number;
  launchPool: string;
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

// "3d 4h" / "12h 23m" / "5m" — compact countdown derived from expiryTime.
function formatCountdown(expiryIso: string): { label: string; urgent: boolean } {
  const ms = new Date(expiryIso).getTime() - Date.now();
  if (ms <= 0) return { label: 'closed', urgent: true };
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (days >= 1) return { label: `${days}d ${hours}h`, urgent: false };
  if (hours >= 1) return { label: `${hours}h ${mins}m`, urgent: hours < 6 };
  return { label: `${mins}m`, urgent: true };
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

// ─── Cosmic Grove (data-bound) ────────────────────────────────────────
// Each leaf is a real platform thing: a market closing soon, a token that
// just bloomed, a market with momentum, or a quiet possibility. Hovering
// any leaf reveals what it is. Clicking takes you there. The tree is a
// living index — its state IS the state of the platform right now.

type LeafState = 'closing-urgent' | 'closing' | 'bloomed' | 'trending' | 'sleeping';

interface LeafSlot {
  cx: number;
  cy: number;
  rotation: number;
  scale: number;
  zone: 'closing' | 'bloomed' | 'trending' | 'sleeping';
}

interface BoundLeaf extends LeafSlot {
  state: LeafState;
  label: string | null;
  sublabel: string | null;
  href: string | null;
}

// Anchor positions chosen so each zone is semantically placed:
//   - Outer-edge tips for "closing" (about to fall)
//   - Crown for "bloomed" (just grown)
//   - Mid-canopy for "trending" (where the energy concentrates)
//   - Scattered fillers for "sleeping" possibilities
// viewBox is 320×320 — see <svg> below.
const CLOSING_SLOTS: LeafSlot[] = [
  { cx: 38, cy: 152, rotation: -75, scale: 1.05, zone: 'closing' },
  { cx: 282, cy: 152, rotation: 75, scale: 1.05, zone: 'closing' },
  { cx: 58, cy: 200, rotation: -100, scale: 1.0, zone: 'closing' },
  { cx: 262, cy: 200, rotation: 100, scale: 1.0, zone: 'closing' },
  { cx: 70, cy: 92, rotation: -55, scale: 0.95, zone: 'closing' },
];
const BLOOMED_SLOTS: LeafSlot[] = [
  { cx: 160, cy: 22, rotation: 0, scale: 1.1, zone: 'bloomed' },
  { cx: 132, cy: 36, rotation: -18, scale: 1.0, zone: 'bloomed' },
  { cx: 188, cy: 36, rotation: 18, scale: 1.0, zone: 'bloomed' },
  { cx: 110, cy: 58, rotation: -28, scale: 0.95, zone: 'bloomed' },
];
const TRENDING_SLOTS: LeafSlot[] = [
  { cx: 112, cy: 116, rotation: -22, scale: 0.95, zone: 'trending' },
  { cx: 208, cy: 116, rotation: 22, scale: 0.95, zone: 'trending' },
  { cx: 92, cy: 175, rotation: -50, scale: 0.9, zone: 'trending' },
  { cx: 228, cy: 175, rotation: 50, scale: 0.9, zone: 'trending' },
];
const SLEEPING_SLOTS: LeafSlot[] = [
  { cx: 145, cy: 86, rotation: -10, scale: 0.78, zone: 'sleeping' },
  { cx: 175, cy: 86, rotation: 10, scale: 0.78, zone: 'sleeping' },
  { cx: 215, cy: 60, rotation: 30, scale: 0.78, zone: 'sleeping' },
];

const LEAF_COLORS: Record<LeafState, { fill: string; stroke: string; vein: string }> = {
  'closing-urgent': { fill: AMBER, stroke: '#b8613a', vein: '#7a3a1a' },
  closing: { fill: PEACH, stroke: '#c98856', vein: '#7a3a1a' },
  bloomed: { fill: PEACH, stroke: '#b8814f', vein: '#5b3a1f' },
  trending: { fill: FOREST, stroke: '#2c5a2f', vein: '#1f3f21' },
  sleeping: { fill: 'rgba(244,238,228,0.18)', stroke: 'rgba(244,238,228,0.3)', vein: 'rgba(244,238,228,0.3)' },
};

function CosmicTree({
  closing,
  bloomed,
  trending,
}: {
  closing: Market[];
  bloomed: LaunchedToken[];
  trending: Market[];
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState<{ index: number; clientX: number; clientY: number } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Build the bound leaf array — slots in declared order map to data in
  // priority order. If a slot's data slice is empty, it falls back to
  // 'sleeping' so the tree never goes bald.
  const leaves = useMemo<BoundLeaf[]>(() => {
    const result: BoundLeaf[] = [];

    CLOSING_SLOTS.forEach((slot, i) => {
      const m = closing[i];
      if (!m) {
        result.push({ ...slot, state: 'sleeping', label: null, sublabel: null, href: null });
        return;
      }
      const cd = formatCountdown(m.expiryTime);
      result.push({
        ...slot,
        state: cd.urgent ? 'closing-urgent' : 'closing',
        label: m.name,
        sublabel: `Closes in ${cd.label}`,
        href: `/market/${m.id}`,
      });
    });

    BLOOMED_SLOTS.forEach((slot, i) => {
      const p = bloomed[i];
      if (!p) {
        result.push({ ...slot, state: 'sleeping', label: null, sublabel: null, href: null });
        return;
      }
      result.push({
        ...slot,
        state: 'bloomed',
        label: p.name,
        sublabel: `Bloomed ${formatRelative(p.launchDate)}`,
        href: `/market/${p.id}`,
      });
    });

    TRENDING_SLOTS.forEach((slot, i) => {
      const m = trending[i];
      if (!m) {
        result.push({ ...slot, state: 'sleeping', label: null, sublabel: null, href: null });
        return;
      }
      const total = (Number(m.totalYesStake) || 0) + (Number(m.totalNoStake) || 0);
      result.push({
        ...slot,
        state: 'trending',
        label: m.name,
        sublabel: `${(total / 1_000_000_000).toFixed(2)} SOL pooled`,
        href: `/market/${m.id}`,
      });
    });

    SLEEPING_SLOTS.forEach((slot) => {
      result.push({ ...slot, state: 'sleeping', label: null, sublabel: null, href: null });
    });

    return result;
  }, [closing, bloomed, trending]);

  const hoveredLeaf = hovered != null ? leaves[hovered.index] : null;
  const hoveredAnchor = (() => {
    if (!hovered || !containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return {
      left: hovered.clientX - rect.left,
      top: hovered.clientY - rect.top,
    };
  })();

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg
        viewBox="0 0 320 320"
        className="w-full h-full"
        style={{ filter: 'drop-shadow(0 0 32px rgba(232,150,96,0.16))' }}
      >
        <defs>
          <radialGradient id="cosmicHalo" cx="50%" cy="58%" r="55%">
            <stop offset="0%" stopColor="rgba(232,150,96,0.20)" />
            <stop offset="55%" stopColor="rgba(214,115,71,0.05)" />
            <stop offset="100%" stopColor="rgba(10,8,20,0)" />
          </radialGradient>
          {/* Almond-shape leaf body + vein — instanced via <use> on each leaf. */}
          <g id="leafBody">
            <path
              d="M 0 0 C -4.4 -3 -5.4 -9 0 -16 C 5.4 -9 4.4 -3 0 0 Z"
              strokeLinejoin="round"
            />
          </g>
          <g id="leafVein">
            <path d="M 0 -1.2 L 0 -13.6" fill="none" strokeLinecap="round" />
          </g>
        </defs>

        {/* warm halo */}
        <circle cx="160" cy="170" r="155" fill="url(#cosmicHalo)" />

        {/* trunk — gentle S-curve */}
        <path
          d="M 160 304 Q 158 268 162 232 Q 166 196 160 158 Q 155 122 161 86 Q 162 60 160 38"
          stroke={CREAM}
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.82"
        />

        {/* main + secondary branches — drawn so each leaf has a real branch reaching it */}
        <g stroke={CREAM} strokeLinecap="round" fill="none">
          {/* lower-left main */}
          <path d="M 161 232 Q 130 222 96 212 Q 75 207 58 200" strokeWidth="1.3" opacity="0.7" />
          <path d="M 96 212 Q 80 195 70 178 Q 58 168 48 158 Q 42 154 38 152" strokeWidth="1.0" opacity="0.6" />
          {/* lower-right main */}
          <path d="M 161 232 Q 195 222 226 212 Q 248 207 262 200" strokeWidth="1.3" opacity="0.7" />
          <path d="M 226 212 Q 244 195 252 178 Q 268 162 282 152" strokeWidth="1.0" opacity="0.6" />
          {/* mid-left */}
          <path d="M 160 175 Q 130 165 110 158 Q 96 154 92 175" strokeWidth="1.05" opacity="0.65" />
          <path d="M 130 165 Q 120 142 112 116" strokeWidth="0.95" opacity="0.6" />
          {/* mid-right */}
          <path d="M 160 175 Q 192 165 212 158 Q 226 154 228 175" strokeWidth="1.05" opacity="0.65" />
          <path d="M 192 165 Q 200 142 208 116" strokeWidth="0.95" opacity="0.6" />
          {/* upper-left toward upper anchor */}
          <path d="M 158 122 Q 138 108 118 96 Q 92 90 70 92" strokeWidth="0.95" opacity="0.6" />
          <path d="M 138 108 Q 122 86 110 58" strokeWidth="0.85" opacity="0.55" />
          {/* upper-right */}
          <path d="M 162 122 Q 182 108 200 96 Q 215 88 215 60" strokeWidth="0.85" opacity="0.55" />
          {/* crown bough — branches reaching to the bloom slots */}
          <path d="M 160 86 Q 152 72 145 86" strokeWidth="0.8" opacity="0.55" />
          <path d="M 161 86 Q 168 72 175 86" strokeWidth="0.8" opacity="0.55" />
          <path d="M 160 70 Q 148 50 132 36" strokeWidth="0.85" opacity="0.55" />
          <path d="M 161 70 Q 172 50 188 36" strokeWidth="0.85" opacity="0.55" />
          <path d="M 160 50 Q 160 35 160 22" strokeWidth="0.8" opacity="0.5" />
        </g>

        {/* leaves — each anchored at a slot, transformed for rotation/scale */}
        {leaves.map((leaf, i) => {
          const colors = LEAF_COLORS[leaf.state];
          const interactive = leaf.href != null;
          const animClass =
            leaf.state === 'closing-urgent'
              ? 'leaf-pulse-urgent'
              : leaf.state === 'closing'
              ? 'leaf-pulse-warm'
              : leaf.state === 'bloomed'
              ? 'leaf-pulse-soft'
              : leaf.state === 'trending'
              ? 'leaf-pulse-mid'
              : 'leaf-still';
          // Rotating phase via i so leaves don't all pulse in lockstep
          const phase = (i * 0.27) % 3.6;
          return (
            <g
              key={i}
              transform={`translate(${leaf.cx} ${leaf.cy}) rotate(${leaf.rotation}) scale(${leaf.scale})`}
              style={{
                cursor: interactive ? 'pointer' : 'default',
                animationDelay: `${phase}s`,
              }}
              className={animClass}
              onMouseEnter={(e) => {
                if (!leaf.label) return;
                setHovered({ index: i, clientX: e.clientX, clientY: e.clientY });
              }}
              onMouseMove={(e) => {
                if (!leaf.label) return;
                setHovered((prev) =>
                  prev && prev.index === i
                    ? { index: i, clientX: e.clientX, clientY: e.clientY }
                    : prev,
                );
              }}
              onMouseLeave={() => setHovered(null)}
              onClick={() => leaf.href && startTransitionLink(router, leaf.href)}
            >
              {/* Soft glow halo behind each living leaf */}
              {leaf.state !== 'sleeping' && (
                <ellipse
                  cx="0"
                  cy="-8"
                  rx="9"
                  ry="13"
                  fill={colors.fill}
                  opacity="0.16"
                  style={{ filter: 'blur(2.5px)' }}
                />
              )}
              <use
                href="#leafBody"
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={leaf.state === 'sleeping' ? 0.6 : 0.9}
                opacity={leaf.state === 'sleeping' ? 0.7 : 0.95}
              />
              <use href="#leafVein" stroke={colors.vein} strokeWidth={0.5} opacity={0.55} />
            </g>
          );
        })}

        <style>{`
          .leaf-pulse-urgent {
            transform-origin: center;
            transform-box: fill-box;
            animation: leafBeatFast 1.6s ease-in-out infinite;
          }
          .leaf-pulse-warm {
            transform-origin: center;
            transform-box: fill-box;
            animation: leafBeatMid 2.6s ease-in-out infinite;
          }
          .leaf-pulse-soft {
            transform-origin: center;
            transform-box: fill-box;
            animation: leafBreathe 4s ease-in-out infinite;
          }
          .leaf-pulse-mid {
            transform-origin: center;
            transform-box: fill-box;
            animation: leafBeatMid 3.2s ease-in-out infinite;
          }
          .leaf-still { opacity: 1; }
          @keyframes leafBeatFast {
            0%, 100% { filter: brightness(0.94); }
            50% { filter: brightness(1.25) drop-shadow(0 0 5px rgba(232,150,96,0.6)); }
          }
          @keyframes leafBeatMid {
            0%, 100% { filter: brightness(0.96); }
            50% { filter: brightness(1.15) drop-shadow(0 0 4px rgba(236,180,138,0.5)); }
          }
          @keyframes leafBreathe {
            0%, 100% { filter: brightness(1); }
            50% { filter: brightness(1.1) drop-shadow(0 0 5px rgba(236,180,138,0.45)); }
          }
        `}</style>
      </svg>

      {/* Hover tooltip */}
      {hoveredLeaf && hoveredLeaf.label && hoveredAnchor && (
        <div
          className="pointer-events-none absolute z-10 px-3 py-2 mono"
          style={{
            left: hoveredAnchor.left,
            top: hoveredAnchor.top - 12,
            transform: 'translate(-50%, -100%)',
            background: 'rgba(10,8,20,0.94)',
            border: `1px solid ${HAIR_STRONG}`,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            maxWidth: '220px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <p
            className="truncate"
            style={{
              color: CREAM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontSize: '0.78rem',
              fontWeight: 400,
              letterSpacing: 'normal',
              textTransform: 'none',
            }}
          >
            {hoveredLeaf.label}
          </p>
          {hoveredLeaf.sublabel && (
            <p
              className="text-[0.55rem] uppercase tracking-[0.22em] mt-0.5 truncate"
              style={{
                color:
                  hoveredLeaf.state === 'closing-urgent'
                    ? AMBER
                    : hoveredLeaf.state === 'bloomed'
                    ? PEACH
                    : hoveredLeaf.state === 'trending'
                    ? FOREST
                    : CREAM_FAINT,
              }}
            >
              {hoveredLeaf.sublabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Small navigation helper used by leaf click — wraps router.push in a
// transition so the click doesn't block paint of the leaf hover state.
function startTransitionLink(
  router: ReturnType<typeof useRouter>,
  href: string,
) {
  router.push(href);
}

// Activity ticker — fed by useAllMarketsSocket. Rolling buffer of the last 5
// market-update events. Shown only when at least one event has landed.
function useActivityFeed(markets: Market[]) {
  const { marketUpdates, newMarkets } = useAllMarketsSocket();
  const [feed, setFeed] = useState<{ id: string; text: string; ts: number }[]>([]);
  const seenRef = React.useRef<Set<string>>(new Set());

  // marketUpdates is a Map<address, data>; we react to its mutations.
  useEffect(() => {
    if (!marketUpdates || marketUpdates.size === 0) return;
    const entries = Array.from(marketUpdates.entries());
    const latest = entries[entries.length - 1];
    if (!latest) return;
    const [addr, payload] = latest;
    const stamp = `${addr}:${payload?.timestamp || Date.now()}`;
    if (seenRef.current.has(stamp)) return;
    seenRef.current.add(stamp);

    // Resolve a friendly market name from our active list
    const market = markets.find((m) => m.marketAddress === addr);
    const name = market?.name || `${addr.slice(0, 6)}…`;
    setFeed((prev) =>
      [{ id: stamp, text: `${name} just moved`, ts: Date.now() }, ...prev].slice(0, 5),
    );
  }, [marketUpdates, markets]);

  useEffect(() => {
    if (!newMarkets || newMarkets.length === 0) return;
    const m = newMarkets[0];
    const id = `new:${m.id || m.marketAddress}`;
    if (seenRef.current.has(id)) return;
    seenRef.current.add(id);
    setFeed((prev) =>
      [{ id, text: `${m.name || 'A new market'} just opened`, ts: Date.now() }, ...prev].slice(
        0,
        5,
      ),
    );
  }, [newMarkets]);

  return feed;
}

export default function LaunchpadPage() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [launchedProjects, setLaunchedProjects] = useState<LaunchedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLaunched, setLoadingLaunched] = useState(true);
  const [platformStats, setPlatformStats] = useState<{
    totalVotes: number;
    totalPoolVolume: number;
    activeMarkets: number;
    resolvedMarkets: number;
  } | null>(null);

  const { authenticated } = useWallet();
  const { displayName } = useUserProfile();

  useEffect(() => {
    document.title = 'PNL';
  }, []);

  useEffect(() => {
    let alive = true;
    const fetchAll = async () => {
      try {
        const [m, l] = await Promise.all([
          fetch('/api/markets/list').then((r) => r.json()),
          fetch('/api/markets/launched').then((r) => r.json()),
        ]);
        if (!alive) return;
        if (m.success) {
          setMarkets(m.data.markets || []);
          if (m.data.platformStats) setPlatformStats(m.data.platformStats);
        }
        if (l.success) setLaunchedProjects(l.data.launched || []);
      } catch (err) {
        console.error('[launchpad] fetch error', err);
      } finally {
        if (alive) {
          setLoading(false);
          setLoadingLaunched(false);
        }
      }
    };
    fetchAll();
    return () => {
      alive = false;
    };
  }, []);

  // Tick the countdown labels every 30s without re-fetching
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const activeMarkets = useMemo(
    () => markets.filter((m) => m.resolution === 'Unresolved' || !m.resolution),
    [markets],
  );

  // Rail 1 — closing soonest (asc by expiry)
  const closingSoonest = useMemo(() => {
    return [...activeMarkets]
      .filter((m) => m.expiryTime && new Date(m.expiryTime).getTime() > Date.now())
      .sort((a, b) => new Date(a.expiryTime).getTime() - new Date(b.expiryTime).getTime())
      .slice(0, 5);
  }, [activeMarkets]);

  // Rail 2 — just bloomed (desc by launchDate)
  const justBloomed = useMemo(() => {
    return [...launchedProjects]
      .sort((a, b) => new Date(b.launchDate).getTime() - new Date(a.launchDate).getTime())
      .slice(0, 6);
  }, [launchedProjects]);

  // Rail 3 — trending energy (desc by total stake volume; reasonable proxy)
  const trendingEnergy = useMemo(() => {
    return [...activeMarkets]
      .map((m) => ({
        ...m,
        _energy: (Number(m.totalYesStake) || 0) + (Number(m.totalNoStake) || 0),
      }))
      .sort((a, b) => (b._energy || 0) - (a._energy || 0))
      .slice(0, 4);
  }, [activeMarkets]);

  // Adaptive headline + CTA based on platform state and user state
  const adaptive = useMemo(() => {
    const closingHero = closingSoonest[0];
    const closingIn = closingHero ? formatCountdown(closingHero.expiryTime) : null;
    const recentBloom = justBloomed[0];

    // Rule order: closing-soon emergency > recent bloom > generic
    if (closingHero && closingIn?.urgent) {
      return {
        headline: `Closing in ${closingIn.label}.`,
        sub: `${closingHero.name} is live on the bell.`,
        ctaLabel: 'Go vote',
        ctaHref: `/market/${closingHero.id}`,
      };
    }
    if (recentBloom && Date.now() - new Date(recentBloom.launchDate).getTime() < 24 * 3600_000) {
      return {
        headline: `${recentBloom.name} just bloomed.`,
        sub: `Joined the orchard ${formatRelative(recentBloom.launchDate)}.`,
        ctaLabel: 'See the orchard',
        ctaHref: '/launched',
      };
    }
    if (!authenticated) {
      return {
        headline: `Plant something today.`,
        sub: `Predict, launch, and let the grove decide what grows.`,
        ctaLabel: 'Plant your first idea',
        ctaHref: '/create',
      };
    }
    return {
      headline: `Welcome back${displayName ? `, ${displayName}` : ''}.`,
      sub: `${activeMarkets.length} markets growing · ${launchedProjects.length} bloomed.`,
      ctaLabel: 'Wander the grove',
      ctaHref: '/browse',
    };
  }, [authenticated, displayName, closingSoonest, justBloomed, activeMarkets.length, launchedProjects.length]);

  const activityFeed = useActivityFeed(markets);

  return (
    <div className="px-4 sm:px-6 pb-20" style={{ color: CREAM }}>
      <div className="max-w-5xl mx-auto">
        {/* ─────────────── SKY (asymmetric editorial hero) ─────────────── */}
        <section className="relative pt-8 sm:pt-14 pb-10 sm:pb-14">
          <HeroStarfield />

          {/* Folio device — top-left corner editorial stamp */}
          <div className="hidden lg:flex items-center gap-3 absolute top-6 left-0 select-none pointer-events-none">
            <span
              className="mono uppercase tracking-[0.36em] text-[0.55rem]"
              style={{ color: CREAM_FAINT }}
            >
              Folio
            </span>
            <span className="h-px w-10" style={{ background: HAIR_STRONG }} />
            <span
              className="mono uppercase tracking-[0.32em] text-[0.55rem]"
              style={{ color: AMBER }}
            >
              The Pulse · No.{' '}
              {String(
                Math.max(1, (platformStats?.totalVotes ?? activeMarkets.length) % 1000),
              ).padStart(3, '0')}
            </span>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,420px)_1fr] gap-x-10 gap-y-6 items-center">
            {/* Left — Cosmic Grove */}
            <div className="relative w-full max-w-[420px] mx-auto lg:mx-0 aspect-square">
              <CosmicTree
                closing={closingSoonest}
                bloomed={justBloomed}
                trending={trendingEnergy}
              />
              {/* Soft caption under the tree */}
              <p
                className="absolute -bottom-1 left-0 right-0 text-center italic"
                style={{
                  color: CREAM_FAINT,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontStyle: 'italic',
                  fontSize: '0.7rem',
                  letterSpacing: '0.02em',
                }}
              >
                — every leaf is a real market.
              </p>
            </div>

            {/* Right — adaptive headline + CTA */}
            <div className="lg:pl-2 relative">
              <p
                className="mono uppercase tracking-[0.36em] text-[0.58rem] mb-4 text-center lg:text-left flex items-center justify-center lg:justify-start gap-3"
                style={{ color: AMBER }}
              >
                <span className="hidden lg:inline-block h-px w-6" style={{ background: AMBER + '88' }} />
                The pulse
                <span
                  style={{
                    color: CREAM_FAINT,
                    fontFamily: 'var(--font-fraunces, serif)',
                    fontStyle: 'italic',
                    textTransform: 'none',
                    letterSpacing: 'normal',
                    fontSize: '0.85rem',
                  }}
                >
                  ·
                </span>
                <span style={{ color: CREAM_FAINT, fontSize: '0.55rem' }}>now</span>
              </p>

              <h1
                className="leading-[0.98] mb-5 text-center lg:text-left"
                style={{
                  color: CREAM,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontWeight: 350,
                  fontSize: 'clamp(2.4rem, 7vw, 4.6rem)',
                  fontFeatureSettings: '"ss01", "cv11"',
                  letterSpacing: '-0.012em',
                  fontVariationSettings: '"SOFT" 30, "opsz" 144',
                }}
              >
                {adaptive.headline}
              </h1>

              <p
                className="mb-7 max-w-md mx-auto lg:mx-0 text-center lg:text-left"
                style={{
                  color: CREAM_DIM,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontSize: 'clamp(1rem, 1.6vw, 1.15rem)',
                  lineHeight: 1.45,
                }}
              >
                {adaptive.sub}
              </p>

              <div className="flex flex-col sm:flex-row items-center lg:items-start gap-3 sm:gap-5">
                <button
                  onClick={() => startTransition(() => router.push(adaptive.ctaHref))}
                  className="cta mono uppercase tracking-[0.28em] text-[0.7rem] px-6 py-3 transition-colors group inline-flex items-center gap-2.5"
                  style={{ background: AMBER, color: BG }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = PEACH)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = AMBER)}
                >
                  {adaptive.ctaLabel}
                  <span className="cta-arrow inline-block transition-transform">→</span>
                </button>

                <Link
                  href="/browse"
                  prefetch
                  className="mono uppercase tracking-[0.24em] text-[0.6rem] transition-colors"
                  style={{ color: CREAM_DIM }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = AMBER)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_DIM)}
                >
                  or wander the catalog →
                </Link>
              </div>
            </div>
          </div>

          {/* Editorial separator + As-it-happens ticker */}
          <div className="mt-12 sm:mt-16">
            <FoliateRule />
            <ActivityLadder feed={activityFeed} />
          </div>

          <style jsx>{`
            .cta:hover .cta-arrow {
              transform: translateX(3px);
            }
          `}</style>
        </section>

        {/* ─────────────── RAIL I — Closing soonest ─────────────── */}
        <RailHeader
          numeral="I"
          eyebrow="Now"
          title="Closing soonest"
          subtitle="time, the only thing that doesn't compound."
          caption={
            closingSoonest.length > 0
              ? `${closingSoonest.length} markets · counting down`
              : 'nothing closing yet'
          }
          Icon={SunIcon}
        />

        {loading ? (
          <RailLoading />
        ) : closingSoonest.length === 0 ? (
          <RailEmpty Icon={SeedIcon} text="No active markets right now." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
            <ClosingHeroCard market={closingSoonest[0]} />
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {closingSoonest.slice(1, 5).map((m) => (
                <ClosingMiniCard key={m.id} market={m} />
              ))}
            </div>
          </div>
        )}

        <FoliateRule />

        {/* ─────────────── RAIL II — Just bloomed ─────────────── */}
        <RailHeader
          numeral="II"
          eyebrow="Recently"
          title="Just bloomed"
          subtitle="the grove keeps a record of what made it."
          caption={
            justBloomed.length > 0
              ? `${justBloomed.length} tokens · joined the orchard`
              : 'no fresh blooms yet'
          }
          Icon={BloomIcon}
        />

        {loadingLaunched ? (
          <RailLoading />
        ) : justBloomed.length === 0 ? (
          <RailEmpty Icon={BloomIcon} text="The orchard is still growing." />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-14">
            {justBloomed.slice(0, 4).map((p) => (
              <BloomCard key={p.id} project={p} />
            ))}
          </div>
        )}

        <FoliateRule />

        {/* ─────────────── RAIL III — Trending energy ─────────────── */}
        <RailHeader
          numeral="III"
          eyebrow="Buzzing"
          title="Trending energy"
          subtitle="where the most weight has gathered today."
          caption="where the grove is loudest"
          Icon={LeafIcon}
        />

        {loading ? (
          <RailLoading />
        ) : trendingEnergy.length === 0 ? (
          <RailEmpty Icon={LeafIcon} text="The grove is quiet for the moment." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
            {trendingEnergy.map((m) => (
              <TrendingCard key={m.id} market={m as Market & { _energy: number }} />
            ))}
          </div>
        )}

        {/* ─────────────── ALMANAC ─────────────── */}
        <Almanac
          stats={{
            predictions: (platformStats?.totalVotes ?? 0).toLocaleString(),
            pooled: (platformStats?.totalPoolVolume ?? 0).toFixed(1),
            bloomed: launchedProjects.length.toString(),
            voting: (platformStats?.activeMarkets ?? activeMarkets.length).toString(),
          }}
        />

        {/* ─────────────── EDITORIAL CLOSING SPREAD ─────────────── */}
        <section className="pt-16 pb-12 grid lg:grid-cols-[1.2fr_1fr] gap-x-10 gap-y-8 items-start">
          <div>
            <p
              className="mono uppercase tracking-[0.36em] text-[0.6rem] mb-4"
              style={{ color: AMBER }}
            >
              ¶ IV — Your turn
            </p>
            <h2
              className="leading-[1.02] mb-4"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontWeight: 300,
                fontSize: 'clamp(2rem, 5.5vw, 3.6rem)',
                fontFeatureSettings: '"ss01"',
                fontVariationSettings: '"SOFT" 60, "opsz" 144',
                fontStyle: 'italic',
              }}
            >
              Have an idea?
              <br />
              <span style={{ fontStyle: 'normal' }}>Let the grove decide.</span>
            </h2>
            <p
              className="max-w-md italic"
              style={{
                color: CREAM_DIM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: '1.05rem',
                fontStyle: 'italic',
                lineHeight: 1.55,
              }}
            >
              Anyone can plant. The market votes.
              <br />
              If it grows, it launches.
            </p>
          </div>

          <div className="lg:pt-12">
            <div className="flex items-center gap-3 mb-5">
              <span className="h-px flex-1" style={{ background: HAIR_STRONG }} />
              <span
                className="mono uppercase tracking-[0.32em] text-[0.55rem]"
                style={{ color: CREAM_FAINT }}
              >
                begin
              </span>
              <span className="h-px w-8" style={{ background: HAIR_STRONG }} />
            </div>

            <Link
              href="/create"
              prefetch
              className="cta block w-full mono uppercase tracking-[0.28em] text-[0.72rem] px-6 py-4 transition-colors text-center"
              style={{ background: AMBER, color: BG }}
              onMouseEnter={(e) => (e.currentTarget.style.background = PEACH)}
              onMouseLeave={(e) => (e.currentTarget.style.background = AMBER)}
            >
              Plant something{' '}
              <span className="cta-arrow inline-block transition-transform">→</span>
            </Link>

            <p
              className="mono uppercase tracking-[0.26em] text-[0.55rem] mt-4 text-right"
              style={{ color: CREAM_FAINT }}
            >
              0.015 SOL · ~5 min
            </p>

            <p
              className="mt-10 text-right italic"
              style={{
                color: CREAM_FAINT,
                fontFamily: 'var(--font-fraunces, serif)',
                fontStyle: 'italic',
                fontSize: '0.85rem',
              }}
            >
              — pnl
            </p>
          </div>

          <style jsx>{`
            .cta:hover .cta-arrow {
              transform: translateX(4px);
            }
          `}</style>
        </section>
      </div>
    </div>
  );
}

// ───────────────────── Sub-components ─────────────────────

function RailHeader({
  numeral,
  eyebrow,
  title,
  subtitle,
  caption,
  Icon,
}: {
  numeral: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  caption: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-6 mt-2">
      {/* Top row: chapter-mark + caption with rule */}
      <div className="flex items-center gap-3 mb-3">
        <span
          className="mono uppercase tracking-[0.36em] text-[0.6rem]"
          style={{ color: AMBER }}
        >
          ¶ {numeral} — {eyebrow}
        </span>
        <span className="h-px flex-1" style={{ background: HAIR_STRONG }} />
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span
          className="hidden sm:inline mono uppercase tracking-[0.22em] text-[0.55rem]"
          style={{ color: CREAM_FAINT }}
        >
          {caption}
        </span>
      </div>

      {/* Title + italic subtitle */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2
          className="leading-none"
          style={{
            color: CREAM,
            fontFamily: 'var(--font-fraunces, serif)',
            fontWeight: 350,
            fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
            fontFeatureSettings: '"ss01"',
            fontVariationSettings: '"SOFT" 50, "opsz" 144',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="italic"
            style={{
              color: CREAM_FAINT,
              fontFamily: 'var(--font-fraunces, serif)',
              fontStyle: 'italic',
              fontSize: 'clamp(0.85rem, 1.2vw, 1rem)',
              fontVariationSettings: '"SOFT" 100',
            }}
          >
            — {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function RailLoading() {
  return (
    <div className="flex items-center justify-center py-12 mb-12" style={{ color: CREAM_FAINT }}>
      <Loader2 className="w-5 h-5 animate-spin" style={{ color: AMBER }} />
      <span className="ml-3 mono text-[0.6rem] uppercase tracking-[0.24em]">Listening…</span>
    </div>
  );
}

function RailEmpty({
  Icon,
  text,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  text: string;
}) {
  return (
    <div
      className="text-center py-12 mb-12"
      style={{ background: 'rgba(244,238,228,0.02)', border: `1px solid ${HAIR}` }}
    >
      <Icon className="w-8 h-8 mx-auto mb-3" />
      <p
        className="mono text-[0.6rem] uppercase tracking-[0.22em]"
        style={{ color: CREAM_FAINT }}
      >
        {text}
      </p>
    </div>
  );
}

function ClosingHeroCard({ market }: { market: Market }) {
  const { label, urgent } = formatCountdown(market.expiryTime);
  const total = market.yesVotes + market.noVotes;
  const yesPct = total > 0 ? Math.round((market.yesVotes / total) * 100) : 50;

  // For TimeArc — compute fraction remaining vs. an assumed full duration.
  // We don't know the original duration here, so cap at 7 days for visual scale.
  const ms = new Date(market.expiryTime).getTime() - Date.now();
  const totalScale = 7 * 24 * 3600 * 1000;
  const remainingFrac = Math.max(0, Math.min(1, ms / totalScale));

  return (
    <Link
      href={`/market/${market.id}`}
      prefetch
      className="hero-card md:col-span-1 group transition-all block p-5 relative overflow-hidden"
      style={{
        background: 'rgba(232,150,96,0.05)',
        border: `1px solid ${urgent ? AMBER + '55' : HAIR_STRONG}`,
        borderLeft: `2px solid ${urgent ? AMBER : HAIR_STRONG}`,
      }}
    >
      {/* Top row: category chip + time arc + countdown */}
      <div className="flex items-start justify-between mb-3">
        <span
          className="mono text-[0.55rem] uppercase tracking-[0.22em] px-1.5 py-0.5"
          style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
        >
          {formatLabel(market.category)}
        </span>
        <div className="flex items-center gap-2.5">
          <TimeArc fraction={remainingFrac} urgent={urgent} />
          <div className="text-right">
            <p
              className="mono text-[0.5rem] uppercase tracking-[0.22em]"
              style={{ color: CREAM_FAINT }}
            >
              closes in
            </p>
            <p
              className="mono"
              style={{
                color: urgent ? AMBER : CREAM,
                fontSize: '1.05rem',
                letterSpacing: '0.04em',
                fontFeatureSettings: '"tnum" on',
              }}
            >
              {label}
            </p>
          </div>
        </div>
      </div>

      <h3
        className="mb-1 line-clamp-2"
        style={{
          color: CREAM,
          fontFamily: 'var(--font-fraunces, serif)',
          fontWeight: 400,
          fontSize: '1.4rem',
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
          fontVariationSettings: '"SOFT" 30, "opsz" 60',
        }}
      >
        {market.name}
      </h3>
      <p className="text-sm line-clamp-2 mb-4" style={{ color: CREAM_DIM }}>
        {market.description}
      </p>

      {/* YES / NO split bar — single bar, two colors meeting at the boundary */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between mono text-[0.58rem] uppercase tracking-[0.22em]">
          <span style={{ color: FOREST }}>
            <span
              style={{
                fontFamily: 'var(--font-fraunces, serif)',
                fontStyle: 'italic',
                fontSize: '0.95rem',
                letterSpacing: 'normal',
                marginRight: '0.3em',
              }}
            >
              {yesPct}
            </span>
            % YES
          </span>
          <span style={{ color: EARTH }}>
            NO {100 - yesPct}
            <span
              style={{
                fontFamily: 'var(--font-fraunces, serif)',
                fontStyle: 'italic',
                fontSize: '0.95rem',
                letterSpacing: 'normal',
                marginLeft: '0.15em',
              }}
            >
              %
            </span>
          </span>
        </div>
        <div className="relative h-1.5 w-full overflow-hidden" style={{ background: HAIR_STRONG }}>
          <div
            className="absolute inset-y-0 left-0 transition-all duration-500"
            style={{ width: `${yesPct}%`, background: FOREST }}
          />
          <div
            className="absolute inset-y-0 transition-all duration-500"
            style={{
              left: `${yesPct}%`,
              right: 0,
              background: 'rgba(214,115,71,0.35)',
            }}
          />
        </div>
      </div>

      {/* Hover-only flourish */}
      <span
        className="hero-flourish absolute bottom-3 right-3 mono uppercase tracking-[0.26em] text-[0.5rem] opacity-0 transition-opacity"
        style={{ color: AMBER }}
      >
        enter →
      </span>

      <style jsx>{`
        .hero-card:hover {
          border-color: ${AMBER + 'aa'} !important;
          transform: translateY(-1px);
        }
        .hero-card:hover .hero-flourish {
          opacity: 1;
        }
      `}</style>
    </Link>
  );
}

function ClosingMiniCard({ market }: { market: Market }) {
  const { label, urgent } = formatCountdown(market.expiryTime);
  const total = market.yesVotes + market.noVotes;
  const yesPct = total > 0 ? Math.round((market.yesVotes / total) * 100) : 50;
  return (
    <Link
      href={`/market/${market.id}`}
      prefetch
      className="mini-card block p-4 transition-all relative"
      style={{
        background: 'rgba(244,238,228,0.025)',
        border: `1px solid ${HAIR_STRONG}`,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <h4
          className="line-clamp-1 flex-1"
          style={{
            color: CREAM,
            fontFamily: 'var(--font-fraunces, serif)',
            fontWeight: 400,
            fontSize: '0.98rem',
            letterSpacing: '-0.005em',
          }}
        >
          {market.name}
        </h4>
        <span
          className="mono text-[0.58rem] uppercase tracking-[0.18em] flex-shrink-0"
          style={{
            color: urgent ? AMBER : CREAM_FAINT,
            fontFeatureSettings: '"tnum" on',
          }}
        >
          {label}
        </span>
      </div>
      <div className="flex items-center justify-between mono uppercase tracking-[0.2em] text-[0.55rem]">
        <span style={{ color: FOREST }}>
          <span
            style={{
              fontFamily: 'var(--font-fraunces, serif)',
              fontStyle: 'italic',
              fontSize: '0.85rem',
              letterSpacing: 'normal',
              marginRight: '0.25em',
            }}
          >
            {yesPct}
          </span>
          % yes
        </span>
        <span style={{ color: CREAM_FAINT }}>
          {total} {total === 1 ? 'vote' : 'votes'}
        </span>
      </div>
      <div className="h-1 w-full mt-2" style={{ background: HAIR }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${yesPct}%`, background: FOREST }}
        />
      </div>
      <style jsx>{`
        .mini-card:hover {
          border-color: ${AMBER + '88'};
          transform: translateY(-1px);
        }
      `}</style>
    </Link>
  );
}

function BloomCard({ project }: { project: LaunchedToken }) {
  return (
    <Link
      href={`/market/${project.id}`}
      prefetch
      className="bloom-card block transition-all relative"
      style={{
        background: 'rgba(244,238,228,0.025)',
        border: `1px solid ${HAIR_STRONG}`,
      }}
    >
      <div
        className="aspect-square overflow-hidden flex items-center justify-center relative"
        style={{ background: 'rgba(236,180,138,0.08)' }}
      >
        {project.projectImageUrl ? (
          <img
            src={project.projectImageUrl}
            alt={project.name}
            className="bloom-img w-full h-full object-cover transition-transform duration-700"
          />
        ) : (
          <BloomIcon className="w-10 h-10" />
        )}
        {/* Bloomed badge, top-right */}
        <span
          className="absolute top-2 right-2 mono uppercase tracking-[0.22em] text-[0.5rem] px-1.5 py-0.5"
          style={{
            background: 'rgba(10,8,20,0.7)',
            color: PEACH,
            backdropFilter: 'blur(4px)',
          }}
        >
          ● bloomed
        </span>
      </div>
      <div className="px-3 py-3">
        <div className="flex items-center justify-between mb-1 gap-2">
          <h4
            className="line-clamp-1 flex-1"
            style={{
              color: CREAM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontWeight: 400,
              fontSize: '0.98rem',
            }}
          >
            {project.name}
          </h4>
          <span
            className="mono text-[0.55rem] uppercase tracking-[0.18em] flex-shrink-0"
            style={{ color: AMBER }}
          >
            {project.symbol}
          </span>
        </div>
        <p
          className="mono italic text-[0.66rem]"
          style={{
            color: CREAM_FAINT,
            fontFamily: 'var(--font-fraunces, serif)',
            fontStyle: 'italic',
            textTransform: 'none',
            letterSpacing: 'normal',
          }}
        >
          joined {formatRelative(project.launchDate)}
        </p>
      </div>
      <style jsx>{`
        .bloom-card:hover {
          border-color: ${PEACH + 'aa'};
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
        }
        .bloom-card:hover .bloom-img {
          transform: scale(1.05);
        }
      `}</style>
    </Link>
  );
}

function TrendingCard({ market }: { market: Market & { _energy?: number } }) {
  const energy = market._energy || 0;
  const total = market.yesVotes + market.noVotes;
  const yesPct = total > 0 ? Math.round((market.yesVotes / total) * 100) : 50;
  return (
    <Link
      href={`/market/${market.id}`}
      prefetch
      className="trending-card block p-5 transition-all relative"
      style={{
        background: 'rgba(244,238,228,0.025)',
        border: `1px solid ${HAIR_STRONG}`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-14 h-14 flex-shrink-0 flex items-center justify-center overflow-hidden"
          style={{
            background: 'rgba(63,122,66,0.12)',
            border: `1px solid ${FOREST}55`,
          }}
        >
          {market.projectImageUrl ? (
            <img
              src={market.projectImageUrl}
              alt={market.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <TreeIcon className="w-6 h-6" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4
            className="line-clamp-1 mb-0.5"
            style={{
              color: CREAM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontWeight: 400,
              fontSize: '1.1rem',
              letterSpacing: '-0.005em',
            }}
          >
            {market.name}
          </h4>
          <p className="text-xs line-clamp-1 mb-2.5" style={{ color: CREAM_DIM }}>
            {market.description}
          </p>
          <div className="flex items-center gap-2.5 mono uppercase tracking-[0.2em] text-[0.55rem]">
            <span style={{ color: FOREST }}>
              <span
                style={{
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontStyle: 'italic',
                  fontSize: '0.95rem',
                  letterSpacing: 'normal',
                  marginRight: '0.25em',
                }}
              >
                {yesPct}
              </span>
              % yes
            </span>
            <span className="h-px w-3" style={{ background: HAIR_STRONG }} />
            <span style={{ color: PEACH }}>
              <span
                style={{
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontStyle: 'italic',
                  fontSize: '0.95rem',
                  letterSpacing: 'normal',
                  marginRight: '0.25em',
                }}
              >
                {(energy / 1_000_000_000).toFixed(2)}
              </span>
              SOL pooled
            </span>
          </div>
        </div>
      </div>

      {/* Subtle "vine" graphic — appears on hover, drawn as a quarter-arc in the bottom-right */}
      <svg
        className="trending-vine absolute bottom-2 right-2 opacity-0 transition-opacity"
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        aria-hidden
      >
        <path
          d="M 4 20 Q 12 18 18 12 Q 22 8 22 4"
          stroke={FOREST}
          strokeWidth="0.9"
          strokeLinecap="round"
          opacity="0.7"
        />
        <ellipse cx="22" cy="4" rx="1.6" ry="2.4" fill={FOREST} opacity="0.85" />
        <ellipse cx="14" cy="14" rx="1.4" ry="2.2" fill={FOREST} opacity="0.6" transform="rotate(-30 14 14)" />
      </svg>

      <style jsx>{`
        .trending-card:hover {
          border-color: ${FOREST + 'aa'};
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
        }
        .trending-card:hover .trending-vine {
          opacity: 1;
        }
      `}</style>
    </Link>
  );
}

// ────────────────────── Editorial almanac ──────────────────────
// Replaces the old 4-tile stat grid with a magazine-edge ledger:
// labels in mono small-caps, numbers in *Fraunces serif* with old-style
// numerals, hairline columns between, italic "as of now" device on top.
function Almanac({
  stats,
}: {
  stats: { predictions: string; pooled: string; bloomed: string; voting: string };
}) {
  const entries: Array<{ label: string; value: string; unit?: string; hint: string }> = [
    { label: 'Predictions', value: stats.predictions, hint: 'all time' },
    { label: 'Pooled', value: stats.pooled, unit: 'SOL', hint: 'on the line' },
    { label: 'Bloomed', value: stats.bloomed, hint: 'launched' },
    { label: 'Voting now', value: stats.voting, hint: 'this minute' },
  ];

  return (
    <section className="mb-2 mt-4" aria-label="Platform almanac">
      <div className="flex items-center gap-3 mb-4">
        <span className="h-px w-6" style={{ background: AMBER + '88' }} />
        <span
          className="mono uppercase tracking-[0.36em] text-[0.6rem]"
          style={{ color: AMBER }}
        >
          The almanac
        </span>
        <span className="h-px flex-1" style={{ background: HAIR_STRONG }} />
        <span
          className="mono uppercase tracking-[0.24em] text-[0.55rem] italic"
          style={{
            color: CREAM_FAINT,
            fontFamily: 'var(--font-fraunces, serif)',
            fontStyle: 'italic',
            textTransform: 'none',
            letterSpacing: 'normal',
            fontSize: '0.78rem',
          }}
        >
          as of now
        </span>
      </div>

      <div
        className="grid grid-cols-2 md:grid-cols-4"
        style={{
          borderTop: `1px solid ${HAIR_STRONG}`,
          borderBottom: `1px solid ${HAIR_STRONG}`,
        }}
      >
        {entries.map((e, i) => (
          <div
            key={e.label}
            className="px-4 sm:px-6 py-6"
            style={{
              borderRight:
                i < entries.length - 1 ? `1px solid ${HAIR_STRONG}` : 'none',
              // On mobile the 4th tile bleeds — turn off the right border on
              // the second column too
            }}
          >
            <p
              className="mono uppercase tracking-[0.26em] text-[0.55rem] mb-2.5"
              style={{ color: CREAM_FAINT }}
            >
              {e.label}
            </p>
            <p
              className="leading-none mb-1.5"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontWeight: 350,
                fontSize: 'clamp(2rem, 4.5vw, 3.4rem)',
                fontFeatureSettings: '"onum" on, "tnum" on, "ss01" on',
                fontVariationSettings: '"SOFT" 30, "opsz" 144',
                letterSpacing: '-0.015em',
              }}
            >
              {e.value}
              {e.unit && (
                <span
                  className="mono ml-2"
                  style={{
                    color: AMBER,
                    fontSize: '0.4em',
                    letterSpacing: '0.18em',
                    verticalAlign: '0.4em',
                  }}
                >
                  {e.unit}
                </span>
              )}
            </p>
            <p
              className="italic"
              style={{
                color: CREAM_FAINT,
                fontFamily: 'var(--font-fraunces, serif)',
                fontStyle: 'italic',
                fontSize: '0.72rem',
              }}
            >
              {e.hint}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ────────────────────── Foliate ornament rule ──────────────────────
// Drawn vine-and-leaf flourish used between sections — replaces a generic
// horizontal rule. Cream stroke, very thin. The flourish itself is an
// asymmetric two-leaf vine echoing the cosmic tree's leaf shape.
function FoliateRule() {
  return (
    <div
      className="my-12 sm:my-16 flex items-center gap-4 select-none pointer-events-none"
      aria-hidden
    >
      <span className="h-px flex-1" style={{ background: HAIR_STRONG }} />
      <svg
        viewBox="0 0 56 16"
        width="56"
        height="16"
        fill="none"
        style={{ flexShrink: 0 }}
      >
        {/* central stem */}
        <path d="M 28 2 L 28 14" stroke={CREAM} strokeWidth="0.7" opacity="0.55" />
        {/* left leaf — almond */}
        <path
          d="M 28 8 C 22 7 18 4 16 8 C 18 12 22 9 28 8 Z"
          fill={CREAM}
          opacity="0.45"
          stroke={CREAM}
          strokeWidth="0.4"
        />
        <path d="M 28 8 L 17.5 8" stroke="rgba(122,68,40,0.6)" strokeWidth="0.3" />
        {/* right leaf — slightly bigger */}
        <path
          d="M 28 8 C 34 6.5 38.5 3 41 7 C 38.5 11.5 34 9.5 28 8 Z"
          fill={AMBER}
          opacity="0.48"
          stroke={AMBER}
          strokeWidth="0.4"
        />
        <path d="M 28 8 L 40 7" stroke="rgba(122,68,40,0.6)" strokeWidth="0.3" />
        {/* tiny seed at top + bottom */}
        <circle cx="28" cy="2" r="0.9" fill={AMBER} opacity="0.85" />
        <circle cx="28" cy="14" r="0.7" fill={CREAM} opacity="0.4" />
      </svg>
      <span className="h-px flex-1" style={{ background: HAIR_STRONG }} />
    </div>
  );
}

// ────────────────────── Hero starfield (local + parallax) ──────────────────────
// A small, intentionally-sparse local starfield that floats around the
// cosmic tree. Colors pulled from the warm cosmic palette (peach/amber/
// cream). Stars drift slightly with mouse parallax for an organic
// "everything is breathing" feel. SSR-safe: we generate positions client-side
// and don't paint until mounted.
function HeroStarfield() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [stars, setStars] = useState<
    Array<{ x: number; y: number; r: number; color: string; opacity: number; depth: number; delay: number }>
  >([]);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const palette = [PEACH, AMBER, CREAM, '#d99875'];
    const generated = Array.from({ length: 28 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      r: 0.7 + Math.random() * 1.6,
      color: palette[Math.floor(Math.random() * palette.length)],
      opacity: 0.18 + Math.random() * 0.45,
      depth: 0.3 + Math.random() * 1.2, // for parallax magnitude
      delay: Math.random() * 6,
    }));
    setStars(generated);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const nx = (e.clientX - cx) / r.width;
      const ny = (e.clientY - cy) / r.height;
      setParallax({ x: nx, y: ny });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 0 }}
    >
      {stars.map((s, i) => {
        const tx = parallax.x * 8 * s.depth;
        const ty = parallax.y * 8 * s.depth;
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.r}px`,
              height: `${s.r}px`,
              borderRadius: '50%',
              background: s.color,
              opacity: s.opacity,
              boxShadow: `0 0 ${s.r * 2.2}px ${s.color}`,
              transform: `translate(${tx}px, ${ty}px)`,
              transition: 'transform 600ms cubic-bezier(0.22,0.61,0.36,1)',
              animation: `heroStarTwinkle ${4 + (i % 4)}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        );
      })}
      <style jsx>{`
        @keyframes heroStarTwinkle {
          0%, 100% { filter: brightness(0.7); }
          50% { filter: brightness(1.4); }
        }
      `}</style>
    </div>
  );
}

// ────────────────────── Activity Ladder ──────────────────────
// Replaces the single-line ticker with a vertical timeline of the last 3
// events. Beating dot anchors the most recent. Older events fade & italicize.
// Empty state shows a contemplative placeholder so the section never goes
// blank — the rhythm of the page is preserved.
function ActivityLadder({
  feed,
}: {
  feed: { id: string; text: string; ts: number }[];
}) {
  const items = feed.slice(0, 3);
  return (
    <div className="grid lg:grid-cols-[1fr_minmax(0,420px)] gap-x-8 gap-y-6 items-start">
      <div className="hidden lg:block">
        <p
          className="mono uppercase tracking-[0.36em] text-[0.58rem] mb-3"
          style={{ color: CREAM_FAINT }}
        >
          As it happens
        </p>
        <p
          className="italic max-w-sm"
          style={{
            color: CREAM_DIM,
            fontFamily: 'var(--font-fraunces, serif)',
            fontStyle: 'italic',
            fontSize: '0.95rem',
            lineHeight: 1.45,
          }}
        >
          Every vote moves the grove. Watch the leaves quicken below as decisions
          land in real time.
        </p>
      </div>

      <div
        className="relative"
        style={{
          background: 'rgba(244,238,228,0.018)',
          border: `1px solid ${HAIR}`,
          padding: '1.25rem 1.5rem',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <span
            className="mono uppercase tracking-[0.32em] text-[0.55rem]"
            style={{ color: AMBER }}
          >
            ● Live
          </span>
          <span
            className="mono uppercase tracking-[0.22em] text-[0.5rem]"
            style={{ color: CREAM_FAINT }}
          >
            last 3 events
          </span>
        </div>

        {items.length === 0 ? (
          <p
            className="italic"
            style={{
              color: CREAM_FAINT,
              fontFamily: 'var(--font-fraunces, serif)',
              fontStyle: 'italic',
              fontSize: '0.85rem',
            }}
          >
            The grove is quiet. New votes will appear here as they land.
          </p>
        ) : (
          <ul className="relative pl-5">
            {/* timeline rule */}
            <span
              className="absolute left-1.5 top-1.5 bottom-1.5 w-px"
              style={{ background: HAIR_STRONG }}
              aria-hidden
            />
            {items.map((it, i) => (
              <li key={it.id} className="relative mb-3 last:mb-0">
                <span
                  className="absolute -left-[14px] top-1"
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: i === 0 ? AMBER : CREAM_FAINT,
                    boxShadow: i === 0 ? `0 0 8px ${AMBER}` : 'none',
                    animation: i === 0 ? 'beat 1.2s ease-in-out infinite' : undefined,
                  }}
                  aria-hidden
                />
                <p
                  className="text-sm leading-tight"
                  style={{
                    color: i === 0 ? CREAM : CREAM_DIM,
                    fontFamily: 'var(--font-fraunces, serif)',
                    fontStyle: i === 0 ? 'normal' : 'italic',
                    fontSize: i === 0 ? '0.95rem' : '0.85rem',
                  }}
                >
                  {it.text}
                </p>
                <p
                  className="mono uppercase tracking-[0.22em] text-[0.5rem] mt-0.5"
                  style={{ color: CREAM_FAINT }}
                >
                  {formatRelative(new Date(it.ts).toISOString())}
                </p>
              </li>
            ))}
          </ul>
        )}

        <style jsx>{`
          @keyframes beat {
            0%, 100% { transform: scale(1); opacity: 0.85; }
            50% { transform: scale(1.4); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}

// ────────────────────── TimeArc ──────────────────────
// Compact circular arc visualizing time remaining on a closing market.
// The arc fills counterclockwise as time elapses (so a fresh market shows
// a full ring; an urgent one shows a sliver). Color shifts amber when
// urgent, peach otherwise. Pure SVG, no JS animation needed.
function TimeArc({ fraction, urgent }: { fraction: number; urgent: boolean }) {
  const size = 26;
  const r = 10;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  // Visible arc length proportional to remaining
  const offset = circ * (1 - fraction);
  const stroke = urgent ? AMBER : PEACH;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ flexShrink: 0 }}
      aria-hidden
    >
      <circle cx={cx} cy={cy} r={r} stroke={HAIR_STRONG} strokeWidth="1.5" fill="none" />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        stroke={stroke}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circ} ${circ}`}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
      />
      {/* center dot when urgent — beating */}
      {urgent && (
        <circle cx={cx} cy={cy} r="1.6" fill={stroke}>
          <animate
            attributeName="opacity"
            values="0.4;1;0.4"
            dur="1.2s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </svg>
  );
}
