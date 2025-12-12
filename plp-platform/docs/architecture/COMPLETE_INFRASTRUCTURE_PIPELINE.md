# Complete Infrastructure Pipeline - PLP Platform

## 📋 Overview

This document describes the **complete end-to-end infrastructure pipeline** for the PLP platform, from market creation through voting to real-time updates. It covers how all infrastructure components work together on both devnet and mainnet.

**Last Updated**: December 3, 2025

**Recent Updates**:
- Fixed Helius Enhanced API integration (removed invalid parameters)
- Switched to MongoDB-first architecture for trade history and market holders
- Fixed production Socket.IO server configuration (unified server on port 3000)

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER FRONTEND                             │
│  • React/Next.js App                                            │
│  • Privy Wallet Integration                                     │
│  • Socket.IO Client (Real-time updates)                         │
└────────────┬─────────────────────────────┬───────────────────────┘
             │                             │
             ↓ (HTTP/WebSocket)            ↓ (Solana RPC)
┌────────────────────────┐   ┌─────────────────────────────────────┐
│   BACKEND API SERVER sw  │   │      SOLANA BLOCKCHAIN              │
│  • Next.js API Routes  │   │  • Devnet / Mainnet-Beta            │
│  • MongoDB             │   │  • PLP Program (Smart Contract)     │
│  • Socket.IO Server    │   │  • Market & Position PDAs           │
└────────────┬───────────┘   └───────────┬─────────────────────────┘
             │                           │
             │                           ↓
             │              ┌────────────────────────────────────┐
             │              │  HELIUS ENHANCED WEBSOCKET         │
             │              │  • Program Account Subscription    │
             │              │  • Real-time Change Detection      │
             │              └──────────┬─────────────────────────┘
             │                         │
             │                         ↓
             │              ┌────────────────────────────────────┐
             │              │       REDIS QUEUE (Upstash)        │
             │              │  • Event Buffer                    │
             │              │  • Retry Logic                     │
             │              └──────────┬─────────────────────────┘
             │                         │
             │                         ↓
             │              ┌────────────────────────────────────┐
             │              │      EVENT PROCESSOR               │
             │              │  • Background Worker               │
             │              │  • Parse Account Data              │
             └──────────────┼──• Update MongoDB                  │
                            │  • Broadcast via Socket.IO         │
                            └────────────────────────────────────┘
```

---

## 📊 Data Flow Diagrams

### 1. Market Creation Flow

```
┌─────────┐
│  USER   │
└────┬────┘
     │
     ↓ Fills Create Form
┌──────────────────────────────┐
│  FRONTEND: /create page      │
│  1. Upload metadata to IPFS  │
│  2. Call prepare API         │
└────────────┬─────────────────┘
             │
             ↓ POST /api/markets/prepare-transaction
┌──────────────────────────────────────────────────────────┐
│  BACKEND API                                             │
│  1. Validate input                                       │
│  2. Store project in MongoDB (projects collection)       │
│  3. Store market in MongoDB (predictionmarkets)          │
│  4. Build Solana transaction (initialize market PDA)     │
│  5. Return serialized transaction                        │
└────────────┬─────────────────────────────────────────────┘
             │
             ↓ Returns: { serializedTransaction, marketId }
┌──────────────────────────────┐
│  FRONTEND                    │
│  1. Sign with Privy wallet   │
│  2. Send to Solana           │
└────────────┬─────────────────┘
             │
             ↓ Transaction Broadcast
┌──────────────────────────────────────────┐
│  SOLANA BLOCKCHAIN                       │
│  1. Process initialize_market IX         │
│  2. Create Market PDA                    │
│  3. Set initial state (phase=0)          │
└────────────┬─────────────────────────────┘
             │
             ↓ Account Change Detected
┌──────────────────────────────────────────┐
│  HELIUS WEBSOCKET                        │
│  • Subscribed to program: 6kK2...       │
│  • Detects new market account           │
│  • Pushes event to Redis                 │
└────────────┬─────────────────────────────┘
             │
             ↓ Event in Queue
