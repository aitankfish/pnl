'use client';

/**
 * Project Updates — the founder's build-in-public feed on a market page.
 *
 * Founders post durable updates (text + images) here; this is the default
 * "Updates" tab and the narrative center of the project page. Replies come in a
 * later phase (they'll reuse ChatMessage). Admins/founders can hide a post.
 */

import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, ImagePlus, X, Trash2, Sparkles } from 'lucide-react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { useWallet } from '@/hooks/useWallet';
import { useToast } from '@/lib/hooks/useToast';
import { isPlatformAdmin } from '@/lib/admin';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const BG = '#0a0814';
const EARTH = '#d67347';

const MAX_IMAGES = 4;

interface Post {
  id: string;
  authorWallet: string;
  body: string;
  media: { url: string; kind: string }[];
  sourceUrl: string | null;
  pinned: boolean;
  editedAt: string | null;
  createdAt: string;
}

export function ProjectUpdates({ marketId, founderWallet }: { marketId: string; founderWallet: string | null }) {
  const { primaryWallet, authenticated } = useWallet();
  const { showToast } = useToast();
  const wallet = primaryWallet?.address || null;
  const isFounder = !!authenticated && !!wallet && wallet === founderWallet;
  const isAdmin = isPlatformAdmin(wallet);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch(`/api/markets/${marketId}/posts?limit=50`);
      const json = await res.json();
      if (json.success) setPosts(json.data.posts || []);
    } catch (e) {
      logger.error('[updates] load failed', e as any);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId]);

  const removePost = async (id: string) => {
    if (!window.confirm('Hide this update?')) return;
    try {
      const res = await authFetch(`/api/markets/${marketId}/posts/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setPosts((p) => p.filter((x) => x.id !== id));
    } catch (e) {
      showToast({ type: 'error', title: 'Couldn’t hide the update', message: e instanceof Error ? e.message : '' });
    }
  };

  return (
    <div className="space-y-4">
      {isFounder && <Composer marketId={marketId} onPosted={(p) => setPosts((prev) => [p, ...prev])} />}

      {loading ? (
        <div className="flex items-center justify-center py-10" style={{ color: CREAM_FAINT }}>
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-10 text-center" style={{ color: CREAM_FAINT }}>
          <p style={{ fontFamily: 'var(--font-fraunces, serif)', fontSize: '1.05rem', color: CREAM_DIM }}>
            No updates yet.
          </p>
          {isFounder && (
            <p className="mono uppercase tracking-[0.2em] text-[0.55rem] mt-2">Post the first build update above.</p>
          )}
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            canRemove={isAdmin || (isFounder && post.authorWallet === wallet)}
            onRemove={() => removePost(post.id)}
          />
        ))
      )}
    </div>
  );
}

function Composer({ marketId, onPosted }: { marketId: string; onPosted: (p: Post) => void }) {
  const { showToast } = useToast();
  const [body, setBody] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Manage preview object URLs in an effect (not in render) so each is revoked
  // when the image set changes or the composer unmounts — no leak, and the
  // blob URL never flows directly into JSX.
  useEffect(() => {
    const urls = images.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [images]);

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const next = [...images, ...Array.from(files)].slice(0, MAX_IMAGES);
    setImages(next);
  };

  const submit = async () => {
    if (!body.trim() && images.length === 0) return;
    setPosting(true);
    try {
      const fd = new FormData();
      if (body.trim()) fd.append('body', body.trim());
      images.forEach((f, i) => fd.append(`image${i}`, f));
      const res = await authFetch(`/api/markets/${marketId}/posts`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to post');
      onPosted(json.data);
      setBody('');
      setImages([]);
    } catch (e) {
      showToast({ type: 'error', title: 'Couldn’t post the update', message: e instanceof Error ? e.message : '' });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="p-4" style={{ border: `1px solid ${HAIR}`, background: 'rgba(244,238,228,0.025)' }}>
      <p className="mono uppercase tracking-[0.28em] text-[0.55rem] mb-2.5 inline-flex items-center gap-2" style={{ color: AMBER }}>
        <Sparkles className="w-3 h-3" />
        Post a build update
      </p>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What did you ship? Drop the result, the numbers, the screenshot…"
        rows={3}
        className="w-full px-3 py-2.5"
        style={{
          background: 'transparent',
          color: CREAM,
          border: `1px solid ${HAIR}`,
          outline: 'none',
          resize: 'vertical',
          minHeight: 80,
          fontFamily: 'var(--font-fraunces, serif)',
          lineHeight: 1.5,
        }}
      />
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {images.map((_f, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previews[i]} alt="" className="w-16 h-16 object-cover" style={{ border: `1px solid ${HAIR}` }} />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 p-0.5"
                style={{ background: BG, border: `1px solid ${HAIR}`, color: EARTH }}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={images.length >= MAX_IMAGES}
          className="mono uppercase tracking-[0.2em] text-[0.55rem] inline-flex items-center gap-1.5 disabled:opacity-40"
          style={{ color: CREAM_DIM }}
        >
          <ImagePlus className="w-3.5 h-3.5" /> image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addImages(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={posting || (!body.trim() && images.length === 0)}
          className="mono uppercase tracking-[0.22em] text-[0.6rem] px-5 py-2 inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: AMBER, color: BG }}
        >
          {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {posting ? 'Posting' : 'Post update'}
        </button>
      </div>
    </div>
  );
}

function PostCard({ post, canRemove, onRemove }: { post: Post; canRemove: boolean; onRemove: () => void }) {
  const date = new Date(post.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <article className="p-4 sm:p-5" style={{ border: `1px solid ${HAIR}`, background: 'rgba(244,238,228,0.025)' }}>
      <div className="flex items-center justify-between mb-2.5">
        <p className="mono uppercase tracking-[0.22em] text-[0.5rem]" style={{ color: CREAM_FAINT }}>
          {post.pinned ? 'Pinned · ' : ''}Update · {date}
          {post.editedAt ? ' · edited' : ''}
        </p>
        {canRemove && (
          <button type="button" onClick={onRemove} className="transition-colors" style={{ color: CREAM_FAINT }} title="Hide update">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {post.body && (
        <div
          className="pnl-post-body"
          style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '1rem', lineHeight: 1.6 }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} disallowedElements={['img', 'script', 'iframe']}>
            {post.body}
          </ReactMarkdown>
        </div>
      )}
      {post.media.length > 0 && (
        <div className={`grid gap-2 mt-3 ${post.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {post.media.map((m, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <a key={i} href={m.url} target="_blank" rel="noopener noreferrer">
              <img src={m.url} alt="" className="w-full object-cover" style={{ border: `1px solid ${HAIR}`, maxHeight: 360 }} />
            </a>
          ))}
        </div>
      )}
      {post.sourceUrl && (
        <a
          href={post.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mono uppercase tracking-[0.18em] text-[0.5rem] mt-3 inline-block underline-offset-2 hover:underline"
          style={{ color: CREAM_FAINT }}
        >
          originally posted on X →
        </a>
      )}
    </article>
  );
}
