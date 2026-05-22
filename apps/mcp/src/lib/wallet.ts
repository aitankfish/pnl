import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import bs58 from 'bs58';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { randomBytes, scryptSync, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';

// ─── PNL local wallet — encrypted at rest, BIP39-recoverable ─────
//
// The keypair is stored on disk as an encrypted blob. Decryption
// requires the user's passphrase, which is delivered to this process
// either via the PNL_PASSPHRASE env var (set in Claude Code's mcp
// config) or via an OS-native dialog (osascript on macOS, zenity on
// Linux). The agent's chat transcript NEVER sees the passphrase.
//
// File layout:
//   ~/.config/pnl/wallet.enc   - encrypted secret + metadata (mode 0600)
//   ~/.config/pnl/config.json  - autosign cap + RPC URL (mode 0644)
//   ~/.config/pnl/exports/     - timestamped backup dumps (mode 0700)
//
// Recovery model: BIP39 12-word mnemonic, derived at Solana's
// Phantom-compatible path m/44'/501'/0'/0'. Mnemonic is shown ONCE
// during pnl_init and never stored on disk — the user is responsible
// for backing it up. With the mnemonic alone (no passphrase) the user
// can restore on any new machine via pnl_restore.

const PNL_DIR = join(homedir(), '.config', 'pnl');
const WALLET_PATH = join(PNL_DIR, 'wallet.enc');
const CONFIG_PATH = join(PNL_DIR, 'config.json');
const EXPORTS_DIR = join(PNL_DIR, 'exports');

// Default RPC is the hosted MCP proxy on pnl.market, which forwards to
// our paid Helius endpoint. The public Solana mainnet RPC is heavily
// rate-limited (429s during autosign send + confirmation polling) and
// is not a viable default for the autosign create_market / vote flows.
// Power users override via PNL_RPC_URL.
const DEFAULT_RPC = 'https://pnl.market/api/mcp/rpc';
const DEFAULT_AUTOSIGN_CAP_SOL = 0.05;

/** True iff the currently active RPC URL is our hosted MCP proxy.
 *  Tools use this to decide whether to surface the BYO-Helius hint. */
export function isUsingHostedRpc(): boolean {
  return getRpcUrl() === DEFAULT_RPC && !process.env.PNL_RPC_URL?.trim();
}

// Solana / Phantom derivation path. Matches what `solana-keygen new`
// and Phantom's "Add account" flow use, so a mnemonic generated here
// imports cleanly into Phantom and vice versa.
const DERIVATION_PATH = "m/44'/501'/0'/0'";

// scrypt parameters. N=2^17 is the value used by Filecoin / standard
// "good" client setups — ~250MB memory, ~250ms on a modern CPU. Slow
// enough to resist brute force, fast enough that interactive unlock
// feels instant.
const SCRYPT_N = 1 << 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LEN = 32;

// AES-256-GCM nonce is 12 bytes per NIST recommendation.
const GCM_NONCE_LEN = 12;
const GCM_TAG_LEN = 16;

// Cached unlocked secret. Cleared on process exit; also cleared by
// pnl_lock and on TTL expiry.
interface UnlockedState {
  secret: Uint8Array;
  unlockedAt: number;
  unlockedUntil: number;
}
let unlocked: UnlockedState | null = null;

export interface PnlConfig {
  autosignCapSol: number;
  rpcUrl: string;
}

interface EncryptedWalletFile {
  version: 1;
  /** Public key in base58. Stored unencrypted so pnl_wallet doesn't require unlock. */
  address: string;
  /** KDF parameters. */
  kdf: 'scrypt';
  scrypt: { N: number; r: number; p: number; keyLen: number };
  /** Random salt, base64. */
  salt: string;
  /** AES-256-GCM nonce, base64. */
  nonce: string;
  /** AES-256-GCM ciphertext, base64. */
  ciphertext: string;
  /** AES-256-GCM auth tag, base64. */
  tag: string;
  createdAt: string;
}

function ensureDir(): void {
  if (!existsSync(PNL_DIR)) {
    mkdirSync(PNL_DIR, { recursive: true, mode: 0o700 });
  }
}

function ensureExportsDir(): void {
  ensureDir();
  if (!existsSync(EXPORTS_DIR)) {
    mkdirSync(EXPORTS_DIR, { recursive: true, mode: 0o700 });
  }
}

// ─── Crypto primitives ───────────────────────────────────────────

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(Buffer.from(passphrase, 'utf8'), salt, SCRYPT_KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    // scrypt's default maxmem is 32MB which is too small for N=2^17.
    maxmem: 256 * 1024 * 1024,
  });
}

