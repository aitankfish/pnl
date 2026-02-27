# PNL Community Hub - Voice & Chat System

> Transform every market into a live community space.

## Quick Links

| Document | Description |
|----------|-------------|
| [Voice Rooms Architecture](./VOICE_ROOMS_ARCHITECTURE.md) | WebRTC voice implementation |
| [Text Chat Architecture](./TEXT_CHAT_ARCHITECTURE.md) | Real-time chat implementation |

---

## Vision

Every market page becomes a community hub where:
- **Founders** host AMAs and connect with supporters
- **Believers** discuss why they're bullish
- **Critics** challenge ideas and keep quality high
- **Spectators** listen and learn before committing

---

## The Community Hub

```
┌─────────────────────────────────────────────────────────────┐
│                     MARKET PAGE                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Market Info, Price Chart, Vote Panel - existing]          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────┬────────────┬────────────┐                  │
│  │  Activity  │    Chat    │   Voice    │  ← Tabs          │
│  └────────────┴────────────┴────────────┘                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │                   [TAB CONTENT]                     │   │
│  │                                                     │   │
│  │   Activity: On-chain events (existing)              │   │
│  │   Chat: Real-time text discussion                   │   │
│  │   Voice: Live audio room                            │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Order

### Recommended Approach: Chat First, Then Voice

**Why?**
1. Chat is simpler (uses existing infra)
2. Chat validates demand (do users want to talk?)
3. Voice builds on chat's socket infrastructure
4. Lower risk - can ship chat in 1 week

### Timeline

```
Week 1-2: Text Chat
├── Day 1-4: Core chat functionality
├── Day 5-7: Features (reactions, replies, pins)
└── Day 8-10: Polish & testing

Week 3-4: Voice Setup
├── Day 1-3: VPS + TURN server
├── Day 4-7: mediasoup integration
└── Day 8-10: Socket signaling

Week 5-6: Voice Features
├── Day 1-4: Frontend component
├── Day 5-7: Mobile + polish
└── Day 8-10: Testing & edge cases

Week 7: Integration
├── Combine chat + voice in Community Hub
├── Final testing
└── Production deployment
```

**Total: ~7 weeks** for full community hub

---

## Cost Summary

| Component | Monthly Cost |
|-----------|--------------|
| Text Chat | $0 (existing MongoDB + Socket.IO) |
| Voice (Single Server) | ~$6 (Hetzner VPS) |
| **Total** | **~$6/month** |

### At Scale

| Users | Cost |
|-------|------|
| 0-1,000 | $6/mo |
| 1,000-5,000 | $25/mo |
| 5,000-20,000 | $80/mo |
| 20,000+ | $350+/mo |

---

## User Experience

### Position Badges

Every user shows their position:

| Badge | Meaning | Color |
|-------|---------|-------|
| 🟢 YES (2.5 SOL) | Believer with 2.5 SOL position | Green |
| 🔴 NO (1.2 SOL) | Critic with 1.2 SOL position | Red |
| ⚪ Spectator | No position yet | Gray |
| ⭐ Founder | Project creator | Gold |

### Voice Room States

```
┌─────────────────────────────────────────┐
│  🎙️ Voice Room                          │
│                                         │
│  ⭐ Founder is speaking...              │
│                                         │
│  Speakers (3):                          │
│  ⭐ Founder  🟢 Alice  🔴 Bob           │
│                                         │
│  Listeners (12):                        │
│  👤 👤 👤 👤 👤 👤 (+6 more)            │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 🙋 Raise Hand (5 waiting)         │  │
│  │ 🔇 Mute    🚪 Leave               │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### Chat Features

```
┌─────────────────────────────────────────┐
│  💬 Chat                         42 👥   │
├─────────────────────────────────────────┤
│                                         │
│  📌 Pinned: "AMA at 5pm UTC!" - Founder │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 🟢 Alice (3.2 SOL)         2m ago │  │
│  │ This project is solid, been       │  │
│  │ following the founder for months  │  │
│  │ 🚀 12  💎 8  🔥 5                 │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ 🔴 Bob (0.5 SOL)           5m ago │  │
│  │ Idk, roadmap seems ambitious      │  │
│  │ 👀 3                              │  │
│  └───────────────────────────────────┘  │
│                                         │
├─────────────────────────────────────────┤
│  [Type a message...]          [Send]    │
└─────────────────────────────────────────┘
```

---

## Technical Requirements

### Existing Infrastructure (No Changes)
- MongoDB (messages storage)
- Socket.IO (real-time events)
- Privy (wallet auth)
- Next.js (frontend)

### New Infrastructure (Voice Only)
- Hetzner VPS (~$6/mo)
- coturn (TURN server)
- mediasoup (WebRTC SFU)
- Redis (room coordination)

---

## Success Metrics

### Engagement
- % of market visitors who open chat
- Messages per market per day
- Voice room participation rate
- Average session duration

### Quality
- Audio latency (<200ms target)
- Connection success rate (>95%)
- Reconnection success rate (>90%)

### Growth
- Daily active chatters
- Peak concurrent voice users
- Return rate (users who come back)

---

## Security Checklist

- [ ] Wallet signature required to send messages
- [ ] Rate limiting (5 messages/min)
- [ ] Message length limits (500 chars)
- [ ] Founder moderation tools
- [ ] Report/block functionality
- [ ] No audio recording
- [ ] 30-day message TTL
- [ ] TURN server credentials rotation

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Dec 2024 | Build custom vs. third-party | Own forever, $6/mo vs $100+/mo |
| Dec 2024 | mediasoup for SFU | Node.js, battle-tested, scales |
| Dec 2024 | Chat first, voice second | Lower risk, validates demand |
| Dec 2024 | Single server start | Scale when needed, not before |

---

## Next Steps

1. **Review this documentation** - Approve approach
2. **Start with chat** - 1 week to working chat
3. **Validate demand** - Do users actually chat?
4. **Add voice** - 3-4 weeks after chat
5. **Iterate** - Add features based on usage

---

## Questions?

Open an issue or discuss in Discord.

---

*Last Updated: December 2024*
