# PNL Per-Project AI Agent System

## Every Project Gets a Neutral AI Research Analyst

---

## Table of Contents

1. [The Concept](#1-the-concept)
2. [The Three Surfaces](#2-the-three-surfaces)
3. [Neutrality Framework](#3-neutrality-framework)
4. [Lean Architecture (Day 1)](#4-lean-architecture-day-1)
5. [Scaling Progression](#5-scaling-progression)
6. [Implementation Plan](#6-implementation-plan)
7. [Agent Intelligence Feed](#7-agent-intelligence-feed)
8. [Cost Model](#8-cost-model)
9. [Differentiators](#9-differentiators)

---

## 1. The Concept

Every market/project on PNL gets its own AI agent. The agent is:
- **Neutral** — not aligned with the founder or critics
- **Knowledgeable** — trained on project data (pitch, docs, GitHub, social)
- **Present** — lives in the voice room and chat room
- **Productive** — generates intelligence for the Agent Feed (4th screen)

The agent is the connective tissue between the three engagement layers:
```
Feed (discover) → Voice Room (debate) → Chat Room (inner circle)
                         ↑                      ↑
                   Agent speaks           Agent posts updates
                   Agent answers          Agent monitors GitHub/X
                         ↓                      ↓
                   Agent Intelligence Feed (daily raw takes)
```

---

## 2. The Three Surfaces

### Surface 1: Voice Room Presence
- Agent joins as a bot peer via mediasoup (server-side)
- LLM → TTS → audio stream to room
- STT on room audio → agent "hears" users
- Speaks when: user joins (welcome pitch), user asks question, new event occurs, room goes quiet
- Does NOT dominate — responds, doesn't monologue

### Surface 2: Chat Room Intelligence
- Posts structured cards for events:
  - GitHub pushes, PRs, releases
  - X/Twitter posts and mentions
  - Whale votes, pool milestones
  - Founder announcements
- Responds to @agent mentions with context-aware answers
- Summarizes daily discussion on demand

### Surface 3: Agent Intelligence Feed (4th Tab)
- Each agent produces a daily "raw take" for its project
- Structured: signal rating (STRONG/CAUTION/VERIFIED/NEUTRAL) + reasoning
- Aggregated into a scrollable feed for all projects
- Personalized: projects you voted on first, then trending, then new

---

## 3. Neutrality Framework

### The Problem
If agents shill, the platform loses trust. Founders will try to manipulate. Critics will claim bias.

### The Solution: Four-Layer Neutrality

**Layer 1: Structural Separation**
- Agent is created by PNL, not the founder
- Founder cannot edit agent's system prompt or delete its posts
- Agent has access to ALL data including negative signals

**Layer 2: Dual-Perspective Framing**
Every opinion includes both sides:
```
Bull case: 84% retention, $4k MRR, 3 prior exits
Bear case: Single founder, no enterprise contracts, crowded market
```

**Layer 3: Source Attribution**
No unsourced claims. Every statement cites:
- "According to the pitch video (0:45)..."
- "GitHub shows 47 commits in 7 days..."
- "On-chain data: 73% YES, avg position $120..."

**Layer 4: Formula-Based Signals (not opinion)**
```
STRONG   = GitHub active (7d) + funding >50% + team verified + sentiment >60% bullish
CAUTION  = One+ red flags (no code 14d, anon team, stale activity)
VERIFIED = Claims independently confirmed
NEUTRAL  = Insufficient data
```

### Anti-Manipulation
- Project descriptions sanitized before agent context (no prompt injection)
- Founder chat messages labeled but don't override analysis
- Discrepancy detection: "Founder claims 1M users but GitHub has 3 commits"
- Wash trading detection on voting patterns

---

## 4. Lean Architecture (Day 1)

**The agent is NOT a running process. It's a context window assembled on demand.**

### Phase 0: @agent Chat Command ($0-30/month)

One API endpoint. That's the whole system.

```
POST /api/chat/agent-reply

Trigger: Chat message starts with "@agent"

Flow:
1. Fetch project data from MongoDB
   - name, description, pitch transcript, stats
   - pool progress, vote counts, founder wallet
2. Fetch last 20 chat messages for conversational context
3. Call Claude API:
   - System prompt: neutral analyst persona
   - Context: project data + recent chat
   - User query: whatever they asked
4. Post response to chat via Socket.IO as bot user
   - Display name: "PNL Agent"
   - Avatar: branded bot icon
   - Badge: "AI" label on message
5. Cost: ~$0.01 per response

That's it. No infrastructure. No background processes.
```

### System Prompt (v1)
```
You are a neutral research analyst for the project "{projectName}" on PNL.

PROJECT DATA:
{description}
{stats: poolProgress, yesVotes, noVotes, totalStaked}
{founderWallet, createdAt, expiryDate}

RULES:
- You are NOT the founder's advocate. You are a neutral analyst.
- Always present BOTH bull and bear perspectives.
- Cite your sources (project data, chat history, on-chain data).
- Never recommend buying, voting, or investing.
- If you don't know something, say "I don't have data on that."
- Keep responses concise (2-4 sentences unless asked for detail).
- Flag discrepancies between claims and observable data.
```

### What Users See
```
@mike: @agent what is this project about?

PNL Agent [AI]: This is an AI tutoring app targeting K-12 education.
According to the pitch, it's already in 200 schools with 84% retention.
The pool is 73% funded with 67% YES votes. Worth noting: the team
is a single founder with no co-founder listed.
```

---

## 5. Scaling Progression

### Phase 1: Event-Driven Auto-Posts ($30-100/month)
*Add when: 50+ daily active users*

- GitHub webhook integration: founder links their repo
  - On push: agent posts commit summary to chat
  - On release: agent posts release notes
- On-chain event triggers:
  - Whale vote (>5 SOL): agent posts alert
  - Pool milestone (25%, 50%, 75%, 100%): agent posts update
- X/Twitter monitoring (optional, founder links account)
  - Founder tweets: agent reposts with context

Implementation: Event listeners → one Claude/Haiku call per event → chat post.
No polling. No background processes. Pure webhook/event-driven.

### Phase 2: Intelligence Feed ($100-300/month)
*Add when: 100+ projects with votes*

- Nightly batch job (2am UTC)
- For each project with 5+ votes in 7 days:
  - Gather: votes, chat activity, GitHub events, social mentions
  - One Haiku call: produce signal rating + 2-sentence raw take
  - Write to `agent_intelligence` MongoDB collection
- Feed UI: scrollable list on the 4th tab
- Cost: ~$0.01 per project per night

### Phase 3: Voice Room Bot ($500+/month)
*Add when: rooms consistently have 10+ listeners*

- Shared pool of voice bot workers (start with 2)
- Bot connects to mediasoup when room hits threshold
- STT on room audio, LLM response, TTS back to room
- Disconnects when room empties
- Only top 5-10 most active rooms get voice presence

### Phase 4: Full Monitoring ($2K+/month)
*Add when: platform has meaningful revenue from trading fees*

- Tiered agent activity (Dormant/Watching/Present)
- Continuous GitHub/social monitoring for top projects
- Real-time sentiment analysis
- Cross-project comparative intelligence
- Agent accuracy tracking and calibration

---

## 6. Implementation Plan

### Week 1: @agent Chat Command (Phase 0)

**Files to create:**
```
apps/web/src/app/api/chat/agent-reply/route.ts  — API endpoint
apps/web/src/lib/agent/system-prompt.ts          — Neutral analyst prompt
apps/web/src/lib/agent/project-context.ts        — Fetches project data for LLM
```

**Files to modify:**
```
apps/web/src/app/api/chat/[marketAddress]/route.ts  — Detect @agent, trigger reply
apps/mobile/src/components/community/ChatMessageItem.tsx — AI badge on agent messages
packages/shared/src/hooks/useChat.ts — Handle bot messages in UI
```

**Steps:**
1. Create `project-context.ts`: fetches project name, description, stats, votes from MongoDB
2. Create `system-prompt.ts`: assembles the neutral analyst prompt with project context
3. Create `agent-reply/route.ts`: receives message, calls Claude, returns response
4. Modify chat POST handler: when message contains "@agent", queue an agent reply
5. Agent reply posts to chat via Socket.IO as a special "agent" user type
6. Mobile: add "AI" badge to agent messages in ChatMessageItem

**Dependencies:**
- Anthropic Claude API key (or OpenAI as fallback)
- Existing MongoDB collections: markets, prediction_participants
- Existing Socket.IO chat infrastructure

### Week 2-3: Event Auto-Posts (Phase 1)

**Files to create:**
```
apps/web/src/app/api/webhooks/github/route.ts    — GitHub webhook handler
apps/web/src/lib/agent/event-handler.ts           — Processes events → agent posts
apps/web/src/lib/agent/chat-bot.ts                — Posts messages as bot user
```

**Steps:**
1. GitHub webhook endpoint: receives push/release events
2. Event handler: formats event data, calls Haiku for summary
3. Chat bot utility: posts formatted cards to project chat
4. Add GitHub repo link field to market creation form
5. On-chain event listeners (already exist for sync): trigger agent posts for milestones

### Week 4+: Intelligence Feed (Phase 2)

**Files to create:**
```
apps/web/src/scripts/generate-intelligence.ts     — Nightly batch script
apps/web/src/app/api/intelligence/route.ts         — Feed API endpoint
apps/mobile/app/(tabs)/intelligence.tsx            — 4th tab UI
apps/mobile/src/components/IntelligenceCard.tsx    — Feed card component
```

**Steps:**
1. Batch script: iterates qualifying projects, calls Haiku, writes to MongoDB
2. API endpoint: returns paginated intelligence feed
3. Mobile tab: scrollable feed with signal cards
4. Personalization: voted projects first, then trending

---

## 7. Agent Intelligence Feed

### Card Types

| Type | Icon | Description |
|------|------|-------------|
| market-fit | green | TAM analysis, competitive positioning |
| risk-scan | red | Red flags, verification failures, activity gaps |
| traction | green | Milestones, metrics, confirmed partnerships |
| sentiment | blue | Chat/voice sentiment summary |
| momentum | yellow | Voting trends, whale movements, pool changes |
| progress | green | GitHub shipping velocity, release notes |

### Signal Ratings (formula-based)

```
STRONG:
  github_commits_7d >= 10
  AND pool_progress >= 50%
  AND team_verified = true
  AND sentiment_score >= 0.6

CAUTION:
  github_commits_14d == 0
  OR team_anonymous = true
  OR pool_progress < 20% after 7 days
  OR sentiment_score < 0.3

VERIFIED:
  external_confirmation = true (grants, press, partnerships)

NEUTRAL:
  insufficient data for any rating
```

---

## 8. Cost Model

| Phase | When | Monthly Cost | Revenue Needed |
|-------|------|-------------|----------------|
| Phase 0: @agent command | Day 1 | $0-30 | $0 (free) |
| Phase 1: Event auto-posts | 50 DAU | $30-100 | Minimal fees |
| Phase 2: Intelligence feed | 100+ projects | $100-300 | Trading fees cover |
| Phase 3: Voice bots | 10+ in rooms | $500-2K | Growing fees |
| Phase 4: Full monitoring | Revenue positive | $2K-10K | Platform revenue |

**Rule: Agent compute cost should never exceed 10% of platform trading fee revenue.**

At scale (10,000 projects):
- 9,000 dormant ($9/day) + 800 watching ($40/day) + 200 present ($600/day)
- Total: ~$650/day = ~$20K/month
- Requires ~$200K/month in trading fees (1.5% fee = ~$13M monthly volume)

---

## 9. Differentiators

### Why This Can't Be Easily Copied

1. **Training data moat**: 6 months of voice transcripts, chat history, on-chain voting data per project is irreplaceable
2. **Neutrality reputation**: Platform-level neutrality score builds trust over time
3. **Network effects**: More projects → more agents → more intelligence → more users → more projects
4. **Skin-in-the-game context**: Agent knows WHO voted, HOW MUCH, and can weight opinions by stake size
5. **Cross-project intelligence**: Agent can compare similar projects, identify patterns across the portfolio

### What This Enables

- **24/7 project coverage**: Every market has a research analyst that never sleeps
- **Information symmetry**: Voters and founders have equal access to intelligence
- **Accountability**: Founders can't hide — agent surfaces GitHub inactivity, broken promises
- **Content generation**: Agents create posts, summaries, alerts — the platform generates its own content
- **Decision quality**: Better-informed voters → better market outcomes → platform credibility

---

## Relationship to Existing Agent Discovery Plan

The existing `AGENT_DISCOVERY_IMPLEMENTATION_PLAN.md` covers **external agents** interacting with PNL (agents as API consumers, voters, and portfolio managers). This document covers **internal per-project agents** that live inside the platform.

They complement each other:
- External agents use PNL's validation data to make decisions
- Internal agents generate the intelligence that makes PNL's data valuable
- External voter agents could eventually feed their analysis INTO the internal agent's knowledge
- The intelligence feed becomes a data source for external agents too

```
External Agents (AGENT_DISCOVERY plan)     Internal Agents (this plan)
────────────────────────────────────       ─────────────────────────────
Consume PNL data via API/MCP               Generate PNL intelligence
Vote on markets programmatically           Analyze markets neutrally
Portfolio management decisions             Voice room + chat room presence
Build on top of PNL                        Built into PNL
Revenue: API fees, voting fees             Revenue: engagement, retention
```
