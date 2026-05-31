'use client';

// Generative-UI market card rendered inline in the concierge chat (/ask).
// The concierge (server) stays read-only and never holds keys — every action
// here is signed by the user's already-connected browser wallet via the same
// hooks the rest of the app uses (useVoting / useClaiming) or an authed POST
// (favorite). Cards are built from the agent's tool output (MarketBrief).

import { useState } from 'react';
import Link from 'next/link';
import {
  Heart,
  ArrowUpRight,
  Check,
  Loader2,
  Users,
  Clock,
  Plus,
  Minus,
  Sprout,
  Award,
  AlertCircle,
} from 'lucide-react';
import { useVoting } from '@/lib/hooks/useVoting';
import { useClaiming } from '@/lib/hooks/useClaiming';
import { useWallet } from '@/hooks/useWallet';
import { useAuthModal } from '@/contexts/AuthModalContext';
import { authFetch } from '@/lib/auth/fetch-with-auth';

export interface ConciergeMarket {
  id: string;
  name: string;
  category?: string | null;
  yesPercent?: number | null;
  poolSol?: number | null;
  participants?: number | null;
  status?: string;
  resolution?: string | null;
  timeLeft?: string | null;
  founder?: string | null;
  marketAddress?: string | null;
  url?: string;
}

const CREAM = '#f4eee4';
const DIM = 'rgba(244,238,228,0.65)';
const FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.12)';
const AMBER = '#e89660';
const FOREST = '#5a9e5d';
const RED = '#e0876f';

function isResolved(m: ConciergeMarket): boolean {
  return !!m.resolution && m.resolution !== 'Unresolved';
}
function endingSoon(t?: string | null): boolean {
  return !!t && /hour|min|soon/i.test(t);
}

type ActState = 'idle' | 'signing' | 'done' | 'error';

