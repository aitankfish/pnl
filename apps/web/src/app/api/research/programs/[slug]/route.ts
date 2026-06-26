/**
 * GET /api/research/programs/[slug]
 *
 * Program detail: the program, its papers in lineage order, and the aggregate
 * staked conviction read from the markets that cite the program's papers. The
 * read model lives in `lib/research-programs.ts` and is shared with the SSR
 * program page so the conviction aggregation exists in exactly one place.
 */

import { NextResponse } from 'next/server';
import { getProgramDetail } from '@/lib/research-programs';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const program = await getProgramDetail(slug);
    if (!program) {
      return NextResponse.json({ success: false, error: 'Program not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: program });
  } catch (error) {
    logger.error('[research/programs/[slug]] failed', error as any);
    return NextResponse.json(
      { success: false, error: 'Failed to load program' },
      { status: 500 },
    );
  }
}