┌──────────────────────────────────────────┐
│  EVENT PROCESSOR                         │
│  1. Pop event from Redis                 │
│  2. Parse market account data            │
│  3. Update MongoDB                       │
│  4. Broadcast via Socket.IO              │
└────────────┬─────────────────────────────┘
             │
             ↓ Real-time Update
┌──────────────────────────────┐
│  ALL CONNECTED CLIENTS       │
│  • Market appears in list    │
│  • Vote buttons enabled      │
│  • Real-time percentages     │
└──────────────────────────────┘
```

---

### 2. Voting Flow

```
┌─────────┐
│  USER   │
└────┬────┘
     │
     ↓ Clicks "Vote YES" (0.05 SOL)
┌──────────────────────────────────┐
│  FRONTEND: /market/[id] page     │
│  useVoting() hook                │
└────────────┬─────────────────────┘
             │
             ↓ POST /api/markets/vote/prepare
┌────────────────────────────────────────────────────────┐
│  BACKEND API                                           │
│  1. Derive position PDA for (user, market)             │
│  2. Build vote transaction                             │
│  3. Calculate AMM swap (SOL → shares)                  │
│  4. Return serialized transaction                      │
└────────────┬───────────────────────────────────────────┘
             │
             ↓ Returns: { serializedTransaction, positionPda }
┌──────────────────────────────┐
│  FRONTEND                    │
│  1. Sign with Privy wallet   │
│  2. Send to Solana           │
│  3. Wait for confirmation    │
└────────────┬─────────────────┘
             │
             ↓ Transaction Broadcast
┌──────────────────────────────────────────────────────┐
│  SOLANA BLOCKCHAIN                                   │
│  1. Process vote IX                                  │
│  2. Transfer SOL from user                           │
│  3. Update market pools (AMM)                        │
│  4. Update/create position PDA with shares           │
│  5. Update total YES/NO share counts                 │
└────────────┬─────────────────────────────────────────┘
             │
             ↓ 2 Account Changes Detected!
┌──────────────────────────────────────────────────────┐
│  HELIUS WEBSOCKET                                    │
│  Event 1: Market account updated (pools changed)     │
│  Event 2: Position account updated (shares)          │
│  → Both pushed to Redis queue                        │
└────────────┬─────────────────────────────────────────┘
             │
             ↓ 2 Events in Queue
┌──────────────────────────────────────────────────────┐
│  EVENT PROCESSOR                                     │
│                                                      │
│  ┌─ Process Market Update:                          │
│  │  1. Parse market data                            │
│  │  2. Calculate vote percentages                   │
│  │  3. Update predictionmarkets collection          │
│  │  4. Broadcast to Socket.IO room                  │
│  │                                                  │
│  └─ Process Position Update:                        │
│     1. Parse position data (user shares)            │
│     2. Update/create prediction_participants         │
│     3. Increment vote count if new voter            │
│     4. Broadcast position update                    │
└────────────┬─────────────────────────────────────────┘
             │
             ↓ Socket.IO Broadcast
┌──────────────────────────────────────────────────────┐
│  ALL CLIENTS WATCHING THIS MARKET                    │
│  • Vote percentages update (65% YES / 35% NO)        │
│  • Pool progress bar animates                        │
│  • Recent activity shows "User voted YES"            │
│  • No page refresh needed!                           │
└──────────────────────────────────────────────────────┘
```

---

## 🔧 Infrastructure Components

### 1. Frontend (Next.js + React)

**Location**: `src/app/`, `src/components/`

**Key Responsibilities**:
- User interface (market creation, voting, claiming)
- Wallet integration (Privy for embedded & external wallets)
- Real-time updates via Socket.IO
- Transaction signing and submission

**Key Files**:
- `src/app/create/page.tsx` - Market creation UI
- `src/app/market/[id]/page.tsx` - Market details & voting
- `src/lib/hooks/useVoting.ts` - Vote transaction logic
- `src/lib/hooks/useSocket.ts` - Socket.IO client

---

### 2. Backend API (Next.js API Routes)

**Location**: `src/app/api/`

**Key Endpoints**:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/markets/prepare-transaction` | POST | Prepare market creation transaction |
| `/api/markets/vote/prepare` | POST | Prepare vote transaction |
| `/api/markets/list` | GET | List markets with filters |
| `/api/markets/[id]` | GET | Get single market details |
| `/api/markets/[id]/position` | GET | Get user's position in market |
| `/api/markets/resolve/prepare-with-token` | POST | Prepare resolution transaction |

