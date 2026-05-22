---
name: pnl-claim-now
description: Autosign claim_rewards — the MCP signs and sends locally. No browser bounce, no autosign cap (claim is a withdrawal, not a spend).
---

# /pnl-claim-now

The user wants to collect rewards on a resolved PNL market without
leaving the terminal. Unlike `/pnl-pitch-now` and `/pnl-vote-now`
there is no autosign cap — claim is a withdrawal of funds the user
is already owed by the program, so capping it would gate the user
from their own money.

## Prerequisites

- Wallet on this machine (`pnl_init` previously)
- Wallet **unlocked** (`pnl_unlock` first)
- Market resolved (YES wins, NO wins, or refund) — not Active
- Wallet has an unclaimed position on the market

## What to do

### Step 1 — figure out which market

`pnl_browse_markets` filtered by status, or `pnl_notify` if there
are claim-ready notifications, or a marketId the user named
directly.

### Step 2 — confirm autosign

In one sentence:

> "I'll sign the `claim_rewards` tx locally with your wallet.
> Confirm?"

If the user wants the browser path, switch to `/pnl-claim`.

### Step 3 — call pnl_claim_now

Pass `{ marketId }`. The tool:
1. Fetches market resolution + position from chain
2. Builds the unsigned tx (including Token2022 ATA creation for
   YES wins)
3. Signs locally
4. Sends + confirms
5. Persists via sig-auth complete-claim

Returns tx signature + Solscan link + profile URL.

### Step 4 — hand off

Tell the user where to see the updated position:
the `/profile/<wallet>` URL the tool returned. For YES wins, the
tokens land in the wallet's Token2022 ATA (Phantom / Solflare /
Backpack will surface them automatically).

## Failure modes

- **Wallet locked** → suggest `/pnl-unlock` first.
- **Market not resolved** → "this market hasn't resolved yet."
- **No position** → "this wallet has nothing to claim on that
  market."
- **Already claimed** → no-op; suggest checking the profile to see
  the existing claim.
- **Tx confirmed but complete-claim failed** → the on-chain claim
  succeeded; the off-chain "claimed" flag failed to update.
  Re-running `pnl_claim_now` is safe (idempotent on tx signature).
