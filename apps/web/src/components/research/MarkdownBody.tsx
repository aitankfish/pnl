'use client';

/**
 * MarkdownBody
 *
 * Renders GitHub-flavored markdown (issue/PR bodies and comments) using
 * react-markdown + remark-gfm. Styled with the cosmic-plant typography
 * so issue threads feel like part of PNL, not embedded GitHub.
 *
 * Note: react-markdown sanitizes by default — it doesn't render raw
 * HTML embedded in markdown, which is exactly the safety posture we
 * want when displaying third-party content.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.08)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';

export function MarkdownBody({ source }: { source: string }) {
  return (
    <div className="pnl-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Force every external link to open in a new tab + nofollow.
          a: ({ href, children }) => (
            <a
              href={href || '#'}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="pnl-md-a"
            >
              {children}
            </a>
          ),
          // Disable raw HTML images from external sources where possible —
          // remark-gfm/react-markdown handle this via the standard parser
          // already; we just style what makes it through.
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src || ''}
              alt={alt || ''}
              className="pnl-md-img"
              loading="lazy"
            />
          ),
        }}
      >
        {source}
      </ReactMarkdown>

      <style jsx global>{`
        .pnl-md {
          font-family: var(--font-fraunces, serif);
          color: ${CREAM};
          font-size: 1rem;
          line-height: 1.55;
        }
        .pnl-md > *:first-child { margin-top: 0; }
        .pnl-md > *:last-child { margin-bottom: 0; }

        .pnl-md p { margin: 0 0 0.85rem; }
        .pnl-md h1, .pnl-md h2, .pnl-md h3,
        .pnl-md h4, .pnl-md h5, .pnl-md h6 {
          font-family: var(--font-fraunces, serif);
          font-weight: 400;
          letter-spacing: -0.005em;
          line-height: 1.18;
          margin: 1.6rem 0 0.65rem;
          color: ${CREAM};
        }
        .pnl-md h1 { font-size: 1.65rem; padding-bottom: 0.3rem; border-bottom: 1px solid ${HAIR_STRONG}; }
        .pnl-md h2 { font-size: 1.4rem; padding-bottom: 0.25rem; border-bottom: 1px solid ${HAIR}; }
        .pnl-md h3 { font-size: 1.2rem; }
        .pnl-md h4 { font-size: 1.05rem; }
        .pnl-md strong { font-weight: 600; color: ${CREAM}; }
        .pnl-md em { font-style: italic; }
        .pnl-md del { text-decoration: line-through; color: ${CREAM_FAINT}; }

        .pnl-md ul, .pnl-md ol { padding-left: 1.4rem; margin: 0 0 0.85rem; }
        .pnl-md li { margin: 0.2rem 0; }
        .pnl-md li > p { margin: 0; }
        .pnl-md li input[type='checkbox'] {
          margin-right: 0.45em;
          accent-color: ${FOREST};
        }

        .pnl-md blockquote {
          margin: 0.75rem 0;
          padding: 0.15rem 1rem;
          border-left: 2px solid ${HAIR_STRONG};
          color: ${CREAM_DIM};
        }
        .pnl-md blockquote > *:first-child { margin-top: 0; }
        .pnl-md blockquote > *:last-child { margin-bottom: 0; }

        .pnl-md-a {
          color: ${AMBER};
          text-decoration: none;
          border-bottom: 1px solid rgba(232,150,96,0.4);
        }
        .pnl-md-a:hover { border-bottom-color: ${AMBER}; }

        .pnl-md code {
          font-family: ui-monospace, SFMono-Regular, monospace;
          background: rgba(244,238,228,0.07);
          padding: 0.1em 0.35em;
          border-radius: 2px;
          font-size: 0.88em;
          color: ${CREAM};
        }
        .pnl-md pre {
          background: rgba(13,13,13,0.5);
          border: 1px solid ${HAIR_STRONG};
          padding: 0.85rem 1rem;
          overflow-x: auto;
          margin: 0 0 0.85rem;
          font-size: 0.85rem;
          line-height: 1.5;
        }
        .pnl-md pre code {
          background: transparent;
          padding: 0;
          color: ${CREAM};
        }

        .pnl-md table {
          border-collapse: collapse;
          margin: 0.85rem 0;
          font-size: 0.92em;
          width: auto;
          max-width: 100%;
          overflow-x: auto;
        }
        .pnl-md th, .pnl-md td {
          border: 1px solid ${HAIR_STRONG};
          padding: 0.45em 0.75em;
          text-align: left;
        }
        .pnl-md th {
          background: rgba(244,238,228,0.04);
          font-weight: 600;
        }

        .pnl-md hr {
          border: none;
          border-top: 1px solid ${HAIR_STRONG};
          margin: 1.5rem 0;
        }

        .pnl-md-img {
          max-width: 100%;
          height: auto;
          margin: 0.6rem 0;
          border: 1px solid ${HAIR_STRONG};
        }
      `}</style>
    </div>
  );
}
