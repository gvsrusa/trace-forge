"""Tool: fetch_repo — discover and fetch React component files from a GitHub repo."""

import re
from urllib.parse import urlparse

import httpx

# Max files to review per repo (keeps demo fast)
MAX_FILES = 10
MAX_FILE_SIZE = 80_000  # bytes — skip huge generated files

REACT_EXTENSIONS = {".tsx", ".jsx"}
JS_EXTENSIONS = {".ts", ".js"}

REACT_IMPORT_RE = re.compile(
    r"""(from\s+['"]react['"]|import\s+React|from\s+['"]react-dom)""",
    re.MULTILINE,
)

SKIP_DIRS = {
    "node_modules", ".next", "dist", "build", "coverage",
    ".git", "__pycache__", ".cache", "out", ".turbo",
}


def parse_github_url(url: str) -> tuple[str, str, str]:
    """Return (owner, repo, ref). ref defaults to HEAD."""
    url = url.rstrip("/")
    # https://github.com/owner/repo or github.com/owner/repo
    if not url.startswith("http"):
        url = "https://" + url
    parts = urlparse(url).path.strip("/").split("/")
    if len(parts) < 2:
        raise ValueError(f"Cannot parse GitHub URL: {url}")
    owner, repo = parts[0], parts[1].removesuffix(".git")
    ref = parts[3] if len(parts) >= 4 and parts[2] == "tree" else "HEAD"
    return owner, repo, ref


def _is_react_file(path: str, content: str) -> bool:
    ext = "." + path.rsplit(".", 1)[-1] if "." in path else ""
    if ext in REACT_EXTENSIONS:
        return True
    if ext in JS_EXTENSIONS:
        return bool(REACT_IMPORT_RE.search(content[:2000]))
    return False


def _skip_path(path: str) -> bool:
    parts = path.split("/")
    return any(p in SKIP_DIRS for p in parts)


def fetch_repo_components(repo_url: str, github_token: str = "") -> dict:
    """
    Discover all React component files in a public GitHub repository.
    Returns a list of {path, content, language} dicts ready for review.
    Limits to MAX_FILES components to keep review time reasonable.
    """
    import os
    token = github_token or os.environ.get("GITHUB_TOKEN", "")

    try:
        owner, repo, ref = parse_github_url(repo_url)
    except ValueError as e:
        return {"error": str(e), "files": []}

    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    api_base = f"https://api.github.com/repos/{owner}/{repo}"

    with httpx.Client(timeout=30, headers=headers) as client:
        # Get default branch / ref SHA
        try:
            branch_res = client.get(f"{api_base}/git/ref/heads/{ref}")
            if branch_res.status_code == 404:
                branch_res = client.get(f"{api_base}/commits/HEAD")
                sha = branch_res.json().get("sha", "HEAD")
            else:
                sha = branch_res.json()["object"]["sha"]
        except Exception:
            sha = ref

        # Get full file tree (recursive)
        tree_res = client.get(f"{api_base}/git/trees/{sha}?recursive=1")
        if tree_res.status_code != 200:
            return {"error": f"GitHub API error {tree_res.status_code}: {tree_res.text[:200]}", "files": []}

        tree = tree_res.json().get("tree", [])

        # Filter candidate files
        candidates = [
            item for item in tree
            if item["type"] == "blob"
            and not _skip_path(item["path"])
            and item.get("size", 0) < MAX_FILE_SIZE
            and any(item["path"].endswith(ext) for ext in REACT_EXTENSIONS | JS_EXTENSIONS)
        ]

        # Fetch content and filter to React components
        components = []
        for item in candidates:
            if len(components) >= MAX_FILES:
                break
            try:
                raw = client.get(
                    f"https://raw.githubusercontent.com/{owner}/{repo}/{sha}/{item['path']}"
                )
                if raw.status_code != 200:
                    continue
                content = raw.text
                if _is_react_file(item["path"], content):
                    ext = item["path"].rsplit(".", 1)[-1]
                    components.append({
                        "path": item["path"],
                        "filename": item["path"].split("/")[-1],
                        "content": content,
                        "language": ext,
                        "size": len(content),
                    })
            except Exception:
                continue

    return {
        "repo": f"{owner}/{repo}",
        "ref": sha[:7] if len(sha) > 7 else sha,
        "files": components,
        "total_found": len(components),
    }
