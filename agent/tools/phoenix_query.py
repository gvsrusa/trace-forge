"""Tools: phoenix_query_traces + phoenix_query_evaluations via Phoenix GraphQL API.

Uses httpx + GraphQL instead of the MCP subprocess (npx) so this works on
Cloud Run and any container without Node.js installed.
"""

import json
import os
from typing import Any

import httpx

# Cached project ID — resolved once per process
_project_id_cache: dict[str, str] = {}


def _phoenix_graphql_url() -> str:
    base = os.environ.get("PHOENIX_COLLECTOR_ENDPOINT", "").strip().rstrip("/")
    if not base:
        base = "https://app.phoenix.arize.com"
    # Strip any path beyond scheme+host (e.g. /s/gvsrusa → keep it, it's the tenant prefix)
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


def _fetch_spans(project_name: str, limit: int = 100, cursor: str | None = None) -> list[dict]:
    """Fetch spans for the given project via GraphQL, grouped into trace dicts.

    cursor: opaque Phoenix pagination cursor from a previous call's pageInfo.endCursor.
    """
    project_id = _resolve_project_id(project_name)
    if not project_id:
        raise RuntimeError(f"Project '{project_name}' not found in Phoenix")

    after_clause = f', after: "{cursor}"' if cursor else ""
    query = f"""
    {{
      node(id: "{project_id}") {{
        ... on Project {{
          name
          spans(first: {limit}{after_clause}) {{
            pageInfo {{ hasNextPage endCursor }}
            edges {{
              node {{
                name spanKind startTime endTime
                statusCode statusMessage parentId
                context {{ traceId spanId }}
                attributes
              }}
            }}
          }}
        }}
      }}
    }}
    """
    data = _graphql(query)
    spans_data = data.get("node", {}).get("spans", {})
    edges = spans_data.get("edges", [])
    spans = []
    for edge in edges:
        n = edge.get("node", {})
        ctx = n.get("context") or {}
        # Flatten context fields to top-level for compatibility with the UI
        raw_attrs = n.get("attributes", "")
        try:
            attrs = json.loads(raw_attrs) if isinstance(raw_attrs, str) and raw_attrs else raw_attrs or {}
        except Exception:
            attrs = {}
        spans.append({
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
        })
    return spans


def _group_into_traces(spans: list[dict]) -> list[dict]:
    """Group flat span list into [{traceId, spans}] format expected by main.py."""
    traces: dict[str, list[dict]] = {}
    for span in spans:
        tid = span.get("trace_id", "")
        if tid not in traces:
            traces[tid] = []
        traces[tid].append(span)
    return [{"traceId": tid, "spans": s} for tid, s in traces.items()]


def phoenix_query_traces(query: str = "", time_range: str = "7d", limit: int = 0) -> dict:
    """
    Query this agent's past traces from Phoenix Cloud via GraphQL.
    Returns a dict with content list matching the legacy MCP response shape.
    limit=0 means read from PHOENIX_TRACES_LIMIT env var (default 100).
    """
    api_key = os.environ.get("PHOENIX_API_KEY", "")
    if not api_key:
        return {"error": "PHOENIX_API_KEY not configured"}

    resolved_limit = limit or int(os.environ.get("PHOENIX_TRACES_LIMIT", "100"))
    project = os.environ.get("PHOENIX_PROJECT_NAME", "traceforge")
    try:
        spans = _fetch_spans(project, limit=resolved_limit)
        traces = _group_into_traces(spans)
        return {"content": [{"type": "text", "text": json.dumps(traces)}]}
    except Exception as e:
        return {"error": f"Phoenix query failed: {e}"}


def phoenix_query_evaluations(eval_name: str = "", time_range: str = "7d") -> dict:
    """
    Query recent spans for evaluation signal from Phoenix Cloud.
    Limit controlled by PHOENIX_EVAL_LIMIT env var (default 50).
    """
    api_key = os.environ.get("PHOENIX_API_KEY", "")
    if not api_key:
        return {"error": "PHOENIX_API_KEY not configured"}

    eval_limit = int(os.environ.get("PHOENIX_EVAL_LIMIT", "50"))
    project = os.environ.get("PHOENIX_PROJECT_NAME", "traceforge")
    try:
        spans = _fetch_spans(project, limit=eval_limit)
        eval_spans = [s for s in spans if "evaluation" in s.get("name", "").lower()
                      or "run_evaluation" in s.get("name", "")]
        return {"content": [{"type": "text", "text": json.dumps(eval_spans or spans[:20])}]}
    except Exception as e:
        return {"error": f"Phoenix evaluations query failed: {e}"}
