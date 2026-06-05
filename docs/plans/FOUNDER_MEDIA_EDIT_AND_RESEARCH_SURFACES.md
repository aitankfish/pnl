# Founder Media Edit + Research Surfaces — Build Plan

Branch: `feat/remote-mcp` · Status: planned (2026-06-04)

Two self-contained, off-chain features. No `plp_program/` / IDL / PDA / fee
changes. Both read/write MongoDB + IPFS/Cloudflare only.

---

## Feature A — Founder media edit (pre-resolution)

**Goal:** Let a market's founder (re-)upload media after creation, gated to
before resolution. Scope (decided): **main image + gallery, pitch video +
documents**. NOT description/text or social links in this pass.

### Why this is safe
Media lives off-chain: `Project.projectImageUrl`, `Project.galleryImageUrls`
(IPFS via Pinata), `Project.pitchVideoUrl` (Cloudflare Stream),
`Project.documentUrls` (IPFS). The detail page renders these from MongoDB, not
from the on-chain `metadataUri`. So updating the Mongo copy is sufficient for
display. The on-chain `metadataUri` stays frozen by design — **flag in PR**:
the immutable on-chain metadata JSON will point at the original image; the app
reads Mongo, so this is acceptable, but anyone reading on-chain metadata
directly sees the original. Acceptable for now.

### A1. New endpoint — `PUT /api/projects/[id]/media`
File: `apps/web/src/app/api/projects/[id]/media/route.ts` (new)

- Wrap with `withAuth` (from `@/lib/auth/require-wallet`) → gives `user.walletAddress`.
- Fetch `Project.findById(id)`. 404 if missing.
- **Ownership gate:** `project.founderWallet === user.walletAddress` else 403.
  (Use `withAuth` + manual check — not `withWalletOwnership`, which reads a JSON
  body; this endpoint is multipart FormData.)
- **Resolution gate:** fetch `PredictionMarket.findOne({ projectId: project._id })`;
  require `market.resolution === 'Unresolved'` AND `market.marketState === 0`
  else 400 "Cannot edit a resolved/closed market".
- Accept multipart FormData, all optional (only update what's sent):
  - `projectImage` (≤10MB) → IPFS → set `projectImageUrl`
  - `galleryImage0..2` (≤10MB each) → IPFS → rebuild `galleryImageUrls`
  - `pitchVideo` (≤100MB) → Cloudflare Stream → set `pitchVideoUrl`
  - `pitchVideoUrl` (pre-uploaded URL) → set directly
  - `projectDocument` → IPFS → append/replace `documentUrls`
- **Reuse the exact upload helpers** from `apps/web/src/app/api/projects/create/route.ts`
  (Pinata IPFS via `src/lib/ipfs.ts`, Cloudflare Stream path). Extract shared
  upload fns if duplication is ugly; otherwise import/copy minimally.
- `Project.updateOne({ _id }, { $set: { ...changed, updatedAt: new Date() } })`.
- Invalidate caches for the market detail + the project (mirror the keys used
  elsewhere; at minimum the `/api/markets/[id]` payload cache and any
  project-by-id cache). Best-effort.
- Return updated project media fields.

### A2. Founder-only edit UI on the detail page
File: `apps/web/src/app/market/[id]/MarketDetailClient.tsx`

- Compute `isFounder = connectedWallet === marketDetails.founderWallet`.
- Compute `canEditMedia = isFounder && marketDetails.resolution === 'Unresolved'
  && marketDetails.status === 'active'`.
- Add an "Edit media" affordance (button near the image/header) visible only
  when `canEditMedia`.
- Modal reusing the existing `FileDrop` component from the create flow
  (`apps/web/src/app/create/...`). Fields mirror A1's accepted files.
- On submit: `PUT /api/projects/[id]/media` with FormData + Privy auth header
  (use existing authed-fetch helper, `src/lib/auth/fetch-with-auth.ts`).
- On success: optimistic update or SWR `mutate` of the market detail; toast.

### A3. Edge cases / tests
- Non-founder gets 403; resolved market gets 400 (verify both).
- Empty submit (no files) is a no-op 200, not an error.
- Image re-upload returns a new `ipfs://` URI; old hash left pinned (optional
  Pinata unpin — out of scope, note as follow-up to avoid orphaned pins).
- Large file rejection mirrors create limits.

**Effort:** ~6–9h.

---

## Feature B — Research surfaces in profile/wallet

**Goal (decided):** surface existing research from profile/wallet:
(1) Papers tab in wallet Portfolio, (2) research section on public profile,
(3) "Publish research" CTA.

Research already exists end-to-end: routes under `/research/*`, creation via
`/create` (KindTabs `project|research`), author API at
`GET /api/research/author/[wallet]` (returns the wallet's papers + stats).
**No new data model or write path — pure read + UI + one deep-link param.**

### B1. Papers tab in wallet Portfolio
File: `apps/web/src/app/wallet/page.tsx`

- Extend `portfolioTab` union `'predictions' | 'projects' | 'watchlist'` →
  add `'papers'`. Add the tab button (label e.g. "Papers" / a garden-consistent
  word) alongside Growing/Bloomed/Watching (the existing tab row).
- Fetch `GET /api/research/author/${primaryWallet.address}` via SWR.
- Render a papers grid/list (reuse the paper-card markup from
  `/research/author/[wallet]/page.tsx` — extract a `PaperCard` component if not
  already shared, to avoid divergence).
- Empty state: "No papers yet" + link to publish (ties into B3).

### B2. Research section on public profile
File: `apps/web/src/app/profile/[wallet]/page.tsx`

- Currently shows Predictions + Projects Created. Add a third section
  "Research" (or a tab, matching the page's existing pattern).
- Same data source: `GET /api/research/author/[wallet]`.
- Reuse the same `PaperCard` from B1. Link each to `/research/[id]`.
- Hide the section entirely if the wallet has zero papers (keep profile clean).

### B3. "Publish research" CTA + create deep-link
Files: `apps/web/src/app/wallet/page.tsx` (+ optionally profile),
`apps/web/src/app/create/page.tsx`

- Add a "Publish research" button near "Plant an idea" (wallet Overview /
  Profile), linking to `/create?kind=research`.
- Make `/create` honor `?kind=`: in `create/page.tsx`, read
  `searchParams.get('kind')` and initialize the `kind` state to `'research'`
  when `kind=research` (today `kind` defaults to `'project'` and is only set via
  KindTabs clicks). One-line initializer + effect, mirroring the existing
  `?draft=` / `?linkedPaper=` handling.

### B4. Edge cases / tests
- Author API returns empty array → tabs/sections render empty states, no crash.
- Deep-link `/create?kind=research` lands directly on the research form.
- Reused `PaperCard` renders identically across author page / wallet / profile.

**Effort:** ~4–6h.

---

## Build sequence (recommended)

1. **Feature B first** (lower risk: read-only + UI + one param). Ship B1→B2→B3.
2. **Feature A second** (new authenticated write endpoint + uploads + gated UI).

Rationale: B reuses an existing API and adds no new trust boundary; A introduces
a new write path that deserves its own focused review (ownership + resolution
gates, upload limits). Keeping them in separate commits keeps the diff legible.

## Out of scope (explicit)
- Editing description / text fields / social links (deferred).
- Updating on-chain `metadataUri` (immutable by design).
- Pinata unpin of replaced images (orphaned-pin cleanup — later).
- Periodic pool reconcile loop (decided against; per-vote refresh + restarts).
