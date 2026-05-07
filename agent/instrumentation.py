# Copyright 2025 Google LLC (adapted for TraceForge)
# SPDX-License-Identifier: Apache-2.0
#
# Registers Phoenix Cloud OTEL tracing for the Google ADK agent.
# Call setup_tracing() once at startup before any ADK calls.

import os
from typing import Optional

_tracer_provider = None


def setup_tracing():
    """Register Phoenix OTEL provider. Returns provider or None if unconfigured."""
    global _tracer_provider
    if _tracer_provider is not None:
        return _tracer_provider

    api_key = os.environ.get("PHOENIX_API_KEY")
    endpoint = os.environ.get("PHOENIX_COLLECTOR_ENDPOINT")

    if not api_key or not endpoint:
        print("⚠️  Phoenix tracing disabled — PHOENIX_API_KEY or PHOENIX_COLLECTOR_ENDPOINT not set")
        return None

    try:
        import phoenix.otel

        project_name = os.environ.get("PHOENIX_PROJECT_NAME", "traceforge")

        # phoenix.otel.register reads PHOENIX_COLLECTOR_ENDPOINT and PHOENIX_API_KEY
        # from env vars automatically — no manual endpoint/headers needed.
        _tracer_provider = phoenix.otel.register(
            project_name=project_name,
            batch=False,
            auto_instrument=True,
        )
        print(f"✅ Phoenix tracing enabled → project: {project_name}")
        print(f"   Collector: {endpoint}")
        return _tracer_provider
    except Exception as e:
        print(f"⚠️  Phoenix tracing setup failed: {e}")
        return None
