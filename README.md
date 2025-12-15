# PNL - Predict & Launch

Community-driven token launch platform powered by prediction markets on Solana.

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
HELIUS_WS_DEVNET=wss://devnet.helius-rpc.com/?api-key=your_api_key
HELIUS_WS_MAINNET=wss://mainnet.helius-rpc.com/?api-key=your_api_key

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

# Server-side IPFS Gateway (used by API routes)
PINATA_GATEWAY_URL=your-gateway.mypinata.cloud

# Platform Configuration
PLATFORM_FEE_PERCENTAGE=3
CREATOR_FEE_PERCENTAGE=2
TARGET_POOL_SOL=5
YES_VOTE_COST_SOL=0.05
PLATFORM_FEE_SOL=0.5
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
- **Claim Rewards**: Claim SOL rewards for NO voters or token airdrops for YES voters
- **My Projects**: Project creators can view and manage their launched markets
- **Multiple Categories**: Support for DeFi, NFT, Gaming, DAO, AI/ML, Meme, Creator, and more

## 🏗️ Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Blockchain**: Solana (Anchor Framework), Helius RPC & WebSocket
- **Database**: MongoDB Cloud (network-aware devnet/mainnet switching)
- **Storage**: IPFS via Pinata (metadata, images, documents)
- **Authentication**: Privy (embedded + external wallets)
- **Real-Time**: Socket.IO for live blockchain event streaming
- **Caching**: Redis (Upstash) for performance optimization

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

## 📁 Project Structure

```
src/
├── app/                    # Next.js 14 App Router
│   ├── api/               # API routes (optimized with MongoDB aggregation)
│   │   ├── markets/       # Market CRUD, voting, claiming rewards
│   │   ├── projects/      # Project creation and management
│   │   ├── profile/       # User profiles, follow system, favorites
│   │   ├── user/          # User positions, history, stats
│   │   ├── search/        # Global search for users and markets
│   │   ├── admin/         # Admin tools (treasury, market fixes)
│   │   └── health/        # Health check endpoints
│   ├── browse/            # Browse and filter active markets
│   ├── create/            # Project creation with IPFS upload
│   ├── market/[id]/       # Market details, trading, activity
│   ├── launched/          # Successfully launched projects
│   ├── launchpad/         # Platform dashboard
│   ├── wallet/            # Wallet, portfolio, positions
│   ├── profile/[wallet]/  # User profiles with followers/following
│   └── whitepaper/        # Platform whitepaper
├── components/             # Reusable UI components
│   ├── ui/                # shadcn/ui components
│   ├── providers/         # React context providers
│   ├── Sidebar.tsx        # Main navigation
│   ├── GlobalSearch.tsx   # Search component
│   └── CosmicOnboardingModal.tsx  # Onboarding flow
├── services/               # Backend services
│   ├── blockchain-sync/   # Helius WebSocket, event processing
│   └── socket/            # Socket.IO server for real-time updates
├── lib/                    # Utilities and shared code
│   ├── hooks/             # React hooks (useSocket, useWallet, etc.)
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
- **Network Switching**: Automatic based on NODE_ENV

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

MIT License - see LICENSE file for details.