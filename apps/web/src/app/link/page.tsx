'use client';

/**
 * /link — the browser side of terminal device authorization.
 *
 * A terminal prints a code and this URL; the user opens it, signs in with their
 * PNL account (Privy), and approves — binding the terminal to *their* wallet.
 * After approval the terminal's next poll receives its device token.
 */

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Terminal, ShieldCheck, Check, X } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';
import { authFetch } from '@/lib/auth/fetch-with-auth';

const BG = '#0a0814';
const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.16)';
const AMBER = '#e89660';
const GREEN = '#5fbf8f';
const RED = '#cf7a6f';

type Phase = 'idle' | 'working' | 'approved' | 'denied' | 'error';

function LinkInner() {
  const params = useSearchParams();
  const { authenticated, login, ready, primaryWallet } = useWallet();
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const c = params?.get('code');
    if (c) setCode(c.toUpperCase());
  }, [params]);

  const act = async (approve: boolean) => {
    if (!code.trim()) {
      setPhase('error');
      setMessage('Enter the code shown in your terminal.');
      return;
    }
    setPhase('working');
    try {
      const res = await authFetch('/api/auth/device/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCode: code.trim(), approve }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed');
      setPhase(approve ? 'approved' : 'denied');
    } catch (e) {
      setPhase('error');
      setMessage(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };

  const card: React.CSSProperties = {
    background: 'rgba(244,238,228,0.025)',
    border: `1px solid ${HAIR}`,
    borderRadius: 14,
    padding: '2rem 1.75rem',
    maxWidth: 440,
    width: '100%',
  };

  return (
    <div className="min-h-[calc(100dvh-64px)] flex items-center justify-center px-4" style={{ color: CREAM }}>
      <div style={card}>
        <div className="flex items-center gap-2 mb-5">
          <Terminal className="w-4 h-4" style={{ color: AMBER }} />
          <span className="mono uppercase tracking-[0.28em] text-[0.6rem]" style={{ color: AMBER }}>
            Link a terminal
          </span>
        </div>

        {!ready ? (
          <div className="flex items-center gap-2 py-6" style={{ color: CREAM_FAINT }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : phase === 'approved' ? (
          <Result icon={<Check className="w-5 h-5" />} color={GREEN} title="Terminal linked."
            body="Head back to your terminal — it can now act as your account. You can revoke it any time from your profile." />
        ) : phase === 'denied' ? (
          <Result icon={<X className="w-5 h-5" />} color={RED} title="Request denied."
            body="No access was granted. You can close this tab." />
        ) : !authenticated ? (
          <>
            <p className="mb-6" style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '1.05rem', lineHeight: 1.5 }}>
              Sign in with your PNL account to authorize the terminal.
            </p>
            <button
              type="button"
              onClick={login}
              className="w-full mono uppercase tracking-[0.22em] text-[0.65rem] py-3 rounded-full"
              style={{ background: AMBER, color: BG }}
            >
              Sign in to continue
            </button>
          </>
        ) : (
          <>
            <p className="mb-2" style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '1.05rem', lineHeight: 1.5 }}>
              A terminal is asking to act as your account. Confirm the code it’s showing:
            </p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              className="w-full text-center bg-transparent outline-none mono tracking-[0.35em] py-3 my-3"
              style={{ color: CREAM, border: `1px solid ${HAIR}`, borderRadius: 10, fontSize: '1.35rem' }}
            />
            <div className="flex items-start gap-2 mb-5 mt-1" style={{ color: CREAM_FAINT }}>
              <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <p className="text-[0.72rem] leading-relaxed">
                The terminal will be able to post, publish, and manage on your behalf until you revoke it.
                Only approve a code you started yourself.
              </p>
            </div>
            <span className="mono text-[0.55rem]" style={{ color: CREAM_FAINT }}>
              Signed in as {primaryWallet?.address ? `${primaryWallet.address.slice(0, 4)}…${primaryWallet.address.slice(-4)}` : 'your account'}
            </span>
            {phase === 'error' && (
              <p className="text-[0.78rem] mt-3" style={{ color: RED, fontFamily: 'var(--font-fraunces, serif)' }}>{message}</p>
            )}
            <div className="flex items-center gap-3 mt-4">
              <button
                type="button"
                onClick={() => act(true)}
                disabled={phase === 'working'}
                className="flex-1 mono uppercase tracking-[0.22em] text-[0.62rem] py-3 rounded-full inline-flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: AMBER, color: BG }}
              >
                {phase === 'working' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Authorize
              </button>
              <button
                type="button"
                onClick={() => act(false)}
                disabled={phase === 'working'}
                className="mono uppercase tracking-[0.22em] text-[0.62rem] py-3 px-5 rounded-full disabled:opacity-50"
                style={{ border: `1px solid ${HAIR}`, color: CREAM_DIM }}
              >
                Deny
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Result({ icon, color, title, body }: { icon: React.ReactNode; color: string; title: string; body: string }) {
  return (
    <div className="py-2">
      <div className="inline-flex items-center justify-center w-11 h-11 rounded-full mb-4" style={{ background: `${color}1a`, color }}>
        {icon}
      </div>
      <h2 className="mb-2" style={{ color: CREAM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '1.35rem' }}>{title}</h2>
      <p style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '0.98rem', lineHeight: 1.55 }}>{body}</p>
    </div>
  );
}

export default function LinkPage() {
  return (
    <Suspense fallback={null}>
      <LinkInner />
    </Suspense>
  );
}
