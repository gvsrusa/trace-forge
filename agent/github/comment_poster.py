"""Post GitHub Pull Request Reviews with inline comments."""

from __future__ import annotations

from .app_auth import github_client

_SEVERITY_ICON = {"error": "🔴", "warning": "🟡", "info": "ℹ️"}


def format_comment_body(findings: list[dict]) -> str:
    """Format a list of findings into a single review comment body."""
    parts = []
    for f in findings:
        icon = _SEVERITY_ICON.get(f.get("severity", "info"), "ℹ️")
        dimension = f.get("dimension", "")
        message = f.get("message", "")
        suggestion = f.get("suggestion", "")
        body = f"{icon} **[{dimension}]** {message}"
        if suggestion:
            body += f"\n\n> **Fix:** {suggestion}"
        parts.append(body)
    return "\n\n---\n\n".join(parts) if parts else "No findings."


def post_pr_review(
    owner: str,
    repo: str,
    pull_number: int,
    commit_sha: str,
    summary_body: str,
    inline_comments: list[dict],
) -> dict:
    """
    Submit a GitHub Pull Request Review.

    inline_comments: list of {path, position, body}

    Returns the GitHub review response dict.
    """
    with github_client() as client:
        payload: dict = {
            "commit_id": commit_sha,
            "body": summary_body,
            "event": "COMMENT",
            "comments": inline_comments,
        }
        resp = client.post(
            f"/repos/{owner}/{repo}/pulls/{pull_number}/reviews",
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()


def build_review_summary(
    pr_title: str,
    files_reviewed: int,
    total_findings: int,
    avg_scores: dict,
    strategy_version: int,
) -> str:
    score_lines = " · ".join(
        f"**{k}**: {round(v * 100)}%"
        for k, v in avg_scores.items()
        if isinstance(v, (int, float))
    )
    return (
        f"## TraceForge Review — {pr_title}\n\n"
        f"Reviewed **{files_reviewed}** file(s), found **{total_findings}** issue(s).\n\n"
        f"**Eval scores:** {score_lines or 'N/A'}\n\n"
        f"*Strategy v{strategy_version} · Self-improving agent*"
    )
