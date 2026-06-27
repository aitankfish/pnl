'use client';

/**
 * PaperStats — the work's external reach on the paper page: citations,
 * downloads, views, pulled from the open scholarly graph (OpenAlex / Crossref /
 * DataCite / Zenodo) by DOI and cached server-side. Renders nothing when the
 * paper has no DOI or no source returned a number — never an empty scaffold.
 */

import React, { useEffect, useState } from 'react';
import { Quote, Download, Eye, Unlock } from 'lucide-react';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR_STRONG = 'rgba(244,238,228,0.16)';
const FOREST = '#3f7a42';

interface Stats {
  citations: number | null;
  downloads: number | null;
  views: number | null;
  openAccess: boolean | null;
  sources: string[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat(undefined, { notation: n >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(n);

export function PaperStats({ paperId }: { paperId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/research/${paperId}/stats`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.success) setStats(j.data.stats);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [paperId]);

  if (!loaded || !stats) return null;

  const items = [
    stats.citations != null ? { Icon: Quote, label: 'cited by', value: stats.citations } : null,
    stats.downloads != null ? { Icon: Download, label: 'downloads', value: stats.downloads } : null,
    stats.views != null ? { Icon: Eye, label: 'views', value: stats.views } : null,
  ].filter(Boolean) as { Icon: typeof Quote; label: string; value: number }[];

  if (items.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {items.map(({ Icon, label, value }) => (
          <span key={label} className="inline-flex items-baseline gap-1.5" title={`${value.toLocaleString()} ${label}`}>
            <Icon className="w-3.5 h-3.5 self-center" style={{ color: CREAM_FAINT }} />
            <span className="mono text-[0.95rem]" style={{ color: CREAM, fontFeatureSettings: '"tnum"' }}>
              {fmt(value)}
            </span>
            <span className="mono uppercase tracking-[0.18em] text-[0.5rem]" style={{ color: CREAM_FAINT }}>
              {label}
            </span>
          </span>
        ))}
        {stats.openAccess && (
          <span className="inline-flex items-center gap-1 mono uppercase tracking-[0.18em] text-[0.5rem]" style={{ color: FOREST }} title="Open access">
            <Unlock className="w-3 h-3" /> open access
          </span>
        )}
      </div>
      {stats.sources.length > 0 && (
        <p className="mono uppercase tracking-[0.18em] text-[0.45rem] mt-2" style={{ color: CREAM_FAINT }}>
          live · via {stats.sources.join(' · ')}
        </p>
      )}
    </div>
  );
}
