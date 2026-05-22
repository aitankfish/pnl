---
name: pnl-pitch-now
description: Autosign mode — MCP signs the create_market transaction locally with the unlocked wallet, no browser bounce. For pitches whose creation fee fits inside the autosign cap.
---

# /pnl-pitch-now

Same intent as `/pnl-pitch`, but the MCP signs and sends the
`create_market` transaction *locally* — the user doesn't have to
open a browser. Use when the user wants the market posted now,
without leaving the terminal.

## Prerequisites

The autosign flow needs:

- A wallet on this machine (`pnl_init` previously run)
- The wallet **unlocked** (`pnl_unlock` first, otherwise the tool
  fails with a "wallet locked" message)
- Wallet balance ≥ ~0.02 SOL (creation fee + tx fee)
- The creation fee within the autosign cap (defaults 0.05 SOL, can
  be overridden per-call via `autosignCapSol`)

If the wallet isn't unlocked, fall back to `/pnl-pitch` (deep-link
mode) — the user can sign in their browser without an unlock.

## What to do

### Step 1 — extract the idea from context

Identical to `/pnl-pitch`: gather name, description, tokenSymbol,
category, projectType, projectStage from the conversation, propose
defaults where reasonable, and confirm with the user.

### Step 2 — gather remaining fields

Ask in one batched question:

- `teamSize` (default 1)
- `targetPoolSol` (typical 5-50, common default 15)
- `durationDays` (typical 7-90, common default 30)

### Step 3 — provenance (same as /pnl-pitch)

If the idea genuinely surfaced from the current conversation, ask
whether to attach a `provenance` record with `source: "claude-code"`,
`excerpt`, optional `codeSnippet`, `timestamp`. Threads through to the
market page as "born from a conversation in Claude Code on [date]".

### Step 4 — confirm the user wants autosign

Before calling the tool, surface what's about to happen in one
sentence:

> "I'll sign the create_market tx locally with your wallet
> (`<truncated-address>`). That's a ~0.015 SOL creation fee plus a
> ~0.000005 SOL Solana fee. Confirm?"

If the user wants the deep-link flow instead, switch to
`/pnl-pitch`.

### Step 5 — call pnl_pitch_now

Pass the same payload as `pnl_pitch_idea` plus any
`autosignCapSol` override.

### Step 6 — hand off the result

The tool returns the live market URL + tx signature + Solscan link.
Tell the user:

> "Market live: <URL>
>  Tx: <signature> (Solscan: <link>)
>  The MCP signed and sent locally — no browser bounce."

## Failure modes to handle gracefully

- **Wallet locked**: tool throws "Wallet is locked." → suggest
  `/pnl-unlock` then re-run.
- **Insufficient balance**: tool throws balance check error →
  show the deposit address from `pnl_wallet` and suggest funding.
- **Exceeds cap**: tool throws cap-exceeded → either ask the user to
  raise the cap (pass `autosignCapSol` larger) or switch to
  `/pnl-pitch` deep-link.
- **Tx confirmed but complete-create failed**: tool throws with the
  tx signature — the market exists on-chain, just the off-chain
  metadata didn't persist. Re-running `pnl_pitch_now` with the same
  args is idempotent on `marketAddress`. Recommend that.
