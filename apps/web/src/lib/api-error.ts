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

/**
 * Map an existing HTTP status to a structured error, preserving the status.
 * Handy for routes that already compute a status (e.g. tx verification returning
 * 400/404/502) — keeps the status exact while adding a branchable errorCode.
 */
export function apiErrorForStatus(status: number, message: string, details?: unknown): NextResponse {
  const code: ApiErrorCode =
    status === 400 ? 'BAD_REQUEST'
      : status === 401 ? 'UNAUTHORIZED'
      : status === 403 ? 'FORBIDDEN'
      : status === 404 ? 'NOT_FOUND'
      : status === 422 ? 'VALIDATION'
      : status === 429 ? 'RATE_LIMITED'
      : status === 502 ? 'UPSTREAM'
      : 'INTERNAL';
  return apiError(code, message, { status, details });
}
