"""PNL Multi-Agent Build System — Main orchestrator."""

import sys
import json
import fnmatch
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.prompt import Confirm
from rich import print as rprint

from agents import PlannerAgent, BuilderAgent, VerifierAgent, ReviewerAgent
from config import MAX_ATTEMPTS, HUMAN_GATE_PATTERNS, REPO_ROOT
import db
import git_ops

console = Console()


def requires_human_gate(changed_files: list[str]) -> bool:
    """Check if any changed files match human approval gate patterns."""
    for f in changed_files:
        for pattern in HUMAN_GATE_PATTERNS:
            if fnmatch.fnmatch(f, pattern):
                return True
    return False


def display_plan(subtasks: list[dict]):
    """Display the decomposed plan in a table."""
    table = Table(title="Task Plan", show_lines=True)
    table.add_column("#", style="cyan", width=4)
    table.add_column("Description", style="white")
    table.add_column("Files", style="dim")
    table.add_column("Criteria", style="green")

    for st in subtasks:
        files = "\n".join(st.get("files", []))
        table.add_row(
            str(st["seq"]),
            st["description"],
            files,
            st.get("acceptance_criteria", ""),
        )
    console.print(table)


def display_verdict(verdict: dict):
    """Display review verdict."""
    color = "green" if verdict.get("approved") else "red"
    severity = verdict.get("severity", "unknown")
    console.print(f"\n[{color}]Review: {'APPROVED' if verdict.get('approved') else 'REJECTED'}[/{color}] (severity: {severity})")

    if verdict.get("issues"):
        for issue in verdict["issues"]:
            console.print(f"  [red]- {issue}[/red]")
    if verdict.get("suggestions"):
        for sug in verdict["suggestions"]:
            console.print(f"  [yellow]~ {sug}[/yellow]")


def run_subtask(subtask: dict, subtask_id: int, worktree_path: str) -> bool:
    """Run the builder → verifier → reviewer loop for one subtask. Returns True on success."""
    error_context = None
    review_feedback = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        db.update_subtask(subtask_id, status="building", attempts=attempt)
        console.print(f"\n[cyan]Attempt {attempt}/{MAX_ATTEMPTS}[/cyan]")

        # 1. Builder
        console.print("[bold]Builder[/bold] writing code...")
        builder = BuilderAgent()
        build_result = builder.run(
            subtask, worktree_path,
            error_context=error_context,
            review_feedback=review_feedback,
            attempt=attempt,
        )
        db.log_run(subtask_id, "builder", build_result.stdout, build_result.stderr,
                    build_result.duration_ms, build_result.success)

        if not build_result.success:
            console.print(f"[red]Builder failed:[/red] {build_result.stderr[:500]}")
            error_context = build_result.stderr
            review_feedback = None
            continue

        # Commit builder changes
        commit = git_ops.commit_changes(
            worktree_path,
            f"agent: {subtask['description'][:60]} (attempt {attempt})"
        )
        if commit:
            db.update_subtask(subtask_id, builder_commit=commit)
            console.print(f"[dim]Committed: {commit[:8]}[/dim]")

        # 2. Verifier
        console.print("[bold]Verifier[/bold] checking build...")
        db.update_subtask(subtask_id, status="verifying")
        verifier = VerifierAgent()
        verify_result = verifier.run(worktree_path)
        db.log_run(subtask_id, "verifier", verify_result.stdout, verify_result.stderr,
                    verify_result.duration_ms, verify_result.success)

        if not verify_result.success:
            console.print(f"[red]Verification failed[/red]")
            error_context = verify_result.stdout[-3000:]
            review_feedback = None
            continue

        console.print("[green]Verification passed[/green]")

        # 3. Check human gates
        changed = git_ops.get_changed_files(worktree_path)
        if requires_human_gate(changed):
            console.print(f"[yellow]Human gate triggered[/yellow] — files: {changed}")
            if not Confirm.ask("Approve these changes?"):
                console.print("[red]Human rejected changes[/red]")
                return False

        # 4. Reviewer
        console.print("[bold]Reviewer[/bold] checking diff...")
        db.update_subtask(subtask_id, status="reviewing")
        diff = git_ops.get_diff(worktree_path)
        reviewer = ReviewerAgent()
        review_result = reviewer.run(diff, subtask["description"])
        db.log_run(subtask_id, "reviewer", review_result.stdout, review_result.stderr,
                    review_result.duration_ms, review_result.success)

        verdict = reviewer.parse_verdict(review_result)
        display_verdict(verdict)
        db.update_subtask(subtask_id, review_verdict=json.dumps(verdict))

        if verdict.get("approved"):
            db.update_subtask(subtask_id, status="done")
            console.print("[green bold]Subtask complete![/green bold]")
            return True

        # Rejected — retry with feedback
        error_context = None
        review_feedback = "\n".join(verdict.get("issues", []))

    # Max attempts exhausted
    db.update_subtask(subtask_id, status="blocked")
    console.print(f"[red bold]Subtask blocked after {MAX_ATTEMPTS} attempts[/red bold]")
    return False


