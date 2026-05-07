"""Tools: phoenix_query_traces + phoenix_query_evaluations via Phoenix MCP server."""

import json
import os
import subprocess
from typing import Any


def _call_phoenix_mcp(method: str, params: dict) -> Any:
    """
    Call the Phoenix MCP server as a stdio subprocess.
    Sends a JSON-RPC request and returns the parsed result.
    """
    base_url = os.environ.get("PHOENIX_COLLECTOR_ENDPOINT", "")
    api_key = os.environ.get("PHOENIX_API_KEY", "")

    if not api_key or not base_url:
        return {"error": "Phoenix credentials not configured"}

    request = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params,
    })

    try:
        result = subprocess.run(
            ["npx", "-y", "@arizeai/phoenix-mcp@latest", "--baseUrl", base_url, "--apiKey", api_key],
            input=request.encode(),
            capture_output=True,
            timeout=30,
        )
        if result.returncode != 0:
            return {"error": f"MCP process error: {result.stderr.decode()[:500]}"}

        response = json.loads(result.stdout.decode())
        if "error" in response:
            return {"error": response["error"]}
        return response.get("result", {})
    except subprocess.TimeoutExpired:
        return {"error": "Phoenix MCP request timed out"}
    except (json.JSONDecodeError, OSError) as e:
        return {"error": f"MCP call failed: {e}"}


def phoenix_query_traces(query: str = "", time_range: str = "7d", limit: int = 10) -> dict:
    """
    Query this agent's past traces from Phoenix Cloud via MCP server.
    Use to identify latency bottlenecks, low-quality tool calls, and blind spots.
    This is the self-introspection tool — the heart of the self-improvement loop.
    """
    return _call_phoenix_mcp(
        method="tools/call",
        params={
            "name": "get_traces",
            "arguments": {
                "project_name": os.environ.get("PHOENIX_PROJECT_NAME", "traceforge"),
                "time_range": time_range,
                "limit": limit,
            },
        },
    )


def phoenix_query_evaluations(eval_name: str = "", time_range: str = "7d") -> dict:
    """
    Query past LLM-as-Judge evaluation results from Phoenix Cloud via MCP server.
    Use to identify score trends and dimensions with declining quality.
    """
    return _call_phoenix_mcp(
        method="tools/call",
        params={
            "name": "get_evaluations",
            "arguments": {
                "project_name": os.environ.get("PHOENIX_PROJECT_NAME", "traceforge"),
                "eval_name": eval_name or "review_quality",
                "time_range": time_range,
            },
        },
    )
