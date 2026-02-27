/**
 * Printify Products API Route
 * Fetches all products from the configured Printify shop
 */

import { NextResponse } from 'next/server';

const PRINTIFY_API_BASE = 'https://api.printify.com/v1';

export interface PrintifyProduct {
  id: string;
  title: string;
  description: string;
  tags: string[];
  options: Array<{
    name: string;
    type: string;
    values: Array<{ id: number; title: string }>;
  }>;
  variants: Array<{
    id: number;
    sku: string;
    cost: number;
    price: number;
    title: string;
    grams: number;
    is_enabled: boolean;
    is_default: boolean;
    is_available: boolean;
    options: number[];
  }>;
  images: Array<{
    src: string;
    variant_ids: number[];
    position: string;
    is_default: boolean;
  }>;
  created_at: string;
  updated_at: string;
  visible: boolean;
  is_locked: boolean;
  blueprint_id: number;
  user_id: number;
  shop_id: number;
  print_provider_id: number;
  print_areas: any[];
  sales_channel_properties: any[];
}

export async function GET() {
  const apiToken = process.env.PRINTIFY_API_TOKEN;
  const shopId = process.env.PRINTIFY_SHOP_ID;

  if (!apiToken || apiToken === 'your_printify_api_token_here') {
    return NextResponse.json(
      { success: false, error: 'Printify API token not configured' },
      { status: 500 }
    );
  }

  if (!shopId || shopId === 'your_shop_id_here') {
    return NextResponse.json(
      { success: false, error: 'Printify Shop ID not configured' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${PRINTIFY_API_BASE}/shops/${shopId}/products.json`, {
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'User-Agent': 'PNL-Platform/1.0',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Printify API error:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: `Printify API error: ${response.status}` },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Platform markup (45% - includes shipping costs)
    const MARKUP_PERCENTAGE = 0.45;

    // Transform products for frontend
    const products = (result.data || []).map((product: PrintifyProduct) => {
      // Get default image
      const defaultImage = product.images?.find(img => img.is_default) || product.images?.[0];

      // Get price range from variants and apply 15% markup
      const enabledVariants = product.variants?.filter(v => v.is_enabled && v.is_available) || [];
      const prices = enabledVariants.map(v => v.price);
      const minPriceBase = prices.length > 0 ? Math.min(...prices) : 0;
      const maxPriceBase = prices.length > 0 ? Math.max(...prices) : 0;

      // Apply markup
      const minPrice = minPriceBase * (1 + MARKUP_PERCENTAGE);
      const maxPrice = maxPriceBase * (1 + MARKUP_PERCENTAGE);

      // Determine category based on blueprint or tags
      let category = 'other';
      const titleLower = product.title.toLowerCase();
      const tagsLower = product.tags?.map(t => t.toLowerCase()) || [];

      if (titleLower.includes('shirt') || titleLower.includes('tee') || titleLower.includes('hoodie') ||
          titleLower.includes('sweatshirt') || titleLower.includes('jacket') || titleLower.includes('cap') ||
          tagsLower.some(t => t.includes('apparel') || t.includes('clothing'))) {
        category = 'apparel';
      } else if (titleLower.includes('mug') || titleLower.includes('bag') || titleLower.includes('hat') ||
                 titleLower.includes('sticker') || titleLower.includes('poster') || titleLower.includes('phone') ||
                 tagsLower.some(t => t.includes('accessories') || t.includes('drinkware'))) {
        category = 'accessories';
      }

      return {
        id: product.id,
        title: product.title,
        description: product.description,
        tags: product.tags,
        category,
        image: defaultImage?.src || null,
        images: product.images?.map(img => ({
          src: img.src,
          variantIds: img.variant_ids || [],
          isDefault: img.is_default || false,
        })) || [],
        priceUSD: minPrice / 100, // Convert cents to dollars (with markup)
        priceRangeUSD: minPrice !== maxPrice ? {
          min: minPrice / 100,
          max: maxPrice / 100,
        } : null,
        variants: enabledVariants.map(v => ({
          id: v.id,
          title: v.title,
          priceUSD: (v.price * (1 + MARKUP_PERCENTAGE)) / 100,
          available: v.is_available,
        })),
        options: product.options,
        visible: product.visible,
      };
    });

    return NextResponse.json({
      success: true,
      data: products,
      total: result.total || products.length,
    });
  } catch (error: any) {
    console.error('Error fetching Printify products:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
