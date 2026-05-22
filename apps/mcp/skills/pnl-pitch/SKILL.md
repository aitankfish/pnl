---
name: pnl-pitch
description: Pitch an idea on PNL. Extracts the idea from the conversation context, asks the user for any missing fields, then returns a deep-link they open to sign + post the market.
---

# /pnl-pitch

The user wants to turn an idea (often something that surfaced in the
agent conversation just before they invoked this skill) into a live
conviction market on PNL.

## What to do

### Step 1 — extract what you can from context

Look back over the recent conversation for:

- **name**: the idea's name (e.g. "AutoImport CLI")
- **description**: 1-3 sentences describing what it is and why it
  matters. Pull from the user's own words when possible — be honest
  about the idea, not overhyped.
- **tokenSymbol**: a 3-10 character uppercase ticker. If not stated,
  propose one derived from the name (e.g. AutoImport CLI → AUTOIMP).
  Confirm with the user before posting.
- **category**: one of DeFi, NFT, Gaming, DAO, AI/ML, Infrastructure,
  Social, Meme, Creator, Healthcare, Science, Education, Finance,
  Commerce, Real Estate, Energy, Media, Manufacturing, Mobility, Other.
  Pick the best fit.
- **projectType**: Protocol | Application | Platform | Service | Tool.
  Default to Tool if uncertain.
- **projectStage**: Idea | MVP | Beta | Production | Scaling | Prototype |
  Launched. Default Idea if uncertain.

### Step 2 — ask the user for anything still missing

These almost always need user input:

- **teamSize** (default 1 if solo)
- **targetPoolSol** (typical range 5-50 SOL; common default 15)
- **durationDays** (typical 7-90; common default 30)

Ask them in one batched question, not one at a time. Example:

> "Got it. Before I draft the market: how big a target pool (in SOL,
> common is 15) and how long should voting stay open (in days, common
> is 30)?"

### Step 3 — provenance (optional but on-brand)

If the idea genuinely surfaced from the current conversation — a TODO
comment, a feature the user mentioned in passing, a problem they were
discussing — *ask the user* whether to attach a provenance record.

If they say yes, pass `provenance` with:
- `source: "claude-code"`
- `excerpt`: the 1-3 sentences from the conversation that birthed the
  idea (their words, lightly cleaned)
- `codeSnippet`: any relevant code if it motivated the idea
- `timestamp`: ISO 8601 of now

This shows up on the market detail page as
"this idea was born from a conversation in Claude Code on [date]" —
the AI-builder thesis made literal.

### Step 4 — call pnl_pitch_idea

Pass everything gathered. The tool POSTs to PNL's draft endpoint and
returns a `https://pnl.market/create?draft=<id>` URL.

### Step 5 — hand off

Tell the user:

> "Drafted. Open this to sign and post: <URL>
>
> The /create page is pre-filled with everything I just sent. You'll
> connect your wallet there and confirm the create_market transaction
> in your browser. The market goes live as soon as it confirms on-chain
> (~5-15 seconds on Solana mainnet)."

Don't try to call `pnl_init` or `pnl_wallet` first unless the user
mentions wallet trouble — the deep-link uses their Privy / external
browser wallet, not the MCP local keypair (that's Phase B).
