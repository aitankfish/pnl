import { ImageResponse } from 'next/og';

// ─── Shared OG image template ────────────────────────────────────
//
// Every share card on docs.pnl.market renders through this module.
// Visual: the tree-mark alone (large), with the page title set in
// Fraunces below, on a deep-night cosmic backdrop with an amber
// glow ringing the tree. No wordmark anywhere — the tree IS the
// signature.
//
// Each opengraph-image.tsx file in the route tree composes its own
// title/subtitle and calls `renderOgCard()`. Next.js handles caching
// and serves the resulting PNG with the right OG meta tags.

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = 'image/png';

// Load a TTF/WOFF2 from Google Fonts at request time. Edge runtime
// only has Web APIs (no `fs`), so we fetch the font binary inline.
// `text` lets Google subset the font to just the glyphs we need —
// keeps the response under 50KB even for variable fonts like Fraunces.
async function loadGoogleFont(
  family: string,
  text: string,
  weight: number,
  italic: boolean,
): Promise<ArrayBuffer> {
  const ital = italic ? '1,' : '0,';
  const familyParam = `${family}:ital,wght@${ital}${weight}`;
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(familyParam)}&text=${encodeURIComponent(text)}`;
  const cssRes = await fetch(url, {
    // Faking a modern browser UA so Google returns WOFF2 (Satori handles it).
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    },
  });
  const css = await cssRes.text();
  const match = css.match(/src:\s*url\((https:[^)]+)\)/);
  if (!match) throw new Error(`OG: failed to parse font url for ${family}`);
  return fetch(match[1]).then((r) => r.arrayBuffer());
}

export interface OgCardProps {
  /** Headline. Required. Set in Fraunces 500. Auto-shrinks for long titles. */
  title: string;
  /** Italic subtitle below the title. Set in Fraunces 400 italic. */
  subtitle?: string;
  /** Small mono badge across the bottom (e.g. live stats, byline). */
  footer?: string;
}

// Pure JSX for the card body — kept as a function so we can re-render
// with different content from each opengraph-image.tsx without rebuilding
// the surrounding Canvas setup.
function OgCard({ title, subtitle, footer }: OgCardProps) {
  const titleLen = title.length;
  const titleSize = titleLen > 64 ? 48 : titleLen > 40 ? 60 : 72;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0814',
        backgroundImage:
          'radial-gradient(ellipse at 50% 18%, rgba(232,150,96,0.20) 0%, rgba(232,150,96,0.06) 32%, transparent 62%), radial-gradient(ellipse at 50% 102%, rgba(63,122,66,0.18) 0%, transparent 55%)',
        color: '#f4eee4',
        padding: '60px 90px',
        position: 'relative',
      }}
    >
      {/* Warm halo behind the tree mark */}
      <div
        style={{
          display: 'flex',
          width: 260,
          height: 260,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
          backgroundImage:
            'radial-gradient(circle at 50% 60%, rgba(232,150,96,0.42) 0%, rgba(232,150,96,0.08) 42%, transparent 70%)',
          borderRadius: 260,
        }}
      >
        <svg
          width="180"
          height="180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#e89660"
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3c-3.6 0-6.2 2.5-6.2 5.7 0 1.3.5 2.5 1.4 3.4-1.4.5-2.3 1.6-2.3 2.9 0 1.7 1.6 2.9 3.7 2.9h7c2.1 0 3.6-1.2 3.6-2.9 0-1.3-.9-2.4-2.3-2.9.9-.9 1.4-2.1 1.4-3.4C18.3 5.5 15.6 3 12 3Z" />
          <path d="M12 18.9V22" />
          <path d="M9.8 22h4.4" />
        </svg>
      </div>

      {/* Headline */}
      <div
        style={{
          display: 'flex',
          textAlign: 'center',
          fontFamily: 'Fraunces',
          fontWeight: 500,
          fontSize: titleSize,
          lineHeight: 1.06,
          letterSpacing: '-0.022em',
          color: '#f4eee4',
          maxWidth: 980,
          marginTop: 18,
        }}
      >
        {title}
      </div>

      {/* Italic subtitle */}
      {subtitle ? (
        <div
          style={{
            display: 'flex',
            textAlign: 'center',
            fontFamily: 'Fraunces',
            fontWeight: 400,
            fontStyle: 'italic',
            fontSize: 26,
            lineHeight: 1.42,
            color: '#c8bdb0',
            maxWidth: 900,
            marginTop: 22,
          }}
        >
          {subtitle}
        </div>
      ) : null}

      {/* Mono footer line (live stats / byline / live-on-mainnet etc.) */}
      {footer ? (
        <div
          style={{
            position: 'absolute',
            bottom: 44,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            fontFamily: 'JetBrainsMono',
            fontWeight: 500,
            fontSize: 18,
            color: '#e89660',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

// Top-level helper each opengraph-image.tsx calls. Loads the three font
// variants we need (Fraunces 500, Fraunces 400 italic, JetBrains Mono 500),
// subsetted to the actual text on this card, then assembles the
// ImageResponse with the right dimensions.
export async function renderOgCard(props: OgCardProps): Promise<ImageResponse> {
  const baseText = `${props.title} ${props.subtitle ?? ''}`;
  const footerText = props.footer ?? '';

  // Three font variants, three parallel fetches. The whole batch is
  // typically under 200ms warm; first cold request is ~600ms.
  const [fraunces500, frauncesItalic400, mono500] = await Promise.all([
    loadGoogleFont('Fraunces', baseText, 500, false),
    props.subtitle
      ? loadGoogleFont('Fraunces', baseText, 400, true)
      : Promise.resolve<ArrayBuffer | null>(null),
    footerText
      ? loadGoogleFont('JetBrains Mono', footerText, 500, false)
      : Promise.resolve<ArrayBuffer | null>(null),
  ]);

  const fonts: { name: string; data: ArrayBuffer; weight: 400 | 500; style: 'normal' | 'italic' }[] = [
    { name: 'Fraunces', data: fraunces500, weight: 500, style: 'normal' },
  ];
  if (frauncesItalic400) {
    fonts.push({ name: 'Fraunces', data: frauncesItalic400, weight: 400, style: 'italic' });
  }
  if (mono500) {
    fonts.push({ name: 'JetBrainsMono', data: mono500, weight: 500, style: 'normal' });
  }

  return new ImageResponse(<OgCard {...props} />, {
    width: OG_SIZE.width,
    height: OG_SIZE.height,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fonts: fonts as any,
  });
}
