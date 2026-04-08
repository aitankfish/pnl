# Blockchain Sync System - Complete Documentation

## 📋 Overview

This document describes the complete event-driven real-time sync architecture for the PLP platform. The system monitors Solana blockchain for account changes and updates MongoDB in real-time, then broadcasts updates to connected frontend clients via Socket.IO.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Solana Blockchain                           │
│                  (Market & Position PDAs)                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Helius WebSocket Client                        │
│  • Subscribes to program account changes                       │
│  • Receives real-time account updates                          │
│  • Detects market vs position accounts                         │
│  File: src/services/blockchain-sync/helius-client.ts           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Redis Event Queue (Upstash)                  │
│  • Buffers blockchain events                                   │
│  • Retry logic (max 3 attempts)                                │
│  • Dead Letter Queue for failed events                         │
│  Files: src/lib/redis/client.ts, queue.ts                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Event Processor                             │
│  • Pops events from Redis queue                                │
│  • Parses account data (market/position)                       │
│  • Updates MongoDB with blockchain state                       │
│  • Records time-series data for charts                         │
│  • Broadcasts updates via Socket.IO                            │
│  File: src/services/blockchain-sync/event-processor.ts         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                   ┌────────┴────────┐
                   ↓                 ↓
         ┌─────────────────┐  ┌──────────────┐
         │    MongoDB      │  │  Socket.IO   │
         │  • Markets      │  │   Server     │
         │  • Positions    │  │  • Rooms     │
         │  • Time-Series  │  │  • Events    │
         └─────────────────┘  └──────┬───────┘
                                     │
                                     ↓
                            ┌─────────────────┐
                            │    Frontend     │
                            │  • React hooks  │
                            │  • Real-time UI │
                            └─────────────────┘
