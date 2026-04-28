#!/usr/bin/env python3
"""Mirror a GitHub repo's PRs, commits, branches, and comments to disk as JSON.

Given a path to a local git checkout, this script reads `origin` to determine
`{owner}/{repo}`, then fetches metadata via the GitHub REST API and writes one
JSON file per entity into a structured directory tree. Re-running overwrites
files in place, so the output dir is always a snapshot of the latest state.

Authentication uses the `gh` CLI (must be installed and `gh auth login`'d).
The current `gh` user is used as the default author filter — pass
`--all-authors` to disable, or `--author USER` to override.

On-disk layout:
    {output}/{owner}__{repo}/
        meta.json                               # repo-level metadata + local_path
        pr/{number}/
            meta.json
            comments/{comment_id}.json          # issue (conversation) comments
            review_comments/{comment_id}.json   # inline diff review comments
        commit/{sha}/
            meta.json
            comments/{comment_id}.json
        branch/{safe_branch_name}/
            meta.json

Notable defaults / behaviors:
    - PR comments are fetched via the bulk repo-wide endpoints (one paginated
      call each for issue and review comments), then bucketed per PR — much
      faster than per-PR calls when there are many PRs.
    - Commits are paged 100 at a time up to `--commit-pages` (default 10 →
      ~1000 commits). Increase for repos with deeper history you care about.
    - `meta.json` at the repo root preserves any prior `local_path` so a
      run from a different machine doesn't clobber the original checkout path.

Examples:
    # Sync everything for the repo at ~/code/myrepo into ./data
    scripts/sync_github_repo.py ~/code/myrepo

    # Only PRs and branches, custom output dir, no comments
    scripts/sync_github_repo.py ~/code/myrepo -o /tmp/gh \\
        --kinds pr branch --no-comments

    # All authors' PRs, but only the current user's commits
    scripts/sync_github_repo.py ~/code/myrepo --no-author-prs

    # Pull a specific contributor's history, deeper commit window
    scripts/sync_github_repo.py ~/code/myrepo --author octocat --commit-pages 50
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Iterable


KIND_PR = "pr"
KIND_COMMIT = "commit"
KIND_BRANCH = "branch"
ALL_KINDS = (KIND_PR, KIND_COMMIT, KIND_BRANCH)


def run(cmd: list[str], *, cwd: Path | None = None) -> str:
    result = subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout


def resolve_owner_repo(repo_path: Path) -> tuple[str, str, str]:
    url = run(["git", "-C", str(repo_path), "remote", "get-url", "origin"]).strip()
    m = re.search(r"[:/]([^/:]+)/([^/]+?)(?:\.git)?/?$", url)
    if not m:
        raise SystemExit(f"could not parse owner/repo from remote url: {url}")
    return m.group(1), m.group(2), url


def gh_api_paginated(endpoint: str) -> list[dict[str, Any]]:
    """Call `gh api --paginate` for a list endpoint and concatenate results."""
    raw = run(["gh", "api", "--paginate", endpoint])
    items: list[dict[str, Any]] = []
    decoder = json.JSONDecoder()
    idx = 0
    n = len(raw)
    while idx < n:
        while idx < n and raw[idx].isspace():
            idx += 1
        if idx >= n:
            break
        obj, offset = decoder.raw_decode(raw, idx)
        if isinstance(obj, list):
            items.extend(obj)
        else:
            items.append(obj)
        idx = offset
    return items


def gh_api(endpoint: str) -> Any:
    return json.loads(run(["gh", "api", endpoint]))


def resolve_current_user() -> str:
    data = gh_api("user")
    login = data.get("login")
    if not login:
        raise SystemExit("could not resolve current GitHub user from `gh api user`")
    return login


def safe_filename(name: str) -> str:
    cleaned = re.sub(r"[\x00-\x1f/\\:*?\"<>|]", "_", name)
    cleaned = cleaned.strip(". ")
    return cleaned or "_"


def write_meta(item_dir: Path, item: dict[str, Any]) -> None:
    item_dir.mkdir(parents=True, exist_ok=True)
    (item_dir / "meta.json").write_text(
        json.dumps(item, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def write_comments(target_dir: Path, comments: Iterable[dict[str, Any]]) -> int:
    target_dir.mkdir(parents=True, exist_ok=True)
    n = 0
    for c in comments:
        cid = c.get("id")
        if cid is None:
            continue
        (target_dir / f"{cid}.json").write_text(
            json.dumps(c, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        n += 1
    return n


def extract_number_from_url(url: str | None) -> int | None:
    if not url:
        return None
    m = re.search(r"/(?:issues|pulls)/(\d+)$", url)
    return int(m.group(1)) if m else None


def sync_prs(
    owner: str,
    repo: str,
    dest: Path,
    state: str,
    *,
    with_comments: bool,
    author: str | None,
) -> tuple[int, int, int]:
    suffix = f", author={author}" if author else ""
    print(f"fetching PRs (state={state}{suffix})...")
    prs = gh_api_paginated(f"repos/{owner}/{repo}/pulls?state={state}&per_page=100")
    if author:
        author_lc = author.lower()
        prs = [
            pr
            for pr in prs
            if ((pr.get("user") or {}).get("login") or "").lower() == author_lc
        ]
    written = 0
    for pr in prs:
        num = pr.get("number")
        if num is None:
            continue
        write_meta(dest / str(num), pr)
        written += 1

    issue_comments = 0
    review_comments = 0
    if with_comments and written:
        print("fetching PR conversation comments (bulk)...")
        all_issue_comments = gh_api_paginated(
            f"repos/{owner}/{repo}/issues/comments?per_page=100"
        )
        by_pr: dict[int, list[dict[str, Any]]] = {}
        for c in all_issue_comments:
            n = extract_number_from_url(c.get("issue_url"))
            if n is None:
                continue
            by_pr.setdefault(n, []).append(c)
        for num, comments in by_pr.items():
            pr_dir = dest / str(num)
            if not pr_dir.exists():
                # comment belongs to an issue, not a PR we synced
                continue
            issue_comments += write_comments(pr_dir / "comments", comments)

        print("fetching PR review (inline) comments (bulk)...")
        all_review_comments = gh_api_paginated(
            f"repos/{owner}/{repo}/pulls/comments?per_page=100"
        )
        by_pr_rc: dict[int, list[dict[str, Any]]] = {}
        for c in all_review_comments:
            n = extract_number_from_url(c.get("pull_request_url"))
            if n is None:
                continue
            by_pr_rc.setdefault(n, []).append(c)
        for num, comments in by_pr_rc.items():
            pr_dir = dest / str(num)
            if not pr_dir.exists():
                continue
            review_comments += write_comments(pr_dir / "review_comments", comments)

    return written, issue_comments, review_comments


def sync_commits(
    owner: str,
    repo: str,
    dest: Path,
    max_pages: int,
    *,
    with_comments: bool,
    author: str | None,
) -> tuple[int, int]:
    suffix = f", author={author}" if author else ""
    print(f"fetching commits (max {max_pages} pages of 100{suffix})...")
    author_q = f"&author={author}" if author else ""
    all_items: list[dict[str, Any]] = []
    for page in range(1, max_pages + 1):
        out = run(
            [
                "gh",
                "api",
                f"repos/{owner}/{repo}/commits?per_page=100&page={page}{author_q}",
            ]
        )
        page_items = json.loads(out)
        if not page_items:
            break
        all_items.extend(page_items)
        if len(page_items) < 100:
            break

    written = 0
    commented = 0
    for item in all_items:
        sha = item.get("sha")
        if not sha:
            continue
        commit_dir = dest / sha
        write_meta(commit_dir, item)
        written += 1

        if with_comments:
            count = (item.get("commit") or {}).get("comment_count", 0) or 0
            if count > 0:
                comments = gh_api_paginated(
                    f"repos/{owner}/{repo}/commits/{sha}/comments?per_page=100"
                )
                commented += write_comments(commit_dir / "comments", comments)

    return written, commented


def sync_repo_meta(
    owner: str,
    repo: str,
    base: Path,
    *,
    local_path: Path,
    origin_url: str,
) -> None:
    print("fetching repo metadata...")
    data = gh_api(f"repos/{owner}/{repo}")

    existing_local_path: str | None = None
    meta_path = base / "meta.json"
    if meta_path.exists():
        try:
            prior = json.loads(meta_path.read_text(encoding="utf-8"))
            if isinstance(prior, dict):
                existing_local_path = prior.get("local_path")
        except (json.JSONDecodeError, OSError):
            pass

    data["local_path"] = existing_local_path or str(local_path)
    data["origin_url"] = origin_url
    write_meta(base, data)


def sync_branches(owner: str, repo: str, dest: Path) -> int:
    print("fetching branches...")
    items = gh_api_paginated(f"repos/{owner}/{repo}/branches?per_page=100")
    n = 0
    for b in items:
        name = b.get("name")
        if not name:
            continue
        write_meta(dest / safe_filename(name), b)
        n += 1
    return n


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("repo_path", type=Path, help="path to local git repo")
    p.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("./data"),
        help="output root directory (default: ./data)",
    )
    p.add_argument(
        "--kinds",
        nargs="+",
        choices=ALL_KINDS,
        default=list(ALL_KINDS),
        help="which kinds to sync",
    )
    p.add_argument(
        "--pr-state",
        default="all",
        choices=["open", "closed", "all"],
        help="PR state filter (default: all)",
    )
    p.add_argument(
        "--commit-pages",
        type=int,
        default=10,
        help="max pages of commits (100/page) (default: 10 = up to 1000 commits)",
    )
    p.add_argument(
        "--no-comments",
        action="store_true",
        help="skip fetching comments for PRs and commits",
    )
    p.add_argument(
        "--author",
        default=None,
        help=(
            "GitHub username to filter PRs/commits by (default: current `gh` user). "
            "Filtering is on by default; use --all-authors to disable."
        ),
    )
    p.add_argument(
        "--all-authors",
        action="store_true",
        help="disable author filtering for both PRs and commits",
    )
    p.add_argument(
        "--no-author-prs",
        action="store_true",
        help="disable author filtering for PRs only",
    )
    p.add_argument(
        "--no-author-commits",
        action="store_true",
        help="disable author filtering for commits only",
    )
    args = p.parse_args()

    repo_path: Path = args.repo_path.resolve()
    if not (repo_path / ".git").exists() and not (repo_path / "HEAD").exists():
        raise SystemExit(f"not a git repo: {repo_path}")

    owner, repo, origin_url = resolve_owner_repo(repo_path)
    print(f"repo: {owner}/{repo}")

    base = args.output / f"{owner}__{repo}"
    base.mkdir(parents=True, exist_ok=True)

    with_comments = not args.no_comments

    pr_author: str | None = None
    commit_author: str | None = None
    if not args.all_authors:
        author = args.author or resolve_current_user()
        if not args.no_author_prs:
            pr_author = author
        if not args.no_author_commits:
            commit_author = author
    if pr_author or commit_author:
        print(
            f"author filter: prs={pr_author or 'off'}, commits={commit_author or 'off'}"
        )

    summary: dict[str, Any] = {}

    sync_repo_meta(
        owner, repo, base, local_path=repo_path, origin_url=origin_url
    )
    summary["repo_meta"] = 1

    if KIND_PR in args.kinds:
        prs, ic, rc = sync_prs(
            owner,
            repo,
            base / KIND_PR,
            args.pr_state,
            with_comments=with_comments,
            author=pr_author,
        )
        summary["pr"] = prs
        summary["pr_issue_comments"] = ic
        summary["pr_review_comments"] = rc
    if KIND_COMMIT in args.kinds:
        commits, cc = sync_commits(
            owner,
            repo,
            base / KIND_COMMIT,
            args.commit_pages,
            with_comments=with_comments,
            author=commit_author,
        )
        summary["commit"] = commits
        summary["commit_comments"] = cc
    if KIND_BRANCH in args.kinds:
        summary["branch"] = sync_branches(owner, repo, base / KIND_BRANCH)

    print("done:")
    for k, v in summary.items():
        print(f"  {k}: {v}")
    print(f"output: {base}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
