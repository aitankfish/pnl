import { Metadata } from 'next';

// Base URL for the app
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pnl.market';

interface MarketData {
  name: string;
  description: string;
  tokenSymbol: string;
  projectImageUrl?: string;
  category?: string;
  status?: string;
  yesPercentage?: number;
  totalParticipants?: number;
}

async function getMarketData(id: string): Promise<MarketData | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || BASE_URL;
    const fetchUrl = `${apiUrl}/api/markets/${id}`;

    const response = await fetch(fetchUrl, {
      next: { revalidate: 60 }, // Cache for 60 seconds
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[Metadata] Failed to fetch market ${id}: ${response.status} ${response.statusText}`);
      return null;
    }

    const result = await response.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error(`[Metadata] Error fetching market ${id}:`, error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const market = await getMarketData(id);

  if (!market) {
    return {
      title: 'Market Not Found | PNL',
      description: 'This market does not exist or has been removed.',
    };
  }

  const title = `${market.name} ($${market.tokenSymbol}) | PNL`;
  const description = market.description?.slice(0, 160) ||
    `Vote on ${market.name} - ${market.category || 'Project'} on PNL. Join the community and help decide if this idea should launch!`;

  // Generate dynamic OG image with market name and description
  const ogTitle = encodeURIComponent(`$${market.tokenSymbol} - ${market.name}`);
  const ogDescription = encodeURIComponent(market.category ? `${market.category} Project on PNL` : 'Prediction Market on PNL');
  const ogImage = `${BASE_URL}/api/og?title=${ogTitle}&description=${ogDescription}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/market/${id}`,
      siteName: 'PNL - Predict and Launch',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: market.name,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function MarketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
