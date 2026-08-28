# Solana Foundation USA Grant — application (pnl.market)

*2026-08-28, rev 4. Ask: $10,000 (program cap; mean award $8,307). Applicant: Bishwanath
Bastola, **individually**. Rolling, ~1 week decision, US-only.*

⚠️ **This is a COMMUNITY grant, not a code grant.** Superteam grants split three ways —
Code, Content, Community — and community grants explicitly cover *"hosting workshops,
bootcamps, or hackathons."* There is a dedicated Solana Foundation Community Grants track
for hackathon organizing ($100–$10,000) that *"recommends applicants with good proof of
work in organizing hackathons."*

Revision history: rev 1 described a spec as shipped code. rev 2 fixed the facts but
pitched PNL as a research platform. rev 3 fixed the product hierarchy but asked for
engineering money — and **nothing was actually blocked by engineering.** The real
constraint is distribution: PNL needs founders and builders on it. That is what this asks
for.

Pre-application contact: **nicky@solanaeco.io** (Nicky Scannella, Superteam USA).
Form: https://superteam.fun/earn/grants/solana-foundation-usa-grants

---

## Project name

**PNL — conviction markets for projects**

## One-liner

The community stakes YES or NO on which projects deserve to launch, and critics get paid
to filter noise. This grant brings the first real cohort of founders onto it.

## What PNL is

A conviction market for ideas, live on Solana mainnet. Anyone posts an idea for 0.015
SOL. Believers stake YES, critics stake NO. At expiry the side with more pooled SOL wins:
YES launches a token on pump.fun with 65% of supply airdropped to YES voters; NO returns
95% of the pool to the critics who called it.

**In a launchpad nobody is paid to say no, so noise is free. Here, skepticism has a
payoff.** That single mechanism is what separates PNL from both a memecoin launchpad and
a standard prediction market.

## What it is becoming

PNL borrows a piece from five places and fixes the thing all five are missing.

X hosts the claims and keeps no record of them. GitHub hosts the work but stars measure
attention, not whether anything shipped. Reddit ranks by agreement. pump.fun launches
tokens with no filter at all. Kalshi settles real questions but only about the world, not
about builders.

**Every one of them is a place where people make claims and nobody ever finds out who was
right.** A paper is a claim. A repo is a claim about capability. A milestone is a claim
with a date. PNL's bet is that one mechanic runs underneath all of them: make a claim,
stake on it, get resolved, accrue a public record.

Concretely, that means adding a second market type alongside tokenization —
milestone-settled projects, where you back a builder and a git event settles whether they
shipped. Existing conviction markets are untouched by it.

## What is actually stopping this — and it isn't code

PNL is live. The mainnet program runs the full lifecycle. Identity is real: ORCID through
OAuth, Zenodo DOI minting, GitHub App integration, and a self-custodial terminal client
doing SIWS-style signature auth. 43 research endpoints. A mobile app.

What it does not have is **people.** Markets are founder-seeded, pools are small, and a
conviction market with no crowd is just a database. No amount of engineering fixes that —
it needs founders posting real ideas and builders willing to stake against them.

**That is what this grant funds: distribution, not development.**

## The plan

**1. Three hackathons — UNM and Albuquerque ($4,500).**
I've already run and placed in hackathons on this campus, funded by non-crypto-native
sponsors. That is the population I want: builders who have never touched Solana and are
not here for a token. Each event ends with teams posting their project to PNL as a live
conviction market, so the hackathon does not evaporate on Sunday night — the judging
continues as a market, and the crowd keeps pricing it.

Albuquerque has no Solana presence whatsoever. Not a club, not a meetup, nothing. Every
builder onboarded here is net new to the ecosystem, not moved from another chain.

**2. A build-in-public cohort ($2,500).**
Ten founders, eight weeks, each running a live PNL market on their project and shipping
weekly in the open. Small stipends for completion. The output is the thing PNL needs most
and cannot fake: real projects with real stakes and a public record of who delivered.

**3. Content and documentation of the model ($1,500).**
Write up how conviction markets work as a fundraising primitive — including the
mechanism where critics are paid, which nobody else is doing. Founders do not currently
know this option exists. This is ecosystem education that outlives my project.

**4. Fraud resistance as the on-ramp ($1,500).**
The reason a stranger cannot safely stake today is that nothing under an idea is
checkable. Anyone can claim any paper, any repo, any credential. This funds wiring the
verification that already exists — ORCID, GitHub ownership, DOI provenance — into the
onboarding flow, plus written guidance so incoming founders understand what is verified
and what is merely asserted. Every new market becomes harder to fake by default.

## Proof of work

- **PNL is live on mainnet**, not a deck. Full market lifecycle on-chain, plus the
  identity stack above.
- **I have already received hackathon funding on this campus from non-crypto sponsors** —
  proof I can organize and win in this exact venue, with a builder population that has no
  crypto exposure yet.
- **I am a PhD student at UNM**, so the venue, the department relationships, and the
  student pipeline are not hypothetical.

## Why the agentic angle matters here

I am also building **Prithvi** and **Nakshatra** — a sovereign, self-hosted AI mesh and a
distributed inference layer. That is not a separate hobby; it is the backend PNL needs
for where this is going.

