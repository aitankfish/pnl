'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { useWallet } from '@/hooks/useWallet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Users, Bot, Loader2, AlertTriangle } from 'lucide-react';

interface Split {
  human: number;
  agent: number;
}
interface TopMarket {
  key: string;
  human: number;
  agent: number;
  total: number;
}
interface MetricsData {
  totals: { platform: Split; market: Split };
  topMarkets: TopMarket[];
  windowDays: number | null;
}

const WINDOWS: { label: string; days: number }[] = [
  { label: 'All time', days: 0 },
  { label: '30 days', days: 30 },
  { label: '7 days', days: 7 },
];

function short(addr: string) {
  return addr.length > 12 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

function Stat({ label, split }: { label: string; split: Split }) {
  const total = split.human + split.agent;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl tabular-nums">{total.toLocaleString()}</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> {split.human.toLocaleString()} human
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Bot className="h-3.5 w-3.5" /> {split.agent.toLocaleString()} agent
        </span>
      </CardContent>
    </Card>
  );
}

export default function MetricsAdminPage() {
  const { primaryWallet } = useWallet();
  const [days, setDays] = useState(0);
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (windowDays: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/metrics${windowDays ? `?days=${windowDays}` : ''}`);
      const json = await res.json();
      if (!json.success) {
        setError(res.status === 403 ? 'Admin only — connect the admin wallet.' : json.error || 'Failed to load metrics.');
        setData(null);
        return;
      }
      setData(json.data as MetricsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-2 flex items-center gap-3">
        <BarChart3 className="h-6 w-6" />
        <h1 className="text-2xl font-semibold">Metrics</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Visits and views, human vs agent. Admin-only — non-admins get a 403 from the server. Connected as{' '}
        <span className="font-mono text-xs">{primaryWallet?.address ?? 'not connected'}</span>.
      </p>

      <div className="mb-6 flex gap-2">
        {WINDOWS.map((w) => (
          <Button
            key={w.days}
            variant={days === w.days ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDays(w.days)}
          >
            {w.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-4 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p>{error}</p>
          </div>
        </div>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat label="Platform visits" split={data.totals.platform} />
            <Stat label="Market views" split={data.totals.market} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top markets by views</CardTitle>
              <CardDescription>
                {data.windowDays ? `Last ${data.windowDays} days` : 'All time'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.topMarkets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No views recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground">
                      <tr className="text-left">
                        <th className="py-1.5 pr-4 font-medium">Market</th>
                        <th className="py-1.5 pr-4 text-right font-medium">Total</th>
                        <th className="py-1.5 pr-4 text-right font-medium">Human</th>
                        <th className="py-1.5 text-right font-medium">Agent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topMarkets.map((m) => (
                        <tr key={m.key} className="border-t border-border/50">
                          <td className="py-1.5 pr-4">
                            <Link href={`/market/${m.key}`} className="font-mono text-xs hover:underline">
                              {short(m.key)}
                            </Link>
                          </td>
                          <td className="py-1.5 pr-4 text-right tabular-nums">{m.total.toLocaleString()}</td>
                          <td className="py-1.5 pr-4 text-right tabular-nums text-muted-foreground">{m.human.toLocaleString()}</td>
                          <td className="py-1.5 text-right tabular-nums text-muted-foreground">{m.agent.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
