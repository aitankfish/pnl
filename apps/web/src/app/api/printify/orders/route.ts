/**
 * Printify Orders API Route
 * Creates orders on Printify after VERIFIED SOL payment.
 *
 * Security: prior to verification, this endpoint accepted any txSignature
 * string and shipped physical merch. An attacker could submit a random
 * signature and harvest products at zero cost. The verifySolPayment helper
 * below now:
 *   1. confirms the tx exists on-chain
 *   2. confirms the tx's fee-payer matches the authenticated wallet
 *      (prevents stealing a legitimate user's payment by replaying their sig)
 *   3. confirms a SOL transfer to MERCH_PAYMENT_ADDRESS
 *   4. confirms the transferred amount covers the variant's USD price at
 *      current SOL/USD with 15% slippage tolerance for volatility
 *   5. confirms the tx is recent (≤ 15 minutes old)
 *   6. enforces single-use via Redis SETNX with 30-day TTL
 */

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { RPC_ENDPOINT } from '@/config/solana';
import { getRedisClient, prefixKey } from '@/lib/redis/client';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';

const PRINTIFY_API_BASE = 'https://api.printify.com/v1';

// Mirror of the frontend MERCH_PAYMENT_ADDRESS in apps/web/src/app/merch/page.tsx.
// Allow env override for staging/rotation without code change.
const MERCH_PAYMENT_ADDRESS = (
  process.env.MERCH_PAYMENT_ADDRESS || 'BoK57Rf2NV1bdiFvvDeev1HPp5g2B72eH8SCoVkkSVsb'
).trim();

// Defense knobs
const PAYMENT_SLIPPAGE = 0.15;          // accept payments ≥ 85% of expected (SOL volatility)
const MAX_PAYMENT_AGE_MS = 15 * 60_000; // 15 minutes
const REPLAY_GUARD_TTL_S = 30 * 24 * 3600; // 30 days
const SOL_PRICE_CACHE_KEY = 'sol-price-usd'; // shared with /api/price/sol

// Fetch the SOL/USD price from the same Redis cache /api/price/sol uses, with
// a CoinGecko fallback. Cached server-side is the right place for this because
// we want the server's check to match the price the user was shown.
async function getSolPriceUsd(): Promise<number> {
  try {
    const redis = getRedisClient();
    const raw = await redis.get(prefixKey(SOL_PRICE_CACHE_KEY));
    if (raw) {
      const cached = JSON.parse(raw);
      if (typeof cached?.price === 'number') return cached.price;
    }
  } catch {
    // fall through to live fetch
  }
  const r = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
    { cache: 'no-store' },
  );
  if (!r.ok) throw new Error(`SOL price fetch failed (${r.status})`);
  const data = await r.json();
  const price = data?.solana?.usd;
  if (typeof price !== 'number') throw new Error('SOL price missing from CoinGecko response');
  return price;
}

// Look up the variant's USD price from Printify so the server doesn't have
// to trust client-supplied amounts. Printify variant.price is in USD cents.
async function getVariantPriceUsd(
  productId: string,
  variantId: number,
  apiToken: string,
  shopId: string,
): Promise<number | null> {
  const r = await fetch(
    `${PRINTIFY_API_BASE}/shops/${shopId}/products/${productId}.json`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'User-Agent': 'PNL-Platform/1.0',
      },
      cache: 'no-store',
    },
  );
  if (!r.ok) return null;
  const product = await r.json();
  const variant = (product?.variants || []).find((v: any) => v.id === variantId);
  if (!variant || typeof variant.price !== 'number') return null;
  return variant.price / 100; // cents → dollars
}

// Verify the Solana transaction actually paid for this order. Returns either
// { ok: true, lamports } or { ok: false, reason } — the reason is a stable
// short code the caller can return in the response.
async function verifySolPayment(opts: {
  txSignature: string;
  payerWallet: string;
  expectedLamports: number;
}): Promise<{ ok: true; lamports: number } | { ok: false; reason: string; status: number }> {
  const { txSignature, payerWallet, expectedLamports } = opts;

  // Signature shape sanity (Solana sigs are 64-byte base58 = 87-88 chars)
  if (typeof txSignature !== 'string' || txSignature.length < 80 || txSignature.length > 100) {
    return { ok: false, reason: 'Invalid transaction signature format', status: 400 };
  }

  const connection = new Connection(RPC_ENDPOINT, 'confirmed');
  const tx = await connection.getParsedTransaction(txSignature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });
  if (!tx) {
    return { ok: false, reason: 'Transaction not found on-chain', status: 400 };
  }
  if (tx.meta?.err) {
    return { ok: false, reason: 'Transaction failed on-chain', status: 400 };
  }

  // Recency check — limits replay window for a sig that wasn't caught by our
  // Redis guard (e.g., Redis was unreachable when the previous order ran).
  const blockTimeMs = tx.blockTime ? tx.blockTime * 1000 : 0;
  if (!blockTimeMs || Date.now() - blockTimeMs > MAX_PAYMENT_AGE_MS) {
    return { ok: false, reason: 'Payment is too old (must be within 15 minutes)', status: 400 };
  }

  // Fee-payer must equal the authenticated wallet. Without this, anyone with
  // an authenticated session could submit ANY user's payment signature and
  // claim the goods.
  const feePayer = tx.transaction.message.accountKeys?.[0]?.pubkey?.toBase58();
  if (feePayer !== payerWallet) {
    return { ok: false, reason: 'Payment was not made by the authenticated wallet', status: 403 };
  }

  // Walk SOL transfers in the parsed instructions, sum anything sent TO the
  // merch address. Supports payments embedded as one of several instructions.
  let receivedLamports = 0;
  const instructions = tx.transaction.message.instructions as any[];
  for (const ix of instructions) {
    const parsed = ix?.parsed;
    if (
      parsed?.type === 'transfer' &&
      parsed?.info?.destination === MERCH_PAYMENT_ADDRESS
    ) {
      receivedLamports += Number(parsed.info.lamports || 0);
    }
  }
  if (receivedLamports === 0) {
    return { ok: false, reason: 'Transaction did not transfer SOL to the merch wallet', status: 400 };
  }

  const minimumAcceptable = Math.floor(expectedLamports * (1 - PAYMENT_SLIPPAGE));
  if (receivedLamports < minimumAcceptable) {
    return {
      ok: false,
      reason: `Payment underpaid (received ${receivedLamports} lamports, need ≥ ${minimumAcceptable})`,
      status: 402,
    };
  }

  return { ok: true, lamports: receivedLamports };
}

