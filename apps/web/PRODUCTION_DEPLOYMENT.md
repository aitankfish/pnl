# PNL Platform - Production Deployment Guide

This guide explains how to deploy the PNL Platform to production with the blockchain sync system enabled.

## 🏗️ Architecture Overview

Your production deployment runs:
1. **Next.js App** (port 3000) - Web server
2. **Socket.IO Server** (port 3001) - Real-time updates
3. **Blockchain Sync System** - Monitors Solana blockchain
   - Helius WebSocket client
   - Redis event queue
   - Event processor
   - MongoDB updates

All 3 components run in **one process** using `npm run start:prod`.

---

## 📋 Prerequisites

Before deploying, ensure you have:

### Required Services:
- ✅ **MongoDB Atlas** - Database (already configured)
- ✅ **Upstash Redis** - Event queue (already configured)
- ✅ **Helius RPC** - Solana API access (already configured)
- ✅ **Privy** - Wallet authentication (already configured)
- ✅ **Pinata** - IPFS storage (already configured)

### Deployment Platform:
- **Render.com** (recommended) - Configuration ready in `render.yaml`
- OR any Node.js hosting platform (Vercel, Railway, Fly.io, etc.)

---

## 🚀 Deployment Options

### **Option 1: Render.com (Recommended) - One-Click Deploy**

1. **Push code to GitHub:**
   ```bash
   git add .
   git commit -m "Add production deployment configuration"
   git push origin main
   ```

2. **Connect to Render.com:**
   - Go to https://dashboard.render.com/
   - Click "New +" → "Blueprint"
   - Connect your GitHub repository
   - Render will automatically detect `render.yaml`

3. **Add Environment Variables:**
   In Render dashboard, add these secrets:

   ```env
   # MongoDB
   MONGODB_URI=mongodb+srv://...

   # Redis
   REDIS_URL=redis://...

   # Helius
   HELIUS_API_KEY=your_helius_key
   NEXT_PUBLIC_HELIUS_MAINNET_RPC=https://mainnet.helius-rpc.com/?api-key=...
   NEXT_PUBLIC_HELIUS_DEVNET_RPC=https://devnet.helius-rpc.com/?api-key=...
   NEXT_PUBLIC_HELIUS_WS_MAINNET=wss://mainnet.helius-rpc.com/?api-key=...
   NEXT_PUBLIC_HELIUS_WS_DEVNET=wss://devnet.helius-rpc.com/?api-key=...

   # Privy
   NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id

   # Pinata
   NEXT_PUBLIC_PINATA_JWT=your_pinata_jwt
   NEXT_PUBLIC_PINATA_GATEWAY_URL=https://your-gateway.mypinata.cloud

   # Solana Network (mainnet-beta or devnet)
   NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta

   # Program IDs
   NEXT_PUBLIC_PLP_PROGRAM_ID_DEVNET=2CjwEvY3gkErkEmM5wnLpRv9fq3msHjnPDVPQmaWhF3G
   NEXT_PUBLIC_PLP_PROGRAM_ID_MAINNET=your_mainnet_program_id

   # Auto-start sync (default: true)
   AUTO_START_SYNC=true
   ```

4. **Deploy:**
   - Click "Apply" in Render dashboard
   - Render will build and deploy automatically
   - Monitor logs for successful startup

5. **Verify Deployment:**
   - Visit your Render URL: `https://pnl-platform.onrender.com`
   - Check health: `https://pnl-platform.onrender.com/api/health`
   - Should show: `status: "healthy"` with sync info

---

### **Option 2: Manual Deployment (Any Platform)**

If not using Render, follow these steps:

1. **Build the application:**
   ```bash
   npm install --legacy-peer-deps
   npm run build
   ```

2. **Set environment variables** (copy from `.env`)

3. **Start production server:**
   ```bash
   npm run start:prod
   ```

4. **Ensure these ports are accessible:**
   - Port 3000 - Next.js app
   - Port 3001 - Socket.IO (internal)

---

## ⚙️ Configuration Options

### Enable/Disable Blockchain Sync

By default, blockchain sync starts automatically in production. To disable:

```env
AUTO_START_SYNC=false
```

This will run only the Next.js app without real-time sync.

### Switch Networks

