"""Tools: phoenix_query_traces + phoenix_query_evaluations via Phoenix MCP server."""

import json
import os
import subprocess
from typing import Any


def _call_phoenix_mcp(tool_name: str, arguments: dict) -> Any:
    """
    Call the Phoenix MCP server as a stdio subprocess.
    Sends the required MCP initialization handshake then the tool call.
    """
    base_url = os.environ.get("PHOENIX_COLLECTOR_ENDPOINT", "")
    api_key = os.environ.get("PHOENIX_API_KEY", "")

    if not api_key or not base_url:
        return {"error": "Phoenix credentials not configured"}

    # MCP requires an initialize handshake before any tool calls
    init_msg = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "traceforge", "version": "1.0"},
        },
    })
    tool_msg = json.dumps({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": arguments},
    })
    payload = (init_msg + "\n" + tool_msg + "\n").encode()

    try:
        result = subprocess.run(
            ["npx", "-y", "@arizeai/phoenix-mcp@latest", "--baseUrl", base_url, "--apiKey", api_key],
            input=payload,
            capture_output=True,
            timeout=60,
        )
        if result.returncode != 0:
            return {"error": f"MCP process error: {result.stderr.decode()[:500]}"}

        # stdout contains one JSON object per line; we want the tool call response (id=2)
        for line in result.stdout.decode().splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            if msg.get("id") == 2:
                if "error" in msg:
                    return {"error": msg["error"]}
                return msg.get("result", {})
        return {"error": "No tool response received from Phoenix MCP"}
    except subprocess.TimeoutExpired:
        return {"error": "Phoenix MCP request timed out"}
    except OSError as e:
        return {"error": f"MCP call failed: {e}"}


def phoenix_query_traces(query: str = "", time_range: str = "7d", limit: int = 100) -> dict:
    """
    Query this agent's past traces from Phoenix Cloud via MCP server.
    Use to identify latency bottlenecks, low-quality tool calls, and blind spots.
    This is the self-introspection tool — the heart of the self-improvement loop.
    """
    return _call_phoenix_mcp(
        tool_name="list-traces",
        arguments={
            "project_identifier": os.environ.get("PHOENIX_PROJECT_NAME", "traceforge"),
            "limit": limit,
        },
    )


def phoenix_query_evaluations(eval_name: str = "", time_range: str = "7d") -> dict:
    """
    Query past LLM-as-Judge evaluation results from Phoenix Cloud via MCP server.
    Use to identify score trends and dimensions with declining quality.
    """
    return _call_phoenix_mcp(
        tool_name="get-spans",
        arguments={
            "project_identifier": os.environ.get("PHOENIX_PROJECT_NAME", "traceforge"),
            "limit": 50,
        },
    )
