'use client';

/**
 * FileViewer
 *
 * Renders a single file with syntax highlighting via prism-react-renderer.
 * Markdown files render as the code by default — we don't try to dual-mode
 * here; readers who want rendered markdown can use the README section on
 * /research/[id]. Binary files show a link out to GitHub instead.
 */

import React from 'react';
import Link from 'next/link';
import { Highlight, type Language, type PrismTheme } from 'prism-react-renderer';
import { ExternalLink, Download } from 'lucide-react';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';

const PAPER_BG = '#fbfaf6';
const INK = '#0d0d0d';
const INK_DIM = 'rgba(13,13,13,0.62)';
const INK_FAINT = 'rgba(13,13,13,0.35)';
const RULE = 'rgba(13,13,13,0.12)';

interface FileData {
  path: string;
  name: string;
  size: number;
  binary: boolean;
  content: string | null;
  downloadUrl: string | null;
  htmlUrl: string | null;
}

interface FileViewerProps {
  paperId: string;
  file: FileData;
  segments: string[]; // Path segments for breadcrumbs
}

export function FileViewer({ paperId, file, segments }: FileViewerProps) {
  if (file.binary) {
    return (
      <div
        className="px-6 py-10"
        style={{
          background: 'rgba(244,238,228,0.025)',
          border: `1px solid ${HAIR_STRONG}`,
          textAlign: 'center',
        }}
      >
        <p
          className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-3"
          style={{ color: CREAM_FAINT }}
        >
          binary file · {formatBytes(file.size)}
        </p>
        <p
          className="mb-6 italic"
          style={{
            fontFamily: 'var(--font-fraunces, serif)',
            color: CREAM_DIM,
            fontSize: '1rem',
          }}
        >
          We don’t render binaries inline. Open it on GitHub or download
          it directly.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {file.htmlUrl && (
            <a
              href={file.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mono uppercase tracking-[0.22em] text-[0.6rem] inline-flex items-center gap-2 px-3 py-2 transition-colors"
              style={{ color: AMBER, border: `1px solid ${AMBER}66` }}
            >
              view on github <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {file.downloadUrl && (
            <a
              href={file.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mono uppercase tracking-[0.22em] text-[0.6rem] inline-flex items-center gap-2 px-3 py-2 transition-colors"
              style={{ color: CREAM_DIM, border: `1px solid ${HAIR_STRONG}` }}
            >
              <Download className="w-3 h-3" /> download
            </a>
          )}
        </div>
      </div>
    );
  }

  const content = file.content || '';
  const language = detectLanguage(file.name);
  const lineCount = content.split('\n').length;

  return (
    <div>
      <div
        className="px-3 py-2 flex items-center justify-between flex-wrap gap-2"
        style={{
          background: 'rgba(13,13,13,0.4)',
          border: `1px solid ${HAIR_STRONG}`,
          borderBottom: 'none',
          color: CREAM_DIM,
        }}
      >
        <p
          className="mono uppercase tracking-[0.18em] text-[0.55rem]"
          style={{ color: CREAM_FAINT }}
        >
          {lineCount} lines · {formatBytes(file.size)} · {language || 'text'}
        </p>
        <div className="flex items-center gap-3">
          {file.htmlUrl && (
            <a
              href={file.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mono uppercase tracking-[0.22em] text-[0.55rem] inline-flex items-center gap-1"
              style={{ color: AMBER }}
            >
              github <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {file.downloadUrl && (
            <a
              href={file.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mono uppercase tracking-[0.22em] text-[0.55rem] inline-flex items-center gap-1"
              style={{ color: CREAM_FAINT }}
            >
              <Download className="w-3 h-3" /> raw
            </a>
          )}
        </div>
      </div>

      <Highlight
        theme={paperPrismTheme}
        code={content}
        language={(language as Language) || 'markup'}
      >
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`pnl-file-pre ${className}`}
            style={{
              ...style,
              margin: 0,
              padding: '1rem 0',
              background: PAPER_BG,
              border: `1px solid ${HAIR_STRONG}`,
              borderTop: 'none',
              overflowX: 'auto',
              lineHeight: 1.5,
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            }}
          >
            {tokens.map((line, i) => {
              const lineProps = getLineProps({ line });
              return (
                <div
                  key={i}
                  {...lineProps}
                  className={lineProps.className}
                  style={{ ...lineProps.style, display: 'flex' }}
                >
                  <span
                    className="pnl-file-gutter"
                    style={{
                      flex: '0 0 auto',
                      textAlign: 'right',
                      userSelect: 'none',
                      color: INK_FAINT,
                      borderRight: `1px solid ${RULE}`,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ flex: 1, whiteSpace: 'pre' }}>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              );
            })}
          </pre>
        )}
      </Highlight>
      <style jsx>{`
        /* Wider gutter + bigger font on desktop, tight on phones so the
           code itself gets the most horizontal real estate. */
        .pnl-file-pre {
          font-size: 0.85rem;
        }
        .pnl-file-pre .pnl-file-gutter {
          width: 56px;
          padding-right: 16px;
          margin-right: 16px;
        }
        @media (max-width: 640px) {
          .pnl-file-pre {
            font-size: 0.78rem;
          }
          .pnl-file-pre .pnl-file-gutter {
            width: 38px;
            padding-right: 8px;
            margin-right: 10px;
          }
        }
      `}</style>
    </div>
  );
}

function formatBytes(b: number): string {
  if (!b) return '0 b';
  if (b < 1024) return `${b} b`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} kb`;
  return `${(b / (1024 * 1024)).toFixed(1)} mb`;
}

// Map common extensions to Prism language identifiers.
function detectLanguage(name: string): string {
  const lower = name.toLowerCase();
  const ext = lower.split('.').pop() || '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    mjs: 'javascript',
    cjs: 'javascript',
    py: 'python',
    rs: 'rust',
    go: 'go',
    rb: 'ruby',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    md: 'markdown',
    markdown: 'markdown',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    sol: 'solidity',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'markup',
    xml: 'markup',
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
    dockerfile: 'docker',
  };
  if (map[ext]) return map[ext];
  if (lower === 'dockerfile') return 'docker';
  if (lower === 'makefile') return 'makefile';
  return 'markup';
}

// Custom Prism theme — paper-cream background, ink-dark base, accent
// colors lifted from the cosmic-plant palette so token highlights feel
// part of the same world.
const paperPrismTheme: PrismTheme = {
  plain: {
    color: INK,
    backgroundColor: PAPER_BG,
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: { color: INK_FAINT, fontStyle: 'italic' },
    },
    {
      types: ['punctuation'],
      style: { color: INK_DIM },
    },
    {
      types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol', 'deleted'],
      style: { color: '#a35a20' },
    },
    {
      types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'],
      style: { color: '#3f7a42' },
    },
    {
      types: ['operator', 'entity', 'url', 'variable'],
      style: { color: '#0d0d0d' },
    },
    {
      types: ['atrule', 'attr-value', 'keyword'],
      style: { color: '#c54a1f', fontWeight: '600' },
    },
    {
      types: ['function', 'class-name'],
      style: { color: '#7a3d12' },
    },
    {
      types: ['regex', 'important'],
      style: { color: '#c54a1f' },
    },
  ],
};
