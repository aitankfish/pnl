/**
 * POST /api/csp-report — CSP violation sink (report-only phase).
 *
 * Browsers POST a JSON body here whenever the Content-Security-Policy-Report-Only
 * policy would have blocked a resource. We log a compact line so violations
 * surface in server logs while the policy is being tuned, then return 204.
 * Nothing is stored and no auth is required (browsers send these unauthenticated).
 * Remove or lock down once CSP is moved to enforcing mode.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    // Legacy report-uri format nests under "csp-report"; the Reporting API
    // (report-to) sends a flat object or an array of reports.
    const reports = Array.isArray(body) ? body : [body];
    for (const entry of reports) {
      const r = entry?.['csp-report'] ?? entry?.body ?? entry;
      if (!r) continue;
      const directive = r['violated-directive'] || r['effectiveDirective'] || 'unknown';
      const blocked = r['blocked-uri'] || r['blockedURL'] || 'unknown';
      const doc = r['document-uri'] || r['documentURL'] || '';
      console.warn(`[csp-report] ${directive} blocked=${blocked} doc=${doc}`);
    }
  } catch {
    // Ignore malformed reports — never let a bad report 500.
  }
  return new NextResponse(null, { status: 204 });
}
