#!/usr/bin/env python3
"""Load GitHub JSON snapshots + live local git state into a SQLite database.

Companion to `sync_github_repo.py`: that script writes JSON files to disk,
this one upserts them into a queryable SQLite DB. Re-running is safe — every
row is upserted by its natural key, so the DB always reflects the latest
on-disk snapshot plus a fresh read of each repo's working tree.

Two sources of truth feed the DB:
    1. On-disk JSON under `{data_root}/{owner}__{repo}/` (PRs, commits,
       branches, comments) — produced by `sync_github_repo.py`.
    2. Live `git` calls in each repo's `local_path` (current branch, HEAD,
       ahead/behind, dirty state, local branches with upstream tracking).
       Skipped if `local_path` is missing or no longer a git repo.

How repos are discovered:
    - No args → walk `--data` and sync every `{owner}__{repo}/` dir found.
      Each repo's `local_path` is read from its `meta.json`.
    - Positional paths → treat each as a local checkout, parse `origin` to
      get owner/repo, look up the corresponding data dir.
    - `--config repos.json` → JSON array of strings or
      `{"local_path": "..."}` objects; merged with positional paths.

Repos with no live `local_path` still get their on-disk JSON loaded; only
the `local_git_state` and `local_branches` tables are skipped for them.

Tables:
    repos, prs, commits, branches,
    pr_comments, commit_comments,
    local_git_state, local_branches

Schema migrations: `ensure_columns` adds new columns to existing tables on
startup, so older DBs upgrade in place without a manual rebuild.

Examples:
    # Default: discover and sync every repo under ./data
    scripts/db_sync.py

    # Sync a specific local checkout, custom DB path
    scripts/db_sync.py ~/code/myrepo --db ~/gh.sqlite

    # Use a config file listing multiple checkouts
    scripts/db_sync.py --config repos.json --data /var/gh-data
"""
from __future__ import annotations

import argparse
import json
import re
import sqlite3
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS repos (
  id INTEGER PRIMARY KEY,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  github_id INTEGER,
  default_branch TEXT,
  description TEXT,
  origin_url TEXT,
  local_path TEXT,
  data_path TEXT,
  last_synced_at TEXT,
  raw_json TEXT,
  UNIQUE(owner, name)
);

CREATE TABLE IF NOT EXISTS prs (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT,
  state TEXT,
  draft INTEGER,
  merged INTEGER,
  author TEXT,
  base_ref TEXT,
  head_ref TEXT,
  head_sha TEXT,
  merge_commit_sha TEXT,
  html_url TEXT,
  body TEXT,
  created_at TEXT,
  updated_at TEXT,
  closed_at TEXT,
  merged_at TEXT,
  raw_json TEXT NOT NULL,
  UNIQUE(repo_id, number)
);

CREATE TABLE IF NOT EXISTS commits (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  sha TEXT NOT NULL,
  author_name TEXT,
  author_email TEXT,
  author_login TEXT,
  committer_name TEXT,
  committer_email TEXT,
  message TEXT,
  authored_at TEXT,
  committed_at TEXT,
  comment_count INTEGER,
  html_url TEXT,
  raw_json TEXT NOT NULL,
  UNIQUE(repo_id, sha)
);

CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sha TEXT,
  protected INTEGER,
  raw_json TEXT NOT NULL,
  UNIQUE(repo_id, name)
);

CREATE TABLE IF NOT EXISTS pr_comments (
  id INTEGER PRIMARY KEY,
  pr_id INTEGER NOT NULL REFERENCES prs(id) ON DELETE CASCADE,
  github_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('issue', 'review')),
  author TEXT,
  body TEXT,
  path TEXT,
  line INTEGER,
  commit_sha TEXT,
  in_reply_to INTEGER,
  created_at TEXT,
  updated_at TEXT,
  html_url TEXT,
  raw_json TEXT NOT NULL,
  UNIQUE(github_id, kind)
);