function encryptSecret(secret: Uint8Array, passphrase: string): Omit<EncryptedWalletFile, 'version' | 'address' | 'createdAt' | 'kdf' | 'scrypt'> {
  const salt = randomBytes(16);
  const nonce = randomBytes(GCM_NONCE_LEN);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(secret)), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Wipe the derived key from memory.
  key.fill(0);
  return {
    salt: salt.toString('base64'),
    nonce: nonce.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function decryptSecret(blob: EncryptedWalletFile, passphrase: string): Uint8Array {
  const salt = Buffer.from(blob.salt, 'base64');
  const nonce = Buffer.from(blob.nonce, 'base64');
  const ciphertext = Buffer.from(blob.ciphertext, 'base64');
  const tag = Buffer.from(blob.tag, 'base64');

  // Param sanity — defends against a corrupted file that swaps params
  // to bypass cost (the GCM auth tag would catch it too but bail early).
  if (
    blob.scrypt.N !== SCRYPT_N ||
    blob.scrypt.r !== SCRYPT_R ||
    blob.scrypt.p !== SCRYPT_P ||
    blob.scrypt.keyLen !== SCRYPT_KEY_LEN
  ) {
    throw new Error('wallet file has unexpected scrypt parameters — possibly tampered. Refusing to decrypt.');
  }

  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  try {
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    key.fill(0);
    return new Uint8Array(plain);
  } catch (e) {
    key.fill(0);
    // GCM auth-tag failure is the common case: wrong passphrase.
    // Use a generic message so we don't leak whether the failure was
    // tag mismatch vs something else (timing safety hygiene).
    throw new Error('passphrase is incorrect (or the wallet file is corrupted)');
  }
}

// ─── Mnemonic / keypair derivation ───────────────────────────────

export function generateMnemonic(): string {
  // bip39 uses crypto.randomBytes under the hood. 128 bits of entropy
  // → 12 words. Standard.
  return bip39.generateMnemonic(128);
}

export function isValidMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

/** Returns a Solana Keypair derived from the BIP39 mnemonic at the
 *  Phantom-compatible path m/44'/501'/0'/0'. */
export function keypairFromMnemonic(mnemonic: string): Keypair {
  const cleaned = mnemonic.trim().split(/\s+/).join(' ').toLowerCase();
  if (!bip39.validateMnemonic(cleaned)) {
    throw new Error('mnemonic is not a valid BIP39 phrase — check spelling and word count (must be 12 or 24 words)');
  }
  const seed = bip39.mnemonicToSeedSync(cleaned); // 64 bytes
  const { key } = derivePath(DERIVATION_PATH, seed.toString('hex'));
  // ed25519-hd-key returns a 32-byte seed; Solana wants 64 bytes
  // (seed || pubkey). Keypair.fromSeed handles that for us.
  return Keypair.fromSeed(key);
}

// ─── State queries ───────────────────────────────────────────────

export function hasWallet(): boolean {
  return existsSync(WALLET_PATH);
}

function readWalletFile(): EncryptedWalletFile {
  const raw = readFileSync(WALLET_PATH, 'utf8');
  const parsed = JSON.parse(raw) as EncryptedWalletFile;
  if (parsed.version !== 1) {
    throw new Error(`wallet file version ${parsed.version} is not supported`);
  }
  return parsed;
}

export function getAddress(): string {
  return readWalletFile().address;
}

// ─── Lock / unlock ───────────────────────────────────────────────

export function isUnlocked(): boolean {
  if (!unlocked) return false;
  if (Date.now() > unlocked.unlockedUntil) {
    lock();
    return false;
  }
  return true;
}

export function unlockWith(passphrase: string, ttlMinutes = 5): { address: string } {
  if (!hasWallet()) {
    throw new Error('No PNL wallet on this machine. Run pnl_init first.');
  }
  const blob = readWalletFile();
  const secret = decryptSecret(blob, passphrase);
  unlocked = {
    secret,
    unlockedAt: Date.now(),
    unlockedUntil: Date.now() + ttlMinutes * 60 * 1000,
  };
  return { address: blob.address };
}

export function lock(): void {
  if (unlocked) {
    // Zero out the cached secret before releasing the reference.
    unlocked.secret.fill(0);
    unlocked = null;
  }
}

/** Returns the in-memory Keypair if the wallet is currently unlocked.
 *  Throws with a "wallet locked" message otherwise. */
export function requireUnlockedKeypair(): Keypair {
  if (!isUnlocked() || !unlocked) {
    throw new Error(
      'Wallet is locked. Call pnl_unlock first — passphrase is read from your PNL_PASSPHRASE env var (set in Claude Code mcp config) or via an OS-native dialog. Never type it directly in chat.',
    );
  }
  return Keypair.fromSecretKey(unlocked.secret);
}

export function unlockStatus(): { unlocked: boolean; secondsRemaining: number } {
  if (!isUnlocked() || !unlocked) return { unlocked: false, secondsRemaining: 0 };
  return {
    unlocked: true,
    secondsRemaining: Math.max(0, Math.floor((unlocked.unlockedUntil - Date.now()) / 1000)),
  };
}

// ─── Wallet creation / restore ───────────────────────────────────

export interface CreatedWallet {
  address: string;
  /** 12-word BIP39 mnemonic. Shown to user ONCE — never stored on disk. */
  mnemonic: string;
}

/** Generate a fresh BIP39 mnemonic + keypair, encrypt the secret with
 *  the user's passphrase, write to disk. Returns the mnemonic so the
 *  agent can display it once for the user to write down. */
export function createWallet(passphrase: string): CreatedWallet {
  if (hasWallet()) {
    throw new Error(
      `A PNL wallet already exists at ${WALLET_PATH}. Use pnl_export_keypair to back it up before deleting and regenerating.`,
    );
  }
  if (!passphrase || passphrase.length < 8) {
    throw new Error('passphrase must be at least 8 characters');
  }
  ensureDir();
  const mnemonic = generateMnemonic();
  const keypair = keypairFromMnemonic(mnemonic);
  const enc = encryptSecret(keypair.secretKey, passphrase);
  const blob: EncryptedWalletFile = {
    version: 1,
    address: keypair.publicKey.toBase58(),
    kdf: 'scrypt',
    scrypt: { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, keyLen: SCRYPT_KEY_LEN },
    ...enc,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(WALLET_PATH, JSON.stringify(blob, null, 2), { mode: 0o600 });
  try {
    chmodSync(WALLET_PATH, 0o600);
  } catch {
    /* non-fatal */
  }
  return { address: blob.address, mnemonic };
}

/** Restore a wallet from an existing BIP39 mnemonic. The user's
 *  passphrase encrypts the derived secret on disk. */
export function restoreWallet(
  mnemonic: string,
  passphrase: string,
  opts: { allowOverwrite?: boolean } = {},
): { address: string } {
  if (hasWallet() && !opts.allowOverwrite) {
    throw new Error(
      `A PNL wallet already exists at ${WALLET_PATH}. Pass allowOverwrite: true if you really mean to replace it (back it up first with pnl_export_keypair).`,
    );
  }
  if (!passphrase || passphrase.length < 8) {
    throw new Error('passphrase must be at least 8 characters');
  }
  ensureDir();
  const keypair = keypairFromMnemonic(mnemonic);
  const enc = encryptSecret(keypair.secretKey, passphrase);
  const blob: EncryptedWalletFile = {
    version: 1,
    address: keypair.publicKey.toBase58(),
    kdf: 'scrypt',
    scrypt: { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, keyLen: SCRYPT_KEY_LEN },
    ...enc,
    createdAt: new Date().toISOString(),
  };
  writeFileSync(WALLET_PATH, JSON.stringify(blob, null, 2), { mode: 0o600 });
  try {
    chmodSync(WALLET_PATH, 0o600);
  } catch {
    /* non-fatal */
  }
  lock(); // make user re-unlock with the new passphrase
  return { address: blob.address };
}

// ─── Export to file (never to chat) ──────────────────────────────

/** Writes the (currently unlocked) secret to a timestamped file under
 *  ~/.config/pnl/exports/ with mode 0600 and returns the path. The
 *  caller relays just the path to the agent — the secret never enters
 *  the conversation transcript. */
export function exportToFile(): { path: string; address: string } {
  const kp = requireUnlockedKeypair();
  ensureExportsDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const path = join(EXPORTS_DIR, `keypair-${ts}.txt`);
  const base58 = bs58.encode(kp.secretKey);
  const jsonArray = JSON.stringify(Array.from(kp.secretKey));
  const body = [
    '# PNL keypair backup',
    `# Generated: ${new Date().toISOString()}`,
    `# Address: ${kp.publicKey.toBase58()}`,
    '#',
    '# TREAT THIS LIKE A PASSWORD. Anyone with this key can spend the SOL',
    '# on this wallet. After moving the contents to a password manager,',
    '# DELETE THIS FILE: rm "' + path + '"',
    '',
    '## Phantom / Solflare / Backpack ("Import Private Key"):',
    base58,
    '',
    '## Solana CLI (save as ~/.config/solana/id.json):',
    jsonArray,
    '',
  ].join('\n');
  writeFileSync(path, body, { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    /* non-fatal */
  }
  return { path, address: kp.publicKey.toBase58() };
}

// ─── Config (autosign cap, RPC URL) ──────────────────────────────

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

export function getRpcUrl(): string {
  return process.env.PNL_RPC_URL?.trim() || loadConfig().rpcUrl;
}

export function getConnection(): Connection {
  return new Connection(getRpcUrl(), 'confirmed');
}

export async function getBalanceSol(pubkey: PublicKey): Promise<number> {
  const conn = getConnection();
  const lamports = await conn.getBalance(pubkey, 'confirmed');
  return lamports / LAMPORTS_PER_SOL;
}

// ─── Clear cache on process exit (defense in depth) ──────────────

process.on('exit', () => {
  try {
    lock();
  } catch {
    /* ignore */
  }
});

// Best-effort constant-time check exported for tools that need it
// (signature verification of e.g. challenge responses).
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export const WALLET_PATHS = {
  dir: PNL_DIR,
  wallet: WALLET_PATH,
  config: CONFIG_PATH,
  exports: EXPORTS_DIR,
} as const;
