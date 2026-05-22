# PNL skills for Claude Code

Short slash commands that wrap the `@pnl/mcp-server` tools. Install
these once and you can type `/pnl-init`, `/pnl-wallet`, `/pnl-browse`,
`/pnl-pitch`, `/pnl-export` in any Claude Code session instead of
asking the agent to call MCP tools by name.

## What they do

| Command | What it does | MCP tool it wraps |
|---|---|---|
| `/pnl-init` | First-run setup. Generate a local Solana keypair and show the deposit address. | `pnl_init` |
| `/pnl-wallet` | Show the local wallet's address, balance, autosign cap, RPC. | `pnl_wallet` |
| `/pnl-browse` | List live conviction markets on PNL with YES%, pool, votes. | `pnl_browse_markets` |
| `/pnl-pitch` | Pitch an idea from the current conversation. Extracts context, asks the user for missing fields, returns a deep-link to post the market. | `pnl_pitch_idea` |
| `/pnl-export` | Back up the local keypair (base58 + JSON-array). Requires confirmation. | `pnl_export_keypair` |

## Install

Copy each skill directory into your Claude Code skills folder:

```bash
# macOS / Linux
cp -R apps/mcp/skills/pnl-* ~/.claude/skills/

# or, symlink them so updates flow without recopying:
for d in apps/mcp/skills/pnl-*; do
  ln -s "$(pwd)/$d" "$HOME/.claude/skills/$(basename "$d")"
done
```

Restart Claude Code. The five commands appear in `/help`.

## Prereq

You also need the MCP server itself wired into Claude Code's
`mcpServers` config. See `apps/mcp/README.md` for that — once the
server is registered, these skills tell the agent how to use it.

## Customization

Each skill is a single `SKILL.md` with frontmatter (name +
description) and free-form instructions to the agent. Edit them to
match your team's pitch style, default target pool, default duration,
etc. — they're just markdown.
