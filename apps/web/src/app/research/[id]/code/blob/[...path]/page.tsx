/**
 * /research/[id]/code/blob/[...path]
 *
 * Renders a single file from the linked repo. Catch-all path segment
 * supports any depth of nesting. The path is server-fetched (with
 * Redis cache) so the first paint has real content; the rest of the
 * page chrome (breadcrumbs, language hint, line numbers) is laid out
 * around it.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Types } from 'mongoose';
import { connectToDatabase, ResearchPaper } from '@/lib/mongodb';
import { ghCachedFetch, parseRepoFromUrl } from '@/lib/github';
import { FileViewer } from '@/components/research/FileViewer';

export const dynamic = 'force-dynamic';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';

const MAX_TEXT_BYTES = 1024 * 1024;
const BINARY_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'tiff',
  'pdf', 'zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar',
  'mp3', 'mp4', 'mov', 'avi', 'mkv', 'webm', 'wav', 'flac', 'ogg',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'so', 'dylib', 'dll', 'exe', 'wasm',
  'class', 'jar',
]);
function isLikelyBinary(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase();
  if (!ext) return false;
  return BINARY_EXTS.has(ext);
}

interface PageProps {
  params: Promise<{ id: string; path: string[] }>;
  searchParams: Promise<{ ref?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { path } = await params;
  const filename = path?.length ? path[path.length - 1] : 'file';
  return { title: `${filename} · code · PNL` };
}

export default async function FilePage({ params, searchParams }: PageProps) {
  const { id, path: pathSegments } = await params;
  const sp = await searchParams;
  const requestedRef = (sp.ref || '').trim();
  if (!Types.ObjectId.isValid(id)) notFound();
  if (!pathSegments || pathSegments.length === 0) notFound();

  await connectToDatabase();
  const paper = await ResearchPaper.findById(id).lean<any>();
  if (!paper || paper.status !== 'active') notFound();
  if (!paper.githubUrl) notFound();

  const parsed = parseRepoFromUrl(paper.githubUrl);
  if (!parsed) notFound();

  const decodedPath = pathSegments.map(decodeURIComponent).join('/');

  const refQuery = requestedRef
    ? `?ref=${encodeURIComponent(requestedRef)}`
    : '';
  const apiPath = `/repos/${parsed.owner}/${parsed.repo}/contents/${encodeURIComponent(
    decodedPath,
  ).replace(/%2F/g, '/')}${refQuery}`;

  const result = await ghCachedFetch<any>(apiPath, {
    cacheKey: `file:${parsed.owner}/${parsed.repo}:${requestedRef || 'default'}:${decodedPath}`,
    ttlSeconds: 5 * 60,
  });

  let file:
    | {
        path: string;
        name: string;
        size: number;
        binary: boolean;
        content: string | null;
        downloadUrl: string | null;
        htmlUrl: string | null;
      }
    | null = null;
  let errorMessage: string | null = null;

  if (result.kind === 'ok') {
    const r = result.data;
    if (r.type !== 'file') {
      errorMessage = 'That path is a directory.';
    } else if (isLikelyBinary(r.name) || r.size > MAX_TEXT_BYTES) {
      file = {
        path: r.path,
        name: r.name,
        size: r.size,
        binary: true,
        content: null,
        downloadUrl: r.download_url,
        htmlUrl: r.html_url,
      };
    } else {
      let content = '';
      if (r.encoding === 'base64' && r.content) {
        content = Buffer.from(r.content.replace(/\n/g, ''), 'base64').toString(
          'utf-8',
        );
      } else if (r.content) {
        content = r.content;
      }
      file = {
        path: r.path,
        name: r.name,
        size: r.size,
        binary: false,
        content,
        downloadUrl: r.download_url,
        htmlUrl: r.html_url,
      };
    }
  } else if (result.kind === 'not-found') {
    errorMessage = 'File not found.';
  } else if (result.kind === 'rate-limited') {
    errorMessage = 'GitHub rate limit reached. Try again shortly.';
  } else {
    errorMessage = 'GitHub returned an error.';
  }

  // Build breadcrumb segments — each links to either the file overview
  // (root) or potentially a future folder browser.
  const breadcrumbSegments = pathSegments.map((seg, idx) => ({
    name: decodeURIComponent(seg),
    isLast: idx === pathSegments.length - 1,
  }));

  return (
    <div style={{ color: CREAM, minHeight: '100vh' }}>
      <div className="px-4 sm:px-6 pb-20">
        <div className="max-w-5xl mx-auto pt-8 sm:pt-12">
          <Link
            href={`/research/${id}/code${requestedRef ? `?ref=${encodeURIComponent(requestedRef)}` : ''}`}
            className="inline-flex items-center gap-2 mono uppercase tracking-[0.22em] text-[0.6rem] mb-6 transition-colors"
            style={{ color: CREAM_DIM }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            back to the code overview
          </Link>

          {/* Breadcrumbs + filename header */}
          <header className="mb-6">
            <p
              className="mono uppercase tracking-[0.32em] text-[0.6rem] mb-2"
              style={{ color: AMBER }}
            >
              github.com/{parsed.owner}/{parsed.repo}
            </p>
            <p
              className="mono text-[0.85rem] flex items-center gap-1 flex-wrap"
              style={{ color: CREAM_DIM }}
            >
              {breadcrumbSegments.map((seg, idx) => (
                <span key={idx} className="inline-flex items-center gap-1">
                  {idx > 0 && (
                    <span style={{ color: HAIR_STRONG }}>/</span>
                  )}
                  <span style={{ color: seg.isLast ? CREAM : CREAM_DIM }}>
                    {seg.name}
                  </span>
                </span>
              ))}
            </p>
          </header>

          {file ? (
            <FileViewer paperId={id} file={file} segments={pathSegments} />
          ) : (
            <div
              className="px-6 py-10 text-center"
              style={{
                background: 'rgba(244,238,228,0.025)',
                border: `1px solid ${HAIR_STRONG}`,
              }}
            >
              <p
                className="italic mb-2"
                style={{
                  fontFamily: 'var(--font-fraunces, serif)',
                  color: CREAM_DIM,
                  fontSize: '1.1rem',
                }}
              >
                {errorMessage || 'Couldn’t load this file.'}
              </p>
              <p
                className="mono uppercase tracking-[0.22em] text-[0.55rem]"
                style={{ color: CREAM_FAINT }}
              >
                {decodedPath}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
