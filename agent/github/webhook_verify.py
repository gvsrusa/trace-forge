"""HMAC-SHA256 webhook signature verification for GitHub App events."""

import hashlib
import hmac
import os


def verify_signature(body: bytes, signature_header: str) -> bool:
    """Return True if the request body matches the GitHub webhook secret."""
    secret = os.environ.get("GITHUB_WEBHOOK_SECRET", "")
    if not secret:
        # No secret configured — skip verification (dev only)
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    received = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, received)
