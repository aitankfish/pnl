import { setPendingBanner } from './output.js';

// ─── npm version drift check ─────────────────────────────────────
//
// The MCP runs as a long-lived stdio child of the user's agent
// (Claude Code / Cursor / Cline). Users have no nudge to upgrade —
// global npm packages don't auto-update. When we ship a security or
// behavioral fix (e.g., v0.5.0 moves the mnemonic out of the tool
// input schema), users on the older version stay vulnerable until
// they happen to reinstall.
//
// Fix: on startup, fire-and-forget a request to the npm registry's
// public metadata endpoint for our package. If the latest published
// version is newer than what we're running, queue a banner that the
// first tool reply prepends. The banner shows once per session, then
// clears.
//
// Privacy: registry metadata is anonymous (no auth required, no PII
// transmitted). Same trust model as `npm outdated`.

const PKG_NAME = '@pnlmarket/mcp-server';
const REGISTRY_URL = `https://registry.npmjs.org/${PKG_NAME}/latest`;
const FETCH_TIMEOUT_MS = 4_000;

/** Fire-and-forget startup check. Never throws, never blocks. */
export function startUpdateCheck(currentVersion: string): void {
  void runCheck(currentVersion);
}

async function runCheck(currentVersion: string): Promise<void> {
  try {
    const res = await fetch(REGISTRY_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { version?: string };
    const latest = typeof data.version === 'string' ? data.version : null;
    if (!latest || latest === currentVersion) return;
    if (compareSemver(latest, currentVersion) <= 0) return;

    setPendingBanner(
      `⚠️  **pnl-mcp-server update available — ${currentVersion} → ${latest}**\n\n` +
        `Run \`npm i -g @pnlmarket/mcp-server@latest\` (or \`pnpm add -g @pnlmarket/mcp-server@latest\`) and restart your agent. ` +
        `Security and behavior fixes between versions are published in the [GitHub releases](https://github.com/aitankfish/pnl/releases).`,
    );
  } catch {
    // Offline, npm unreachable, timeout, malformed response — silently skip.
    // Update notification is best-effort; it must never break the MCP.
  }
}

/** Compare two semver strings. Returns positive if a > b, negative
 *  if a < b, zero if equal. Ignores pre-release tags (treats them as
 *  the base version) — good enough for "is there a newer stable?". */
function compareSemver(a: string, b: string): number {
  const parsePart = (s: string) => {
    const base = s.split('-')[0]; // drop pre-release tag
    return base.split('.').map((n) => parseInt(n, 10) || 0);
  };
  const pa = parsePart(a);
  const pb = parsePart(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}
