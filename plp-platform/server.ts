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
// In production, bind to 0.0.0.0 to allow external connections
// In development, use localhost
const hostname = dev ? 'localhost' : '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create HTTP server
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

  // Initialize Socket.IO
  console.log('🚀 About to initialize Socket.IO server...');
  initializeSocketServer(httpServer);
  console.log('✅ Socket.IO initialization complete');

  // Start server
  httpServer.listen(port, hostname, () => {
    const displayHost = hostname === '0.0.0.0' ? 'localhost' : hostname;
    console.log(`> Ready on http://${displayHost}:${port}`);
    console.log(`> Environment: ${dev ? 'development' : 'production'}`);
    console.log(`> Socket.IO: ${dev ? 'http://localhost:3001' : 'enabled on same port'}`);

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
