#!/bin/bash

echo "🧹 Cleaning up old processes..."
killall node npm 2>/dev/null || true
sleep 2

echo "🗑️  Clearing Next.js cache..."
rm -rf .next

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "════════════════════════════════════════════════════════════"
echo "  Starting Development Servers"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📝 IMPORTANT: This will open 2 terminal tabs"
echo ""
echo "   Terminal 1: Next.js Dev Server (Port 3000)"
echo "   Terminal 2: Blockchain Sync System"
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""

# Detect terminal app
if [[ "$TERM_PROGRAM" == "iTerm.app" ]]; then
    # iTerm
    osascript <<EOF
tell application "iTerm"
    tell current window
        create tab with default profile
        tell current session
            write text "cd '$(pwd)' && npm run dev"
        end tell

        create tab with default profile
        tell current session
            write text "cd '$(pwd)' && npx tsx scripts/start-sync-system.ts"
        end tell
    end tell
end tell
EOF
elif [[ "$TERM_PROGRAM" == "Apple_Terminal" ]]; then
    # Terminal.app
    osascript <<EOF
tell application "Terminal"
    do script "cd '$(pwd)' && npm run dev"
    do script "cd '$(pwd)' && npx tsx scripts/start-sync-system.ts"
end tell
EOF
else
    # Fallback - just show instructions
    echo "⚠️  Auto-launch not available for your terminal"
    echo ""
    echo "Please manually open 2 terminals and run:"
    echo ""
    echo "Terminal 1:"
    echo "  npm run dev"
    echo ""
    echo "Terminal 2:"
    echo "  npx tsx scripts/start-sync-system.ts"
fi

echo ""
echo "✅ Done!"
