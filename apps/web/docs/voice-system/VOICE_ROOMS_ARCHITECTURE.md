# PNL Voice Rooms - Architecture & Implementation Guide

> Build once, own forever. Scale-ready from day 1.

## Overview

Real-time voice rooms for PNL market pages, allowing community members to discuss projects, founders to host AMAs, and believers/critics to debate live.

**Key Features:**
- Voice rooms per market (using `marketAddress` as room ID)
- Position badges (YES/NO/Founder)
- Speaker queue with "raise hand"
- Founder moderation controls
- Mobile responsive
- Scale from 1 to 100,000+ concurrent users

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Scale-Ready Design](#scale-ready-design)
4. [Component Breakdown](#component-breakdown)
5. [Database Schema](#database-schema)
6. [API Specifications](#api-specifications)
7. [Socket Events](#socket-events)
8. [Implementation Phases](#implementation-phases)
9. [Deployment Guide](#deployment-guide)
10. [Scaling Playbook](#scaling-playbook)
11. [Cost Projections](#cost-projections)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Next.js    │  │  Socket.IO  │  │ mediasoup   │  │   WebRTC    │    │
│  │  Frontend   │  │   Client    │  │   Client    │  │   Audio     │    │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘    │
└─────────┼────────────────┼────────────────┼────────────────┼───────────┘
          │                │                │                │
          │ HTTP/REST      │ WebSocket      │ WebSocket      │ UDP/TCP
          │                │                │                │
┌─────────┼────────────────┼────────────────┼────────────────┼───────────┐
│         ▼                ▼                ▼                ▼           │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                      MAIN SERVER (Next.js)                       │  │
│  │                                                                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │  │
│  │  │  API Routes  │  │  Socket.IO   │  │   Voice      │           │  │
│  │  │  /api/voice  │  │   Server     │  │  Coordinator │           │  │
│  │  └──────────────┘  └──────────────┘  └──────┬───────┘           │  │
│  └──────────────────────────────────────────────┼──────────────────┘  │
│                                                 │                      │
│                           ┌─────────────────────┘                      │
│                           ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                         REDIS                                    │  │
│  │           (Room Registry, Server Mapping, Pub/Sub)               │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                           │                                            │
│         ┌─────────────────┼─────────────────┐                         │
│         ▼                 ▼                 ▼                          │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                  │
│  │ mediasoup   │   │ mediasoup   │   │ mediasoup   │                  │
│  │  Worker 1   │   │  Worker 2   │   │  Worker N   │                  │
│  │ (Rooms 1-X) │   │ (Rooms X-Y) │   │ (Rooms Y-Z) │                  │
│  └─────────────┘   └─────────────┘   └─────────────┘                  │
│                                                                        │
│                    MEDIA SERVER CLUSTER                                │
└────────────────────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
       ┌─────────────┐          ┌─────────────┐
       │ STUN Server │          │ TURN Server │
       │  (Google)   │          │  (coturn)   │
       │    FREE     │          │   ~$5/mo    │
       └─────────────┘          └─────────────┘
```

### Request Flow

```
1. User clicks "Join Voice" on market page
   │
   ▼
2. Client → POST /api/voice/join { marketAddress, walletAddress }
   │
   ▼
3. Server checks Redis: Does room exist?
   │
   ├── NO  → Create room on least-loaded mediasoup worker
   │         Store mapping in Redis
   │
   └── YES → Get worker assignment from Redis
   │
   ▼
4. Server returns: { workerId, roomId, rtpCapabilities }
   │
   ▼
5. Client connects to mediasoup worker via WebSocket
   │
   ▼
6. Client creates audio producer (microphone)
   │
   ▼
7. Server broadcasts to room: "User X joined"
   │
   ▼
8. Client creates consumers for all existing producers
   │
   ▼
9. User is now in voice room, hearing everyone
```

---

## Technology Stack

| Layer | Technology | Why |
|-------|------------|-----|
| **Frontend** | Next.js 14, React, TypeScript | Already using |
| **Signaling** | Socket.IO | Already have, battle-tested |
| **Media Server** | mediasoup v3 | Node.js, scales well, used by Discord clones |
| **Coordination** | Redis | Pub/sub, room registry, server mapping |
| **TURN Relay** | coturn | Open source, handles NAT traversal |
| **STUN** | Google STUN | Free, reliable |
| **Database** | MongoDB | Already using, store room metadata |
| **Deployment** | Docker + Docker Compose | Easy to scale |

### Why mediasoup?

- **SFU Architecture**: Selective Forwarding Unit - server receives audio from each user and forwards to others
- **Node.js Native**: Fits our stack perfectly
- **Battle-tested**: Powers many production apps
- **Efficient**: Handles 100+ users per room
- **Open Source**: ISC License, free forever

---

## Scale-Ready Design

### Design Principles

1. **Stateless Application Layer**: All state in Redis, any server can handle any request
2. **Horizontal Scaling**: Add more mediasoup workers as needed
3. **Lazy Resource Allocation**: Rooms created on-demand, destroyed when empty
4. **Geographic Distribution Ready**: Architecture supports multi-region deployment
5. **Graceful Degradation**: If one worker dies, others continue working

### Room-to-Worker Assignment

```
┌─────────────────────────────────────────────────────────────┐
│                         REDIS                                │
│                                                             │
│  room_registry: {                                           │
│    "market_ABC123": {                                       │
│      workerId: "worker_1",                                  │
│      createdAt: 1703345600,                                 │
│      participants: 12,                                      │
│      founder: "8Yzk...abc"                                  │
│    },                                                       │
│    "market_XYZ789": {                                       │
│      workerId: "worker_2",                                  │
│      ...                                                    │
│    }                                                        │
│  }                                                          │
│                                                             │
│  worker_load: {                                             │
│    "worker_1": { rooms: 45, users: 380, cpu: 65 },         │
│    "worker_2": { rooms: 32, users: 290, cpu: 48 },         │
│    "worker_3": { rooms: 51, users: 420, cpu: 72 }          │
│  }                                                          │
│                                                             │
│  user_sessions: {                                           │
│    "wallet_Ab3d...xyz": {                                   │
│      roomId: "market_ABC123",                               │
│      producerId: "prod_123",                                │
│      joinedAt: 1703345700                                   │
│    }                                                        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

### Load Balancing Algorithm

```typescript
async function assignRoomToWorker(marketAddress: string): Promise<string> {
  // 1. Check if room already exists
  const existingRoom = await redis.hget('room_registry', marketAddress);
  if (existingRoom) {
    return JSON.parse(existingRoom).workerId;
  }

  // 2. Find least-loaded worker
  const workerLoads = await redis.hgetall('worker_load');
  const workers = Object.entries(workerLoads)
    .map(([id, data]) => ({ id, ...JSON.parse(data) }))
    .filter(w => w.cpu < 80) // Only workers under 80% CPU
    .sort((a, b) => a.users - b.users);

  if (workers.length === 0) {
    throw new Error('All workers at capacity');
  }

  const selectedWorker = workers[0].id;

  // 3. Register room
  await redis.hset('room_registry', marketAddress, JSON.stringify({
    workerId: selectedWorker,
    createdAt: Date.now(),
    participants: 0,
    founder: null
  }));

  return selectedWorker;
}
```

---

## Component Breakdown

### Backend Components

```
server/
├── voice/
│   ├── index.ts                 # Main entry, initializes workers
│   ├── mediasoupConfig.ts       # mediasoup settings
│   ├── WorkerManager.ts         # Manages mediasoup workers
│   ├── RoomManager.ts           # Room lifecycle (create/join/leave/destroy)
│   ├── ParticipantManager.ts    # User state within rooms
│   ├── SignalingHandler.ts      # Socket.IO event handlers
│   └── RedisAdapter.ts          # Redis pub/sub for multi-server sync
│
├── config/
│   └── turn.ts                  # TURN server credentials
│
└── types/
    └── voice.ts                 # TypeScript interfaces
```

### Frontend Components

```
src/
├── lib/
│   └── voice/
│       ├── MediasoupClient.ts   # mediasoup-client wrapper
│       ├── AudioManager.ts      # Mic access, audio levels, mute
│       ├── VoiceSocket.ts       # Socket events for voice
│       └── types.ts             # TypeScript interfaces
│
├── hooks/
│   └── useVoiceRoom.ts          # React hook for voice room state
│
├── components/
│   └── voice/
│       ├── VoiceRoom.tsx        # Main container component
│       ├── VoiceControls.tsx    # Mute, leave, settings
│       ├── ParticipantList.tsx  # List of users in room
│       ├── SpeakerQueue.tsx     # Raise hand queue
│       ├── AudioVisualizer.tsx  # Audio level indicators
│       └── VoiceRoomModal.tsx   # Mobile full-screen modal
│
└── app/
    └── api/
        └── voice/
            ├── join/route.ts         # POST - Join room
            ├── leave/route.ts        # POST - Leave room
            ├── participants/route.ts # GET - List participants
            ├── mute/route.ts         # POST - Mute/unmute
            └── moderate/route.ts     # POST - Founder actions
```

---

## Database Schema

### MongoDB Collections

```typescript
// voice_rooms collection
interface VoiceRoom {
  _id: ObjectId;
  marketAddress: string;          // Unique identifier
  workerId: string;               // Which mediasoup worker
  createdAt: Date;
  lastActivityAt: Date;
  settings: {
    maxParticipants: number;      // Default: 50
    speakerOnly: boolean;         // Founder controls who speaks
    autoDestroy: boolean;         // Destroy when empty
    destroyAfterMinutes: number;  // Default: 5
  };
  stats: {
    totalJoins: number;
    peakParticipants: number;
    totalMinutes: number;
  };
}

// voice_participants collection (for analytics)
interface VoiceParticipant {
  _id: ObjectId;
  marketAddress: string;
  walletAddress: string;
  position: 'YES' | 'NO' | 'NONE';
  positionSize: number;           // SOL amount
  isFounder: boolean;
  joinedAt: Date;
  leftAt: Date | null;
  totalSpeakingTime: number;      // seconds
  wasKicked: boolean;
}
```

### Redis Keys

```
# Room registry (Hash)
room:{marketAddress} -> {
  workerId: string,
  participants: number,
  createdAt: number,
  founderWallet: string | null
}

# Worker load (Hash)
worker:{workerId} -> {
  rooms: number,
  users: number,
  cpu: number,
  memory: number
}

# User session (Hash)
user:{walletAddress} -> {
  roomId: string | null,
  producerId: string | null,
  isMuted: boolean,
  isSpeaker: boolean
}

# Speaker queue (List)
queue:{marketAddress} -> [walletAddress1, walletAddress2, ...]

# Pub/Sub channels
voice:room:{marketAddress}    # Room events (join, leave, mute, etc.)
voice:workers                 # Worker health/load updates
```

---

## API Specifications

### POST /api/voice/join

Join a voice room for a specific market.

**Request:**
```typescript
{
  marketAddress: string;    // Market's Solana address
  walletAddress: string;    // User's wallet address
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    roomId: string;
    workerId: string;
    workerUrl: string;              // WebSocket URL for mediasoup
    rtpCapabilities: object;        // mediasoup RTP capabilities
    participants: Participant[];    // Current participants
    speakerQueue: string[];         // Wallet addresses waiting to speak
    settings: RoomSettings;
    iceServers: IceServer[];        // STUN/TURN config
  }
}
```

### POST /api/voice/leave

Leave the current voice room.

**Request:**
```typescript
{
  marketAddress: string;
  walletAddress: string;
}
```

**Response:**
```typescript
{
  success: boolean;
}
```

### GET /api/voice/participants?marketAddress=xxx

Get current participants in a room.

**Response:**
```typescript
{
  success: boolean;
  data: {
    participants: [
      {
        walletAddress: string;
        displayName: string;
        position: 'YES' | 'NO' | 'NONE';
        positionSize: number;
        isFounder: boolean;
        isSpeaker: boolean;
        isMuted: boolean;
        joinedAt: string;
      }
    ];
    total: number;
  }
}
```

### POST /api/voice/moderate

Founder moderation actions.

**Request:**
```typescript
{
  marketAddress: string;
  founderWallet: string;
  action: 'grant_speaker' | 'revoke_speaker' | 'kick' | 'mute_all';
  targetWallet?: string;    // Required for grant/revoke/kick
}
```

---

## Socket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `voice:join` | `{ marketAddress, walletAddress }` | Join voice room |
| `voice:leave` | `{ marketAddress }` | Leave voice room |
| `voice:mute` | `{ muted: boolean }` | Toggle mute |
| `voice:raise_hand` | `{ marketAddress }` | Request to speak |
| `voice:lower_hand` | `{ marketAddress }` | Cancel speak request |
| `voice:produce` | `{ rtpParameters }` | Start sending audio |
| `voice:consume` | `{ producerId }` | Start receiving audio from user |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `voice:user_joined` | `{ user: Participant }` | Someone joined |
| `voice:user_left` | `{ walletAddress }` | Someone left |
| `voice:user_muted` | `{ walletAddress, muted }` | Mute state changed |
| `voice:speaker_granted` | `{ walletAddress }` | User can now speak |
| `voice:speaker_revoked` | `{ walletAddress }` | User can no longer speak |
| `voice:hand_raised` | `{ walletAddress }` | Someone wants to speak |
| `voice:hand_lowered` | `{ walletAddress }` | Speak request cancelled |
| `voice:new_producer` | `{ producerId, walletAddress }` | New audio source |
| `voice:producer_closed` | `{ producerId }` | Audio source removed |
| `voice:room_closed` | `{ reason }` | Room was closed |
| `voice:error` | `{ code, message }` | Error occurred |

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal:** Basic infrastructure working

```
Day 1-2: Server Setup
├── [ ] Provision Hetzner VPS (Ubuntu 22.04)
├── [ ] Install Docker & Docker Compose
├── [ ] Install coturn (TURN server)
├── [ ] Configure SSL with Let's Encrypt
├── [ ] Test TURN connectivity
└── [ ] Set up Redis

Day 3-4: mediasoup Setup
├── [ ] Create mediasoup Docker image
├── [ ] Configure mediasoup workers
├── [ ] Test basic room creation
├── [ ] Test producer/consumer flow
└── [ ] Verify audio transmission

Day 5-7: Socket.IO Integration
├── [ ] Add voice namespace to existing Socket.IO
├── [ ] Implement join/leave events
├── [ ] Implement signaling for mediasoup
├── [ ] Test end-to-end audio
└── [ ] Debug NAT traversal issues
```

**Deliverable:** Two users can hear each other in a test room.

---

### Phase 2: Core Features (Week 2)

**Goal:** Full-featured voice room

```
Day 1-2: Room Management
├── [ ] Redis room registry
├── [ ] Auto-create room on first join
├── [ ] Auto-destroy room when empty (5 min timeout)
├── [ ] Track participant count
└── [ ] API routes: join, leave, participants

Day 3-4: User Features
├── [ ] Mute/unmute functionality
├── [ ] Position badges (fetch from on-chain)
├── [ ] Founder detection
├── [ ] "Raise hand" queue
└── [ ] Speaker grant/revoke

Day 5-7: Frontend Component
├── [ ] VoiceRoom React component
├── [ ] VoiceControls (mute, leave)
├── [ ] ParticipantList with badges
├── [ ] SpeakerQueue display
└── [ ] Integrate into market page
```

**Deliverable:** Working voice room on market page with all core features.

---

### Phase 3: Polish & Mobile (Week 3)

**Goal:** Production-ready

```
Day 1-2: Audio Quality
├── [ ] Echo cancellation
├── [ ] Noise suppression
├── [ ] Auto-gain control
├── [ ] Audio level visualization
└── [ ] Push-to-talk option

Day 3-4: Mobile Experience
├── [ ] Mobile-responsive design
├── [ ] Full-screen modal on mobile
├── [ ] Touch-friendly controls
├── [ ] Test on iOS Safari
└── [ ] Test on Android Chrome

Day 5-7: Edge Cases & Testing
├── [ ] Reconnection on disconnect
├── [ ] Handle network changes
├── [ ] Graceful degradation
├── [ ] Load testing (simulate 50 users)
├── [ ] Fix all bugs
└── [ ] Performance optimization
```

**Deliverable:** Production-ready voice rooms.

---

### Phase 4: Scale Preparation (Week 4)

**Goal:** Ready for growth

```
Day 1-3: Multi-Worker Support
├── [ ] Worker health monitoring
├── [ ] Load balancing logic
├── [ ] Worker auto-recovery
├── [ ] Redis pub/sub for cross-worker events
└── [ ] Test with 3 workers

Day 4-5: Monitoring & Analytics
├── [ ] Prometheus metrics
├── [ ] Grafana dashboard
├── [ ] Error tracking (Sentry)
├── [ ] Usage analytics
└── [ ] Alert thresholds

Day 6-7: Documentation & Deployment
├── [ ] Deployment runbook
├── [ ] Scaling playbook
├── [ ] Troubleshooting guide
├── [ ] Docker Compose for production
└── [ ] CI/CD pipeline
```

**Deliverable:** Scale-ready system with monitoring.

---

## Deployment Guide

### Single Server Setup (Phase 1)

```yaml
# docker-compose.yml
version: '3.8'

services:
  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  coturn:
    image: coturn/coturn:latest
    restart: always
    network_mode: host
    volumes:
      - ./turnserver.conf:/etc/coturn/turnserver.conf
    environment:
      - TURN_USER=pnl
      - TURN_PASSWORD=${TURN_PASSWORD}

  mediasoup:
    build: ./mediasoup
    restart: always
    ports:
      - "3001:3001"          # Signaling
      - "40000-40100:40000-40100/udp"  # RTP
    environment:
      - REDIS_URL=redis://redis:6379
      - ANNOUNCED_IP=${SERVER_IP}
    depends_on:
      - redis

volumes:
  redis_data:
```

### TURN Server Config

```conf
# turnserver.conf
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
relay-ip=${SERVER_IP}
external-ip=${SERVER_IP}
realm=pnl.market
server-name=pnl.market
fingerprint
lt-cred-mech
user=pnl:${TURN_PASSWORD}
total-quota=100
max-bps=0
stale-nonce=600
cert=/etc/letsencrypt/live/pnl.market/fullchain.pem
pkey=/etc/letsencrypt/live/pnl.market/privkey.pem
no-multicast-peers
```

### Environment Variables

```env
# .env.voice
SERVER_IP=xxx.xxx.xxx.xxx
TURN_PASSWORD=your-secure-password
REDIS_URL=redis://localhost:6379
MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=${SERVER_IP}
MEDIASOUP_RTC_MIN_PORT=40000
MEDIASOUP_RTC_MAX_PORT=40100
```

---

## Scaling Playbook

### When to Scale

| Metric | Threshold | Action |
|--------|-----------|--------|
| CPU Usage | >70% sustained | Add worker |
| Memory Usage | >80% | Add worker or upgrade |
| Active Rooms | >80 per worker | Add worker |
| Concurrent Users | >800 per worker | Add worker |
| Latency | >200ms average | Add regional server |

### Adding a Worker

```bash
# 1. Update docker-compose with new worker
docker-compose up -d mediasoup-worker-2

# 2. Register in Redis
redis-cli HSET worker:worker_2 rooms 0 users 0 cpu 0 memory 0

# 3. Verify health
curl http://worker2:3001/health
```

### Multi-Region Setup

```
                    ┌─────────────────┐
                    │  Global Redis   │
                    │  (Redis Cluster)│
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   ┌───────────┐       ┌───────────┐       ┌───────────┐
   │  US-EAST  │       │  EU-WEST  │       │   ASIA    │
   │  Workers  │       │  Workers  │       │  Workers  │
   └───────────┘       └───────────┘       └───────────┘

User → Closest region (via GeoDNS or Cloudflare)
```

---

## Cost Projections

### Phase 1: Single Server (0-1,000 users)

| Item | Provider | Cost |
|------|----------|------|
| VPS (2 vCPU, 4GB RAM) | Hetzner CX22 | €4.99/mo |
| Domain SSL | Let's Encrypt | Free |
| STUN | Google | Free |
| Redis | Same VPS | Free |
| **Total** | | **~$6/mo** |

### Phase 2: Growth (1,000-5,000 users)

| Item | Provider | Cost |
|------|----------|------|
| VPS (4 vCPU, 8GB RAM) | Hetzner CX32 | €14.99/mo |
| Managed Redis | Upstash | ~$10/mo |
| **Total** | | **~$25/mo** |

### Phase 3: Scale (5,000-20,000 users)

| Item | Provider | Cost |
|------|----------|------|
| 3x VPS Workers | Hetzner | €45/mo |
| Redis Cluster | Upstash | ~$30/mo |
| Load Balancer | Hetzner | €5/mo |
| **Total** | | **~$80/mo** |

### Phase 4: High Scale (20,000+ users)

| Item | Provider | Cost |
|------|----------|------|
| Kubernetes Cluster | Hetzner | ~$150/mo |
| Auto-scaling Workers | Variable | ~$100-300/mo |
| Multi-region Redis | ~$100/mo |
| **Total** | | **~$350-550/mo** |

---

## Security Considerations

### Authentication
- Require valid wallet signature to join
- Verify wallet owns position in market (for badges)
- Rate limit join requests (max 1 per second per wallet)

### Moderation
- Founder can kick/mute users
- Auto-kick for spam (rapid join/leave)
- Report mechanism for abuse

### Privacy
- No audio recording by default
- Clear data retention policy
- GDPR compliance

---

## Monitoring Metrics

### Key Metrics to Track

```
# Room metrics
voice_rooms_active              # Current active rooms
voice_rooms_created_total       # Total rooms created
voice_room_duration_seconds     # How long rooms last

# User metrics
voice_users_concurrent          # Current users in voice
voice_users_joined_total        # Total joins
voice_user_session_duration     # How long users stay

# Quality metrics
voice_latency_ms                # Audio latency
voice_packet_loss_percent       # Network quality
voice_reconnections_total       # Connection stability

# Resource metrics
voice_worker_cpu_percent        # Worker CPU usage
voice_worker_memory_bytes       # Worker memory
voice_worker_rooms              # Rooms per worker
```

---

## Next Steps

1. **Approve this architecture** - Review and confirm approach
2. **Provision infrastructure** - Set up Hetzner VPS
3. **Start Phase 1** - Foundation setup
4. **Weekly check-ins** - Review progress, adjust as needed

---

## References

- [mediasoup Documentation](https://mediasoup.org/documentation/)
- [mediasoup Demo](https://github.com/versatica/mediasoup-demo)
- [coturn Project](https://github.com/coturn/coturn)
- [WebRTC Samples](https://webrtc.github.io/samples/)
- [Socket.IO Documentation](https://socket.io/docs/)

---

*Document Version: 1.0*
*Created: December 2024*
*Last Updated: December 2024*
