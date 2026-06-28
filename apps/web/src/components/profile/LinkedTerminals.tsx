'use client';

/**
 * LinkedTerminals — own-profile panel listing the terminals bound to this
 * account via device authorization, each revocable. The visible half of the
 * "revocable" promise: see every credential that can act as you, kill any one.
 * Renders nothing when there are no linked terminals.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Terminal, Trash2 } from 'lucide-react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { useToast } from '@/lib/hooks/useToast';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

interface Session {
  id: string;
  label: string | null;
  approvedAt: string | null;
  lastUsedAt: string | null;
  neverExpires: boolean;
  expiresAt: string | null;
  active: boolean;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function LinkedTerminals() {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/auth/device/sessions');
      const json = await res.json();
      if (json.success) setSessions((json.data.sessions || []).filter((s: Session) => s.active));
    } catch (e) {
      logger.error('[terminals] load failed', e as any);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (id: string) => {
    if (!window.confirm('Revoke this terminal? It will immediately lose access to your account.')) return;
    setRevoking(id);
    try {
      const res = await authFetch('/api/auth/device/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revoke: id }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      showToast({ type: 'success', title: 'Terminal revoked', message: '' });
    } catch (e) {
      showToast({ type: 'error', title: 'Couldn’t revoke', message: e instanceof Error ? e.message : '' });
    } finally {
      setRevoking(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }
  if (sessions.length === 0) return null;

  return (
    <div className="max-w-md mx-auto mt-6 rounded-xl border border-white/10 p-4 text-left" style={{ background: 'rgba(255,255,255,0.02)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Terminal className="w-3.5 h-3.5 text-gray-400" />
        <span className="mono uppercase tracking-[0.2em] text-[0.6rem] text-gray-400">
          Linked terminals · {sessions.length}
        </span>
      </div>
      <ul className="space-y-2.5">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white truncate">{s.label || 'Unnamed terminal'}</p>
              <p className="text-[0.7rem] text-gray-500">
                linked {timeAgo(s.approvedAt)} · used {timeAgo(s.lastUsedAt)}
                {s.neverExpires ? ' · no expiry' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => revoke(s.id)}
              disabled={revoking === s.id}
              className="shrink-0 inline-flex items-center gap-1 text-[0.7rem] text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
              title="Revoke this terminal"
            >
              {revoking === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              revoke
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
