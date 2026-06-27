'use client';

/**
 * Git Digest — the founder's "draft a progress update from my repo" button.
 *
 * Reads recent commits/PRs/releases, asks the LLM to draft a short update, then
 * lets the founder EDIT and route it: post it to the Updates feed, or (if they
 * authored the cited paper) propose it as the paper's new summary. The LLM only
 * proposes — nothing publishes without the founder's edit + click. Founder-only;
 * renders nothing for everyone else.
 */

import React, { useState } from 'react';
import { Loader2, Sparkles, X, FileText, MessageSquarePlus } from 'lucide-react';
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
const BG = '#0a0814';

const PAPER_SUMMARY_MAX = 500;

interface Draft {
  draft: { title: string; body: string };
  stats: { commits: number; prs: number; releases: number };
  repo: string;
  paper: { id: string; title: string; authorWallet: string; isAuthor: boolean } | null;
}

type Route = 'update' | 'paper';

export function GitDigest({
  marketId,
  founderWallet,
  onPosted,
}: {
  marketId: string;
  founderWallet: string | null;
  onPosted: () => void;
}) {
  const { primaryWallet, authenticated } = useWallet();
  const { showToast } = useToast();
  const wallet = primaryWallet?.address || null;
  const isFounder = !!authenticated && !!wallet && wallet === founderWallet;

  const [drafting, setDrafting] = useState(false);
  const [data, setData] = useState<Draft | null>(null);
  const [body, setBody] = useState('');
  const [route, setRoute] = useState<Route>('update');
  const [changelog, setChangelog] = useState('Progress update from git activity');
  const [submitting, setSubmitting] = useState(false);

  if (!isFounder) return null;

  const generate = async () => {
    setDrafting(true);
    try {
      const res = await authFetch(`/api/markets/${marketId}/digest`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to draft');
      setData(json.data);
      setBody(json.data.draft.body);
      setRoute('update');
    } catch (e) {
      showToast({ type: 'error', title: 'Couldn’t draft', message: e instanceof Error ? e.message : '' });
    } finally {
      setDrafting(false);
    }
  };

  const reset = () => {
    setData(null);
    setBody('');
    setChangelog('Progress update from git activity');
  };

  const postUpdate = async () => {
    const text = body.trim();
    if (!text) {
      showToast({ type: 'error', title: 'The update is empty', message: '' });
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('body', text);
      const res = await authFetch(`/api/markets/${marketId}/posts`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to post');
      showToast({ type: 'success', title: 'Posted to Updates', message: '' });
      reset();
      onPosted();
    } catch (e) {
      showToast({ type: 'error', title: 'Couldn’t post', message: e instanceof Error ? e.message : '' });
    } finally {
      setSubmitting(false);
    }
  };

  const proposePaper = async () => {
    if (!data?.paper) return;
    const summary = body.trim();
    if (!summary) {
      showToast({ type: 'error', title: 'The summary is empty', message: '' });
      return;
    }
    if (summary.length > PAPER_SUMMARY_MAX) {
      showToast({ type: 'error', title: `Trim to ${PAPER_SUMMARY_MAX} characters`, message: 'A paper summary is short by design.' });
      return;
    }
    if (!changelog.trim()) {
      showToast({ type: 'error', title: 'Add a changelog note', message: '' });
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('summary', summary);
      fd.append('changelog', changelog.trim());
      const res = await authFetch(`/api/research/${data.paper.id}/version`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed');
      showToast({ type: 'success', title: `Published as v${json.data?.currentVersion ?? ''}`, message: '' });
      reset();
    } catch (e) {
      showToast({ type: 'error', title: 'Couldn’t update paper', message: e instanceof Error ? e.message : '' });
    } finally {
      setSubmitting(false);
    }
  };

  // Collapsed: just the trigger.
  if (!data) {
    return (
      <div className="pb-4 mb-1" style={{ borderBottom: `1px solid ${HAIR}` }}>
        <button
          type="button"
          onClick={generate}
          disabled={drafting}
          className="inline-flex items-center gap-2 mono uppercase tracking-[0.18em] text-[0.6rem] px-3.5 py-2 rounded-full disabled:opacity-50"
          style={{ border: `1px solid ${HAIR}`, color: drafting ? CREAM_FAINT : AMBER }}
        >
          {drafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {drafting ? 'Reading the repo…' : 'Draft from git'}
        </button>
      </div>
    );
  }

  const overPaperLimit = route === 'paper' && body.trim().length > PAPER_SUMMARY_MAX;
  const canPaper = !!data.paper?.isAuthor;

  return (
    <div className="pb-5 mb-1 p-3 rounded-lg" style={{ border: `1px solid ${HAIR}` }}>
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5" style={{ color: AMBER }} />
        <span className="mono uppercase tracking-[0.18em] text-[0.55rem]" style={{ color: CREAM_DIM }}>
          AI draft · review before publishing
        </span>
        <button type="button" onClick={reset} className="ml-auto" style={{ color: CREAM_FAINT }} title="Discard">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="mono text-[0.55rem] mb-2" style={{ color: CREAM_FAINT }}>
        {data.repo} · {data.stats.commits} commits · {data.stats.prs} PRs · {data.stats.releases} releases
      </p>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        className="w-full bg-transparent outline-none resize-none"
        style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.98rem', lineHeight: 1.55 }}
      />

      {/* Route switch */}
      <div className="flex items-center gap-1.5 mt-2 mb-3">
        <RouteTab active={route === 'update'} onClick={() => setRoute('update')} icon={<MessageSquarePlus className="w-3 h-3" />} label="Post update" />
        <RouteTab
          active={route === 'paper'}
          onClick={() => canPaper && setRoute('paper')}
          icon={<FileText className="w-3 h-3" />}
          label="Update paper"
          disabled={!canPaper}
          title={canPaper ? undefined : 'Only the cited paper’s author can revise its summary'}
        />
        {route === 'paper' && (
          <span className="ml-auto mono text-[0.55rem]" style={{ color: overPaperLimit ? '#cf7a6f' : CREAM_FAINT }}>
            {body.trim().length}/{PAPER_SUMMARY_MAX}
          </span>
        )}
      </div>

      {route === 'paper' && (
        <input
          type="text"
          value={changelog}
          onChange={(e) => setChangelog(e.target.value)}
          placeholder="Changelog note (what changed)"
          maxLength={500}
          className="w-full bg-transparent outline-none mono text-[0.62rem] py-1 mb-3"
          style={{ color: CREAM_DIM, borderBottom: `1px solid ${HAIR}` }}
        />
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={route === 'update' ? postUpdate : proposePaper}
          disabled={submitting || overPaperLimit}
          className="mono uppercase tracking-[0.2em] text-[0.55rem] px-4 py-2 rounded-full inline-flex items-center gap-2 disabled:opacity-40"
          style={{ background: AMBER, color: BG }}
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {route === 'update' ? 'Post to Updates' : 'Propose new version'}
        </button>
        <button type="button" onClick={generate} disabled={drafting || submitting} className="mono uppercase tracking-[0.2em] text-[0.55rem]" style={{ color: CREAM_FAINT }}>
          {drafting ? 'Redrafting…' : 'Redraft'}
        </button>
      </div>
    </div>
  );
}

function RouteTab({
  active,
  onClick,
  icon,
  label,
  disabled,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="mono text-[0.55rem] px-2.5 py-1 rounded-full inline-flex items-center gap-1 disabled:opacity-30"
      style={{
        border: `1px solid ${active ? AMBER : HAIR}`,
        color: active ? AMBER : CREAM_DIM,
        background: active ? 'rgba(232,150,96,0.08)' : 'transparent',
      }}
    >
      {icon} {label}
    </button>
  );
}