CREATE TABLE IF NOT EXISTS commit_comments (
  id INTEGER PRIMARY KEY,
  commit_id INTEGER NOT NULL REFERENCES commits(id) ON DELETE CASCADE,
  github_id INTEGER NOT NULL,
  author TEXT,
  body TEXT,
  path TEXT,
  line INTEGER,
  created_at TEXT,
  updated_at TEXT,
  html_url TEXT,
  raw_json TEXT NOT NULL,
  UNIQUE(github_id)
);

CREATE TABLE IF NOT EXISTS local_git_state (
  repo_id INTEGER PRIMARY KEY REFERENCES repos(id) ON DELETE CASCADE,
  current_branch TEXT,
  head_sha TEXT,
  upstream TEXT,
  ahead INTEGER,
  behind INTEGER,
  is_dirty INTEGER,
  dirty_count INTEGER,
  porcelain TEXT,
  checked_at TEXT
);

CREATE TABLE IF NOT EXISTS local_branches (
  id INTEGER PRIMARY KEY,
  repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sha TEXT,
  upstream TEXT,
  last_committer_date TEXT,
  last_subject TEXT,
  is_current INTEGER,
  UNIQUE(repo_id, name)
);

CREATE INDEX IF NOT EXISTS idx_prs_head_sha ON prs(head_sha);
CREATE INDEX IF NOT EXISTS idx_prs_state ON prs(repo_id, state);
CREATE INDEX IF NOT EXISTS idx_prs_head_ref ON prs(repo_id, head_ref);
CREATE INDEX IF NOT EXISTS idx_commits_sha ON commits(sha);
CREATE INDEX IF NOT EXISTS idx_pr_comments_pr ON pr_comments(pr_id);
CREATE INDEX IF NOT EXISTS idx_commit_comments_commit ON commit_comments(commit_id);
CREATE INDEX IF NOT EXISTS idx_branches_sha ON branches(sha);
CREATE INDEX IF NOT EXISTS idx_local_branches_repo ON local_branches(repo_id);
"""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def run(cmd: list[str], *, cwd: Path | None = None, check: bool = True) -> str:
    res = subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        capture_output=True,
        text=True,
        check=False,
    )
    if check and res.returncode != 0:
        raise RuntimeError(
            f"command failed: {' '.join(cmd)}\nstderr: {res.stderr.strip()}"
        )
    return res.stdout


def resolve_owner_repo(local_path: Path) -> tuple[str, str]:
    url = run(["git", "-C", str(local_path), "remote", "get-url", "origin"]).strip()
    m = re.search(r"[:/]([^/:]+)/([^/]+?)(?:\.git)?/?$", url)
    if not m:
        raise SystemExit(f"could not parse owner/repo from remote url: {url}")
    return m.group(1), m.group(2)


def load_json(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"  skip {path}: {e}", file=sys.stderr)
        return None


def safe_int(v: Any) -> int | None:
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def actor_login(node: Any) -> str | None:
    if isinstance(node, dict):
        return node.get("login")
    return None


# ---------------------------------------------------------------------------
# DB ops
# ---------------------------------------------------------------------------

def ensure_columns(
    conn: sqlite3.Connection, table: str, columns: list[tuple[str, str]]
) -> None:
    """Add missing columns to an existing table (idempotent migration)."""
    existing = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
    for col_name, ddl in columns:
        if col_name not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def init_db(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    # Migrate older DBs that lack the newer repos columns.
    ensure_columns(
        conn,
        "repos",
        [
            ("github_id", "github_id INTEGER"),
            ("default_branch", "default_branch TEXT"),
            ("description", "description TEXT"),
            ("origin_url", "origin_url TEXT"),
            ("raw_json", "raw_json TEXT"),
        ],
    )
    conn.commit()
    return conn


def upsert_repo(
    conn: sqlite3.Connection,
    owner: str,
    name: str,
    *,
    local_path: Path | None,
    data_path: Path,
    repo_meta: dict[str, Any] | None,
) -> int:
    github_id = safe_int((repo_meta or {}).get("id"))
    default_branch = (repo_meta or {}).get("default_branch")
    description = (repo_meta or {}).get("description")
    origin_url = (repo_meta or {}).get("origin_url") or (repo_meta or {}).get(
        "clone_url"
    )
    raw = json.dumps(repo_meta) if repo_meta else None
    conn.execute(
        """
        INSERT INTO repos (
            owner, name, github_id, default_branch, description, origin_url,
            local_path, data_path, last_synced_at, raw_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner, name) DO UPDATE SET
            github_id = COALESCE(excluded.github_id, repos.github_id),
            default_branch = COALESCE(excluded.default_branch, repos.default_branch),
            description = COALESCE(excluded.description, repos.description),
            origin_url = COALESCE(excluded.origin_url, repos.origin_url),
            local_path = COALESCE(excluded.local_path, repos.local_path),
            data_path = excluded.data_path,
            last_synced_at = excluded.last_synced_at,
            raw_json = COALESCE(excluded.raw_json, repos.raw_json)
        """,
        (
            owner,
            name,
            github_id,
            default_branch,
            description,
            origin_url,
            str(local_path) if local_path else None,
            str(data_path),
            now_utc(),
            raw,
        ),
    )
    row = conn.execute(
        "SELECT id FROM repos WHERE owner = ? AND name = ?", (owner, name)
    ).fetchone()
    return int(row["id"])


# ---------------------------------------------------------------------------
# Sync from disk JSON (synced via sync_github_repo.py)
# ---------------------------------------------------------------------------

def iter_item_dirs(parent: Path) -> Iterable[Path]:
    if not parent.exists():
        return []
    return (p for p in sorted(parent.iterdir()) if p.is_dir())


def sync_prs_from_disk(
    conn: sqlite3.Connection, repo_id: int, repo_data: Path
) -> tuple[int, int, int]:
    pr_root = repo_data / "pr"
    pr_count = ic_count = rc_count = 0
    for pr_dir in iter_item_dirs(pr_root):
        meta = load_json(pr_dir / "meta.json")
        if not meta:
            continue
        pr_id = upsert_pr(conn, repo_id, meta)
        pr_count += 1
        ic_count += sync_pr_comments(conn, pr_id, pr_dir / "comments", "issue")
        rc_count += sync_pr_comments(
            conn, pr_id, pr_dir / "review_comments", "review"
        )
    return pr_count, ic_count, rc_count


def upsert_pr(conn: sqlite3.Connection, repo_id: int, m: dict[str, Any]) -> int:
    head = m.get("head") or {}
    base = m.get("base") or {}
    conn.execute(
        """
        INSERT INTO prs (
            repo_id, number, title, state, draft, merged, author,
            base_ref, head_ref, head_sha, merge_commit_sha,
            html_url, body, created_at, updated_at, closed_at, merged_at, raw_json
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(repo_id, number) DO UPDATE SET
            title = excluded.title,
            state = excluded.state,
            draft = excluded.draft,
            merged = excluded.merged,
            author = excluded.author,
            base_ref = excluded.base_ref,
            head_ref = excluded.head_ref,
            head_sha = excluded.head_sha,
            merge_commit_sha = excluded.merge_commit_sha,
            html_url = excluded.html_url,
            body = excluded.body,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at,
            closed_at = excluded.closed_at,
            merged_at = excluded.merged_at,
            raw_json = excluded.raw_json
        """,
        (
            repo_id,
            int(m["number"]),
            m.get("title"),
            m.get("state"),
            int(bool(m.get("draft"))),
            int(bool(m.get("merged"))),
            actor_login(m.get("user")),
            base.get("ref"),
            head.get("ref"),
            head.get("sha"),
            m.get("merge_commit_sha"),
            m.get("html_url"),
            m.get("body"),
            m.get("created_at"),
            m.get("updated_at"),
            m.get("closed_at"),
            m.get("merged_at"),
            json.dumps(m),
        ),
    )
    row = conn.execute(
        "SELECT id FROM prs WHERE repo_id = ? AND number = ?",
        (repo_id, int(m["number"])),
    ).fetchone()
    return int(row["id"])


def sync_pr_comments(
    conn: sqlite3.Connection, pr_id: int, comments_dir: Path, kind: str
) -> int:
    if not comments_dir.exists():
        return 0
    n = 0
    for f in sorted(comments_dir.glob("*.json")):
        c = load_json(f)
        if not c or c.get("id") is None:
            continue
        conn.execute(
            """
            INSERT INTO pr_comments (
                pr_id, github_id, kind, author, body, path, line,
                commit_sha, in_reply_to, created_at, updated_at, html_url, raw_json
            )
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(github_id, kind) DO UPDATE SET
                pr_id = excluded.pr_id,
                author = excluded.author,
                body = excluded.body,
                path = excluded.path,
                line = excluded.line,
                commit_sha = excluded.commit_sha,
                in_reply_to = excluded.in_reply_to,
                created_at = excluded.created_at,
                updated_at = excluded.updated_at,
                html_url = excluded.html_url,
                raw_json = excluded.raw_json
            """,
            (
                pr_id,
                int(c["id"]),
                kind,
                actor_login(c.get("user")),
                c.get("body"),
                c.get("path"),
                safe_int(c.get("line") or c.get("original_line")),
                c.get("commit_id") or c.get("original_commit_id"),
                safe_int(c.get("in_reply_to_id")),
                c.get("created_at"),
                c.get("updated_at"),
                c.get("html_url"),
                json.dumps(c),
            ),
        )
        n += 1
    return n


def sync_commits_from_disk(
    conn: sqlite3.Connection, repo_id: int, repo_data: Path
) -> tuple[int, int]:
    commit_root = repo_data / "commit"
    c_count = cc_count = 0
    for commit_dir in iter_item_dirs(commit_root):
        meta = load_json(commit_dir / "meta.json")
        if not meta or not meta.get("sha"):
            continue
        commit_id = upsert_commit(conn, repo_id, meta)
        c_count += 1
        cc_count += sync_commit_comments(conn, commit_id, commit_dir / "comments")
    return c_count, cc_count


def upsert_commit(conn: sqlite3.Connection, repo_id: int, m: dict[str, Any]) -> int:
    commit_obj = m.get("commit") or {}
    a = commit_obj.get("author") or {}
    c = commit_obj.get("committer") or {}
    conn.execute(
        """
        INSERT INTO commits (
            repo_id, sha, author_name, author_email, author_login,
            committer_name, committer_email, message,
            authored_at, committed_at, comment_count, html_url, raw_json
        )
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(repo_id, sha) DO UPDATE SET
            author_name = excluded.author_name,
            author_email = excluded.author_email,
            author_login = excluded.author_login,
            committer_name = excluded.committer_name,
            committer_email = excluded.committer_email,
            message = excluded.message,
            authored_at = excluded.authored_at,
            committed_at = excluded.committed_at,
            comment_count = excluded.comment_count,
            html_url = excluded.html_url,
            raw_json = excluded.raw_json
        """,
        (
            repo_id,
            m["sha"],
            a.get("name"),
            a.get("email"),
            actor_login(m.get("author")),
            c.get("name"),
            c.get("email"),
            commit_obj.get("message"),
            a.get("date"),
            c.get("date"),
            safe_int(commit_obj.get("comment_count")),
            m.get("html_url"),
            json.dumps(m),
        ),
    )
    row = conn.execute(
        "SELECT id FROM commits WHERE repo_id = ? AND sha = ?", (repo_id, m["sha"])
    ).fetchone()
    return int(row["id"])


def sync_commit_comments(
    conn: sqlite3.Connection, commit_id: int, comments_dir: Path
) -> int:
    if not comments_dir.exists():
        return 0
    n = 0
    for f in sorted(comments_dir.glob("*.json")):
        c = load_json(f)
        if not c or c.get("id") is None:
            continue
        conn.execute(
            """
            INSERT INTO commit_comments (
                commit_id, github_id, author, body, path, line,
                created_at, updated_at, html_url, raw_json
            )
            VALUES (?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(github_id) DO UPDATE SET
                commit_id = excluded.commit_id,
                author = excluded.author,
                body = excluded.body,
                path = excluded.path,
                line = excluded.line,
                created_at = excluded.created_at,
                updated_at = excluded.updated_at,
                html_url = excluded.html_url,
                raw_json = excluded.raw_json
            """,
            (
                commit_id,
                int(c["id"]),
                actor_login(c.get("user")),
                c.get("body"),
                c.get("path"),
                safe_int(c.get("line") or c.get("position")),
                c.get("created_at"),
                c.get("updated_at"),
                c.get("html_url"),
                json.dumps(c),
            ),
        )
        n += 1
    return n


def sync_branches_from_disk(
    conn: sqlite3.Connection, repo_id: int, repo_data: Path
) -> int:
    branch_root = repo_data / "branch"
    n = 0
    for branch_dir in iter_item_dirs(branch_root):
        meta = load_json(branch_dir / "meta.json")
        if not meta or not meta.get("name"):
            continue
        commit = meta.get("commit") or {}
        conn.execute(
            """
            INSERT INTO branches (repo_id, name, sha, protected, raw_json)
            VALUES (?,?,?,?,?)
            ON CONFLICT(repo_id, name) DO UPDATE SET
                sha = excluded.sha,
                protected = excluded.protected,
                raw_json = excluded.raw_json
            """,
            (
                repo_id,
                meta["name"],
                commit.get("sha"),
                int(bool(meta.get("protected"))),
                json.dumps(meta),
            ),
        )
        n += 1
    return n


# ---------------------------------------------------------------------------
# Sync from live local git
# ---------------------------------------------------------------------------

def sync_local_git_state(
    conn: sqlite3.Connection, repo_id: int, local_path: Path
) -> None:
    porcelain = run(
        ["git", "-C", str(local_path), "status", "--porcelain=v2", "--branch"]
    )
    head_sha = current_branch = upstream = None
    ahead = behind = None
    dirty_count = 0
    for line in porcelain.splitlines():
        if line.startswith("# branch.oid "):
            head_sha = line.split(" ", 2)[2].strip() or None
            if head_sha == "(initial)":
                head_sha = None
        elif line.startswith("# branch.head "):
            current_branch = line.split(" ", 2)[2].strip() or None
            if current_branch == "(detached)":
                current_branch = None
        elif line.startswith("# branch.upstream "):
            upstream = line.split(" ", 2)[2].strip() or None
        elif line.startswith("# branch.ab "):
            parts = line.split()
            # # branch.ab +N -M
            for p in parts[2:]:
                if p.startswith("+"):
                    ahead = int(p[1:])
                elif p.startswith("-"):
                    behind = int(p[1:])
        elif line and not line.startswith("#"):
            dirty_count += 1

    conn.execute(
        """
        INSERT INTO local_git_state (
            repo_id, current_branch, head_sha, upstream,
            ahead, behind, is_dirty, dirty_count, porcelain, checked_at
        )
        VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(repo_id) DO UPDATE SET
            current_branch = excluded.current_branch,
            head_sha = excluded.head_sha,
            upstream = excluded.upstream,
            ahead = excluded.ahead,
            behind = excluded.behind,
            is_dirty = excluded.is_dirty,
            dirty_count = excluded.dirty_count,
            porcelain = excluded.porcelain,
            checked_at = excluded.checked_at
        """,
        (
            repo_id,
            current_branch,
            head_sha,
            upstream,
            ahead,
            behind,
            int(dirty_count > 0),
            dirty_count,
            porcelain,
            now_utc(),
        ),
    )


def sync_local_branches(
    conn: sqlite3.Connection, repo_id: int, local_path: Path
) -> int:
    SEP = "\x1f"
    fmt = SEP.join(
        [
            "%(refname:short)",
            "%(objectname)",
            "%(upstream:short)",
            "%(committerdate:iso-strict)",
            "%(subject)",
        ]
    )
    out = run(
        ["git", "-C", str(local_path), "for-each-ref", f"--format={fmt}", "refs/heads/"]
    )
    current = run(
        ["git", "-C", str(local_path), "symbolic-ref", "--quiet", "--short", "HEAD"],
        check=False,
    ).strip() or None

    seen: set[str] = set()
    n = 0
    for line in out.splitlines():
        if not line:
            continue
        parts = line.split(SEP)
        if len(parts) < 5:
            continue
        name, sha, upstream, cdate, subject = parts[:5]
        seen.add(name)
        conn.execute(
            """
            INSERT INTO local_branches (
                repo_id, name, sha, upstream, last_committer_date, last_subject, is_current
            )
            VALUES (?,?,?,?,?,?,?)
            ON CONFLICT(repo_id, name) DO UPDATE SET
                sha = excluded.sha,
                upstream = excluded.upstream,
                last_committer_date = excluded.last_committer_date,
                last_subject = excluded.last_subject,
                is_current = excluded.is_current
            """,
            (
                repo_id,
                name,
                sha or None,
                upstream or None,
                cdate or None,
                subject or None,
                int(name == current),
            ),
        )
        n += 1

    # Prune branches that no longer exist locally
    rows = conn.execute(
        "SELECT name FROM local_branches WHERE repo_id = ?", (repo_id,)
    ).fetchall()
    stale = [r["name"] for r in rows if r["name"] not in seen]
    if stale:
        conn.executemany(
            "DELETE FROM local_branches WHERE repo_id = ? AND name = ?",
            [(repo_id, s) for s in stale],
        )
    return n


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

def is_git_repo(path: Path) -> bool:
    return (path / ".git").exists() or (path / "HEAD").exists()


def derive_owner_name(repo_data: Path, meta: dict[str, Any] | None) -> tuple[str, str]:
    """Prefer meta.full_name; fall back to dir name `{owner}__{name}`."""
    full = (meta or {}).get("full_name")
    if isinstance(full, str) and "/" in full:
        owner, name = full.split("/", 1)
        return owner, name
    parts = repo_data.name.split("__", 1)
    if len(parts) == 2:
        return parts[0], parts[1]
    raise SystemExit(
        f"cannot derive owner/name from {repo_data} "
        "(expected dir name like 'owner__repo' or meta.json with full_name)"
    )


def read_repo_meta(repo_data: Path) -> dict[str, Any] | None:
    meta_path = repo_data / "meta.json"
    if not meta_path.exists():
        return None
    try:
        data = json.loads(meta_path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError as e:
        print(f"  skip {meta_path}: {e}", file=sys.stderr)
        return None


def discover_from_data(data_root: Path) -> list[tuple[Path, dict[str, Any] | None]]:
    """Find {data_root}/{owner}__{repo} dirs. Returns (repo_data_dir, meta)."""
    out: list[tuple[Path, dict[str, Any] | None]] = []
    if not data_root.exists():
        return out
    for entry in sorted(data_root.iterdir()):
        if not entry.is_dir():
            continue
        if "__" not in entry.name:
            continue
        out.append((entry, read_repo_meta(entry)))
    return out


def sync_one_repo(
    conn: sqlite3.Connection,
    repo_data: Path,
    *,
    repo_meta: dict[str, Any] | None,
    local_path_override: Path | None = None,
) -> dict[str, Any]:
    owner, name = derive_owner_name(repo_data, repo_meta)

    local_path: Path | None = local_path_override
    if local_path is None:
        meta_local = (repo_meta or {}).get("local_path")
        if isinstance(meta_local, str) and meta_local:
            local_path = Path(meta_local).expanduser()

    repo_id = upsert_repo(
        conn,
        owner,
        name,
        local_path=local_path,
        data_path=repo_data,
        repo_meta=repo_meta,
    )

    summary: dict[str, Any] = {"repo": f"{owner}/{name}", "repo_id": repo_id}

    if repo_data.exists():
        prs, ic, rc = sync_prs_from_disk(conn, repo_id, repo_data)
        summary.update(prs=prs, pr_issue_comments=ic, pr_review_comments=rc)

        commits, cc = sync_commits_from_disk(conn, repo_id, repo_data)
        summary.update(commits=commits, commit_comments=cc)

        summary["branches_remote"] = sync_branches_from_disk(conn, repo_id, repo_data)
    else:
        print(f"  warning: data dir missing: {repo_data}", file=sys.stderr)

    if local_path and is_git_repo(local_path):
        sync_local_git_state(conn, repo_id, local_path)
        summary["branches_local"] = sync_local_branches(conn, repo_id, local_path)
        summary["local_path"] = str(local_path)
    else:
        if local_path:
            print(
                f"  skip live git: {local_path} not a git repo",
                file=sys.stderr,
            )
        else:
            print(
                "  skip live git: no local_path (run sync_github_repo.py "
                "from the local repo to record one)",
                file=sys.stderr,
            )

    return summary


def load_config(path: Path) -> list[Path]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise SystemExit(f"config {path} must be a JSON array")
    out: list[Path] = []
    for entry in raw:
        if isinstance(entry, str):
            out.append(Path(entry).expanduser())
        elif isinstance(entry, dict) and "local_path" in entry:
            out.append(Path(entry["local_path"]).expanduser())
        else:
            raise SystemExit(f"invalid config entry: {entry!r}")
    return out


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "repo_paths",
        nargs="*",
        type=Path,
        help=(
            "optional local git repo paths to sync. "
            "If omitted, all repos under --data are discovered."
        ),
    )
    p.add_argument(
        "--config",
        type=Path,
        help="JSON file: array of strings or {local_path: ...} objects",
    )
    p.add_argument(
        "--data",
        type=Path,
        default=Path("./data"),
        help="root of on-disk synced data (default: ./data)",
    )
    p.add_argument(
        "--db",
        type=Path,
        default=Path("./data/gh.sqlite"),
        help="sqlite database path (default: ./data/gh.sqlite)",
    )
    args = p.parse_args()

    data_root: Path = args.data.resolve()
    db_path: Path = args.db.resolve()

    explicit_paths: list[Path] = [pth.resolve() for pth in args.repo_paths]
    if args.config:
        explicit_paths.extend(p.resolve() for p in load_config(args.config))

    print(f"db: {db_path}")
    print(f"data root: {data_root}")
    conn = init_db(db_path)
    try:
        targets: list[tuple[Path, dict[str, Any] | None, Path | None]] = []

        if explicit_paths:
            # User-specified local repos: derive owner/name from origin remote
            # and look up the corresponding data dir.
            for local in explicit_paths:
                if not is_git_repo(local):
                    raise SystemExit(f"not a git repo: {local}")
                owner, name = resolve_owner_repo(local)
                repo_data = data_root / f"{owner}__{name}"
                meta = read_repo_meta(repo_data) if repo_data.exists() else None
                targets.append((repo_data, meta, local))
        else:
            # Default: discover all repos under data root
            discovered = discover_from_data(data_root)
            if not discovered:
                raise SystemExit(
                    f"no repos found under {data_root} "
                    "(run sync_github_repo.py first, or pass repo paths positionally)"
                )
            for repo_data, meta in discovered:
                targets.append((repo_data, meta, None))

        for repo_data, meta, local_override in targets:
            print(f"\n=== {repo_data.name} ===")
            summary = sync_one_repo(
                conn,
                repo_data,
                repo_meta=meta,
                local_path_override=local_override,
            )
            conn.commit()
            for k, v in summary.items():
                print(f"  {k}: {v}")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
