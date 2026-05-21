import { ImageResponse } from 'next/og';

export const runtime = 'edge';

async function loadFraunces(): Promise<ArrayBuffer> {
  const css = await fetch(
    'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400&display=swap',
    {
      headers: {
        // Older UA forces Google Fonts to serve TTF (satori needs TTF/OTF, not woff2)
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.75.14 (KHTML, like Gecko) Version/7.0.3 Safari/7046A194A',
      },
    }
  ).then((r) => r.text());

  const match = css.match(/url\((https:[^)]+)\)/);
  if (!match) throw new Error('Could not parse Fraunces font URL');
  return fetch(match[1]).then((r) => r.arrayBuffer());
}

export async function GET() {
  const fontData = await loadFraunces();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'radial-gradient(circle at 50% 42%, #1a1028 0%, #0c0818 55%, #06040d 100%)',
          fontFamily: 'Fraunces',
          fontSize: 232,
          fontWeight: 400,
          color: '#f4eee4',
          letterSpacing: '-2px',
        }}
      >
        PNL
      </div>
    ),
    {
      width: 512,
      height: 512,
      fonts: [
        {
          name: 'Fraunces',
          data: fontData,
          weight: 400,
          style: 'normal',
        },
      ],
    }
  );
}
