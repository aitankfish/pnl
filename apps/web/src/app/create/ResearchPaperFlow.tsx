'use client';

/**
 * Research Paper submission flow.
 *
 * Phase 1: sentiment-only. Single-screen form (PDF + author + X handle + optional
 * title/summary). No on-chain transaction. POSTs to /api/research/create then
 * routes the user to the new paper's detail page.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Check, X } from 'lucide-react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { useToast } from '@/lib/hooks/useToast';
import { useWallet } from '@/hooks/useWallet';
import { createClientLogger } from '@/lib/logger';
import { SeedIcon } from '@/components/PlantIcons';
import { KindTabs } from './KindTabs';

const logger = createClientLogger();

// Shared cosmic-plant palette (kept in sync with create/page.tsx).
const BG = '#0a0814';
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const PEACH = '#ecb48a';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

const MAX_PDF_MB = 25;
const MAX_SUMMARY_CHARS = 500;

interface PaperFormData {
  title: string;
  authorName: string;
  authorXHandle: string;
  summary: string;
  githubUrl: string;
  doi: string;
  externalUrl: string;
  paper?: File;
}

const initialData: PaperFormData = {
  title: '',
  authorName: '',
  authorXHandle: '',
  summary: '',
  githubUrl: '',
  doi: '',
  externalUrl: '',
};

function looksLikeGithubRepoUrl(input: string): boolean {
  const cleaned = input.trim().replace(/^https?:\/\//i, '').replace(/^github\.com\//i, '');
  const parts = cleaned.split(/[/?#]/).filter(Boolean);
  if (parts.length < 2) return false;
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  return /^[A-Za-z0-9_.-]+$/.test(owner) && /^[A-Za-z0-9_.-]+$/.test(repo);
}

export function ResearchPaperFlow({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { primaryWallet, authenticated } = useWallet();

  const [data, setData] = useState<PaperFormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Paste-a-DOI autofill: pull title/author/abstract from the DOI registry so a
  // researcher who already published (Zenodo, arXiv, a journal) barely types.
  const [doiInput, setDoiInput] = useState('');
  const [resolvingDoi, setResolvingDoi] = useState(false);
  const [doiError, setDoiError] = useState<string | null>(null);
  const [doiSource, setDoiSource] = useState<string | null>(null);
  // Optional research-program grouping. The author can drop this paper into one
  // of their existing programs, or name a new one inline.
  const [programs, setPrograms] = useState<Array<{ id: string; title: string }>>([]);
  const [programChoice, setProgramChoice] = useState<string>(''); // '' | program id | '__new__'
  const [newProgramTitle, setNewProgramTitle] = useState('');
  // After a successful publish we hand the page to a short celebration
  // (parity with the plant flow's PlantingCelebration) rather than silently
  // bouncing to the paper page. From there the author can read the paper or
  // turn it straight into a market.
  const [published, setPublished] = useState<{ paperId: string; title: string } | null>(null);

  const setField = (field: keyof PaperFormData, value: any) => {
    setData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as string]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    }
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!data.title.trim()) e.title = 'Give your paper a title.';
    else if (data.title.length > 255) e.title = 'Title must be 255 characters or fewer.';

    if (!data.authorName.trim()) e.authorName = 'Author name is required.';
    else if (data.authorName.length > 120) e.authorName = 'Keep author name under 120 characters.';

    if (data.authorXHandle.trim()) {
      const stripped = data.authorXHandle.trim().replace(/^@+/, '');
      if (!/^[A-Za-z0-9_]{1,15}$/.test(stripped)) {
        e.authorXHandle = 'X handles are 1–15 characters, letters/numbers/underscore only.';
      }
    }

    if (data.summary.length > MAX_SUMMARY_CHARS) {
      e.summary = `Summary must be under ${MAX_SUMMARY_CHARS} characters.`;
    }

    if (data.githubUrl.trim() && !looksLikeGithubRepoUrl(data.githubUrl)) {
      e.githubUrl = 'Should look like github.com/owner/repo.';
    }

    // A paper needs a body: either an uploaded PDF or a published-source link
    // (DOI / external URL). With a DOI attached, the PDF is optional.
    const hasPublishedSource = !!data.doi.trim() || !!data.externalUrl.trim();
    if (data.paper) {
      if (data.paper.type !== 'application/pdf') e.paper = 'Only PDF files are accepted.';
      else if (data.paper.size > MAX_PDF_MB * 1024 * 1024) {
        e.paper = `PDF must be ${MAX_PDF_MB}MB or smaller.`;
      }
    } else if (!hasPublishedSource) {
      e.paper = 'Attach a PDF, or paste a DOI above to publish.';
    }

    return e;
  };

  const resolveDoi = async () => {
    const input = doiInput.trim();
    if (!input) return;
    setResolvingDoi(true);
    setDoiError(null);
    setDoiSource(null);
    try {
      const res = await fetch('/api/research/resolve-doi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Could not resolve that DOI.');
      const d = json.data;
      setData((prev) => ({
        ...prev,
        doi: d.doi || '',
        externalUrl: d.externalUrl || '',
        // Fill metadata from the registry; the author can still edit below.
        title: d.title || prev.title,
        authorName: d.authorName || prev.authorName,
        summary: (d.summary || prev.summary || '').slice(0, MAX_SUMMARY_CHARS),
      }));
      setDoiSource(d.source || d.doi || 'the DOI registry');
      // Clear any stale field errors the autofill just satisfied.
      setErrors({});
    } catch (err) {
      setDoiError(err instanceof Error ? err.message : 'Could not resolve that DOI.');
    } finally {
      setResolvingDoi(false);
    }
  };

  const clearDoi = () => {
    setDoiInput('');
    setDoiSource(null);
    setDoiError(null);
    setData((prev) => ({ ...prev, doi: '', externalUrl: '' }));
  };

  // Load the author's existing programs so they can drop this paper into one.
  useEffect(() => {
    const wallet = primaryWallet?.address;
    if (!authenticated || !wallet) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/research/programs?owner=${encodeURIComponent(wallet)}`);
        const json = await res.json();
        if (!cancelled && json?.success) {
          setPrograms(
            (json.data.programs || []).map((p: any) => ({ id: p.id, title: p.title })),
          );
        }
      } catch {
        /* non-fatal — the program picker just stays empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, primaryWallet?.address]);

  // Resolve the chosen program to an id, creating a new program if the author
  // named one inline. Returns undefined when no program is selected.
  const resolveProgramId = async (): Promise<string | undefined> => {
    if (programChoice === '__new__') {
      const title = newProgramTitle.trim();
      if (!title) return undefined;
      const res = await authFetch('/api/research/programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to create program');
      return json.data.id as string;
    }
    return programChoice || undefined;
  };

  const handlePublish = async () => {
    if (!authenticated || !primaryWallet) {
      showToast({
        type: 'error',
        title: 'Wallet not connected',
        message: 'Connect your wallet to publish.',
      });
      return;
    }

    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }

    setIsSubmitting(true);
    try {
      // Create / resolve the program first so a failure here doesn't leave an
      // orphan paper publish behind.
      const programId = await resolveProgramId();

      const fd = new FormData();
      fd.append('title', data.title.trim());
      fd.append('authorName', data.authorName.trim());
      if (data.authorXHandle.trim()) fd.append('authorXHandle', data.authorXHandle.trim());
      if (data.summary.trim()) fd.append('summary', data.summary.trim());
      if (data.githubUrl.trim()) fd.append('githubUrl', data.githubUrl.trim());
      if (data.doi.trim()) fd.append('doi', data.doi.trim());
      if (data.externalUrl.trim()) fd.append('externalUrl', data.externalUrl.trim());
      if (programId) fd.append('programId', programId);
      if (data.paper) fd.append('paper', data.paper);

      const res = await authFetch('/api/research/create', {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to publish paper');

      setPublished({ paperId: json.data.paperId, title: data.title.trim() });
    } catch (err) {
      logger.error('[research/create] failed', err as any);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast({
        type: 'error',
        title: 'Couldn’t publish the paper',
        message: msg,
        details: ['Try again, or reach out on Discord.'],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (published) {
    return (
      <PaperPublishedCelebration
        paperId={published.paperId}
        title={published.title}
        onRead={() => router.push(`/research/${published.paperId}`)}
        onPlant={() => router.push(`/create?linkedPaper=${published.paperId}`)}
      />
    );
  }

  return (
    <div className="px-4 sm:px-6 pb-20" style={{ color: CREAM }}>
      <div className="max-w-2xl mx-auto pt-8 sm:pt-12">
        <KindTabs kind="research" onChange={(k) => k === 'project' && onBack()} />
        <header className="text-center mb-8 sm:mb-10">
          <p
            className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-2"
            style={{ color: AMBER }}
          >
            Research paper
          </p>
          <h1
            className="leading-[1.05] mb-3 inline-flex items-center justify-center gap-3"
            style={{
              color: CREAM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontWeight: 350,
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontFeatureSettings: '"ss01"',
            }}
          >
            <SeedIcon className="w-[0.85em] h-[0.85em]" />
            <span>Plant the seed.</span>
          </h1>
          <p
            className="mx-auto max-w-md"
            style={{
              color: CREAM_DIM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontSize: 'clamp(0.95rem, 1.5vw, 1.1rem)',
            }}
          >
            Paste a DOI to autofill, or drop the PDF. Either way, the grove reads.
          </p>
        </header>

        <div className="space-y-6">
          {/* Already-published fast path: paste a DOI / Zenodo link, autofill. */}
          <div
            style={{
              border: `1px solid ${doiSource ? `${FOREST}66` : HAIR_STRONG}`,
              background: doiSource ? 'rgba(63,122,66,0.06)' : 'rgba(244,238,228,0.025)',
              padding: '1.1rem 1.15rem',
            }}
          >
            <FieldLabel>Already published? Paste a DOI or link</FieldLabel>
            <div className="flex items-stretch gap-2">
              <input
                type="text"
                placeholder="DOI · doi.org link · arXiv · Zenodo · journal URL"
                value={doiInput}
                onChange={(e) => {
                  setDoiInput(e.target.value);
                  if (doiError) setDoiError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    resolveDoi();
                  }
                }}
                onFocus={focusOn}
                onBlur={focusOff}
                disabled={resolvingDoi}
                style={{
                  ...inputBase,
                  borderColor: doiError ? `${EARTH}88` : HAIR_STRONG,
                  fontFamily: 'var(--font-fraunces, serif)',
                }}
              />
              <button
                type="button"
                onClick={resolveDoi}
                disabled={resolvingDoi || !doiInput.trim()}
                className="mono uppercase tracking-[0.2em] text-[0.6rem] px-4 transition-colors inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                style={{ background: AMBER, color: BG }}
                onMouseEnter={(e) => {
                  if (!resolvingDoi && doiInput.trim()) e.currentTarget.style.background = PEACH;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = AMBER;
                }}
              >
                {resolvingDoi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Autofill'}
              </button>
            </div>
            {doiSource ? (
              <p
                className="mono uppercase tracking-[0.2em] text-[0.55rem] mt-2 inline-flex items-center gap-1.5"
                style={{ color: FOREST }}
              >
                <Check className="w-3 h-3" />
                Imported {data.doi ? `· ${data.doi}` : ''} from {doiSource}.
                <button
                  type="button"
                  onClick={clearDoi}
                  className="underline underline-offset-2 ml-1"
                  style={{ color: CREAM_FAINT }}
                >
                  clear
                </button>
              </p>
            ) : (
              <FieldHint>
                Optional. Works with any DOI — arXiv, Zenodo, or a journal. Pulls the
                title, authors, and abstract from the registry; the published source stays
                the source of truth, and the PDF becomes optional.
              </FieldHint>
            )}
            <FieldError>{doiError}</FieldError>
          </div>

          <div>
            <FieldLabel required>Title</FieldLabel>
            <input
              type="text"
              placeholder="The title on the cover page"
              value={data.title}
              onChange={(e) => setField('title', e.target.value)}
              onFocus={focusOn}
              onBlur={focusOff}
              style={{
                ...inputBase,
                borderColor: errors.title ? `${EARTH}88` : HAIR_STRONG,
                fontFamily: 'var(--font-fraunces, serif)',
              }}
            />
            <FieldError>{errors.title}</FieldError>
          </div>

          <div>
            <FieldLabel required>Author name</FieldLabel>
            <input
              type="text"
              placeholder="Your name as it appears on the paper"
              value={data.authorName}
              onChange={(e) => setField('authorName', e.target.value)}
              onFocus={focusOn}
              onBlur={focusOff}
              style={{
                ...inputBase,
                borderColor: errors.authorName ? `${EARTH}88` : HAIR_STRONG,
                fontFamily: 'var(--font-fraunces, serif)',
              }}
            />
            <FieldError>{errors.authorName}</FieldError>
          </div>

          <div>
            <FieldLabel>X handle</FieldLabel>
            <div className="flex items-stretch">
              <span
                className="mono uppercase tracking-[0.22em] text-[0.65rem] flex items-center px-3"
                style={{
                  color: CREAM_FAINT,
                  background: 'rgba(244,238,228,0.04)',
                  border: `1px solid ${HAIR_STRONG}`,
                  borderRight: 'none',
                }}
              >
                @
              </span>
              <input
                type="text"
                placeholder="handle"
                value={data.authorXHandle}
                onChange={(e) => setField('authorXHandle', e.target.value.replace(/^@+/, ''))}
                onFocus={focusOn}
                onBlur={focusOff}
                style={{
                  ...inputBase,
                  borderColor: errors.authorXHandle ? `${EARTH}88` : HAIR_STRONG,
                  fontFamily: 'var(--font-fraunces, serif)',
                }}
              />
            </div>
            <FieldHint>Optional. Shown on the paper page so readers can follow you.</FieldHint>
            <FieldError>{errors.authorXHandle}</FieldError>
          </div>

          <div>
            <FieldLabel>One-line summary</FieldLabel>
            <textarea
              placeholder="What is this paper about, in one or two sentences?"
              value={data.summary}
              onChange={(e) => setField('summary', e.target.value)}
              onFocus={focusOn}
              onBlur={focusOff}
              rows={3}
              style={{
                ...inputBase,
                borderColor: errors.summary ? `${EARTH}88` : HAIR_STRONG,
                resize: 'vertical',
                minHeight: '88px',
                fontFamily: 'var(--font-fraunces, serif)',
                lineHeight: 1.5,
              }}
            />
            <FieldHint>
              Optional. {data.summary.length}/{MAX_SUMMARY_CHARS} characters
            </FieldHint>
            <FieldError>{errors.summary}</FieldError>
          </div>

          <div>
            <FieldLabel>GitHub repository</FieldLabel>
            <input
              type="text"
              placeholder="github.com/owner/repo"
              value={data.githubUrl}
              onChange={(e) => setField('githubUrl', e.target.value)}
              onFocus={focusOn}
              onBlur={focusOff}
              style={{
                ...inputBase,
                borderColor: errors.githubUrl ? `${EARTH}88` : HAIR_STRONG,
                fontFamily: 'var(--font-fraunces, serif)',
              }}
            />
            <FieldHint>Optional. If your paper has accompanying code, link the repo and we’ll show the README on the paper page.</FieldHint>
            <FieldError>{errors.githubUrl}</FieldError>
          </div>

          <div>
            <FieldLabel>Research program</FieldLabel>
            <select
              value={programChoice}
              onChange={(e) => setProgramChoice(e.target.value)}
              onFocus={focusOn}
              onBlur={focusOff}
              style={{
                ...inputBase,
                borderColor: HAIR_STRONG,
                fontFamily: 'var(--font-fraunces, serif)',
                appearance: 'none',
              }}
            >
              <option value="" style={{ background: BG }}>
                None — standalone paper
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
            {programChoice === '__new__' && (
              <input
                type="text"
                placeholder="Program name (e.g. Nakshatra)"
                value={newProgramTitle}
                onChange={(e) => setNewProgramTitle(e.target.value)}
                onFocus={focusOn}
                onBlur={focusOff}
                maxLength={120}
                style={{
                  ...inputBase,
                  marginTop: '0.5rem',
                  borderColor: HAIR_STRONG,
                  fontFamily: 'var(--font-fraunces, serif)',
                }}
              />
            )}
            <FieldHint>
              Optional. Group this paper into a body of work — readers land on the
              program and see the lineage + conviction behind it.
            </FieldHint>
          </div>

          <div>
            <FieldLabel required={!data.doi && !data.externalUrl}>Paper (PDF)</FieldLabel>
            <PdfDrop
              file={data.paper}
              onFile={(f) => setField('paper', f)}
              error={!!errors.paper}
            />
            <FieldHint>
              {data.doi || data.externalUrl
                ? `Optional — readers can open the published version. Attach a PDF to also embed it here. Up to ${MAX_PDF_MB}MB.`
                : `PDF only. Up to ${MAX_PDF_MB}MB.`}
            </FieldHint>
            <FieldError>{errors.paper}</FieldError>
          </div>
        </div>

        <div className="flex justify-between items-center mt-12 mb-2">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="mono text-[0.62rem] uppercase tracking-[0.24em] px-4 py-2.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.color = CREAM;
                e.currentTarget.style.borderColor = `${AMBER}66`;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = CREAM_DIM;
              e.currentTarget.style.borderColor = HAIR_STRONG;
            }}
          >
            ← Different kind
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isSubmitting}
            className="mono text-[0.65rem] uppercase tracking-[0.28em] px-6 py-3 transition-colors inline-flex items-center gap-2 disabled:cursor-wait"
            style={{ background: AMBER, color: BG, minWidth: '200px', justifyContent: 'center' }}
            onMouseEnter={(e) => {
              if (!isSubmitting) e.currentTarget.style.background = PEACH;
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) e.currentTarget.style.background = AMBER;
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Publishing
              </>
            ) : (
              'Publish paper'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── primitives (kept local so this file is self-contained) ───

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label
      className="block mono uppercase tracking-[0.22em] text-[0.6rem] mb-2"
      style={{ color: CREAM_DIM }}
    >
      {children}
      {required && <span style={{ color: AMBER }}> *</span>}
    </label>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mono uppercase tracking-[0.2em] text-[0.55rem] mt-1.5"
      style={{ color: CREAM_FAINT }}
    >
      {children}
    </p>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p
      className="mt-2 text-sm"
      style={{ color: EARTH, fontFamily: 'var(--font-fraunces, serif)' }}
    >
      {children}
    </p>
  );
}

