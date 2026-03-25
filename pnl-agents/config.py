"""Configuration for PNL multi-agent build system."""

from pathlib import Path

# Paths
REPO_ROOT = Path(__file__).parent.parent.resolve()
AGENTS_DIR = Path(__file__).parent.resolve()
PROMPTS_DIR = AGENTS_DIR / "prompts"
DB_PATH = AGENTS_DIR / "pnl_agents.db"

# Git
AGENT_BRANCH_PREFIX = "agent/"
WORKTREE_BASE = Path("/tmp/pnl-agent-worktrees")

# Agent retry limits
MAX_ATTEMPTS = 3

# Human approval gates — file patterns that require human sign-off
HUMAN_GATE_PATTERNS = [
    "*.rs",                          # Solana program changes
    "*/models/*.ts",                 # MongoDB schema changes
    "*/api/**/*.ts",                 # API route contract changes
]

# Build commands (ordered — later stages depend on earlier ones)
BUILD_STEPS = [
    {"name": "shared", "cmd": "pnpm build:shared", "cwd": str(REPO_ROOT)},
    {"name": "web", "cmd": "pnpm build:web", "cwd": str(REPO_ROOT)},
]

# Verification commands
VERIFY_STEPS = [
    {"name": "typecheck", "cmd": "pnpm tsc --noEmit", "cwd": str(REPO_ROOT)},
    {"name": "lint", "cmd": "pnpm lint", "cwd": str(REPO_ROOT)},
]
