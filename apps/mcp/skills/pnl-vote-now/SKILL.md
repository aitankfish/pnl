---
name: pnl-vote-now
description: Autosign mode — MCP signs the buy_yes / buy_no transaction locally with the unlocked wallet, no browser bounce. For stakes inside the autosign cap.
---

# /pnl-vote-now

Same intent as `/pnl-vote`, but the MCP signs and sends the
`buy_yes` / `buy_no` transaction *locally* — the user doesn't open
a browser. Use when the user wants to stake immediately without
leaving the terminal.

## Prerequisites

- Wallet on this machine (`pnl_init` previously run)
- Wallet **unlocked** (`pnl_unlock` first)
- Wallet balance ≥ `amountSol + ~0.001 SOL` (stake + tx-fee buffer)
- `amountSol` within the autosign cap (defaults 0.05 SOL, can be
  overridden per-call via `autosignCapSol`)

For larger stakes, use `/pnl-vote` — the deep-link flow is the right
tool when the user explicitly wants to bigger amount approval-flow.

## What to do

### Step 1 — figure out which market

If the user named a market, run `pnl_browse_markets` (or
`pnl_get_market` with the id) to confirm and grab its identifier.
The tool accepts either the Mongo id or the on-chain market address.

### Step 2 — confirm side + amount

If not given inline, ask:

- `vote`: `yes` (back) or `no` (fade)
- `amountSol`: minimum 0.01 SOL

If the user said "small", treat as 0.05; "modest", 0.1; "real money",
ask explicitly.

### Step 3 — confirm autosign

Before calling the tool, surface in one sentence:

> "I'll sign a `buy_<side>` tx locally for `<amountSol>` SOL with
> your wallet. Confirm?"

### Step 4 — call pnl_vote_now

Pass `{ marketId, vote, amountSol }` and any `autosignCapSol`
override.

### Step 5 — hand off

The tool returns the tx signature + Solscan link + market URL.
Pool movement is visible immediately at the market URL.

## Failure modes to handle gracefully

- **Wallet locked** → suggest `/pnl-unlock` first.
- **Stake exceeds cap** → either raise `autosignCapSol` or switch to
  `/pnl-vote` deep-link.
- **Insufficient balance** → show address from `pnl_wallet`, suggest
  funding.
- **Tx confirmed but complete-vote failed** → the on-chain vote
  landed; re-running `pnl_vote_now` is idempotent on the tx
  signature. Recommend a retry.
