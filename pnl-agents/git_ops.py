"""Git operations: worktree management, branching, diff extraction."""

import subprocess
import shutil
from pathlib import Path
from config import REPO_ROOT, AGENT_BRANCH_PREFIX, WORKTREE_BASE


def _run(cmd: list[str], cwd: str = None, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd, capture_output=True, text=True,
        cwd=cwd or str(REPO_ROOT), check=check,
    )


def create_worktree(task_id: int, base_branch: str = "main") -> tuple[str, str]:
    """Create isolated git worktree for agent work. Returns (worktree_path, branch_name)."""
    branch = f"{AGENT_BRANCH_PREFIX}task-{task_id}"
    worktree_path = WORKTREE_BASE / f"task-{task_id}"

    # Clean up stale worktree if exists
    if worktree_path.exists():
        remove_worktree(task_id)

    WORKTREE_BASE.mkdir(parents=True, exist_ok=True)

    # Create branch from base if it doesn't exist
    result = _run(["git", "branch", "--list", branch], check=False)
    if branch not in result.stdout:
        _run(["git", "branch", branch, base_branch])

    _run(["git", "worktree", "add", str(worktree_path), branch])
    return str(worktree_path), branch


def remove_worktree(task_id: int):
    """Remove a worktree and optionally its branch."""
    worktree_path = WORKTREE_BASE / f"task-{task_id}"
    _run(["git", "worktree", "remove", str(worktree_path), "--force"], check=False)
    if worktree_path.exists():
        shutil.rmtree(worktree_path, ignore_errors=True)


def commit_changes(worktree_path: str, message: str) -> str | None:
    """Stage all changes and commit in worktree. Returns commit hash or None."""
    # Check for changes
    result = _run(["git", "status", "--porcelain"], cwd=worktree_path)
    if not result.stdout.strip():
        return None

    _run(["git", "add", "-A"], cwd=worktree_path)
    _run(["git", "commit", "-m", message], cwd=worktree_path)

    result = _run(["git", "rev-parse", "HEAD"], cwd=worktree_path)
    return result.stdout.strip()


def get_diff(worktree_path: str, base_branch: str = "main") -> str:
    """Get full diff of agent branch vs base."""
    result = _run(["git", "diff", f"{base_branch}...HEAD"], cwd=worktree_path, check=False)
    return result.stdout


def get_changed_files(worktree_path: str, base_branch: str = "main") -> list[str]:
    """List files changed on agent branch vs base."""
    result = _run(
        ["git", "diff", "--name-only", f"{base_branch}...HEAD"],
        cwd=worktree_path, check=False,
    )
    return [f for f in result.stdout.strip().split("\n") if f]


def get_branch_name(worktree_path: str) -> str:
    result = _run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=worktree_path)
    return result.stdout.strip()


def install_deps(worktree_path: str) -> subprocess.CompletedProcess:
    """Run pnpm install in worktree."""
    return _run(["pnpm", "install", "--frozen-lockfile"], cwd=worktree_path, check=False)
