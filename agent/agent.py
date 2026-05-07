"""Root ADK agent definition for TraceForge."""

import asyncio
import os
from typing import AsyncGenerator
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"), override=True)

from google.adk.agents import LlmAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools import FunctionTool
from google.genai import types

from prompts.review_system import REVIEW_SYSTEM_PROMPT
from tools.analyze_code import analyze_code
from tools.web_search import google_search_tool
from tools.phoenix_query import phoenix_query_traces, phoenix_query_evaluations
from tools.run_evaluation import run_evaluation
from tools.update_strategy import update_strategy
from tools.generate_report import generate_report
from db.firestore import get_current_strategy, save_review, save_eval_result


_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview")
_LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")
_APP_NAME = "traceforge"


def _make_agent(strategy_context: str) -> LlmAgent:
    return LlmAgent(
        model=_MODEL,
        name="traceforge_reviewer",
        description="Reviews React components across 4 dimensions and self-improves.",
        instruction=REVIEW_SYSTEM_PROMPT.format(strategy_context=strategy_context),
        tools=[
            FunctionTool(analyze_code),
            google_search_tool,
            FunctionTool(phoenix_query_traces),
            FunctionTool(phoenix_query_evaluations),
            FunctionTool(run_evaluation),
            FunctionTool(update_strategy),
            FunctionTool(generate_report),
        ],
    )


async def run_review(
    code: str,
    filename: str,
    language: str,
) -> AsyncGenerator[dict, None]:
    """Run a full review + reflection cycle. Yields SSE event dicts."""

    # Load strategy from Firestore (None on first run — defaults used)
    strategy = get_current_strategy()
    strategy_context = _format_strategy(strategy)

    agent = _make_agent(strategy_context)
    session_service = InMemorySessionService()
    runner = Runner(
        agent=agent,
        app_name=_APP_NAME,
        session_service=session_service,
    )

    session = await session_service.create_session(
        app_name=_APP_NAME,
        user_id="demo",
    )

    user_message = types.Content(
        role="user",
        parts=[types.Part(text=(
            f"Review this React component (`{filename}`):\n\n"
            f"```{language}\n{code}\n```\n\n"
            f"Run a full 4-dimension review (performance, accessibility, "
            f"best_practices, security), then enter reflection mode and update the strategy."
        ))],
    )

    yield {"type": "step", "name": "Starting review", "dimension": "setup", "status": "running"}

    final_text = ""
    eval_scores: dict = {}

    async for event in runner.run_async(
        user_id="demo",
        session_id=session.id,
        new_message=user_message,
    ):
        # Tool calls in progress
        for fc in (event.get_function_calls() or []):
            yield {"type": "tool_call", "tool": fc.name, "status": "running"}

        # Tool responses completed — capture eval scores when run_evaluation returns
        for fr in (event.get_function_responses() or []):
            yield {"type": "tool_call", "tool": fr.name, "status": "complete"}
            if fr.name == "run_evaluation" and fr.response:
                try:
                    resp = fr.response if isinstance(fr.response, dict) else {}
                    eval_scores = resp.get("scores", {})
                except Exception:
                    pass

        # Intermediate text thoughts
        if event.content and event.content.parts:
            for part in event.content.parts:
                if hasattr(part, "text") and part.text and not event.is_final_response():
                    yield {"type": "thought", "content": part.text[:300]}

        # Final agent response
        if event.is_final_response():
            if event.content and event.content.parts:
                final_text = "".join(
                    p.text for p in event.content.parts if hasattr(p, "text") and p.text
                )
            yield {"type": "final", "content": final_text}

    # Persist review and eval scores to Firestore after stream completes
    current_strategy = get_current_strategy()
    strategy_version = current_strategy.get("version", 0) if current_strategy else 0
    try:
        review_id = save_review({
            "filename": filename,
            "language": language,
            "code_snippet": code[:500],
            "report": final_text,
            "eval_scores": eval_scores,
            "strategy_version": strategy_version,
        })
        if eval_scores:
            save_eval_result(review_id, eval_scores, strategy_version)
    except Exception:
        pass


def _format_strategy(strategy: dict | None) -> str:
    if not strategy or not strategy.get("adjustments"):
        return "No prior strategy. Use the default review checklist."
    lines = [f"Strategy v{strategy.get('version', 1)} — apply these adjustments:"]
    for adj in strategy["adjustments"]:
        lines.append(f"  [{adj['dimension']}] {adj['action']}: {adj['detail']}")
    return "\n".join(lines)
