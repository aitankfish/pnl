/**
 * Printify Shops API Route
 * Fetches all shops associated with the Printify account
 */

import { NextResponse } from 'next/server';

const PRINTIFY_API_BASE = 'https://api.printify.com/v1';

export async function GET() {
  const apiToken = process.env.PRINTIFY_API_TOKEN;

  if (!apiToken || apiToken === 'your_printify_api_token_here') {
    return NextResponse.json(
      { success: false, error: 'Printify API token not configured' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(`${PRINTIFY_API_BASE}/shops.json`, {
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

    const shops = await response.json();

    return NextResponse.json({
      success: true,
      data: shops,
    });
  } catch (error: any) {
    console.error('Error fetching Printify shops:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch shops' },
      { status: 500 }
    );
  }
}
