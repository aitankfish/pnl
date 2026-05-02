'use client';

/**
 * /research/inbox
 *
 * Auth-walled inbox of citation requests addressed to the connected
 * wallet. Each pending row gives the cited author a deliberate
 * accept/reject action; accepted/rejected rows show as history when the
 * "show all" toggle is on.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, X, Loader2 } from 'lucide-react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { useWallet } from '@/hooks/useWallet';
import { useToast } from '@/lib/hooks/useToast';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

type CitationStatus = 'pending' | 'accepted' | 'rejected';

interface InboxItem {
  id: string;
  status: CitationStatus;
  role: 'thesis' | 'foundation' | 'reference';
  citationNote: string | null;
  createdAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  paper: {
    id: string;
    title: string;
    currentVersion: number;
  };
  project: {
    id: string;
    name: string;
    tokenSymbol: string;
    category: string;
    projectImageUrl: string | null;
  };
  founder: { wallet: string };
  market: {
    address: string;
    state: number;
    resolution: 'Unresolved' | 'YesWins' | 'NoWins' | 'Refund';
    expiryTime: string | null;
  } | null;
}

export default function InboxPage() {
  const { authenticated, primaryWallet } = useWallet();
  const { showToast } = useToast();

  const [showAll, setShowAll] = useState(false);
  const [items, setItems] = useState<InboxItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authenticated || !primaryWallet) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const url = `/api/research/inbox${showAll ? '?status=all' : ''}`;
      const res = await authFetch(url);
      const json = await res.json();
      if (json?.success) {
        setItems(json.data?.citations || []);
      } else {
        setItems([]);
      }
    } catch (err) {
      logger.error('[research/inbox] load failed', err as any);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [authenticated, primaryWallet, showAll]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, action: 'accept' | 'reject') => {
    setBusyId(id);
    try {
      const res = await authFetch(
        `/api/research/citations/${id}/${action}`,
        { method: 'POST' },
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error || `Failed to ${action}`);
      // Optimistically update.
      setItems((prev) =>
        prev
          ? prev.map((c) =>
              c.id === id
                ? {
                    ...c,
                    status: action === 'accept' ? 'accepted' : 'rejected',
                  }
                : c,
            )
          : prev,
      );
      showToast({
        type: 'success',
        title: action === 'accept' ? '✓ Accepted' : '✗ Rejected',
        message:
          action === 'accept'
            ? 'The citation is now visible on both pages.'
            : 'The citation will not appear publicly.',
      });
    } catch (err) {
      logger.error(`[inbox/${action}]`, err as any);
      showToast({
        type: 'error',
        title: `Couldn’t ${action}`,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setBusyId(null);
    }
  };

  const visible = useMemo(() => {
    if (!items) return [];
    return showAll ? items : items.filter((i) => i.status === 'pending');
  }, [items, showAll]);
  const pendingCount = useMemo(
    () => (items ? items.filter((i) => i.status === 'pending').length : 0),
    [items],
  );

  return (
    <div style={{ color: CREAM, minHeight: '100vh' }}>
      <div className="px-4 sm:px-6 pb-20">
        <div className="max-w-3xl mx-auto pt-8 sm:pt-12">
          {/* Header */}
          <header className="mb-10">
            <p
              className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-3"
              style={{ color: AMBER }}
            >
              Citation inbox
            </p>
            <h1
              className="leading-[1.05] mb-3"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontWeight: 350,
                fontSize: 'clamp(2rem, 5vw, 3rem)',
                fontFeatureSettings: '"ss01"',
                letterSpacing: '-0.01em',
              }}
            >
              Who’s building on your work.
            </h1>
            <p
              className="max-w-prose"
              style={{
                fontFamily: 'var(--font-fraunces, serif)',
                color: CREAM_DIM,
                fontSize: '1.05rem',
                lineHeight: 1.5,
              }}
            >
              When a project cites one of your papers, it shows up here. Accepted
              citations appear publicly on both the project and the paper.
            </p>
          </header>

          {/* Toggle */}
          <div className="mb-6 flex items-center gap-2">
            <ToggleChip
              label={`Pending${pendingCount > 0 ? ` · ${pendingCount}` : ''}`}
              active={!showAll}
              onClick={() => setShowAll(false)}
            />
            <ToggleChip
              label="All"
              active={showAll}
              onClick={() => setShowAll(true)}
            />
          </div>

          {/* Auth-required state */}
          {!authenticated && (
            <EmptyState
              title="Connect your wallet."
              hint="Citation requests are addressed to your wallet — connect to read them."
            />
          )}

          {/* Loading */}
          {authenticated && loading && (
            <div
              className="flex items-center gap-3 py-10"
              style={{ color: CREAM_DIM }}
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="mono uppercase tracking-[0.22em] text-[0.6rem]">
                fetching citations…
              </span>
            </div>
          )}

          {/* Empty state */}
          {authenticated && !loading && visible.length === 0 && (
            <EmptyState
              title={showAll ? 'No citations yet.' : 'Inbox quiet.'}
              hint={
                showAll
                  ? 'When researchers cite your work, the activity will be archived here.'
                  : 'No pending citation requests right now.'
              }
            />
          )}

          {/* Rows */}
          {authenticated && !loading && visible.length > 0 && (
            <ul className="space-y-3">
              {visible.map((c) => (
                <li key={c.id}>
                  <CitationCard
                    item={c}
                    busy={busyId === c.id}
                    onAccept={() => act(c.id, 'accept')}
                    onReject={() => act(c.id, 'reject')}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mono uppercase tracking-[0.22em] text-[0.6rem] px-3 py-2 transition-colors"
      style={{
        background: active ? AMBER : 'transparent',
        color: active ? '#0a0814' : CREAM_DIM,
        border: `1px solid ${active ? AMBER : HAIR_STRONG}`,
      }}
    >
      {label}
    </button>
  );
}

function CitationCard({
  item,
  busy,
  onAccept,
  onReject,
}: {
  item: InboxItem;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const isPending = item.status === 'pending';
  const statusColor =
    item.status === 'accepted'
      ? FOREST
      : item.status === 'rejected'
      ? EARTH
      : AMBER;
  return (
    <div
      className="p-4 sm:p-5"
      style={{
        background: 'rgba(244,238,228,0.025)',
        border: `1px solid ${HAIR_STRONG}`,
      }}
    >
      <div className="flex items-start gap-3">
        {item.project.projectImageUrl && (
          <div
            className="w-12 h-12 flex-shrink-0 overflow-hidden"
            style={{ border: `1px solid ${HAIR_STRONG}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.project.projectImageUrl}
              alt={item.project.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1 mb-1">
            <Link
              href={`/market/${item.market?.address || item.project.id}`}
              className="line-clamp-1 underline-offset-4 hover:underline"
              style={{
                color: CREAM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: '1.1rem',
                fontWeight: 400,
              }}
            >
              {item.project.name}
            </Link>
            <span
              className="mono uppercase tracking-[0.22em] text-[0.55rem]"
              style={{ color: AMBER }}
            >
              ${item.project.tokenSymbol}
            </span>
            <span
              className="mono uppercase tracking-[0.22em] text-[0.5rem] ml-auto"
              style={{ color: statusColor }}
            >
              {item.status}
            </span>
          </div>
          <p
            className="mono uppercase tracking-[0.22em] text-[0.55rem] mb-3"
            style={{ color: CREAM_FAINT }}
          >
            cites your{' '}
            <Link
              href={`/research/${item.paper.id}`}
              className="underline-offset-4 hover:underline"
              style={{ color: CREAM_DIM }}
            >
              {item.paper.title}
            </Link>
            {' '}as{' '}
            <span style={{ color: CREAM_DIM }}>{item.role}</span>
          </p>

          {item.citationNote && (
            <p
              className="text-sm italic mb-4"
              style={{
                color: CREAM_DIM,
                fontFamily: 'var(--font-fraunces, serif)',
                borderLeft: `1px solid ${HAIR_STRONG}`,
                paddingLeft: '0.75rem',
                lineHeight: 1.5,
              }}
            >
              “{item.citationNote}”
            </p>
          )}

          {isPending && (
            <div className="flex items-center flex-wrap gap-2">
              <button
                type="button"
                onClick={onAccept}
                disabled={busy}
                className="mono uppercase tracking-[0.22em] text-[0.6rem] px-3 py-2 transition-colors inline-flex items-center gap-1.5 disabled:cursor-wait"
                style={{
                  background: FOREST,
                  color: '#fff',
                  border: `1px solid ${FOREST}`,
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Check className="w-3.5 h-3.5" /> accept
              </button>
              <button
                type="button"
                onClick={onReject}
                disabled={busy}
                className="mono uppercase tracking-[0.22em] text-[0.6rem] px-3 py-2 transition-colors inline-flex items-center gap-1.5 disabled:cursor-wait"
                style={{
                  background: 'transparent',
                  color: EARTH,
                  border: `1px solid ${EARTH}88`,
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <X className="w-3.5 h-3.5" /> reject
              </button>
              <Link
                href={`/research/${item.paper.id}`}
                className="mono uppercase tracking-[0.22em] text-[0.55rem] ml-auto inline-flex items-center gap-1"
                style={{ color: CREAM_FAINT }}
              >
                read your paper <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div
      className="text-center py-16 px-6"
      style={{ background: 'rgba(244,238,228,0.02)', border: `1px solid ${HAIR}` }}
    >
      <h3
        className="mb-2"
        style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '1.4rem' }}
      >
        {title}
      </h3>
      <p
        className="mx-auto max-w-md italic"
        style={{
          color: CREAM_DIM,
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '1rem',
        }}
      >
        {hint}
      </p>
    </div>
  );
}
