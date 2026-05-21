# Mintlify docs site — setup guide

This folder contains the Mintlify documentation site that ships at **docs.pnl.market**. Mintlify hosts the docs for free for open-source projects and auto-deploys from this repo on every push.

## What's here

```
docs/
  docs.json              # Mintlify config (branding, navigation, search, SEO)
  index.mdx              # Welcome page
  how-to-buy.mdx         # Buying guide (Phantom / Robinhood / Coinbase)
  logo-pnl.svg           # Logo (light + dark)
  favicon.png

  mechanics/
    overview.mdx         # 60-second tour of how PNL works
    economics.mdx        # Fees, AMM, distribution
    lifecycle.mdx        # State machine + permissioned vs permissionless actions

  build/
    public-api.mdx       # /api/markets/list REST surface
    on-chain-program.mdx # Anchor program reference
    agent-integration.mdx # AI agent + MCP path

  legal/
    privacy.mdx
    terms.mdx
    disclaimer.mdx

  # Internal subdirs — NOT included in Mintlify navigation
  pitch/       (sales decks, scripts — sensitive)
  plans/       (implementation plans — internal)
  strategy/    (patent/IP strategy — sensitive)
  legal/       (legal PDFs — internal copies)
```

The `pitch/`, `plans/`, `strategy/` subdirs live alongside but are NOT listed in `docs.json` navigation, so Mintlify won't publish them.

## One-time deployment steps

These need to be done once. The user (account owner) handles them; Mintlify handles re-deploys automatically after that.

### 1. Create Mintlify account

Sign up at [mintlify.com](https://mintlify.com) with the same GitHub account that owns `aitankfish/pnl`. Free tier covers everything needed.

### 2. Connect the repo

In Mintlify dashboard → New project → "Import from GitHub" → select `aitankfish/pnl`. Point it at the `docs/` directory.

Mintlify auto-detects `docs.json` and starts building.

### 3. Configure custom domain

In Mintlify dashboard → Settings → Custom Domain → enter `docs.pnl.market`.

Mintlify will give you a CNAME target like `cname.mintlify.app`. Add it to your DNS provider:

```
docs.pnl.market   CNAME   cname.mintlify.app
```

DNS propagates in 5-60 minutes. Mintlify handles SSL automatically (Let's Encrypt).

### 4. Test the docs site

Once DNS resolves, visit `https://docs.pnl.market` and verify:

- Welcome page loads
- Navigation tabs work (Documentation tab visible)
- Search works ("Ask the grove..." prompt)
- All linked pages render
- Legal pages show "Last updated: May 2026"

### 5. Enable redirects on pnl.market

Once docs.pnl.market is verified working, flip the redirects in `apps/web/next.config.js`:

In Render dashboard → Environment → add:

```
DOCS_REDIRECTS_ENABLED=true
```

This activates 301 redirects from:

- `pnl.market/whitepaper` → `docs.pnl.market/whitepaper`
- `pnl.market/how-to-buy` → `docs.pnl.market/how-to-buy`
- `pnl.market/privacy` → `docs.pnl.market/legal/privacy`
- `pnl.market/terms` → `docs.pnl.market/legal/terms`

The legacy Next.js TSX pages (`apps/web/src/app/whitepaper`, etc.) keep existing as a fallback. Once you're confident the redirects work, you can delete those pages in a follow-up cleanup.

### 6. (Optional) Delete legacy pages after a soak period

After ~2 weeks with redirects working and no user complaints:

```bash
rm -rf apps/web/src/app/whitepaper
rm -rf apps/web/src/app/how-to-buy
rm -rf apps/web/src/app/privacy
rm -rf apps/web/src/app/terms
```

The redirects in `next.config.js` will still catch the URLs and forward to docs.pnl.market.

## Editing docs

Just edit the `.mdx` files in this folder and push. Mintlify auto-rebuilds within ~30 seconds.

Mintlify MDX supports React-style components (`<Card>`, `<Tip>`, `<Steps>`, `<CodeGroup>`, etc.) via the Mintlify component library. See [their docs](https://mintlify.com/docs/components) for the full set.

## Cost

**Free** for this use case. The Mintlify free tier includes:

- 1 admin seat
- Custom domain (docs.pnl.market)
- Unlimited public pages
- Full-text search
- AI assistant (uses your `llms.txt`)
- OpenAPI rendering
- llms.txt auto-generation

Pro ($150/mo) adds analytics, multi-language, advanced auth — none of which we need today.

## What's still in the legacy app

Some content stays on pnl.market (the app), not the docs:

- **Homepage** (`/`) — the thesis/landing page. This is brand surface, not docs.
- **`/browse`** — live market list. Realtime, app feature.
- **`/launchpad`** — "the Pulse" activity feed. App feature.
- **`/create`** — create-market form. App feature.
- **`/market/[id]`** — individual market pages. App feature.
- **`/launched`** — bloomed markets gallery. App feature.

Only the static/long-form content moves to docs.pnl.market.
