'use client';

/**
 * Founder-only modal to (re-)upload a market's media before resolution.
 * Submits multipart FormData to PUT /api/markets/[id]/media. All fields are
 * optional — only the files the founder picks get uploaded/replaced. The
 * server enforces ownership + the resolution gate; this is just the UI.
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ImageIcon, Film, FileText, Loader2 } from 'lucide-react';
import { authFetch } from '@/lib/auth/fetch-with-auth';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.12)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';

const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 100;

interface Props {
  marketId: string;
  current?: {
    projectImageUrl?: string;
    pitchVideoUrl?: string;
    documentUrls?: string[];
  };
  onClose: () => void;
  onUpdated: () => void;
}

export function MarketMediaEditModal({ marketId, current, onClose, onUpdated }: Props) {
  const [image, setImage] = useState<File | null>(null);
  const [gallery, setGallery] = useState<(File | null)[]>([null, null, null]);
  const [video, setVideo] = useState<File | null>(null);
  const [doc, setDoc] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAny = !!image || gallery.some(Boolean) || !!video || !!doc;

  const pick = (
    setter: (f: File | null) => void,
    maxMB: number,
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && f.size > maxMB * 1024 * 1024) {
      setError(`File must be ${maxMB}MB or less`);
      e.target.value = '';
      return;
    }
    setError(null);
    setter(f);
  };

  const submit = async () => {
    if (!hasAny || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      if (image) fd.append('projectImage', image);
      gallery.forEach((g, i) => {
        if (g) fd.append(`galleryImage${i}`, g);
      });
      if (video) fd.append('pitchVideo', video);
      if (doc) fd.append('projectDocument', doc);

      const res = await authFetch(`/api/markets/${marketId}/media`, {
        method: 'PUT',
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Failed to update media');
      }
      onUpdated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update media');
    } finally {
      setSubmitting(false);
    }
  };

  const body = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(8,6,14,0.78)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[88vh] overflow-y-auto"
        style={{ background: '#11101a', border: `1px solid ${HAIR}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${HAIR}` }}>
          <h2 className="mono uppercase tracking-[0.24em] text-[0.7rem]" style={{ color: CREAM }}>
            Edit media
          </h2>
          <button onClick={onClose} className="p-1 transition-colors" style={{ color: CREAM_FAINT }} title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <p className="text-sm" style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)' }}>
            Update only what you want to change. Empty fields are left as-is. You can edit until the market resolves.
          </p>

          <FilePicker
            label="Project image"
            hint={current?.projectImageUrl ? 'Replaces current image · max 10MB' : 'Add an image · max 10MB'}
            Icon={ImageIcon}
            accept="image/jpeg,image/png,image/gif,image/webp"
            file={image}
            onChange={pick(setImage, MAX_IMAGE_MB)}
          />

          <div className="space-y-2">
            <p className="mono uppercase tracking-[0.2em] text-[0.55rem]" style={{ color: CREAM_FAINT }}>
              Gallery (up to 3) · replaces the set
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <FilePicker
                  key={i}
                  compact
                  label={`#${i + 1}`}
                  Icon={ImageIcon}
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  file={gallery[i]}
                  onChange={(e) => {
                    pick((f) => setGallery((prev) => prev.map((g, gi) => (gi === i ? f : g))), MAX_IMAGE_MB)(e);
                  }}
                />
              ))}
            </div>
          </div>

          <FilePicker
            label="Pitch video"
            hint={current?.pitchVideoUrl ? 'Replaces current video · max 100MB' : 'Add a video · max 100MB'}
            Icon={Film}
            accept="video/mp4,video/quicktime,video/webm"
            file={video}
            onChange={pick(setVideo, MAX_VIDEO_MB)}
          />

          <FilePicker
            label="Document"
            hint="Appends to project documents (PDF/DOC)"
            Icon={FileText}
            accept=".pdf,.doc,.docx,application/pdf"
            file={doc}
            onChange={pick(setDoc, MAX_VIDEO_MB)}
          />

          {error && (
            <p className="mono text-[0.62rem]" style={{ color: '#e0654f' }}>
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${HAIR}` }}>
          <button
            onClick={onClose}
            className="mono uppercase tracking-[0.2em] text-[0.6rem] px-4 py-2 transition-colors"
            style={{ color: CREAM_DIM, border: `1px solid ${HAIR}` }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!hasAny || submitting}
            className="mono uppercase tracking-[0.2em] text-[0.6rem] px-4 py-2 inline-flex items-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: AMBER, color: '#0a0814', border: `1px solid ${AMBER}` }}
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? 'Saving…' : 'Save media'}
          </button>
        </div>
      </div>
    </div>
  );

  // Portal to body so the fixed overlay isn't clipped by transformed ancestors.
  if (typeof document === 'undefined') return null;
  return createPortal(body, document.body);
}

function FilePicker({
  label,
  hint,
  Icon,
  accept,
  file,
  onChange,
  compact,
}: {
  label: string;
  hint?: string;
  Icon: React.ComponentType<{ className?: string }>;
  accept: string;
  file: File | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  compact?: boolean;
}) {
  const has = !!file;
  return (
    <label
      className="block cursor-pointer transition-colors"
      style={{
        background: has ? 'rgba(63,122,66,0.08)' : 'rgba(244,238,228,0.025)',
        border: `1px dashed ${has ? FOREST + '99' : HAIR}`,
        padding: compact ? '0.6rem' : '0.85rem 1rem',
      }}
    >
      <input type="file" accept={accept} onChange={onChange} className="hidden" />
      <div className="flex items-center gap-2.5">
        <Icon className="w-4 h-4 flex-shrink-0" />
        <div className="min-w-0">
          <p className="mono uppercase tracking-[0.18em] text-[0.58rem] truncate" style={{ color: has ? FOREST : CREAM_DIM }}>
            {has ? file!.name : label}
          </p>
          {hint && !compact && (
            <p className="mono uppercase tracking-[0.16em] text-[0.5rem] mt-0.5" style={{ color: CREAM_FAINT }}>
              {hint}
            </p>
          )}
        </div>
      </div>
    </label>
  );
}
