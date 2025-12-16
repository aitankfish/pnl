# Chat & Voice System Integration - Future Task

## Overview
Add real-time chat and voice communication to each market page, turning every project into a live community hub.

## Goal
- Text chat for community discussion
- Voice chat for live conversations (radio-style)
- Auto-configure per market (using `marketAddress` as channel/room ID)
- Wallet-based authentication
- Show YES/NO position badges for users

---

## Research Summary

### Three Main Options Evaluated

1. **SolChat** - Web3-native, on-chain messaging (NEW - Recommended)
2. **Rocket.Chat** - Production-ready, feature-complete
3. **free4chat** - Lightweight, privacy-first, Elixir-based

---

## SolChat (Recommended - Web3 Native)

### Overview
SolChat is a decentralized messaging protocol built on Solana with encrypted wallet-to-wallet communication and on-chain message storage. Perfect fit for our prediction market platform.

### Pros
- ✅ **Web3-native** - Wallet auth built-in (matches our Privy stack)
- ✅ On-chain message storage (immutable, censorship-resistant)
- ✅ End-to-end encryption
- ✅ Text + voice + video via WebRTC
- ✅ Integrated payments (send SOL/SPL tokens in chat)
- ✅ No separate infrastructure needed (uses Solana RPC)
- ✅ TypeScript SDK available
- ✅ Position badges easy - can query on-chain positions directly
- ✅ MIT license - fully open source

### Cons
- ❌ Gas costs per message (~$0.0001 per message)
- ❌ Newer project, smaller community
- ❌ SDK uses Metaplex Umi (different from our @solana/web3.js)
- ❌ No npm package yet (must clone repo)
- ❌ Group size limits (on-chain storage constraints)
- ❌ Less battle-tested than Rocket.Chat

### Cost Breakdown (Monthly)
- **Small (1000 messages/day)**: ~$3/mo in gas fees
- **Medium (5000 messages/day)**: ~$15/mo in gas fees
- **Large (20000 messages/day)**: ~$60/mo in gas fees
- **Note**: No server costs - uses existing Solana RPC

### SDK Details
- **GitHub**: https://github.com/solchatapp/solchat-sdk
- **Mainnet Program**: `3RwiUiCrxqsnbSBkbqAdRCY3n9RdwJHG9MVeSmtG7PSs`
- **Devnet Program**: `5zf6JLJTTHobHboH7X17k5x3TeACiziomehjAGRx6PYq`

### SDK Functions
```typescript
// User management
initializeUser, fetchUser, fetchAllUser

// Group management
createGroup, createGroupWithUser, addUserToGroup, fetchGroup, fetchAllGroup

// Messaging
sendMessage, sendMessageToGroup, fetchDecryptedMessages, acceptChat, leaveChat

// Encryption
encryptWithAES, decryptWithAES, generateRsaKeypairFromSeed
```

### Why SolChat for PLP?
1. **Wallet-based identity** - Already using Privy for wallet auth
2. **On-chain positions** - Can show YES/NO badges from on-chain data
3. **Token integration** - Users can tip creators or send tokens
4. **Censorship-resistant** - Aligns with decentralized prediction markets
5. **No extra infrastructure** - Already have Solana RPC configured

---

## Rocket.Chat (Recommended for Quick Launch)

### Pros
- ✅ Production-ready from day 1
- ✅ Text + voice + video + screen sharing all included
- ✅ REST API for auto-creating channels per market
- ✅ Embeddable iframe/SDK
- ✅ 40k+ GitHub stars, battle-tested
- ✅ Mobile apps available
- ✅ Message moderation, reactions, threads, search built-in
- ✅ Can launch in 1 week

