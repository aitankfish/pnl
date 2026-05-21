/**
 * Health Check Endpoint
 *
 * Public response: a minimal status payload sufficient for platform
 * health probes (Render.com, uptime monitors). It MUST NOT leak
 * infrastructure topology — database names, env-var presence, sync
 * state, queue depths, RPC providers, etc. — because that gives
 * attackers a free reconnaissance map of a live launchpad handling
 * real SOL.
 *
 * Operator response (full diagnostic): returned only when the request
 * carries the HEALTHCHECK_SECRET in `x-health-secret`. Used by ops
 * dashboards and incident response. Falls back to the public payload
 * if the secret isn't configured.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSyncManager } from '@/services/blockchain-sync/sync-manager';
import { getDatabaseConfig } from '@/lib/environment';

export const dynamic = 'force-dynamic';

function publicPayload() {
  return {
    status: 'healthy' as const,
    timestamp: new Date().toISOString(),
    service: 'pnl-platform',
    version: '0.1.0',
  };
}

async function diagnosticPayload() {
  const dbConfig = getDatabaseConfig();
  const out: any = {
    ...publicPayload(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    network: process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta',
    database: {
      name: dbConfig.name,
      hasUri: !!dbConfig.uri,
      uriLength: dbConfig.uri?.length || 0,
    },
    envVars: {
      hasMongoUri: !!process.env.MONGODB_URI,
      hasSolanaNetwork: !!process.env.NEXT_PUBLIC_SOLANA_NETWORK,
      hasHeliusDevnet: !!process.env.NEXT_PUBLIC_HELIUS_DEVNET_RPC,
      hasHeliusMainnet: !!process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC,
      hasHeliusApiKey: !!process.env.HELIUS_API_KEY,
      hasRedisUrl: !!process.env.REDIS_URL,
    },
  };

  const autoStartSync = process.env.AUTO_START_SYNC !== 'false';
  if (autoStartSync) {
    try {
      const manager = getSyncManager();
      if (manager) {
        const syncStatus = await manager.getStatus();
        out.sync = {
          enabled: true,
          isRunning: syncStatus.isRunning,
          heliusConnected: syncStatus.heliusConnected,
          processorRunning: syncStatus.processorRunning,
          subscriptions: syncStatus.subscriptionCount,
          queueLength: syncStatus.queueStats.queueLength,
          processing: syncStatus.queueStats.processingCount,
          status: syncStatus.isRunning
            ? syncStatus.heliusConnected
              ? 'connected'
              : 'reconnecting'
            : 'not_started',
        };
      } else {
        out.sync = { enabled: true, status: 'initializing' };
      }
    } catch (error) {
      out.sync = {
        enabled: true,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  } else {
    out.sync = { enabled: false };
  }

  return out;
}

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.HEALTHCHECK_SECRET;
    const providedSecret = req.headers.get('x-health-secret');
    const isOperator =
      !!secret && !!providedSecret && providedSecret === secret;

    const payload = isOperator ? await diagnosticPayload() : publicPayload();
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
