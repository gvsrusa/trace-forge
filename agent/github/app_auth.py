"""GitHub App authentication — JWT generation and installation token exchange."""

import base64
import os
import time

import httpx
import jwt

_token_cache: dict = {"token": None, "expires_at": 0.0}
_GITHUB_API = "https://api.github.com"


def _get_private_key() -> str:
    pem = os.environ.get("GITHUB_APP_PRIVATE_KEY_PEM", "")
    if not pem:
        raise RuntimeError("GITHUB_APP_PRIVATE_KEY_PEM is not set")
    # Support base64-encoded PEM
    if not pem.startswith("-----"):
        pem = base64.b64decode(pem).decode()
    return pem


def _make_jwt() -> str:
    app_id = os.environ.get("GITHUB_APP_ID", "")
    if not app_id:
        raise RuntimeError("GITHUB_APP_ID is not set")
    now = int(time.time())
    payload = {"iat": now - 60, "exp": now + 540, "iss": app_id}
    return jwt.encode(payload, _get_private_key(), algorithm="RS256")


def get_installation_token() -> str:
    """Return a cached installation access token, refreshing when near expiry."""
    now = time.monotonic()
    if _token_cache["token"] and now < _token_cache["expires_at"] - 60:
        return _token_cache["token"]

    installation_id = os.environ.get("GITHUB_INSTALLATION_ID", "")
    if not installation_id:
        raise RuntimeError("GITHUB_INSTALLATION_ID is not set")

    jwt_token = _make_jwt()
    resp = httpx.post(
        f"{_GITHUB_API}/app/installations/{installation_id}/access_tokens",
        headers={
            "Authorization": f"Bearer {jwt_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    _token_cache["token"] = data["token"]
    # GitHub tokens expire in 1 hour; cache for ~58 min
    _token_cache["expires_at"] = now + 3480
    return data["token"]


def github_client() -> httpx.Client:
    """Return an httpx.Client pre-configured with the installation token."""
    token = get_installation_token()
    return httpx.Client(
        base_url=_GITHUB_API,
        headers={
            "Authorization": f"token {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=30,
    )