def run_task(description: str, base_branch: str = "main"):
    """Main orchestration: plan → approve → build each subtask → final review."""
    console.print(Panel(f"[bold]Task:[/bold] {description}", title="PNL Agent System"))

    # Create task record
    task_id = db.create_task(description)
    console.print(f"[dim]Task ID: {task_id}[/dim]")

    # 1. Plan
    console.print("\n[bold blue]Phase 1: Planning[/bold blue]")
    planner = PlannerAgent()
    plan_result = planner.run(description)

    if not plan_result.success:
        console.print(f"[red]Planner failed:[/red] {plan_result.stderr}")
        db.update_task(task_id, status="failed")
        return

    subtasks = planner.parse_plan(plan_result)
    if not subtasks:
        console.print("[red]Could not parse planner output:[/red]")
        console.print(plan_result.stdout[:2000])
        db.update_task(task_id, status="failed")
        return

    db.update_task(task_id, plan_json=json.dumps(subtasks))

    # 2. Human approves plan
    display_plan(subtasks)
    if not Confirm.ask("\nApprove this plan?"):
        console.print("[yellow]Plan rejected by human[/yellow]")
        db.update_task(task_id, status="rejected")
        return

    db.update_task(task_id, human_approved=1, status="in_progress")

    # 3. Create worktree
    console.print("\n[bold blue]Setting up worktree...[/bold blue]")
    worktree_path, branch = git_ops.create_worktree(task_id, base_branch)
    db.update_task(task_id, branch=branch)
    console.print(f"[dim]Branch: {branch} | Worktree: {worktree_path}[/dim]")

    # Install deps in worktree
    console.print("[dim]Installing dependencies...[/dim]")
    install_result = git_ops.install_deps(worktree_path)
    if install_result.returncode != 0:
        console.print(f"[yellow]Warning: pnpm install had issues, continuing...[/yellow]")
        console.print(f"[dim]{install_result.stderr[:500]}[/dim]")

    # 4. Create subtask records
    subtask_ids = []
    for st in subtasks:
        sid = db.create_subtask(
            task_id, st["seq"], st["description"],
            st.get("files"), st.get("acceptance_criteria"),
        )
        subtask_ids.append(sid)

    # 5. Execute each subtask
    console.print(f"\n[bold blue]Phase 2: Building ({len(subtasks)} subtasks)[/bold blue]")
    all_success = True
    for i, (st, sid) in enumerate(zip(subtasks, subtask_ids)):
        console.print(Panel(
            f"[bold]Subtask {st['seq']}:[/bold] {st['description']}",
            title=f"[{i+1}/{len(subtasks)}]",
        ))
        success = run_subtask(st, sid, worktree_path)
        if not success:
            all_success = False
            if not Confirm.ask("Subtask failed. Continue with remaining subtasks?"):
                break

    # 6. Final verification
    if all_success:
        console.print("\n[bold blue]Phase 3: Final Verification[/bold blue]")
        verifier = VerifierAgent()
        final = verifier.run(worktree_path)
        if final.success:
            console.print("[green bold]All checks passed![/green bold]")
        else:
            console.print("[red]Final verification failed[/red]")
            console.print(final.stdout[-2000:])

    # 7. Summary
    status = "complete" if all_success else "partial"
    db.update_task(task_id, status=status)

    console.print(Panel(
        f"[bold]Branch:[/bold] {branch}\n"
        f"[bold]Status:[/bold] {status}\n"
        f"[bold]Worktree:[/bold] {worktree_path}\n\n"
        f"To review: [cyan]cd {worktree_path} && git log --oneline {base_branch}..HEAD[/cyan]\n"
        f"To merge:  [cyan]git merge {branch}[/cyan]\n"
        f"To clean:  [cyan]python orchestrator.py --cleanup {task_id}[/cyan]",
        title="Done",
    ))
