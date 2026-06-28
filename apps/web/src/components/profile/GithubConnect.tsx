'use client';

/**
 * GithubConnect — own-profile control to install the PNL GitHub App (so the
 * founder can cut releases that settle milestones). Shows configured/not, and
 * which GitHub accounts are connected. Surfaces the install round-trip result.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Github } from 'lucide-react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { useToast } from '@/lib/hooks/useToast';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

interface Status {
  configured: boolean;
  installations: { accountLogin: string; accountType: string | null }[];
}

const ERROR_COPY: Record<string, string> = {
  state: 'That install link expired — try connecting again.',
  lookup: 'GitHub didn’t return the installation. Try again.',
  missing: 'No installation came back from GitHub.',
  server: 'Something went wrong connecting GitHub.',
  unconfigured: 'GitHub isn’t configured on this deployment yet.',
};

export function GithubConnect() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/auth/github/status');
      const json = await res.json();
      if (json.success) setStatus(json.data);
    } catch (e) {
      logger.error('[github] status failed', e as any);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('github');
    if (!result) return;
    if (result === 'connected') {
      showToast({ type: 'success', title: 'GitHub connected', message: 'You can now cut releases from milestones.' });
    } else if (result === 'error') {
      const reason = params.get('reason') || '';
      showToast({ type: 'error', title: 'GitHub connect failed', message: ERROR_COPY[reason] || 'Please try again.' });
    }
    params.delete('github');
    params.delete('reason');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    setBusy(true);
    try {
      const res = await authFetch('/api/auth/github/start', { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to start');
      window.location.href = json.data.url;
    } catch (e) {
      showToast({ type: 'error', title: 'Couldn’t start GitHub install', message: e instanceof Error ? e.message : '' });
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-2 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    );
  }
  if (!status) return null;

  if (!status.configured && status.installations.length === 0) {
    return (
      <p className="text-xs text-gray-500 inline-flex items-center gap-1.5">
        <Github className="w-3.5 h-3.5" /> GitHub releases coming soon
      </p>
    );
  }

  const connected = status.installations.length > 0;

  return (
    <div className="inline-flex items-center gap-3">
      {connected && (
        <span className="text-xs text-gray-300 inline-flex items-center gap-1.5">
          <Github className="w-3.5 h-3.5" />
          {status.installations.map((i) => i.accountLogin).join(', ')}
        </span>
      )}
      <button
        type="button"
        onClick={connect}
        disabled={busy}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors disabled:opacity-50 border border-white/15 text-white hover:bg-white/10"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
        {connected ? 'Connect another' : 'Connect GitHub'}
      </button>
    </div>
  );
}
