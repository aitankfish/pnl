#!/usr/bin/env python3
"""PNL Multi-Agent Build System — CLI entry point."""

import sys
import argparse
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.prompt import Prompt, Confirm
from rich.text import Text
from rich.columns import Columns
from rich.rule import Rule
from rich import box

import db
import git_ops
from orchestrator import run_task

console = Console()

BANNER = r"""
[bold cyan]
 ____  _   _ _        _                    _
|  _ \| \ | | |      / \   __ _  ___ _ __ | |_ ___
| |_) |  \| | |     / _ \ / _` |/ _ \ '_ \| __/ __|
|  __/| |\  | |___ / ___ \ (_| |  __/ | | | |_\__ \
|_|   |_| \_|_____/_/   \_\__, |\___|_| |_|\__|___/
                           |___/
[/bold cyan]
[dim]Multi-Agent Build System for PNL (Predict & Launch)[/dim]
"""

HELP_TEXT = """
[bold]Commands:[/bold]
  [cyan]new[/cyan]              Submit a new task for agents to work on
  [cyan]status[/cyan]           Show all tasks and their status
  [cyan]detail <id>[/cyan]      Show subtasks and progress for a task
  [cyan]logs <id>[/cyan]        Show agent run logs for a task
  [cyan]cleanup <id>[/cyan]     Remove worktree for a completed task
  [cyan]help[/cyan]             Show this help
  [cyan]quit[/cyan]             Exit

[bold]Quick run:[/bold]
  [dim]python3 cli.py run "Add vitest tests for API routes"[/dim]
  [dim]python3 cli.py run --base mobile-devices "Fix voice room"[/dim]
"""


def show_status():
    """Show status of all tasks."""
    conn = db.get_db()
    tasks = conn.execute("SELECT * FROM tasks ORDER BY id DESC LIMIT 20").fetchall()
    conn.close()

    if not tasks:
        console.print("[dim]No tasks yet. Type 'new' to submit one.[/dim]\n")
        return

    table = Table(title="Tasks", box=box.ROUNDED, show_lines=True)
    table.add_column("ID", style="cyan", width=4)
    table.add_column("Status", width=12)
    table.add_column("Branch", style="dim", max_width=25)
    table.add_column("Description", max_width=50)
    table.add_column("Created", style="dim", width=12)

    status_icons = {
        "complete": "[green]done[/green]",
        "in_progress": "[yellow]running[/yellow]",
        "failed": "[red]failed[/red]",
        "blocked": "[red]blocked[/red]",
        "rejected": "[dim]rejected[/dim]",
        "pending": "[white]pending[/white]",
        "partial": "[yellow]partial[/yellow]",
    }

    for t in tasks:
        status = status_icons.get(t["status"], t["status"])
        created = t["created_at"][:10] if t["created_at"] else "-"
        table.add_row(
            str(t["id"]),
            status,
            t["branch"] or "-",
            t["description"][:50],
            created,
        )
    console.print(table)
    console.print()


def show_detail(task_id: int):
    """Show details of a specific task."""
    task = db.get_task(task_id)
    if not task:
        console.print(f"[red]Task {task_id} not found[/red]")
        return

    console.print(Panel(
        f"[bold]{task['description']}[/bold]\n\n"
        f"Status: {task['status']}  |  Branch: {task['branch'] or 'none'}  |  "
        f"Approved: {'yes' if task['human_approved'] else 'no'}",
        title=f"Task {task['id']}",
        border_style="cyan",
    ))

    subtasks = db.get_subtasks(task_id)
    if not subtasks:
        console.print("[dim]No subtasks yet.[/dim]")
        return

    table = Table(box=box.SIMPLE_HEAVY)
    table.add_column("#", width=4)
    table.add_column("Status", width=12)
    table.add_column("Att", width=4)
    table.add_column("Description")
    table.add_column("Commit", width=10)

    status_icons = {
        "done": "[green]done[/green]",
        "building": "[yellow]building[/yellow]",
        "verifying": "[yellow]verifying[/yellow]",
        "reviewing": "[yellow]reviewing[/yellow]",
        "blocked": "[red]blocked[/red]",
        "pending": "[dim]pending[/dim]",
    }

    for st in subtasks:
        status = status_icons.get(st["status"], st["status"])
        table.add_row(
            str(st["seq"]),
            status,
            str(st["attempts"]),
            st["description"][:55],
            (st["builder_commit"] or "-")[:8],
        )
    console.print(table)
    console.print()


def show_logs(task_id: int):
    """Show agent run logs for a task."""
    subtasks = db.get_subtasks(task_id)
    if not subtasks:
        console.print(f"[dim]No subtasks for task {task_id}[/dim]")
        return

    for st in subtasks:
        runs = db.get_runs(st["id"])
        if runs:
            console.print(f"\n[bold]Subtask {st['seq']}:[/bold] {st['description'][:50]}")
            for run in runs:
                color = "green" if run["success"] else "red"
                duration = f"{run['duration_ms']}ms" if run['duration_ms'] else "?"
                console.print(f"  [{color}]{run['agent']}[/{color}] ({duration})")
                if run["stderr"] and not run["success"]:
                    console.print(f"    [dim]{run['stderr'][:200]}[/dim]")
    console.print()