const inputBase: React.CSSProperties = {
  background: 'transparent',
  color: CREAM,
  width: '100%',
  padding: '0.75rem 1rem',
  fontSize: '1rem',
  border: `1px solid ${HAIR_STRONG}`,
  outline: 'none',
  transition: 'border-color 200ms',
};

function focusOn(e: React.FocusEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.borderColor = AMBER;
}
function focusOff(e: React.FocusEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.borderColor = HAIR_STRONG;
}

function PdfDrop({
  file,
  onFile,
  error,
}: {
  file?: File;
  onFile: (f: File | undefined) => void;
  error: boolean;
}) {
  const id = useMemo(() => `paper-${Math.random().toString(36).slice(2)}`, []);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const remove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFile(undefined);
  };

  return (
    <label
      htmlFor={id}
      className="block cursor-pointer transition-colors"
      style={{
        background: file ? 'rgba(63,122,66,0.06)' : 'rgba(244,238,228,0.025)',
        border: `1px dashed ${error ? `${EARTH}88` : file ? `${FOREST}88` : HAIR_STRONG}`,
        padding: '1.25rem',
        textAlign: 'center',
      }}
    >
      <input
        id={id}
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > MAX_PDF_MB * 1024 * 1024) {
            alert(`PDF must be ${MAX_PDF_MB}MB or less`);
            e.target.value = '';
            return;
          }
          onFile(f);
        }}
        className="hidden"
      />
      {file ? (
        <div className="flex flex-col items-center">
          <div
            className="w-16 h-20 mb-3 flex items-center justify-center"
            style={{
              background: 'rgba(244,238,228,0.04)',
              border: `1px solid ${FOREST}55`,
              color: FOREST,
            }}
          >
            <span
              className="mono uppercase tracking-[0.18em] text-[0.62rem]"
              style={{ color: FOREST }}
            >
              PDF
            </span>
          </div>
          <p
            className="text-sm truncate max-w-full"
            style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)' }}
          >
            <Check className="w-3.5 h-3.5 inline mr-1.5 -translate-y-px" style={{ color: FOREST }} />
            {file.name}
          </p>
          <p
            className="mono uppercase tracking-[0.2em] text-[0.55rem] mt-1"
            style={{ color: CREAM_FAINT }}
          >
            {(file.size / 1024 / 1024).toFixed(2)} MB · click to change
          </p>
          <button
            type="button"
            onClick={remove}
            className="mono uppercase tracking-[0.22em] text-[0.55rem] mt-2 inline-flex items-center gap-1 transition-colors"
            style={{ color: CREAM_FAINT }}
            onMouseEnter={(e) => (e.currentTarget.style.color = EARTH)}
            onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_FAINT)}
          >
            <X className="w-3 h-3" /> remove
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center py-3">
          <p
            className="text-sm"
            style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)' }}
          >
            Drop a PDF here, or click to choose.
          </p>
          <p
            className="mono uppercase tracking-[0.2em] text-[0.55rem] mt-1"
            style={{ color: CREAM_FAINT }}
          >
            PDF only · up to {MAX_PDF_MB}MB
          </p>
        </div>
      )}
    </label>
  );
}

