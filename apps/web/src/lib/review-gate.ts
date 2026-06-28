/**
 * Evidence gate for AI reviews — the anti-hallucination backstop.
 *
 * Adapted from the peer-review system's gate: every discrete claim (red flag /
 * positive) the model makes must carry a VERBATIM quote copied from the source
 * it was given (the project's own pitch + the external verification results). We
 * mechanically check that quote appears in the source; a claim whose quote we
 * can't find is DROPPED. So the model can't assert specifics it can't prove
 * ("forked repo", "solo team") unless the data actually says so.
 *
 * Fail-closed: an unquotable claim is dropped, not shown — we'd rather lose a
 * real-but-unquoted flag than surface a fabricated one. The gate is also what
 * lets a cheaper/local model be "safe enough": its slop gets caught here.
 */

// Normalize curly quotes/dashes + whitespace + case so honest verbatim quotes
// survive typography differences.
const TYPO: Record<string, string> = {
  '‘': "'", '’': "'",
  '“': '"', '”': '"',
  '–': '-', '—': '-',
};

export function normalizeText(s: string | null | undefined): string {
  return (s || '')
    .replace(/[‘’“”–—]/g, (c) => TYPO[c] || c)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function buildCorpus(parts: Array<string | null | undefined>): string {
  return normalizeText(parts.filter(Boolean).join('\n'));
}

// A quote must be at least this long to count — blocks a claim from "passing"
// by quoting a single common word.
const MIN_QUOTE_LEN = 12;

export interface ClaimWithQuote {
  claim?: string;
  quote?: string;
}

export interface GateResult {
  kept: string[];
  dropped: number;
}

/**
 * Keep only the claims whose verbatim quote is found in the corpus.
 * Returns the surviving claim strings (the client's existing shape).
 */
export function gateClaims(items: ClaimWithQuote[] | undefined, corpus: string): GateResult {
  if (!Array.isArray(items)) return { kept: [], dropped: 0 };
  const kept: string[] = [];
  let dropped = 0;
  for (const it of items) {
    const claim = (it?.claim || '').trim();
    const quote = normalizeText(it?.quote);
    if (claim && quote.length >= MIN_QUOTE_LEN && corpus.includes(quote)) {
      kept.push(claim);
    } else {
      dropped++;
    }
  }
  return { kept, dropped };
}
