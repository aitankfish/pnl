// ─── PNL MCP — terminal output helpers ───────────────────────────
//
// Every tool returns text that Claude Code renders as part of its
// reply. Plain console.log-style output reads like a log file in
// that context. This module gives every tool a consistent visual
// rhythm:
//
//   - Bold one-line answer first (so the user can stop reading early
//     if that's all they wanted)
//   - Markdown tables for structured data (Claude Code renders them)
//   - Truncated addresses with full base58 in a code block for copy
//   - ASCII status badges ([ok], [!], [locked], [live]) — no emoji
//     per the standing brand rule
//   - A "→ Next:" hint at the end so the agent and user both know
//     the typical follow-up
//
// All helpers return strings. Compose with template literals or
// section() + join('\n\n').

// ─── Address / hash formatting ───────────────────────────────────

/**
 * Shorten a base58 pubkey for display. Keeps the first 6 and last 4
 * characters — enough to be visually distinguishable without taking
 * a full line.
 *
 *   truncAddress("9ot5o7tbtUit8j75ivdjxoUCGaY7uCcUDootdKuVhECH")
 *   // → "9ot5o7…hECH"
 */
export function truncAddress(addr: string, leading = 6, trailing = 4): string {
  if (!addr || addr.length <= leading + trailing + 1) return addr;
  return `${addr.slice(0, leading)}…${addr.slice(-trailing)}`;
}

/**
 * Format SOL from lamports with reasonable precision. Returns null
 * when the amount is below display threshold so callers can omit
 * the row entirely.
 */
export function formatSol(lamports: number | string | null | undefined): string | null {
  if (lamports == null) return null;
  const n = typeof lamports === 'string' ? Number(lamports) : lamports;
  if (!Number.isFinite(n)) return null;
  const sol = n / 1e9;
  if (sol < 0.0001) return null;
  if (sol < 1) return `${sol.toFixed(3)} SOL`;
  if (sol < 100) return `${sol.toFixed(2)} SOL`;
  return `${sol.toFixed(1)} SOL`;
}

// ─── Badges & status markers ─────────────────────────────────────
//
// Plain-ASCII bracketed tokens read as visual cues without being
// emoji. They survive copy-paste, terminals without unicode font
// fallback, and screen readers.

export const Badge = {
  ok: '[ok]',
  warn: '[!]',
  err: '[err]',
  locked: '[locked]',
  unlocked: '[unlocked]',
  live: '[live]',
  ended: '[ended]',
  pending: '[pending]',
  draft: '[draft]',
} as const;

// ─── Structural primitives ───────────────────────────────────────

/**
 * Render a one-line bold "headline" answer. The user can read just
 * this and stop. Subsequent text is "if you want details".
 */
export function headline(text: string): string {
  return `**${text}**`;
}

/**
 * Two-column key/value table. Used by pnl_wallet, pnl_get_market,
 * etc. for structured "here's what we know" responses.
 */
export function kvTable(rows: Array<[string, string | null | undefined]>): string {
  const filtered = rows.filter((r) => r[1] != null && String(r[1]).length > 0);
  if (filtered.length === 0) return '';
  return [
    '| | |',
    '|---|---|',
    ...filtered.map(([k, v]) => `| **${k}** | ${v} |`),
  ].join('\n');
}

/**
 * Generic markdown table with headers + rows. Pads cells with one
 * space on each side so the source reads cleanly in case the user
 * is on a renderer that doesn't pretty-print markdown tables.
 */
export function table(headers: string[], rows: string[][]): string {
  const separator = headers.map(() => '---');
  const all = [headers, separator, ...rows];
  return all.map((r) => `| ${r.join(' | ')} |`).join('\n');
}

/**
 * Code block — useful for pubkeys, tx signatures, IPFS CIDs,
 * mnemonics, file paths. Claude Code renders these as monospace
 * with a copy button.
 */
export function code(content: string, lang = ''): string {
  return `\`\`\`${lang}\n${content}\n\`\`\``;
}

/**
 * Inline code span — for short identifiers in the middle of a
 * sentence.
 */
export function inline(content: string): string {
  return `\`${content}\``;
}

/**
 * Blockquote — used for market descriptions, manifesto-style
 * pull-quotes, important warnings.
 */
export function quote(text: string): string {
  return text
    .trim()
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

/**
 * Markdown heading — H3 by default since tool output isn't a doc.
 */
export function heading(text: string, level: 1 | 2 | 3 | 4 = 3): string {
  return `${'#'.repeat(level)} ${text}`;
}

/**
 * Horizontal rule. Use sparingly to separate big sections.
 */
export const hr = '---';

/**
 * Action hint at the bottom of an output. Standardized so users
 * recognize the pattern.
 */
export function next(hint: string): string {
  return `→ ${hint}`;
}

/**
 * Wrap a tool result in the MCP content-block shape so callers
 * don't have to repeat the boilerplate. Joins parts with two
 * newlines so each section gets a paragraph break.
 */
export function reply(...parts: Array<string | null | undefined | false>): {
  content: Array<{ type: 'text'; text: string }>;
} {
  const text = parts
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .join('\n\n');
  return { content: [{ type: 'text', text }] };
}

// ─── Common domain-specific formatters ───────────────────────────

/**
 * Render a Solana address: truncated for the eye, plus a code block
 * with the full thing for copy. Optionally include a Solscan link.
 */
export function addressBlock(addr: string, opts: { label?: string; solscan?: boolean } = {}): string {
  const label = opts.label ?? 'Address';
  const lines: string[] = [`**${label}:** \`${truncAddress(addr)}\``];
  lines.push(code(addr));
  if (opts.solscan) {
    lines.push(`[View on Solscan](https://solscan.io/account/${addr})`);
  }
  return lines.join('\n');
}

/**
 * Render a market URL with its truncated id and the full URL on a
 * separate line for copy.
 */
export function marketLink(marketId: string, baseUrl: string): string {
  return `${baseUrl}/market/${marketId}`;
}
