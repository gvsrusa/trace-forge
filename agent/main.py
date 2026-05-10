"""TraceForge agent backend — FastAPI app with SSE review endpoint."""

import asyncio
import json
import os
from typing import AsyncGenerator

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel

from instrumentation import setup_tracing

# Use explicit path so .env is found regardless of working directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"), override=True)
setup_tracing()

app = FastAPI(title="TraceForge Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)



class ReviewRequest(BaseModel):
    code: str
    filename: str = "component.tsx"
    language: str = "tsx"


class RepoReviewRequest(BaseModel):
    repo_url: str
    github_token: str = ""


class FeedbackRequest(BaseModel):
    finding_id: str
    action: str  # "approve" | "reject" | "modify"
    note: str = ""


class PRFeedbackRequest(BaseModel):
    comment_id: str
    reaction: str  # "thumbs_up" | "thumbs_down"
    github_login: str = ""


class PRTriggerRequest(BaseModel):
    pr_url: str  # https://github.com/owner/repo/pull/N


def _run_sync(fn, *args, **kwargs):
    """Run a sync Firestore function from an async FastAPI endpoint."""
    return asyncio.get_event_loop().run_in_executor(None, lambda: fn(*args, **kwargs))


@app.get("/health")
async def health():
    return {"status": "ok", "service": "traceforge-agent"}


@app.post("/api/review")
async def review(request: ReviewRequest):
    """Stream agent review steps via SSE."""
    from agent import run_review

    async def event_stream() -> AsyncGenerator[str, None]:
        try:
            async for event in run_review(
                code=request.code,
                filename=request.filename,
                language=request.language,
            ):
                yield f"data: {json.dumps(event)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/repo-review")
async def repo_review(request: RepoReviewRequest):
    """Discover React components in a GitHub repo and stream reviews for each."""
    from agent import run_review
    from tools.fetch_repo import fetch_repo_components

    async def event_stream() -> AsyncGenerator[str, None]:
        try:
            result = fetch_repo_components(request.repo_url, request.github_token)
            if "error" in result:
                yield f"data: {json.dumps({'type': 'error', 'message': result['error']})}\n\n"
                return

            files = result["files"]
            if not files:
                yield f"data: {json.dumps({'type': 'error', 'message': 'No React components found in repository'})}\n\n"
                return

            yield f"data: {json.dumps({'type': 'repo_info', 'repo': result['repo'], 'ref': result['ref'], 'total': len(files)})}\n\n"

            for i, f in enumerate(files):
                yield f"data: {json.dumps({'type': 'file_start', 'index': i + 1, 'total': len(files), 'path': f['path']})}\n\n"
                async for event in run_review(
                    code=f["content"],
                    filename=f["filename"],
                    language=f["language"],
                ):
                    yield f"data: {json.dumps(event)}\n\n"
                yield f"data: {json.dumps({'type': 'file_done', 'index': i + 1, 'path': f['path']})}\n\n"

            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/reviews")
async def list_reviews(limit: int = 20, offset: int = 0):
    from db.firestore import get_reviews
    reviews = await _run_sync(get_reviews, limit=limit, offset=offset)
    return {"reviews": reviews, "total": len(reviews)}


