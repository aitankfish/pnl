'use client';

/**
 * ProjectColdStart — what the Updates tab shows BEFORE the founder has posted.
 *
 * A quiet project (no updates yet) is the common early case, and a bare "no
 * updates" void reads as dead. Instead we surface whatever real signal already
 * exists — the git heartbeat, the project video, the papers it's built on — so
 * the page stays alive and credible. Each piece renders nothing when it has no
 * data, so this gracefully shows only what's actually there.
 */

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { ProjectPulse } from '@/components/research/ProjectPulse';
import { MarketCitations } from '@/components/research/MarketCitations';
import VideoEmbed from '@/components/VideoEmbed';

const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.12)';
const AMBER = '#e89660';

export function ProjectColdStart({
  marketId,
  videoUrl,
  isFounder,
  onDiscuss,
}: {
  marketId: string;
  videoUrl: string | null;
  isFounder: boolean;
  onDiscuss?: () => void;
}) {
  return (
    <div className="py-6 space-y-6">
      <div className="text-center">
        <p style={{ fontFamily: 'var(--font-fraunces, serif)', fontSize: '1.1rem', color: CREAM_DIM }}>
          {isFounder ? 'Share your first update — and here’s what’s already live:' : 'The story starts here.'}
        </p>
        <p className="mono uppercase tracking-[0.2em] text-[0.55rem] mt-2" style={{ color: CREAM_FAINT }}>
          {isFounder ? 'Post above whenever you ship something' : 'What this project is built on, while we wait for the first update'}
        </p>
      </div>

      {/* Proof of life — the repo's recent activity (renders nothing if no repo). */}
      <ProjectPulse marketIdOrAddress={marketId} />

      {/* The pitch video, if one was attached. */}
      {videoUrl && <VideoEmbed url={videoUrl} />}

      {/* The research it stands on (renders nothing if there are no citations). */}
      <MarketCitations marketIdOrAddress={marketId} variant="full" />

      {/* Keep a quiet project from being silent — point to the live discussion. */}
      {onDiscuss && (
        <div className="text-center pt-4" style={{ borderTop: `1px solid ${HAIR}` }}>
          <button
            type="button"
            onClick={onDiscuss}
            className="inline-flex items-center gap-2 mono uppercase tracking-[0.2em] text-[0.6rem] px-4 py-2 rounded-full"
            style={{ border: `1px solid ${HAIR}`, color: AMBER }}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Join the discussion
          </button>
        </div>
      )}
    </div>
  );
}