// ─── Publish celebration ───
// A short, paper-themed echo of the plant flow's PlantingCelebration: a page
// unfurls, the title settles in, then two CTAs — read it, or plant a market
// from it. Self-contained (palette + keyframes local) so it travels with the
// flow file.
function PaperPublishedCelebration({
  paperId,
  title,
  onRead,
  onPlant,
}: {
  paperId: string;
  title: string;
  onRead: () => void;
  onPlant: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
      style={{ background: BG }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 42%, rgba(232,150,96,0.12), transparent 60%)',
        }}
      />

      <div className="relative flex flex-col items-center text-center max-w-md">
        {/* Unfurling page */}
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          aria-hidden
          className="mb-8"
        >
          <rect
            className="paper-sheet"
            x="34"
            y="26"
            width="52"
            height="68"
            rx="2"
            fill="rgba(244,238,228,0.06)"
            stroke={AMBER}
            strokeWidth="1.5"
          />
          {[40, 48, 56, 64, 72].map((y, i) => (
            <line
              key={y}
              className="paper-line"
              x1="44"
              y1={y}
              x2={i === 4 ? 66 : 76}
              y2={y}
              stroke={CREAM_FAINT}
              strokeWidth="1.5"
              style={{ animationDelay: `${0.5 + i * 0.12}s` }}
            />
          ))}
          <circle
            className="paper-halo"
            cx="60"
            cy="60"
            r="44"
            fill="none"
            stroke={AMBER}
            strokeWidth="1"
            opacity="0"
          />
        </svg>

        <p
          className="paper-fade mono uppercase tracking-[0.32em] text-[0.6rem] mb-3"
          style={{ color: AMBER, animationDelay: '0.9s' }}
        >
          Published.
        </p>
        <h1
          className="paper-fade leading-[1.08] mb-3"
          style={{
            color: CREAM,
            fontFamily: 'var(--font-fraunces, serif)',
            fontWeight: 350,
            fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
            animationDelay: '1.15s',
          }}
        >
          {title}
        </h1>
        <p
          className="paper-fade italic mb-9"
          style={{
            color: CREAM_DIM,
            fontFamily: 'var(--font-fraunces, serif)',
            fontStyle: 'italic',
            fontSize: '1rem',
            animationDelay: '1.4s',
          }}
        >
          The grove can read it now. Want to plant a market on whether it lands?
        </p>

        <div className="paper-fade flex flex-col sm:flex-row gap-3" style={{ animationDelay: '1.65s' }}>
          <button
            type="button"
            onClick={onPlant}
            className="mono uppercase tracking-[0.24em] text-[0.65rem] px-6 py-3 transition-colors"
            style={{ background: AMBER, color: BG }}
            onMouseEnter={(e) => (e.currentTarget.style.background = PEACH)}
            onMouseLeave={(e) => (e.currentTarget.style.background = AMBER)}
          >
            Plant a market from this
          </button>
          <button
            type="button"
            onClick={onRead}
            className="mono uppercase tracking-[0.24em] text-[0.62rem] px-6 py-3 transition-colors"
            style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = CREAM;
              e.currentTarget.style.borderColor = `${AMBER}66`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = CREAM_DIM;
              e.currentTarget.style.borderColor = HAIR_STRONG;
            }}
          >
            Read the paper →
          </button>
        </div>

        <p
          className="paper-fade mono uppercase tracking-[0.2em] text-[0.5rem] mt-8"
          style={{ color: CREAM_FAINT, animationDelay: '1.9s' }}
        >
          paper · {paperId.slice(0, 8)}…{paperId.slice(-4)}
        </p>
      </div>

      <style jsx>{`
        .paper-sheet {
          transform-origin: 60px 60px;
          animation: sheetIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .paper-line {
          opacity: 0;
          animation: lineIn 0.4s ease forwards;
        }
        .paper-halo {
          animation: haloPulse 1.4s ease-out 0.8s forwards;
        }
        .paper-fade {
          opacity: 0;
          animation: fadeUp 0.6s ease forwards;
        }
        @keyframes sheetIn {
          0% {
            transform: scale(0.7) rotate(-4deg);
            opacity: 0;
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        @keyframes lineIn {
          from {
            opacity: 0;
            transform: translateX(-4px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes haloPulse {
          0% {
            opacity: 0.5;
            transform: scale(0.85);
          }
          100% {
            opacity: 0;
            transform: scale(1.25);
          }
        }
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
