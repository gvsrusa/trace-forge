"""Lightweight GitHub REST client for public repos.

Uses GITHUB_TOKEN if set (increases rate limit from 60 to 5000 req/hr).
Works without any token for fully public repos.
"""

import os

import httpx

_GITHUB_API = "https://api.github.com"


def github_client() -> httpx.Client:
    token = os.environ.get("GITHUB_TOKEN", "")
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"token {token}"
    return httpx.Client(base_url=_GITHUB_API, headers=headers, timeout=30)


def parse_pr_url(pr_url: str) -> tuple[str, str, int]:
    """Parse 'https://github.com/owner/repo/pull/123' → (owner, repo, pull_number)."""
    parts = pr_url.rstrip("/").split("/")
    try:
        pull_idx = parts.index("pull")
        owner = parts[pull_idx - 2]
        repo = parts[pull_idx - 1]
        pull_number = int(parts[pull_idx + 1])
        return owner, repo, pull_number
    except (ValueError, IndexError):
        raise ValueError(f"Cannot parse PR URL: {pr_url!r}. Expected https://github.com/owner/repo/pull/N")
