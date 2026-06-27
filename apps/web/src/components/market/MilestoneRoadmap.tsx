'use client';

/**
 * Milestone Roadmap — the back-the-builder resolution surface in the rail.
 *
 * A founder declares "I'll ship X by <date>", optionally bound to a GitHub
 * release/tag. PNL doesn't judge the work — it reads the git signal the founder
 * controls and flips the milestone: a matching release/tag ships it, a passed
 * deadline misses it. Off-chain status only (the on-chain stake is untouched).
 * Once shipped or missed a milestone is frozen — the founder can't erase a miss.
 */

import React, { useEffect, useState } from 'react';
import { Loader2, Plus, X, Trash2, ExternalLink, Tag, CircleDot, Check, Clock } from 'lucide-react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { useWallet } from '@/hooks/useWallet';
import { useToast } from '@/lib/hooks/useToast';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.12)';
const AMBER = '#e89660';
const GREEN = '#5fbf8f';
const RED = '#cf7a6f';
const BG = '#0a0814';

type Status = 'open' | 'shipped' | 'missed';
type Trigger = 'release' | 'tag' | 'manual';

interface Milestone {
  id: string;
  title: string;
  detail: string | null;
  targetDate: string;
  triggerType: Trigger;
  triggerMatch: string | null;
  status: Status;
  evidenceUrl: string | null;
  shippedAt: string | null;
  order: number;
  createdAt: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dueLabel(iso: string, status: Status) {
  if (status === 'shipped') return 'shipped';
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (status === 'missed') return 'missed';
  if (days < 0) return 'overdue';
  if (days === 0) return 'due today';
  if (days === 1) return 'in 1 day';
  if (days < 30) return `in ${days} days`;
  return `by ${fmtDate(iso)}`;
}

const STATUS_COLOR: Record<Status, string> = { open: CREAM_FAINT, shipped: GREEN, missed: RED };

export function MilestoneRoadmap({ marketId, founderWallet }: { marketId: string; founderWallet: string | null }) {
  const { primaryWallet, authenticated } = useWallet();
  const wallet = primaryWallet?.address || null;
  const [items, setItems] = useState<Milestone[]>([]);
  const [resolvedFounder, setResolvedFounder] = useState<string | null>(founderWallet);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const isFounder = !!authenticated && !!wallet && wallet === resolvedFounder;

  const load = async () => {
    try {
      const res = await fetch(`/api/markets/${marketId}/milestones`);
      const json = await res.json();
      if (json.success) {
        setItems(json.data.milestones || []);
        setResolvedFounder(json.data.founderWallet || founderWallet);
      }
    } catch (e) {
      logger.error('[roadmap] load failed', e as any);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId]);

  const shipped = items.filter((m) => m.status === 'shipped').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6" style={{ color: CREAM_FAINT }}>
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }

  // Nothing to show and not the founder → render nothing (no empty scaffold).
  if (items.length === 0 && !isFounder) return null;

