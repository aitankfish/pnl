"""Verifier agent: runs build/lint/typecheck, uses Claude for error interpretation."""

from agents.base import call_claude, run_shell, AgentResult


class VerifierAgent:
    def run(self, worktree_path: str, steps: list[dict] = None) -> AgentResult:
        """Run verification steps. Returns combined result."""
        if steps is None:
            steps = self._default_steps()

        all_output = []
        for step in steps:
            result = run_shell(step["cmd"], cwd=step.get("cwd", worktree_path))
            status = "PASS" if result.success else "FAIL"
            all_output.append(f"[{status}] {step['name']}: {step['cmd']}")
            if result.stdout:
                all_output.append(result.stdout[-2000:])  # Truncate long output
            if result.stderr:
                all_output.append(result.stderr[-2000:])

            if not result.success:
                # Get Claude to interpret the error
                error_text = (result.stderr or result.stdout)[-3000:]
                interpretation = call_claude(
                    f"Interpret this build error and suggest a concise fix:\n\n"
                    f"Command: {step['cmd']}\n\n{error_text}",
                    timeout=60,
                )
                all_output.append(f"\nError interpretation:\n{interpretation.stdout}")

                return AgentResult(
                    stdout="\n".join(all_output),
                    stderr=result.stderr,
                    success=False,
                    duration_ms=result.duration_ms,
                )

        combined = "\n".join(all_output)
        return AgentResult(stdout=combined, stderr="", success=True, duration_ms=0)

    def _default_steps(self) -> list[dict]:
        return [
            {"name": "install", "cmd": "pnpm install --frozen-lockfile"},
            {"name": "typecheck", "cmd": "pnpm tsc --noEmit"},
            {"name": "lint", "cmd": "pnpm lint"},
        ]
