"""Optional Supabase persistence for the ward state.

When SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, the whole ward state is
kept as one jsonb row in `ward_state` (see supabase/schema.sql) via PostgREST.
Without them every function here is a no-op, so the app runs purely in memory.

Writes go through a single background worker that only ever sends the latest
snapshot, so ward actions never wait on the network. Every failure is logged and
swallowed: persistence must never break a round.
"""
from __future__ import annotations

import atexit
import json
import os
import threading
from typing import Any, Dict, Optional

import requests

ROW_ID = "ward-4b"
TIMEOUT = 5


def _config() -> Optional[tuple]:
    url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key or os.getenv("WARDVOICE_PERSIST", "1") == "0":
        return None
    # Never let the test suite touch a real database, even if .env.local has keys.
    if os.getenv("PYTEST_CURRENT_TEST") and os.getenv("WARDVOICE_PERSIST") != "force":
        return None
    return url, key


def enabled() -> bool:
    return _config() is not None


def _headers(key: str) -> Dict[str, str]:
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def load() -> Optional[Dict[str, Any]]:
    """Return the stored ward state, or None (not configured, no row, or error)."""
    cfg = _config()
    if not cfg:
        return None
    url, key = cfg
    try:
        res = requests.get(f"{url}/rest/v1/ward_state", headers=_headers(key), timeout=TIMEOUT,
                           params={"id": f"eq.{ROW_ID}", "select": "state"})
        res.raise_for_status()
        rows = res.json()
        if rows and isinstance(rows[0].get("state"), dict):
            print("[PERSIST] loaded ward state from Supabase", flush=True)
            return rows[0]["state"]
        print("[PERSIST] no stored ward state yet; using seed", flush=True)
    except Exception as exc:  # noqa: BLE001
        print(f"[PERSIST] load failed, using seed: {type(exc).__name__}: {exc}", flush=True)
    return None


def save_now(state: Dict[str, Any]) -> bool:
    """Upsert the snapshot synchronously. Returns True on success."""
    cfg = _config()
    if not cfg:
        return False
    url, key = cfg
    try:
        body = json.dumps({"id": ROW_ID, "state": state})
        res = requests.post(f"{url}/rest/v1/ward_state", data=body, timeout=TIMEOUT,
                            headers={**_headers(key), "Prefer": "resolution=merge-duplicates,return=minimal"})
        res.raise_for_status()
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"[PERSIST] save failed: {type(exc).__name__}: {exc}", flush=True)
        return False


# --------------------------------------------------------------------------- background writer

_cond = threading.Condition()
_pending: Optional[Dict[str, Any]] = None
_busy = False
_worker: Optional[threading.Thread] = None


def _run() -> None:
    global _pending, _busy
    while True:
        with _cond:
            while _pending is None:
                _cond.wait()
            state, _pending, _busy = _pending, None, True
        try:
            save_now(state)
        finally:
            with _cond:
                _busy = False
                _cond.notify_all()


def save(state: Dict[str, Any]) -> None:
    """Queue `state` (already a private copy) for upsert; only the latest is written."""
    global _pending, _worker
    if not enabled():
        return
    with _cond:
        _pending = state
        if _worker is None or not _worker.is_alive():
            _worker = threading.Thread(target=_run, name="ward-persist", daemon=True)
            _worker.start()
        _cond.notify_all()


def flush(timeout: float = TIMEOUT) -> None:
    """Wait (bounded) until queued snapshots are written — used at exit and in tests."""
    with _cond:
        _cond.wait_for(lambda: _pending is None and not _busy, timeout=timeout)


atexit.register(flush)
