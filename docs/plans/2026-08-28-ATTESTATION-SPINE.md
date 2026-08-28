# The Resolvable Project — unfragmenting PNL

*2026-08-28. Rev 2. Written after a full read of branch `2026` (HEAD `8143972`,
2026-07-04), then revised after an adversarial review by Codex (GPT-5-class, read-only,
full repo access). **Rev 1 of this doc proposed an attestation primitive as the spine.
That was wrong and is corrected below** — the correction is kept visible because the
mistake is instructive.*

---

## What is actually built (verified, not remembered)

**On-chain, live on mainnet.** Anchor 0.30.1 program `errors` at
`C5mVE2BwSehWJNkNvhpsoepyKwZkvSLZx29bi4MzVj86` — confirmed deployed and executable under
`BPFLoaderUpgradeable`. `create_market`, `buy_yes/no`, `claim_yes/no`, `resolve_market`,
`refund`, `close_market`, treasury, founder + team vesting, `migrate_market_v2`.

⚠️ **`expire`, `finalize_yes`, and `finalize_no` are dead code** — commented out in
`lib.rs:224` (*"Commented out due to compatibility issues with new state structure"*).
`expire.rs` still references `market.state`, `expiry_ts`, `total_sol_in`,
`target_lamports` — **none of which exist** on the current `Market`. It would not
compile. Do not reason about the permission model from that file; `resolve_market` is
the only live resolution path.

**Research — substantial, entirely off-chain.** 43 API routes. IPFS (Pinata), append-only
versioning, author-by-wallet profiles, search, citation index, programs, and a full
GitHub repo browser per paper.

**Identity — three real integrations.** ORCID OAuth (`lib/orcid.ts`, verified, badge).
Zenodo DOI minting (author-gated, irreversibility-aware, 5/hr). GitHub OAuth + a GitHub
App with installation tokens in a `GithubInstallation` collection.

**Terminal — `@pnlmarket/mcp-server` v0.5.1, 19 tools.** scrypt N=2¹⁷ + AES-256-GCM
custody with a param-tamper check, SIWS-style ed25519 auth (live on markets only), and a
device-authorization flow.

**Production reality:** 7 research papers, newest 2026-07-08. Branch `2026` last commit
**2026-07-04**. Markets are founder-seeded, pools 0–0.03 SOL — the June doc's own word:
*pre-demand*.

---

## The fragmentation, and its actual cause

Nine seams: five identity systems joined by convention not cryptography · research with
zero on-chain representation · authorship session-authed (`research/create` is
`withAuth`; `verifyMcpSignature` appears only in `api/mcp/markets/*`) · `ProjectSchema`
has no `githubUrl`, so code is four hops away through a thesis citation · git data inert
· `PaperCitationSchema` **requires** `projectId`, so no paper→paper graph · 19 MCP tools,
none touching research · markets that don't resolve.

**Cause:** three products — prediction markets, research publishing, a GitHub trust
layer — share one database and no spine. Each 70–80% done, none finished. Every seam is
a place where two of the three had to meet and there was nothing to meet *on*.

---

## The spine is the resolvable project — not a cryptographic primitive

**Rev 1 said the spine was an `attest(content_hash, kind, uri)` PDA. That confused a
mechanism for an object.** The spine is:

> A project makes a falsifiable claim, publishes evidence, links its implementation,
> attracts conviction, and settles against observable results.

```
claim → evidence (papers) → repository → milestones → market → resolution receipt → reputation
```

Research supplies evidence. GitHub supplies implementation activity *and outcome
evidence*. Markets price conviction. Settlement turns outcomes into trust. The GitHub
layer is not a third product or a tab — it is an evidence and resolution provider.

What this excludes, deliberately: generic prediction markets, generic academic
publishing, a generic GitHub browser. Keep only the parts that serve resolvable
technical projects.

### Why the attestation idea was wrong as a spine

- **Self-attestation is not an oracle.** A builder signing `kind: Release` proves nothing
  about what GitHub published. Rev 1 had the builder settling their own market.
