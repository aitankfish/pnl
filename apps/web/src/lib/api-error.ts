/**
 * Structured API errors — a stable, machine-readable error surface for agents.
 *
 * Agents (and our own MCP/concierge) should branch on `errorCode` (a stable
 * enum) instead of parsing the human `error` string, which can be reworded any
 * time. The response keeps `error` for back-compat and adds `errorCode` (+
 * optional `details`), so this is purely additive for existing consumers.
 */

import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'VALIDATION'
  | 'UPSTREAM'
  | 'INTERNAL';

const DEFAULT_STATUS: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  VALIDATION: 422,
  UPSTREAM: 502,
  INTERNAL: 500,
};

/**
 * Build a structured error response. Keeps the human `error` message and adds
 * a stable `errorCode` (+ optional `details`). Status defaults to the code's
 * canonical HTTP status but can be overridden.
 */
export function apiError(
  code: ApiErrorCode,
  message: string,
  opts?: { status?: number; details?: unknown; headers?: HeadersInit },
): NextResponse {
  const body: Record<string, unknown> = { success: false, errorCode: code, error: message };
  if (opts?.details !== undefined) body.details = opts.details;
  return NextResponse.json(body, {
    status: opts?.status ?? DEFAULT_STATUS[code],
    ...(opts?.headers ? { headers: opts.headers } : {}),
  });
}