**Database**: MongoDB (Mongoose)
- Collections: `projects`, `predictionmarkets`, `prediction_participants`, `user_profiles`

---

### 3. Solana Blockchain

**Networks**:
- **Devnet**: For testing (program: `C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86`)
- **Mainnet-Beta**: For production (program: `C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86`)

**Account Types**:
1. **Market PDA**: Stores market state (pools, votes, resolution)
2. **Position PDA**: Stores user's position (YES/NO shares, invested amount)

**RPC Provider**: Helius
- Devnet: `https://devnet.helius-rpc.com/?api-key=...`
- Mainnet: `https://mainnet.helius-rpc.com/?api-key=...`

---

### 4. Helius Enhanced WebSocket

**File**: `src/services/blockchain-sync/helius-client.ts`

**How It Works**:
```typescript
// 1. Connect to Helius WebSocket
wss://mainnet.helius-rpc.com/?api-key=YOUR_KEY

// 2. Subscribe to program (all accounts under this program)
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "programSubscribe",
  "params": [
    "C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86", // Program ID
    {
      "encoding": "base64",
      "commitment": "confirmed"
    }
  ]
}

// 3. Receive updates when ANY account under this program changes
// • New market created → account created event
// • Vote happens → market & position account updated
// • Market resolved → market account updated
```

**Key Features**:
- **Real-time**: Sub-second latency
- **Reliable**: Auto-reconnect with exponential backoff
- **Efficient**: Single WebSocket for all accounts
- **No polling**: Push-based, not pull-based

**Important**: We use Helius WebSocket for real-time monitoring only. Historical data (trade history, holders) is queried from MongoDB, NOT from Helius Enhanced Transactions API. This prevents rate limiting and improves performance.

---

### 5. Redis Queue (Upstash)

**File**: `src/lib/redis/queue.ts`

**Purpose**: Buffer between blockchain and database

**Why Redis?**
- **Decoupling**: Blockchain events don't directly hit MongoDB
- **Reliability**: Events queued even if processor is down
- **Retry Logic**: Failed events automatically retried (max 3 attempts)
- **Dead Letter Queue**: Failed events moved to `dlq:blockchain-events`

**Queue Operations**:
```typescript
// Push event (from Helius client)
await pushEvent({
  type: 'account_update',
  accountType: 'market',
  address: 'market_pda_address',
  data: Buffer, // Raw account data
  slot: 12345
});

// Pop event (by event processor) - blocks for 5 seconds
const event = await popEvent(5);

// Mark processed
await markProcessed(event.id);

// Retry on failure
await retryEvent(event, errorMessage);
```

---

### 6. Event Processor (Background Worker)

**File**: `src/services/blockchain-sync/event-processor.ts`

**Runs**: Continuously in background (started with `npm run dev:unified`)

**Flow**:
```typescript
while (!stopRequested) {
  // 1. Pop event from Redis (blocking, 5 second timeout)
  const event = await popEvent(5);

  if (!event) continue; // No events, loop again

  // 2. Process based on account type
  if (event.accountType === 'market') {
    await processMarketUpdate(event);
  } else if (event.accountType === 'position') {
    await processPositionUpdate(event);
  }

  // 3. Mark as processed
  await markProcessed(event.id);
}
```

**Market Update Processing**:
1. Parse raw account data to structured format
2. Calculate derived fields (percentages, pool progress)
3. Update MongoDB `predictionmarkets` collection
4. Record time-series data for charts
5. Broadcast update via Socket.IO

**Position Update Processing**:
1. Parse position data (user, shares, invested amount)
2. Update/create `prediction_participants` record
3. Increment vote count if new voter
4. Broadcast position update

---

### 7. Socket.IO Server

**File**: `src/services/socket/socket-client.ts`

**Purpose**: Real-time updates to frontend clients

