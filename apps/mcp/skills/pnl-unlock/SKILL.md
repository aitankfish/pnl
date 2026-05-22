---
name: pnl-unlock
description: Unlock the PNL wallet for signing. Passphrase is requested via OS-native dialog or PNL_PASSPHRASE env var — never via chat.
---

# /pnl-unlock

The user wants to enable signing on their PNL wallet for the current
session.

## What to do

1. Call the `pnl_unlock` MCP tool. Optional arg: `ttlMinutes` (default 5).
2. The tool will request the user's passphrase via PNL_PASSPHRASE env
   or by popping an OS-native dialog. **You will never see the
   passphrase.** Relay the response.
3. On success: confirm the wallet is unlocked and for how long.
4. On failure ("passphrase is incorrect"): suggest the user re-run the
   command; the passphrase prompt will reappear.

## Important

Never offer to put the passphrase in a tool argument or chat message.
The whole point of the unlock flow is that the passphrase stays out of
the conversation. If the user types their passphrase in chat anyway,
mention that they should rotate the wallet (pnl_export_keypair, send
funds to a fresh pnl_init, restore on the same machine with new
passphrase via pnl_restore).
