---
name: pnl-wallet
description: Show the local PNL wallet's address, balance, and autosign cap. Use to check if a funding transaction has landed.
---

# /pnl-wallet

The user wants to see the current state of their local PNL wallet.

## What to do

1. Call the `pnl_wallet` MCP tool with no arguments.
2. Relay the response. It contains:
   - Public address (the deposit address)
   - Current SOL balance
   - Autosign cap (the per-tx SOL limit below which the MCP server
     signs without confirmation — Phase B feature)
   - Active RPC endpoint
3. If the balance is 0, suggest the user fund the wallet by sending SOL
   to the address from any Solana wallet.
4. If the tool returns "No PNL wallet on this machine yet", suggest
   they run `/pnl-init` first.
