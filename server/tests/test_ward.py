"""WardVoice rules, exercised through the MCP tools exactly as Agora cloud calls them."""
import asyncio
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
import mcp_server as srv  # noqa: E402
import ward  # noqa: E402


def call(name, **args):
    out = asyncio.run(srv.mcp.call_tool(name, args))
    content = out[0] if isinstance(out, tuple) else out
    return json.loads(content[0].text)


@pytest.fixture(autouse=True)
def fresh(monkeypatch):
    for k in ("RESEND_API_KEY", "SMTP_HOST", "SMTP_USER", "FAMILY_EMAIL_OVERRIDE"):
        monkeypatch.delenv(k, raising=False)
    ward.reset()


def full_round(condition="improving"):
    call("select_patient", bed="12")
    call("confirm_identity", confirmed=True)
    call("record_vitals", hr=88, bp_sys=124, bp_dia=78, temp_c=37.2, spo2=96, rr=18, pain=2)
    call("confirm_section", section="vitals")
    call("set_status", condition=condition, consciousness="alert", diet="soft", mobility="assisted")
    call("confirm_section", section="status")
    call("add_order", kind="medication", action="change", text="Ceftriaxone IV to Cefuroxime 500 mg oral 12-hourly")
    call("confirm_section", section="orders")
    call("set_notes", family_note="Ramesh is breathing more comfortably.")
    call("confirm_section", section="notes")


def test_tools_registered():
    names = {t.name for t in asyncio.run(srv.mcp.list_tools())}
    assert {"select_patient", "confirm_identity", "record_vitals", "set_status", "add_order", "remove_order",
            "set_notes", "confirm_section", "read_back", "sign_and_send", "get_time"} <= names


def test_nothing_written_before_identity_confirmed():
    sel = call("select_patient", bed="12")
    assert sel["patient"]["name"] == "Ramesh Kumar" and "Correct" not in sel.get("error", "")
    r = call("record_vitals", hr=88)
    assert "Identity not confirmed" in r["error"]
    assert ward.snapshot()["records"]["P1"]["vitals"]["hr"] is None


def test_unknown_bed_lists_beds():
    assert "Beds on this ward" in call("select_patient", bed="99")["error"]


def test_implausible_vital_rejected_and_out_of_range_flagged():
    call("select_patient", bed="12")
    call("confirm_identity", confirmed=True)
    assert "not plausible" in call("record_vitals", spo2=150)["error"]
    flagged = call("record_vitals", spo2=89)
    assert flagged["out_of_range"] and "Oxygen" in flagged["out_of_range"][0]


def test_fahrenheit_converted():
    call("select_patient", bed="12")
    call("confirm_identity", confirmed=True)
    assert call("record_vitals", temp_c=101.3)["vitals"]["temp_c"] == 38.5


def test_enum_rejects_free_values():
    """The MCP schema itself rejects values outside the allowed set; ward.py double-checks."""
    from mcp.server.fastmcp.exceptions import ToolError

    call("select_patient", bed="12")
    call("confirm_identity", confirmed=True)
    with pytest.raises(ToolError):
        asyncio.run(srv.mcp.call_tool("set_status", {"condition": "fantastic"}))
    with pytest.raises(ward.WardError):
        ward.set_status(condition="fantastic")
    assert ward.snapshot()["records"]["P1"]["condition"] is None


def test_cannot_sign_until_every_section_confirmed():
    call("select_patient", bed="12")
    call("confirm_identity", confirmed=True)
    call("record_vitals", hr=88)
    r = call("sign_and_send", doctor_confirmed=True)
    assert "Still to confirm" in r["error"]


def test_sign_sends_report_and_locks():
    full_round()
    rb = call("read_back")
    assert rb["ready_to_sign"] and "Ramesh Kumar" in rb["summary"]
    signed = call("sign_and_send", doctor_confirmed=True)
    assert signed["family_update"] == "sent"
    assert signed["delivery"].startswith("preview_only")
    snap = ward.snapshot()
    assert snap["records"]["P1"]["status"] == "signed"
    assert snap["reports"][0]["plan"] == ["Ceftriaxone IV to Cefuroxime 500 mg oral 12-hourly"]
    # Locked: further edits are refused.
    call("select_patient", bed="12")
    assert "locked" in call("record_vitals", hr=90)["error"]


def test_critical_condition_holds_email():
    full_round(condition="critical")
    signed = call("sign_and_send", doctor_confirmed=True)
    assert signed["family_update"] == "held_call_family"
    assert ward.snapshot()["reports"][0]["recipients"] == []


def test_touch_fallback_uses_same_rules():
    ward.apply_touch("P1", "select", {})
    with pytest.raises(ward.WardError):
        ward.apply_touch("P1", "set_vital", {"key": "hr", "value": 80})
    ward.apply_touch("P1", "verify", {})
    ward.apply_touch("P1", "set_vital", {"key": "hr", "value": 80})
    rec = ward.snapshot()["records"]["P1"]
    assert rec["vitals"]["hr"] == 80 and rec["audit"][-1]["via"] == "touch"


def test_email_render_escapes_and_includes_note():
    full_round()
    call("sign_and_send", doctor_confirmed=True)
    report = ward.snapshot()["reports"][0]
    mail = ward.render_email(report, "Anita")
    assert "Daily update for Ramesh Kumar" in mail["subject"]
    assert "breathing more comfortably" in mail["html"] and "Dear Anita" in mail["html"]
