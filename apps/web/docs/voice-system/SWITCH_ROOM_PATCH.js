/**
 * switchRoom handler — paste this into /opt/voice-server/index.js
 *
 * Add this AFTER the existing 'joinRoom' handler, inside the
 * io.on('connection', (socket) => { ... }) block.
 *
 * This handler atomically moves a peer from one room to another
 * without dropping the Socket.IO connection. The response shape
 * matches joinRoom so the client reuses the same transport setup logic.
 */

// ─── switchRoom ─────────────────────────────────────────────────
socket.on('switchRoom', async ({ fromRoom, toRoom, peerId }, callback) => {
  try {
    if (!fromRoom || !toRoom || !peerId) {
      return callback({ error: 'Missing required fields: fromRoom, toRoom, peerId' });
    }

    if (fromRoom === toRoom) {
      return callback({ error: 'Already in this room' });
    }

    // ── 1. Leave old room ──────────────────────────────────────

    const oldRoom = rooms.get(fromRoom);
    if (oldRoom) {
      const oldPeer = oldRoom.peers.get(peerId);
      if (oldPeer) {
        // Close all server-side transports (also closes their producers/consumers)
        for (const transport of oldPeer.transports.values()) {
          try { transport.close(); } catch (e) { /* already closed */ }
        }
        oldRoom.peers.delete(peerId);
      }

      // Leave Socket.IO room and notify remaining peers
      socket.leave(fromRoom);
      socket.to(fromRoom).emit('peerLeft', { peerId });

      // Clean up empty room
      if (oldRoom.peers.size === 0) {
        try { oldRoom.router.close(); } catch (e) { /* already closed */ }
        rooms.delete(fromRoom);
        console.log(`[switchRoom] Room ${fromRoom} destroyed (empty)`);
      }
    }

    // ── 2. Join new room ───────────────────────────────────────

    let newRoom = rooms.get(toRoom);
    if (!newRoom) {
      // Create new room with a fresh Router
      const worker = getNextWorker(); // use your existing worker selection
      const router = await worker.createRouter({ mediaCodecs });
      newRoom = {
        router,
        peers: new Map(),
      };
      rooms.set(toRoom, newRoom);
      console.log(`[switchRoom] Created new room: ${toRoom}`);
    }

    const router = newRoom.router;

    // Create send transport
    const sendTransport = await router.createWebRtcTransport(webRtcTransportOptions);
    // Create recv transport
    const recvTransport = await router.createWebRtcTransport(webRtcTransportOptions);

    // Register peer in new room
    const peerData = {
      peerId,
      transports: new Map([
        [sendTransport.id, sendTransport],
        [recvTransport.id, recvTransport],
      ]),
      producers: new Map(),
      consumers: new Map(),
      isSpeaker: true, // default; client can override
    };
    newRoom.peers.set(peerId, peerData);

    // Join Socket.IO room
    socket.join(toRoom);

    // Update socket metadata so existing handlers target the new room
    socket.data.roomId = toRoom;
    socket.data.peerId = peerId;

    // Build peer list (existing peers in new room, excluding self)
    const peers = [];
    for (const [id, p] of newRoom.peers.entries()) {
      if (id !== peerId) {
        peers.push({
          id,
          isSpeaker: p.isSpeaker ?? true,
        });
      }
    }

    console.log(`[switchRoom] ${peerId} moved ${fromRoom} -> ${toRoom} (${newRoom.peers.size} peers)`);

    callback({
      rtpCapabilities: router.rtpCapabilities,
      sendTransportOptions: {
        id: sendTransport.id,
        iceParameters: sendTransport.iceParameters,
        iceCandidates: sendTransport.iceCandidates,
        dtlsParameters: sendTransport.dtlsParameters,
      },
      recvTransportOptions: {
        id: recvTransport.id,
        iceParameters: recvTransport.iceParameters,
        iceCandidates: recvTransport.iceCandidates,
        dtlsParameters: recvTransport.dtlsParameters,
      },
      peers,
    });

  } catch (err) {
    console.error('[switchRoom] Error:', err);
    callback({ error: err.message || 'switchRoom failed' });
  }
});
