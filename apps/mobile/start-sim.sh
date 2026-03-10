#!/bin/bash
# PNL Mobile Simulator Launcher
# Usage: ./start-sim.sh
# Boots iPhone 17 Pro, starts backend, launches Expo on simulator

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE_DIR="$REPO_ROOT/apps/mobile"
WEB_DIR="$REPO_ROOT/apps/web"
SIMULATOR_NAME="iPhone 17 Pro"
EXPO_PORT=8081
BACKEND_PORT=3000

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${CYAN}[PNL]${NC} $1"; }
success() { echo -e "${GREEN}[PNL]${NC} $1"; }
warn() { echo -e "${YELLOW}[PNL]${NC} $1"; }
error() { echo -e "${RED}[PNL]${NC} $1"; }

cleanup() {
  log "Shutting down..."
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null && log "Backend stopped"
  [ -n "$EXPO_PID" ] && kill "$EXPO_PID" 2>/dev/null && log "Expo stopped"
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── 1. Boot Simulator ──────────────────────────────────────────
log "Booting $SIMULATOR_NAME simulator..."
DEVICE_UDID=$(xcrun simctl list devices available | grep "$SIMULATOR_NAME" | head -1 | grep -oE '[A-F0-9-]{36}')

if [ -z "$DEVICE_UDID" ]; then
  error "$SIMULATOR_NAME not found! Available devices:"
  xcrun simctl list devices available | grep iPhone
  exit 1
fi

BOOTED=$(xcrun simctl list devices | grep "$DEVICE_UDID" | grep -c "Booted" || true)
if [ "$BOOTED" -eq 0 ]; then
  xcrun simctl boot "$DEVICE_UDID" 2>/dev/null || true
  success "Simulator booted ($DEVICE_UDID)"
else
  success "Simulator already running"
fi

open -a Simulator
sleep 2

# ── 2. Kill stale processes on our ports ────────────────────────
kill_port() {
  local port=$1
  local pids=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    warn "Killing existing processes on port $port (PIDs: $pids)"
    echo "$pids" | xargs kill 2>/dev/null || true
    sleep 1
  fi
}

kill_port $BACKEND_PORT
kill_port $EXPO_PORT

# ── 3. Start Backend (unified server) ──────────────────────────
log "Starting backend on port $BACKEND_PORT..."
cd "$WEB_DIR"
pnpm dev:unified > /tmp/pnl-backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to be ready
log "Waiting for backend..."
for i in $(seq 1 30); do
  if curl -s "http://localhost:$BACKEND_PORT/api/health" | grep -q '"healthy"' 2>/dev/null; then
    success "Backend ready!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    error "Backend failed to start. Check /tmp/pnl-backend.log"
    cat /tmp/pnl-backend.log | tail -20
    exit 1
  fi
  sleep 1
done

# ── 4. Start Expo Dev Server ───────────────────────────────────
log "Starting Expo on port $EXPO_PORT..."
cd "$MOBILE_DIR"
npx expo start --port $EXPO_PORT > /tmp/pnl-expo.log 2>&1 &
EXPO_PID=$!

# Wait for Expo to be ready
sleep 5

# ── 5. Open PNL app on simulator ───────────────────────────────
log "Launching PNL app..."
PNL_BUNDLE_ID="PNL.Predict-and-Launch"
if xcrun simctl listapps "$DEVICE_UDID" 2>/dev/null | grep -q "$PNL_BUNDLE_ID"; then
  xcrun simctl launch "$DEVICE_UDID" "$PNL_BUNDLE_ID"
  success "PNL app launched!"
else
  warn "PNL native app not installed — falling back to Expo Go"
  xcrun simctl openurl "$DEVICE_UDID" "exp://127.0.0.1:$EXPO_PORT"
fi

success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
success " PNL Mobile Dev Environment Running!"
success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
success " Simulator: $SIMULATOR_NAME"
success " Backend:   http://localhost:$BACKEND_PORT (PID $BACKEND_PID)"
success " Expo:      http://localhost:$EXPO_PORT (PID $EXPO_PID)"
success " Logs:      /tmp/pnl-backend.log & /tmp/pnl-expo.log"
success "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log "Press Ctrl+C to stop everything"

# Keep running and forward logs
tail -f /tmp/pnl-backend.log /tmp/pnl-expo.log 2>/dev/null &
wait