- **A wallet signature is not authorship.** It proves a wallet asserted a hash.
- **Identity stays unbound.** ORCID and a GitHub installation do not become
  cryptographically linked because the same wallet appears in Mongo.
- **`owner/repo` is mutable and not content-addressed.** Repo pinning was undefined.
- **DOI writeback breaks immutability** and forces realloc. A DOI must be a *separate
  linking statement*.
- **Absence cannot be attested.** "No release by the deadline" needs a trusted clock, not
  a positive signature.

The salvageable core, for *later*: an immutable **statement envelope** —
`issuer + subject namespace/id + predicate/schema version + evidence hash + issued_at +
supersedes` — with **typed issuers**: the author wallet ("I publish this"), a GitHub
App-backed observer ("GitHub emitted this"), a resolver authority ("this satisfied
milestone X"). One account per statement, explicit seeds. Compact hashes on-chain, rich
metadata off-chain.

---

## Do we modify the smart contracts? **Yes — additively, and not first.**

⚠️ **Correction to an earlier reading (mine and Codex's both).** `resolve_market.rs:158`
computes the outcome purely from pool mechanics:

```rust
if pool_balance < target_pool      { Refund }
else if yes_shares > no_shares     { YesWins }   // → pump.fun launch, 65% to YES
else if no_shares > yes_shares     { NoWins }    // → 95% of pool to NO
else                               { Refund }
```

We both called this a limitation. **It is not — it is the specified design.**
`docs/mechanics/overview.mdx` defines PNL as *"a conviction market for ideas"* where *"at
expiry, the side with more pooled SOL wins,"* and names the differentiator as **"NO voters
paid to filter."** A conviction market is *supposed* to resolve by conviction. The program
implements the whitepaper correctly.

**Decision (Biswa, 2026-08-28): milestone-settled projects are ADDED alongside
tokenization, not a replacement.** Two market types coexist:

| | resolves on | the bet is about |
|---|---|---|
| **Conviction** (today, live) | pooled SOL at expiry | does this *idea* deserve to launch |
| **Milestone** (new) | a git event by a deadline | did this *builder* ship |

That makes the contract work **additive and much safer** than a replacement would be:

- add a `resolution_mode: Conviction \| Milestone` discriminator to `Market`, defaulting
  to `Conviction` so **every existing market and every live position is untouched**
- for `Milestone` only: immutable `resolver` + `rules_hash`, set at creation
- resolution branches on the mode. `Conviction` keeps today's logic **verbatim** —
  including the founder-early and share-majority paths, which Codex advised removing on
  the assumption of a replacement. **That advice does not apply here; removing them would
  break the live product.**
- the `Milestone` branch accepts `outcome: Yes|No` + an evidence hash (merge SHA),
  requires the authorized resolver's signature and `now >= expiry_time`, and records
  outcome + evidence *before* any payout
- ⛔ never let the builder's own signature settle their own milestone market

Nothing off-chain substitutes for this: a crank cannot transmit a verdict the program has
no field to receive, and encoding the answer by moving share balances is manipulation, not
resolution.

**Distinguish the two failures.** *"Deadline passed, nobody called"* is an ops/crank gap —
Solana does not self-execute. *"The program cannot settle from GitHub evidence"* is a
genuine gap in the new mode. Only the second needs the upgrade.

⛔ **Do not launch real-money milestone markets until that mode exists.** Conviction
markets are unaffected and keep running throughout.

---

## Build order

**Step 0 — the manual pilot. Zero new code.** Publish one immutable rule tuple; two
participants take opposing positions with negligible manual escrow; the builder attempts
one milestone PR; at the deadline **two independent humans adjudicate without conferring**;
publish verdict + evidence; pay manually.
*Falsified if the two adjudicators disagree from the same pinned evidence, or a
structurally qualifying PR passes while plainly failing the milestone.*

**The v1 rule.** "Shipped" = merged, not deployed. Pin at market creation, in the existing
IPFS metadata: GitHub **numeric** repo ID, displayed `owner/repo`, default branch,
baseline commit SHA, builder's **numeric** GitHub user ID, open time `T0`, UTC deadline
`D`, a binary acceptance checklist, and the resolver pubkey. YES iff a PR exists with
`merged == true`, author ID = pinned builder, base repo + branch match, `T0 < merged_at
<= D` **by GitHub's timestamp**, the merge descends from the baseline and is not reverted
on the pinned branch at `D`, and every acceptance item is met. Everything else is NO:
late merges, drafts, direct pushes, fork commits, tags, releases, screenshots. Evidence
identity is `(repository_id, PR number, merge SHA)`; duplicates collapse to one YES;
ambiguity resolves NO. **A GitHub outage leaves the market unresolved — never infer NO
from an outage.**

**The crank.** Platform-funded keeper, polls GitHub + unresolved markets every 60s.
Webhooks are wake-up hints only; polling is authoritative. At the first poll ≥ `D`,
reconstruct state through `D`, sign, settle; retry until confirmed. If down at `D` the
market freezes unresolved and backfills on recovery against the same historical
predicate — no automatic NO, no shifted deadline.

**Step 1 — wallet-signed publication (days).** The P0 spec in
`trisul/plans/2026-06-23-pnl-P0-terminal-publish-spec.md`, still unbuilt: signature auth
on research-create, `pnl_post_paper`, `authorVerified`, **unique sparse index on `doi`**.
Call it what it is — signed publication, not cryptographic authorship.

**Step 2 — the off-chain project graph.** `githubUrl` on `Project` (kills the four-hop
indirection), milestones as first-class objects with rule + deadline, automated GitHub
observation. Still no chain code.

**Step 3 — the contract upgrade.** Only after the loop demonstrably works: resolver +
rules_hash + outcome/evidence, per the minimum viable change above. Devnet, tests,
audit, then mainnet.

**Step 4 — paper→paper citations**, as typed edges over the project graph.

**Not now:** Arcium privacy, agent discovery, house concierge, project agent system —
four more plan docs, four more fragments. And **not WebMCP**: Chrome 146 shipped
`navigator.modelContext` in Feb 2026 but it is flag-gated, still W3C Draft, and no major
agent calls it yet. Watch it; building it now buys a fifth fragment and zero users.

---

## Information architecture

Routes today reflect implementation history, not a user model. `/launchpad`, `/browse`,
`/launched` are one thing: **`/discover`**, with filters Active / Closing / Research /
Shipped ("launched" is a state, not a destination). `/create` → **`/publish`**, first
choice Project or Research, both converging on the same claim graph. **`/project/[id]`
becomes canonical** and the market becomes a *section* of it, not the reverse. `/wallet`
+ `/settings` + profile + GitHub + ORCID + linked terminals → **`/account`** (Funds,
Portfolio, Identity, Connections, Preferences). Notifications is an inbox icon, not IA.
Merch, whitepaper, docs, terms, privacy → footer. `/link` and `/github/connected` are
callbacks, never destinations. Research is labelled **Evidence** in-product. Hide
`/terminal` and drop Ask from primary nav until each participates in the loop.

Primary nav: **Discover | Publish | Portfolio** + search, inbox, account.

Every card carries one stage strip: `Evidence published → Market live → Milestone due →
Settled`. The project page: claim + lifecycle state · trust strip (author identity, paper
hash/DOI, repo ownership, last verified activity) · probability + stake · the milestone
being judged with its exact rule and deadline · tabs Overview / Evidence / Build /
Milestones / Discussion · resolution history as receipts.

Retire "Plant / Orchard / Bloom" from navigation — decorative language is not a status
label.

---

## Theme — one bug, now fixed

`tailwind.config.js` consumes every shadcn token as `hsl(var(--x))`, but `globals.css`
defined them as `oklch(...)`. That composes to `hsl(oklch(...))` — **invalid CSS, silently
dropped**. So `bg-background`, `text-foreground`, `border-border`, `bg-card` and
`bg-primary` did nothing app-wide, and `layout.tsx` had to hardcode `bg-black text-white`
to render at all. The cosmic palette was defined and unused on the two most important
surfaces.

Fixed on `theme/unify-brand-tokens`: tokens are bare HSL triplets bound to the brand
(background = `--cosmic`, foreground = `--cream`, primary/ring = `--ember`, destructive =
`--signal-red`, charts = ember/peach/signal-green/forest/earth), `:root` and `.dark`
share one block, and body uses `bg-background text-foreground`.

Remaining: reserve ember for actions and live conviction, signal green/red for *resolved*
outcomes only; Fraunces for claims, mono for hashes/status/time, sans for functional
copy; standardize radius/borders/focus across the square editorial panels, rounded chat
bubbles, and 24px modal cards; strip the off-brand blue/purple still in error, loading,
and admin views.

⚠️ **The live site currently paints `bg-black` (#000) and `text-white`.** After this
change it paints `--cosmic` (#0a0814) and `--cream` (#f4eee4) — a faint warm shift
*toward* the declared brand, but a visible change. Eyeball it before it lands.

---

## ⚠️ Repo hazard — this clone was fetching one branch

`remote.origin.fetch` was pinned to `+refs/heads/2026:refs/remotes/origin/2026`. A
collaborator's branch would never have appeared locally. There are **24** branches on
`github.com/aitankfish/pnl` (the single canonical remote — not Forgejo, not `fthrvi`).

    git config --unset-all remote.origin.fetch
    git config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'

`origin/2026` at 2026-07-04 is genuinely the tip; `origin/main` is stale at 2026-04-28.

### Already built, then deliberately shelved

`chore/hide-project-pulse` (2026-06-27, **merged into `2026`**):

> *hide raw git activity (Project Pulse) from the project page… the Updates feed stays
> the founder's voice. **Git returns as the trustworthy use: founder-declared milestones
> settled by a git event (release/tag/CI).** The ProjectPulse component +
> `/api/research/[id]/repo` endpoints are kept untouched for that next build.*

A prior session built Approach A, judged raw git activity to be the wrong surface, hid
it, and left the machinery in place pointing at exactly the milestone design above.
**Step 2 has pre-built parts — re-light ProjectPulse as milestones rather than rebuilding.**

---

## What this borrows, and why it is one product

PNL fuses five things. What each reference actually solves that PNL lacks:

- **arXiv → the return rhythm.** arXiv isn't a dumping ground because of endorsement, and
  researchers return *daily* because of new/recent/cross-list. Verified ORCID is a
  stronger primitive than arXiv endorsement — but there is no reason to return daily.
- **GitHub → the page shape.** The project page should read like a repo page: claim =
  README, evidence = source, milestones = issues, settlements = releases. And add
  **watch/subscribe** — GitHub's quietest load-bearing primitive.
- **X → the conviction post.** *You cannot comment on a project without a position.*
  Quote-posting with skin in the game. Native to a prediction market, and it is the
  anti-noise mechanism for free.
- **Reddit → programs as subreddits.** `research/programs` already exists. Give a program
  its own feed and leaderboard, and **rank comments by the commenter's resolved track
  record, not upvotes.**
- **buzz.xyz → agents as visible participants.** Block's open-source Nostr workspace
  (launched 2026-07-21) puts people and AI agents in the same channels. An agent posting
  a claim on PNL should be a participant with a public track record, not a hidden API
  caller. The MCP already signs; this is mostly surfacing.

**The unifying mechanic.** All five are places where people make claims and nobody ever
finds out who was right. X keeps no record. GitHub stars measure attention. Reddit karma
measures agreement. arXiv citations measure influence — gamed and slow.

> A paper is a claim. A repo is a claim about capability. A milestone is a claim with a
> date. A comment is a claim. One mechanic underneath all of them: **make a claim, stake
> on it, get resolved, accrue a public record.**

That is not a merge of five products. It is the one thing all five are missing —
*a record of who was right.*
