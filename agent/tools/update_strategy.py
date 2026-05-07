"""Tool: update_strategy — persist strategy adjustments to Firestore."""

from db.firestore import save_strategy_update


def update_strategy(adjustments: list[dict]) -> dict:
    """
    Persist strategy updates to Firestore for future reviews.
    Call this after reflection mode to save identified improvements.

    Each adjustment must have:
    - dimension: performance | accessibility | best_practices | security
    - action: ADD_CHECK | CALIBRATE | DEPRIORITIZE
    - detail: specific description of the check or calibration change
    - rationale: what evidence led to this adjustment
    - priority: high | medium | low
    """
    if not adjustments:
        return {"strategy_version": 0, "changes_applied": [], "error": "No adjustments provided"}

    valid_dimensions = {"performance", "accessibility", "best_practices", "security"}
    valid_actions = {"ADD_CHECK", "CALIBRATE", "DEPRIORITIZE"}

    cleaned = [
        {
            "dimension": adj["dimension"],
            "action": adj["action"],
            "detail": adj.get("detail", ""),
            "rationale": adj.get("rationale", ""),
            "priority": adj.get("priority", "medium"),
            "verified": False,
        }
        for adj in adjustments
        if adj.get("dimension") in valid_dimensions and adj.get("action") in valid_actions
    ]

    if not cleaned:
        return {"strategy_version": 0, "changes_applied": [], "error": "No valid adjustments after validation"}

    return save_strategy_update(cleaned)
