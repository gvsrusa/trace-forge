"""FastAPI router for GitHub App webhook events."""

import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import JSONResponse

from .webhook_verify import verify_signature

logger = logging.getLogger(__name__)

github_router = APIRouter(prefix="/api/github", tags=["github"])

_PR_TRIGGER_ACTIONS = {"opened", "synchronize", "reopened"}


@github_router.post("/webhook")
async def github_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Receive and dispatch GitHub App webhook events.
    Must return within 10 seconds — processing runs as a background task.
    """
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")
    event_type = request.headers.get("X-GitHub-Event", "")

    if not verify_signature(body, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    if event_type == "pull_request":
        action = payload.get("action", "")
        if action in _PR_TRIGGER_ACTIONS:
            from .pr_handler import handle_pr_event
            background_tasks.add_task(_safe_handle_pr, payload)
            return JSONResponse({"queued": True, "action": action}, status_code=202)

    if event_type == "pull_request_review_comment":
        _handle_reaction_event(payload)

    return JSONResponse({"received": True, "event": event_type}, status_code=200)


async def _safe_handle_pr(payload: dict) -> None:
    from .pr_handler import handle_pr_event
    try:
        pr = payload.get("pull_request", {})
        repo = payload.get("repository", {})
        logger.info(
            "Processing PR #%d for %s/%s",
            pr.get("number", 0),
            repo.get("owner", {}).get("login", ""),
            repo.get("name", ""),
        )
        await handle_pr_event(payload)
    except Exception as e:
        logger.error("PR handler failed: %s", e, exc_info=True)


def _handle_reaction_event(payload: dict) -> None:
    """Map a thumbs-up/down reaction on a PR review comment to Firestore feedback."""
    try:
        reaction = payload.get("reaction", {})
        comment = payload.get("comment", {})
        content = reaction.get("content", "")
        if content not in ("+1", "-1"):
            return

        comment_id = str(comment.get("id", ""))
        github_login = payload.get("sender", {}).get("login", "")
        pull_request_review_id = str(comment.get("pull_request_review_id", ""))

        from db.firestore import _get_db
        db = _get_db()
        # Find pr_review by github_review_id
        docs = (
            db.collection("pr_reviews")
            .where("github_review_id", "==", int(pull_request_review_id or 0))
            .limit(1)
            .stream()
        )
        for doc in docs:
            from db.firestore import save_pr_feedback
            save_pr_feedback(
                pr_review_id=doc.id,
                comment_id=comment_id,
                reaction="thumbs_up" if content == "+1" else "thumbs_down",
                github_login=github_login,
            )
            break
    except Exception as e:
        logger.error("Reaction handler failed: %s", e)
