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
    const response = await fetch(`${apiUrl}/api/markets/${id}`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });

    if (!response.ok) return null;

    const result = await response.json();
    return result.success ? result.data : null;
  } catch (error) {
    console.error('Failed to fetch market data for OG:', error);
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

  // Use project image or default OG image
  const ogImage = market.projectImageUrl || `${BASE_URL}/og-default.png`;

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