**For Devnet (Testing):**
```env
NEXT_PUBLIC_SOLANA_NETWORK=devnet
```

**For Mainnet (Production):**
```env
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
```

---

## 🔍 Monitoring & Health Checks

### Health Check Endpoint

```bash
curl https://your-domain.com/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-24T...",
  "service": "pnl-platform",
  "version": "0.1.0",
  "uptime": 3600,
  "environment": "production",
  "network": "mainnet-beta",
  "sync": {
    "enabled": true,
    "heliusConnected": true,
    "processorRunning": true,
    "subscriptions": 20,
    "queueLength": 0,
    "processing": 0
  }
}
```

### Logs Monitoring

**On Render.com:**
- View logs in Render dashboard
- Logs tab shows real-time output

**Look for these key messages:**
```
✅ Next.js server started
✅ Blockchain sync started
✅ Production system fully operational!
```

**Health check logs (every 60 seconds):**
```
[10:30:00] Health: Helius ✓ | Queue: 0 | Processing: 0
```

---

## 🔧 Troubleshooting

### Sync Not Starting

**Check logs for:**
```
❌ Failed to start blockchain sync
```

**Common causes:**
- Missing `MONGODB_URI` - Check env vars
- Missing `HELIUS_API_KEY` - Add to env
- Invalid network config - Check `NEXT_PUBLIC_SOLANA_NETWORK`

**Fix:** Ensure all required environment variables are set in Render dashboard.

### WebSocket Connection Errors

```
[ERROR] 🔌 Connection error: websocket error
```

**Cause:** Helius WebSocket connection failed

**Fix:**
1. Check Helius API key is valid
2. Verify WebSocket URLs are correct
3. Check Helius dashboard for rate limits

### Queue Building Up

**If health check shows:**
```json
"queueLength": 100,
"processing": 0
```

**Cause:** Event processor not running or stuck

**Fix:**
1. Check MongoDB connection
2. Restart service
3. Check logs for processor errors

---

## 🔐 Security Checklist

Before going live:

- [ ] All API keys in environment variables (not in code)
- [ ] MongoDB has IP whitelist configured
- [ ] Redis has authentication enabled
- [ ] Privy has production domain whitelisted
- [ ] Program IDs are correct for mainnet
- [ ] `NODE_ENV=production` is set
- [ ] Health check endpoint is accessible

---

## 📊 Performance Tips

### Scaling

**Render.com Plans:**
- **Starter** ($7/mo) - Good for testing, 512MB RAM
- **Standard** ($25/mo) - Recommended for production, 2GB RAM
- **Pro** ($85/mo) - High traffic, 4GB RAM

**When to upgrade:**
- Queue length consistently > 50
- High memory usage warnings
- Slow response times

### Separate Sync Worker (Advanced)

For high-traffic production, run sync as separate service:

**In `render.yaml`, uncomment:**
```yaml
- type: worker
  name: pnl-blockchain-sync
  startCommand: npx tsx scripts/start-sync-system.ts
```

This runs sync in a dedicated worker process.

---

## 🎯 Deployment Checklist

Before deploying to production:

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Program deployed to mainnet
- [ ] MongoDB production database created
- [ ] Redis configured and accessible
- [ ] Privy production domain added
- [ ] Health check returns 200
- [ ] Logs show successful startup
- [ ] Create test market on mainnet works
- [ ] Real-time updates working
- [ ] Socket.IO connected

---

## 📚 Quick Reference

### Commands

```bash
# Development (local)
npm run dev:unified

# Production (server)
npm run start:prod

# Sync only (separate process)
npx tsx scripts/start-sync-system.ts
```

### Important URLs

- **Health Check:** `/api/health`
- **API Base:** `/api`
- **Socket.IO:** Port 3001

### Key Files

- `render.yaml` - Render deployment config
- `scripts/start-production.ts` - Production startup script
- `scripts/start-sync-system.ts` - Standalone sync script
- `.env` - Environment variables (DO NOT COMMIT)

---

## 🆘 Support

If you encounter issues:

1. Check health endpoint: `/api/health`
2. Review server logs
3. Verify environment variables
4. Test MongoDB/Redis connections
5. Check Helius API status

---

**You're all set!** 🚀

Your PNL Platform will now run with full real-time blockchain synchronization in production.
