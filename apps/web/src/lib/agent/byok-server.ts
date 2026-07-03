/**
 * Server-only BYOK helpers: turn the per-request provider + key (+ model)
 * headers a browser sends into a Vercel AI SDK LanguageModel. The key never
 * leaves the request scope — never persisted, never logged.
 *
 * The client-safe pieces (header names, provider list, localStorage) live in
 * ./byok-shared. This file imports the provider SDKs, so it must stay
 * server-only (never pulled into a client bundle).
 */

import type { LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  BYOK_PROVIDER_HEADER,
  BYOK_KEY_HEADER,
  BYOK_MODEL_HEADER,
  providerMeta,
} from './byok-shared';

export interface ByokRequest {
  provider: string;
  apiKey: string;
  model?: string;
}

/** Pull the BYOK provider + key (+ optional model) from request headers. */
export function readByok(req: Request): ByokRequest {
  return {
    provider: req.headers.get(BYOK_PROVIDER_HEADER)?.trim() || '',
    apiKey: req.headers.get(BYOK_KEY_HEADER)?.trim() || '',
    model: req.headers.get(BYOK_MODEL_HEADER)?.trim() || undefined,
  };
}

/**
 * Build a model instance from the user-supplied provider + key. The key never
 * leaves this request scope. Throws on unknown/unsupported provider.
 */
export function buildModel(provider: string, apiKey: string, model?: string): LanguageModel {
  const id = model?.trim() || providerMeta(provider)?.defaultModel;
  if (!id) throw new Error(`unknown provider: ${provider}`);
  switch (provider) {
    case 'anthropic':
      return createAnthropic({ apiKey })(id);
    case 'openai':
      return createOpenAI({ apiKey })(id);
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(id);
    case 'openrouter':
      return createOpenRouter({ apiKey })(id);
    default:
      throw new Error(`unsupported provider: ${provider}`);
  }
}
