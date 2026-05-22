---
name: pnl-claim
description: Claim rewards on a resolved PNL market in deep-link mode. Returns a URL the user opens to sign the claim_rewards tx in their browser wallet.
---

# /pnl-claim

The user has an unclaimed position on a resolved PNL market and
wants to collect their rewards via the browser flow (no MCP unlock
needed).

## What to do

### Step 1 — figure out which market

If the user named one or said "claim my market", run
`pnl_browse_markets` (filter by `status: 'yesWins'`, `'noWins'`, or
`'refund'`) — or use `pnl_notify` to surface "claim_ready"
notifications if any are pending.

If the user is talking about their own positions, the
`/profile/<wallet>` page is the source of truth for what's
claimable; suggest opening it if disambiguating between several.

### Step 2 — confirm

Quickly check that:
- The market is resolved (not "active" / "Unresolved")
- The user expects to be a winner (they had a position on the
  winning side, or it's a refund)

If anything is off, redirect to `pnl_browse_markets` or the profile
page rather than guessing.

### Step 3 — call pnl_claim

Pass `{ marketId }`. The tool returns a URL of the form
`/market/<id>?claim=1`.

### Step 4 — hand off

Tell the user to open the URL — the market detail page detects
`?claim=1`, opens the claim panel, and they sign `claim_rewards`
in their browser wallet. Tx confirms in ~5-15s.

## Failure modes

- **Market not resolved**: backend returns 400. Surface as "this
  market hasn't resolved yet — check back when YES, NO, or refund
  is decided."
- **No position**: backend returns 404. Surface as "this wallet has
  nothing to claim on that market."
- **Already claimed**: backend returns 400 with "Rewards already
  claimed for this position".

## When to use `/pnl-claim-now` instead

If the user says "claim it for me" or "auto-claim", switch to
`/pnl-claim-now` — it signs locally without a browser bounce.
Requires the wallet to be unlocked.
