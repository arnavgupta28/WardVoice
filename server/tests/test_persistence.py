"""Supabase persistence: no-op without env, upsert/load via PostgREST with env (no network)."""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
import persistence  # noqa: E402
import ward  # noqa: E402


class FakeResponse:
    def __init__(self, payload=None, status=200):
        self._payload = payload
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._payload


@pytest.fixture
def calls(monkeypatch):
    log = {"get": [], "post": []}

    def fake_get(url, **kw):
        log["get"].append((url, kw))
        return FakeResponse(log.get("rows", []))

    def fake_post(url, **kw):
        log["post"].append((url, kw))
        return FakeResponse(None, log.get("status", 201))

    monkeypatch.setattr(persistence.requests, "get", fake_get)
    monkeypatch.setattr(persistence.requests, "post", fake_post)
    for k in ("RESEND_API_KEY", "SMTP_HOST", "SMTP_USER", "FAMILY_EMAIL_OVERRIDE"):
        monkeypatch.delenv(k, raising=False)
    yield log
    persistence.flush()
    ward._seed()


@pytest.fixture
def supabase_env(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://proj.supabase.co/")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-key")
    monkeypatch.setenv("WARDVOICE_PERSIST", "force")  # allow persistence under pytest


def test_no_env_means_no_calls(calls, monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    assert not persistence.enabled()
    assert persistence.load() is None
    ward.reset()
    ward.select_patient(bed="12", via="touch")
    persistence.flush()
    assert calls["get"] == [] and calls["post"] == []


def test_disabled_under_pytest_even_with_keys(calls, monkeypatch, supabase_env):
    monkeypatch.delenv("WARDVOICE_PERSIST")
    assert not persistence.enabled()


def test_ward_action_upserts_json_snapshot(calls, supabase_env):
    ward.reset()
    ward.select_patient(bed="12", via="touch")
    ward.confirm_identity(True, via="touch")
    persistence.flush()
    assert calls["post"], "expected an upsert"
    url, kw = calls["post"][-1]
    assert url == "https://proj.supabase.co/rest/v1/ward_state"
    assert kw["headers"]["apikey"] == "service-key"
    assert kw["headers"]["Authorization"] == "Bearer service-key"
    assert "resolution=merge-duplicates" in kw["headers"]["Prefer"]
    assert kw["timeout"] == persistence.TIMEOUT
    body = json.loads(kw["data"])
    assert body["id"] == "ward-4b"
    assert body["state"]["active_patient_id"] == "P1"
    assert body["state"]["records"]["P1"]["verified"] is True


def test_full_round_state_is_json_serialisable(calls, supabase_env):
    ward.reset()
    ward.select_patient(bed="12", via="touch")
    ward.confirm_identity(True, via="touch")
    ward.record_vitals(via="touch", hr=88, bp_sys=124, bp_dia=78, temp_c=37.2, spo2=96, rr=18, pain=2)
    ward.set_status(condition="improving", consciousness="alert", diet="soft", mobility="assisted", via="touch")
    ward.add_order("medication", "start", "Amoxicillin 500 mg oral three times daily", via="touch")
    ward.set_notes(family_note="Doing better today.", via="touch")
    for s in ("vitals", "status", "orders", "notes"):
        ward.confirm_section(s, via="touch")
    ward.sign_and_send(True, via="touch")
    persistence.flush()
    state = json.loads(calls["post"][-1][1]["data"])["state"]
    assert state["records"]["P1"]["status"] == "signed"
    assert state["reports"][0]["patient_id"] == "P1"


def test_save_failure_is_swallowed(calls, supabase_env):
    calls["status"] = 500
    assert persistence.save_now({"x": 1}) is False
    ward.select_patient(bed="12", via="touch")  # still works


def test_load_returns_snapshot_and_restore_applies_it(calls, supabase_env):
    ward._seed()
    stored = json.loads(json.dumps(ward._state))
    stored["records"]["P1"]["clinical_note"] = "restored from supabase"
    stored["active_patient_id"] = "P1"
    stored["seq"] = 7
    calls["rows"] = [{"state": stored}]
    assert persistence.load() == stored
    url, kw = calls["get"][-1]
    assert url == "https://proj.supabase.co/rest/v1/ward_state"
    assert kw["params"]["id"] == "eq.ward-4b"
    ward._restore()
    assert ward._state["records"]["P1"]["clinical_note"] == "restored from supabase"
    assert ward._state["active_patient_id"] == "P1"
    assert ward._state["seq"] == 7


def test_bad_snapshot_falls_back_to_seed(calls, supabase_env):
    calls["rows"] = [{"state": {"records": "garbage", "reports": [], "seq": 0}}]
    ward._restore()
    assert ward._state["records"]["P2"]["status"] == "signed"
