"""Builder agent: writes code in isolated git worktree."""

from agents.base import call_claude, AgentResult


class BuilderAgent:
    def run(self, subtask: dict, worktree_path: str,
            error_context: str = None, review_feedback: str = None,
            attempt: int = 1) -> AgentResult:
        """Run builder to implement a subtask."""
        parts = [f"Implement this subtask:\n\n{subtask['description']}"]

        if subtask.get("files"):
            parts.append(f"\nTarget files: {', '.join(subtask['files'])}")

        if subtask.get("acceptance_criteria"):
            parts.append(f"\nAcceptance criteria: {subtask['acceptance_criteria']}")

        if error_context:
            parts.append(f"\n\nPREVIOUS ATTEMPT FAILED with this error:\n{error_context}")

        if review_feedback:
            parts.append(f"\n\nREVIEWER FEEDBACK (fix these issues):\n{review_feedback}")

        if attempt >= 3:
            parts.append(
                "\n\nIMPORTANT: This is attempt 3 of 3. Previous approaches failed. "
                "Take a FUNDAMENTALLY DIFFERENT approach this time."
            )

        message = "\n".join(parts)

        return call_claude(
            message,
            system_prompt_file="builder.md",
            cwd=worktree_path,
            allowed_tools=["Edit", "Write", "Read", "Glob", "Grep", "Bash"],
            max_turns=20,
            timeout=600,
        )
