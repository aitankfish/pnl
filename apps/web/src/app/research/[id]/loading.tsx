/**
 * Loading state for /research/[id] — appears during route transitions
 * (e.g. clicking from a market's "thesis" card to the paper). Matches
 * the page layout silhouette so the swap-in feels seamless.
 */

export default function ResearchPaperLoading() {
  const HAIR_STRONG = 'rgba(244,238,228,0.16)';
  const PULSE = 'rgba(244,238,228,0.05)';
  const PULSE_FAINT = 'rgba(244,238,228,0.025)';

  return (
    <div style={{ color: '#f4eee4', minHeight: '100vh' }}>
      {/* Top bar silhouette */}
      <div
        className="px-5 sm:px-8 py-4 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${HAIR_STRONG}` }}
      >
        <div
          className="animate-pulse"
          style={{ width: 140, height: 12, background: PULSE }}
        />
        <div className="flex items-center gap-5">
          <div
            className="animate-pulse"
            style={{ width: 96, height: 18, background: PULSE }}
          />
          <div
            className="animate-pulse"
            style={{ width: 64, height: 12, background: PULSE }}
          />
        </div>
      </div>

      {/* Single-column body */}
      <div
        className="max-w-[1000px] mx-auto px-6 sm:px-12 py-10 sm:py-16"
        style={{ borderLeft: `1px solid ${HAIR_STRONG}` }}
      >
        {/* Amber eyebrow placeholder */}
        <div
          className="animate-pulse mb-5"
          style={{ width: 180, height: 12, background: PULSE }}
        />

        {/* The paper itself */}
        <div
          className="w-full animate-pulse"
          style={{
            background: PULSE_FAINT,
            border: `1px solid ${HAIR_STRONG}`,
            height: 'min(85vh, 1100px)',
          }}
        />

        {/* Hint line */}
        <div
          className="mt-3 animate-pulse"
          style={{ width: 320, height: 10, background: PULSE }}
        />

        {/* Byline + reactions row */}
        <div className="mt-12 sm:mt-16 flex flex-wrap items-center gap-4">
          <div
            className="animate-pulse"
            style={{ width: 220, height: 18, background: PULSE }}
          />
          <div className="flex gap-2">
            <div
              className="animate-pulse"
              style={{ width: 56, height: 28, background: PULSE }}
            />
            <div
              className="animate-pulse"
              style={{ width: 56, height: 28, background: PULSE }}
            />
          </div>
        </div>
        <div
          className="mt-3 animate-pulse"
          style={{ width: '70%', height: 14, background: PULSE }}
        />
      </div>
    </div>
  );
}
