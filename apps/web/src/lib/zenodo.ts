/**
 * Zenodo minting — PNL's "publish first, get a real DOI" backend.
 *
 * We mint through Zenodo (CERN-backed, a DataCite member) so the DOI is real
 * and citable AND Zenodo absorbs the forever-persistence obligation for free.
 * The only "cost" is the prefix reads 10.5281/zenodo.* rather than a PNL prefix
 * — swapping to a DataCite/PNL prefix later is a change behind this one module.
 *
 * Depositor model = INSTITUTIONAL: one dedicated PNL Zenodo ORG account (never
 * a personal token) is the depositor of every paper; the visible author/creator
 * is the actual researcher (set from the paper + their verified ORCID), and
 * records are branded into the PNL Zenodo *community*. PNL is the repository,
 * the researcher is the author — the normal journal/repository split.
 *
 * Config via env (free — create the token on the PNL org account with
 * deposit:write + deposit:actions):
 *   ZENODO_TOKEN, ZENODO_ENV = 'sandbox' | 'production' (default 'sandbox')
 *   ZENODO_COMMUNITY = the PNL community identifier (optional; brands records)
 */

import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export interface ZenodoConfig {
  token: string;
  base: string; // https://zenodo.org/api or https://sandbox.zenodo.org/api
}

export function getZenodoConfig(): ZenodoConfig | null {
  const token = process.env.ZENODO_TOKEN;
  if (!token) return null;
  const base = (process.env.ZENODO_ENV || 'sandbox').toLowerCase() === 'production'
    ? 'https://zenodo.org/api'
    : 'https://sandbox.zenodo.org/api';
  return { token, base };
}

export function isZenodoConfigured(): boolean {
  return getZenodoConfig() !== null;
}

export interface MintInput {
  title: string;
  description: string; // Zenodo requires a non-empty description
  creatorName: string;
  creatorOrcid?: string | null;
  pdf: { bytes: ArrayBuffer; filename: string };
}

export interface MintResult {
  doi: string;
  recordUrl: string;
}

/**
 * Deposit a paper to Zenodo and publish it, returning the minted DOI. Four
 * steps: create deposition → upload the PDF to its bucket → set metadata →
 * publish. Any failure throws with a readable message; the caller decides how
 * to surface it. Note: publishing on Zenodo is IRREVERSIBLE (the record and its
 * DOI are permanent) — callers must gate this behind explicit author intent.
 */
export async function mintDoi(cfg: ZenodoConfig, input: MintInput): Promise<MintResult> {
  const auth = { Authorization: `Bearer ${cfg.token}` };

  // 1. Create an empty deposition.
  const createRes = await fetch(`${cfg.base}/deposit/depositions`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!createRes.ok) {
    throw new Error(`Zenodo create failed (${createRes.status})`);
  }
  const deposition = await createRes.json();
  const depositionId = deposition.id;
  const bucketUrl: string | undefined = deposition?.links?.bucket;
  if (!depositionId || !bucketUrl) {
    throw new Error('Zenodo did not return a deposition bucket');
  }

  // 2. Upload the PDF into the deposition's bucket (new files API).
  const safeName = input.pdf.filename.replace(/[^A-Za-z0-9._-]/g, '_') || 'paper.pdf';
  const uploadRes = await fetch(`${bucketUrl}/${encodeURIComponent(safeName)}`, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/octet-stream' },
    body: input.pdf.bytes,
  });
  if (!uploadRes.ok) {
    throw new Error(`Zenodo upload failed (${uploadRes.status})`);
  }

  // 3. Attach metadata. ORCID, when present, ties the DOI to a verified author.
  // The depositing account is PNL's, but the CREATOR is the researcher — so the
  // citation reads their name, not the institutional depositor's.
  const creator: Record<string, string> = { name: input.creatorName };
  if (input.creatorOrcid) creator.orcid = input.creatorOrcid;
  const metadata: Record<string, unknown> = {
    title: input.title,
    upload_type: 'publication',
    publication_type: 'preprint',
    description: input.description,
    creators: [creator],
  };
  // Brand into the PNL community when configured (PNL = the repository).
  const community = process.env.ZENODO_COMMUNITY;
  if (community) metadata.communities = [{ identifier: community }];
  const metaRes = await fetch(`${cfg.base}/deposit/depositions/${depositionId}`, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ metadata }),
  });
  if (!metaRes.ok) {
    throw new Error(`Zenodo metadata failed (${metaRes.status})`);
  }

  // 4. Publish — irreversible; mints the DOI.
  const publishRes = await fetch(`${cfg.base}/deposit/depositions/${depositionId}/actions/publish`, {
    method: 'POST',
    headers: auth,
  });
  if (!publishRes.ok) {
    throw new Error(`Zenodo publish failed (${publishRes.status})`);
  }
  const published = await publishRes.json();
  const doi: string | undefined = published?.doi || published?.metadata?.doi;
  const recordUrl: string =
    published?.links?.record_html || published?.links?.latest_html || (doi ? `https://doi.org/${doi}` : '');
  if (!doi) {
    throw new Error('Zenodo published but returned no DOI');
  }

  logger.info('[zenodo] minted', { depositionId, doi });
  return { doi, recordUrl };
}
