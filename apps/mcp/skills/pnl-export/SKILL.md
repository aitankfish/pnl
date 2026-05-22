---
name: pnl-export
description: Export the local PNL keypair (base58 + JSON-array) so the user can back it up or import it into Phantom/Solflare/Backpack. Requires explicit confirmation.
---

# /pnl-export

The user wants to back up the seed of their local PNL wallet, or move
it into a different Solana wallet (Phantom / Solflare / Backpack /
Solana CLI).

## What to do

1. **Confirm before exporting.** The keypair is the entire access
   control for the wallet — anyone who reads it can spend the SOL on
   it. Ask the user something like:

   > "I'm about to show your PNL secret key in this conversation. It
   > can be used by anyone who sees it to spend your funds. Continue?"

   Only proceed if they say yes.

2. Call the `pnl_export_keypair` MCP tool with `confirm: "EXPORT"`.

3. Display the response. It contains both formats:
   - **base58 string** — paste into Phantom's "Import Private Key"
     (also works for Solflare and Backpack)
   - **64-byte JSON array** — for the Solana CLI
     (`solana config set --keypair /path/to/keypair.json`)

4. Suggest the user:
   - Save the base58 string in a password manager (1Password, Bitwarden, etc.)
   - Clear their terminal scrollback after copying, if they're on a
     shared machine
   - Test the restore in a wallet they control before relying on it

5. If the user pastes the secret somewhere visible (a screenshot, a
   shared chat), warn them to rotate the wallet by sending funds to a
   fresh `pnl_init`-generated address.