### Cons
- ❌ Resource heavy (Node.js single-threaded)
- ❌ Requires separate MongoDB server
- ❌ Higher costs (~$11-28/mo depending on scale)
- ❌ Overkill features (many we don't need)
- ❌ Not web3-native (need custom wallet auth)
- ❌ Performance issues at very high scale (100k+ messages)

### Cost Breakdown (Monthly)
- **Small (200 users, 50 concurrent)**: $11-17/mo
  - Hetzner: 2 vCPU, 2GB RAM - €4.99/mo
  - MongoDB: 2GB RAM - €4.99/mo
- **Medium (500 users, 100 concurrent)**: $17-28/mo
- **Large (1000+ concurrent)**: $39-56/mo

### Server Requirements
- Up to 500 users: 2 vCPU, 2GB RAM, 40GB SSD
- Up to 1000 users: 4 vCPU, 4-8GB RAM
- 5000+ users: 16 vCPU, 12GB RAM + MongoDB cluster

### Repository
https://github.com/RocketChat/Rocket.Chat

---

## free4chat (Recommended for Custom Solution)

### Pros
- ✅ Lightweight and fast (Elixir/Erlang)
- ✅ Privacy-first, local-first design (web3-aligned)
- ✅ WebRTC P2P voice (low latency, scales well)
- ✅ Much lower costs (~$6-17/mo)
- ✅ Easy to customize (smaller codebase)
- ✅ MIT license - fully open source
- ✅ React/TypeScript frontend (matches our stack)
- ✅ Distributed by design (Erlang OTP)
- ✅ No separate database needed for small scale

### Cons
- ❌ Less mature (1.1k stars vs 40k)
- ❌ Smaller community, less documentation
- ❌ Basic text chat (no file sharing, limited history)
- ❌ No mobile apps
- ❌ No built-in moderation tools
- ❌ Requires TURN server setup (coturn)
- ❌ Need to add features yourself
- ❌ Deployment complexity (Elixir less common)
- ❌ 2-3 weeks development time

### Cost Breakdown (Monthly)
- **Small (100-200 concurrent)**: $6-11/mo
  - Hetzner: 2 vCPU, 2GB RAM - €4.99/mo
  - TURN server: same server or €4.99/mo separate
- **Medium (500 concurrent)**: $11-17/mo
- **Large (1000+ concurrent)**: $17-28/mo

### Tech Stack
- Backend: Elixir/Phoenix, Membrane Framework
- Frontend: React, TypeScript, Tailwind CSS
- Communication: WebSocket, WebRTC
- Database: Optional (uses localStorage for messages)

### Repository
https://github.com/i365dev/free4chat

---

## Other Options Considered

### Stream Chat + Huddle01
- **Stream Chat** for text: $99/mo after 25 MAU free tier
- **Huddle01** for voice: Web3-native, free tier available
- **Total**: $0-200/mo depending on scale
- **Pros**: Purpose-built for each use case, modern SDKs
- **Cons**: Two separate integrations, higher cost

### Build Custom with Socket.IO + WebRTC
- We already have Socket.IO running (port 3001)
- Reference: https://github.com/varunon9/webRTC
- **Time**: 2-3 weeks development
- **Cost**: Just server costs (~$6/mo)
- **Pros**: Full control, no ongoing licensing
- **Cons**: Maintenance burden, need to build everything

---

## Recommended Implementation Strategy

### Option A: SolChat (Recommended for Web3-Native Experience)

**Phase 1: Devnet Proof of Concept (Week 1-2)**
1. Clone SolChat SDK from GitHub
2. Test on devnet with one market
3. Integrate with existing Privy wallet auth
4. Build React component wrapper
5. Measure gas costs and latency

**Phase 2: Mainnet Integration (Week 3-4)**
1. Deploy to mainnet
2. Add position badges (YES/NO from on-chain data)
3. Add voice room via WebRTC
4. Style to match brand
5. Launch to production

**Total Cost**: ~$3-15/mo (gas fees only, no server costs)

**This approach:**
- ✅ Web3-native (wallet auth built-in)
- ✅ On-chain messages (censorship-resistant)
- ✅ No extra infrastructure
- ✅ Position badges from on-chain data
- ⚠️ Gas costs scale with usage

---

### Option B: Rocket.Chat (Quick Launch Alternative)

**Phase 1: Quick Launch (Week 1-2)**
1. Deploy Rocket.Chat on Hetzner (€4.99/mo)
2. Deploy MongoDB (€4.99/mo)
3. Integrate REST API for auto-channel creation per `marketAddress`
4. Add Solana wallet authentication
5. Embed chat widget in market page
6. Test with users

**Total Cost**: ~$11-17/mo

**Phase 2: Monitor & Validate (Month 1-3)**
- Track usage metrics (active chatters, messages/day, engagement rate)
- Monitor server costs and performance
- Gather user feedback
- Decide if chat is valuable enough to continue

**This approach:**
- ✅ Ships quickly (1 week)
- ✅ Battle-tested (40k+ GitHub stars)
- ✅ Full feature set out of box
- ❌ Not web3-native (need custom wallet auth)
- ❌ Requires separate infrastructure

---

## Integration Points

### Market Page Integration
Location: `src/app/market/[id]/page.tsx`

Replace or extend the LiveActivityFeed section (lines 1974-1988) with tabbed interface:

```tsx
<CommunityHub marketId={params.id} marketAddress={market.marketAddress}>
  <Tab id="activity">Activity Feed</Tab>
  <Tab id="chat">Chat</Tab>
  <Tab id="voice">Voice Room</Tab>
</CommunityHub>
```

### Auto-Configuration
- Channel/Room ID: Use `market.marketAddress` (Solana public key)
- User ID: Use `primaryWallet.address`
- User Display: Show position badge (YES/NO)
- Permissions: Project creator gets moderator role

### Authentication
- Sign message with Solana wallet to prove ownership
- Username: Shortened wallet address (e.g., "Ab3d...7xYz")
- Avatar: Generated from wallet address or ENS/SNS

---

## Success Metrics

### Track These KPIs
1. **Adoption Rate**: % of market page visitors who use chat
2. **Daily Active Chatters**: Unique users per day
3. **Messages per Market**: Average messages per project
4. **Engagement Time**: Time spent in chat vs just viewing market
5. **Voice Participation**: % who join voice rooms

### Decision Thresholds
- **Keep Chat If**: >10% of visitors engage with chat
- **Add Voice If**: >5% request voice or use it when available
- **Migrate to Custom If**: Costs exceed $30/mo OR need more features

---

## Technical Resources

### SolChat (Recommended)
- SDK: https://github.com/solchatapp/solchat-sdk
- Website: https://www.solchat.io
- Mainnet Program: `3RwiUiCrxqsnbSBkbqAdRCY3n9RdwJHG9MVeSmtG7PSs`
- Devnet Program: `5zf6JLJTTHobHboH7X17k5x3TeACiziomehjAGRx6PYq`
- Dependencies: `@metaplex-foundation/umi`, `@metaplex-foundation/umi-bundle-defaults`

### Rocket.Chat
- Docs: https://docs.rocket.chat
- API: https://developer.rocket.chat/reference/api
- Docker: `docker run -p 3000:3000 rocket.chat`
- React SDK: https://github.com/RocketChat/Rocket.Chat.ReactNative

### free4chat
- Repo: https://github.com/i365dev/free4chat
- Elixir: https://elixir-lang.org
- Membrane Framework: https://membrane.stream
- Phoenix: https://phoenixframework.org

### WebRTC References
- Simple Example: https://github.com/varunon9/webRTC
- Group Chat: https://github.com/anoek/webrtc-group-chat-example

---

## Next Steps (When Ready)

### To Start Implementation:
1. ✅ Create Hetzner account
2. ✅ Deploy Rocket.Chat via Docker
3. ✅ Deploy MongoDB
4. ✅ Set up SSL certificate
5. ✅ Test API integration
6. ✅ Build React component wrapper
7. ✅ Add wallet authentication
8. ✅ Style to match brand
9. ✅ Test with small group
10. ✅ Launch to production

### Estimated Timeline
- **Rocket.Chat**: 1 week
- **free4chat**: 2-3 weeks
- **Custom build**: 3-4 weeks

---

## Cost Summary

| Solution | Small Scale | Medium Scale | Large Scale | Dev Time | Web3 Native |
|----------|-------------|--------------|-------------|----------|-------------|
| **SolChat** | $3/mo | $15/mo | $60/mo | 2-3 weeks | ✅ Yes |
| **Rocket.Chat** | $11-17/mo | $17-28/mo | $39-56/mo | 1 week | ❌ No |
| **free4chat** | $6-11/mo | $11-17/mo | $17-28/mo | 2-3 weeks | ❌ No |
| **Stream + Huddle01** | $0-100/mo | $100-200/mo | $200+/mo | 1-2 weeks | ⚠️ Partial |
| **Custom Build** | $6/mo | $12/mo | $24/mo | 3-4 weeks | ✅ Yes |

**Recommendation**: Use **SolChat** for web3-native experience that aligns with the prediction market ethos. Fall back to Rocket.Chat if SolChat proves too immature or gas costs become prohibitive.

---

## Notes
- This task is for future implementation - not immediate priority
- Initial research completed: November 30, 2025
- SolChat research added: December 15, 2025
- **New recommendation**: SolChat for web3-native experience
- Decision: Launch when ready to add community features
- Alternative: Could also integrate Discord/Telegram bots as interim solution
