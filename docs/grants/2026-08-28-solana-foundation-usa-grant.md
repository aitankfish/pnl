# Solana Foundation USA Grant — application (pnl.market)

*2026-08-28. Ask: $10,000 (program cap; mean award $8,307, so the ceiling is the right
ask). Applicant: Bishwanath Bastola, **individually** — not through UNM, not through a
student club. Payout to a personal Solana wallet. Rolling, ~1 week decision, US-only.*

⚠️ **Every claim below was verified against branch `2026` on 2026-08-28.** An earlier
draft (2026-08-27) described the P0 *spec document* as shipped code and claimed
cryptographic authorship that does not exist. That draft is void. Do not reuse its
language.

Pre-application contact: **nicky@solanaeco.io** (Nicky Scannella, Superteam USA).
Form: https://superteam.fun/earn/grants/solana-foundation-usa-grants

---

## Project name

**PNL — verified research publishing on Solana**

## One-liner

An ORCID-verified researcher mints a permanent, citable DOI from a Solana-authenticated
account — and the wallet that holds the identity is the wallet that gets credited.

## The problem

Academic publishing verifies an email address. Everything that hangs off authorship —
citation credit, reputation, any reward attached to a work — rests on trusting a
registrar's record of who submitted what. That was tolerable when submission was
expensive. It isn't now: generated submissions arrive faster than any registrar can vet
them, and "who actually wrote this, and can you check it later" has no good answer.

Crypto has not helped, because crypto research tooling generally ignores the
infrastructure researchers actually use — ORCID for identity, DOIs for permanence,
Crossref and DataCite for resolution. A paper that only exists inside a crypto app is
not citable anywhere that matters.

## What ships today — verified

PNL already joins the two halves. This is running in production, not planned:

- **ORCID via real OAuth.** `start` / `callback` / `disconnect` / `status` routes,
  `lib/orcid.ts`, a verified badge, and `orcidId` + `orcidVerifiedAt` on the user
  profile. Not a text field the user types.
- **Zenodo DOI minting.** `lib/zenodo.ts` + `api/research/[id]/mint-doi` +
  `resolve-doi`. Author-gated, requires a PDF, refuses if a DOI already exists,
  rate-limited. The code treats the irreversibility seriously — Zenodo publication
  cannot be undone.
- **The join that matters: the verified ORCID flows into the minted DOI's creator
  record.** The permanent, externally-resolvable citation carries an identity that was
  actually checked.
- **Solana as the account layer.** Author of record is the authenticated wallet, taken
  from the session and never from a request body. Author pages are addressed by wallet.
- **A self-custodial terminal client.** `@pnlmarket/mcp-server` v0.5.1, 19 tools. BIP39
  key encrypted at rest with scrypt (N=2¹⁷) + AES-256-GCM, `0600`, OS-dialog passphrase,
  in-memory unlock TTL — and it refuses to decrypt if the scrypt parameters were altered.
  SIWS-style ed25519 challenge auth, live today against our markets API.
- **A device-authorization flow** so a terminal can act as the user with a revocable
  token, plus a GitHub App integration and 43 research endpoints including per-paper
  repository browsing.
- **An Anchor program live on mainnet** (`C5mVE2Bw…`), running the markets side.

## What the $10k buys

Publishing is still browser-only, and authorship is still *session*-authenticated rather
than *signed*. Those are the two gaps between what works and what a researcher outside
our circle can use and verify.

**M1 — Wallet-signed publication, from the terminal ($3,000, weeks 1–3).**
An ed25519 signature path for paper creation, reusing the verification already live on
our markets endpoints. The signature binds `sha256(pdf_bytes)` plus a metadata hash, so a
captured signature cannot be replayed onto a different file. Ships `pnl_post_paper` so a
researcher — or their agent — publishes from the terminal where the work happens.
*Deliverable:* merged PR, a real paper published this way, and a one-command
verification anyone can run.

