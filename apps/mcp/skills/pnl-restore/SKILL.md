---
name: pnl-restore
description: Restore a PNL wallet on this machine from a BIP39 mnemonic (12 or 24 words). Use on a new machine when the user already has the recovery phrase.
---

# /pnl-restore

The user wants to set up PNL on a new machine using the BIP39 mnemonic
from a previous `pnl_init`.

## What to do

1. Ask the user for their 12 or 24 word recovery phrase. Confirm
   they're typing it in a context they trust — once they paste it in
   chat, anyone who reads the conversation transcript could in
   principle reconstruct the wallet. This is the standard wallet-
   restore tradeoff.
2. Call the `pnl_restore` MCP tool with `{ mnemonic: <phrase> }`. If a
   wallet already exists on the machine, the tool will refuse unless
   you pass `allowOverwrite: true` — only do this if the user
   explicitly says to replace the existing wallet (and ideally after
   they've run `/pnl-export` to back it up).
3. The tool will prompt for a fresh passphrase via OS dialog. The
   user types it there, not in chat.
4. On success: confirm the restored address and tell the user the
   wallet is unlocked for 30 minutes.

## Common follow-ups

- "Why do I need a new passphrase?" → The passphrase encrypts the
  wallet at rest on THIS machine. It's independent of the mnemonic
  (which is what actually controls the funds). You can use the same
  passphrase as before, or pick a new one for this machine.
- "What if I lost the mnemonic?" → If the user has access to ANY
  machine where the wallet was previously initialized AND knows the
  passphrase for it, they can run `pnl_export_keypair` to retrieve
  the secret. Without either, the funds are unrecoverable — that's
  the harsh reality of self-custody.