**Architecture**:
```
Event Processor
      ↓
socketClient.broadcastMarketUpdate(marketAddress, data)
      ↓
Socket.IO Server (port 3000)
      ↓
Emit to room: `market:${marketAddress}`
      ↓
All clients in that room get instant update
```

**Client-Side Usage**:
```typescript
// Frontend hook
const { marketData, isConnected } = useMarketSocket(marketAddress);

// Automatically receives updates when:
// • Someone votes
// • Market resolved
// • Pool progress changes
```

**Events Broadcasted**:
- `market:${address}:update` - Market state changed
- `market:${address}:vote` - New vote cast
- `market:${address}:resolved` - Market resolved

---

## 🔄 Complete Pipeline Examples

### Example 1: Market Creation on Mainnet

**Environment Variables**:
```env
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_PLP_PROGRAM_ID_MAINNET=C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86
MONGODB_PROD_DATABASE=plp_platform_prod
NEXT_PUBLIC_HELIUS_MAINNET_RPC=https://mainnet.helius-rpc.com/?api-key=...
HELIUS_WS_MAINNET=wss://mainnet.helius-rpc.com/?api-key=...
```

**Step-by-Step**:

1. **User Action** (t=0s)
   ```
   User fills create form → Uploads to IPFS → Clicks "Create Market"
   ```

2. **Frontend** (t=0.1s)
   ```typescript
   POST /api/markets/prepare-transaction
   {
     name: "New DeFi Protocol",
     tokenSymbol: "DFP",
     targetPool: 5 SOL,
     expiryTime: "2025-12-01T00:00:00Z"
   }
   ```

3. **Backend API** (t=0.3s)
   ```typescript
   // 1. Store in MongoDB
   const project = await Project.create({ ... });
   const market = await PredictionMarket.create({
     projectId: project._id,
     marketAddress: derivedPda.toBase58(),
     marketState: 0,
     phase: 0,
     ...
   });

   // 2. Build Solana transaction
   const tx = await program.methods
     .initializeMarket(...)
     .accounts({ ... })
     .transaction();

   // 3. Return to client
   return { serializedTransaction: tx.serialize() };
   ```

4. **Frontend Signs & Sends** (t=0.5s)
   ```typescript
   const { signature } = await signAndSendTransaction({
     transaction: Buffer.from(serializedTx),
     wallet: privyWallet
   });
   // signature: "3xK2p9..."
   ```

5. **Solana Confirms** (t=1.5s)
   ```
   ✅ Transaction confirmed in slot 234567890
   ✅ Market PDA created: ABC123...
   ```

6. **Helius Detects** (t=1.6s)
   ```
   Helius WebSocket: Account ABC123... created
   → accountType: market (detected by discriminator)
   → Push to Redis queue
   ```

7. **Event Processor** (t=2.0s)
   ```typescript
   // Pop event from Redis
   const event = await popEvent();

   // Process market update
   await processMarketUpdate(event);

   // Update MongoDB
   await PredictionMarket.updateOne(
     { marketAddress: event.address },
     { $set: { syncStatus: 'synced', lastSyncedAt: new Date() } }
   );

   // Broadcast via Socket.IO
   socketClient.broadcastMarketUpdate(event.address, marketData);
   ```

8. **Frontend Updates** (t=2.1s)
   ```typescript
   // Socket.IO event received
   useMarketSocket receives update → UI re-renders

   ✅ Market appears in list
   ✅ Vote buttons enabled
   ✅ Real-time progress shows 0%
   ```

**Total Time: ~2 seconds from click to live on site!**

---

### Example 2: Voting on Mainnet

**Scenario**: Alice votes YES with 0.05 SOL

1. **Alice Clicks "Vote YES"** (t=0s)

2. **Frontend Prepares** (t=0.1s)
   ```typescript
   POST /api/markets/vote/prepare
   {
     marketAddress: "ABC123...",
     voteType: "yes",
     amount: 0.05,
     userWallet: "Alice's address",
     network: "mainnet-beta"
   }
   ```

