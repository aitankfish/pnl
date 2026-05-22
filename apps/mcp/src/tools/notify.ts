import { z } from 'zod';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { hasWallet, getAddress } from '../lib/wallet.js';
import {
  Badge,
  headline,
  table,
  inline,
  truncAddress,
  heading,
  next,
  reply,
} from '../lib/output.js';

// ─── pnl_notify ──────────────────────────────────────────────────
//
// Pull recent notifications for the local wallet from PNL's
// /api/notifications endpoint and format them for the agent. Stateful
// via ~/.config/pnl/last-seen.json: tracks the most recent notification
// id this tool has surfaced so subsequent calls only show new ones
// (with --all to override).
//
// The agent typically invokes this when the user says "what's new on
// PNL", "any updates on my market", or via /pnl-notify. Works without
// any always-on process — pure on-demand poll.

const LAST_SEEN_FILE = join(homedir(), '.config', 'pnl', 'last-seen.json');

interface LastSeenState {
  // Map of walletAddress → most recent notification createdAt seen
  perWallet: Record<string, string>;
}

function loadLastSeen(): LastSeenState {
  try {
    if (!existsSync(LAST_SEEN_FILE)) return { perWallet: {} };
    const raw = readFileSync(LAST_SEEN_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.perWallet) return parsed;
    return { perWallet: {} };
  } catch {
    return { perWallet: {} };
  }
}

function saveLastSeen(state: LastSeenState): void {
  const dir = join(homedir(), '.config', 'pnl');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(LAST_SEEN_FILE, JSON.stringify(state, null, 2));
}

function getApiBase(): string {
  const raw = process.env.PNL_API_BASE_URL?.trim();
  if (!raw) return 'https://pnl.market';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export const notifyInputSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('Max notifications to return per call. Default 10.'),
  all: z
    .boolean()
    .optional()
    .describe(
      'When true, show ALL notifications regardless of last-seen state (useful for "show me the full activity feed"). When false (default), only return notifications newer than the last time pnl_notify was called.',
    ),
  unreadOnly: z
    .boolean()
    .optional()
    .describe('Only return unread notifications. Default true.'),
} as const;

const NotifyInput = z.object(notifyInputSchema);

interface ApiNotification {
  _id?: string;
  type?: string;
  title?: string;
  message?: string;
  isRead?: boolean;
  createdAt?: string;
  marketId?: { marketName?: string; marketAddress?: string } | string | null;
  projectId?: { name?: string; tokenSymbol?: string } | string | null;
  data?: Record<string, unknown>;
}

const TYPE_BADGE: Record<string, string> = {
  vote_result: '[vote]',
  token_launched: '[live]',
  vote_reminder: '[!]',
  reward_earned: '[ok]',
  project_update: '[update]',
  weekly_digest: '[digest]',
  community_milestone: '[milestone]',
  market_resolved: '[resolved]',
  claim_ready: '[claim]',
  pool_complete: '[pool]',
  founder_voice_live: '[live]',
};

export async function callNotify(rawInput: unknown) {
  const input = NotifyInput.parse(rawInput ?? {});
  const limit = input.limit ?? 10;
  const unreadOnly = input.unreadOnly ?? true;
  const showAll = input.all ?? false;

  if (!hasWallet()) {
    return reply(
      headline('No wallet on this machine yet.'),
      `Run ${inline('pnl_init')} to set one up. Notifications are scoped to a wallet address — without one there's nothing to fetch.`,
    );
  }
  const address = getAddress();
  const base = getApiBase();

  const qs = new URLSearchParams({ wallet: address, limit: String(Math.min(limit * 2, 50)) });
  if (unreadOnly) qs.set('unread', 'true');

  let payload: { notifications?: ApiNotification[]; unreadCount?: number; total?: number };
  try {
    const res = await fetch(`${base}/api/notifications?${qs.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'pnl-mcp-server/0.3.0 (+https://docs.pnl.market)',
      },
    });
    if (!res.ok) {
      throw new Error(`/api/notifications returned ${res.status} ${res.statusText}`);
    }
    payload = (await res.json()) as typeof payload;
  } catch (e) {
    return reply(
      headline(`${Badge.err} Couldn't fetch notifications`),
      `Error: ${e instanceof Error ? e.message : String(e)}`,
      `Profile: ${base}/profile/${address}`,
    );
  }

  const all = payload.notifications ?? [];
  const state = loadLastSeen();
  const lastSeenAt = state.perWallet[address];

  const filtered = showAll
    ? all
    : lastSeenAt
      ? all.filter((n) => (n.createdAt ?? '') > lastSeenAt)
      : all;

  const toShow = filtered.slice(0, limit);

  // Bump last-seen to the newest createdAt in the API response (not
  // just toShow) so we don't re-surface notifications we deliberately
  // truncated with `limit`.
  if (all.length > 0) {
    const newest = all
      .map((n) => n.createdAt ?? '')
      .filter(Boolean)
      .sort()
      .pop();
    if (newest) {
      state.perWallet[address] = newest;
      saveLastSeen(state);
    }
  }

  const profileUrl = `${base}/profile/${address}`;
  const profileLink = `[your profile](${profileUrl})`;

  if (toShow.length === 0) {
    if (showAll) {
      return reply(
        headline(`${Badge.ok} No notifications`),
        `Your inbox for \`${truncAddress(address)}\` is empty.`,
        `${profileLink} · ${inline(profileUrl)}`,
        next('Stake on a market with `/pnl-vote` to start seeing activity here.'),
      );
    }
    return reply(
      headline(`${Badge.ok} Nothing new since last check`),
      `Total unread: ${payload.unreadCount ?? 0}. Pass \`all: true\` to see the full inbox or visit ${profileLink}.`,
    );
  }

  const rows = toShow.map((n) => {
    const badge = TYPE_BADGE[n.type ?? ''] ?? '[ping]';
    const when = n.createdAt ? new Date(n.createdAt).toISOString().slice(0, 16).replace('T', ' ') : '—';
    const title = (n.title ?? '(no title)').slice(0, 70);
    const ctx =
      n.marketId && typeof n.marketId === 'object' && n.marketId.marketName
        ? `\`${n.marketId.marketName.slice(0, 30)}\``
        : n.projectId && typeof n.projectId === 'object' && n.projectId.tokenSymbol
          ? `\`$${n.projectId.tokenSymbol}\``
          : '—';
    return [badge, when, title, ctx];
  });

  return reply(
    headline(
      `${Badge.live} ${toShow.length} ${toShow.length === 1 ? 'update' : 'updates'} · ${truncAddress(address)}`,
    ),
    `${payload.unreadCount ?? 0} unread total · viewing ${showAll ? 'all' : 'new since last check'}.`,
    table(['Type', 'When (UTC)', 'Title', 'Market / Token'], rows),
    heading('Open in browser'),
    `${profileLink}: ${inline(profileUrl)}`,
    next(
      showAll
        ? 'Mark items read in the browser — or stake / claim from here with `/pnl-vote-now` / `/pnl-claim-now`.'
        : `Re-run with ${inline('all: true')} to see everything, or open ${profileLink} to mark items read.`,
    ),
  );
}
