// ─── pnl-mcp-server install ──────────────────────────────────────
//
// One-shot installer that wires @pnlmarket/mcp-server into the user's agent
// of choice (Claude Code, Cursor, Cline) and optionally drops the
// SKILL.md slash commands into their skills directory.
//
// Usage:
//   npx @pnlmarket/mcp-server install            # prints plan, asks for confirm
//   npx @pnlmarket/mcp-server install --write    # apply without confirmation
//   npx @pnlmarket/mcp-server install --skills   # only install slash commands
//
// Idempotent: re-running is safe. Existing entries get replaced
// in-place, no duplicates accumulate.

import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_KEY = 'pnl';
const NPX_COMMAND = 'npx';
const NPX_ARGS = ['-y', '@pnlmarket/mcp-server'];

interface AgentTarget {
  label: string;
  configPath: string;
  description: string;
}

function candidates(): AgentTarget[] {
  const home = homedir();
  return [
    {
      label: 'Claude Code CLI',
      configPath: join(home, '.claude.json'),
      description: 'The Claude Code terminal app reads MCP servers from here.',
    },
    {
      label: 'Claude Desktop (macOS)',
      configPath: join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
      description: 'The desktop app on macOS.',
    },
    {
      label: 'Cursor',
      configPath: join(home, '.cursor', 'mcp.json'),
      description: 'Cursor MCP config.',
    },
  ];
}

function readJson(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

function writeJson(path: string, data: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

function ensureMcpServer(config: Record<string, unknown>): { changed: boolean; existingMatches: boolean } {
  const existing = (config.mcpServers as Record<string, unknown> | undefined) ?? {};
  const current = existing[SERVER_KEY] as { command?: string; args?: string[] } | undefined;
  const matches =
    current?.command === NPX_COMMAND &&
    Array.isArray(current.args) &&
    current.args.length === NPX_ARGS.length &&
    current.args.every((a, i) => a === NPX_ARGS[i]);
  if (matches) {
    return { changed: false, existingMatches: true };
  }
  (config as { mcpServers: Record<string, unknown> }).mcpServers = {
    ...existing,
    [SERVER_KEY]: { command: NPX_COMMAND, args: NPX_ARGS },
  };
  return { changed: true, existingMatches: false };
}

function installSkills(): { copied: number; targetDir: string } {
  const targetDir = join(homedir(), '.claude', 'skills');
  mkdirSync(targetDir, { recursive: true });

  // The skills directory ships alongside the npm tarball. From dist/,
  // that's ../skills.
  const here = dirname(fileURLToPath(import.meta.url));
  const skillsRoot = join(here, '..', 'skills');
  if (!existsSync(skillsRoot)) {
    return { copied: 0, targetDir };
  }

  let copied = 0;
  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith('pnl-')) continue;
    const src = join(skillsRoot, entry.name);
    const dest = join(targetDir, entry.name);
    // cpSync with recursive overwrite — re-running the installer just
    // refreshes the templates with whatever the current package ships.
    cpSync(src, dest, { recursive: true, force: true });
    copied++;
  }
  return { copied, targetDir };
}

function logBlock(title: string, body: string): void {
  process.stdout.write(`\n── ${title} ──\n${body}\n`);
}

export async function runInstall(argv: string[]): Promise<number> {
  const flags = new Set(argv.slice(1));
  const write = flags.has('--write') || flags.has('-y') || flags.has('--yes');
  const skillsOnly = flags.has('--skills');
  const noSkills = flags.has('--no-skills');

  process.stdout.write('\n@pnlmarket/mcp-server installer\n');

  // 1. Discover target configs.
  const targets = candidates();
  const present = targets.filter((t) => existsSync(t.configPath));
  const missing = targets.filter((t) => !existsSync(t.configPath));

  if (skillsOnly) {
    const { copied, targetDir } = installSkills();
    process.stdout.write(`\nSlash commands installed: ${copied} skill${copied === 1 ? '' : 's'} -> ${targetDir}\n`);
    process.stdout.write('Restart Claude Code, then type /pnl-init to begin.\n');
    return 0;
  }

  const planLines: string[] = [];
  if (present.length === 0) {
    planLines.push('No agent config files found at the standard locations.');
    planLines.push('You can still run the server directly. After installing globally with `npm i -g @pnlmarket/mcp-server`, add this to your agent\'s MCP config:');
    planLines.push('');
    planLines.push(JSON.stringify({ mcpServers: { [SERVER_KEY]: { command: NPX_COMMAND, args: NPX_ARGS } } }, null, 2));
  } else {
    planLines.push('Will add an `mcpServers.pnl` entry pointing to `npx -y @pnlmarket/mcp-server` in:');
    for (const t of present) {
      planLines.push(`  • ${t.label}: ${t.configPath}`);
    }
    if (missing.length) {
      planLines.push('');
      planLines.push('Not found (skipped):');
      for (const t of missing) {
        planLines.push(`  • ${t.label}: ${t.configPath}`);
      }
    }
  }

  if (!noSkills) {
    planLines.push('');
    planLines.push(`Will also copy the slash-command skills (pnl-init, pnl-wallet, pnl-unlock, pnl-lock, pnl-restore, pnl-export, pnl-name, pnl-browse, pnl-pitch, pnl-pitch-now, pnl-vote, pnl-vote-now, pnl-claim, pnl-claim-now, pnl-notify, pnl-help) to ~/.claude/skills/`);
  }

  logBlock('Plan', planLines.join('\n'));

  if (!write) {
    process.stdout.write(
      '\nRe-run with `--write` (or `-y`) to apply.\n  npx @pnlmarket/mcp-server install --write\n\n',
    );
    return 0;
  }

  // 2. Apply.
  let mcpWritten = 0;
  let mcpAlready = 0;
  for (const target of present) {
    const config = readJson(target.configPath);
    const { changed, existingMatches } = ensureMcpServer(config);
    if (existingMatches) {
      mcpAlready++;
      continue;
    }
    if (changed) {
      writeJson(target.configPath, config);
      mcpWritten++;
    }
  }

  const skillsResult = !noSkills ? installSkills() : null;

  logBlock(
    'Done',
    [
      `MCP server entries written: ${mcpWritten}${mcpAlready ? ` (${mcpAlready} already current)` : ''}`,
      skillsResult
        ? `Slash commands installed: ${skillsResult.copied} skill${skillsResult.copied === 1 ? '' : 's'} -> ${skillsResult.targetDir}`
        : 'Slash commands: skipped (--no-skills)',
      '',
      'Next:',
      '  1. Restart Claude Code / Cursor.',
      '  2. Type /pnl-init in any session — it generates a local Solana keypair and shows the deposit address.',
      '  3. Fund the wallet with at least 0.05 SOL from any Solana wallet, then /pnl-pitch an idea.',
    ].join('\n'),
  );
  return 0;
}
