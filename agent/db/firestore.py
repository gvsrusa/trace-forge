"""Firestore client and CRUD helpers for TraceForge.

Firebase Admin SDK is synchronous — all functions here are sync.
Async wrappers in callers use run_in_executor if needed.
"""

import os
from datetime import datetime, timezone

_db = None


def _get_db():
    global _db
    if _db is None:
        import firebase_admin
        from firebase_admin import firestore

        if not firebase_admin._apps:
            firebase_admin.initialize_app()
        _db = firestore.client()
    return _db


# ── Reviews ──────────────────────────────────────────────────────────────────

def save_review(review: dict) -> str:
    db = _get_db()
    review["timestamp"] = datetime.now(timezone.utc).isoformat()
    ref = db.collection("reviews").document()
    review["id"] = ref.id
    ref.set(review)
    return ref.id


def get_reviews(limit: int = 20, offset: int = 0) -> list[dict]:
    db = _get_db()
    docs = (
        db.collection("reviews")
        .order_by("timestamp", direction="DESCENDING")
        .limit(limit)
        .stream()
    )
    return [doc.to_dict() for doc in docs]


def get_review_by_id(review_id: str) -> dict | None:
    db = _get_db()
    doc = db.collection("reviews").document(review_id).get()
    return doc.to_dict() if doc.exists else None


def get_reviews_for_comparison(limit: int = 200) -> list[dict]:
    """Fetch reviews for comparison — larger limit, includes all fields."""
    db = _get_db()
    docs = (
        db.collection("reviews")
        .order_by("strategy_version", direction="ASCENDING")
        .limit(limit)
        .stream()
    )
    return [doc.to_dict() for doc in docs]


def get_distinct_reviewed_filenames(limit: int = 100) -> list[str]:
    """Return sorted list of distinct filenames that have been reviewed."""
    db = _get_db()
    docs = (
        db.collection("reviews")
        .order_by("timestamp", direction="DESCENDING")
        .limit(limit)
        .stream()
    )
    seen: set[str] = set()
    names: list[str] = []
    for doc in docs:
        fname = doc.to_dict().get("filename", "")
        if fname and fname not in seen:
            seen.add(fname)
            names.append(fname)
    return sorted(names)


# ── Strategy ─────────────────────────────────────────────────────────────────

def get_current_strategy() -> dict | None:
    db = _get_db()
    docs = (
        db.collection("agent_strategy")
        .order_by("version", direction="DESCENDING")
        .limit(1)
        .stream()
    )
    for doc in docs:
        return doc.to_dict()
    return None


def save_strategy_update(adjustments: list[dict]) -> dict:
    db = _get_db()
    current = get_current_strategy()
    new_version = (current.get("version", 0) + 1) if current else 1

    strategy = {
        "version": new_version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "base_strategy": "default_v1",
        "adjustments": adjustments,
    }
    db.collection("agent_strategy").document(f"v{new_version}").set(strategy)
    return {"strategy_version": new_version, "changes_applied": adjustments}


def get_strategy_range(from_version: int, to_version: int) -> list[dict]:
    """Get all strategy documents between two versions (inclusive), ascending."""
    db = _get_db()
    docs = (
        db.collection("agent_strategy")
        .order_by("version", direction="ASCENDING")
        .stream()
    )
    return [
        doc.to_dict()
        for doc in docs
        if from_version <= doc.to_dict().get("version", 0) <= to_version
    ]


def get_strategy_history(limit: int = 10) -> list[dict]:
    db = _get_db()
    docs = (
        db.collection("agent_strategy")
        .order_by("version", direction="DESCENDING")
        .limit(limit)
        .stream()
    )
    return [doc.to_dict() for doc in docs]


# ── Eval history ─────────────────────────────────────────────────────────────

def save_eval_result(review_id: str, scores: dict, strategy_version: int) -> None:
    db = _get_db()
    db.collection("eval_history").add({
        "review_id": review_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "scores": scores,
        "strategy_version": strategy_version,
    })


def get_eval_trends(limit: int = 50) -> list[dict]:
    db = _get_db()
    docs = (
        db.collection("eval_history")
        .order_by("timestamp", direction="ASCENDING")
        .limit(limit)
        .stream()
    )
    return [doc.to_dict() for doc in docs]


# ── Blind spots ──────────────────────────────────────────────────────────────

def get_blind_spots() -> list[dict]:
    db = _get_db()
    docs = db.collection("blind_spots").stream()
    return [doc.to_dict() for doc in docs]


def upsert_blind_spot(key: str, data: dict) -> None:
    db = _get_db()
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    db.collection("blind_spots").document(key).set(data, merge=True)


# ── Feedback ─────────────────────────────────────────────────────────────────

def save_feedback(review_id: str, feedback: dict) -> None:
    db = _get_db()
    feedback["timestamp"] = datetime.now(timezone.utc).isoformat()
    db.collection("reviews").document(review_id).collection("feedback").add(feedback)


# ── PR Reviews ────────────────────────────────────────────────────────────────

def save_pr_review(pr_review: dict) -> str:
    db = _get_db()
    pr_review["timestamp"] = datetime.now(timezone.utc).isoformat()
    ref = db.collection("pr_reviews").document()
    pr_review["id"] = ref.id
    ref.set(pr_review)
    return ref.id


def get_pr_reviews(limit: int = 20, offset: int = 0) -> list[dict]:
    db = _get_db()
    docs = (
        db.collection("pr_reviews")
        .order_by("timestamp", direction="DESCENDING")
        .limit(limit)
        .stream()
    )
    return [doc.to_dict() for doc in docs]


def get_pr_review_by_id(pr_review_id: str) -> dict | None:
    db = _get_db()
    doc = db.collection("pr_reviews").document(pr_review_id).get()
    return doc.to_dict() if doc.exists else None


def save_pr_feedback(
    pr_review_id: str,
    comment_id: str,
    reaction: str,
    github_login: str = "",
) -> None:
    db = _get_db()
    db.collection("pr_reviews").document(pr_review_id).collection("feedback").add({
        "comment_id": comment_id,
        "reaction": reaction,
        "github_login": github_login,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
