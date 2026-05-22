---
name: pnl-notify
description: Show recent PNL notifications for the local wallet — votes on your markets, resolutions, claim-ready alerts. Stateful (last-seen tracking) and on-demand.
---

# /pnl-notify

The user wants to know what's happened on PNL since they last
checked — votes on their markets, market resolutions, claim-ready
alerts, milestones.

## What to do

### Step 1 — call pnl_notify

Pass `{}` for the default behavior (new items since last call, top
10, unread only). The tool reads the local wallet address from the
encrypted-at-rest store and queries `/api/notifications` for that
wallet.

If the user asks for the *full* feed (not just what's new), pass
`{ all: true }`. If they want read items too, pass `{ unreadOnly:
false }`.

### Step 2 — surface the items

The tool returns a table:

| Type | When (UTC) | Title | Market / Token |

Plus the user's profile URL (`/profile/<wallet>`) so they can open
it to mark items read or drill into specifics.

### Step 3 — suggest follow-ups based on type

- `claim_ready` → suggest `/pnl-claim-now` (or `/pnl-claim`)
- `market_resolved` → mention the resolution side
- `vote_result` on a market the user created → suggest checking
  `/pnl-get-market` for the live pool state
- `pool_complete` → market may be eligible for early resolution

## State management

The tool writes the most recent notification timestamp to
`~/.config/pnl/last-seen.json` keyed by wallet address. To re-show
everything (e.g. if the user wants to scan the full inbox), pass
`{ all: true }` — that ignores the last-seen cursor.

## When to invoke proactively

- After `/pnl-pitch-now` or `/pnl-vote-now` succeeds and the user
  asks "what's next" — they may want to see how their existing
  positions are doing.
- When the user opens a session and says "any updates?".

Do not auto-poll without being asked; this is an on-demand tool.
For background polling, use `/loop /pnl-notify` from the user side.
