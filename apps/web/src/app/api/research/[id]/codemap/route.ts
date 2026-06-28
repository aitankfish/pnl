/**
 * GET /api/research/[id]/codemap
 *
 * Renders the linked repo's ARCHITECTURE / codemap doc, if it has one — the
 * hand-written "how it's built and what's proven" map (ASCII diagrams, status
 * legends, file pointers). Complements the README (how to run) and the cited
 * papers (the research). Probes a small set of conventional paths and renders
 * the first that exists via GitHub's markdown API, sanitized. 404 → the client
 * shows nothing (not every repo has one).
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import sanitizeHtml from 'sanitize-html';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const GITHUB_API = 'https://api.github.com';
const USER_AGENT = 'PNL-Research-Reader/1.0';

// Conventional homes for an architecture/codemap doc, in priority order.
const CANDIDATES = [
  'ARCHITECTURE.md',
  'docs/ARCHITECTURE.md',
  'CODEMAP.md',
  'docs/CODEMAP.md',
  'docs/INFRA-MAP.md',
  'docs/infra-map.md',
  'docs/architecture.md',
  'Architecture.md',
  'docs/OVERVIEW.md',
];

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
    }

    await connectToDatabase();
    const paper = await ResearchPaper.findById(id).lean<any>();
    if (!paper || paper.status !== 'active') {
      return NextResponse.json({ success: false, error: 'Paper not found' }, { status: 404 });
    }
    if (!paper.githubUrl) {
      return NextResponse.json({ success: false, error: 'No linked repository' }, { status: 404 });
    }

    const parsed = parseRepoFromUrl(paper.githubUrl);
    if (!parsed) {
      return NextResponse.json({ success: false, error: 'Stored github URL is malformed' }, { status: 500 });
    }

    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.github+json',
    };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

    // Probe candidates; take the first that exists.
    let markdown: string | null = null;
    let filename = '';
    for (const path of CANDIDATES) {
      const res = await fetch(`${GITHUB_API}/repos/${parsed.owner}/${parsed.repo}/contents/${path}`, {
        headers,
        next: { revalidate: 3600 } as any,
      });
      if (res.status === 403) {
        return NextResponse.json({ success: false, error: 'GitHub rate limit exceeded' }, { status: 502 });
      }
      if (res.ok) {
        const json = await res.json();
        if (json?.content) {
          markdown = decodeBase64(json.content);
          filename = json.name || path;
          break;
        }
      }
      // 404 → try the next candidate.
    }

    if (!markdown) {
      return NextResponse.json(
        { success: false, error: 'No architecture/codemap doc found', repo: `${parsed.owner}/${parsed.repo}` },
        { status: 404 },
      );
    }

    // Render via GitHub's markdown API, then sanitize (defense in depth).
    const renderRes = await fetch(`${GITHUB_API}/markdown`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: markdown, mode: 'gfm', context: `${parsed.owner}/${parsed.repo}` }),
      next: { revalidate: 3600 } as any,
    });

    if (!renderRes.ok) {
      return NextResponse.json({
        success: true,
        data: { html: null, markdown, filename, repo: `${parsed.owner}/${parsed.repo}`, repoUrl: paper.githubUrl },
      });
    }

    const html = sanitizeRepoHtml(await renderRes.text());
    return NextResponse.json({
      success: true,
      data: { html, markdown: null, filename, repo: `${parsed.owner}/${parsed.repo}`, repoUrl: paper.githubUrl },
    });
  } catch (error) {
    logger.error('[research/codemap] failed', error as any);
    return NextResponse.json({ success: false, error: 'Failed to load codemap' }, { status: 500 });
  }
}

function parseRepoFromUrl(url: string): { owner: string; repo: string } | null {
  const cleaned = url.trim().replace(/^https?:\/\//i, '').replace(/^github\.com\//i, '');
  const parts = cleaned.split(/[/?#]/).filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null;
  return { owner, repo };
}

function decodeBase64(b64: string): string {
  return Buffer.from(b64.replace(/\n/g, ''), 'base64').toString('utf-8');
}

// Same strict allowlist as the README renderer — third-party repo content.
function sanitizeRepoHtml(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr', 'div', 'span', 'section', 'article',
      'a', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'sub', 'sup', 'mark', 'small',
      'blockquote', 'q', 'cite',
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
      'pre', 'code', 'kbd', 'samp', 'var',
      'img', 'figure', 'figcaption', 'picture', 'source',
      'details', 'summary',
      'input',
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel', 'aria-label'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      input: ['type', 'checked', 'disabled'],
      th: ['align', 'colspan', 'rowspan', 'scope'],
      td: ['align', 'colspan', 'rowspan'],
      code: ['class'],
      pre: ['class'],
      div: ['class'],
      span: ['class'],
      h1: ['id'], h2: ['id'], h3: ['id'], h4: ['id'], h5: ['id'], h6: ['id'],
      '*': [],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
    },
  });
}
