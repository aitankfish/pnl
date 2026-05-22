---
name: pnl-vote
description: Stake YES or NO on an existing PNL market. Returns a deep-link with side + amount pre-filled; user signs in their wallet.
---

# /pnl-vote

The user wants to stake YES or NO on an existing PNL conviction
market. This is the "back this idea" or "fade this idea" action.

## What to do

### Step 1 — figure out which market

If the user said "vote yes on Nakshatra" or named a market, run
`pnl_browse_markets` (or `pnl_get_market` if they gave an id) to
confirm the market id. The deep-link uses that id.

### Step 2 — confirm side + amount

Ask the user for any missing fields:

- **vote**: `yes` (back) or `no` (fade)
- **amountSol**: minimum 0.01 SOL on most markets; typical
  retail-sized vote is 0.01-1 SOL. If the user said "small" treat
  as 0.05, "modest" as 0.1, "real money" ask explicitly.

Skip Step 2 if the user gave both inline (e.g. "vote yes on Nakshatra
with 0.1 SOL").

### Step 3 — call pnl_vote

Pass `{ marketId, vote, amountSol }`. The tool returns a deep-link.

### Step 4 — hand off

Tell the user to open the URL. The market page pre-fills the vote
panel from the query params, so they only confirm + sign in their
browser wallet. Transaction confirms in ~5-15s on Solana mainnet.

## Common follow-ups

- "Why two clicks?" → v0.2 is deep-link mode (no local signing).
  Phase B will add autosign for stakes under the cap.
- "What does NO actually win?" → NO voters split the pool if NO
  wins. Critics get paid for filtering noise. Tell them to read
  the manifesto at docs.pnl.market/docs/manifesto for the
  protocol's stance on skepticism as a paid role.