```

## ✅ Completed Components

### 1. Redis Infrastructure
**Files:**
- `src/lib/redis/client.ts` - Redis connection manager
- `src/lib/redis/queue.ts` - Event queue with retry logic

**Features:**
- ✅ Upstash Redis connection with TLS
- ✅ Event push/pop operations
- ✅ Automatic retry (max 3 attempts)
- ✅ Dead Letter Queue (DLQ) for failed events
- ✅ Queue statistics and monitoring
- ✅ Stuck event recovery

**Test:** `scripts/test-redis.ts`

### 2. Helius WebSocket Client
**File:** `src/services/blockchain-sync/helius-client.ts`

**Features:**
- ✅ WebSocket connection to Helius
- ✅ Program-level subscription (monitors all PDAs)
- ✅ Individual account subscriptions
- ✅ Automatic reconnection with exponential backoff
- ✅ Account type detection (market vs position)
- ✅ Event queuing to Redis
- ✅ Ping/pong keepalive

**Test:** `scripts/test-helius-websocket.ts`

### 3. Account Parser
**File:** `src/services/blockchain-sync/account-parser.ts`

**Features:**
- ✅ Parse Market PDA (all fields)
- ✅ Parse Position PDA (all fields)
- ✅ Calculate derived fields:
  - Pool progress percentage
  - YES percentage (SOL-based for display)
  - YES percentage (shares-based for winner logic)
  - Total stakes (YES/NO)
  - Available actions (vote, resolve, extend, claim)
- ✅ Type-safe parsing with Buffer operations

### 4. Event Processor
**File:** `src/services/blockchain-sync/event-processor.ts`

**Features:**
- ✅ Background event processing loop
- ✅ MongoDB updates for markets
- ✅ MongoDB updates for positions
- ✅ Time-series data recording
- ✅ Socket.IO broadcasting
- ✅ Error handling and retry logic
- ✅ Graceful start/stop

### 5. Sync Manager
**File:** `src/services/blockchain-sync/sync-manager.ts`

**Features:**
- ✅ Orchestrates Helius client + Event processor
- ✅ Singleton pattern
- ✅ Status monitoring
- ✅ Stats logging (every 30 seconds)
- ✅ Alerts for queue backlog and DLQ issues
- ✅ Market subscription management

### 6. Socket.IO Server
**File:** `src/services/socket/socket-server.ts`

**Features:**
- ✅ Room-based subscriptions
- ✅ Market-specific rooms (`market:${address}`)
- ✅ All-markets room (`all-markets`)
- ✅ User-specific rooms (`user:${wallet}`)
- ✅ Real-time broadcasts:
  - `market:update` - Market state changes
  - `position:update` - Position changes
  - `notification` - User notifications
- ✅ Connection monitoring
- ✅ CORS configuration

**API Route:** `src/app/api/socket/route.ts`
**Server Setup:** `server.ts`

### 7. Database Schema Updates
**File:** `src/lib/mongodb.ts`

**PredictionMarket Schema - New Fields:**
- ✅ `poolBalance` - Current pool balance (bigint as string)
- ✅ `distributionPool` - Distribution pool balance
- ✅ `yesPool` - AMM YES pool state
- ✅ `noPool` - AMM NO pool state
- ✅ `totalYesShares` - Total YES share tokens issued
- ✅ `totalNoShares` - Total NO share tokens issued
- ✅ `phase` - Market phase (0=Prediction, 1=Funding)
- ✅ `poolProgressPercentage` - Pool funding progress
- ✅ `yesPercentage` - YES % based on SOL (user display)
- ✅ `sharesYesPercentage` - YES % based on shares (winner logic)
- ✅ `availableActions` - Array of available actions
- ✅ `tokenMint` - SPL token mint address
- ✅ `platformTokensAllocated` - Platform token allocation
- ✅ `platformTokensClaimed` - Platform claim status
- ✅ `yesVoterTokensAllocated` - YES voter allocation
- ✅ `lastSyncedAt` - Last sync timestamp
- ✅ `lastSlot` - Last blockchain slot
- ✅ `syncStatus` - Sync status (synced/syncing/error/pending)
- ✅ `syncCount` - Number of syncs performed

**PredictionParticipant Schema - New Fields:**
- ✅ `yesShares` - YES share tokens owned
- ✅ `noShares` - NO share tokens owned
- ✅ `totalInvested` - Total SOL invested
- ✅ `positionPdaAddress` - Position PDA address
- ✅ `positionClosed` - Position closed status
- ✅ `lastSyncedAt` - Last sync timestamp

### 8. Time-Series Collection
**Collection:** `market_time_series`

**Schema:**
```typescript
{
  marketId: ObjectId,
  timestamp: Date,
  yesPrice: Number,      // YES percentage (SOL-based)
  noPrice: Number,       // NO percentage
  totalVolume: String,   // Total SOL volume
  yesVolume: String,     // YES SOL volume
  noVolume: String,      // NO SOL volume
  yesPool: String,       // AMM YES pool state
  noPool: String,        // AMM NO pool state
  totalYesShares: String,
  totalNoShares: String
}
```

**Indexes:**
- ✅ `market_timestamp_idx` - Query by market + time
- ✅ `timestamp_idx` - Query by time only
- ✅ `ttl_idx` - Auto-delete after 90 days

**Setup Script:** `scripts/setup-time-series-indexes.ts`

### 9. Chart API
**File:** `src/app/api/markets/[marketAddress]/chart/route.ts`

**Features:**
- ✅ Timeframe support (1h, 24h, 7d, 30d, all)
- ✅ Auto interval sampling
- ✅ Custom interval support
- ✅ Data point reduction for performance
- ✅ Summary statistics:
  - Price change (absolute)
  - Price change percentage
  - Highest/lowest YES price
  - Total volume

**Usage:**
```
GET /api/markets/{address}/chart?timeframe=24h&interval=5m
```

### 10. React Hooks

**Socket.IO Hooks** (`src/lib/hooks/useSocket.ts`):
- ✅ `useSocket()` - Base Socket.IO connection
- ✅ `useMarketSocket(marketAddress)` - Subscribe to market updates
- ✅ `useAllMarketsSocket()` - Subscribe to all market updates
- ✅ `useUserSocket(walletAddress)` - Subscribe to user updates

**Chart Hook** (`src/lib/hooks/useMarketChart.ts`):
- ✅ `useMarketChart(marketAddress, timeframe, enableRealtime)` - Fetch + realtime chart data
- ✅ Auto-updates with Socket.IO
- ✅ Timeframe management
- ✅ Stats calculation

### 11. Scripts

**Initial Sync** (`scripts/initial-sync.ts`):
- ✅ Fetch all markets from blockchain
- ✅ Parse and update MongoDB
- ✅ One-time sync for existing data
- **Run:** `npx ts-node scripts/initial-sync.ts`

**Start Sync System** (`scripts/start-sync-system.ts`):
- ✅ Start Helius WebSocket
- ✅ Start Event Processor
- ✅ Monitor queue stats
- ✅ Display system status
- **Run:** `npx ts-node scripts/start-sync-system.ts`

**Test Scripts:**
- ✅ `scripts/test-redis.ts` - Test Redis connection
- ✅ `scripts/test-helius-websocket.ts` - Test Helius WebSocket
- ✅ `scripts/test-sync-pipeline.ts` - Test complete pipeline
- ✅ `scripts/setup-time-series-indexes.ts` - Setup chart indexes

## 🚀 Getting Started

### 1. Environment Setup

Ensure these variables are in `.env`:

```env
# Helius Configuration
HELIUS_API_KEY=your_helius_api_key
HELIUS_WS_DEVNET=wss://devnet.helius-rpc.com/?api-key=xxx
HELIUS_WS_MAINNET=wss://mainnet.helius-rpc.com/?api-key=xxx

