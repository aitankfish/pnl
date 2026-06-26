'use client';

/**
 * Author-only control to group a paper into a research program and set its
 * lineage (the paper it builds on). Lets papers that were published before
 * programs existed — or before their siblings did — join a program and form a
 * "builds on" chain retroactively, via POST /api/research/[id]/program.
 */

import React, { useEffect, useState } from 'react';
import { Loader2, Check, Layers } from 'lucide-react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { useToast } from '@/lib/hooks/useToast';

const CREAM = '#f4eee4';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const BG = '#0a0814';

interface ProgramLite {
  id: string;
  slug: string;
  title: string;
}
interface SiblingPaper {
  id: string;
  title: string;
}

export function PaperProgramControl({
  paperId,
  ownerWallet,
  initialProgramId,
  initialParentPaperId,
}: {
  paperId: string;
  ownerWallet: string;
  initialProgramId: string | null;
  initialParentPaperId: string | null;
}) {
  const { showToast } = useToast();
  const [programs, setPrograms] = useState<ProgramLite[]>([]);
  const [choice, setChoice] = useState<string>(initialProgramId || ''); // '' | id | '__new__'
  const [newTitle, setNewTitle] = useState('');
  const [siblings, setSiblings] = useState<SiblingPaper[]>([]);
  const [parentId, setParentId] = useState<string>(initialParentPaperId || '');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  // Load the author's programs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/research/programs?owner=${encodeURIComponent(ownerWallet)}`);
        const json = await res.json();
        if (!cancelled && json?.success) {
          setPrograms((json.data.programs || []).map((p: any) => ({ id: p.id, slug: p.slug, title: p.title })));
        }
      } catch {
        /* picker just stays empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ownerWallet]);

  // When a real program is selected, load its papers so the "builds on" picker
  // can offer siblings (excluding this paper).
  useEffect(() => {
    const prog = programs.find((p) => p.id === choice);
    if (!prog) {
      setSiblings([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/research/programs/${prog.slug}`);
        const json = await res.json();
        if (!cancelled && json?.success) {
          setSiblings(
            (json.data.papers || [])
              .filter((p: any) => p.id !== paperId)
              .map((p: any) => ({ id: p.id, title: p.title })),
          );
        }
      } catch {
        setSiblings([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [choice, programs, paperId]);

  const dirty =
    choice !== (initialProgramId || '') || parentId !== (initialParentPaperId || '');

  const save = async () => {
    setSaving(true);
    try {
      // Resolve the program id, creating a new program if named inline.
      let programId: string | null = null;
      if (choice === '__new__') {
        const title = newTitle.trim();
        if (!title) throw new Error('Name the new program first.');
        const res = await authFetch('/api/research/programs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to create program');
        programId = json.data.id;
      } else {
        programId = choice || null;
      }

      const res = await authFetch(`/api/research/${paperId}/program`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ programId, parentPaperId: programId ? parentId || null : null }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to save');

      setSavedAt(Date.now());
      showToast({ type: 'success', title: 'Program updated', message: 'Reloading…' });
      // Reflect the change (program badge, lineage on the program page).
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Couldn’t update the program',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  };

  const hasProgram = choice && choice !== '';

  return (
    <div className="mt-10 px-5 py-4" style={{ border: `1px solid ${HAIR}`, background: 'rgba(244,238,228,0.025)' }}>
      <p
        className="mono uppercase tracking-[0.28em] text-[0.55rem] mb-3 inline-flex items-center gap-2"
        style={{ color: AMBER }}
      >
        <Layers className="w-3 h-3" />
        Program &amp; lineage · only you can see this
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <label className="flex-1">
          <span className="block mono uppercase tracking-[0.2em] text-[0.5rem] mb-1.5" style={{ color: CREAM_FAINT }}>
            Research program
          </span>
          <select
            value={choice}
            onChange={(e) => {
              setChoice(e.target.value);
              setParentId('');
            }}
            style={selectStyle}
          >
            <option value="" style={{ background: BG }}>
              None — standalone
            </option>
            {programs.map((p) => (
              <option key={p.id} value={p.id} style={{ background: BG }}>
                {p.title}
              </option>
            ))}
            <option value="__new__" style={{ background: BG }}>
              + New program…
            </option>
          </select>
          {choice === '__new__' && (
            <input
              type="text"
              placeholder="Program name (e.g. Nakshatra)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={120}
              style={{ ...selectStyle, marginTop: '0.5rem' }}
            />
          )}
        </label>

        {hasProgram && choice !== '__new__' && (
          <label className="flex-1">
            <span className="block mono uppercase tracking-[0.2em] text-[0.5rem] mb-1.5" style={{ color: CREAM_FAINT }}>
              Builds on
            </span>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} style={selectStyle}>
              <option value="" style={{ background: BG }}>
                Nothing — this is a root
              </option>
              {siblings.map((s) => (
                <option key={s.id} value={s.id} style={{ background: BG }}>
                  {s.title.length > 48 ? `${s.title.slice(0, 48)}…` : s.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-3 mt-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="mono uppercase tracking-[0.2em] text-[0.55rem] px-4 py-2 transition-colors inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: AMBER, color: BG }}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : savedAt ? <Check className="w-3.5 h-3.5" /> : null}
          {saving ? 'Saving' : 'Save grouping'}
        </button>
        {choice !== '__new__' && (
          <span className="mono uppercase tracking-[0.18em] text-[0.5rem]" style={{ color: CREAM_FAINT }}>
            Set the program first; “builds on” lists its other papers.
          </span>
        )}
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: 'transparent',
  color: CREAM,
  width: '100%',
  padding: '0.6rem 0.75rem',
  fontSize: '0.95rem',
  border: `1px solid ${HAIR}`,
  outline: 'none',
  fontFamily: 'var(--font-fraunces, serif)',
  appearance: 'none',
};
