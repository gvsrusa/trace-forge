"""Tool: generate_report — compile findings into a structured review report."""

_VALID_DIMENSIONS = {"performance", "accessibility", "best_practices", "security"}
_VALID_SEVERITIES = {"error", "warning", "info"}


def generate_report(
    findings: list[dict],
    code: str,
    eval_scores: dict | None = None,
    strategy_notes: str = "",
) -> dict:
    """
    Compile all findings from the 4-dimension review into a structured report.
    Call this after completing all 4 review dimensions.
    Returns the report text and line-level annotations for the dashboard.
    """
    if not findings:
        return {
            "report": "No findings — component looks clean.",
            "annotations": [],
            "summary": {"total": 0, "errors": 0, "warnings": 0, "info": 0},
        }

    # Normalize and validate findings
    cleaned: list[dict] = []
    for i, f in enumerate(findings):
        cleaned.append({
            "id": f.get("id", f"f{i+1}"),
            "dimension": f.get("dimension", "best_practices") if f.get("dimension") in _VALID_DIMENSIONS else "best_practices",
            "severity": f.get("severity", "warning") if f.get("severity") in _VALID_SEVERITIES else "warning",
            "line": f.get("line"),
            "message": f.get("message", ""),
            "suggestion": f.get("suggestion", ""),
        })

    errors = [f for f in cleaned if f["severity"] == "error"]
    warnings = [f for f in cleaned if f["severity"] == "warning"]
    info = [f for f in cleaned if f["severity"] == "info"]

    # Build report text
    lines = ["# TraceForge Review Report\n"]

    if errors:
        lines.append(f"## Errors ({len(errors)})\n")
        for f in errors:
            line_ref = f" (line {f['line']})" if f.get("line") else ""
            lines.append(f"**[{f['dimension']}]{line_ref}** {f['message']}")
            if f["suggestion"]:
                lines.append(f"  → Fix: {f['suggestion']}\n")

    if warnings:
        lines.append(f"## Warnings ({len(warnings)})\n")
        for f in warnings:
            line_ref = f" (line {f['line']})" if f.get("line") else ""
            lines.append(f"**[{f['dimension']}]{line_ref}** {f['message']}")
            if f["suggestion"]:
                lines.append(f"  → Fix: {f['suggestion']}\n")

    if info:
        lines.append(f"## Info ({len(info)})\n")
        for f in info:
            line_ref = f" (line {f['line']})" if f.get("line") else ""
            lines.append(f"**[{f['dimension']}]{line_ref}** {f['message']}")

    if eval_scores:
        lines.append("\n## Eval Scores")
        for criterion, score in eval_scores.items():
            bar = "█" * int(score * 10) + "░" * (10 - int(score * 10))
            lines.append(f"- {criterion}: {bar} {score:.2f}")

    if strategy_notes:
        lines.append(f"\n## Strategy Notes\n{strategy_notes}")

    annotations = [
        {
            "line": f["line"],
            "severity": f["severity"],
            "message": f["message"],
            "dimension": f["dimension"],
            "suggestion": f["suggestion"],
        }
        for f in cleaned
        if f.get("line")
    ]

    return {
        "report": "\n".join(lines),
        "annotations": annotations,
        "findings": cleaned,
        "summary": {
            "total": len(cleaned),
            "errors": len(errors),
            "warnings": len(warnings),
            "info": len(info),
        },
    }
