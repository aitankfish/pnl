/**
 * POST /api/research/[id]/mint-doi
 *
 * Author-only: publish this paper to Zenodo and stamp the minted DOI back onto
 * it. The "publish first on PNL, then cite it anywhere" on-ramp. Gated hard
 * because Zenodo publishing is IRREVERSIBLE: author-only, must have a PDF, must
 * not already carry a DOI.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase, ResearchPaper, UserProfile } from '@/lib/mongodb';
import { withAuth } from '@/lib/auth/require-wallet';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { convertToGatewayUrl } from '@/lib/api-utils';
import { getZenodoConfig, mintDoi } from '@/lib/zenodo';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

const MAX_PDF_BYTES = 50 * 1024 * 1024;

export const POST = withAuth(async (_request: NextRequest, authUser, { params }: any) => {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return bad('Invalid paper id');

    const cfg = getZenodoConfig();
    if (!cfg) return bad('DOI minting is not configured on this deployment', 503);

    // Irreversible + costs a real deposit — keep the gate tight.
    const rateLimited = await checkRateLimit(`mint-doi:${authUser.walletAddress}`, 5, 60 * 60_000);
    if (rateLimited) return rateLimited;

    await connectToDatabase();
    const paper = await ResearchPaper.findById(id);
    if (!paper || paper.status !== 'active') return bad('Paper not found', 404);
    if (paper.authorWallet !== authUser.walletAddress) {
      return bad('Only the author can mint a DOI for this paper', 403);
    }
    if (paper.doi) return bad('This paper already has a DOI', 409);

    const pdfUrl = convertToGatewayUrl(paper.paperUrl || undefined);
    if (!pdfUrl) return bad('Minting needs a PDF on the paper', 422);

    // Pull the PDF bytes from IPFS to hand to Zenodo.
    const pdfRes = await fetch(pdfUrl);
    if (!pdfRes.ok) return bad('Could not fetch the paper PDF', 502);
    const bytes = await pdfRes.arrayBuffer();
    if (bytes.byteLength === 0) return bad('The paper PDF is empty', 422);
    if (bytes.byteLength > MAX_PDF_BYTES) return bad('PDF is too large to mint', 413);

    // Verified ORCID (if any) goes on the DOI's creator — verified authorship.
    const profile = await UserProfile.findOne({ walletAddress: paper.authorWallet }).select('orcidId').lean<any>();

    const description = (paper.summary && paper.summary.trim()) || `Preprint: ${paper.title}`;

    const result = await mintDoi(cfg, {
      title: paper.title,
      description,
      creatorName: paper.authorName || 'Anonymous',
      creatorOrcid: profile?.orcidId || null,
      pdf: { bytes, filename: `${slugify(paper.title)}.pdf` },
    });

    // Stamp the DOI onto the paper + the current version entry.
    const now = new Date();
    paper.doi = result.doi;
    paper.externalUrl = result.recordUrl || paper.externalUrl;
    if (Array.isArray(paper.versions) && paper.versions.length > 0) {
      const cur = paper.versions.find((v: any) => v.version === paper.currentVersion);
      if (cur) {
        cur.doi = result.doi;
        cur.externalUrl = result.recordUrl || cur.externalUrl;
      }
    }
    paper.updatedAt = now;
    await paper.save();

    logger.info('[mint-doi] minted', { paperId: id, doi: result.doi });
    return NextResponse.json({ success: true, data: { doi: result.doi, recordUrl: result.recordUrl } });
  } catch (error) {
    logger.error('[mint-doi] failed', error as any);
    const message = error instanceof Error ? error.message : 'Failed to mint DOI';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
});

function slugify(s: string): string {
  return (s || 'paper').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'paper';
}

function bad(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
