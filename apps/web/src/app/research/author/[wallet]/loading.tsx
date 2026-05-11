/**
 * Loading state for /research/author/[wallet] — soft fade during route
 * transitions from a paper byline to its author profile.
 */

export default function AuthorLoading() {
  const HAIR = 'rgba(244,238,228,0.08)';
  const HAIR_STRONG = 'rgba(244,238,228,0.16)';
  const PULSE = 'rgba(244,238,228,0.05)';
  const PULSE_FAINT = 'rgba(244,238,228,0.025)';

  return (
    <div style={{ color: '#f4eee4', minHeight: '100vh' }}>
      <div className="px-4 sm:px-6 pb-20">
        <div className="max-w-5xl mx-auto pt-8 sm:pt-12">
          {/* Back link */}
          <div
            className="animate-pulse mb-8"
            style={{ width: 180, height: 12, background: PULSE }}
          />

          {/* Header */}
          <div className="mb-12 sm:mb-16">
            <div
              className="animate-pulse mb-3"
              style={{ width: 110, height: 12, background: PULSE }}
            />
            <div
              className="animate-pulse mb-4"
              style={{ width: '55%', height: 56, background: PULSE }}
            />
            <div
              className="animate-pulse mb-6"
              style={{ width: 240, height: 14, background: PULSE }}
            />
            <div
              className="grid grid-cols-3 gap-px max-w-md"
              style={{ background: HAIR_STRONG }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="px-4 py-3 animate-pulse"
                  style={{ background: PULSE_FAINT, height: 78 }}
                />
              ))}
            </div>
          </div>

          {/* Shelf */}
          <div
            className="animate-pulse mb-4"
            style={{ width: 120, height: 12, background: PULSE }}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{
                  background: PULSE_FAINT,
                  border: `1px solid ${HAIR}`,
                  borderLeft: `2px solid ${HAIR_STRONG}`,
                  height: 220,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
