/**
 * Client-side Logger (shared)
 * Simple console-based logger for client-side code
 */

export interface ClientLogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

export function createClientLogger(prefix: string = 'PNL'): ClientLogger {
  const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development';

  return {
    info: (...args: unknown[]) => {
      if (isDev) console.log(`[${prefix}]`, ...args);
    },
    warn: (...args: unknown[]) => {
      console.warn(`[${prefix}]`, ...args);
    },
    error: (...args: unknown[]) => {
      console.error(`[${prefix}]`, ...args);
    },
    debug: (...args: unknown[]) => {
      if (isDev) console.debug(`[${prefix}]`, ...args);
    },
  };
}
