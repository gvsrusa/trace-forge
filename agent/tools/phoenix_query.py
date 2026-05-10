"""Tools: phoenix_query_traces + phoenix_query_evaluations via Phoenix GraphQL API.

Uses httpx + GraphQL instead of the MCP subprocess (npx) so this works on
Cloud Run and any container without Node.js installed.

Queries root spans with rootSpansOnly:true (one per trace, sorted newest-first)
and fetches each trace's full span tree via span.trace.spans — this matches
exactly how the Arize Phoenix portal displays traces.
"""

import json
import os
from typing import Any

import httpx

# Cached project ID — resolved once per process
_project_id_cache: dict[str, str] = {}

_SPAN_FIELDS = """
  name spanKind startTime endTime statusCode statusMessage parentId
  context { traceId spanId }
  attributes
"""


def _phoenix_graphql_url() -> str:
    base = os.environ.get("PHOENIX_COLLECTOR_ENDPOINT", "").strip().rstrip("/")
    if not base:
        base = "https://app.phoenix.arize.com"
    return f"{base}/graphql"


def _headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {os.environ.get('PHOENIX_API_KEY', '')}"}


def _graphql(query: str) -> dict[str, Any]:
    url = _phoenix_graphql_url()
    resp = httpx.post(url, json={"query": query}, headers=_headers(), timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if "errors" in data:
        raise RuntimeError(f"GraphQL errors: {data['errors']}")
    return data.get("data", {})


def _resolve_project_id(project_name: str) -> str | None:
    """Return the Phoenix GraphQL node ID for a project name, caching the result."""
    if project_name in _project_id_cache:
        return _project_id_cache[project_name]

    data = _graphql("{ projects { edges { node { id name } } } }")
    for edge in data.get("projects", {}).get("edges", []):
        node = edge.get("node", {})
        _project_id_cache[node["name"]] = node["id"]

    return _project_id_cache.get(project_name)


def _flatten(obj: dict, prefix: str = "") -> dict:
    """Recursively flatten a nested dict into dot-notation keys.

    ADK stores attributes as nested objects ({"gen_ai": {"agent": {"name": "x"}}})
    but the UI expects OTel-style flat keys ("gen_ai.agent.name").
    """
    out: dict = {}
    for k, v in obj.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.update(_flatten(v, key))
        else:
            out[key] = v
    return out


# Cap individual string attribute values to keep response under Cloud Run's 32 MiB limit.
# LLM input/output blobs (full code files + review text) can be 100KB+ each.
# 8 KB per value × ~15 spans × ~15 traces per page ≈ 1.8 MB — safely under the limit.
_MAX_ATTR_CHARS = 8_192


def _truncate_attrs(attrs: dict) -> dict:
    out = {}
    for k, v in attrs.items():
        if isinstance(v, str) and len(v) > _MAX_ATTR_CHARS:
            out[k] = v[:_MAX_ATTR_CHARS] + f" … [truncated, {len(v)} chars total]"
        else:
            out[k] = v
    return out


def _parse_span(n: dict) -> dict:
    """Normalise a raw GraphQL span node to a flat dict."""
    ctx = n.get("context") or {}
    raw_attrs = n.get("attributes", "")
    try:
        raw = json.loads(raw_attrs) if isinstance(raw_attrs, str) and raw_attrs else raw_attrs or {}
        attrs = _truncate_attrs(_flatten(raw)) if isinstance(raw, dict) else {}
    except Exception:
        attrs = {}
    return {
        "name": n.get("name", ""),
        "span_kind": n.get("spanKind", ""),
        "start_time": n.get("startTime", ""),
        "end_time": n.get("endTime", ""),
        "status_code": n.get("statusCode", "UNSET"),
        "status_message": n.get("statusMessage", ""),
        "parent_id": n.get("parentId"),
        "trace_id": ctx.get("traceId", ""),
        "span_id": ctx.get("spanId", ""),
        "attributes": attrs,
    }


def _fetch_traces(
    project_name: str,
    limit: int = 50,
    cursor: str | None = None,
    max_spans_per_trace: int = 50,
) -> list[dict]:
    """Fetch traces from Phoenix using rootSpansOnly, sorted newest-first.

    Returns [{traceId, spans}] where spans[0] is always the root span and
    the full span tree is included — matching the Arize portal's view.
    cursor: opaque pagination cursor from pageInfo.endCursor.
    """
    project_id = _resolve_project_id(project_name)
    if not project_id:
        raise RuntimeError(f"Project '{project_name}' not found in Phoenix")

    after_clause = f', after: "{cursor}"' if cursor else ""
    query = f"""
    {{
      node(id: "{project_id}") {{
        ... on Project {{
          spans(
            first: {limit},
            rootSpansOnly: true,
            sort: {{ col: startTime, dir: desc }}
            {after_clause}
          ) {{
            pageInfo {{ hasNextPage endCursor }}
            edges {{
              node {{
                {_SPAN_FIELDS}
                trace {{
                  numSpans
                  spans(first: {max_spans_per_trace}) {{
                    edges {{
                      node {{
                        {_SPAN_FIELDS}
                      }}
                    }}
                  }}
                }}
              }}
            }}
          }}
        }}
      }}
    }}
    """
    data = _graphql(query)
    spans_data = data.get("node", {}).get("spans", {})
    page_info = spans_data.get("pageInfo", {})
    edges = spans_data.get("edges", [])
    traces = []
    for edge in edges:
        root_node = edge.get("node", {})
        root = _parse_span(root_node)
        trace_id = root["trace_id"]

        # Collect all spans in the trace (root + children from trace.spans)
        child_edges = root_node.get("trace", {}).get("spans", {}).get("edges", [])
        all_spans = [_parse_span(e["node"]) for e in child_edges]

        # If trace.spans didn't include the root (depends on Phoenix version), add it
        if not any(s["span_id"] == root["span_id"] for s in all_spans):
            all_spans.insert(0, root)

        # Ensure trace_id is stamped on every span
        for s in all_spans:
            s["trace_id"] = trace_id

        traces.append({"traceId": trace_id, "spans": all_spans})

    return {
        "traces": traces,
        "page_info": {
            "has_next_page": page_info.get("hasNextPage", False),
            "end_cursor": page_info.get("endCursor") or "",
        },
    }


def _summarize_trace(trace: dict) -> dict:
    """Return a compact summary of a trace suitable for LLM self-reflection.

    Omits all span attributes (which can be 100KB+ of LLM blobs) and keeps
    only the metadata needed to spot blind spots: names, status, duration.
    """
    spans = trace.get("spans", [])
    root = next((s for s in spans if s.get("parent_id") is None), spans[0] if spans else {})

    def _duration_ms(s: dict) -> int:
        try:
            from datetime import datetime, timezone
            fmt = "%Y-%m-%dT%H:%M:%S.%fZ"
            start = datetime.strptime(s["start_time"], fmt).replace(tzinfo=timezone.utc)
            end = datetime.strptime(s["end_time"], fmt).replace(tzinfo=timezone.utc)
            return int((end - start).total_seconds() * 1000)
        except Exception:
            return 0

    return {
        "traceId": trace["traceId"],
        "root_name": root.get("name", ""),
        "root_status": root.get("status_code", "UNSET"),
        "duration_ms": _duration_ms(root),
        "num_spans": len(spans),
        "span_names": [s.get("name", "") for s in spans],
        "error_spans": [
            {"name": s.get("name", ""), "message": s.get("status_message", "")}
            for s in spans if s.get("status_code") == "ERROR"
        ],
    }


def phoenix_query_traces(
    query: str = "",
    time_range: str = "7d",
    limit: int = 0,
    cursor: str = "",
    summary_only: bool = False,
) -> dict:
    """
    Query traces from Phoenix Cloud, sorted newest-first, one entry per trace.
    Uses rootSpansOnly so results match the Arize portal exactly.
    limit=0 reads from PHOENIX_TRACES_LIMIT env var (default 15).
    summary_only=True returns compact metadata only (no attributes) — use this
    for self-reflection to avoid exceeding the LLM context window.
    Returns traces + page_info {has_next_page, end_cursor} for progressive loading.
    """
    api_key = os.environ.get("PHOENIX_API_KEY", "")
    if not api_key:
        return {"error": "PHOENIX_API_KEY not configured"}

    resolved_limit = limit or int(os.environ.get("PHOENIX_TRACES_LIMIT", "15"))
    project = os.environ.get("PHOENIX_PROJECT_NAME", "traceforge")
    try:
        result = _fetch_traces(project, limit=resolved_limit, cursor=cursor or None)
        traces = result["traces"]
        if summary_only:
            traces = [_summarize_trace(t) for t in traces]
        return {
            "content": [{"type": "text", "text": json.dumps(traces)}],
            "page_info": result["page_info"],
        }
    except Exception as e:
        return {"error": f"Phoenix query failed: {e}"}


def phoenix_query_evaluations(eval_name: str = "", time_range: str = "7d") -> dict:
    """
    Query recent traces for evaluation signal from Phoenix Cloud.
    Limit controlled by PHOENIX_EVAL_LIMIT env var (default 30).
    """
    api_key = os.environ.get("PHOENIX_API_KEY", "")
    if not api_key:
        return {"error": "PHOENIX_API_KEY not configured"}

    eval_limit = int(os.environ.get("PHOENIX_EVAL_LIMIT", "30"))
    project = os.environ.get("PHOENIX_PROJECT_NAME", "traceforge")
    try:
        traces = _fetch_traces(project, limit=eval_limit)
        # Flatten to spans and filter for evaluation-related ones
        all_spans = [s for t in traces for s in t["spans"]]
        eval_spans = [s for s in all_spans if "evaluation" in s.get("name", "").lower()
                      or "run_evaluation" in s.get("name", "")]
        return {"content": [{"type": "text", "text": json.dumps(eval_spans or all_spans[:20])}]}
    except Exception as e:
        return {"error": f"Phoenix evaluations query failed: {e}"}
