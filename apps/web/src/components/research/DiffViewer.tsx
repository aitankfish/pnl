'use client';

/**
 * DiffViewer
 *
 * Renders a unified diff for a single file from a commit's `patch` string
 * (GitHub's API format — same shape as `git diff -p`). Parses the patch
 * into hunks + lines and colors them inline. Deliberately simple: no
 * side-by-side view, no inline edit, no syntax highlighting (yet) —
 * those are post-v1 polish.
 */

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, MessageSquare } from 'lucide-react';
import { MarkdownBody } from './MarkdownBody';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';
const EARTH = '#d67347';

const PAPER_BG = '#fbfaf6';
const INK = '#0d0d0d';
const INK_DIM = 'rgba(13,13,13,0.62)';
const INK_FAINT = 'rgba(13,13,13,0.35)';
const RULE = 'rgba(13,13,13,0.12)';

const ADD_BG = 'rgba(63,122,66,0.12)';
const ADD_GUTTER = 'rgba(63,122,66,0.22)';
const DEL_BG = 'rgba(214,115,71,0.12)';
const DEL_GUTTER = 'rgba(214,115,71,0.22)';

interface FileChange {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  blobUrl: string | null;
  rawUrl: string | null;
  patch: string | null;
  previousFilename: string | null;
}

export interface ReviewComment {
  id: number;
  path: string;
  line: number | null;
  originalLine: number | null;
  side: 'LEFT' | 'RIGHT' | null;
  body: string | null;
  author: string;
  authorAvatarUrl: string | null;
  htmlUrl: string;
  createdAt: string;
  inReplyToId: number | null;
}