In the agentic era the entities posting claims and staking on them will increasingly be
agents. PNL already exposes an MCP server with self-custodial signing, so an agent can
hold its own key and act on the market today. What is missing is a public record of which
agents were *right*. I am building both halves: the market that prices claims, and the
agent infrastructure that will make them at volume.

That is why I care about the record-of-who-was-right problem specifically, rather than
building another launchpad.

## Budget

| | |
|---|---|
| Three hackathons — venue, food, prizes, materials | $4,500 |
| Build-in-public cohort — 10 founders, 8 weeks, completion stipends | $2,500 |
| Content: conviction markets as a fundraising primitive | $1,500 |
| Verification wired into onboarding + fraud-resistance guidance | $1,500 |
| **Total** | **$10,000** |

## What success looks like

Measurable, and I will report them honestly whether or not they land:

- **60+ builders** onboarded to Solana who had no prior exposure
- **25+ real projects** posted as live markets, not seeded by me
- **10 founders** completing the build-in-public cohort with public shipping records
- **A standing Solana presence at UNM** that outlives the grant period

## Links

- Product: https://pnl.market
- Code: https://github.com/aitankfish/pnl (public)
- X: https://x.com/pnldotmarket

---

## Intro email — send BEFORE the form

**To:** nicky@solanaeco.io
**Subject:** USA grant — bringing New Mexico founders onto Solana via PNL

Hi Nicky,

I'm a PhD student at the University of New Mexico building pnl.market, and I'd like to
apply for a community grant. Wanted to introduce it first.

PNL is a conviction market for projects, live on Solana mainnet. Anyone posts an idea,
believers stake YES, critics stake NO, and at expiry YES launches a token on pump.fun with
65% of supply airdropped to YES voters — while NO returns 95% of the pool to the critics
who called it. In a launchpad nobody is paid to say no, so noise is free. Here, skepticism
has a payoff.

The product is built. Mainnet program, full lifecycle, ORCID and GitHub identity, DOI
provenance, a self-custodial MCP client so an agent can hold its own key and act on the
market. What it doesn't have is people — and a conviction market with no crowd is just a
database. No amount of engineering fixes that, which is why I'm asking for community
money rather than code money.

The plan is three hackathons at UNM and in Albuquerque, plus a ten-founder
build-in-public cohort where each runs a live market on their own project. I've already
run and placed in hackathons on this campus funded by non-crypto sponsors, so I know the
venue and the builder population — and that population is the point. Albuquerque has no
Solana presence at all. No club, no meetup, nothing. Everyone onboarded here is net new
to the ecosystem, not migrated from another chain.

One piece I'd flag because it's the on-ramp problem: a stranger can't safely stake on an
idea today, because nothing underneath it is checkable — anyone can claim any paper,
repo, or credential. Part of the ask is wiring the verification PNL already has into
onboarding, so every new market is harder to fake by default.

For context on where I think this goes: I'm also building a sovereign AI mesh and a
distributed inference layer, because in the agentic era the things posting claims and
staking on them will increasingly be agents. PNL already lets an agent sign for itself.
What's missing everywhere is a public record of which ones were right.

Code: github.com/aitankfish/pnl · X: @pnldotmarket · happy to send the full budget and
target numbers, or walk through the live product.

Thanks,
Bishwanath Bastola

---

## Notes on the framing

**This asks for community money, not engineering money.** Rev 3 asked for $10k to build
M1–M3, and the honest answer to "what's blocking that" was *nothing* — the signature
primitive is already live on the markets endpoints, the spec is written, it's days of
work. Asking a grant to fund unblocked engineering is a weak ask and a reviewer will feel
it. The real constraint is that a conviction market with no crowd is just a database.

**"Critics are paid to filter" leads.** It is the row in PNL's own comparison table that
neither a launchpad nor a prediction market can claim.

**The five-platform comparison is framed as a gap, not a boast.** "More than X, GitHub,
Reddit, pump.fun and Kalshi" reads as grandiose stated flat. "Every one of them is a place
where people make claims and nobody finds out who was right" is the same claim, specific
and defensible.

**Non-crypto campus hackathon funding is the strongest credential in the application** —
Superteam's own hackathon track says it recommends applicants with *proof of work in
organizing hackathons.* Lead with it in any follow-up.

**Prithvi/Nakshatra is one paragraph, positioned as backend not side project.** Two extra
projects in a $10k application can read as unfocused; framed as "the agent layer that will
make the claims PNL prices," it reads as building for where the ecosystem is going.

## Before you send

1. **Replace the target numbers with ones you'll actually stand behind.** 60 builders /
   25 markets / 10 founders are my estimates, not yours. A reviewer may hold you to them.
2. **Name the campus hackathons you were funded by** — specifics beat "non-crypto
   sponsors."
3. If the form pushes back on $10k, hackathons + cohort alone is a coherent $7k.
4. Do not present UNM as a fiscal host — credibility and venue only. Money goes to your
   wallet.
5. Before accepting: visa/work-authorization implications (UNM Global Education Office),
   assistantship COI disclosure, and USDC taxed as property at fair market value on
   receipt.
