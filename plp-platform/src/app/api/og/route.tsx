import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Get optional parameters for customization
  const title = searchParams.get('title') || 'PNL - Predict and Launch';
  const description = searchParams.get('description') || 'Idea Tokenization Platform powered by Prediction Markets';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000000',
          backgroundImage: 'radial-gradient(circle at 25% 25%, #1a1a2e 0%, #000000 50%), radial-gradient(circle at 75% 75%, #16213e 0%, #000000 50%)',
        }}
      >
        {/* Logo representation using gradients */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '40px',
          }}
        >
          {/* Arrow up */}
          <div
            style={{
              width: '0',
              height: '0',
              borderLeft: '30px solid transparent',
              borderRight: '30px solid transparent',
              borderBottom: '40px solid #ff4444',
            }}
          />
          {/* Gradient bar */}
          <div
            style={{
              width: '20px',
              height: '60px',
              background: 'linear-gradient(to bottom, #ff4444, #00ff88, #00ccff)',
              borderRadius: '10px',
              marginTop: '-5px',
            }}
          />
          {/* Circle */}
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: '#00ccff',
              marginTop: '10px',
            }}
          />
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            fontSize: '72px',
            fontWeight: 'bold',
            background: 'linear-gradient(90deg, #00ccff, #8b5cf6, #ff00ff)',
            backgroundClip: 'text',
            color: 'transparent',
            marginBottom: '20px',
          }}
        >
          {title}
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: '32px',
            color: '#a0a0a0',
            textAlign: 'center',
            maxWidth: '900px',
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            width: '200px',
            height: '4px',
            background: 'linear-gradient(90deg, #00ccff, #8b5cf6)',
            borderRadius: '2px',
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
