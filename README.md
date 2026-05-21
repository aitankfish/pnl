# P&L - Predict & Launch

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-mainnet-9945FF.svg)](https://solscan.io/account/C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86)
[![Live](https://img.shields.io/badge/live-pnl.market-3f7a42.svg)](https://pnl.market)

**Tokenize ideas. Validate through community. Launch what deserves to exist.**

P&L is a new paradigm for fundraising on Solana. Not every token deserves to launch - let the crowd decide. Live on Solana mainnet — mint `6QuNZJzUF7oZj3GsG7fVBfidX1cE81sXhb9Czi12pump`.

## The Problem
The crypto space is flooded with tokens that never needed to exist. Meanwhile, talented builders worldwide lack access to traditional fundraising.

## The Solution
P&L turns token launches into prediction markets. The community stakes SOL to vote YES (launch) or NO (don't launch). Market dynamics determine which ideas deserve to become tokens.

- **YES wins** → Token launches on pump.fun. Voters receive airdrops. Founders earn ongoing trading fees.
- **NO wins** → NO voters share the pool. Bad ideas filtered out.

## Why It Matters
- **For Builders**: Raise funds from anywhere in the world through community validation. Earn creator fees from pump.fun trading.
- **For Voters**: Back ideas you believe in and earn rewards. Filter out noise by voting NO.
- **For Crypto**: Only community-validated tokens launch. Better signal, less noise.

*The launchpad where community conviction decides which tokens deserve to exist.*

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory with the following variables:

```env
# Privy Configuration
# Get your App ID from https://dashboard.privy.io/
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id

# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
MONGODB_DEV_DATABASE=plp-platform
MONGODB_PROD_DATABASE=plp_platform_prod

# Solana Network Configuration
NEXT_PUBLIC_SOLANA_NETWORK=devnet

# PLP Program IDs
NEXT_PUBLIC_PLP_PROGRAM_ID_DEVNET=your_devnet_program_id
NEXT_PUBLIC_PLP_PROGRAM_ID_MAINNET=your_mainnet_program_id

# Helius RPC Configuration (Required for WebSocket support)
HELIUS_API_KEY=your_helius_api_key
NEXT_PUBLIC_HELIUS_MAINNET_RPC=https://mainnet.helius-rpc.com/?api-key=your_api_key
NEXT_PUBLIC_HELIUS_DEVNET_RPC=https://devnet.helius-rpc.com/?api-key=your_api_key
NEXT_PUBLIC_HELIUS_WS_DEVNET=wss://devnet.helius-rpc.com/?api-key=your_api_key
NEXT_PUBLIC_HELIUS_WS_MAINNET=wss://mainnet.helius-rpc.com/?api-key=your_api_key

# Redis Configuration (Upstash)
REDIS_URL=redis://default:password@your-redis.upstash.io:6379

# Socket.IO Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_PORT=3000
SOCKET_PORT=3000
AUTO_START_SYNC=false

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Development Settings
NODE_ENV=development

# IPFS Storage (Pinata) - Client-side accessible
NEXT_PUBLIC_PINATA_API_KEY=your_pinata_api_key
NEXT_PUBLIC_PINATA_SECRET_KEY=your_pinata_secret_key
NEXT_PUBLIC_PINATA_GATEWAY_URL=https://your-gateway.mypinata.cloud
NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt

# Server-side IPFS (used by API routes)
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key
PINATA_JWT=your_pinata_jwt
PINATA_GATEWAY_URL=your-gateway.mypinata.cloud

# Jupiter Swap (Optional - for token swapping)
NEXT_PUBLIC_JUPITER_API_KEY=your_jupiter_api_key

# Grok AI (Optional - for project roasting feature)
GROK_API_KEY=your_grok_api_key

# Printify Merch Store (Optional - for merch shop)
# Get your API token from: https://printify.com/app/account/api
PRINTIFY_API_TOKEN=your_printify_api_token
PRINTIFY_SHOP_ID=your_printify_shop_id
```

### 3. Run Development Server
```bash
npm run dev:unified
```

This will start:
- Next.js development server on port 3000
- Socket.IO server for real-time updates
- Blockchain sync manager for monitoring on-chain events

Open [http://localhost:3000](http://localhost:3000) to view the application.

## 📱 Features

- **Mobile-First Design**: Optimized for mobile devices with responsive design
- **Dark Theme**: Modern, professional appearance with glassmorphic UI
- **Privy Wallet Integration**: Seamless embedded wallet or external wallet connection
- **Project Creation**: Comprehensive form with IPFS document and image storage
- **Prediction Markets**: Community validation through on-chain prediction markets
- **Real-Time Updates**: WebSocket integration for live market data synchronization
- **Document Viewing**: IPFS-based project documentation with prominent display
- **User Profiles**: Track investments, favorites, and project portfolios
- **Social Features**: Share markets, favorite projects, follow users, and engage with the community
- **Notifications System**: Real-time notifications for market events, voting results, and rewards
- **Global Search**: Search for users and markets across the platform
- **Wallet Management**: View SOL balance, transaction history, and manage your portfolio
- **Tabbed Portfolio**: Switch between Predictions, Projects, and Watchlist with filtered tabs
- **Creator Fees**: Claim pump.fun trading fees from launched tokens directly in-app
- **First-time Onboarding**: Zero-balance users see guided options to buy with card or deposit crypto
- **Jupiter Swap**: In-app token swapping powered by Jupiter aggregator
- **Claim Rewards**: Claim SOL rewards for NO voters or token airdrops for YES voters
- **My Projects**: Project creators can view and manage their launched markets
- **Grok Roast**: AI-powered project roasting for entertainment
- **Multiple Categories**: Support for DeFi, NFT, Gaming, DAO, AI/ML, Meme, Creator, and more
- **Merch Shop**: Integrated print-on-demand merchandise store powered by Printify, pay with SOL

## 🏗️ Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Blockchain**: Solana (Anchor Framework), Helius RPC & WebSocket
- **Database**: MongoDB Cloud (network-aware devnet/mainnet switching)
- **Storage**: IPFS via Pinata (metadata, images, documents)
- **Authentication**: Privy (embedded + external wallets)
- **Real-Time**: Socket.IO for live blockchain event streaming
- **Caching**: Redis (Upstash) for performance optimization

## 🤖 For AI Agents & Integrators

PNL is designed to be readable by AI clients and integratable by Solana agents. Three surfaces exist depending on what you're building:

### 1. Read PNL (LLMs, search engines, indexers)

- **`https://pnl.market/llms.txt`** — protocol summary in [llmstxt.org](https://llmstxt.org) format. Lists every public route, mechanic, market state, and the JSON shape of the markets API.
- **`https://pnl.market/sitemap.xml`** — full crawl index including every market URL.
- **`https://pnl.market/robots.txt`** — explicit allow-list for GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, Applebot-Extended, CCBot, cohere-ai, meta-externalagent, Bytespider, and others.

### 2. Query live state (public REST, no auth)

```bash
# All active markets
curl https://pnl.market/api/markets/list?status=active&page=1&limit=25

# All markets (any state)
curl https://pnl.market/api/markets/list?status=all

# Single market by id
curl https://pnl.market/api/markets/<id>
```

Valid `status` values: `active`, `yesWins` (bloomed), `noWins` (withered), `expired` (closed), `refund` (returned), `all`. Response shape is documented in `llms.txt`.

### 3. Participate on-chain (Solana agents)

The on-chain program is permissionless — any Solana keypair with SOL can call it. There is no Privy session requirement and no allow-list.

- **Program ID (mainnet):** `C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86`
- **Source:** `apps/web/plp_program/programs/errors/src/instructions/` (Rust, Anchor 0.30.1)
- **Reference TypeScript client:** `packages/shared/src/solana/anchor-program.ts` — shows how to build `create_market`, `buy_yes`, `buy_no` instructions with raw `@solana/web3.js` and correctly-computed Anchor discriminators (`sha256('global:<instruction>')[:8]`)

Permissionless actions an agent can perform directly on the program:

| Instruction | Signer | Cost | Notes |
|---|---|---|---|
| `create_market` | any keypair | 0.015 SOL fee | Creates a market with an IPFS metadata URI |
| `buy_yes` / `buy_no` | any keypair | min 0.01 SOL stake | Vote with conviction |
| `expire` | any keypair | rent only | Crank any market past its expiry timestamp |
| `resolve_market` | any keypair | rent only | Permissionless resolution after expiry; triggers pump.fun launch CPI on YES win |
| `claim_yes` / `claim_no` | position holder | rent only | Claim airdrops (YES) or SOL (NO) after resolution |

Privileged (admin-only): `set_admin`, `withdraw_fees`, `init_treasury`, `emergency_drain_vault`.

> ⚠ **Note on IDL:** the file at `apps/web/src/lib/idl/errors.json` is a stub with non-canonical discriminators. Do not feed it to `anchor.Program.fetchIdl()`. Either read the Rust source directly or copy the instruction-building pattern from `anchor-program.ts`. A proper Anchor-generated IDL is on the post-hackathon roadmap.

## 🔒 Security

- **License:** MIT (open-source, no patent grants — see `LICENSE`)
- **Dependency policy:** `pnpm overrides` pins `axios ^1.15.2` and `sanitize-html ^2.17.4` to patch transitive CVEs from the `@privy-io → wagmi → @coinbase/cdp-sdk` chain. Run `pnpm install` after pulling.
- **`/api/health`:** public response is minimal (`{status, timestamp, service, version}`). Full diagnostic payload (DB name, env-var presence map, sync state, queue depths) is gated behind an `x-health-secret` header matching the `HEALTHCHECK_SECRET` env var. Render.com health probes only need HTTP 200.
- **`robots.txt` / `llms.txt`:** disallow `/api/*` and `/admin/*` for every agent except the explicit allow for `/api/og` (social cards) and `/api/markets/list` (the public read API). Security still depends on auth/ACL; these files are hygiene, not enforcement.
- **Reporting vulnerabilities:** open a GitHub issue or DM [@pnldotmarket](https://x.com/pnldotmarket).

## 📋 Development Rules

- **Mobile-First**: Always design for mobile, then enhance for desktop
- **Dark Theme**: Use dark theme by default
- **Logging**: Use Winston logger, never console.log in production
- **Environment**: Support both Mainnet and Devnet with environment switching
- **Validation**: Client and server-side validation required
- **Security**: Never give SOL directly to founders, use secure escrow

## 🎯 Economic Model

### Market Creation & Trading
- **Market Creation Fee**: 0.015 SOL (paid to platform treasury)
- **Target Pool Options**: 5 SOL, 10 SOL, or 15 SOL per market
- **Minimum Investment**: 0.01 SOL per trade
- **Trade Fee**: 1.5% on every YES/NO purchase (paid to platform treasury)
- **Pricing Mechanism**: Constant Product AMM (x * y = k) - prices always sum to 1.0

### Market Resolution & Fees
- **Completion Fee**: 5% of pool when market resolves YES or NO (paid to platform treasury)
- **Refund Scenario**: 0% fee if market fails to reach target or ends in tie

### Token Distribution (YES Wins)
When a market resolves with YES winning, tokens purchased on pump.fun are distributed:
- **YES Voters**: 65% (proportional to shares held, claimable immediately)
- **Project Team**: 33% total
  - 8% immediate claim
  - 25% vested linearly over 12 months
- **Platform**: 2% (immediate claim to P&L wallet)

### Rewards
- **YES Wins**: Proportional token airdrop based on YES shares held
- **NO Wins**: Proportional SOL distribution from 95% of pool (after 5% completion fee)
- **Refund**: Full invested amount returned (no fees deducted)

## ⛓️ Smart Contract (Solana Program)

### Program Overview

The PLP Prediction Market program is built with Anchor Framework and deployed on Solana.

**Program IDs:**
| Network | Program ID |
|---------|------------|
| **Mainnet** | `C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86` |
| **Devnet** | `Fd2kY3Bu3JzP2wXRKGMYQYr782HXthJby71xH9Xp6L3X` |

### Instructions

| Instruction | Description | Access |
|-------------|-------------|--------|
| `init_treasury` | Initialize global treasury PDA | Deployer only (one-time) |
| `set_admin` | Change treasury admin (DAO/multisig) | Current admin |
| `withdraw_fees` | Withdraw platform fees | Admin |
| `create_market` | Create new prediction market | Anyone |
| `buy_yes` | Buy YES shares with SOL | Anyone |
| `buy_no` | Buy NO shares with SOL | Anyone |
| `extend_market` | Extend market for additional funding | Founder only |
| `resolve_market` | Resolve market after expiry | Platform authority |
| `claim_rewards` | Claim rewards (tokens/SOL/refund) | Position holders |
| `init_team_vesting` | Initialize team token vesting | After YES wins |
| `claim_team_tokens` | Claim vested team tokens | Team |
| `init_founder_vesting` | Initialize founder SOL vesting | After YES wins (pool > 50 SOL) |
| `claim_founder_sol` | Claim vested founder SOL | Founder |
| `claim_platform_tokens` | Claim platform's 2% tokens | Anyone |
| `close_position` | Close position, recover rent | Position holder |
| `close_market` | Close market, recover rent | Founder (after claim period) |
| `emergency_drain_vault` | Emergency vault drain | Admin only |

### Constants & Rules

```rust
// Fees
CREATION_FEE:        0.015 SOL    // Per market creation
TRADE_FEE:           1.5%         // On every YES/NO purchase
COMPLETION_FEE:      5%           // When market resolves YES or NO

// Trading
MIN_INVESTMENT:      0.01 SOL     // Minimum per trade
TARGET_POOLS:        5/10/15 SOL  // Allowed target pool sizes
MAX_POOL_FOR_LAUNCH: 50 SOL       // Beyond this, excess goes to founder

// Market Duration
MIN_DURATION:        1 day
MAX_DURATION:        1 year

// Token Distribution (YES Wins)
YES_VOTERS:          65%          // Proportional to shares, immediate
TEAM_TOTAL:          33%          // 8% immediate + 25% vested (12 months)
PLATFORM:            2%           // Immediate

// Founder SOL Vesting (when pool > 50 SOL)
IMMEDIATE:           8%
VESTED:              92%          // Linear over 12 months
```

### Market Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                         MARKET LIFECYCLE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. CREATE MARKET                                                    │
│     └─> Founder pays 0.015 SOL creation fee                         │
│     └─> Market enters PREDICTION phase                              │
│                                                                      │
│  2. TRADING (Prediction Phase)                                       │
│     └─> Users buy YES or NO shares (1.5% fee per trade)             │
│     └─> One position per wallet (can't hold both YES and NO)        │
│     └─> Constant Product AMM: prices always sum to 1.0              │
│                                                                      │
│  3. TARGET REACHED                                                   │
│     └─> If YES winning: Founder can EXTEND to Funding phase         │
│     └─> If NO winning: Wait for expiry                              │
│                                                                      │
│  4. FUNDING PHASE (Optional)                                         │
│     └─> Only YES votes allowed (NO locked)                          │
│     └─> Pool can exceed target_pool                                 │
│                                                                      │
│  5. EXPIRY                                                           │
│     └─> No more trading allowed                                     │
│     └─> Platform authority calls resolve_market                      │
│                                                                      │
│  6. RESOLUTION                                                       │
│     ├─> YES_WINS (total_yes_shares > total_no_shares)               │
│     │   └─> 5% completion fee taken                                 │
│     │   └─> Token created via Pump.fun                              │
│     │   └─> 65% to YES voters, 33% to team, 2% to platform          │
│     │                                                                │
│     ├─> NO_WINS (total_no_shares > total_yes_shares)                │
│     │   └─> 5% completion fee taken                                 │
│     │   └─> 95% of pool distributed to NO voters proportionally     │
│     │                                                                │
│     └─> REFUND (tie or insufficient activity)                       │
│         └─> No fees taken                                           │
│         └─> Full refund to all participants                         │
│                                                                      │
│  7. CLAIM REWARDS                                                    │
│     └─> Users call claim_rewards                                    │
│     └─> Position PDA closed, rent returned                          │
│                                                                      │
│  8. CLEANUP (30+ days after expiry)                                  │
│     └─> Founder can close_market to recover rent                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Error Codes

| Code | Message |
|------|---------|
| `MarketExpired` | Market has already expired |
| `MarketNotExpired` | Market is not yet expired |
| `AlreadyResolved` | Market has already been resolved |
| `AlreadyHasPosition` | User already has position on opposite side |
| `InvestmentTooSmall` | Below minimum 0.01 SOL |
| `CapReached` | Target pool has been filled |
| `AlreadyClaimed` | Reward has already been claimed |
| `Unauthorized` | Only platform authority can perform this |
| `InvalidTargetPool` | Must be 5, 10, or 15 SOL |
| `YesNotWinning` | YES must be winning to extend market |
| `TargetNotReached` | Cannot extend before target reached |
| `ClaimPeriodNotOver` | Cannot close market yet (30 days) |
| `PoolNotEmpty` | Cannot close market with unclaimed funds |

### PDAs (Program Derived Addresses)

```
Market PDA:      seeds = ["market", founder, ipfs_cid]
Position PDA:    seeds = ["position", market, user]
Treasury PDA:    seeds = ["treasury"]
Vault PDA:       seeds = ["vault", market]
Team Vesting:    seeds = ["team_vesting", market]
Founder Vesting: seeds = ["founder_vesting", market]
```

## 📁 Project Structure

```
src/
├── app/                    # Next.js 14 App Router
│   ├── api/               # API routes (optimized with MongoDB aggregation)
│   │   ├── markets/       # Market CRUD, voting, claiming rewards
│   │   ├── projects/      # Project creation and management
│   │   ├── profile/       # User profiles, follow system, favorites
│   │   ├── user/          # User positions, history, stats, creator-fees
│   │   ├── search/        # Global search for users and markets
│   │   ├── grok/          # AI roasting endpoints
│   │   ├── pump/          # Pump.fun IPFS uploads
│   │   ├── printify/      # Merch shop API (products, orders)
│   │   ├── admin/         # Admin tools (treasury, market fixes)
│   │   └── health/        # Health check endpoints
│   ├── browse/            # Browse and filter active markets
│   ├── merch/             # Merch shop with Printify integration
│   ├── create/            # Project creation with IPFS upload
│   ├── market/[id]/       # Market details, trading, activity
│   ├── launched/          # Successfully launched projects
│   ├── launchpad/         # Platform dashboard
│   ├── wallet/            # Wallet, portfolio, positions
│   ├── profile/[wallet]/  # User profiles with followers/following
│   └── whitepaper/        # Platform whitepaper
├── components/             # Reusable UI components
│   ├── ui/                # shadcn/ui components
│   ├── auth/              # Headless auth components (OTP, OAuth, etc.)
│   ├── providers/         # React context providers
│   ├── Sidebar.tsx        # Main navigation
│   ├── GlobalSearch.tsx   # Search component
│   ├── JupiterSwap.tsx    # Token swap modal (Jupiter aggregator)
│   ├── GrokRoast.tsx      # AI project roasting
│   └── CosmicOnboardingModal.tsx  # Custom onboarding flow
├── services/               # Backend services
│   ├── blockchain-sync/   # Helius WebSocket, event processing
│   └── socket/            # Socket.IO server for real-time updates
├── lib/                    # Utilities and shared code
│   ├── hooks/             # React hooks (useSocket, useWallet, useCreatorFees, etc.)
│   ├── database/          # MongoDB models and connection
│   ├── redis/             # Redis queue and caching
│   ├── solana/            # Solana RPC and program interactions
│   ├── api-utils.ts       # Shared API utilities
│   ├── mongodb.ts         # Mongoose models
│   └── ipfs.ts            # IPFS/Pinata integration
├── contexts/               # React context providers
└── types/                  # TypeScript type definitions
```

## 🔄 Real-Time Architecture

The platform uses a sophisticated real-time update system:

- **Helius WebSocket**: Monitors on-chain program accounts for state changes
- **Event Queue**: Processes blockchain events with retry logic
- **Socket.IO**: Broadcasts updates to connected clients in real-time
- **MongoDB Sync**: Automatically syncs on-chain data to database
- **Redis Cache**: Reduces database load and improves response times

This ensures users see market updates, votes, and pool changes instantly without refreshing.

## 🔧 Configuration

The platform supports both development and production environments:

- **Development**: Uses Solana devnet for testing
- **Production**: Uses Solana mainnet for live trading
- **Network Switching**: Controlled by `NEXT_PUBLIC_SOLANA_NETWORK` (`devnet` or `mainnet-beta`). Set explicitly in the deploy environment.

## 📱 Mobile Optimization

All pages are fully optimized for mobile devices with a mobile-first approach:

- **Touch-friendly UI**: Buttons sized appropriately for touch interaction (36px+ on mobile)
- **Responsive Breakpoints**: `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px)
- **Optimized Typography**: Smaller text on mobile, larger on desktop
- **Compact Spacing**: Reduced padding and margins on mobile devices
- **Icon-only Actions**: Social links and secondary actions show icons only on mobile
- **Stacked Layouts**: Cards and grids stack vertically on mobile
- **Mobile-first CSS**: Base styles target mobile, enhanced for larger screens
- **Proper Viewport**: Configured for optimal mobile rendering

**Recent Mobile Optimizations:**
- Navbar: Compact navigation with all buttons visible on mobile
- Browse Page: Optimized market cards with reduced sizes and spacing
- Market Details: Fully responsive trading interface and market information
- Notifications: Icon-only actions with touch-friendly buttons
- Create Page: Image upload confirmation and responsive form layout

## 🚀 Deployment

1. Set up MongoDB Cloud database with separate collections for devnet/mainnet
2. Configure Helius RPC endpoints for production
3. Set up Pinata IPFS storage account
4. Configure Redis (Upstash) for caching
5. Update Privy App ID for production environment
6. Set up environment variables on your hosting platform
7. Deploy to Vercel, Railway, or your preferred Node.js hosting platform
8. Ensure WebSocket support is enabled for real-time updates

## 🔧 Troubleshooting

### Common Issues

**Markets not updating in real-time**
- Check if Socket.IO is connected (green indicator in UI)
- Verify `NEXT_PUBLIC_SOCKET_PORT` matches your server configuration
- Check browser console for WebSocket connection errors
- Ensure Redis is running for event queue processing

**IPFS images not loading**
- Verify `PINATA_GATEWAY_URL` is set correctly (without `https://` prefix)
- Check if the Pinata gateway is accessible
- Ensure `NEXT_PUBLIC_PINATA_JWT` is valid

**Blockchain sync not working**
- Verify Helius API key is valid and has sufficient credits
- Check `HELIUS_WS_MAINNET` or `HELIUS_WS_DEVNET` WebSocket URLs
- Look for connection errors in server logs
- Ensure `AUTO_START_SYNC=true` for automatic sync on startup

**MongoDB connection issues**
- Verify `MONGODB_URI` is correct and accessible
- Check IP whitelist in MongoDB Atlas
- Ensure the correct database name is set (`MONGODB_DEV_DATABASE` or `MONGODB_PROD_DATABASE`)

**Privy authentication not working**
- Verify `NEXT_PUBLIC_PRIVY_APP_ID` is correct
- Check Privy dashboard for allowed domains
- Ensure cookies are enabled in the browser

### Debug Commands

```bash
# Check health endpoints
curl http://localhost:3000/api/health

# View server logs
npm run dev:unified 2>&1 | tee server.log

# Check MongoDB connection
npm run db:test

# Verify environment variables
npm run env:check
```

### Performance Issues

- **Slow API responses**: APIs use MongoDB aggregation pipelines for optimal performance. Check database indexes.
- **High memory usage**: Reduce `stars` count in landing page if needed (currently 500).
- **Stale data**: Check `lastSyncedAt` timestamps in market responses. Data older than 2 minutes may be stale.

## 📄 License

MIT — see [LICENSE](LICENSE). Copyright © 2026 Bishwanath Bastola.

## 🌐 Live surface

- Site: [pnl.market](https://pnl.market)
- Token: [$PNL on pump.fun](https://pump.fun/coin/6QuNZJzUF7oZj3GsG7fVBfidX1cE81sXhb9Czi12pump) · [DexScreener](https://dexscreener.com/solana/6QuNZJzUF7oZj3GsG7fVBfidX1cE81sXhb9Czi12pump)
- Program: [`C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86`](https://solscan.io/account/C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86) on Solana mainnet
- X / Twitter: [@pnldotmarket](https://x.com/pnldotmarket)
- Discord: [discord.gg/38pkg4vm](https://discord.gg/38pkg4vm)
- Hackathon: [Solana Frontier 2026 submission](https://arena.colosseum.org/projects/explore/predict-and-launch)