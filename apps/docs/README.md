# @pnl/docs

[Fumadocs](https://fumadocs.vercel.app/)-powered documentation site for PNL.
Ships at **docs.pnl.market**.

This is a separate Next.js app inside the monorepo. It doesn't share runtime
state with `@pnl/web` — no Solana RPC, Privy, Mongo, or Helius dependencies
here. Just MDX → static pages.

## What's here

```
apps/docs/
  app/                       # Next.js App Router
    (home)/page.tsx          # Marketing homepage
    docs/
      layout.tsx             # DocsLayout shell
      [[...slug]]/page.tsx   # Renders any MDX page
    api/search/route.ts      # Built-in Orama search

  content/docs/              # The MDX content
    index.mdx                # Welcome
    how-to-buy.mdx           # Buying guide
    mechanics/               # How PNL works
    build/                   # Builders & agents
    legal/                   # Privacy, terms, disclaimer
    meta.json                # Navigation order (per folder)

  lib/
    source.ts                # Content loader (Fumadocs source adapter)
    layout.shared.tsx        # Nav + branding shared by home + docs layouts

  source.config.ts           # MDX collection definition
  tailwind.config.ts         # Pulls in Fumadocs preset + content paths
  app/global.css             # Cosmic-plant color overrides on Fumadocs UI
```

## Develop

From the repo root (uses the monorepo workspace):

```bash
pnpm install              # installs Fumadocs deps + runs postinstall (fumadocs-mdx)
pnpm -F @pnl/docs dev     # starts on http://localhost:3001
```

## Build

```bash
pnpm -F @pnl/docs build
pnpm -F @pnl/docs start
```

## Deploy to Vercel

1. In the Vercel dashboard, create a new project pointing at `aitankfish/pnl`.
2. **Root directory:** `apps/docs`
3. **Framework preset:** Next.js (auto-detected)
4. **Build command:** `pnpm install --filter @pnl/docs && pnpm -F @pnl/docs build`
   (or use the Vercel monorepo helper)
5. **Output directory:** `.next` (default)
6. **Custom domain:** `docs.pnl.market` — add a CNAME to `cname.vercel-dns.com`
7. Vercel handles SSL automatically.

Auto-deploys on every push to the default branch (`2026`).

## Editing content

Just edit `.mdx` files under `content/docs/`. Push to GitHub, Vercel rebuilds.

The page tree is built from `meta.json` files — each folder declares the order
of its pages. The root `meta.json` mixes pages and folders, with `---Label---`
entries for visual separators.

## Mintlify component compatibility

The page renderer in `app/docs/[[...slug]]/page.tsx` aliases Mintlify-style
components to Fumadocs equivalents so MDX written for Mintlify renders here:

| Mintlify | Fumadocs equivalent |
|---|---|
| `<CardGroup cols={N}>` | `<Cards>` |
| `<Card>` | `<Card>` |
| `<Steps>` / `<Step>` | `<Steps>` / `<Step>` |
| `<Tip>` | `<Callout type="info">` |
| `<Note>` | `<Callout>` |
| `<Warning>` | `<Callout type="warn">` |
| `<CodeGroup>` | `<Tabs>` (with `<Tab>` children) |

Mintlify `icon="seedling"` strings were stripped during migration — Fumadocs
`<Card>` accepts an `icon` prop that's a React node, not a string. Cards
render without icons for now. Add Lucide icons later if you want them back.

## Why not Mintlify?

Tried Mintlify first — hit a persistent "Invalid Redirect URI" bug in their
GitHub OAuth flow during signup. Rather than wait for Mintlify support to fix
their OAuth config, switched to Fumadocs. Same outcome (clean docs site at
docs.pnl.market), zero vendor lock-in, and reuses our Next.js + Vercel stack.

The original Mintlify config and content lives at `/docs/` (repo root) for
reference. Once the Fumadocs deploy is verified working, that folder can be
deleted.