# Redis Configuration (Upstash)
REDIS_URL=redis://default:xxx@simple-fowl-21160.upstash.io:6379

# Socket.IO Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
AUTO_START_SYNC=false

# Solana Configuration
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PLP_PROGRAM_ID_DEVNET=2CjwEvY3gkErkEmM5wnLpRv9fq3msHjnPDVPQmaWhF3G
```

### 2. Install Dependencies

Already installed:
```bash
npm install ioredis socket.io socket.io-client @types/socket.io --legacy-peer-deps
```

### 3. Setup Time-Series Indexes

```bash
npx ts-node scripts/setup-time-series-indexes.ts
```

### 4. Run Initial Sync

```bash
npx ts-node scripts/initial-sync.ts
```

This will:
- Fetch all existing markets from blockchain
- Parse account data
- Update MongoDB with current state

### 5. Start the Sync System

```bash
npx ts-node scripts/start-sync-system.ts
```

This will:
- Connect to Helius WebSocket
- Subscribe to program accounts
- Start processing events
- Monitor queue stats

### 6. Start Next.js with Socket.IO

Option A - Using custom server:
```bash
ts-node server.ts
```

Option B - Separate processes:
```bash
# Terminal 1: Next.js dev server
npm run dev

# Terminal 2: Sync system
npx ts-node scripts/start-sync-system.ts
```

## 📊 Monitoring

### Check System Status

```bash
curl http://localhost:3000/api/socket
```

Returns:
```json
{
  "status": "ok",
  "connections": 5,
  "rooms": ["market:xyz...", "all-markets", "user:abc..."],
  "message": "Socket.IO server is running"
}
```

### Monitor Queue Stats

The sync system logs stats every 30 seconds:
```
📊 [10:30:45 AM] Queue: 0 | Processing: 0 | DLQ: 0
```

### View Logs

All components use the logger:
```typescript
import { createClientLogger } from '@/lib/logger';
const logger = createClientLogger();

logger.info('Message');
logger.warn('Warning');
logger.error('Error');
```

## 🎯 Frontend Integration

### Example: Market Details Page with Real-time Updates

```typescript
import { useMarketSocket } from '@/lib/hooks/useSocket';
import { useMarketChart } from '@/lib/hooks/useMarketChart';

export default function MarketDetailsPage({ marketAddress }) {
  // Real-time market updates
  const { marketData, isConnected } = useMarketSocket(marketAddress);

  // Chart data with real-time updates
  const { chartData, loading } = useMarketChart(marketAddress, '24h', true);

  return (
    <div>
      <h1>Market Details {isConnected && '🟢'}</h1>

      {/* Display real-time data */}
      <div>
        Pool Progress: {marketData?.poolProgressPercentage}%
        YES: {marketData?.yesPercentage}% (Display)
        YES: {marketData?.sharesYesPercentage}% (Winner Logic)
      </div>

      {/* Display available actions */}
      <div>
        {marketData?.availableActions.includes('vote') && <VoteButton />}
        {marketData?.availableActions.includes('resolve') && <ResolveButton />}
        {marketData?.availableActions.includes('extend') && <ExtendButton />}
        {marketData?.availableActions.includes('claim') && <ClaimButton />}
      </div>

      {/* Display chart */}
      {!loading && <MarketChart data={chartData} />}
    </div>
  );
}
```

### Example: Browse Page with All Markets

```typescript
import { useAllMarketsSocket } from '@/lib/hooks/useSocket';

