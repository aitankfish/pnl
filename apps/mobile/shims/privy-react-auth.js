// Shim for @privy-io/react-auth AND @privy-io/react-auth/solana on mobile
// Mobile uses @privy-io/expo instead — this prevents crashes from web-only imports
// Hooks that depend on this will return safe defaults

// Polyfill browser Event/EventTarget APIs BEFORE anything else evaluates
// These are required by Privy/Solana wallet-standard libs but don't exist in Hermes
if (typeof globalThis.Event === 'undefined') {
  globalThis.Event = class Event {
    constructor(type, opts) {
      this.type = type;
      this.bubbles = !!(opts && opts.bubbles);
      this.cancelable = !!(opts && opts.cancelable);
      this.defaultPrevented = false;
    }
    preventDefault() { this.defaultPrevented = true; }
    stopPropagation() {}
    stopImmediatePropagation() {}
  };
}
if (typeof globalThis.EventTarget === 'undefined') {
  globalThis.EventTarget = class EventTarget {
    constructor() { this._listeners = {}; }
    addEventListener(type, cb) {
      (this._listeners[type] = this._listeners[type] || []).push(cb);
    }
    removeEventListener(type, cb) {
      const arr = this._listeners[type];
      if (arr) this._listeners[type] = arr.filter(l => l !== cb);
    }
    dispatchEvent(event) {
      const arr = this._listeners[event && event.type];
      if (arr) arr.forEach(cb => cb(event));
      return true;
    }
  };
}

const noop = () => {};
const noopAsync = () => Promise.resolve(null);

// --- @privy-io/react-auth exports ---

export const usePrivy = () => ({
  ready: false,
  authenticated: false,
  user: null,
  login: noop,
  logout: noopAsync,
});

export const useWallets = () => ({
  wallets: [],
});

export const useLoginWithEmail = () => ({
  sendCode: noopAsync,
  loginWithCode: noopAsync,
  state: { status: 'initial' },
});

export const useLoginWithOAuth = () => ({
  initOAuth: noopAsync,
  state: { status: 'initial' },
});

// --- @privy-io/react-auth/solana exports ---

export const useStandardWallets = () => [];

export const useCreateWallet = () => ({
  createWallet: noopAsync,
});

export const useSignAndSendTransaction = () => ({
  signAndSendTransaction: noopAsync,
});

export const useSignTransaction = () => ({
  signTransaction: noopAsync,
});

export default {};
