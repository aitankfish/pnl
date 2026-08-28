# Solana Foundation USA Grant — application (pnl.market)

*2026-08-28, rev 3. Ask: $10,000 (program cap; mean award $8,307, so the ceiling is the
right ask). Applicant: Bishwanath Bastola, **individually** — not through UNM, not through
a student club. Rolling, ~1 week decision, US-only.*

⚠️ **Every claim below was verified against branch `2026` on 2026-08-28.** Rev 1
(2026-08-27) described a spec document as shipped code. Rev 2 corrected the facts but
inverted the product — it pitched PNL *as* a research platform. PNL is a conviction
market; research is evidence underneath it. This rev fixes the hierarchy.

Pre-application contact: **nicky@solanaeco.io** (Nicky Scannella, Superteam USA).
Form: https://superteam.fun/earn/grants/solana-foundation-usa-grants

---

## Project name

**PNL — conviction markets for projects, with evidence you can verify**

## One-liner

The community stakes YES or NO on which projects deserve to launch, and critics get paid
to filter noise. This grant makes the evidence under those bets verifiable.

## What PNL is

A conviction market for ideas, live on Solana mainnet. Anyone posts an idea for 0.015
SOL. Believers stake YES, critics stake NO. At expiry the side with more pooled SOL wins:
YES launches a token on pump.fun with 65% of supply airdropped to YES voters; NO returns
95% of the pool to the critics who called it.

That last part is the mechanism I care about. In a memecoin launchpad nobody is paid to
say no, and in a standard prediction market the bet is one-sided. **Here, critics are
compensated for filtering.** Skepticism has a payoff, so noise has a cost.

## The problem this grant solves

Conviction markets price ideas — but what is the crowd actually pricing? Today, a pitch.
A title, a thesis, a target raise. Nothing underneath it is checkable.

Meanwhile the people posting ideas often have real work behind them: papers, code,
credentials. None of it can be verified by the person deciding whether to stake. So
conviction gets priced on presentation, and the filter that makes PNL different is
filtering on vibes.

The underlying gap is old and not specific to crypto. When a paper gets submitted
anywhere, the only identity check is an email address — nobody verifies the person
actually wrote it. Academia never solved the problem crypto solved years ago, proving
you're the one who made a thing. Crypto hasn't helped either, because crypto research
tools ignore the infrastructure researchers actually use, so a paper that only exists
inside a crypto app isn't citable anywhere that counts.

**PNL is in an unusual position to close it, because it already sits on both sides.**

## What ships today — verified

- **ORCID via real OAuth.** `start` / `callback` / `disconnect` / `status`,
  `lib/orcid.ts`, a verified badge, `orcidId` + `orcidVerifiedAt` on the profile. Not a
  text field the user types.
- **Zenodo DOI minting.** `lib/zenodo.ts` + `api/research/[id]/mint-doi` +
  `resolve-doi`. Author-gated, requires a PDF, refuses if a DOI already exists,
  rate-limited, and written to respect the fact that Zenodo publication is irreversible.
- **The join: the verified ORCID flows into the minted DOI's creator record.** The
  permanent, externally resolvable citation carries an identity that was actually checked.
- **Evidence already attaches to markets.** A paper can be cited as a project's thesis,
  which is how a market reaches its repository and its research today.
- **Solana as the account layer.** Author of record is the authenticated wallet, taken
  from the session and never from a request body.
- **A self-custodial terminal client.** `@pnlmarket/mcp-server` v0.5.1, 19 tools. BIP39
  key encrypted at rest with scrypt (N=2¹⁷) + AES-256-GCM, `0600`, OS-dialog passphrase,
  in-memory unlock TTL, and it refuses to decrypt if the scrypt parameters were altered.
  SIWS-style ed25519 challenge auth, live today against PNL's markets API.
- **A mainnet Anchor program** (`C5mVE2Bw…`) running the full market lifecycle, plus a
  device-authorization flow and 43 research endpoints including per-paper repo browsing.

## What the $10k buys

Two gaps stand between "evidence exists" and "a stranger can verify it before staking":
publishing is browser-only, and authorship is *session*-authenticated rather than
*signed*.

**M1 — Wallet-signed publication, from the terminal ($3,000, weeks 1–3).**
An ed25519 signature path for paper creation, reusing verification already live on PNL's
markets endpoints. The signature binds `sha256(pdf_bytes)` plus a metadata hash, so a
captured signature cannot be replayed onto a different file. Ships `pnl_post_paper`, so a
researcher — or their agent — publishes from the terminal where the work happens.
*Deliverable:* merged PR, a real paper published this way, and a one-command verification
anyone can run before they stake on it.

**M2 — The evidence graph ($4,000, weeks 4–7).**
Multi-author records with per-author ORCID. Paper→paper citations, which do not exist
today — the current citation model requires a project on one end. Import-from-DOI for
arXiv, Zenodo and Crossref that attributes the *real* authors and links the canonical
source rather than re-hosting or re-claiming it.
*Deliverable:* ≥100 imported papers forming a queryable citation graph behind a public
read API, so a market's thesis resolves to real, checkable prior work.

**M3 — Open the verification ($3,000, weeks 8–12).**
A written spec plus a standalone reference verifier, so "this Solana pubkey signed this
exact PDF, and this ORCID was verified at that time" is checkable by any application
without trusting PNL.
*Deliverable:* published package, spec document, and 3 external researchers publishing.

