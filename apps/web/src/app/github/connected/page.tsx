'use client';

/**
 * /github/connected — the post-install landing for the GitHub App.
 *
 * GitHub redirects here (via the callback) with ?installation_id after a user
 * installs the app. The browser is already signed in to PNL, so we bind the
 * installation to the caller's wallet from their live session — no dependence
 * on GitHub forwarding the install `state`.
 */

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Github, Check, X } from 'lucide-react';
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

type Phase = 'loading' | 'signin' | 'working' | 'done' | 'error';

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const { authenticated, login, ready, primaryWallet } = useWallet();
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState('');
  const tried = useRef(false);

  const installationId = params?.get('installation_id') || '';

  useEffect(() => {
    if (!ready) return;
    if (!installationId) {
      setPhase('error');
      setMessage('No installation came back from GitHub.');
      return;
    }
    if (!authenticated) {
      setPhase('signin');
      return;
    }
    if (tried.current) return;
    tried.current = true;
    setPhase('working');
    authFetch('/api/auth/github/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installationId }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setPhase('done');
          const wallet = primaryWallet?.address;
          if (wallet) setTimeout(() => router.replace(`/profile/${wallet}?github=connected`), 1200);
        } else {
          setPhase('error');
          setMessage(json.error || 'Could not link the installation.');
        }
      })
      .catch(() => {
        setPhase('error');
        setMessage('Network error linking the installation.');
      });
  }, [ready, authenticated, installationId, primaryWallet, router]);

  const card: React.CSSProperties = {
    background: 'rgba(244,238,228,0.025)',
    border: `1px solid ${HAIR}`,
    borderRadius: 14,
    padding: '2rem 1.75rem',
    maxWidth: 420,
    width: '100%',
  };

  return (
    <div className="min-h-[calc(100dvh-64px)] flex items-center justify-center px-4" style={{ color: CREAM }}>
      <div style={card}>
        <div className="flex items-center gap-2 mb-5">
          <Github className="w-4 h-4" style={{ color: AMBER }} />
          <span className="mono uppercase tracking-[0.28em] text-[0.6rem]" style={{ color: AMBER }}>
            Connect GitHub
          </span>
        </div>

        {phase === 'loading' || phase === 'working' ? (
          <div className="flex items-center gap-2 py-4" style={{ color: CREAM_DIM }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            {phase === 'working' ? 'Linking the installation…' : 'Loading…'}
          </div>
        ) : phase === 'signin' ? (
          <>
            <p className="mb-6" style={{ color: CREAM_DIM, fontFamily: 'var(--font-fraunces, serif)', fontSize: '1.05rem', lineHeight: 1.5 }}>
              Almost there — sign in to finish linking the GitHub installation to your account.
            </p>
            <button
              type="button"
              onClick={login}
              className="w-full mono uppercase tracking-[0.22em] text-[0.65rem] py-3 rounded-full"
              style={{ background: AMBER, color: BG }}
            >
              Sign in to finish
            </button>
          </>
        ) : phase === 'done' ? (
          <Result color={GREEN} icon={<Check className="w-5 h-5" />} title="GitHub connected." body="Taking you to your profile — you can now cut releases from milestones." />
        ) : (
          <Result color={RED} icon={<X className="w-5 h-5" />} title="Couldn’t connect" body={message || 'Please try again from your profile.'} />
        )}
      </div>
    </div>
  );
}

function Result({ color, icon, title, body }: { color: string; icon: React.ReactNode; title: string; body: string }) {
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

export default function GithubConnectedPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
