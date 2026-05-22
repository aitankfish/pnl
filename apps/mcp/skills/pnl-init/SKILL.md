---
name: pnl-init
description: Set up PNL on this machine — generate a local Solana keypair and show the deposit address. Run this once before pitching ideas or voting.
---

# /pnl-init

First-run setup for PNL. The user wants to start posting ideas to the
conviction-market protocol on Solana (pnl.market) from their terminal.

## What to do

1. Call the `pnl_init` MCP tool with no arguments.
2. Relay the response verbatim — it contains the deposit address, current
   balance, and clear funding instructions.
3. Suggest the user fund the wallet by sending at least 0.05 SOL from any
   Solana wallet (Phantom, Solflare, Backpack, an exchange withdrawal).
4. Tell them once funded they can run `/pnl-wallet` to confirm the balance
   landed, or `/pnl-pitch <idea>` to post an idea directly.

## Tone

Be direct. Don't editorialize about non-custodial framing unless the user
asks. The terminal output already says enough.
