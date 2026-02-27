/**
 * API URL helper
 * Web: returns relative path (empty base)
 * Mobile: prepends API_BASE_URL for absolute URLs
 */

import { getEnvConfig } from '../config/environment';

export function apiUrl(path: string): string {
  const base = getEnvConfig().API_BASE_URL;
  if (!base) return path; // Web: relative URLs
  return `${base.replace(/\/$/, '')}${path}`;
}

export function getSocketUrl(): string {
  const config = getEnvConfig();
  if (config.API_BASE_URL) {
    return config.API_BASE_URL;
  }
  // Web: derive from window.location
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.host}`;
  }
  return 'http://localhost:3000';
}
