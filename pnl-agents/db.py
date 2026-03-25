"""SQLite state tracking for agent tasks and runs."""

import sqlite3
import json
from datetime import datetime, timezone
from pathlib import Path
from config import DB_PATH


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            branch TEXT,
            human_approved INTEGER DEFAULT 0,
            plan_json TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS subtasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER NOT NULL REFERENCES tasks(id),
            seq INTEGER NOT NULL,
            description TEXT NOT NULL,
            files TEXT,
            acceptance_criteria TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            builder_commit TEXT,
            review_verdict TEXT,
            attempts INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subtask_id INTEGER NOT NULL REFERENCES subtasks(id),
            agent TEXT NOT NULL,
            stdout TEXT,
            stderr TEXT,
            duration_ms INTEGER,
            success INTEGER NOT NULL,
            created_at TEXT NOT NULL
        );
    """)
    conn.commit()
    conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_task(description: str) -> int:
    conn = get_db()
    now = _now()
    cur = conn.execute(
        "INSERT INTO tasks (description, created_at, updated_at) VALUES (?, ?, ?)",
        (description, now, now),
    )
    task_id = cur.lastrowid
    conn.commit()
    conn.close()
    return task_id


def update_task(task_id: int, **kwargs):
    conn = get_db()
    kwargs["updated_at"] = _now()
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [task_id]
    conn.execute(f"UPDATE tasks SET {sets} WHERE id = ?", vals)
    conn.commit()
    conn.close()


def get_task(task_id: int) -> dict:
    conn = get_db()
    row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def create_subtask(task_id: int, seq: int, description: str,
                   files: list[str] = None, acceptance_criteria: str = None) -> int:
    conn = get_db()
    now = _now()
    cur = conn.execute(
        "INSERT INTO subtasks (task_id, seq, description, files, acceptance_criteria, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (task_id, seq, description, json.dumps(files or []), acceptance_criteria, now, now),
    )
    subtask_id = cur.lastrowid
    conn.commit()
    conn.close()
    return subtask_id


def update_subtask(subtask_id: int, **kwargs):
    conn = get_db()
    kwargs["updated_at"] = _now()
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [subtask_id]
    conn.execute(f"UPDATE subtasks SET {sets} WHERE id = ?", vals)
    conn.commit()
    conn.close()


def get_subtasks(task_id: int) -> list[dict]:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM subtasks WHERE task_id = ? ORDER BY seq", (task_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def log_run(subtask_id: int, agent: str, stdout: str, stderr: str,
            duration_ms: int, success: bool) -> int:
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO runs (subtask_id, agent, stdout, stderr, duration_ms, success, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (subtask_id, agent, stdout, stderr, duration_ms, int(success), _now()),
    )
    run_id = cur.lastrowid
    conn.commit()
    conn.close()
    return run_id


def get_runs(subtask_id: int) -> list[dict]:
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM runs WHERE subtask_id = ? ORDER BY created_at", (subtask_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# Initialize on import
init_db()
