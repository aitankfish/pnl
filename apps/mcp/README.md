# `@pnl/mcp-server`

The Model Context Protocol server for [PNL](https://pnl.market) — let your
agent (Claude Code, Cursor, Cline, Codex, the next one) browse live
conviction markets on Solana and prepare new pitches that you confirm in
your own wallet.

PNL is a coordination market for ideas. Anyone posts an idea for $2; a
global market of believers and critics stakes real SOL on whether it
deserves to launch as a token on pump.fun. YES wins → token auto-launches,
founder earns royalties. NO wins → critics split the pool, paid for
filtering noise. The protocol is documented at
[docs.pnl.market](https://docs.pnl.market) (MIT licensed, open public API,
manifesto and transparency disclosures published).

This MCP server is the bridge from your agent window into that market.

## Status

**v0.1.0 — read tools only.** Two tools live today, two more shipping in
the same hackathon window.

| Tool | What it does | Auth |
|---|---|---|
| `pnl_browse_markets` | List live (or historical) conviction markets. Filter by status, paginate. | none |
| `pnl_get_market` | Fetch a single market's full state by id or on-chain address. | none |
| `pnl_pitch_idea` *(coming)* | Prepare a new market draft (IPFS pinning + server-side draft), return a deep-link the founder confirms in their wallet. | non-custodial deep-link |
| `pnl_vote_intent` *(coming)* | Prepare a YES/NO stake, return a deep-link the user signs in their wallet. | non-custodial deep-link |

The MCP server **never holds keys**. Write-prep tools always return
deep-links the user confirms in their own wallet. This is by design —
PNL's non-custodial framing in the
[regulatory posture](https://docs.pnl.market/docs/transparency/regulatory-posture)
section is load-bearing.

## Install (local, hackathon window)

The npm publish lands at the end of the build. Until then, run from the
monorepo build output.

```bash
git clone https://github.com/aitankfish/PnL.git
cd PnL
pnpm install
pnpm -F @pnl/mcp-server build
```

The compiled entry point lands at `apps/mcp/dist/index.js`.

## Wire it into your agent

### Claude Code

Edit `~/.claude.json` (or `~/.config/claude-code/config.json` depending
on platform) and add an entry under `mcpServers`:

```json
{
  "mcpServers": {
    "pnl": {
      "command": "node",
      "args": [
        "/absolute/path/to/PnL/apps/mcp/dist/index.js"
      ]
    }
  }
}
```

Restart Claude Code. The two tools appear in the tools panel.

### Cursor

In Cursor settings → MCP, add a server:

```json
{
  "mcpServers": {
    "pnl": {
      "command": "node",
      "args": [
        "/absolute/path/to/PnL/apps/mcp/dist/index.js"
      ]
    }
  }
}
```

### Cline / Codex / others

The server speaks standard MCP over stdio. Any host that supports MCP
should pick up `node /path/to/apps/mcp/dist/index.js` as a server.

## Environment variables

| Variable | Default | When to override |
|---|---|---|
| `PNL_API_BASE_URL` | `https://pnl.market` | Pointing at devnet, staging, or a local Next.js dev server. |

## Try it

Once wired into your agent, ask:

> "What's live on PNL right now?"

The agent should call `pnl_browse_markets` and read back the active
markets with YES%, total pool, vote counts, and a clickable URL for
each.

Then:

> "Tell me more about the first one"

Triggers `pnl_get_market` for the full market state.

## Roadmap

- `pnl_pitch_idea` — IPFS pin + server-side draft endpoint at
  `/api/markets/drafts`, returns `https://pnl.market/create?draft=<id>`
  deep-link. Founder confirms in their wallet, pays the $2 SOL fee, and
  the market goes live in one signature.
- `pnl_vote_intent` — same shape for YES/NO stakes.
- `pnl-pitch` slash command — drops a Claude Code skill manifest under
  `~/.claude/skills/pnl/SKILL.md` so an agent can ask "want to plant
  this idea on PNL?" mid-session.
- npm publish + Smithery registry submission.

## Links

- Live: [pnl.market](https://pnl.market)
- Docs: [docs.pnl.market](https://docs.pnl.market) (manifesto +
  transparency + public API reference)
- Repo: [github.com/aitankfish/PnL](https://github.com/aitankfish/PnL)
- Manifesto: [docs.pnl.market/docs/manifesto](https://docs.pnl.market/docs/manifesto)

## License

MIT.
