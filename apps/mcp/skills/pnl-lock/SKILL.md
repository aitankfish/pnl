---
name: pnl-lock
description: Lock the PNL wallet immediately. Wipes the cached secret from memory; future signing requires a fresh unlock.
---

# /pnl-lock

The user wants to lock the PNL wallet right now — stepping away,
ending a session, or after a sensitive operation.

## What to do

1. Call the `pnl_lock` MCP tool (no arguments).
2. Confirm the wallet is locked.

This is a fast operation and safe to call any time. If the wallet was
already locked, the tool just confirms that.
