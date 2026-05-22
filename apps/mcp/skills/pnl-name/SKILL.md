---
name: pnl-name
description: Claim or rename your PNL username. Signs a challenge with the local wallet to prove ownership — no browser, no Privy, no Gmail login needed.
---

# /pnl-name

The user wants to set the username shown on their PNL profile and on
any market detail page they create.

## What to do

1. Ask the user what they'd like the username to be (or extract from
   their message if they gave it inline — e.g. "/pnl-name bishwa" or
   "set my pnl username to bishwa"). Constraints: 3-20 characters,
   letters / numbers / `_` / `-` only.
2. Call the `pnl_set_username` MCP tool with `{ username: <name> }`.
3. If the response is "taken", suggest 2-3 variations (e.g. append a
   number, add `_pnl`, swap an underscore for a hyphen) and ask the
   user which to try.
4. On success, relay the confirmation:
   - new username
   - wallet address it's attached to
   - mention that this name will now show on the market detail page
     for any market they create (replacing the truncated wallet address)

## Common follow-ups

- "Why no Gmail?" → PNL is non-custodial; the wallet IS the login.
  The MCP server signs a time-bounded challenge with the keypair from
  pnl_init so the backend can verify ownership without a Privy session.
- "Can I change it later?" → Yes, just run `/pnl-name <new-name>` again.