def submit_new_task():
    """Interactive task submission."""
    console.print(Rule("New Task"))
    console.print()

    task = Prompt.ask("[bold]What do you want the agents to build?[/bold]")
    if not task.strip():
        console.print("[dim]Cancelled.[/dim]")
        return

    # Ask for base branch
    base = Prompt.ask(
        "[dim]Base branch[/dim]",
        default="main",
    )

    console.print()
    console.print(Panel(
        f"[bold]Task:[/bold] {task}\n[bold]Base:[/bold] {base}",
        title="Confirm",
        border_style="yellow",
    ))

    if not Confirm.ask("Launch agents?"):
        console.print("[dim]Cancelled.[/dim]")
        return

    console.print()
    run_task(task, base_branch=base)


def interactive():
    """Interactive REPL mode."""
    console.print(BANNER)
    show_status()

    while True:
        try:
            raw = Prompt.ask("[bold cyan]pnl-agents[/bold cyan]")
            cmd = raw.strip().lower()
            parts = raw.strip().split(maxsplit=1)

            if not cmd:
                continue
            elif cmd in ("quit", "exit", "q"):
                console.print("[dim]Bye![/dim]")
                break
            elif cmd in ("help", "h", "?"):
                console.print(HELP_TEXT)
            elif cmd in ("new", "n"):
                submit_new_task()
            elif cmd in ("status", "s"):
                show_status()
            elif parts[0] in ("detail", "d") and len(parts) > 1:
                try:
                    show_detail(int(parts[1]))
                except ValueError:
                    console.print("[red]Usage: detail <task_id>[/red]")
            elif parts[0] in ("logs", "l") and len(parts) > 1:
                try:
                    show_logs(int(parts[1]))
                except ValueError:
                    console.print("[red]Usage: logs <task_id>[/red]")
            elif parts[0] in ("cleanup", "c") and len(parts) > 1:
                try:
                    tid = int(parts[1])
                    git_ops.remove_worktree(tid)
                    console.print(f"[green]Cleaned up worktree for task {tid}[/green]")
                except ValueError:
                    console.print("[red]Usage: cleanup <task_id>[/red]")
            else:
                # Treat anything else as a task description
                console.print(f"\n[dim]Treating input as task description...[/dim]")
                base = Prompt.ask("[dim]Base branch[/dim]", default="main")
                if Confirm.ask(f"Launch agents for: \"{raw.strip()}\"?"):
                    run_task(raw.strip(), base_branch=base)

        except KeyboardInterrupt:
            console.print("\n[dim]Ctrl+C — type 'quit' to exit[/dim]")
        except EOFError:
            console.print("\n[dim]Bye![/dim]")
            break


# --- CLI subcommands for non-interactive use ---

def cmd_run(args):
    """Run a task through the agent pipeline."""
    task = args.task or Prompt.ask("Describe the task")
    base = args.base or "main"
    run_task(task, base_branch=base)


def cmd_status(_args):
    show_status()


def cmd_detail(args):
    show_detail(args.task_id)


def cmd_logs(args):
    show_logs(args.task_id)


def cmd_cleanup(args):
    task = db.get_task(args.task_id)
    if not task:
        console.print(f"[red]Task {args.task_id} not found[/red]")
        return
    git_ops.remove_worktree(args.task_id)
    console.print(f"[green]Cleaned up worktree for task {args.task_id}[/green]")


def main():
    parser = argparse.ArgumentParser(
        description="PNL Multi-Agent Build System",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 cli.py                                       Interactive mode
  python3 cli.py run "Add vitest and write API tests"   Direct run
  python3 cli.py run --base mobile-devices "Fix UI"     Run against branch
  python3 cli.py status                                 Show all tasks
  python3 cli.py detail 1                               Show task details
  python3 cli.py logs 1                                 Show agent run logs
  python3 cli.py cleanup 1                              Remove worktree
        """,
    )
    sub = parser.add_subparsers(dest="command")

    # run
    p_run = sub.add_parser("run", help="Run a task through the agent pipeline")
    p_run.add_argument("task", nargs="?", help="Task description")
    p_run.add_argument("--base", help="Base branch (default: main)")
    p_run.set_defaults(func=cmd_run)

    # status
    p_status = sub.add_parser("status", help="Show task status")
    p_status.set_defaults(func=cmd_status)

    # detail
    p_detail = sub.add_parser("detail", help="Show task details")
    p_detail.add_argument("task_id", type=int)
    p_detail.set_defaults(func=cmd_detail)

    # logs
    p_logs = sub.add_parser("logs", help="Show agent run logs")
    p_logs.add_argument("task_id", type=int)
    p_logs.set_defaults(func=cmd_logs)

    # cleanup
    p_cleanup = sub.add_parser("cleanup", help="Remove task worktree")
    p_cleanup.add_argument("task_id", type=int)
    p_cleanup.set_defaults(func=cmd_cleanup)

    args = parser.parse_args()

    if not args.command:
        # No subcommand → launch interactive mode
        interactive()
    else:
        args.func(args)


if __name__ == "__main__":
    main()
