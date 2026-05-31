'use client';

// Reusable BYOK (bring-your-own-key) settings panel for the PNL Concierge.
// Used inside the wallet page's "AI Keys" section and the /settings page.
// Non-custodial: the key is stored in this browser only (localStorage), sent
// per-request, never stored or logged on PNL servers.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Check, Trash2, ExternalLink } from 'lucide-react';
import {
  PROVIDERS,
  providerMeta,
  loadByok,
  saveByok,
  clearByok,
  CUSTOM_MODEL,
  type ProviderId,
} from '@/lib/agent/byok-shared';

const CREAM = '#f4eee4';
const CREAM_DIM = 'rgba(244,238,228,0.65)';
const CREAM_FAINT = 'rgba(244,238,228,0.4)';
const HAIR = 'rgba(244,238,228,0.12)';
const AMBER = '#e89660';
const FOREST = '#3f7a42';

export default function AiKeySettings() {
  const [provider, setProvider] = useState<ProviderId>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasStored, setHasStored] = useState(false);

  useEffect(() => {
    const c = loadByok();
    if (c) {
      setProvider(c.provider);
      setApiKey(c.apiKey);
      setModel(c.model ?? '');
      const pm = providerMeta(c.provider);
      if (c.model && pm && !pm.models.includes(c.model)) setIsCustom(true);
      setHasStored(true);
    }
  }, []);

  const meta = providerMeta(provider);

  function changeProvider(id: ProviderId) {
    setProvider(id);
    setModel(''); // fall back to the new provider's default
    setIsCustom(false);
  }

  function handleSave() {
    if (!apiKey.trim()) return;
    saveByok({ provider, apiKey: apiKey.trim(), model: model.trim() || undefined });
    setHasStored(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClear() {
    clearByok();
    setApiKey('');
    setModel('');
    setIsCustom(false);
    setHasStored(false);
  }

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-medium" style={{ color: CREAM }}>
        Bring your own AI key
      </h2>
      <p className="mt-1 text-sm" style={{ color: CREAM_DIM }}>
        The PNL Concierge runs on <em>your</em> model. Pick a provider and paste a key. It&apos;s
        stored in this browser only — PNL never sees or stores it except to forward your own
        requests.
      </p>

      <div className="mt-6 space-y-5">
        {/* Provider */}
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider" style={{ color: CREAM_FAINT }}>
            Provider
          </label>
          <select
            value={provider}
            onChange={(e) => changeProvider(e.target.value as ProviderId)}
            className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none"
            style={{ borderColor: HAIR, color: CREAM }}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id} style={{ background: '#0a0814', color: CREAM }}>
                {p.label}
              </option>
            ))}
          </select>
          {meta && (
            <a
              href={meta.keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-xs"
              style={{ color: AMBER }}
            >
              Get a {meta.label.split(' ')[0]} key <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* API key */}
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider" style={{ color: CREAM_FAINT }}>
            API key
          </label>
          <div className="flex items-center gap-2 rounded-xl border px-3 py-1" style={{ borderColor: HAIR }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={meta?.keyHint ?? 'your provider key'}
              autoComplete="off"
              spellCheck={false}
              className="flex-1 bg-transparent py-1.5 text-sm outline-none"
              style={{ color: CREAM }}
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              className="p-1 opacity-60 hover:opacity-100"
              style={{ color: CREAM }}
              aria-label={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Model — pick from a list, or Custom… for anything else */}
        <div>
          <label className="mb-1.5 block text-xs uppercase tracking-wider" style={{ color: CREAM_FAINT }}>
            Model
          </label>
          <select
            value={isCustom ? CUSTOM_MODEL : model || meta?.defaultModel || ''}
            onChange={(e) => {
              if (e.target.value === CUSTOM_MODEL) {
                setIsCustom(true);
                setModel('');
              } else {
                setIsCustom(false);
                setModel(e.target.value);
              }
            }}
            className="w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none"
            style={{ borderColor: HAIR, color: CREAM }}
          >
            {meta?.models.map((m) => (
              <option key={m} value={m} style={{ background: '#0a0814', color: CREAM }}>
                {m}
              </option>
            ))}
            <option value={CUSTOM_MODEL} style={{ background: '#0a0814', color: CREAM }}>
              Custom…
            </option>
          </select>
          {isCustom && (
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="exact provider model id"
              spellCheck={false}
              className="mt-2 w-full rounded-xl border bg-transparent px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: HAIR, color: CREAM }}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-30"
            style={{ background: AMBER, color: '#1a1208' }}
          >
            {saved ? <Check className="h-4 w-4" /> : null}
            {saved ? 'Saved' : 'Save key'}
          </button>
          {hasStored && (
            <button
              onClick={handleClear}
              className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition-colors hover:bg-white/5"
              style={{ borderColor: HAIR, color: CREAM_DIM }}
            >
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          )}
        </div>

        {/* Privacy note */}
        <div
          className="mt-2 flex items-start gap-2 rounded-xl border p-3 text-xs"
          style={{ borderColor: HAIR, color: CREAM_FAINT }}
        >
          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: FOREST }} />
          <span>
            Stored in this browser&apos;s local storage only. It&apos;s sent with each concierge
            request to reach your provider, and is never saved or logged on PNL servers. Clearing
            your browser data removes it.
          </span>
        </div>

        {hasStored && (
          <Link href="/ask" className="inline-block text-sm underline underline-offset-2" style={{ color: AMBER }}>
            Open the Concierge →
          </Link>
        )}
      </div>
    </div>
  );
}