  return (
    <div className="pt-4 mt-4" style={{ borderTop: `1px solid ${HAIR}` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="mono uppercase tracking-[0.2em] text-[0.6rem]" style={{ color: CREAM_DIM }}>
          Roadmap{items.length > 0 ? ` · ${shipped}/${items.length} shipped` : ''}
        </span>
        {isFounder && !adding && (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 mono text-[0.6rem]" style={{ color: AMBER }}>
            <Plus className="w-3 h-3" /> add
          </button>
        )}
      </div>

      {isFounder && adding && (
        <DeclareForm
          marketId={marketId}
          onCancel={() => setAdding(false)}
          onCreated={(m) => {
            setItems((prev) => [...prev, m]);
            setAdding(false);
          }}
        />
      )}

      {items.length === 0 && isFounder && !adding ? (
        <p className="text-[0.78rem] leading-relaxed" style={{ color: CREAM_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}>
          Declare what you’ll ship and by when. A matching GitHub release or tag settles it — no one has to judge.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((m) => (
            <MilestoneRow
              key={m.id}
              m={m}
              marketId={marketId}
              isFounder={isFounder}
              onChange={(next) => setItems((prev) => prev.map((x) => (x.id === next.id ? next : x)))}
              onRemove={(rid) => setItems((prev) => prev.filter((x) => x.id !== rid))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MilestoneRow({
  m,
  marketId,
  isFounder,
  onChange,
  onRemove,
}: {
  m: Milestone;
  marketId: string;
  isFounder: boolean;
  onChange: (m: Milestone) => void;
  onRemove: (id: string) => void;
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [shipUrl, setShipUrl] = useState('');
  const [shipping, setShipping] = useState(false);

  const color = STATUS_COLOR[m.status];
  const StatusIcon = m.status === 'shipped' ? Check : m.status === 'missed' ? X : CircleDot;

  const remove = async () => {
    if (!window.confirm('Remove this milestone?')) return;
    setBusy(true);
    try {
      const res = await authFetch(`/api/markets/${marketId}/milestones/${m.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      onRemove(m.id);
    } catch (e) {
      showToast({ type: 'error', title: 'Couldn’t remove', message: e instanceof Error ? e.message : '' });
      setBusy(false);
    }
  };

  const markShipped = async () => {
    const url = shipUrl.trim();
    if (!url) {
      showToast({ type: 'error', title: 'Add an evidence link', message: '' });
      return;
    }
    setBusy(true);
    try {
      const res = await authFetch(`/api/markets/${marketId}/milestones/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markShipped: true, evidenceUrl: url }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      onChange(json.data);
      setShipping(false);
    } catch (e) {
      showToast({ type: 'error', title: 'Couldn’t mark shipped', message: e instanceof Error ? e.message : '' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-2.5">
      <StatusIcon className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="text-[0.85rem] leading-snug" style={{ color: m.status === 'open' ? CREAM : CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)' }}>
            {m.title}
          </span>
          {isFounder && m.status === 'open' && (
            <button type="button" onClick={remove} disabled={busy} className="ml-auto shrink-0" style={{ color: CREAM_FAINT }} title="Remove">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>

        {m.detail && (
          <p className="text-[0.72rem] mt-0.5 leading-relaxed" style={{ color: CREAM_FAINT }}>{m.detail}</p>
        )}

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="mono text-[0.55rem] inline-flex items-center gap-1" style={{ color }}>
            <Clock className="w-2.5 h-2.5" /> {dueLabel(m.targetDate, m.status)}
          </span>
          {m.triggerType !== 'manual' && m.triggerMatch && (
            <span className="mono text-[0.55rem] inline-flex items-center gap-1" style={{ color: CREAM_FAINT }}>
              <Tag className="w-2.5 h-2.5" /> {m.triggerMatch}
            </span>
          )}
          {m.evidenceUrl && (
            <a href={m.evidenceUrl} target="_blank" rel="noopener noreferrer" className="mono text-[0.55rem] inline-flex items-center gap-1 hover:underline" style={{ color: GREEN }}>
              proof <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>

        {/* Founder manual-settle for 'manual' milestones. */}
        {isFounder && m.status === 'open' && m.triggerType === 'manual' && (
          shipping ? (
            <div className="flex items-center gap-1.5 mt-1.5">
              <input
                type="text"
                value={shipUrl}
                onChange={(e) => setShipUrl(e.target.value)}
                placeholder="Evidence link (PR, demo, release)…"
                className="flex-1 bg-transparent outline-none mono text-[0.6rem] py-1"
                style={{ color: CREAM, borderBottom: `1px solid ${HAIR}` }}
              />
              <button type="button" onClick={markShipped} disabled={busy} style={{ color: GREEN }} title="Confirm shipped">
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button type="button" onClick={() => setShipping(false)} style={{ color: CREAM_FAINT }}><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <button type="button" onClick={() => setShipping(true)} className="mono text-[0.55rem] mt-1.5" style={{ color: AMBER }}>
              mark shipped →
            </button>
          )
        )}
      </div>
    </div>
  );
}

function DeclareForm({
  marketId,
  onCancel,
  onCreated,
}: {
  marketId: string;
  onCancel: () => void;
  onCreated: (m: Milestone) => void;
}) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [date, setDate] = useState('');
  const [trigger, setTrigger] = useState<Trigger>('manual');
  const [match, setMatch] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      showToast({ type: 'error', title: 'Add a title', message: '' });
      return;
    }
    if (!date) {
      showToast({ type: 'error', title: 'Pick a target date', message: '' });
      return;
    }
    if (trigger !== 'manual' && !match.trim()) {
      showToast({ type: 'error', title: 'Add the tag or release name to match', message: '' });
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(`/api/markets/${marketId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          detail: detail.trim() || undefined,
          targetDate: new Date(date).toISOString(),
          triggerType: trigger,
          triggerMatch: trigger === 'manual' ? undefined : match.trim(),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed');
      onCreated(json.data);
    } catch (e) {
      showToast({ type: 'error', title: 'Couldn’t add milestone', message: e instanceof Error ? e.message : '' });
    } finally {
      setSaving(false);
    }
  };

  const fieldStyle = { color: CREAM, borderBottom: `1px solid ${HAIR}`, background: 'transparent' } as React.CSSProperties;

  return (
    <div className="mb-4 p-3 rounded-lg" style={{ border: `1px solid ${HAIR}` }}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What will you ship?"
        maxLength={140}
        className="w-full outline-none text-[0.85rem] py-1 mb-2"
        style={{ ...fieldStyle, fontFamily: 'var(--font-fraunces, serif)' }}
        autoFocus
      />
      <input
        type="text"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="One line of detail (optional)"
        maxLength={500}
        className="w-full outline-none mono text-[0.65rem] py-1 mb-3"
        style={fieldStyle}
      />
      <div className="flex items-center gap-2 mb-3">
        <label className="mono uppercase tracking-[0.15em] text-[0.5rem]" style={{ color: CREAM_FAINT }}>by</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="outline-none mono text-[0.65rem] py-1"
          style={{ ...fieldStyle, colorScheme: 'dark' }}
        />
      </div>

      <div className="mb-2">
        <span className="mono uppercase tracking-[0.15em] text-[0.5rem]" style={{ color: CREAM_FAINT }}>settles when</span>
        <div className="flex items-center gap-1.5 mt-1.5">
          {(['manual', 'release', 'tag'] as Trigger[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTrigger(t)}
              className="mono text-[0.55rem] px-2.5 py-1 rounded-full"
              style={{
                border: `1px solid ${trigger === t ? AMBER : HAIR}`,
                color: trigger === t ? AMBER : CREAM_DIM,
                background: trigger === t ? 'rgba(232,150,96,0.08)' : 'transparent',
              }}
            >
              {t === 'manual' ? 'I mark it' : `git ${t}`}
            </button>
          ))}
        </div>
      </div>

      {trigger !== 'manual' && (
        <input
          type="text"
          value={match}
          onChange={(e) => setMatch(e.target.value)}
          placeholder={trigger === 'release' ? 'Release tag/name e.g. v0.5.0' : 'Tag name e.g. v0.5.0'}
          maxLength={120}
          className="w-full outline-none mono text-[0.65rem] py-1 mb-1"
          style={fieldStyle}
        />
      )}

      <div className="flex items-center gap-3 mt-3">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="mono uppercase tracking-[0.2em] text-[0.55rem] px-4 py-1.5 rounded-full inline-flex items-center gap-1.5 disabled:opacity-40"
          style={{ background: AMBER, color: BG }}
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
          Declare
        </button>
        <button type="button" onClick={onCancel} className="mono uppercase tracking-[0.2em] text-[0.55rem]" style={{ color: CREAM_FAINT }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
