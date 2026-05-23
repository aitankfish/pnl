# Hidden routes registry

Routes whose content has moved to **docs.pnl.market** but whose page
files are intentionally preserved on pnl.market for a fast revert if
we ever need to bring them back.

The pattern: at the top of each hidden `page.tsx`, the exported
component calls `redirect(...)` to the new docs URL. The original
component is renamed (typically to `<Name>Original`) and kept below
it — unreachable while hidden, but ready to restore in one rename.

## What's hidden

| pnl.market path | Redirects to | Original component (in file) |
|---|---|---|
| `/privacy` | `https://docs.pnl.market/docs/legal/privacy` | `PrivacyPolicyOriginal` |
| `/terms` | `https://docs.pnl.market/docs/legal/terms` | `TermsOriginal` |
| `/how-to-buy` | `https://docs.pnl.market/docs/how-to-buy` | `HowToBuyOriginal` |

## How to restore a hidden route

1. Open the relevant `apps/web/src/app/<path>/page.tsx`
2. Delete the `redirect(...)` call inside the exported function
3. Change the export so `<Name>Original` is the default export — i.e.
   rename `function PrivacyPolicyOriginal()` to `function PrivacyPolicy()`
   and remove the stub above it
4. Remove the entry from the table above
5. Optionally remove this file if no hidden routes remain

That's it. No content changes required — the original JSX is
unchanged from when it was hidden.

## How to hide a new route

Mirror the pattern in `/privacy/page.tsx`. Steps:

1. Rename the current exported component to `<Name>Original`
2. Add an `import { redirect } from 'next/navigation'` at the top
3. Add a new default-exported stub component that calls
   `redirect('https://docs.pnl.market/<new-location>')` and returns
   `null`
4. Drop a comment marker pointing at this file
5. Add a row to the table above

## Why hide vs delete

- **Hidden** keeps the file in git, which means:
  - The route can be restored without re-writing the page from scratch
  - History is preserved on the original component
  - Easy to grep for hidden routes (search this file or
    `redirect('https://docs.pnl.market`)
- **Deletion** would be cleaner but loses the safety net. Since
  the docs site authority is lower than the apex domain
  (`pnl.market` vs `docs.pnl.market`), we may want to reverse the
  decision if some hidden page turns out to drive significant
  organic traffic.

## Nav links to these routes

The footer and other links currently point to the in-app paths
(`/privacy`, `/terms`, `/how-to-buy`). The page-level
`redirect()` handles them — clicks land on docs.pnl.market with
one network hop. Don't bother updating the nav unless we
permanently delete the pages.
