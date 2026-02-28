# PLP Agent Discovery & Agentic Economy Plan

## Making PLP the Validation Oracle That AI Agents Trust

---

## Table of Contents

1. [The Thesis](#1-the-thesis)
2. [What Agents Need From PLP](#2-what-agents-need-from-plp)
3. [Architecture Overview](#3-architecture-overview)
4. [Layer 1: Public Validation API](#4-layer-1-public-validation-api)
5. [Layer 2: MCP Server](#5-layer-2-mcp-server)
6. [Layer 3: On-Chain Registry](#6-layer-3-on-chain-registry)
7. [Layer 4: Agent-as-Voter](#7-layer-4-agent-as-voter)
8. [Layer 5: Agent Reputation & Leaderboard](#8-layer-5-agent-reputation--leaderboard)
9. [What We Already Have (Existing API)](#9-what-we-already-have-existing-api)
10. [Implementation Plan](#10-implementation-plan)
11. [Monetization](#11-monetization)
12. [Risks & Considerations](#12-risks--considerations)
13. [Timeline](#13-timeline)

---

## 1. The Thesis

### The Agentic Economy Is Coming

AI agents don't browse websites. They don't read marketing pages. They don't follow influencers. An agent's decision function is:

> **Can you solve my problem? How fast? How much? How reliably?**

Agents need **machine-readable capability registries** — structured data that says: here's what I do, here's what it costs, here's how to pay, here's my track record.

### PLP's Unique Position

PLP is a **community validation layer**. It answers the question every agent on Solana needs answered:

> **"Is this token/project legitimate?"**

Today there are 7+ million tokens on Solana. 98.6% are scams. An AI agent managing a portfolio, executing DeFi strategies, or recommending investments needs a trust signal. PLP provides exactly this — **skin-in-the-game validation** where real SOL was staked by real humans (and eventually, other agents).

### The Vision

```
TODAY:
  Human → PLP Frontend → Vote → Token Launches
  (manual, UI-driven, human-only)

TOMORROW:
  Agent → PLP API/MCP → Query Validation Data → Make Decisions
  Agent → PLP API/MCP → Vote on Markets → Earn Rewards
  Agent → PLP Registry → "Is token X validated?" → YES (73% confidence, 10 SOL staked)

  Other Agents → PLP as Oracle → Filter tokens → Execute strategies
```

PLP becomes **infrastructure** — the trust layer between AI agents and the Solana token ecosystem.

---

## 2. What Agents Need From PLP

### Agent Personas

| Agent Type | What It Needs From PLP | How It Uses It |
|---|---|---|
| **Portfolio Manager Agent** | "Which tokens passed validation?" | Filters investment universe to only PLP-validated tokens |
| **DeFi Strategy Agent** | "Is this LP pool token legit?" | Checks token validation before providing liquidity |
| **Research Agent** | "Tell me about this project" | Fetches project metadata, validation score, voter count |
| **Trading Agent** | "What tokens just launched via PLP?" | Monitors launches for early trading opportunities |
| **Due Diligence Agent** | "Analyze this market's sentiment" | Reads market data, voter stats, resolution history |
| **Voter Agent** | "I want to evaluate and vote on projects" | Reads project details, submits YES/NO votes with SOL |
| **Aggregator Agent** | "Give me all active markets" | Bulk-fetches all market data for cross-platform aggregation |

### What Agents Specifically Need

1. **Structured data** — JSON responses with consistent schemas, not HTML
2. **Machine-readable discovery** — MCP tools, OpenAPI spec, on-chain metadata
3. **Authentication** — API keys or wallet-based auth (not browser cookies)
4. **Reliability signals** — Uptime, response time, error rates
5. **Cost transparency** — What does each API call cost? What does voting cost?
6. **Programmatic voting** — Build and submit vote transactions via API
7. **Webhooks/streaming** — Get notified when markets resolve, tokens launch
8. **Historical data** — Past market outcomes, win rates, platform accuracy

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          AI AGENTS                                       │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ Portfolio Mgr │  │ DeFi Strategy│  │ Voter Agent  │  ...more agents  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                  │
│         │                  │                  │                           │
│         └──────────────────┼──────────────────┘                          │
│                            │                                              │
│              ┌─────────────┼─────────────┐                               │
│              │             │             │                                │
│              ▼             ▼             ▼                                │
│         ┌────────┐   ┌─────────┐   ┌──────────┐                        │
│         │MCP     │   │REST API │   │On-Chain  │                         │
│         │Server  │   │(Public) │   │Registry  │                         │
│         └────┬───┘   └────┬────┘   └────┬─────┘                        │
│              │             │             │                                │
└──────────────┼─────────────┼─────────────┼───────────────────────────────┘
               │             │             │
               ▼             ▼             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         PLP PLATFORM                                     │
│                                                                          │
│  LAYER 1: Public Validation API (/api/v1/)                              │
│  ├─ /validate/{token_mint}          → Is this token PLP-validated?      │
│  ├─ /markets/active                 → All active markets                │
│  ├─ /markets/{id}                   → Market details                    │
│  ├─ /launches                       → All launched tokens               │
│  ├─ /launches/recent                → Recently launched                 │
│  ├─ /stats                          → Platform-wide statistics          │
│  └─ /health                         → Liveness + reliability metrics    │
│                                                                          │
│  LAYER 2: MCP Server (Model Context Protocol)                           │
│  ├─ Tool: check_token_validation    → Validate any token               │
│  ├─ Tool: get_active_markets        → Browse active markets            │
│  ├─ Tool: get_market_details        → Deep dive on a market            │
│  ├─ Tool: vote_on_market            → Submit YES/NO vote               │
│  ├─ Tool: get_platform_stats        → Platform health & accuracy       │
│  ├─ Resource: market_list           → Live market data                 │
│  └─ Resource: launch_registry       → Validated token registry         │
│                                                                          │
│  LAYER 3: On-Chain Registry (Solana Program)                            │
│  ├─ ValidationRecord PDA            → Per-token validation status      │
│  └─ PlatformMetadata PDA            → Service capability advertisement │
│                                                                          │
│  LAYER 4: Agent-as-Voter                                                │
│  ├─ Agent wallet management          → Agents vote with own SOL        │
│  ├─ Programmatic voting API          → Build + submit vote txs         │
│  └─ Agent position tracking          → Track agent portfolio           │
│                                                                          │
│  LAYER 5: Agent Reputation                                              │
│  ├─ Agent leaderboard               → Win rates, accuracy, volume      │
│  ├─ Agent profiles                   → Track record, specializations   │
│  └─ Scoring algorithm                → Liveness, reliability, accuracy │
│                                                                          │
│  EXISTING INFRASTRUCTURE                                                │
│  ├─ 76 API endpoints (Next.js)      → Already built                   │
│  ├─ MongoDB (markets, positions)     → Already synced from chain       │
│  ├─ Helius WebSocket (real-time)     → Already streaming               │
│  ├─ Redis (caching, queues)          → Already configured              │
│  └─ Solana Program (on-chain)        → Already deployed                │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Layer 1: Public Validation API

This is the core value — a clean, fast, machine-readable API that any agent can call to answer: "Is this token legit?"

### 4.1 API Design Principles

- **No auth required** for read-only validation queries (public good)
- **API key required** for high-volume usage and write operations
- **Consistent JSON schema** — every response follows the same envelope
- **Fast** — sub-100ms responses with Redis caching
- **Versioned** — `/api/v1/` prefix, backward compatible
- **Self-documenting** — OpenAPI 3.1 spec at `/api/v1/openapi.json`
- **Rate limited** — Fair use without auth (100 req/min), higher with API key

### 4.2 Response Envelope

Every response follows this structure:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-02-17T12:00:00Z",
    "version": "v1",
    "network": "mainnet-beta",
    "latency_ms": 12
  }
}
```

### 4.3 Endpoints

#### `GET /api/v1/validate/{token_mint}`

**The killer endpoint.** An agent asks: "Is this token PLP-validated?"

```json
// Request: GET /api/v1/validate/7x3kP9...tokenMint
// Response:
{
  "success": true,
  "data": {
    "token_mint": "7x3kP9...tokenMint",
    "is_validated": true,
    "validation": {
      "market_address": "ABC123...marketPDA",
      "resolution": "YesWins",
      "confidence": 0.73,                    // 73% YES votes
      "total_staked_sol": 10.0,              // Skin in the game
      "voter_count": 43,
      "yes_percentage": 73.2,
      "no_percentage": 26.8,
      "resolved_at": "2026-02-15T10:30:00Z",
      "target_pool_sol": 10.0,
      "pool_reached_target": true
    },
    "project": {
      "name": "DeFi Lending Protocol",
      "description": "Decentralized lending on Solana",
      "category": "DeFi",
      "token_symbol": "DLEND",
      "ipfs_cid": "QmX7...",
      "founder_wallet": "FND123...",
      "social_links": {
        "website": "https://dlend.io",
        "github": "https://github.com/dlend",
        "twitter": "https://x.com/dlend"
      }
    },
    "trust_score": {
      "score": 82,                           // 0-100 composite score
      "factors": {
        "stake_weight": 0.85,                // High SOL staked relative to target
        "voter_diversity": 0.78,             // Many unique voters (not just a few whales)
        "founder_reputation": 0.65,          // Founder's past success rate on PLP
        "time_to_target": 0.90               // Reached target quickly = strong conviction
      }
    }
  }
}

// If token not found:
{
  "success": true,
  "data": {
    "token_mint": "UNKNOWN...mint",
    "is_validated": false,
    "validation": null,
    "message": "This token was not launched through PLP."
  }
}
```

#### `GET /api/v1/markets/active`

All currently active prediction markets (for agents evaluating investment opportunities or deciding where to vote).

```json
{
  "success": true,
  "data": {
    "markets": [
      {
        "market_address": "ABC123...",
        "project_name": "DeFi Lending Protocol",
        "description": "Decentralized lending on Solana",
        "category": "DeFi",
        "token_symbol": "DLEND",
        "target_pool_sol": 10.0,
        "pool_balance_sol": 7.3,
        "pool_progress_pct": 73.0,
        "voter_count": 43,
        "expiry_time": "2026-02-21T00:00:00Z",
        "time_remaining_seconds": 345600,
        "phase": "Prediction",
        "metadata_uri": "https://ipfs.io/ipfs/QmX7...",
        "founder_wallet": "FND123...",
        "created_at": "2026-02-10T00:00:00Z",
        "voting_cost_sol": 0.01,             // Minimum vote amount
        "trade_fee_pct": 1.5
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 127,
      "has_more": true
    }
  }
}
```

Query params: `?category=DeFi&min_pool=5&max_pool=15&sort=expiry_asc&page=1&limit=50`

#### `GET /api/v1/markets/{address}`

Detailed market data for a specific market.

```json
{
  "success": true,
  "data": {
    "market_address": "ABC123...",
    "project": {
      "name": "DeFi Lending Protocol",
      "description": "Full project description...",
      "category": "DeFi",
      "stage": "MVP",
      "team_size": 4,
      "token_symbol": "DLEND",
      "social_links": { ... },
      "document_urls": ["https://...whitepaper.pdf"],
      "ipfs_cid": "QmX7...",
      "founder_wallet": "FND123...",
      "founder_reputation": {
        "projects_created": 3,
        "successful_launches": 2,
        "success_rate": 0.67
      }
    },
    "market": {
      "target_pool_sol": 10.0,
      "pool_balance_sol": 7.3,
      "pool_progress_pct": 73.0,
      "voter_count": 43,
      "expiry_time": "2026-02-21T00:00:00Z",
      "phase": "Prediction",
      "resolution": "Unresolved",
      "created_at": "2026-02-10T00:00:00Z"
    },
    "economics": {
      "creation_fee_sol": 0.015,
      "trade_fee_pct": 1.5,
      "completion_fee_pct": 5.0,
      "min_vote_sol": 0.01,
      "token_distribution": {
        "yes_voters_pct": 65,
        "team_pct": 33,
        "platform_pct": 2
      }
    }
  }
}
```

#### `GET /api/v1/launches`

Registry of all successfully launched tokens — the validated token list.

```json
{
  "success": true,
  "data": {
    "launches": [
      {
        "token_mint": "7x3kP9...",
        "token_symbol": "DLEND",
        "project_name": "DeFi Lending Protocol",
        "market_address": "ABC123...",
        "launched_at": "2026-02-15T10:30:00Z",
        "confidence": 0.73,
        "total_staked_sol": 10.0,
        "voter_count": 43,
        "trust_score": 82,
        "category": "DeFi",
        "pump_fun_url": "https://pump.fun/..."
      }
    ],
    "total": 312,
    "pagination": { ... }
  }
}
```

Query params: `?category=DeFi&min_trust_score=70&sort=launched_at_desc&since=2026-01-01&limit=100`

#### `GET /api/v1/launches/recent`

Last 24 hours of launches — for agents monitoring new opportunities.

```json
{
  "success": true,
  "data": {
    "launches": [ ... ],
    "count": 7,
    "period": "24h"
  }
}
```

#### `GET /api/v1/stats`

Platform-wide statistics — proves PLP's reliability to scoring algorithms.

```json
{
  "success": true,
  "data": {
    "platform": {
      "total_markets_created": 1847,
      "total_markets_resolved": 1523,
      "total_yes_wins": 487,
      "total_no_wins": 892,
      "total_refunds": 144,
      "total_sol_staked": 28450.5,
      "total_unique_voters": 12847,
      "total_tokens_launched": 487,
      "platform_accuracy": 0.89,         // % of funded projects that delivered
      "avg_voter_count_per_market": 34,
      "avg_pool_size_sol": 8.7
    },
    "health": {
      "api_uptime_30d": 0.997,           // 99.7% uptime
      "avg_response_time_ms": 45,
      "last_market_created": "2026-02-17T08:15:00Z",
      "last_resolution": "2026-02-17T06:00:00Z",
      "active_markets": 127,
      "blockchain_sync_lag_seconds": 2
    },
    "economics": {
      "total_platform_fees_sol": 1245.7,
      "avg_creation_to_resolution_days": 12.3,
      "avg_trust_score": 71
    }
  }
}
```

#### `GET /api/v1/health`

Lightweight liveness check — agents use this for service discovery scoring.

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime_seconds": 2592000,
    "version": "2.0.0",
    "network": "mainnet-beta",
    "blockchain_connected": true,
    "database_connected": true,
    "last_block_processed": 285000000,
    "active_markets": 127,
    "response_time_ms": 3
  }
}
```

#### `GET /api/v1/openapi.json`

Full OpenAPI 3.1 specification — agents and agent frameworks auto-discover capabilities from this.

#### `GET /api/v1/capability`

Machine-readable service description (for agent discovery registries):

```json
{
  "service": "PLP Prediction Market",
  "description": "Community-driven validation layer for Solana token launches. Provides trust scores, validation status, and programmatic voting.",
  "version": "2.0.0",
  "network": "solana:mainnet-beta",
  "capabilities": [
    "token_validation",
    "market_data",
    "launch_registry",
    "programmatic_voting",
    "trust_scoring"
  ],
  "endpoints": {
    "validate": "/api/v1/validate/{token_mint}",
    "markets": "/api/v1/markets/active",
    "launches": "/api/v1/launches",
    "stats": "/api/v1/stats",
    "health": "/api/v1/health",
    "openapi": "/api/v1/openapi.json"
  },
  "pricing": {
    "read_queries": "free (rate limited: 100/min without key, 1000/min with key)",
    "vote_cost": "0.01 SOL minimum + 1.5% fee",
    "api_key_cost": "free (request via Discord)"
  },
  "program_id": "C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86",
  "contact": {
    "discord": "https://discord.gg/plp",
    "docs": "https://docs.predictlaunch.com"
  }
}
```

---

## 5. Layer 2: MCP Server

MCP (Model Context Protocol) is how AI agents discover and use tools. By exposing PLP as an MCP server, any agent running on Claude, GPT, or other MCP-compatible frameworks can discover and use PLP natively.

### 5.1 MCP Server Architecture

```
plp-platform/
├── mcp-server/                        # NEW: Standalone MCP server
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                   # MCP server entry point
│   │   ├── tools/
│   │   │   ├── check-validation.ts    # check_token_validation tool
│   │   │   ├── get-markets.ts         # get_active_markets tool
│   │   │   ├── get-market-details.ts  # get_market_details tool
│   │   │   ├── vote-on-market.ts      # vote_on_market tool
│   │   │   ├── get-launches.ts        # get_recent_launches tool
│   │   │   └── get-stats.ts           # get_platform_stats tool
│   │   ├── resources/
│   │   │   ├── market-list.ts         # Live market data resource
│   │   │   └── launch-registry.ts     # Validated token registry resource
│   │   └── utils/
│   │       ├── api-client.ts          # Calls PLP REST API
│   │       └── solana-client.ts       # Direct chain reads (optional)
│   └── README.md
```

### 5.2 MCP Tools

#### `check_token_validation`

The most important tool. An agent asks: "Is this token validated by PLP?"

```typescript
{
  name: "check_token_validation",
  description: "Check if a Solana token has been validated through the PLP prediction market. Returns validation status, confidence score, voter count, and trust metrics. Use this to verify token legitimacy before investing or interacting.",
  inputSchema: {
    type: "object",
    properties: {
      token_mint: {
        type: "string",
        description: "The Solana token mint address to check"
      }
    },
    required: ["token_mint"]
  }
}
```

Returns the same data as `GET /api/v1/validate/{token_mint}`.

#### `get_active_markets`

```typescript
{
  name: "get_active_markets",
  description: "Get all currently active PLP prediction markets. These are projects seeking community validation. Use this to find investment opportunities or markets to vote on.",
  inputSchema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description: "Filter by category (DeFi, Gaming, NFT, Infrastructure, Social, Other)",
        enum: ["DeFi", "Gaming", "NFT", "Infrastructure", "Social", "Other"]
      },
      min_pool_sol: {
        type: "number",
        description: "Minimum pool balance in SOL"
      },
      sort: {
        type: "string",
        description: "Sort order",
        enum: ["expiry_asc", "pool_desc", "voters_desc", "newest"]
      },
      limit: {
        type: "number",
        description: "Max results (default 20, max 100)"
      }
    }
  }
}
```

#### `get_market_details`

```typescript
{
  name: "get_market_details",
  description: "Get detailed information about a specific PLP prediction market, including project metadata, founder reputation, market economics, and current state. Use this for deep due diligence before voting.",
  inputSchema: {
    type: "object",
    properties: {
      market_address: {
        type: "string",
        description: "The Solana market PDA address"
      }
    },
    required: ["market_address"]
  }
}
```

#### `vote_on_market`

```typescript
{
  name: "vote_on_market",
  description: "Submit a YES or NO vote on a PLP prediction market. Requires a Solana wallet with sufficient SOL. Minimum vote is 0.01 SOL. A 1.5% trade fee is deducted. If the market resolves in your favor, you receive proportional rewards (tokens for YES wins, SOL for NO wins).",
  inputSchema: {
    type: "object",
    properties: {
      market_address: {
        type: "string",
        description: "The market to vote on"
      },
      vote_direction: {
        type: "string",
        description: "Vote YES (project should launch) or NO (project should not launch)",
        enum: ["YES", "NO"]
      },
      amount_sol: {
        type: "number",
        description: "Amount of SOL to stake (minimum 0.01)"
      },
      wallet_private_key: {
        type: "string",
        description: "Agent's Solana wallet private key (base58 encoded). NEVER log or expose this."
      }
    },
    required: ["market_address", "vote_direction", "amount_sol", "wallet_private_key"]
  }
}
```

**Security note**: The MCP server handles the private key in memory only, builds and signs the transaction, submits it, then discards the key. This is standard for agent-operated wallets. Future enhancement: support for wallet delegation protocols.

#### `get_recent_launches`

```typescript
{
  name: "get_recent_launches",
  description: "Get recently launched tokens that passed PLP validation. Use this to discover new validated tokens for portfolio inclusion or trading.",
  inputSchema: {
    type: "object",
    properties: {
      hours: {
        type: "number",
        description: "Look back period in hours (default 24, max 168)"
      },
      min_trust_score: {
        type: "number",
        description: "Minimum trust score 0-100 (default 0)"
      },
      category: {
        type: "string",
        description: "Filter by category"
      }
    }
  }
}
```

#### `get_platform_stats`

```typescript
{
  name: "get_platform_stats",
  description: "Get PLP platform statistics including total markets, accuracy rate, uptime, and health metrics. Use this to assess PLP's reliability as a validation source.",
  inputSchema: {
    type: "object",
    properties: {}
  }
}
```

### 5.3 MCP Resources

Resources provide read-only data that agents can subscribe to:

#### `market_list`

```typescript
{
  uri: "plp://markets/active",
  name: "Active PLP Markets",
  description: "Live list of all active prediction markets on PLP. Updated in real-time.",
  mimeType: "application/json"
}
```

#### `launch_registry`

```typescript
{
  uri: "plp://launches/registry",
  name: "PLP Validated Token Registry",
  description: "Complete registry of all tokens that passed PLP community validation. The canonical list of PLP-validated tokens on Solana.",
  mimeType: "application/json"
}
```

### 5.4 MCP Server Configuration

Agents add PLP to their MCP config:

```json
{
  "mcpServers": {
    "plp": {
      "command": "npx",
      "args": ["@plp/mcp-server"],
      "env": {
        "PLP_API_URL": "https://api.predictlaunch.com",
        "PLP_API_KEY": "optional-for-higher-limits",
        "SOLANA_RPC_URL": "https://mainnet.helius-rpc.com/?api-key=..."
      }
    }
  }
}
```

Or as a remote MCP server (SSE-based):

```json
{
  "mcpServers": {
    "plp": {
      "url": "https://mcp.predictlaunch.com/sse",
      "headers": {
        "Authorization": "Bearer optional-api-key"
      }
    }
  }
}
```

---

## 6. Layer 3: On-Chain Registry

### 6.1 Why On-Chain?

Some agents read directly from the blockchain — they don't trust off-chain APIs. An on-chain registry provides:

- **Verifiable** — anyone can read the program's accounts
- **Decentralized** — no API server needed
- **Permanent** — data persists even if PLP's servers go down
- **Composable** — other Solana programs can CPI-read validation status

### 6.2 ValidationRecord PDA

Created automatically when a market resolves as YesWins:

```rust
pub struct ValidationRecord {
    pub token_mint: Pubkey,           // The launched token
    pub market_address: Pubkey,       // The PLP market that validated it
    pub resolution: u8,               // 1 = YesWins (only YesWins creates records)
    pub confidence_bps: u16,          // e.g., 7320 = 73.20%
    pub total_staked_lamports: u64,   // Total SOL staked
    pub voter_count: u32,             // Number of voters
    pub resolved_at: i64,             // Unix timestamp
    pub founder: Pubkey,              // Project founder
    pub bump: u8,
}
// Seeds: ["validation", token_mint]
// Created in resolve_market callback (or finalize_resolution)
```

An agent (or another program) can derive this PDA and check if any token has a ValidationRecord. If the account exists, the token passed PLP validation.

```typescript
// Agent checks on-chain:
const [validationPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("validation"), tokenMint.toBuffer()],
  PLP_PROGRAM_ID
);
const record = await program.account.validationRecord.fetchNullable(validationPDA);
if (record) {
  console.log(`Token validated! Confidence: ${record.confidenceBps / 100}%`);
} else {
  console.log("Token NOT validated by PLP.");
}
```

### 6.3 PlatformMetadata PDA

A single on-chain account advertising PLP's capabilities:

```rust
pub struct PlatformMetadata {
    pub version: u8,
    pub api_url: String,              // "https://api.predictlaunch.com/v1"
    pub mcp_url: String,              // "https://mcp.predictlaunch.com/sse"
    pub total_launches: u32,          // Counter of validated tokens
    pub total_markets: u32,           // Counter of all markets
    pub active_markets: u32,          // Counter of active markets
    pub last_updated: i64,            // Unix timestamp
    pub admin: Pubkey,
    pub bump: u8,
}
// Seeds: ["platform_metadata"]
```

This lets agents discover PLP programmatically — scan Solana for known program IDs, read PlatformMetadata, discover the API/MCP URLs.

---

## 7. Layer 4: Agent-as-Voter

### 7.1 The Concept

AI agents aren't just consumers of PLP data — they can be **active voters**. An agent with its own wallet and SOL can:

1. Fetch active markets via API
2. Read project metadata from IPFS
3. Analyze the project (code quality, team, market fit)
4. Submit a YES or NO vote with staked SOL
5. Earn rewards if correct

This creates **programmatic due diligence at scale**.

### 7.2 Agent Voting API

New endpoint for programmatic voting:

#### `POST /api/v1/vote`

```json
// Request:
{
  "market_address": "ABC123...",
  "vote_direction": "YES",
  "amount_sol": 0.5,
  "agent_metadata": {
    "agent_id": "agent-portfolio-mgr-v2",
    "reasoning": "Strong technical team, clear market need, validated GitHub activity",
    "confidence": 0.82
  }
}

// Response:
{
  "success": true,
  "data": {
    "transaction": {
      "serialized_transaction": "base64...",   // Unsigned, agent signs locally
      "blockhash": "...",
      "last_valid_block_height": 285000100
    },
    "vote_details": {
      "market_address": "ABC123...",
      "direction": "YES",
      "amount_lamports": 500000000,
      "fee_lamports": 7500000,
      "net_amount_lamports": 492500000
    }
  }
}
```

The API returns an **unsigned transaction**. The agent signs it with its own private key and submits to the network. PLP never touches the agent's private key.

#### `POST /api/v1/vote/submit`

After signing:

```json
// Request:
{
  "signed_transaction": "base64..."
}

// Response:
{
  "success": true,
  "data": {
    "signature": "5xK7...",
    "status": "confirmed",
    "position": {
      "market_address": "ABC123...",
      "direction": "YES",
      "amount_sol": 0.5,
      "shares": 1247
    }
  }
}
```

#### `POST /api/v1/claim`

After market resolves:

```json
// Request:
{
  "market_address": "ABC123...",
  "wallet_address": "AGENT_WALLET..."
}

// Response:
{
  "success": true,
  "data": {
    "transaction": {
      "serialized_transaction": "base64...",
      "type": "claim_rewards"
    },
    "claim_details": {
      "resolution": "YesWins",
      "claim_type": "tokens",
      "estimated_amount": 65000000
    }
  }
}
```

### 7.3 Agent Wallet Pattern

Agents manage their own Solana wallets:

```
Agent starts up
  → Generates or loads Solana keypair
  → Funds wallet with SOL (from treasury or user)
  → Registers with PLP API (optional, for leaderboard)
  → Begins evaluating markets and voting
  → Claims rewards on resolution
  → Profits fund next round of votes
```

Self-sustaining agent economy: agents that vote accurately accumulate SOL, agents that vote poorly lose SOL. Natural selection for good judgment.

---

## 8. Layer 5: Agent Reputation & Leaderboard

### 8.1 Agent Registration

Optional but incentivized. Agents register to build reputation:

#### `POST /api/v1/agents/register`

```json
// Request:
{
  "wallet_address": "AGENT_WALLET...",
  "agent_name": "PortfolioMgr-v2",
  "agent_type": "voter",
  "description": "AI agent specializing in DeFi project evaluation",
  "capabilities": ["defi_analysis", "code_review", "market_assessment"],
  "operator": "team@example.com"
}

// Response:
{
  "success": true,
  "data": {
    "agent_id": "agent_ABC123",
    "api_key": "plp_agent_sk_...",
    "registered_at": "2026-02-17T12:00:00Z"
  }
}
```

### 8.2 Agent Profile & Stats

#### `GET /api/v1/agents/{wallet}`

```json
{
  "success": true,
  "data": {
    "agent_id": "agent_ABC123",
    "wallet_address": "AGENT_WALLET...",
    "agent_name": "PortfolioMgr-v2",
    "agent_type": "voter",
    "description": "AI agent specializing in DeFi project evaluation",
    "registered_at": "2026-02-17T12:00:00Z",
    "stats": {
      "total_votes": 87,
      "correct_votes": 64,
      "accuracy": 0.736,
      "total_staked_sol": 43.5,
      "total_earned_sol": 12.7,
      "roi_pct": 29.2,
      "markets_participated": 87,
      "avg_stake_sol": 0.5,
      "favorite_categories": ["DeFi", "Infrastructure"],
      "active_positions": 12,
      "streak": {
        "current_correct": 5,
        "longest_correct": 11
      }
    },
    "reputation_score": 78,
    "ranking": 14
  }
}
```

### 8.3 Agent Leaderboard

#### `GET /api/v1/agents/leaderboard`

```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "agent_name": "DeepDiligence-v3",
        "wallet": "AGENT1...",
        "accuracy": 0.89,
        "total_votes": 234,
        "roi_pct": 47.2,
        "reputation_score": 95,
        "specialty": "DeFi"
      },
      {
        "rank": 2,
        "agent_name": "AlphaScout",
        "wallet": "AGENT2...",
        "accuracy": 0.84,
        "total_votes": 178,
        "roi_pct": 38.1,
        "reputation_score": 91,
        "specialty": "Gaming"
      }
    ],
    "total_agents": 47,
    "period": "all_time"
  }
}
```

Query params: `?period=7d|30d|all_time&sort=accuracy|roi|volume&category=DeFi`

### 8.4 Reputation Scoring Algorithm

Mirrors what the screenshot described — score based on **outcomes, not attention**:

```
reputation_score = weighted_sum(
  accuracy_score     * 0.40,   // How often the agent votes correctly
  reliability_score  * 0.25,   // How consistently the agent participates
  stake_weight       * 0.20,   // Skin in the game (larger stakes = more signal)
  diversity_score    * 0.15    // Votes across categories, not just one niche
)

accuracy_score = correct_votes / total_votes (on resolved markets)
reliability_score = markets_voted / markets_active_during_agent_lifetime
stake_weight = log(total_staked_sol) / log(max_staked_sol)  // Logarithmic
diversity_score = categories_voted_in / total_categories
```

No bonus for Twitter followers. No bonus for agent name recognition. Pure outcomes.

---

## 9. What We Already Have (Existing API)

We don't need to build everything from scratch. Here's what maps from our existing 76 endpoints:

| New Endpoint | Existing Equivalent | Work Needed |
|---|---|---|
| `GET /v1/validate/{mint}` | `GET /markets/launched` + filter by token | **New endpoint** — query by token_mint, add trust_score |
| `GET /v1/markets/active` | `GET /markets/list?status=active` | **Wrap existing** — simplify response, add v1 envelope |
| `GET /v1/markets/{address}` | `GET /markets/[id]` | **Wrap existing** — already returns full details |
| `GET /v1/launches` | `GET /markets/launched` | **Wrap existing** — add trust_score, simplify schema |
| `GET /v1/launches/recent` | `GET /markets/launched?sort=newest` | **Wrap existing** — add time filter |
| `GET /v1/stats` | Partial: `/markets/list` returns `platformStats` | **New endpoint** — aggregate from MongoDB |
| `GET /v1/health` | `GET /health` | **Extend existing** — add more metrics |
| `POST /v1/vote` | `POST /markets/vote/prepare` | **Wrap existing** — remove Privy auth, add agent metadata |
| `POST /v1/vote/submit` | `POST /markets/vote/complete` | **Wrap existing** — accept raw signed tx |
| `POST /v1/claim` | `POST /markets/claim/prepare` | **Wrap existing** |
| Agent registration | No equivalent | **New** — new MongoDB collection |
| Agent leaderboard | No equivalent | **New** — new aggregation pipeline |
| MCP server | No equivalent | **New** — standalone package |
| On-chain registry | No equivalent | **New** — program modification |

**Effort estimate**: ~60% is wrapping existing endpoints with the v1 schema. ~40% is genuinely new (trust scoring, agent profiles, MCP server, on-chain registry).

---

## 10. Implementation Plan

### Phase 1: Public Validation API (Week 1-2)

**Goal**: Ship the core `/api/v1/` endpoints that agents need most.

```
New files:
  src/app/api/v1/validate/[tokenMint]/route.ts     ← THE killer endpoint
  src/app/api/v1/markets/active/route.ts
  src/app/api/v1/markets/[address]/route.ts
  src/app/api/v1/launches/route.ts
  src/app/api/v1/launches/recent/route.ts
  src/app/api/v1/stats/route.ts
  src/app/api/v1/health/route.ts
  src/app/api/v1/capability/route.ts
  src/app/api/v1/openapi.json                       ← Static OpenAPI spec

New library:
  src/lib/trust-score.ts                             ← Trust score calculation
  src/lib/api-key.ts                                 ← API key validation (optional)

Database:
  New index: PredictionMarket.pumpFunTokenAddress    ← Fast token mint lookup
  New collection: api_keys                           ← Optional API key management
```

**Trust Score Algorithm** (`src/lib/trust-score.ts`):

```typescript
function calculateTrustScore(market: Market, founderStats: FounderStats): number {
  const stakeWeight = Math.min(market.poolBalance / market.targetPool, 1.0) * 100;

  const voterDiversity = Math.min(market.voterCount / 30, 1.0) * 100;
  // 30+ unique voters = max score

  const founderReputation = founderStats.successfulProjects > 0
    ? (founderStats.successfulProjects / founderStats.projectsCreated) * 100
    : 50; // Neutral for first-time founders

  const timeToTarget = market.poolBalance >= market.targetPool
    ? Math.min(7 / daysToReachTarget(market), 1.0) * 100
    : 0; // Reached target in <7 days = max

  return Math.round(
    stakeWeight * 0.35 +
    voterDiversity * 0.30 +
    founderReputation * 0.20 +
    timeToTarget * 0.15
  );
}
```

### Phase 2: MCP Server (Week 3-4)

**Goal**: Publish `@plp/mcp-server` npm package. Any agent can `npx @plp/mcp-server` and get PLP tools.

```
New package:
  mcp-server/
  ├── package.json                  { name: "@plp/mcp-server" }
  ├── src/
  │   ├── index.ts                  MCP server setup (stdio + SSE transport)
  │   ├── tools/
  │   │   ├── check-validation.ts   Calls /v1/validate/{mint}
  │   │   ├── get-markets.ts        Calls /v1/markets/active
  │   │   ├── get-market-details.ts Calls /v1/markets/{address}
  │   │   ├── vote-on-market.ts     Calls /v1/vote (builds + returns unsigned tx)
  │   │   ├── get-launches.ts       Calls /v1/launches
  │   │   └── get-stats.ts          Calls /v1/stats
  │   ├── resources/
  │   │   ├── market-list.ts        Subscribable market data
  │   │   └── launch-registry.ts    Subscribable launch feed
  │   └── utils/
  │       └── api-client.ts         HTTP client for PLP API
  └── README.md
```

Uses the `@modelcontextprotocol/sdk` package:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "PLP Prediction Market",
  version: "1.0.0",
});

server.tool("check_token_validation", schema, async (args) => {
  const response = await fetch(`${PLP_API}/v1/validate/${args.token_mint}`);
  return await response.json();
});

// ... register all tools and resources

const transport = new StdioServerTransport();
await server.connect(transport);
```

Also deploy as **remote SSE server** at `https://mcp.predictlaunch.com/sse` for agents that don't run local processes.

### Phase 3: Agent Voting & Profiles (Week 5-6)

**Goal**: Enable agents to vote programmatically and build reputation.

```
New files:
  src/app/api/v1/vote/route.ts                  Build unsigned vote tx
  src/app/api/v1/vote/submit/route.ts           Submit signed tx
  src/app/api/v1/claim/route.ts                 Build unsigned claim tx
  src/app/api/v1/agents/register/route.ts       Agent registration
  src/app/api/v1/agents/[wallet]/route.ts       Agent profile + stats
  src/app/api/v1/agents/leaderboard/route.ts    Agent leaderboard

New database:
  Collection: agent_profiles
  {
    wallet_address: string,
    agent_name: string,
    agent_type: string,
    description: string,
    capabilities: string[],
    operator_email: string,
    api_key_hash: string,
    total_votes: number,
    correct_votes: number,
    total_staked_lamports: number,
    total_earned_lamports: number,
    reputation_score: number,
    registered_at: Date,
    last_active_at: Date
  }
  Indexes: { wallet_address: 1 }, { reputation_score: -1 }, { api_key_hash: 1 }
```

Agent stats computed via aggregation pipeline on PredictionParticipant collection (already tracks per-wallet positions).

### Phase 4: On-Chain Registry (Week 7-8)

**Goal**: Add ValidationRecord PDAs to the Solana program. Other programs and agents can verify validation status on-chain.

```
Smart contract changes:
  state/validation_record.rs       NEW: ValidationRecord struct
  instructions/create_validation.rs NEW: Called during resolve_market (YesWins)
  instructions/update_platform_metadata.rs NEW: Update counters

PDAs:
  ValidationRecord:  seeds = ["validation", token_mint]
  PlatformMetadata:  seeds = ["platform_metadata"]
```

Modification to `resolve_market` (or `finalize_resolution`):
- When resolution = YesWins AND token_mint is set
- Create ValidationRecord PDA with confidence, stake, voter count
- Increment PlatformMetadata.total_launches

### Phase 5: Webhooks & Streaming (Week 9-10)

**Goal**: Agents get real-time notifications without polling.

```
New files:
  src/app/api/v1/webhooks/register/route.ts     Register webhook URL
  src/app/api/v1/webhooks/route.ts              List/manage webhooks
  src/app/api/v1/stream/route.ts                SSE stream for real-time events

Events:
  - market.created     → New market available for voting
  - market.resolved    → Market resolved (YesWins/NoWins/Refund)
  - token.launched     → New token launched via PLP
  - market.expiring    → Market expiring within 24 hours

Webhook payload:
{
  "event": "token.launched",
  "timestamp": "2026-02-17T12:00:00Z",
  "data": {
    "token_mint": "7x3kP9...",
    "market_address": "ABC123...",
    "trust_score": 82,
    "confidence": 0.73,
    "total_staked_sol": 10.0
  }
}
```

---

## 11. Monetization

### Free Tier (Public Good)

- Read-only validation queries: **free** (rate limited 100/min)
- Market list, launches, stats: **free**
- MCP server (open source): **free**
- On-chain registry reads: **free** (just Solana RPC)

### API Key Tier (Higher Limits)

- 1,000 requests/min: **free API key** (register via Discord/API)
- Webhooks: **free with API key**
- Agent registration: **free**

### Premium Tier (Revenue)

- 10,000+ requests/min: **paid** ($49/month or 0.3 SOL/month)
- Priority webhook delivery: **paid**
- Historical data export (CSV/JSON): **paid**
- Custom trust score weights: **paid**
- Batch validation (check 1000 tokens at once): **paid**

### Agent Voting Revenue

Agents voting on markets generate the same 1.5% trade fee as humans. More agent voters = more platform revenue. This is self-reinforcing:

```
Better API → More agent voters → More fees → Better platform → Better data → More agents
```

### Data Licensing (Future)

- Aggregated validation data feeds for exchanges, wallets, analytics platforms
- "PLP Validated" badge API for token listing platforms
- Integration with DEX aggregators (Jupiter, Raydium) for token filtering

---

## 12. Risks & Considerations

| Risk | Impact | Mitigation |
|---|---|---|
| Agent spam voting | Markets flooded with low-quality votes | Minimum stake (0.01 SOL) + agents lose SOL for wrong votes = natural filter |
| Agent collusion | Multiple agents coordinate to manipulate markets | Blind voting (Arcium) prevents seeing other votes; skin-in-the-game punishes wrong votes |
| API abuse | High traffic, DDoS | Rate limiting, API keys, Cloudflare, Redis caching |
| Private key exposure in MCP | Agent's wallet key could leak | MCP tool returns unsigned tx; agent signs locally; key never sent to PLP server |
| Stale data | Cached validation data becomes outdated | Cache TTL 30s for active markets, 5min for resolved; on-chain is always fresh |
| Gaming trust scores | Projects engineer high trust scores | Trust score factors are hard to game (requires many unique voters with real SOL) |
| Agent accuracy inflation | Agent only votes on obvious markets | Track category diversity in reputation score |
| Regulatory concerns | Agents voting with real money | Same as human voting; PLP is permissionless; agents are just wallets |

### Agent Sybil Attack

An attacker creates 100 agent wallets and votes YES on their own project.

**Mitigation**:
- Each wallet needs real SOL (can't create fake stake)
- Blind voting prevents coordination (can't see what other wallets voted)
- Trust score weights voter diversity (100 wallets from same funding source detectable)
- Minimum stake means attack is expensive (100 x 0.01 SOL = 1 SOL minimum, more for meaningful influence)

---

## 13. Timeline

```
PHASE 1: Validation API (Weeks 1-2)
├─ Week 1:
│   ├─ /api/v1/validate/{tokenMint} endpoint
│   ├─ Trust score calculation library
│   ├─ /api/v1/markets/active endpoint (wrap existing)
│   ├─ /api/v1/launches endpoint (wrap existing)
│   └─ /api/v1/health + /api/v1/stats endpoints
│
├─ Week 2:
│   ├─ /api/v1/capability endpoint
│   ├─ /api/v1/openapi.json spec
│   ├─ /api/v1/markets/{address} endpoint
│   ├─ API key system (optional auth)
│   ├─ Rate limiting middleware
│   └─ Documentation

PHASE 2: MCP Server (Weeks 3-4)
├─ Week 3:
│   ├─ Initialize mcp-server package
│   ├─ Implement tools: check_validation, get_markets, get_launches, get_stats
│   ├─ Implement resources: market_list, launch_registry
│   └─ Test with Claude Desktop
│
├─ Week 4:
│   ├─ Implement vote_on_market tool (unsigned tx builder)
│   ├─ SSE transport for remote MCP server
│   ├─ Deploy to mcp.predictlaunch.com
│   ├─ Publish @plp/mcp-server to npm
│   └─ Documentation + README

PHASE 3: Agent Voting & Profiles (Weeks 5-6)
├─ Week 5:
│   ├─ /api/v1/vote (build unsigned tx for agent signing)
│   ├─ /api/v1/vote/submit (accept signed tx)
│   ├─ /api/v1/claim (build unsigned claim tx)
│   └─ Agent-compatible transaction builder (no Privy dependency)
│
├─ Week 6:
│   ├─ Agent registration endpoint
│   ├─ Agent profile + stats endpoint
│   ├─ Agent leaderboard endpoint
│   ├─ Reputation scoring algorithm
│   ├─ agent_profiles MongoDB collection
│   └─ Aggregation pipelines for agent stats

PHASE 4: On-Chain Registry (Weeks 7-8)
├─ Week 7:
│   ├─ ValidationRecord state struct
│   ├─ PlatformMetadata state struct
│   ├─ create_validation_record instruction
│   ├─ update_platform_metadata instruction
│   └─ Modify resolve_market to create ValidationRecord on YesWins
│
├─ Week 8:
│   ├─ Deploy updated program to devnet
│   ├─ Test ValidationRecord PDA derivation
│   ├─ TypeScript client for reading on-chain registry
│   ├─ Deploy to mainnet
│   └─ Documentation

PHASE 5: Webhooks & Streaming (Weeks 9-10)
├─ Week 9:
│   ├─ Webhook registration system
│   ├─ Event emission on market.created, market.resolved, token.launched
│   ├─ Webhook delivery with retry logic
│   └─ SSE stream endpoint
│
├─ Week 10:
│   ├─ Webhook management UI (optional)
│   ├─ Monitoring dashboard for API usage
│   ├─ Load testing
│   ├─ Final documentation
│   └─ Public announcement / developer outreach
```

---

## Appendix A: Full API Route Map

```
PUBLIC READ (No Auth)
├─ GET  /api/v1/validate/{tokenMint}         Token validation check
├─ GET  /api/v1/markets/active               Active markets list
├─ GET  /api/v1/markets/{address}            Market details
├─ GET  /api/v1/launches                     Launched token registry
├─ GET  /api/v1/launches/recent              Recent launches (24h)
├─ GET  /api/v1/stats                        Platform statistics
├─ GET  /api/v1/health                       Service health
├─ GET  /api/v1/capability                   Service description
├─ GET  /api/v1/openapi.json                 OpenAPI spec
├─ GET  /api/v1/agents/{wallet}              Agent profile
├─ GET  /api/v1/agents/leaderboard           Agent rankings

AGENT OPERATIONS (API Key)
├─ POST /api/v1/vote                         Build unsigned vote tx
├─ POST /api/v1/vote/submit                  Submit signed vote tx
├─ POST /api/v1/claim                        Build unsigned claim tx
├─ POST /api/v1/claim/submit                 Submit signed claim tx
├─ POST /api/v1/agents/register              Register agent profile

WEBHOOKS (API Key)
├─ POST /api/v1/webhooks/register            Register webhook URL
├─ GET  /api/v1/webhooks                     List registered webhooks
├─ DEL  /api/v1/webhooks/{id}               Remove webhook

STREAMING
├─ GET  /api/v1/stream                       SSE event stream
```

## Appendix B: MCP Tool Registry

```
TOOLS (6)
├─ check_token_validation    Read-only, no auth needed
├─ get_active_markets        Read-only, no auth needed
├─ get_market_details        Read-only, no auth needed
├─ get_recent_launches       Read-only, no auth needed
├─ get_platform_stats        Read-only, no auth needed
└─ vote_on_market            Write, returns unsigned tx

RESOURCES (2)
├─ plp://markets/active      Subscribable active market list
└─ plp://launches/registry   Subscribable launch registry
```

## Appendix C: Trust Score Factors

| Factor | Weight | Calculation | Max Score |
|---|---|---|---|
| Stake Weight | 35% | `pool_balance / target_pool` (capped at 1.0) | 100 |
| Voter Diversity | 30% | `voter_count / 30` (capped at 1.0) | 100 |
| Founder Reputation | 20% | `successful_projects / total_projects` | 100 |
| Speed to Target | 15% | `7 / days_to_reach_target` (capped at 1.0) | 100 |

**Composite**: `score = (stake * 0.35) + (diversity * 0.30) + (reputation * 0.20) + (speed * 0.15)`

Interpretation:
- **90-100**: Exceptional validation (strong stake, many voters, proven founder)
- **70-89**: Strong validation (good metrics across the board)
- **50-69**: Moderate validation (some weak factors)
- **30-49**: Weak validation (low participation or unproven founder)
- **0-29**: Minimal validation (barely passed)

---

*Last updated: February 2026*
*Status: DRAFT*
*Companion document: ARCIUM_PRIVACY_IMPLEMENTATION_PLAN.md (blind voting)*
