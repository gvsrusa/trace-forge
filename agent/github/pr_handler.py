"""Core orchestrator for on-demand GitHub PR reviews (public repos)."""

from __future__ import annotations

import logging
import os
from typing import AsyncGenerator

from .diff_parser import parse_pr_files, language_for
from .public_client import github_client, parse_pr_url

logger = logging.getLogger(__name__)

_MAX_FILES = int(os.environ.get("PR_MAX_FILES_PER_REVIEW", "5"))
_MAX_DIFF_LINES = int(os.environ.get("PR_MAX_DIFF_LINES", "300"))
_MAX_HUNKS_PER_FILE = int(os.environ.get("PR_MAX_HUNKS_PER_FILE", "2"))

# Language preference order — review code first, skip pure config/docs if over limit
_LANG_PRIORITY = {
    "python": 0, "typescript": 0, "tsx": 0, "javascript": 0, "jsx": 0,
    "go": 0, "rust": 0, "java": 0, "kotlin": 0, "ruby": 0, "php": 0,
    "csharp": 0, "cpp": 0, "c": 0, "swift": 0, "bash": 1,
    "yaml": 2, "json": 2, "hcl": 2,
    "markdown": 3, "text": 3,
}


def _prioritize_files(files: list[dict], max_files: int) -> list[dict]:
    """Sort files by language priority, then take up to max_files."""
    def priority(f: dict) -> int:
        lang = language_for(f.get("filename", ""))
        return _LANG_PRIORITY.get(lang, 2)
    return sorted(files, key=priority)[:max_files]


async def handle_pr_url(pr_url: str) -> AsyncGenerator[dict, None]:
    """
    Full PR review pipeline. Async generator — yields progress events so the
    SSE connection stays alive throughout the review (which can take 1-5 min).

    Event types yielded:
      file_start  — about to review a file
      file_done   — file review complete, with findings count
      tool_call   — forwarded from the agent loop
      complete    — all done, includes pr_review_id
      error       — something went wrong
    """
    owner, repo, pull_number = parse_pr_url(pr_url)
    logger.info("PR review started: %s/%s#%d", owner, repo, pull_number)

    # Fetch PR metadata
    pr_meta = _fetch_pr_meta(owner, repo, pull_number)
    head_sha = pr_meta.get("head", {}).get("sha", "")
    pr_title = pr_meta.get("title", f"PR #{pull_number}")
    pr_html_url = pr_meta.get("html_url", pr_url)

    # Fetch changed files
    files = _fetch_pr_files(owner, repo, pull_number)
    if not files:
        yield {"type": "error", "message": f"Could not fetch files for {owner}/{repo}#{pull_number}. Check the repo is public."}
        return

    # Pick the most meaningful files up to _MAX_FILES
    selected = _prioritize_files(files, _MAX_FILES)
    hunks = parse_pr_files(selected, max_diff_lines=_MAX_DIFF_LINES, max_hunks_per_file=_MAX_HUNKS_PER_FILE)

    if not hunks:
        yield {"type": "error", "message": "No reviewable code found in this PR (all files are binary, generated, or too large)."}
        return

    yield {"type": "files_found", "count": len(hunks), "total_files": len(files)}

    # Review each hunk, streaming progress
    hunk_results: list[dict] = []
    for i, hunk in enumerate(hunks):
        yield {"type": "file_start", "path": hunk["path"], "index": i + 1, "total": len(hunks)}

        result = await _review_hunk(
            hunk=hunk,
            owner=owner,
            repo=repo,
            pull_number=pull_number,
            pr_url=pr_html_url,
            head_sha=head_sha,
        )
        hunk_results.append(result)

        yield {
            "type": "file_done",
            "path": hunk["path"],
            "findings": len(result.get("findings", [])),
            "index": i + 1,
            "total": len(hunks),
        }

    # Aggregate results
    all_findings: list[dict] = []
    all_eval_scores: list[dict] = []
    files_reviewed: set[str] = set()

    for result in hunk_results:
        files_reviewed.add(result["path"])
        all_findings.extend(result.get("findings", []))
        if result.get("eval_scores"):
            all_eval_scores.append(result["eval_scores"])

    avg_scores: dict = {}
    if all_eval_scores:
        keys = {k for s in all_eval_scores for k in s}
        avg_scores = {
            k: sum(s.get(k, 0) for s in all_eval_scores) / len(all_eval_scores)
            for k in keys
        }

    from db.firestore import get_current_strategy
    current_strategy = get_current_strategy()
    strategy_version = current_strategy.get("version", 0) if current_strategy else 0

    # Strategy reflection intentionally skipped here — the per-hunk reviews already
    # call save_eval_result, which feeds the self-improvement loop via the existing
    # snippet review path. A full reflection would overflow context on large PRs.

    # Persist
    from db.firestore import save_pr_review
    pr_review_id = save_pr_review({
        "repo": f"{owner}/{repo}",
        "pr_number": pull_number,
        "head_sha": head_sha,
        "pr_title": pr_title,
        "pr_url": pr_html_url,
        "files_reviewed": len(files_reviewed),
        "total_findings": len(all_findings),
        "eval_scores": avg_scores,
        "strategy_version": strategy_version,
        "hunk_results": [
            {
                "path": r["path"],
                "hunk_index": r.get("hunk_index", 0),
                "findings": r.get("findings", []),
                "eval_scores": r.get("eval_scores", {}),
                "review_id": r.get("review_id", ""),
            }
            for r in hunk_results
        ],
    })

    logger.info("PR review persisted: %s", pr_review_id)
    yield {"type": "complete", "pr_review_id": pr_review_id}


def _fetch_pr_meta(owner: str, repo: str, pull_number: int) -> dict:
    try:
        with github_client() as client:
            resp = client.get(f"/repos/{owner}/{repo}/pulls/{pull_number}")
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.error("Failed to fetch PR metadata: %s", e)
        return {}


def _fetch_pr_files(owner: str, repo: str, pull_number: int) -> list[dict]:
    try:
        with github_client() as client:
            resp = client.get(
                f"/repos/{owner}/{repo}/pulls/{pull_number}/files",
                params={"per_page": 100},
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        logger.error("Failed to fetch PR files: %s", e)
        return []


async def _review_hunk(
    hunk: dict,
    owner: str,
    repo: str,
    pull_number: int,
    pr_url: str,
    head_sha: str,
) -> dict:
    from agent import run_pr_file_review

    findings: list[dict] = []
    eval_scores: dict = {}
    review_id = ""

    try:
        async for event in run_pr_file_review(
            code=hunk["content"],
            filename=hunk["path"],
            language=hunk["language"],
            pr_context={
                "repo": f"{owner}/{repo}",
                "pr_number": pull_number,
                "pr_url": pr_url,
                "commit_sha": head_sha,
                "diff_position": hunk["position"],
                "hunk_index": hunk["hunk_index"],
            },
        ):
            if event.get("type") == "eval_scores":
                eval_scores = event.get("scores", {})
            elif event.get("type") == "findings":
                findings = event.get("findings", [])
            elif event.get("type") == "review_id":
                review_id = event.get("id", "")
    except Exception as e:
        logger.error("Hunk review failed for %s: %s", hunk["path"], e)

    return {
        "path": hunk["path"],
        "position": hunk["position"],
        "hunk_index": hunk["hunk_index"],
        "findings": findings,
        "eval_scores": eval_scores,
        "review_id": review_id,
    }