export function MarketCard({ market: m }: { market: ConciergeMarket }) {
  const { primaryWallet, authenticated } = useWallet();
  const { showAuthModal } = useAuthModal();
  const { vote } = useVoting();
  const { claim } = useClaiming();

  const [faved, setFaved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [amount, setAmount] = useState(0.05);
  const [voteState, setVoteState] = useState<ActState>('idle');
  const [voteMsg, setVoteMsg] = useState('');
  const [claimState, setClaimState] = useState<ActState>('idle');
  const [claimMsg, setClaimMsg] = useState('');

  const resolved = isResolved(m);
  const urgent = endingSoon(m.timeLeft);
  const needsAuth = !authenticated || !primaryWallet;

  async function toggleFav() {
    if (needsAuth) return showAuthModal();
    const next = !faved;
    setFaved(next); // optimistic
    try {
      await authFetch(`/api/profile/${primaryWallet!.address}/favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId: m.id }),
      });
    } catch {
      setFaved(!next); // revert on failure
    }
  }

  async function doVote() {
    if (needsAuth) return showAuthModal();
    if (!m.marketAddress) {
      setVoteState('error');
      setVoteMsg('This market has no on-chain address yet.');
      return;
    }
    setVoteState('signing');
    setVoteMsg('');
    const r = await vote({ marketId: m.id, marketAddress: m.marketAddress, voteType: side, amount });
    if (r.success) {
      setVoteState('done');
      setVoteMsg(`Staked ${amount} SOL on ${side.toUpperCase()}`);
    } else {
      setVoteState('error');
      setVoteMsg(typeof r.error === 'string' ? r.error : 'Vote failed');
    }
  }

  async function doClaim() {
    if (needsAuth) return showAuthModal();
    if (!m.marketAddress) return;
    setClaimState('signing');
    setClaimMsg('');
    const r = await claim({ marketId: m.id, marketAddress: m.marketAddress });
    if (r.success) {
      setClaimState('done');
      setClaimMsg(r.claimAmount != null ? `Claimed ${r.claimAmount} ${r.claimType ?? ''}`.trim() : 'Claimed');
    } else {
      setClaimState('error');
      setClaimMsg(typeof r.error === 'string' ? r.error : 'Nothing to claim');
    }
  }

  const adj = (d: number) => setAmount((a) => Math.max(0.01, Math.round((a + d) * 100) / 100));

  return (
    <div
      className="group rounded-xl border p-3.5 transition-colors"
      style={{ borderColor: HAIR, background: 'rgba(244,238,228,0.03)' }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(232,150,96,0.35)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = HAIR)}
    >
      {/* Header: name + category + favorite */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={m.url || `#`}
            className="block truncate font-medium leading-tight"
            style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '1rem' }}
          >
            {m.name}
          </Link>
          {m.category && (
            <span
              className="mt-1 inline-block rounded px-1.5 py-0.5 text-[0.5rem] uppercase tracking-[0.18em]"
              style={{ background: 'rgba(232,150,96,0.12)', color: AMBER }}
            >
              {m.category}
            </span>
          )}
        </div>
        <button
          onClick={toggleFav}
          className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-white/5"
          style={{ color: faved ? AMBER : FAINT }}
          aria-label={faved ? 'Unfavorite' : 'Favorite'}
          title="Favorite"
        >
          <Heart className="h-4 w-4" fill={faved ? AMBER : 'none'} />
        </button>
      </div>

      {/* Conviction bar (only when revealed, i.e. resolved/has data) */}
      {m.yesPercent != null && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[0.55rem] uppercase tracking-[0.16em]" style={{ color: FAINT }}>
            <span style={{ color: FOREST }}>{Math.round(m.yesPercent)}% YES</span>
            <span style={{ color: AMBER }}>{100 - Math.round(m.yesPercent)}% NO</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(232,150,96,0.25)' }}>
            <div className="h-full rounded-full" style={{ width: `${m.yesPercent}%`, background: FOREST }} />
          </div>
        </div>
      )}

      {/* Meta row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.62rem]" style={{ color: DIM }}>
        <span className="inline-flex items-center gap-1">
          <Sprout className="h-3 w-3" style={{ color: FOREST }} />
          {m.poolSol != null ? `${m.poolSol} SOL` : '—'}
        </span>
        {m.participants != null && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {m.participants}
          </span>
        )}
        {m.timeLeft && (
          <span
            className="inline-flex items-center gap-1"
            style={urgent ? { color: AMBER } : undefined}
          >
            <Clock className="h-3 w-3" />
            {urgent ? 'Ending soon' : `${m.timeLeft} left`}
          </span>
        )}
        {resolved && (
          <span className="rounded px-1.5 py-0.5 text-[0.5rem] uppercase tracking-[0.16em]" style={{ background: 'rgba(90,158,93,0.15)', color: FOREST }}>
            {m.resolution}
          </span>
        )}
      </div>

      {m.founder && (
        <p className="mt-1.5 text-[0.62rem]" style={{ color: FAINT }}>
          by {m.founder}
        </p>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2 border-t pt-3" style={{ borderColor: HAIR }}>
        {!resolved ? (
          <button
            onClick={() => setExpanded((x) => !x)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity"
            style={{ background: AMBER, color: '#1a1208' }}
          >
            {expanded ? 'Hide' : 'Vote'}
          </button>
        ) : (
          <button
            onClick={doClaim}
            disabled={claimState === 'signing' || claimState === 'done'}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity disabled:opacity-60"
            style={{ background: claimState === 'done' ? 'rgba(90,158,93,0.18)' : AMBER, color: claimState === 'done' ? FOREST : '#1a1208' }}
          >
            {claimState === 'signing' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />}
            {claimState === 'done' ? 'Claimed' : claimState === 'signing' ? 'Confirm…' : 'Claim'}
          </button>
        )}
        <Link
          href={m.url || '#'}
          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs transition-colors hover:bg-white/5"
          style={{ color: DIM, border: `1px solid ${HAIR}` }}
        >
          View <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        {claimState === 'error' && (
          <span className="inline-flex items-center gap-1 text-[0.62rem]" style={{ color: RED }}>
            <AlertCircle className="h-3 w-3" /> {claimMsg}
          </span>
        )}
      </div>

      {/* Vote expander */}
      {expanded && !resolved && (
        <div className="mt-3 rounded-lg border p-3" style={{ borderColor: HAIR, background: 'rgba(0,0,0,0.2)' }}>
          {voteState === 'done' ? (
            <p className="inline-flex items-center gap-1.5 text-xs" style={{ color: FOREST }}>
              <Check className="h-4 w-4" /> {voteMsg}
            </p>
          ) : (
            <>
              {/* YES / NO */}
              <div className="flex gap-2">
                {(['yes', 'no'] as const).map((s) => {
                  const on = side === s;
                  const col = s === 'yes' ? FOREST : AMBER;
                  return (
                    <button
                      key={s}
                      onClick={() => setSide(s)}
                      className="flex-1 rounded-lg py-1.5 text-xs font-medium uppercase tracking-wider transition-colors"
                      style={{
                        background: on ? (s === 'yes' ? 'rgba(90,158,93,0.18)' : 'rgba(232,150,96,0.18)') : 'transparent',
                        color: on ? col : FAINT,
                        border: `1px solid ${on ? col : HAIR}`,
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              {/* Amount stepper */}
              <div className="mt-2.5 flex items-center justify-between">
                <span className="text-[0.6rem] uppercase tracking-wider" style={{ color: FAINT }}>
                  Stake (SOL)
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => adj(-0.01)} className="rounded-md p-1" style={{ border: `1px solid ${HAIR}`, color: CREAM }} aria-label="Less">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-12 text-center text-sm" style={{ color: CREAM }}>
                    {amount.toFixed(2)}
                  </span>
                  <button onClick={() => adj(0.01)} className="rounded-md p-1" style={{ border: `1px solid ${HAIR}`, color: CREAM }} aria-label="More">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
              {/* Confirm */}
              <button
                onClick={doVote}
                disabled={voteState === 'signing'}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-opacity disabled:opacity-60"
                style={{
                  background: side === 'yes' ? FOREST : AMBER,
                  color: side === 'yes' ? '#0a1a0b' : '#1a1208',
                }}
              >
                {voteState === 'signing' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {voteState === 'signing'
                  ? 'Confirm in your wallet…'
                  : `Stake ${amount.toFixed(2)} SOL on ${side.toUpperCase()}`}
              </button>
              {needsAuth && (
                <p className="mt-2 text-center text-[0.6rem]" style={{ color: FAINT }}>
                  You&apos;ll be asked to connect your wallet first.
                </p>
              )}
              {voteState === 'error' && (
                <p className="mt-2 inline-flex items-center gap-1 text-[0.62rem]" style={{ color: RED }}>
                  <AlertCircle className="h-3 w-3" /> {voteMsg}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function MarketCardStack({ markets }: { markets: ConciergeMarket[] }) {
  if (!markets?.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {markets.map((m) => (
        <MarketCard key={m.id} market={m} />
      ))}
    </div>
  );
}
