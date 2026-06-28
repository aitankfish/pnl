'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import parse from 'html-react-parser';
import {
  Check, X, ArrowLeft, ExternalLink, Loader2, Github, Sun,
  History, Pencil, ChevronDown, Sprout, Stamp,
} from 'lucide-react';
import { PaperUnderpins } from '@/components/research/PaperUnderpins';
import { PaperStats } from '@/components/research/PaperStats';
import { OrcidBadge } from '@/components/research/OrcidBadge';
import { PaperProgramControl } from '@/components/research/PaperProgramControl';
import { isPlatformAdmin } from '@/lib/admin';
import { PaperActivityFeed } from '@/components/research/PaperActivityFeed';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { useWallet } from '@/hooks/useWallet';
import { useToast } from '@/lib/hooks/useToast';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

interface PaperVersion {
  version: number;
  paperUrl: string | null;
  title: string;
  summary: string | null;
  githubUrl: string | null;
  doi: string | null;
  externalUrl: string | null;
  changelog: string | null;
  createdAt: string;
}

interface Paper {
  id: string;
  title: string;
  authorName: string;
  authorXHandle: string | null;
  authorWallet: string;
  authorOrcid: string | null;
  paperUrl: string | null;
  summary: string | null;
  githubUrl: string | null;
  doi: string | null;
  externalUrl: string | null;
  program: { slug: string; title: string } | null;
  programId: string | null;
  parentPaperId: string | null;
  likeCount: number;
  dislikeCount: number;
  createdAt: string;
  currentVersion: number;
  versions: PaperVersion[];
}

// Cosmic-plant page palette — frames the paper.
const BG = '#0a0814';
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const PEACH = '#ecb48a';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

// Paper palette — only used inside the PDF + README containers.
const PAPER_BG = '#fbfaf6';
const INK = '#0d0d0d';
const INK_DIM = 'rgba(13,13,13,0.62)';
const RULE = 'rgba(13,13,13,0.12)';
const ACCENT = FOREST;

type Reaction = 'like' | 'dislike' | null;

const BRIGHTNESS_KEY = 'pnl:research-brightness';
const BRIGHTNESS_DEFAULT = 0.82;
const BRIGHTNESS_MIN = 0.5;
const BRIGHTNESS_MAX = 1.0;

