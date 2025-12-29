/**
 * Twitter Service for automated tweets
 * Posts announcements for market creation and resolution
 */

import { TwitterApi } from 'twitter-api-v2';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

// Initialize Twitter client
function getTwitterClient(): TwitterApi | null {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    logger.warn('[Twitter] Missing API credentials - tweets will be skipped');
    return null;
  }

  return new TwitterApi({
    appKey: apiKey,
    appSecret: apiSecret,
    accessToken: accessToken,
    accessSecret: accessTokenSecret,
  });
}

// Tweet data interfaces
export interface MarketCreatedData {
  tokenSymbol: string;
  projectName: string;
  category: string;
  stage: string;
  marketId: string;
  description?: string;
  twitterHandle?: string; // Project's Twitter handle (without @)
  projectImageUrl?: string; // URL to project image
}

export interface TokenLaunchedData {
  tokenSymbol: string;
  projectName: string;
  contractAddress: string;
  pumpFunUrl?: string;
  marketId: string;
}

export interface MarketFailedData {
  tokenSymbol: string;
  projectName: string;
  grokRoast: string;
  marketId: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pnl.market';

/**
 * Extract Twitter handle from URL or return as-is if already a handle
 */
function extractTwitterHandle(input?: string): string | null {
  if (!input) return null;

  // If it's already just a handle (with or without @)
  if (!input.includes('/')) {
    return input.replace('@', '');
  }

  // Extract from URL like https://twitter.com/username or https://x.com/username
  const match = input.match(/(?:twitter\.com|x\.com)\/(@?[\w]+)/i);
  if (match) {
    return match[1].replace('@', '');
  }

  return null;
}

/**
 * Truncate description to fit in tweet
 */
function truncateDescription(desc?: string, maxLength: number = 80): string {
  if (!desc) return '';
  const cleaned = desc.replace(/\n/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength - 3) + '...';
}

/**
 * Post tweet for new market creation
 */
export async function tweetMarketCreated(data: MarketCreatedData): Promise<boolean> {
  const client = getTwitterClient();
  if (!client) return false;

  try {
    // Extract Twitter handle if provided
    const handle = extractTwitterHandle(data.twitterHandle);
    const handleMention = handle ? ` by @${handle}` : '';

    // Truncate description
    const shortDesc = truncateDescription(data.description, 80);

    // Build the tweet
    const tweet = `🚀 Fresh drop on PNL!

$${data.tokenSymbol} - ${data.projectName}${handleMention}
${data.category} | ${data.stage}

${shortDesc ? `"${shortDesc}"\n\n` : ''}Ape in or fade it?
${BASE_URL}/market/${data.marketId}

#Solana #PNL`;

    const result = await client.v2.tweet(tweet);
    logger.info('[Twitter] Market created tweet posted', {
      tweetId: result.data.id,
      marketId: data.marketId,
      tokenSymbol: data.tokenSymbol,
    });
    return true;
  } catch (error) {
    logger.error('[Twitter] Failed to post market created tweet', {
      error: error instanceof Error ? error.message : String(error),
      marketId: data.marketId,
    });
    return false;
  }
}

/**
 * Post tweet for successful token launch (YES wins)
 */
export async function tweetTokenLaunched(data: TokenLaunchedData): Promise<boolean> {
  const client = getTwitterClient();
  if (!client) return false;

  try {
    const pumpFunLink = data.pumpFunUrl || `https://pump.fun/${data.contractAddress}`;

    const tweet = `$${data.tokenSymbol} just launched!

The community voted YES and the token is LIVE!

CA: ${data.contractAddress}

Trade on PumpFun
${pumpFunLink}

#Solana #TokenLaunch #PNL`;

    const result = await client.v2.tweet(tweet);
    logger.info('[Twitter] Token launched tweet posted', {
      tweetId: result.data.id,
      marketId: data.marketId,
      tokenSymbol: data.tokenSymbol,
      contractAddress: data.contractAddress,
    });
    return true;
  } catch (error) {
    logger.error('[Twitter] Failed to post token launched tweet', {
      error: error instanceof Error ? error.message : String(error),
      marketId: data.marketId,
    });
    return false;
  }
}

/**
 * Post tweet for failed market (NO wins) with Grok roast
 */
export async function tweetMarketFailed(data: MarketFailedData): Promise<boolean> {
  const client = getTwitterClient();
  if (!client) return false;

  try {
    // Truncate roast if too long (Twitter limit is 280 chars)
    const maxRoastLength = 150;
    const roast = data.grokRoast.length > maxRoastLength
      ? data.grokRoast.slice(0, maxRoastLength - 3) + '...'
      : data.grokRoast;

    const tweet = `$${data.tokenSymbol} didn't make it...

The community has spoken. NO wins.

Grok's verdict:
"${roast}"

Better luck next time!
#Solana #PNL`;

    const result = await client.v2.tweet(tweet);
    logger.info('[Twitter] Market failed tweet posted', {
      tweetId: result.data.id,
      marketId: data.marketId,
      tokenSymbol: data.tokenSymbol,
    });
    return true;
  } catch (error) {
    logger.error('[Twitter] Failed to post market failed tweet', {
      error: error instanceof Error ? error.message : String(error),
      marketId: data.marketId,
    });
    return false;
  }
}

/**
 * Test Twitter connection
 */
export async function testTwitterConnection(): Promise<boolean> {
  const client = getTwitterClient();
  if (!client) return false;

  try {
    const me = await client.v2.me();
    logger.info('[Twitter] Connection test successful', {
      username: me.data.username,
      name: me.data.name,
    });
    return true;
  } catch (error) {
    logger.error('[Twitter] Connection test failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
