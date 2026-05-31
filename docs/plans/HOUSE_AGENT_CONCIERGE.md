# PNL House Agent — The Concierge

## PNL's single, protocol-level agent: a front door for humans and a peer for other agents

Status: SKETCH · 2026-05-31
Companion docs:
- `AGENT_DISCOVERY_IMPLEMENTATION_PLAN.md` — external agents *consuming* PNL (APIs, MCP, agent-as-voter, leaderboard)
- `PNL_PROJECT_AGENT_SYSTEM.md` — *per-market* neutral analyst agents (one per project, in voice/chat)
- Shipped substrate: `apps/web/src/app/api/mcp/route.ts` — hosted remote MCP endpoint (read + deep-link tools, no key custody)

---

## 1. What it is (and what it is NOT)

The **House Agent** is **one** agent that represents the PNL protocol as a whole. It is the conversational, protocol-level layer that sits on top of the read APIs and the remote MCP. Two jobs:

1. **Concierge for humans** — a chat front door on pnl.market: "what's hot right now?", "find me AI-agent markets closing soon", "explain how conviction works", "is $FOO legit on PNL?". It navigates *every* market, not one.
2. **Peer for other agents (A2A)** — a single endpoint + discoverable agent card so *another* AI agent can ask PNL questions in natural language and get a structured answer back, instead of wiring up MCP tools itself. This is the "PNL has its own agent that talks to other agents" idea.

It is explicitly **NOT**:
- **Not a custodian.** It never holds keys, never signs, never moves a user's SOL. Actions (vote/pitch/claim) are always handed back as deep-links the user signs themselves — same posture as the remote MCP.
- **Not the per-market analyst.** Those (`PNL_PROJECT_AGENT_SYSTEM`) are neutral, one-per-project, and live inside a market's voice/chat. The House Agent is singular, cross-market, and is the *router* to them ("here's the $FOO market — its project agent can go deeper").
- **Not a paywall.** Free and open, because the goal is to *grow* participation (more participants → better conviction signal), not to extract from agents. (This is why we dropped x402 for now — see session notes.)

### Where it sits

```
                         ┌─────────────────────────┐
   Humans (web chat) ───▶│                         │
                         │      HOUSE AGENT        │──▶ deep-link to sign (vote/pitch/claim)
   Other agents (A2A) ──▶│   (one, protocol-level) │──▶ hands off to per-market analyst
                         └────────────┬────────────┘
                                      │ tools (read-only)
                  ┌───────────────────┼────────────────────┐
                  ▼                   ▼                    ▼
          /api/markets/list   /api/markets/[id]    /api/v1/stats, search
          (existing)          (existing)           (existing / discovery-plan)
```

---

## 2. Architecture — reuse first

PNL is Next.js 15 on Vercel, so build the House Agent the Vercel-native way and reuse what exists.

- **Runtime:** Vercel AI SDK (agent/tool-calling loop) through the **Vercel AI Gateway** (plain `"provider/model"` strings, model fallbacks, observability). Default to a strong model for reasoning + a cheap model for routine answers. (The per-project plan calls Claude directly; either is fine — Gateway gives us fallback + spend visibility for free.)
- **Tools (all read-only, all already exist or are trivial wrappers):**
  - `browse_markets(status, category, sort, limit)` → `/api/markets/list`
  - `get_market(id)` → `/api/markets/[id]`
  - `search_markets(query)` → keyword/category filter over the list (thin new helper)
  - `platform_stats()` → existing platform stats / discovery-plan `/api/v1/stats`
  - `make_action_link(kind, marketId, …)` → returns a `pnl.market/...` deep-link (NOT an action; just the URL, mirroring the remote MCP write tools)
- **No new data layer.** Everything routes through the public read endpoints the remote MCP already uses, so the agent sees the exact display-ready payloads (TTL-cached).

### Surfaces

| Surface | What | Who |
|---|---|---|
| `POST /api/concierge` | NL query in → `{ answer, citations[], suggestedLinks[] }` out. Streaming. | Web chat UI + other agents |
| Web chat widget | Thin client on pnl.market calling `/api/concierge` | Humans |
| `GET /.well-known/agent-card.json` (or `/api/v1/capability`) | A2A discovery: name, description, skills, endpoint, auth, pricing=free | Other agents / directories |
| `ask_pnl` MCP tool (optional) | One more tool on the remote MCP that proxies `/api/concierge` | Agents already on our MCP |

The A2A agent card is how PNL becomes *discoverable* in the agent ecosystem — it's the analog of `llms.txt`/`robots.txt`, but for agents that want to talk to PNL as an agent rather than crawl it.

---

## 3. Neutrality & guardrails

Inherit the four-layer neutrality framework from `PNL_PROJECT_AGENT_SYSTEM` (structural separation, dual-perspective framing, source attribution, formula-based signals), plus concierge-specific rails:

- **Sourced or silent.** Every market claim cites live data ("73% YES, 0.4 SOL pooled, closes in 2d"). No invented numbers.
- **No financial advice.** It informs and routes; it never says "you should stake YES." It can surface the bull/bear framing and the on-chain facts.
- **Prompt-injection hardening.** Market descriptions and project metadata are untrusted input — sanitize before they enter the agent context (founders will try to make the House Agent shill).
- **Action = deep-link, always.** The only "write" it can produce is a URL the human opens and signs.
- **Honest uncertainty.** "I don't have data on that" beats a confident guess.

---

## 4. Build phases (lean → reach)

**Phase 0 — Concierge endpoint + web chat (ship first, ~days).**
`POST /api/concierge` with the read-only tool set + AI Gateway, and a minimal chat widget on pnl.market. Humans can ask anything about live markets and get sourced answers + deep-links. Zero custody, zero new infra beyond an AI Gateway key.

**Phase 1 — A2A discovery (small).**
Publish the agent card (`/.well-known/agent-card.json`) and harden `/api/concierge` for agent callers (structured JSON mode, rate limiting like the remote MCP's 120/min/IP). Now other agents can find and query PNL conversationally. Optionally add the `ask_pnl` MCP tool.

**Phase 2 — Hand-off to per-market analysts.**
When a query narrows to one market, the House Agent calls/links the per-project agent from `PNL_PROJECT_AGENT_SYSTEM` for the deep dive. The concierge becomes the router; the analysts are the specialists.

**Phase 3 — Proactive (optional, later).**
Digest/notify surface ("3 AI-agent markets closing in 24h, here's the conviction split"), and presence in agent directories. Still read-only.

**Deliberately deferred (separate, intentional decisions):** market-making / taking the other side, any custodial flow, any paid tier. These re-open the custody + liability questions we parked.

---

## 5. Cost

Pure per-call LLM cost, same shape as the per-project plan's Phase 0 (~$0.01–0.05/answer depending on model + tool round-trips). The AI Gateway gives spend visibility and lets us route routine answers to a cheap model. No background processes in Phase 0–1. Keep the standing rule: agent compute < ~10% of trading-fee revenue.

---

## 6. Open questions

1. **Model routing** — one strong model for everything, or cheap-model-first with escalation on hard queries?
2. **Memory** — stateless per query (simplest), or lightweight session memory for multi-turn chat?
3. **A2A protocol flavor** — agent card now; do we also speak a formal A2A handshake (Google A2A / similar) or keep it as a plain documented JSON endpoint until an agent actually asks for it?
4. **Relationship to the discovery plan's `/api/v1/capability`** — fold the agent card into that endpoint, or keep a dedicated well-known path?
5. **Per-market analyst hand-off** — call them server-side and synthesize, or just deep-link the user into the market's room?
```