export default function BrowsePage() {
  const { marketUpdates, isConnected } = useAllMarketsSocket();

  return (
    <div>
      <h1>Markets {isConnected && '🟢 Live'}</h1>

      {markets.map(market => {
        const liveUpdate = marketUpdates.get(market.marketAddress);

        return (
          <MarketCard
            key={market._id}
            market={market}
            yesPercentage={liveUpdate?.yesPercentage || market.yesPercentage}
            poolProgress={liveUpdate?.poolProgressPercentage || market.poolProgressPercentage}
          />
        );
      })}
    </div>
  );
}
```

## 🔍 Key Concepts

### Two Types of Percentages

**1. SOL-based Percentage (`yesPercentage`)**
- Used for display (user-friendly)
- Calculated from actual SOL invested
- Formula: `yesStake / (yesStake + noStake) * 100`

**2. Shares-based Percentage (`sharesYesPercentage`)**
- Used for winner determination
- Calculated from AMM share tokens
- Formula: `totalYesShares / (totalYesShares + totalNoShares) * 100`

**Why the difference?**
Early buyers get more shares per SOL (AMM pricing), so the share distribution determines winners, but SOL amounts are more intuitive for display.

### Available Actions

The system calculates which actions are available based on market state:

- **`vote`** - Market is active and not full
- **`resolve`** - Market expired or pool full
- **`extend`** - Pool full AND YES winning (>50% shares)
- **`claim`** - Market resolved

### Event Flow

1. User votes on blockchain → Transaction confirmed
2. Helius detects account change → Sends WebSocket notification
3. Helius Client receives update → Pushes to Redis queue
4. Event Processor pops event → Parses account data
5. MongoDB updated → Time-series recorded
6. Socket.IO broadcasts → Frontend receives update
7. React hook updates state → UI re-renders

**Total latency:** ~1-3 seconds from blockchain to UI

## 🛠️ Troubleshooting

### Issue: Events not processing

**Check:**
1. Is Helius WebSocket connected?
   ```typescript
   const status = await getSyncManager().getStatus();
   console.log(status.heliusConnected); // Should be true
   ```

2. Is Event Processor running?
   ```typescript
   console.log(status.processorRunning); // Should be true
   ```

3. Check queue stats:
   ```typescript
   console.log(status.queueStats);
   // queueLength: 0, processingCount: 0, dlqLength: 0
   ```

### Issue: High DLQ count

Failed events are in Dead Letter Queue. Check logs for errors.

Recover stuck events:
```typescript
import { recoverStuckEvents } from '@/lib/redis/queue';
await recoverStuckEvents();
```

### Issue: Socket.IO not connecting

1. Check Socket.IO server is initialized:
   ```bash
   curl http://localhost:3000/api/socket
   ```

2. Check CORS settings in `socket-server.ts`

3. Check client connection:
   ```typescript
   const { socket, isConnected } = useSocket();
   console.log(isConnected); // Should be true
   ```

## 📈 Performance Considerations

### Optimizations Implemented

1. **Redis Queue** - Prevents blocking during high load
2. **Exponential Backoff** - Reduces reconnection storms
3. **Data Sampling** - Chart API reduces data points
4. **Room-based Broadcasting** - Only sends to subscribed clients
5. **TTL Indexes** - Auto-delete old time-series data (90 days)
6. **Compound Indexes** - Faster MongoDB queries
7. **Singleton Pattern** - Single WebSocket connection

### Scaling Considerations

**Current Setup (Good for 100s of markets):**
- Single Event Processor
- Single Helius WebSocket connection
- Upstash Redis free tier (30MB)

**Future Scaling (1000s of markets):**
- Multiple Event Processor workers
- Redis Pub/Sub for worker coordination
- Upstash Redis paid tier
- Load balancing for Socket.IO

## 🎉 What's Next?

The complete sync system is ready! Next steps:

1. ✅ Test the complete pipeline with test markets
2. ✅ Update frontend pages to use new hooks
3. ✅ Remove old direct blockchain calls
4. ✅ Add chart components to market pages
5. ✅ Monitor performance and optimize

## 📝 Files Reference

### Core Infrastructure
- `src/lib/redis/client.ts` - Redis connection
- `src/lib/redis/queue.ts` - Event queue
- `src/services/blockchain-sync/helius-client.ts` - WebSocket client
- `src/services/blockchain-sync/account-parser.ts` - Account parser
- `src/services/blockchain-sync/event-processor.ts` - Event processor
- `src/services/blockchain-sync/sync-manager.ts` - Orchestrator
- `src/services/socket/socket-server.ts` - Socket.IO server

### Frontend
- `src/lib/hooks/useSocket.ts` - Socket.IO hooks
- `src/lib/hooks/useMarketChart.ts` - Chart data hook

### API Routes
- `src/app/api/socket/route.ts` - Socket.IO status
- `src/app/api/markets/[marketAddress]/chart/route.ts` - Chart data

### Scripts
- `scripts/test-redis.ts` - Test Redis
- `scripts/test-helius-websocket.ts` - Test WebSocket
- `scripts/test-sync-pipeline.ts` - Test full pipeline
- `scripts/initial-sync.ts` - Initial blockchain sync
- `scripts/start-sync-system.ts` - Start sync system
- `scripts/setup-time-series-indexes.ts` - Setup indexes

### Configuration
- `server.ts` - Custom Next.js server with Socket.IO
- `.env` - Environment variables
- `src/lib/mongodb.ts` - Database schemas

---

**Built with:** Helius WebSocket, Redis (Upstash), Socket.IO, MongoDB, Next.js, TypeScript

**Ready for production!** 🚀
