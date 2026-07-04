/**
 * Lightweight visit/view analytics — Mongo-only, no third party.
 *
 * Aggregate daily counters (MetricCounter), bounded growth. Every write is
 * best-effort and MUST NOT throw: measurement never breaks a real request.
 * Traffic is tagged human vs agent so we can tell real pull from bot/agent
 * reads — PNL is agent-native, so agents are counted, not blocked.
 */

import { connectToDatabase, MetricCounter } from '@/lib/mongodb';

export type Actor = 'human' | 'agent';
export type Scope = 'platform' | 'market';

function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Classify a request as human or agent from its headers. Browsers send a Privy
 * Bearer token + a Mozilla UA; PNL's agent surfaces send a device token
 * (pnl_dev_) or a pnl-* / concierge / mcp User-Agent.
 */
export function actorFromRequest(req: { headers: { get(name: string): string | null } }): Actor {
  const ua = (req.headers.get('user-agent') || '').toLowerCase();
  const auth = (req.headers.get('authorization') || '').toLowerCase();
  const agenty =
    auth.includes('pnl_dev_') ||
    /\bpnl[-_]/.test(ua) ||
    ua.includes('concierge') ||
    ua.includes('mcp') ||
    ua.includes('bot') ||
    ua.includes('crawler') ||
    ua.includes('spider');
  return agenty ? 'agent' : 'human';
}

/** Best-effort increment of one daily counter. Never throws. */
export async function recordMetric(scope: Scope, key: string, actor: Actor): Promise<void> {
  try {
    await connectToDatabase();
    await MetricCounter.updateOne(
      { scope, key, actor, day: utcDay() },
      { $inc: { count: 1 }, $set: { updatedAt: new Date() } },
      { upsert: true },
    );
  } catch {
    // analytics is best-effort — swallow
  }
}

/** Views for one market key, split by actor, optionally since a date (UTC day). */
export async function marketViewStats(
  key: string,
  since?: Date,
): Promise<{ human: number; agent: number; total: number }> {
  await connectToDatabase();
  const match: Record<string, unknown> = { scope: 'market', key };
  if (since) match.day = { $gte: utcDay(since) };
  const rows = await MetricCounter.find(match).select('actor count').lean<any[]>();
  let human = 0;
  let agent = 0;
  for (const r of rows) {
    if (r.actor === 'agent') agent += r.count || 0;
    else human += r.count || 0;
  }
  return { human, agent, total: human + agent };
}

/** Platform-wide totals (admin), split by scope + actor, optionally since a date. */
export async function platformMetrics(since?: Date): Promise<{
  platform: { human: number; agent: number };
  market: { human: number; agent: number };
}> {
  await connectToDatabase();
  const match: Record<string, unknown> = {};
  if (since) match.day = { $gte: utcDay(since) };
  const rows = await MetricCounter.aggregate([
    { $match: match },
    { $group: { _id: { scope: '$scope', actor: '$actor' }, count: { $sum: '$count' } } },
  ]);
  const out = { platform: { human: 0, agent: 0 }, market: { human: 0, agent: 0 } };
  for (const r of rows) {
    const s = r._id?.scope as Scope;
    const a = r._id?.actor as Actor;
    if ((s === 'platform' || s === 'market') && (a === 'human' || a === 'agent')) {
      out[s][a] = r.count || 0;
    }
  }
  return out;
}

/** Top markets by total views (admin), optionally since a date. */
export async function topMarkets(
  limit = 20,
  since?: Date,
): Promise<Array<{ key: string; human: number; agent: number; total: number }>> {
  await connectToDatabase();
  const match: Record<string, unknown> = { scope: 'market' };
  if (since) match.day = { $gte: utcDay(since) };
  const rows = await MetricCounter.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$key',
        human: { $sum: { $cond: [{ $eq: ['$actor', 'human'] }, '$count', 0] } },
        agent: { $sum: { $cond: [{ $eq: ['$actor', 'agent'] }, '$count', 0] } },
      },
    },
    { $addFields: { total: { $add: ['$human', '$agent'] } } },
    { $sort: { total: -1 } },
    { $limit: limit },
  ]);
  return rows.map((r) => ({ key: r._id, human: r.human, agent: r.agent, total: r.total }));
}