3. **Backend Builds Transaction** (t=0.2s)
   ```typescript
   // Derive position PDA
   const [positionPda] = PublicKey.findProgramAddressSync(
     [Buffer.from("position"), market.toBuffer(), user.toBuffer()],
     programId
   );

   // Build vote transaction
   const tx = await program.methods
     .vote(true, new BN(50000000)) // true = YES, 0.05 SOL
     .accounts({
       market: marketAddress,
       position: positionPda,
       user: userWallet,
       ...
     })
     .transaction();

   return { serializedTransaction, positionPda };
   ```

4. **Alice Signs & Confirms** (t=0.8s)
   ```
   Privy → Sign → Send → Confirmed
   signature: "5yH3n8..."
   ```

5. **Solana Executes** (t=1.8s)
   ```
   ✅ Instruction: vote
   ✅ Transferred: 0.05 SOL from Alice
   ✅ Updated: Market PDA (pools, shares)
   ✅ Updated: Position PDA (Alice's shares)
   ```

6. **Helius Detects 2 Changes** (t=1.9s)
   ```
   Event 1: market:ABC123... updated
   Event 2: position:Alice-ABC123... updated
   → Both pushed to Redis
   ```

7. **Event Processor Handles Both** (t=2.5s)
   ```typescript
   // Process market update
   marketData = parseMarketAccount(event1.data);
   yesPercentage = (yesPool / (yesPool + noPool)) * 100; // Now 52%

   await PredictionMarket.updateOne({ marketAddress }, {
     yesPercentage: 52,
     noPercentage: 48,
     totalYesStake: 2.6, // Was 2.55
     yesVoteCount: 53, // Was 52
   });

   // Process position update
   await PredictionParticipant.updateOne(
     { marketId, participantWallet: Alice },
     { yesShares: "125000000", totalInvested: "50000000" },
     { upsert: true }
   );

   // Broadcast both
   socketClient.broadcastMarketUpdate(...);
   ```

8. **All Clients Update** (t=2.6s)
   ```
   Bob watching same market:
   • Sees YES percentage jump from 51% → 52%
   • Sees pool progress bar animate
   • Sees "Alice voted YES" in activity feed
   • All without refreshing!
   ```

**Total Time: ~2.6 seconds from vote to everyone seeing update!**

---

## 🌐 Network Switching (Devnet ↔ Mainnet)

### What Changes Automatically

When you change `NEXT_PUBLIC_SOLANA_NETWORK` from `devnet` to `mainnet-beta`:

| Component | Devnet Value | Mainnet Value | Auto-Switch? |
|-----------|-------------|---------------|--------------|
| **MongoDB Database** | `plp-platform` | `plp_platform_prod` | ✅ Yes |
| **Program ID** | `2CjwEvY3gkEr...` | `6kK2SVaj6yW7...` | ✅ Yes |
| **RPC Endpoint** | `devnet.helius-rpc.com` | `mainnet.helius-rpc.com` | ✅ Yes |
| **WebSocket URL** | `wss://devnet.helius...` | `wss://mainnet.helius...` | ✅ Yes |
| **USDC Mint** | Devnet USDC | Real USDC | ✅ Yes |
| **Redis Instance** | Same | Same | N/A |
| **Socket.IO Server** | Same | Same | N/A |

### Environment Files

**File**: `src/lib/environment.ts`

```typescript
// Automatically selects database based on network
const databaseName = network === 'devnet'
  ? 'plp-platform'
  : 'plp_platform_prod';

// Automatically selects RPC
const rpcUrl = network === 'devnet'
  ? process.env.NEXT_PUBLIC_HELIUS_DEVNET_RPC
  : process.env.NEXT_PUBLIC_HELIUS_MAINNET_RPC;
```

**File**: `src/services/blockchain-sync/sync-manager.ts`

```typescript
// Automatically selects program ID (FIXED in latest commit!)
const pid = programId || (
  net === 'mainnet'
    ? process.env.NEXT_PUBLIC_PLP_PROGRAM_ID_MAINNET
    : process.env.NEXT_PUBLIC_PLP_PROGRAM_ID_DEVNET
);
```

### Testing Checklist

Before switching to mainnet:

