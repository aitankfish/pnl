# Quick Start Guide

## Running the App with Real-Time Updates

### Option 1: Manual Start (Recommended)

**Step 1:** Clean up and prepare
```bash
./scripts/start-dev.sh
```

**Step 2:** Start Next.js (Terminal 1)
```bash
npm run dev
```
Wait for: `✓ Ready on http://localhost:3000`

**Step 3:** Start Blockchain Sync (Terminal 2)
```bash
npx tsx scripts/start-sync-system.ts
```
Wait for: `✅ Blockchain sync manager started successfully!`

### Option 2: Quick Commands

If you already know your terminals are clean:

**Terminal 1:**
```bash
npm run dev
```

**Terminal 2:**
```bash
npx tsx scripts/start-sync-system.ts
```

## What You Get

✅ **Real-time market updates** - No refresh needed
✅ **Socket.IO connection** - Live WebSocket communication
✅ **Blockchain synchronization** - Automatic DB updates from chain
✅ **Vote tracking** - See votes appear instantly across all browsers

## Testing Real-Time Updates

1. Open `http://localhost:3000` in **two browser windows**
2. Navigate to the same market in both
3. Cast a vote from Window 1
4. Watch Window 2 update automatically (2-3 seconds)

## Important Notes

⚠️ **Use `npm run dev`** (the standard command)
❌ **Don't use `npm run dev:unified`** (has a font loading bug)

## Troubleshooting

### Build Error with Font Loading

If you see `ERR_INVALID_URL_SCHEME: The URL must be of scheme file`:
- You accidentally ran `npm run dev:unified`
- Solution: Stop it and use `npm run dev` instead

### Socket.IO Not Connecting

- Make sure **both** terminals are running
- Check Terminal 2 shows "Blockchain sync manager started"
- Refresh your browser

### Port Already in Use

```bash
# Kill all node processes
killall node

# Or run the cleanup script
./scripts/start-dev.sh
```

## Documentation

- `SOCKET_IO_TESTING.md` - Detailed testing guide
- `REALTIME_UPDATES_STATUS.md` - Technical implementation details

## Need Help?

Check the browser console for Socket.IO connection logs:
```
[INFO] 🔌 Socket.IO connected
[INFO] 📡 Subscribing to market: <address>
```

If you see these, everything is working!