**M2 — The academic graph ($4,000, weeks 4–7).**
Multi-author records with per-author ORCID. Paper→paper citations, which do not exist
today — the current citation model requires a project on one end. Import-from-DOI for
arXiv, Zenodo and Crossref that attributes the *real* authors and links the canonical
source rather than re-hosting or re-claiming it.
*Deliverable:* ≥100 imported papers forming a queryable citation graph behind a public
read API.

**M3 — Open the verification ($3,000, weeks 8–12).**
A written spec plus a standalone reference verifier, so "this Solana pubkey signed this
exact PDF, and this ORCID was verified at that time" is checkable by any application
without trusting PNL.
*Deliverable:* published package, spec document, and 3 external researchers publishing.

## What is open source

The verification spec, the reference verifier, and the terminal client. PNL's market
surface is a commercial product and we are not claiming otherwise — the identity and
verification layer beneath it is the public good, and that is what this grant funds.

## Scope discipline — what we are deliberately not promising

An on-chain record of research is designed and is the natural next layer, but it is
**not** in this grant. Putting research settlement on-chain requires an oracle model we
have not yet validated, and our own analysis concluded a mainnet program change before
that validation is premature. We would rather ship a verifiable off-chain layer in 12
weeks than promise a chain upgrade we would have to walk back.

## Why us

I'm a PhD student at the University of New Mexico — the user, not a founder guessing at
a market. I've shipped the custody, auth, ORCID and DOI surfaces above.

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
- GitHub: *(fill in)*
- X: *(fill in)*
- Payout wallet: *(fill in — must be a wallet you control)*

---

## Intro email — send BEFORE the form

**To:** nicky@solanaeco.io
**Subject:** USA grant — verified research publishing on Solana (PNL)

Hi Nicky,

I'm a PhD student at the University of New Mexico building pnl.market, and I'm about to
submit for the Solana Foundation USA grant. Wanted to introduce it first.

Academic publishing verifies an email address, so authorship — and everything hanging off
it: citation credit, reputation, any attached reward — rests on trusting a registrar's
record of who submitted what. Crypto hasn't helped, because crypto research tools ignore
the infrastructure researchers actually use, and a paper that only exists inside a crypto
app isn't citable anywhere that counts.

PNL already joins the two halves, in production today: ORCID connected through real
OAuth, Zenodo DOI minting that's author-gated and treats publication as irreversible, and
the verified ORCID flowing into the minted DOI's creator record — with the Solana wallet
as the account of record. The terminal client holds keys self-custodially (scrypt +
AES-256-GCM) and already does SIWS-style signature auth against our markets API.

The gap is that publishing is browser-only and authorship is session-authenticated rather
than signed. The $10k closes it: a signature path that binds the PDF hash so authorship
is verifiable by anyone, paper-to-paper citations with per-author ORCID, and an open spec
plus reference verifier so the check doesn't require trusting us.

One thing I'll say plainly: an on-chain research record is the natural next layer and
it's deliberately *not* in this proposal — the oracle model isn't validated yet, and I'd
rather ship a verifiable off-chain layer in 12 weeks than promise a chain upgrade I'd
have to walk back.

Happy to send the milestone breakdown or walk through a demo.

Separately — UNM has no Solana presence at all right now. No blockchain club, nothing.
I'm working on changing that this semester and would welcome a pointer on how Superteam
USA likes to plug into a new campus.

Thanks,
Bishwanath Bastola
pnl.market

---

## Before you send

1. Fill the three blanks (GitHub, X, payout wallet).
2. Decide **"I" vs "we"** — the draft uses "we" for the product and "I" for yourself. If
   PNL is solo, switch to "I" throughout; a solo PhD student who shipped this is a better
   story than an implied team.
3. If the form pushes back on $10k, M1+M2 alone is a coherent $7k.
4. Do not present UNM as a fiscal host. It belongs here as credibility and a user base
   only — the money goes to your wallet, not through the university.