- [ ] Verify `NEXT_PUBLIC_PLP_PROGRAM_ID_MAINNET` is deployed
- [ ] Test market creation on mainnet
- [ ] Test voting on mainnet
- [ ] Verify blockchain sync picks up changes
- [ ] Check MongoDB `plp_platform_prod` database receives data
- [ ] Confirm Socket.IO broadcasts work
- [ ] Test with real USDC (not devnet USDC)

---

## 🐛 Debugging & Monitoring

### Logs

**Helius WebSocket**:
```
✅ Helius WebSocket connected
📥 Account update: ABC123... (market)
✅ Event pushed to queue: event-12345
```

**Event Processor**:
```
🚀 Event processor started
✅ Event processor connected to MongoDB: plp_platform_prod
📋 Processing event: account_update - ABC123...
✅ Market updated: ABC123...
```

**Socket.IO**:
```
📡 Broadcasting market update: ABC123...
✅ 5 clients notified in room: market:ABC123...
```

### Health Checks

**Endpoint**: `/api/health`

```json
{
  "status": "ok",
  "mongodb": {
    "connected": true,
    "database": "plp_platform_prod"
  },
  "redis": {
    "connected": true,
    "queueLength": 3
  },
  "blockchain_sync": {
    "running": true,
    "lastProcessed": "2025-11-30T12:34:56Z"
  },
  "socket": {
    "connected": true,
    "clientCount": 12
  }
}
```

### Common Issues

**Issue**: Market created but not appearing in list
**Cause**: Blockchain sync not running
**Solution**: Check `npm run dev:unified` is running

**Issue**: Votes not updating in real-time
**Cause**: Socket.IO disconnected
**Solution**: Check browser console for Socket.IO errors

**Issue**: Wrong program ID on mainnet
**Cause**: Not using latest fix
**Solution**: Pull latest from `mainnet-testing` branch

---

## 🚀 Deployment

### Development

```bash
# Terminal 1: Next.js app + Socket.IO server
npm run dev

# Terminal 2: Blockchain sync (Helius + Event Processor)
npm run dev:unified
```

### Production

```bash
# Single command starts all services
npm run start:unified

# Services started:
# 1. Next.js app (port 3000, hostname: 0.0.0.0)
# 2. Socket.IO server (port 3000, same port as HTTP)
# 3. Helius WebSocket client
# 4. Event processor (background)
```

**Important**: Production uses `start:unified` (NOT `start:prod`) to ensure Socket.IO server is initialized properly.

---

## 📚 Related Documentation

- `BLOCKCHAIN_SYNC_COMPLETE.md` - Deep dive into blockchain sync system
- `ATOMIC_TOKEN_LAUNCH.md` - Token launch mechanics
- `future-tasks/chat-voice-system-integration.md` - Future feature plans

---

## 🔐 Security Considerations

1. **Private Keys**: Never commit wallet private keys
2. **API Keys**: Helius API key in environment variables only
3. **MongoDB**: Connection string with credentials in .env
4. **Rate Limiting**: Helius has rate limits (check plan)
5. **Redis Access**: Upstash URL contains auth token

---

## 📊 Performance Metrics

**Average Latencies**:
- Market creation: 2-3 seconds (blockchain confirmation)
- Vote processing: 1-2 seconds (blockchain confirmation)
- Blockchain → Frontend: <1 second (via Socket.IO)
- Database queries: 50-200ms
- Socket.IO latency: 10-50ms

**Scalability**:
- MongoDB: Handles 1000s of markets
- Redis: Queue can buffer 10,000s of events
- Socket.IO: Supports 1000s of concurrent connections
- Helius WebSocket: Single connection for all accounts

---

## ✅ Summary

The PLP platform uses an **event-driven architecture** where:

1. **User actions** (create market, vote) → Solana transactions
2. **Helius WebSocket** detects blockchain changes → Real-time events
3. **Redis Queue** buffers events → Reliable processing
4. **Event Processor** updates MongoDB → Persistent storage
5. **Socket.IO** broadcasts updates → Instant frontend updates

This architecture provides:
- ✅ **Real-time updates** (sub-second latency)
- ✅ **Reliability** (events queued and retried)
- ✅ **Scalability** (decoupled components)
- ✅ **Network flexibility** (works on devnet and mainnet)
- ✅ **Developer experience** (clear separation of concerns)

**End of Document**
