"""Parse GitHub PR unified diff patches into reviewable hunks."""

from __future__ import annotations

import re

_EXT_TO_LANG: dict[str, str] = {
    ".py": "python", ".ts": "typescript", ".tsx": "tsx", ".js": "javascript",
    ".jsx": "jsx", ".go": "go", ".rs": "rust", ".java": "java", ".kt": "kotlin",
    ".rb": "ruby", ".php": "php", ".cs": "csharp", ".cpp": "cpp", ".c": "c",
    ".swift": "swift", ".sh": "bash", ".yaml": "yaml", ".yml": "yaml",
    ".json": "json", ".md": "markdown", ".sql": "sql", ".tf": "hcl",
    ".html": "html", ".css": "css", ".scss": "scss",
}

_SKIP_PATTERNS = re.compile(
    r"(\.lock$|lock\.json$|[-.]min\.(js|css)$|/vendor/|/node_modules/|"
    r"/migrations?/|/generated/|\.pb\.go$|_pb2\.py$|\.snap$)"
)

_HUNK_HEADER = re.compile(r"^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@")


def language_for(path: str) -> str:
    suffix = "." + path.rsplit(".", 1)[-1] if "." in path else ""
    return _EXT_TO_LANG.get(suffix.lower(), "text")


def should_skip(path: str) -> bool:
    return bool(_SKIP_PATTERNS.search(path))


def parse_pr_files(
    files: list[dict],
    max_diff_lines: int = 300,
    max_hunks_per_file: int = 3,
) -> list[dict]:
    """
    Convert GitHub PR file objects into a flat list of reviewable hunk dicts.

    Each hunk dict:
      {path, language, content, start_line, hunk_index, position, total_hunks}

    `position` is the diff-relative position required by the GitHub Reviews API
    (1-indexed count from the top of each file's patch block).
    """
    hunks: list[dict] = []

    for f in files:
        path = f.get("filename", "")
        status = f.get("status", "")
        patch = f.get("patch", "")

        if status == "removed":
            continue
        if not patch:
            continue
        if should_skip(path):
            continue

        additions = f.get("additions", 0)
        deletions = f.get("deletions", 0)
        if additions + deletions > max_diff_lines:
            continue

        file_hunks = _split_patch(patch, path)
        for i, h in enumerate(file_hunks[:max_hunks_per_file]):
            h["total_hunks"] = len(file_hunks)
            h["hunk_index"] = i
            hunks.append(h)

    return hunks


def _split_patch(patch: str, path: str) -> list[dict]:
    """Split a file's patch into individual @@ hunk dicts."""
    language = language_for(path)
    lines = patch.splitlines()
    result: list[dict] = []
    current_lines: list[str] = []
    start_new_line = 1
    position_offset = 0  # position within the whole patch

    i = 0
    while i < len(lines):
        line = lines[i]
        m = _HUNK_HEADER.match(line)
        if m:
            if current_lines:
                content = "\n".join(current_lines)
                result.append({
                    "path": path,
                    "language": language,
                    "content": content,
                    "start_line": start_new_line,
                    "position": position_offset,  # position of @@ line itself
                    "hunk_index": 0,
                    "total_hunks": 0,
                })
            start_new_line = int(m.group(2))
            current_lines = [line]
            position_offset = i + 1  # 1-indexed, relative to start of patch block
        else:
            current_lines.append(line)
        i += 1

    if current_lines:
        content = "\n".join(current_lines)
        result.append({
            "path": path,
            "language": language,
            "content": content,
            "start_line": start_new_line,
            "position": position_offset,
            "hunk_index": 0,
            "total_hunks": 0,
        })

    return result
