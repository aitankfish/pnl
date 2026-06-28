'use client';

/**
 * OrcidConnect — own-profile control to verify (or unlink) an ORCID iD.
 *
 * Shown only on the viewer's own profile. Reflects three states: not configured
 * on this deployment, not yet linked (→ "Verify with ORCID"), or linked
 * (→ badge + disconnect). Also surfaces the ?orcid= result from the OAuth
 * round-trip once on mount.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { authFetch } from '@/lib/auth/fetch-with-auth';
import { useToast } from '@/lib/hooks/useToast';
import { OrcidBadge } from '@/components/research/OrcidBadge';
import { createClientLogger } from '@/lib/logger';

const logger = createClientLogger();

interface Status {
  configured: boolean;
  orcidId: string | null;
  orcidName: string | null;
  verifiedAt: string | null;
}

const ERROR_COPY: Record<string, string> = {
  denied: 'ORCID verification was cancelled.',
  expired: 'That verification link expired — try again.',
  exchange: 'ORCID couldn’t confirm the sign-in. Try again.',
  taken: 'That ORCID iD is already verified on another account.',
  server: 'Something went wrong verifying ORCID.',
  unconfigured: 'ORCID isn’t configured on this deployment yet.',
};

export function OrcidConnect() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/auth/orcid/status');
      const json = await res.json();
      if (json.success) setStatus(json.data);
    } catch (e) {
      logger.error('[orcid] status failed', e as any);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Surface the OAuth round-trip result once, then strip the query param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('orcid');
    if (!result) return;
    if (result === 'connected') {
      showToast({ type: 'success', title: 'ORCID verified', message: 'Your researcher identity is linked.' });
    } else if (result === 'error') {
      const reason = params.get('reason') || '';
      showToast({ type: 'error', title: 'ORCID verification failed', message: ERROR_COPY[reason] || 'Please try again.' });
    }
    params.delete('orcid');
    params.delete('reason');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    setBusy(true);
    try {
      const res = await authFetch('/api/auth/orcid/start', { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to start');
      window.location.href = json.data.url;
    } catch (e) {
      showToast({ type: 'error', title: 'Couldn’t start ORCID', message: e instanceof Error ? e.message : '' });
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm('Unlink your ORCID iD from this account?')) return;
    setBusy(true);
    try {
      const res = await authFetch('/api/auth/orcid/disconnect', { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      showToast({ type: 'success', title: 'ORCID unlinked', message: '' });
      await load();
    } catch (e) {
      showToast({ type: 'error', title: 'Couldn’t unlink', message: e instanceof Error ? e.message : '' });
    } finally {
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

  if (!status.configured && !status.orcidId) {
    return (
      <p className="text-xs text-gray-500 inline-flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" /> Researcher verification (ORCID) coming soon
      </p>
    );
  }

  if (status.orcidId) {
    return (
      <div className="inline-flex items-center gap-3">
        <OrcidBadge orcidId={status.orcidId} variant="full" />
        <button
          type="button"
          onClick={disconnect}
          disabled={busy}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          {busy ? 'working…' : 'unlink'}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={connect}
      disabled={busy}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors disabled:opacity-50"
      style={{ border: '1px solid #A6CE3955', color: '#A6CE39', background: 'rgba(166,206,57,0.08)' }}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
      Verify with ORCID
    </button>
  );
}
