---
name: pnl-browse
description: List live conviction markets on PNL. Use to see what ideas are currently open for voting.
---

# /pnl-browse

The user wants to see what's currently live on PNL — names, YES%,
pool sizes, vote counts.

## What to do

1. Call the `pnl_browse_markets` MCP tool. Defaults are fine — `status: "active"`,
   `limit: 10`. If the user said "show me resolved markets" or "what won
   recently", pass `status: "yesWins"` or `status: "noWins"`.
2. Display the formatted summary returned by the tool. Each market line
   shows: name + $ticker + founder, status + YES% + pool + vote count
   + time-left, and a URL the user can click to see the full market.
3. If the user wants details on a specific market, suggest they run
   `/pnl-get <market-id>` (the id is in the URL after `/market/`) or
   call `pnl_get_market` directly.
4. Don't repeat the raw JSON dump back to the user unless they ask —
   it's there for the agent's reasoning, not display.

## Common follow-ups

- "Show me the AI ones" → call again with default args, then filter the
  results by category in your response.
- "Just YES%" → re-render with only that field per market.
- "More" → call again with `page: 2`.
