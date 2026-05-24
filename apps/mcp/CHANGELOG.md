# @pnlmarket/mcp-server changelog

All notable changes to the published npm package are listed here.
Version line corresponds to the version on
[npm](https://www.npmjs.com/package/@pnlmarket/mcp-server).

## 0.5.0 — 2026-05-24

**Security release. All users on 0.4.x should upgrade.**

```bash
npm i -g @pnlmarket/mcp-server@latest
# or
pnpm add -g @pnlmarket/mcp-server@latest
```

### Fixed (security)

- **CRIT — Mnemonic was passed as a tool argument** to `pnl_restore`,
  which routed the BIP39 recovery phrase through the agent's chat
  transcript (Claude Code history, Anthropic API logs, anywhere the
  conversation got exported). Anyone with that history owned the
  wallet anywhere. Fixed: `pnl_restore` now takes **no arguments**;
  it reads the phrase via OS-native dialog (osascript on macOS,
  zenity on Linux), same pattern as the passphrase. The agent
  process never sees the words. Headless fallback: `PNL_MNEMONIC`
  env var (set in MCP host config only, never shell history).
- **MED — `allowOverwrite: true` from agent silently nuked existing
  wallet.** A prompt-injected agent could pass this boolean and
  replace the user's wallet with attacker-supplied seed. Fixed: the
  field is gone from the tool input. When `pnl_restore` detects an
  existing wallet, a second OS-native YES/NO dialog opens showing
  OLD address + NEW address (from supplied phrase); the user must
  click "Replace wallet" to proceed. Agent prompt-injection can't
  synthesize that click.
- **HIGH — Autosign cap was per-call only, no rolling window.** The
  per-transaction cap correctly prevented the agent from raising
  its ceiling via tool args, but didn't bound total spend — N
  sub-per-tx-cap calls in a loop drained the wallet (e.g., 0.05
  SOL cap × 100 calls = 5 SOL). Fixed: added daily cap (`dailyAutosignCapSol`,
  default 0.5 SOL). Spent total persisted at `~/.config/pnl/spent.json`,
  resets at UTC midnight. Reservation happens BEFORE sign so racing
  autosign calls in the same process can't both pass a stale check;
  rolled back on send failure so users keep their budget for retries.

### Added

- **`PNL_MNEMONIC` env var** for headless `pnl_restore` (Windows,
  CI, container environments where the OS dialog can't open).
- **`dailyAutosignCapSol` config field** at `~/.config/pnl/config.json`.
  Default 0.5 SOL. Edit the file directly to change — no tool arg
  bypass.
- **`~/.config/pnl/spent.json`** — daily-spend state file (mode 0600).
  Resets automatically at UTC midnight.
- **In-session update banner** — MCP fire-and-forgets a request to
  the npm registry on startup; if a newer version is published, the
  first tool reply in that session prepends a banner pointing at the
  upgrade command + release notes. One-shot per session, never blocks
  startup, never throws on failure.

### Breaking changes

- `pnl_restore` tool input schema is now empty (`{}`). Old callers
  passing `{ mnemonic, allowOverwrite }` get a Zod validation error
  instructing them to retry without args.
- Skill manifests in `~/.claude/skills/` need to be re-installed for
  the new `pnl_restore` flow. Run `npx @pnlmarket/mcp-server install --write`
  again, or update `~/.claude/skills/pnl-restore/SKILL.md` by hand.

## 0.4.x

- `pnl_pitch_now`, `pnl_vote_now`, `pnl_claim_now` autosign flows
- Sig-auth payload binding on `/api/mcp/markets/complete-*` routes
- Cache mnemonic in mode-0600 file under `~/.config/pnl/exports/`
  instead of returning via reply
