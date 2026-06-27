'use client';

/**
 * Project Updates — the founder's build-in-public feed on a market page.
 *
 * Styled as a STREAM, not a stack of cards: hairline separators and whitespace
 * instead of nested boxes, so the founder's words + screenshots lead. Founders
 * post durable updates (text + images, optional X source link); anyone can
 * reply (PostReply); author/founder/admin can hide a post or reply. Display
 * names are server-resolved usernames (never client-supplied).
 */

import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, ImagePlus, X, Trash2, Link2, Send, MessageSquare } from 'lucide-react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { useWallet } from '@/hooks/useWallet';
import { useToast } from '@/lib/hooks/useToast';
import { isPlatformAdmin } from '@/lib/admin';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.12)';
const AMBER = '#e89660';
const BG = '#0a0814';

const MAX_IMAGES = 4;

interface Post {
  id: string;
  authorWallet: string;
  authorName: string | null;
  body: string;
  media: { url: string; kind: string }[];
  sourceUrl: string | null;
  pinned: boolean;
  editedAt: string | null;
  createdAt: string;
}

// Small deterministic avatar: a hue derived from the wallet + the first letter
// of the display name. Cheap personality, no asset infra.
function Avatar({ seed, label, size = 32 }: { seed: string; label: string; size?: number }) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  const initial = (label || seed || '?').trim().charAt(0).toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 rounded-full select-none"
      style={{
        width: size,
        height: size,
        background: `hsl(${h} 45% 22%)`,
        color: `hsl(${h} 60% 78%)`,
        fontSize: size * 0.42,
        fontFamily: 'var(--font-fraunces, serif)',
      }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

function displayName(name: string | null, wallet: string) {
  return name || `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function ProjectUpdates({ marketId, founderWallet }: { marketId: string; founderWallet: string | null }) {
  const { primaryWallet, authenticated } = useWallet();
  const { showToast } = useToast();
  const wallet = primaryWallet?.address || null;
  const isAdmin = isPlatformAdmin(wallet);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvedFounder, setResolvedFounder] = useState<string | null>(founderWallet);
  const isFounder = !!authenticated && !!wallet && wallet === resolvedFounder;

  const load = async () => {
    try {
      const res = await fetch(`/api/markets/${marketId}/posts?limit=50`);
      const json = await res.json();
      if (json.success) {
        setPosts(json.data.posts || []);
        setResolvedFounder(json.data.founderWallet || founderWallet);
      }
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
    <div>
      {isFounder && <Composer marketId={marketId} onPosted={(p) => setPosts((prev) => [p, ...prev])} />}

      {loading ? (
        <div className="flex items-center justify-center py-12" style={{ color: CREAM_FAINT }}>
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-12 text-center">
          <p style={{ fontFamily: 'var(--font-fraunces, serif)', fontSize: '1.1rem', color: CREAM_DIM }}>
            The story starts here.
          </p>
          <p className="mono uppercase tracking-[0.2em] text-[0.55rem] mt-2" style={{ color: CREAM_FAINT }}>
            {isFounder ? 'Share your first build update above.' : 'No updates yet.'}
          </p>
        </div>
      ) : (
        <div>
          {posts.map((post, i) => (
            <PostItem
              key={post.id}
              post={post}
              marketId={marketId}
              wallet={wallet}
              authenticated={!!authenticated}
              canModerate={isAdmin || isFounder}
              canRemove={isAdmin || (isFounder && post.authorWallet === wallet)}
              onRemove={() => removePost(post.id)}
              last={i === posts.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Composer({ marketId, onPosted }: { marketId: string; onPosted: (p: Post) => void }) {
  const { showToast } = useToast();
  const [body, setBody] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [showSource, setShowSource] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const urls = images.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [images]);

  const addImages = (files: FileList | null) => {
    if (!files) return;
    setImages((prev) => [...prev, ...Array.from(files)].slice(0, MAX_IMAGES));
  };

  const submit = async () => {
    if (!body.trim() && images.length === 0) return;
    setPosting(true);
    try {
      const fd = new FormData();
      if (body.trim()) fd.append('body', body.trim());
      images.forEach((f, i) => fd.append(`image${i}`, f));
      if (sourceUrl.trim()) fd.append('sourceUrl', sourceUrl.trim());
      const res = await authFetch(`/api/markets/${marketId}/posts`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to post');
      onPosted(json.data);
      setBody('');
      setImages([]);
      setSourceUrl('');
      setShowSource(false);
    } catch (e) {
      showToast({ type: 'error', title: 'Couldn’t post the update', message: e instanceof Error ? e.message : '' });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="pb-5 mb-1" style={{ borderBottom: `1px solid ${HAIR}` }}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What did you ship? Drop the result, the numbers, the screenshot…"
        rows={2}
        className="w-full bg-transparent outline-none resize-none"
        style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '1.05rem', lineHeight: 1.5, minHeight: 56 }}
      />
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-1">
          {images.map((_f, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previews[i]} alt="" className="w-16 h-16 object-cover rounded" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 rounded-full p-0.5"
                style={{ background: BG, color: CREAM }}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {showSource && (
        <input
          type="text"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="Paste the X link…"
          className="w-full bg-transparent outline-none mono text-[0.7rem] py-1 mb-1"
          style={{ color: CREAM_DIM, borderBottom: `1px solid ${HAIR}` }}
        />
      )}
      <div className="flex items-center gap-3 mt-1.5">
        <button type="button" onClick={() => fileRef.current?.click()} disabled={images.length >= MAX_IMAGES} title="Add image" style={{ color: CREAM_FAINT }} className="disabled:opacity-30">
          <ImagePlus className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => setShowSource((s) => !s)} title="Crosspost link" style={{ color: showSource || sourceUrl ? AMBER : CREAM_FAINT }}>
          <Link2 className="w-4 h-4" />
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addImages(e.target.files); e.target.value = ''; }} />
        <button
          type="button"
          onClick={submit}
          disabled={posting || (!body.trim() && images.length === 0)}
          className="ml-auto mono uppercase tracking-[0.22em] text-[0.6rem] px-5 py-2 rounded-full inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: AMBER, color: BG }}
        >
          {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {posting ? 'Posting' : 'Post'}
        </button>
      </div>
    </div>
  );
}

function PostItem({
  post,
  marketId,
  wallet,
  authenticated,
  canModerate,
  canRemove,
  onRemove,
  last,
}: {
  post: Post;
  marketId: string;
  wallet: string | null;
  authenticated: boolean;
  canModerate: boolean;
  canRemove: boolean;
  onRemove: () => void;
  last: boolean;
}) {
  const name = displayName(post.authorName, post.authorWallet);
  return (
    <article className="flex gap-3 py-5" style={last ? undefined : { borderBottom: `1px solid ${HAIR}` }}>
      <Avatar seed={post.authorWallet} label={name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.95rem' }}>{name}</span>
          <span className="mono text-[0.6rem]" style={{ color: CREAM_FAINT }}>
            · {timeAgo(post.createdAt)}
            {post.pinned ? ' · pinned' : ''}
            {post.editedAt ? ' · edited' : ''}
          </span>
          {canRemove && (
            <button type="button" onClick={onRemove} className="ml-auto" style={{ color: CREAM_FAINT }} title="Hide update">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {post.body && (
          <div className="mt-1" style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '1.02rem', lineHeight: 1.6 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} disallowedElements={['img', 'script', 'iframe']}>
              {post.body}
            </ReactMarkdown>
          </div>
        )}

        {post.media.length > 0 && (
          <div className={`grid gap-2 mt-3 ${post.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {post.media.map((m, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg" style={{ border: `1px solid ${HAIR}` }}>
                <img src={m.url} alt="" className="w-full object-cover" style={{ maxHeight: 380 }} />
              </a>
            ))}
          </div>
        )}

        {post.sourceUrl && (
          <a href={post.sourceUrl} target="_blank" rel="noopener noreferrer" className="mono uppercase tracking-[0.18em] text-[0.5rem] mt-2.5 inline-flex items-center gap-1 underline-offset-2 hover:underline" style={{ color: CREAM_FAINT }}>
            <Link2 className="w-3 h-3" /> from X
          </a>
        )}

        <Replies marketId={marketId} postId={post.id} wallet={wallet} authenticated={authenticated} canModerate={canModerate} />
      </div>
    </article>
  );
}

