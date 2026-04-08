"""Base agent: wraps claude --print subprocess calls."""

import subprocess
import time
from pathlib import Path
from config import PROMPTS_DIR


class AgentResult:
    def __init__(self, stdout: str, stderr: str, success: bool, duration_ms: int):
        self.stdout = stdout
        self.stderr = stderr
        self.success = success
        self.duration_ms = duration_ms

    def __repr__(self):
        status = "OK" if self.success else "FAIL"
        return f"AgentResult({status}, {self.duration_ms}ms, {len(self.stdout)} chars)"


def call_claude(
    message: str,
    system_prompt_file: str = None,
    cwd: str = None,
    allowed_tools: list[str] = None,
    max_turns: int = None,
    timeout: int = 300,
) -> AgentResult:
    """Call claude --print with optional system prompt and tools."""
    cmd = ["claude", "--print"]

    if system_prompt_file:
        prompt_path = PROMPTS_DIR / system_prompt_file
        if prompt_path.exists():
            cmd.extend(["--system-prompt", prompt_path.read_text()])

    if allowed_tools:
        cmd.extend(["--allowedTools", ",".join(allowed_tools)])

    if max_turns:
        cmd.extend(["--max-turns", str(max_turns)])

    cmd.append(message)

    start = time.monotonic()
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True,
            cwd=cwd, timeout=timeout,
        )
        duration_ms = int((time.monotonic() - start) * 1000)
        return AgentResult(
            stdout=result.stdout,
            stderr=result.stderr,
            success=result.returncode == 0,
            duration_ms=duration_ms,
        )
    except subprocess.TimeoutExpired:
        duration_ms = int((time.monotonic() - start) * 1000)
        return AgentResult(
            stdout="",
            stderr=f"Agent timed out after {timeout}s",
            success=False,
            duration_ms=duration_ms,
        )


def run_shell(cmd: str, cwd: str = None, timeout: int = 120) -> AgentResult:
    """Run a shell command and return result."""
    start = time.monotonic()
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True,
            cwd=cwd, timeout=timeout,
        )
        duration_ms = int((time.monotonic() - start) * 1000)
        return AgentResult(
            stdout=result.stdout,
            stderr=result.stderr,
            success=result.returncode == 0,
            duration_ms=duration_ms,
        )
    except subprocess.TimeoutExpired:
        duration_ms = int((time.monotonic() - start) * 1000)
        return AgentResult(
            stdout="",
            stderr=f"Command timed out after {timeout}s",
            success=False,
            duration_ms=duration_ms,
        )
