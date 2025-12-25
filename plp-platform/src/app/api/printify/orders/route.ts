/**
 * Printify Orders API Route
 * Creates orders on Printify after successful SOL payment
 */

import { NextRequest, NextResponse } from 'next/server';

const PRINTIFY_API_BASE = 'https://api.printify.com/v1';

// Country name to ISO 3166-1 alpha-2 code mapping
const COUNTRY_CODES: Record<string, string> = {
  'United States': 'US',
  'USA': 'US',
  'United Kingdom': 'GB',
  'UK': 'GB',
  'Canada': 'CA',
  'Australia': 'AU',
  'Germany': 'DE',
  'France': 'FR',
  'Spain': 'ES',
  'Italy': 'IT',
  'Netherlands': 'NL',
  'Belgium': 'BE',
  'Austria': 'AT',
  'Switzerland': 'CH',
  'Sweden': 'SE',
  'Norway': 'NO',
  'Denmark': 'DK',
  'Finland': 'FI',
  'Ireland': 'IE',
  'Portugal': 'PT',
  'Poland': 'PL',
  'Czech Republic': 'CZ',
  'Japan': 'JP',
  'South Korea': 'KR',
  'China': 'CN',
  'India': 'IN',
  'Brazil': 'BR',
  'Mexico': 'MX',
  'New Zealand': 'NZ',
  'Singapore': 'SG',
  'Hong Kong': 'HK',
};

function getCountryCode(country: string): string {
  // If already a 2-letter code, return it
  if (country.length === 2) return country.toUpperCase();
  // Look up the country name
  return COUNTRY_CODES[country] || country;
}

interface OrderLineItem {
  product_id: string;
  variant_id: number;
  quantity: number;
}

interface ShippingAddress {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  country: string;
  region: string;
  address1: string;
  address2?: string;
  city: string;
  zip: string;
}

interface CreateOrderRequest {
  productId: string;
  variantId: number;
  quantity: number;
  shippingAddress: {
    fullName: string;
    email: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  txSignature: string; // For reference
}

export async function POST(request: NextRequest) {
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
    const body: CreateOrderRequest = await request.json();
    const { productId, variantId, quantity, shippingAddress, txSignature } = body;

    // Validate required fields
    if (!productId || !variantId || !shippingAddress || !txSignature) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Parse full name into first and last name
    const nameParts = shippingAddress.fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || firstName; // Use first name if no last name

    // Convert country name to ISO code
    const countryCode = getCountryCode(shippingAddress.country);

    // Prepare Printify order payload
    const orderPayload = {
      external_id: txSignature.slice(0, 32), // Use tx signature as external reference
      label: `SOL-${txSignature.slice(0, 8)}`, // Short label
      line_items: [
        {
          product_id: productId,
          variant_id: variantId,
          quantity: quantity || 1,
        },
      ],
      shipping_method: 1, // Standard shipping
      send_shipping_notification: true,
      address_to: {
        first_name: firstName,
        last_name: lastName,
        email: shippingAddress.email,
        phone: '', // Optional
        country: countryCode,
        region: shippingAddress.state || '',
        address1: shippingAddress.address,
        address2: '',
        city: shippingAddress.city,
        zip: shippingAddress.zipCode || '',
      },
    };

    console.log('Creating Printify order:', {
      productId,
      variantId,
      txSignature: txSignature.slice(0, 16) + '...',
      shipping: `${shippingAddress.city}, ${countryCode} (from: ${shippingAddress.country})`,
    });

    // Create order on Printify
    const response = await fetch(`${PRINTIFY_API_BASE}/shops/${shopId}/orders.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PNL-Platform/1.0',
      },
      body: JSON.stringify(orderPayload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Printify order creation failed:', response.status, result);
      return NextResponse.json(
        {
          success: false,
          error: result.errors?.[0]?.message || `Printify API error: ${response.status}`,
          details: result
        },
        { status: response.status }
      );
    }

    console.log('Printify order created successfully:', result.id);

    return NextResponse.json({
      success: true,
      data: {
        orderId: result.id,
        status: result.status,
        createdAt: result.created_at,
      },
    });

  } catch (error: any) {
    console.error('Error creating Printify order:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
}
