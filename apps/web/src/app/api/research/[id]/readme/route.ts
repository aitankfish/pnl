/**
 * GET /api/research/[id]/readme
 *
 * Fetches the linked GitHub repo's README and returns rendered HTML via
 * GitHub's public markdown API. Public; relies on the unauthenticated rate
 * limit (60/hr/IP) — set GITHUB_TOKEN to raise to 5000/hr.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import sanitizeHtml from 'sanitize-html';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const GITHUB_API = 'https://api.github.com';
const USER_AGENT = 'PNL-Research-Reader/1.0';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
      return NextResponse.json(
        { success: false, error: 'This paper has no linked repository' },
        { status: 404 },
      );
    }

    const parsed = parseRepoFromUrl(paper.githubUrl);
    if (!parsed) {
      return NextResponse.json(
        { success: false, error: 'Stored github URL is malformed' },
        { status: 500 },
      );
    }

    const headers: Record<string, string> = {
      'User-Agent': USER_AGENT,
      Accept: 'application/vnd.github+json',
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    // 1. Fetch raw README content + metadata.
    const readmeRes = await fetch(
      `${GITHUB_API}/repos/${parsed.owner}/${parsed.repo}/readme`,
      { headers, next: { revalidate: 3600 } as any },
    );

    if (readmeRes.status === 404) {
      return NextResponse.json(
        {
          success: false,
          error: 'No README found on that repository',
          repo: `${parsed.owner}/${parsed.repo}`,
        },
        { status: 404 },
      );
    }
    if (readmeRes.status === 403) {
      return NextResponse.json(
        { success: false, error: 'GitHub rate limit exceeded' },
        { status: 502 },
      );
    }
    if (!readmeRes.ok) {
      logger.error('[research/readme] github readme fetch failed', {
        status: readmeRes.status,
      } as any);
      return NextResponse.json(
        { success: false, error: 'GitHub returned an error' },
        { status: 502 },
      );
    }

    const readmeJson = await readmeRes.json();
    const markdown = decodeBase64(readmeJson.content || '');
    const filename: string = readmeJson.name || 'README.md';

    // 2. Render markdown to HTML via GitHub's /markdown endpoint.
    const renderRes = await fetch(`${GITHUB_API}/markdown`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: markdown,
        mode: 'gfm',
        context: `${parsed.owner}/${parsed.repo}`,
      }),
      next: { revalidate: 3600 } as any,
    });

    if (!renderRes.ok) {
      logger.error('[research/readme] github render failed', {
        status: renderRes.status,
      } as any);
      // Fall back to raw markdown so the client still has something to show.
      return NextResponse.json({
        success: true,
        data: {
          html: null,
          markdown,
          filename,
          repo: `${parsed.owner}/${parsed.repo}`,
          repoUrl: paper.githubUrl,
        },
      });
    }

    const rawHtml = await renderRes.text();
    const html = sanitizeReadmeHtml(rawHtml);

    return NextResponse.json({
      success: true,
      data: {
        html,
        markdown: null,
        filename,
        repo: `${parsed.owner}/${parsed.repo}`,
        repoUrl: paper.githubUrl,
      },
    });
  } catch (error) {
    logger.error('[research/readme] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load README' },
      { status: 500 },
    );
  }
}

function parseRepoFromUrl(url: string): { owner: string; repo: string } | null {
  const cleaned = url.trim().replace(/^https?:\/\//i, '').replace(/^github\.com\//i, '');
  const parts = cleaned.split(/[/?#]/).filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, '');
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    return null;
  }
  return { owner, repo };
}

function decodeBase64(b64: string): string {
  // GitHub's content field has line breaks every 60 chars.
  const stripped = b64.replace(/\n/g, '');
  return Buffer.from(stripped, 'base64').toString('utf-8');
}

/**
 * Sanitize HTML returned by GitHub's /markdown endpoint. GitHub already
 * sanitizes its output, but we apply a strict allowlist as defense in depth —
 * the input markdown comes from a third-party repo we don't control.
 */
function sanitizeReadmeHtml(input: string): string {
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
      'input', // for GFM task list checkboxes
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target', 'rel', 'aria-label'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      input: ['type', 'checked', 'disabled'], // task list items only
      th: ['align', 'colspan', 'rowspan', 'scope'],
      td: ['align', 'colspan', 'rowspan'],
      code: ['class'], // language-* hints
      pre: ['class'],
      div: ['class'],
      span: ['class'],
      h1: ['id'],
      h2: ['id'],
      h3: ['id'],
      h4: ['id'],
      h5: ['id'],
      h6: ['id'],
      '*': [], // explicit empty default
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
    allowProtocolRelative: false,
    transformTags: {
      // Force every external link to open in a new tab + drop referrer.
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
    },
  });
}
