"""TraceForge agent backend — FastAPI app with SSE review endpoint."""

import asyncio
import json
import os
from typing import AsyncGenerator

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
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


class FeedbackRequest(BaseModel):
    finding_id: str
    action: str  # "approve" | "reject" | "modify"
    note: str = ""


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
        "history": await _run_sync(get_strategy_history, limit=10),
    }


@app.get("/api/improvement")
async def get_improvement():
    from db.firestore import get_eval_trends, get_blind_spots
    return {
        "eval_trends": await _run_sync(get_eval_trends),
        "blind_spots": await _run_sync(get_blind_spots),
    }


@app.post("/api/review/{review_id}/feedback")
async def submit_feedback(review_id: str, feedback: FeedbackRequest):
    from db.firestore import save_feedback
    await _run_sync(save_feedback, review_id, feedback.model_dump())
    return {"updated": True}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