export function DiffViewer({
  file,
  comments = [],
}: {
  file: FileChange;
  comments?: ReviewComment[];
}) {
  const [expanded, setExpanded] = useState(true);
  const hunks = useMemo(() => parsePatch(file.patch || ''), [file.patch]);

  // Index comments by "side:line" so we can drop them inline as we
  // render each DiffLine. Tracking which IDs we've shown lets us
  // surface unmatched ones at the bottom of the file as "other notes".
  const commentsByKey = useMemo(() => {
    const m = new Map<string, ReviewComment[]>();
    for (const c of comments) {
      const line = c.line ?? c.originalLine;
      if (!line) continue;
      // GitHub omits `side` for context-line comments; default RIGHT
      // (the new file) which matches GitHub's UI default.
      const side = c.side || 'RIGHT';
      const key = `${side}:${line}`;
      const arr = m.get(key) || [];
      arr.push(c);
      m.set(key, arr);
    }
    return m;
  }, [comments]);

  const renderedIds = useMemo(() => new Set<number>(), [comments]);
  const orphanedComments = useMemo(() => {
    // Build the set of (side:line) keys that *will* appear in the diff
    // so we can flag comments that anchor outside the visible patch.
    const anchored = new Set<string>();
    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (line.newLine !== null) anchored.add(`RIGHT:${line.newLine}`);
        if (line.oldLine !== null) anchored.add(`LEFT:${line.oldLine}`);
      }
    }
    return comments.filter((c) => {
      const line = c.line ?? c.originalLine;
      if (!line) return true;
      const side = c.side || 'RIGHT';
      return !anchored.has(`${side}:${line}`);
    });
  }, [hunks, comments]);

  const statusColor = STATUS_COLORS[file.status] || CREAM_DIM;

  return (
    <section
      style={{
        background: 'rgba(244,238,228,0.025)',
        border: `1px solid ${HAIR_STRONG}`,
        marginBottom: '1.25rem',
      }}
    >
      {/* File header */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full px-4 py-3 flex items-center gap-3 transition-colors"
        style={{ background: 'rgba(13,13,13,0.3)' }}
      >
        {expanded ? (
          <ChevronDown
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: CREAM_FAINT }}
          />
        ) : (
          <ChevronRight
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: CREAM_FAINT }}
          />
        )}
        <span
          className="mono uppercase tracking-[0.2em] text-[0.55rem]"
          style={{ color: statusColor }}
        >
          {file.status}
        </span>
        <span
          className="font-mono text-sm truncate flex-1 text-left"
          style={{ color: CREAM }}
        >
          {file.previousFilename ? (
            <>
              <span style={{ color: CREAM_FAINT }}>{file.previousFilename}</span>
              <span style={{ color: CREAM_FAINT }}> → </span>
              <span>{file.filename}</span>
            </>
          ) : (
            file.filename
          )}
        </span>
        {comments.length > 0 && (
          <span
            className="mono uppercase tracking-[0.2em] text-[0.5rem] flex-shrink-0 inline-flex items-center gap-1"
            style={{ color: AMBER }}
            title={`${comments.length} review comment${comments.length === 1 ? '' : 's'} on this file`}
          >
            <MessageSquare className="w-3 h-3" />
            {comments.length}
          </span>
        )}
        <span
          className="mono uppercase tracking-[0.2em] text-[0.5rem] flex-shrink-0"
          style={{ color: FOREST }}
        >
          +{file.additions}
        </span>
        <span
          className="mono uppercase tracking-[0.2em] text-[0.5rem] flex-shrink-0"
          style={{ color: EARTH }}
        >
          −{file.deletions}
        </span>
        {file.blobUrl && (
          <a
            href={file.blobUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mono uppercase tracking-[0.2em] text-[0.5rem] inline-flex items-center gap-1 flex-shrink-0"
            style={{ color: AMBER }}
          >
            blob <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </button>

      {/* Diff body — width values come from CSS variables defined in
          the style jsx below so we can shrink them on mobile. */}
      {expanded && (
        <>
          {!file.patch && (
            <p
              className="px-4 py-6 italic text-center"
              style={{
                background: PAPER_BG,
                color: INK_DIM,
                fontFamily: 'var(--font-fraunces, serif)',
                fontSize: '0.9rem',
              }}
            >
              {file.status === 'renamed' && file.changes === 0
                ? 'Renamed without content changes.'
                : 'No diff available — file may be too large or binary.'}
            </p>
          )}
          {file.patch && (
            <div
              className="pnl-diff-body font-mono overflow-x-auto"
              style={{ background: PAPER_BG, color: INK, lineHeight: 1.55 }}
            >
              {hunks.map((hunk, hi) => (
                <div key={hi}>
                  <div
                    className="px-3 py-1"
                    style={{
                      background: 'rgba(13,13,13,0.04)',
                      color: INK_DIM,
                      borderTop: hi === 0 ? 'none' : `1px solid ${RULE}`,
                      borderBottom: `1px solid ${RULE}`,
                      fontSize: '0.72rem',
                    }}
                  >
                    {hunk.header}
                  </div>
                  {hunk.lines.map((line, li) => {
                    // Look up comments anchored to this exact line+side.
                    // GitHub permits comments on either side of a hunk;
                    // we render them after the line on either side, but
                    // skip duplicates by tracking ID.
                    const inline: ReviewComment[] = [];
                    if (line.newLine !== null) {
                      const arr = commentsByKey.get(`RIGHT:${line.newLine}`);
                      if (arr) {
                        for (const c of arr) {
                          if (!renderedIds.has(c.id)) {
                            inline.push(c);
                            renderedIds.add(c.id);
                          }
                        }
                      }
                    }
                    if (line.oldLine !== null) {
                      const arr = commentsByKey.get(`LEFT:${line.oldLine}`);
                      if (arr) {
                        for (const c of arr) {
                          if (!renderedIds.has(c.id)) {
                            inline.push(c);
                            renderedIds.add(c.id);
                          }
                        }
                      }
                    }
                    return (
                      <React.Fragment key={li}>
                        <DiffLine line={line} />
                        {inline.map((c) => (
                          <InlineComment key={c.id} comment={c} />
                        ))}
                      </React.Fragment>
                    );
                  })}
                </div>
              ))}
              {orphanedComments.length > 0 && (
                <div style={{ background: PAPER_BG }}>
                  <div
                    className="px-3 py-2"
                    style={{
                      background: 'rgba(13,13,13,0.04)',
                      color: INK_DIM,
                      borderTop: `1px solid ${RULE}`,
                      borderBottom: `1px solid ${RULE}`,
                      fontSize: '0.72rem',
                    }}
                  >
                    Other notes on this file
                  </div>
                  {orphanedComments.map((c) => (
                    <InlineComment key={c.id} comment={c} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <style jsx>{`
        /* Diff column widths are responsive — desktop gets generous
           gutters; phones tighten them so the actual code fits. */
        :global(.pnl-diff-body) {
          --diff-gutter: 56px;
          --diff-gutter-pad: 8px;
          --diff-marker: 18px;
          font-size: 0.78rem;
        }
        :global(.pnl-diff-comment-pad) {
          padding-left: calc(2 * (var(--diff-gutter) + var(--diff-gutter-pad)) + var(--diff-marker));
        }
        @media (max-width: 640px) {
          :global(.pnl-diff-body) {
            --diff-gutter: 32px;
            --diff-gutter-pad: 4px;
            --diff-marker: 14px;
            font-size: 0.72rem;
          }
        }
      `}</style>
    </section>
  );
}

function DiffLine({ line }: { line: ParsedLine }) {
  const isAdd = line.kind === 'add';
  const isDel = line.kind === 'del';
  const lineBg = isAdd ? ADD_BG : isDel ? DEL_BG : 'transparent';
  const gutterBg = isAdd ? ADD_GUTTER : isDel ? DEL_GUTTER : 'transparent';

  // Widths are CSS variables (set by the .pnl-diff-body root + a
  // mobile media query) so we don't need to re-render anything to
  // shrink the columns on a phone.
  return (
    <div className="flex" style={{ background: lineBg, whiteSpace: 'pre' }}>
      <span
        className="text-right select-none"
        style={{
          flex: '0 0 auto',
          width: 'var(--diff-gutter, 56px)',
          padding: '0 var(--diff-gutter-pad, 8px)',
          color: INK_FAINT,
          background: gutterBg,
          borderRight: `1px solid ${RULE}`,
        }}
      >
        {line.oldLine ?? ''}
      </span>
      <span
        className="text-right select-none"
        style={{
          flex: '0 0 auto',
          width: 'var(--diff-gutter, 56px)',
          padding: '0 var(--diff-gutter-pad, 8px)',
          color: INK_FAINT,
          background: gutterBg,
          borderRight: `1px solid ${RULE}`,
        }}
      >
        {line.newLine ?? ''}
      </span>
      <span
        className="select-none"
        style={{
          flex: '0 0 auto',
          width: 'var(--diff-marker, 18px)',
          textAlign: 'center',
          color: isAdd ? FOREST : isDel ? EARTH : INK_FAINT,
        }}
      >
        {isAdd ? '+' : isDel ? '−' : ' '}
      </span>
      <span style={{ flex: 1, padding: '0 8px', color: INK }}>
        {line.text}
      </span>
    </div>
  );
}

function InlineComment({ comment }: { comment: ReviewComment }) {
  return (
    <div
      className="pnl-diff-comment-pad"
      style={{
        background: 'rgba(232,150,96,0.06)',
        borderTop: `1px solid ${RULE}`,
        borderBottom: `1px solid ${RULE}`,
        padding: '0.65rem 0.85rem',
      }}
    >
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <p
          className="mono uppercase tracking-[0.2em] text-[0.55rem]"
          style={{ color: INK_DIM }}
        >
          <span style={{ color: INK }}>{comment.author}</span>
          <span style={{ color: INK_FAINT }}>
            {' '}· {timeAgo(comment.createdAt)}
          </span>
          {comment.inReplyToId && (
            <span style={{ color: INK_FAINT }}> · reply</span>
          )}
        </p>
        <a
          href={comment.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mono uppercase tracking-[0.18em] text-[0.5rem] inline-flex items-center gap-1"
          style={{ color: AMBER }}
        >
          on github <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
      {comment.body ? (
        <div className="pnl-md-inline">
          <MarkdownBody source={comment.body} />
        </div>
      ) : (
        <p
          className="italic"
          style={{ color: INK_FAINT, fontFamily: 'var(--font-fraunces, serif)' }}
        >
          (empty comment)
        </p>
      )}
      <style jsx global>{`
        .pnl-md-inline .pnl-md {
          color: ${INK};
          font-size: 0.92rem;
        }
        .pnl-md-inline .pnl-md a { color: #a35a20; border-bottom-color: rgba(163,90,32,0.4); }
        .pnl-md-inline .pnl-md a:hover { border-bottom-color: #a35a20; }
        .pnl-md-inline .pnl-md code { background: rgba(13,13,13,0.06); color: ${INK}; }
        .pnl-md-inline .pnl-md pre { background: rgba(13,13,13,0.04); border-color: ${RULE}; color: ${INK}; }
        .pnl-md-inline .pnl-md pre code { color: ${INK}; }
        .pnl-md-inline .pnl-md blockquote { border-left-color: ${RULE}; color: ${INK_DIM}; }
        .pnl-md-inline .pnl-md strong { color: ${INK}; }
        .pnl-md-inline .pnl-md h1, .pnl-md-inline .pnl-md h2, .pnl-md-inline .pnl-md h3,
        .pnl-md-inline .pnl-md h4, .pnl-md-inline .pnl-md h5, .pnl-md-inline .pnl-md h6 {
          color: ${INK};
          border-bottom-color: ${RULE};
        }
      `}</style>
    </div>
  );
}

function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso).getTime();
  if (!isFinite(d)) return '';
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

const STATUS_COLORS: Record<string, string> = {
  added: FOREST,
  removed: EARTH,
  modified: AMBER,
  renamed: AMBER,
  copied: AMBER,
  changed: AMBER,
  unchanged: CREAM_DIM,
};

interface ParsedLine {
  kind: 'add' | 'del' | 'context';
  oldLine: number | null;
  newLine: number | null;
  text: string;
}

interface ParsedHunk {
  header: string;
  lines: ParsedLine[];
}

/**
 * Parse a unified diff patch into hunks. Patches don't include
 * `--- a/file` / `+++ b/file` headers (GitHub strips them), so the
 * patch starts directly with the first `@@` hunk header.
 */
function parsePatch(patch: string): ParsedHunk[] {
  if (!patch) return [];
  const lines = patch.split('\n');
  const hunks: ParsedHunk[] = [];
  let current: ParsedHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const raw of lines) {
    if (raw.startsWith('@@')) {
      // @@ -oldStart,oldLen +newStart,newLen @@ optional context
      const m = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) {
        oldLine = parseInt(m[1], 10);
        newLine = parseInt(m[2], 10);
      }
      current = { header: raw, lines: [] };
      hunks.push(current);
      continue;
    }
    if (!current) continue;
    if (raw.startsWith('+')) {
      current.lines.push({
        kind: 'add',
        oldLine: null,
        newLine: newLine,
        text: raw.slice(1),
      });
      newLine += 1;
    } else if (raw.startsWith('-')) {
      current.lines.push({
        kind: 'del',
        oldLine: oldLine,
        newLine: null,
        text: raw.slice(1),
      });
      oldLine += 1;
    } else if (raw.startsWith('\\')) {
      // "\ No newline at end of file" — show as context but no line numbers.
      current.lines.push({
        kind: 'context',
        oldLine: null,
        newLine: null,
        text: raw,
      });
    } else {
      // Context line (starts with space, but tolerate empty for safety).
      current.lines.push({
        kind: 'context',
        oldLine: oldLine,
        newLine: newLine,
        text: raw.startsWith(' ') ? raw.slice(1) : raw,
      });
      oldLine += 1;
      newLine += 1;
    }
  }
  return hunks;
}
