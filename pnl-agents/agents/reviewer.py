"""Reviewer agent: reviews diffs for quality, security, and patterns."""

import json
from agents.base import call_claude, AgentResult


class ReviewerAgent:
    def run(self, diff: str, subtask_description: str = "") -> AgentResult:
        """Review a diff and return structured verdict."""
        # Truncate very large diffs
        if len(diff) > 15000:
            diff = diff[:15000] + "\n\n... (diff truncated)"

        message = f"""Review this code diff for a Solana prediction market monorepo (Next.js + React Native + Anchor).

SUBTASK: {subtask_description}

DIFF:
```
{diff}
```

CHECKLIST:
1. No secrets, API keys, or private keys in code
2. Proper error handling (no swallowed errors)
3. Solana: signer validation, no unsigned transactions
4. No web-only APIs used in mobile code (no window/document)
5. Shared package exports are correct
6. No obvious security vulnerabilities (XSS, injection, etc.)
7. Code follows existing patterns in the codebase

Respond with ONLY valid JSON (no markdown fencing):
{{
  "approved": true/false,
  "issues": ["list of issues found"],
  "severity": "none|low|medium|high|critical",
  "suggestions": ["optional improvement suggestions"]
}}"""

        return call_claude(message, system_prompt_file="reviewer.md", timeout=120)

    def parse_verdict(self, result: AgentResult) -> dict:
        """Parse reviewer output into verdict dict."""
        text = result.stdout.strip()

        # Handle markdown fencing
        if "```" in text:
            lines = text.split("\n")
            json_lines = []
            in_block = False
            for line in lines:
                if line.strip().startswith("```"):
                    in_block = not in_block
                    continue
                if in_block:
                    json_lines.append(line)
            text = "\n".join(json_lines)

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    return json.loads(text[start:end])
                except json.JSONDecodeError:
                    pass
            # Default to rejected if we can't parse
            return {
                "approved": False,
                "issues": ["Could not parse reviewer output"],
                "severity": "medium",
                "suggestions": [],
            }
