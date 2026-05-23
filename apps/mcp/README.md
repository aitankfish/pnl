# `@pnlmarket/mcp-server`

The Model Context Protocol server for [PNL](https://pnl.market) — let
your agent (Claude Code, Cursor, Cline, Codex, the next one) browse
live conviction markets on Solana, pitch new ideas as markets, and
stake YES / NO without leaving the terminal.

PNL is a coordination market for ideas. Anyone posts an idea for ~$2
in SOL; a global market of believers and critics stakes real SOL on
whether it deserves to launch as a token on pump.fun. YES wins → token
auto-launches, founder earns royalties. NO wins → critics split the
pool, paid for filtering noise. The protocol is documented at
[docs.pnl.market](https://docs.pnl.market) (MIT licensed, open public
API, manifesto + transparency disclosures published).

This MCP server is the bridge from your agent window into that
market.

## Status

**v0.3.0 — autosign live.** 13 tools across read, identity, wallet,
and market actions.

### Read tools (no auth)

| Tool | What it does |
|---|---|
| `pnl_help` | Discovery menu — every tool, current wallet state, next step |
| `pnl_browse_markets` | List live (or historical) conviction markets, filter by status, paginate |
| `pnl_get_market` | Fetch a single market's full state by id or on-chain address |

### Wallet tools (local, encrypted at rest)

| Tool | What it does |
|---|---|
| `pnl_init` | First-run: generate BIP39 mnemonic + Ed25519 keypair, encrypt with passphrase, write to `~/.config/pnl/wallet.enc` (mode 0600) |
| `pnl_wallet` | Address, balance, lock state, autosign cap, active RPC |
| `pnl_unlock` | Decrypt secret in memory for N min (default 5, max 60). Passphrase via `PNL_PASSPHRASE` env or OS-native dialog — **never** typed in chat |
| `pnl_lock` | Wipe cached secret immediately |
| `pnl_restore` | Rebuild wallet on a new machine from a BIP39 mnemonic |
| `pnl_export_keypair` | Write secret to a 0600 file for password-manager backup (path returned, never the secret itself) |

### Identity

| Tool | What it does |
|---|---|
| `pnl_set_username` | Claim or rename your PNL username — signature-auth, no Privy session needed |

### Market actions

Two flows for each write action:

- **Deep-link** (browser signs) — works on any wallet, no MCP unlock needed
- **Autosign** (MCP signs locally) — for amounts inside the autosign cap, no browser bounce

| Tool | Mode | What it does |
|---|---|---|
| `pnl_pitch_idea` | Deep-link | Draft a market, return `pnl.market/create?draft=<id>` for the user to confirm + sign in their browser wallet |
| `pnl_pitch_now` | Autosign | Pin metadata, build + sign the `create_market` tx locally, persist via sig-auth. One shot, no browser |
| `pnl_vote` | Deep-link | Return `pnl.market/market/<id>?vote=&amount=` deep-link for the user to sign in browser |
| `pnl_vote_now` | Autosign | Build + sign the `buy_yes` / `buy_no` tx locally for stakes under the cap |

### Trust model

The MCP server holds an encrypted keypair on the local disk. The
passphrase is never delivered through the agent's chat transcript —
it comes from `PNL_PASSPHRASE` (set in your MCP host config) or an
OS-native dialog. Cached secrets time out automatically and on
`pnl_lock`.

Autosign is bounded by the **autosign cap** (defaults 0.05 SOL),
configurable via `pnl_unlock`'s output or by editing
`~/.config/pnl/config.json`. Per-call override available via
`autosignCapSol`. Anything above the cap requires the deep-link
flow — by design.

PNL's non-custodial framing in the
[regulatory posture](https://docs.pnl.market/docs/transparency/regulatory-posture)
section is load-bearing — the MCP only signs with keys the user
controls on their own machine.

## Install

### One-shot installer (recommended)

After `pnpm install && pnpm -F @pnlmarket/mcp-server build`:

```bash
npx @pnlmarket/mcp-server install --write
```

That wires the MCP server into every supported host config it
finds on the machine (Claude Code, Cursor, Cline, Codex, Windsurf)
and copies the 13 slash-command skills into
`~/.claude/skills/`.

Run without `--write` first to see the plan. Flags:

- `--skills` — only install the slash commands, skip MCP config writes
- `--no-skills` — skip slash commands, only wire MCP servers

### Manual

The compiled entry point is `apps/mcp/dist/index.js`.

```json
{
  "mcpServers": {
    "pnl": {
      "command": "node",
      "args": ["/absolute/path/to/pnl/apps/mcp/dist/index.js"]
    }
  }
}
```

## Slash commands (Claude Code)

The installer drops these into `~/.claude/skills/`:

```
/pnl-help            /pnl-browse          /pnl-name
/pnl-init            /pnl-pitch           /pnl-restore
/pnl-wallet          /pnl-pitch-now       /pnl-export
/pnl-unlock          /pnl-vote
/pnl-lock            /pnl-vote-now
```

Each is a small Markdown skill manifest that tells the agent how
to gather the right context from the conversation and which tool
to call.

## Environment variables

| Variable | Default | When to override |
|---|---|---|
| `PNL_API_BASE_URL` | `https://pnl.market` | Pointing at devnet, staging, or a local Next.js dev server |
| `PNL_RPC_URL` | `https://pnl.market/api/mcp/rpc` (hosted proxy) | BYO Helius key (recommended for heavy use — grab one at [helius.dev](https://helius.dev) and set this to your endpoint) |
| `PNL_PASSPHRASE` | (prompt via OS dialog) | Skip the OS-native unlock prompt — useful when running an agent unattended, but only set this in your MCP host config, never in shell history |

The default RPC is the hosted proxy. It works zero-setup; under
load it's rate-limited to 60 reads/min and 10 sends/min per IP.
Set `PNL_RPC_URL` to your own Helius endpoint to bypass that.

## Try it

Once wired into your agent:

> "What's live on PNL right now?"

Triggers `pnl_browse_markets` — active markets with YES%, pool size,
vote counts, clickable URLs.

> "Set me up on PNL"

The agent walks `pnl_init` (mnemonic + passphrase), funds-the-wallet
hint, `pnl_unlock`, `pnl_set_username`.

> "Pitch this idea on PNL and sign it for me"

If the wallet is unlocked and the creation fee fits the autosign
cap, the agent calls `pnl_pitch_now` and the market is live in
~10s — no browser bounce. Otherwise it falls back to `pnl_pitch_idea`
(deep-link).

> "Stake 0.02 YES on the Nakshatra market"

Same shape — `pnl_vote_now` if within cap, `pnl_vote` if not.

## Wallet file layout

```
~/.config/pnl/
├── wallet.enc          # encrypted secret + metadata (mode 0600)
├── config.json         # autosign cap + RPC URL (mode 0644)
└── exports/            # timestamped backup dumps (mode 0700)
```

Crypto: scrypt (N=2^17, r=8, p=1) → AES-256-GCM. BIP39 12-word
mnemonic at the Phantom-compatible derivation path
`m/44'/501'/0'/0'` so backups import cleanly into
Phantom / Solflare / Backpack and vice versa.

## Backend surface

The MCP autosign flows talk to four sig-auth-aware endpoints on
pnl.market:

```
POST /api/mcp/rpc                            JSON-RPC proxy → Helius
POST /api/mcp/markets/build-create-tx        unsigned create_market tx
POST /api/mcp/markets/complete-create        sig-auth → persist Project + Market
POST /api/mcp/markets/build-vote-tx          unsigned buy_yes / buy_no tx
POST /api/mcp/markets/complete-vote          sig-auth → persist TradeHistory + counts
POST /api/mcp/profile                        sig-auth → username claim/rename
```

The challenge format is canonical:
`pnl-mcp:<kind>:<fingerprint>:<nonce>` where `<kind>` is one of
`complete-create | complete-vote | profile`, `<fingerprint>` is
either the tx signature (for complete-*) or the username (for
profile), and `<nonce>` is `<unix-ms>-<hex>` with a 5min freshness
window + 1min clock-skew tolerance. The MCP signs with the local
keypair; the backend verifies the signature is good for the
claimed wallet via tweetnacl.

## Links

- Live: [pnl.market](https://pnl.market)
- Docs: [docs.pnl.market](https://docs.pnl.market) (manifesto + transparency + public API reference)
- Repo: [github.com/aitankfish/pnl](https://github.com/aitankfish/pnl)
- Manifesto: [docs.pnl.market/docs/manifesto](https://docs.pnl.market/docs/manifesto)

## License

MIT.