interface Reply {
  id: string;
  authorWallet: string;
  displayName: string | null;
  body: string;
  createdAt: string;
}

function Replies({
  marketId,
  postId,
  wallet,
  authenticated,
  canModerate,
}: {
  marketId: string;
  postId: string;
  wallet: string | null;
  authenticated: boolean;
  canModerate: boolean;
}) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const baseUrl = `/api/markets/${marketId}/posts/${postId}/replies`;

  const load = async () => {
    try {
      const res = await fetch(baseUrl);
      const json = await res.json();
      if (json.success) setReplies(json.data.replies || []);
    } catch {
      /* non-fatal */
    } finally {
      setLoaded(true);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) load();
  };

  const send = async () => {
    const text = body.trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await authFetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to reply');
      setReplies((r) => [...r, json.data]);
      setBody('');
    } catch (e) {
      showToast({ type: 'error', title: 'Couldn’t reply', message: e instanceof Error ? e.message : '' });
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await authFetch(`${baseUrl}/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setReplies((r) => r.filter((x) => x.id !== id));
    } catch (e) {
      showToast({ type: 'error', title: 'Couldn’t remove reply', message: e instanceof Error ? e.message : '' });
    }
  };

  return (
    <div className="mt-3">
      <button type="button" onClick={toggle} className="mono uppercase tracking-[0.18em] text-[0.5rem] inline-flex items-center gap-1.5" style={{ color: CREAM_FAINT }}>
        <MessageSquare className="w-3 h-3" />
        {loaded ? (replies.length ? `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}` : 'reply') : 'reply'}
        {open ? ' · hide' : ''}
      </button>

      {open && (
        <div className="mt-3 pl-3 space-y-3" style={{ borderLeft: `1px solid ${HAIR}` }}>
          {loaded &&
            replies.map((r) => {
              const name = displayName(r.displayName, r.authorWallet);
              return (
                <div key={r.id} className="flex items-start gap-2">
                  <Avatar seed={r.authorWallet} label={name} size={22} />
                  <div className="min-w-0 flex-1">
                    <span className="mono text-[0.55rem]" style={{ color: CREAM_FAINT }}>{name}</span>
                    <p className="text-sm whitespace-pre-wrap break-words" style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', lineHeight: 1.45 }}>
                      {r.body}
                    </p>
                  </div>
                  {(canModerate || (wallet && r.authorWallet === wallet)) && (
                    <button type="button" onClick={() => remove(r.id)} style={{ color: CREAM_FAINT }} title="Remove reply" className="shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

          {authenticated ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
                placeholder="Add a reply…"
                maxLength={1000}
                className="flex-1 bg-transparent outline-none text-sm py-1.5"
                style={{ color: CREAM, borderBottom: `1px solid ${HAIR}`, fontFamily: 'var(--font-fraunces, serif)' }}
              />
              <button type="button" onClick={send} disabled={sending || !body.trim()} className="disabled:opacity-40" style={{ color: AMBER }}>
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          ) : (
            <p className="mono uppercase tracking-[0.18em] text-[0.5rem]" style={{ color: CREAM_FAINT }}>
              Connect wallet to reply.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
