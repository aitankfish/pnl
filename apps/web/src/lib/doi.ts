/**
 * DOI helpers — shared by the resolver route and the paper create/version routes.
 *
 * The resolver is registrar-agnostic: it resolves via DOI content-negotiation,
 * a single endpoint (doi.org) that covers EVERY DOI registrar — Crossref (most
 * journals, conferences, preprint servers), DataCite (Zenodo, Figshare, Dryad,
 * arXiv), mEDRA, and others. So any paper with a DOI works, not just Zenodo.
 *
 * `normalizeDoi` pulls a canonical bare DOI out of whatever the researcher
 * pastes. Most inputs already contain a DOI (a bare DOI, a `doi:` string, a
 * doi.org link, or a publisher link with the DOI in it) — those resolve as-is.
 * A few popular sites are pasted as *non-DOI* URLs (a Zenodo record page, an
 * arXiv abstract link), so we reconstruct their well-known DOI from the URL.
 */

// A DOI is `10.<registrant>/<suffix>`. The suffix is permissive by spec; we keep
// the common safe character set and stop at whitespace.
const DOI_CORE = /10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+/;

export interface NormalizedDoi {
  /** Bare DOI, e.g. `10.5281/zenodo.15838409`. */
  doi: string;
  /** Canonical resolver URL, e.g. `https://doi.org/10.5281/zenodo.15838409`. */
  doiUrl: string;
}

/**
 * Extract a canonical DOI from arbitrary user input:
 *   - bare DOI:            10.5281/zenodo.15838409
 *   - doi: prefix:         doi:10.5281/zenodo.15838409
 *   - resolver URL:        https://doi.org/10.5281/zenodo.15838409
 *   - Zenodo record URL:   https://zenodo.org/records/15838409  → 10.5281/zenodo.15838409
 * Returns null if nothing DOI-shaped is found.
 */
export function normalizeDoi(input: string): NormalizedDoi | null {
  if (!input) return null;
  let raw = input.trim();
  if (!raw) return null;

  // Strip a leading `doi:` label if present.
  raw = raw.replace(/^doi:\s*/i, '');

  // A real DOI anywhere in the string wins (covers bare + doi.org + crossref links).
  const direct = raw.match(DOI_CORE);
  if (direct) {
    const doi = trimDoi(direct[0]);
    return { doi, doiUrl: `https://doi.org/${doi}` };
  }

  // Zenodo record/landing URL → reconstruct its canonical DataCite DOI. Zenodo
  // mints `10.5281/zenodo.<recordId>` for every record, so the numeric id maps
  // straight to the DOI suffix.
  const zenodo = raw.match(/zenodo\.org\/record[s]?\/(\d+)/i);
  if (zenodo) {
    const doi = `10.5281/zenodo.${zenodo[1]}`;
    return { doi, doiUrl: `https://doi.org/${doi}` };
  }

  // arXiv → every arXiv paper now carries a DataCite DOI of the form
  // `10.48550/arXiv.<id>`. Accept abstract/pdf links and bare `arXiv:` ids,
  // both modern (2401.12345) and legacy (hep-th/9901001) identifiers. The
  // version suffix (v2) is dropped so the DOI resolves to the latest version.
  const arxiv =
    raw.match(/arxiv\.org\/(?:abs|pdf)\/([a-z-]+(?:\.[A-Z]{2})?\/\d{7}|\d{4}\.\d{4,5})/i) ||
    raw.match(/arxiv:\s*([a-z-]+(?:\.[A-Z]{2})?\/\d{7}|\d{4}\.\d{4,5})/i);
  if (arxiv) {
    const arxivId = arxiv[1].replace(/v\d+$/i, '');
    const doi = `10.48550/arXiv.${arxivId}`;
    return { doi, doiUrl: `https://doi.org/${doi}` };
  }

  return null;
}

// Trailing punctuation often rides along when a DOI is pasted from prose.
function trimDoi(doi: string): string {
  return doi.replace(/[).,;'"\]]+$/, '');
}

/**
 * Strip JATS/HTML tags and decode the handful of entities that show up in
 * Crossref/DataCite abstracts, so an autofilled summary reads as plain text.
 */
export function stripAbstract(html: string | undefined | null): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
