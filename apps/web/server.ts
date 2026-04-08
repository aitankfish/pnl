/**
 * Custom Next.js Server with Socket.IO
 * Required for Socket.IO integration
 *
 * Run with: ts-node server.ts
 * Or add to package.json: "dev": "ts-node server.ts"
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig(); // Load .env file

// Mark that we're running with unified server (skip instrumentation.ts)
process.env.UNIFIED_SERVER = 'true';

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initializeSocketServer } from './src/services/socket/socket-server';
import { startBlockchainSync } from './src/services/blockchain-sync/sync-manager';

const dev = process.env.NODE_ENV !== 'production';
// Bind to 0.0.0.0 to allow external connections (mobile devices on LAN)
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create HTTP server with the Next.js request handler as the callback.
  // IMPORTANT: Socket.IO's engine.io attach() captures existing request
  // listeners, removes them, and re-invokes them for non-socket paths.
  // The callback passed to createServer() becomes the initial request
  // listener that Socket.IO will capture and manage.
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Initialize Socket.IO AFTER creating the server with the Next.js handler.
  // engine.io's attach() will:
  //   1. Capture the existing Next.js request listener
  //   2. Remove it
  //   3. Add its own handler that intercepts /api/socket/io requests
  //   4. For non-socket requests, call the captured Next.js handler
  console.log('🚀 About to initialize Socket.IO server...');
  initializeSocketServer(httpServer);
  console.log('✅ Socket.IO initialization complete');

  // Start server
  httpServer.listen(port, hostname, () => {
    const displayHost = hostname === '0.0.0.0' ? 'localhost' : hostname;
    console.log(`> Ready on http://${displayHost}:${port}`);
    console.log(`> Environment: ${dev ? 'development' : 'production'}`);
    console.log(`> Socket.IO: enabled on same port (path: /api/socket/io)`);

    // Start blockchain sync after server is fully ready
    // This ensures Socket.IO is listening before broadcasts start
    setTimeout(() => {
      startBlockchainSync()
        .then(() => console.log('✅ Blockchain sync started'))
        .catch((error) => console.error('❌ Failed to start blockchain sync:', error));
    }, 3000); // Wait 3 seconds for server to be fully ready
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    httpServer.close(() => {
      console.log('HTTP server closed');
    });
  });
});
