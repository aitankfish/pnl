/**
 * Health Check Endpoint
 * Used by Render.com and other platforms to monitor service health
 */

import { NextResponse } from 'next/server';
import { getSyncManager } from '@/services/blockchain-sync/sync-manager';
import { getDatabaseConfig } from '@/lib/environment';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const timestamp = new Date().toISOString();
    const dbConfig = getDatabaseConfig();

    // Basic health check
    const health: any = {
      status: 'healthy',
      timestamp,
      service: 'pnl-platform',
      version: '0.1.0',
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
        hasHeliusApiKey: !!process.env.HELIUS_API_KEY, // Required for WebSocket
      },
    };

    // Check blockchain sync status (if enabled)
    const autoStartSync = process.env.AUTO_START_SYNC !== 'false';
    if (autoStartSync) {
      try {
        const manager = getSyncManager();
        if (manager) {
          const syncStatus = await manager.getStatus();
          health.sync = {
            enabled: true,
            heliusConnected: syncStatus.heliusConnected,
            processorRunning: syncStatus.processorRunning,
            subscriptions: syncStatus.subscriptionCount,
            queueLength: syncStatus.queueStats.queueLength,
            processing: syncStatus.queueStats.processingCount,
          };
        } else {
          health.sync = {
            enabled: true,
            status: 'initializing',
          };
        }
      } catch (error) {
        health.sync = {
          enabled: true,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    } else {
      health.sync = {
        enabled: false,
      };
    }

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
