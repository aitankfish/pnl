'use client';

/**
 * FileTree
 *
 * Interactive directory listing for a paper's linked repo. Folders
 * expand/collapse on click; clicking a file navigates to the file
 * viewer. Lazy-fetches subdirectory contents only when expanded so
 * we don't blow GitHub rate limits walking deep trees.
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  Loader2,
} from 'lucide-react';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';

interface TreeEntry {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  sha: string;
  size: number;
}

interface FileTreeProps {
  paperId: string;
  initialEntries: TreeEntry[];
  initialPath?: string;
  defaultBranch?: string;
  ref?: string;
}

export function FileTree({
  paperId,
  initialEntries,
  defaultBranch,
  ref: gitRef,
}: FileTreeProps) {
  return (
    <div
      className="pnl-file-tree font-mono text-sm"
      style={{
        background: 'rgba(244,238,228,0.025)',
        border: `1px solid ${HAIR_STRONG}`,
        color: CREAM,
      }}
    >
      <ul>
        {initialEntries.map((entry) => (
          <TreeNode
            key={entry.path}
            entry={entry}
            paperId={paperId}
            depth={0}
            defaultBranch={defaultBranch}
            gitRef={gitRef}
          />
        ))}
      </ul>
      <style jsx>{`
        /* Per-level indent comes from --indent-step on the tree root.
           Smaller on mobile so deeply-nested folders don't push file
           rows off-screen. */
        .pnl-file-tree {
          --indent-step: 1.1rem;
        }
        @media (max-width: 640px) {
          .pnl-file-tree {
            --indent-step: 0.65rem;
          }
        }
      `}</style>
    </div>
  );
}

function TreeNode({
  entry,
  paperId,
  depth,
  defaultBranch,
  gitRef,
}: {
  entry: TreeEntry;
  paperId: string;
  depth: number;
  defaultBranch?: string;
  gitRef?: string;
}) {
  const isFolder = entry.type === 'dir';
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<TreeEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChildren = useCallback(async () => {
    if (children !== null) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ path: entry.path });
      if (gitRef) params.set('ref', gitRef);
      const res = await fetch(
        `/api/research/${paperId}/repo/tree?${params.toString()}`,
      );
      const json = await res.json();
      if (json?.success) {
        setChildren(json.data?.entries || []);
      } else {
        setError(json?.error || 'Failed to load directory');
      }
    } catch {
      setError('Failed to load directory');
    } finally {
      setLoading(false);
    }
  }, [entry.path, paperId, children, gitRef]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && children === null) loadChildren();
  };

  const indentStyle: React.CSSProperties = {
    paddingLeft: `calc(${depth} * var(--indent-step, 1.1rem) + 0.6rem)`,
  };

  if (isFolder) {
    return (
      <li>
        <button
          type="button"
          onClick={toggle}
          className="w-full text-left flex items-center gap-2 py-2 sm:py-1.5 transition-colors"
          style={{
            ...indentStyle,
            paddingRight: '0.6rem',
            background: open ? 'rgba(232,150,96,0.04)' : 'transparent',
          }}
          onMouseEnter={(e) => {
            if (!open) e.currentTarget.style.background = 'rgba(244,238,228,0.04)';
          }}
          onMouseLeave={(e) => {
            if (!open) e.currentTarget.style.background = 'transparent';
          }}
        >
          <ChevronRight
            className="w-3 h-3 flex-shrink-0 transition-transform"
            style={{
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
              color: CREAM_FAINT,
            }}
          />
          {open ? (
            <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" style={{ color: AMBER }} />
          ) : (
            <Folder className="w-3.5 h-3.5 flex-shrink-0" style={{ color: AMBER }} />
          )}
          <span className="truncate" style={{ color: CREAM }}>
            {entry.name}
          </span>
        </button>
        {open && (
          <div>
            {loading && (
              <p
                className="flex items-center gap-2 py-1.5"
                style={{ ...indentStyle, paddingLeft: `calc(${depth + 1} * 1.1rem + 1.7rem)`, color: CREAM_FAINT }}
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="mono uppercase tracking-[0.22em] text-[0.5rem]">
                  loading…
                </span>
              </p>
            )}
            {error && (
              <p
                className="py-1.5 italic"
                style={{
                  ...indentStyle,
                  paddingLeft: `calc(${depth + 1} * var(--indent-step, 1.1rem) + 1.7rem)`,
                  color: '#d67347',
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontSize: '0.8rem',
                }}
              >
                {error}
              </p>
            )}
            {children && children.length === 0 && (
              <p
                className="py-1.5 italic"
                style={{
                  ...indentStyle,
                  paddingLeft: `calc(${depth + 1} * var(--indent-step, 1.1rem) + 1.7rem)`,
                  color: CREAM_FAINT,
                  fontFamily: 'var(--font-fraunces, serif)',
                  fontSize: '0.85rem',
                }}
              >
                empty
              </p>
            )}
            {children && children.length > 0 && (
              <ul>
                {children.map((c) => (
                  <TreeNode
                    key={c.path}
                    entry={c}
                    paperId={paperId}
                    depth={depth + 1}
                    defaultBranch={defaultBranch}
                    gitRef={gitRef}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </li>
    );
  }

  // File row → link to viewer. Preserve ?ref= so the viewer fetches
  // from the same branch the user is browsing.
  const refSuffix = gitRef ? `?ref=${encodeURIComponent(gitRef)}` : '';
  return (
    <li>
      <Link
        href={`/research/${paperId}/code/blob/${entry.path
          .split('/')
          .map(encodeURIComponent)
          .join('/')}${refSuffix}`}
        className="flex items-center gap-2 py-2 sm:py-1.5 transition-colors"
        style={{
          ...indentStyle,
          paddingRight: '0.6rem',
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = 'rgba(244,238,228,0.04)')
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <span className="w-3 h-3 flex-shrink-0" />
        <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: CREAM_FAINT }} />
        <span className="truncate min-w-0" style={{ color: CREAM_DIM }}>
          {entry.name}
        </span>
        <span
          className="hidden sm:inline ml-auto mono uppercase tracking-[0.18em] text-[0.5rem] flex-shrink-0"
          style={{ color: CREAM_FAINT }}
        >
          {formatBytes(entry.size)}
        </span>
      </Link>
    </li>
  );
}

function formatBytes(b: number): string {
  if (!b) return '';
  if (b < 1024) return `${b}b`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}kb`;
  return `${(b / (1024 * 1024)).toFixed(1)}mb`;
}
