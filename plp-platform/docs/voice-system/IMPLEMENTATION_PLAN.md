# Voice System Implementation Plan

> WebRTC voice rooms for PNL market pages using mediasoup SFU

---

## Overview

Add real-time voice rooms to each market page, allowing:
- Founders to host AMAs
- Believers/Critics to debate live
- Community to listen and participate

---

## Prerequisites

Before starting, we need:
- [ ] Hetzner account (or similar VPS provider)
- [ ] Domain for TURN server (e.g., `turn.pnl.market`)
- [ ] SSL certificate (Let's Encrypt)

---

## Phase 1: Infrastructure Setup (Days 1-3)

### Task 1.1: Provision VPS
```
Provider: Hetzner
Plan: CX22 (2 vCPU, 4GB RAM) - €4.99/mo
OS: Ubuntu 22.04 LTS
Location: US East or EU (closest to users)
```

**Steps:**
- [ ] Create Hetzner account
- [ ] Provision CX22 VPS
- [ ] Configure firewall (open ports: 22, 80, 443, 3478, 5349, 40000-40100/UDP)
- [ ] Set up SSH keys
- [ ] Point subdomain to VPS IP (e.g., `voice.pnl.market`)

### Task 1.2: Install Dependencies
```bash
# On VPS
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx
sudo systemctl enable docker
```

### Task 1.3: SSL Certificate
```bash
sudo certbot --nginx -d voice.pnl.market -d turn.pnl.market
```

### Task 1.4: Install coturn (TURN Server)
```bash
sudo apt install -y coturn
```

**Configure `/etc/turnserver.conf`:**
```conf
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
external-ip=YOUR_SERVER_IP
realm=pnl.market
server-name=turn.pnl.market
fingerprint
lt-cred-mech
user=pnl:SECURE_PASSWORD_HERE
total-quota=100
stale-nonce=600
cert=/etc/letsencrypt/live/turn.pnl.market/fullchain.pem
pkey=/etc/letsencrypt/live/turn.pnl.market/privkey.pem
no-multicast-peers
```

**Start coturn:**
```bash
sudo systemctl enable coturn
sudo systemctl start coturn
```

### Task 1.5: Test TURN Server
Use https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/ to verify TURN works.

---

## Phase 2: mediasoup Server (Days 4-7)

### Task 2.1: Create mediasoup Service

**File structure:**
```
voice-server/
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
├── src/
│   ├── index.ts           # Entry point
│   ├── config.ts          # mediasoup config
│   ├── Room.ts            # Room class
│   ├── Peer.ts            # Peer class
│   └── socketHandlers.ts  # Socket.IO events
```

### Task 2.2: mediasoup Configuration

**`src/config.ts`:**
```typescript
export const mediasoupConfig = {
  worker: {
    rtcMinPort: 40000,
    rtcMaxPort: 40100,
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
  },
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
    ],
  },
  webRtcTransport: {
    listenIps: [
      { ip: '0.0.0.0', announcedIp: process.env.ANNOUNCED_IP },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    maxIncomingBitrate: 1500000,
  },
};
```

### Task 2.3: Docker Setup

**`Dockerfile`:**
```dockerfile
FROM node:20-alpine

RUN apk add --no-cache python3 make g++ linux-headers

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

EXPOSE 3002
EXPOSE 40000-40100/udp

CMD ["node", "dist/index.js"]
```

**`docker-compose.yml`:**
```yaml
version: '3.8'

services:
  voice-server:
    build: .
    restart: always
    network_mode: host
    environment:
      - REDIS_URL=redis://localhost:6379
      - ANNOUNCED_IP=${SERVER_IP}
      - PORT=3002
    volumes:
      - ./logs:/app/logs
```

---

## Phase 3: Backend Integration (Days 8-10)

### Task 3.1: Add Voice API Routes

**Create in Next.js app:**
```
src/app/api/voice/
├── join/route.ts         # POST - Join voice room
├── leave/route.ts        # POST - Leave voice room
├── participants/route.ts # GET - List participants
└── ice-servers/route.ts  # GET - Get TURN credentials
```

### Task 3.2: Socket.IO Voice Events

**Add to existing socket server (`server.ts`):**
```typescript
// Voice namespace
const voiceNamespace = io.of('/voice');

voiceNamespace.on('connection', (socket) => {
  // Join room
  socket.on('voice:join', async ({ marketAddress, walletAddress }) => {
    // Verify wallet, get position
    // Connect to mediasoup server
    // Return RTP capabilities
  });

  // Leave room
  socket.on('voice:leave', ({ marketAddress }) => {
    // Cleanup
  });

  // Mute/unmute
  socket.on('voice:mute', ({ muted }) => {
    // Update state, broadcast to room
  });

  // Raise hand
  socket.on('voice:raise-hand', ({ marketAddress }) => {
    // Add to speaker queue
  });
});
```

### Task 3.3: Redis Keys for Voice

```typescript
// Add to redis/client.ts
export const VOICE_KEYS = {
  ROOM: (marketAddress: string) => prefixKey(`voice:room:${marketAddress}`),
  PARTICIPANTS: (marketAddress: string) => prefixKey(`voice:participants:${marketAddress}`),
  SPEAKER_QUEUE: (marketAddress: string) => prefixKey(`voice:queue:${marketAddress}`),
};
```

---

## Phase 4: Frontend Components (Days 11-14)

### Task 4.1: Voice Hook

**`src/lib/hooks/useVoiceRoom.ts`:**
```typescript
export function useVoiceRoom(marketAddress: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [participants, setParticipants] = useState<VoiceParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [speakerQueue, setSpeakerQueue] = useState<string[]>([]);

  const join = async () => { /* ... */ };
  const leave = async () => { /* ... */ };
  const toggleMute = () => { /* ... */ };
  const raiseHand = () => { /* ... */ };
  const lowerHand = () => { /* ... */ };

  return {
    isConnected,
    participants,
    isMuted,
    isSpeaker,
    speakerQueue,
    join,
    leave,
    toggleMute,
    raiseHand,
    lowerHand,
  };
}
```

### Task 4.2: Voice Room Component

**`src/components/voice/VoiceRoom.tsx`:**
```typescript
interface VoiceRoomProps {
  marketAddress: string;
  walletAddress?: string | null;
  founderWallet?: string | null;
  hasPosition?: boolean;
}

export default function VoiceRoom({
  marketAddress,
  walletAddress,
  founderWallet,
  hasPosition
}: VoiceRoomProps) {
  const {
    isConnected,
    participants,
    isMuted,
    speakerQueue,
    join,
    leave,
    toggleMute,
    raiseHand,
  } = useVoiceRoom(marketAddress);

  return (
    <div className="flex flex-col h-full">
      {/* Participants list */}
      <ParticipantList participants={participants} />

      {/* Speaker queue */}
      {speakerQueue.length > 0 && (
        <SpeakerQueue queue={speakerQueue} />
      )}

      {/* Controls */}
      <VoiceControls
        isConnected={isConnected}
        isMuted={isMuted}
        onJoin={join}
        onLeave={leave}
        onToggleMute={toggleMute}
        onRaiseHand={raiseHand}
      />
    </div>
  );
}
```

### Task 4.3: Integrate into CommunityHub

**Update `src/components/chat/CommunityHub.tsx`:**
- Enable the Voice tab (remove `disabled: true`)
- Render `VoiceRoom` component instead of "Coming Soon" message

---

## Phase 5: Testing & Polish (Days 15-17)

### Task 5.1: Testing Checklist
- [ ] Two users can hear each other
- [ ] Mute/unmute works
- [ ] Position badges display correctly
- [ ] Founder can moderate (kick, grant speaker)
- [ ] Raise hand queue works
- [ ] Room auto-destroys when empty
- [ ] Reconnection after disconnect
- [ ] Mobile browser support (iOS Safari, Android Chrome)
- [ ] NAT traversal (test behind corporate firewall)

### Task 5.2: Audio Quality
- [ ] Enable echo cancellation
- [ ] Enable noise suppression
- [ ] Enable auto-gain control
- [ ] Test audio levels visualization

### Task 5.3: Error Handling
- [ ] Microphone permission denied
- [ ] TURN server unreachable
- [ ] mediasoup server unreachable
- [ ] Network disconnect recovery

---

## Phase 6: Deployment (Days 18-19)

### Task 6.1: Environment Variables

**Add to `.env`:**
```env
# Voice Server
VOICE_SERVER_URL=https://voice.pnl.market
TURN_SERVER_URL=turn:turn.pnl.market:3478
TURN_USERNAME=pnl
TURN_PASSWORD=SECURE_PASSWORD_HERE
```

### Task 6.2: Deploy Voice Server
```bash
# On VPS
cd voice-server
docker-compose up -d
```

### Task 6.3: Deploy Frontend
- Push changes to Git
- Vercel auto-deploys

---

## File Checklist

### New Files to Create
```
voice-server/                      # Separate repo/folder for mediasoup
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
└── src/
    ├── index.ts
    ├── config.ts
    ├── Room.ts
    ├── Peer.ts
    └── socketHandlers.ts

src/app/api/voice/
├── join/route.ts
├── leave/route.ts
├── participants/route.ts
└── ice-servers/route.ts

src/lib/hooks/
└── useVoiceRoom.ts

src/components/voice/
├── VoiceRoom.tsx
├── VoiceControls.tsx
├── ParticipantList.tsx
├── SpeakerQueue.tsx
└── AudioVisualizer.tsx
```

### Files to Modify
```
src/components/chat/CommunityHub.tsx  # Enable voice tab
server.ts                              # Add voice socket events
src/lib/redis/client.ts               # Add voice Redis keys
.env                                   # Add voice env vars
```

---

## Cost Summary

| Item | Cost |
|------|------|
| Hetzner VPS (CX22) | €4.99/mo (~$6) |
| Domain (if new) | ~$12/year |
| SSL | Free (Let's Encrypt) |
| **Total** | **~$6/mo** |

---

## Timeline Summary

| Phase | Days | Deliverable |
|-------|------|-------------|
| 1. Infrastructure | 1-3 | VPS + TURN server running |
| 2. mediasoup Server | 4-7 | Voice server deployed |
| 3. Backend Integration | 8-10 | API routes + socket events |
| 4. Frontend Components | 11-14 | Voice UI in app |
| 5. Testing & Polish | 15-17 | Bug-free, mobile-ready |
| 6. Deployment | 18-19 | Production launch |

**Total: ~3 weeks**

---

## Next Steps

1. **Approve this plan**
2. **Set up Hetzner account** (need your input)
3. **Start Phase 1** - Infrastructure setup

---

*Created: December 2024*
