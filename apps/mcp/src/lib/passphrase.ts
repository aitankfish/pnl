import { execFileSync } from 'node:child_process';

// ─── Native passphrase prompts ───────────────────────────────────
//
// We never want the wallet passphrase to enter the agent's chat
// transcript or sit in tool arguments. On the platforms we support,
// the MCP server spawns an OS-native dialog so the user types
// directly into the OS (hidden input). The agent process can't read
// what's in the dialog — it only sees the result on stdout after
// the user confirms.
//
// Fallback hierarchy:
//   1. PNL_PASSPHRASE env var (set in Claude Code mcp config)
//   2. Native dialog (macOS osascript / Linux zenity)
//   3. Throw with a clear message
//
// Windows fallback is env var only for now — a PowerShell-based
// dialog is a v0.4 follow-up.

export interface PromptOptions {
  /** Title shown on the dialog */
  title?: string;
  /** Prompt text inside the dialog */
  prompt?: string;
  /** If true, ask twice and require they match (for setup) */
  confirm?: boolean;
}

function fromEnv(): string | null {
  const raw = process.env.PNL_PASSPHRASE;
  if (raw && raw.length > 0) return raw;
  return null;
}

function macosPrompt(prompt: string, title: string): string {
  // osascript escapes: we use a heredoc-style applescript and inject
  // strings as bash args (execFileSync arrays are safe from shell injection).
  const script = `display dialog "${prompt.replace(/"/g, '\\"')}" default answer "" with hidden answer with title "${title.replace(/"/g, '\\"')}"
return text returned of result`;
  const out = execFileSync('osascript', ['-e', script], { encoding: 'utf8' });
  return out.trim();
}

function linuxPrompt(prompt: string, _title: string): string {
  const out = execFileSync('zenity', ['--password', '--title', _title], { encoding: 'utf8' });
  return out.trim();
}

/**
 * Request the wallet passphrase from the user, never via the agent.
 *
 * Throws with a helpful message if no path is available so the agent
 * can relay the failure clearly ("set PNL_PASSPHRASE in your Claude
 * Code mcp config and restart").
 */
export function promptPassphrase(opts: PromptOptions = {}): string {
  const envValue = fromEnv();
  if (envValue) return envValue;

  const title = opts.title || 'PNL Wallet';
  const prompt = opts.prompt || 'Enter your PNL wallet passphrase:';

  try {
    if (process.platform === 'darwin') {
      const first = macosPrompt(prompt, title);
      if (opts.confirm) {
        const again = macosPrompt('Re-enter to confirm:', title);
        if (first !== again) throw new Error('passphrases do not match');
      }
      return first;
    }
    if (process.platform === 'linux') {
      const first = linuxPrompt(prompt, title);
      if (opts.confirm) {
        const again = linuxPrompt('Re-enter to confirm:', title);
        if (first !== again) throw new Error('passphrases do not match');
      }
      return first;
    }
  } catch (e) {
    throw new Error(
      `Couldn't open the native passphrase dialog (${e instanceof Error ? e.message : String(e)}). Set the PNL_PASSPHRASE env var in your Claude Code mcp config and restart — see apps/mcp/README.md for the snippet.`,
    );
  }

  throw new Error(
    `Native passphrase dialog isn't supported on ${process.platform} yet. Set the PNL_PASSPHRASE env var in your Claude Code mcp config and restart.`,
  );
}
