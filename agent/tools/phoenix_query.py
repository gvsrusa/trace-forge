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


def _parse_span(n: dict) -> dict:
    """Normalise a raw GraphQL span node to a flat dict."""
    ctx = n.get("context") or {}
    raw_attrs = n.get("attributes", "")
    try:
        attrs = json.loads(raw_attrs) if isinstance(raw_attrs, str) and raw_attrs else raw_attrs or {}
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
    max_spans_per_trace: int = 200,
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
    edges = data.get("node", {}).get("spans", {}).get("edges", [])
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

    return traces


def phoenix_query_traces(query: str = "", time_range: str = "7d", limit: int = 0) -> dict:
    """
    Query traces from Phoenix Cloud, sorted newest-first, one entry per trace.
    Uses rootSpansOnly so results match the Arize portal exactly.
    limit=0 reads from PHOENIX_TRACES_LIMIT env var (default 50).
    """
    api_key = os.environ.get("PHOENIX_API_KEY", "")
    if not api_key:
        return {"error": "PHOENIX_API_KEY not configured"}

    resolved_limit = limit or int(os.environ.get("PHOENIX_TRACES_LIMIT", "50"))
    project = os.environ.get("PHOENIX_PROJECT_NAME", "traceforge")
    try:
        traces = _fetch_traces(project, limit=resolved_limit)
        return {"content": [{"type": "text", "text": json.dumps(traces)}]}
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