@app.get("/api/reviews/{review_id}")
async def get_review(review_id: str):
    from db.firestore import get_review_by_id
    review = await _run_sync(get_review_by_id, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return review


@app.get("/api/strategy")
async def get_strategy():
    from db.firestore import get_current_strategy, get_strategy_history
    return {
        "current_strategy": await _run_sync(get_current_strategy),
        "history": await _run_sync(get_strategy_history, limit=int(os.environ.get("STRATEGY_HISTORY_LIMIT", "200"))),
    }


@app.get("/api/improvement")
async def get_improvement():
    from db.firestore import get_eval_trends, get_blind_spots
    return {
        "eval_trends": await _run_sync(get_eval_trends, limit=int(os.environ.get("EVAL_TRENDS_LIMIT", "200"))),
        "blind_spots": await _run_sync(get_blind_spots),
    }


@app.post("/api/review/{review_id}/feedback")
async def submit_feedback(review_id: str, feedback: FeedbackRequest):
    from db.firestore import save_feedback
    await _run_sync(save_feedback, review_id, feedback.model_dump())
    return {"updated": True}


@app.post("/api/pr-reviews/trigger")
async def trigger_pr_review(request: PRTriggerRequest):
    """Trigger an on-demand review of a public GitHub PR. Streams SSE progress events."""
    from github.public_client import parse_pr_url

    try:
        parse_pr_url(request.pr_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    async def event_stream() -> AsyncGenerator[str, None]:
        try:
            from github.pr_handler import handle_pr_url
            yield f"data: {json.dumps({'type': 'started', 'pr_url': request.pr_url})}\n\n"
            async for event in handle_pr_url(request.pr_url):
                yield f"data: {json.dumps(event)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/pr-reviews")
async def list_pr_reviews(limit: int = 20, offset: int = 0):
    from db.firestore import get_pr_reviews
    reviews = await _run_sync(get_pr_reviews, limit=limit, offset=offset)
    return {"pr_reviews": reviews, "total": len(reviews)}


@app.get("/api/pr-reviews/{pr_review_id}")
async def get_pr_review(pr_review_id: str):
    from db.firestore import get_pr_review_by_id
    review = await _run_sync(get_pr_review_by_id, pr_review_id)
    if not review:
        raise HTTPException(status_code=404, detail="PR review not found")
    return review


@app.post("/api/pr-reviews/{pr_review_id}/feedback")
async def submit_pr_feedback(pr_review_id: str, feedback: PRFeedbackRequest):
    from db.firestore import save_pr_feedback
    await _run_sync(
        save_pr_feedback,
        pr_review_id,
        feedback.comment_id,
        feedback.reaction,
        feedback.github_login,
    )
    return {"updated": True}


_traces_cache: dict = {"data": None, "at": 0.0}
_TRACES_TTL = 45  # seconds


@app.get("/api/traces")
async def get_traces(
    limit: int = Query(default=0, ge=0, description="Max traces to return; 0 uses PHOENIX_TRACES_LIMIT env var"),
    cursor: str = Query(default="", description="Pagination cursor from previous response"),
):
    """Fetch a page of traces from Phoenix Cloud. Returns has_next_page + end_cursor for progressive loading."""
    import time
    from tools.phoenix_query import phoenix_query_traces

    # Only cache the default first page (no limit/cursor override)
    now = time.monotonic()
    use_cache = not limit and not cursor
    if use_cache and _traces_cache["data"] is not None and now - _traces_cache["at"] < _TRACES_TTL:
        return Response(content=_traces_cache["data"], media_type="application/json")

    try:
        result = await asyncio.get_event_loop().run_in_executor(
            None, lambda: phoenix_query_traces(limit=limit, cursor=cursor, summary_only=False)
        )
    except Exception as e:
        return Response(
            content=json.dumps({"error": f"Phoenix query failed: {e}", "traces": [], "has_next_page": False, "end_cursor": ""}),
            media_type="application/json",
            status_code=200,
        )

    if isinstance(result, dict) and "error" in result:
        return Response(
            content=json.dumps({"error": result["error"], "traces": [], "has_next_page": False, "end_cursor": ""}),
            media_type="application/json",
            status_code=200,
        )

    page_info = result.get("page_info", {}) if isinstance(result, dict) else {}
    traces = []
    content = result.get("content", []) if isinstance(result, dict) else []
    for item in content:
        if isinstance(item, dict) and item.get("type") == "text":
            try:
                raw = json.loads(item.get("text", "[]"))
                if isinstance(raw, list):
                    for trace in raw:
                        trace_id = trace.get("traceId", "")
                        all_spans = [{**s, "trace_id": trace_id} for s in trace.get("spans", [])]
                        root = next(
                            (s for s in all_spans if s.get("parent_id") is None),
                            all_spans[0] if all_spans else None,
                        )
                        if root:
                            traces.append({"trace_id": trace_id, "root": root, "spans": all_spans})
            except Exception:
                pass

    phoenix_base = os.environ.get("PHOENIX_COLLECTOR_ENDPOINT", "")
    payload = {
        "traces": traces,
        "phoenix_base": phoenix_base,
        "has_next_page": page_info.get("has_next_page", False),
        "end_cursor": page_info.get("end_cursor", ""),
    }
    json_payload = json.dumps(payload)

    if use_cache:
        _traces_cache["data"] = json_payload
        _traces_cache["at"] = now

    return Response(content=json_payload, media_type="application/json")


@app.get("/api/comparison")
async def get_comparison(
    component: str = "ProductCard.tsx",
    from_strategy: int | None = None,
    to_strategy: int | None = None,
):
    """Return before/after review data for a component across strategy versions."""
    from db.firestore import (
        get_reviews_for_comparison,
        get_strategy_range,
        get_distinct_reviewed_filenames,
    )

    comparison_limit = int(os.environ.get("COMPARISON_REVIEWS_LIMIT", "200"))
    filenames_limit = int(os.environ.get("COMPARISON_FILENAMES_LIMIT", "100"))
    all_reviews = await _run_sync(get_reviews_for_comparison, comparison_limit)
    all_filenames = await _run_sync(get_distinct_reviewed_filenames, filenames_limit)

    component_reviews = [
        r for r in all_reviews if r.get("filename") == component
    ]
    component_reviews.sort(key=lambda r: r.get("strategy_version", 0))

    if not component_reviews:
        return {
            "error": f"No reviews found for {component}",
            "available_components": all_filenames,
        }

    versions = sorted({r.get("strategy_version", 0) for r in component_reviews})
    actual_from = from_strategy if from_strategy is not None else versions[0]
    actual_to = to_strategy if to_strategy is not None else versions[-1]

    def closest(reviews: list[dict], target: int) -> dict:
        return min(reviews, key=lambda r: abs(r.get("strategy_version", 0) - target))

    from_review = closest(component_reviews, actual_from)
    to_review = closest(component_reviews, actual_to)

    from_v = from_review.get("strategy_version", actual_from)
    to_v = to_review.get("strategy_version", actual_to)

    mutations: list[dict] = []
    if from_v < to_v:
        strategy_docs = await _run_sync(get_strategy_range, from_v + 1, to_v)
        for s in strategy_docs:
            for adj in s.get("adjustments", []):
                mutations.append({**adj, "strategy_version": s.get("version")})

    return {
        "from_review": from_review,
        "to_review": to_review,
        "from_version": from_v,
        "to_version": to_v,
        "strategy_mutations": mutations,
        "available_versions": versions,
        "available_components": all_filenames,
    }


@app.get("/api/comparison/components")
async def get_comparison_components():
    from db.firestore import get_distinct_reviewed_filenames
    names = await _run_sync(get_distinct_reviewed_filenames, 100)
    return {"components": names}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
