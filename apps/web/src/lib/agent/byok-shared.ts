// BYOK (bring-your-own-key) — client-safe shared config.
//
// PNL never holds a user's LLM key. The key lives in the browser (localStorage)
// and is sent per-request to /api/concierge in a header, used for that one
// request, and never stored or logged server-side. Same non-custodial posture
// as the wallet + MCP surfaces. This module has NO provider-SDK imports so it
// is safe to import from client components.

export const BYOK_STORAGE_KEY = 'pnl.byok.v1';
export const BYOK_PROVIDER_HEADER = 'x-pnl-ai-provider';
export const BYOK_KEY_HEADER = 'x-pnl-ai-key';
export const BYOK_MODEL_HEADER = 'x-pnl-ai-model';

export type ProviderId = 'openrouter' | 'anthropic' | 'openai' | 'google';

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  /** Curated model choices shown in the dropdown (first = default). */
  models: string[];
  /** Used when the user doesn't override the model. */
  defaultModel: string;
  /** Where to get a key. */
  keyUrl: string;
  /** Placeholder shown in the key field. */
  keyHint: string;
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: 'openrouter',
    label: 'OpenRouter — one key, any model',
    models: [
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3.7-sonnet',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'google/gemini-2.0-flash-001',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    defaultModel: 'anthropic/claude-3.5-sonnet',
    keyUrl: 'https://openrouter.ai/keys',
    keyHint: 'sk-or-...',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
    defaultModel: 'claude-3-5-sonnet-latest',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'sk-ant-...',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'],
    defaultModel: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-...',
  },
  {
    id: 'google',
    label: 'Google (Gemini)',
    models: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
    defaultModel: 'gemini-1.5-flash',
    keyUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza...',
  },
];

export const CUSTOM_MODEL = '__custom__';

export function providerMeta(id: string): ProviderMeta | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export interface ByokConfig {
  provider: ProviderId;
  apiKey: string;
  model?: string;
}

export function loadByok(): ByokConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BYOK_STORAGE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Partial<ByokConfig>;
    if (c && c.provider && c.apiKey && providerMeta(c.provider)) {
      return { provider: c.provider, apiKey: c.apiKey, model: c.model || undefined };
    }
  } catch {
    // ignore malformed entries
  }
  return null;
}

export function saveByok(c: ByokConfig): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(c));
}

export function clearByok(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(BYOK_STORAGE_KEY);
}

// Headers attached to each concierge request. Empty when no key is configured.
export function byokHeaders(): Record<string, string> {
  const c = loadByok();
  if (!c) return {};
  const h: Record<string, string> = {
    [BYOK_PROVIDER_HEADER]: c.provider,
    [BYOK_KEY_HEADER]: c.apiKey,
  };
  if (c.model) h[BYOK_MODEL_HEADER] = c.model;
  return h;
}
