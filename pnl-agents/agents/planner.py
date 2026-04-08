"""Planner agent: decomposes tasks into ordered subtasks."""

import json
from agents.base import call_claude, AgentResult


class PlannerAgent:
    def run(self, task_description: str) -> AgentResult:
        message = f"""Decompose this task into ordered subtasks for implementation.

TASK: {task_description}

RULES:
- Each subtask should touch ONE layer only (shared lib → API → web UI → mobile)
- Order subtasks by dependency (shared first, then consumers)
- Be specific about which files to create or modify
- Include acceptance criteria for each subtask

Respond with ONLY valid JSON (no markdown fencing):
{{
  "subtasks": [
    {{
      "seq": 1,
      "description": "...",
      "files": ["path/to/file.ts"],
      "acceptance_criteria": "..."
    }}
  ]
}}"""

        return call_claude(message, system_prompt_file="planner.md", timeout=120)

    def parse_plan(self, result: AgentResult) -> list[dict] | None:
        """Parse planner output into subtask list. Returns None on failure."""
        text = result.stdout.strip()

        # Try to extract JSON from response (handle markdown fencing)
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
            data = json.loads(text)
            return data.get("subtasks", [])
        except json.JSONDecodeError:
            # Try to find JSON object in the text
            start = text.find("{")
            end = text.rfind("}") + 1
            if start >= 0 and end > start:
                try:
                    data = json.loads(text[start:end])
                    return data.get("subtasks", [])
                except json.JSONDecodeError:
                    return None
            return None
