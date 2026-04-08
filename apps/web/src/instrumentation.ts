/**
 * Next.js Instrumentation Hook
 *
 * NOTE: This is ONLY used when running `next start` directly.
 * When using `npm run start:unified` (server.ts), this is SKIPPED
 * because server.ts already handles Socket.IO and blockchain sync.
 */

export async function register() {
  // Skip if running with unified server (server.ts handles everything)
  // server.ts sets this env var before starting Next.js
  if (process.env.UNIFIED_SERVER === 'true') {
    console.log('ℹ️  Instrumentation skipped (unified server handles Socket.IO and sync)');
    return;
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { createServer } = await import('http');
    const { initializeSocketServer } = await import('./services/socket/socket-server');

    // Get Next.js server instance
    // Note: This is a simplified approach that works with Next.js App Router
    const httpServer = createServer();

    // Initialize Socket.IO
    initializeSocketServer(httpServer);

    // Start listening on Socket.IO port (separate from Next.js)
    const socketPort = parseInt(process.env.SOCKET_PORT || '3001', 10);
    httpServer.listen(socketPort, () => {
      console.log(`✅ Socket.IO server running on port ${socketPort}`);
    });

    // Start blockchain sync system (if enabled)
    // Can be enabled in dev mode with ENABLE_BLOCKCHAIN_SYNC=true (for devnet testing)
    const autoStartSync = process.env.AUTO_START_SYNC !== 'false';
    const enableInDev = process.env.ENABLE_BLOCKCHAIN_SYNC === 'true';
    const isProduction = process.env.NODE_ENV === 'production';

    if (autoStartSync && (isProduction || enableInDev)) {
      console.log('🔗 Starting blockchain sync system...');

      setTimeout(async () => {
        try {
          const { startBlockchainSync } = await import('./services/blockchain-sync/sync-manager');
          await startBlockchainSync();
          console.log('✅ Blockchain sync started');
        } catch (error) {
          console.error('❌ Failed to start blockchain sync:', error);
          console.error('   Markets will still work but real-time updates may be delayed');
        }
      }, 5000); // Wait 5 seconds for Next.js to fully initialize
    } else if (!autoStartSync) {
      console.log('⚠️  Blockchain sync disabled (AUTO_START_SYNC=false)');
    } else {
      console.log('ℹ️  Blockchain sync disabled in development mode (set ENABLE_BLOCKCHAIN_SYNC=true to enable)');
    }
  }
}
