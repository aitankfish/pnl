---
name: pnl-help
description: Show all PNL commands + a typical first-run flow. Context-aware — adjusts the suggested next step based on whether the user has a wallet and whether it's unlocked.
---

# /pnl-help

The user wants to discover what PNL can do from the terminal.

## What to do

1. Call the `pnl_help` MCP tool (no arguments).
2. Display the response verbatim — it's already formatted as a
   markdown reference with context-aware suggestions.

That's it. If the user has a follow-up like "what does X do",
explain it from the table or call the specific tool directly.
