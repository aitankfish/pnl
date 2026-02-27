/**
 * Socket.IO API Route
 * Sets up Socket.IO server for real-time updates
 */

import { NextRequest } from 'next/server';
import { getSocketServer } from '@/services/socket/socket-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const server = getSocketServer();

    // Return connection stats
    return Response.json({
      status: 'ok',
      connections: server.getConnectionCount(),
      rooms: server.getActiveRooms(),
      message: 'Socket.IO server is running',
    });
  } catch (error) {
    return Response.json(
      { error: 'Failed to get Socket.IO status' },
      { status: 500 }
    );
  }
}