export function ResearchPaperClient({ paper }: { paper: Paper }) {
  const { authenticated, primaryWallet } = useWallet();
  const { showToast } = useToast();
  const router = useRouter();

  const [likeCount, setLikeCount] = useState(paper.likeCount);
  const [dislikeCount, setDislikeCount] = useState(paper.dislikeCount);
  const [reaction, setReaction] = useState<Reaction>(null);
  const [busy, setBusy] = useState(false);

  // Versioning. `viewedVersion` defaults to current; the user can browse
  // older versions via the version panel. Author-only edit sheet appends
  // a new version via /api/research/[id]/version.
  const [viewedVersion, setViewedVersion] = useState<number>(paper.currentVersion);
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const isAuthor =
    !!authenticated &&
    !!primaryWallet?.address &&
    primaryWallet.address === paper.authorWallet;
  const isAdmin = isPlatformAdmin(primaryWallet?.address);
  const [hiding, setHiding] = useState(false);
  const [minting, setMinting] = useState(false);

  // Author-only: publish this paper to Zenodo and stamp the minted DOI back on
  // it. Irreversible (Zenodo records are permanent), so we confirm first.
  const mintDoiNow = async () => {
    if (
      !window.confirm(
        'Publish this paper to Zenodo and mint a permanent DOI?\n\nThis is irreversible — the Zenodo record and its DOI are public and can’t be deleted.',
      )
    ) {
      return;
    }
    setMinting(true);
    try {
      const res = await authFetch(`/api/research/${paper.id}/mint-doi`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to mint');
      showToast({ type: 'success', title: 'DOI minted', message: `${json.data.doi} — now citable anywhere.` });
      router.refresh();
    } catch (err) {
      showToast({ type: 'error', title: 'Couldn’t mint a DOI', message: err instanceof Error ? err.message : '' });
    } finally {
      setMinting(false);
    }
  };

  const hidePaper = async () => {
    if (!window.confirm('Hide this paper from the shelf? It’s reversible but removes it from public view.')) {
      return;
    }
    setHiding(true);
    try {
      const res = await authFetch(`/api/admin/research/${paper.id}/hide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: true }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to hide');
      showToast({ type: 'success', title: 'Paper hidden', message: 'Removed from the shelf.' });
      router.push('/browse');
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Couldn’t hide the paper',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
      setHiding(false);
    }
  };
  const activeVersion =
    paper.versions.find((v) => v.version === viewedVersion) ||
    paper.versions[paper.versions.length - 1] ||
    null;
  const isCurrent = viewedVersion === paper.currentVersion;
  const displayPaperUrl = activeVersion?.paperUrl || paper.paperUrl;
  // Published-paper provenance for the active version (falls back to the
  // paper's current values). When there's no embeddable PDF, these drive a
  // link-out card so a DOI-first paper still reads as a real document.
  const displayDoi = activeVersion?.doi || paper.doi;
  const displayExternalUrl = activeVersion?.externalUrl || paper.externalUrl;
  const hasEmbed = !!displayPaperUrl;

  // Focus-mode state. We portal four frosted "tiles" to document.body that
  // surround the paper's bounding rect, leaving a paper-shaped hole. Doing
  // it via portal escapes AppLayout's stacking context (children container
  // is z-1, masthead is z-50) — overlays at z-90 on body are above both.
  const [reading, setReading] = useState(false);
  const paperRef = useRef<HTMLDivElement | null>(null);
  const [paperRect, setPaperRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!reading) return;
    const update = () => {
      if (paperRef.current) {
        setPaperRect(paperRef.current.getBoundingClientRect());
      }
    };
    update();
    let raf: number | null = null;
    const onScrollOrResize = () => {
      if (raf !== null) return;
      raf = window.requestAnimationFrame(() => {
        update();
        raf = null;
      });
    };
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      if (raf !== null) window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [reading]);

  // Reader-controlled paper brightness, persisted across papers.
  const [brightness, setBrightness] = useState<number>(BRIGHTNESS_DEFAULT);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(BRIGHTNESS_KEY);
      if (stored) {
        const n = parseFloat(stored);
        if (!Number.isNaN(n) && n >= BRIGHTNESS_MIN && n <= BRIGHTNESS_MAX) {
          setBrightness(n);
        }
      }
    } catch {
      // localStorage may be blocked — fall back to default silently.
    }
  }, []);
  const onBrightnessChange = (n: number) => {
    setBrightness(n);
    try {
      window.localStorage.setItem(BRIGHTNESS_KEY, String(n));
    } catch {}
  };
  // Sepia softens with light; bright = no sepia, dim = warm.
  const sepia = Math.max(0, (1 - brightness) * 0.4);
  const iframeFilter = `brightness(${brightness}) sepia(${sepia.toFixed(3)})`;

  // Load the caller's existing reaction once the wallet is known.
  useEffect(() => {
    if (!authenticated || !primaryWallet) {
      setReaction(null);
      return;
    }
    let cancelled = false;
    authFetch(`/api/research/${paper.id}/react`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.success) setReaction(json.data?.reaction ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authenticated, primaryWallet, paper.id]);

  const react = async (next: Reaction) => {
    if (!authenticated || !primaryWallet) {
      showToast({
        type: 'error',
        title: 'Connect wallet to react',
        message: 'Sign in so we can record your tick or cross.',
      });
      return;
    }
    if (busy) return;
    // Toggle off if pressing the same one
    const desired: Reaction = reaction === next ? null : next;
    setBusy(true);
    try {
      const res = await authFetch(`/api/research/${paper.id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reaction: desired }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Reaction failed');
      setReaction(json.data.reaction ?? null);
      setLikeCount(json.data.likeCount);
      setDislikeCount(json.data.dislikeCount);
    } catch (err) {
      logger.error('[research/react] failed', err as any);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast({
        type: 'error',
        title: 'Couldn’t record your reaction',
        message: msg,
      });
    } finally {
      setBusy(false);
    }
  };

  const formattedDate = new Date(paper.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    // No page-level background — let the global cosmic starfield in AppLayout
    // show through. data-pnl-reading drives the focus-mode blur on every
    // .pnl-fade descendant; see <style jsx global> at the bottom.
    //
    // While the reader is engaged we lift this whole subtree above the
    // AppLayout masthead's z-index (z-50) so the focus overlay can paint
    // over the global nav too. When idle, we drop back to auto so the
    // masthead stacks normally for the rest of the app.
    <div
      style={{ color: CREAM, minHeight: '100vh' }}
      data-pnl-reading={reading ? '1' : '0'}
    >
      {/* ─── Top utility bar ─── */}
      <div
        className="px-5 sm:px-8 py-4 flex items-center justify-between pnl-fade"
        style={{ borderBottom: `1px solid ${HAIR_STRONG}` }}
      >
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] transition-colors"
          style={{ color: CREAM_DIM }}
          onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
          onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_DIM)}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          back to the grove
        </Link>
        <div className="flex items-center gap-5">
          <BrightnessSlider value={brightness} onChange={onBrightnessChange} />
          {paper.versions.length > 0 && (
            <VersionBadge
              currentVersion={paper.currentVersion}
              viewedVersion={viewedVersion}
              onClick={() => setVersionPanelOpen((v) => !v)}
            />
          )}
          {isAuthor && (
            <button
              type="button"
              onClick={() => setEditSheetOpen(true)}
              className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] transition-colors"
              style={{ color: CREAM_DIM }}
              onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
              onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_DIM)}
              title="Publish a new version"
            >
              <Pencil className="w-3.5 h-3.5" />
              revise
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={hidePaper}
              disabled={hiding}
              className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] transition-colors disabled:opacity-40"
              style={{ color: EARTH }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f08a5a')}
              onMouseLeave={(e) => (e.currentTarget.style.color = EARTH)}
              title="Admin: hide this paper from the shelf"
            >
              <X className="w-3.5 h-3.5" />
              {hiding ? 'hiding' : 'hide'}
            </button>
          )}
          {paper.githubUrl && (
            <Link
              href={`/research/${paper.id}/code`}
              prefetch
              className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] transition-colors"
              style={{ color: CREAM_DIM }}
              onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
              onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_DIM)}
            >
              <Github className="w-3.5 h-3.5" />
              code
            </Link>
          )}
          {displayDoi && (
            <a
              href={`https://doi.org/${displayDoi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] transition-colors"
              style={{ color: CREAM_DIM }}
              onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
              onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_DIM)}
              title={`DOI ${displayDoi}`}
            >
              doi
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {/* Author-only: mint a real DOI for a native paper that doesn't have
              one yet (needs an embeddable PDF to deposit). */}
          {isAuthor && !displayDoi && hasEmbed && (
            <button
              type="button"
              onClick={mintDoiNow}
              disabled={minting}
              className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] transition-colors disabled:opacity-50"
              style={{ color: AMBER }}
              onMouseEnter={(e) => (e.currentTarget.style.color = PEACH)}
              onMouseLeave={(e) => (e.currentTarget.style.color = AMBER)}
              title="Publish to Zenodo and mint a citable DOI"
            >
              {minting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Stamp className="w-3.5 h-3.5" />}
              {minting ? 'minting' : 'mint doi'}
            </button>
          )}
          {displayExternalUrl && !displayDoi && (
            <a
              href={displayExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] transition-colors"
              style={{ color: CREAM_DIM }}
              onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
              onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_DIM)}
            >
              published
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {displayPaperUrl && (
            <a
              href={displayPaperUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] transition-colors"
              style={{ color: CREAM_DIM }}
              onMouseEnter={(e) => (e.currentTarget.style.color = CREAM)}
              onMouseLeave={(e) => (e.currentTarget.style.color = CREAM_DIM)}
            >
              open pdf
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          {/* Funnel: turn this paper into a market, pre-linked as the thesis. */}
          <Link
            href={`/create?linkedPaper=${paper.id}`}
            className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] px-3 py-1.5 transition-colors"
            style={{ color: BG, background: AMBER }}
            onMouseEnter={(e) => (e.currentTarget.style.background = PEACH)}
            onMouseLeave={(e) => (e.currentTarget.style.background = AMBER)}
          >
            <Sprout className="w-3.5 h-3.5" />
            plant a market
          </Link>
        </div>
      </div>

      {/* ─── Single-column body ─── */}
      <article
        className="max-w-[1000px] mx-auto px-6 sm:px-12 py-10 sm:py-16"
        style={{ borderLeft: `1px solid ${HAIR_STRONG}` }}
      >
        {/* ─── Front matter ─── title, byline, reactions, abstract sit ABOVE
            the PDF, so the page leads with who/what/score and then the
            document itself renders below. */}
        <header className="mb-10 sm:mb-12 pnl-fade">
          <p
            className="mono uppercase tracking-[0.32em] text-[0.55rem] mb-4"
            style={{ color: AMBER }}
          >
            Research · {formattedDate}
          </p>
          <h1
            className="mb-6"
            style={{
              color: CREAM,
              fontFamily: 'var(--font-fraunces, "Times New Roman", serif)',
              fontWeight: 350,
              fontSize: 'clamp(1.9rem, 4vw, 3rem)',
              lineHeight: 1.08,
              letterSpacing: '-0.01em',
            }}
          >
            {paper.title}
          </h1>

          {/* Byline + inline tick/cross */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-6">
            <p
              style={{
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: '1.05rem',
                color: CREAM_DIM,
                margin: 0,
              }}
            >
              by{' '}
              <Link
                href={`/research/author/${paper.authorWallet}`}
                className="underline-offset-4 hover:underline"
                style={{ color: CREAM }}
              >
                {paper.authorName}
              </Link>
              {paper.authorOrcid && (
                <>
                  {' '}
                  <OrcidBadge orcidId={paper.authorOrcid} size={15} />
                </>
              )}
              {paper.authorXHandle && (
                <>
                  {' '}·{' '}
                  <a
                    href={`https://x.com/${paper.authorXHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-4 hover:underline"
                    style={{ color: AMBER }}
                  >
                    @{paper.authorXHandle}
                  </a>
                </>
              )}
            </p>
            <div className="flex items-center gap-2">
              <InlineReaction
                variant="like"
                active={reaction === 'like'}
                count={likeCount}
                disabled={busy}
                onClick={() => react('like')}
              />
              <InlineReaction
                variant="dislike"
                active={reaction === 'dislike'}
                count={dislikeCount}
                disabled={busy}
                onClick={() => react('dislike')}
              />
              {!authenticated && (
                <span
                  className="mono uppercase tracking-[0.2em] text-[0.5rem] ml-1"
                  style={{ color: CREAM_FAINT }}
                >
                  · connect wallet to react
                </span>
              )}
            </div>
          </div>

          {/* External reach — citations / downloads / views from the scholarly
              graph (silent until a DOI's sources return numbers). */}
          <PaperStats paperId={paper.id} />

          {paper.program && (
            <Link
              href={`/research/program/${paper.program.slug}`}
              className="inline-flex items-center gap-2 mono uppercase tracking-[0.2em] text-[0.55rem] mb-6 px-3 py-1.5 transition-colors"
              style={{ color: AMBER, border: `1px solid ${AMBER}44` }}
            >
              part of {paper.program.title} →
            </Link>
          )}

          {paper.summary && (
            <div>
              <p
                className="mono uppercase tracking-[0.28em] text-[0.55rem] mb-2.5"
                style={{ color: CREAM_FAINT }}
              >
                Abstract
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontSize: '1.15rem',
                  lineHeight: 1.55,
                  color: CREAM_DIM,
                  borderLeft: `1px solid ${HAIR_STRONG}`,
                  paddingLeft: '1rem',
                  margin: 0,
                }}
              >
                {paper.summary}
              </p>
            </div>
          )}
        </header>

        {!isCurrent && activeVersion && (
          <div
            className="mb-3 px-4 py-2.5 flex items-center justify-between gap-3 pnl-fade"
            style={{
              border: `1px solid ${AMBER}55`,
              background: 'rgba(232,150,96,0.08)',
            }}
          >
            <p
              className="mono uppercase tracking-[0.22em] text-[0.55rem]"
              style={{ color: AMBER }}
            >
              Reading v{activeVersion.version} · current is v{paper.currentVersion}
            </p>
            <button
              type="button"
              onClick={() => setViewedVersion(paper.currentVersion)}
              className="mono uppercase tracking-[0.22em] text-[0.55rem] px-3 py-1 transition-colors"
              style={{ color: AMBER, border: `1px solid ${AMBER}66` }}
            >
              jump to current →
            </button>
          </div>
        )}

        {/* PDF embed — the paper itself. Mouse enter/leave drives focus mode:
            a frosted overlay drops over the page and the paper lifts above it
            so only the document is in focus. */}
        {hasEmbed ? (
          <>
            <div
              ref={paperRef}
              className="w-full pnl-paper"
              onMouseEnter={() => setReading(true)}
              onMouseLeave={() => setReading(false)}
              style={{
                background: '#fff',
                height: 'min(85vh, 1100px)',
                position: 'relative',
                transform: reading ? 'scale(1.015)' : 'scale(1)',
                boxShadow: reading
                  ? '0 40px 100px rgba(0,0,0,0.75), 0 0 0 1px rgba(244,238,228,0.08)'
                  : '0 18px 40px rgba(0,0,0,0.35)',
                transition:
                  'transform 750ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 750ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <iframe
                src={`${displayPaperUrl}#view=FitH&zoom=page-width&toolbar=1&navpanes=0`}
                title={paper.title}
                className="w-full h-full block"
                style={{
                  border: 'none',
                  filter: iframeFilter,
                  transition: 'filter 200ms ease',
                }}
              />
            </div>
            <p
              className="mt-3 mono uppercase tracking-[0.22em] text-[0.55rem] pnl-fade"
              style={{ color: CREAM_FAINT }}
            >
              If the paper doesn’t render here, click <em style={{ fontStyle: 'italic' }}>open pdf</em> above.
            </p>
          </>
        ) : (
          /* DOI-first paper with no embeddable PDF — a card that links to the
             canonical published version instead of an empty frame. */
          <PublishedSourceCard doi={displayDoi} externalUrl={displayExternalUrl} />
        )}

        {/* Author-only: group this paper into a program + set its lineage. */}
        {isAuthor && (
          <PaperProgramControl
            paperId={paper.id}
            ownerWallet={paper.authorWallet}
            initialProgramId={paper.programId}
            initialParentPaperId={paper.parentPaperId}
          />
        )}

        {/* Projects citing this paper — silent if none, paper-flavored
            cards in cosmic chrome when present. */}
        <PaperUnderpins paperId={paper.id} />

        {paper.githubUrl && <ReadmeSection paperId={paper.id} repoUrl={paper.githubUrl} />}

        {paper.githubUrl && <PaperActivityFeed paperId={paper.id} />}
      </article>

      {/* Version panel — slides in below the top bar listing every revision */}
      {versionPanelOpen && (
        <VersionPanel
          versions={paper.versions}
          currentVersion={paper.currentVersion}
          viewedVersion={viewedVersion}
          onPick={(v) => {
            setViewedVersion(v);
            setVersionPanelOpen(false);
          }}
          onClose={() => setVersionPanelOpen(false)}
        />
      )}

      {/* Author-only revise sheet */}
      {editSheetOpen && (
        <EditPaperSheet
          paperId={paper.id}
          currentTitle={paper.title}
          currentSummary={paper.summary}
          currentGithubUrl={paper.githubUrl}
          currentDoi={paper.doi}
          currentExternalUrl={paper.externalUrl}
          pdfRequired={!paper.doi && !paper.externalUrl}
          onClose={() => setEditSheetOpen(false)}
          onPublished={() => {
            setEditSheetOpen(false);
            // Re-fetch the page so the new version lands. router.refresh()
            // re-runs the server component and the client hydrates with
            // updated versions array + currentVersion.
            router.refresh();
            showToast({
              type: 'success',
              title: '✓ Published a new version',
              message: 'Your revision is live in the archive.',
            });
          }}
        />
      )}

      {/* Focus tiles — portaled to document.body so they live outside
          AppLayout's stacking context (where children sit at z-1 below the
          masthead at z-50). Four fixed-position tiles surround the paper
          rect, leaving the paper visible through the gap. */}
      {mounted && createPortal(
        <FocusTiles active={reading} rect={paperRect} />,
        document.body,
      )}

      <style jsx global>{`
        /* Soft in-flow blur on peripheral page elements as a fallback for
           browsers that don't support backdrop-filter. */
        .pnl-fade {
          transition:
            filter 750ms cubic-bezier(0.4, 0, 0.2, 1),
            opacity 750ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        [data-pnl-reading='1'] .pnl-fade {
          filter: blur(2px);
          opacity: 0.55;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

function FocusTiles({
  active,
  rect,
}: {
  active: boolean;
  rect: DOMRect | null;
}) {
  // Until we know where the paper is, render the tiles at viewport bounds
  // so the entrance fade can't flash a misaligned hole.
  const top = rect?.top ?? 0;
  const bottom = rect?.bottom ?? 0;
  const left = rect?.left ?? 0;
  const right = rect?.right ?? 0;

  const tile: React.CSSProperties = {
    position: 'fixed',
    background: 'rgba(10, 8, 20, 0.55)',
    WebkitBackdropFilter: 'blur(14px) saturate(0.85)',
    backdropFilter: 'blur(14px) saturate(0.85)',
    pointerEvents: 'none',
    zIndex: 90,
    opacity: active ? 1 : 0,
    transition: 'opacity 750ms cubic-bezier(0.4, 0, 0.2, 1)',
  };

  return (
    <>
      {/* Above the paper */}
      <div
        aria-hidden
        style={{
          ...tile,
          top: 0,
          left: 0,
          right: 0,
          height: `${Math.max(0, top)}px`,
        }}
      />
      {/* Below the paper */}
      <div
        aria-hidden
        style={{
          ...tile,
          top: `${bottom}px`,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
      {/* Left of the paper */}
      <div
        aria-hidden
        style={{
          ...tile,
          top: `${top}px`,
          left: 0,
          width: `${Math.max(0, left)}px`,
          height: `${Math.max(0, bottom - top)}px`,
        }}
      />
      {/* Right of the paper */}
      <div
        aria-hidden
        style={{
          ...tile,
          top: `${top}px`,
          left: `${right}px`,
          right: 0,
          height: `${Math.max(0, bottom - top)}px`,
        }}
      />
    </>
  );
}

function VersionBadge({
  currentVersion,
  viewedVersion,
  onClick,
}: {
  currentVersion: number;
  viewedVersion: number;
  onClick: () => void;
}) {
  const isOff = viewedVersion !== currentVersion;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 transition-colors"
      style={{
        border: `1px solid ${isOff ? AMBER + 'aa' : HAIR_STRONG}`,
        color: isOff ? AMBER : CREAM_DIM,
        background: isOff ? 'rgba(232,150,96,0.08)' : 'transparent',
      }}
      title="View paper history"
    >
      <History className="w-3.5 h-3.5" />
      <span
        className="mono uppercase tracking-[0.22em] text-[0.55rem]"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        v{viewedVersion}
      </span>
      <ChevronDown className="w-3 h-3" />
    </button>
  );
}

function VersionPanel({
  versions,
  currentVersion,
  viewedVersion,
  onPick,
  onClose,
}: {
  versions: PaperVersion[];
  currentVersion: number;
  viewedVersion: number;
  onPick: (v: number) => void;
  onClose: () => void;
}) {
  // Newest first, regardless of insertion order in the array.
  const sorted = useMemo(
    () => [...versions].sort((a, b) => b.version - a.version),
    [versions],
  );
  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 z-40"
        onClick={onClose}
        style={{ background: 'rgba(10,8,20,0.55)', backdropFilter: 'blur(6px)' }}
      />
      <div
        role="dialog"
        aria-label="Paper version history"
        className={[
          // Mobile — bottom sheet that slides up from the bottom edge.
          'fixed left-0 right-0 bottom-0 z-50 max-h-[82vh] overflow-y-auto',
          // Desktop — centered modal.
          'sm:bottom-auto sm:top-[12vh] sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-[min(640px,calc(100vw-2rem))] sm:max-h-[76vh]',
          'pnl-version-panel',
        ].join(' ')}
        style={{
          background: BG,
          border: `1px solid ${HAIR_STRONG}`,
          boxShadow: '0 -30px 80px rgba(0,0,0,0.6)',
        }}
      >
        {/* Mobile-only drag handle for affordance. Decorative — taps still */}
        <div
          aria-hidden
          className="sm:hidden flex justify-center pt-2 pb-1"
        >
          <span
            className="block"
            style={{
              width: 36,
              height: 3,
              borderRadius: 2,
              background: HAIR_STRONG,
            }}
          />
        </div>
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${HAIR_STRONG}` }}
        >
          <p
            className="mono uppercase tracking-[0.32em] text-[0.6rem]"
            style={{ color: AMBER }}
          >
            Evolution of this paper
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mono uppercase tracking-[0.22em] text-[0.55rem]"
            style={{ color: CREAM_DIM }}
            aria-label="Close"
          >
            close ✕
          </button>
        </div>

        <ul className="py-2">
          {sorted.map((v) => {
            const isCurrent = v.version === currentVersion;
            const isViewed = v.version === viewedVersion;
            return (
              <li key={v.version}>
                <button
                  type="button"
                  onClick={() => onPick(v.version)}
                  className="w-full text-left px-5 py-4 transition-colors"
                  style={{
                    background: isViewed ? 'rgba(232,150,96,0.08)' : 'transparent',
                    borderBottom: `1px solid ${HAIR_STRONG}`,
                  }}
                >
                  <div className="flex items-baseline gap-3">
                    <span
                      className="w-2.5 h-2.5 inline-block rounded-full flex-shrink-0"
                      style={{
                        background: isCurrent ? AMBER : 'transparent',
                        border: `1px solid ${isCurrent ? AMBER : CREAM_FAINT}`,
                      }}
                    />
                    <span
                      className="mono uppercase tracking-[0.22em] text-[0.6rem]"
                      style={{ color: isViewed ? AMBER : CREAM }}
                    >
                      v{v.version}
                    </span>
                    <span
                      className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                      style={{ color: CREAM_FAINT }}
                    >
                      {new Date(v.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    {isCurrent && (
                      <span
                        className="mono uppercase tracking-[0.22em] text-[0.55rem] ml-auto"
                        style={{ color: FOREST }}
                      >
                        current
                      </span>
                    )}
                    {!isCurrent && v.version === 1 && (
                      <span
                        className="mono uppercase tracking-[0.22em] text-[0.55rem] ml-auto"
                        style={{ color: CREAM_FAINT }}
                      >
                        first published
                      </span>
                    )}
                  </div>
                  {v.changelog && (
                    <p
                      className="mt-2 ml-[1.125rem] italic"
                      style={{
                        fontFamily: 'var(--font-fraunces, serif)',
                        color: CREAM_DIM,
                        fontSize: '0.95rem',
                        lineHeight: 1.5,
                      }}
                    >
                      “{v.changelog}”
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

// A DOI-first paper has no embeddable PDF. Instead of a blank frame, show a
// card that sends the reader to the canonical published version.
function PublishedSourceCard({
  doi,
  externalUrl,
}: {
  doi: string | null;
  externalUrl: string | null;
}) {
  const href = doi ? `https://doi.org/${doi}` : externalUrl || '#';
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full pnl-fade transition-colors"
      style={{
        border: `1px solid ${HAIR_STRONG}`,
        background: 'rgba(244,238,228,0.025)',
        padding: '2.5rem 2rem',
        textAlign: 'center',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${AMBER}66`)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = HAIR_STRONG)}
    >
      <p
        className="mono uppercase tracking-[0.28em] text-[0.55rem] mb-3"
        style={{ color: AMBER }}
      >
        Published source
      </p>
      <p
        className="mb-1"
        style={{
          color: CREAM,
          fontFamily: 'var(--font-fraunces, serif)',
          fontSize: '1.25rem',
        }}
      >
        Read the paper at its published home
      </p>
      {doi && (
        <p className="mono text-[0.7rem] mb-4" style={{ color: CREAM_DIM }}>
          DOI {doi}
        </p>
      )}
      <span
        className="inline-flex items-center gap-2 mono uppercase tracking-[0.24em] text-[0.6rem] px-5 py-2.5 mt-2"
        style={{ background: AMBER, color: BG }}
      >
        Open published version
        <ExternalLink className="w-3.5 h-3.5" />
      </span>
    </a>
  );
}

function EditPaperSheet({
  paperId,
  currentTitle,
  currentSummary,
  currentGithubUrl,
  currentDoi,
  currentExternalUrl,
  pdfRequired,
  onClose,
  onPublished,
}: {
  paperId: string;
  currentTitle: string;
  currentSummary: string | null;
  currentGithubUrl: string | null;
  currentDoi: string | null;
  currentExternalUrl: string | null;
  pdfRequired: boolean;
  onClose: () => void;
  onPublished: () => void;
}) {
  const [title, setTitle] = useState(currentTitle);
  const [summary, setSummary] = useState(currentSummary || '');
  const [githubUrl, setGithubUrl] = useState(currentGithubUrl || '');
  const [doi, setDoi] = useState(currentDoi || '');
  const [externalUrl, setExternalUrl] = useState(currentExternalUrl || '');
  const [paper, setPaper] = useState<File | null>(null);
  const [changelog, setChangelog] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    // A PDF is only required when the paper has no published-source link to
    // stand in for it. With a DOI/external URL, revising metadata is enough.
    const willHaveSource = !!doi.trim() || !!externalUrl.trim();
    if (!paper && pdfRequired && !willHaveSource) {
      setError('Drop the new PDF, or add a DOI / published link.');
      return;
    }
    if (paper && paper.type !== 'application/pdf') {
      setError('Only PDF files are accepted.');
      return;
    }
    if (paper && paper.size > 25 * 1024 * 1024) {
      setError('PDF must be 25MB or smaller.');
      return;
    }
    if (!changelog.trim()) {
      setError('Add a one-line note explaining what changed.');
      return;
    }
    if (changelog.length > 500) {
      setError('Changelog must be under 500 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      if (paper) fd.append('paper', paper);
      fd.append('changelog', changelog.trim());
      if (title.trim() && title.trim() !== currentTitle) fd.append('title', title.trim());
      if (summary.trim() !== (currentSummary || '')) fd.append('summary', summary.trim());
      if (githubUrl.trim() !== (currentGithubUrl || '')) fd.append('githubUrl', githubUrl.trim());
      // Always send doi/externalUrl so the route preserves vs clears explicitly.
      fd.append('doi', doi.trim());
      fd.append('externalUrl', externalUrl.trim());

      const res = await authFetch(`/api/research/${paperId}/version`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to publish');
      onPublished();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 z-[80]"
        onClick={!submitting ? onClose : undefined}
        style={{ background: 'rgba(10,8,20,0.6)', backdropFilter: 'blur(8px)' }}
      />
      <div
        role="dialog"
        aria-label="Publish a new version"
        className="fixed left-0 right-0 bottom-0 z-[90] max-h-[90vh] overflow-y-auto"
        style={{
          background: BG,
          borderTop: `1px solid ${HAIR_STRONG}`,
          boxShadow: '0 -30px 80px rgba(0,0,0,0.6)',
        }}
      >
        <div className="max-w-2xl mx-auto px-5 sm:px-8 py-8">
          <p
            className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-2"
            style={{ color: AMBER }}
          >
            Publish a new version
          </p>
          <h2
            className="mb-6"
            style={{
              color: CREAM,
              fontFamily: 'var(--font-fraunces, serif)',
              fontWeight: 350,
              fontSize: '1.6rem',
            }}
          >
            Revise the paper.
          </h2>

          <div className="space-y-5">
            <SheetField label="What changed?" required>
              <input
                type="text"
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                placeholder="One-line summary (e.g., reframed claim around telemetry)"
                maxLength={500}
                className="w-full px-3 py-2.5"
                style={sheetInputStyle}
              />
              <p
                className="mt-1 mono uppercase tracking-[0.2em] text-[0.5rem]"
                style={{ color: CREAM_FAINT }}
              >
                {changelog.length}/500
              </p>
            </SheetField>

            <SheetField label={pdfRequired ? 'New PDF' : 'New PDF (optional)'} required={pdfRequired}>
              <SheetPdfDrop file={paper} onFile={setPaper} />
              {!pdfRequired && (
                <p
                  className="mt-1 mono uppercase tracking-[0.2em] text-[0.5rem]"
                  style={{ color: CREAM_FAINT }}
                >
                  This paper is published-source-first — leave blank to keep it that way.
                </p>
              )}
            </SheetField>

            <SheetField label="DOI">
              <input
                type="text"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                placeholder="10.5281/zenodo.… (or leave blank to clear)"
                className="w-full px-3 py-2.5"
                style={sheetInputStyle}
              />
            </SheetField>

            <SheetField label="Published URL">
              <input
                type="text"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://zenodo.org/records/… (or leave blank to clear)"
                className="w-full px-3 py-2.5"
                style={sheetInputStyle}
              />
            </SheetField>

            <SheetField label="Title">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2.5"
                style={sheetInputStyle}
              />
            </SheetField>

            <SheetField label="Summary">
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5"
                style={{ ...sheetInputStyle, resize: 'vertical', minHeight: 64 }}
              />
            </SheetField>

            <SheetField label="GitHub repository">
              <input
                type="text"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="github.com/owner/repo (or leave blank to clear)"
                className="w-full px-3 py-2.5"
                style={sheetInputStyle}
              />
            </SheetField>

            {error && (
              <p
                className="text-sm"
                style={{ color: '#d67347', fontFamily: 'var(--font-fraunces, serif)' }}
              >
                {error}
              </p>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="mono uppercase tracking-[0.22em] text-[0.6rem] px-4 py-2 transition-colors"
              style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
            >
              cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="mono uppercase tracking-[0.26em] text-[0.65rem] px-6 py-3 transition-colors inline-flex items-center gap-2 disabled:cursor-wait"
              style={{
                background: AMBER,
                color: BG,
                minWidth: 200,
                justifyContent: 'center',
              }}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  publishing
                </>
              ) : (
                'publish revision'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const sheetInputStyle: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${HAIR_STRONG}`,
  color: CREAM,
  fontFamily: 'var(--font-fraunces, serif)',
  fontSize: '0.95rem',
  outline: 'none',
};

function SheetField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block mono uppercase tracking-[0.22em] text-[0.55rem] mb-2"
        style={{ color: CREAM_DIM }}
      >
        {label}
        {required && <span style={{ color: AMBER }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function SheetPdfDrop({
  file,
  onFile,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const id = useMemo(() => `pdf-${Math.random().toString(36).slice(2)}`, []);
  return (
    <label
      htmlFor={id}
      className="block cursor-pointer"
      style={{
        border: `1px dashed ${file ? FOREST + '88' : HAIR_STRONG}`,
        background: file ? 'rgba(63,122,66,0.06)' : 'rgba(244,238,228,0.025)',
        padding: '1.25rem',
        textAlign: 'center',
      }}
    >
      <input
        id={id}
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
        className="hidden"
      />
      {file ? (
        <p
          className="text-sm"
          style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)' }}
        >
          ✓ {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      ) : (
        <p
          className="text-sm"
          style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)' }}
        >
          Drop the new PDF here, or click to choose.
        </p>
      )}
    </label>
  );
}

function BrightnessSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  // Drive the visual fill of the track via a CSS variable so the track
  // gradient matches the thumb position without re-styling per-render.
  const pct = ((value - BRIGHTNESS_MIN) / (BRIGHTNESS_MAX - BRIGHTNESS_MIN)) * 100;
  return (
    <label
      className="hidden sm:inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem]"
      style={{ color: CREAM_DIM }}
      title="Adjust paper brightness"
    >
      <Sun className="w-3.5 h-3.5" />
      <input
        type="range"
        min={BRIGHTNESS_MIN}
        max={BRIGHTNESS_MAX}
        step={0.02}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="pnl-brightness-slider"
        style={{
          // CSS variable read by the global style block below.
          ['--pnl-fill' as any]: `${pct}%`,
        }}
        aria-label="Paper brightness"
      />
      <style jsx global>{`
        .pnl-brightness-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 96px;
          height: 18px;
          background: transparent;
          cursor: pointer;
          padding: 0;
          margin: 0;
        }
        .pnl-brightness-slider::-webkit-slider-runnable-track {
          height: 2px;
          background: linear-gradient(
            to right,
            ${AMBER} 0%,
            ${AMBER} var(--pnl-fill, 60%),
            ${HAIR_STRONG} var(--pnl-fill, 60%),
            ${HAIR_STRONG} 100%
          );
          border: none;
        }
        .pnl-brightness-slider::-moz-range-track {
          height: 2px;
          background: ${HAIR_STRONG};
          border: none;
        }
        .pnl-brightness-slider::-moz-range-progress {
          height: 2px;
          background: ${AMBER};
          border: none;
        }
        .pnl-brightness-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 10px;
          height: 10px;
          margin-top: -4px;
          border-radius: 50%;
          background: ${AMBER};
          border: none;
          cursor: pointer;
          transition: transform 150ms ease;
        }
        .pnl-brightness-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
        .pnl-brightness-slider::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: ${AMBER};
          border: none;
          cursor: pointer;
        }
        .pnl-brightness-slider:focus {
          outline: none;
        }
      `}</style>
    </label>
  );
}

function InlineReaction({
  variant,
  active,
  count,
  disabled,
  onClick,
}: {
  variant: 'like' | 'dislike';
  active: boolean;
  count: number;
  disabled: boolean;
  onClick: () => void;
}) {
  const accent = variant === 'like' ? FOREST : EARTH;
  const Icon = variant === 'like' ? Check : X;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={variant === 'like' ? 'Mark as worthwhile' : 'Mark as flawed'}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 transition-colors disabled:cursor-wait"
      style={{
        border: `1px solid ${active ? accent : HAIR_STRONG}`,
        background: active ? `${accent}1a` : 'transparent',
        color: active ? accent : CREAM,
        opacity: disabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled) {
          e.currentTarget.style.borderColor = `${accent}88`;
        }
      }}
      onMouseLeave={(e) => {
        if (!active && !disabled) {
          e.currentTarget.style.borderColor = HAIR_STRONG;
        }
      }}
    >
      <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
      <span
        className="mono text-[0.7rem]"
        style={{ fontFeatureSettings: '"tnum"' }}
      >
        {count}
      </span>
    </button>
  );
}

function ReadmeSection({
  paperId,
  repoUrl,
}: {
  paperId: string;
  repoUrl: string;
}) {
  type RenderedState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'rendered'; html: string; filename: string; repo: string }
    | { kind: 'fallback'; markdown: string; filename: string; repo: string }
    | { kind: 'error'; message: string };

  const [state, setState] = useState<RenderedState>({ kind: 'idle' });

  // HTML is server-side sanitized in /api/research/[id]/readme via sanitize-html
  // (strict allowlist). We then parse to React elements — no innerHTML injection.
  const renderedTree = useMemo(() => {
    if (state.kind !== 'rendered') return null;
    return parse(state.html);
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    fetch(`/api/research/${paperId}/readme`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.success) {
          setState({ kind: 'error', message: json.error || 'Could not load README' });
          return;
        }
        if (json.data?.html) {
          setState({
            kind: 'rendered',
            html: json.data.html,
            filename: json.data.filename || 'README.md',
            repo: json.data.repo,
          });
        } else if (json.data?.markdown) {
          setState({
            kind: 'fallback',
            markdown: json.data.markdown,
            filename: json.data.filename || 'README.md',
            repo: json.data.repo,
          });
        } else {
          setState({ kind: 'error', message: 'Empty README' });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error('[research/readme] failed', err);
        setState({ kind: 'error', message: 'Could not load README' });
      });
    return () => {
      cancelled = true;
    };
  }, [paperId]);

  const repoLabel =
    state.kind === 'rendered' || state.kind === 'fallback' ? state.repo : '';

  return (
    <section className="mt-16 pnl-fade">
      <p
        className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-4"
        style={{ color: AMBER }}
      >
        The code{repoLabel ? ` · github.com/${repoLabel}` : ''}
      </p>
      <h2
        className="mb-6"
        style={{
          color: CREAM,
          fontFamily: 'var(--font-fraunces, "Times New Roman", serif)',
          fontWeight: 350,
          fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
          lineHeight: 1.1,
          letterSpacing: '-0.005em',
        }}
      >
        Read the README
      </h2>

      {state.kind === 'loading' && (
        <div className="flex items-center gap-3 py-12" style={{ color: CREAM_DIM }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="mono uppercase tracking-[0.24em] text-[0.6rem]">
            Pulling from GitHub…
          </span>
        </div>
      )}

      {state.kind === 'error' && (
        <div
          className="px-5 py-6"
          style={{
            border: `1px solid ${HAIR_STRONG}`,
            color: CREAM_DIM,
            background: 'rgba(244,238,228,0.025)',
          }}
        >
          <p
            className="mb-3"
            style={{ fontFamily: 'var(--font-fraunces, serif)', fontSize: '1rem' }}
          >
            {state.message}.
          </p>
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] transition-colors"
            style={{ color: AMBER }}
          >
            <Github className="w-3.5 h-3.5" />
            View on GitHub
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {state.kind === 'rendered' && (
        <>
          <div
            className="paper-readme"
            style={{
              background: PAPER_BG,
              border: `1px solid ${HAIR_STRONG}`,
              padding: '2rem 2.25rem',
              boxShadow: '0 1px 0 rgba(244,238,228,0.04), 0 18px 40px rgba(0,0,0,0.35)',
            }}
          >
            {renderedTree}
          </div>
          <div className="mt-4 flex justify-between items-center">
            <span
              className="mono uppercase tracking-[0.22em] text-[0.55rem]"
              style={{ color: CREAM_FAINT }}
            >
              {state.filename}
            </span>
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] transition-colors"
              style={{ color: AMBER }}
            >
              <Github className="w-3.5 h-3.5" />
              View on GitHub
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </>
      )}

      {state.kind === 'fallback' && (
        <>
          <pre
            className="overflow-x-auto"
            style={{
              background: PAPER_BG,
              border: `1px solid ${HAIR_STRONG}`,
              padding: '1.5rem',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              fontSize: '0.85rem',
              color: INK,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
            }}
          >
            {state.markdown}
          </pre>
          <div className="mt-4 flex justify-between items-center">
            <span
              className="mono uppercase tracking-[0.22em] text-[0.55rem]"
              style={{ color: CREAM_FAINT }}
            >
              {state.filename} · raw markdown
            </span>
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] transition-colors"
              style={{ color: AMBER }}
            >
              <Github className="w-3.5 h-3.5" />
              View on GitHub
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </>
      )}

      <style jsx global>{`
        .paper-readme {
          font-family: var(--font-fraunces, 'Times New Roman', serif);
          font-size: 1.02rem;
          line-height: 1.65;
          color: ${INK};
        }
        .paper-readme h1,
        .paper-readme h2,
        .paper-readme h3,
        .paper-readme h4,
        .paper-readme h5,
        .paper-readme h6 {
          font-family: var(--font-fraunces, serif);
          font-weight: 400;
          letter-spacing: -0.005em;
          margin: 2rem 0 0.75rem;
          line-height: 1.18;
        }
        .paper-readme h1 { font-size: 1.85rem; border-bottom: 1px solid ${RULE}; padding-bottom: 0.5rem; }
        .paper-readme h2 { font-size: 1.5rem; border-bottom: 1px solid ${RULE}; padding-bottom: 0.4rem; }
        .paper-readme h3 { font-size: 1.25rem; }
        .paper-readme h4 { font-size: 1.1rem; }
        .paper-readme p { margin: 0 0 1rem; }
        .paper-readme a {
          color: ${ACCENT};
          text-decoration: none;
          border-bottom: 1px solid ${ACCENT}55;
        }
        .paper-readme a:hover { border-bottom-color: ${ACCENT}; }
        .paper-readme strong { font-weight: 600; }
        .paper-readme em { font-style: italic; }
        .paper-readme ul, .paper-readme ol { padding-left: 1.5rem; margin: 0 0 1rem; }
        .paper-readme li { margin: 0.25rem 0; }
        .paper-readme blockquote {
          margin: 1rem 0;
          padding: 0.25rem 1rem;
          border-left: 3px solid ${RULE};
          color: ${INK_DIM};
        }
        .paper-readme code {
          background: rgba(13,13,13,0.06);
          padding: 0.1em 0.35em;
          border-radius: 2px;
          font-family: ui-monospace, SFMono-Regular, monospace;
          font-size: 0.88em;
        }
        .paper-readme pre {
          background: #f4eee4;
          border: 1px solid ${RULE};
          padding: 1rem;
          overflow-x: auto;
          margin: 0 0 1rem;
          font-size: 0.85rem;
          line-height: 1.5;
        }
        .paper-readme pre code { background: transparent; padding: 0; }
        .paper-readme img {
          max-width: 100%;
          height: auto;
          margin: 0.75rem 0;
        }
        .paper-readme table {
          border-collapse: collapse;
          margin: 1rem 0;
          font-size: 0.92em;
        }
        .paper-readme th, .paper-readme td {
          border: 1px solid ${RULE};
          padding: 0.5em 0.75em;
          text-align: left;
        }
        .paper-readme th {
          background: rgba(13,13,13,0.04);
          font-weight: 600;
        }
        .paper-readme hr {
          border: none;
          border-top: 1px solid ${RULE};
          margin: 2rem 0;
        }
        .paper-readme .anchor,
        .paper-readme .octicon-link { display: none; }
      `}</style>
    </section>
  );
}

