"""Tool: analyze_code — parse React component structure via regex + heuristics."""

import re
from dataclasses import dataclass, field


@dataclass
class CodeAnalysis:
    ast_summary: str
    component_name: str
    hook_usage: list[str]
    imports: list[str]
    has_memo: bool
    has_use_callback: bool
    has_use_memo: bool
    has_error_boundary: bool
    has_dangerous_html: bool
    prop_count: int
    jsx_elements: list[str]


def analyze_code(code: str, language: str = "tsx", filename: str = "") -> dict:
    """
    Parse a React component and extract structural information.
    Returns hook usage, imports, key patterns, and a summary.
    """
    analysis = _analyze(code, filename)
    return {
        "ast_summary": analysis.ast_summary,
        "component_name": analysis.component_name,
        "hook_usage": analysis.hook_usage,
        "imports": analysis.imports,
        "patterns": {
            "has_memo": analysis.has_memo,
            "has_use_callback": analysis.has_use_callback,
            "has_use_memo": analysis.has_use_memo,
            "has_error_boundary": analysis.has_error_boundary,
            "has_dangerous_html": analysis.has_dangerous_html,
        },
        "prop_count": analysis.prop_count,
        "jsx_elements": analysis.jsx_elements[:20],
    }


def _analyze(code: str, filename: str) -> CodeAnalysis:
    lines = code.splitlines()
    imports = _extract_imports(code)
    hooks = _extract_hooks(code)
    component_name = _extract_component_name(code, filename)
    jsx_elements = _extract_jsx_elements(code)
    prop_count = _estimate_prop_count(code)

    flags = {
        "has_memo": bool(re.search(r"\bReact\.memo\b|\bwithMemo\b", code)),
        "has_use_callback": bool(re.search(r"\buseCallback\b", code)),
        "has_use_memo": bool(re.search(r"\buseMemo\b", code)),
        "has_error_boundary": bool(re.search(r"\bcomponentDidCatch\b|\bErrorBoundary\b", code)),
        "has_dangerous_html": bool(re.search(r"dangerouslySetInnerHTML", code)),
    }

    summary_parts = [
        f"Component: {component_name or 'unknown'} ({len(lines)} lines)",
        f"Hooks: {', '.join(hooks) if hooks else 'none'}",
        f"Imports: {len(imports)} modules",
        f"JSX elements: {', '.join(jsx_elements[:8]) if jsx_elements else 'none'}",
    ]
    if flags["has_dangerous_html"]:
        summary_parts.append("⚠ uses dangerouslySetInnerHTML")
    if not flags["has_memo"] and prop_count > 3:
        summary_parts.append("⚠ no React.memo (component takes props)")

    return CodeAnalysis(
        ast_summary=" | ".join(summary_parts),
        component_name=component_name,
        hook_usage=hooks,
        imports=imports,
        jsx_elements=jsx_elements,
        prop_count=prop_count,
        **flags,
    )


def _extract_imports(code: str) -> list[str]:
    return re.findall(r"^import\s+.+\s+from\s+['\"](.+)['\"]", code, re.MULTILINE)


def _extract_hooks(code: str) -> list[str]:
    found = re.findall(r"\b(use[A-Z][a-zA-Z]+)\s*\(", code)
    return sorted(set(found))


def _extract_component_name(code: str, filename: str) -> str:
    # function ComponentName or const ComponentName =
    m = re.search(r"(?:function|const)\s+([A-Z][a-zA-Z]+)", code)
    if m:
        return m.group(1)
    if filename:
        return filename.replace(".tsx", "").replace(".jsx", "").split("/")[-1]
    return ""


def _extract_jsx_elements(code: str) -> list[str]:
    found = re.findall(r"<([A-Za-z][a-zA-Z.]+)[\s/>]", code)
    return sorted(set(found))


def _estimate_prop_count(code: str) -> int:
    # Count destructured props in function signature
    m = re.search(r"(?:function\s+\w+|=\s*)\(\s*\{([^}]+)\}", code)
    if m:
        return len(m.group(1).split(","))
    return 0