## What is open source

The verification spec, the reference verifier, and the terminal client. PNL's market
surface is a commercial product and I'm not claiming otherwise — the identity and
verification layer beneath it is the public good, and that is what this grant funds. Any
Solana project that needs "prove this wallet authored this artifact" can use it without
touching PNL.

## Scope discipline — what I am deliberately not promising

PNL is adding a second market type alongside tokenization: **milestone-settled projects**,
where instead of staking on whether an idea deserves to launch, you back a builder and a
git event settles whether they shipped. Existing conviction markets are untouched by it.

That needs a program change and an oracle model I have not validated yet, so it is
**deliberately outside this grant.** I would rather ship a verifiable evidence layer in
12 weeks — which both market types need regardless — than promise a chain upgrade I would
have to walk back. The manual, zero-code pilot for that resolution rule is already
specified and runs on my own time.

## Why me

I'm a PhD student at the University of New Mexico, which puts me on both sides of this: I
publish research, and I built the market that prices it. I've shipped the custody, auth,
ORCID and DOI surfaces above.

UNM has no blockchain club and no Solana presence at all. I'm working to change that this
semester, which puts the first cohort of researchers testing this a campus away rather
than hypothetical.

## Budget

| | |
|---|---|
| Engineering time (12 weeks, part-time) | $8,200 |
| IPFS pinning + RPC for the import and graph load | $1,000 |
| DOI registration and metadata deposits | $800 |

## Links

- Product: https://pnl.market
- Code: https://github.com/aitankfish/pnl (public, verified 2026-08-28)
- X: https://x.com/pnldotmarket

The **payout wallet is a form field, not part of the pitch** — Superteam pays in USDC and
needs a destination. It never appears in the email.

---

## Intro email — send BEFORE the form

**To:** nicky@solanaeco.io
**Subject:** USA grant — conviction markets with verifiable evidence (PNL)

Hi Nicky,

I'm a PhD student at the University of New Mexico building pnl.market, and I'm about to
submit for the Solana Foundation USA grant. Wanted to introduce it first.

PNL is a conviction market for projects, live on mainnet. Anyone posts an idea, believers
stake YES, critics stake NO, and at expiry YES launches a token on pump.fun with 65% of
supply airdropped to YES voters — while NO returns 95% of the pool to the critics who
called it. That's the part I care about: in a launchpad nobody is paid to say no, so
noise is free. Here, skepticism has a payoff.

The problem is what the crowd is actually pricing. Today it's a pitch — a title, a
thesis, a target raise, with nothing checkable underneath. The people posting often have
real work behind them, papers and code and credentials, and none of it can be verified by
the person deciding whether to stake. So the filter that makes PNL different is filtering
on presentation.

I'm in an odd position to fix that, because PNL already sits on both sides. In production
today: ORCID connected through real OAuth, Zenodo DOI minting that's author-gated and
treats publication as irreversible, and the verified ORCID flowing into the minted DOI's
creator record — with the Solana wallet as the account of record. The terminal client
holds keys self-custodially (scrypt + AES-256-GCM) and already does SIWS-style signature
auth against the markets API.

The gap is that publishing is browser-only and authorship is session-authenticated rather
than signed. The $10k closes it: a signature path binding the PDF hash so authorship is
verifiable by anyone before they stake, a citation graph so a thesis resolves to real
prior work, and an open spec plus reference verifier so the check doesn't require trusting
PNL.

One thing I'll say plainly — I'm adding a second market type where a git event settles
whether a builder shipped, and it's deliberately *not* in this proposal. That needs a
program change and an oracle model I haven't validated, and I'd rather ship the evidence
layer both market types need than promise a chain upgrade I'd have to walk back.

Code: github.com/aitankfish/pnl · X: @pnldotmarket · happy to send the milestone
breakdown or walk through a demo.

Separately — UNM has no Solana presence at all right now. No blockchain club, nothing.
I'm working on changing that this semester and would welcome a pointer on how Superteam
USA likes to plug into a new campus.

Thanks,
Bishwanath Bastola

---

## Notes on the framing

**PNL is the conviction market. Research is evidence underneath it.** Rev 2 had this
backwards and pitched a research platform, which both mis-describes the product and is a
thin story — 7 papers in production. A live conviction market hardening its evidence layer
is a much better one, and it explains why a narrow $10k deliverable matters.

**"Critics are paid to filter" is the strongest line in the pitch.** It is the row in
PNL's own comparison table that neither a launchpad nor a prediction market can claim.
Lead with it.

**Voice is first person throughout**; PNL is named as the product. A one-person sign-off
under "we" invites the question of who else there is.

**The problem paragraph is written for a crypto operator, not an academic.** Nicky runs
Superteam USA. He will not reconstruct the academic incentive chain from "publishing
verifies an email address," so it names the concrete failure — nobody checks that you
wrote it — and anchors it to something he already lives in.

**Keep the scope-discipline paragraph.** Volunteering what is *not* promised is the most
credible thing in the message to a reader who sees applications promising on-chain
everything, and it means nothing has to be walked back.

## Before you send

1. If the form pushes back on $10k, M1+M2 alone is a coherent $7k.
2. Do not present UNM as a fiscal host. It is credibility and a user base only — the
   money goes to your wallet, not through the university.
3. Before accepting: visa/work-authorization implications (UNM Global Education Office),
   assistantship COI disclosure, and USDC taxed as property at fair market value on
   receipt.
