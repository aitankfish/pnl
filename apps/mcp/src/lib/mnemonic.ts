import { execFileSync } from 'node:child_process';

// ─── Native mnemonic prompt + overwrite confirm ──────────────────
//
// The BIP39 mnemonic is the MOST sensitive secret in PNL — it bypasses
// the wallet passphrase entirely. Anyone with the 12 (or 24) words can
// restore the wallet on any machine and sign anything. So it must NEVER
// enter the agent's chat transcript or sit in tool arguments — same
// principle as the passphrase prompt in `./passphrase.ts`, but the
// stakes are even higher.
//
// pnl_restore used to accept `mnemonic` as a tool input, which meant
// the seed flowed through Claude Code's transcript, was sent to
// Anthropic's API, and persisted in the local conversation history.
// Now we read it via the same OS-native dialog path the passphrase
// uses (hidden input on macOS osascript / Linux zenity).
//
// Fallback hierarchy:
//   1. PNL_MNEMONIC env var (e.g., for CI / scripted recovery)
//   2. Native dialog (macOS osascript / Linux zenity)
//   3. Throw with a clear message

export interface MnemonicPromptOptions {
  /** Title shown on the dialog */
  title?: string;
  /** Prompt text inside the dialog */
  prompt?: string;
}

function fromEnv(): string | null {
  const raw = process.env.PNL_MNEMONIC;
  if (raw && raw.length > 0) return raw;
  return null;
}

function macosMnemonicPrompt(prompt: string, title: string): string {
  // Same env-var trick as passphrase.ts — values never go through
  // AppleScript string interpolation. Hidden answer keeps the seed off
  // the screen (shoulder-surfing defense).
  const script = `set p to system attribute "PNL_DIALOG_PROMPT"
set t to system attribute "PNL_DIALOG_TITLE"
display dialog p default answer "" with hidden answer with title t
return text returned of result`;
  const out = execFileSync('osascript', ['-e', script], {
    encoding: 'utf8',
    env: { ...process.env, PNL_DIALOG_PROMPT: prompt, PNL_DIALOG_TITLE: title },
  });
  return out.trim();
}

function linuxMnemonicPrompt(prompt: string, title: string): string {
  // zenity --password uses hidden input; perfect for a seed phrase.
  const out = execFileSync(
    'zenity',
    ['--password', '--title', title, '--text', prompt],
    { encoding: 'utf8' },
  );
  return out.trim();
}

/**
 * Read the BIP39 mnemonic from the user via OS-native dialog (or
 * PNL_MNEMONIC env). Throws if no path is available.
 *
 * Does NOT validate — caller should pass the result through
 * `isValidMnemonic` from wallet.ts (which normalises whitespace and
 * checks the BIP39 wordlist).
 */
export function promptMnemonic(opts: MnemonicPromptOptions = {}): string {
  const envValue = fromEnv();
  if (envValue) return envValue;

  const title = opts.title || 'PNL Wallet — Restore';
  const prompt =
    opts.prompt ||
    'Enter your 12 or 24 word recovery phrase (words separated by spaces):';

  try {
    if (process.platform === 'darwin') {
      return macosMnemonicPrompt(prompt, title);
    }
    if (process.platform === 'linux') {
      return linuxMnemonicPrompt(prompt, title);
    }
  } catch (e) {
    throw new Error(
      `Couldn't open the native mnemonic dialog (${e instanceof Error ? e.message : String(e)}). Set the PNL_MNEMONIC env var in your Claude Code mcp config (or as a one-shot env on the MCP launch) and try again — see apps/mcp/README.md.`,
    );
  }

  throw new Error(
    `Native mnemonic dialog isn't supported on ${process.platform} yet. Set the PNL_MNEMONIC env var in your Claude Code mcp config and retry.`,
  );
}

// ─── Overwrite-confirm dialog ────────────────────────────────────
//
// Restore over an existing wallet is loss-of-funds-irreversible: the
// old encrypted keystore is replaced with the new one, so any SOL on
// the previous address becomes inaccessible until the user separately
// restores the OLD mnemonic. We require a YES/NO OS dialog showing
// both addresses + the prompt to confirm — the agent can't synthesize
// a click, so this can't be defeated by prompt injection.
//
// Returns true if the user confirmed, false if cancelled.

function macosConfirmOverwrite(oldAddress: string, newAddress: string): boolean {
  const message =
    `You are about to REPLACE your PNL wallet.\n\n` +
    `OLD address (will become inaccessible unless you have its mnemonic backed up):\n  ${oldAddress}\n\n` +
    `NEW address (derived from the recovery phrase you just entered):\n  ${newAddress}\n\n` +
    `This cannot be undone. Continue?`;
  const script = `set m to system attribute "PNL_DIALOG_MESSAGE"
set t to system attribute "PNL_DIALOG_TITLE"
display dialog m buttons {"Cancel", "Replace wallet"} default button "Cancel" with title t with icon caution
return button returned of result`;
  try {
    const out = execFileSync('osascript', ['-e', script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PNL_DIALOG_MESSAGE: message,
        PNL_DIALOG_TITLE: 'PNL Wallet — Confirm Replace',
      },
    });
    return out.trim() === 'Replace wallet';
  } catch {
    // osascript exits non-zero when the user clicks Cancel — treat as
    // declined rather than as an error.
    return false;
  }
}

function linuxConfirmOverwrite(oldAddress: string, newAddress: string): boolean {
  const text =
    `You are about to REPLACE your PNL wallet.\n\n` +
    `OLD address (will become inaccessible unless backed up):\n  ${oldAddress}\n\n` +
    `NEW address (from the recovery phrase you entered):\n  ${newAddress}\n\n` +
    `This cannot be undone. Continue?`;
  try {
    execFileSync(
      'zenity',
      [
        '--question',
        '--title',
        'PNL Wallet — Confirm Replace',
        '--text',
        text,
        '--ok-label',
        'Replace wallet',
        '--cancel-label',
        'Cancel',
      ],
      { encoding: 'utf8' },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Ask the user via OS-native dialog whether they really want to
 * overwrite an existing wallet. Returns false on Cancel, on any
 * dialog error, or on unsupported platforms (fail-closed).
 *
 * Note: an env-var bypass is intentionally NOT provided here. The
 * point of this dialog is to defeat prompt-injection attacks where
 * the agent passes `allowOverwrite: true` based on instructions
 * smuggled in via market metadata. If an env-var existed, the agent
 * could set it.
 */
export function confirmOverwrite(oldAddress: string, newAddress: string): boolean {
  if (process.platform === 'darwin') return macosConfirmOverwrite(oldAddress, newAddress);
  if (process.platform === 'linux') return linuxConfirmOverwrite(oldAddress, newAddress);
  return false;
}
