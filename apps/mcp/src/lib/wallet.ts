import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';

// ─── Local keypair management ────────────────────────────────────
//
// The MCP server holds an Ed25519 keypair on disk. The user owns the
// seed — we expose pnl_export_keypair so they can move it anywhere
// else (Phantom, Solflare, Backpack — they all accept Solana keypair
// JSON). The protocol is still non-custodial: the SOL lives on-chain
// under a pubkey only the user controls. This is the same trust model
// `solana-keygen new` uses.
//
// File layout — matches the Solana CLI convention so the keypair is
// portable to any Solana tool:
//   ~/.config/pnl/keypair.json   — 64-byte secret key as JSON array (mode 0600)
//   ~/.config/pnl/config.json    — autosign cap + other prefs (mode 0644)

const PNL_DIR = join(homedir(), '.config', 'pnl');
const KEYPAIR_PATH = join(PNL_DIR, 'keypair.json');
const CONFIG_PATH = join(PNL_DIR, 'config.json');

const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

// Routine actions (idea post ≈ $0.013 SOL, small votes) sign without
// confirmation. Anything above this cap returns a deep-link the user
// confirms in their external wallet. Tunable via pnl_set_autosign.
const DEFAULT_AUTOSIGN_CAP_SOL = 0.05;

export interface PnlConfig {
  autosignCapSol: number;
  rpcUrl: string;
}

function ensureDir(): void {
  if (!existsSync(PNL_DIR)) {
    mkdirSync(PNL_DIR, { recursive: true, mode: 0o700 });
  }
}

export function getRpcUrl(): string {
  return process.env.PNL_RPC_URL?.trim() || loadConfig().rpcUrl;
}

export function getConnection(): Connection {
  return new Connection(getRpcUrl(), 'confirmed');
}

export function hasKeypair(): boolean {
  return existsSync(KEYPAIR_PATH);
}

export function loadKeypair(): Keypair {
  if (!hasKeypair()) {
    throw new Error(
      'No PNL keypair on this machine yet. Run pnl_init first — it generates a local Solana keypair, then shows you the deposit address.',
    );
  }
  const raw = readFileSync(KEYPAIR_PATH, 'utf8');
  let secret: Uint8Array;
  try {
    const parsed = JSON.parse(raw) as number[];
    if (!Array.isArray(parsed) || parsed.length !== 64) {
      throw new Error('keypair file is not a 64-byte JSON array');
    }
    secret = Uint8Array.from(parsed);
  } catch (e) {
    throw new Error(
      `keypair file at ${KEYPAIR_PATH} is malformed — ${e instanceof Error ? e.message : String(e)}. Delete it and run pnl_init again, or restore from a backup.`,
    );
  }
  return Keypair.fromSecretKey(secret);
}

export function generateKeypair(): Keypair {
  ensureDir();
  if (hasKeypair()) {
    throw new Error(
      `A PNL keypair already exists at ${KEYPAIR_PATH}. Use pnl_wallet to see its address, or pnl_export_keypair to back it up before deleting and regenerating.`,
    );
  }
  const kp = Keypair.generate();
  const secret = Array.from(kp.secretKey);
  writeFileSync(KEYPAIR_PATH, JSON.stringify(secret), { mode: 0o600 });
  // Belt and braces — writeFileSync mode is honored on Unix but not on
  // some Windows file systems; chmod afterwards covers macOS/Linux at least.
  try {
    chmodSync(KEYPAIR_PATH, 0o600);
  } catch {
    /* non-fatal on platforms without POSIX perms */
  }
  return kp;
}

export function loadConfig(): PnlConfig {
  ensureDir();
  if (!existsSync(CONFIG_PATH)) {
    return { autosignCapSol: DEFAULT_AUTOSIGN_CAP_SOL, rpcUrl: DEFAULT_RPC };
  }
  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Partial<PnlConfig>;
    return {
      autosignCapSol:
        typeof parsed.autosignCapSol === 'number' && parsed.autosignCapSol >= 0
          ? parsed.autosignCapSol
          : DEFAULT_AUTOSIGN_CAP_SOL,
      rpcUrl:
        typeof parsed.rpcUrl === 'string' && parsed.rpcUrl.length > 0
          ? parsed.rpcUrl
          : DEFAULT_RPC,
    };
  } catch {
    return { autosignCapSol: DEFAULT_AUTOSIGN_CAP_SOL, rpcUrl: DEFAULT_RPC };
  }
}

export function saveConfig(updates: Partial<PnlConfig>): PnlConfig {
  const current = loadConfig();
  const next = { ...current, ...updates };
  ensureDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2));
  return next;
}

export async function getBalanceSol(pubkey: PublicKey): Promise<number> {
  const conn = getConnection();
  const lamports = await conn.getBalance(pubkey, 'confirmed');
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Encode the secret key as the base58 string format Phantom / Solflare
 * accept on import. Returned alongside the standard JSON array form so
 * the user can pick whichever fits their target wallet.
 */
export function exportSecret(kp: Keypair): { base58: string; jsonArray: number[] } {
  return {
    base58: bs58.encode(kp.secretKey),
    jsonArray: Array.from(kp.secretKey),
  };
}

export const WALLET_PATHS = {
  dir: PNL_DIR,
  keypair: KEYPAIR_PATH,
  config: CONFIG_PATH,
} as const;
