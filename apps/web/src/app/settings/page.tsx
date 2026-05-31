'use client';

// /settings — the no-sign-in path to set your Concierge AI key.
//
// The primary home for this is the wallet page (Settings → AI Keys), but the
// concierge itself needs no wallet, so this lightweight page lets logged-out
// users add a key too (the /ask CTA points here). Same shared component.

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import AiKeySettings from '@/components/settings/AiKeySettings';

export default function SettingsPage() {
  return (
    <div className="mx-auto min-h-[calc(100dvh-64px)] max-w-2xl px-4 py-10 sm:px-6">
      <Link
        href="/ask"
        className="mb-6 inline-flex items-center gap-1.5 text-sm"
        style={{ color: 'rgba(244,238,228,0.65)' }}
      >
        <ArrowLeft className="h-4 w-4" /> Back to Concierge
      </Link>
      <AiKeySettings />
    </div>
  );
}