// Atomic anti-replay: SETNX with TTL. Returns true if this is the first use
// of the signature; false if it's already been redeemed.
async function reserveSignature(txSignature: string): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const key = prefixKey(`merch:sig:${txSignature}`);
    // Redis: SET key value NX EX <seconds> — atomic check-and-set with TTL
    const result = await redis.set(key, Date.now().toString(), 'EX', REPLAY_GUARD_TTL_S, 'NX');
    return result === 'OK';
  } catch (err) {
    // If Redis is unreachable, fail closed. Better to reject a valid order
    // than to allow a replay of a paid signature.
    console.error('[printify/orders] Redis reserveSignature failed:', err);
    return false;
  }
}

async function releaseSignature(txSignature: string): Promise<void> {
  // Roll back the reservation if Printify rejects the order so the user can
  // retry. Best-effort — Redis errors here are non-fatal to the user response.
  try {
    const redis = getRedisClient();
    await redis.del(prefixKey(`merch:sig:${txSignature}`));
  } catch {
    /* ignore */
  }
}

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

export const POST = withAuth(async (request, authUser) => {
  // Only allow order creation on mainnet
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  if (network !== 'mainnet-beta') {
    console.log('Printify order blocked: not on mainnet', { network });
    return NextResponse.json(
      {
        success: false,
        error: 'Orders can only be placed on mainnet. This is a test environment.',
        isTestMode: true
      },
      { status: 403 }
    );
  }

  // Rate limit: 5 order attempts per minute per wallet. Order placement is
  // a state-mutating + cost-incurring operation; this stops scripted abuse
  // even before payment verification kicks in.
  const rateLimited = await checkRateLimit(`printify-orders:${authUser.walletAddress}`, 5, 60_000);
  if (rateLimited) return rateLimited;

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

    // ─── SOL PAYMENT VERIFICATION ──────────────────────────────────────────
    // Compute the expected SOL amount from Printify's authoritative variant
    // price + the same SOL/USD oracle the frontend uses. Then verify the
    // on-chain tx satisfies all defense-in-depth checks before placing the
    // Printify order.
    const orderQuantity = quantity || 1;
    const variantUsd = await getVariantPriceUsd(productId, variantId, apiToken, shopId);
    if (variantUsd === null) {
      return NextResponse.json(
        { success: false, error: 'Could not look up product price for verification' },
        { status: 400 },
      );
    }
    const expectedUsd = variantUsd * orderQuantity;

    let solPriceUsd: number;
    try {
      solPriceUsd = await getSolPriceUsd();
    } catch (err) {
      // Fail closed — without an SOL price we cannot enforce the amount check.
      console.error('[printify/orders] SOL price lookup failed:', err);
      return NextResponse.json(
        { success: false, error: 'Payment verification temporarily unavailable, please retry' },
        { status: 503 },
      );
    }
    const expectedLamports = Math.floor((expectedUsd / solPriceUsd) * LAMPORTS_PER_SOL);

    const verification = await verifySolPayment({
      txSignature,
      payerWallet: authUser.walletAddress,
      expectedLamports,
    });
    if (!verification.ok) {
      return NextResponse.json(
        { success: false, error: verification.reason },
        { status: verification.status },
      );
    }

    // Anti-replay: reserve the signature atomically before placing the
    // Printify order. If the same signature is submitted twice (race or
    // intentional), only one will reserve and the other will get 409.
    const reserved = await reserveSignature(txSignature);
    if (!reserved) {
      return NextResponse.json(
        { success: false, error: 'This payment has already been redeemed' },
        { status: 409 },
      );
    }
    // ──────────────────────────────────────────────────────────────────────

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
      // Release the signature reservation so the user can retry. Printify's
      // failure is on their side, not the payment's — we'd be double-charging
      // the user (in fairness terms) if we left the signature locked.
      await releaseSignature(txSignature);
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
    // If we reserved the signature but failed downstream of Printify (network
    // error etc), release it. The verifySolPayment path itself doesn't
    // reserve, so this is only reached after reservation succeeded.
    try {
      const bodyForRelease = await request.clone().json();
      if (bodyForRelease?.txSignature) await releaseSignature(bodyForRelease.txSignature);
    } catch {
      /* request body unparseable — nothing to release */
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create order' },
      { status: 500 }
    );
  }
});
