/**
 * Next.js Instrumentation Hook
 * Initializes Socket.IO server and Blockchain Sync when Next.js starts
 * Works with standard `next dev` and `next start` commands
 */

export async function register() {
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
    const autoStartSync = process.env.AUTO_START_SYNC !== 'false';
    if (autoStartSync && process.env.NODE_ENV === 'production') {
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
      console.log('ℹ️  Blockchain sync disabled in development mode');
    }
  }
}
